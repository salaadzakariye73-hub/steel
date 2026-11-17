import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type PaymentCurrency = 'USD' | 'SOS';
export type PaymentMethod = 'CASH_USD' | 'CASH_SOS' | 'MOBILE_MONEY' | 'BANK_TRANSFER';

export interface IPayment extends Document {
  paymentNumber: string;
  customer: Types.ObjectId;
  rental: Types.ObjectId;
  invoice: Types.ObjectId;
  amount: number;
  currency: PaymentCurrency;
  exchangeRate: number;
  usdEquivalent: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  referenceNumber?: string;
  idempotencyKey?: string;
  notes: string;
  receivedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    rental: { type: Schema.Types.ObjectId, ref: 'Rental', required: true, index: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ['USD', 'SOS'], default: 'USD', required: true },
    exchangeRate: { type: Number, required: true, min: 1, default: 1 },
    usdEquivalent: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: ['CASH_USD', 'CASH_SOS', 'MOBILE_MONEY', 'BANK_TRANSFER'],
      required: true,
    },
    paymentDate: { type: Date, required: true, default: Date.now },
    referenceNumber: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true },
    notes: { type: String, trim: true, default: '' },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Prevent duplicate reference numbers and duplicate idempotency keys when present
PaymentSchema.index({ referenceNumber: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ paymentDate: -1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
