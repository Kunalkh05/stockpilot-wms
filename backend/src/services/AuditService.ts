import { prisma } from '../config/prisma.js';

export class AuditService {
  static async log(
    action: string,
    entityType: string,
    entityId: string,
    userId?: string,
    details?: any,
    ipAddress?: string
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          userId: userId || null,
          detailsJson: details ? JSON.stringify(details) : null,
          ipAddress: ipAddress || null,
        },
      });
    } catch (err) {
      console.error('[AuditService Error] Failed to write audit log:', err);
    }
  }

  static async getLogs(query: {
    page?: number;
    limit?: number;
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
