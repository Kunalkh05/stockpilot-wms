import React, { useState, useEffect } from 'react';
import { CheckSquare, AlertCircle, RefreshCw, Check, ArrowRight } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { PickTask, PickTaskItem } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';

export const PickingPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Warehouse Picking Station
          </h1>
          <p className="text-xs text-surface-500">
            Bin-sequenced pick lists with item-level discrepancy handling
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadTasks}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Pick Task Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-surface-400">Loading pick tasks...</div>
      ) : pickTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="All Pick Tasks Complete"
          description="There are no active orders waiting to be picked in this facility."
        />
      ) : (
        <div className="space-y-4">
          {pickTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm"
            >
              <div className="px-4 py-3 bg-surface-50/80 border-b border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-surface-900 text-sm">
                    {task.taskNumber}
                  </span>
                  <span className="text-xs text-surface-500">
                    Order: <span className="font-mono font-medium">{task.salesOrder.orderNumber}</span> ({task.salesOrder.customer.name})
                  </span>
                </div>
                <Badge variant={task.status === 'SHORT_PICKED' ? 'warning' : 'amber'} size="sm">
                  {task.status}
                </Badge>
              </div>

              {/* Items List in this pick task */}
              <div className="divide-y divide-surface-100">
                {task.items.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-1 bg-surface-100 border border-surface-200 rounded font-mono font-bold text-surface-800 text-xs">
                        {item.location?.code}
                      </div>
                      <div>
                        <div className="font-mono font-semibold text-surface-900 text-xs">
                          {item.product.sku}
                        </div>
                        <div className="text-[11px] text-surface-500">{item.product.name}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono text-xs">
                          Target: <span className="font-bold">{item.targetQty}</span> {item.product.uom}
                        </div>
                        {item.pickedQty > 0 && (
                          <div className="text-[11px] text-emerald-700 font-mono">
                            Picked: {item.pickedQty}
                          </div>
                        )}
                      </div>

                      <Button
                        variant={item.pickedQty >= item.targetQty ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => openPickItem(task, item)}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                      >
                        {item.pickedQty > 0 ? 'Update Pick' : 'Pick Line'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Pick Line Modal */}
      <Modal
        isOpen={Boolean(activeItem)}
        onClose={() => setActiveItem(null)}
        title="Confirm Floor Pick Line"
        description="Verify physically collected units from bin"
      >
        {activeItem && (
          <form onSubmit={handleConfirmPick} className="space-y-4">
            <div className="p-3 rounded bg-surface-50 border border-surface-200 text-xs space-y-1 font-mono">
              <div>
                <span className="text-surface-400">SKU:</span>{' '}
                <span className="font-bold">{activeItem.product.sku}</span>
              </div>
              <div>
                <span className="text-surface-400">Bin Location:</span>{' '}
                <span className="font-bold text-brand-600">{activeItem.location?.code}</span>
              </div>
              <div>
                <span className="text-surface-400">Target Qty:</span>{' '}
                <span className="font-bold">{activeItem.targetQty}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Actual Quantity Picked
              </label>
              <input
                type="number"
                min={0}
                max={activeItem.targetQty}
                required
                value={pickedQty}
                onChange={(e) => setPickedQty(parseInt(e.target.value, 10) || 0)}
                className="w-full h-9 px-3 text-xs border border-surface-300 rounded font-mono text-surface-900"
              />
            </div>

            {pickedQty < activeItem.targetQty && (
              <div>
                <label className="block text-xs font-semibold text-amber-800 uppercase mb-1">
                  Discrepancy / Short-Pick Reason
                </label>
                <input
                  type="text"
                  required
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  placeholder="e.g. Bin empty, physical count shortage of 2 units"
                  className="w-full h-9 px-3 text-xs border border-amber-300 rounded text-surface-900"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
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
