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
  Filter,
  ArrowRight,
  TrendingDown,
  ChevronRight,
  History,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { InventoryBalance, Category, Location, Product } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { SearchInput } from '../components/common/SearchInput.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { toast } from 'sonner';
import { formatINR, formatNumberIN, formatIST } from '../utils/formatters.js';

type StockStateFilter = 'ALL' | 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export const InventoryPage: React.FC = () => {
  const { selectedWarehouseId, warehouses } = useWarehouse();
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(searchParams.get('sku') || searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState('');
  const [stockState, setStockState] = useState<StockStateFilter>(
    searchParams.get('filter') === 'low-stock' || searchParams.get('lowStock') === 'true' ? 'LOW_STOCK' : 'ALL'
  );

  // Stock Modals
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null);

  // Product Drawer & CRUD
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any | null>(null);
  const [productDrawerTab, setProductDrawerTab] = useState<'overview' | 'locations' | 'lots' | 'movements'>('overview');
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

  // Adjustment & Transfer Form
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
          lowStockOnly: stockState === 'LOW_STOCK',
          limit: 150,
        }),
        api.listCategories(),
      ]);
      setBalances(balRes);
      setCategories(catRes);

      if (selectedWarehouseId) {
        const locRes = await api.listLocations(selectedWarehouseId);
        setLocations(locRes);
      }
    } catch (err) {
      toast.error('Failed to load inventory balances');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId, categoryId, stockState]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const clearAllFilters = () => {
    setSearch('');
    setCategoryId('');
    setStockState('ALL');
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

  // Product Detail Drawer
  const openProductDetail = async (productId: string) => {
    setIsProductDetailLoading(true);
    setIsEditingProduct(false);
    setProductDrawerTab('overview');
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
      toast.success(`Updated ${updated.sku}`);
      setDetailProduct(updated);
      setIsEditingProduct(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await api.createProduct({
        sku: newSku,
        name: newName,
        description: newDesc,
        categoryId: newCatId || (categories[0]?.id || ''),
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

  // Filter balances based on search and stockState
  const filteredBalances = balances.filter((bal) => {
    if (stockState === 'HEALTHY') {
      return bal.available > bal.product.minReorderPoint;
    }
    if (stockState === 'OUT_OF_STOCK') {
      return bal.available === 0;
    }
    return true;
  });

  const isFilterActive = Boolean(search || categoryId || stockState !== 'ALL');

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Stock Balances & Lookup</h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {filteredBalances.length} active bin balances
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time sellable available inventory, reservations, and location-level balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <a
            href={api.getExportCsvUrl(selectedWarehouseId)}
            download="stockpilot-inventory.csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-xs transition-colors"
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
              Add Product SKU
            </Button>
          )}
        </div>
      </div>

      {/* Prominent Search Field at the Top */}
      <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="relative">
          <SearchInput
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search SKU code, product title, barcode, or bin location (Press Enter)..."
          />
        </form>

        {/* Compact Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-mono text-[11px] uppercase">Filter:</span>

            {/* Category Dropdown */}
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-8 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Stock State Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              {(
                [
                  { id: 'ALL', label: 'All Stock' },
                  { id: 'HEALTHY', label: 'In Stock' },
                  { id: 'LOW_STOCK', label: 'Low Stock Deficit' },
                  { id: 'OUT_OF_STOCK', label: 'Out of Stock' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStockState(st.id)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    stockState === st.id
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters Button */}
          {isFilterActive && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Default Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5">Product Name</th>
                <th className="px-4 py-2.5 text-right font-bold text-slate-900">Available</th>
                <th className="px-4 py-2.5 text-right">On Hand</th>
                <th className="px-4 py-2.5 text-right">Reserved</th>
                <th className="px-4 py-2.5">Bin / Location</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading stock balances...
                  </td>
                </tr>
              ) : filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No inventory balances match current search criteria.
                  </td>
                </tr>
              ) : (
                filteredBalances.map((bal) => {
                  const isLow = bal.available <= bal.product.minReorderPoint && bal.available > 0;
                  const isOut = bal.available === 0;

                  return (
                    <tr
                      key={bal.id}
                      onClick={() => openProductDetail(bal.productId)}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. SKU */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{bal.product.sku}</span>
                          <Eye className="w-3 h-3 text-slate-300 group-hover:text-slate-600" />
                        </div>
                        {bal.product.barcode && (
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                            UPC: {bal.product.barcode}
                          </div>
                        )}
                      </td>

                      {/* 2. Product Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 truncate max-w-xs">{bal.product.name}</div>
                        <span className="text-[10px] font-mono text-slate-600">
                          {bal.product.category?.name || 'Standard'} • {bal.product.uom}
                        </span>
                      </td>

                      {/* 3. Available (Right-Aligned, Tabular) */}
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-800 font-bold border border-amber-200'
                              : 'text-slate-900'
                          }`}
                        >
                          {formatNumberIN(bal.available)}
                        </span>
                      </td>

                      {/* 4. On Hand (Right-Aligned, Tabular) */}
                      <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                        {formatNumberIN(bal.onHand)}
                      </td>

                      {/* 5. Reserved (Right-Aligned, Tabular) */}
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {bal.reserved > 0 ? (
                          <span className="text-amber-700 font-semibold">{formatNumberIN(bal.reserved)}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* 6. Bin / Location */}
                      <td className="px-4 py-3 font-mono">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {bal.location.code}
                        </span>
                        <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                          {bal.warehouse.code} • {bal.location.type}
                        </div>
                      </td>

                      {/* 7. Status Explanation */}
                      <td className="px-4 py-3">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                              Low Stock Deficit
                            </span>
                            <div className="text-[10px] text-amber-700 font-mono">
                              Avail: {bal.available} / Min: {bal.product.minReorderPoint}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                            Healthy
                          </span>
                        )}
                      </td>

                      {/* 8. Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openTransfer(bal)}
                            title="Transfer Stock to another Bin"
                            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          {hasRole('ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_SPECIALIST') && (
                            <button
                              type="button"
                              onClick={() => openAdjust(bal)}
                              title="Perform Cycle Count Adjustment"
                              className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
                            >
                              <Sliders className="w-3.5 h-3.5" />
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

      {/* Slide-Out Product Detail Drawer */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDetailProduct(null)}
          />
          <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-slate-900">{detailProduct.sku}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-800">
                    {detailProduct.category?.name || 'General'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5 truncate max-w-sm">{detailProduct.name}</div>
              </div>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Tabs */}
            <div className="flex items-center border-b border-slate-200 px-4 text-xs font-medium">
              {(
                [
                  { id: 'overview', label: 'Stock Overview' },
                  { id: 'locations', label: 'Bins & Locations' },
                  { id: 'lots', label: 'Lots & Expiry' },
                  { id: 'movements', label: 'Movement Ledger' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProductDrawerTab(tab.id)}
                  className={`px-3 py-2 border-b-2 transition-colors ${
                    productDrawerTab === tab.id
                      ? 'border-blue-600 text-slate-900 font-bold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Tab: Overview */}
              {productDrawerTab === 'overview' && (
                <div className="space-y-4">
                  {/* Stock Composition Visualization */}
                  {(() => {
                    const totalOnHand =
                      detailProduct.inventoryBalances?.reduce((s: number, b: any) => s + b.onHand, 0) || 0;
                    const totalReserved =
                      detailProduct.inventoryBalances?.reduce((s: number, b: any) => s + b.reserved, 0) || 0;
                    const totalDamaged =
                      detailProduct.inventoryBalances?.reduce((s: number, b: any) => s + b.damaged, 0) || 0;
                    const totalAvailable = Math.max(0, totalOnHand - totalReserved - totalDamaged);

                    const availPct = totalOnHand > 0 ? (totalAvailable / totalOnHand) * 100 : 0;
                    const resPct = totalOnHand > 0 ? (totalReserved / totalOnHand) * 100 : 0;
                    const damPct = totalOnHand > 0 ? (totalDamaged / totalOnHand) * 100 : 0;

                    return (
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span>Stock Composition Arithmetic</span>
                          <span className="font-mono text-slate-600">
                            On Hand: <strong>{formatNumberIN(totalOnHand)} {detailProduct.uom}</strong>
                          </span>
                        </div>

                        {/* Composition Bar */}
                        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                          <div
                            title={`Available: ${totalAvailable}`}
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${availPct}%` }}
                          />
                          <div
                            title={`Reserved: ${totalReserved}`}
                            className="h-full bg-amber-500 transition-all"
                            style={{ width: `${resPct}%` }}
                          />
                          <div
                            title={`Damaged: ${totalDamaged}`}
                            className="h-full bg-rose-500 transition-all"
                            style={{ width: `${damPct}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-[11px]">
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <div className="text-slate-500 text-[10px] uppercase">Available</div>
                            <div className="font-bold text-emerald-700 text-sm mt-0.5">
                              {formatNumberIN(totalAvailable)}
                            </div>
                          </div>
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <div className="text-slate-500 text-[10px] uppercase">Reserved</div>
                            <div className="font-bold text-amber-700 text-sm mt-0.5">
                              {formatNumberIN(totalReserved)}
                            </div>
                          </div>
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <div className="text-slate-500 text-[10px] uppercase">Damaged</div>
                            <div className="font-bold text-rose-700 text-sm mt-0.5">
                              {formatNumberIN(totalDamaged)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Financial & Procurement Parameters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-slate-500">Unit Cost (Standard)</div>
                      <div className="text-base font-bold font-mono text-slate-900">
                        {formatINR(detailProduct.unitCost)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-slate-500">Selling Price</div>
                      <div className="text-base font-bold font-mono text-slate-900">
                        {formatINR(detailProduct.unitPrice)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-slate-500">Min Reorder Point</div>
                      <div className="text-base font-bold font-mono text-slate-900">
                        {formatNumberIN(detailProduct.minReorderPoint)} units
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-mono uppercase text-slate-500">Target Par Stock</div>
                      <div className="text-base font-bold font-mono text-slate-900">
                        {formatNumberIN(detailProduct.targetStock)} units
                      </div>
                    </div>
                  </div>

                  {detailProduct.description && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Product Description</div>
                      <p className="text-slate-700">{detailProduct.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Locations */}
              {productDrawerTab === 'locations' && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800 uppercase font-mono">
                    Bin Allocations across Facilities
                  </div>
                  {detailProduct.inventoryBalances?.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                      No stock currently on hand in any facility bin.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-mono text-[10px] uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Facility</th>
                            <th className="px-3 py-2">Bin Code</th>
                            <th className="px-3 py-2 text-right">On Hand</th>
                            <th className="px-3 py-2 text-right">Reserved</th>
                            <th className="px-3 py-2 text-right font-bold">Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {detailProduct.inventoryBalances?.map((b: any) => (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2">{b.warehouse?.code}</td>
                              <td className="px-3 py-2 font-bold text-blue-600">{b.location?.code}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{b.onHand}</td>
                              <td className="px-3 py-2 text-right text-amber-700 tabular-nums">{b.reserved}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900 tabular-nums">
                                {Math.max(0, b.onHand - b.reserved - b.damaged)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Lots */}
              {productDrawerTab === 'lots' && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800 uppercase font-mono">
                    Active Lots & Batches
                  </div>
                  {detailProduct.lots && detailProduct.lots.length > 0 ? (
                    <div className="space-y-1.5">
                      {detailProduct.lots.map((lot: any) => (
                        <div
                          key={lot.id}
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">Lot: {lot.lotNumber}</span>
                            <div className="text-[11px] text-slate-600">
                              Mfg: {lot.manufactureDate ? formatIST(lot.manufactureDate, false) : '—'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {lot.status}
                            </span>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              Exp: {lot.expiryDate ? formatIST(lot.expiryDate, false) : 'No Expiry'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                      No lot or batch tracking configured for this SKU.
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Movements */}
              {productDrawerTab === 'movements' && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-800 uppercase font-mono">
                    Recent Stock Movements
                  </div>
                  {detailProduct.stockMovements && detailProduct.stockMovements.length > 0 ? (
                    <div className="space-y-1.5">
                      {detailProduct.stockMovements.slice(0, 10).map((m: any) => (
                        <div
                          key={m.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-800">
                              {m.referenceType.replace('_', ' ')}
                            </span>
                            <div className="text-[11px] text-slate-600 font-mono mt-1">
                              {formatIST(m.createdAt)}
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="font-bold text-slate-900 tabular-nums">
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </div>
                            <div className="text-[10px] text-slate-600">
                              {m.destinationLocation?.code || m.sourceLocation?.code || 'Outbound'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
                      No stock movement history recorded for this SKU.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
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
                  Edit Product Parameters
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        title="Cycle Count Stock Adjustment"
        description="Record verified physical count and reconcile system inventory balances"
      >
        {selectedBalance && (
          <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="font-mono font-bold text-slate-900">{selectedBalance.product.sku}</div>
              <div className="text-slate-600">{selectedBalance.product.name}</div>
              <div className="text-slate-500 font-mono text-[11px]">
                Facility: {selectedBalance.warehouse.code} • Bin: {selectedBalance.location.code}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-mono uppercase text-[10px] mb-1">
                  Current On Hand
                </label>
                <div className="h-8 px-2.5 flex items-center bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-800">
                  {selectedBalance.onHand}
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold uppercase text-[10px] mb-1">
                  New Verified On Hand *
                </label>
                <input
                  type="number"
                  min={selectedBalance.reserved}
                  required
                  value={newOnHand}
                  onChange={(e) => setNewOnHand(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-8 px-2.5 border border-slate-300 rounded font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold uppercase text-[10px] mb-1">
                Reason for Adjustment (Required) *
              </label>
              <textarea
                required
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Physical cycle count reconciliation, damaged unit discard"
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
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

      {/* Transfer Stock Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Bin-to-Bin Stock Transfer"
        description="Transfer available units to another storage or staging bin in this warehouse"
      >
        {selectedBalance && (
          <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="font-mono font-bold text-slate-900">{selectedBalance.product.sku}</div>
              <div className="text-slate-500 font-mono text-[11px]">
                Source Bin: <strong className="text-slate-800">{selectedBalance.location.code}</strong> (Available: {selectedBalance.available})
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold uppercase text-[10px] mb-1">
                Destination Bin *
              </label>
              <select
                required
                value={destLocationId}
                onChange={(e) => setDestLocationId(e.target.value)}
                className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-mono"
              >
                <option value="">Select destination bin...</option>
                {locations
                  .filter((l) => l.id !== selectedBalance.locationId && l.status === 'ACTIVE')
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} ({l.type} - Zone {l.zone})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold uppercase text-[10px] mb-1">
                Transfer Quantity (Max {selectedBalance.available}) *
              </label>
              <input
                type="number"
                min={1}
                max={selectedBalance.available}
                required
                value={transferQty}
                onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 1)}
                className="w-full h-8 px-2 border border-slate-300 rounded font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold uppercase text-[10px] mb-1">
                Reason / Note
              </label>
              <input
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g., Consolidation, picking aisle replenishment"
                className="w-full h-8 px-2 border border-slate-300 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
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

      {/* Add Product Modal */}
      <Modal
        isOpen={createProductOpen}
        onClose={() => setCreateProductOpen(false)}
        title="Add New Catalog SKU"
        description="Register a new stock-keeping unit in the enterprise product master"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProductSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
                SKU Identifier *
              </label>
              <input
                required
                placeholder="e.g., PK-BOX-001"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                className="w-full h-8 px-2 border border-slate-300 rounded font-mono font-bold uppercase"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
                Category *
              </label>
              <select
                value={newCatId}
                onChange={(e) => setNewCatId(e.target.value)}
                className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
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
            <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
              Product Title *
            </label>
            <input
              required
              placeholder="e.g., Heavy-Duty Double Wall Corrugated Carton (20x15x10)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full h-8 px-2 border border-slate-300 rounded"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
                Unit Cost (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={newUnitCost}
                onChange={(e) => setNewUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full h-8 px-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
                Selling Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full h-8 px-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
                Unit of Measure
              </label>
              <select
                value={newUom}
                onChange={(e) => setNewUom(e.target.value)}
                className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-mono"
              >
                <option value="EA">EA (Each)</option>
                <option value="BOX">BOX</option>
                <option value="PLT">PLT (Pallet)</option>
                <option value="KG">KG (Kilogram)</option>
                <option value="LTR">LTR (Litre)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
                Min Reorder Threshold
              </label>
              <input
                type="number"
                min={0}
                value={newMinReorder}
                onChange={(e) => setNewMinReorder(parseInt(e.target.value, 10) || 0)}
                className="w-full h-8 px-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">
                Target Stock Level
              </label>
              <input
                type="number"
                min={1}
                value={newTargetStock}
                onChange={(e) => setNewTargetStock(parseInt(e.target.value, 10) || 1)}
                className="w-full h-8 px-2 border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateProductOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create SKU
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
