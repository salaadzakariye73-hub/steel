import mongoose, { Schema, type Document } from 'mongoose';

export type NotificationType =
  | 'APPROACHING_RETURN'
  | 'OVERDUE_RENTAL'
  | 'UNPAID_INVOICE'
  | 'LOW_INVENTORY'
  | 'DAMAGED_EQUIPMENT'
  | 'PROJECT_COMPLETION';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface INotification extends Document {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  titleSo: string;
  message: string;
  messageSo: string;
  relatedEntityType: string;
  relatedEntityId: string;
  isRead: boolean;
  dedupKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: [
        'APPROACHING_RETURN',
        'OVERDUE_RENTAL',
        'UNPAID_INVOICE',
        'LOW_INVENTORY',
        'DAMAGED_EQUIPMENT',
        'PROJECT_COMPLETION',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'WARNING',
      required: true,
    },
    title: { type: String, required: true },
    titleSo: { type: String, required: true },
    message: { type: String, required: true },
    messageSo: { type: String, required: true },
    relatedEntityType: { type: String, required: true },
    relatedEntityId: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    dedupKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
