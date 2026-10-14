import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../types/index.js';

export function requestIdMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] as string;
  const requestId = incomingId || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
