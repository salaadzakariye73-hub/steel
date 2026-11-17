import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { User, type UserRole } from '../models/User.ts';
import { AuditLog } from '../models/AuditLog.ts';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;

    const dbUser = await User.findById(decoded.id).select('name email role isActive').lean();
    if (!dbUser || !dbUser.isActive) {
      res.status(401).json({ error: 'Account is inactive or no longer exists.' });
      return;
    }

    req.user = {
      id: String(dbUser._id),
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }

    next();
  };
}

export async function recordAuditLog(params: {
  req?: AuthenticatedRequest;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await AuditLog.create({
      actor: params.req?.user?.id || params.actorId,
      actorName: params.req?.user?.name || params.actorName || 'System',
      actorRole: params.req?.user?.role || params.actorRole || 'SYSTEM',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
      metadata: params.metadata,
      ipAddress: params.req?.ip || '',
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}
