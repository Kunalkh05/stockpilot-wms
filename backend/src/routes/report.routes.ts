import { Router } from 'express';
import { Role } from '@prisma/client';
import { ReportController } from '../controllers/ReportController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/dashboard', authenticate, ReportController.getDashboard);
router.get(
  '/valuation',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  ReportController.getValuation
);
router.get('/low-stock', authenticate, ReportController.getLowStock);
router.get('/lot-expiry', authenticate, ReportController.getLotExpiry);
router.get('/utilization', authenticate, ReportController.getBinUtilization);

export default router;
