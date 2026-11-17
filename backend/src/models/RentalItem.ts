import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IRentalItem extends Document {
  rental: Types.ObjectId;
  product: Types.ObjectId;
  initialQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  remainingQuantity: number;
  dailyRate: number;
  lastPeriodStartDate: Date;
  accruedCharge: number;
  createdAt: Date;
  updatedAt: Date;
}

const RentalItemSchema = new Schema<IRentalItem>(
  {
    rental: { type: Schema.Types.ObjectId, ref: 'Rental', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    initialQuantity: { type: Number, required: true, min: 1 },
    returnedQuantity: { type: Number, required: true, min: 0, default: 0 },
    damagedQuantity: { type: Number, required: true, min: 0, default: 0 },
    lostQuantity: { type: Number, required: true, min: 0, default: 0 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    dailyRate: { type: Number, required: true, min: 0.01 },
    lastPeriodStartDate: { type: Date, required: true },
    accruedCharge: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

export const RentalItem = mongoose.model<IRentalItem>('RentalItem', RentalItemSchema);
