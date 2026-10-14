import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  InboundController,
  createSupplierSchema,
  createPOSchema,
  receiveItemsSchema,
  completePutAwaySchema,
} from '../controllers/InboundController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

// Suppliers
router.get('/suppliers', authenticate, InboundController.listSuppliers);
router.post(
  '/suppliers',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(createSupplierSchema),
  InboundController.createSupplier
);

// Purchase Orders
router.get('/purchase-orders', authenticate, InboundController.listPurchaseOrders);
router.post(
  '/purchase-orders',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(createPOSchema),
  InboundController.createPurchaseOrder
);

// Receiving Dock
router.post(
  '/receive',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.RECEIVING_CLERK),
  validateBody(receiveItemsSchema),
  InboundController.receive
);

// Put-away Tasks
router.get('/put-away-tasks', authenticate, InboundController.listPutAwayTasks);
router.post(
  '/put-away-tasks/:id/complete',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.RECEIVING_CLERK, Role.INVENTORY_SPECIALIST),
  validateBody(completePutAwaySchema),
  InboundController.completePutAway
);

export default router;
