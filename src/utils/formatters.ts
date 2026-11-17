import type { Language } from '../i18n/translations';

export function formatMoney(amount: number | undefined | null, currency: 'USD' | 'SOS' = 'USD'): string {
  const val = Number(amount || 0);
  if (currency === 'SOS') {
    return `${val.toLocaleString('en-US', { maximumFractionDigits: 0 })} SOS`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatNumber(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString('en-US');
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function toInputDate(dateStr?: string | Date): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function formatPaymentMethod(method: string, lang: Language): string {
  const map: Record<string, { en: string; so: string }> = {
    CASH_USD: { en: 'Cash USD', so: 'Kaash USD' },
    CASH_SOS: { en: 'Cash SOS', so: 'Kaash SOS' },
    MOBILE_MONEY: { en: 'Mobile Money', so: 'Lacagta Mobilka' },
    BANK_TRANSFER: { en: 'Bank Transfer', so: 'Xawaalad Bangi' },
  };
  return map[method]?.[lang] || method;
}

export function formatStatusLabel(status: string, lang: Language): string {
  const map: Record<string, { en: string; so: string }> = {
    ACTIVE: { en: 'Active', so: 'Firfircoon' },
    PARTIALLY_RETURNED: { en: 'Partial Return', so: 'Soo Celin Qayb ah' },
    OVERDUE: { en: 'Overdue', so: 'Waqtigu Dhaafay' },
    COMPLETED: { en: 'Completed', so: 'Dhammaystiran' },
    CANCELLED: { en: 'Cancelled', so: 'La Joojiyay' },
    PLANNING: { en: 'Planning', so: 'Qorshayn' },
    ON_HOLD: { en: 'On Hold', so: 'Hakad' },
    UNPAID: { en: 'Unpaid', so: 'Aan La Bixin' },
    PARTIALLY_PAID: { en: 'Partial Paid', so: 'Qayb La Bixiyay' },
    PAID: { en: 'Paid', so: 'La Bixiyay' },
    VOID: { en: 'Void', so: 'La Baabi’iyay' },
  };
  return map[status]?.[lang] || status;
}

export function getStatusTone(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'PAID':
    case 'COMPLETED':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'PARTIALLY_RETURNED':
    case 'PARTIALLY_PAID':
    case 'PLANNING':
    case 'ON_HOLD':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'OVERDUE':
    case 'UNPAID':
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-slate-600 bg-slate-100 border-slate-200';
  }
}
