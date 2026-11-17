import type { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.ts';
import { Notification } from '../models/Notification.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { refreshSystemNotifications } from '../services/billingService.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER']).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function listNotifications(_req: AuthenticatedRequest, res: Response): Promise<void> {
  await refreshSystemNotifications();
  const notifications = await Notification.find()
    .sort({ isRead: 1, createdAt: -1 })
    .limit(50)
    .lean();
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  res.json({ notifications, unreadCount });
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  const notif = await Notification.findByIdAndUpdate(
    req.params.id,
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notif) {
    throw new HttpError(404, 'Notification not found');
  }
  res.json({ notification: notif });
}

export async function markAllNotificationsRead(_req: AuthenticatedRequest, res: Response): Promise<void> {
  await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
  res.json({ success: true });
}

export async function listUsers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  res.json({ users });
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof updateUserSchema>;
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  if (String(user._id) === req.user?.id && data.isActive === false) {
    throw new HttpError(400, 'You cannot deactivate your own account.');
  }

  if (data.name) user.name = data.name;
  if (data.role) user.role = data.role;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.isActive !== undefined) user.isActive = data.isActive;
  if (data.password) {
    user.passwordHash = await bcrypt.hash(data.password, 10);
  }

  await user.save();

  await recordAuditLog({
    req,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: String(user._id),
    summary: `Updated user ${user.name} (${user.role}, active=${user.isActive}).`,
  });

  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    },
  });
}

export async function listAuditLogs(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(120).lean();
  res.json({ logs });
}
