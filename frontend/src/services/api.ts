import { ApiResponse, Role, User } from '../types/index.js';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const DEMO_ACCOUNTS = [
  {
    id: 'demo-admin-01',
    email: 'admin@stockpilot.io',
    loginId: 'admin',
    fullName: 'Alex Vance (Admin)',
    role: 'ADMIN' as Role,
    active: true,
    password: 'StockPilot2026!',
    memberships: [
      {
        warehouse: {
          id: 'wh-edc-001',
          code: 'EDC',
          name: 'East Coast Distribution Center',
          isDefault: true,
        },
      },
    ],
  },
  {
    id: 'demo-manager-02',
    email: 'manager@stockpilot.io',
    loginId: 'manager',
    fullName: 'Sarah Chen (Ops Manager)',
    role: 'WAREHOUSE_MANAGER' as Role,
    active: true,
    password: 'StockPilot2026!',
    memberships: [
      {
        warehouse: {
          id: 'wh-edc-001',
          code: 'EDC',
          name: 'East Coast Distribution Center',
          isDefault: true,
        },
      },
    ],
  },
  {
    id: 'demo-inv-03',
    email: 'inventory@stockpilot.io',
    loginId: 'inventory',
    fullName: 'David Morales (Inventory Lead)',
    role: 'INVENTORY_SPECIALIST' as Role,
    active: true,
    password: 'StockPilot2026!',
    memberships: [
      {
        warehouse: {
          id: 'wh-edc-001',
          code: 'EDC',
          name: 'East Coast Distribution Center',
          isDefault: true,
        },
      },
    ],
  },
  {
    id: 'demo-picker-04',
    email: 'picker@stockpilot.io',
    loginId: 'picker',
    fullName: 'Marcus Bell (Fulfillment Associate)',
    role: 'PICKER_PACKER' as Role,
    active: true,
    password: 'StockPilot2026!',
    memberships: [
      {
        warehouse: {
          id: 'wh-edc-001',
          code: 'EDC',
          name: 'East Coast Distribution Center',
          isDefault: true,
        },
      },
    ],
  },
  {
    id: 'demo-rcv-05',
    email: 'receiving@stockpilot.io',
    loginId: 'receiving',
    fullName: 'Elena Rostova (Inbound Lead)',
    role: 'RECEIVING_CLERK' as Role,
    active: true,
    password: 'StockPilot2026!',
    memberships: [
      {
        warehouse: {
          id: 'wh-edc-001',
          code: 'EDC',
          name: 'East Coast Distribution Center',
          isDefault: true,
        },
      },
    ],
  },
];

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('stockpilot_token');
  }

  private toQueryString(params?: Record<string, any>): string {
    if (!params) return '';
    const cleanParams: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanParams[k] = String(v);
      }
    });
    const qs = new URLSearchParams(cleanParams).toString();
    return qs ? `?${qs}` : '';
  }

  private handleOfflineFallback<T>(endpoint: string, options: RequestInit = {}): T | null {
    const body = options.body ? JSON.parse(options.body as string) : {};

    // 1. Fallback for /auth/login
    if (endpoint.includes('/auth/login')) {
      const identifier = (body.identifier || body.loginId || body.email || body.username || '').trim().toLowerCase();
      const password = body.password || '';

      const localUsers: any[] = JSON.parse(localStorage.getItem('stockpilot_local_users') || '[]');
      const allUsers = [...DEMO_ACCOUNTS, ...localUsers];

      const found = allUsers.find((u) => {
        const emailMatch = u.email?.toLowerCase() === identifier;
        const loginMatch = u.loginId?.toLowerCase() === identifier;
        const prefixMatch = !identifier.includes('@') && u.email?.toLowerCase().startsWith(`${identifier}@`);
        return emailMatch || loginMatch || prefixMatch;
      });

      if (!found || found.password !== password) {
        throw new Error('Invalid login ID or password');
      }

      const { password: _, ...userSafe } = found;
      return {
        token: `demo_jwt_token_${found.id}_${Date.now()}`,
        user: userSafe,
      } as unknown as T;
    }

    // 2. Fallback for /auth/register
    if (endpoint.includes('/auth/register')) {
      const loginId = (body.loginId || '').trim().toLowerCase();
      const password = body.password || '';
      const fullName = (body.fullName || '').trim();
      const email = (body.email || `${loginId}@stockpilot.local`).trim().toLowerCase();
      const role = (body.role as Role) || 'WAREHOUSE_MANAGER';

      if (!loginId || loginId.length < 3) {
        throw new Error('Login ID must be at least 3 characters');
      }
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      const localUsers: any[] = JSON.parse(localStorage.getItem('stockpilot_local_users') || '[]');
      const allUsers = [...DEMO_ACCOUNTS, ...localUsers];

      const isTaken = allUsers.some(
        (u) => u.loginId?.toLowerCase() === loginId || u.email?.toLowerCase() === email
      );
      if (isTaken) {
        throw new Error(`Login ID "${loginId}" is already taken. Please choose another.`);
      }

      const newUser = {
        id: `usr_${Date.now()}`,
        email,
        loginId,
        fullName,
        role,
        active: true,
        password,
        createdAt: new Date().toISOString(),
        memberships: [
          {
            warehouse: {
              id: 'wh-edc-001',
              code: 'EDC',
              name: 'East Coast Distribution Center',
              isDefault: true,
            },
          },
        ],
      };

      localUsers.push(newUser);
      localStorage.setItem('stockpilot_local_users', JSON.stringify(localUsers));

      const { password: _, ...userSafe } = newUser;
      return {
        token: `demo_jwt_token_${newUser.id}_${Date.now()}`,
        user: userSafe,
      } as unknown as T;
    }

    // 3. Fallback for /auth/me
    if (endpoint.includes('/auth/me')) {
      const stored = localStorage.getItem('stockpilot_user');
      if (stored) {
        try {
          return JSON.parse(stored) as T;
        } catch {}
      }
      return DEMO_ACCOUNTS[0] as unknown as T;
    }

    // 4. Fallback for /warehouses
    if (endpoint === '/warehouses') {
      return [
        {
          id: 'wh-edc-001',
          code: 'EDC',
          name: 'East Coast Distribution Center',
          city: 'Newark',
          state: 'NJ',
          isDefault: true,
        },
        {
          id: 'wh-wdc-002',
          code: 'WDC',
          name: 'West Coast Fulfillment Hub',
          city: 'Reno',
          state: 'NV',
          isDefault: false,
        },
      ] as unknown as T;
    }

    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      // If backend responded with HTML (e.g. Cloudflare Pages SPA rewrite returning index.html)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const fallback = this.handleOfflineFallback<T>(endpoint, options);
        if (fallback !== null) {
          return fallback;
        }
        throw new Error('Service unavailable. Please ensure backend server is running.');
      }

      const data: ApiResponse<T> = await res.json().catch(() => ({
        success: false,
        error: { code: 'PARSE_ERROR', message: 'Failed to parse JSON response' },
      }));

      if (!res.ok || !data.success) {
        if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          localStorage.removeItem('stockpilot_token');
          localStorage.removeItem('stockpilot_user');
          window.location.href = '/login';
        }
        throw new Error(data.error?.message || `Request failed with status ${res.status}`);
      }

      return data.data;
    } catch (err: any) {
      // Handle connection refused, network errors or offline fallback
      const fallback = this.handleOfflineFallback<T>(endpoint, options);
      if (fallback !== null) {
        return fallback;
      }
      throw err;
    }
  }

  // Auth
  async login(identifier: string, password: string) {
    return this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
  }

  async register(data: {
    loginId: string;
    password: string;
    fullName: string;
    email?: string;
    role?: Role;
  }) {
    return this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async me() {
    return this.request<any>('/auth/me');
  }

  async listUsers(params?: Record<string, string | number>) {
    return this.request<any[]>(`/auth/users${this.toQueryString(params as any)}`);
  }

  async createUser(data: any) {
    return this.request<any>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Warehouses & Locations
  async listWarehouses() {
    return this.request<any[]>('/warehouses');
  }

  async getWarehouse(id: string) {
    return this.request<any>(`/warehouses/${id}`);
  }

  async createWarehouse(data: any) {
    return this.request<any>('/warehouses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listLocations(warehouseId: string, params?: Record<string, any>) {
    return this.request<any[]>(`/warehouses/${warehouseId}/locations${this.toQueryString(params)}`);
  }

  async createLocation(warehouseId: string, data: any) {
    return this.request<any>(`/warehouses/${warehouseId}/locations`, {
      method: 'POST',
      body: JSON.stringify({ ...data, warehouseId }),
    });
  }

  async updateLocation(warehouseId: string, locId: string, data: any) {
    return this.request<any>(`/warehouses/${warehouseId}/locations/${locId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Products & Categories
  async listProducts(params?: Record<string, string | number>) {
    return this.request<any[]>(`/products${this.toQueryString(params as any)}`);
  }

  async getProduct(id: string) {
    return this.request<any>(`/products/${id}`);
  }

  async createProduct(data: any) {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.request<any>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async listCategories() {
    return this.request<any[]>('/products/categories');
  }

  // Inventory & Movements
  async listBalances(params?: Record<string, any>) {
    return this.request<any[]>(`/inventory/balances${this.toQueryString(params)}`);
  }

  async getProductStock(productId: string, warehouseId?: string) {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return this.request<any>(`/inventory/product/${productId}${qs}`);
  }

  async adjustStock(data: {
    warehouseId: string;
    locationId: string;
    productId: string;
    newOnHand: number;
    reason: string;
    lotId?: string | null;
  }) {
    return this.request<any>('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transferStock(data: {
    warehouseId: string;
    sourceLocationId: string;
    destLocationId: string;
    productId: string;
    quantity: number;
    reason?: string;
  }) {
    return this.request<any>('/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listMovements(params?: Record<string, any>) {
    return this.request<any[]>(`/inventory/movements${this.toQueryString(params)}`);
  }

  getExportCsvUrl(warehouseId?: string) {
    const token = this.getToken();
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (token) params.append('token', token);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return `${BASE_URL}/inventory/export/csv${qs}`;
  }

  // Inbound
  async listSuppliers() {
    return this.request<any[]>('/inbound/suppliers');
  }

  async createSupplier(data: {
    code: string;
    name: string;
    contactEmail: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  }) {
    return this.request<any>('/inbound/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listPurchaseOrders(params?: Record<string, any>) {
    return this.request<any[]>(`/inbound/purchase-orders${this.toQueryString(params)}`);
  }

  async createPurchaseOrder(data: any) {
    return this.request<any>('/inbound/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async receiveStock(data: any) {
    return this.request<any>('/inbound/receive', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listPutAwayTasks(params?: Record<string, any>) {
    return this.request<any[]>(`/inbound/put-away-tasks${this.toQueryString(params)}`);
  }

  async completePutAway(taskId: string, confirmedLocationId: string) {
    return this.request<any>(`/inbound/put-away-tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ confirmedLocationId }),
    });
  }

  // Outbound
  async listCustomers() {
    return this.request<any[]>('/outbound/customers');
  }

  async createCustomer(data: {
    code: string;
    name: string;
    email: string;
    phone?: string;
    shippingAddress: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  }) {
    return this.request<any>('/outbound/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listReservations(params?: { warehouseId?: string; status?: string }) {
    return this.request<any[]>(`/outbound/reservations${this.toQueryString(params as any)}`);
  }

  async listSalesOrders(params?: Record<string, any>) {
    return this.request<any[]>(`/outbound/orders${this.toQueryString(params)}`);
  }

  async createSalesOrder(data: any) {
    return this.request<any>('/outbound/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async allocateOrder(orderId: string) {
    return this.request<any>(`/outbound/orders/${orderId}/allocate`, {
      method: 'POST',
    });
  }

  async listPickTasks(params?: Record<string, any>) {
    return this.request<any[]>(`/outbound/pick-tasks${this.toQueryString(params)}`);
  }

  async confirmPickItem(taskId: string, itemId: string, data: { pickedQty: number; discrepancyReason?: string }) {
    return this.request<any>(`/outbound/pick-tasks/${taskId}/items/${itemId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async packOrder(orderId: string, data: { weightKg: number; boxType: string }) {
    return this.request<any>(`/outbound/orders/${orderId}/pack`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async dispatchOrder(orderId: string, data: { carrier: string; trackingNumber?: string }) {
    return this.request<any>(`/outbound/orders/${orderId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelOrder(orderId: string, reason: string) {
    return this.request<any>(`/outbound/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Returns
  async listReturns(params?: Record<string, any>) {
    return this.request<any[]>(`/returns${this.toQueryString(params)}`);
  }

  async createReturn(data: any) {
    return this.request<any>('/returns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async inspectReturn(returnId: string, items: any[]) {
    return this.request<any>(`/returns/${returnId}/inspect`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // Reports
  async getDashboard(warehouseId?: string) {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return this.request<any>(`/reports/dashboard${qs}`);
  }

  async getValuationReport(warehouseId?: string) {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return this.request<any>(`/reports/valuation${qs}`);
  }

  async getLowStockReport(warehouseId?: string) {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return this.request<any>(`/reports/low-stock${qs}`);
  }

  async getLotExpiryReport(warehouseId?: string) {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return this.request<any>(`/reports/lot-expiry${qs}`);
  }

  async getBinUtilization(warehouseId?: string) {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return this.request<any>(`/reports/utilization${qs}`);
  }

  // Audit
  async listAuditLogs(params?: Record<string, any>) {
    return this.request<any[]>(`/audit/logs${this.toQueryString(params)}`);
  }
}

export const api = new ApiClient();
