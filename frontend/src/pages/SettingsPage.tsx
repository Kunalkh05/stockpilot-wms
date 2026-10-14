import React, { useState, useEffect } from 'react';
import { Settings, Warehouse as WarehouseIcon, ShieldCheck, CheckCircle2, Server, Database } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Role } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { Badge } from '../components/common/Badge.js';
import { toast } from 'sonner';
import { formatIST } from '../utils/formatters.js';

export const SettingsPage: React.FC = () => {
  const { warehouses, selectedWarehouse } = useWarehouse();
  const { user, switchDemoRole } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const checkHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch('/api/v1/health');
      const json = await res.json();
      setHealth(json);
      toast.success('System API and PostgreSQL health verified');
    } catch (err) {
      toast.error('Health check failed');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-surface-900 tracking-tight">
          Facility Settings & Diagnostics
        </h1>
        <p className="text-xs text-surface-500">
          Warehouse infrastructure configuration and operational status
        </p>
      </div>

      {/* Facility Network Section */}
      <div className="bg-white border border-surface-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-surface-200">
          <WarehouseIcon className="w-4 h-4 text-brand-600" />
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
            Operational Facilities
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {warehouses.map((w) => (
            <div
              key={w.id}
              className={`p-4 rounded-lg border text-xs space-y-1 ${
                selectedWarehouse?.id === w.id
                  ? 'border-brand-500 bg-brand-50/20'
                  : 'border-surface-200 bg-surface-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-surface-900">{w.code}</span>
                {w.isDefault && <Badge variant="info" size="sm">Primary Default</Badge>}
              </div>
              <div className="font-semibold text-surface-800 text-sm">{w.name}</div>
              <div className="text-surface-500">{w.address}</div>
              <div className="text-surface-500 font-mono text-[11px]">{w.city}, {w.state} {w.postalCode}</div>
            </div>
          ))}
        </div>
      </div>

      {/* System Diagnostics & Health */}
      <div className="bg-white border border-surface-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-surface-200">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
              Backend API & Database Telemetry
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={checkHealth} isLoading={isLoadingHealth}>
            Re-test Health
          </Button>
        </div>

        {health && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-surface-50 rounded border border-surface-200">
              <span className="text-[10px] text-surface-400 font-mono uppercase block">API Status</span>
              <span className="font-mono font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {health.status}
              </span>
            </div>

            <div className="p-3 bg-surface-50 rounded border border-surface-200">
              <span className="text-[10px] text-surface-400 font-mono uppercase block">PostgreSQL</span>
              <span className="font-mono font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                <Database className="w-3.5 h-3.5" />
                {health.database}
              </span>
            </div>

            <div className="p-3 bg-surface-50 rounded border border-surface-200">
              <span className="text-[10px] text-surface-400 font-mono uppercase block">Release Version</span>
              <span className="font-mono font-bold text-surface-800 mt-0.5 block">{health.version}</span>
            </div>

            <div className="p-3 bg-surface-50 rounded border border-surface-200">
              <span className="text-[10px] text-surface-400 font-mono uppercase block">System Clock (IST)</span>
              <span className="font-mono text-[11px] text-surface-600 truncate mt-0.5 block">
                {formatIST(health.timestamp)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Role Testing Quick Matrix */}
      <div className="bg-white border border-surface-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-surface-200">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
            RBAC Testing Persona Switcher
          </h2>
        </div>

        <p className="text-xs text-surface-600">
          Current logged-in identity: <span className="font-bold text-surface-900">{user?.fullName}</span> ({user?.role})
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {(
            [
              ['ADMIN', 'admin@stockpilot.io', 'Admin (Superuser)'],
              ['WAREHOUSE_MANAGER', 'manager@stockpilot.io', 'Warehouse Manager'],
              ['INVENTORY_SPECIALIST', 'inventory@stockpilot.io', 'Inventory Specialist'],
              ['PICKER_PACKER', 'picker@stockpilot.io', 'Picker / Packer'],
              ['RECEIVING_CLERK', 'receiving@stockpilot.io', 'Receiving Clerk'],
            ] as Array<[Role, string, string]>
          ).map(([r, em, label]) => (
            <button
              key={r}
              onClick={async () => {
                await switchDemoRole(r);
                toast.success(`Switched active role to ${r}`);
              }}
              className={`p-3 rounded border text-left transition-colors ${
                user?.role === r
                  ? 'border-brand-500 bg-brand-50/40 font-semibold text-brand-900'
                  : 'border-surface-200 hover:bg-surface-50 text-surface-700'
              }`}
            >
              <div className="font-medium">{label}</div>
              <div className="text-[10px] text-surface-400 font-mono">{em}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
