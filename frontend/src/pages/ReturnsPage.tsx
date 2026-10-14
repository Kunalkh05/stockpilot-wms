import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, RefreshCw, CheckCircle2, AlertOctagon, Check } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { ReturnOrder, Location, Product } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';

export const ReturnsPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const { hasRole } = useAuth();
  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Request RMA Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [reason, setReason] = useState('');
  const [rmaItems, setRmaItems] = useState<Array<{ productId: string; expectedQty: number }>>([
    { productId: '', expectedQty: 1 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inspect Modal
  const [inspectOrder, setInspectOrder] = useState<ReturnOrder | null>(null);
  const [inspectLines, setInspectLines] = useState<any[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [retRes, locRes, prodRes] = await Promise.all([
        api.listReturns({ warehouseId: selectedWarehouseId }),
        selectedWarehouseId ? api.listLocations(selectedWarehouseId) : [],
        api.listProducts({ limit: 100 }),
      ]);
      setReturns(retRes);
      setLocations(locRes);
      setProducts(prodRes);
    } catch (err) {
      toast.error('Failed to load return orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId]);

  const openInspect = (ret: ReturnOrder) => {
    setInspectOrder(ret);
    const defaultStorage = locations.find((l) => l.type === 'STORAGE')?.id || '';
    setInspectLines(
      ret.items.map((it) => ({
        returnOrderItemId: it.id,
        productId: it.productId,
        sku: it.product.sku,
        name: it.product.name,
        expectedQty: it.expectedQty,
        receivedQty: it.expectedQty,
        disposition: 'RESTOCK',
        targetLocationId: defaultStorage,
        notes: '',
      }))
    );
  };

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectOrder) return;

    setIsSubmitting(true);
    try {
      await api.inspectReturn(inspectOrder.id, inspectLines);
      toast.success(`RMA ${inspectOrder.rmaNumber} inspected and inventory credited`);
      setInspectOrder(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Inspection failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRMA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId) return;

    const valid = rmaItems.filter((i) => i.productId && i.expectedQty > 0);
    if (valid.length === 0) {
      toast.error('At least one item line is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createReturn({
        customerId: customerId || 'cust-nexus-default',
        warehouseId: selectedWarehouseId,
        reason,
        items: valid,
      });
      toast.success('Return authorization (RMA) created');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create return order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Customer Returns & Reverse Logistics
          </h1>
          <p className="text-xs text-surface-500">
            RMA processing, quality inspection, and automated restocking or quarantine routing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {hasRole('ADMIN', 'WAREHOUSE_MANAGER', 'INVENTORY_SPECIALIST') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Authorize Return (RMA)
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-2.5">RMA #</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Reason</th>
              <th className="px-4 py-2.5">Items</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-center">Disposition Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                  Loading return orders...
                </td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8">
                  <EmptyState
                    icon={RotateCcw}
                    title="No Customer Returns"
                    description="No pending return authorizations or customer RMAs."
                  />
                </td>
              </tr>
            ) : (
              returns.map((ret) => (
                <tr key={ret.id} className="hover:bg-surface-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-surface-900">
                    {ret.rmaNumber}
                  </td>
                  <td className="px-4 py-3 font-medium text-surface-800">
                    {ret.customer?.name}
                  </td>
                  <td className="px-4 py-3 text-surface-600 truncate max-w-xs">
                    {ret.reason || 'Customer Return'}
                  </td>
                  <td className="px-4 py-3 font-mono text-surface-600">
                    {ret.items.map((i) => `${i.product.sku} (x${i.expectedQty})`).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ret.status === 'INSPECTED' ? 'success' : 'amber'} size="sm">
                      {ret.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ret.status === 'REQUESTED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openInspect(ret)}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                      >
                        Inspect Goods
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Return Modal */}
      <Modal
        isOpen={Boolean(inspectOrder)}
        onClose={() => setInspectOrder(null)}
        title="Inspect Returned Goods & Route Disposition"
        description="Inspect received goods for restocking or quarantine write-off"
        maxWidth="2xl"
      >
        {inspectOrder && (
          <form onSubmit={handleInspectSubmit} className="space-y-4">
            <div className="space-y-3">
              {inspectLines.map((line, idx) => (
                <div key={line.returnOrderItemId} className="p-3 bg-surface-50 border rounded text-xs space-y-2">
                  <div className="flex justify-between font-mono font-bold">
                    <span>{line.sku}</span>
                    <span>Expected: {line.expectedQty}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-surface-600 mb-0.5">
                        Received Qty
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={line.receivedQty}
                        onChange={(e) => {
                          const updated = [...inspectLines];
                          updated[idx].receivedQty = parseInt(e.target.value, 10) || 0;
                          setInspectLines(updated);
                        }}
                        className="w-full h-8 px-2 text-xs border border-surface-300 rounded font-mono text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-surface-600 mb-0.5">
                        Disposition
                      </label>
                      <select
                        value={line.disposition}
                        onChange={(e) => {
                          const updated = [...inspectLines];
                          updated[idx].disposition = e.target.value;
                          setInspectLines(updated);
                        }}
                        className="w-full h-8 px-2 text-xs border border-surface-300 rounded bg-white"
                      >
                        <option value="RESTOCK">Restock (Good Condition)</option>
                        <option value="QUARANTINE">Quarantine (Damaged)</option>
                        <option value="SCRAP">Scrap / Write-off</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-surface-600 mb-0.5">
                        Target Storage Bin
                      </label>
                      <select
                        value={line.targetLocationId}
                        onChange={(e) => {
                          const updated = [...inspectLines];
                          updated[idx].targetLocationId = e.target.value;
                          setInspectLines(updated);
                        }}
                        className="w-full h-8 px-2 text-xs border border-surface-300 rounded bg-white font-mono"
                      >
                        <option value="">Select location...</option>
                        {locations
                          .filter((l) => (line.disposition === 'QUARANTINE' ? l.type === 'QUARANTINE' : l.type === 'STORAGE'))
                          .map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.code}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setInspectOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Confirm Disposition & Restock
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Authorize Return Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Authorize Customer Return (RMA)"
        description="Issue RMA for customer product returns"
      >
        <form onSubmit={handleCreateRMA} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Return Reason
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Ordered incorrect voltage sensor, returning in sealed box"
              className="w-full p-2 text-xs border border-surface-300 rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Returned SKU
            </label>
            <select
              required
              value={rmaItems[0].productId}
              onChange={(e) => setRmaItems([{ productId: e.target.value, expectedQty: rmaItems[0].expectedQty }])}
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded bg-white"
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Expected Return Units
            </label>
            <input
              type="number"
              min={1}
              required
              value={rmaItems[0].expectedQty}
              onChange={(e) =>
                setRmaItems([{ productId: rmaItems[0].productId, expectedQty: parseInt(e.target.value, 10) || 1 }])
              }
              className="w-full h-8 px-2 text-xs border border-surface-300 rounded font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Issue RMA
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
