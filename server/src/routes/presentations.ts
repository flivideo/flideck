import { Router } from 'express';
import type { Server } from 'socket.io';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { PresentationService } from '../services/PresentationService.js';

interface RouteConfig {
  io: Server;
}

/**
 * Create presentation routes with dependency injection.
 */
export function createPresentationRoutes({ io }: RouteConfig): Router {
  const router = Router();
  const presentationService = PresentationService.getInstance();

  /**
   * GET /api/presentations
   * List all discovered presentations.
   */
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const presentations = await presentationService.discoverAll();
      res.json({ success: true, data: presentations });
    })
  );

  /**
   * GET /api/presentations/:id
   * Get a single presentation by ID.
   */
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const presentation = await presentationService.getById(id);

      if (!presentation) {
        throw new AppError('Presentation not found', 404);
      }

      res.json({ success: true, data: presentation });
    })
  );

  /**
   * POST /api/presentations/refresh
   * Force refresh of presentation cache.
   */
  router.post(
    '/refresh',
    asyncHandler(async (_req, res) => {
      presentationService.invalidateCache();
      const presentations = await presentationService.discoverAll();

      // Notify all clients
      io.emit('presentations:updated', { reason: 'manual-refresh' });

      res.json({ success: true, data: presentations });
    })
  );

  /**
   * PUT /api/presentations/:id/order
   * Update asset order for a presentation.
   */
  router.put(
    '/:id/order',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { order } = req.body;

      // Validate request body
      if (!order || !Array.isArray(order)) {
        throw new AppError('Invalid request: order must be an array of filenames', 400);
      }

      // Verify presentation exists
      const presentation = await presentationService.getById(id);
      if (!presentation) {
        throw new AppError('Presentation not found', 404);
      }

      // Save the new order
      await presentationService.saveAssetOrder(id, order);

      // Notify clients about the change
      io.emit('presentations:updated', { reason: 'order-changed', presentationId: id });

      res.json({ success: true });
    })
  );

  return router;
}
