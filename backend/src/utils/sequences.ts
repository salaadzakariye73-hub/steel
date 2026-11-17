import type { Model, ClientSession } from 'mongoose';

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toUtcDayStart(dateInput: Date | string): number {
  const d = new Date(dateInput);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function diffDaysUtc(startDate: Date | string, endDate: Date | string): number {
  const startMs = toUtcDayStart(startDate);
  const endMs = toUtcDayStart(endDate);
  return Math.round((endMs - startMs) / 86_400_000);
}

export function calculateRentalDays(startDate: Date | string, endDate: Date | string): number {
  return Math.max(1, diffDaysUtc(startDate, endDate));
}

export async function generateCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  field: string,
  prefix: string,
  withYear = true,
  session: ClientSession | null = null
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const fullPrefix = withYear ? `${prefix}-${year}-` : `${prefix}-`;

  const query = model
    .findOne({ [field]: { $regex: `^${fullPrefix}` } })
    .sort({ [field]: -1 })
    .select(field)
    .lean();

  if (session) {
    query.session(session);
  }

  const latest = (await query) as Record<string, string> | null;
  let nextSeq = 1;

  if (latest && typeof latest[field] === 'string') {
    const parts = latest[field].split('-');
    const lastNum = Number(parts[parts.length - 1]);
    if (!Number.isNaN(lastNum) && lastNum >= 1) {
      nextSeq = lastNum + 1;
    }
  }

  return `${fullPrefix}${String(nextSeq).padStart(4, '0')}`;
}
