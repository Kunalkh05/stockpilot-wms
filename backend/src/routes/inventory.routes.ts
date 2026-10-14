import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  InventoryController,
  adjustStockSchema,
  transferStockSchema,
} from '../controllers/InventoryController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/balances', authenticate, InventoryController.listBalances);
router.get('/product/:id', authenticate, InventoryController.getProductStock);
router.get('/movements', authenticate, InventoryController.listMovements);
router.get('/export/csv', authenticate, InventoryController.exportCsv);

// Stock adjustments require Manager or Admin
router.post(
  '/adjust',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  validateBody(adjustStockSchema),
  InventoryController.adjust
);

// Transfers permitted for Specialist, Manager, Admin
router.post(
  '/transfer',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(transferStockSchema),
  InventoryController.transfer
);

export default router;
