import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type ExpenseCategory =
  | 'MAINTENANCE'
  | 'TRANSPORT'
  | 'WAREHOUSE'
  | 'SALARIES'
  | 'UTILITIES'
  | 'PURCHASE'
  | 'OTHER';

export interface IExpense extends Document {
  expenseNumber: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: 'USD' | 'SOS';
  usdEquivalent: number;
  expenseDate: Date;
  vendor: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    expenseNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: {
      type: String,
      enum: ['MAINTENANCE', 'TRANSPORT', 'WAREHOUSE', 'SALARIES', 'UTILITIES', 'PURCHASE', 'OTHER'],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ['USD', 'SOS'], default: 'USD', required: true },
    usdEquivalent: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: Date, required: true, default: Date.now },
    vendor: { type: String, trim: true, default: '' },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ expenseDate: -1 });

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
