import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  WarehouseController,
  createWarehouseSchema,
  createLocationSchema,
  updateLocationSchema,
} from '../controllers/WarehouseController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', authenticate, WarehouseController.list);
router.get('/:id', authenticate, WarehouseController.getById);
router.post(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  validateBody(createWarehouseSchema),
  WarehouseController.create
);

router.get('/:id/locations', authenticate, WarehouseController.listLocations);
router.post(
  '/:id/locations',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  validateBody(createLocationSchema),
  WarehouseController.createLocation
);
router.patch(
  '/:id/locations/:locId',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  validateBody(updateLocationSchema),
  WarehouseController.updateLocation
);

export default router;
