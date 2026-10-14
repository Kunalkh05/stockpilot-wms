import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { OutboundService } from '../src/services/OutboundService.js';
import { InventoryService } from '../src/services/InventoryService.js';
import { AppError } from '../src/types/index.js';

describe('Concurrency Control & Overselling Prevention', () => {
  let warehouseId: string;
  let customerId: string;
  let productId: string;
  let locationId: string;
  let userId: string;

  beforeAll(async () => {
    const warehouse = await prisma.warehouse.findFirst({ where: { code: 'EDC' } });
    const customer = await prisma.customer.findFirst();
    const product = await prisma.product.findFirst({ where: { sku: 'EL-DRV-201' } });
    const location = await prisma.location.findFirst({
      where: { warehouseId: warehouse!.id, type: 'STORAGE' },
    });
    const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    warehouseId = warehouse!.id;
    customerId = customer!.id;
    productId = product!.id;
    locationId = location!.id;
    userId = user!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('prevents overselling during concurrent allocation attempts on scarce inventory', async () => {
    // 1. Set explicit scarce inventory: zero out other bins and set exactly 10 units in test location with 0 reserved
    await prisma.inventoryBalance.updateMany({
      where: { warehouseId, productId, locationId: { not: locationId } },
      data: { onHand: 0, reserved: 0, damaged: 0 },
    });

    const existing = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId, productId },
    });
    if (existing) {
      await prisma.inventoryBalance.update({
        where: { id: existing.id },
        data: { onHand: 10, reserved: 0, damaged: 0 },
      });
    } else {
      await prisma.inventoryBalance.create({
        data: { warehouseId, locationId, productId, onHand: 10, reserved: 0, damaged: 0 },
      });
    }

    // 2. Create Order A (demanding 8 units) and Order B (demanding 8 units)
    // Combined demand = 16 units, but only 10 exist!
    const orderA = await OutboundService.createSalesOrder(userId, {
      customerId,
      warehouseId,
      items: [{ productId, requestedQty: 8, unitPrice: 340.0 }],
    });

    const orderB = await OutboundService.createSalesOrder(userId, {
      customerId,
      warehouseId,
      items: [{ productId, requestedQty: 8, unitPrice: 340.0 }],
    });

    // 3. Attempt concurrent allocation
    const results = await Promise.allSettled([
      OutboundService.allocateOrder(orderA.id, userId),
      OutboundService.allocateOrder(orderB.id, userId),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactly one should succeed and one should fail
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Verify balance was not oversold
    const balance = await prisma.inventoryBalance.findFirst({
      where: { warehouseId, locationId, productId },
    });

    expect(balance!.reserved).toBe(8);
    expect(balance!.onHand).toBe(10);
    expect(balance!.onHand - balance!.reserved).toBe(2); // exactly 2 remain
  });
});
