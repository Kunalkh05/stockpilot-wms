import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  ShoppingCart,
  Check,
  X,
  ShieldAlert,
  ArrowRight,
  Layers,
  Users,
  Mail,
  Phone,
  MapPin,
  Clock,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { SalesOrder, SOStatus, Product, Customer, StockReservation } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { SearchInput } from '../components/common/SearchInput.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { toast } from 'sonner';

export const SalesOrdersPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const { hasRole } = useAuth();

  const [activeTab, setActiveTab] = useState<'orders' | 'reservations' | 'customers'>('orders');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>('ACTIVE');

  // Create Customer Modal
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    shippingAddress: '',
    city: '',
    state: 'IL',
    postalCode: '60601',
    country: 'USA',
  });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Create Order Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; requestedQty: number; unitPrice: number }>>([
    { productId: '', requestedQty: 1, unitPrice: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cancel Modal
  const [cancelModalOrder, setCancelModalOrder] = useState<SalesOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const [ordRes, prodRes, custRes, resRes] = await Promise.all([
        api.listSalesOrders({
          warehouseId: selectedWarehouseId,
          status: (statusFilter as SOStatus) || undefined,
          search: search || undefined,
        }),
        api.listProducts({ limit: 100 }),
        api.listCustomers(),
        api.listReservations({ warehouseId: selectedWarehouseId }),
      ]);
      setOrders(ordRes);
      setProducts(prodRes);
      setCustomers(custRes);
      setReservations(resRes);
      if (custRes.length > 0 && !customerId) {
        setCustomerId(custRes[0].id);
      }
    } catch (err) {
      toast.error('Failed to load sales orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedWarehouseId, statusFilter]);

  const handleAllocate = async (orderId: string) => {
    try {
      await api.allocateOrder(orderId);
      toast.success('Stock allocated and pick task generated successfully');
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Allocation failed (insufficient stock)');
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalOrder || !cancelReason) return;
    try {
      await api.cancelOrder(cancelModalOrder.id, cancelReason);
      toast.success(`Order ${cancelModalOrder.orderNumber} cancelled and reservations released`);
      setCancelModalOrder(null);
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Cancellation failed');
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.code.trim() || !newCustomer.name.trim() || !newCustomer.email.trim() || !newCustomer.shippingAddress.trim()) {
      toast.error('Customer code, company name, email, and shipping address are required');
      return;
    }
    setIsSubmittingCustomer(true);
    try {
      const created = await api.createCustomer(newCustomer);
      toast.success(`Customer ${created.name} (${created.code}) registered successfully`);
      setCustomers((prev) => [...prev, created]);
      setCustomerId(created.id);
      setIsCreateCustomerOpen(false);
      setNewCustomer({
        code: '',
        name: '',
        email: '',
        phone: '',
        shippingAddress: '',
        city: '',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to register customer');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch) return true;
    const term = customerSearch.toLowerCase();
    return (
      c.code.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      c.city.toLowerCase().includes(term)
    );
  });

  const filteredReservations = reservations.filter((r) => {
    if (!reservationStatusFilter) return true;
    return r.status === reservationStatusFilter;
  });


  const handleAddItemRow = () => {
    setOrderItems([...orderItems, { productId: '', requestedQty: 1, unitPrice: 0 }]);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...orderItems];
    if (field === 'productId') {
      const prod = products.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value,
        unitPrice: prod ? prod.unitPrice : 0,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setOrderItems(updated);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId) {
      toast.error('Please select a facility scope in header');
      return;
    }
    const valid = orderItems.filter((i) => i.productId && i.requestedQty > 0);
    if (valid.length === 0) {
      toast.error('Order requires at least one product line');
      return;
    }

    setIsSubmitting(true);
    try {
      const cust = customerId || (customers.length > 0 ? customers[0].id : '');
      if (!cust) {
        toast.error('Please select a valid customer account');
        setIsSubmitting(false);
        return;
      }

      await api.createSalesOrder({
        customerId: cust,
        warehouseId: selectedWarehouseId,
        items: valid,
      });
      toast.success('Sales order created in PENDING status');
      setIsCreateOpen(false);
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sales order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeReservationsCount = reservations.filter((r) => r.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Outbound Orders & Allocation
          </h1>
          <p className="text-xs text-surface-500">
            Fulfillment pipeline: Customer orders, stock reservation ledger, and customer accounts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadOrders} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {hasRole('ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_SPECIALIST') && (
            <>
              {activeTab === 'customers' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateCustomerOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Register Customer
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  New Sales Order
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
          <ShoppingCart className="w-3.5 h-3.5" />
          Customer Orders
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-100 text-surface-600">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reservations')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'reservations'
              ? 'border-brand-500 text-surface-900 font-bold'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Stock Reservations
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 font-bold">
            {activeReservationsCount} active
          </span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'customers'
              ? 'border-brand-500 text-surface-900 font-bold'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Customer Accounts
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface-100 text-surface-600">
            {customers.length}
          </span>
        </button>
      </div>

      {/* Content depending on active tab */}
      {activeTab === 'orders' && (
        <>
          {/* Filter Bar */}
          <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
            <div className="flex-1 max-w-sm">
              <SearchInput
                value={search}
                onChange={(val) => setSearch(val)}
                placeholder="Search order # or customer..."
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-700"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending (Unallocated)</option>
              <option value="ALLOCATED">Allocated (Reserved)</option>
              <option value="PICKING">Picking</option>
              <option value="PICKED">Picked</option>
              <option value="PACKED">Packed</option>
              <option value="SHIPPED">Shipped</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Orders Table */}
          <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Order #</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Facility</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Lines</th>
                  <th className="px-4 py-2.5 text-right">Total Units</th>
                  <th className="px-4 py-2.5">Carrier / Tracking</th>
                  <th className="px-4 py-2.5 text-center">Fulfillment Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                      Loading customer orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                      No sales orders found matching criteria.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const totalUnits = order.items.reduce((s, i) => s + i.requestedQty, 0);
                    return (
                      <tr key={order.id} className="hover:bg-surface-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-surface-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-surface-800">
                          {order.customer?.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-surface-600">
                          {order.warehouse?.code}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              order.status === 'SHIPPED'
                                ? 'success'
                                : order.status === 'ALLOCATED' || order.status === 'PICKED' || order.status === 'PACKED'
                                ? 'amber'
                                : order.status === 'CANCELLED'
                                ? 'danger'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-surface-600 font-mono">
                          {order.items.length} item(s)
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-surface-900">
                          {totalUnits}
                        </td>
                        <td className="px-4 py-3 text-surface-500 font-mono text-[11px]">
                          {order.trackingNumber || order.shippingCarrier || 'Standard'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {order.status === 'PENDING' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAllocate(order.id)}
                              >
                                Allocate Stock
                              </Button>
                            )}

                            {order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
                              <button
                                onClick={() => {
                                  setCancelModalOrder(order);
                                  setCancelReason('');
                                }}
                                title="Cancel order and release reservations"
                                className="p-1 rounded text-surface-400 hover:text-rose-600 hover:bg-surface-100 transition-colors"
                              >
                                <X className="w-4 h-4" />
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
        </>
      )}

      {/* Stock Reservations Ledger */}
      {activeTab === 'reservations' && (
        <>
          <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-surface-500 font-mono">Status Filter:</span>
              {(['ACTIVE', 'CONSUMED', 'RELEASED', ''] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setReservationStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    reservationStatusFilter === st
                      ? 'bg-surface-900 text-white border-surface-900 font-medium'
                      : 'bg-surface-50 text-surface-600 border-surface-200 hover:bg-surface-100'
                  }`}
                >
                  {st || 'All Reservations'}
                </button>
              ))}
            </div>
            <div className="text-xs text-surface-500 font-mono">
              Showing {filteredReservations.length} reservation records
            </div>
          </div>

          <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Sales Order</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">SKU / Product</th>
                  <th className="px-4 py-2.5">Bin Location</th>
                  <th className="px-4 py-2.5">Lot / Expiry</th>
                  <th className="px-4 py-2.5 text-right">Reserved Qty</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Allocated Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                      No stock reservation records found.
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((res) => (
                    <tr key={res.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-surface-900">
                        {res.salesOrder?.orderNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-surface-800">
                        {res.salesOrder?.customer?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-surface-900">{res.product?.sku}</span>
                        <div className="text-surface-500 text-[11px] truncate max-w-xs">{res.product?.name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-brand-600 font-bold">
                        {res.location?.code}
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-600 text-[11px]">
                        {res.lot?.lotNumber || <span className="text-surface-400">Standard</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-surface-900">
                        {res.reservedQty}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            res.status === 'ACTIVE'
                              ? 'amber'
                              : res.status === 'CONSUMED'
                              ? 'success'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {res.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-surface-500 font-mono text-[11px]">
                        {new Date(res.createdAt).toLocaleDateString()} {new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Customer Directory */}
      {activeTab === 'customers' && (
        <>
          <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
            <div className="flex-1 max-w-sm">
              <SearchInput
                value={customerSearch}
                onChange={(val) => setCustomerSearch(val)}
                placeholder="Search customer account, company, or city..."
              />
            </div>
          </div>

          <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Account Code</th>
                  <th className="px-4 py-2.5">Customer Name</th>
                  <th className="px-4 py-2.5">Contact Email</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Shipping Destination</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                      No customer accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-surface-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-surface-900">
                        {cust.code}
                      </td>
                      <td className="px-4 py-3 font-semibold text-surface-800">
                        {cust.name}
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-surface-400" />
                          <span>{cust.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-600 font-mono text-[11px]">
                        {cust.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-surface-400" />
                            <span>{cust.phone}</span>
                          </div>
                        ) : (
                          <span className="text-surface-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-surface-400" />
                          <span>{cust.shippingAddress}, {cust.city}, {cust.state}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="success" size="sm">ACTIVE ACCOUNT</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCustomerId(cust.id);
                            setIsCreateOpen(true);
                          }}
                        >
                          New Order
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


      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Customer Sales Order"
        description="Submit order for stock allocation and fulfillment routing"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Customer Account *
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded bg-white text-surface-900"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-700 uppercase">
                Order Items
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
                        {p.sku} — {p.name} (${p.unitPrice})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    required
                    value={item.requestedQty}
                    onChange={(e) => handleItemChange(idx, 'requestedQty', parseInt(e.target.value, 10) || 1)}
                    placeholder="Qty"
                    className="w-20 h-8 px-2 text-xs border border-surface-300 rounded font-mono text-right"
                  />

                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    placeholder="Price"
                    className="w-24 h-8 px-2 text-xs border border-surface-300 rounded font-mono text-right"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Submit Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        isOpen={Boolean(cancelModalOrder)}
        onClose={() => setCancelModalOrder(null)}
        title="Cancel Sales Order"
        description="Cancels order and releases all reserved inventory back into sellable pool"
      >
        {cancelModalOrder && (
          <form onSubmit={handleCancel} className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
              Are you sure you want to cancel order <span className="font-mono font-bold">{cancelModalOrder.orderNumber}</span>? Active reservations will be released immediately.
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Cancellation Reason (Required)
              </label>
              <textarea
                required
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation before dispatch"
                className="w-full p-2 text-xs border border-surface-300 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setCancelModalOrder(null)}>
                Back
              </Button>
              <Button type="submit" variant="danger" size="sm">
                Confirm Cancellation
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Register Customer Modal */}
      <Modal
        isOpen={isCreateCustomerOpen}
        onClose={() => setIsCreateCustomerOpen(false)}
        title="Register Customer Account"
        description="Add a new business or consumer customer account for order fulfillment"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Account Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CUST-AURORA"
                value={newCustomer.code}
                onChange={(e) => setNewCustomer({ ...newCustomer, code: e.target.value.toUpperCase() })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Aurora Medical Systems"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Billing / Order Email *
              </label>
              <input
                type="email"
                required
                placeholder="purchasing@customer.com"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+1 (555) 482-9102"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Shipping Destination Street *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 500 Technology Way, Dock 4"
              value={newCustomer.shippingAddress}
              onChange={(e) => setNewCustomer({ ...newCustomer, shippingAddress: e.target.value })}
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                City *
              </label>
              <input
                type="text"
                required
                placeholder="Chicago"
                value={newCustomer.city}
                onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                State *
              </label>
              <input
                type="text"
                required
                placeholder="IL"
                value={newCustomer.state}
                onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value.toUpperCase() })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Postal Code *
              </label>
              <input
                type="text"
                required
                placeholder="60601"
                value={newCustomer.postalCode}
                onChange={(e) => setNewCustomer({ ...newCustomer, postalCode: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateCustomerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingCustomer}>
              Register Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

