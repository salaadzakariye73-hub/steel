import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Edit3, Trash2, ArrowUpDown, History } from 'lucide-react';
import { api } from '../services/api';
import type { InventoryTransaction, Product } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatMoney, formatNumber } from '../utils/formatters';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ToastBanner, type ToastMessage } from '../components/ui/ToastBanner';
import { ProductImage } from '../components/ui/ProductImage';

const DEFAULT_IMAGES = [
  { label: 'Acrow Steel Props', url: '/src/assets/images/prop_acrow_standard_1794824459173.jpg' },
  { label: 'Heavy Shoring & Tripod', url: '/src/assets/images/prop_heavy_shoring_1794824458934.jpg' },
  { label: 'U-Head & Base Plates', url: '/src/assets/images/prop_scaffolding_accessories_1794824459003.jpg' },
];

export function InventoryPage() {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'MANAGER', 'STOREKEEPER');
  const canDelete = hasRole('ADMIN', 'MANAGER');

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState('');
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Product Form State
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'Steel Props',
    description: '',
    totalQuantity: 100,
    purchasePrice: 25,
    dailyRentalPrice: 0.6,
    minStockThreshold: 50,
    imageUrl: DEFAULT_IMAGES[0].url,
    warehouseLocation: 'Mogadishu Yard A',
  });

  // Adjust Stock State
  const [adjustForm, setAdjustForm] = useState({
    type: 'STOCK_IN' as 'STOCK_IN' | 'REPAIRED' | 'ADJUSTMENT',
    quantity: 50,
    notes: '',
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (categoryFilter !== 'ALL') q.set('category', categoryFilter);
      const res = await api.get<{ products: Product[] }>(`/products?${q.toString()}`);
      setProducts(res.products);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load inventory' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      sku: '',
      category: 'Steel Props',
      description: '',
      totalQuantity: 100,
      purchasePrice: 25,
      dailyRentalPrice: 0.6,
      minStockThreshold: 50,
      imageUrl: DEFAULT_IMAGES[0].url,
      warehouseLocation: 'Mogadishu Yard A',
    });
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      description: p.description,
      totalQuantity: p.totalQuantity,
      purchasePrice: p.purchasePrice,
      dailyRentalPrice: p.dailyRentalPrice,
      minStockThreshold: p.minStockThreshold,
      imageUrl: p.imageUrl || DEFAULT_IMAGES[0].url,
      warehouseLocation: p.warehouseLocation,
    });
    setFormOpen(true);
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/products/${editing._id}`, {
          name: form.name,
          sku: form.sku,
          category: form.category,
          description: form.description,
          purchasePrice: Number(form.purchasePrice),
          dailyRentalPrice: Number(form.dailyRentalPrice),
          minStockThreshold: Number(form.minStockThreshold),
          imageUrl: form.imageUrl,
          warehouseLocation: form.warehouseLocation,
        });
        setToast({ type: 'success', text: 'Product updated successfully.' });
      } else {
        await api.post('/products', {
          ...form,
          totalQuantity: Number(form.totalQuantity),
          purchasePrice: Number(form.purchasePrice),
          dailyRentalPrice: Number(form.dailyRentalPrice),
          minStockThreshold: Number(form.minStockThreshold),
        });
        setToast({ type: 'success', text: 'Product added to inventory.' });
      }
      setFormOpen(false);
      await loadProducts();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save product' });
    }
  };

  const handleAdjustStock = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    try {
      await api.post(`/products/${adjustTarget._id}/adjust`, {
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        notes: adjustForm.notes,
      });
      setToast({ type: 'success', text: 'Stock quantity updated.' });
      setAdjustTarget(null);
      await loadProducts();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Adjustment failed' });
    }
  };

  const openHistory = async (productId: string, title: string) => {
    try {
      const res = await api.get<{ transactions: InventoryTransaction[] }>(
        `/products/${productId}/transactions`
      );
      setTransactions(res.transactions);
      setHistoryTitle(title);
      setHistoryOpen(true);
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load ledger' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/products/${deleteTarget._id}`);
      setToast({ type: 'success', text: 'Product removed from active catalog.' });
      setDeleteTarget(null);
      await loadProducts();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
      setDeleteTarget(null);
    }
  };

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];
  const filteredProducts = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.warehouseLocation.toLowerCase().includes(search.toLowerCase())
  );

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
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? t('filterAll') : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openHistory('all', t('stockMovementHistory'))}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <History className="h-3.5 w-3.5" />
            <span>{t('stockMovementHistory')}</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('addProduct')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">{t('productName')}</th>
                <th className="px-4 py-3">{t('warehouseLocation')}</th>
                <th className="px-4 py-3 text-right">{t('totalQty')}</th>
                <th className="px-4 py-3 text-right">{t('availableQty')}</th>
                <th className="px-4 py-3 text-right">{t('rentedQty')}</th>
                <th className="px-4 py-3 text-right">{t('damagedQty')}</th>
                <th className="px-4 py-3 text-right">{t('lostQty')}</th>
                <th className="px-4 py-3 text-right">{t('dailyRate')}</th>
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
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.availableQuantity <= p.minStockThreshold;
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage src={p.imageUrl} alt={p.name} />
                          <div>
                            <div className="font-medium text-slate-900">{p.name}</div>
                            <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-slate-500">
                              <span>{p.sku}</span>
                              <span>·</span>
                              <span className="font-sans">{p.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{p.warehouseLocation}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {formatNumber(p.totalQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums">
                        <span className={isLow ? 'text-red-700' : 'text-emerald-700'}>
                          {formatNumber(p.availableQuantity)}
                        </span>
                        {isLow && (
                          <div className="font-sans text-[10px] font-medium text-red-600">
                            Low Stock
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-amber-700">
                        {formatNumber(p.rentedQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-orange-700">
                        {formatNumber(p.damagedQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-red-700">
                        {formatNumber(p.lostQuantity)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {formatMoney(p.dailyRentalPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustTarget(p);
                                  setAdjustForm({ type: 'STOCK_IN', quantity: 100, notes: '' });
                                }}
                                title={t('adjustStock')}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <ArrowUpDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(p)}
                                title={t('edit')}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => openHistory(p._id, `${p.name} (${p.sku})`)}
                            title={t('stockMovementHistory')}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              title={t('delete')}
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

      {/* Add / Edit Product Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('editProduct') : t('addProduct')}
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('productName')}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Standard Acrow Prop 3.5m"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('sku')}</label>
              <input
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="PRP-ACW-350"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('category')}</label>
              <input
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('warehouseLocation')}</label>
              <input
                required
                value={form.warehouseLocation}
                onChange={(e) => setForm({ ...form, warehouseLocation: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {!editing && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">{t('totalQty')}</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={form.totalQuantity}
                  onChange={(e) => setForm({ ...form, totalQuantity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('purchasePrice')} ($)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('dailyRate')} ($)</label>
              <input
                type="number"
                step="0.01"
                min={0.01}
                required
                value={form.dailyRentalPrice}
                onChange={(e) => setForm({ ...form, dailyRentalPrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('minThreshold')}</label>
              <input
                type="number"
                min={0}
                required
                value={form.minStockThreshold}
                onChange={(e) => setForm({ ...form, minStockThreshold: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Equipment Photo Preset</label>
            <div className="grid grid-cols-3 gap-2">
              {DEFAULT_IMAGES.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setForm({ ...form, imageUrl: img.url })}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs ${
                    form.imageUrl === img.url
                      ? 'border-slate-900 bg-slate-50 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ProductImage src={img.url} alt={img.label} className="h-8 w-10 rounded object-cover" />
                  <span className="truncate">{img.label}</span>
                </button>
              ))}
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
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        title={t('adjustStock')}
        subtitle={adjustTarget ? `${adjustTarget.name} (Available: ${adjustTarget.availableQuantity})` : ''}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Operation Type</label>
            <select
              value={adjustForm.type}
              onChange={(e) =>
                setAdjustForm({ ...adjustForm, type: e.target.value as 'STOCK_IN' | 'REPAIRED' | 'ADJUSTMENT' })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="STOCK_IN">Stock In (New Purchase)</option>
              <option value="REPAIRED">Repaired (Damaged → Available)</option>
              <option value="ADJUSTMENT">Audit Adjustment (+/-)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Quantity</label>
            <input
              type="number"
              required
              value={adjustForm.quantity}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">{t('notes')}</label>
            <input
              value={adjustForm.notes}
              onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reason or supplier reference"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAdjustTarget(null)}
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

      {/* Stock Movement History Modal */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={historyTitle}
        maxWidth="max-w-4xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">{t('date')}</th>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Avail. After</th>
                <th className="px-3 py-2.5">By / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx._id}>
                  <td className="px-3 py-2 font-mono text-slate-500">{formatDate(tx.createdAt)}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {tx.product?.name} <span className="font-mono text-slate-400">({tx.product?.sku})</span>
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-slate-700">{tx.type}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                    {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {formatNumber(tx.newAvailable)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {tx.performedBy?.name} · {tx.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Product"
        message={`Remove "${deleteTarget?.name}" from the active inventory catalog?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
