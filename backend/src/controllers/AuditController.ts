import { Response, NextFunction } from 'express';
import { AuditService } from '../services/AuditService.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

export class AuditController {
  static async listLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const userId = req.query.userId as string | undefined;
      const action = req.query.action as string | undefined;

      const result = await AuditService.getLogs({
        page,
        limit,
        entityType,
        entityId,
        userId,
        action,
      });

      const response: ApiResponse = {
        success: true,
        data: result.logs,
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
}
