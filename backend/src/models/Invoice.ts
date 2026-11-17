import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type InvoiceStatus =
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID';

export interface IInvoiceLineItem {
  description: string;
  productName: string;
  quantity: number;
  dailyRate: number;
  days: number;
  fromDate: Date;
  toDate: Date;
  amount: number;
  lineType: 'CLOSED_PERIOD' | 'ACTIVE_PERIOD' | 'DAMAGE_LOSS';
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  rental: Types.ObjectId;
  customer: Types.ObjectId;
  project: Types.ObjectId;
  issueDate: Date;
  dueDate: Date;
  lineItems: IInvoiceLineItem[];
  subtotal: number;
  depositAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    description: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    dailyRate: { type: Number, required: true, min: 0 },
    days: { type: Number, required: true, min: 0 },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    lineType: {
      type: String,
      enum: ['CLOSED_PERIOD', 'ACTIVE_PERIOD', 'DAMAGE_LOSS'],
      default: 'ACTIVE_PERIOD',
    },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    rental: { type: Schema.Types.ObjectId, ref: 'Rental', required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    lineItems: { type: [InvoiceLineItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    depositAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0, default: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    balanceAmount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'],
      default: 'UNPAID',
      required: true,
      index: true,
    },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

InvoiceSchema.index({ dueDate: 1, status: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
