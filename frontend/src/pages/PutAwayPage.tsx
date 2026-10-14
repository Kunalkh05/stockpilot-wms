import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, RefreshCw, ArrowRight, ArrowDownLeft, ArrowLeft } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { PutAwayTask, Location } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { toast } from 'sonner';
import { formatNumberIN } from '../utils/formatters.js';

export const PutAwayPage: React.FC = () => {
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const navigate = useNavigate();
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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
              Put-Away Task Execution
            </h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {selectedWarehouse ? selectedWarehouse.name : 'All Facilities'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Relocate received goods from inbound docks to permanent storage bins
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/receiving')}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Back to Goods Receipt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTasks}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Inward Pipeline Stage Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-xs text-xs">
        <button
          type="button"
          onClick={() => navigate('/receiving')}
          className="flex items-center justify-between p-2.5 rounded border border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <div className="font-semibold text-slate-800">Inbound Goods Receipt</div>
              <div className="text-[11px] text-slate-500">PO verification, discrepancy & QC inspection</div>
            </div>
          </div>
          <ArrowDownLeft className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        <div className="flex items-center justify-between p-2.5 rounded border border-blue-500/40 bg-blue-50/20 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <div className="font-semibold text-blue-950 flex items-center gap-1.5">
                Put-Away to Storage
                <Badge variant="info" size="sm">Active Stage</Badge>
              </div>
              <div className="text-[11px] text-blue-800">Dock-to-bin transfer & inventory ledger balance update</div>
            </div>
          </div>
          <ClipboardList className="w-4 h-4 text-blue-600 shrink-0" />
        </div>
      </div>

      {/* Task Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-xs">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
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
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
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
                    actionLabel="Go to Goods Receipt"
                    onAction={() => navigate('/receiving')}
                  />
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">
                    {task.taskNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-900">
                      {task.product.sku}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">
                      {task.product.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatNumberIN(task.quantity)} <span className="text-[11px] font-normal text-slate-500">{task.product.uom}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      {task.sourceLocation?.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-blue-700 font-medium">
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px]">
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
            <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs space-y-1 font-mono">
              <div>
                <span className="text-slate-400">Task:</span>{' '}
                <span className="font-bold text-slate-900">{selectedTask.taskNumber}</span>
              </div>
              <div>
                <span className="text-slate-400">Product:</span>{' '}
                <span>{selectedTask.product.sku} — {selectedTask.product.name}</span>
              </div>
              <div>
                <span className="text-slate-400">Quantity:</span>{' '}
                <span className="font-bold text-emerald-700 tabular-nums">{formatNumberIN(selectedTask.quantity)} {selectedTask.product.uom}</span>
              </div>
              <div>
                <span className="text-slate-400">Source Dock:</span>{' '}
                <span>{selectedTask.sourceLocation?.code}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Confirmed Destination Storage Bin
              </label>
              <select
                required
                value={confirmedLocationId}
                onChange={(e) => setConfirmedLocationId(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                {storageLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} ({loc.type} - Zone {loc.zone})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
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

