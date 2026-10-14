import { MovementType, PickTaskStatus, Prisma, ReservationStatus, SOStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../types/index.js';
import { AuditService } from './AuditService.js';

export class OutboundService {
  /**
   * List customer sales orders with filters and pagination.
   */
  static async listSalesOrders(query: {
    warehouseId?: string;
    status?: SOStatus;
    customerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          warehouse: { select: { id: true, code: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true, uom: true } },
            },
          },
          pickTasks: { select: { id: true, taskNumber: true, status: true } },
          packages: true,
          shipments: true,
        },
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Create a new sales order.
   */
  static async createSalesOrder(
    userId: string,
    data: {
      customerId: string;
      warehouseId: string;
      requiredDate?: string;
      shippingCarrier?: string;
      items: Array<{
        productId: string;
        requestedQty: number;
        unitPrice: number;
      }>;
    }
  ) {
    if (!data.items || data.items.length === 0) {
      throw new AppError(400, 'ITEMS_REQUIRED', 'Sales order must have at least one line item');
    }

    const count = await prisma.salesOrder.count();
    const orderNumber = `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const order = await prisma.salesOrder.create({
      data: {
        orderNumber,
        customerId: data.customerId,
        warehouseId: data.warehouseId,
        status: SOStatus.PENDING,
        requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
        shippingCarrier: data.shippingCarrier || 'Standard Ground',
        createdById: userId,
        items: {
          create: data.items.map((it) => ({
            productId: it.productId,
            requestedQty: it.requestedQty,
            allocatedQty: 0,
            pickedQty: 0,
            packedQty: 0,
            unitPrice: it.unitPrice,
          })),
        },
      },
      include: {
        customer: true,
        warehouse: true,
        items: { include: { product: true } },
      },
    });

    await AuditService.log('SO_CREATED', 'SalesOrder', order.id, userId, {
      orderNumber: order.orderNumber,
      itemCount: data.items.length,
    });

    return order;
  }

  /**
   * Allocate inventory to a Sales Order: atomic reservation with concurrency protection.
   */
  static async allocateOrder(orderId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
        },
      });

      if (!order) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Sales order not found');
      }

      if (order.status !== SOStatus.PENDING) {
        throw new AppError(400, 'INVALID_STATUS', `Cannot allocate order in status '${order.status}'`);
      }

      // Check stock availability for all items before applying reservations
      for (const item of order.items) {
        const balances = await tx.inventoryBalance.findMany({
          where: {
            warehouseId: order.warehouseId,
            productId: item.productId,
          },
          include: { location: true },
        });

        const totalAvailable = balances
          .filter((b) => b.location.type === 'STORAGE' || b.location.type === 'PICKING')
          .reduce((sum, b) => sum + Math.max(0, b.onHand - b.reserved - b.damaged), 0);

        if (totalAvailable < item.requestedQty) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `Insufficient available stock for SKU ${item.product.sku}. Requested: ${item.requestedQty}, Available: ${totalAvailable}`
          );
        }
      }

      // Reserve stock line by line across eligible bins
      const reservationRecords: Array<{
        salesOrderId: string;
        salesOrderItemId: string;
        productId: string;
        warehouseId: string;
        locationId: string;
        lotId: string | null;
        reservedQty: number;
      }> = [];

      for (const item of order.items) {
        let remainingToReserve = item.requestedQty;

        const candidateBalances = await tx.inventoryBalance.findMany({
          where: {
            warehouseId: order.warehouseId,
            productId: item.productId,
          },
          include: {
            location: true,
            lot: true,
          },
          orderBy: [
            { lot: { expiryDate: 'asc' } }, // FEFO prioritisation
            { onHand: 'desc' },
          ],
        });

        for (const balance of candidateBalances) {
          if (remainingToReserve <= 0) break;
          if (balance.location.type !== 'STORAGE' && balance.location.type !== 'PICKING') continue;

          const available = Math.max(0, balance.onHand - balance.reserved - balance.damaged);
          if (available <= 0) continue;

          const qtyToReserve = Math.min(available, remainingToReserve);

          // Atomic conditional update ensuring concurrency protection against overselling
          const affected = await tx.$executeRaw`
            UPDATE inventory_balances
            SET reserved = reserved + ${qtyToReserve}, updated_at = NOW()
            WHERE id = ${balance.id} AND (on_hand - reserved - damaged) >= ${qtyToReserve}
          `;

          if (affected === 0) {
            throw new AppError(
              409,
              'INSUFFICIENT_STOCK',
              `Stock in bin ${balance.locationId} was claimed by a concurrent transaction`
            );
          }

          reservationRecords.push({
            salesOrderId: order.id,
            salesOrderItemId: item.id,
            productId: item.productId,
            warehouseId: order.warehouseId,
            locationId: balance.locationId,
            lotId: balance.lotId || null,
            reservedQty: qtyToReserve,
          });

          remainingToReserve -= qtyToReserve;
        }

        await tx.salesOrderItem.update({
          where: { id: item.id },
          data: { allocatedQty: item.requestedQty },
        });
      }

      // Create Reservation records
      await tx.stockReservation.createMany({
        data: reservationRecords.map((r) => ({
          ...r,
          status: ReservationStatus.ACTIVE,
        })),
      });

      // Generate Pick Task and Items
      const pickCount = await tx.pickTask.count();
      const taskNumber = `PCK-${Date.now().toString().slice(-6)}-${String(pickCount + 1).padStart(3, '0')}`;

      const pickTask = await tx.pickTask.create({
        data: {
          taskNumber,
          salesOrderId: order.id,
          status: PickTaskStatus.PENDING,
          items: {
            create: reservationRecords.map((r) => ({
              salesOrderItemId: r.salesOrderItemId,
              productId: r.productId,
              locationId: r.locationId,
              lotId: r.lotId,
              targetQty: r.reservedQty,
              pickedQty: 0,
            })),
          },
        },
      });

      // Update Order Status
      const updatedOrder = await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: SOStatus.ALLOCATED },
        include: {
          items: { include: { product: true } },
          pickTasks: true,
          stockReservations: true,
        },
      });

      await AuditService.log('SO_ALLOCATED', 'SalesOrder', order.id, userId, {
        orderNumber: order.orderNumber,
        pickTaskId: pickTask.id,
      });

      return updatedOrder;
    });
  }

  /**
   * List pick tasks.
   */
  static async listPickTasks(query: {
    warehouseId?: string;
    status?: PickTaskStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PickTaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) {
      where.salesOrder = { warehouseId: query.warehouseId };
    }

    const [tasks, total] = await Promise.all([
      prisma.pickTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          salesOrder: {
            select: { id: true, orderNumber: true, customer: { select: { name: true } } },
          },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true, uom: true } },
              location: { select: { id: true, code: true, zone: true, aisle: true } },
              lot: { select: { id: true, lotNumber: true } },
            },
          },
          assignedTo: { select: { id: true, fullName: true } },
        },
      }),
      prisma.pickTask.count({ where }),
    ]);

    return { tasks, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Confirm picked item with discrepancy handling.
   */
  static async confirmPickItem(
    pickTaskId: string,
    pickTaskItemId: string,
    pickedQty: number,
    discrepancyReason?: string,
    userId?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.pickTaskItem.findUnique({
        where: { id: pickTaskItemId },
        include: { pickTask: true },
      });

      if (!item) {
        throw new AppError(404, 'PICK_ITEM_NOT_FOUND', 'Pick task item not found');
      }

      if (pickedQty < 0 || pickedQty > item.targetQty) {
        throw new AppError(400, 'INVALID_PICK_QTY', `Picked quantity must be between 0 and ${item.targetQty}`);
      }

      const updatedItem = await tx.pickTaskItem.update({
        where: { id: pickTaskItemId },
        data: {
          pickedQty,
          discrepancyReason: discrepancyReason || null,
        },
      });

      // Update SalesOrderItem picked counter
      await tx.salesOrderItem.update({
        where: { id: item.salesOrderItemId },
        data: { pickedQty: { increment: pickedQty } },
      });

      // Check if all items in the pick task are completed
      const allItems = await tx.pickTaskItem.findMany({
        where: { pickTaskId },
      });

      const isCompleted = allItems.every((it) => it.id === pickTaskItemId || it.pickedQty > 0);
      const hasDiscrepancy = allItems.some(
        (it) => (it.id === pickTaskItemId ? pickedQty : it.pickedQty) < it.targetQty
      );

      if (isCompleted) {
        await tx.pickTask.update({
          where: { id: pickTaskId },
          data: {
            status: hasDiscrepancy ? PickTaskStatus.SHORT_PICKED : PickTaskStatus.COMPLETED,
            completedAt: new Date(),
            assignedToId: userId || null,
          },
        });

        await tx.salesOrder.update({
          where: { id: item.pickTask.salesOrderId },
          data: { status: SOStatus.PICKED },
        });
      }

      return updatedItem;
    });
  }

  /**
   * Create Package for an order (Packing Station).
   */
  static async packOrder(
    orderId: string,
    userId: string,
    data: { weightKg: number; boxType: string }
  ) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Sales order not found');
      }

      if (order.status !== SOStatus.PICKED && order.status !== SOStatus.ALLOCATED) {
        throw new AppError(400, 'ORDER_NOT_READY_FOR_PACKING', `Cannot pack order with status '${order.status}'`);
      }

      const pkgCount = await tx.package.count();
      const packageNumber = `PKG-${Date.now().toString().slice(-6)}-${String(pkgCount + 1).padStart(3, '0')}`;
      const trackingNumber = `TRK-${Date.now().toString().slice(-8)}`;

      const pkg = await tx.package.create({
        data: {
          packageNumber,
          salesOrderId: orderId,
          weightKg: data.weightKg || 1.5,
          boxType: data.boxType || 'STANDARD_CORRUGATED',
          packedById: userId,
          trackingNumber,
        },
      });

      await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          status: SOStatus.PACKED,
          trackingNumber,
        },
      });

      await AuditService.log('SO_PACKED', 'Package', pkg.id, userId, {
        packageNumber,
        orderId,
      });

      return pkg;
    });
  }

  /**
   * Dispatch / Ship Order:
   * Decrements onHand, releases reserved counter, records immutable StockMovement.
   */
  static async dispatchOrder(
    orderId: string,
    userId: string,
    data: { carrier: string; trackingNumber?: string }
  ) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          packages: true,
          stockReservations: {
            where: { status: ReservationStatus.ACTIVE },
          },
        },
      });

      if (!order) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Sales order not found');
      }

      if (order.status !== SOStatus.PACKED) {
        throw new AppError(
          400,
          'ORDER_NOT_PACKED',
          `Order must be in PACKED status prior to dispatch. Current status: '${order.status}'`
        );
      }

      const trackingNumber =
        data.trackingNumber || order.trackingNumber || `SP-${Date.now().toString().slice(-8)}`;
      const carrier = data.carrier || order.shippingCarrier || 'FedEx Express';

      // Relieve inventory balances and record movements
      for (const res of order.stockReservations) {
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            warehouseId: res.warehouseId,
            locationId: res.locationId,
            productId: res.productId,
            lotId: res.lotId || null,
          },
        });

        if (!balance) {
          throw new AppError(500, 'BALANCE_DESYNC', 'Inventory balance record missing for active reservation');
        }

        const newOnHand = Math.max(0, balance.onHand - res.reservedQty);
        const newReserved = Math.max(0, balance.reserved - res.reservedQty);

        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            onHand: newOnHand,
            reserved: newReserved,
          },
        });

        // Mark reservation consumed
        await tx.stockReservation.update({
          where: { id: res.id },
          data: { status: ReservationStatus.CONSUMED },
        });

        // Record immutable stock movement
        await tx.stockMovement.create({
          data: {
            referenceType: MovementType.ORDER_SHIP,
            referenceId: order.orderNumber,
            productId: res.productId,
            lotId: res.lotId,
            sourceLocationId: res.locationId,
            destinationLocationId: null,
            quantity: res.reservedQty,
            balanceBefore: balance.onHand,
            balanceAfter: newOnHand,
            userId,
            reason: `Order Dispatch ${order.orderNumber} via ${carrier} (${trackingNumber})`,
          },
        });
      }

      // Create Shipment record
      const shipCount = await tx.shipment.count();
      const shipmentNumber = `SHP-${Date.now().toString().slice(-6)}-${String(shipCount + 1).padStart(3, '0')}`;

      const shipment = await tx.shipment.create({
        data: {
          shipmentNumber,
          salesOrderId: order.id,
          packageId: order.packages[0]?.id || null,
          carrier,
          trackingNumber,
          dispatchedById: userId,
          dispatchedAt: new Date(),
        },
      });

      // Update Order to SHIPPED
      const updatedOrder = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: SOStatus.SHIPPED,
          shippingCarrier: carrier,
          trackingNumber,
        },
      });

      await AuditService.log('SO_DISPATCHED', 'Shipment', shipment.id, userId, {
        shipmentNumber,
        orderNumber: order.orderNumber,
        trackingNumber,
      });

      return {
        order: updatedOrder,
        shipment,
      };
    });
  }

  /**
   * Cancel order and safely release any active reservations.
   */
  static async cancelOrder(orderId: string, userId: string, reason: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          stockReservations: { where: { status: ReservationStatus.ACTIVE } },
        },
      });

      if (!order) {
        throw new AppError(404, 'ORDER_NOT_FOUND', 'Sales order not found');
      }

      if (order.status === SOStatus.SHIPPED) {
        throw new AppError(400, 'CANNOT_CANCEL_SHIPPED', 'Cannot cancel an order that has already been shipped');
      }

      // Release active reservations back to available stock
      for (const res of order.stockReservations) {
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            warehouseId: res.warehouseId,
            locationId: res.locationId,
            productId: res.productId,
            lotId: res.lotId || null,
          },
        });

        if (balance) {
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              reserved: Math.max(0, balance.reserved - res.reservedQty),
            },
          });
        }

        await tx.stockReservation.update({
          where: { id: res.id },
          data: { status: ReservationStatus.RELEASED },
        });
      }

      // Cancel any pending pick tasks
      await tx.pickTask.updateMany({
        where: {
          salesOrderId: order.id,
          status: { in: [PickTaskStatus.PENDING, PickTaskStatus.IN_PROGRESS] },
        },
        data: { status: PickTaskStatus.CANCELLED },
      });

      const updated = await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: SOStatus.CANCELLED },
      });

      await AuditService.log('SO_CANCELLED', 'SalesOrder', order.id, userId, {
        orderNumber: order.orderNumber,
        reason,
      });

      return updated;
    });
  }
}
