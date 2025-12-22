import { Router } from 'express';
import type { Server } from 'socket.io';
import type {
  CreatePresentationRequest,
  AddSlideRequest,
  UpdateSlideRequest,
  ReorderGroupsRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
} from '@flideck/shared';
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

  // ============================================================
  // FR-16: Agent Slide Management API
  // ============================================================

  /**
   * POST /api/presentations
   * Create a new presentation folder and manifest.
   */
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = req.body as CreatePresentationRequest;

      // Validate required field
      if (!body.id) {
        throw new AppError('Missing required field: id', 400);
      }

      // Validate id format (folder name safe)
      if (!/^[a-zA-Z0-9_-]+$/.test(body.id)) {
        throw new AppError('Invalid id: must contain only letters, numbers, hyphens, and underscores', 400);
      }

      try {
        const folderPath = await presentationService.createPresentation(
          body.id,
          body.name,
          body.slides
        );

        // Notify clients
        io.emit('presentations:updated', { reason: 'presentation-created', presentationId: body.id });

        res.status(201).json({ success: true, path: folderPath });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          throw new AppError(error.message, 409);
        }
        throw error;
      }
    })
  );

  /**
   * POST /api/presentations/:id/slides
   * Add a slide to a presentation's manifest.
   */
  router.post(
    '/:id/slides',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as AddSlideRequest;

      // Validate required field
      if (!body.file) {
        throw new AppError('Missing required field: file', 400);
      }

      // Validate file format
      if (!body.file.endsWith('.html')) {
        throw new AppError('Invalid file: must end with .html', 400);
      }

      try {
        await presentationService.addSlide(id, {
          file: body.file,
          title: body.title,
          group: body.group,
          description: body.description,
          recommended: body.recommended,
        });

        // Notify clients
        io.emit('presentations:updated', { reason: 'slide-added', presentationId: id });

        res.status(201).json({ success: true });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new AppError(error.message, 404);
          }
          if (error.message.includes('already exists')) {
            throw new AppError(error.message, 409);
          }
        }
        throw error;
      }
    })
  );

  /**
   * PUT /api/presentations/:id/slides/:slideId
   * Update metadata for a slide.
   */
  router.put(
    '/:id/slides/:slideId',
    asyncHandler(async (req, res) => {
      const { id, slideId } = req.params;
      const body = req.body as UpdateSlideRequest;

      try {
        await presentationService.updateSlide(id, slideId, {
          title: body.title,
          group: body.group,
          description: body.description,
          recommended: body.recommended,
        });

        // Notify clients
        io.emit('presentations:updated', { reason: 'slide-updated', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  /**
   * DELETE /api/presentations/:id/slides/:slideId
   * Remove a slide from the manifest.
   */
  router.delete(
    '/:id/slides/:slideId',
    asyncHandler(async (req, res) => {
      const { id, slideId } = req.params;

      try {
        await presentationService.removeSlide(id, slideId);

        // Notify clients
        io.emit('presentations:updated', { reason: 'slide-removed', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  // ============================================================
  // FR-17: Group Management API
  // ============================================================

  /**
   * PUT /api/presentations/:id/groups/order
   * Reorder groups in the manifest.
   */
  router.put(
    '/:id/groups/order',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as ReorderGroupsRequest;

      // Validate request body
      if (!body.order || !Array.isArray(body.order)) {
        throw new AppError('Invalid request: order must be an array of group IDs', 400);
      }

      try {
        await presentationService.reorderGroups(id, body.order);

        // Notify clients
        io.emit('presentations:updated', { reason: 'groups-reordered', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  /**
   * POST /api/presentations/:id/groups
   * Create a new group.
   */
  router.post(
    '/:id/groups',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as CreateGroupRequest;

      // Validate required fields
      if (!body.id) {
        throw new AppError('Missing required field: id', 400);
      }
      if (!body.label) {
        throw new AppError('Missing required field: label', 400);
      }

      // Validate id format (kebab-case safe)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.id)) {
        throw new AppError('Invalid id: must be lowercase kebab-case (e.g., "my-group")', 400);
      }

      try {
        await presentationService.createGroup(id, body.id, body.label);

        // Notify clients
        io.emit('presentations:updated', { reason: 'group-created', presentationId: id });

        res.status(201).json({ success: true });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new AppError(error.message, 404);
          }
          if (error.message.includes('already exists')) {
            throw new AppError(error.message, 409);
          }
        }
        throw error;
      }
    })
  );

  /**
   * PUT /api/presentations/:id/groups/:groupId
   * Update a group's label.
   */
  router.put(
    '/:id/groups/:groupId',
    asyncHandler(async (req, res) => {
      const { id, groupId } = req.params;
      const body = req.body as UpdateGroupRequest;

      // Validate required field
      if (!body.label) {
        throw new AppError('Missing required field: label', 400);
      }

      try {
        await presentationService.updateGroup(id, groupId, body.label);

        // Notify clients
        io.emit('presentations:updated', { reason: 'group-updated', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  /**
   * DELETE /api/presentations/:id/groups/:groupId
   * Delete a group. Slides in the group move to root level.
   */
  router.delete(
    '/:id/groups/:groupId',
    asyncHandler(async (req, res) => {
      const { id, groupId } = req.params;

      try {
        await presentationService.deleteGroup(id, groupId);

        // Notify clients
        io.emit('presentations:updated', { reason: 'group-deleted', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  return router;
}
