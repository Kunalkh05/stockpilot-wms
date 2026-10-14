import { MovementType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../types/index.js';
import { AuditService } from './AuditService.js';

export class InventoryService {
  /**
   * Helper to fetch or create an inventory balance record in a transaction.
   */
  static async getOrCreateBalance(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    locationId: string,
    productId: string,
    lotId?: string | null
  ) {
    let balance = await tx.inventoryBalance.findFirst({
      where: {
        warehouseId,
        locationId,
        productId,
        lotId: lotId || null,
      },
    });

    if (!balance) {
      balance = await tx.inventoryBalance.create({
        data: {
          warehouseId,
          locationId,
          productId,
          lotId: lotId || null,
          onHand: 0,
          reserved: 0,
          damaged: 0,
        },
      });
    }

    return balance;
  }

  /**
   * Lists inventory balances across warehouses and locations with rich filtering.
   */
  static async listBalances(query: {
    warehouseId?: string;
    locationId?: string;
    categoryId?: string;
    search?: string;
    lowStockOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryBalanceWhereInput = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.locationId) where.locationId = query.locationId;

    if (query.categoryId || query.search) {
      where.product = {};
      if (query.categoryId) where.product.categoryId = query.categoryId;
      if (query.search) {
        where.product.OR = [
          { sku: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
          { barcode: { contains: query.search, mode: 'insensitive' } },
        ];
      }
    }

    const [rawBalances, total] = await Promise.all([
      prisma.inventoryBalance.findMany({
        where,
        skip,
        take: limit,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          location: {
            select: {
              id: true,
              code: true,
              zone: true,
              aisle: true,
              rack: true,
              shelf: true,
              bin: true,
              type: true,
              status: true,
            },
          },
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              uom: true,
              minReorderPoint: true,
              targetStock: true,
              unitCost: true,
              unitPrice: true,
              category: { select: { id: true, name: true, code: true } },
            },
          },
          lot: {
            select: {
              id: true,
              lotNumber: true,
              expiryDate: true,
              manufactureDate: true,
              status: true,
            },
          },
        },
        orderBy: [{ warehouse: { code: 'asc' } }, { location: { code: 'asc' } }],
      }),
      prisma.inventoryBalance.count({ where }),
    ]);

    const enriched = rawBalances.map((b) => {
      const available = Math.max(0, b.onHand - b.reserved - b.damaged);
      const isLowStock = available <= b.product.minReorderPoint;
      return {
        ...b,
        available,
        isLowStock,
        valuation: b.onHand * b.product.unitCost,
      };
    });

    const items = query.lowStockOnly ? enriched.filter((b) => b.isLowStock) : enriched;

    return {
      items,
      total: query.lowStockOnly ? items.length : total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single product inventory overview across all locations.
   */
  static async getProductStockDetails(productId: string, warehouseId?: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        lots: { orderBy: { expiryDate: 'asc' } },
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    const where: Prisma.InventoryBalanceWhereInput = { productId };
    if (warehouseId) where.warehouseId = warehouseId;

    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: true,
        location: true,
        lot: true,
      },
      orderBy: { location: { code: 'asc' } },
    });

    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        lot: true,
        user: { select: { id: true, fullName: true, role: true } },
      },
    });

    let totalOnHand = 0;
    let totalReserved = 0;
    let totalDamaged = 0;

    balances.forEach((b) => {
      totalOnHand += b.onHand;
      totalReserved += b.reserved;
      totalDamaged += b.damaged;
    });

    const totalAvailable = Math.max(0, totalOnHand - totalReserved - totalDamaged);

    return {
      product,
      balances: balances.map((b) => ({
        ...b,
        available: Math.max(0, b.onHand - b.reserved - b.damaged),
      })),
      summary: {
        totalOnHand,
        totalReserved,
        totalDamaged,
        totalAvailable,
        minReorderPoint: product.minReorderPoint,
        targetStock: product.targetStock,
        isLowStock: totalAvailable <= product.minReorderPoint,
        valuation: totalOnHand * product.unitCost,
      },
      recentMovements: movements,
    };
  }

  /**
   * Adjust inventory balance (Cycle count / damage / write-off) with strict invariants.
   */
  static async adjustStock(data: {
    warehouseId: string;
    locationId: string;
    productId: string;
    lotId?: string | null;
    newOnHand: number;
    reason: string;
    userId: string;
  }) {
    if (data.newOnHand < 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'On-hand quantity cannot be negative');
    }
    if (!data.reason || data.reason.trim().length < 3) {
      throw new AppError(400, 'REASON_REQUIRED', 'A valid documented reason is required for manual stock adjustments');
    }

    return await prisma.$transaction(async (tx) => {
      const balance = await this.getOrCreateBalance(
        tx,
        data.warehouseId,
        data.locationId,
        data.productId,
        data.lotId
      );

      const oldOnHand = balance.onHand;
      const delta = data.newOnHand - oldOnHand;

      if (delta === 0) {
        return balance;
      }

      // Check if newOnHand would be less than current reserved stock
      if (data.newOnHand < balance.reserved + balance.damaged) {
        throw new AppError(
          409,
          'RESERVATION_CONFLICT',
          `Cannot reduce on-hand to ${data.newOnHand} as ${balance.reserved} units are currently reserved and ${balance.damaged} are marked damaged`
        );
      }

      const updated = await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: { onHand: data.newOnHand },
      });

      const movementType =
        delta > 0 ? MovementType.CYCLE_COUNT_ADJUSTMENT : MovementType.CYCLE_COUNT_ADJUSTMENT;

      await tx.stockMovement.create({
        data: {
          referenceType: movementType,
          referenceId: `ADJ-${Date.now()}`,
          productId: data.productId,
          lotId: data.lotId || null,
          sourceLocationId: delta < 0 ? data.locationId : null,
          destinationLocationId: delta > 0 ? data.locationId : null,
          quantity: Math.abs(delta),
          balanceBefore: oldOnHand,
          balanceAfter: data.newOnHand,
          userId: data.userId,
          reason: `Manual Cycle Count Adjustment: ${data.reason.trim()} (${delta > 0 ? '+' : ''}${delta})`,
        },
      });

      await AuditService.log('STOCK_ADJUSTMENT', 'InventoryBalance', balance.id, data.userId, {
        productId: data.productId,
        locationId: data.locationId,
        oldOnHand,
        newOnHand: data.newOnHand,
        delta,
        reason: data.reason,
      });

      return {
        ...updated,
        available: Math.max(0, updated.onHand - updated.reserved - updated.damaged),
      };
    });
  }

  /**
   * Transfer stock between bins/locations atomically.
   */
  static async transferStock(data: {
    warehouseId: string;
    sourceLocationId: string;
    destLocationId: string;
    productId: string;
    lotId?: string | null;
    quantity: number;
    userId: string;
    reason?: string;
  }) {
    if (data.quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Transfer quantity must be greater than zero');
    }
    if (data.sourceLocationId === data.destLocationId) {
      throw new AppError(400, 'SAME_LOCATION', 'Source and destination locations cannot be identical');
    }

    return await prisma.$transaction(async (tx) => {
      // Validate destination location is active
      const destLocation = await tx.location.findUnique({
        where: { id: data.destLocationId },
      });
      if (!destLocation || destLocation.status !== 'ACTIVE') {
        throw new AppError(400, 'DESTINATION_INACTIVE', 'Destination location is not active or does not exist');
      }

      // Fetch source balance with check
      const sourceBalance = await tx.inventoryBalance.findFirst({
        where: {
          warehouseId: data.warehouseId,
          locationId: data.sourceLocationId,
          productId: data.productId,
          lotId: data.lotId || null,
        },
      });

      if (!sourceBalance) {
        throw new AppError(404, 'STOCK_NOT_FOUND', 'No stock balance found at source location for this product');
      }

      const availableAtSource = sourceBalance.onHand - sourceBalance.reserved - sourceBalance.damaged;
      if (availableAtSource < data.quantity) {
        throw new AppError(
          409,
          'INSUFFICIENT_AVAILABLE_STOCK',
          `Cannot transfer ${data.quantity} units; only ${availableAtSource} unreserved units available at source location`
        );
      }

      // Debit source
      const updatedSource = await tx.inventoryBalance.update({
        where: { id: sourceBalance.id },
        data: { onHand: sourceBalance.onHand - data.quantity },
      });

      // Credit destination
      const destBalance = await this.getOrCreateBalance(
        tx,
        data.warehouseId,
        data.destLocationId,
        data.productId,
        data.lotId
      );

      const updatedDest = await tx.inventoryBalance.update({
        where: { id: destBalance.id },
        data: { onHand: destBalance.onHand + data.quantity },
      });

      // Record atomic movement
      await tx.stockMovement.create({
        data: {
          referenceType: MovementType.TRANSFER,
          referenceId: `TRF-${Date.now()}`,
          productId: data.productId,
          lotId: data.lotId || null,
          sourceLocationId: data.sourceLocationId,
          destinationLocationId: data.destLocationId,
          quantity: data.quantity,
          balanceBefore: sourceBalance.onHand,
          balanceAfter: updatedSource.onHand,
          userId: data.userId,
          reason: data.reason || 'Bin-to-bin relocation',
        },
      });

      await AuditService.log('STOCK_TRANSFER', 'InventoryBalance', sourceBalance.id, data.userId, {
        sourceLocationId: data.sourceLocationId,
        destLocationId: data.destLocationId,
        productId: data.productId,
        quantity: data.quantity,
      });

      return {
        source: {
          ...updatedSource,
          available: Math.max(0, updatedSource.onHand - updatedSource.reserved - updatedSource.damaged),
        },
        destination: {
          ...updatedDest,
          available: Math.max(0, updatedDest.onHand - updatedDest.reserved - updatedDest.damaged),
        },
      };
    });
  }

  /**
   * Query movement ledger with filters.
   */
  static async listMovements(query: {
    productId?: string;
    referenceType?: MovementType;
    referenceId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};
    if (query.productId) where.productId = query.productId;
    if (query.referenceType) where.referenceType = query.referenceType;
    if (query.referenceId) where.referenceId = { contains: query.referenceId, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, sku: true, name: true, uom: true } },
          lot: { select: { id: true, lotNumber: true, expiryDate: true } },
          sourceLocation: { select: { id: true, code: true, type: true } },
          destinationLocation: { select: { id: true, code: true, type: true } },
          user: { select: { id: true, fullName: true, role: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
