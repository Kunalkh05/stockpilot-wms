import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  DollarSign,
  ShoppingCart,
  CheckSquare,
  Truck,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { DashboardSummary } from '../types/index.js';
import { StatCard } from '../components/common/StatCard.js';
import { Badge } from '../components/common/Badge.js';
import { Button } from '../components/common/Button.js';

export const DashboardPage: React.FC = () => {
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-surface-200 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const { kpi, categoryBreakdown, recentMovements, priorityTasks } = data;

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Operational Overview
          </h1>
          <p className="text-xs text-surface-500">
            Real-time telemetry for {selectedWarehouse ? selectedWarehouse.name : 'All Facilities'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/receiving')}
            leftIcon={<ArrowDownLeft className="w-3.5 h-3.5" />}
          >
            Inbound Dock
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sellable Stock"
          value={kpi.totalSellableUnits.toLocaleString()}
          subtext={`${kpi.totalOnHandUnits.toLocaleString()} physical on hand`}
          icon={Boxes}
          to="/inventory"
        />
        <StatCard
          label="Inventory Valuation"
          value={`$${kpi.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Standard cost basis"
          icon={DollarSign}
          to="/reports"
        />
        <StatCard
          label="Open Fulfillment Orders"
          value={kpi.openOrdersCount}
          subtext={`${kpi.awaitingPickingCount} tasks awaiting pick`}
          icon={ShoppingCart}
          to="/sales-orders"
        />
        <StatCard
          label="Low Stock Exceptions"
          value={kpi.lowStockCount}
          subtext="SKUs at or below reorder threshold"
          icon={AlertTriangle}
          to="/inventory?lowStock=true"
          variant={kpi.lowStockCount > 0 ? 'amber' : 'default'}
        />
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-surface-200 rounded-lg">
          <div className="text-[11px] text-surface-500 uppercase font-mono">PO Inbound Queue</div>
          <div className="text-lg font-bold font-mono text-surface-900 mt-0.5">
            {kpi.receiptsAwaitingProcessingCount} Orders
          </div>
          <Link to="/purchase-orders" className="text-[11px] text-brand-600 hover:underline mt-1 inline-block">
            View PO Queue &rarr;
          </Link>
        </div>

        <div className="p-3 bg-white border border-surface-200 rounded-lg">
          <div className="text-[11px] text-surface-500 uppercase font-mono">Pending Put-Aways</div>
          <div className="text-lg font-bold font-mono text-surface-900 mt-0.5">
            {kpi.pendingPutAwaysCount} Tasks
          </div>
          <Link to="/put-away" className="text-[11px] text-brand-600 hover:underline mt-1 inline-block">
            Execute Put-Aways &rarr;
          </Link>
        </div>

        <div className="p-3 bg-white border border-surface-200 rounded-lg">
          <div className="text-[11px] text-surface-500 uppercase font-mono">Active Reservations</div>
          <div className="text-lg font-bold font-mono text-surface-900 mt-0.5">
            {kpi.totalReservedUnits.toLocaleString()} Units
          </div>
          <span className="text-[11px] text-surface-400 mt-1 inline-block">Locked for orders</span>
        </div>

        <div className="p-3 bg-white border border-surface-200 rounded-lg">
          <div className="text-[11px] text-surface-500 uppercase font-mono">Quarantine / Damaged</div>
          <div className="text-lg font-bold font-mono text-surface-900 mt-0.5">
            {kpi.totalDamagedUnits.toLocaleString()} Units
          </div>
          <span className="text-[11px] text-surface-400 mt-1 inline-block">Non-sellable</span>
        </div>
      </div>

      {/* Two Column Layout: Priority Tasks & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Operational Tasks */}
        <div className="bg-white rounded-lg border border-surface-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-surface-500" />
              <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
                Priority Floor Tasks
              </h2>
            </div>
            <span className="text-[11px] font-mono text-surface-400">
              {priorityTasks.length} Pending
            </span>
          </div>

          <div className="divide-y divide-surface-100">
            {priorityTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-surface-400">
                All floor picking and put-away tasks are up to date.
              </div>
            ) : (
              priorityTasks.map((task) => (
                <div
                  key={task.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-surface-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={task.type === 'PICK' ? 'amber' : 'info'} size="sm">
                      {task.type}
                    </Badge>
                    <div>
                      <div className="text-xs font-medium text-surface-900">{task.title}</div>
                      <div className="text-[11px] text-surface-400">
                        Status: <span className="font-mono">{task.status}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(task.type === 'PICK' ? '/picking' : '/put-away')}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Action
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Ledger Movements */}
        <div className="bg-white rounded-lg border border-surface-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-surface-500" />
              <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
                Recent Stock Movements
              </h2>
            </div>
            <Link to="/movements" className="text-xs text-brand-600 hover:underline">
              Full Ledger &rarr;
            </Link>
          </div>

          <div className="divide-y divide-surface-100">
            {recentMovements.length === 0 ? (
              <div className="p-6 text-center text-xs text-surface-400">
                No recent stock movements recorded.
              </div>
            ) : (
              recentMovements.map((m) => (
                <div key={m.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="neutral" size="sm">
                      {m.referenceType.replace('_', ' ')}
                    </Badge>
                    <div>
                      <span className="font-mono font-medium text-surface-900">{m.product.sku}</span>
                      <span className="text-surface-500 ml-1.5">{m.product.name}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-semibold text-surface-900">
                      +{m.quantity} {m.product.uom}
                    </div>
                    <div className="text-[10px] text-surface-400 font-mono">
                      {m.destinationLocation?.code || 'Outbound'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white rounded-lg border border-surface-200 p-4 shadow-sm">
        <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wider mb-3">
          Inventory Valuation by Category
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {categoryBreakdown.map((cat) => (
            <div key={cat.category} className="p-3 rounded-md bg-surface-50 border border-surface-200">
              <div className="text-xs font-medium text-surface-700 truncate">{cat.category}</div>
              <div className="text-base font-bold font-mono text-surface-900 mt-1">
                ${cat.valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-surface-500 font-mono mt-0.5">
                {cat.units.toLocaleString()} units
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
