import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest, ApiResponse, AppError } from '../types/index.js';
import { AuditService } from '../services/AuditService.js';

export const createProductSchema = z.object({
  sku: z.string().min(2).max(50),
  name: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  uom: z.string().default('EA'),
  barcode: z.string().optional(),
  minReorderPoint: z.number().int().nonnegative().default(10),
  targetStock: z.number().int().positive().default(100),
  unitCost: z.number().nonnegative().default(0),
  unitPrice: z.number().nonnegative().default(0),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  uom: z.string().optional(),
  barcode: z.string().optional(),
  minReorderPoint: z.number().int().nonnegative().optional(),
  targetStock: z.number().int().positive().optional(),
  unitCost: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

export class ProductController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const skip = (page - 1) * limit;
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;

      const where: any = { active: true };
      if (categoryId) where.categoryId = categoryId;
      if (search) {
        where.OR = [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limit,
          include: {
            category: true,
            _count: { select: { inventoryBalances: true, lots: true } },
          },
          orderBy: { sku: 'asc' },
        }),
        prisma.product.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: products,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          lots: { orderBy: { expiryDate: 'asc' } },
          inventoryBalances: {
            include: {
              warehouse: { select: { code: true, name: true } },
              location: { select: { code: true, zone: true, type: true } },
            },
          },
        },
      });

      if (!product) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      }

      const response: ApiResponse = { success: true, data: product };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const product = await prisma.product.create({
        data: {
          ...req.body,
          sku: req.body.sku.toUpperCase().trim(),
        },
        include: { category: true },
      });

      await AuditService.log('PRODUCT_CREATED', 'Product', product.id, req.user?.userId, {
        sku: product.sku,
        name: product.name,
      });

      const response: ApiResponse = { success: true, data: product };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      }

      const updated = await prisma.product.update({
        where: { id },
        data: req.body,
        include: { category: true },
      });

      await AuditService.log('PRODUCT_UPDATED', 'Product', updated.id, req.user?.userId, {
        sku: updated.sku,
        changes: req.body,
      });

      const response: ApiResponse = { success: true, data: updated };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const existing = await prisma.product.findUnique({
        where: { id },
        include: { inventoryBalances: true },
      });
      if (!existing) {
        throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      }

      // Check if product has active physical inventory
      const totalOnHand = existing.inventoryBalances.reduce((sum, b) => sum + b.onHand, 0);
      if (totalOnHand > 0) {
        throw new AppError(
          400,
          'CANNOT_DELETE_ACTIVE_STOCK',
          `Cannot deactivate product ${existing.sku} because ${totalOnHand} physical units remain in warehouse inventory. Adjust or transfer stock to 0 first.`
        );
      }

      await prisma.product.update({
        where: { id },
        data: { active: false },
      });

      await AuditService.log('PRODUCT_DEACTIVATED', 'Product', id, req.user?.userId, {
        sku: existing.sku,
      });

      const response: ApiResponse = {
        success: true,
        data: { message: `Product ${existing.sku} successfully deactivated` },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { products: true } },
        },
      });
      const response: ApiResponse = { success: true, data: categories };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}
