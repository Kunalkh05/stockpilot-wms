import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  PackageCheck,
  Truck,
  TrendingUp,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { DashboardSummary } from '../types/index.js';
import { Badge } from '../components/common/Badge.js';
import { Button } from '../components/common/Button.js';
import { formatNumberIN, formatIST, formatRelativeTime } from '../utils/formatters.js';

export const DashboardPage: React.FC = () => {
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'PICK' | 'PUTAWAY'>('ALL');
  const navigate = useNavigate();

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDashboard(selectedWarehouseId);
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedWarehouseId]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-slate-200 rounded-md" />
          <div className="h-72 bg-slate-200 rounded-md" />
        </div>
      </div>
    );
  }

  const { kpi, recentMovements, priorityTasks, orderStages, movementTrends7Days } = data;

  const inwardPendingCount = (kpi.receiptsAwaitingProcessingCount || 0) + (kpi.pendingPutAwaysCount || 0);
  const filteredTasks = priorityTasks.filter((t) => taskFilter === 'ALL' || t.type === taskFilter);

  // Order stage pipeline data
  const stages = [
    { key: 'PENDING', label: 'New Orders', count: orderStages?.PENDING ?? 0, color: 'bg-amber-500' },
    { key: 'ALLOCATED', label: 'Stock Allocated', count: orderStages?.ALLOCATED ?? 0, color: 'bg-blue-500' },
    { key: 'PICKING', label: 'In Picking', count: orderStages?.PICKING ?? 0, color: 'bg-indigo-500' },
    { key: 'PACKED', label: 'Packed & Staged', count: orderStages?.PACKED ?? 0, color: 'bg-purple-500' },
    { key: 'SHIPPED', label: 'Dispatched', count: orderStages?.SHIPPED ?? 0, color: 'bg-emerald-500' },
  ];
  const maxStageCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Today at the Warehouse</h1>
            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {selectedWarehouse ? `${selectedWarehouse.code} • ${selectedWarehouse.city}` : 'All Facilities'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Operational work queues, dispatch status, and stock exceptions requiring action
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/receiving')}
            leftIcon={<ArrowDownLeft className="w-3.5 h-3.5" />}
          >
            Receive Inbound
          </Button>
        </div>
      </div>

      {/* Top Strip: Strictly <=4 Compact Clickable Operational Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Orders to Process */}
        <button
          type="button"
          onClick={() => navigate('/sales-orders')}
          className="group text-left p-3.5 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Orders to Process</span>
            <ShoppingCart className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {formatNumberIN(kpi.openOrdersCount)}
            </span>
            <span className="text-[11px] text-slate-600 font-medium">orders pending</span>
          </div>
          <div className="mt-1 text-[11px] text-blue-600 group-hover:underline flex items-center gap-0.5">
            <span>View order queue</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </button>

        {/* Metric 2: Inward Pending */}
        <button
          type="button"
          onClick={() => navigate('/receiving')}
          className="group text-left p-3.5 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Inward Pending</span>
            <ArrowDownLeft className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {formatNumberIN(inwardPendingCount)}
            </span>
            <span className="text-[11px] text-slate-600 font-medium">
              {kpi.receiptsAwaitingProcessingCount} POs • {kpi.pendingPutAwaysCount} put-aways
            </span>
          </div>
          <div className="mt-1 text-[11px] text-blue-600 group-hover:underline flex items-center gap-0.5">
            <span>Open receiving dock</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </button>

        {/* Metric 3: Outward Pending */}
        <button
          type="button"
          onClick={() => navigate('/picking')}
          className="group text-left p-3.5 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Outward Pending</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {formatNumberIN(kpi.awaitingPickingCount)}
            </span>
            <span className="text-[11px] text-slate-600 font-medium">tasks awaiting pick</span>
          </div>
          <div className="mt-1 text-[11px] text-blue-600 group-hover:underline flex items-center gap-0.5">
            <span>Open picking station</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </button>

        {/* Metric 4: Low-Stock Items */}
        <button
          type="button"
          onClick={() => navigate('/inventory?filter=low-stock')}
          className={`group text-left p-3.5 bg-white border rounded-lg transition-all hover:shadow-sm ${
            kpi.lowStockCount > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Low-Stock Items</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                kpi.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'
              } group-hover:text-amber-700 transition-colors`}
            />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
                kpi.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {formatNumberIN(kpi.lowStockCount)}
            </span>
            <span className="text-[11px] text-slate-600 font-medium">SKUs at threshold</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700 group-hover:underline flex items-center gap-0.5">
            <span>Review reorder alerts</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </button>
      </div>

      {/* Deliberate Two-Column Composition at Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Column (8 cols): Floor Work Queue */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-500" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Floor Work Queue
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-200 text-slate-700">
                  {priorityTasks.length}
                </span>
              </div>

              {/* Task Filter Tabs */}
              <div className="flex items-center gap-1 text-xs">
                {(['ALL', 'PICK', 'PUTAWAY'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTaskFilter(mode)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      taskFilter === mode
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {mode === 'ALL' ? 'All' : mode === 'PICK' ? 'Picking' : 'Put-Away'}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700">No pending floor tasks</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    All pick and put-away tasks are up to date for this facility.
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`mt-0.5 shrink-0 px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${
                          task.type === 'PICK'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {task.type}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-900 truncate">{task.title}</div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatRelativeTime(task.createdAt)}
                          </span>
                          <span>•</span>
                          <span className="font-mono">Status: {task.status}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(task.type === 'PICK' ? '/picking' : '/put-away')}
                      rightIcon={<ArrowRight className="w-3 h-3" />}
                    >
                      {task.type === 'PICK' ? 'Pick' : 'Store'}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operational Figure: Fulfillment Pipeline Stage Distribution */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Outbound Order Fulfillment Pipeline
                </h3>
              </div>
              <span className="text-[11px] text-slate-600 font-mono">
                {kpi.openOrdersCount} active sales orders
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {stages.map((stage) => {
                const pct = Math.round((stage.count / maxStageCount) * 100);
                return (
                  <div key={stage.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium">{stage.label}</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {stage.count} {stage.count === 1 ? 'order' : 'orders'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stage.color} rounded-full transition-all duration-300`}
                        style={{ width: `${Math.max(pct, stage.count > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Secondary Column (4-5 cols): Needs Attention */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Needs Attention
              </h2>
            </div>

            <div className="mt-3 space-y-3">
              {/* Alert 1: Low-stock SKU Deficits */}
              {kpi.lowStockCount > 0 ? (
                <div className="p-3 rounded-md bg-amber-50/60 border border-amber-200 text-xs">
                  <div className="flex items-center justify-between font-semibold text-amber-900">
                    <span>Low Stock Deficit</span>
                    <span className="font-mono bg-amber-200/80 px-1.5 py-0.5 rounded text-[10px]">
                      {kpi.lowStockCount} SKUs
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-1">
                    Items are at or below minimum threshold. Reorder is recommended to prevent stockouts.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/inventory?filter=low-stock')}
                    className="mt-2 text-[11px] font-semibold text-amber-900 underline hover:text-amber-950 inline-flex items-center gap-1"
                  >
                    Inspect Low Stock SKUs &rarr;
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  No critical stock deficits. All SKUs are above reorder thresholds.
                </div>
              )}

              {/* Alert 2: Inbound POs Awaiting Receipt */}
              {kpi.receiptsAwaitingProcessingCount > 0 && (
                <div className="p-3 rounded-md bg-blue-50/60 border border-blue-200 text-xs">
                  <div className="flex items-center justify-between font-semibold text-blue-900">
                    <span>Inbound PO Receipts</span>
                    <span className="font-mono bg-blue-200/80 px-1.5 py-0.5 rounded text-[10px]">
                      {kpi.receiptsAwaitingProcessingCount} Orders
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 mt-1">
                    Approved purchase orders are pending receiving at the dock.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/purchase-orders')}
                    className="mt-2 text-[11px] font-semibold text-blue-900 underline hover:text-blue-950 inline-flex items-center gap-1"
                  >
                    View Purchase Orders &rarr;
                  </button>
                </div>
              )}

              {/* Alert 3: Active Reservations & Damaged Stock */}
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Committed Reservations:</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatNumberIN(kpi.totalReservedUnits)} units
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span className="text-slate-500">Quarantine / Damaged:</span>
                  <span className="font-mono font-bold text-rose-600 tabular-nums">
                    {formatNumberIN(kpi.totalDamagedUnits)} units
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Sellable Available:</span>
                  <span className="font-mono font-bold text-emerald-600 tabular-nums">
                    {formatNumberIN(kpi.totalSellableUnits)} units
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Real Operational Figure: 7-Day Inbound vs Outbound Movements */}
          {movementTrends7Days && movementTrends7Days.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    7-Day Stock Activity
                  </h3>
                </div>
                <span className="text-[10px] text-slate-600 font-mono">Units / Day</span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-2 h-28 pt-2">
                {movementTrends7Days.map((trend) => {
                  const maxDay = Math.max(
                    ...movementTrends7Days.map((t) => Math.max(t.inboundUnits, t.outboundUnits)),
                    10
                  );
                  const inPct = Math.min(100, Math.round((trend.inboundUnits / maxDay) * 100));
                  const outPct = Math.min(100, Math.round((trend.outboundUnits / maxDay) * 100));
                  const dayLabel = new Date(trend.date).toLocaleDateString('en-IN', {
                    weekday: 'narrow',
                  });

                  return (
                    <div key={trend.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div className="w-full flex items-end justify-center gap-0.5 h-20">
                        <div
                          title={`Inbound: ${trend.inboundUnits} units`}
                          className="w-2.5 bg-blue-500 rounded-t transition-all hover:opacity-80"
                          style={{ height: `${Math.max(inPct, 4)}%` }}
                        />
                        <div
                          title={`Outbound: ${trend.outboundUnits} units`}
                          className="w-2.5 bg-slate-700 rounded-t transition-all hover:opacity-80"
                          style={{ height: `${Math.max(outPct, 4)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />
                  <span>Inbound (Receipts)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-slate-700 inline-block" />
                  <span>Outbound (Dispatches)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Stock Movement Ledger */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent Stock Movements
            </h2>
          </div>
          <Link to="/movements" className="text-xs text-blue-600 hover:underline font-medium">
            Full Audit Ledger &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-[11px] uppercase font-mono tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2">Movement Type</th>
                <th className="px-4 py-2">Product / SKU</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2">Source / Destination</th>
                <th className="px-4 py-2">Operator</th>
                <th className="px-4 py-2 text-right">Time (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-600">
                    No recent inventory transactions recorded.
                  </td>
                </tr>
              ) : (
                recentMovements.slice(0, 6).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {m.referenceType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-mono font-semibold text-slate-900">{m.product.sku}</div>
                      <div className="text-[11px] text-slate-600 truncate max-w-xs">{m.product.name}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                      +{m.quantity}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                      {m.destinationLocation?.code || m.sourceLocation?.code || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-[120px]">
                      {m.user?.fullName || 'System'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatIST(m.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
