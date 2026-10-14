import React, { useState, useEffect } from 'react';
import { PackageCheck, RefreshCw, Box, Printer, Check, ArrowRight } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { SalesOrder } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';

export const PackingPage: React.FC = () => {
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Order Packing Station
          </h1>
          <p className="text-xs text-surface-500">
            Package verification, container assignment, and packing slip generation
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadOrders}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-2.5">Order #</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Items to Verify</th>
              <th className="px-4 py-2.5 text-right">Picked Units</th>
              <th className="px-4 py-2.5">Carrier Service</th>
              <th className="px-4 py-2.5 text-center">Packing Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                  Loading orders awaiting packing...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8">
                  <EmptyState
                    icon={PackageCheck}
                    title="No Orders Awaiting Packing"
                    description="All picked orders have been containerized and sent to shipping dispatch."
                  />
                </td>
              </tr>
            ) : (
              orders.map((ord) => {
                const totalUnits = ord.items.reduce((s, i) => s + (i.pickedQty || i.allocatedQty), 0);
                return (
                  <tr key={ord.id} className="hover:bg-surface-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-surface-900">
                      {ord.orderNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-surface-800">
                      {ord.customer?.name}
                    </td>
                    <td className="px-4 py-3 text-surface-600">
                      {ord.items.map((i) => `${i.product.sku} (x${i.requestedQty})`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-surface-900">
                      {totalUnits}
                    </td>
                    <td className="px-4 py-3 font-mono text-surface-600 text-[11px]">
                      {ord.shippingCarrier || 'Standard Ground'}
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

      {/* Pack Order Modal */}
      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title="Containerize & Pack Order"
        description="Record physical packaging dimensions and container specifications"
      >
        {selectedOrder && (
          <form onSubmit={handlePackSubmit} className="space-y-4">
            <div className="p-3 rounded bg-surface-50 border border-surface-200 text-xs font-mono space-y-1">
              <div>
                <span className="text-surface-400">Order:</span>{' '}
                <span className="font-bold text-surface-900">{selectedOrder.orderNumber}</span>
              </div>
              <div>
                <span className="text-surface-400">Customer:</span>{' '}
                <span>{selectedOrder.customer.name}</span>
              </div>
              <div>
                <span className="text-surface-400">Destination:</span>{' '}
                <span>{selectedOrder.customer.shippingAddress}, {selectedOrder.customer.city}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Container / Box Type
              </label>
              <select
                value={boxType}
                onChange={(e) => setBoxType(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-surface-300 rounded font-mono text-surface-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="STANDARD_CORRUGATED">Standard Corrugated 12x10x8</option>
                <option value="LARGE_CORRUGATED">Large Corrugated 18x14x12</option>
                <option value="HEAVY_DUTY_CRATE">Heavy-Duty Double-Wall Crate</option>
                <option value="PADDED_POLY_MAILER">Padded Poly Mailer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Gross Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                required
                value={weightKg}
                onChange={(e) => setWeightKg(parseFloat(e.target.value) || 1.0)}
                className="w-full h-9 px-3 text-xs border border-surface-300 rounded font-mono text-surface-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Seal & Mark Packed
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Manifest Slip Modal */}
      <Modal
        isOpen={Boolean(slipOrder)}
        onClose={() => setSlipOrder(null)}
        title="Packing Manifest Slip"
        description="Physical manifest copy for warehouse staging and carton insertion"
      >
        {slipOrder && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 border border-surface-300 rounded bg-surface-50 space-y-2">
              <div className="flex justify-between border-b pb-2">
                <span className="font-bold">StockPilot WMS Manifest</span>
                <span>{slipOrder.orderNumber}</span>
              </div>
              <div>Customer: {slipOrder.customer.name}</div>
              <div>Address: {slipOrder.customer.shippingAddress}, {slipOrder.customer.city}</div>
              <div className="border-t pt-2 space-y-1">
                <div className="font-bold">Verified Items:</div>
                {slipOrder.items.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>{i.product.sku} ({i.product.name})</span>
                    <span>x{i.requestedQty}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSlipOrder(null)}>
                Close Manifest
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
