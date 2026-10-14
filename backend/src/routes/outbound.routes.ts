import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  OutboundController,
  createCustomerSchema,
  createSalesOrderSchema,
  confirmPickItemSchema,
  packOrderSchema,
  dispatchOrderSchema,
  cancelOrderSchema,
} from '../controllers/OutboundController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

// Customers
router.get('/customers', authenticate, OutboundController.listCustomers);
router.post(
  '/customers',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(createCustomerSchema),
  OutboundController.createCustomer
);

// Stock Reservations Ledger
router.get('/reservations', authenticate, OutboundController.listReservations);

// Orders
router.get('/orders', authenticate, OutboundController.listSalesOrders);
router.post(
  '/orders',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(createSalesOrderSchema),
  OutboundController.createSalesOrder
);

router.post(
  '/orders/:id/allocate',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  OutboundController.allocate
);

router.post(
  '/orders/:id/cancel',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  validateBody(cancelOrderSchema),
  OutboundController.cancel
);

// Picking
router.get('/pick-tasks', authenticate, OutboundController.listPickTasks);
router.post(
  '/pick-tasks/:taskId/items/:itemId/confirm',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.PICKER_PACKER),
  validateBody(confirmPickItemSchema),
  OutboundController.confirmPickItem
);

// Packing
router.post(
  '/orders/:id/pack',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.PICKER_PACKER),
  validateBody(packOrderSchema),
  OutboundController.pack
);

// Dispatch
router.post(
  '/orders/:id/dispatch',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.PICKER_PACKER),
  validateBody(dispatchOrderSchema),
  OutboundController.dispatch
);

export default router;
