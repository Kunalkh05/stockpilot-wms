import { Router } from 'express';
import { Role } from '@prisma/client';
import { AuditController } from '../controllers/AuditController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get(
  '/logs',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  AuditController.listLogs
);

export default router;
