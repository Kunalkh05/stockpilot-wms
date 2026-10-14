import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { useAuth } from '../context/AuthContext.js';

export const AppLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded bg-brand-500 text-white font-black flex items-center justify-center animate-pulse">
            SP
          </div>
          <div className="text-xs text-surface-500 font-mono">Initializing StockPilot WMS...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-surface-950/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-64 bg-surface-900 h-full flex flex-col">
            <Sidebar collapsed={false} setCollapsed={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onToggleMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface-50">
          <Outlet />
        </main>
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
  );
};
