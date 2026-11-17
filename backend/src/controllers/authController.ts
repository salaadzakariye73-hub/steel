import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.ts';
import { signAuthToken, recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional().default(''),
  role: z.enum(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER']).optional(),
});

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new HttpError(401, 'Invalid email or password.');
  }
  if (!user.isActive) {
    throw new HttpError(403, 'Your account has been deactivated. Contact an administrator.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const authPayload = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const token = signAuthToken(authPayload);

  await recordAuditLog({
    req,
    actorId: String(user._id),
    actorName: user.name,
    actorRole: user.role,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: String(user._id),
    summary: `${user.name} (${user.role}) signed in.`,
  });

  res.json({
    token,
    user: {
      ...authPayload,
      phone: user.phone,
    },
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new HttpError(401, 'Not authenticated');
  }
  const user = await User.findById(req.user.id).select('-passwordHash').lean();
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  res.json({ user });
}

export async function registerUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, email, password, phone, role } = req.body as z.infer<typeof registerSchema>;
  const normalizedEmail = email.toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const assignedRole = req.user?.role === 'ADMIN' && role ? role : 'STOREKEEPER';

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    phone,
    role: assignedRole,
    isActive: true,
  });

  await recordAuditLog({
    req,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: String(user._id),
    summary: `Created user ${user.name} (${user.role}).`,
  });

  res.status(201).json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
    },
  });
}
