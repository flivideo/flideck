import { Router } from 'express';
import type { Server } from 'socket.io';
import { getSchema } from '../utils/manifestValidator.js';
import { asyncHandler } from '../middleware/errorHandler.js';

interface RouteConfig {
  io?: Server;
}

/**
 * Schema routes - expose JSON Schema for manifest
 */
export function createSchemaRoutes(_config?: RouteConfig): Router {
  const router = Router();

  /**
   * GET /api/schema/manifest
   * Returns the JSON Schema definition for the manifest
   */
  router.get(
    '/manifest',
    asyncHandler(async (_req, res) => {
      const schema = getSchema();
      res.json(schema);
    })
  );

  // ============================================================
  // FR-21: Manifest Templates
  // ============================================================


  return router;
}
