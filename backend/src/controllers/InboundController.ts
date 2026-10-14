import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { POStatus, PutAwayStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { InboundService } from '../services/InboundService.js';
import { AuthenticatedRequest, ApiResponse, AppError } from '../types/index.js';

export const createSupplierSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  contactEmail: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('USA'),
});

export const createPOSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.nativeEnum(POStatus).optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      expectedQty: z.number().int().positive(),
      unitCost: z.number().nonnegative(),
    })
  ).min(1),
});

export const receiveItemsSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  receivingLocationId: z.string().uuid(),
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      purchaseOrderItemId: z.string().uuid(),
      productId: z.string().uuid(),
      acceptedQty: z.number().int().nonnegative(),
      damagedQty: z.number().int().nonnegative().optional(),
      rejectedQty: z.number().int().nonnegative().optional(),
      lotNumber: z.string().optional(),
      expiryDate: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1),
});

export const completePutAwaySchema = z.object({
  confirmedLocationId: z.string().uuid(),
});

export class InboundController {
  static async listPurchaseOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const status = req.query.status as POStatus | undefined;
      const supplierId = req.query.supplierId as string | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await InboundService.listPurchaseOrders({
        warehouseId,
        status,
        supplierId,
        search,
        page,
        limit,
      });

      const response: ApiResponse = {
        success: true,
        data: result.orders,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async createPurchaseOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await InboundService.createPurchaseOrder(req.user!.userId, req.body);
      const response: ApiResponse = { success: true, data: order };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async receive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const receipt = await InboundService.processReceipt(req.user!.userId, req.body);
      const response: ApiResponse = { success: true, data: receipt };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listPutAwayTasks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const status = req.query.status as PutAwayStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await InboundService.listPutAwayTasks({
        warehouseId,
        status,
        page,
        limit,
      });

      const response: ApiResponse = {
        success: true,
        data: result.tasks,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async completePutAway(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { confirmedLocationId } = req.body;
      const result = await InboundService.completePutAwayTask(
        id,
        confirmedLocationId,
        req.user!.userId
      );
      const response: ApiResponse = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listSuppliers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const suppliers = await prisma.supplier.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      });
      const response: ApiResponse = { success: true, data: suppliers };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async createSupplier(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const supplier = await prisma.supplier.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          contactEmail: data.contactEmail,
          phone: data.phone,
          address: data.address,
          city: data.city,
          country: data.country || 'USA',
        },
      });
      const response: ApiResponse = { success: true, data: supplier };
      res.status(201).json(response);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return next(new AppError(400, 'DUPLICATE_CODE', 'Supplier code already exists'));
      }
      next(err);
    }
  }
}

