import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Edit3, Trash2, Eye } from 'lucide-react';
import { api } from '../services/api';
import type { Customer, Invoice, Payment, Project, Rental } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, formatStatusLabel, getStatusTone } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

interface CustomerDetailPayload {
  customer: Customer;
  projects: Project[];
  rentals: Rental[];
  invoices: Invoice[];
  payments: Payment[];
  financialSummary: { totalBilled: number; totalPaid: number; outstandingBalance: number };
}

export function CustomersPage() {
  const { lang, t } = useLanguage();
  const { hasRole } = useAuth();
  const canEdit = hasRole('ADMIN', 'MANAGER');
  const canDelete = hasRole('ADMIN');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailData, setDetailData] = useState<CustomerDetailPayload | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    companyName: '',
    identificationNumber: '',
    notes: '',
  });

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ customers: Customer[] }>(
        `/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`
      );
      setCustomers(res.customers);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load customers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      companyName: '',
      identificationNumber: '',
      notes: '',
    });
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      address: c.address || '',
      companyName: c.companyName || '',
      identificationNumber: c.identificationNumber || '',
      notes: c.notes || '',
    });
    setFormOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/customers/${editing._id}`, form);
        setToast({ type: 'success', text: 'Customer record updated.' });
      } else {
        await api.post('/customers', form);
        setToast({ type: 'success', text: 'Customer registered successfully.' });
      }
      setFormOpen(false);
      await loadCustomers();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const openDetails = async (id: string) => {
    try {
      const res = await api.get<CustomerDetailPayload>(`/customers/${id}`);
      setDetailData(res);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load customer profile' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/customers/${deleteTarget._id}`);
      setToast({ type: 'success', text: 'Customer archived.' });
      setDeleteTarget(null);
      await loadCustomers();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Archive failed' });
      setDeleteTarget(null);
    }
  };

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.customerCode.toLowerCase().includes(search.toLowerCase())
  );

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
            className="w-72 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
          />
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('addCustomer')}</span>
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('customerName')}</th>
                <th className="px-4 py-3">{t('phone')}</th>
                <th className="px-4 py-3 text-right">{t('navProjects')}</th>
                <th className="px-4 py-3 text-right">{t('activeRentals')}</th>
                <th className="px-4 py-3 text-right">{t('totalBilled')}</th>
                <th className="px-4 py-3 text-right">{t('totalPaid')}</th>
                <th className="px-4 py-3 text-right">{t('balance')}</th>
                <th className="px-4 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    {t('loading')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono">{c.customerCode}</span>
                        {c.companyName ? ` · ${c.companyName}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.phone}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {c.activeProjectsCount || 0} / {c.totalProjectsCount || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {c.activeRentalsCount || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {formatMoney(c.totalBilled)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-emerald-700">
                      {formatMoney(c.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                      <span className={(c.outstandingBalance || 0) > 0 ? 'text-red-700' : 'text-slate-700'}>
                        {formatMoney(c.outstandingBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openDetails(c._id)}
                          title={t('viewDetails')}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            title={t('edit')}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            title={t('delete')}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      {/* Add / Edit Customer Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('editCustomer') : t('addCustomer')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('customerName')}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('companyName')}</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('phone')}</label>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('idNumber')}</label>
              <input
                value={form.identificationNumber}
                onChange={(e) => setForm({ ...form, identificationNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('address')}</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">{t('notes')}</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
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

      {/* Customer 360 Detail Modal */}
      <Modal
        open={!!detailData}
        onClose={() => setDetailData(null)}
        title={detailData ? `${detailData.customer.name} (${detailData.customer.customerCode})` : ''}
        subtitle={detailData?.customer.companyName || detailData?.customer.phone}
        maxWidth="max-w-4xl"
      >
        {detailData && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{t('totalBilled')}</div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900">
                  {formatMoney(detailData.financialSummary.totalBilled)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{t('totalPaid')}</div>
                <div className="mt-1 font-mono text-lg font-bold text-emerald-700">
                  {formatMoney(detailData.financialSummary.totalPaid)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">{t('balance')}</div>
                <div className="mt-1 font-mono text-lg font-bold text-red-700">
                  {formatMoney(detailData.financialSummary.outstandingBalance)}
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('navProjects')}</h3>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {detailData.projects.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500">{t('noData')}</div>
                ) : (
                  detailData.projects.map((p) => (
                    <div key={p._id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <div>
                        <span className="font-mono font-semibold text-slate-700">{p.projectCode}</span> ·{' '}
                        <span className="font-medium text-slate-900">{p.name}</span>
                        <div className="text-slate-500">{p.location}</div>
                      </div>
                      <span className={`rounded border px-2 py-0.5 font-medium ${getStatusTone(p.status)}`}>
                        {formatStatusLabel(p.status, lang)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">{t('navRentals')}</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">{t('rentalNumber')}</th>
                      <th className="px-3 py-2">{t('startDate')}</th>
                      <th className="px-3 py-2">{t('expectedReturnDate')}</th>
                      <th className="px-3 py-2 text-right">{t('amount')}</th>
                      <th className="px-3 py-2">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailData.rentals.map((r) => (
                      <tr key={r._id}>
                        <td className="px-3 py-2 font-mono font-semibold">{r.rentalNumber}</td>
                        <td className="px-3 py-2 font-mono">{formatDate(r.startDate)}</td>
                        <td className="px-3 py-2 font-mono">{formatDate(r.expectedReturnDate)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          {formatMoney(r.expectedTotalCharge)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded border px-1.5 py-0.5 ${getStatusTone(r.status)}`}>
                            {formatStatusLabel(r.status, lang)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Archive Customer"
        message={`Archive customer "${deleteTarget?.name}"? Financial records and historical contracts remain preserved.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
