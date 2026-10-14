import { MovementType, POStatus, PutAwayStatus, ReceiptStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../types/index.js';
import { AuditService } from './AuditService.js';
import { InventoryService } from './InventoryService.js';

export class InboundService {
  /**
   * List purchase orders with filtering and pagination.
   */
  static async listPurchaseOrders(query: {
    warehouseId?: string;
    status?: POStatus | POStatus[] | string;
    supplierId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {};
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.status) {
      if (typeof query.status === 'string' && query.status.includes(',')) {
        where.status = { in: query.status.split(',').map((s) => s.trim()) as POStatus[] };
      } else if (Array.isArray(query.status)) {
        where.status = { in: query.status as POStatus[] };
      } else {
        where.status = query.status as POStatus;
      }
    }
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.search) {
      where.OR = [
        { poNumber: { contains: query.search, mode: 'insensitive' } },
        { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true, uom: true } },
            },
          },
          receipts: {
            select: { id: true, receiptNumber: true, status: true, createdAt: true },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Create a new purchase order in DRAFT or ORDERED state.
   */
  static async createPurchaseOrder(
    userId: string,
    data: {
      supplierId: string;
      warehouseId: string;
      expectedDate?: string;
      notes?: string;
      status?: POStatus;
      items: Array<{
        productId: string;
        expectedQty: number;
        unitCost: number;
      }>;
    }
  ) {
    if (!data.items || data.items.length === 0) {
      throw new AppError(400, 'ITEMS_REQUIRED', 'At least one line item is required for a purchase order');
    }

    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        status: data.status || POStatus.ORDERED,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        notes: data.notes,
        createdById: userId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            expectedQty: item.expectedQty,
            receivedQty: 0,
            unitCost: item.unitCost,
          })),
        },
      },
      include: {
        supplier: true,
        warehouse: true,
        items: { include: { product: true } },
      },
    });

    await AuditService.log('PO_CREATED', 'PurchaseOrder', po.id, userId, {
      poNumber: po.poNumber,
      itemCount: data.items.length,
    });

    return po;
  }

  /**
   * Receive items against a Purchase Order at inbound dock.
   * Idempotent: checks idempotencyKey to prevent duplicate inventory crediting on retries.
   */
  static async processReceipt(
    userId: string,
    data: {
      purchaseOrderId: string;
      warehouseId: string;
      receivingLocationId: string;
      idempotencyKey?: string;
      notes?: string;
      items: Array<{
        purchaseOrderItemId: string;
        productId: string;
        acceptedQty: number;
        damagedQty?: number;
        rejectedQty?: number;
        lotNumber?: string;
        expiryDate?: string;
        notes?: string;
      }>;
    }
  ) {
    // 1. Idempotency Check
    if (data.idempotencyKey) {
      const existingReceipt = await prisma.receipt.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: {
          items: true,
          putAwayTasks: true,
        },
      });
      if (existingReceipt) {
        return existingReceipt;
      }
    }

    return await prisma.$transaction(async (tx) => {
      // Validate PO
      const po = await tx.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: { items: true },
      });

      if (!po) {
        throw new AppError(404, 'PO_NOT_FOUND', 'Purchase order not found');
      }

      if (po.status === POStatus.CANCELLED || po.status === POStatus.RECEIVED) {
        throw new AppError(400, 'INVALID_PO_STATUS', `Cannot receive against PO with status '${po.status}'`);
      }

      // Generate receipt number
      const receiptCount = await tx.receipt.count();
      const receiptNumber = `RCV-${Date.now().toString().slice(-6)}-${String(receiptCount + 1).padStart(3, '0')}`;

      // Create Receipt
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          purchaseOrderId: data.purchaseOrderId,
          warehouseId: data.warehouseId,
          receivingLocationId: data.receivingLocationId,
          status: ReceiptStatus.CONFIRMED,
          receivedById: userId,
          idempotencyKey: data.idempotencyKey || null,
          notes: data.notes,
        },
      });

      // Find suitable storage locations in the warehouse for put-away suggestions
      const defaultStorageLocation = await tx.location.findFirst({
        where: {
          warehouseId: data.warehouseId,
          type: 'STORAGE',
          status: 'ACTIVE',
        },
      });

      let totalAccepted = 0;

      for (const item of data.items) {
        const accepted = Math.max(0, item.acceptedQty || 0);
        const damaged = Math.max(0, item.damagedQty || 0);
        const rejected = Math.max(0, item.rejectedQty || 0);

        totalAccepted += accepted;

        // Manage lot record if lot number provided
        let lotId: string | null = null;
        if (item.lotNumber) {
          let lot = await tx.lot.findFirst({
            where: { productId: item.productId, lotNumber: item.lotNumber },
          });
          if (!lot) {
            lot = await tx.lot.create({
              data: {
                productId: item.productId,
                lotNumber: item.lotNumber,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              },
            });
          }
          lotId = lot.id;
        }

        // Record receipt item
        await tx.receiptItem.create({
          data: {
            receiptId: receipt.id,
            purchaseOrderItemId: item.purchaseOrderItemId,
            productId: item.productId,
            lotNumber: item.lotNumber || null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            acceptedQty: accepted,
            damagedQty: damaged,
            rejectedQty: rejected,
            notes: item.notes,
          },
        });

        // Credit inventory in receiving bin for accepted quantities
        if (accepted > 0) {
          const balance = await InventoryService.getOrCreateBalance(
            tx,
            data.warehouseId,
            data.receivingLocationId,
            item.productId,
            lotId
          );

          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { onHand: balance.onHand + accepted },
          });

          await tx.stockMovement.create({
            data: {
              referenceType: MovementType.PURCHASE_RECEIPT,
              referenceId: receipt.receiptNumber,
              productId: item.productId,
              lotId,
              sourceLocationId: null,
              destinationLocationId: data.receivingLocationId,
              quantity: accepted,
              balanceBefore: balance.onHand,
              balanceAfter: balance.onHand + accepted,
              userId,
              reason: `PO Receipt ${po.poNumber}`,
            },
          });

          // Generate put-away task
          const taskCount = await tx.putAwayTask.count();
          const taskNumber = `PUT-${Date.now().toString().slice(-6)}-${String(taskCount + 1).padStart(3, '0')}`;

          await tx.putAwayTask.create({
            data: {
              taskNumber,
              receiptId: receipt.id,
              productId: item.productId,
              lotId,
              sourceLocationId: data.receivingLocationId,
              suggestedLocationId: defaultStorageLocation?.id || data.receivingLocationId,
              quantity: accepted,
              status: PutAwayStatus.PENDING,
            },
          });
        }

        // If damaged quantity exists, credit to receiving bin with damaged counter
        if (damaged > 0) {
          const balance = await InventoryService.getOrCreateBalance(
            tx,
            data.warehouseId,
            data.receivingLocationId,
            item.productId,
            lotId
          );

          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              onHand: balance.onHand + damaged,
              damaged: balance.damaged + damaged,
            },
          });

          await tx.stockMovement.create({
            data: {
              referenceType: MovementType.DAMAGE_WRITE_OFF,
              referenceId: receipt.receiptNumber,
              productId: item.productId,
              lotId,
              sourceLocationId: null,
              destinationLocationId: data.receivingLocationId,
              quantity: damaged,
              balanceBefore: balance.onHand,
              balanceAfter: balance.onHand + damaged,
              userId,
              reason: `Damaged in Transit during PO Receipt ${po.poNumber}`,
            },
          });
        }

        // Update PO item received quantity
        const totalReceivedLine = accepted + damaged;
        if (totalReceivedLine > 0) {
          await tx.purchaseOrderItem.update({
            where: { id: item.purchaseOrderItemId },
            data: { receivedQty: { increment: totalReceivedLine } },
          });
        }
      }

      // Check updated PO status
      const updatedPOItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });

      const allReceived = updatedPOItems.every((it) => it.receivedQty >= it.expectedQty);
      const anyReceived = updatedPOItems.some((it) => it.receivedQty > 0);

      const newStatus = allReceived
        ? POStatus.RECEIVED
        : anyReceived
        ? POStatus.PARTIALLY_RECEIVED
        : po.status;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus },
      });

      await AuditService.log('PO_RECEIPT', 'Receipt', receipt.id, userId, {
        receiptNumber: receipt.receiptNumber,
        poNumber: po.poNumber,
        totalAccepted,
      });

      return receipt;
    });
  }

  /**
   * List put-away tasks.
   */
  static async listPutAwayTasks(query: {
    warehouseId?: string;
    status?: PutAwayStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PutAwayTaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.warehouseId) {
      where.sourceLocation = { warehouseId: query.warehouseId };
    }

    const [tasks, total] = await Promise.all([
      prisma.putAwayTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, sku: true, name: true, uom: true } },
          lot: { select: { id: true, lotNumber: true, expiryDate: true } },
          sourceLocation: { select: { id: true, code: true, type: true } },
          suggestedLocation: { select: { id: true, code: true, type: true } },
          confirmedLocation: { select: { id: true, code: true, type: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      }),
      prisma.putAwayTask.count({ where }),
    ]);

    return { tasks, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Complete Put-Away task: transfers stock from receiving bin to target storage bin.
   */
  static async completePutAwayTask(
    taskId: string,
    confirmedLocationId: string,
    userId: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const task = await tx.putAwayTask.findUnique({
        where: { id: taskId },
        include: {
          sourceLocation: true,
          product: true,
        },
      });

      if (!task) {
        throw new AppError(404, 'TASK_NOT_FOUND', 'Put-away task not found');
      }

      if (task.status === PutAwayStatus.COMPLETED) {
        throw new AppError(400, 'TASK_ALREADY_COMPLETED', 'Put-away task has already been completed');
      }

      // Check destination location
      const destLocation = await tx.location.findUnique({
        where: { id: confirmedLocationId },
      });
      if (!destLocation || destLocation.status !== 'ACTIVE') {
        throw new AppError(400, 'INVALID_DESTINATION', 'Target storage location is not active');
      }

      // Debit source (receiving dock)
      const sourceBalance = await tx.inventoryBalance.findFirst({
        where: {
          warehouseId: task.sourceLocation.warehouseId,
          locationId: task.sourceLocationId,
          productId: task.productId,
          lotId: task.lotId || null,
        },
      });

      if (!sourceBalance || sourceBalance.onHand < task.quantity) {
        throw new AppError(
          409,
          'INSUFFICIENT_RECEIVING_STOCK',
          `Cannot put away: receiving location does not have ${task.quantity} units of this SKU`
        );
      }

      await tx.inventoryBalance.update({
        where: { id: sourceBalance.id },
        data: { onHand: sourceBalance.onHand - task.quantity },
      });

      // Credit destination
      const destBalance = await InventoryService.getOrCreateBalance(
        tx,
        task.sourceLocation.warehouseId,
        confirmedLocationId,
        task.productId,
        task.lotId
      );

      await tx.inventoryBalance.update({
        where: { id: destBalance.id },
        data: { onHand: destBalance.onHand + task.quantity },
      });

      // Record movement
      await tx.stockMovement.create({
        data: {
          referenceType: MovementType.PUTAWAY,
          referenceId: task.taskNumber,
          productId: task.productId,
          lotId: task.lotId || null,
          sourceLocationId: task.sourceLocationId,
          destinationLocationId: confirmedLocationId,
          quantity: task.quantity,
          balanceBefore: sourceBalance.onHand,
          balanceAfter: sourceBalance.onHand - task.quantity,
          userId,
          reason: `Put-Away Task Execution ${task.taskNumber}`,
        },
      });

      // Mark task completed
      const updatedTask = await tx.putAwayTask.update({
        where: { id: task.id },
        data: {
          status: PutAwayStatus.COMPLETED,
          confirmedLocationId,
          completedAt: new Date(),
          assignedToId: userId,
        },
      });

      await AuditService.log('PUTAWAY_COMPLETED', 'PutAwayTask', task.id, userId, {
        taskNumber: task.taskNumber,
        sourceLocationId: task.sourceLocationId,
        confirmedLocationId,
        quantity: task.quantity,
      });

      return updatedTask;
    });
  }
}
