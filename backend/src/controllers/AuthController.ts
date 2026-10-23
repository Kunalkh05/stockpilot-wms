import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { AuthService } from '../services/AuthService.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

export const loginSchema = z
  .object({
    identifier: z.string().optional(),
    loginId: z.string().optional(),
    login: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine(
    (data) => Boolean(data.identifier || data.loginId || data.login || data.username || data.email),
    {
      message: 'Login ID or email is required',
      path: ['identifier'],
    }
  );

export const registerSchema = z.object({
  loginId: z
    .string()
    .min(3, 'Login ID must be at least 3 characters')
    .max(30, 'Login ID cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Login ID can only contain letters, numbers, hyphens, dots, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  role: z.nativeEnum(Role).optional(),
  warehouseIds: z.array(z.string()).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  loginId: z.string().optional(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.nativeEnum(Role),
  warehouseIds: z.array(z.string()).optional(),
});

export class AuthController {
  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const identifier =
        req.body.identifier ||
        req.body.loginId ||
        req.body.login ||
        req.body.username ||
        req.body.email;
      const { password } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await AuthService.login(identifier, password, ip);
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await AuthService.register({
        ...req.body,
        ipAddress: ip,
      });
      const response: ApiResponse = {
        success: true,
        data: result,
      };
      res.status(201).json(response);
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
