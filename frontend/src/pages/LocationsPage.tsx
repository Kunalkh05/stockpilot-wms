import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Box,
  Layers,
  CheckCircle2,
  Lock,
  Eye,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Location, LocationType, LocationStatus } from '../types/index.js';
import { Button } from '../components/common/Button.js';
import { SearchInput } from '../components/common/SearchInput.js';
import { Badge } from '../components/common/Badge.js';
import { Modal } from '../components/common/Modal.js';
import { toast } from 'sonner';
import { formatNumberIN } from '../utils/formatters.js';

export const LocationsPage: React.FC = () => {
  const { selectedWarehouseId, selectedWarehouse, warehouses, setSelectedWarehouseId } = useWarehouse();
  const { hasRole } = useAuth();

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Location Inspection & Config Modal
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [editStatus, setEditStatus] = useState<LocationStatus>('ACTIVE');
  const [editCapacity, setEditCapacity] = useState<number>(1000);
  const [isUpdating, setIsUpdating] = useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [zone, setZone] = useState('ZA');
  const [aisle, setAisle] = useState('01');
  const [rack, setRack] = useState('01');
  const [shelf, setShelf] = useState('1');
  const [bin, setBin] = useState('01');
  const [locType, setLocType] = useState<LocationType>('STORAGE');
  const [locStatus, setLocStatus] = useState<LocationStatus>('ACTIVE');
  const [capacityUnits, setCapacityUnits] = useState(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadLocations = async () => {
    if (!selectedWarehouseId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.listLocations(selectedWarehouseId, {
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setLocations(data);
    } catch (err) {
      toast.error('Failed to load warehouse locations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, [selectedWarehouseId, typeFilter, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId) return;
    setIsSubmitting(true);
    try {
      await api.createLocation(selectedWarehouseId, {
        zone,
        aisle,
        rack,
        shelf,
        bin,
        type: locType,
        status: locStatus,
        capacityUnits,
      });
      toast.success('Warehouse location created');
      setIsCreateOpen(false);
      loadLocations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !selectedWarehouseId) return;
    setIsUpdating(true);
    try {
      await api.updateLocation(selectedWarehouseId, selectedLocation.id, {
        status: editStatus,
        capacityUnits: editCapacity,
      });
      toast.success(`Bin ${selectedLocation.code} updated successfully`);
      setSelectedLocation(null);
      loadLocations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update location');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">
            Warehouse Locations & Bins
          </h1>
          <p className="text-xs text-surface-500">
            Hierarchical mapping and capacity tracking for {selectedWarehouse?.name || 'facility'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadLocations}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          {hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Location Bin
            </Button>
          )}
        </div>
      </div>

      {!selectedWarehouseId ? (
        <div className="p-8 bg-white border border-surface-200 rounded-lg text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-bold text-surface-900">Select a Warehouse Facility</h3>
            <p className="text-xs text-surface-500 mt-1">
              Bin topologies and physical rack allocations are scoped to individual facilities. Choose a warehouse below to view and configure its zone and aisle bins:
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {warehouses.map((w) => (
              <Button
                key={w.id}
                variant="outline"
                size="sm"
                onClick={() => setSelectedWarehouseId(w.id)}
              >
                {w.code} — {w.name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="p-3 bg-white border border-surface-200 rounded-lg flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="Search code, zone, aisle..."
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-700"
          >
            <option value="">All Types</option>
            <option value="RECEIVING">Receiving Dock</option>
            <option value="STORAGE">Bulk Storage</option>
            <option value="PICKING">Forward Picking</option>
            <option value="PACKING">Packing Station</option>
            <option value="SHIPPING">Shipping Staging</option>
            <option value="QUARANTINE">Quarantine Bay</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs bg-white border border-surface-300 rounded-md text-surface-700"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="LOCKED">Locked</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Locations Grid / Table */}
      <div className="bg-white border border-surface-200 rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-surface-50 border-b border-surface-200 text-surface-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-2.5">Bin Code</th>
              <th className="px-4 py-2.5">Zone & Hierarchy</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Stored Units</th>
              <th className="px-4 py-2.5 text-right">Capacity</th>
              <th className="px-4 py-2.5 w-36">Utilization</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 font-sans">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                  Loading warehouse bins...
                </td>
              </tr>
            ) : locations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-surface-400">
                  No locations found matching the criteria.
                </td>
              </tr>
            ) : (
              locations.map((loc) => {
                const util = loc.utilizationPercent || 0;
                return (
                  <tr
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocation(loc);
                      setEditStatus(loc.status);
                      setEditCapacity(loc.capacityUnits);
                    }}
                    className="hover:bg-surface-50/80 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono font-bold text-surface-900">
                      {loc.code}
                    </td>
                    <td className="px-4 py-2.5 text-surface-600 font-mono text-[11px]">
                      Zone {loc.zone} &bull; Aisle {loc.aisle} &bull; Rack {loc.rack} &bull; Shelf {loc.shelf} &bull; Bin {loc.bin}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          loc.type === 'RECEIVING'
                            ? 'info'
                            : loc.type === 'QUARANTINE'
                            ? 'danger'
                            : loc.type === 'PICKING'
                            ? 'amber'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {loc.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                          loc.status === 'ACTIVE'
                            ? 'text-emerald-700 font-medium'
                            : 'text-amber-700'
                        }`}
                      >
                        {loc.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Lock className="w-3 h-3 text-amber-500" />
                        )}
                        {loc.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium tabular-nums">
                      {formatNumberIN(loc.occupancyUnits || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-surface-500 tabular-nums">
                      {formatNumberIN(loc.capacityUnits)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              util > 85 ? 'bg-rose-500' : util > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, util)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] w-8 text-right text-surface-500">
                          {util}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLocation(loc);
                          setEditStatus(loc.status);
                          setEditCapacity(loc.capacityUnits);
                        }}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

        </>
      )}

      {/* Add Location Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Warehouse Location Bin"
        description="Creates a new indexed physical storage address"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Zone Identifier
              </label>
              <input
                type="text"
                required
                value={zone}
                onChange={(e) => setZone(e.target.value.toUpperCase())}
                placeholder="e.g. ZA, ZB, INB"
                className="w-full h-8 px-2.5 text-xs border border-surface-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Aisle Number
              </label>
              <input
                type="text"
                required
                value={aisle}
                onChange={(e) => setAisle(e.target.value)}
                placeholder="e.g. 01, 02"
                className="w-full h-8 px-2.5 text-xs border border-surface-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Rack
              </label>
              <input
                type="text"
                required
                value={rack}
                onChange={(e) => setRack(e.target.value)}
                placeholder="01"
                className="w-full h-8 px-2.5 text-xs border border-surface-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Shelf
              </label>
              <input
                type="text"
                required
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                placeholder="1"
                className="w-full h-8 px-2.5 text-xs border border-surface-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Bin
              </label>
              <input
                type="text"
                required
                value={bin}
                onChange={(e) => setBin(e.target.value)}
                placeholder="01"
                className="w-full h-8 px-2.5 text-xs border border-surface-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Location Type
              </label>
              <select
                value={locType}
                onChange={(e) => setLocType(e.target.value as LocationType)}
                className="w-full h-8 px-2 text-xs border border-surface-300 rounded"
              >
                <option value="STORAGE">Storage</option>
                <option value="PICKING">Forward Pick</option>
                <option value="RECEIVING">Receiving Dock</option>
                <option value="PACKING">Packing Station</option>
                <option value="SHIPPING">Shipping Bay</option>
                <option value="QUARANTINE">Quarantine</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                Capacity (Units)
              </label>
              <input
                type="number"
                min={1}
                value={capacityUnits}
                onChange={(e) => setCapacityUnits(parseInt(e.target.value, 10) || 500)}
                className="w-full h-8 px-2.5 text-xs border border-surface-300 rounded font-mono"
              />
            </div>
          </div>

          <div className="p-2.5 bg-surface-50 border border-surface-200 rounded text-xs font-mono text-surface-600">
            Computed Bin Code: <span className="font-bold text-surface-900">{zone}-{aisle}-{rack}-{shelf}-{bin}</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Create Bin
            </Button>
          </div>
        </form>
      </Modal>

      {/* Location Details & Inventory Inspection Modal */}
      <Modal
        isOpen={Boolean(selectedLocation)}
        onClose={() => setSelectedLocation(null)}
        title={selectedLocation ? `Location Bin: ${selectedLocation.code}` : 'Location Details'}
        description="Physical storage address configuration and current on-hand contents"
        maxWidth="2xl"
      >
        {selectedLocation && (
          <div className="space-y-4">
            {/* Bin Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-surface-50 border border-surface-200 rounded">
                <span className="text-surface-500 font-mono text-[10px] block uppercase">Coordinate</span>
                <span className="font-semibold text-surface-900 font-mono mt-0.5 block">
                  Z:{selectedLocation.zone} A:{selectedLocation.aisle} R:{selectedLocation.rack} S:{selectedLocation.shelf} B:{selectedLocation.bin}
                </span>
              </div>
              <div className="p-2.5 bg-surface-50 border border-surface-200 rounded">
                <span className="text-surface-500 font-mono text-[10px] block uppercase">Location Type</span>
                <span className="font-semibold text-surface-900 mt-0.5 block">
                  {selectedLocation.type}
                </span>
              </div>
              <div className="p-2.5 bg-surface-50 border border-surface-200 rounded">
                <span className="text-surface-500 font-mono text-[10px] block uppercase">Current Status</span>
                <span className="font-semibold text-surface-900 mt-0.5 block">
                  {selectedLocation.status}
                </span>
              </div>
              <div className="p-2.5 bg-surface-50 border border-surface-200 rounded">
                <span className="text-surface-500 font-mono text-[10px] block uppercase">Barcode Tag</span>
                <span className="font-mono text-surface-700 text-[11px] mt-0.5 block">
                  {selectedLocation.barcode || `LOC-${selectedLocation.code}`}
                </span>
              </div>
            </div>

            {/* Capacity Meter */}
            <div className="p-3 bg-surface-50 border border-surface-200 rounded space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-surface-600">Storage Utilization:</span>
                <span className="font-bold text-surface-900 tabular-nums">
                  {formatNumberIN(selectedLocation.occupancyUnits || 0)} / {formatNumberIN(selectedLocation.capacityUnits)} units (
                  {selectedLocation.utilizationPercent || 0}%)
                </span>
              </div>
              <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    (selectedLocation.utilizationPercent || 0) > 85
                      ? 'bg-rose-500'
                      : (selectedLocation.utilizationPercent || 0) > 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, selectedLocation.utilizationPercent || 0)}%` }}
                />
              </div>
            </div>

            {/* Currently Stored Items Table */}
            <div>
              <div className="text-xs font-bold text-surface-900 uppercase font-mono mb-2 flex items-center justify-between">
                <span>Stored SKUs in Bin</span>
                <span className="text-surface-500 font-normal">
                  {(selectedLocation.inventoryBalances || []).length} SKU(s)
                </span>
              </div>

              <div className="border border-surface-200 rounded overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50 text-surface-500 uppercase font-mono text-[10px] border-b border-surface-200">
                    <tr>
                      <th className="px-3 py-1.5">Product SKU</th>
                      <th className="px-3 py-1.5">Product Name</th>
                      <th className="px-3 py-1.5 text-right">On-Hand</th>
                      <th className="px-3 py-1.5 text-right">Reserved</th>
                      <th className="px-3 py-1.5 text-right">Available</th>
                      <th className="px-3 py-1.5 text-right">Damaged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 font-mono">
                    {(!selectedLocation.inventoryBalances || selectedLocation.inventoryBalances.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-surface-400 font-sans">
                          No inventory balances currently assigned to this bin.
                        </td>
                      </tr>
                    ) : (
                      selectedLocation.inventoryBalances.map((bal) => (
                        <tr key={bal.id} className="hover:bg-surface-50">
                          <td className="px-3 py-2 font-bold text-surface-900">
                            {bal.product?.sku}
                          </td>
                          <td className="px-3 py-2 text-surface-700 font-sans truncate max-w-xs">
                            {bal.product?.name}
                          </td>
                          <td className="px-3 py-2 text-right text-surface-900 font-bold tabular-nums">
                            {formatNumberIN(bal.onHand)}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-700 tabular-nums">
                            {formatNumberIN(bal.reserved)}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-bold tabular-nums">
                            {formatNumberIN(bal.available ?? (bal.onHand - bal.reserved - bal.damaged))}
                          </td>
                          <td className="px-3 py-2 text-right text-rose-700 tabular-nums">
                            {formatNumberIN(bal.damaged)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bin Configuration Form */}
            {hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
              <form onSubmit={handleUpdate} className="pt-3 border-t border-surface-200 space-y-3">
                <div className="text-xs font-bold text-surface-900 uppercase font-mono">
                  Modify Bin Configuration
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                      Operating Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as LocationStatus)}
                      className="w-full h-8 px-2 text-xs border border-surface-300 rounded bg-white"
                    >
                      <option value="ACTIVE">Active (Available for Put-Away/Storage)</option>
                      <option value="LOCKED">Locked (Cycle Count / Quarantine)</option>
                      <option value="MAINTENANCE">Maintenance (Offline)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-surface-700 uppercase mb-1">
                      Max Unit Capacity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editCapacity}
                      onChange={(e) => setEditCapacity(parseInt(e.target.value, 10) || 100)}
                      className="w-full h-8 px-2 text-xs border border-surface-300 rounded font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-200">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLocation(null)}>
                    Close
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isUpdating}>
                    Save Bin Configuration
                  </Button>
                </div>
              </form>
            )}

            {!hasRole('ADMIN', 'WAREHOUSE_MANAGER') && (
              <div className="flex items-center justify-end pt-2 border-t border-surface-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLocation(null)}>
                  Close
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

