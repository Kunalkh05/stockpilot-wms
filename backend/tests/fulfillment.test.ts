import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { prisma } from '../src/config/prisma.js';
import { OutboundService } from '../src/services/OutboundService.js';
import { InboundService } from '../src/services/InboundService.js';
import { InventoryService } from '../src/services/InventoryService.js';
import { SOStatus, PickTaskStatus } from '@prisma/client';

describe('Comprehensive Outbound Fulfillment & Lifecycle Integration', () => {
  let adminToken: string;
  let warehouseId: string;
  let customerId: string;
  let productId: string;
  let storageLocId: string;
  let userId: string;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@stockpilot.io', password: 'StockPilot2026!' });
    adminToken = adminRes.body.data.token;

    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'EDC' } });
    const customer = await prisma.customer.findFirst();
    const product = await prisma.product.findFirst({ where: { sku: 'EL-SEN-002' } });
    const location = await prisma.location.findFirst({
      where: { warehouseId: warehouse!.id, type: 'STORAGE', status: 'ACTIVE' },
    });
    const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    warehouseId = warehouse!.id;
    customerId = customer!.id;
    productId = product!.id;
    storageLocId = location!.id;
    userId = user!.id;

    // Ensure baseline inventory in storage
    await InventoryService.adjustStock({
      warehouseId,
      locationId: storageLocId,
      productId,
      newOnHand: 50,
      reason: 'Fulfillment test baseline',
      userId,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('executes complete outbound slice: Create SO -> Allocate -> Pick -> Pack -> Dispatch', async () => {
    const orderQty = 6;

    // 1. Create Sales Order
    const order = await OutboundService.createSalesOrder(userId, {
      customerId,
      warehouseId,
      items: [{ productId, requestedQty: orderQty, unitPrice: 145.0 }],
      shippingCarrier: 'FedEx Express',
    });

    expect(order.status).toBe(SOStatus.PENDING);
    expect(order.items[0].requestedQty).toBe(orderQty);

    // 2. Allocate Stock (creates active reservations)
    const allocated = await OutboundService.allocateOrder(order.id, userId);
    expect(allocated.status).toBe(SOStatus.ALLOCATED);

    const reservations = await prisma.stockReservation.findMany({
      where: { salesOrderId: order.id, status: 'ACTIVE' },
    });
    expect(reservations.length).toBeGreaterThan(0);
    expect(reservations.reduce((s, r) => s + r.reservedQty, 0)).toBe(orderQty);

    // Verify pick task generated
    const pickTask = await prisma.pickTask.findFirst({
      where: { salesOrderId: order.id },
      include: { items: true },
    });
    expect(pickTask).toBeDefined();
    expect(pickTask!.items.length).toBeGreaterThan(0);

    // 3. Confirm Picking for each item
    for (const item of pickTask!.items) {
      await OutboundService.confirmPickItem(
        pickTask!.id,
        item.id,
        item.targetQty,
        undefined,
        userId
      );
    }

    const updatedOrderAfterPick = await prisma.salesOrder.findUnique({
      where: { id: order.id },
    });
    expect(updatedOrderAfterPick!.status).toBe(SOStatus.PICKED);

    // 4. Pack Order (Packing station)
    const pkg = await OutboundService.packOrder(order.id, userId, {
      weightKg: 2.8,
      boxType: 'STANDARD_CORRUGATED',
    });
    expect(pkg.packageNumber).toBeDefined();

    const updatedOrderAfterPack = await prisma.salesOrder.findUnique({
      where: { id: order.id },
    });
    expect(updatedOrderAfterPack!.status).toBe(SOStatus.PACKED);

    // Record balance before dispatch
    const balanceBeforeDispatch = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: reservations[0].locationId, productId },
    });
    const onHandBefore = balanceBeforeDispatch!.onHand;
    const reservedBefore = balanceBeforeDispatch!.reserved;

    // 5. Dispatch Order (Shipping station)
    const dispatchResult = await OutboundService.dispatchOrder(order.id, userId, {
      carrier: 'FedEx Express',
      trackingNumber: `TRK-TEST-${Date.now()}`,
    });

    expect(dispatchResult.order.status).toBe(SOStatus.SHIPPED);
    expect(dispatchResult.shipment).toBeDefined();

    // Verify inventory balance was relieved
    const balanceAfterDispatch = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: reservations[0].locationId, productId },
    });
    expect(balanceAfterDispatch!.onHand).toBe(onHandBefore - orderQty);
    expect(balanceAfterDispatch!.reserved).toBe(reservedBefore - orderQty);

    // Verify reservations marked CONSUMED
    const consumedReservations = await prisma.stockReservation.findMany({
      where: { salesOrderId: order.id },
    });
    expect(consumedReservations.every((r) => r.status === 'CONSUMED')).toBe(true);

    // Verify immutable movement record
    const shipMovement = await prisma.stockMovement.findFirst({
      where: { referenceId: order.orderNumber, referenceType: 'ORDER_SHIP' },
    });
    expect(shipMovement).toBeDefined();
    expect(shipMovement!.quantity).toBe(orderQty);
  });

  it('cancels order and safely releases reservations back to available stock', async () => {
    // 1. Create & Allocate Order
    const order = await OutboundService.createSalesOrder(userId, {
      customerId,
      warehouseId,
      items: [{ productId, requestedQty: 3, unitPrice: 145.0 }],
    });
    await OutboundService.allocateOrder(order.id, userId);

    const reservation = await prisma.stockReservation.findFirst({
      where: { salesOrderId: order.id, status: 'ACTIVE' },
    });
    expect(reservation).toBeDefined();
    const allocatedLocId = reservation!.locationId;

    const balDuring = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: allocatedLocId, productId },
    });
    const reservedDuring = balDuring!.reserved;

    // 2. Cancel Order
    const cancelled = await OutboundService.cancelOrder(
      order.id,
      userId,
      'Customer requested cancellation'
    );
    expect(cancelled.status).toBe(SOStatus.CANCELLED);

    // 3. Verify reservation released on the allocated location
    const balAfterCancel = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: allocatedLocId, productId },
    });
    expect(balAfterCancel!.reserved).toBe(reservedDuring - 3);

    const releasedRes = await prisma.stockReservation.findMany({
      where: { salesOrderId: order.id },
    });
    expect(releasedRes.every((r) => r.status === 'RELEASED')).toBe(true);
  });

  it('records system audit log entries for key lifecycle transitions', async () => {
    const recentAuditLogs = await prisma.auditLog.findMany({
      where: {
        action: { in: ['SO_CREATED', 'SO_ALLOCATED', 'SO_PACKED', 'SO_DISPATCHED'] },
      },
      take: 4,
      orderBy: { createdAt: 'desc' },
    });

    expect(recentAuditLogs.length).toBeGreaterThan(0);
    expect(recentAuditLogs[0].detailsJson).toBeDefined();
  });
});
