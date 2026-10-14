import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { AuthService } from '../services/AuthService.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.nativeEnum(Role),
  warehouseIds: z.array(z.string()).optional(),
});

export class AuthController {
  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await AuthService.login(email, password, ip);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.getCurrentUser(req.user!.userId);
      const response: ApiResponse = {
        success: true,
        data: user,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const role = req.query.role as Role | undefined;
      const search = req.query.search as string | undefined;

      const result = await AuthService.listUsers({ page, limit, role, search });
      const response: ApiResponse = {
        success: true,
        data: result.users,
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

  static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const newUser = await AuthService.createUser(req.user!.userId, req.body);
      const response: ApiResponse = {
        success: true,
        data: newUser,
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }
}
