import { Request, Response, NextFunction } from 'express';
import { AppError, ApiResponse } from '../types/index.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Prisma errors
  if (err.code === 'P2002') {
    const fields = (err.meta?.target as string[]) || [];
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTITY',
        message: `Unique constraint violated on field(s): ${fields.join(', ')}`,
        details: err.meta,
      },
    });
    return;
  }

  if (err.code === 'P2025') {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested entity was not found',
      },
    });
    return;
  }

  // Catch-all unhandled server error
  console.error(`[Unhandled Error] ${req.method} ${req.url}:`, err);
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred',
      details: isDevelopment ? err.stack : undefined,
    },
  };
  res.status(500).json(response);
}
