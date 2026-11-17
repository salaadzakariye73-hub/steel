import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, FileDown } from 'lucide-react';
import { api } from '../services/api';
import type { Invoice, Payment, PaymentMethod } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  formatDate,
  formatMoney,
  formatPaymentMethod,
  toInputDate,
} from '../utils/formatters';
import { generateReceiptPdf } from '../utils/pdfGenerator';
import { Modal } from '../components/ui/Modal';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

export function PaymentsPage() {
  const { lang, t } = useLanguage();
  const { hasRole } = useAuth();
  const canRecord = hasRole('ADMIN', 'MANAGER', 'ACCOUNTANT');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    invoiceId: '',
    amount: 0,
    currency: 'USD' as 'USD' | 'SOS',
    exchangeRate: 27000,
    paymentMethod: 'CASH_USD' as PaymentMethod,
    paymentDate: toInputDate(),
    referenceNumber: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [payRes, invRes] = await Promise.all([
        api.get<{ payments: Payment[] }>('/payments'),
        api.get<{ invoices: Invoice[] }>('/invoices'),
      ]);
      setPayments(payRes.payments);
      setOpenInvoices(invRes.invoices.filter((i) => i.balanceAmount > 0 && i.status !== 'VOID'));
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load payments' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openModal = () => {
    const firstInv = openInvoices[0];
    setForm({
      invoiceId: firstInv?._id || '',
      amount: firstInv ? firstInv.balanceAmount : 0,
      currency: 'USD',
      exchangeRate: 27000,
      paymentMethod: 'CASH_USD',
      paymentDate: toInputDate(),
      referenceNumber: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const selectedInvoice = openInvoices.find((i) => i._id === form.invoiceId);
  const usdEquivalentPreview =
    form.currency === 'SOS'
      ? Number(form.amount || 0) / Math.max(1, Number(form.exchangeRate || 27000))
      : Number(form.amount || 0);

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const idempotencyKey = `${form.invoiceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await api.post('/payments', {
        ...form,
        amount: Number(form.amount),
        exchangeRate: Number(form.exchangeRate),
        referenceNumber: form.referenceNumber.trim() || undefined,
        idempotencyKey,
      });
      setToast({ type: 'success', text: 'Payment recorded and invoice balance updated.' });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Payment failed' });
    }
  };

  const filtered = payments.filter((p) => {
    if (methodFilter !== 'ALL' && p.paymentMethod !== methodFilter) return false;
    if (!search) return true;
    return (
      p.paymentNumber.toLowerCase().includes(search.toLowerCase()) ||
      (p.referenceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      p.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.invoice?.invoiceNumber?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalDisplayedUsd = filtered.reduce((sum, p) => sum + p.usdEquivalent, 0);

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="w-60 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'CASH_USD', 'CASH_SOS', 'MOBILE_MONEY', 'BANK_TRANSFER'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                  methodFilter === m ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'ALL' ? t('filterAll') : formatPaymentMethod(m, lang)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] text-slate-500">{t('totalPaymentsReceived')}</div>
            <div className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
              {formatMoney(totalDisplayedUsd)}
            </div>
          </div>

          {canRecord && (
            <button
              type="button"
              onClick={openModal}
              disabled={openInvoices.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('recordPayment')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('paymentNumber')}</th>
                <th className="px-4 py-3">{t('paymentDate')}</th>
                <th className="px-4 py-3">{t('customer')}</th>
                <th className="px-4 py-3">{t('invoiceNumber')} / {t('rentalNumber')}</th>
                <th className="px-4 py-3">{t('paymentMethod')}</th>
                <th className="px-4 py-3">{t('referenceNumber')}</th>
                <th className="px-4 py-3 text-right">{t('amount')}</th>
                <th className="px-4 py-3 text-right">{t('usdEquivalent')}</th>
                <th className="px-4 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    {t('loading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                      {p.paymentNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {formatDate(p.paymentDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.customer?.name}</div>
                      <div className="text-xs text-slate-500">{p.customer?.companyName}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      <div>{p.invoice?.invoiceNumber}</div>
                      <div className="text-slate-400">{p.rental?.rentalNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {formatPaymentMethod(p.paymentMethod, lang)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.referenceNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums text-emerald-700">
                      {formatMoney(p.usdEquivalent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => generateReceiptPdf({ payment: p, lang })}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                        <span>{t('downloadReceipt')}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('recordPayment')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">{t('invoiceNumber')}</label>
            <select
              required
              value={form.invoiceId}
              onChange={(e) => {
                const inv = openInvoices.find((i) => i._id === e.target.value);
                setForm({
                  ...form,
                  invoiceId: e.target.value,
                  amount: inv ? inv.balanceAmount : 0,
                });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {openInvoices.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.invoiceNumber} — {inv.customer?.name} (Balance: {formatMoney(inv.balanceAmount)})
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span>Invoice Total: {formatMoney(selectedInvoice.totalAmount)}</span>
              <span>Paid: {formatMoney(selectedInvoice.paidAmount)}</span>
              <span className="font-semibold text-red-700">
                Balance: {formatMoney(selectedInvoice.balanceAmount)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('paymentMethod')}</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => {
                  const method = e.target.value as PaymentMethod;
                  setForm({
                    ...form,
                    paymentMethod: method,
                    currency: method === 'CASH_SOS' ? 'SOS' : 'USD',
                  });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="CASH_USD">{t('cashUsd')}</option>
                <option value="CASH_SOS">{t('cashSos')}</option>
                <option value="MOBILE_MONEY">{t('mobileMoney')}</option>
                <option value="BANK_TRANSFER">{t('bankTransfer')}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('currency')}</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as 'USD' | 'SOS' })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="USD">USD ($)</option>
                <option value="SOS">SOS (Shilling)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {t('amount')} ({form.currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            {form.currency === 'SOS' ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">{t('exchangeRate')}</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.exchangeRate}
                  onChange={(e) => setForm({ ...form, exchangeRate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">{t('paymentDate')}</label>
                <input
                  type="date"
                  required
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
            )}
          </div>

          {form.currency === 'SOS' && (
            <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white flex justify-between">
              <span>{t('usdEquivalent')}:</span>
              <span className="font-mono font-bold text-amber-400">
                {formatMoney(usdEquivalentPreview)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('referenceNumber')}</label>
              <input
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="Unique Txn / Receipt Ref"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('notes')}</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0F172A] px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
