import type { ClientSession } from 'mongoose';
import { Rental } from '../models/Rental.ts';
import { RentalItem } from '../models/RentalItem.ts';
import { RentalReturn } from '../models/RentalReturn.ts';
import { Invoice, type IInvoiceLineItem, type InvoiceStatus } from '../models/Invoice.ts';
import { DamageRecord } from '../models/DamageRecord.ts';
import { Product } from '../models/Product.ts';
import { Project } from '../models/Project.ts';
import { Notification } from '../models/Notification.ts';
import { calculateRentalDays, diffDaysUtc, roundMoney, toUtcDayStart } from '../utils/sequences.ts';

/**
 * Rebuilds the invoice line items, accrued/expected charges, and invoice status
 * accurately from:
 * 1. Closed billing periods recorded in RentalReturns (historical qty held * days * rate)
 * 2. Active remaining quantities from lastPeriodStartDate through max(now, expectedReturnDate)
 * 3. Customer-responsible Damage/Loss replacement charges
 */
export async function syncRentalAndInvoice(
  rentalId: string,
  session: ClientSession | null = null
) {
  const rentalQuery = Rental.findById(rentalId);
  if (session) rentalQuery.session(session);
  const rental = await rentalQuery;
  if (!rental) return null;

  const itemsQuery = RentalItem.find({ rental: rental._id }).populate('product', 'name sku');
  if (session) itemsQuery.session(session);
  const rentalItems = await itemsQuery;

  const returnsQuery = RentalReturn.find({ rental: rental._id }).sort({ returnDate: 1 });
  if (session) returnsQuery.session(session);
  const rentalReturns = await returnsQuery;

  const damagesQuery = DamageRecord.find({
    rental: rental._id,
    responsibility: { $in: ['CUSTOMER', 'SHARED'] },
  }).populate('product', 'name');
  if (session) damagesQuery.session(session);
  const damageRecords = await damagesQuery;

  const invoiceQuery = Invoice.findOne({ rental: rental._id });
  if (session) invoiceQuery.session(session);
  const invoice = await invoiceQuery;

  const lineItems: IInvoiceLineItem[] = [];
  let closedPeriodSubtotal = 0;

  // 1. Add all closed period charges from partial/final returns
  for (const ret of rentalReturns) {
    for (const item of ret.items) {
      if (item.periodCharge > 0) {
        lineItems.push({
          description: `Period Settlement (${ret.returnNumber})`,
          productName: item.productName,
          quantity: item.quantityHeldBeforeReturn,
          dailyRate: item.dailyRate,
          days: item.periodDays,
          fromDate: item.periodStartDate,
          toDate: item.periodEndDate,
          amount: roundMoney(item.periodCharge),
          lineType: 'CLOSED_PERIOD',
        });
        closedPeriodSubtotal = roundMoney(closedPeriodSubtotal + item.periodCharge);
      }
    }
  }

  // 2. Add currently open/active remaining items billed through expectedReturnDate or today if overdue
  const now = new Date();
  const billingEndTarget =
    toUtcDayStart(now) > toUtcDayStart(rental.expectedReturnDate)
      ? now
      : rental.expectedReturnDate;

  let activeEstimatedSubtotal = 0;
  let totalRemainingUnits = 0;

  for (const item of rentalItems) {
    if (item.remainingQuantity > 0) {
      totalRemainingUnits += item.remainingQuantity;
      const productDoc = item.product as unknown as { name?: string };
      const productName = productDoc?.name || 'Steel Prop';
      const days = calculateRentalDays(item.lastPeriodStartDate, billingEndTarget);
      const amount = roundMoney(item.remainingQuantity * item.dailyRate * days);

      lineItems.push({
        description:
          toUtcDayStart(now) > toUtcDayStart(rental.expectedReturnDate)
            ? 'Active Rental (Overdue Accrual)'
            : 'Active Rental Period',
        productName,
        quantity: item.remainingQuantity,
        dailyRate: item.dailyRate,
        days,
        fromDate: item.lastPeriodStartDate,
        toDate: billingEndTarget,
        amount,
        lineType: 'ACTIVE_PERIOD',
      });

      activeEstimatedSubtotal = roundMoney(activeEstimatedSubtotal + amount);
    }
  }

  // 3. Add customer-responsible damage/loss replacement fees
  let damageTotal = 0;
  for (const dmg of damageRecords) {
    if (dmg.replacementCost > 0) {
      const shareFactor = dmg.responsibility === 'SHARED' ? 0.5 : 1;
      const charged = roundMoney(dmg.replacementCost * shareFactor);
      const prodDoc = dmg.product as unknown as { name?: string };
      lineItems.push({
        description: `Damage/Loss Replacement (${dmg.recordNumber})`,
        productName: prodDoc?.name || 'Equipment Replacement',
        quantity: dmg.damagedQuantity + dmg.lostQuantity,
        dailyRate: charged,
        days: 1,
        fromDate: dmg.inspectionDate,
        toDate: dmg.inspectionDate,
        amount: charged,
        lineType: 'DAMAGE_LOSS',
      });
      damageTotal = roundMoney(damageTotal + charged);
    }
  }

  const grandTotal = roundMoney(closedPeriodSubtotal + activeEstimatedSubtotal + damageTotal);

  // Update rental status & totals
  rental.accruedClosedCharge = closedPeriodSubtotal;
  rental.damageChargeTotal = damageTotal;
  rental.expectedTotalCharge = grandTotal;

  if (rental.status !== 'CANCELLED') {
    if (totalRemainingUnits === 0) {
      rental.status = 'COMPLETED';
      if (!rental.actualCloseDate) {
        rental.actualCloseDate = now;
      }
    } else if (toUtcDayStart(now) > toUtcDayStart(rental.expectedReturnDate)) {
      rental.status = 'OVERDUE';
    } else if (rentalReturns.length > 0) {
      rental.status = 'PARTIALLY_RETURNED';
    } else {
      rental.status = 'ACTIVE';
    }
  }

  await rental.save({ session: session || undefined });

  if (invoice) {
    invoice.lineItems = lineItems;
    invoice.subtotal = grandTotal;
    invoice.totalAmount = grandTotal;
    invoice.dueDate = rental.expectedReturnDate;
    invoice.balanceAmount = roundMoney(Math.max(0, grandTotal - invoice.paidAmount));

    let nextStatus: InvoiceStatus = invoice.status;
    if (invoice.status !== 'VOID') {
      if (invoice.balanceAmount <= 0 && grandTotal > 0) {
        nextStatus = 'PAID';
      } else if (invoice.paidAmount > 0 && invoice.balanceAmount > 0) {
        nextStatus = toUtcDayStart(now) > toUtcDayStart(invoice.dueDate) ? 'OVERDUE' : 'PARTIALLY_PAID';
      } else if (toUtcDayStart(now) > toUtcDayStart(invoice.dueDate) && invoice.balanceAmount > 0) {
        nextStatus = 'OVERDUE';
      } else {
        nextStatus = 'UNPAID';
      }
    }
    invoice.status = nextStatus;
    await invoice.save({ session: session || undefined });
  }

  return { rental, invoice };
}

/**
 * Evaluates current system state and refreshes real operational notifications
 * (overdue rentals, approaching returns, unpaid invoices, low inventory,
 * damaged equipment, and project completion dates).
 */
export async function refreshSystemNotifications(): Promise<void> {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  // 1. Mark overdue rentals & sync their accrual
  const openRentals = await Rental.find({
    status: { $in: ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'] },
  }).populate('customer', 'name');

  for (const rental of openRentals) {
    const daysToDue = diffDaysUtc(now, rental.expectedReturnDate);
    const customerName = (rental.customer as unknown as { name?: string })?.name || 'Customer';

    if (daysToDue < 0) {
      if (rental.status !== 'OVERDUE') {
        await syncRentalAndInvoice(String(rental._id));
      }
      const overdueDays = Math.abs(daysToDue);
      await upsertNotification({
        type: 'OVERDUE_RENTAL',
        severity: 'CRITICAL',
        title: `Overdue Rental: ${rental.rentalNumber}`,
        titleSo: `Kiro Waqtigeedii Dhaafay: ${rental.rentalNumber}`,
        message: `${customerName} is ${overdueDays} day(s) past expected return date.`,
        messageSo: `${customerName} waxay dhaaftay waqtigii soo celinta ${overdueDays} maalmood.`,
        relatedEntityType: 'Rental',
        relatedEntityId: String(rental._id),
        dedupKey: `OVERDUE_RENTAL:${rental._id}:${todayKey}`,
      });
    } else if (daysToDue <= 3) {
      await upsertNotification({
        type: 'APPROACHING_RETURN',
        severity: 'WARNING',
        title: `Return Due Soon: ${rental.rentalNumber}`,
        titleSo: `Soo Celin Dhow: ${rental.rentalNumber}`,
        message: `${customerName} rental is due in ${daysToDue} day(s).`,
        messageSo: `Kirada ${customerName} waxaa ka harsan ${daysToDue} maalmood.`,
        relatedEntityType: 'Rental',
        relatedEntityId: String(rental._id),
        dedupKey: `APPROACHING_RETURN:${rental._id}:${todayKey}`,
      });
    }
  }

  // 2. Unpaid / overdue invoices
  const unpaidInvoices = await Invoice.find({
    status: { $in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
    balanceAmount: { $gt: 0 },
  }).populate('customer', 'name');

  for (const inv of unpaidInvoices) {
    const daysToDue = diffDaysUtc(now, inv.dueDate);
    if (daysToDue <= 0) {
      const customerName = (inv.customer as unknown as { name?: string })?.name || 'Customer';
      await upsertNotification({
        type: 'UNPAID_INVOICE',
        severity: daysToDue < 0 ? 'CRITICAL' : 'WARNING',
        title: `Unpaid Invoice: ${inv.invoiceNumber}`,
        titleSo: `Qaansheeg Aan La Bixin: ${inv.invoiceNumber}`,
        message: `${customerName} owes $${inv.balanceAmount.toFixed(2)}.`,
        messageSo: `${customerName} waxaa lagu leeyahay $${inv.balanceAmount.toFixed(2)}.`,
        relatedEntityType: 'Invoice',
        relatedEntityId: String(inv._id),
        dedupKey: `UNPAID_INVOICE:${inv._id}:${todayKey}`,
      });
    }
  }

  // 3. Low inventory alerts
  const lowProducts = await Product.find({
    isActive: true,
    $expr: { $lte: ['$availableQuantity', '$minStockThreshold'] },
  });

  for (const prod of lowProducts) {
    await upsertNotification({
      type: 'LOW_INVENTORY',
      severity: prod.availableQuantity === 0 ? 'CRITICAL' : 'WARNING',
      title: `Low Stock: ${prod.name}`,
      titleSo: `Kaydka oo Yaraaday: ${prod.name}`,
      message: `Only ${prod.availableQuantity} units available (threshold: ${prod.minStockThreshold}).`,
      messageSo: `Kaliya ${prod.availableQuantity} xabo ayaa bannaan (xadka: ${prod.minStockThreshold}).`,
      relatedEntityType: 'Product',
      relatedEntityId: String(prod._id),
      dedupKey: `LOW_INVENTORY:${prod._id}:${todayKey}`,
    });
  }

  // 4. Unresolved damaged equipment
  const unresolvedDamages = await DamageRecord.find({ resolved: false })
    .populate('product', 'name')
    .limit(10);

  for (const dmg of unresolvedDamages) {
    const prodName = (dmg.product as unknown as { name?: string })?.name || 'Steel Prop';
    await upsertNotification({
      type: 'DAMAGED_EQUIPMENT',
      severity: 'WARNING',
      title: `Equipment Damage/Loss: ${dmg.recordNumber}`,
      titleSo: `Qalab Waxyeeloobay/Lumay: ${dmg.recordNumber}`,
      message: `${prodName}: ${dmg.damagedQuantity} damaged, ${dmg.lostQuantity} lost.`,
      messageSo: `${prodName}: ${dmg.damagedQuantity} waxyeeloobay, ${dmg.lostQuantity} lumay.`,
      relatedEntityType: 'DamageRecord',
      relatedEntityId: String(dmg._id),
      dedupKey: `DAMAGED_EQUIPMENT:${dmg._id}`,
    });
  }

  // 5. Project completion dates approaching or past due
  const activeProjects = await Project.find({ status: 'ACTIVE' }).populate('customer', 'name');
  for (const proj of activeProjects) {
    const daysLeft = diffDaysUtc(now, proj.expectedCompletionDate);
    if (daysLeft <= 7) {
      await upsertNotification({
        type: 'PROJECT_COMPLETION',
        severity: daysLeft < 0 ? 'WARNING' : 'INFO',
        title: `Project Milestone: ${proj.name}`,
        titleSo: `Dhammaadka Mashruuca: ${proj.name}`,
        message:
          daysLeft < 0
            ? `Expected completion date passed ${Math.abs(daysLeft)} day(s) ago.`
            : `Expected completion in ${daysLeft} day(s).`,
        messageSo:
          daysLeft < 0
            ? `Taariikhda dhammaystirka mashruuca waxay dhaaftay ${Math.abs(daysLeft)} maalmood.`
            : `Mashruuca waxaa la filayaa inuu dhammaado ${daysLeft} maalmood gudahood.`,
        relatedEntityType: 'Project',
        relatedEntityId: String(proj._id),
        dedupKey: `PROJECT_COMPLETION:${proj._id}:${todayKey}`,
      });
    }
  }
}

async function upsertNotification(data: {
  type:
    | 'APPROACHING_RETURN'
    | 'OVERDUE_RENTAL'
    | 'UNPAID_INVOICE'
    | 'LOW_INVENTORY'
    | 'DAMAGED_EQUIPMENT'
    | 'PROJECT_COMPLETION';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  titleSo: string;
  message: string;
  messageSo: string;
  relatedEntityType: string;
  relatedEntityId: string;
  dedupKey: string;
}) {
  await Notification.updateOne(
    { dedupKey: data.dedupKey },
    {
      $setOnInsert: {
        ...data,
        isRead: false,
      },
    },
    { upsert: true }
  );
}
