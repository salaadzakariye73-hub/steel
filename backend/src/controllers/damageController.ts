import type { Response } from 'express';
import { z } from 'zod';
import { runInTransaction } from '../config/db.ts';
import { DamageRecord } from '../models/DamageRecord.ts';
import { Product } from '../models/Product.ts';
import { Rental } from '../models/Rental.ts';
import { InventoryTransaction } from '../models/InventoryTransaction.ts';
import { syncRentalAndInvoice, refreshSystemNotifications } from '../services/billingService.ts';
import { generateCode, roundMoney } from '../utils/sequences.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export const createDamageSchema = z.object({
  product: z.string().min(1),
  rental: z.string().optional().or(z.literal('')),
  customer: z.string().optional().or(z.literal('')),
  damagedQuantity: z.coerce.number().int().min(0).default(0),
  lostQuantity: z.coerce.number().int().min(0).default(0),
  damageDescription: z.string().min(3),
  inspectionDate: z.string().optional(),
  replacementCost: z.coerce.number().min(0).default(0),
  responsibility: z.enum(['CUSTOMER', 'COMPANY', 'SHARED']).default('CUSTOMER'),
  notes: z.string().optional().default(''),
});

export async function listDamages(req: AuthenticatedRequest, res: Response): Promise<void> {
  const responsibility = String(req.query.responsibility || '').trim();
  const resolved = String(req.query.resolved || '').trim();

  const filter: Record<string, unknown> = {};
  if (responsibility && responsibility !== 'ALL') filter.responsibility = responsibility;
  if (resolved === 'true') filter.resolved = true;
  if (resolved === 'false') filter.resolved = false;

  const records = await DamageRecord.find(filter)
    .populate('product', 'name sku dailyRentalPrice purchasePrice')
    .populate('rental', 'rentalNumber status')
    .populate('customer', 'name companyName phone')
    .populate('inspectedBy', 'name role')
    .sort({ inspectionDate: -1, createdAt: -1 })
    .lean();

  res.json({ records });
}

export async function createDamageRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof createDamageSchema>;

  if (data.damagedQuantity + data.lostQuantity <= 0) {
    throw new HttpError(400, 'Damaged quantity or lost quantity must be greater than zero.');
  }

  const record = await runInTransaction(async (session) => {
    const prodQuery = Product.findById(data.product);
    if (session) prodQuery.session(session);
    const product = await prodQuery;

    if (!product) {
      throw new HttpError(404, 'Product not found');
    }

    const totalAffected = data.damagedQuantity + data.lostQuantity;
    if (product.availableQuantity < totalAffected) {
      throw new HttpError(
        400,
        `Cannot mark ${totalAffected} available units damaged/lost; only ${product.availableQuantity} available in warehouse. For rented items, record damage during rental return.`
      );
    }

    const prevAvail = product.availableQuantity;
    product.availableQuantity -= totalAffected;
    product.damagedQuantity += data.damagedQuantity;
    product.lostQuantity += data.lostQuantity;
    await product.save({ session: session || undefined });

    if (data.damagedQuantity > 0) {
      await InventoryTransaction.create(
        [
          {
            product: product._id,
            type: 'DAMAGED',
            quantity: -data.damagedQuantity,
            previousAvailable: prevAvail,
            newAvailable: prevAvail - data.damagedQuantity,
            rental: data.rental ? data.rental : undefined,
            performedBy: req.user!.id,
            notes: `Warehouse inspection: ${data.damageDescription}`,
          },
        ],
        session ? { session } : undefined
      );
    }

    if (data.lostQuantity > 0) {
      await InventoryTransaction.create(
        [
          {
            product: product._id,
            type: 'LOST',
            quantity: -data.lostQuantity,
            previousAvailable: prevAvail - data.damagedQuantity,
            newAvailable: product.availableQuantity,
            rental: data.rental ? data.rental : undefined,
            performedBy: req.user!.id,
            notes: `Warehouse loss report: ${data.damageDescription}`,
          },
        ],
        session ? { session } : undefined
      );
    }

    let resolvedCustomerId = data.customer || undefined;
    if (data.rental && !resolvedCustomerId) {
      const r = await Rental.findById(data.rental).session(session).select('customer').lean();
      if (r) resolvedCustomerId = String(r.customer);
    }

    const recordNumber = await generateCode(DamageRecord, 'recordNumber', 'DMG', true, session);
    const [created] = await DamageRecord.create(
      [
        {
          recordNumber,
          product: product._id,
          rental: data.rental || undefined,
          customer: resolvedCustomerId,
          damagedQuantity: data.damagedQuantity,
          lostQuantity: data.lostQuantity,
          damageDescription: data.damageDescription,
          inspectionDate: data.inspectionDate ? new Date(data.inspectionDate) : new Date(),
          replacementCost: roundMoney(data.replacementCost),
          responsibility: data.responsibility,
          resolved: false,
          notes: data.notes,
          inspectedBy: req.user!.id,
        },
      ],
      session ? { session } : undefined
    );

    if (data.rental) {
      await syncRentalAndInvoice(data.rental, session);
    }

    return created;
  });

  await recordAuditLog({
    req,
    action: 'DAMAGE_RECORD_CREATED',
    entityType: 'DamageRecord',
    entityId: String(record._id),
    summary: `Recorded ${record.recordNumber}: ${record.damagedQuantity} damaged, ${record.lostQuantity} lost.`,
  });

  await refreshSystemNotifications();

  res.status(201).json({ record });
}

export async function toggleDamageResolved(req: AuthenticatedRequest, res: Response): Promise<void> {
  const record = await DamageRecord.findById(req.params.id);
  if (!record) {
    throw new HttpError(404, 'Damage record not found');
  }

  record.resolved = !record.resolved;
  await record.save();

  await recordAuditLog({
    req,
    action: 'DAMAGE_STATUS_UPDATED',
    entityType: 'DamageRecord',
    entityId: String(record._id),
    summary: `Marked damage record ${record.recordNumber} as ${record.resolved ? 'Resolved' : 'Open'}.`,
  });

  res.json({ record });
}
