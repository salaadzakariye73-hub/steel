import mongoose, { Schema, type Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku: string;
  category: string;
  description: string;
  totalQuantity: number;
  availableQuantity: number;
  rentedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  purchasePrice: number;
  dailyRentalPrice: number;
  minStockThreshold: number;
  imageUrl: string;
  warehouseLocation: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: { type: String, required: true, trim: true, default: 'Steel Props' },
    description: { type: String, trim: true, default: '' },
    totalQuantity: { type: Number, required: true, min: 0, default: 0 },
    availableQuantity: { type: Number, required: true, min: 0, default: 0 },
    rentedQuantity: { type: Number, required: true, min: 0, default: 0 },
    damagedQuantity: { type: Number, required: true, min: 0, default: 0 },
    lostQuantity: { type: Number, required: true, min: 0, default: 0 },
    purchasePrice: { type: Number, required: true, min: 0, default: 0 },
    dailyRentalPrice: { type: Number, required: true, min: 0.01 },
    minStockThreshold: { type: Number, min: 0, default: 50 },
    imageUrl: { type: String, trim: true, default: '' },
    warehouseLocation: { type: String, trim: true, default: 'Main Yard A' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ name: 'text', sku: 'text' });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
