import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackageCheck,
  RefreshCw,
  Box,
  Printer,
  Check,
  ArrowRight,
  Truck,
  Layers,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { SalesOrder } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { formatNumberIN, formatIST } from '../utils/formatters.js';
import { toast } from 'sonner';

export const PackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedWarehouseId } = useWarehouse();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pack Order Modal
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [weightKg, setWeightKg] = useState<number>(2.5);
  const [boxType, setBoxType] = useState('STANDARD_CORRUGATED');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Packing Slip Preview
  const [slipOrder, setSlipOrder] = useState<SalesOrder | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await api.listSalesOrders({
        warehouseId: selectedWarehouseId,
        status: 'PICKED',
      });
      setOrders(data);
    } catch (err) {
      toast.error('Failed to load packing queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [selectedWarehouseId]);

  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsSubmitting(true);
    try {
      await api.packOrder(selectedOrder.id, { weightKg, boxType });
      toast.success(`Order ${selectedOrder.orderNumber} packed and containerized`);
      setSelectedOrder(null);
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || 'Packing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
              Order Packing Station
            </h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {orders.length} Ready to Pack
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Physical package verification, container tare assignment, and packing slip generation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/shipments')}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            Go to Dispatch Station
          </Button>
        </div>
      </div>

      {/* Outward Guided Stages Pipeline Bar */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono">
        <button
          type="button"
          onClick={() => navigate('/picking')}
          className="flex items-center gap-2 p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors text-left"
        >
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
            1
          </div>
          <span className="truncate">Stage 1: Floor Picking</span>
        </button>

        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-300 text-slate-900 font-bold shadow-xs">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
            2
          </div>
          <span className="truncate">Stage 2: Carton Packing (Active)</span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/shipments')}
          className="flex items-center gap-2 p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors text-left"
        >
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
            3
          </div>
          <span className="truncate">Stage 3: Carrier Dispatch</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Order #</th>
                <th className="px-4 py-2.5">Customer & City</th>
                <th className="px-4 py-2.5">Verified Picked Items</th>
                <th className="px-4 py-2.5 text-right">Total Units</th>
                <th className="px-4 py-2.5">Assigned Carrier</th>
                <th className="px-4 py-2.5 text-center">Packing Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading orders awaiting packing...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <EmptyState
                      icon={PackageCheck}
                      title="No Orders Awaiting Packing"
                      description="All floor-picked items have been packed into shipping cartons. Check floor picking queue for new tasks."
                      actionLabel="Go to Floor Picking Queue"
                      onAction={() => navigate('/picking')}
                    />
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const totalUnits = ord.items.reduce((s, i) => s + (i.pickedQty || i.allocatedQty), 0);
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {ord.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{ord.customer?.name}</div>
                        <div className="text-[10px] text-slate-500">{ord.customer?.city || 'Warehouse Direct'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                        {ord.items.map((i) => `${i.product.sku} (x${i.pickedQty || i.requestedQty})`).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatNumberIN(totalUnits)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {ord.shippingCarrier || 'Delhivery / Fleet'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSlipOrder(ord)}
                            leftIcon={<Printer className="w-3.5 h-3.5" />}
                          >
                            Manifest
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setSelectedOrder(ord)}
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            Pack Order
                          </Button>
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

      {/* Pack Order Modal */}
      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title="Containerize & Pack Order"
        description="Record physical packaging dimensions and container specifications"
      >
        {selectedOrder && (
          <form onSubmit={handlePackSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-blue-700 font-bold uppercase text-[10px]">Order Reference</span>
                <span className="font-bold text-blue-950 text-sm">{selectedOrder.orderNumber}</span>
              </div>
              <div className="text-blue-900 text-[11px]">
                Customer: <strong>{selectedOrder.customer.name}</strong>
              </div>
              <div className="text-blue-900 text-[11px]">
                Ship to: <strong>{selectedOrder.customer.shippingAddress}, {selectedOrder.customer.city}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Container / Carton Specification *
              </label>
              <select
                value={boxType}
                onChange={(e) => setBoxType(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
              >
                <option value="STANDARD_CORRUGATED">Standard 3-Ply Corrugated Box (12×10×8 in)</option>
                <option value="LARGE_CORRUGATED">Large 5-Ply Corrugated Box (18×14×12 in)</option>
                <option value="HEAVY_DUTY_CRATE">Heavy-Duty Wooden/Plastic Crate</option>
                <option value="PADDED_POLY_MAILER">Tamper-Evident Poly Courier Bag</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Gross Package Weight (kg) *
              </label>
              <input
                type="number"
                step="0.05"
                min={0.05}
                required
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 1.0)}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Seal Carton & Stage for Dispatch
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Manifest Slip Modal */}
      <Modal
        isOpen={Boolean(slipOrder)}
        onClose={() => setSlipOrder(null)}
        title="Packing Slip & Manifest"
        description="Physical manifest copy for warehouse staging and carton insertion"
      >
        {slipOrder && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 border border-slate-300 rounded-lg bg-slate-50 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <div className="font-bold text-sm text-slate-900">StockPilot WMS • India</div>
                  <div className="text-[10px] text-slate-500">Warehouse Packing Slip</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">{slipOrder.orderNumber}</div>
                  <div className="text-[10px] text-slate-500">{formatIST(slipOrder.orderDate, false)}</div>
                </div>
              </div>

              <div className="text-[11px] space-y-0.5">
                <div>Consignee: <strong>{slipOrder.customer.name}</strong></div>
                <div>Destination: <strong>{slipOrder.customer.shippingAddress}, {slipOrder.customer.city}</strong></div>
              </div>

              <div className="border-t border-slate-200 pt-2 space-y-1.5">
                <div className="font-bold text-[10px] uppercase text-slate-600">Verified Line Items:</div>
                {slipOrder.items.map((i) => (
                  <div key={i.id} className="flex justify-between items-center text-[11px] py-1 border-b border-slate-100">
                    <div>
                      <span className="font-bold text-slate-900">{i.product.sku}</span>
                      <span className="text-slate-500 ml-1.5">— {i.product.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">Qty: {i.pickedQty || i.requestedQty} {i.product.uom}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSlipOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
