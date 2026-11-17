import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type RentalStatus =
  | 'ACTIVE'
  | 'PARTIALLY_RETURNED'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'CANCELLED';

export interface IRentalExtension {
  previousReturnDate: Date;
  newReturnDate: Date;
  additionalEstimatedCharge: number;
  reason: string;
  extendedBy: Types.ObjectId;
  extendedAt: Date;
}

export interface IRental extends Document {
  rentalNumber: string;
  customer: Types.ObjectId;
  project: Types.ObjectId;
  startDate: Date;
  expectedReturnDate: Date;
  actualCloseDate?: Date;
  status: RentalStatus;
  depositAmount: number;
  accruedClosedCharge: number;
  damageChargeTotal: number;
  expectedTotalCharge: number;
  notes: string;
  extensions: IRentalExtension[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RentalExtensionSchema = new Schema<IRentalExtension>(
  {
    previousReturnDate: { type: Date, required: true },
    newReturnDate: { type: Date, required: true },
    additionalEstimatedCharge: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, default: '' },
    extendedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    extendedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RentalSchema = new Schema<IRental>(
  {
    rentalNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    startDate: { type: Date, required: true },
    expectedReturnDate: { type: Date, required: true },
    actualCloseDate: { type: Date },
    status: {
      type: String,
      enum: ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    depositAmount: { type: Number, min: 0, default: 0 },
    accruedClosedCharge: { type: Number, min: 0, default: 0 },
    damageChargeTotal: { type: Number, min: 0, default: 0 },
    expectedTotalCharge: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true, default: '' },
    extensions: { type: [RentalExtensionSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

RentalSchema.index({ expectedReturnDate: 1, status: 1 });
RentalSchema.index({ createdAt: -1 });

export const Rental = mongoose.model<IRental>('Rental', RentalSchema);
