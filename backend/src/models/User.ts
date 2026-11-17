import mongoose, { Schema, type Document } from 'mongoose';

export type UserRole = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'STOREKEEPER';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'],
      default: 'STOREKEEPER',
      required: true,
    },
    phone: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, isActive: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
