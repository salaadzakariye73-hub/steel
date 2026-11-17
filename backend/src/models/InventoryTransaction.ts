import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type InventoryTxType =
  | 'STOCK_IN'
  | 'RENTAL_OUT'
  | 'RETURN_IN'
  | 'DAMAGED'
  | 'LOST'
  | 'REPAIRED'
  | 'ADJUSTMENT';

export interface IInventoryTransaction extends Document {
  product: Types.ObjectId;
  type: InventoryTxType;
  quantity: number;
  previousAvailable: number;
  newAvailable: number;
  rental?: Types.ObjectId;
  performedBy: Types.ObjectId;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: {
      type: String,
      enum: ['STOCK_IN', 'RENTAL_OUT', 'RETURN_IN', 'DAMAGED', 'LOST', 'REPAIRED', 'ADJUSTMENT'],
      required: true,
    },
    quantity: { type: Number, required: true },
    previousAvailable: { type: Number, required: true, min: 0 },
    newAvailable: { type: Number, required: true, min: 0 },
    rental: { type: Schema.Types.ObjectId, ref: 'Rental' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

InventoryTransactionSchema.index({ createdAt: -1 });
InventoryTransactionSchema.index({ type: 1, createdAt: -1 });

export const InventoryTransaction = mongoose.model<IInventoryTransaction>(
  'InventoryTransaction',
  InventoryTransactionSchema
);
