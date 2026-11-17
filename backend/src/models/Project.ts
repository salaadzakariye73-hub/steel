import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export interface IProject extends Document {
  projectCode: string;
  name: string;
  customer: Types.ObjectId;
  location: string;
  startDate: Date;
  expectedCompletionDate: Date;
  status: ProjectStatus;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    projectCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    location: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    expectedCompletionDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      default: 'ACTIVE',
      required: true,
    },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

ProjectSchema.index({ status: 1, expectedCompletionDate: 1 });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
