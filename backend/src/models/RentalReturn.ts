import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IRentalReturnItem {
  rentalItem: Types.ObjectId;
  product: Types.ObjectId;
  productName: string;
  returnedGoodQty: number;
  damagedQty: number;
  lostQty: number;
  quantityHeldBeforeReturn: number;
  periodStartDate: Date;
  periodEndDate: Date;
  periodDays: number;
  dailyRate: number;
  periodCharge: number;
  replacementCharge: number;
}

export interface IRentalReturn extends Document {
  returnNumber: string;
  rental: Types.ObjectId;
  returnDate: Date;
  isFinalReturn: boolean;
  items: IRentalReturnItem[];
  totalPeriodCharge: number;
  totalReplacementCharge: number;
  notes: string;
  processedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RentalReturnItemSchema = new Schema<IRentalReturnItem>(
  {
    rentalItem: { type: Schema.Types.ObjectId, ref: 'RentalItem', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    returnedGoodQty: { type: Number, required: true, min: 0 },
    damagedQty: { type: Number, required: true, min: 0, default: 0 },
    lostQty: { type: Number, required: true, min: 0, default: 0 },
    quantityHeldBeforeReturn: { type: Number, required: true, min: 0 },
    periodStartDate: { type: Date, required: true },
    periodEndDate: { type: Date, required: true },
    periodDays: { type: Number, required: true, min: 0 },
    dailyRate: { type: Number, required: true, min: 0 },
    periodCharge: { type: Number, required: true, min: 0 },
    replacementCharge: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const RentalReturnSchema = new Schema<IRentalReturn>(
  {
    returnNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    rental: { type: Schema.Types.ObjectId, ref: 'Rental', required: true, index: true },
    returnDate: { type: Date, required: true },
    isFinalReturn: { type: Boolean, default: false },
    items: { type: [RentalReturnItemSchema], required: true },
    totalPeriodCharge: { type: Number, required: true, min: 0 },
    totalReplacementCharge: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, trim: true, default: '' },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

RentalReturnSchema.index({ returnDate: -1 });

export const RentalReturn = mongoose.model<IRentalReturn>('RentalReturn', RentalReturnSchema);
