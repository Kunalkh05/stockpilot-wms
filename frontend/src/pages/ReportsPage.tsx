import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  AlertTriangle,
  Calendar,
  Layers,
  Download,
  RefreshCw,
  TrendingDown,
  Clock,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { toast } from 'sonner';
import { formatINR, formatNumberIN, formatIST } from '../utils/formatters.js';

type Tab = 'valuation' | 'low-stock' | 'lot-expiry' | 'utilization';

export const ReportsPage: React.FC = () => {
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const [activeTab, setActiveTab] = useState<Tab>('valuation');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      let res: any;
      if (activeTab === 'valuation') {
        res = await api.getValuationReport(selectedWarehouseId);
      } else if (activeTab === 'low-stock') {
        res = await api.getLowStockReport(selectedWarehouseId);
      } else if (activeTab === 'lot-expiry') {
        res = await api.getLotExpiryReport(selectedWarehouseId);
      } else if (activeTab === 'utilization') {
        res = await api.getBinUtilization(selectedWarehouseId);
      }
      setData(res);
    } catch (err) {
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeTab, selectedWarehouseId]);

  const handleExportCsv = () => {
    if (!data) return;
    let csvContent = '';
    let filename = '';

    if (activeTab === 'valuation' && data.items) {
      filename = `stockpilot-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = [
        ['Facility Code', 'Facility Name', 'SKU', 'Item Name', 'Category', 'UOM', 'On Hand', 'Reserved', 'Available', 'Unit Cost (INR)', 'Total Valuation (INR)', 'Margin %'].join(','),
        ...data.items.map((r: any) =>
          [
            `"${r.warehouseCode}"`,
            `"${r.warehouse}"`,
            `"${r.sku}"`,
            `"${r.name?.replace(/"/g, '""') || ''}"`,
            `"${r.category}"`,
            `"${r.uom}"`,
            r.onHand,
            r.reserved,
            r.available,
            r.unitCost.toFixed(2),
            r.totalValuation.toFixed(2),
            r.margin,
          ].join(',')
        ),
      ].join('\n');
    } else if (activeTab === 'low-stock' && data.items) {
      filename = `stockpilot-low-stock-${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = [
        ['Facility', 'SKU', 'Item Name', 'Available Stock', 'Reorder Threshold', 'Target Stock', 'Reorder Deficit', 'Unit Cost (INR)', 'Est. Reorder Cost (INR)'].join(','),
        ...data.items.map((r: any) =>
          [
            `"${r.warehouse}"`,
            `"${r.sku}"`,
            `"${r.name?.replace(/"/g, '""') || ''}"`,
            r.available,
            r.minReorderPoint,
            r.targetStock,
            r.reorderDeficit,
            r.unitCost.toFixed(2),
            r.estimatedReorderCost.toFixed(2),
          ].join(',')
        ),
      ].join('\n');
    } else if (activeTab === 'lot-expiry' && data.items) {
      filename = `stockpilot-lot-expiry-${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = [
        ['Lot Number', 'SKU', 'Item Name', 'Expiration Date (IST)', 'Days Remaining', 'FEFO Status', 'Lot Quantity'].join(','),
        ...data.items.map((r: any) =>
          [
            `"${r.lotNumber}"`,
            `"${r.sku}"`,
            `"${r.productName?.replace(/"/g, '""') || ''}"`,
            `"${r.expiryDate ? formatIST(r.expiryDate, false) : 'N/A'}"`,
            r.daysRemaining ?? 'N/A',
            `"${r.fefoStatus}"`,
            r.quantity,
          ].join(',')
        ),
      ].join('\n');
    } else if (activeTab === 'utilization' && data.locations) {
      filename = `stockpilot-utilization-${new Date().toISOString().slice(0, 10)}.csv`;
      csvContent = [
        ['Facility', 'Location Code', 'Zone', 'Type', 'Max Units', 'Current Units', 'Occupancy %', 'Status'].join(','),
        ...data.locations.map((r: any) =>
          [
            `"${r.warehouseCode}"`,
            `"${r.code}"`,
            `"${r.zone}"`,
            `"${r.type}"`,
            r.maxCapacity,
            r.currentOccupancy,
            r.occupancyPercentage,
            `"${r.status}"`,
          ].join(',')
        ),
      ].join('\n');
    }

    if (!csvContent) {
      toast.error('No tabular data available for export');
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success(`Exported ${filename}`);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
              Operational Reports & Intelligence
            </h1>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {selectedWarehouse ? selectedWarehouse.name : 'All Facilities'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Audit-ready valuation in INR (₹), replenishment deficits, FEFO lot aging, and space utilization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadReport} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Recalculate
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('valuation')}
          className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition-colors ${
            activeTab === 'valuation'
              ? 'border-blue-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Inventory Valuation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('low-stock')}
          className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition-colors ${
            activeTab === 'low-stock'
              ? 'border-blue-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low-Stock & Reorder Deficits</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lot-expiry')}
          className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition-colors ${
            activeTab === 'lot-expiry'
              ? 'border-blue-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Lot Aging & FEFO Expiry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('utilization')}
          className={`flex items-center gap-2 px-3.5 py-2 border-b-2 transition-colors ${
            activeTab === 'utilization'
              ? 'border-blue-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Bin Space Utilization</span>
        </button>
      </div>

      {/* TAB 1: Valuation */}
      {activeTab === 'valuation' && (
        <div className="space-y-4">
          {isLoading || !data ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading valuation metrics...</div>
          ) : (
            <>
              {/* Valuation KPI Card */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-mono uppercase font-bold text-slate-500">
                    Total Network Inventory Asset Valuation
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {formatINR(data.totalValuation)}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Standard FIFO/Weighted acquisition cost basis • {data.totalItems} active SKUs
                  </div>
                </div>

                {/* Category breakdown bar if data has items */}
                {data.items && data.items.length > 0 && (() => {
                  const catMap: Record<string, number> = {};
                  data.items.forEach((it: any) => {
                    catMap[it.category] = (catMap[it.category] || 0) + it.totalValuation;
                  });
                  const total = data.totalValuation || 1;
                  const catList = Object.entries(catMap).map(([name, val]) => ({
                    name,
                    val,
                    pct: Math.round((val / total) * 100),
                  }));

                  return (
                    <div className="w-full sm:w-80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                        <span>Category Asset Spread</span>
                        <span>100% Capital</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        {catList.map((c, i) => (
                          <div
                            key={c.name}
                            title={`${c.name}: ${formatINR(c.val)} (${c.pct}%)`}
                            className={`h-full transition-all ${
                              i % 3 === 0 ? 'bg-blue-600' : i % 3 === 1 ? 'bg-indigo-500' : 'bg-slate-700'
                            }`}
                            style={{ width: `${c.pct}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 font-mono">
                        {catList.slice(0, 3).map((c, i) => (
                          <span key={c.name} className="flex items-center gap-1">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                i % 3 === 0 ? 'bg-blue-600' : i % 3 === 1 ? 'bg-indigo-500' : 'bg-slate-700'
                              }`}
                            />
                            {c.name} ({c.pct}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Exact Tabular Values */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">SKU</th>
                      <th className="px-4 py-2.5">Product Title</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5 text-right">Physical On Hand</th>
                      <th className="px-4 py-2.5 text-right">Unit Cost</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-900">Total Valuation</th>
                      <th className="px-4 py-2.5 text-right">Gross Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {data.items?.map((r: any) => (
                      <tr key={`${r.warehouseCode}-${r.sku}`} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{r.sku}</td>
                        <td className="px-4 py-2.5 text-slate-900 truncate max-w-xs">{r.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{r.category}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {formatNumberIN(r.onHand)} {r.uom}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                          {formatINR(r.unitCost)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(r.totalValuation)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-semibold tabular-nums">
                          {r.margin}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Low-Stock & Reorder Deficits */}
      {activeTab === 'low-stock' && (
        <div className="space-y-4">
          {isLoading || !data ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading deficit metrics...</div>
          ) : (
            <>
              {/* Deficit Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Deficit SKUs</div>
                  <div className="text-xl font-bold font-mono text-amber-700 mt-1 tabular-nums">
                    {data.totalLowStockItems || 0} Items
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Below reorder threshold</div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Total Deficit Quantity</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {formatNumberIN(data.totalUnitsDeficit || 0)} Units
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Required to reach par stock</div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-lg shadow-xs">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Est. Reorder Procurement Cost</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {formatINR(data.totalEstimatedCost || 0)}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Standard cost replenishment basis</div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">SKU</th>
                      <th className="px-4 py-2.5">Product Title</th>
                      <th className="px-4 py-2.5 text-right font-bold text-amber-700">Available</th>
                      <th className="px-4 py-2.5 text-right">Min Threshold</th>
                      <th className="px-4 py-2.5 text-right">Target Stock</th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-900">Reorder Deficit</th>
                      <th className="px-4 py-2.5 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {data.items?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No items currently in stock deficit. All inventory is above minimum reorder points.
                        </td>
                      </tr>
                    ) : (
                      data.items?.map((r: any) => (
                        <tr key={r.sku} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{r.sku}</td>
                          <td className="px-4 py-2.5 text-slate-900 truncate max-w-xs">{r.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-700 tabular-nums">
                            {r.available}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                            {r.minReorderPoint}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                            {r.targetStock}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            +{r.reorderDeficit}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatINR(r.estimatedReorderCost)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Lot Expiry */}
      {activeTab === 'lot-expiry' && (
        <div className="space-y-4">
          {isLoading || !data ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading lot aging data...</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Lot #</th>
                    <th className="px-4 py-2.5">SKU / Item</th>
                    <th className="px-4 py-2.5">Expiration Date (IST)</th>
                    <th className="px-4 py-2.5 text-right">Days Remaining</th>
                    <th className="px-4 py-2.5">FEFO Status</th>
                    <th className="px-4 py-2.5 text-right">Lot Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {data.items?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No batch or lot records tracked for this warehouse.
                      </td>
                    </tr>
                  ) : (
                    data.items?.map((r: any) => (
                      <tr key={r.lotId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{r.lotNumber}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-semibold text-slate-900">{r.sku}</span>
                          <span className="text-slate-500 ml-1.5 truncate max-w-xs">{r.productName}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">
                          {r.expiryDate ? formatIST(r.expiryDate, false) : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {r.daysRemaining !== null ? `${r.daysRemaining} days` : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={
                              r.fefoStatus === 'EXPIRED'
                                ? 'danger'
                                : r.fefoStatus === 'NEAR_EXPIRY'
                                ? 'amber'
                                : 'success'
                            }
                            size="sm"
                          >
                            {r.fefoStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {r.quantity}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Utilization */}
      {activeTab === 'utilization' && (
        <div className="space-y-4">
          {isLoading || !data ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading utilization data...</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Location Code</th>
                    <th className="px-4 py-2.5">Zone</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Max Capacity</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-900">Current Units</th>
                    <th className="px-4 py-2.5 w-40">Occupancy %</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {data.locations?.map((l: any) => {
                    const pct = l.occupancyPercentage || 0;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{l.code}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{l.zone}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{l.type}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{l.maxCapacity}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {l.currentOccupancy}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                              <div
                                className={`h-full rounded-full ${
                                  pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-slate-700 w-8 text-right tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={l.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                            {l.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
