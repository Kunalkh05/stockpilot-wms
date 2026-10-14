import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Warehouse as WarehouseIcon,
  ChevronDown,
  Bell,
  Menu,
  CheckCircle2,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext.js';
import { GlobalSearchDialog } from '../components/common/GlobalSearchDialog.js';

interface HeaderProps {
  onToggleMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const { warehouses, selectedWarehouse, setSelectedWarehouseId } = useWarehouse();
  const [showWarehouseMenu, setShowWarehouseMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  // Generate breadcrumb title
  const path = location.pathname.replace(/^\//, '').split('/')[0];
  const titleMap: Record<string, string> = {
    '': 'Home',
    'dashboard': 'Home',
    'sales-orders': 'Orders',
    'orders': 'Orders',
    'inventory': 'Inventory',
    'receiving': 'Inward Receiving',
    'inward': 'Inward Receiving',
    'picking': 'Outward Picking',
    'outward': 'Outward Picking',
    'packing': 'Packing Station',
    'shipments': 'Dispatches & Shipments',
    'locations': 'Warehouse Locations',
    'reports': 'Reports & Intelligence',
    'purchase-orders': 'Purchase Orders',
    'put-away': 'Put-Away Tasks',
    'returns': 'Customer Returns',
    'movements': 'Stock Movements Ledger',
    'users': 'Users & Access',
    'audit': 'Audit Trail',
    'settings': 'Facility Settings',
  };
  const pageTitle = titleMap[path] || (path.charAt(0).toUpperCase() + path.slice(1));

  return (
    <>
      <header className="h-14 bg-white border-b border-surface-200 px-4 flex items-center justify-between sticky top-0 z-30 select-none">
        {/* Left: Mobile Nav & Breadcrumb Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileNav}
            className="md:hidden p-1.5 rounded text-surface-600 hover:bg-surface-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-surface-400 font-medium hidden sm:inline">StockPilot</span>
            <span className="text-surface-300 hidden sm:inline">/</span>
            <span className="font-semibold text-surface-800 text-sm tracking-tight">{pageTitle}</span>
          </div>
        </div>

        {/* Center: Global Search Bar trigger */}
        <div className="flex-1 max-w-md mx-4 hidden lg:block min-w-0">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full h-8 px-3 text-xs bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-md text-surface-400 flex items-center justify-between transition-colors cursor-pointer overflow-hidden whitespace-nowrap"
          >
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Search inventory, orders, bins...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-surface-300 rounded text-surface-500 font-mono shrink-0 ml-2">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Warehouse Facility Switcher & Notifications */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Search icon button for screens without the full search bar */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-surface-600 hover:bg-surface-100 transition-colors"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Facility Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWarehouseMenu(!showWarehouseMenu)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-md text-xs font-medium text-surface-700 transition-colors max-w-[200px] sm:max-w-xs"
            >
              <WarehouseIcon className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span className="truncate">{selectedWarehouse ? selectedWarehouse.name : 'All Facilities'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-surface-400 shrink-0" />
            </button>

            {showWarehouseMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-surface-200 rounded-lg shadow-xl py-1 z-50 animate-in fade-in-0 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-surface-400 tracking-wider border-b border-surface-100">
                  Select Facility Scope
                </div>
                <button
                  onClick={() => {
                    setSelectedWarehouseId(undefined);
                    setShowWarehouseMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-surface-50 ${
                    !selectedWarehouse ? 'text-brand-600 font-semibold bg-brand-50/50' : 'text-surface-700'
                  }`}
                >
                  <div>
                    <div>All Facilities</div>
                    <div className="text-[10px] text-surface-400">Aggregated network inventory</div>
                  </div>
                  {!selectedWarehouse && <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />}
                </button>

                {warehouses.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWarehouseId(w.id);
                      setShowWarehouseMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-surface-50 ${
                      selectedWarehouse?.id === w.id ? 'text-brand-600 font-semibold bg-brand-50/50' : 'text-surface-700'
                    }`}
                  >
                    <div>
                      <div className="font-mono">{w.code} — {w.name}</div>
                      <div className="text-[10px] text-surface-400">{w.city}, {w.state}</div>
                    </div>
                    {selectedWarehouse?.id === w.id && <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* System Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ONLINE</span>
          </div>
        </div>
      </header>

      {/* Cmd+K Dialog */}
      <GlobalSearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
