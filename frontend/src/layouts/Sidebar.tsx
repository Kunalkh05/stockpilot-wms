import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  MapPin,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  CheckSquare,
  PackageCheck,
  Truck,
  RotateCcw,
  History,
  BarChart3,
  Users,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
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

  const navGroups = [
    {
      title: 'Core Logistics',
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
        { label: 'Inventory Balances', to: '/inventory', icon: Boxes },
        { label: 'Warehouse Bins', to: '/locations', icon: MapPin },
      ],
    },
    {
      title: 'Inbound Operations',
      items: [
        { label: 'Purchase Orders', to: '/purchase-orders', icon: FileText },
        { label: 'Receiving Dock', to: '/receiving', icon: ArrowDownLeft },
        { label: 'Put-Away Tasks', to: '/put-away', icon: ClipboardList },
      ],
    },
    {
      title: 'Outbound Fulfillment',
      items: [
        { label: 'Sales Orders', to: '/sales-orders', icon: ArrowUpRight },
        { label: 'Picking Station', to: '/picking', icon: CheckSquare },
        { label: 'Packing Station', to: '/packing', icon: PackageCheck },
        { label: 'Shipments', to: '/shipments', icon: Truck },
      ],
    },
    {
      title: 'Ledger & Intelligence',
      items: [
        { label: 'Customer Returns', to: '/returns', icon: RotateCcw },
        { label: 'Movement Ledger', to: '/movements', icon: History },
        { label: 'Operational Reports', to: '/reports', icon: BarChart3 },
      ],
    },
    {
      title: 'Administration',
      items: [
        ...(hasRole('ADMIN', 'WAREHOUSE_MANAGER')
          ? [
              { label: 'Users & Roles', to: '/users', icon: Users },
              { label: 'Audit Trail', to: '/audit', icon: ShieldCheck },
            ]
          : []),
        { label: 'Facility Settings', to: '/settings', icon: Settings },
      ],
    },
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
      className={`relative flex flex-col bg-surface-900 text-surface-200 border-r border-surface-800 transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-surface-800">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-brand-500 text-surface-950 flex items-center justify-center font-black tracking-wider shadow">
              SP
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-white tracking-tight leading-none">StockPilot</span>
              <span className="text-[10px] text-brand-400 font-mono tracking-widest mt-0.5">WMS ENTERPRISE</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded bg-brand-500 text-surface-950 flex items-center justify-center font-black text-sm">
            SP
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-1.5 rounded text-surface-400 hover:text-white hover:bg-surface-800 transition-colors ${
            collapsed ? 'hidden' : 'block'
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold tracking-wider uppercase text-surface-500 font-mono">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                          : 'text-surface-400 hover:text-white hover:bg-surface-800/60'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Demo Role Switcher & User Footer */}
      <div className="p-3 border-t border-surface-800 bg-surface-950/40 relative">
        {showRoleMenu && !collapsed && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-surface-900 border border-surface-700 rounded-lg shadow-xl p-2 z-50 text-xs">
            <div className="px-2 py-1 text-[10px] uppercase font-mono text-surface-400 border-b border-surface-800 mb-1">
              Switch Demo Role
            </div>
            {demoRoles.map((dr) => (
              <button
                key={dr.role}
                onClick={async () => {
                  await switchDemoRole(dr.role);
                  setShowRoleMenu(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                  user?.role === dr.role
                    ? 'bg-brand-500/20 text-brand-400 font-medium'
                    : 'text-surface-300 hover:bg-surface-800'
                }`}
              >
                <span>{dr.label}</span>
                {user?.role === dr.role && <span className="text-[10px]">Active</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-xs text-white font-mono shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-medium text-white truncate">{user?.fullName}</div>
                <div className="text-[10px] text-surface-400 font-mono truncate">{user?.role}</div>
              </div>
            </div>
          ) : (
            <div
              className="w-7 h-7 mx-auto rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-xs text-white font-mono cursor-pointer"
              title={`${user?.fullName} (${user?.role})`}
            >
              {user?.fullName?.charAt(0) || 'U'}
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                title="Switch test role"
                className="p-1 rounded text-surface-400 hover:text-brand-400 hover:bg-surface-800 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={logout}
                title="Sign out"
                className="p-1 rounded text-surface-400 hover:text-rose-400 hover:bg-surface-800 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
