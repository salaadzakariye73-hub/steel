import type { Response } from 'express';
import { z } from 'zod';
import { Invoice } from '../models/Invoice.ts';
import { Payment } from '../models/Payment.ts';
import { Rental } from '../models/Rental.ts';
import { RentalItem } from '../models/RentalItem.ts';
import { Customer } from '../models/Customer.ts';
import { InventoryTransaction } from '../models/InventoryTransaction.ts';
import { DamageRecord } from '../models/DamageRecord.ts';
import { Expense } from '../models/Expense.ts';
import { generateCode, roundMoney } from '../utils/sequences.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { env } from '../config/env.ts';

export const createExpenseSchema = z.object({
  category: z.enum([
    'MAINTENANCE',
    'TRANSPORT',
    'WAREHOUSE',
    'SALARIES',
    'UTILITIES',
    'PURCHASE',
    'OTHER',
  ]),
  description: z.string().min(2),
  amount: z.coerce.number().positive(),
  currency: z.enum(['USD', 'SOS']).default('USD'),
  exchangeRate: z.coerce.number().positive().optional(),
  expenseDate: z.string().optional(),
  vendor: z.string().optional().default(''),
});

export async function getReportsData(req: AuthenticatedRequest, res: Response): Promise<void> {
  const startDateStr = String(req.query.startDate || '').trim();
  const endDateStr = String(req.query.endDate || '').trim();
  const customerId = String(req.query.customerId || '').trim();
  const projectId = String(req.query.projectId || '').trim();
  const productId = String(req.query.productId || '').trim();

  const dateFilter = (field: string) => {
    const f: Record<string, unknown> = {};
    if (startDateStr || endDateStr) {
      const range: Record<string, Date> = {};
      if (startDateStr) range.$gte = new Date(startDateStr);
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setUTCHours(23, 59, 59, 999);
        range.$lte = end;
      }
      f[field] = range;
    }
    return f;
  };

  const rentalFilter: Record<string, unknown> = { status: { $ne: 'CANCELLED' } };
  if (customerId) rentalFilter.customer = customerId;
  if (projectId) rentalFilter.project = projectId;
  Object.assign(rentalFilter, dateFilter('startDate'));

  const paymentFilter: Record<string, unknown> = { ...dateFilter('paymentDate') };
  if (customerId) paymentFilter.customer = customerId;

  const invoiceFilter: Record<string, unknown> = { status: { $ne: 'VOID' }, ...dateFilter('issueDate') };
  if (customerId) invoiceFilter.customer = customerId;
  if (projectId) invoiceFilter.project = projectId;

  const txFilter: Record<string, unknown> = { ...dateFilter('createdAt') };
  if (productId) txFilter.product = productId;

  const dmgFilter: Record<string, unknown> = { ...dateFilter('inspectionDate') };
  if (customerId) dmgFilter.customer = customerId;
  if (productId) dmgFilter.product = productId;

  const expFilter: Record<string, unknown> = { ...dateFilter('expenseDate') };

  const [rentals, rentalItems, payments, invoices, customers, transactions, damages, expenses] =
    await Promise.all([
      Rental.find(rentalFilter)
        .populate('customer', 'name companyName phone')
        .populate('project', 'name location')
        .sort({ startDate: -1 })
        .lean(),
      RentalItem.find(productId ? { product: productId } : {})
        .populate('product', 'name sku')
        .lean(),
      Payment.find(paymentFilter)
        .populate('customer', 'name companyName')
        .populate('rental', 'rentalNumber')
        .sort({ paymentDate: -1 })
        .lean(),
      Invoice.find(invoiceFilter)
        .populate('customer', 'name companyName')
        .populate('project', 'name')
        .lean(),
      Customer.find({ isActive: true }).lean(),
      InventoryTransaction.find(txFilter)
        .populate('product', 'name sku')
        .populate('performedBy', 'name')
        .populate('rental', 'rentalNumber')
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
      DamageRecord.find(dmgFilter)
        .populate('product', 'name sku')
        .populate('customer', 'name')
        .populate('rental', 'rentalNumber')
        .sort({ inspectionDate: -1 })
        .lean(),
      Expense.find(expFilter)
        .populate('recordedBy', 'name')
        .sort({ expenseDate: -1 })
        .lean(),
    ]);

  // Filter rentals by product if productId filter is specified
  const matchingRentalIds = productId
    ? new Set(rentalItems.map((it) => String(it.rental)))
    : null;
  const filteredRentals = matchingRentalIds
    ? rentals.filter((r) => matchingRentalIds.has(String(r._id)))
    : rentals;

  // Revenue grouping (Daily, Weekly, Monthly, Annual) from actual Payments (received income) + Invoices (billed)
  const groupPaymentsBy = (keyFn: (d: Date) => string) => {
    const map = new Map<string, { period: string; collectedUsd: number; paymentCount: number }>();
    for (const p of payments) {
      const k = keyFn(new Date(p.paymentDate));
      const entry = map.get(k) || { period: k, collectedUsd: 0, paymentCount: 0 };
      entry.collectedUsd = roundMoney(entry.collectedUsd + p.usdEquivalent);
      entry.paymentCount += 1;
      map.set(k, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
  };

  const dailyRevenue = groupPaymentsBy((d) => d.toISOString().slice(0, 10));
  const weeklyRevenue = groupPaymentsBy((d) => {
    const temp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  });
  const monthlyRevenue = groupPaymentsBy((d) => d.toISOString().slice(0, 7));
  const annualRevenue = groupPaymentsBy((d) => String(d.getUTCFullYear()));

  // Customer balances
  const allInvoices = await Invoice.find({ status: { $ne: 'VOID' } }).lean();
  const customerBalances = customers
    .filter((c) => !customerId || String(c._id) === customerId)
    .map((c) => {
      const cid = String(c._id);
      const cinvs = allInvoices.filter((i) => String(i.customer) === cid);
      const totalBilled = roundMoney(cinvs.reduce((s, i) => s + i.totalAmount, 0));
      const totalPaid = roundMoney(cinvs.reduce((s, i) => s + i.paidAmount, 0));
      const balance = roundMoney(cinvs.reduce((s, i) => s + i.balanceAmount, 0));
      return {
        customerId: cid,
        customerCode: c.customerCode,
        name: c.name,
        companyName: c.companyName,
        phone: c.phone,
        invoiceCount: cinvs.length,
        totalBilled,
        totalPaid,
        balance,
      };
    })
    .sort((a, b) => b.balance - a.balance);

  const totalCollected = roundMoney(payments.reduce((s, p) => s + p.usdEquivalent, 0));
  const totalBilled = roundMoney(invoices.reduce((s, i) => s + i.totalAmount, 0));
  const totalExpenses = roundMoney(expenses.reduce((s, e) => s + e.usdEquivalent, 0));

  res.json({
    revenue: {
      daily: dailyRevenue,
      weekly: weeklyRevenue,
      monthly: monthlyRevenue,
      annual: annualRevenue,
    },
    rentals: {
      active: filteredRentals.filter((r) => ['ACTIVE', 'PARTIALLY_RETURNED'].includes(r.status)),
      completed: filteredRentals.filter((r) => r.status === 'COMPLETED'),
      overdue: filteredRentals.filter((r) => r.status === 'OVERDUE'),
    },
    customerBalances,
    inventoryMovement: transactions,
    damagedEquipment: damages.filter((d) => d.damagedQuantity > 0),
    lostEquipment: damages.filter((d) => d.lostQuantity > 0),
    profitAndExpenses: {
      totalBilled,
      totalCollected,
      totalExpenses,
      netCashProfit: roundMoney(totalCollected - totalExpenses),
      expenses,
    },
  });
}

export async function listExpenses(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const expenses = await Expense.find()
    .populate('recordedBy', 'name role')
    .sort({ expenseDate: -1 })
    .lean();
  res.json({ expenses });
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof createExpenseSchema>;
  const exchangeRate = data.currency === 'SOS' ? data.exchangeRate || env.SOS_EXCHANGE_RATE : 1;
  const usdEquivalent =
    data.currency === 'SOS' ? roundMoney(data.amount / exchangeRate) : roundMoney(data.amount);

  const expenseNumber = await generateCode(Expense, 'expenseNumber', 'EXP', true);

  const expense = await Expense.create({
    expenseNumber,
    category: data.category,
    description: data.description,
    amount: roundMoney(data.amount),
    currency: data.currency,
    usdEquivalent,
    expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
    vendor: data.vendor,
    recordedBy: req.user!.id,
  });

  await recordAuditLog({
    req,
    action: 'EXPENSE_RECORDED',
    entityType: 'Expense',
    entityId: String(expense._id),
    summary: `Recorded expense ${expense.expenseNumber} ($${usdEquivalent.toFixed(2)} - ${expense.category}).`,
  });

  res.status(201).json({ expense });
}
