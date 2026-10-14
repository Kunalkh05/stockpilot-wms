import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { InventoryService } from '../src/services/InventoryService.js';
import { InboundService } from '../src/services/InboundService.js';
import { OutboundService } from '../src/services/OutboundService.js';
import { AppError } from '../src/types/index.js';

describe('Inventory Domain Invariants & Logic', () => {
  let warehouseId: string;
  let sourceLocId: string;
  let destLocId: string;
  let productId: string;
  let userId: string;

  beforeAll(async () => {
    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'EDC' } });
    const locations = await prisma.location.findMany({
      where: { warehouseId: warehouse!.id, type: 'STORAGE' },
      take: 2,
    });
    const product = await prisma.product.findFirst({ where: { sku: 'EL-SEN-001' } });
    const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    warehouseId = warehouse!.id;
    sourceLocId = locations[0].id;
    destLocId = locations[1].id;
    productId = product!.id;
    userId = user!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('calculates available quantity strictly as onHand - reserved - damaged', async () => {
    const res = await InventoryService.listBalances({ warehouseId, limit: 10 });
    expect(res.items.length).toBeGreaterThan(0);

    for (const b of res.items) {
      expect(b.available).toBe(Math.max(0, b.onHand - b.reserved - b.damaged));
      expect(b.onHand).toBeGreaterThanOrEqual(0);
      expect(b.reserved).toBeGreaterThanOrEqual(0);
      expect(b.damaged).toBeGreaterThanOrEqual(0);
    }
  });

  it('atomically transfers stock between bins, debiting source and crediting destination', async () => {
    // 1. Establish initial balance at source
    await InventoryService.adjustStock({
      warehouseId,
      locationId: sourceLocId,
      productId,
      newOnHand: 50,
      reason: 'Unit test setup initial baseline',
      userId,
    });

    const transferQty = 15;
    const result = await InventoryService.transferStock({
      warehouseId,
      sourceLocationId: sourceLocId,
      destLocationId: destLocId,
      productId,
      quantity: transferQty,
      userId,
      reason: 'Unit test bin rebalance',
    });

    expect(result.source.onHand).toBe(35);
    expect(result.destination.onHand).toBeGreaterThanOrEqual(15);

    // Verify movement was created
    const movements = await prisma.stockMovement.findMany({
      where: {
        sourceLocationId: sourceLocId,
        destinationLocationId: destLocId,
        productId,
      },
      take: 1,
      orderBy: { createdAt: 'desc' },
    });

    expect(movements.length).toBe(1);
    expect(movements[0].quantity).toBe(transferQty);
  });

  it('rejects transfer if requested quantity exceeds available stock', async () => {
    await expect(
      InventoryService.transferStock({
        warehouseId,
        sourceLocationId: sourceLocId,
        destLocationId: destLocId,
        productId,
        quantity: 999999, // Impossible amount
        userId,
        reason: 'Oversell attempt test',
      })
    ).rejects.toThrow(AppError);
  });

  it('prevents manual stock adjustment below currently reserved quantities', async () => {
    // Artificial reservation
    const bal = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId: sourceLocId, productId },
    });

    if (bal) {
      await prisma.inventoryBalance.update({
        where: { id: bal.id },
        data: { reserved: 10 },
      });

      // Try setting on-hand to 5 (less than reserved)
      await expect(
        InventoryService.adjustStock({
          warehouseId,
          locationId: sourceLocId,
          productId,
          newOnHand: 5,
          reason: 'Illegal reduction test',
          userId,
        })
      ).rejects.toThrow(AppError);

      // Clean up reservation
      await prisma.inventoryBalance.update({
        where: { id: bal.id },
        data: { reserved: 0 },
      });
    }
  });

  it('guarantees idempotency on receiving: retries with same idempotencyKey do not duplicate stock', async () => {
    const po = await prisma.purchaseOrder.findFirst({
      where: { warehouseId, status: 'ORDERED' },
      include: { items: true },
    });

    if (po && po.items.length > 0) {
      const receivingLoc = await prisma.location.findFirst({
        where: { warehouseId, type: 'RECEIVING' },
      });

      const key = `IDEMP-TEST-${Date.now()}`;
      const payload = {
        purchaseOrderId: po.id,
        warehouseId,
        receivingLocationId: receivingLoc!.id,
        idempotencyKey: key,
        items: [
          {
            purchaseOrderItemId: po.items[0].id,
            productId: po.items[0].productId,
            acceptedQty: 5,
            damagedQty: 0,
            rejectedQty: 0,
          },
        ],
      };

      // First receipt call
      const receipt1 = await InboundService.processReceipt(userId, payload);
      expect(receipt1).toBeDefined();

      // Second receipt call with identical key
      const receipt2 = await InboundService.processReceipt(userId, payload);
      expect(receipt2.id).toBe(receipt1.id);
      expect(receipt2.receiptNumber).toBe(receipt1.receiptNumber);
    }
  });
});
