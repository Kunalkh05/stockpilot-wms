import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Filter, ArrowRight, Download } from 'lucide-react';
import { api } from '../services/api.js';
import { StockMovement, MovementType } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { SearchInput } from '../components/common/SearchInput.js';
import { Badge } from '../components/common/Badge.js';
import { formatIST, formatNumberIN } from '../utils/formatters.js';
import { toast } from 'sonner';

export const MovementsPage: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const data = await api.listMovements({
        referenceId: search || undefined,
        referenceType: (typeFilter as MovementType) || undefined,
        limit: 100,
      });
      setMovements(data);
    } catch (err) {
      toast.error('Failed to load stock movements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadMovements();
  };

  const handleExportCsv = () => {
    if (movements.length === 0) {
      toast.error('No movement records to export');
      return;
    }
    const filename = `stockpilot-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = [
      'Timestamp',
      'Movement Type',
      'Reference ID',
      'SKU',
      'Product Name',
      'Source Bin',
      'Destination Bin',
      'Quantity',
      'Balance Before',
      'Balance After',
      'Operator',
      'Reason',
    ];
    const rows = movements.map((m) => [
      `"${new Date(m.createdAt).toISOString()}"`,
      `"${m.referenceType}"`,
      `"${m.referenceId || ''}"`,
      `"${m.product.sku}"`,
      `"${m.product.name.replace(/"/g, '""')}"`,
      `"${m.sourceLocation?.code || 'None'}"`,
      `"${m.destinationLocation?.code || 'None'}"`,
      m.quantity,
      m.balanceBefore,
      m.balanceAfter,
      `"${m.user?.fullName?.replace(/"/g, '""') || 'System'}"`,
      `"${m.reason?.replace(/"/g, '""') || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-surface-200">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Stock Movement Audit Ledger
          </h1>
          <p className="text-xs text-surface-500">
            Immutable transaction records: receipts, transfers, picks, adjustments, and shipments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMovements}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Ledger
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

      {/* Filter Bar */}
      <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
        <form onSubmit={handleSearch} className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search Reference # (PO, SO, TRF, ADJ)..."
          />
        </form>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-700"
        >
          <option value="">All Movement Types</option>
          <option value="PURCHASE_RECEIPT">Purchase Receipt (Dock)</option>
          <option value="PUTAWAY">Put-Away (Dock &rarr; Storage)</option>
          <option value="ORDER_PICK">Order Pick</option>
          <option value="ORDER_SHIP">Order Ship (Relief)</option>
          <option value="TRANSFER">Internal Transfer</option>
          <option value="CYCLE_COUNT_ADJUSTMENT">Cycle Count Adjustment</option>
          <option value="RETURN_RESTOCK">Customer Return Restock</option>
          <option value="DAMAGE_WRITE_OFF">Damage / Quarantine</option>
        </select>
      </div>

      {/* Movements Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-2.5">Timestamp</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Reference ID</th>
              <th className="px-4 py-2.5">SKU & Item</th>
              <th className="px-4 py-2.5 text-center">Bin Routing</th>
              <th className="px-4 py-2.5 text-right">Quantity</th>
              <th className="px-4 py-2.5 text-right">Balance Change</th>
              <th className="px-4 py-2.5">Operative / Audit Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 font-sans">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                  Loading movement transactions...
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                  No stock movements found.
                </td>
              </tr>
            ) : (
              movements.map((m) => (
                <tr key={m.id} className="hover:bg-surface-50/70 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-surface-500 text-[11px] whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={
                        m.referenceType === 'ORDER_SHIP'
                          ? 'success'
                          : m.referenceType === 'PURCHASE_RECEIPT'
                          ? 'info'
                          : m.referenceType === 'CYCLE_COUNT_ADJUSTMENT'
                          ? 'amber'
                          : m.referenceType === 'DAMAGE_WRITE_OFF'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {m.referenceType.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono font-medium text-surface-800">
                    {m.referenceId}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-bold text-surface-900">{m.product.sku}</span>
                    <span className="text-surface-500 ml-1.5 text-[11px] truncate max-w-xs block">
                      {m.product.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-[11px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-surface-500">{m.sourceLocation?.code || 'Inbound'}</span>
                      <ArrowRight className="w-3 h-3 text-surface-400" />
                      <span className="text-surface-900 font-semibold">
                        {m.destinationLocation?.code || 'Outbound'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-surface-900">
                    {m.quantity} {m.product.uom}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[11px]">
                    <span className="text-surface-400">{m.balanceBefore}</span>
                    <span className="text-surface-400 mx-1">&rarr;</span>
                    <span className="font-semibold text-surface-800">{m.balanceAfter}</span>
                  </td>
                  <td className="px-4 py-2.5 text-surface-600 text-[11px]">
                    <div>{m.reason || 'Standard Warehouse Transaction'}</div>
                    {m.user && (
                      <div className="text-[10px] text-surface-400 font-mono">
                        by {m.user.fullName} ({m.user.role})
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
