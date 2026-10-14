import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  AlertCircle,
  RefreshCw,
  Check,
  ArrowRight,
  PackageCheck,
  Truck,
  MapPin,
  Clock,
  Layers,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { PickTask, PickTaskItem } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';
import { formatNumberIN, formatIST, formatRelativeTime } from '../utils/formatters.js';

export const PickingPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const navigate = useNavigate();

  const [pickTasks, setPickTasks] = useState<PickTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pick Item Modal
  const [activeTask, setActiveTask] = useState<PickTask | null>(null);
  const [activeItem, setActiveItem] = useState<PickTaskItem | null>(null);
  const [pickedQty, setPickedQty] = useState<number>(0);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const tasks = await api.listPickTasks({
        warehouseId: selectedWarehouseId,
        status: 'PENDING',
      });
      setPickTasks(tasks);
    } catch (err) {
      toast.error('Failed to load pick tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [selectedWarehouseId]);

  const openPickItem = (task: PickTask, item: PickTaskItem) => {
    setActiveTask(task);
    setActiveItem(item);
    setPickedQty(item.targetQty);
    setDiscrepancyReason('');
  };

  const handleConfirmPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !activeItem) return;

    setIsSubmitting(true);
    try {
      await api.confirmPickItem(activeTask.id, activeItem.id, {
        pickedQty,
        discrepancyReason: discrepancyReason || undefined,
      });

      toast.success(`Picked line confirmed for ${activeItem.product.sku}`);
      setActiveItem(null);
      setActiveTask(null);
      loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Pick confirmation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real aggregate line stats
  const totalTasks = pickTasks.length;
  const allItems = pickTasks.flatMap((t) => t.items);
  const totalLines = allItems.length;
  const completedLines = allItems.filter((i) => i.pickedQty >= i.targetQty).length;
  const progressPercent = totalLines > 0 ? Math.round((completedLines / totalLines) * 100) : 0;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Outward Fulfillment — Picking Station</h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {totalTasks} Active Task{totalTasks === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Floor pick lists with prominent bin location guidance, discrepancy logging, and packing handover
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTasks} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/packing')}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            Go to Packing Station
          </Button>
        </div>
      </div>

      {/* Outward Guided Stages Pipeline Bar */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono">
        <div className="flex items-center gap-2 p-2 rounded-md bg-white border border-slate-300 text-slate-900 font-bold shadow-xs">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
            1
          </div>
          <span className="truncate">Stage 1: Floor Picking (Active)</span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/packing')}
          className="flex items-center gap-2 p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors text-left"
        >
          <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px]">
            2
          </div>
          <span className="truncate">Stage 2: Carton Packing</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/shipments')}
          className="flex items-center gap-2 p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors text-left"
        >
          <div className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px]">
            3
          </div>
          <span className="truncate">Stage 3: Carrier Dispatch</span>
        </button>
      </div>

      {/* Real Line Progress Overview Strip */}
      {totalLines > 0 && (
        <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500 font-mono text-[11px] uppercase">Picking Progress:</span>{' '}
              <strong className="font-mono text-slate-900">
                {completedLines} of {totalLines} lines confirmed ({progressPercent}%)
              </strong>
            </div>
          </div>

          <div className="w-full sm:w-64 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Pick Task Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading picking tasks...</div>
      ) : pickTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="All Floor Pick Tasks Complete"
          description="There are currently no sales orders awaiting picking in this warehouse facility."
        />
      ) : (
        <div className="space-y-4">
          {pickTasks.map((task) => {
            const taskLines = task.items;
            const taskCompleted = taskLines.filter((i) => i.pickedQty >= i.targetQty).length;
            const isAllPicked = taskLines.length > 0 && taskCompleted === taskLines.length;

            return (
              <div
                key={task.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs"
              >
                {/* Task Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {task.taskNumber}
                    </span>
                    <span className="text-xs text-slate-600">
                      Order: <strong className="font-mono text-slate-900">{task.salesOrder.orderNumber}</strong> ({task.salesOrder.customer.name})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500">
                      Progress: <strong>{taskCompleted} / {taskLines.length} Lines</strong>
                    </span>
                    <Badge variant={task.status === 'SHORT_PICKED' ? 'warning' : 'amber'} size="sm">
                      {task.status}
                    </Badge>
                  </div>
                </div>

                {/* Items List in this pick task */}
                <div className="divide-y divide-slate-100">
                  {taskLines.map((item) => {
                    const isPicked = item.pickedQty >= item.targetQty;

                    return (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Prominent Bin Display */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 px-3 bg-blue-50 border border-blue-200 rounded-md font-mono font-bold text-blue-900 text-xs shrink-0 flex items-center gap-1.5 shadow-xs">
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            <span>{item.location?.code || 'UNASSIGNED'}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="font-mono font-bold text-slate-900 text-xs flex items-center gap-2">
                              <span>{item.product.sku}</span>
                              {item.lot && (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  (Lot: {item.lot.lotNumber})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate max-w-sm">
                              {item.product.name}
                            </div>
                          </div>
                        </div>

                        {/* Quantity and Actions */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right font-mono text-xs">
                            <div className="text-slate-500">
                              Target:{' '}
                              <strong className="text-slate-900 tabular-nums font-bold">
                                {item.targetQty} {item.product.uom}
                              </strong>
                            </div>
                            {item.pickedQty > 0 ? (
                              <div className="text-[11px] text-emerald-700 font-bold tabular-nums">
                                Picked: {item.pickedQty} units
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400">Not yet collected</div>
                            )}
                          </div>

                          <Button
                            variant={isPicked ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() => openPickItem(task, item)}
                            leftIcon={isPicked ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : undefined}
                          >
                            {isPicked ? 'Update' : 'Confirm Pick'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Handover when task is complete */}
                {isAllPicked && (
                  <div className="px-4 py-2.5 bg-emerald-50/70 border-t border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      All items picked for {task.salesOrder.orderNumber}. Ready for carton packing.
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/packing')}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Handover to Packing Station
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Pick Line Modal */}
      <Modal
        isOpen={Boolean(activeItem)}
        onClose={() => setActiveItem(null)}
        title="Confirm Floor Pick Line"
        description="Verify physically collected units from designated storage bin"
      >
        {activeItem && (
          <form onSubmit={handleConfirmPick} className="space-y-4 text-xs">
            {/* Prominent Bin Target in modal */}
            <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 space-y-1 font-mono">
              <div className="text-[10px] uppercase font-bold text-blue-700">Source Storage Bin</div>
              <div className="text-base font-bold text-blue-950 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>{activeItem.location?.code}</span>
              </div>
              <div className="text-[11px] text-blue-800 pt-1">
                Item: <strong>{activeItem.product.sku}</strong> — {activeItem.product.name}
              </div>
              <div className="text-[11px] text-blue-800">
                Target Allocation: <strong>{activeItem.targetQty} {activeItem.product.uom}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Actual Physical Quantity Picked *
              </label>
              <input
                type="number"
                min={0}
                max={activeItem.targetQty}
                required
                value={pickedQty}
                onChange={(e) => setPickedQty(parseInt(e.target.value, 10) || 0)}
                className="w-full h-9 px-3 text-sm border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
              />
            </div>

            {pickedQty < activeItem.targetQty && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                <label className="block text-xs font-semibold text-amber-900 uppercase">
                  Discrepancy / Short-Pick Reason (Required) *
                </label>
                <input
                  type="text"
                  required
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  placeholder="e.g., Physical count shortage, damaged packaging in bin"
                  className="w-full h-8 px-2.5 text-xs border border-amber-300 rounded text-slate-900 bg-white"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveItem(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Confirm Line Pick
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
