import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { errorHandler } from './middlewares/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import warehouseRoutes from './routes/warehouse.routes.js';
import productRoutes from './routes/product.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import inboundRoutes from './routes/inbound.routes.js';
import outboundRoutes from './routes/outbound.routes.js';
import returnsRoutes from './routes/returns.routes.js';
import reportRoutes from './routes/report.routes.js';
import auditRoutes from './routes/audit.routes.js';

export const app = express();

// Security & utility middlewares
app.use(helmet());
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(requestIdMiddleware);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms (req-id: :req[x-request-id])'));
}

// Auth rate limiting (100 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
});

// Health check
app.get(`${env.API_PREFIX}/health`, async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      system: 'StockPilot WMS',
      version: '1.0.0',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// Swagger OpenAPI documentation spec
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'StockPilot WMS API',
    version: '1.0.0',
    description: 'Enterprise Warehouse Management System REST API documentation',
  },
  servers: [{ url: env.API_PREFIX }],
  paths: {
    '/health': { get: { summary: 'System Health Check' } },
    '/auth/login': { post: { summary: 'User Authentication & JWT issuance' } },
    '/auth/register': { post: { summary: 'User Registration with custom login ID and password' } },
    '/warehouses': { get: { summary: 'List operational facilities' }, post: { summary: 'Register new facility' } },
    '/warehouses/{id}/locations': {
      get: { summary: 'List and filter warehouse storage locations' },
      post: { summary: 'Create new physical bin address' },
    },
    '/warehouses/{id}/locations/{locId}': {
      patch: { summary: 'Update location operating status or capacity' },
    },
    '/products': {
      get: { summary: 'List and filter catalog products' },
      post: { summary: 'Register new master catalog SKU' },
    },
    '/products/{id}': {
      get: { summary: 'Retrieve product specifications and network stock' },
      put: { summary: 'Update product specifications' },
      delete: { summary: 'Safely deactivate product with 0 physical stock' },
    },
    '/products/categories': { get: { summary: 'List product categories' } },
    '/inventory/balances': { get: { summary: 'List granular inventory balances' } },
    '/inventory/adjust': { post: { summary: 'Cycle count manual inventory adjustment' } },
    '/inventory/transfer': { post: { summary: 'Atomic location-to-location stock transfer' } },
    '/inventory/export/csv': { get: { summary: 'Export inventory balance records as CSV' } },
    '/inbound/suppliers': { get: { summary: 'List approved vendor suppliers' }, post: { summary: 'Register new vendor supplier' } },
    '/inbound/purchase-orders': { get: { summary: 'List and create purchase orders' } },
    '/inbound/receive': { post: { summary: 'Inbound PO dock receiving session' } },
    '/inbound/put-away-tasks': { get: { summary: 'List and complete put-away tasks' } },
    '/outbound/customers': { get: { summary: 'List verified customer accounts' }, post: { summary: 'Register new customer account' } },
    '/outbound/reservations': { get: { summary: 'Audit stock reservations by facility and order' } },
    '/outbound/orders': { get: { summary: 'List and create customer sales orders' } },
    '/outbound/orders/{id}/allocate': { post: { summary: 'Atomic reservation engine' } },
    '/outbound/orders/{id}/dispatch': { post: { summary: 'Order dispatch and shipment confirmation' } },
    '/returns': { get: { summary: 'List return orders' }, post: { summary: 'Create customer RMA request' } },
    '/returns/{id}/inspect': { post: { summary: 'Inspect RMA return with restock or quarantine routing' } },
    '/reports/dashboard': { get: { summary: 'Executive operational dashboard summary' } },
    '/reports/valuation': { get: { summary: 'Inventory financial valuation breakdown' } },
    '/reports/low-stock': { get: { summary: 'Low stock and reorder deficit alerts' } },
    '/audit/logs': { get: { summary: 'System security and compliance audit log' } },
  },
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mount REST domain endpoints
app.use(`${env.API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${env.API_PREFIX}/warehouses`, warehouseRoutes);
app.use(`${env.API_PREFIX}/products`, productRoutes);
app.use(`${env.API_PREFIX}/inventory`, inventoryRoutes);
app.use(`${env.API_PREFIX}/inbound`, inboundRoutes);
app.use(`${env.API_PREFIX}/outbound`, outboundRoutes);
app.use(`${env.API_PREFIX}/returns`, returnsRoutes);
app.use(`${env.API_PREFIX}/reports`, reportRoutes);
app.use(`${env.API_PREFIX}/audit`, auditRoutes);

// Serve static frontend Single Page Application in production/standalone mode
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 handler for unmatched API routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.url} does not exist`,
    },
  });
});

// Centralized error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`[StockPilot WMS API] Server running on port ${env.PORT} (${env.NODE_ENV})`);
    console.log(`[StockPilot WMS API] Health check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
    console.log(`[StockPilot WMS API] Interactive API Docs: http://localhost:${env.PORT}/api/docs`);
  });
}
