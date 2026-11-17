import { useEffect, useState, type FormEvent } from 'react';
import {
  Plus,
  Search,
  RotateCcw,
  CalendarPlus,
  Eye,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  Customer,
  DamageRecord,
  Invoice,
  Payment,
  Product,
  Project,
  Rental,
  RentalItem,
  RentalReturn,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatStatusLabel,
  getStatusTone,
  toInputDate,
} from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

interface RentalDetailPayload {
  rental: Rental;
  items: RentalItem[];
  returns: RentalReturn[];
  invoice: Invoice | null;
  payments: Payment[];
  damages: DamageRecord[];
}

interface ReturnLineInput {
  rentalItemId: string;
  productName: string;
  remainingQuantity: number;
  dailyRate: number;
  lastPeriodStartDate: string;
  returnedGoodQty: number;
  damagedQty: number;
  lostQty: number;
  replacementCost: number;
  damageDescription: string;
}

export function RentalsPage({
  triggerCreateSignal,
}: {
  triggerCreateSignal?: number;
}) {
  const { lang, t } = useLanguage();
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'MANAGER', 'STOREKEEPER');

  const [rentals, setRentals] = useState<Rental[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [detailData, setDetailData] = useState<RentalDetailPayload | null>(null);
  const [extendTarget, setExtendTarget] = useState<Rental | null>(null);
  const [returnTarget, setReturnTarget] = useState<Rental | null>(null);

  // Create Rental State
  const [createForm, setCreateForm] = useState({
    customer: '',
    project: '',
    startDate: toInputDate(),
    expectedReturnDate: toInputDate(new Date(Date.now() + 30 * 86400000)),
    depositAmount: 0,
    notes: '',
    items: [{ product: '', quantity: 100, dailyRate: 0.6 }],
  });

  // Extend State
  const [extendForm, setExtendForm] = useState({
    newExpectedReturnDate: '',
    reason: '',
  });

  // Return State
  const [returnDate, setReturnDate] = useState(toInputDate());
  const [returnNotes, setReturnNotes] = useState('');
  const [responsibility, setResponsibility] = useState<'CUSTOMER' | 'COMPANY' | 'SHARED'>('CUSTOMER');
  const [returnLines, setReturnLines] = useState<ReturnLineInput[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rentRes, custRes, projRes, prodRes] = await Promise.all([
        api.get<{ rentals: Rental[] }>('/rentals'),
        api.get<{ customers: Customer[] }>('/customers'),
        api.get<{ projects: Project[] }>('/projects'),
        api.get<{ products: Product[] }>('/products'),
      ]);
      setRentals(rentRes.rentals);
      setCustomers(custRes.customers);
      setProjects(projRes.projects);
      setProducts(prodRes.products);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load rentals' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (triggerCreateSignal && triggerCreateSignal > 0 && canOperate) {
      openCreateModal();
    }
  }, [triggerCreateSignal]);

  const openCreateModal = () => {
    const firstCust = customers[0]?._id || '';
    const matchingProj = projects.find(
      (p) => (typeof p.customer === 'object' ? p.customer._id : p.customer) === firstCust
    );
    const firstProd = products.find((p) => p.availableQuantity > 0) || products[0];

    setCreateForm({
      customer: firstCust,
      project: matchingProj?._id || '',
      startDate: toInputDate(),
      expectedReturnDate: toInputDate(new Date(Date.now() + 30 * 86400000)),
      depositAmount: 0,
      notes: '',
      items: firstProd
        ? [{ product: firstProd._id, quantity: Math.min(100, firstProd.availableQuantity || 1), dailyRate: firstProd.dailyRentalPrice }]
        : [{ product: '', quantity: 1, dailyRate: 0.6 }],
    });
    setCreateOpen(true);
  };

  const customerProjects = projects.filter(
    (p) => (typeof p.customer === 'object' ? p.customer._id : p.customer) === createForm.customer
  );

  const calcDays = () => {
    const s = new Date(createForm.startDate).getTime();
    const e = new Date(createForm.expectedReturnDate).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return 1;
    return Math.max(1, Math.round((e - s) / 86400000));
  };

  const dailyTotalPreview = createForm.items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.dailyRate || 0),
    0
  );
  const daysPreview = calcDays();
  const estimatedTotalPreview = dailyTotalPreview * daysPreview;

  const handleCreateRental = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/rentals', {
        ...createForm,
        depositAmount: Number(createForm.depositAmount),
        items: createForm.items.map((it) => ({
          product: it.product,
          quantity: Number(it.quantity),
          dailyRate: Number(it.dailyRate),
        })),
      });
      setToast({ type: 'success', text: 'Rental contract created and invoice generated.' });
      setCreateOpen(false);
      await loadAll();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create rental' });
    }
  };

  const openDetails = async (rentalId: string) => {
    try {
      const res = await api.get<RentalDetailPayload>(`/rentals/${rentalId}`);
      setDetailData(res);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load details' });
    }
  };

  const openExtendModal = (r: Rental) => {
    const nextDate = new Date(new Date(r.expectedReturnDate).getTime() + 14 * 86400000);
    setExtendTarget(r);
    setExtendForm({
      newExpectedReturnDate: toInputDate(nextDate),
      reason: 'Site schedule extension',
    });
  };

  const handleExtend = async (e: FormEvent) => {
    e.preventDefault();
    if (!extendTarget) return;
    try {
      await api.post(`/rentals/${extendTarget._id}/extend`, extendForm);
      setToast({ type: 'success', text: 'Rental contract extended and invoice updated.' });
      setExtendTarget(null);
      await loadAll();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Extension failed' });
    }
  };

  const openReturnModal = (r: Rental) => {
    const openItems = (r.items || []).filter((it) => it.remainingQuantity > 0);
    setReturnTarget(r);
    setReturnDate(toInputDate());
    setReturnNotes('');
    setResponsibility('CUSTOMER');
    setReturnLines(
      openItems.map((it) => ({
        rentalItemId: it._id,
        productName: it.product?.name || 'Steel Prop',
        remainingQuantity: it.remainingQuantity,
        dailyRate: it.dailyRate,
        lastPeriodStartDate: it.lastPeriodStartDate,
        returnedGoodQty: 0,
        damagedQty: 0,
        lostQty: 0,
        replacementCost: 0,
        damageDescription: '',
      }))
    );
  };

  const handleProcessReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    try {
      await api.post(`/rentals/${returnTarget._id}/return`, {
        returnDate,
        notes: returnNotes,
        responsibility,
        items: returnLines.map((l) => ({
          rentalItemId: l.rentalItemId,
          returnedGoodQty: Number(l.returnedGoodQty || 0),
          damagedQty: Number(l.damagedQty || 0),
          lostQty: Number(l.lostQty || 0),
          replacementCost: Number(l.replacementCost || 0),
          damageDescription: l.damageDescription,
        })),
      });
      setToast({ type: 'success', text: 'Return recorded, inventory updated, and invoice synchronized.' });
      setReturnTarget(null);
      await loadAll();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Return failed' });
    }
  };

  const filtered = rentals.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!search) return true;
    return (
      r.rentalNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.project?.name?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Toolbar */}
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
            {(['ALL', 'ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE', 'COMPLETED'] as const).map((st) => (
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

        {canOperate && (
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('newRental')}</span>
          </button>
        )}
      </div>

      {/* Rentals Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('rentalNumber')}</th>
                <th className="px-4 py-3">{t('customer')} / {t('project')}</th>
                <th className="px-4 py-3">{t('startDate')} → {t('expectedReturnDate')}</th>
                <th className="px-4 py-3 text-right">{t('remainingOut')}</th>
                <th className="px-4 py-3 text-right">{t('dailyTotal')}</th>
                <th className="px-4 py-3 text-right">{t('estimatedTotal')}</th>
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
                filtered.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                      {r.rentalNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.customer?.name}</div>
                      <div className="text-xs text-slate-500">{r.project?.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      <div>{formatDate(r.startDate)}</div>
                      <div className="text-slate-400">→ {formatDate(r.expectedReturnDate)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      <span className="font-semibold text-slate-900">
                        {formatNumber(r.totalRemainingUnits)}
                      </span>{' '}
                      <span className="text-slate-400">/ {formatNumber(r.totalInitialUnits)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                      {formatMoney(r.currentDailyRate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                      {formatMoney(r.expectedTotalCharge)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                      <span className={(r.invoice?.balanceAmount || 0) > 0 ? 'text-red-700' : 'text-emerald-700'}>
                        {formatMoney(r.invoice?.balanceAmount || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${getStatusTone(r.status)}`}>
                        {formatStatusLabel(r.status, lang)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openDetails(r._id)}
                          title={t('viewDetails')}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canOperate && r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openReturnModal(r)}
                              title={t('processReturn')}
                              className="rounded-md p-1.5 text-amber-700 hover:bg-amber-50"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openExtendModal(r)}
                              title={t('extendRental')}
                              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                            >
                              <CalendarPlus className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Rental Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('newRental')}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateRental} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('customer')}</label>
              <select
                required
                value={createForm.customer}
                onChange={(e) => {
                  const nextCust = e.target.value;
                  const firstProj = projects.find(
                    (p) => (typeof p.customer === 'object' ? p.customer._id : p.customer) === nextCust
                  );
                  setCreateForm({
                    ...createForm,
                    customer: nextCust,
                    project: firstProj?._id || '',
                  });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.companyName || c.customerCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('project')}</label>
              <select
                required
                value={createForm.project}
                onChange={(e) => setCreateForm({ ...createForm, project: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select project...</option>
                {customerProjects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.location})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('startDate')}</label>
              <input
                type="date"
                required
                value={createForm.startDate}
                onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('expectedReturnDate')}</label>
              <input
                type="date"
                required
                value={createForm.expectedReturnDate}
                onChange={(e) => setCreateForm({ ...createForm, expectedReturnDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          {/* Product Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Equipment Line Items</span>
              <button
                type="button"
                onClick={() => {
                  const p = products[0];
                  setCreateForm({
                    ...createForm,
                    items: [
                      ...createForm.items,
                      { product: p?._id || '', quantity: 50, dailyRate: p?.dailyRentalPrice || 0.6 },
                    ],
                  });
                }}
                className="text-xs font-semibold text-slate-900 hover:underline"
              >
                + Add Equipment Item
              </button>
            </div>

            {createForm.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="col-span-6">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">{t('productName')}</label>
                  <select
                    required
                    value={item.product}
                    onChange={(e) => {
                      const prod = products.find((p) => p._id === e.target.value);
                      const next = [...createForm.items];
                      next[idx] = {
                        ...next[idx],
                        product: e.target.value,
                        dailyRate: prod ? prod.dailyRentalPrice : next[idx].dailyRate,
                      };
                      setCreateForm({ ...createForm, items: next });
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} (Avail: {p.availableQuantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Qty</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...createForm.items];
                      next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                      setCreateForm({ ...createForm, items: next });
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>

                <div className="col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">Daily Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    required
                    value={item.dailyRate}
                    onChange={(e) => {
                      const next = [...createForm.items];
                      next[idx] = { ...next[idx], dailyRate: Number(e.target.value) };
                      setCreateForm({ ...createForm, items: next });
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>

                <div className="col-span-1 flex justify-end">
                  {createForm.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setCreateForm({
                          ...createForm,
                          items: createForm.items.filter((_, i) => i !== idx),
                        })
                      }
                      className="rounded p-1.5 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('deposit')} ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={createForm.depositAmount}
                onChange={(e) => setCreateForm({ ...createForm, depositAmount: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('notes')}</label>
              <input
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Live Calculation Summary */}
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
            <div>
              <div className="text-[11px] text-slate-400">{t('dailyTotal')}</div>
              <div className="mt-0.5 font-mono text-base font-bold tabular-nums">
                {formatMoney(dailyTotalPreview)}/day
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{t('rentalDays')}</div>
              <div className="mt-0.5 font-mono text-base font-bold tabular-nums">
                {daysPreview} days
              </div>
            </div>
            <div>
              <div className="text-[11px] text-amber-400">{t('estimatedTotal')}</div>
              <div className="mt-0.5 font-mono text-base font-bold text-amber-400 tabular-nums">
                {formatMoney(estimatedTotalPreview)}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
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

      {/* Partial / Final Return Modal */}
      <Modal
        open={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        title={t('partialReturnTitle')}
        subtitle={
          returnTarget
            ? `${returnTarget.rentalNumber} · ${returnTarget.customer?.name} · Period charges are calculated accurately from last settlement date.`
            : ''
        }
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleProcessReturn} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('returnDate')}</label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('responsibility')}</label>
              <select
                value={responsibility}
                onChange={(e) =>
                  setResponsibility(e.target.value as 'CUSTOMER' | 'COMPANY' | 'SHARED')
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="CUSTOMER">Customer</option>
                <option value="SHARED">Shared (50/50)</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('notes')}</label>
              <input
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Batch return notes..."
              />
            </div>
          </div>

          <div className="space-y-3">
            {returnLines.map((line, idx) => {
              const totalEntered =
                Number(line.returnedGoodQty || 0) +
                Number(line.damagedQty || 0) +
                Number(line.lostQty || 0);
              const nextRemaining = Math.max(0, line.remainingQuantity - totalEntered);
              const exceeds = totalEntered > line.remainingQuantity;

              return (
                <div key={line.rentalItemId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{line.productName}</div>
                      <div className="font-mono text-xs text-slate-500">
                        Held Out: {line.remainingQuantity} · Rate: {formatMoney(line.dailyRate)}/day · Period Start: {formatDate(line.lastPeriodStartDate)}
                      </div>
                    </div>
                    <div className="font-mono text-xs font-semibold">
                      {exceeds ? (
                        <span className="text-red-600">Exceeds held quantity!</span>
                      ) : (
                        <span className="text-slate-700">Remaining after return: {nextRemaining}</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        {t('goodReturned')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={line.remainingQuantity}
                        value={line.returnedGoodQty}
                        onChange={(e) => {
                          const next = [...returnLines];
                          next[idx].returnedGoodQty = Number(e.target.value);
                          setReturnLines(next);
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        {t('damagedReturned')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={line.remainingQuantity}
                        value={line.damagedQty}
                        onChange={(e) => {
                          const next = [...returnLines];
                          next[idx].damagedQty = Number(e.target.value);
                          setReturnLines(next);
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        {t('lostQtyInput')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={line.remainingQuantity}
                        value={line.lostQty}
                        onChange={(e) => {
                          const next = [...returnLines];
                          next[idx].lostQty = Number(e.target.value);
                          setReturnLines(next);
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        {t('replacementCost')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.replacementCost}
                        onChange={(e) => {
                          const next = [...returnLines];
                          next[idx].replacementCost = Number(e.target.value);
                          setReturnLines(next);
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        Inspection Note
                      </label>
                      <input
                        value={line.damageDescription}
                        onChange={(e) => {
                          const next = [...returnLines];
                          next[idx].damageDescription = e.target.value;
                          setReturnLines(next);
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        placeholder="If damaged/lost..."
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setReturnTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0F172A] px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {t('confirm')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Extend Rental Modal */}
      <Modal
        open={!!extendTarget}
        onClose={() => setExtendTarget(null)}
        title={t('extendRental')}
        subtitle={
          extendTarget
            ? `${extendTarget.rentalNumber} · Current Expected Return: ${formatDate(extendTarget.expectedReturnDate)}`
            : ''
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleExtend} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">{t('newReturnDate')}</label>
            <input
              type="date"
              required
              value={extendForm.newExpectedReturnDate}
              onChange={(e) => setExtendForm({ ...extendForm, newExpectedReturnDate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">{t('extensionReason')}</label>
            <input
              value={extendForm.reason}
              onChange={(e) => setExtendForm({ ...extendForm, reason: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setExtendTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Rental 360 Detail Modal */}
      <Modal
        open={!!detailData}
        onClose={() => setDetailData(null)}
        title={detailData ? `${detailData.rental.rentalNumber} — ${detailData.rental.customer?.name}` : ''}
        subtitle={detailData?.rental.project?.name}
        maxWidth="max-w-4xl"
      >
        {detailData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Closed Period Charges</div>
                <div className="mt-1 font-mono text-base font-bold text-slate-900">
                  {formatMoney(detailData.rental.accruedClosedCharge)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Projected / Total Invoice</div>
                <div className="mt-1 font-mono text-base font-bold text-slate-900">
                  {formatMoney(detailData.invoice?.totalAmount || detailData.rental.expectedTotalCharge)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{t('totalPaid')}</div>
                <div className="mt-1 font-mono text-base font-bold text-emerald-700">
                  {formatMoney(detailData.invoice?.paidAmount || 0)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{t('balance')}</div>
                <div className="mt-1 font-mono text-base font-bold text-red-700">
                  {formatMoney(detailData.invoice?.balanceAmount || 0)}
                </div>
              </div>
            </div>

            {/* Rented Items */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Equipment & Stock Status</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">{t('productName')}</th>
                      <th className="px-3 py-2 text-right">Initial</th>
                      <th className="px-3 py-2 text-right">Good Ret.</th>
                      <th className="px-3 py-2 text-right">Damaged</th>
                      <th className="px-3 py-2 text-right">Lost</th>
                      <th className="px-3 py-2 text-right">Remaining</th>
                      <th className="px-3 py-2 text-right">Daily Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailData.items.map((it) => (
                      <tr key={it._id}>
                        <td className="px-3 py-2 font-medium text-slate-900">{it.product?.name}</td>
                        <td className="px-3 py-2 text-right font-mono">{it.initialQuantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700">{it.returnedQuantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-700">{it.damagedQuantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-700">{it.lostQuantity}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{it.remainingQuantity}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatMoney(it.dailyRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return History */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('returnHistory')}</h3>
              {detailData.returns.length === 0 ? (
                <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500">
                  No partial or final returns recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {detailData.returns.map((ret) => (
                    <div key={ret._id} className="rounded-lg border border-slate-200 p-3 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span className="font-mono">
                          {ret.returnNumber} · {formatDate(ret.returnDate)} ({ret.isFinalReturn ? 'Final Return' : 'Partial Return'})
                        </span>
                        <span className="font-mono text-slate-900">
                          Period Charge: {formatMoney(ret.totalPeriodCharge)}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1 text-slate-600">
                        {ret.items.map((ri, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {ri.productName}: Returned {ri.returnedGoodQty} good, {ri.damagedQty} damaged, {ri.lostQty} lost (Held {ri.quantityHeldBeforeReturn} × {ri.periodDays}d × {formatMoney(ri.dailyRate)})
                            </span>
                            <span className="font-mono font-medium">{formatMoney(ri.periodCharge)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
