import { useEffect, useState, type FormEvent } from 'react';
import { FileSpreadsheet, FileDown, Plus } from 'lucide-react';
import { api } from '../services/api';
import type {
  Customer,
  DamageRecord,
  Expense,
  InventoryTransaction,
  Product,
  Project,
  Rental,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, formatStatusLabel, toInputDate } from '../utils/formatters';
import { exportToExcel } from '../utils/excelExport';
import { exportTableReportPdf } from '../utils/pdfGenerator';
import { Modal } from '../components/ui/Modal';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';

type ReportTab =
  | 'dailyRevenue'
  | 'weeklyRevenue'
  | 'monthlyRevenue'
  | 'annualRevenue'
  | 'activeRentals'
  | 'completedRentals'
  | 'overdueRentals'
  | 'customerBalances'
  | 'inventoryMovement'
  | 'damagedEquipment'
  | 'lostEquipment'
  | 'profitAndExpenses';

interface ReportsPayload {
  revenue: {
    daily: { period: string; collectedUsd: number; paymentCount: number }[];
    weekly: { period: string; collectedUsd: number; paymentCount: number }[];
    monthly: { period: string; collectedUsd: number; paymentCount: number }[];
    annual: { period: string; collectedUsd: number; paymentCount: number }[];
  };
  rentals: {
    active: Rental[];
    completed: Rental[];
    overdue: Rental[];
  };
  customerBalances: {
    customerId: string;
    customerCode: string;
    name: string;
    companyName: string;
    phone: string;
    invoiceCount: number;
    totalBilled: number;
    totalPaid: number;
    balance: number;
  }[];
  inventoryMovement: InventoryTransaction[];
  damagedEquipment: DamageRecord[];
  lostEquipment: DamageRecord[];
  profitAndExpenses: {
    totalBilled: number;
    totalCollected: number;
    totalExpenses: number;
    netCashProfit: number;
    expenses: Expense[];
  };
}

const REPORT_TABS: { id: ReportTab; label: string; labelSo: string }[] = [
  { id: 'monthlyRevenue', label: 'Monthly Revenue', labelSo: 'Dakhliga Bisha' },
  { id: 'dailyRevenue', label: 'Daily Revenue', labelSo: 'Dakhliga Maalinkii' },
  { id: 'weeklyRevenue', label: 'Weekly Revenue', labelSo: 'Dakhliga Toddobaadka' },
  { id: 'annualRevenue', label: 'Annual Revenue', labelSo: 'Dakhliga Sanadka' },
  { id: 'activeRentals', label: 'Active Rentals', labelSo: 'Kirooyinka Firfircoon' },
  { id: 'completedRentals', label: 'Completed Rentals', labelSo: 'Kirooyinka Dhammaaday' },
  { id: 'overdueRentals', label: 'Overdue Rentals', labelSo: 'Kirooyinka Daahay' },
  { id: 'customerBalances', label: 'Customer Balances', labelSo: 'Haraaga Macaamiisha' },
  { id: 'inventoryMovement', label: 'Inventory Movement', labelSo: 'Dhaqdhaqaaqa Kaydka' },
  { id: 'damagedEquipment', label: 'Damaged Equipment', labelSo: 'Qalabka Waxyeeloobay' },
  { id: 'lostEquipment', label: 'Lost Equipment', labelSo: 'Qalabka Lumay' },
  { id: 'profitAndExpenses', label: 'Profit & Expenses', labelSo: 'Faa’iidada & Kharashaadka' },
];

export function ReportsPage() {
  const { lang, t } = useLanguage();
  const { hasRole } = useAuth();
  const canRecordExpense = hasRole('ADMIN', 'ACCOUNTANT');

  const [activeTab, setActiveTab] = useState<ReportTab>('monthlyRevenue');
  const [data, setData] = useState<ReportsPayload | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    customerId: '',
    projectId: '',
    productId: '',
  });

  // Expense Modal
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'MAINTENANCE',
    description: '',
    amount: 0,
    currency: 'USD' as 'USD' | 'SOS',
    exchangeRate: 27000,
    expenseDate: toInputDate(),
    vendor: '',
  });

  const loadReports = async (f = filters) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (f.startDate) q.set('startDate', f.startDate);
      if (f.endDate) q.set('endDate', f.endDate);
      if (f.customerId) q.set('customerId', f.customerId);
      if (f.projectId) q.set('projectId', f.projectId);
      if (f.productId) q.set('productId', f.productId);

      const res = await api.get<ReportsPayload>(`/reports?${q.toString()}`);
      setData(res);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load reports' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get<{ customers: Customer[] }>('/customers'),
      api.get<{ projects: Project[] }>('/projects'),
      api.get<{ products: Product[] }>('/products'),
    ]).then(([cRes, pRes, prRes]) => {
      setCustomers(cRes.customers);
      setProjects(pRes.projects);
      setProducts(prRes.products);
    });
    loadReports();
  }, []);

  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/expenses', {
        ...expenseForm,
        amount: Number(expenseForm.amount),
        exchangeRate: Number(expenseForm.exchangeRate),
      });
      setToast({ type: 'success', text: 'Operational expense recorded.' });
      setExpenseOpen(false);
      await loadReports();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save expense' });
    }
  };

  const getExportTable = (): { title: string; columns: string[]; rows: (string | number)[][] } => {
    if (!data) return { title: 'Report', columns: [], rows: [] };
    switch (activeTab) {
      case 'dailyRevenue':
        return {
          title: 'Daily Revenue Report',
          columns: ['Date', 'Payments Count', 'Collected (USD)'],
          rows: data.revenue.daily.map((r) => [r.period, r.paymentCount, r.collectedUsd]),
        };
      case 'weeklyRevenue':
        return {
          title: 'Weekly Revenue Report',
          columns: ['Week', 'Payments Count', 'Collected (USD)'],
          rows: data.revenue.weekly.map((r) => [r.period, r.paymentCount, r.collectedUsd]),
        };
      case 'monthlyRevenue':
        return {
          title: 'Monthly Revenue Report',
          columns: ['Month', 'Payments Count', 'Collected (USD)'],
          rows: data.revenue.monthly.map((r) => [r.period, r.paymentCount, r.collectedUsd]),
        };
      case 'annualRevenue':
        return {
          title: 'Annual Revenue Report',
          columns: ['Year', 'Payments Count', 'Collected (USD)'],
          rows: data.revenue.annual.map((r) => [r.period, r.paymentCount, r.collectedUsd]),
        };
      case 'activeRentals':
      case 'completedRentals':
      case 'overdueRentals': {
        const list =
          activeTab === 'activeRentals'
            ? data.rentals.active
            : activeTab === 'completedRentals'
            ? data.rentals.completed
            : data.rentals.overdue;
        return {
          title: `${activeTab} Report`,
          columns: ['Rental ID', 'Customer', 'Project', 'Start', 'Expected Return', 'Total Charge ($)', 'Status'],
          rows: list.map((r) => [
            r.rentalNumber,
            r.customer?.name || '',
            r.project?.name || '',
            formatDate(r.startDate),
            formatDate(r.expectedReturnDate),
            r.expectedTotalCharge,
            r.status,
          ]),
        };
      }
      case 'customerBalances':
        return {
          title: 'Customer Balances Report',
          columns: ['Code', 'Customer', 'Company', 'Invoices', 'Billed ($)', 'Paid ($)', 'Balance ($)'],
          rows: data.customerBalances.map((c) => [
            c.customerCode,
            c.name,
            c.companyName,
            c.invoiceCount,
            c.totalBilled,
            c.totalPaid,
            c.balance,
          ]),
        };
      case 'inventoryMovement':
        return {
          title: 'Inventory Movement Report',
          columns: ['Date', 'Product', 'SKU', 'Type', 'Qty', 'Avail After', 'Notes'],
          rows: data.inventoryMovement.map((tx) => [
            formatDate(tx.createdAt),
            tx.product?.name || '',
            tx.product?.sku || '',
            tx.type,
            tx.quantity,
            tx.newAvailable,
            tx.notes,
          ]),
        };
      case 'damagedEquipment':
        return {
          title: 'Damaged Equipment Report',
          columns: ['ID', 'Date', 'Product', 'Damaged Qty', 'Cost ($)', 'Responsibility', 'Description'],
          rows: data.damagedEquipment.map((d) => [
            d.recordNumber,
            formatDate(d.inspectionDate),
            d.product?.name || '',
            d.damagedQuantity,
            d.replacementCost,
            d.responsibility,
            d.damageDescription,
          ]),
        };
      case 'lostEquipment':
        return {
          title: 'Lost Equipment Report',
          columns: ['ID', 'Date', 'Product', 'Lost Qty', 'Cost ($)', 'Responsibility', 'Description'],
          rows: data.lostEquipment.map((d) => [
            d.recordNumber,
            formatDate(d.inspectionDate),
            d.product?.name || '',
            d.lostQuantity,
            d.replacementCost,
            d.responsibility,
            d.damageDescription,
          ]),
        };
      case 'profitAndExpenses':
        return {
          title: 'Profit and Expenses Report',
          columns: ['Expense ID', 'Date', 'Category', 'Vendor', 'Description', 'Amount (USD)'],
          rows: data.profitAndExpenses.expenses.map((e) => [
            e.expenseNumber,
            formatDate(e.expenseDate),
            e.category,
            e.vendor,
            e.description,
            e.usdEquivalent,
          ]),
        };
    }
  };

  const handleExportExcel = () => {
    const tbl = getExportTable();
    const jsonRows = tbl.rows.map((r) => {
      const obj: Record<string, string | number> = {};
      tbl.columns.forEach((col, i) => {
        obj[col] = r[i];
      });
      return obj;
    });
    exportToExcel({
      sheetName: activeTab,
      filename: `Kaah_${activeTab}_${toInputDate()}`,
      rows: jsonRows,
    });
  };

  const handleExportPdf = () => {
    const tbl = getExportTable();
    exportTableReportPdf({
      title: tbl.title,
      columns: tbl.columns,
      rows: tbl.rows,
      filename: `Kaah_${activeTab}_${toInputDate()}`,
    });
  };

  const tableDef = getExportTable();

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">{t('fromDate')}</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">{t('toDate')}</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">{t('customer')}</label>
            <select
              value={filters.customerId}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              <option value="">{t('filterAll')}</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">{t('project')}</label>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              <option value="">{t('filterAll')}</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">{t('productName')}</label>
            <select
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
            >
              <option value="">{t('filterAll')}</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadReports(filters)}
              className="flex-1 rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {t('applyFilters')}
            </button>
          </div>
        </div>

        {/* Report Selector Tabs */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {lang === 'so' ? tab.labelSo : tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Profit & Expenses Summary Banner */}
      {activeTab === 'profitAndExpenses' && data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{t('totalRentalRevenue')}</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900">
              {formatMoney(data.profitAndExpenses.totalBilled)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{t('totalPaymentsReceived')}</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-700">
              {formatMoney(data.profitAndExpenses.totalCollected)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Total Operational Expenses</div>
            <div className="mt-1 font-mono text-xl font-bold text-orange-700">
              {formatMoney(data.profitAndExpenses.totalExpenses)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{t('netCashProfit')}</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900">
              {formatMoney(data.profitAndExpenses.netCashProfit)}
            </div>
          </div>
        </div>
      )}

      {/* Action & Export Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-slate-900">{tableDef.title}</h2>
        <div className="flex items-center gap-2">
          {canRecordExpense && activeTab === 'profitAndExpenses' && (
            <button
              type="button"
              onClick={() => setExpenseOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('addExpense')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
            <span>{t('exportExcel')}</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileDown className="h-3.5 w-3.5 text-red-700" />
            <span>{t('exportPdf')}</span>
          </button>
        </div>
      </div>

      {/* Report Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                {tableDef.columns.map((col) => (
                  <th key={col} className="px-4 py-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={Math.max(1, tableDef.columns.length)} className="px-4 py-10 text-center text-slate-500">
                    {t('loading')}
                  </td>
                </tr>
              ) : tableDef.rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, tableDef.columns.length)} className="px-4 py-10 text-center text-slate-500">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                tableDef.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    {row.map((cell, cIdx) => {
                      const colName = tableDef.columns[cIdx] || '';
                      const isMoney =
                        colName.includes('($)') || colName.includes('(USD)');
                      return (
                        <td
                          key={cIdx}
                          className={`px-4 py-3 text-xs ${
                            typeof cell === 'number' ? 'font-mono tabular-nums font-medium' : 'text-slate-700'
                          }`}
                        >
                          {isMoney && typeof cell === 'number'
                            ? formatMoney(cell)
                            : colName === 'Status'
                            ? formatStatusLabel(String(cell), lang)
                            : String(cell)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title={t('addExpense')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('expenseCategory')}</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="MAINTENANCE">Maintenance & Repair</option>
                <option value="TRANSPORT">Transport & Haulage</option>
                <option value="WAREHOUSE">Warehouse & Yard</option>
                <option value="SALARIES">Staff Salaries</option>
                <option value="UTILITIES">Utilities</option>
                <option value="PURCHASE">Hardware Purchase</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('date')}</label>
              <input
                type="date"
                required
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('amount')}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('currency')}</label>
              <select
                value={expenseForm.currency}
                onChange={(e) =>
                  setExpenseForm({ ...expenseForm, currency: e.target.value as 'USD' | 'SOS' })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="SOS">SOS</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">{t('vendor')}</label>
            <input
              value={expenseForm.vendor}
              onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
            <input
              required
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setExpenseOpen(false)}
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
