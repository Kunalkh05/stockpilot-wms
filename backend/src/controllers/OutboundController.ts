import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PickTaskStatus, SOStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { OutboundService } from '../services/OutboundService.js';
import { AuthenticatedRequest, ApiResponse, AppError } from '../types/index.js';

export const createCustomerSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  shippingAddress: z.string().min(2),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default('USA'),
});

export const createSalesOrderSchema = z.object({
  customerId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  requiredDate: z.string().optional(),
  shippingCarrier: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      requestedQty: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
    })
  ).min(1),
});

export const confirmPickItemSchema = z.object({
  pickedQty: z.number().int().nonnegative(),
  discrepancyReason: z.string().optional(),
});

export const packOrderSchema = z.object({
  weightKg: z.number().positive().default(1.5),
  boxType: z.string().default('STANDARD_CORRUGATED'),
});

export const dispatchOrderSchema = z.object({
  carrier: z.string().min(2),
  trackingNumber: z.string().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(3),
});

export class OutboundController {
  static async listSalesOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const status = req.query.status as SOStatus | undefined;
      const customerId = req.query.customerId as string | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await OutboundService.listSalesOrders({
        warehouseId,
        status,
        customerId,
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

  static async createSalesOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const order = await OutboundService.createSalesOrder(req.user!.userId, req.body);
      const response: ApiResponse = { success: true, data: order };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async allocate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await OutboundService.allocateOrder(id, req.user!.userId);
      const response: ApiResponse = { success: true, data: updated };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listPickTasks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const status = req.query.status as PickTaskStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await OutboundService.listPickTasks({
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

  static async confirmPickItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { taskId, itemId } = req.params;
      const { pickedQty, discrepancyReason } = req.body;
      const result = await OutboundService.confirmPickItem(
        taskId,
        itemId,
        pickedQty,
        discrepancyReason,
        req.user?.userId
      );
      const response: ApiResponse = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async pack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const pkg = await OutboundService.packOrder(id, req.user!.userId, req.body);
      const response: ApiResponse = { success: true, data: pkg };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async dispatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await OutboundService.dispatchOrder(id, req.user!.userId, req.body);
      const response: ApiResponse = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await OutboundService.cancelOrder(id, req.user!.userId, reason);
      const response: ApiResponse = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const customers = await prisma.customer.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      });
      const response: ApiResponse = { success: true, data: customers };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const customer = await prisma.customer.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          email: data.email,
          phone: data.phone,
          shippingAddress: data.shippingAddress,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country || 'USA',
        },
      });
      const response: ApiResponse = { success: true, data: customer };
      res.status(201).json(response);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return next(new AppError(400, 'DUPLICATE_CODE', 'Customer code already exists'));
      }
      next(err);
    }
  }

  static async listReservations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const status = req.query.status as string | undefined;
      const reservations = await prisma.stockReservation.findMany({
        where: {
          ...(warehouseId ? { warehouseId } : {}),
          ...(status ? { status: status as any } : {}),
        },
        include: {
          product: { select: { id: true, sku: true, name: true, uom: true } },
          location: { select: { id: true, code: true, type: true } },
          salesOrder: { select: { id: true, orderNumber: true, status: true, customer: { select: { name: true } } } },
          lot: { select: { lotNumber: true, expiryDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      const response: ApiResponse = { success: true, data: reservations };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}

