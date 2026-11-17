import { useEffect, useState } from 'react';
import {
  Package,
  CheckCircle2,
  Truck,
  RotateCcw,
  AlertTriangle,
  XCircle,
  ClipboardList,
  Clock,
  DollarSign,
  Wallet,
  Scale,
  ArrowUpRight,
} from 'lucide-react';
import { api } from '../services/api';
import type { DashboardData } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatStatusLabel,
  getStatusTone,
} from '../utils/formatters';
import type { NavSection } from '../layouts/DashboardLayout';

export function DashboardPage({ onNavigate }: { onNavigate: (tab: NavSection) => void }) {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<DashboardData>('/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white p-4" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Unable to load dashboard overview.'}
      </div>
    );
  }

  const { kpis, monthlyChart, recentRentals, overdueList, stockByCategory } = data;
  const maxChartValue = Math.max(
    1,
    ...monthlyChart.map((m) => Math.max(m.billedRevenue, m.cashCollected))
  );

  const inventoryCards = [
    { label: t('totalInventory'), value: formatNumber(kpis.totalInventory), icon: Package, tone: 'text-slate-900' },
    { label: t('availableProps'), value: formatNumber(kpis.availableProps), icon: CheckCircle2, tone: 'text-emerald-700' },
    { label: t('rentedProps'), value: formatNumber(kpis.rentedProps), icon: Truck, tone: 'text-amber-700' },
    { label: t('returnedProps'), value: formatNumber(kpis.returnedProps), icon: RotateCcw, tone: 'text-slate-700' },
    { label: t('damagedProps'), value: formatNumber(kpis.damagedProps), icon: AlertTriangle, tone: 'text-orange-700' },
    { label: t('lostProps'), value: formatNumber(kpis.lostProps), icon: XCircle, tone: 'text-red-700' },
  ];

  const operationalCards = [
    { label: t('activeRentals'), value: formatNumber(kpis.activeRentals), icon: ClipboardList, tone: 'text-slate-900' },
    { label: t('overdueRentals'), value: formatNumber(kpis.overdueRentals), icon: Clock, tone: kpis.overdueRentals > 0 ? 'text-red-700' : 'text-slate-900' },
    { label: t('totalRentalRevenue'), value: formatMoney(kpis.totalRentalRevenue), icon: DollarSign, tone: 'text-slate-900' },
    { label: t('totalPaymentsReceived'), value: formatMoney(kpis.totalPaymentsReceived), icon: Wallet, tone: 'text-emerald-700' },
    { label: t('outstandingBalances'), value: formatMoney(kpis.outstandingBalances), icon: Scale, tone: kpis.outstandingBalances > 0 ? 'text-red-700' : 'text-slate-900' },
    { label: t('netCashProfit'), value: formatMoney(kpis.netCashProfit), icon: ArrowUpRight, tone: kpis.netCashProfit >= 0 ? 'text-emerald-700' : 'text-red-700' },
  ];

  return (
    <div className="space-y-6">
      {/* Financial & Contract KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {operationalCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="truncate">{card.label}</span>
                <Icon className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <div className={`mt-2.5 font-mono text-xl font-bold tabular-nums ${card.tone}`}>
                {card.value}
              </div>
            </div>
          );
        })}
      </section>

      {/* Inventory KPIs */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {inventoryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span className="truncate">{card.label}</span>
                <Icon className="h-4 w-4 shrink-0 text-slate-400" />
              </div>
              <div className={`mt-2 font-mono text-xl font-bold tabular-nums ${card.tone}`}>
                {card.value}
              </div>
            </div>
          );
        })}
      </section>

      {/* Chart + Stock Breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Revenue vs Cash Collected Bar Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                {t('monthlyRevenueChart')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {lang === 'so'
                  ? 'Lacagta la dalacay iyo lacagta dhabta ah ee la ururiyay (USD)'
                  : 'Six-month comparison of invoiced billing vs. collected payments (USD)'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#0F172A]" />
                {t('totalRentalRevenue')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-amber-500" />
                {t('totalPaymentsReceived')}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <div className="grid h-56 grid-cols-6 items-end gap-3 border-b border-slate-200 pb-2">
              {monthlyChart.map((m) => {
                const billedH = Math.max(4, Math.round((m.billedRevenue / maxChartValue) * 180));
                const cashH = Math.max(4, Math.round((m.cashCollected / maxChartValue) * 180));
                const isHovered = hoveredMonth === m.key;

                return (
                  <div
                    key={m.key}
                    onMouseEnter={() => setHoveredMonth(m.key)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="relative flex h-full flex-col items-center justify-end"
                  >
                    {isHovered && (
                      <div className="absolute -top-2 z-10 w-40 rounded-lg border border-slate-200 bg-slate-900 p-2 text-[11px] text-white shadow-lg">
                        <div className="font-semibold text-amber-400">{m.label}</div>
                        <div className="mt-1 flex justify-between">
                          <span>Billed:</span>
                          <span className="font-mono tabular-nums">{formatMoney(m.billedRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Paid:</span>
                          <span className="font-mono tabular-nums">{formatMoney(m.cashCollected)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-end gap-1.5">
                      <div
                        style={{ height: `${billedH}px` }}
                        className="w-4 sm:w-6 rounded-t bg-[#0F172A] transition-opacity hover:opacity-85"
                        title={`Billed: ${formatMoney(m.billedRevenue)}`}
                      />
                      <div
                        style={{ height: `${cashH}px` }}
                        className="w-4 sm:w-6 rounded-t bg-amber-500 transition-opacity hover:opacity-85"
                        title={`Collected: ${formatMoney(m.cashCollected)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-6 gap-3 text-center">
              {monthlyChart.map((m) => (
                <div key={m.key} className="font-mono text-xs text-slate-500">
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stock Allocation by Product */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {t('inventoryAllocation')}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              {t('navInventory')} →
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {stockByCategory.map((item) => {
              const total = Math.max(1, item.total);
              const availPct = (item.available / total) * 100;
              const rentedPct = (item.rented / total) * 100;
              const dmgPct = ((item.damaged + item.lost) / total) * 100;

              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-slate-800">{item.name}</span>
                    <span className="shrink-0 font-mono text-slate-500 tabular-nums">
                      {formatNumber(item.available)} / {formatNumber(item.total)}
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div style={{ width: `${availPct}%` }} className="bg-emerald-600" title="Available" />
                    <div style={{ width: `${rentedPct}%` }} className="bg-amber-500" title="Rented" />
                    <div style={{ width: `${dmgPct}%` }} className="bg-red-500" title="Damaged / Lost" />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{t('availableQty')}: {formatNumber(item.available)}</span>
                    <span>·</span>
                    <span>{t('rentedQty')}: {formatNumber(item.rented)}</span>
                    <span>·</span>
                    <span>{t('damagedQty')}/{t('lostQty')}: {formatNumber(item.damaged + item.lost)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Overdue Alerts + Recent Rentals */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {t('recentRentals')}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('rentals')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              {t('navRentals')} →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t('rentalNumber')}</th>
                  <th className="px-4 py-3">{t('customer')}</th>
                  <th className="px-4 py-3">{t('expectedReturnDate')}</th>
                  <th className="px-4 py-3 text-right">{t('estimatedTotal')}</th>
                  <th className="px-4 py-3">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRentals.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">
                      {r.rentalNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.customer?.name}</div>
                      <div className="text-xs text-slate-500">{r.project?.name}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {formatDate(r.expectedReturnDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatMoney(r.expectedTotalCharge)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${getStatusTone(
                          r.status
                        )}`}
                      >
                        {formatStatusLabel(r.status, lang)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Contracts */}
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-4">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {t('overdueAlerts')}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {overdueList.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                {lang === 'so' ? 'Ma jiraan kirooyin waqtigoodii dhaafay.' : 'No overdue rental contracts.'}
              </div>
            ) : (
              overdueList.map((r) => (
                <div key={r._id} className="flex items-start justify-between gap-3 px-6 py-4">
                  <div>
                    <div className="font-mono text-xs font-semibold text-red-700">
                      {r.rentalNumber}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900">{r.customer?.name}</div>
                    <div className="text-xs text-slate-500">
                      {r.project?.name} · Due {formatDate(r.expectedReturnDate)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('rentals')}
                    className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t('viewDetails')}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
