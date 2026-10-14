import React, { useState, useEffect } from 'react';
import { Truck, RefreshCw, Send, CheckCircle2, ArrowRight } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { SalesOrder } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';

export const ShipmentsPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const [packedOrders, setPackedOrders] = useState<SalesOrder[]>([]);
  const [shippedOrders, setShippedOrders] = useState<SalesOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dispatch Modal
  const [dispatchOrder, setDispatchOrder] = useState<SalesOrder | null>(null);
  const [carrier, setCarrier] = useState('FedEx Ground');
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
    setCarrier(order.shippingCarrier || 'FedEx Ground');
    setTrackingNumber(order.trackingNumber || `TRK-${Date.now().toString().slice(-8)}`);
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

      toast.success(`Order ${dispatchOrder.orderNumber} dispatched! Inventory relieved.`);
      setDispatchOrder(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Dispatch failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Shipping & Dispatch Station
          </h1>
          <p className="text-xs text-surface-500">
            Carrier dispatch release: permanently relieves reserved inventory balances
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Queues
        </Button>
      </div>

      {/* Awaiting Dispatch Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-brand-600" />
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
            Awaiting Carrier Hand-Off ({packedOrders.length})
          </h2>
        </div>

        <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Order #</th>
                <th className="px-4 py-2.5">Customer & Destination</th>
                <th className="px-4 py-2.5">Packages</th>
                <th className="px-4 py-2.5">Carrier</th>
                <th className="px-4 py-2.5">Tracking #</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-surface-400">
                    Loading packed orders...
                  </td>
                </tr>
              ) : packedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-surface-400">
                    No orders currently packed and awaiting carrier dispatch.
                  </td>
                </tr>
              ) : (
                packedOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-surface-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-surface-900">
                      {ord.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-surface-800">{ord.customer.name}</div>
                      <div className="text-[11px] text-surface-500">{ord.customer.city}, {ord.customer.state}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-surface-600">
                      {ord.packages?.length || 1} carton(s)
                    </td>
                    <td className="px-4 py-3 font-mono text-surface-700">
                      {ord.shippingCarrier || 'Standard'}
                    </td>
                    <td className="px-4 py-3 font-mono text-surface-500 text-[11px]">
                      {ord.trackingNumber || 'Pending Label'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openDispatch(ord)}
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        Dispatch
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatched History Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
            Recently Dispatched Shipments
          </h2>
        </div>

        <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Order #</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Carrier Service</th>
                <th className="px-4 py-2.5">Waybill / Tracking</th>
                <th className="px-4 py-2.5 text-right">Items Shipped</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {shippedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-surface-400">
                    No shipments dispatched yet.
                  </td>
                </tr>
              ) : (
                shippedOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-surface-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-surface-900">
                      {ord.orderNumber}
                    </td>
                    <td className="px-4 py-2.5 text-surface-700 font-medium">
                      {ord.customer?.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-surface-600">
                      {ord.shippingCarrier}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-brand-700 font-medium text-[11px]">
                      {ord.trackingNumber}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">
                      {ord.items.reduce((s, i) => s + (i.pickedQty || i.requestedQty), 0)} units
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="success" size="sm">
                        {ord.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Confirmation Modal */}
      <Modal
        isOpen={Boolean(dispatchOrder)}
        onClose={() => setDispatchOrder(null)}
        title="Confirm Shipment Dispatch"
        description="Permanently relives physical inventory and consumes active stock reservations"
      >
        {dispatchOrder && (
          <form onSubmit={handleDispatchSubmit} className="space-y-4">
            <div className="p-3 rounded bg-surface-50 border border-surface-200 text-xs font-mono space-y-1">
              <div>
                <span className="text-surface-400">Order:</span>{' '}
                <span className="font-bold">{dispatchOrder.orderNumber}</span>
              </div>
              <div>
                <span className="text-surface-400">Customer:</span>{' '}
                <span>{dispatchOrder.customer.name}</span>
              </div>
              <div>
                <span className="text-surface-400">Address:</span>{' '}
                <span>{dispatchOrder.customer.shippingAddress}, {dispatchOrder.customer.city}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Logistics Carrier
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-surface-300 rounded font-mono text-surface-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="FedEx Ground">FedEx Ground</option>
                <option value="FedEx Express">FedEx Express Air</option>
                <option value="UPS Ground">UPS Ground Freight</option>
                <option value="DHL Express">DHL Express International</option>
                <option value="Old Dominion Freight Line">ODFL Dedicated Truckload</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Carrier Tracking Number
              </label>
              <input
                type="text"
                required
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-surface-300 rounded font-mono text-surface-900"
              />
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
              Note: This action records an immutable <span className="font-mono font-bold">ORDER_SHIP</span> movement and deducts physical balance from bins.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setDispatchOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Confirm Hand-Off & Relieve Inventory
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
