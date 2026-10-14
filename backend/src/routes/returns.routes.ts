import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  ReturnsController,
  createReturnSchema,
  inspectReturnSchema,
} from '../controllers/ReturnsController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', authenticate, ReturnsController.list);
router.post(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(createReturnSchema),
  ReturnsController.create
);
router.post(
  '/:id/inspect',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.RECEIVING_CLERK),
  validateBody(inspectReturnSchema),
  ReturnsController.inspect
);

export default router;
