import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { LocationType, LocationStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest, ApiResponse, AppError } from '../types/index.js';
import { AuditService } from '../services/AuditService.js';

export const createWarehouseSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(2),
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(3),
  country: z.string().default('USA'),
  isDefault: z.boolean().optional(),
});

export const createLocationSchema = z.object({
  warehouseId: z.string().uuid(),
  zone: z.string().min(1),
  aisle: z.string().min(1),
  rack: z.string().min(1),
  shelf: z.string().min(1),
  bin: z.string().min(1),
  type: z.nativeEnum(LocationType).default(LocationType.STORAGE),
  status: z.nativeEnum(LocationStatus).default(LocationStatus.ACTIVE),
  capacityUnits: z.number().int().positive().default(1000),
});

export const updateLocationSchema = z.object({
  type: z.nativeEnum(LocationType).optional(),
  status: z.nativeEnum(LocationStatus).optional(),
  capacityUnits: z.number().int().positive().optional(),
});

export class WarehouseController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouses = await prisma.warehouse.findMany({
        orderBy: { code: 'asc' },
        include: {
          _count: {
            select: { locations: true, inventoryBalances: true },
          },
        },
      });

      const response: ApiResponse = { success: true, data: warehouses };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          locations: {
            orderBy: [{ zone: 'asc' }, { code: 'asc' }],
          },
        },
      });

      if (!warehouse) {
        throw new AppError(404, 'WAREHOUSE_NOT_FOUND', 'Warehouse not found');
      }

      const response: ApiResponse = { success: true, data: warehouse };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouse = await prisma.warehouse.create({
        data: req.body,
      });

      await AuditService.log('WAREHOUSE_CREATED', 'Warehouse', warehouse.id, req.user?.userId, {
        code: warehouse.code,
        name: warehouse.name,
      });

      const response: ApiResponse = { success: true, data: warehouse };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listLocations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const type = req.query.type as LocationType | undefined;
      const status = req.query.status as LocationStatus | undefined;
      const search = req.query.search as string | undefined;

      const where: any = { warehouseId: id };
      if (type) where.type = type;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { zone: { contains: search, mode: 'insensitive' } },
          { aisle: { contains: search, mode: 'insensitive' } },
        ];
      }

      const locations = await prisma.location.findMany({
        where,
        orderBy: [{ zone: 'asc' }, { aisle: 'asc' }, { rack: 'asc' }, { shelf: 'asc' }, { bin: 'asc' }],
        include: {
          inventoryBalances: {
            include: {
              product: { select: { sku: true, name: true } },
            },
          },
        },
      });

      const enriched = locations.map((loc) => {
        const storedUnits = loc.inventoryBalances.reduce((sum, b) => sum + b.onHand, 0);
        return {
          ...loc,
          occupancyUnits: storedUnits,
          utilizationPercent:
            loc.capacityUnits > 0 ? Math.min(100, Math.round((storedUnits / loc.capacityUnits) * 100)) : 0,
        };
      });

      const response: ApiResponse = { success: true, data: enriched };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async createLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { warehouseId, zone, aisle, rack, shelf, bin, type, status, capacityUnits } = req.body;
      const code = `${zone}-${aisle}-${rack}-${shelf}-${bin}`;

      const location = await prisma.location.create({
        data: {
          warehouseId,
          zone,
          aisle,
          rack,
          shelf,
          bin,
          code,
          barcode: `LOC-${code}`,
          type,
          status,
          capacityUnits,
        },
      });

      await AuditService.log('LOCATION_CREATED', 'Location', location.id, req.user?.userId, {
        code,
        warehouseId,
      });

      const response: ApiResponse = { success: true, data: location };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async updateLocation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, locId } = req.params;
      const { status, type, capacityUnits } = req.body;

      const location = await prisma.location.update({
        where: { id: locId, warehouseId: id },
        data: {
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
          ...(capacityUnits !== undefined ? { capacityUnits } : {}),
        },
      });

      await AuditService.log('LOCATION_UPDATED', 'Location', location.id, req.user?.userId, {
        code: location.code,
        changes: req.body,
      });

      const response: ApiResponse = { success: true, data: location };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}

