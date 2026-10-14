import { PickTaskStatus, POStatus, SOStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export class ReportService {
  /**
   * Comprehensive operational dashboard metrics.
   */
  static async getDashboardSummary(warehouseId?: string) {
    const whereBalance: Prisma.InventoryBalanceWhereInput = {};
    const whereOrder: Prisma.SalesOrderWhereInput = {};
    const wherePO: Prisma.PurchaseOrderWhereInput = {};
    const whereTask: Prisma.PickTaskWhereInput = {};
    const wherePutAway: Prisma.PutAwayTaskWhereInput = {};

    if (warehouseId) {
      whereBalance.warehouseId = warehouseId;
      whereOrder.warehouseId = warehouseId;
      wherePO.warehouseId = warehouseId;
      whereTask.salesOrder = { warehouseId };
      wherePutAway.sourceLocation = { warehouseId };
    }

    // 1. Balances and valuation
    const balances = await prisma.inventoryBalance.findMany({
      where: whereBalance,
      include: {
        product: { select: { unitCost: true, minReorderPoint: true, category: { select: { name: true } } } },
      },
    });

    let totalOnHandUnits = 0;
    let totalReservedUnits = 0;
    let totalDamagedUnits = 0;
    let totalSellableUnits = 0;
    let totalValuation = 0;
    let lowStockCount = 0;

    const categoryMap: Record<string, { units: number; valuation: number }> = {};

    // Group by product to correctly assess SKU-level low stock
    const productStockMap: Record<string, { available: number; minReorder: number }> = {};

    for (const b of balances) {
      totalOnHandUnits += b.onHand;
      totalReservedUnits += b.reserved;
      totalDamagedUnits += b.damaged;

      const avail = Math.max(0, b.onHand - b.reserved - b.damaged);
      totalSellableUnits += avail;

      const val = b.onHand * b.product.unitCost;
      totalValuation += val;

      const catName = b.product.category?.name || 'General';
      if (!categoryMap[catName]) {
        categoryMap[catName] = { units: 0, valuation: 0 };
      }
      categoryMap[catName].units += b.onHand;
      categoryMap[catName].valuation += val;

      if (!productStockMap[b.productId]) {
        productStockMap[b.productId] = {
          available: 0,
          minReorder: b.product.minReorderPoint,
        };
      }
      productStockMap[b.productId].available += avail;
    }

    for (const p of Object.values(productStockMap)) {
      if (p.available <= p.minReorder) {
        lowStockCount++;
      }
    }

    // 2. Open Orders & Fulfillment stats
    const [openOrdersCount, awaitingPickingCount, openPOsCount, pendingPutAwaysCount] = await Promise.all([
      prisma.salesOrder.count({
        where: {
          ...whereOrder,
          status: { in: [SOStatus.PENDING, SOStatus.ALLOCATED, SOStatus.PICKING, SOStatus.PACKED] },
        },
      }),
      prisma.pickTask.count({
        where: {
          ...whereTask,
          status: { in: [PickTaskStatus.PENDING, PickTaskStatus.IN_PROGRESS] },
        },
      }),
      prisma.purchaseOrder.count({
        where: {
          ...wherePO,
          status: { in: [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED] },
        },
      }),
      prisma.putAwayTask.count({
        where: {
          ...wherePutAway,
          status: 'PENDING',
        },
      }),
    ]);

    // 3. Recent stock movements
    const recentMovements = await prisma.stockMovement.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { sku: true, name: true } },
        sourceLocation: { select: { code: true } },
        destinationLocation: { select: { code: true } },
        user: { select: { fullName: true } },
      },
    });

    // 4. Priority Tasks feed
    const priorityTasks = [
      ...(await prisma.pickTask.findMany({
        where: { ...whereTask, status: PickTaskStatus.PENDING },
        take: 4,
        include: { salesOrder: { select: { orderNumber: true } } },
      })).map((t) => ({
        id: t.id,
        type: 'PICK',
        title: `Pick Task ${t.taskNumber} for Order ${t.salesOrder.orderNumber}`,
        priority: 'HIGH',
        status: t.status,
        createdAt: t.createdAt,
      })),
      ...(await prisma.putAwayTask.findMany({
        where: { ...wherePutAway, status: 'PENDING' },
        take: 4,
        include: { product: { select: { sku: true } } },
      })).map((p) => ({
        id: p.id,
        type: 'PUTAWAY',
        title: `Put-away ${p.quantity}x ${p.product.sku} (${p.taskNumber})`,
        priority: 'MEDIUM',
        status: p.status,
        createdAt: p.createdAt,
      })),
    ];

    return {
      kpi: {
        totalSellableUnits,
        totalOnHandUnits,
        totalReservedUnits,
        totalDamagedUnits,
        totalValuation,
        openOrdersCount,
        awaitingPickingCount,
        receiptsAwaitingProcessingCount: openPOsCount,
        pendingPutAwaysCount,
        lowStockCount,
      },
      categoryBreakdown: Object.entries(categoryMap).map(([category, stats]) => ({
        category,
        units: stats.units,
        valuation: stats.valuation,
      })),
      recentMovements,
      priorityTasks,
    };
  }

  /**
   * Inventory Valuation Report.
   */
  static async getValuationReport(warehouseId?: string) {
    const where: Prisma.InventoryBalanceWhereInput = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: { select: { code: true, name: true } },
        product: {
          include: { category: true },
        },
      },
      orderBy: { product: { sku: 'asc' } },
    });

    // Aggregate by SKU & warehouse
    const skuMap: Record<string, any> = {};

    for (const b of balances) {
      const key = `${b.warehouse.code}-${b.product.sku}`;
      if (!skuMap[key]) {
        skuMap[key] = {
          warehouse: b.warehouse.name,
          warehouseCode: b.warehouse.code,
          sku: b.product.sku,
          name: b.product.name,
          category: b.product.category?.name || 'Uncategorized',
          uom: b.product.uom,
          onHand: 0,
          reserved: 0,
          unitCost: b.product.unitCost,
          unitPrice: b.product.unitPrice,
        };
      }
      skuMap[key].onHand += b.onHand;
      skuMap[key].reserved += b.reserved;
    }

    const items = Object.values(skuMap).map((row) => ({
      ...row,
      available: Math.max(0, row.onHand - row.reserved),
      totalValuation: row.onHand * row.unitCost,
      potentialRevenue: row.onHand * row.unitPrice,
      margin:
        row.unitPrice > 0
          ? Math.round(((row.unitPrice - row.unitCost) / row.unitPrice) * 100)
          : 0,
    }));

    const totalValuation = items.reduce((sum, it) => sum + it.totalValuation, 0);

    return {
      totalValuation,
      totalItems: items.length,
      items,
    };
  }

  /**
   * Low Stock & Reorder Report.
   */
  static async getLowStockReport(warehouseId?: string) {
    const where: Prisma.InventoryBalanceWhereInput = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        warehouse: { select: { code: true, name: true } },
        product: {
          include: { category: true },
        },
      },
    });

    const productMap: Record<string, any> = {};

    for (const b of balances) {
      const key = `${b.warehouseId}-${b.productId}`;
      if (!productMap[key]) {
        productMap[key] = {
          warehouseId: b.warehouseId,
          warehouseName: b.warehouse.name,
          product: b.product,
          onHand: 0,
          reserved: 0,
          damaged: 0,
        };
      }
      productMap[key].onHand += b.onHand;
      productMap[key].reserved += b.reserved;
      productMap[key].damaged += b.damaged;
    }

    const lowStockList = [];

    for (const p of Object.values(productMap)) {
      const available = Math.max(0, p.onHand - p.reserved - p.damaged);
      if (available <= p.product.minReorderPoint) {
        const deficit = Math.max(0, p.product.targetStock - available);
        lowStockList.push({
          warehouse: p.warehouseName,
          sku: p.product.sku,
          name: p.product.name,
          category: p.product.category?.name,
          uom: p.product.uom,
          onHand: p.onHand,
          reserved: p.reserved,
          available,
          minReorderPoint: p.product.minReorderPoint,
          targetStock: p.product.targetStock,
          reorderDeficit: deficit,
          estimatedReorderCost: deficit * p.product.unitCost,
        });
      }
    }

    return {
      count: lowStockList.length,
      items: lowStockList.sort((a, b) => b.reorderDeficit - a.reorderDeficit),
    };
  }

  /**
   * Aging and Expiry Lot Report (FEFO inspection).
   */
  static async getLotExpiryReport(warehouseId?: string) {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const lots = await prisma.lot.findMany({
      include: {
        product: { select: { sku: true, name: true, uom: true } },
        inventoryBalances: {
          include: {
            warehouse: { select: { name: true, code: true } },
            location: { select: { code: true } },
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const reportItems: any[] = [];

    for (const lot of lots) {
      const relevantBalances = lot.inventoryBalances.filter(
        (b) => !warehouseId || b.warehouseId === warehouseId
      );

      const totalQty = relevantBalances.reduce((sum, b) => sum + b.onHand, 0);
      if (totalQty === 0) continue;

      let status = 'HEALTHY';
      let daysRemaining = null;

      if (lot.expiryDate) {
        const diffMs = lot.expiryDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          status = 'EXPIRED';
        } else if (daysRemaining <= 30) {
          status = 'EXPIRING_SOON';
        }
      }

      reportItems.push({
        lotNumber: lot.lotNumber,
        sku: lot.product.sku,
        productName: lot.product.name,
        manufactureDate: lot.manufactureDate,
        expiryDate: lot.expiryDate,
        daysRemaining,
        status,
        totalQuantity: totalQty,
        locations: relevantBalances.map((b) => `${b.location.code} (${b.onHand})`).join(', '),
      });
    }

    return {
      totalLots: reportItems.length,
      expiredCount: reportItems.filter((i) => i.status === 'EXPIRED').length,
      expiringSoonCount: reportItems.filter((i) => i.status === 'EXPIRING_SOON').length,
      items: reportItems,
    };
  }

  /**
   * Warehouse Bin Utilization Report.
   */
  static async getBinUtilization(warehouseId?: string) {
    const where: Prisma.LocationWhereInput = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const locations = await prisma.location.findMany({
      where,
      include: {
        warehouse: { select: { name: true, code: true } },
        inventoryBalances: true,
      },
      orderBy: [{ zone: 'asc' }, { code: 'asc' }],
    });

    const items = locations.map((loc) => {
      const storedUnits = loc.inventoryBalances.reduce((sum, b) => sum + b.onHand, 0);
      const utilization =
        loc.capacityUnits > 0 ? Math.min(100, Math.round((storedUnits / loc.capacityUnits) * 100)) : 0;

      return {
        id: loc.id,
        warehouse: loc.warehouse.name,
        code: loc.code,
        zone: loc.zone,
        aisle: loc.aisle,
        rack: loc.rack,
        shelf: loc.shelf,
        bin: loc.bin,
        type: loc.type,
        status: loc.status,
        capacityUnits: loc.capacityUnits,
        currentUnits: storedUnits,
        utilizationPercent: utilization,
      };
    });

    const avgUtilization =
      items.length > 0
        ? Math.round(items.reduce((s, i) => s + i.utilizationPercent, 0) / items.length)
        : 0;

    return {
      totalLocations: items.length,
      averageUtilization: avgUtilization,
      items,
    };
  }
}
