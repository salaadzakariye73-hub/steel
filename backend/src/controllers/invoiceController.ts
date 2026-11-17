import type { Response } from 'express';
import { Invoice } from '../models/Invoice.ts';
import { RentalItem } from '../models/RentalItem.ts';
import { RentalReturn } from '../models/RentalReturn.ts';
import { Payment } from '../models/Payment.ts';
import { syncRentalAndInvoice } from '../services/billingService.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export async function listInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const status = String(req.query.status || '').trim();
  const customerId = String(req.query.customerId || '').trim();
  const search = String(req.query.search || '').trim();

  const filter: Record<string, unknown> = {};
  if (status && status !== 'ALL') filter.status = status;
  if (customerId) filter.customer = customerId;
  if (search) {
    filter.invoiceNumber = { $regex: search, $options: 'i' };
  }

  const invoices = await Invoice.find(filter)
    .populate('customer', 'name companyName phone email address customerCode')
    .populate('project', 'name projectCode location')
    .populate('rental', 'rentalNumber startDate expectedReturnDate actualCloseDate status depositAmount')
    .sort({ issueDate: -1 })
    .lean();

  res.json({ invoices });
}

export async function getInvoiceDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const existing = await Invoice.findById(req.params.id).lean();
  if (!existing) {
    throw new HttpError(404, 'Invoice not found');
  }

  // Ensure live up-to-date billing calculation
  await syncRentalAndInvoice(String(existing.rental));

  const invoice = await Invoice.findById(req.params.id)
    .populate('customer')
    .populate('project')
    .populate('rental')
    .lean();

  const [rentalItems, returns, payments] = await Promise.all([
    RentalItem.find({ rental: existing.rental }).populate('product', 'name sku').lean(),
    RentalReturn.find({ rental: existing.rental }).sort({ returnDate: 1 }).lean(),
    Payment.find({ invoice: existing._id }).populate('receivedBy', 'name role').sort({ paymentDate: -1 }).lean(),
  ]);

  res.json({
    invoice,
    rentalItems,
    returns,
    payments,
  });
}

export async function deleteInvoiceForbidden(): Promise<void> {
  throw new HttpError(
    403,
    'Financial integrity policy: Invoices cannot be deleted once issued.'
  );
}
