import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  RefreshCw,
  Send,
  CheckCircle2,
  ArrowRight,
  Package,
  ChevronRight,
  ExternalLink,
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

export const ShipmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedWarehouseId } = useWarehouse();
  const [packedOrders, setPackedOrders] = useState<SalesOrder[]>([]);
  const [shippedOrders, setShippedOrders] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dispatch Modal
  const [dispatchOrder, setDispatchOrder] = useState<SalesOrder | null>(null);
  const [carrier, setCarrier] = useState('Delhivery Surface Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [packed, shipped] = await Promise.all([
        api.listSalesOrders({
          warehouseId: selectedWarehouseId,
          status: 'PACKED',
        }),
        api.listSalesOrders({
          warehouseId: selectedWarehouseId,
          status: 'SHIPPED',
          limit: 25,
        }),
      ]);
      setPackedOrders(packed);
      setShippedOrders(shipped);
    } catch (err) {
      toast.error('Failed to load shipment queues');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId]);

  const openDispatch = (order: SalesOrder) => {
    setDispatchOrder(order);
    setCarrier(order.shippingCarrier || 'Delhivery Surface Express');
    setTrackingNumber(order.trackingNumber || `DEL-${Date.now().toString().slice(-8)}`);
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchOrder) return;

    setIsSubmitting(true);
    try {
      await api.dispatchOrder(dispatchOrder.id, {
        carrier,
        trackingNumber,
      });

      toast.success(`Order ${dispatchOrder.orderNumber} dispatched! Physical inventory relieved.`);
      setDispatchOrder(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Dispatch failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
              Carrier Shipping & Dispatch Station
            </h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {packedOrders.length} Staged for Pickup
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Waybill generation, vehicle handover, and atomic inventory relief
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Queues
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/sales-orders')}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            All Sales Orders
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

        <button
          type="button"
          onClick={() => navigate('/packing')}
          className="flex items-center gap-2 p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors text-left"
        >
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
            2
          </div>
          <span className="truncate">Stage 2: Carton Packing</span>
        </button>

        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-300 text-slate-900 font-bold shadow-xs">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
            3
          </div>
          <span className="truncate">Stage 3: Carrier Dispatch (Active)</span>
        </div>
      </div>

      {/* Awaiting Dispatch Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Cartons Awaiting Carrier Handover ({packedOrders.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Staged at Shipping Dock</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Order #</th>
                  <th className="px-4 py-2.5">Customer & City</th>
                  <th className="px-4 py-2.5">Cartons</th>
                  <th className="px-4 py-2.5">Logistics Partner</th>
                  <th className="px-4 py-2.5">Waybill / Docket</th>
                  <th className="px-4 py-2.5 text-center">Handover Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      Loading packed orders...
                    </td>
                  </tr>
                ) : packedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <EmptyState
                        icon={Truck}
                        title="No Cartons Awaiting Dispatch"
                        description="All packed cartons have been dispatched to logistics carriers. Check the packing station for upcoming cartons."
                        actionLabel="Go to Packing Station"
                        onAction={() => navigate('/packing')}
                      />
                    </td>
                  </tr>
                ) : (
                  packedOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {ord.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{ord.customer.name}</div>
                        <div className="text-[10px] text-slate-500">{ord.customer.city}, {ord.customer.state}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {ord.packages?.length || 1} carton(s)
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {ord.shippingCarrier || 'Delhivery Express'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                        {ord.trackingNumber || 'Pending Barcode'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openDispatch(ord)}
                          leftIcon={<Send className="w-3.5 h-3.5" />}
                        >
                          Confirm Dispatch
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dispatched History Section */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Recently Dispatched Shipments ({shippedOrders.length})
          </h2>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Order #</th>
                  <th className="px-4 py-2.5">Customer & Destination</th>
                  <th className="px-4 py-2.5">Logistics Partner</th>
                  <th className="px-4 py-2.5">Docket / Tracking</th>
                  <th className="px-4 py-2.5 text-right">Items Relieved</th>
                  <th className="px-4 py-2.5">Dispatched Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {shippedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No shipments dispatched yet in this facility.
                    </td>
                  </tr>
                ) : (
                  shippedOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                        {ord.orderNumber}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{ord.customer?.name}</div>
                        <div className="text-[10px] text-slate-500">{ord.customer?.city}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">
                        {ord.shippingCarrier || 'Delhivery Express'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-blue-700 font-semibold text-[11px]">
                        {ord.trackingNumber || 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatNumberIN(ord.items.reduce((s, i) => s + (i.pickedQty || i.requestedQty), 0))} units
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          DISPATCHED
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dispatch Confirmation Modal */}
      <Modal
        isOpen={Boolean(dispatchOrder)}
        onClose={() => setDispatchOrder(null)}
        title="Confirm Carrier Handover & Dispatch"
        description="Permanently relieves reserved inventory balances and generates immutable ORDER_SHIP movement"
      >
        {dispatchOrder && (
          <form onSubmit={handleDispatchSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-700 font-bold uppercase text-[10px]">Order To Release</span>
                <span className="font-bold text-emerald-950 text-sm">{dispatchOrder.orderNumber}</span>
              </div>
              <div className="text-emerald-900 text-[11px]">
                Consignee: <strong>{dispatchOrder.customer.name}</strong>
              </div>
              <div className="text-emerald-900 text-[11px]">
                Delivery Address: <strong>{dispatchOrder.customer.shippingAddress}, {dispatchOrder.customer.city}</strong>
              </div>
              <div className="text-emerald-800 text-[10px] pt-1 border-t border-emerald-200">
                Notice: Physical stock on hand will be permanently deducted.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Logistics Carrier Partner *
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-1 focus:ring-blue-500"
              >
                <option value="Delhivery Surface Express">Delhivery Surface Express</option>
                <option value="Blue Dart Air Express">Blue Dart Air Express</option>
                <option value="Shadowfax Logistics">Shadowfax Logistics</option>
                <option value="Xpressbees Logistics">Xpressbees Logistics</option>
                <option value="DTDC Express Priority">DTDC Express Priority</option>
                <option value="Safexpress Full Truckload">Safexpress Full Truckload</option>
                <option value="TCI Freight Transport">TCI Freight Transport</option>
                <option value="Direct Fleet Distribution">Direct Fleet Distribution (In-House)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Air Waybill / Consignment Docket Number *
              </label>
              <input
                type="text"
                required
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
                placeholder="e.g. DEL-82910382, AWB-99120482"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setDispatchOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Confirm Handover & Relieve Stock
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
