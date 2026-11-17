import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Edit3, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { Customer, Project, ProjectStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, formatStatusLabel, getStatusTone, toInputDate } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

export function ProjectsPage() {
  const { lang, t } = useLanguage();
  const { hasRole } = useAuth();
  const canEdit = hasRole('ADMIN', 'MANAGER');
  const canDelete = hasRole('ADMIN');

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const [form, setForm] = useState({
    name: '',
    customer: '',
    location: '',
    startDate: toInputDate(),
    expectedCompletionDate: toInputDate(new Date(Date.now() + 60 * 86400000)),
    status: 'ACTIVE' as ProjectStatus,
    description: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [projRes, custRes] = await Promise.all([
        api.get<{ projects: Project[] }>('/projects'),
        api.get<{ customers: Customer[] }>('/customers'),
      ]);
      setProjects(projRes.projects);
      setCustomers(custRes.customers);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load projects' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      customer: customers[0]?._id || '',
      location: '',
      startDate: toInputDate(),
      expectedCompletionDate: toInputDate(new Date(Date.now() + 60 * 86400000)),
      status: 'ACTIVE',
      description: '',
    });
    setFormOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    const custId = typeof p.customer === 'object' ? p.customer._id : p.customer;
    setForm({
      name: p.name,
      customer: custId,
      location: p.location,
      startDate: toInputDate(p.startDate),
      expectedCompletionDate: toInputDate(p.expectedCompletionDate),
      status: p.status,
      description: p.description || '',
    });
    setFormOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/projects/${editing._id}`, form);
        setToast({ type: 'success', text: 'Project updated.' });
      } else {
        await api.post('/projects', form);
        setToast({ type: 'success', text: 'Construction project registered.' });
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save project' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${deleteTarget._id}`);
      setToast({ type: 'success', text: 'Project deleted.' });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
      setDeleteTarget(null);
    }
  };

  const filtered = projects.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (!search) return true;
    const custName = typeof p.customer === 'object' ? p.customer.name : '';
    return (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase()) ||
      custName.toLowerCase().includes(search.toLowerCase())
    );
  });

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
              className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'ACTIVE', 'PLANNING', 'ON_HOLD', 'COMPLETED'] as const).map((st) => (
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

        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('addProject')}</span>
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('projectName')}</th>
                <th className="px-4 py-3">{t('customer')}</th>
                <th className="px-4 py-3">{t('constructionLocation')}</th>
                <th className="px-4 py-3">{t('startDate')}</th>
                <th className="px-4 py-3">{t('expectedCompletion')}</th>
                <th className="px-4 py-3 text-right">{t('navRentals')}</th>
                <th className="px-4 py-3">{t('status')}</th>
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
                filtered.map((p) => {
                  const cust = typeof p.customer === 'object' ? p.customer : null;
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        <div className="font-mono text-xs text-slate-500">{p.projectCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{cust?.name || '—'}</div>
                        <div className="text-xs text-slate-500">{cust?.companyName}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{p.location}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{formatDate(p.startDate)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {formatDate(p.expectedCompletionDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        <div>{p.rentalCount || 0} contracts</div>
                        <div className="text-slate-500">{formatMoney(p.totalRentalValue)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${getStatusTone(p.status)}`}>
                          {formatStatusLabel(p.status, lang)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('editProject') : t('addProject')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('projectName')}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('customer')}</label>
              <select
                required
                value={form.customer}
                onChange={(e) => setForm({ ...form, customer: e.target.value })}
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
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('status')}</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('constructionLocation')}</label>
              <input
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('startDate')}</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('expectedCompletion')}</label>
              <input
                type="date"
                required
                value={form.expectedCompletionDate}
                onChange={(e) => setForm({ ...form, expectedCompletionDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Project"
        message={`Delete project "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
