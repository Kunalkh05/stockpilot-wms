import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Eye, Search, Download } from 'lucide-react';
import { api } from '../services/api.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { formatIST } from '../utils/formatters.js';
import { toast } from 'sonner';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.listAuditLogs({
        action: actionFilter || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const handleExportCsv = () => {
    if (logs.length === 0) {
      toast.error('No audit records to export');
      return;
    }
    const filename = `stockpilot-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    const headers = ['Timestamp', 'Action', 'Entity', 'Entity ID', 'User', 'Role', 'IP Address'];
    const rows = logs.map((l) => [
      `"${new Date(l.createdAt).toISOString()}"`,
      `"${l.action}"`,
      `"${l.entity}"`,
      `"${l.entityId || ''}"`,
      `"${l.user?.fullName?.replace(/"/g, '""') || 'System'}"`,
      `"${l.user?.role || 'N/A'}"`,
      `"${l.ipAddress || ''}"`,
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
            System Security & Compliance Audit Log
          </h1>
          <p className="text-xs text-surface-500">
            Immutable chronological audit trail of authentication events and critical state mutations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadLogs} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh Trail
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="p-3 bg-white border border-surface-200 rounded-lg flex items-center justify-between shadow-sm">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-700 font-mono"
        >
          <option value="">All Action Types</option>
          <option value="AUTH_LOGIN">AUTH_LOGIN</option>
          <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
          <option value="STOCK_TRANSFER">STOCK_TRANSFER</option>
          <option value="PO_RECEIPT">PO_RECEIPT</option>
          <option value="SO_ALLOCATED">SO_ALLOCATED</option>
          <option value="SO_DISPATCHED">SO_DISPATCHED</option>
          <option value="RMA_INSPECTED">RMA_INSPECTED</option>
          <option value="USER_CREATED">USER_CREATED</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-2.5">Timestamp</th>
              <th className="px-4 py-2.5">Action Code</th>
              <th className="px-4 py-2.5">Target Entity</th>
              <th className="px-4 py-2.5">Entity ID</th>
              <th className="px-4 py-2.5">Executing User</th>
              <th className="px-4 py-2.5 text-center">Payload Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 font-sans">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-surface-400">
                  No audit log entries recorded.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-50/70 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-surface-500 text-[11px] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="neutral" size="sm">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-surface-700">{log.entityType}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-surface-500 truncate max-w-xs">
                    {log.entityId}
                  </td>
                  <td className="px-4 py-2.5">
                    {log.user ? (
                      <span className="font-medium text-surface-900">
                        {log.user.fullName} ({log.user.role})
                      </span>
                    ) : (
                      <span className="text-surface-400 italic">System Automation</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1 rounded text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
                      title="Inspect payload json"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* JSON Viewer Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Payload Inspection"
        description="Raw JSON telemetry captured at execution"
      >
        {selectedLog && (
          <div className="space-y-3 font-mono text-xs">
            <div className="p-2.5 bg-surface-100 rounded text-surface-800 space-y-1 text-[11px]">
              <div>Action: {selectedLog.action}</div>
              <div>Entity: {selectedLog.entityType} ({selectedLog.entityId})</div>
              <div>User: {selectedLog.user?.email || 'N/A'}</div>
              <div>Timestamp: {selectedLog.createdAt}</div>
            </div>

            <div>
              <div className="font-semibold text-surface-600 mb-1 text-[10px] uppercase">
                Details JSON:
              </div>
              <pre className="p-3 bg-surface-900 text-surface-100 rounded text-[11px] overflow-x-auto max-h-60">
                {selectedLog.detailsJson
                  ? JSON.stringify(JSON.parse(selectedLog.detailsJson), null, 2)
                  : 'No additional details captured'}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-surface-200">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
