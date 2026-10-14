import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  MapPin,
  BarChart3,
  FileText,
  ClipboardList,
  PackageCheck,
  Truck,
  RotateCcw,
  History,
  Users,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Warehouse as WarehouseIcon,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Role } from '../types/index.js';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { user, logout, switchDemoRole, hasRole } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(true);

  // Core High-Frequency Navigation
  const primaryNav = [
    { label: 'Home', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Orders', to: '/sales-orders', icon: ShoppingCart },
    { label: 'Inventory', to: '/inventory', icon: Boxes },
    { label: 'Inward', to: '/receiving', icon: ArrowDownLeft },
    { label: 'Outward', to: '/picking', icon: ArrowUpRight },
    { label: 'Locations', to: '/locations', icon: MapPin },
    { label: 'Reports', to: '/reports', icon: BarChart3 },
  ];

  // Secondary Administration & Workflow Modules
  const secondaryNav = [
    { label: 'Purchase Orders', to: '/purchase-orders', icon: FileText },
    { label: 'Put-Away Tasks', to: '/put-away', icon: ClipboardList },
    { label: 'Packing Station', to: '/packing', icon: PackageCheck },
    { label: 'Dispatches', to: '/shipments', icon: Truck },
    { label: 'Customer Returns', to: '/returns', icon: RotateCcw },
    { label: 'Stock Movements', to: '/movements', icon: History },
    ...(hasRole('ADMIN', 'WAREHOUSE_MANAGER')
      ? [
          { label: 'Users & Access', to: '/users', icon: Users },
          { label: 'Audit Trail', to: '/audit', icon: ShieldCheck },
        ]
      : []),
    { label: 'Facility Settings', to: '/settings', icon: Settings },
  ];

  const demoRoles: Array<{ label: string; role: Role }> = [
    { label: 'Admin (Full Access)', role: 'ADMIN' },
    { label: 'Warehouse Manager', role: 'WAREHOUSE_MANAGER' },
    { label: 'Inventory Specialist', role: 'INVENTORY_SPECIALIST' },
    { label: 'Picker / Packer', role: 'PICKER_PACKER' },
    { label: 'Receiving Clerk', role: 'RECEIVING_CLERK' },
  ];

  return (
    <aside
      className={`relative flex flex-col bg-slate-900 text-slate-200 border-r border-slate-800 transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold tracking-wider shadow-sm text-sm">
              SP
            </div>
            <div>
              <div className="font-semibold text-sm text-white tracking-tight leading-tight">StockPilot</div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider">WMS • INDIA</div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            SP
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Core Primary Navigation */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
              Operations
            </div>
          )}
          {primaryNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } ${collapsed ? 'justify-center px-0' : ''}`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Secondary Administration & Deep Workflows */}
        <div className="pt-2 border-t border-slate-800/80">
          {!collapsed ? (
            <div>
              <button
                type="button"
                onClick={() => setShowAdminMenu(!showAdminMenu)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 hover:text-slate-200 uppercase font-mono transition-colors"
              >
                <span>Administration & More</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showAdminMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {showAdminMenu && (
                <div className="mt-1 space-y-1">
                  {secondaryNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-1.5 rounded-md text-xs transition-colors ${
                            isActive
                              ? 'bg-blue-600/15 text-blue-400 font-medium'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`
                        }
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1 pt-1">
              {secondaryNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      `flex items-center justify-center py-2 rounded-md text-xs transition-colors ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-400 font-medium'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User Info & Persona Switcher */}
      <div className="p-3 border-t border-slate-800 shrink-0 relative bg-slate-950/40">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
                {user?.fullName.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">{user?.fullName}</div>
                <div className="text-[10px] text-slate-400 font-mono tracking-tight truncate">
                  {user?.role.replace('_', ' ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                title="Switch Demo Persona"
              >
                <UserCheck className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="p-1.5 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800"
              title="Switch Persona"
            >
              <UserCheck className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Demo Persona Selection Popover */}
        {showRoleMenu && (
          <div className="absolute bottom-full left-2 mb-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in-0 duration-100">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-slate-400 tracking-wider border-b border-slate-800">
              Demo Persona Switcher
            </div>
            {demoRoles.map((dr) => (
              <button
                key={dr.role}
                type="button"
                onClick={async () => {
                  setShowRoleMenu(false);
                  await switchDemoRole(dr.role);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-slate-800 ${
                  user?.role === dr.role ? 'text-blue-400 font-semibold bg-slate-800/60' : 'text-slate-300'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
