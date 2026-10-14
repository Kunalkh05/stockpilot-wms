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
  const path = location.pathname.replace('/', '');
  const pageTitle = path
    ? path.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    : 'Dashboard';

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
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full h-8 px-3 text-xs bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-md text-surface-400 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Search inventory, orders, bins...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-surface-300 rounded text-surface-500 font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Warehouse Facility Switcher & Notifications */}
        <div className="flex items-center gap-3">
          {/* Facility Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowWarehouseMenu(!showWarehouseMenu)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-md text-xs font-medium text-surface-700 transition-colors"
            >
              <WarehouseIcon className="w-3.5 h-3.5 text-brand-600" />
              <span>{selectedWarehouse ? selectedWarehouse.name : 'All Facilities'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
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
