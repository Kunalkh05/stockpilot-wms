import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext.js';
import { WarehouseProvider } from './context/WarehouseContext.js';
import { AppLayout } from './layouts/AppLayout.js';

import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { LocationsPage } from './pages/LocationsPage.js';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage.js';
import { ReceivingPage } from './pages/ReceivingPage.js';
import { PutAwayPage } from './pages/PutAwayPage.js';
import { SalesOrdersPage } from './pages/SalesOrdersPage.js';
import { PickingPage } from './pages/PickingPage.js';
import { PackingPage } from './pages/PackingPage.js';
import { ShipmentsPage } from './pages/ShipmentsPage.js';
import { ReturnsPage } from './pages/ReturnsPage.js';
import { MovementsPage } from './pages/MovementsPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WarehouseProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<LoginPage initialMode="register" />} />

              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="orders" element={<Navigate to="/sales-orders" replace />} />
                <Route path="sales-orders" element={<SalesOrdersPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="locations" element={<LocationsPage />} />
                <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="inward" element={<Navigate to="/receiving" replace />} />
                <Route path="receiving" element={<ReceivingPage />} />
                <Route path="put-away" element={<PutAwayPage />} />
                <Route path="outward" element={<Navigate to="/picking" replace />} />
                <Route path="picking" element={<PickingPage />} />
                <Route path="packing" element={<PackingPage />} />
                <Route path="shipments" element={<ShipmentsPage />} />
                <Route path="returns" element={<ReturnsPage />} />
                <Route path="movements" element={<MovementsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="audit" element={<AuditLogPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WarehouseProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};
export default App;
