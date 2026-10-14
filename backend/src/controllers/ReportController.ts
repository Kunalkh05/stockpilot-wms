import { Response, NextFunction } from 'express';
import { ReportService } from '../services/ReportService.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

export class ReportController {
  static async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const data = await ReportService.getDashboardSummary(warehouseId);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getValuation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const data = await ReportService.getValuationReport(warehouseId);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getLowStock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const data = await ReportService.getLowStockReport(warehouseId);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getLotExpiry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const data = await ReportService.getLotExpiryReport(warehouseId);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  static async getBinUtilization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const data = await ReportService.getBinUtilization(warehouseId);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}
