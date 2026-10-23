import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError, TokenPayload } from '../types/index.js';
import { AuditService } from './AuditService.js';

export class AuthService {
  static async login(identifier: string, password: string, ipAddress?: string) {
    if (!identifier || !password) {
      throw new AppError(400, 'BAD_REQUEST', 'Login ID/email and password are required');
    }

    const cleanId = identifier.trim().toLowerCase();

    const orConditions: Prisma.UserWhereInput[] = [
      { email: { equals: cleanId, mode: 'insensitive' } },
      { loginId: { equals: cleanId, mode: 'insensitive' } },
    ];
    if (!cleanId.includes('@')) {
      orConditions.push({ email: { equals: `${cleanId}@stockpilot.io`, mode: 'insensitive' } });
    }

    // Look up by email or loginId (or demo alias like 'admin' -> 'admin@stockpilot.io')
    const user = await prisma.user.findFirst({
      where: {
        OR: orConditions,
      },
      include: {
        memberships: {
          include: { warehouse: true },
        },
      },
    });

    if (!user || !user.active) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid login ID or password');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid login ID or password');
    }

    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      loginId: user.loginId,
      role: user.role,
      fullName: user.fullName,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    await AuditService.log('AUTH_LOGIN', 'User', user.id, user.id, { email: user.email, loginId: user.loginId }, ipAddress);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        loginId: user.loginId,
        fullName: user.fullName,
        role: user.role,
        memberships: user.memberships,
      },
    };
  }

  static async register(data: {
    loginId: string;
    password: string;
    fullName: string;
    email?: string;
    role?: Role;
    warehouseIds?: string[];
    ipAddress?: string;
  }) {
    const cleanLoginId = data.loginId.trim().toLowerCase();

    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(cleanLoginId)) {
      throw new AppError(
        400,
        'INVALID_LOGIN_ID',
        'Login ID must be 3-30 characters long and contain only letters, numbers, underscores, dots, or hyphens'
      );
    }

    if (!data.password || data.password.length < 6) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Password must be at least 6 characters long');
    }

    // Check if loginId is already taken
    const existingUserWithLoginId = await prisma.user.findFirst({
      where: {
        OR: [
          { loginId: { equals: cleanLoginId, mode: 'insensitive' } },
          { email: { equals: cleanLoginId, mode: 'insensitive' } },
        ],
      },
    });

    if (existingUserWithLoginId) {
      throw new AppError(409, 'USER_EXISTS', `Login ID "${data.loginId}" is already taken. Please choose another.`);
    }

    // Determine email
    let cleanEmail = data.email?.trim().toLowerCase();
    if (cleanEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (existingEmail) {
        throw new AppError(409, 'EMAIL_EXISTS', `Email "${data.email}" is already registered`);
      }
    } else {
      cleanEmail = `${cleanLoginId}@stockpilot.local`;
      const existingEmail = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (existingEmail) {
        cleanEmail = `${cleanLoginId}.${Date.now()}@stockpilot.local`;
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const assignedRole = data.role || Role.WAREHOUSE_MANAGER;

    // Default to EDC warehouse if available so user has immediate access
    let warehouseMemberships = undefined;
    if (data.warehouseIds && data.warehouseIds.length > 0) {
      warehouseMemberships = {
        create: data.warehouseIds.map((wId) => ({ warehouseId: wId })),
      };
    } else {
      const defaultWh = (await prisma.warehouse.findFirst({ where: { isDefault: true } })) ||
        (await prisma.warehouse.findFirst());
      if (defaultWh) {
        warehouseMemberships = {
          create: [{ warehouseId: defaultWh.id }],
        };
      }
    }

    const newUser = await prisma.user.create({
      data: {
        loginId: cleanLoginId,
        email: cleanEmail,
        passwordHash,
        fullName: data.fullName.trim(),
        role: assignedRole,
        memberships: warehouseMemberships,
      },
      include: {
        memberships: {
          include: { warehouse: true },
        },
      },
    });

    const payload: TokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      loginId: newUser.loginId,
      role: newUser.role,
      fullName: newUser.fullName,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    await AuditService.log(
      'USER_REGISTERED',
      'User',
      newUser.id,
      newUser.id,
      { email: newUser.email, loginId: newUser.loginId, role: newUser.role },
      data.ipAddress
    );

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        loginId: newUser.loginId,
        fullName: newUser.fullName,
        role: newUser.role,
        memberships: newUser.memberships,
      },
    };
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        loginId: true,
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
        { loginId: { contains: query.search, mode: 'insensitive' } },
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
          loginId: true,
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
    data: { email: string; loginId?: string; password: string; fullName: string; role: Role; warehouseIds?: string[] }
  ) {
    const cleanEmail = data.email.toLowerCase().trim();
    const cleanLoginId = data.loginId ? data.loginId.toLowerCase().trim() : cleanEmail.split('@')[0];

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { loginId: cleanLoginId },
        ],
      },
    });
    if (existing) {
      throw new AppError(409, 'USER_EXISTS', 'A user with this email or login ID already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        loginId: cleanLoginId,
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
        loginId: true,
        fullName: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    await AuditService.log('USER_CREATED', 'User', user.id, adminUserId, {
      email: user.email,
      loginId: user.loginId,
      role: user.role,
    });

    return user;
  }
}
