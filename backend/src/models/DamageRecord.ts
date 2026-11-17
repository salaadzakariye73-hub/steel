import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type DamageResponsibility = 'CUSTOMER' | 'COMPANY' | 'SHARED';

export interface IDamageRecord extends Document {
  recordNumber: string;
  product: Types.ObjectId;
  rental?: Types.ObjectId;
  customer?: Types.ObjectId;
  damagedQuantity: number;
  lostQuantity: number;
  damageDescription: string;
  inspectionDate: Date;
  replacementCost: number;
  responsibility: DamageResponsibility;
  resolved: boolean;
  notes: string;
  inspectedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DamageRecordSchema = new Schema<IDamageRecord>(
  {
    recordNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rental: { type: Schema.Types.ObjectId, ref: 'Rental', index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    damagedQuantity: { type: Number, required: true, min: 0, default: 0 },
    lostQuantity: { type: Number, required: true, min: 0, default: 0 },
    damageDescription: { type: String, required: true, trim: true },
    inspectionDate: { type: Date, required: true, default: Date.now },
    replacementCost: { type: Number, required: true, min: 0, default: 0 },
    responsibility: {
      type: String,
      enum: ['CUSTOMER', 'COMPANY', 'SHARED'],
      default: 'CUSTOMER',
      required: true,
    },
    resolved: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '' },
    inspectedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

DamageRecordSchema.index({ inspectionDate: -1 });

export const DamageRecord = mongoose.model<IDamageRecord>('DamageRecord', DamageRecordSchema);
