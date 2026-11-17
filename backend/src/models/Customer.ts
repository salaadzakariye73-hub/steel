import mongoose, { Schema, type Document } from 'mongoose';

export interface ICustomer extends Document {
  customerCode: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
  identificationNumber: string;
  registrationDate: Date;
  notes: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    companyName: { type: String, trim: true, default: '' },
    identificationNumber: { type: String, trim: true, default: '' },
    registrationDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: 1, phone: 1 });
CustomerSchema.index({ name: 'text', companyName: 'text', phone: 'text' });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
