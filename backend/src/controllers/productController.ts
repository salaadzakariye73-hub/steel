import type { Response } from 'express';
import { z } from 'zod';
import { Product } from '../models/Product.ts';
import { InventoryTransaction } from '../models/InventoryTransaction.ts';
import { RentalItem } from '../models/RentalItem.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export const createProductSchema = z.object({
  name: z.string().min(2).max(140),
  sku: z.string().min(2).max(40),
  category: z.string().min(2).max(60),
  description: z.string().optional().default(''),
  totalQuantity: z.coerce.number().int().min(0),
  purchasePrice: z.coerce.number().min(0),
  dailyRentalPrice: z.coerce.number().positive(),
  minStockThreshold: z.coerce.number().int().min(0).optional().default(50),
  imageUrl: z.string().optional().default(''),
  warehouseLocation: z.string().min(1).default('Main Yard A'),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(140).optional(),
  sku: z.string().min(2).max(40).optional(),
  category: z.string().min(2).max(60).optional(),
  description: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  dailyRentalPrice: z.coerce.number().positive().optional(),
  minStockThreshold: z.coerce.number().int().min(0).optional(),
  imageUrl: z.string().optional(),
  warehouseLocation: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const adjustStockSchema = z.object({
  type: z.enum(['STOCK_IN', 'REPAIRED', 'ADJUSTMENT']),
  quantity: z.coerce.number().int().refine((n) => n !== 0, 'Quantity cannot be zero'),
  notes: z.string().optional().default(''),
});

export async function listProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const includeInactive = req.query.includeInactive === 'true';

  const filter: Record<string, unknown> = {};
  if (!includeInactive) filter.isActive = true;
  if (category && category !== 'ALL') filter.category = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { warehouseLocation: { $regex: search, $options: 'i' } },
    ];
  }

  const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ products });
}

export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof createProductSchema>;

  const product = await Product.create({
    ...data,
    sku: data.sku.toUpperCase(),
    availableQuantity: data.totalQuantity,
    rentedQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    isActive: true,
  });

  if (data.totalQuantity > 0 && req.user) {
    await InventoryTransaction.create({
      product: product._id,
      type: 'STOCK_IN',
      quantity: data.totalQuantity,
      previousAvailable: 0,
      newAvailable: data.totalQuantity,
      performedBy: req.user.id,
      notes: 'Initial product registration',
    });
  }

  await recordAuditLog({
    req,
    action: 'PRODUCT_CREATED',
    entityType: 'Product',
    entityId: String(product._id),
    summary: `Added product ${product.name} (${product.sku}) with ${product.totalQuantity} units.`,
  });

  res.status(201).json({ product });
}

export async function updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof updateProductSchema>;
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }

  Object.assign(product, data);
  if (data.sku) product.sku = data.sku.toUpperCase();
  await product.save();

  await recordAuditLog({
    req,
    action: 'PRODUCT_UPDATED',
    entityType: 'Product',
    entityId: String(product._id),
    summary: `Updated product ${product.name} (${product.sku}).`,
  });

  res.json({ product });
}

export async function adjustProductStock(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { type, quantity, notes } = req.body as z.infer<typeof adjustStockSchema>;
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }

  const prevAvail = product.availableQuantity;

  if (type === 'STOCK_IN') {
    if (quantity <= 0) throw new HttpError(400, 'Stock addition quantity must be positive.');
    product.totalQuantity += quantity;
    product.availableQuantity += quantity;
  } else if (type === 'REPAIRED') {
    if (quantity <= 0) throw new HttpError(400, 'Repaired quantity must be positive.');
    if (quantity > product.damagedQuantity) {
      throw new HttpError(400, `Cannot repair ${quantity} units; only ${product.damagedQuantity} marked damaged.`);
    }
    product.damagedQuantity -= quantity;
    product.availableQuantity += quantity;
  } else {
    // ADJUSTMENT can be positive or negative, but availableQuantity can NEVER become negative
    const nextAvail = product.availableQuantity + quantity;
    if (nextAvail < 0) {
      throw new HttpError(
        400,
        `Adjustment rejected: available stock (${product.availableQuantity}) cannot become negative.`
      );
    }
    product.availableQuantity = nextAvail;
    product.totalQuantity =
      product.availableQuantity + product.rentedQuantity + product.damagedQuantity + product.lostQuantity;
  }

  await product.save();

  if (req.user) {
    await InventoryTransaction.create({
      product: product._id,
      type,
      quantity,
      previousAvailable: prevAvail,
      newAvailable: product.availableQuantity,
      performedBy: req.user.id,
      notes: notes || `Manual ${type}`,
    });
  }

  await recordAuditLog({
    req,
    action: 'INVENTORY_ADJUSTED',
    entityType: 'Product',
    entityId: String(product._id),
    summary: `${type} (${quantity > 0 ? '+' : ''}${quantity}) for ${product.sku}. Available: ${prevAvail} -> ${product.availableQuantity}.`,
  });

  res.json({ product });
}

export async function deleteProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new HttpError(404, 'Product not found');
  }

  if (product.rentedQuantity > 0) {
    throw new HttpError(400, 'Cannot delete product while units are currently rented out.');
  }

  const hasRentalHistory = await RentalItem.exists({ product: product._id });
  if (hasRentalHistory) {
    // Soft-archive to preserve relational integrity & audit history
    product.isActive = false;
    await product.save();
  } else {
    await product.deleteOne();
  }

  await recordAuditLog({
    req,
    action: 'PRODUCT_DELETED',
    entityType: 'Product',
    entityId: String(product._id),
    summary: `Removed/archived product ${product.name} (${product.sku}).`,
  });

  res.json({ success: true });
}

export async function getProductTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.params.id && req.params.id !== 'all') {
    filter.product = req.params.id;
  }

  const transactions = await InventoryTransaction.find(filter)
    .populate('product', 'name sku')
    .populate('performedBy', 'name role')
    .populate('rental', 'rentalNumber')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ transactions });
}
