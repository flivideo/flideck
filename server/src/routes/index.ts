import { Router } from 'express';
import type { Server } from 'socket.io';
import { createPresentationRoutes } from './presentations.js';
import { createAssetRoutes } from './assets.js';
import { createConfigRoutes } from './config.js';
import { createQueryRoutes } from './query.js';
import { createSchemaRoutes } from './schema.js';
import { createTemplateRoutes } from './templates.js';
import { createCapabilitiesRoutes } from './capabilities.js';
import type { WatcherManager } from '../WatcherManager.js';

interface RouteConfig {
  io: Server;
  watcherManager: WatcherManager;
}

/**
 * Create and aggregate all API routes.
 */
export function createRoutes({ io, watcherManager }: RouteConfig): Router {
  const router = Router();

  router.use('/presentations', createPresentationRoutes({ io }));
  router.use('/assets', createAssetRoutes());
  router.use('/config', createConfigRoutes({ io, watcherManager }));
  router.use('/query', createQueryRoutes());
  router.use('/schema', createSchemaRoutes({ io }));
  router.use('/templates', createTemplateRoutes({ io }));
  router.use('/capabilities', createCapabilitiesRoutes());

  return router;
}
