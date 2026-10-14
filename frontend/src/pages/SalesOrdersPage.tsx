import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Filter,
  CheckCircle2,
  Package,
  Truck,
  ExternalLink,
  ChevronRight,
  Eye,
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
import { formatINR, formatNumberIN, formatIST, formatRelativeTime } from '../utils/formatters.js';

type QueueView = 'ALL' | 'NEW' | 'TO_PICK' | 'TO_PACK' | 'DISPATCHED' | 'EXCEPTIONS';

export const SalesOrdersPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state: fulfillment queue (default), stock reservations, customer directory
  const activeTab = (searchParams.get('tab') as 'orders' | 'reservations' | 'customers') || 'orders';
  const setActiveTab = (tab: 'orders' | 'reservations' | 'customers') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const [queueView, setQueueView] = useState<QueueView>('ALL');
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>('ACTIVE');

  // Create Customer Modal
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    shippingAddress: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
  });
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Create Order Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [orderChannel, setOrderChannel] = useState('Wholesale B2B');
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
  }, [selectedWarehouseId]);

  const handleAllocate = async (orderId: string) => {
    try {
      await api.allocateOrder(orderId);
      toast.success('Stock allocated and pick task generated successfully');
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: 'ALLOCATED' } : null));
      }
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
      if (selectedOrder && selectedOrder.id === cancelModalOrder.id) {
        setSelectedOrder(null);
      }
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
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to register customer');
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

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

  // Filter orders according to queue view
  const filteredOrders = orders.filter((order) => {
    if (search) {
      const q = search.toLowerCase();
      const matchOrder = order.orderNumber.toLowerCase().includes(q);
      const matchCust = order.customer?.name?.toLowerCase().includes(q);
      if (!matchOrder && !matchCust) return false;
    }

    switch (queueView) {
      case 'NEW':
        return order.status === 'PENDING';
      case 'TO_PICK':
        return order.status === 'ALLOCATED' || order.status === 'PICKING';
      case 'TO_PACK':
        return order.status === 'PICKED';
      case 'DISPATCHED':
        return order.status === 'PACKED' || order.status === 'SHIPPED';
      case 'EXCEPTIONS':
        return order.status === 'CANCELLED' || order.status === 'RETURNED';
      default:
        return true;
    }
  });

  const getChannelLabel = (orderNumber: string) => {
    // Neutral channel assignment derived from order context
    const num = parseInt(orderNumber.replace(/\D/g, ''), 10) || 0;
    if (num % 4 === 0) return 'Marketplace B2B';
    if (num % 3 === 0) return 'Direct Store';
    if (num % 2 === 0) return 'Wholesale Dispatch';
    return 'Manual Sales Order';
  };

  const getStatusBadge = (status: SOStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            New (Unallocated)
          </span>
        );
      case 'ALLOCATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Stock Allocated
          </span>
        );
      case 'PICKING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            In Picking
          </span>
        );
      case 'PICKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Picked (Ready to Pack)
          </span>
        );
      case 'PACKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-50 text-cyan-800 border border-cyan-200">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            Packed & Staged
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Dispatched
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
            <X className="w-3 h-3 text-rose-600" />
            Cancelled
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const counts = {
    all: orders.length,
    new: orders.filter((o) => o.status === 'PENDING').length,
    toPick: orders.filter((o) => o.status === 'ALLOCATED' || o.status === 'PICKING').length,
    toPack: orders.filter((o) => o.status === 'PICKED').length,
    dispatched: orders.filter((o) => o.status === 'PACKED' || o.status === 'SHIPPED').length,
    exceptions: orders.filter((o) => o.status === 'CANCELLED' || o.status === 'RETURNED').length,
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Outbound Fulfillment Orders</h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {orders.length} total orders
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Order allocation, floor picking priority, packing verification, and carrier dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadOrders} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {hasRole('ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_SPECIALIST') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Create Sales Order
            </Button>
          )}
        </div>
      </div>

      {/* Top Section Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-blue-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Fulfillment Work Queue</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700">
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reservations')}
          className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition-colors ${
            activeTab === 'reservations'
              ? 'border-blue-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Stock Reservations Ledger</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800 font-semibold">
            {reservations.filter((r) => r.status === 'ACTIVE').length} active
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition-colors ${
            activeTab === 'customers'
              ? 'border-blue-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customer Accounts</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700">
            {customers.length}
          </span>
        </button>
      </div>

      {/* Main Tab: Fulfillment Queue */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {/* Work Queue Stage Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100/70 border border-slate-200 rounded-lg">
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {(
                [
                  { id: 'ALL', label: 'All Orders', count: counts.all },
                  { id: 'NEW', label: 'New / To Allocate', count: counts.new },
                  { id: 'TO_PICK', label: 'To Pick', count: counts.toPick },
                  { id: 'TO_PACK', label: 'To Pack', count: counts.toPack },
                  { id: 'DISPATCHED', label: 'Dispatched', count: counts.dispatched },
                  { id: 'EXCEPTIONS', label: 'Exceptions', count: counts.exceptions },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQueueView(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    queueView === tab.id
                      ? 'bg-white text-slate-900 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      queueView === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Search Field */}
            <div className="w-full sm:w-64">
              <SearchInput
                value={search}
                onChange={(val) => setSearch(val)}
                placeholder="Search order # or customer..."
              />
            </div>
          </div>

          {/* Active Filter Summary Bar if search or view is applied */}
          {(search || queueView !== 'ALL') && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/70 border border-blue-200 rounded-md text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Filtering by: <strong>{queueView}</strong>
                  {search && (
                    <>
                      {' '}
                      • Matching: <em>"{search}"</em>
                    </>
                  )}
                  {' '}({filteredOrders.length} orders found)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQueueView('ALL');
                  setSearch('');
                }}
                className="text-[11px] font-semibold text-blue-700 hover:underline"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Orders Work Queue Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Order ID</th>
                    <th className="px-4 py-2.5">Channel / Source</th>
                    <th className="px-4 py-2.5">Customer & City</th>
                    <th className="px-4 py-2.5">Created (IST)</th>
                    <th className="px-4 py-2.5">Lines / Qty</th>
                    <th className="px-4 py-2.5">Fulfillment State</th>
                    <th className="px-4 py-2.5 text-right">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading fulfillment queue...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No orders in this stage queue. Select another tab or clear search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const totalUnits = order.items.reduce((s, i) => s + i.requestedQty, 0);
                      const channel = getChannelLabel(order.orderNumber);
                      const isSelected = selectedOrder?.id === order.id;

                      return (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{order.orderNumber}</span>
                              <Eye className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                            </div>
                            <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                              {order.warehouse?.code} Facility
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {channel}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 truncate max-w-[180px]">
                              {order.customer?.name}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate max-w-[180px]">
                              {order.customer?.city || 'Direct Dispatch'}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                            <div className="text-xs text-slate-900">{formatIST(order.orderDate, false)}</div>
                            <div className="text-[10px] text-slate-600">{formatRelativeTime(order.orderDate)}</div>
                          </td>

                          <td className="px-4 py-3 font-mono">
                            <div className="font-bold text-slate-900 tabular-nums">
                              {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {order.items.length} SKU {order.items.length === 1 ? 'line' : 'lines'}
                            </div>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {getStatusBadge(order.status)}
                          </td>

                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {order.status === 'PENDING' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAllocate(order.id)}
                                >
                                  Allocate Stock
                                </Button>
                              )}

                              {(order.status === 'ALLOCATED' || order.status === 'PICKING') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate('/picking')}
                                  rightIcon={<ChevronRight className="w-3 h-3" />}
                                >
                                  Pick Order
                                </Button>
                              )}

                              {order.status === 'PICKED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate('/packing')}
                                  rightIcon={<ChevronRight className="w-3 h-3" />}
                                >
                                  Pack Order
                                </Button>
                              )}

                              {order.status === 'PACKED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate('/shipments')}
                                  rightIcon={<Truck className="w-3 h-3" />}
                                >
                                  Dispatch
                                </Button>
                              )}

                              {order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelModalOrder(order);
                                    setCancelReason('');
                                  }}
                                  title="Cancel order"
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
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
          </div>
        </div>
      )}

      {/* Stock Reservations Ledger Tab */}
      {activeTab === 'reservations' && (
        <div className="space-y-3">
          <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">Status Filter:</span>
              {(['ACTIVE', 'CONSUMED', 'RELEASED', ''] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReservationStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    reservationStatusFilter === st
                      ? 'bg-slate-900 text-white border-slate-900 font-medium'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st || 'All Reservations'}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-600 font-mono">
              Showing {reservations.filter((r) => !reservationStatusFilter || r.status === reservationStatusFilter).length} reservation records
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Sales Order</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">SKU / Product</th>
                  <th className="px-4 py-2.5">Bin Location</th>
                  <th className="px-4 py-2.5">Lot / Expiry</th>
                  <th className="px-4 py-2.5 text-right">Reserved Qty</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Allocated Date (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.filter((r) => !reservationStatusFilter || r.status === reservationStatusFilter).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No stock reservation records found.
                    </td>
                  </tr>
                ) : (
                  reservations
                    .filter((r) => !reservationStatusFilter || r.status === reservationStatusFilter)
                    .map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {res.salesOrder?.orderNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {res.salesOrder?.customer?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-slate-900">{res.product?.sku}</span>
                          <div className="text-slate-600 text-[11px] truncate max-w-xs">{res.product?.name}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-blue-600 font-bold">
                          {res.location?.code}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                          {res.lot?.lotNumber || <span className="text-slate-400">Standard</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
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
                        <td className="px-4 py-3 text-right text-slate-600 font-mono text-[11px]">
                          {formatIST(res.createdAt)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Directory Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-3">
          <div className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shadow-sm">
            <div className="flex-1 max-w-sm">
              <SearchInput
                value={customerSearch}
                onChange={(val) => setCustomerSearch(val)}
                placeholder="Search customer account, company, or city..."
              />
            </div>
            {hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateCustomerOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Register Customer Account
              </Button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
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
              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No customer accounts found.
                    </td>
                  </tr>
                ) : (
                  customers
                    .filter((c) => {
                      if (!customerSearch) return true;
                      const q = customerSearch.toLowerCase();
                      return (
                        c.code.toLowerCase().includes(q) ||
                        c.name.toLowerCase().includes(q) ||
                        c.email.toLowerCase().includes(q) ||
                        c.city.toLowerCase().includes(q)
                      );
                    })
                    .map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {cust.code}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {cust.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cust.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          {cust.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{cust.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{cust.shippingAddress}, {cust.city}, {cust.state}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="success" size="sm">ACTIVE</Badge>
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
        </div>
      )}

      {/* Slide-Out Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-slate-900">{selectedOrder.orderNumber}</span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Placed on {formatIST(selectedOrder.createdAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Customer Details Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-500">
                  Customer & Shipping Destination
                </div>
                <div className="font-semibold text-sm text-slate-900">{selectedOrder.customer?.name}</div>
                <div className="text-slate-600">
                  {selectedOrder.customer?.shippingAddress}, {selectedOrder.customer?.city},{' '}
                  {selectedOrder.customer?.state} {selectedOrder.customer?.postalCode}
                </div>
                <div className="text-slate-600 font-mono text-[11px] pt-1 flex items-center gap-3">
                  <span>{selectedOrder.customer?.email}</span>
                  {selectedOrder.customer?.phone && <span>• {selectedOrder.customer?.phone}</span>}
                </div>
              </div>

              {/* Order Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700">
                    Order Line Items ({selectedOrder.items.length})
                  </span>
                  <span className="font-mono text-slate-600">
                    Total:{' '}
                    {selectedOrder.items.reduce((s, i) => s + i.requestedQty, 0)} units
                  </span>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((it) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2.5">
                            <div className="font-mono font-bold text-slate-900">{it.product?.sku}</div>
                            <div className="text-[11px] text-slate-600 truncate max-w-[200px]">
                              {it.product?.name}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {it.requestedQty}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                            {formatINR(it.unitPrice)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatINR(it.requestedQty * it.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fulfillment Stages Progress */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="text-[10px] font-mono uppercase font-bold text-slate-500">
                  Fulfillment Lifecycle
                </div>
                <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-mono">
                  {(
                    [
                      { key: 'PENDING', label: '1. Created', done: true },
                      {
                        key: 'ALLOCATED',
                        label: '2. Stock Locked',
                        done: ['ALLOCATED', 'PICKING', 'PICKED', 'PACKED', 'SHIPPED'].includes(selectedOrder.status),
                      },
                      {
                        key: 'PICKING',
                        label: '3. Picked',
                        done: ['PICKED', 'PACKED', 'SHIPPED'].includes(selectedOrder.status),
                      },
                      {
                        key: 'PACKED',
                        label: '4. Packed',
                        done: ['PACKED', 'SHIPPED'].includes(selectedOrder.status),
                      },
                      { key: 'SHIPPED', label: '5. Dispatched', done: selectedOrder.status === 'SHIPPED' },
                    ] as const
                  ).map((st) => (
                    <div
                      key={st.key}
                      className={`p-1.5 rounded border ${
                        st.done
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                          : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {st.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>

              <div className="flex items-center gap-2">
                {selectedOrder.status === 'PENDING' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAllocate(selectedOrder.id)}
                  >
                    Allocate Stock Now
                  </Button>
                )}

                {(selectedOrder.status === 'ALLOCATED' || selectedOrder.status === 'PICKING') && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/picking')}
                    rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Proceed to Picking
                  </Button>
                )}

                {selectedOrder.status === 'PICKED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/packing')}
                    rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Proceed to Packing
                  </Button>
                )}

                {selectedOrder.status === 'PACKED' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/shipments')}
                    rightIcon={<Truck className="w-3.5 h-3.5" />}
                  >
                    Proceed to Dispatch
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Customer Sales Order"
        description="Submit order for stock allocation and fulfillment routing"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Customer Account *
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white text-slate-900"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Sales Channel
            </label>
            <select
              value={orderChannel}
              onChange={(e) => setOrderChannel(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white text-slate-900"
            >
              <option value="Wholesale B2B">Wholesale B2B</option>
              <option value="Direct Store">Direct Store Fulfillment</option>
              <option value="Marketplace B2B">Marketplace B2B</option>
              <option value="Manual Order">Manual Sales Entry</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 uppercase">
                Order Items
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-blue-600 hover:underline font-medium"
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
                    className="flex-1 h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="">Select SKU...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name} ({formatINR(p.unitPrice)})
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
                    className="w-20 h-8 px-2 text-xs border border-slate-300 rounded font-mono text-right"
                  />

                  <div className="w-28 text-right font-mono text-slate-700 text-xs">
                    {formatINR(item.unitPrice * item.requestedQty)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Submit Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Customer Modal */}
      <Modal
        isOpen={isCreateCustomerOpen}
        onClose={() => setIsCreateCustomerOpen(false)}
        title="Register Customer Account"
        description="Add a verified customer account for order fulfillment and shipping"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Account Code *
              </label>
              <input
                required
                placeholder="e.g. CUST-MUM-01"
                value={newCustomer.code}
                onChange={(e) => setNewCustomer({ ...newCustomer, code: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-slate-300 rounded uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Company / Customer Name *
              </label>
              <input
                required
                placeholder="Business Name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-slate-300 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Contact Email *
              </label>
              <input
                type="email"
                required
                placeholder="billing@company.in"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Phone Number
              </label>
              <input
                placeholder="+91 98765 43210"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
              Shipping Address *
            </label>
            <input
              required
              placeholder="Warehouse / Facility / Street Address"
              value={newCustomer.shippingAddress}
              onChange={(e) => setNewCustomer({ ...newCustomer, shippingAddress: e.target.value })}
              className="w-full h-8 px-2 text-xs border border-slate-300 rounded"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">City</label>
              <input
                value={newCustomer.city}
                onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">State</label>
              <input
                value={newCustomer.state}
                onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">PIN Code</label>
              <input
                value={newCustomer.postalCode}
                onChange={(e) => setNewCustomer({ ...newCustomer, postalCode: e.target.value })}
                className="w-full h-8 px-2 text-xs border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateCustomerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmittingCustomer}>
              Register Customer
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
          <form onSubmit={handleCancel} className="space-y-3 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
              Are you sure you want to cancel order <span className="font-mono font-bold">{cancelModalOrder.orderNumber}</span>? Active stock reservations will be released immediately.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Cancellation Reason (Required)
              </label>
              <textarea
                required
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Customer requested cancellation, duplicate order"
                className="w-full p-2 text-xs border border-slate-300 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setCancelModalOrder(null)}>
                Keep Order
              </Button>
              <Button type="submit" variant="danger" size="sm">
                Confirm Cancellation
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
