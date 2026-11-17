import type { Response } from 'express';
import { z } from 'zod';
import { Customer } from '../models/Customer.ts';
import { Project } from '../models/Project.ts';
import { Rental } from '../models/Rental.ts';
import { Invoice } from '../models/Invoice.ts';
import { Payment } from '../models/Payment.ts';
import { generateCode, roundMoney } from '../utils/sequences.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export const customerSchema = z.object({
  name: z.string().min(2).max(140),
  phone: z.string().min(5).max(40),
  email: z.string().email().or(z.literal('')).optional().default(''),
  address: z.string().optional().default(''),
  companyName: z.string().optional().default(''),
  identificationNumber: z.string().optional().default(''),
  registrationDate: z.string().optional(),
  notes: z.string().optional().default(''),
});

export async function listCustomers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const search = String(req.query.search || '').trim();
  const filter: Record<string, unknown> = { isActive: true };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { companyName: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { customerCode: { $regex: search, $options: 'i' } },
    ];
  }

  const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();

  const [projects, rentals, invoices] = await Promise.all([
    Project.find().select('customer status').lean(),
    Rental.find({ status: { $ne: 'CANCELLED' } }).select('customer status').lean(),
    Invoice.find({ status: { $ne: 'VOID' } }).select('customer totalAmount paidAmount balanceAmount').lean(),
  ]);

  const enriched = customers.map((c) => {
    const id = String(c._id);
    const custProjects = projects.filter((p) => String(p.customer) === id);
    const custRentals = rentals.filter((r) => String(r.customer) === id);
    const custInvoices = invoices.filter((i) => String(i.customer) === id);

    return {
      ...c,
      activeProjectsCount: custProjects.filter((p) => p.status === 'ACTIVE').length,
      totalProjectsCount: custProjects.length,
      activeRentalsCount: custRentals.filter((r) =>
        ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'].includes(r.status)
      ).length,
      totalBilled: roundMoney(custInvoices.reduce((s, i) => s + i.totalAmount, 0)),
      totalPaid: roundMoney(custInvoices.reduce((s, i) => s + i.paidAmount, 0)),
      outstandingBalance: roundMoney(custInvoices.reduce((s, i) => s + i.balanceAmount, 0)),
    };
  });

  res.json({ customers: enriched });
}

export async function getCustomerDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) {
    throw new HttpError(404, 'Customer not found');
  }

  const [projects, rentals, invoices, payments] = await Promise.all([
    Project.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
    Rental.find({ customer: customer._id })
      .populate('project', 'name projectCode')
      .sort({ createdAt: -1 })
      .lean(),
    Invoice.find({ customer: customer._id }).sort({ issueDate: -1 }).lean(),
    Payment.find({ customer: customer._id })
      .populate('rental', 'rentalNumber')
      .sort({ paymentDate: -1 })
      .lean(),
  ]);

  const totalBilled = roundMoney(invoices.reduce((s, i) => s + i.totalAmount, 0));
  const totalPaid = roundMoney(invoices.reduce((s, i) => s + i.paidAmount, 0));
  const outstandingBalance = roundMoney(invoices.reduce((s, i) => s + i.balanceAmount, 0));

  res.json({
    customer,
    projects,
    rentals,
    invoices,
    payments,
    financialSummary: { totalBilled, totalPaid, outstandingBalance },
  });
}

export async function createCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof customerSchema>;
  const customerCode = await generateCode(Customer, 'customerCode', 'CUS', false);

  const customer = await Customer.create({
    ...data,
    customerCode,
    registrationDate: data.registrationDate ? new Date(data.registrationDate) : new Date(),
  });

  await recordAuditLog({
    req,
    action: 'CUSTOMER_CREATED',
    entityType: 'Customer',
    entityId: String(customer._id),
    summary: `Registered customer ${customer.name} (${customer.customerCode}).`,
  });

  res.status(201).json({ customer });
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as Partial<z.infer<typeof customerSchema>>;
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { $set: data },
    { new: true, runValidators: true }
  );

  if (!customer) {
    throw new HttpError(404, 'Customer not found');
  }

  await recordAuditLog({
    req,
    action: 'CUSTOMER_UPDATED',
    entityType: 'Customer',
    entityId: String(customer._id),
    summary: `Updated customer ${customer.name} (${customer.customerCode}).`,
  });

  res.json({ customer });
}

export async function deleteCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    throw new HttpError(404, 'Customer not found');
  }

  const openRental = await Rental.exists({
    customer: customer._id,
    status: { $in: ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'] },
  });
  if (openRental) {
    throw new HttpError(400, 'Cannot archive customer with active or overdue rentals.');
  }

  customer.isActive = false;
  await customer.save();

  await recordAuditLog({
    req,
    action: 'CUSTOMER_ARCHIVED',
    entityType: 'Customer',
    entityId: String(customer._id),
    summary: `Archived customer ${customer.name} (${customer.customerCode}).`,
  });

  res.json({ success: true });
}
