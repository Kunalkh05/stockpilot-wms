import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  Layers,
  Calendar,
  Check,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  ArrowRight,
  FileText,
  Clock,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { PurchaseOrder, Location } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { toast } from 'sonner';
import { formatNumberIN, formatIST } from '../utils/formatters.js';

interface ReceivingLineState {
  purchaseOrderItemId: string;
  productId: string;
  sku: string;
  name: string;
  expectedQty: number;
  previouslyReceived: number;
  totalReceived: number;
  acceptedQty: number;
  damagedQty: number;
  rejectedQty: number;
  lotNumber: string;
  expiryDate: string;
  notes: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

export const ReceivingPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [openPOs, setOpenPOs] = useState<PurchaseOrder[]>([]);
  const [receivingLocations, setReceivingLocations] = useState<Location[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [receivingLines, setReceivingLines] = useState<ReceivingLineState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [receiptSuccessData, setReceiptSuccessData] = useState<any | null>(null);

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
        totalReceived: remaining,
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

    // Auto-balance if total received is edited
    if (field === 'totalReceived') {
      const tot = Number(value) || 0;
      updated[index].acceptedQty = tot;
      updated[index].damagedQty = 0;
      updated[index].rejectedQty = 0;
    }

    setReceivingLines(updated);
  };

  // Live Summary Calculations
  const selectedPO = openPOs.find((p) => p.id === selectedPOId);
  const selectedLocation = receivingLocations.find((l) => l.id === selectedLocationId);
  const skuCount = receivingLines.length;
  const totalReceivedUnits = receivingLines.reduce((s, l) => s + (Number(l.totalReceived) || 0), 0);
  const totalAcceptedUnits = receivingLines.reduce((s, l) => s + (Number(l.acceptedQty) || 0), 0);
  const totalDamagedUnits = receivingLines.reduce((s, l) => s + (Number(l.damagedQty) || 0), 0);
  const totalRejectedUnits = receivingLines.reduce((s, l) => s + (Number(l.rejectedQty) || 0), 0);

  // Validation before advancing
  const canAdvanceFromStep1 = Boolean(selectedPOId && selectedLocationId);
  const canAdvanceFromStep2 = receivingLines.length > 0 && totalReceivedUnits > 0;
  const canAdvanceFromStep3 =
    receivingLines.every((l) => Number(l.acceptedQty) + Number(l.damagedQty) + Number(l.rejectedQty) === Number(l.totalReceived)) &&
    (totalAcceptedUnits > 0 || totalDamagedUnits > 0);

  const handleConfirmReceipt = async () => {
    if (!selectedPOId || !selectedWarehouseId || !selectedLocationId) {
      toast.error('Please verify purchase order and receiving dock assignment');
      return;
    }

    if (totalAcceptedUnits === 0 && totalDamagedUnits === 0) {
      toast.error('Receipt requires at least one accepted or damaged physical unit');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `RCV-SESSION-${selectedPOId}-${Date.now()}`;
      const res = await api.receiveStock({
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
          lotNumber: l.lotNumber.trim() || undefined,
          expiryDate: l.expiryDate || undefined,
          notes: l.notes || undefined,
        })),
      });

      setReceiptSuccessData(res);
      toast.success('Inbound goods receipt confirmed and put-away tasks generated!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Inbound PO & Dock' },
    { num: 2, label: 'Physical Check-In' },
    { num: 3, label: 'Quality & Triage' },
    { num: 4, label: 'Lots & Expiry' },
    { num: 5, label: 'Review & Confirm' },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Inward Receiving Dock</h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Guided 5-Stage Stepper
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Physical cargo inspection, discrepancy accounting, lot assignment, and put-away task routing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh Open POs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/put-away')}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            Go to Put-Away Tasks
          </Button>
        </div>
      </div>

      {/* 5-Stage Step Indicator */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
        <div className="grid grid-cols-5 gap-2">
          {steps.map((s) => {
            const isCurrent = currentStep === s.num;
            const isCompleted = currentStep > s.num;

            return (
              <button
                key={s.num}
                type="button"
                disabled={isSubmitting || (s.num > currentStep && !canAdvanceFromStep1)}
                onClick={() => {
                  if (s.num < currentStep) setCurrentStep(s.num as WizardStep);
                }}
                className={`flex items-center gap-2 p-2 rounded-md border text-left transition-all ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 font-bold ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3 stroke-3" /> : s.num}
                </div>
                <span className="text-[11px] truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Wizard Form on Left (8 cols), Dynamic Summary Panel on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Form Area (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between min-h-[460px]">
          {/* STEP 1: PO & Dock Location Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Stage 1: Select Inbound Purchase Order & Receiving Dock
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">{openPOs.length} POs awaiting check-in</span>
              </div>

              {openPOs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  No purchase orders currently pending receipt in this warehouse facility.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {openPOs.map((po) => {
                    const isSelected = selectedPOId === po.id;
                    return (
                      <div
                        key={po.id}
                        onClick={() => handleSelectPO(po.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-slate-900 font-medium shadow-xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{po.poNumber}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 text-blue-800">
                            {po.status}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1">{po.supplier?.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {po.items.length} product line(s) • Expected delivery:{' '}
                          {po.expectedDeliveryDate ? formatIST(po.expectedDeliveryDate, false) : 'Standard'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Receiving Dock Location Selector */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Receiving Dock Staging Bin *
                </label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded font-mono text-slate-900"
                >
                  {receivingLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} ({loc.type} - Zone {loc.zone})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Physical Check-In / Expected vs Received */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Stage 2: Verify Physical Package Counts & Line Quantities
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">{receivingLines.length} Lines</span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {receivingLines.map((line, idx) => (
                  <div key={line.purchaseOrderItemId} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-slate-900">{line.sku}</span>
                        <span className="text-slate-600 ml-2">{line.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        PO Expected: <strong>{line.expectedQty}</strong> | Prev Received: {line.previouslyReceived}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-xs font-medium text-slate-700">Physical Units Unloaded:</label>
                      <input
                        type="number"
                        min={0}
                        max={line.expectedQty - line.previouslyReceived + 50}
                        value={line.totalReceived}
                        onChange={(e) => updateLine(idx, 'totalReceived', parseInt(e.target.value, 10) || 0)}
                        className="w-28 h-8 px-2 text-xs border border-slate-300 rounded font-mono font-bold text-right text-slate-900 bg-white"
                      />
                      <span className="text-slate-500 text-xs">units</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Quality & Triage Breakdown */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Stage 3: Inspection Breakdown (Accepted, Damaged, Rejected)
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">Triage Verification</span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {receivingLines.map((line, idx) => {
                  const sumBreakdown = Number(line.acceptedQty) + Number(line.damagedQty) + Number(line.rejectedQty);
                  const isBalanced = sumBreakdown === Number(line.totalReceived);

                  return (
                    <div key={line.purchaseOrderItemId} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-900">{line.sku} — {line.name}</span>
                        <span className="font-mono text-xs">Total Unloaded: <strong>{line.totalReceived}</strong></span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-emerald-700 mb-1">
                            Accepted (Sellable)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={line.acceptedQty}
                            onChange={(e) => updateLine(idx, 'acceptedQty', parseInt(e.target.value, 10) || 0)}
                            className="w-full h-8 px-2 text-xs border border-emerald-300 rounded font-mono font-bold text-right bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-amber-700 mb-1">
                            Damaged (Quarantine)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={line.damagedQty}
                            onChange={(e) => updateLine(idx, 'damagedQty', parseInt(e.target.value, 10) || 0)}
                            className="w-full h-8 px-2 text-xs border border-amber-300 rounded font-mono font-bold text-right bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-rose-700 mb-1">
                            Rejected (Return)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={line.rejectedQty}
                            onChange={(e) => updateLine(idx, 'rejectedQty', parseInt(e.target.value, 10) || 0)}
                            className="w-full h-8 px-2 text-xs border border-rose-300 rounded font-mono font-bold text-right bg-white"
                          />
                        </div>
                      </div>

                      {!isBalanced && (
                        <div className="text-[11px] text-rose-600 font-semibold pt-1">
                          Sum of triage units ({sumBreakdown}) must equal total unloaded units ({line.totalReceived}).
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Lots & Expiry Assignment */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Stage 4: Batch / Lot Tracking & Expiry Dates
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">Traceability</span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {receivingLines.map((line, idx) => (
                  <div key={line.purchaseOrderItemId} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="font-mono font-bold text-slate-900">{line.sku} — {line.name}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-1">
                          Vendor Lot / Batch # (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., LOT-2026-X9"
                          value={line.lotNumber}
                          onChange={(e) => updateLine(idx, 'lotNumber', e.target.value)}
                          className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-1">
                          Expiry Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={line.expiryDate}
                          onChange={(e) => updateLine(idx, 'expiryDate', e.target.value)}
                          className="w-full h-8 px-2 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Final Review & Confirmation */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Stage 5: Final Verification & Confirmation
                  </h2>
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-700">Ready to Commit</span>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1.5 text-blue-950">
                <div className="font-semibold text-blue-900">What will happen upon confirmation:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-900">
                  <li>
                    Physical inventory will be debited into dock bin{' '}
                    <strong className="font-mono">{selectedLocation?.code}</strong>.
                  </li>
                  <li>
                    <strong>{totalAcceptedUnits}</strong> sellable units and{' '}
                    <strong>{totalDamagedUnits}</strong> quarantine units will be registered.
                  </li>
                  <li>
                    Put-away tasks will be automatically generated to route items from dock to storage racks.
                  </li>
                  <li>
                    PO status for <strong className="font-mono">{selectedPO?.poNumber}</strong> will update
                    automatically.
                  </li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-mono text-[10px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Accepted</th>
                      <th className="px-3 py-2 text-right">Damaged</th>
                      <th className="px-3 py-2 text-right">Rejected</th>
                      <th className="px-3 py-2">Lot #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {receivingLines.map((l) => (
                      <tr key={l.purchaseOrderItemId}>
                        <td className="px-3 py-2 font-bold text-slate-900">{l.sku}</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{l.acceptedQty}</td>
                        <td className="px-3 py-2 text-right font-bold text-amber-700">{l.damagedQty}</td>
                        <td className="px-3 py-2 text-right text-rose-700">{l.rejectedQty}</td>
                        <td className="px-3 py-2 text-slate-600">{l.lotNumber || 'Standard'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentStep === 1 || isSubmitting}
              onClick={() => setCurrentStep((prev) => (prev - 1) as WizardStep)}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous Stage
            </Button>

            {currentStep < 5 ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={
                  (currentStep === 1 && !canAdvanceFromStep1) ||
                  (currentStep === 2 && !canAdvanceFromStep2) ||
                  (currentStep === 3 && !canAdvanceFromStep3)
                }
                onClick={() => setCurrentStep((prev) => (prev + 1) as WizardStep)}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Continue to Stage {currentStep + 1}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleConfirmReceipt}
                rightIcon={<Check className="w-3.5 h-3.5" />}
              >
                Confirm Goods Receipt
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Visible Dynamic Summary Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Receipt Manifest Summary
              </span>
              <span className="text-[10px] font-mono text-slate-500">Live Form State</span>
            </div>

            {/* Inbound PO Reference */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-500">Selected Inbound PO</div>
              {selectedPO ? (
                <div>
                  <div className="font-mono font-bold text-slate-900">{selectedPO.poNumber}</div>
                  <div className="text-[11px] text-slate-600 truncate">{selectedPO.supplier?.name}</div>
                </div>
              ) : (
                <div className="text-slate-400 italic">No PO selected yet</div>
              )}
            </div>

            {/* Receiving Dock Location */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1">
              <div className="text-[10px] font-mono uppercase text-slate-500">Destination Dock Bin</div>
              {selectedLocation ? (
                <div className="font-mono font-bold text-blue-700">{selectedLocation.code}</div>
              ) : (
                <div className="text-slate-400 italic">Select dock location</div>
              )}
            </div>

            {/* Quantities Breakdown */}
            <div className="space-y-2 pt-1 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 font-sans">SKU Line Count:</span>
                <span className="font-bold text-slate-900">{skuCount} SKUs</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-500 font-sans">Total Physical Units:</span>
                <span className="font-bold text-slate-900">{formatNumberIN(totalReceivedUnits)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-emerald-700 font-sans">Accepted (Sellable):</span>
                <span className="font-bold text-emerald-700">+{formatNumberIN(totalAcceptedUnits)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-amber-700 font-sans">Damaged (Quarantine):</span>
                <span className="font-bold text-amber-700">+{formatNumberIN(totalDamagedUnits)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-rose-700 font-sans">Rejected (Vendor Return):</span>
                <span className="font-bold text-rose-700">{formatNumberIN(totalRejectedUnits)}</span>
              </div>
            </div>

            {receiptSuccessData && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-md text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Receipt Committed
                </div>
                <div className="text-[11px] font-mono text-emerald-800">
                  Generated Put-Away Task: {receiptSuccessData.putAwayTasks?.length || 1} task(s)
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => navigate('/put-away')}
                >
                  View Put-Away Queue &rarr;
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
