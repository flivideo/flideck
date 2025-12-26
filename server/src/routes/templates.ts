import { Router } from 'express';
import type { Server } from 'socket.io';
import { getTemplates, getTemplateById } from '../utils/manifestTemplates.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

interface RouteConfig {
  io: Server;
}

/**
 * Template routes - manage manifest templates (FR-21)
 */
export function createTemplateRoutes(_config: RouteConfig): Router {
  const router = Router();

  /**
   * GET /api/templates/manifest
   * Get all available manifest templates.
   */
  router.get(
    '/manifest',
    asyncHandler(async (_req, res) => {
      const templates = getTemplates();
      res.json(templates);
    })
  );

  /**
   * GET /api/templates/manifest/:id
   * Get a specific manifest template by ID.
   */
  router.get(
    '/manifest/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const template = getTemplateById(id);

      if (!template) {
        throw new AppError(`Template not found: ${id}`, 404);
      }

      res.json(template);
    })
  );

  return router;
}
