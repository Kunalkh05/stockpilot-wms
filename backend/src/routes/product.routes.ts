import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  ProductController,
  createProductSchema,
  updateProductSchema,
} from '../controllers/ProductController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/categories', authenticate, ProductController.listCategories);
router.get('/', authenticate, ProductController.list);
router.get('/:id', authenticate, ProductController.getById);
router.post(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(createProductSchema),
  ProductController.create
);
router.put(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER, Role.INVENTORY_SPECIALIST),
  validateBody(updateProductSchema),
  ProductController.update
);
router.delete(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER),
  ProductController.delete
);

export default router;
