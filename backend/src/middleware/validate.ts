import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      res.status(400).json({
        error: details[0]?.message || 'Validation failed',
        details,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
    return;
  }

  // Handle MongoDB duplicate key errors cleanly
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
    const keyPattern = 'keyPattern' in err ? Object.keys((err as { keyPattern: Record<string, unknown> }).keyPattern) : [];
    const field = keyPattern[0] || 'record';
    res.status(409).json({ error: `Duplicate value for ${field}. Record already exists.` });
    return;
  }

  console.error('[API Error]', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
}
