import { Router } from 'express';
import { Role } from '@prisma/client';
import { AuthController, loginSchema, createUserSchema } from '../controllers/AuthController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.post('/login', validateBody(loginSchema), AuthController.login);
router.get('/me', authenticate, AuthController.me);
router.get('/users', authenticate, authorize(Role.ADMIN, Role.WAREHOUSE_MANAGER), AuthController.listUsers);
router.post(
  '/users',
  authenticate,
  authorize(Role.ADMIN),
  validateBody(createUserSchema),
  AuthController.createUser
);

export default router;
