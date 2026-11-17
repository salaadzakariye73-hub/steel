import { useEffect, useState } from 'react';
import { Search, FileDown, Printer, Eye } from 'lucide-react';
import { api } from '../services/api';
import type { Invoice, Payment, Rental } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, formatMoney, formatStatusLabel, getStatusTone } from '../utils/formatters';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import { Modal } from '../components/ui/Modal';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

interface InvoiceDetailPayload {
  invoice: Invoice;
  payments: Payment[];
}

export function InvoicesPage() {
  const { lang, t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [detailData, setDetailData] = useState<InvoiceDetailPayload | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ invoices: Invoice[] }>('/invoices');
      setInvoices(res.invoices);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load invoices' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const openInvoiceDetail = async (id: string) => {
    try {
      const res = await api.get<InvoiceDetailPayload>(`/invoices/${id}`);
      setDetailData(res);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load invoice details' });
    }
  };

  const handlePdfAction = async (id: string, mode: 'download' | 'print') => {
    try {
      const res = await api.get<InvoiceDetailPayload>(`/invoices/${id}`);
      await generateInvoicePdf({ invoice: res.invoice, payments: res.payments, lang, mode });
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'PDF export failed' });
    }
  };

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
    if (!search) return true;
    return (
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      inv.project?.name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(['ALL', 'UNPAID', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'ALL' ? t('filterAll') : formatStatusLabel(st, lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('invoiceNumber')}</th>
                <th className="px-4 py-3">{t('customer')} / {t('project')}</th>
                <th className="px-4 py-3">{t('rentalNumber')}</th>
                <th className="px-4 py-3">{t('date')}</th>
                <th className="px-4 py-3 text-right">{t('totalBilled')}</th>
                <th className="px-4 py-3 text-right">{t('totalPaid')}</th>
                <th className="px-4 py-3 text-right">{t('balance')}</th>
                <th className="px-4 py-3">{t('status')}</th>
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
                filtered.map((inv) => {
                  const rentalObj = typeof inv.rental === 'object' ? (inv.rental as Rental) : null;
                  return (
                    <tr key={inv._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{inv.customer?.name}</div>
                        <div className="text-xs text-slate-500">{inv.project?.name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {rentalObj?.rentalNumber || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        <div>Iss: {formatDate(inv.issueDate)}</div>
                        <div className="text-slate-400">Due: {formatDate(inv.dueDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {formatMoney(inv.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">
                        {formatMoney(inv.paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">
                        <span className={inv.balanceAmount > 0 ? 'text-red-700' : 'text-emerald-700'}>
                          {formatMoney(inv.balanceAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${getStatusTone(inv.status)}`}>
                          {formatStatusLabel(inv.status, lang)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openInvoiceDetail(inv._id)}
                            title={t('viewDetails')}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePdfAction(inv._id, 'download')}
                            title={t('downloadPdf')}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePdfAction(inv._id, 'print')}
                            title={t('printInvoice')}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      <Modal
        open={!!detailData}
        onClose={() => setDetailData(null)}
        title={detailData ? `${detailData.invoice.invoiceNumber} — ${detailData.invoice.customer?.name}` : ''}
        subtitle={detailData?.invoice.project?.name}
        maxWidth="max-w-4xl"
      >
        {detailData && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
              <div className="flex items-center gap-3">
                <img
                  src="/src/assets/images/company_logo_mark_1794824457556.jpg"
                  alt="Kaah Steel Props"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-lg bg-white p-0.5"
                />
                <div>
                  <div className="font-display text-sm font-bold">KAAH STEEL PROPS</div>
                  <div className="text-xs text-slate-300">
                    KM4 Industrial Rd, Mogadishu · +252 61 500 1001
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    generateInvoicePdf({
                      invoice: detailData.invoice,
                      payments: detailData.payments,
                      lang,
                      mode: 'download',
                    })
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>{t('downloadPdf')}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    generateInvoicePdf({
                      invoice: detailData.invoice,
                      payments: detailData.payments,
                      lang,
                      mode: 'print',
                    })
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{t('printInvoice')}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">{t('productName')}</th>
                    <th className="px-3 py-2.5">Period</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Days</th>
                    <th className="px-3 py-2.5 text-right">{t('dailyRate')}</th>
                    <th className="px-3 py-2.5 text-right">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailData.invoice.lineItems.map((li, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{li.productName}</div>
                        <div className="text-[11px] text-slate-500">{li.description}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600">
                        {formatDate(li.fromDate)} → {formatDate(li.toDate)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{li.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{li.days}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatMoney(li.dailyRate)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">{formatMoney(li.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-4 text-xs">
                <div className="font-semibold text-slate-900">Recorded Payments</div>
                <div className="mt-2 space-y-1.5">
                  {detailData.payments.length === 0 ? (
                    <div className="text-slate-500">No payments recorded yet.</div>
                  ) : (
                    detailData.payments.map((p) => (
                      <div key={p._id} className="flex justify-between text-slate-600">
                        <span className="font-mono">{p.paymentNumber} ({formatDate(p.paymentDate)})</span>
                        <span className="font-mono font-semibold text-emerald-700">{formatMoney(p.usdEquivalent)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{t('deposit')}:</span>
                  <span className="font-mono">{formatMoney(detailData.invoice.depositAmount)}</span>
                </div>
                <div className="flex justify-between font-medium text-slate-900">
                  <span>{t('totalBilled')}:</span>
                  <span className="font-mono font-bold">{formatMoney(detailData.invoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>{t('totalPaid')}:</span>
                  <span className="font-mono font-semibold">{formatMoney(detailData.invoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                  <span>{t('balance')}:</span>
                  <span className={`font-mono ${detailData.invoice.balanceAmount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {formatMoney(detailData.invoice.balanceAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
