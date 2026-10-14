import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle2, RefreshCw, ArrowRight } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { PutAwayTask, Location } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';

export const PutAwayPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
  const [tasks, setTasks] = useState<PutAwayTask[]>([]);
  const [storageLocations, setStorageLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Execution Modal
  const [selectedTask, setSelectedTask] = useState<PutAwayTask | null>(null);
  const [confirmedLocationId, setConfirmedLocationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const [taskRes, locRes] = await Promise.all([
        api.listPutAwayTasks({
          warehouseId: selectedWarehouseId,
          status: 'PENDING',
        }),
        selectedWarehouseId ? api.listLocations(selectedWarehouseId, { type: 'STORAGE' }) : [],
      ]);
      setTasks(taskRes);
      setStorageLocations(locRes);
    } catch (err) {
      toast.error('Failed to load put-away tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [selectedWarehouseId]);

  const openExecute = (task: PutAwayTask) => {
    setSelectedTask(task);
    setConfirmedLocationId(task.suggestedLocationId);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !confirmedLocationId) return;

    setIsSubmitting(true);
    try {
      await api.completePutAway(selectedTask.id, confirmedLocationId);
      toast.success(`Put-Away ${selectedTask.taskNumber} completed! Stock relocated to storage.`);
      setSelectedTask(null);
      loadTasks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete put-away task');
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
            Put-Away Task Execution
          </h1>
          <p className="text-xs text-surface-500">
            Relocate received goods from inbound docks to permanent storage bins
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

      {/* Task Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-2.5">Task #</th>
              <th className="px-4 py-2.5">SKU & Item</th>
              <th className="px-4 py-2.5 text-right">Units</th>
              <th className="px-4 py-2.5">Dock Source</th>
              <th className="px-4 py-2.5">Suggested Bin</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                  Loading put-away tasks...
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <EmptyState
                    icon={ClipboardList}
                    title="No Pending Put-Away Tasks"
                    description="All received goods have been put away into permanent storage locations."
                  />
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-surface-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-surface-900">
                    {task.taskNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-surface-900">
                      {task.product.sku}
                    </div>
                    <div className="text-[11px] text-surface-500 truncate max-w-xs">
                      {task.product.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-surface-900">
                    {task.quantity} {task.product.uom}
                  </td>
                  <td className="px-4 py-3 font-mono text-surface-600">
                    <span className="px-1.5 py-0.5 rounded bg-surface-100 border border-surface-200 text-[11px]">
                      {task.sourceLocation?.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-brand-700 font-medium">
                    <span className="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-200 text-[11px]">
                      {task.suggestedLocation?.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="amber" size="sm">
                      {task.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openExecute(task)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Put Away
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title="Confirm Put-Away Execution"
        description="Verify physically stored location to update warehouse inventory"
      >
        {selectedTask && (
          <form onSubmit={handleComplete} className="space-y-4">
            <div className="p-3 rounded bg-surface-50 border border-surface-200 text-xs space-y-1 font-mono">
              <div>
                <span className="text-surface-400">Task:</span>{' '}
                <span className="font-bold text-surface-900">{selectedTask.taskNumber}</span>
              </div>
              <div>
                <span className="text-surface-400">Product:</span>{' '}
                <span>{selectedTask.product.sku} — {selectedTask.product.name}</span>
              </div>
              <div>
                <span className="text-surface-400">Quantity:</span>{' '}
                <span className="font-bold text-emerald-700">{selectedTask.quantity} {selectedTask.product.uom}</span>
              </div>
              <div>
                <span className="text-surface-400">Source Dock:</span>{' '}
                <span>{selectedTask.sourceLocation?.code}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Confirmed Destination Storage Bin
              </label>
              <select
                required
                value={confirmedLocationId}
                onChange={(e) => setConfirmedLocationId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-surface-300 rounded font-mono text-surface-900 focus:ring-2 focus:ring-brand-500"
              >
                {storageLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} ({loc.type} - Zone {loc.zone})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedTask(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Confirm Physical Placement
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
