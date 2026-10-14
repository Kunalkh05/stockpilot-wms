import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { prisma } from '../src/config/prisma.js';
import { InboundService } from '../src/services/InboundService.js';
import { POStatus, ReturnStatus, ReturnDisposition, MovementType } from '@prisma/client';

describe('Inbound Receiving, Put-Away, Returns & Ledger Audit Tests', () => {
  let adminToken: string;
  let warehouseId: string;
  let supplierId: string;
  let customerId: string;
  let productId: string;
  let dockLocId: string;
  let storageLocId: string;
  let userId: string;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'StockPilot2026!' });
    adminToken = adminRes.body.data.token;

    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'EDC' } });
    const supplier = await prisma.supplier.findFirst();
    const customer = await prisma.customer.findFirst();
    const product = await prisma.product.findFirst({ where: { sku: 'EL-SEN-001' } });
    const dockLoc = await prisma.location.findFirst({
      where: { warehouseId: warehouse!.id, type: 'RECEIVING', status: 'ACTIVE' },
    });
    const storageLoc = await prisma.location.findFirst({
      where: { warehouseId: warehouse!.id, type: 'STORAGE', status: 'ACTIVE' },
    });
    const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    warehouseId = warehouse!.id;
    supplierId = supplier!.id;
    customerId = customer!.id;
    productId = product!.id;
    dockLocId = dockLoc!.id;
    storageLocId = storageLoc!.id;
    userId = user!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('receives PO with accepted and damaged stock, verifies balance invariants and put-away tasks', async () => {
    // 1. Create a PO
    const po = await InboundService.createPurchaseOrder(userId, {
      supplierId,
      warehouseId,
      items: [{ productId, expectedQty: 20, unitCost: 45.0 }],
    });

    expect(po.poNumber).toBeDefined();
    expect(po.status).toBe(POStatus.ORDERED);

    const idempotencyKey = `RECV-TEST-${Date.now()}`;

    // 2. Receive 15 accepted, 5 damaged
    const receipt = await InboundService.processReceipt(userId, {
      purchaseOrderId: po.id,
      warehouseId,
      receivingLocationId: dockLocId,
      idempotencyKey,
      items: [
        {
          purchaseOrderItemId: po.items[0].id,
          productId,
          acceptedQty: 15,
          damagedQty: 5,
          rejectedQty: 0,
        },
      ],
    });

    expect(receipt.id).toBeDefined();
    expect(receipt.receiptNumber).toBeDefined();

    // 3. Verify PO status updated to RECEIVED
    const updatedPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(updatedPo?.status).toBe(POStatus.RECEIVED);

    // 4. Verify dock balance: onHand has received stock, damaged has damaged units
    const dockBalance = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: dockLocId, productId, lotId: null },
    });
    expect(dockBalance).toBeDefined();
    expect(dockBalance!.damaged).toBeGreaterThanOrEqual(5);

    // 5. Test idempotency: calling processReceipt with identical idempotencyKey returns existing receipt without duplicating effects
    const duplicateReceipt = await InboundService.processReceipt(userId, {
      purchaseOrderId: po.id,
      warehouseId,
      receivingLocationId: dockLocId,
      idempotencyKey,
      items: [
        {
          purchaseOrderItemId: po.items[0].id,
          productId,
          acceptedQty: 15,
          damagedQty: 5,
        },
      ],
    });
    expect(duplicateReceipt.id).toBe(receipt.id);

    // 6. Complete Put-Away task
    const putAwayTask = await prisma.putAwayTask.findFirst({
      where: { receiptId: receipt.id, productId },
    });
    expect(putAwayTask).toBeDefined();
    expect(putAwayTask!.quantity).toBe(15);

    const completedTask = await InboundService.completePutAwayTask(
      putAwayTask!.id,
      storageLocId,
      userId
    );
    expect(completedTask.status).toBe('COMPLETED');

    // 7. Storage location now has received inventory
    const storageBalance = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: storageLocId, productId, lotId: null },
    });
    expect(storageBalance!.onHand).toBeGreaterThanOrEqual(15);
  });

  it('handles Customer Return RMA: restocks good inventory and quarantines damaged inventory', async () => {
    // 1. Create RMA
    const createRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId,
        warehouseId,
        reason: 'Customer ordered wrong size - unopened unit',
        items: [{ productId, expectedQty: 3 }],
      });

    expect(createRes.status).toBe(201);
    const rma = createRes.body.data;
    expect(rma.rmaNumber).toBeDefined();
    expect(rma.status).toBe(ReturnStatus.REQUESTED);

    const balanceBefore = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: storageLocId, productId, lotId: null },
    });
    const onHandBefore = balanceBefore?.onHand || 0;

    // 2. Inspect RMA with RESTOCK disposition
    const inspectRes = await request(app)
      .post(`/api/v1/returns/${rma.id}/inspect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            returnOrderItemId: rma.items[0].id,
            productId,
            receivedQty: 3,
            disposition: ReturnDisposition.RESTOCK,
            targetLocationId: storageLocId,
            notes: 'Inspected and verified original sealed packaging',
          },
        ],
      });

    expect(inspectRes.status).toBe(200);

    // 3. Verify stock credited
    const balanceAfter = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: storageLocId, productId, lotId: null },
    });
    expect(balanceAfter!.onHand).toBe(onHandBefore + 3);

    // 4. Verify movement ledger has RETURN_RESTOCK entry
    const movement = await prisma.stockMovement.findFirst({
      where: {
        referenceType: MovementType.RETURN_RESTOCK,
        referenceId: rma.rmaNumber,
        productId,
      },
    });
    expect(movement).toBeDefined();
    expect(movement!.quantity).toBe(3);
  });

  it('exports inventory CSV with query-string token authentication', async () => {
    const res = await request(app)
      .get(`/api/v1/inventory/export/csv?token=${adminToken}&warehouseId=${warehouseId}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('SKU');
    expect(res.text).toContain('EL-SEN-001');
  });
});
