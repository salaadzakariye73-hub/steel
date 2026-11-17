import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Package,
  Users,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  AlertOctagon,
  BarChart3,
  Shield,
  Bell,
  LogOut,
  Menu,
  X,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import type { NotificationItem, UserRole } from '../types';
import type { TranslationKey } from '../i18n/translations';
import { formatDate } from '../utils/formatters';

export type NavSection =
  | 'dashboard'
  | 'inventory'
  | 'customers'
  | 'projects'
  | 'rentals'
  | 'payments'
  | 'invoices'
  | 'damages'
  | 'reports'
  | 'users';

interface NavDef {
  id: NavSection;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavDef[] = [
  { id: 'dashboard', labelKey: 'navDashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'] },
  { id: 'inventory', labelKey: 'navInventory', icon: Package, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'] },
  { id: 'customers', labelKey: 'navCustomers', icon: Users, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'] },
  { id: 'projects', labelKey: 'navProjects', icon: Building2, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'] },
  { id: 'rentals', labelKey: 'navRentals', icon: ClipboardList, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'] },
  { id: 'payments', labelKey: 'navPayments', icon: CreditCard, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { id: 'invoices', labelKey: 'navInvoices', icon: FileText, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'] },
  { id: 'damages', labelKey: 'navDamages', icon: AlertOctagon, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STOREKEEPER'] },
  { id: 'reports', labelKey: 'navReports', icon: BarChart3, roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { id: 'users', labelKey: 'navUsers', icon: Shield, roles: ['ADMIN'] },
];

export function DashboardLayout({
  activeTab,
  onNavigate,
  onQuickNewRental,
  children,
}: {
  activeTab: NavSection;
  onNavigate: (tab: NavSection) => void;
  onQuickNewRental: () => void;
  children: ReactNode;
}) {
  const { user, logout, hasRole } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      const res = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/notifications'
      );
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore transient poll failures
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [activeTab]);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const visibleNav = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));
  const currentTitleKey = NAV_ITEMS.find((n) => n.id === activeTab)?.labelKey || 'navDashboard';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Dark Navy Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0B1324] text-slate-200 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/company_logo_mark_1794824457556.jpg"
              alt="Kaah Steel Props"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-lg bg-white object-cover p-0.5"
            />
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold tracking-tight text-white">
                {t('brandName')}
              </div>
              <div className="truncate text-[11px] text-slate-400">
                {lang === 'so' ? 'Nidaamka Kirada' : 'Equipment Operations'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span className="truncate whitespace-nowrap">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user?.name}</div>
              <div className="truncate text-xs text-slate-400">
                {user?.role} · {user?.email}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title={t('signOut')}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400">{t('brandName')}</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="truncate font-display text-base font-semibold text-slate-900">
                {t(currentTitleKey)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Bilingual Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('so')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  lang === 'so' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                SO
              </button>
            </div>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen) loadNotifications();
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                aria-label={t('notifications')}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 font-mono text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-lg z-50">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-900">
                      {t('notifications')} ({unreadCount})
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        {t('markAllRead')}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        {t('noNotifications')}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          className={`flex items-start justify-between gap-3 px-4 py-3 ${
                            n.isRead ? 'bg-white opacity-70' : 'bg-amber-50/40'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-semibold ${
                                  n.severity === 'CRITICAL'
                                    ? 'text-red-700'
                                    : n.severity === 'WARNING'
                                    ? 'text-amber-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {n.severity}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {formatDate(n.createdAt)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm font-medium text-slate-900">
                              {lang === 'so' ? n.titleSo : n.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {lang === 'so' ? n.messageSo : n.message}
                            </p>
                          </div>
                          {!n.isRead && (
                            <button
                              type="button"
                              onClick={() => markRead(n._id)}
                              className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Mark read"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Primary CTA */}
            {hasRole('ADMIN', 'MANAGER', 'STOREKEEPER') && (
              <button
                type="button"
                onClick={onQuickNewRental}
                className="rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-slate-800"
              >
                + {t('newRental')}
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
