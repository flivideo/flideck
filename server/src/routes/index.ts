import { Router } from 'express';
import type { Server } from 'socket.io';
import { createPresentationRoutes } from './presentations.js';
import { createAssetRoutes } from './assets.js';

interface RouteConfig {
  io: Server;
}

/**
 * Create and aggregate all API routes.
 */
export function createRoutes({ io }: RouteConfig): Router {
  const router = Router();

  router.use('/presentations', createPresentationRoutes({ io }));
  router.use('/assets', createAssetRoutes());

  return router;
}
