import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError, TokenPayload } from '../types/index.js';
import { AuditService } from './AuditService.js';

export class AuthService {
  static async login(email: string, password: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          include: { warehouse: true },
        },
      },
    });

    if (!user || !user.active) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    await AuditService.log('AUTH_LOGIN', 'User', user.id, user.id, { email: user.email }, ipAddress);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        memberships: user.memberships,
      },
    };
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
        memberships: {
          include: {
            warehouse: {
              select: { id: true, code: true, name: true, isDefault: true },
            },
          },
        },
      },
    });

    if (!user || !user.active) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account does not exist or is deactivated');
    }

    return user;
  }

  static async listUsers(query: { page?: number; limit?: number; role?: Role; search?: string }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          active: true,
          createdAt: true,
          memberships: {
            include: { warehouse: { select: { id: true, code: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async createUser(
    adminUserId: string,
    data: { email: string; password: string; fullName: string; role: Role; warehouseIds?: string[] }
  ) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new AppError(409, 'USER_EXISTS', 'A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        fullName: data.fullName.trim(),
        role: data.role,
        memberships: data.warehouseIds?.length
          ? {
              create: data.warehouseIds.map((wId) => ({ warehouseId: wId })),
            }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    await AuditService.log('USER_CREATED', 'User', user.id, adminUserId, {
      email: user.email,
      role: user.role,
    });

    return user;
  }
}
