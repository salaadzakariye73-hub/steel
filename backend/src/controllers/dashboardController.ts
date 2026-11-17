import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { Product } from '../models/Product.ts';
import { Rental } from '../models/Rental.ts';
import { RentalReturn } from '../models/RentalReturn.ts';
import { Invoice } from '../models/Invoice.ts';
import { Payment } from '../models/Payment.ts';
import { Expense } from '../models/Expense.ts';
import { refreshSystemNotifications } from '../services/billingService.ts';
import { roundMoney } from '../utils/sequences.ts';

export async function getDashboardOverview(_req: AuthenticatedRequest, res: Response): Promise<void> {
  await refreshSystemNotifications();

  const [products, rentals, returns, invoices, payments, expenses] = await Promise.all([
    Product.find({ isActive: true }).lean(),
    Rental.find({ status: { $ne: 'CANCELLED' } })
      .populate('customer', 'name companyName phone')
      .populate('project', 'name location')
      .sort({ createdAt: -1 })
      .lean(),
    RentalReturn.find().lean(),
    Invoice.find({ status: { $ne: 'VOID' } }).lean(),
    Payment.find().sort({ paymentDate: -1 }).lean(),
    Expense.find().lean(),
  ]);

  // Inventory metrics
  let totalInventory = 0;
  let availableProps = 0;
  let rentedProps = 0;
  let damagedProps = 0;
  let lostProps = 0;

  for (const p of products) {
    totalInventory += p.totalQuantity;
    availableProps += p.availableQuantity;
    rentedProps += p.rentedQuantity;
    damagedProps += p.damagedQuantity;
    lostProps += p.lostQuantity;
  }

  let returnedProps = 0;
  for (const ret of returns) {
    for (const item of ret.items) {
      returnedProps += item.returnedGoodQty;
    }
  }

  const activeRentals = rentals.filter((r) =>
    ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'].includes(r.status)
  ).length;
  const overdueRentals = rentals.filter((r) => r.status === 'OVERDUE').length;

  // Financial metrics (Strict rule: Received Income ONLY comes from Payments, not uncollected Invoices)
  const totalRentalRevenue = roundMoney(
    invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  );
  const totalPaymentsReceived = roundMoney(
    payments.reduce((sum, pay) => sum + (pay.usdEquivalent || 0), 0)
  );
  const outstandingBalances = roundMoney(
    invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0)
  );
  const totalExpenses = roundMoney(
    expenses.reduce((sum, exp) => sum + (exp.usdEquivalent || 0), 0)
  );

  // Build 6-month revenue & cash collected chart series
  const now = new Date();
  const months: { key: string; label: string; billedRevenue: number; cashCollected: number; expenses: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    months.push({ key, label, billedRevenue: 0, cashCollected: 0, expenses: 0 });
  }

  const monthMap = new Map(months.map((m) => [m.key, m]));

  for (const inv of invoices) {
    const k = new Date(inv.issueDate).toISOString().slice(0, 7);
    const bucket = monthMap.get(k);
    if (bucket) {
      bucket.billedRevenue = roundMoney(bucket.billedRevenue + inv.totalAmount);
    }
  }

  for (const pay of payments) {
    const k = new Date(pay.paymentDate).toISOString().slice(0, 7);
    const bucket = monthMap.get(k);
    if (bucket) {
      bucket.cashCollected = roundMoney(bucket.cashCollected + pay.usdEquivalent);
    }
  }

  for (const exp of expenses) {
    const k = new Date(exp.expenseDate).toISOString().slice(0, 7);
    const bucket = monthMap.get(k);
    if (bucket) {
      bucket.expenses = roundMoney(bucket.expenses + exp.usdEquivalent);
    }
  }

  const recentRentals = rentals.slice(0, 6);
  const overdueList = rentals.filter((r) => r.status === 'OVERDUE').slice(0, 5);
  const lowStockProducts = products.filter((p) => p.availableQuantity <= p.minStockThreshold);

  res.json({
    kpis: {
      totalInventory,
      availableProps,
      rentedProps,
      returnedProps,
      damagedProps,
      lostProps,
      activeRentals,
      overdueRentals,
      totalRentalRevenue,
      totalPaymentsReceived,
      outstandingBalances,
      totalExpenses,
      netCashProfit: roundMoney(totalPaymentsReceived - totalExpenses),
    },
    monthlyChart: months,
    recentRentals,
    overdueList,
    lowStockProducts,
    stockByCategory: products.map((p) => ({
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      available: p.availableQuantity,
      rented: p.rentedQuantity,
      damaged: p.damagedQuantity,
      lost: p.lostQuantity,
      total: p.totalQuantity,
    })),
  });
}
