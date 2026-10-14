import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, FileText, ArrowRight, Truck, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { PurchaseOrder, POStatus, Product, Supplier } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { SearchInput } from '../components/common/SearchInput.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { toast } from 'sonner';
import { formatINR, formatNumberIN, formatIST } from '../utils/formatters.js';

export const PurchaseOrdersPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const { hasRole } = useAuth();

  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create Supplier Modal
  const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    code: '',
    name: '',
    contactEmail: '',
    phone: '',
    address: '',
    city: '',
  });
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  // Create PO Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; expectedQty: number; unitCost: number }>>([
    { productId: '', expectedQty: 10, unitCost: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPOs = async () => {
    setIsLoading(true);
    try {
      const [poRes, prodRes, supRes] = await Promise.all([
        api.listPurchaseOrders({
          warehouseId: selectedWarehouseId,
          status: (statusFilter as POStatus) || undefined,
          search: search || undefined,
        }),
        api.listProducts({ limit: 100 }),
        api.listSuppliers(),
      ]);
      setOrders(poRes);
      setProducts(prodRes);
      setSuppliers(supRes);
      if (supRes.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(supRes[0].id);
      }
    } catch (err) {
      toast.error('Failed to load purchase orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPOs();
  }, [selectedWarehouseId, statusFilter]);

  const handleAddItemRow = () => {
    setOrderItems([...orderItems, { productId: '', expectedQty: 10, unitCost: 0 }]);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...orderItems];
    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value,
        unitCost: prod ? prod.unitCost : 0,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setOrderItems(updated);
  };

  const handleRemoveRow = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId) {
      toast.error('Please select a warehouse facility in the header');
      return;
    }
    const validItems = orderItems.filter((i) => i.productId && i.expectedQty > 0);
    if (validItems.length === 0) {
      toast.error('At least one valid line item is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const supplier = selectedSupplierId || (suppliers.length > 0 ? suppliers[0].id : '');
      if (!supplier) {
        toast.error('Please select a valid supplier');
        setIsSubmitting(false);
        return;
      }

      await api.createPurchaseOrder({
        supplierId: supplier,
        warehouseId: selectedWarehouseId,
        expectedDate: expectedDate || undefined,
        notes: poNotes || undefined,
        items: validItems,
      });
      toast.success('Purchase order created successfully');
      setIsCreateOpen(false);
      loadPOs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create PO');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.code.trim() || !newSupplier.name.trim() || !newSupplier.contactEmail.trim()) {
      toast.error('Supplier code, company name, and contact email are required');
      return;
    }
    setIsSubmittingSupplier(true);
    try {
      const created = await api.createSupplier(newSupplier);
      toast.success(`Supplier ${created.name} (${created.code}) registered successfully`);
      setSuppliers((prev) => [...prev, created]);
      setSelectedSupplierId(created.id);
      setIsCreateSupplierOpen(false);
      setNewSupplier({ code: '', name: '', contactEmail: '', phone: '', address: '', city: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to register supplier');
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearch) return true;
    const term = supplierSearch.toLowerCase();
    return (
      s.code.toLowerCase().includes(term) ||
      s.name.toLowerCase().includes(term) ||
      s.contactEmail.toLowerCase().includes(term) ||
      (s.phone && s.phone.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Inbound Procurement & Suppliers
          </h1>
          <p className="text-xs text-surface-500">
            Manage vendor purchase orders, delivery requisitions, and approved supplier catalog
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadPOs} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {hasRole('ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_SPECIALIST') && (
            <>
              {activeTab === 'orders' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  New Purchase Order
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateSupplierOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Register Supplier
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-200">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-brand-500 text-surface-900 font-bold'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Purchase Orders
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-100 text-surface-600">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'suppliers'
              ? 'border-brand-500 text-surface-900 font-bold'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Supplier Directory
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-100 text-surface-600">
            {suppliers.length}
          </span>
        </button>
      </div>

      {/* Content depending on active tab */}
      {activeTab === 'orders' ? (
        <>
          {/* Filter */}
          <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
            <div className="flex-1 max-w-sm">
              <SearchInput
                value={search}
                onChange={(val) => setSearch(val)}
                placeholder="Search PO # or supplier..."
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-700"
            >
              <option value="">All Statuses</option>
              <option value="ORDERED">Ordered</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Received</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* PO Table */}
          <div className="bg-white border border-surface-200 rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">PO Number</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5">Facility</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Line Items</th>
                  <th className="px-4 py-2.5 text-right">Expected Qty</th>
                  <th className="px-4 py-2.5 text-right">Received Qty</th>
                  <th className="px-4 py-2.5">Expected Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => {
                    const totalExpected = po.items.reduce((s, i) => s + i.expectedQty, 0);
                    const totalReceived = po.items.reduce((s, i) => s + i.receivedQty, 0);
                    return (
                      <tr key={po.id} className="hover:bg-surface-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-surface-900">
                          {po.poNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-surface-800">
                          {po.supplier?.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-surface-600">
                          {po.warehouse?.code}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              po.status === 'RECEIVED'
                                ? 'success'
                                : po.status === 'PARTIALLY_RECEIVED'
                                ? 'amber'
                                : po.status === 'ORDERED'
                                ? 'info'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {po.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-surface-600 font-mono">
                          {po.items.length} line(s)
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium tabular-nums">
                          {formatNumberIN(totalExpected)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-emerald-700 tabular-nums">
                          {formatNumberIN(totalReceived)}
                        </td>
                        <td className="px-4 py-3 text-surface-500 font-mono text-[11px]">
                          {po.expectedDate ? formatIST(po.expectedDate, false) : 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Supplier Directory View */}
          <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
            <div className="flex-1 max-w-sm">
              <SearchInput
                value={supplierSearch}
                onChange={(val) => setSupplierSearch(val)}
                placeholder="Search vendor code, company, or email..."
              />
            </div>
          </div>

          <div className="bg-white border border-surface-200 rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Supplier Code</th>
                  <th className="px-4 py-2.5">Company Name</th>
                  <th className="px-4 py-2.5">Contact Email</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Headquarters</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                      No approved suppliers found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-surface-900">
                        {sup.code}
                      </td>
                      <td className="px-4 py-3 font-semibold text-surface-800">
                        {sup.name}
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-surface-400" />
                          <span>{sup.contactEmail}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-600 font-mono text-[11px]">
                        {sup.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-surface-400" />
                            <span>{sup.phone}</span>
                          </div>
                        ) : (
                          <span className="text-surface-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-surface-400" />
                          <span>{[sup.city, (sup as any).country || 'India'].filter(Boolean).join(', ')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="success" size="sm">ACTIVE VENDOR</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSupplierId(sup.id);
                            setIsCreateOpen(true);
                          }}
                        >
                          Issue PO
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}


      {/* Create PO Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Inbound Purchase Order"
        description="Issue purchase order to supplier for inventory replenishment"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreatePO} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Supplier Vendor *
              </label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded bg-white text-surface-900"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Expected Date
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Notes / Instructions
              </label>
              <input
                type="text"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                placeholder="e.g., Expedited freight dock delivery"
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-700 uppercase">
                Purchase Order Lines
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-brand-600 hover:underline font-medium"
              >
                + Add SKU Line
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto p-1">
              {orderItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    required
                    value={item.productId}
                    onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                    className="flex-1 h-8 px-2 text-xs border border-surface-300 rounded bg-white"
                  >
                    <option value="">Select SKU...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} ({formatINR(p.unitCost)})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    required
                    value={item.expectedQty}
                    onChange={(e) => handleItemChange(idx, 'expectedQty', parseInt(e.target.value, 10) || 1)}
                    placeholder="Qty"
                    className="w-20 h-8 px-2 text-xs border border-surface-300 rounded font-mono text-right"
                  />

                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={item.unitCost}
                    onChange={(e) => handleItemChange(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                    placeholder="Cost"
                    className="w-24 h-8 px-2 text-xs border border-surface-300 rounded font-mono text-right"
                  />

                  {orderItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="text-surface-400 hover:text-rose-600 text-sm px-1"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Issue Purchase Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Register Supplier Modal */}
      <Modal
        isOpen={isCreateSupplierOpen}
        onClose={() => setIsCreateSupplierOpen(false)}
        title="Register Approved Vendor Supplier"
        description="Add a new verified vendor to the master procurement directory"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Supplier Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SUP-GLOBAL"
                value={newSupplier.code}
                onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value.toUpperCase() })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Global Industrial Logistics"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Contact Email *
              </label>
              <input
                type="email"
                required
                placeholder="orders@supplier.com"
                value={newSupplier.contactEmail}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactEmail: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 98200 12345"
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Headquarters City
              </label>
              <input
                type="text"
                placeholder="e.g. Bhiwandi, Thane, Bengaluru"
                value={newSupplier.city}
                onChange={(e) => setNewSupplier({ ...newSupplier, city: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Street Address
              </label>
              <input
                type="text"
                placeholder="e.g. Plot 42, Logistics Park, NH 48"
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateSupplierOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingSupplier}>
              Save Supplier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

