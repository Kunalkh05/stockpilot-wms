import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { AuthenticatedRequest, AppError, TokenPayload } from '../types/index.js';

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch (err) {
    throw new AppError(401, 'INVALID_TOKEN', 'Token is expired or invalid');
  }
}

export function authorize(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        `Role '${req.user.role}' is not authorized to perform this operation. Allowed: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
}
