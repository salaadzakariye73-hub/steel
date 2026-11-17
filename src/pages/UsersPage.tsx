import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Shield, Edit3, Download } from 'lucide-react';
import { api } from '../services/api';
import type { AuditLogItem, User, UserRole } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDate } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

export function UsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [viewMode, setViewMode] = useState<'USERS' | 'AUDIT'>('USERS');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'STOREKEEPER' as UserRole,
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, aRes] = await Promise.all([
        api.get<{ users: User[] }>('/users'),
        api.get<{ logs: AuditLogItem[] }>('/audit-logs'),
      ]);
      setUsers(uRes.users);
      setAuditLogs(aRes.logs);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load user records' });
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
      email: '',
      password: '',
      phone: '',
      role: 'STOREKEEPER',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      phone: u.phone || '',
      role: u.role,
      isActive: u.isActive ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        const uid = editing._id || editing.id;
        await api.put(`/users/${uid}`, {
          name: form.name,
          phone: form.phone,
          role: form.role,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
        setToast({ type: 'success', text: 'Staff user updated.' });
      } else {
        await api.post('/auth/register', {
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          role: form.role,
        });
        setToast({ type: 'success', text: 'Staff account created.' });
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save user' });
    }
  };

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode('USERS')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              viewMode === 'USERS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Staff & Roles
          </button>
          <button
            type="button"
            onClick={() => setViewMode('AUDIT')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              viewMode === 'AUDIT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {t('auditLogTitle')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/kaah-steel-prop-rental-system.zip"
            download="kaah-steel-prop-rental-system.zip"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download ZIP</span>
          </a>

          {viewMode === 'USERS' && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('addUser')}</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'USERS' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">{t('email')}</th>
                <th className="px-4 py-3">{t('phone')}</th>
                <th className="px-4 py-3">{t('role')}</th>
                <th className="px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    {t('loading')}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id || u.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-800">
                        <Shield className="h-3 w-3 text-amber-600" />
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${
                          u.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {u.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {formatDate(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {log.actorName} <span className="text-slate-400">({log.actorRole})</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{log.action}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">{log.entityType}</td>
                  <td className="px-4 py-2.5 text-slate-700">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Staff Account' : t('addUser')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Full Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {!editing && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('email')}</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('role')}</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ADMIN">ADMIN (Full Access)</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ACCOUNTANT">ACCOUNTANT</option>
                <option value="STOREKEEPER">STOREKEEPER</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('phone')}</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {editing ? 'Reset Password (optional)' : t('password')}
            </label>
            <input
              type="password"
              required={!editing}
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <span>Account Active</span>
            </label>
          )}
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
