import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { MovementType } from '@prisma/client';
import { InventoryService } from '../services/InventoryService.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

export const adjustStockSchema = z.object({
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  lotId: z.string().uuid().optional().nullable(),
  newOnHand: z.number().int().nonnegative(),
  reason: z.string().min(3),
});

export const transferStockSchema = z.object({
  warehouseId: z.string().uuid(),
  sourceLocationId: z.string().uuid(),
  destLocationId: z.string().uuid(),
  productId: z.string().uuid(),
  lotId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
});

export class InventoryController {
  static async listBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const locationId = req.query.locationId as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      const search = req.query.search as string | undefined;
      const lowStockOnly = req.query.lowStockOnly === 'true';
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;

      const result = await InventoryService.listBalances({
        warehouseId,
        locationId,
        categoryId,
        search,
        lowStockOnly,
        page,
        limit,
      });

      const response: ApiResponse = {
        success: true,
        data: result.items,
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

  static async getProductStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await InventoryService.getProductStockDetails(id, warehouseId);
      const response: ApiResponse = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async adjust(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.adjustStock({
        ...req.body,
        userId: req.user!.userId,
      });
      const response: ApiResponse = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async transfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await InventoryService.transferStock({
        ...req.body,
        userId: req.user!.userId,
      });
      const response: ApiResponse = { success: true, data: result };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listMovements(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const productId = req.query.productId as string | undefined;
      const referenceType = req.query.referenceType as MovementType | undefined;
      const referenceId = req.query.referenceId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;

      const result = await InventoryService.listMovements({
        productId,
        referenceType,
        referenceId,
        startDate,
        endDate,
        page,
        limit,
      });

      const response: ApiResponse = {
        success: true,
        data: result.movements,
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

  static async exportCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const result = await InventoryService.listBalances({ warehouseId, limit: 1000 });

      const header = 'Warehouse,Location,Zone,SKU,Name,Category,UOM,On-Hand,Reserved,Damaged,Available,UnitCost,Valuation\n';
      const rows = result.items.map((b) =>
        [
          `"${b.warehouse.code}"`,
          `"${b.location.code}"`,
          `"${b.location.zone}"`,
          `"${b.product.sku}"`,
          `"${b.product.name.replace(/"/g, '""')}"`,
          `"${b.product.category?.name || ''}"`,
          `"${b.product.uom}"`,
          b.onHand,
          b.reserved,
          b.damaged,
          b.available,
          b.product.unitCost.toFixed(2),
          b.valuation.toFixed(2),
        ].join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=stockpilot-inventory.csv');
      res.send(header + rows.join('\n'));
    } catch (err) {
      next(err);
    }
  }
}
