import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Boxes,
  ArrowRightLeft,
  Sliders,
  Download,
  AlertTriangle,
  RefreshCw,
  Info,
  Check,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Tag,
  Package,
  Layers,
  X,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { InventoryBalance, Category, Location, Product } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { SearchInput } from '../components/common/SearchInput.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';

export const InventoryPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();

  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(searchParams.get('sku') || '');
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('lowStock') === 'true');

  // Multi-selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Stock Modals
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null);

  // Product CRUD Modals
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any | null>(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [isProductDetailLoading, setIsProductDetailLoading] = useState(false);

  // New Product Form State
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCatId, setNewCatId] = useState('');
  const [newUom, setNewUom] = useState('EA');
  const [newBarcode, setNewBarcode] = useState('');
  const [newMinReorder, setNewMinReorder] = useState(10);
  const [newTargetStock, setNewTargetStock] = useState(100);
  const [newUnitCost, setNewUnitCost] = useState(0);
  const [newUnitPrice, setNewUnitPrice] = useState(0);

  // Edit Product Form State
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCatId, setEditCatId] = useState('');
  const [editMinReorder, setEditMinReorder] = useState(10);
  const [editTargetStock, setEditTargetStock] = useState(100);
  const [editUnitCost, setEditUnitCost] = useState(0);
  const [editUnitPrice, setEditUnitPrice] = useState(0);

  // Adjustment form states
  const [newOnHand, setNewOnHand] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [destLocationId, setDestLocationId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [balRes, catRes] = await Promise.all([
        api.listBalances({
          warehouseId: selectedWarehouseId,
          search: search || undefined,
          categoryId: categoryId || undefined,
          lowStockOnly,
          limit: 100,
        }),
        api.listCategories(),
      ]);
      setBalances(balRes);
      setCategories(catRes);
      if (catRes.length > 0 && !newCatId) {
        setNewCatId(catRes[0].id);
      }

      if (selectedWarehouseId) {
        const locRes = await api.listLocations(selectedWarehouseId);
        setLocations(locRes);
      }
    } catch (err: any) {
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId, categoryId, lowStockOnly]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === balances.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(balances.map((b) => b.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Bulk CSV Export
  const handleBulkExportSelected = () => {
    const selectedBalances = balances.filter((b) => selectedIds.has(b.id));
    if (selectedBalances.length === 0) {
      toast.error('No items selected for export');
      return;
    }

    const headers = [
      'Warehouse Code',
      'Location Code',
      'SKU',
      'Product Name',
      'Category',
      'On Hand',
      'Reserved',
      'Damaged',
      'Available',
      'Unit Cost ($)',
      'Valuation ($)',
    ];

    const rows = selectedBalances.map((b) => [
      `"${b.warehouse.code}"`,
      `"${b.location.code}"`,
      `"${b.product.sku}"`,
      `"${b.product.name.replace(/"/g, '""')}"`,
      `"${b.product.category?.name || 'General'}"`,
      b.onHand,
      b.reserved,
      b.damaged,
      b.available,
      b.product.unitCost.toFixed(2),
      b.valuation.toFixed(2),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockpilot-selected-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(`Exported ${selectedBalances.length} selected inventory records`);
  };

  // Adjust stock
  const openAdjust = (bal: InventoryBalance) => {
    setSelectedBalance(bal);
    setNewOnHand(bal.onHand);
    setAdjustReason('');
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBalance) return;
    setIsSubmitting(true);
    try {
      await api.adjustStock({
        warehouseId: selectedBalance.warehouseId,
        locationId: selectedBalance.locationId,
        productId: selectedBalance.productId,
        newOnHand,
        reason: adjustReason,
        lotId: selectedBalance.lotId,
      });
      toast.success(`Inventory balance adjusted for ${selectedBalance.product.sku}`);
      setAdjustModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transfer stock
  const openTransfer = (bal: InventoryBalance) => {
    setSelectedBalance(bal);
    setTransferQty(1);
    setDestLocationId('');
    setTransferReason('');
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBalance || !destLocationId) return;
    setIsSubmitting(true);
    try {
      await api.transferStock({
        warehouseId: selectedBalance.warehouseId,
        sourceLocationId: selectedBalance.locationId,
        destLocationId,
        productId: selectedBalance.productId,
        quantity: transferQty,
        reason: transferReason,
      });
      toast.success(`Transferred ${transferQty} units of ${selectedBalance.product.sku}`);
      setTransferModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Product Detail Modal
  const openProductDetail = async (productId: string) => {
    setIsProductDetailLoading(true);
    setIsEditingProduct(false);
    try {
      const prod = await api.getProduct(productId);
      setDetailProduct(prod);
      setEditName(prod.name);
      setEditDesc(prod.description || '');
      setEditCatId(prod.categoryId);
      setEditMinReorder(prod.minReorderPoint);
      setEditTargetStock(prod.targetStock);
      setEditUnitCost(prod.unitCost);
      setEditUnitPrice(prod.unitPrice);
    } catch (err: any) {
      toast.error('Failed to load product details');
    } finally {
      setIsProductDetailLoading(false);
    }
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailProduct) return;
    setIsSubmitting(true);
    try {
      const updated = await api.updateProduct(detailProduct.id, {
        name: editName,
        description: editDesc,
        categoryId: editCatId,
        minReorderPoint: editMinReorder,
        targetStock: editTargetStock,
        unitCost: editUnitCost,
        unitPrice: editUnitPrice,
      });
      toast.success(`Product ${updated.sku} updated successfully`);
      setDetailProduct(updated);
      setIsEditingProduct(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateProduct = async () => {
    if (!detailProduct) return;
    if (!confirm(`Are you sure you want to deactivate ${detailProduct.sku}?`)) return;
    setIsSubmitting(true);
    try {
      await api.deleteProduct(detailProduct.id);
      toast.success(`Product ${detailProduct.sku} deactivated`);
      setDetailProduct(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to deactivate product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Product Submit
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await api.createProduct({
        sku: newSku,
        name: newName,
        description: newDesc,
        categoryId: newCatId,
        uom: newUom,
        barcode: newBarcode || undefined,
        minReorderPoint: newMinReorder,
        targetStock: newTargetStock,
        unitCost: newUnitCost,
        unitPrice: newUnitPrice,
      });
      toast.success(`Registered product ${created.sku}`);
      setCreateProductOpen(false);
      setNewSku('');
      setNewName('');
      setNewDesc('');
      setNewBarcode('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedIds.size;
  const selectedBalances = balances.filter((b) => selectedIds.has(b.id));
  const selectedUnits = selectedBalances.reduce((sum, b) => sum + b.available, 0);
  const selectedValuation = selectedBalances.reduce((sum, b) => sum + b.valuation, 0);

  return (
    <div className="space-y-4">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Inventory Ledger & Balances
          </h1>
          <p className="text-xs text-surface-500">
            Granular bin-level stock balances and real-time ledger accounting
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <a
            href={api.getExportCsvUrl(selectedWarehouseId)}
            download="stockpilot-inventory.csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-surface-700 bg-white border border-surface-300 rounded-md hover:bg-surface-50 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          {hasRole('ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_SPECIALIST') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateProductOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search SKU, name, barcode..."
          />
        </form>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-surface-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
            />
            <span>Low Stock Deficit Only</span>
          </label>
        </div>
      </div>

      {/* Safe Bulk Action Toolbar */}
      {selectedCount > 0 && (
        <div className="p-2.5 px-4 bg-surface-900 text-white rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="font-bold text-brand-400">
              {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
            </span>
            <span className="text-surface-400">|</span>
            <span>Available Units: <strong className="text-white">{selectedUnits}</strong></span>
            <span className="text-surface-400">|</span>
            <span>Total Valuation: <strong className="text-emerald-400">${selectedValuation.toFixed(2)}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkExportSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 rounded text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Selected CSV</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-surface-400 hover:text-white text-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Balances Data Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="px-3 py-2.5 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={balances.length > 0 && selectedIds.size === balances.length}
                    onChange={toggleSelectAll}
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                    title="Select all"
                  />
                </th>
                <th className="px-4 py-2.5">Warehouse</th>
                <th className="px-4 py-2.5">Location / Bin</th>
                <th className="px-4 py-2.5">SKU & Item Name</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5 text-right">On Hand</th>
                <th className="px-4 py-2.5 text-right">Reserved</th>
                <th className="px-4 py-2.5 text-right">Damaged</th>
                <th className="px-4 py-2.5 text-right font-bold text-surface-900">Available</th>
                <th className="px-4 py-2.5 text-right">Valuation</th>
                <th className="px-4 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-surface-400">
                    Loading inventory records...
                  </td>
                </tr>
              ) : balances.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8">
                    <EmptyState
                      icon={Boxes}
                      title="No Inventory Records Found"
                      description="No stock matching the applied filters. Clear filters or check warehouse selection."
                    />
                  </td>
                </tr>
              ) : (
                balances.map((b) => (
                  <tr
                    key={b.id}
                    className={`hover:bg-surface-50/70 transition-colors ${
                      selectedIds.has(b.id) ? 'bg-brand-50/20' : ''
                    }`}
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(b.id)}
                        onChange={() => toggleSelectOne(b.id)}
                        className="rounded border-surface-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-surface-700">
                      {b.warehouse.code}
                    </td>
                    <td className="px-4 py-3 font-mono text-surface-600">
                      <span className="px-1.5 py-0.5 rounded bg-surface-100 border border-surface-200 text-[11px]">
                        {b.location.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openProductDetail(b.productId)}
                        className="font-mono font-semibold text-brand-600 hover:text-brand-700 hover:underline text-left block"
                        title="Click to view full product details & specs"
                      >
                        {b.product.sku}
                      </button>
                      <div className="text-surface-500 text-[11px] truncate max-w-xs">{b.product.name}</div>
                    </td>
                    <td className="px-4 py-3 text-surface-600">
                      {b.product.category?.name || 'General'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{b.onHand}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">
                      {b.reserved > 0 ? b.reserved : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-700">
                      {b.damaged > 0 ? b.damaged : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-surface-900">
                      <span
                        className={
                          b.isLowStock
                            ? 'text-amber-600 font-black'
                            : 'text-emerald-700'
                        }
                      >
                        {b.available}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-surface-600">
                      ${b.valuation.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openTransfer(b)}
                          title="Transfer stock to another bin"
                          className="p-1 rounded text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        {hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
                          <button
                            onClick={() => openAdjust(b)}
                            title="Cycle count adjustment"
                            className="p-1 rounded text-surface-500 hover:text-brand-600 hover:bg-surface-100 transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
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

      {/* Product Detail & Edit Modal */}
      <Modal
        isOpen={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        title={detailProduct ? `${detailProduct.sku} — ${detailProduct.name}` : 'Product Details'}
        description="Comprehensive item specifications, warehouse network stock, and lot records"
      >
        {detailProduct && (
          <div className="space-y-4">
            {!isEditingProduct ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-surface-50 border border-surface-200 rounded-lg text-xs font-mono">
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">SKU Code</span>
                    <span className="font-bold text-surface-900">{detailProduct.sku}</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Category</span>
                    <span className="font-medium text-surface-800">{detailProduct.category?.name || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Unit of Measure</span>
                    <span className="font-medium text-surface-800">{detailProduct.uom}</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Unit Cost</span>
                    <span className="font-semibold text-surface-900">${detailProduct.unitCost?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Unit Price</span>
                    <span className="font-semibold text-emerald-700">${detailProduct.unitPrice?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Barcode</span>
                    <span className="text-surface-600">{detailProduct.barcode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Min Reorder</span>
                    <span className="font-semibold text-rose-600">{detailProduct.minReorderPoint} units</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Target Stock</span>
                    <span className="font-semibold text-surface-800">{detailProduct.targetStock} units</span>
                  </div>
                  <div>
                    <span className="text-surface-400 block text-[10px] uppercase">Status</span>
                    <span className={detailProduct.active ? 'text-emerald-700 font-bold' : 'text-surface-400'}>
                      {detailProduct.active ? 'ACTIVE' : 'DEACTIVATED'}
                    </span>
                  </div>
                </div>

                {detailProduct.description && (
                  <p className="text-xs text-surface-600 bg-white p-2.5 border border-surface-200 rounded">
                    {detailProduct.description}
                  </p>
                )}

                {/* Network Stock Breakdown */}
                <div>
                  <h4 className="text-xs font-semibold text-surface-800 uppercase font-mono tracking-wider mb-2">
                    Storage Bins & Network Balances
                  </h4>
                  {detailProduct.inventoryBalances?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-surface-400 bg-surface-50 border border-surface-200 rounded">
                      No stock currently on hand in any facility bin.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-surface-200 rounded">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-50 text-surface-500 font-mono text-[10px] uppercase">
                          <tr>
                            <th className="px-3 py-1.5">Facility</th>
                            <th className="px-3 py-1.5">Location</th>
                            <th className="px-3 py-1.5 text-right">On Hand</th>
                            <th className="px-3 py-1.5 text-right">Reserved</th>
                            <th className="px-3 py-1.5 text-right font-bold">Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100 font-mono">
                          {detailProduct.inventoryBalances?.map((bal: any) => (
                            <tr key={bal.id} className="hover:bg-surface-50">
                              <td className="px-3 py-1.5">{bal.warehouse?.code}</td>
                              <td className="px-3 py-1.5">{bal.location?.code}</td>
                              <td className="px-3 py-1.5 text-right">{bal.onHand}</td>
                              <td className="px-3 py-1.5 text-right text-amber-700">{bal.reserved}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-surface-900">
                                {Math.max(0, bal.onHand - bal.reserved - bal.damaged)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Lots & Expiry */}
                {detailProduct.lots && detailProduct.lots.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-surface-800 uppercase font-mono tracking-wider mb-2">
                      Active Lots & Batches
                    </h4>
                    <div className="space-y-1">
                      {detailProduct.lots.map((lot: any) => (
                        <div
                          key={lot.id}
                          className="flex items-center justify-between p-2 bg-surface-50 border border-surface-200 rounded text-xs font-mono"
                        >
                          <span className="font-bold text-surface-800">Lot: {lot.lotNumber}</span>
                          <span className="text-surface-500 text-[11px]">
                            Expiry: {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString() : 'None'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-surface-200">
                  {hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
                    <button
                      type="button"
                      onClick={handleDeactivateProduct}
                      className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Deactivate</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => setDetailProduct(null)}>
                      Close
                    </Button>
                    {hasRole('ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_SPECIALIST') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setIsEditingProduct(true)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit Item
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Inline Edit Mode */
              <form onSubmit={handleSaveProductEdit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                    Product Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full p-2 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                      Category
                    </label>
                    <select
                      value={editCatId}
                      onChange={(e) => setEditCatId(e.target.value)}
                      className="w-full h-8 px-3 text-xs bg-white border border-surface-300 rounded-md"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                      Unit Cost ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editUnitCost}
                      onChange={(e) => setEditUnitCost(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                      Unit Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={editUnitPrice}
                      onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                      Min Reorder Point
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editMinReorder}
                      onChange={(e) => setEditMinReorder(parseInt(e.target.value, 10) || 0)}
                      className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                      Target Level
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editTargetStock}
                      onChange={(e) => setEditTargetStock(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-200">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingProduct(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                    Save Changes
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Register New Product Modal */}
      <Modal
        isOpen={createProductOpen}
        onClose={() => setCreateProductOpen(false)}
        title="Register Master Catalog SKU"
        description="Add a new stock-keeping unit into the centralized master product catalog"
      >
        <form onSubmit={handleCreateProductSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                SKU Identifier *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ME-BRG-010"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                className="w-full h-8 px-3 text-xs font-mono font-bold uppercase border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Category *
              </label>
              <select
                required
                value={newCatId}
                onChange={(e) => setNewCatId(e.target.value)}
                className="w-full h-8 px-3 text-xs bg-white border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Product Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Industrial Ball Bearing 50mm Sealed"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Description / Specs
            </label>
            <textarea
              rows={2}
              placeholder="Technical specs, grade, manufacturer notes..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full p-2 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Unit of Measure (UOM)
              </label>
              <select
                value={newUom}
                onChange={(e) => setNewUom(e.target.value)}
                className="w-full h-8 px-3 text-xs bg-white border border-surface-300 rounded-md font-mono"
              >
                <option value="EA">EA (Each)</option>
                <option value="BOX">BOX (Box)</option>
                <option value="PK">PK (Pack)</option>
                <option value="SET">SET (Set)</option>
                <option value="ROLL">ROLL (Roll)</option>
                <option value="PALLET">PALLET (Pallet)</option>
                <option value="KG">KG (Kilogram)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Barcode / UPC
              </label>
              <input
                type="text"
                placeholder="Scan or enter barcode"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                className="w-full h-8 px-3 text-xs font-mono border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Unit Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={newUnitCost}
                onChange={(e) => setNewUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Unit Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Min Reorder
              </label>
              <input
                type="number"
                min={0}
                value={newMinReorder}
                onChange={(e) => setNewMinReorder(parseInt(e.target.value, 10) || 0)}
                className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Target Stock
              </label>
              <input
                type="number"
                min={1}
                value={newTargetStock}
                onChange={(e) => setNewTargetStock(parseInt(e.target.value, 10) || 1)}
                className="w-full h-8 px-3 text-xs border border-surface-300 rounded-md font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateProductOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Register Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cycle Count Stock Adjustment Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Cycle Count Inventory Adjustment"
        description="Authorized ledger adjustment with mandatory audit explanation"
      >
        {selectedBalance && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div className="p-3 rounded bg-surface-50 border border-surface-200 text-xs space-y-1">
              <div>
                <span className="text-surface-400">SKU:</span>{' '}
                <span className="font-mono font-semibold">{selectedBalance.product.sku}</span>
              </div>
              <div>
                <span className="text-surface-400">Location:</span>{' '}
                <span className="font-mono">{selectedBalance.location.code}</span>
              </div>
              <div>
                <span className="text-surface-400">Current On Hand:</span>{' '}
                <span className="font-mono font-semibold">{selectedBalance.onHand}</span>
              </div>
              <div>
                <span className="text-surface-400">Active Reserved:</span>{' '}
                <span className="font-mono text-amber-700">{selectedBalance.reserved}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                New On-Hand Physical Count
              </label>
              <input
                type="number"
                min={selectedBalance.reserved + selectedBalance.damaged}
                value={newOnHand}
                onChange={(e) => setNewOnHand(parseInt(e.target.value, 10) || 0)}
                className="w-full h-9 px-3 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500 text-surface-900"
                required
              />
              <div className="text-[11px] text-surface-500 mt-1">
                Cannot be lower than reserved stock ({selectedBalance.reserved}). Delta will be recorded in movement ledger.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Audit Reason (Mandatory)
              </label>
              <textarea
                required
                rows={3}
                placeholder="Specify root cause: cycle count variance, damaged goods, physical count reconciliation..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full p-2 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500 text-surface-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setAdjustModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Save Adjustment
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Bin Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Bin-to-Bin Stock Transfer"
        description="Transfer available units atomically to another active warehouse bin"
      >
        {selectedBalance && (
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="p-3 rounded bg-surface-50 border border-surface-200 text-xs space-y-1">
              <div>
                <span className="text-surface-400">SKU:</span>{' '}
                <span className="font-mono font-semibold">{selectedBalance.product.sku}</span>
              </div>
              <div>
                <span className="text-surface-400">Source Location:</span>{' '}
                <span className="font-mono">{selectedBalance.location.code}</span>
              </div>
              <div>
                <span className="text-surface-400">Available to Transfer:</span>{' '}
                <span className="font-mono font-bold text-emerald-700">{selectedBalance.available}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Transfer Quantity
              </label>
              <input
                type="number"
                min={1}
                max={selectedBalance.available}
                value={transferQty}
                onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 1)}
                className="w-full h-9 px-3 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500 text-surface-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Destination Storage Bin
              </label>
              <select
                required
                value={destLocationId}
                onChange={(e) => setDestLocationId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select target bin...</option>
                {locations
                  .filter((l) => l.id !== selectedBalance.locationId && l.status === 'ACTIVE')
                  .map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} ({loc.type} - {loc.zone})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Transfer Memo / Notes
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g., Relocation to forward pick face"
                className="w-full h-9 px-3 text-xs border border-surface-300 rounded-md focus:ring-2 focus:ring-brand-500 text-surface-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setTransferModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Execute Transfer
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
export default InventoryPage;
