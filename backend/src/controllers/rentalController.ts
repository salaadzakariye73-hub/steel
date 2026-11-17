import type { Response } from 'express';
import { z } from 'zod';
import { runInTransaction } from '../config/db.ts';
import { Rental } from '../models/Rental.ts';
import { RentalItem } from '../models/RentalItem.ts';
import { RentalReturn } from '../models/RentalReturn.ts';
import { Product } from '../models/Product.ts';
import { Customer } from '../models/Customer.ts';
import { Project } from '../models/Project.ts';
import { Invoice } from '../models/Invoice.ts';
import { Payment } from '../models/Payment.ts';
import { DamageRecord } from '../models/DamageRecord.ts';
import { InventoryTransaction } from '../models/InventoryTransaction.ts';
import { syncRentalAndInvoice, refreshSystemNotifications } from '../services/billingService.ts';
import {
  calculateRentalDays,
  diffDaysUtc,
  generateCode,
  roundMoney,
  toUtcDayStart,
} from '../utils/sequences.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export const createRentalSchema = z.object({
  customer: z.string().min(1),
  project: z.string().min(1),
  startDate: z.string().min(1),
  expectedReturnDate: z.string().min(1),
  depositAmount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        product: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
        dailyRate: z.coerce.number().positive(),
      })
    )
    .min(1, 'At least one product line item is required'),
});

export const extendRentalSchema = z.object({
  newExpectedReturnDate: z.string().min(1),
  reason: z.string().optional().default('Project schedule extension'),
});

export const processReturnSchema = z.object({
  returnDate: z.string().min(1),
  notes: z.string().optional().default(''),
  responsibility: z.enum(['CUSTOMER', 'COMPANY', 'SHARED']).optional().default('CUSTOMER'),
  items: z
    .array(
      z.object({
        rentalItemId: z.string().min(1),
        returnedGoodQty: z.coerce.number().int().min(0).default(0),
        damagedQty: z.coerce.number().int().min(0).default(0),
        lostQty: z.coerce.number().int().min(0).default(0),
        replacementCost: z.coerce.number().min(0).optional().default(0),
        damageDescription: z.string().optional().default(''),
      })
    )
    .min(1),
});

export async function listRentals(req: AuthenticatedRequest, res: Response): Promise<void> {
  const status = String(req.query.status || '').trim();
  const customerId = String(req.query.customerId || '').trim();
  const projectId = String(req.query.projectId || '').trim();
  const search = String(req.query.search || '').trim();

  const filter: Record<string, unknown> = {};
  if (status && status !== 'ALL') filter.status = status;
  if (customerId) filter.customer = customerId;
  if (projectId) filter.project = projectId;
  if (search) {
    filter.rentalNumber = { $regex: search, $options: 'i' };
  }

  const rentals = await Rental.find(filter)
    .populate('customer', 'name companyName phone customerCode')
    .populate('project', 'name projectCode location')
    .sort({ createdAt: -1 })
    .lean();

  const rentalIds = rentals.map((r) => r._id);
  const [items, invoices] = await Promise.all([
    RentalItem.find({ rental: { $in: rentalIds } }).populate('product', 'name sku').lean(),
    Invoice.find({ rental: { $in: rentalIds } }).lean(),
  ]);

  const enriched = rentals.map((r) => {
    const rid = String(r._id);
    const rItems = items.filter((it) => String(it.rental) === rid);
    const rInv = invoices.find((inv) => String(inv.rental) === rid);
    const totalInitial = rItems.reduce((s, it) => s + it.initialQuantity, 0);
    const totalRemaining = rItems.reduce((s, it) => s + it.remainingQuantity, 0);
    const currentDailyRate = roundMoney(
      rItems.reduce((s, it) => s + it.remainingQuantity * it.dailyRate, 0)
    );

    return {
      ...r,
      items: rItems,
      invoice: rInv || null,
      totalInitialUnits: totalInitial,
      totalRemainingUnits: totalRemaining,
      currentDailyRate,
    };
  });

  res.json({ rentals: enriched });
}

export async function getRentalDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const rental = await Rental.findById(req.params.id)
    .populate('customer')
    .populate('project')
    .populate('createdBy', 'name role')
    .lean();

  if (!rental) {
    throw new HttpError(404, 'Rental contract not found');
  }

  const [items, returns, invoice, payments, damages] = await Promise.all([
    RentalItem.find({ rental: rental._id }).populate('product').lean(),
    RentalReturn.find({ rental: rental._id })
      .populate('processedBy', 'name role')
      .sort({ returnDate: -1 })
      .lean(),
    Invoice.findOne({ rental: rental._id }).lean(),
    Payment.find({ rental: rental._id })
      .populate('receivedBy', 'name role')
      .sort({ paymentDate: -1 })
      .lean(),
    DamageRecord.find({ rental: rental._id })
      .populate('product', 'name sku')
      .sort({ inspectionDate: -1 })
      .lean(),
  ]);

  res.json({
    rental,
    items,
    returns,
    invoice,
    payments,
    damages,
  });
}

export async function createRental(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof createRentalSchema>;
  const startDate = new Date(data.startDate);
  const expectedReturnDate = new Date(data.expectedReturnDate);

  if (toUtcDayStart(expectedReturnDate) < toUtcDayStart(startDate)) {
    throw new HttpError(400, 'Expected return date must be on or after rental start date.');
  }

  const customer = await Customer.findById(data.customer);
  if (!customer || !customer.isActive) {
    throw new HttpError(404, 'Selected customer not found or inactive.');
  }

  const project = await Project.findById(data.project);
  if (!project || String(project.customer) !== String(customer._id)) {
    throw new HttpError(400, 'Selected project does not belong to the chosen customer.');
  }

  const result = await runInTransaction(async (session) => {
    const rentalNumber = await generateCode(Rental, 'rentalNumber', 'RNT', true, session);
    const rentalDays = calculateRentalDays(startDate, expectedReturnDate);

    // Aggregate quantities per product to validate stock cleanly
    const requestedByProduct = new Map<string, number>();
    for (const item of data.items) {
      requestedByProduct.set(
        item.product,
        (requestedByProduct.get(item.product) || 0) + item.quantity
      );
    }

    const productsMap = new Map<string, InstanceType<typeof Product>>();
    for (const [productId, totalReq] of requestedByProduct.entries()) {
      const prodQuery = Product.findById(productId);
      if (session) prodQuery.session(session);
      const product = await prodQuery;
      if (!product || !product.isActive) {
        throw new HttpError(404, 'One of the selected products does not exist.');
      }
      if (product.availableQuantity < totalReq) {
        throw new HttpError(
          400,
          `Insufficient stock for ${product.name} (${product.sku}). Available: ${product.availableQuantity}, Requested: ${totalReq}.`
        );
      }
      productsMap.set(productId, product);
    }

    const [rental] = await Rental.create(
      [
        {
          rentalNumber,
          customer: customer._id,
          project: project._id,
          startDate,
          expectedReturnDate,
          status: toUtcDayStart(new Date()) > toUtcDayStart(expectedReturnDate) ? 'OVERDUE' : 'ACTIVE',
          depositAmount: roundMoney(data.depositAmount || 0),
          expectedTotalCharge: 0,
          notes: data.notes,
          createdBy: req.user!.id,
        },
      ],
      session ? { session } : undefined
    );

    for (const line of data.items) {
      const product = productsMap.get(line.product)!;
      const prevAvail = product.availableQuantity;

      product.availableQuantity -= line.quantity;
      product.rentedQuantity += line.quantity;
      await product.save({ session: session || undefined });

      await RentalItem.create(
        [
          {
            rental: rental._id,
            product: product._id,
            initialQuantity: line.quantity,
            returnedQuantity: 0,
            damagedQuantity: 0,
            lostQuantity: 0,
            remainingQuantity: line.quantity,
            dailyRate: roundMoney(line.dailyRate),
            lastPeriodStartDate: startDate,
            accruedCharge: 0,
          },
        ],
        session ? { session } : undefined
      );

      await InventoryTransaction.create(
        [
          {
            product: product._id,
            type: 'RENTAL_OUT',
            quantity: -line.quantity,
            previousAvailable: prevAvail,
            newAvailable: product.availableQuantity,
            rental: rental._id,
            performedBy: req.user!.id,
            notes: `Dispatched for ${rentalNumber} (${rentalDays} days est.)`,
          },
        ],
        session ? { session } : undefined
      );
    }

    const invoiceNumber = await generateCode(Invoice, 'invoiceNumber', 'INV', true, session);
    await Invoice.create(
      [
        {
          invoiceNumber,
          rental: rental._id,
          customer: customer._id,
          project: project._id,
          issueDate: startDate,
          dueDate: expectedReturnDate,
          depositAmount: roundMoney(data.depositAmount || 0),
          paidAmount: 0,
          balanceAmount: 0,
          status: 'UNPAID',
          notes: data.notes,
        },
      ],
      session ? { session } : undefined
    );

    const synced = await syncRentalAndInvoice(String(rental._id), session);
    return synced;
  });

  await recordAuditLog({
    req,
    action: 'RENTAL_CREATED',
    entityType: 'Rental',
    entityId: String(result?.rental._id),
    summary: `Created rental ${result?.rental.rentalNumber} for ${customer.name} ($${result?.rental.expectedTotalCharge.toFixed(2)} est.).`,
  });

  await refreshSystemNotifications();

  res.status(201).json(result);
}

export async function extendRental(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { newExpectedReturnDate, reason } = req.body as z.infer<typeof extendRentalSchema>;
  const newDate = new Date(newExpectedReturnDate);

  const result = await runInTransaction(async (session) => {
    const rentalQuery = Rental.findById(req.params.id);
    if (session) rentalQuery.session(session);
    const rental = await rentalQuery;

    if (!rental) {
      throw new HttpError(404, 'Rental contract not found');
    }
    if (rental.status === 'COMPLETED' || rental.status === 'CANCELLED') {
      throw new HttpError(400, 'Cannot extend a closed or cancelled rental.');
    }
    if (toUtcDayStart(newDate) <= toUtcDayStart(rental.expectedReturnDate)) {
      throw new HttpError(
        400,
        'New expected return date must be later than the current expected return date.'
      );
    }

    const itemsQuery = RentalItem.find({ rental: rental._id });
    if (session) itemsQuery.session(session);
    const items = await itemsQuery;

    const addedDays = diffDaysUtc(rental.expectedReturnDate, newDate);
    const additionalEstimatedCharge = roundMoney(
      items.reduce((sum, it) => sum + it.remainingQuantity * it.dailyRate * addedDays, 0)
    );

    rental.extensions.push({
      previousReturnDate: rental.expectedReturnDate,
      newReturnDate: newDate,
      additionalEstimatedCharge,
      reason,
      extendedBy: req.user!.id as unknown as typeof rental.createdBy,
      extendedAt: new Date(),
    });
    rental.expectedReturnDate = newDate;
    await rental.save({ session: session || undefined });

    return syncRentalAndInvoice(String(rental._id), session);
  });

  await recordAuditLog({
    req,
    action: 'RENTAL_EXTENDED',
    entityType: 'Rental',
    entityId: req.params.id,
    summary: `Extended rental ${result?.rental.rentalNumber} return date to ${newDate.toISOString().slice(0, 10)}.`,
  });

  await refreshSystemNotifications();

  res.json(result);
}

export async function processRentalReturn(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof processReturnSchema>;
  const returnDate = new Date(data.returnDate);

  const result = await runInTransaction(async (session) => {
    const rentalQuery = Rental.findById(req.params.id);
    if (session) rentalQuery.session(session);
    const rental = await rentalQuery;

    if (!rental) {
      throw new HttpError(404, 'Rental contract not found');
    }
    if (rental.status === 'COMPLETED' || rental.status === 'CANCELLED') {
      throw new HttpError(400, 'This rental contract is already closed.');
    }
    if (toUtcDayStart(returnDate) < toUtcDayStart(rental.startDate)) {
      throw new HttpError(400, 'Return date cannot be earlier than the rental start date.');
    }

    const rentalItemsQuery = RentalItem.find({ rental: rental._id }).populate('product');
    if (session) rentalItemsQuery.session(session);
    const rentalItems = await rentalItemsQuery;
    const itemMap = new Map(rentalItems.map((it) => [String(it._id), it]));

    let totalUnitsReturnedInBatch = 0;
    let totalPeriodCharge = 0;
    let totalReplacementCharge = 0;
    const returnLineItems = [];

    for (const line of data.items) {
      const totalAccounted = line.returnedGoodQty + line.damagedQty + line.lostQty;
      if (totalAccounted === 0) continue;

      totalUnitsReturnedInBatch += totalAccounted;
      const rentalItem = itemMap.get(line.rentalItemId);
      if (!rentalItem) {
        throw new HttpError(404, `Rental item ${line.rentalItemId} not found on this contract.`);
      }

      if (totalAccounted > rentalItem.remainingQuantity) {
        throw new HttpError(
          400,
          `Cannot process ${totalAccounted} units; only ${rentalItem.remainingQuantity} units remain out.`
        );
      }

      const productDoc = await Product.findById(rentalItem.product).session(session);
      if (!productDoc) {
        throw new HttpError(404, 'Associated product not found.');
      }

      const qtyHeldBeforeReturn = rentalItem.remainingQuantity;
      const rawPeriodDays = diffDaysUtc(rentalItem.lastPeriodStartDate, returnDate);

      let periodDays = 0;
      let periodCharge = 0;
      let periodStart = rentalItem.lastPeriodStartDate;

      if (rawPeriodDays > 0) {
        periodDays = rawPeriodDays;
        periodCharge = roundMoney(qtyHeldBeforeReturn * rentalItem.dailyRate * periodDays);
        rentalItem.lastPeriodStartDate = returnDate;
      } else {
        // Same-day return: bill 1 minimum day on the returned portion only, keep lastPeriodStartDate intact for remaining
        periodDays = 1;
        periodCharge = roundMoney(totalAccounted * rentalItem.dailyRate * 1);
      }

      rentalItem.accruedCharge = roundMoney(rentalItem.accruedCharge + periodCharge);
      rentalItem.returnedQuantity += line.returnedGoodQty;
      rentalItem.damagedQuantity += line.damagedQty;
      rentalItem.lostQuantity += line.lostQty;
      rentalItem.remainingQuantity -= totalAccounted;
      await rentalItem.save({ session: session || undefined });

      // Update inventory safely
      const prevAvail = productDoc.availableQuantity;
      if (productDoc.rentedQuantity < totalAccounted) {
        throw new HttpError(400, `Inventory state mismatch for ${productDoc.name}.`);
      }

      productDoc.rentedQuantity -= totalAccounted;
      productDoc.availableQuantity += line.returnedGoodQty;
      productDoc.damagedQuantity += line.damagedQty;
      productDoc.lostQuantity += line.lostQty;
      await productDoc.save({ session: session || undefined });

      if (line.returnedGoodQty > 0) {
        await InventoryTransaction.create(
          [
            {
              product: productDoc._id,
              type: 'RETURN_IN',
              quantity: line.returnedGoodQty,
              previousAvailable: prevAvail,
              newAvailable: productDoc.availableQuantity,
              rental: rental._id,
              performedBy: req.user!.id,
              notes: `Good units returned from ${rental.rentalNumber}`,
            },
          ],
          session ? { session } : undefined
        );
      }

      if (line.damagedQty > 0) {
        await InventoryTransaction.create(
          [
            {
              product: productDoc._id,
              type: 'DAMAGED',
              quantity: line.damagedQty,
              previousAvailable: productDoc.availableQuantity,
              newAvailable: productDoc.availableQuantity,
              rental: rental._id,
              performedBy: req.user!.id,
              notes: `Damaged units reported on return from ${rental.rentalNumber}`,
            },
          ],
          session ? { session } : undefined
        );
      }

      if (line.lostQty > 0) {
        await InventoryTransaction.create(
          [
            {
              product: productDoc._id,
              type: 'LOST',
              quantity: line.lostQty,
              previousAvailable: productDoc.availableQuantity,
              newAvailable: productDoc.availableQuantity,
              rental: rental._id,
              performedBy: req.user!.id,
              notes: `Lost units reported on return from ${rental.rentalNumber}`,
            },
          ],
          session ? { session } : undefined
        );
      }

      const replacementCost = roundMoney(line.replacementCost || 0);
      if (line.damagedQty > 0 || line.lostQty > 0) {
        const dmgNumber = await generateCode(DamageRecord, 'recordNumber', 'DMG', true, session);
        await DamageRecord.create(
          [
            {
              recordNumber: dmgNumber,
              product: productDoc._id,
              rental: rental._id,
              customer: rental.customer,
              damagedQuantity: line.damagedQty,
              lostQuantity: line.lostQty,
              damageDescription:
                line.damageDescription ||
                `Reported during return inspection for ${rental.rentalNumber}`,
              inspectionDate: returnDate,
              replacementCost,
              responsibility: data.responsibility,
              resolved: false,
              notes: data.notes,
              inspectedBy: req.user!.id,
            },
          ],
          session ? { session } : undefined
        );
      }

      totalPeriodCharge = roundMoney(totalPeriodCharge + periodCharge);
      totalReplacementCharge = roundMoney(totalReplacementCharge + replacementCost);

      returnLineItems.push({
        rentalItem: rentalItem._id,
        product: productDoc._id,
        productName: productDoc.name,
        returnedGoodQty: line.returnedGoodQty,
        damagedQty: line.damagedQty,
        lostQty: line.lostQty,
        quantityHeldBeforeReturn: qtyHeldBeforeReturn,
        periodStartDate: periodStart,
        periodEndDate: returnDate,
        periodDays,
        dailyRate: rentalItem.dailyRate,
        periodCharge,
        replacementCharge: replacementCost,
      });
    }

    if (totalUnitsReturnedInBatch === 0) {
      throw new HttpError(400, 'Please enter at least 1 returned, damaged, or lost quantity.');
    }

    const allRemainingZero = rentalItems.every((it) => it.remainingQuantity === 0);
    const returnNumber = await generateCode(RentalReturn, 'returnNumber', 'RET', true, session);

    const [rentalReturn] = await RentalReturn.create(
      [
        {
          returnNumber,
          rental: rental._id,
          returnDate,
          isFinalReturn: allRemainingZero,
          items: returnLineItems,
          totalPeriodCharge,
          totalReplacementCharge,
          notes: data.notes,
          processedBy: req.user!.id,
        },
      ],
      session ? { session } : undefined
    );

    if (allRemainingZero) {
      rental.actualCloseDate = returnDate;
      await rental.save({ session: session || undefined });
    }

    const synced = await syncRentalAndInvoice(String(rental._id), session);
    return { rentalReturn, ...synced };
  });

  await recordAuditLog({
    req,
    action: result?.rentalReturn.isFinalReturn ? 'RENTAL_FINAL_RETURN' : 'RENTAL_PARTIAL_RETURN',
    entityType: 'Rental',
    entityId: req.params.id,
    summary: `Processed ${result?.rentalReturn.returnNumber} for ${result?.rental?.rentalNumber}. Period charge: $${result?.rentalReturn.totalPeriodCharge.toFixed(2)}.`,
  });

  await refreshSystemNotifications();

  res.status(201).json(result);
}
