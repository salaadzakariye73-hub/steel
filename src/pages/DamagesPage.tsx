import { useEffect, useState, type FormEvent } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { Customer, DamageRecord, Product, Rental } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, toInputDate } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

export function DamagesPage() {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const canInspect = hasRole('ADMIN', 'MANAGER', 'STOREKEEPER');

  const [records, setRecords] = useState<DamageRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    product: '',
    rental: '',
    customer: '',
    damagedQuantity: 0,
    lostQuantity: 0,
    damageDescription: '',
    inspectionDate: toInputDate(),
    replacementCost: 0,
    responsibility: 'CUSTOMER' as 'CUSTOMER' | 'COMPANY' | 'SHARED',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [dmgRes, prodRes, rentRes, custRes] = await Promise.all([
        api.get<{ records: DamageRecord[] }>('/damages'),
        api.get<{ products: Product[] }>('/products'),
        api.get<{ rentals: Rental[] }>('/rentals'),
        api.get<{ customers: Customer[] }>('/customers'),
      ]);
      setRecords(dmgRes.records);
      setProducts(prodRes.products);
      setRentals(rentRes.rentals);
      setCustomers(custRes.customers);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load damage records' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/damages', {
        ...form,
        damagedQuantity: Number(form.damagedQuantity),
        lostQuantity: Number(form.lostQuantity),
        replacementCost: Number(form.replacementCost),
      });
      setToast({ type: 'success', text: 'Damage/loss inspection recorded and inventory updated.' });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to record damage' });
    }
  };

  const toggleResolved = async (id: string) => {
    try {
      await api.patch(`/damages/${id}/resolve`);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  const filtered = records.filter((r) => {
    if (filterStatus === 'OPEN') return !r.resolved;
    if (filterStatus === 'RESOLVED') return r.resolved;
    return true;
  });

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(['ALL', 'OPEN', 'RESOLVED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterStatus(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                filterStatus === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f === 'ALL' ? t('filterAll') : f === 'OPEN' ? t('openIssue') : t('resolved')}
            </button>
          ))}
        </div>

        {canInspect && (
          <button
            type="button"
            onClick={() => {
              setForm({
                product: products[0]?._id || '',
                rental: '',
                customer: '',
                damagedQuantity: 1,
                lostQuantity: 0,
                damageDescription: '',
                inspectionDate: toInputDate(),
                replacementCost: 25,
                responsibility: 'CUSTOMER',
                notes: '',
              });
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('recordDamage')}</span>
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('damageNumber')}</th>
                <th className="px-4 py-3">{t('inspectionDate')}</th>
                <th className="px-4 py-3">{t('productName')}</th>
                <th className="px-4 py-3">{t('customer')} / {t('rentalNumber')}</th>
                <th className="px-4 py-3 text-right">{t('damagedQty')}</th>
                <th className="px-4 py-3 text-right">{t('lostQty')}</th>
                <th className="px-4 py-3 text-right">{t('replacementCost')}</th>
                <th className="px-4 py-3">{t('responsibility')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    {t('loading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">
                      {rec.recordNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {formatDate(rec.inspectionDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{rec.product?.name}</div>
                      <div className="text-xs text-slate-500">{rec.damageDescription}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      <div>{rec.customer?.name || 'Warehouse Yard'}</div>
                      <div className="font-mono text-slate-400">{rec.rental?.rentalNumber || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-orange-700 tabular-nums">
                      {rec.damagedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-red-700 tabular-nums">
                      {rec.lostQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatMoney(rec.replacementCost)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">
                      {rec.responsibility}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${
                          rec.resolved
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {rec.resolved ? t('resolved') : t('openIssue')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canInspect && (
                        <button
                          type="button"
                          onClick={() => toggleResolved(rec._id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{rec.resolved ? 'Reopen' : t('markResolved')}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('recordDamage')}
        subtitle="Damaged and lost units are excluded from available rental inventory."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('productName')}</label>
              <select
                required
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} (Avail: {p.availableQuantity})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Linked Rental (Optional)</label>
              <select
                value={form.rental}
                onChange={(e) => setForm({ ...form, rental: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Warehouse Inspection (No Rental)</option>
                {rentals.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.rentalNumber} — {r.customer?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('customer')} (Optional)</label>
              <select
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">None / Yard Audit</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('responsibility')}</label>
              <select
                value={form.responsibility}
                onChange={(e) =>
                  setForm({ ...form, responsibility: e.target.value as 'CUSTOMER' | 'COMPANY' | 'SHARED' })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="CUSTOMER">Customer</option>
                <option value="COMPANY">Company</option>
                <option value="SHARED">Shared</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('damagedQty')}</label>
              <input
                type="number"
                min={0}
                value={form.damagedQuantity}
                onChange={(e) => setForm({ ...form, damagedQuantity: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('lostQty')}</label>
              <input
                type="number"
                min={0}
                value={form.lostQuantity}
                onChange={(e) => setForm({ ...form, lostQuantity: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('replacementCost')}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.replacementCost}
                onChange={(e) => setForm({ ...form, replacementCost: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('inspectionDate')}</label>
              <input
                type="date"
                value={form.inspectionDate}
                onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">{t('damageDescription')}</label>
            <textarea
              required
              rows={2}
              value={form.damageDescription}
              onChange={(e) => setForm({ ...form, damageDescription: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
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
              className="rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
