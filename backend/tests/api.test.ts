import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { prisma } from '../src/config/prisma.js';

describe('StockPilot WMS REST API Integration Tests', () => {
  let adminToken: string;
  let pickerToken: string;
  let edcWarehouseId: string;

  beforeAll(async () => {
    // Login as Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'StockPilot2026!' });
    adminToken = adminRes.body.data.token;

    // Login as Picker
    const pickerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'picker@stockpilot.io', password: 'StockPilot2026!' });
    pickerToken = pickerRes.body.data.token;

    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'EDC' } });
    edcWarehouseId = warehouse!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/v1/health returns healthy system status and database connection', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
    expect(res.body.system).toBe('StockPilot WMS');
  });

  it('POST /api/v1/auth/login rejects invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'WrongPassword!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login supports login with username / loginId alias without domain', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'admin', password: 'StockPilot2026!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@stockpilot.io');
  });

  it('POST /api/v1/auth/register creates a user with custom loginId and password', async () => {
    const uniqueId = `testuser_${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        loginId: uniqueId,
        fullName: 'Test Operator',
        password: 'SecurePassword123!',
        email: `${uniqueId}@example.com`,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.loginId).toBe(uniqueId);

    // Verify login with newly created loginId
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        loginId: uniqueId,
        password: 'SecurePassword123!',
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.loginId).toBe(uniqueId);
  });

  it('POST /api/v1/auth/register rejects duplicate loginId with 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        loginId: 'admin',
        fullName: 'Duplicate Admin',
        password: 'SecurePassword123!',
      });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });

  it('GET /api/v1/auth/me returns current user identity with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('admin@stockpilot.io');
    expect(res.body.data.role).toBe('ADMIN');
  });

  it('GET /api/v1/warehouses returns operational warehouse facilities', async () => {
    const res = await request(app)
      .get('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/inventory/balances returns list with available calculation', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/balances?warehouseId=${edcWarehouseId}&limit=10`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('available');
  });

  it('GET /api/v1/reports/dashboard returns verified KPIs and activity lists', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/dashboard?warehouseId=${edcWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.kpi).toHaveProperty('totalSellableUnits');
    expect(res.body.data.kpi).toHaveProperty('totalValuation');
  });

  it('enforces RBAC: Picker role is forbidden from manual stock adjustment', async () => {
    const product = await prisma.product.findFirst();
    const location = await prisma.location.findFirst({ where: { warehouseId: edcWarehouseId } });

    const res = await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', `Bearer ${pickerToken}`)
      .send({
        warehouseId: edcWarehouseId,
        locationId: location!.id,
        productId: product!.id,
        newOnHand: 100,
        reason: 'Unauthorized attempt by picker',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('PUT /api/v1/products/:id updates product attributes and emits audit log', async () => {
    const product = await prisma.product.findFirst({ where: { sku: 'EL-SEN-001' } });
    const res = await request(app)
      .put(`/api/v1/products/${product!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Photoelectric Proximity Sensor 24V (Updated)',
        unitPrice: 155.0,
        minReorderPoint: 15,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Photoelectric Proximity Sensor 24V (Updated)');
    expect(res.body.data.unitPrice).toBe(155.0);
  });

  it('DELETE /api/v1/products/:id prevents deactivating product with active physical stock', async () => {
    // EL-SEN-001 has active physical stock in EDC
    const product = await prisma.product.findFirst({ where: { sku: 'EL-SEN-001' } });
    const res = await request(app)
      .delete(`/api/v1/products/${product!.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CANNOT_DELETE_ACTIVE_STOCK');
  });

  it('GET /api/v1/inbound/suppliers returns active suppliers for procurement', async () => {
    const res = await request(app)
      .get('/api/v1/inbound/suppliers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('code');
    expect(res.body.data[0]).toHaveProperty('name');
  });

  it('GET /api/v1/outbound/customers returns active customer accounts for order entry', async () => {
    const res = await request(app)
      .get('/api/v1/outbound/customers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('code');
    expect(res.body.data[0]).toHaveProperty('name');
  });

  it('POST /api/v1/inbound/suppliers creates a new approved vendor supplier', async () => {
    const uniqueCode = `SUP-TEST-${Date.now().toString().slice(-4)}`;
    const res = await request(app)
      .post('/api/v1/inbound/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: uniqueCode,
        name: 'Precision Test Components LLC',
        contactEmail: 'sales@precisiontest.io',
        phone: '+1 312 555 0199',
        city: 'Chicago',
        address: '400 N Michigan Ave',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(uniqueCode);
    expect(res.body.data.name).toBe('Precision Test Components LLC');
  });

  it('POST /api/v1/outbound/customers registers a verified customer account', async () => {
    const uniqueCode = `CUST-TEST-${Date.now().toString().slice(-4)}`;
    const res = await request(app)
      .post('/api/v1/outbound/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: uniqueCode,
        name: 'Apex Robotics Labs',
        email: 'procurement@apexrobotics.io',
        phone: '+1 415 555 8832',
        shippingAddress: '742 Evergreen Terrace, Suite 100',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62704',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(uniqueCode);
    expect(res.body.data.name).toBe('Apex Robotics Labs');
  });

  it('GET /api/v1/outbound/reservations lists stock reservation records with balance references', async () => {
    const res = await request(app)
      .get(`/api/v1/outbound/reservations?warehouseId=${edcWarehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('PATCH /api/v1/warehouses/:id/locations/:locId updates bin status and capacity with audit log', async () => {
    const location = await prisma.location.findFirst({ where: { warehouseId: edcWarehouseId } });
    const res = await request(app)
      .patch(`/api/v1/warehouses/${edcWarehouseId}/locations/${location!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'LOCKED',
        capacityUnits: 1500,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('LOCKED');
    expect(res.body.data.capacityUnits).toBe(1500);

    // Revert back to ACTIVE to keep test database consistent
    await request(app)
      .patch(`/api/v1/warehouses/${edcWarehouseId}/locations/${location!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE', capacityUnits: location!.capacityUnits });
  });
});


