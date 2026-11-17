import type { Response } from 'express';
import { z } from 'zod';
import { runInTransaction } from '../config/db.ts';
import { Payment } from '../models/Payment.ts';
import { Invoice } from '../models/Invoice.ts';
import { Rental } from '../models/Rental.ts';
import { syncRentalAndInvoice, refreshSystemNotifications } from '../services/billingService.ts';
import { generateCode, roundMoney } from '../utils/sequences.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';
import { env } from '../config/env.ts';

export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  currency: z.enum(['USD', 'SOS']).default('USD'),
  exchangeRate: z.coerce.number().positive().optional(),
  paymentMethod: z.enum(['CASH_USD', 'CASH_SOS', 'MOBILE_MONEY', 'BANK_TRANSFER']),
  paymentDate: z.string().optional(),
  referenceNumber: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
  notes: z.string().optional().default(''),
});

export async function listPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = String(req.query.customerId || '').trim();
  const rentalId = String(req.query.rentalId || '').trim();
  const method = String(req.query.paymentMethod || '').trim();
  const search = String(req.query.search || '').trim();

  const filter: Record<string, unknown> = {};
  if (customerId) filter.customer = customerId;
  if (rentalId) filter.rental = rentalId;
  if (method && method !== 'ALL') filter.paymentMethod = method;
  if (search) {
    filter.$or = [
      { paymentNumber: { $regex: search, $options: 'i' } },
      { referenceNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const payments = await Payment.find(filter)
    .populate('customer', 'name companyName customerCode phone')
    .populate('rental', 'rentalNumber')
    .populate('invoice', 'invoiceNumber totalAmount balanceAmount status')
    .populate('receivedBy', 'name role')
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  res.json({ payments });
}

export async function createPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof createPaymentSchema>;

  // Idempotency / duplicate check
  if (data.idempotencyKey) {
    const existingByKey = await Payment.findOne({ idempotencyKey: data.idempotencyKey }).lean();
    if (existingByKey) {
      throw new HttpError(409, 'Duplicate payment submission detected (idempotency key already used).');
    }
  }

  if (data.referenceNumber) {
    const existingByRef = await Payment.findOne({ referenceNumber: data.referenceNumber }).lean();
    if (existingByRef) {
      throw new HttpError(
        409,
        `Duplicate payment blocked: Reference number "${data.referenceNumber}" is already recorded on ${existingByRef.paymentNumber}.`
      );
    }
  }

  const exchangeRate =
    data.currency === 'SOS' ? data.exchangeRate || env.SOS_EXCHANGE_RATE : 1;
  const usdEquivalent =
    data.currency === 'SOS' ? roundMoney(data.amount / exchangeRate) : roundMoney(data.amount);

  if (usdEquivalent <= 0) {
    throw new HttpError(400, 'Converted USD payment amount must be positive.');
  }

  const result = await runInTransaction(async (session) => {
    const invQuery = Invoice.findById(data.invoiceId);
    if (session) invQuery.session(session);
    const invoice = await invQuery;

    if (!invoice) {
      throw new HttpError(404, 'Invoice not found.');
    }
    if (invoice.status === 'VOID') {
      throw new HttpError(400, 'Cannot record payment against a voided invoice.');
    }
    if (invoice.balanceAmount <= 0) {
      throw new HttpError(400, 'This invoice is already fully paid.');
    }
    if (usdEquivalent > roundMoney(invoice.balanceAmount + 0.01)) {
      throw new HttpError(
        400,
        `Payment ($${usdEquivalent.toFixed(2)}) exceeds remaining invoice balance ($${invoice.balanceAmount.toFixed(2)}).`
      );
    }

    const rentalQuery = Rental.findById(invoice.rental);
    if (session) rentalQuery.session(session);
    const rental = await rentalQuery;

    const paymentNumber = await generateCode(Payment, 'paymentNumber', 'PAY', true, session);

    const [payment] = await Payment.create(
      [
        {
          paymentNumber,
          customer: invoice.customer,
          rental: invoice.rental,
          invoice: invoice._id,
          amount: roundMoney(data.amount),
          currency: data.currency,
          exchangeRate,
          usdEquivalent,
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          referenceNumber: data.referenceNumber || undefined,
          idempotencyKey: data.idempotencyKey || undefined,
          notes: data.notes,
          receivedBy: req.user!.id,
        },
      ],
      session ? { session } : undefined
    );

    invoice.paidAmount = roundMoney(invoice.paidAmount + usdEquivalent);
    invoice.balanceAmount = roundMoney(Math.max(0, invoice.totalAmount - invoice.paidAmount));
    await invoice.save({ session: session || undefined });

    if (rental) {
      await syncRentalAndInvoice(String(rental._id), session);
    }

    const refreshedInvoice = await Invoice.findById(invoice._id)
      .populate('customer')
      .populate('project')
      .populate('rental')
      .session(session)
      .lean();

    const populatedPayment = await Payment.findById(payment._id)
      .populate('customer', 'name companyName customerCode phone address')
      .populate('rental', 'rentalNumber')
      .populate('invoice', 'invoiceNumber totalAmount paidAmount balanceAmount status')
      .populate('receivedBy', 'name role')
      .session(session)
      .lean();

    return { payment: populatedPayment, invoice: refreshedInvoice };
  });

  await recordAuditLog({
    req,
    action: 'PAYMENT_RECORDED',
    entityType: 'Payment',
    entityId: String(result.payment?._id),
    summary: `Recorded payment ${result.payment?.paymentNumber} ($${usdEquivalent.toFixed(2)} via ${data.paymentMethod}) for ${result.invoice?.invoiceNumber}.`,
  });

  await refreshSystemNotifications();

  res.status(201).json(result);
}

export async function deletePaymentForbidden(_req: AuthenticatedRequest, _res: Response): Promise<void> {
  throw new HttpError(
    403,
    'Financial integrity policy: Recorded payments cannot be deleted. Contact Admin to issue an adjustment or audit note.'
  );
}
