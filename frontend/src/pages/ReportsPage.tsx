import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  AlertTriangle,
  Calendar,
  Layers,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { api } from '../services/api.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { toast } from 'sonner';

type Tab = 'valuation' | 'low-stock' | 'lot-expiry' | 'utilization';

export const ReportsPage: React.FC = () => {
  const { selectedWarehouseId } = useWarehouse();
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
        ['Facility Code', 'Facility Name', 'SKU', 'Item Name', 'Category', 'UOM', 'On Hand', 'Reserved', 'Available', 'Unit Cost ($)', 'Total Valuation ($)', 'Margin %'].join(','),
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
        ['Facility', 'SKU', 'Item Name', 'Available Stock', 'Reorder Threshold', 'Target Stock', 'Reorder Deficit', 'Unit Cost ($)', 'Est. Reorder Cost ($)'].join(','),
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
        ['Lot Number', 'SKU', 'Item Name', 'Expiration Date', 'Days Remaining', 'FEFO Status', 'Lot Quantity'].join(','),
        ...data.items.map((r: any) =>
          [
            `"${r.lotNumber}"`,
            `"${r.sku}"`,
            `"${r.productName?.replace(/"/g, '""') || ''}"`,
            `"${r.expiryDate ? new Date(r.expiryDate).toISOString().slice(0, 10) : 'N/A'}"`,
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Operational Intelligence & Analytics
          </h1>
          <p className="text-xs text-surface-500">
            Audit-ready valuation, inventory aging, reorder deficits, and facility capacity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReport}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Recalculate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-200 gap-1">
        <button
          onClick={() => setActiveTab('valuation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'valuation'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Inventory Valuation</span>
        </button>

        <button
          onClick={() => setActiveTab('low-stock')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'low-stock'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low-Stock & Reorder</span>
        </button>

        <button
          onClick={() => setActiveTab('lot-expiry')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'lot-expiry'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Lot Aging & FEFO Expiry</span>
        </button>

        <button
          onClick={() => setActiveTab('utilization')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'utilization'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Bin Space Utilization</span>
        </button>
      </div>

      {/* Report Content */}
      {isLoading || !data ? (
        <div className="p-12 text-center text-xs text-surface-400">Computing real-time report...</div>
      ) : activeTab === 'valuation' ? (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-surface-200 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-xs text-surface-500 uppercase font-mono">Total Asset Valuation</div>
              <div className="text-2xl font-bold font-mono text-surface-900 mt-0.5">
                ${data.totalValuation?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-right text-xs text-surface-500">
              {data.totalItems} Active Stock-Keeping Units
            </div>
          </div>

          <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Facility</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Item Name</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 text-right">Physical On Hand</th>
                  <th className="px-4 py-2.5 text-right">Unit Cost</th>
                  <th className="px-4 py-2.5 text-right font-bold text-surface-900">Total Valuation</th>
                  <th className="px-4 py-2.5 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.items?.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-surface-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-surface-600">{row.warehouseCode}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-surface-900">{row.sku}</td>
                    <td className="px-4 py-2.5 text-surface-700">{row.name}</td>
                    <td className="px-4 py-2.5 text-surface-500">{row.category}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">{row.onHand} {row.uom}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-600">${row.unitCost.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-surface-900">${row.totalValuation.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{row.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'low-stock' ? (
        <div className="space-y-4">
          <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Facility</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Item Name</th>
                  <th className="px-4 py-2.5 text-right">Available Stock</th>
                  <th className="px-4 py-2.5 text-right">Reorder Threshold</th>
                  <th className="px-4 py-2.5 text-right">Target Level</th>
                  <th className="px-4 py-2.5 text-right text-rose-700 font-bold">Deficit Qty</th>
                  <th className="px-4 py-2.5 text-right">Est. Reorder Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.items?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-surface-400">
                      All items are safely above minimum reorder points.
                    </td>
                  </tr>
                ) : (
                  data.items?.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-50/70 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-surface-700">{row.warehouse}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-surface-900">{row.sku}</td>
                      <td className="px-4 py-2.5 text-surface-700">{row.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-600">{row.available}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-surface-600">{row.minReorderPoint}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-surface-600">{row.targetStock}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-black text-rose-700">+{row.reorderDeficit}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">${row.estimatedReorderCost.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'lot-expiry' ? (
        <div className="space-y-4">
          <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Lot / Batch #</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Item Name</th>
                  <th className="px-4 py-2.5">Expiration Date</th>
                  <th className="px-4 py-2.5 text-center">Days Remaining</th>
                  <th className="px-4 py-2.5">FEFO Status</th>
                  <th className="px-4 py-2.5 text-right">Lot Quantity</th>
                  <th className="px-4 py-2.5">Locations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.items?.map((lot: any, idx: number) => (
                  <tr key={idx} className="hover:bg-surface-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-surface-900">{lot.lotNumber}</td>
                    <td className="px-4 py-2.5 font-mono text-surface-700">{lot.sku}</td>
                    <td className="px-4 py-2.5 text-surface-600">{lot.productName}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-surface-600">
                      {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold">
                      {lot.daysRemaining !== null ? (
                        <span className={lot.daysRemaining <= 0 ? 'text-rose-600' : lot.daysRemaining <= 30 ? 'text-amber-600' : 'text-emerald-700'}>
                          {lot.daysRemaining <= 0 ? `Expired (${Math.abs(lot.daysRemaining)}d ago)` : `${lot.daysRemaining} days`}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={lot.status === 'EXPIRED' ? 'danger' : lot.status === 'EXPIRING_SOON' ? 'amber' : 'success'}
                        size="sm"
                      >
                        {lot.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-surface-900">{lot.totalQuantity}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-surface-500">{lot.locations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-surface-200 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-xs text-surface-500 uppercase font-mono">Average Bin Utilization</div>
              <div className="text-2xl font-bold font-mono text-surface-900 mt-0.5">
                {data.averageUtilization}%
              </div>
            </div>
            <div className="text-xs text-surface-500 font-mono">
              {data.totalLocations} Mapped Bins
            </div>
          </div>

          <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Bin Code</th>
                  <th className="px-4 py-2.5">Zone & Hierarchy</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Stored Units</th>
                  <th className="px-4 py-2.5 text-right">Capacity</th>
                  <th className="px-4 py-2.5 w-48">Occupancy Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.items?.map((loc: any) => (
                  <tr key={loc.id} className="hover:bg-surface-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-surface-900">{loc.code}</td>
                    <td className="px-4 py-2.5 text-surface-500 font-mono text-[11px]">
                      Zone {loc.zone} &bull; Aisle {loc.aisle} &bull; Rack {loc.rack}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      <Badge variant="neutral" size="sm">{loc.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{loc.currentUnits}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-500">{loc.capacityUnits}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              loc.utilizationPercent > 80 ? 'bg-rose-500' : loc.utilizationPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, loc.utilizationPercent)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] w-8 text-right text-surface-600">
                          {loc.utilizationPercent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
