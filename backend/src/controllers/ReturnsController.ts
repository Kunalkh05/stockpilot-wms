import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReturnDisposition, ReturnStatus, MovementType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest, ApiResponse, AppError } from '../types/index.js';
import { AuditService } from '../services/AuditService.js';
import { InventoryService } from '../services/InventoryService.js';

export const createReturnSchema = z.object({
  customerId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  salesOrderId: z.string().uuid().optional(),
  reason: z.string().min(3),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      expectedQty: z.number().int().positive(),
    })
  ).min(1),
});

export const inspectReturnSchema = z.object({
  items: z.array(
    z.object({
      returnOrderItemId: z.string().uuid(),
      productId: z.string().uuid(),
      receivedQty: z.number().int().nonnegative(),
      disposition: z.nativeEnum(ReturnDisposition),
      targetLocationId: z.string().uuid().optional(),
      notes: z.string().optional(),
    })
  ).min(1),
});

export class ReturnsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const status = req.query.status as ReturnStatus | undefined;

      const where: any = {};
      if (warehouseId) where.warehouseId = warehouseId;
      if (status) where.status = status;

      const returns = await prisma.returnOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          salesOrder: { select: { orderNumber: true } },
          items: {
            include: {
              product: { select: { sku: true, name: true } },
              targetLocation: { select: { code: true } },
            },
          },
        },
      });

      const response: ApiResponse = { success: true, data: returns };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const count = await prisma.returnOrder.count();
      const rmaNumber = `RMA-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

      const returnOrder = await prisma.returnOrder.create({
        data: {
          rmaNumber,
          customerId: req.body.customerId,
          warehouseId: req.body.warehouseId,
          salesOrderId: req.body.salesOrderId || null,
          reason: req.body.reason,
          createdById: req.user!.userId,
          status: ReturnStatus.REQUESTED,
          items: {
            create: req.body.items.map((it: any) => ({
              productId: it.productId,
              expectedQty: it.expectedQty,
              receivedQty: 0,
              disposition: ReturnDisposition.RESTOCK,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      await AuditService.log('RMA_CREATED', 'ReturnOrder', returnOrder.id, req.user!.userId, {
        rmaNumber,
      });

      const response: ApiResponse = { success: true, data: returnOrder };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async inspect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { items } = req.body;

      const returnOrder = await prisma.returnOrder.findUnique({
        where: { id },
      });

      if (!returnOrder) {
        throw new AppError(404, 'RMA_NOT_FOUND', 'Return order not found');
      }

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await tx.returnOrderItem.update({
            where: { id: item.returnOrderItemId },
            data: {
              receivedQty: item.receivedQty,
              disposition: item.disposition,
              targetLocationId: item.targetLocationId || null,
              notes: item.notes || null,
            },
          });

          // If restocked to a location, credit inventory atomically
          if (item.disposition === ReturnDisposition.RESTOCK && item.targetLocationId && item.receivedQty > 0) {
            const balance = await InventoryService.getOrCreateBalance(
              tx,
              returnOrder.warehouseId,
              item.targetLocationId,
              item.productId,
              null
            );

            await tx.inventoryBalance.update({
              where: { id: balance.id },
              data: { onHand: balance.onHand + item.receivedQty },
            });

            await tx.stockMovement.create({
              data: {
                referenceType: MovementType.RETURN_RESTOCK,
                referenceId: returnOrder.rmaNumber,
                productId: item.productId,
                destinationLocationId: item.targetLocationId,
                quantity: item.receivedQty,
                balanceBefore: balance.onHand,
                balanceAfter: balance.onHand + item.receivedQty,
                userId: req.user!.userId,
                reason: `Customer Return RMA Restock ${returnOrder.rmaNumber}`,
              },
            });
          } else if (item.disposition === ReturnDisposition.QUARANTINE && item.targetLocationId && item.receivedQty > 0) {
            const balance = await InventoryService.getOrCreateBalance(
              tx,
              returnOrder.warehouseId,
              item.targetLocationId,
              item.productId,
              null
            );

            await tx.inventoryBalance.update({
              where: { id: balance.id },
              data: {
                onHand: balance.onHand + item.receivedQty,
                damaged: balance.damaged + item.receivedQty,
              },
            });

            await tx.stockMovement.create({
              data: {
                referenceType: MovementType.DAMAGE_WRITE_OFF,
                referenceId: returnOrder.rmaNumber,
                productId: item.productId,
                destinationLocationId: item.targetLocationId,
                quantity: item.receivedQty,
                balanceBefore: balance.onHand,
                balanceAfter: balance.onHand + item.receivedQty,
                userId: req.user!.userId,
                reason: `Customer Return Quarantine Inspection ${returnOrder.rmaNumber}`,
              },
            });
          }
        }

        await tx.returnOrder.update({
          where: { id: returnOrder.id },
          data: { status: ReturnStatus.INSPECTED },
        });
      });

      await AuditService.log('RMA_INSPECTED', 'ReturnOrder', returnOrder.id, req.user!.userId, {
        rmaNumber: returnOrder.rmaNumber,
      });

      const response: ApiResponse = {
        success: true,
        data: { message: 'Return inspected and inventory reconciled' },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}
