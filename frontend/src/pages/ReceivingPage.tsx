import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  Layers,
  Calendar,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { PurchaseOrder, Location } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { toast } from 'sonner';

interface ReceivingLineState {
  purchaseOrderItemId: string;
  productId: string;
  sku: string;
  name: string;
  expectedQty: number;
  previouslyReceived: number;
  acceptedQty: number;
  damagedQty: number;
  rejectedQty: number;
  lotNumber: string;
  expiryDate: string;
  notes: string;
}

export const ReceivingPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const [openPOs, setOpenPOs] = useState<PurchaseOrder[]>([]);
  const [receivingLocations, setReceivingLocations] = useState<Location[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [receivingLines, setReceivingLines] = useState<ReceivingLineState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pos, locs] = await Promise.all([
        api.listPurchaseOrders({
          warehouseId: selectedWarehouseId,
          status: 'ORDERED',
        }),
        selectedWarehouseId ? api.listLocations(selectedWarehouseId, { type: 'RECEIVING' }) : [],
      ]);
      setOpenPOs(pos);
      setReceivingLocations(locs);

      if (locs.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locs[0].id);
      }
    } catch (err) {
      toast.error('Failed to load inbound receiving data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouseId]);

  const handleSelectPO = (poId: string) => {
    setSelectedPOId(poId);
    const po = openPOs.find((p) => p.id === poId);
    if (!po) {
      setReceivingLines([]);
      return;
    }

    const lines: ReceivingLineState[] = po.items.map((item) => {
      const remaining = Math.max(0, item.expectedQty - item.receivedQty);
      return {
        purchaseOrderItemId: item.id,
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        expectedQty: item.expectedQty,
        previouslyReceived: item.receivedQty,
        acceptedQty: remaining,
        damagedQty: 0,
        rejectedQty: 0,
        lotNumber: '',
        expiryDate: '',
        notes: '',
      };
    });

    setReceivingLines(lines);
  };

  const updateLine = (index: number, field: keyof ReceivingLineState, value: any) => {
    const updated = [...receivingLines];
    updated[index] = { ...updated[index], [field]: value };
    setReceivingLines(updated);
  };

  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOId || !selectedWarehouseId || !selectedLocationId) {
      toast.error('Please select both a Purchase Order and Receiving Dock location');
      return;
    }

    const hasAnyUnits = receivingLines.some((l) => l.acceptedQty > 0 || l.damagedQty > 0);
    if (!hasAnyUnits) {
      toast.error('Please specify accepted or damaged quantities for at least one line');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `RCV-SESSION-${Date.now()}`;
      await api.receiveStock({
        purchaseOrderId: selectedPOId,
        warehouseId: selectedWarehouseId,
        receivingLocationId: selectedLocationId,
        idempotencyKey,
        items: receivingLines.map((l) => ({
          purchaseOrderItemId: l.purchaseOrderItemId,
          productId: l.productId,
          acceptedQty: Number(l.acceptedQty) || 0,
          damagedQty: Number(l.damagedQty) || 0,
          rejectedQty: Number(l.rejectedQty) || 0,
          lotNumber: l.lotNumber || undefined,
          expiryDate: l.expiryDate || undefined,
          notes: l.notes || undefined,
        })),
      });

      toast.success('Inbound receipt processed and put-away tasks generated!');
      setSelectedPOId('');
      setReceivingLines([]);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-surface-900 tracking-tight">
          Inbound Receiving Dock
        </h1>
        <p className="text-xs text-surface-500">
          Capture quantities, inspect lot/expiry, and auto-route to put-away tasks
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Select Purchase Order */}
        <div className="bg-white rounded-lg border border-surface-200 p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-200">
            <Truck className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
              1. Select Inbound PO
            </h2>
          </div>

          {openPOs.length === 0 ? (
            <div className="text-xs text-surface-400 py-6 text-center">
              No open purchase orders currently awaiting receipt in this facility.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {openPOs.map((po) => (
                <div
                  key={po.id}
                  onClick={() => handleSelectPO(po.id)}
                  className={`p-3 rounded-md border text-xs cursor-pointer transition-colors ${
                    selectedPOId === po.id
                      ? 'border-brand-500 bg-brand-50/40 text-surface-900 font-medium'
                      : 'border-surface-200 hover:bg-surface-50 text-surface-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold">{po.poNumber}</span>
                    <Badge variant="info" size="sm">
                      {po.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-surface-500 mt-1">{po.supplier?.name}</div>
                  <div className="text-[11px] text-surface-400 font-mono mt-0.5">
                    {po.items.length} line item(s)
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Receiving Dock Location Selector */}
          <div className="pt-2 border-t border-surface-200">
            <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
              Receiving Dock Location
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-white border border-surface-300 rounded font-mono text-surface-900"
            >
              {receivingLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} ({loc.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2: Line Item Capture Form */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-surface-200 p-4 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 pb-2 border-b border-surface-200 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
              2. Inspect & Verify Physical Goods
            </h2>
          </div>

          {!selectedPOId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-surface-400">
              <Package className="w-10 h-10 stroke-1 mb-2 text-surface-300" />
              <div className="text-xs">Select a Purchase Order on the left to begin receiving.</div>
            </div>
          ) : (
            <form onSubmit={handleConfirmReceipt} className="flex-1 flex flex-col justify-between">
              <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
                {receivingLines.map((line, idx) => (
                  <div
                    key={line.purchaseOrderItemId}
                    className="p-3.5 bg-surface-50 border border-surface-200 rounded-lg text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-surface-900">{line.sku}</span>
                        <span className="text-surface-600 ml-2">{line.name}</span>
                      </div>
                      <span className="text-surface-500 font-mono text-[11px]">
                        Expected: {line.expectedQty} | Previously Received: {line.previouslyReceived}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-emerald-800 mb-0.5">
                          Accepted Qty
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={line.acceptedQty}
                          onChange={(e) =>
                            updateLine(idx, 'acceptedQty', parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full h-8 px-2 text-xs border border-emerald-300 bg-white rounded font-mono font-semibold text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-rose-800 mb-0.5">
                          Damaged in Transit
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={line.damagedQty}
                          onChange={(e) =>
                            updateLine(idx, 'damagedQty', parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full h-8 px-2 text-xs border border-rose-300 bg-white rounded font-mono text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-surface-600 mb-0.5">
                          Rejected (Vendor)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={line.rejectedQty}
                          onChange={(e) =>
                            updateLine(idx, 'rejectedQty', parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full h-8 px-2 text-xs border border-surface-300 bg-white rounded font-mono text-right"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-surface-200/60">
                      <div>
                        <label className="block text-[10px] font-medium text-surface-600 mb-0.5">
                          Lot / Batch Number
                        </label>
                        <input
                          type="text"
                          value={line.lotNumber}
                          onChange={(e) => updateLine(idx, 'lotNumber', e.target.value)}
                          placeholder="e.g. LOT-2026-X8"
                          className="w-full h-7 px-2 text-xs border border-surface-300 bg-white rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-surface-600 mb-0.5">
                          Expiry Date (if applicable)
                        </label>
                        <input
                          type="date"
                          value={line.expiryDate}
                          onChange={(e) => updateLine(idx, 'expiryDate', e.target.value)}
                          className="w-full h-7 px-2 text-xs border border-surface-300 bg-white rounded"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-surface-200 flex items-center justify-between mt-4">
                <span className="text-xs text-surface-500">
                  Idempotent submission prevents double-receiving
                </span>
                <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
                  Confirm Dock Receipt & Generate Put-Aways
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
