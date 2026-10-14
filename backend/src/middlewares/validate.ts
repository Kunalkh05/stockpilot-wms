import { Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AuthenticatedRequest, AppError } from '../types/index.js';

export function validateBody(schema: ZodSchema) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request payload', error.errors);
      }
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query parameters', error.errors);
      }
      next(error);
    }
  };
}
