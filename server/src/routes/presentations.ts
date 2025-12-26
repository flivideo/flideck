import { Router } from 'express';
import type { Server } from 'socket.io';
import type {
  CreatePresentationRequest,
  AddSlideRequest,
  UpdateSlideRequest,
  ReorderGroupsRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  BulkAddSlidesRequest,
  BulkAddGroupsRequest,
  SyncManifestRequest,
  ValidateManifestRequest,
  ApplyTemplateRequest,
  CreateTabRequest,
  UpdateTabRequest,
  ReorderTabsRequest,
  SetGroupParentRequest,
  SyncFromIndexRequest,
} from '@flideck/shared';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { PresentationService } from '../services/PresentationService.js';
import { loadConfig, collapsePath } from '../config.js';
import { validate } from '../utils/manifestValidator.js';
import { getTemplateById } from '../utils/manifestTemplates.js';

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
      const config = await loadConfig();
      const presentations = await presentationService.discoverAll();
      res.json({
        _context: {
          presentationsRoot: collapsePath(config.presentationsRoot),
        },
        success: true,
        data: presentations,
      });
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
      const config = await loadConfig();
      const presentation = await presentationService.getById(id);

      if (!presentation) {
        throw new AppError('Presentation not found', 404);
      }

      res.json({
        _context: {
          presentationsRoot: collapsePath(config.presentationsRoot),
        },
        success: true,
        data: presentation,
      });
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

  // ============================================================
  // FR-22: Tab Management API
  // ============================================================

  /**
   * POST /api/presentations/:id/tabs
   * Create a new tab (group with tab: true).
   */
  router.post(
    '/:id/tabs',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as CreateTabRequest;

      // Validate required fields
      if (!body.id) {
        throw new AppError('Missing required field: id', 400);
      }
      if (!body.label) {
        throw new AppError('Missing required field: label', 400);
      }

      // Validate id format (kebab-case safe)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.id)) {
        throw new AppError('Invalid id: must be lowercase kebab-case (e.g., "my-tab")', 400);
      }

      try {
        await presentationService.createTab(id, body.id, body.label);

        // Notify clients
        io.emit('presentations:updated', { reason: 'tab-created', presentationId: id });

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
   * PUT /api/presentations/:id/tabs/:tabId
   * Update a tab's label.
   */
  router.put(
    '/:id/tabs/:tabId',
    asyncHandler(async (req, res) => {
      const { id, tabId } = req.params;
      const body = req.body as UpdateTabRequest;

      // Validate required field
      if (!body.label) {
        throw new AppError('Missing required field: label', 400);
      }

      try {
        await presentationService.updateTab(id, tabId, body.label);

        // Notify clients
        io.emit('presentations:updated', { reason: 'tab-updated', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new AppError(error.message, 404);
          }
          if (error.message.includes('not a tab')) {
            throw new AppError(error.message, 400);
          }
        }
        throw error;
      }
    })
  );

  /**
   * DELETE /api/presentations/:id/tabs/:tabId
   * Delete a tab with child group handling strategy.
   * Query params:
   * - strategy=orphan (default) - Make child groups parentless
   * - strategy=cascade - Delete child groups too
   * - strategy=reparent:<tabId> - Move children to another tab
   */
  router.delete(
    '/:id/tabs/:tabId',
    asyncHandler(async (req, res) => {
      const { id, tabId } = req.params;
      const strategy = (req.query.strategy as string) || 'orphan';

      try {
        await presentationService.deleteTab(id, tabId, strategy);

        // Notify clients
        io.emit('presentations:updated', { reason: 'tab-deleted', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new AppError(error.message, 404);
          }
          if (error.message.includes('not a tab')) {
            throw new AppError(error.message, 400);
          }
        }
        throw error;
      }
    })
  );

  /**
   * PUT /api/presentations/:id/tabs/order
   * Reorder tabs only (groups where tab: true).
   */
  router.put(
    '/:id/tabs/order',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as ReorderTabsRequest;

      // Validate request body
      if (!body.order || !Array.isArray(body.order)) {
        throw new AppError('Invalid request: order must be an array of tab IDs', 400);
      }

      try {
        await presentationService.reorderTabs(id, body.order);

        // Notify clients
        io.emit('presentations:updated', { reason: 'tabs-reordered', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new AppError(error.message, 404);
          }
          if (error.message.includes('not a tab')) {
            throw new AppError(error.message, 400);
          }
        }
        throw error;
      }
    })
  );

  /**
   * PUT /api/presentations/:id/groups/:groupId/parent
   * Set a group's parent tab (move group under tab).
   */
  router.put(
    '/:id/groups/:groupId/parent',
    asyncHandler(async (req, res) => {
      const { id, groupId } = req.params;
      const body = req.body as SetGroupParentRequest;

      // Validate required field
      if (!body.parent) {
        throw new AppError('Missing required field: parent', 400);
      }

      try {
        await presentationService.setGroupParent(id, groupId, body.parent);

        // Notify clients
        io.emit('presentations:updated', { reason: 'group-parent-set', presentationId: id });

        res.json({ success: true });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new AppError(error.message, 404);
          }
          if (error.message.includes('not a tab')) {
            throw new AppError(error.message, 400);
          }
        }
        throw error;
      }
    })
  );

  /**
   * DELETE /api/presentations/:id/groups/:groupId/parent
   * Remove a group's parent tab (make group parentless).
   */
  router.delete(
    '/:id/groups/:groupId/parent',
    asyncHandler(async (req, res) => {
      const { id, groupId } = req.params;

      try {
        await presentationService.removeGroupParent(id, groupId);

        // Notify clients
        io.emit('presentations:updated', { reason: 'group-parent-removed', presentationId: id });

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
  // FR-19: Manifest Schema & Data API
  // ============================================================

  /**
   * GET /api/presentations/:id/manifest
   * Returns the raw manifest JSON for a presentation.
   */
  router.get(
    '/:id/manifest',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const config = await loadConfig();
      const manifest = await presentationService.getManifest(id);

      if (!manifest) {
        // Presentation exists but has no manifest - return empty object with context
        res.json({
          _context: {
            presentationsRoot: collapsePath(config.presentationsRoot),
          },
        });
        return;
      }

      res.json({
        _context: {
          presentationsRoot: collapsePath(config.presentationsRoot),
        },
        ...manifest,
      });
    })
  );

  /**
   * PUT /api/presentations/:id/manifest
   * Replace the entire manifest with validation.
   */
  router.put(
    '/:id/manifest',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const manifest = req.body;

      // Validate manifest against JSON Schema
      const validationResult = validate(manifest);

      if (!validationResult.valid) {
        throw new AppError(
          `Manifest validation failed: ${validationResult.errors
            ?.map((e) => `${e.field}: ${e.message}`)
            .join(', ')}`,
          400
        );
      }

      // Replace manifest
      await presentationService.setManifest(id, manifest);

      // Notify clients
      io.emit('presentations:updated', { reason: 'manifest-replaced', presentationId: id });

      res.json({ success: true });
    })
  );

  /**
   * PATCH /api/presentations/:id/manifest
   * Partial update with deep merge semantics.
   */
  router.patch(
    '/:id/manifest',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const updates = req.body;

      // Get current manifest
      const currentManifest = (await presentationService.getManifest(id)) || {};

      // Perform deep merge to simulate final result
      const mergedManifest = deepMerge(currentManifest, updates);

      // Validate merged result
      const validationResult = validate(mergedManifest);

      if (!validationResult.valid) {
        throw new AppError(
          `Manifest validation failed after merge: ${validationResult.errors
            ?.map((e) => `${e.field}: ${e.message}`)
            .join(', ')}`,
          400
        );
      }

      // Apply patch
      await presentationService.patchManifest(id, updates);

      // Notify clients
      io.emit('presentations:updated', { reason: 'manifest-patched', presentationId: id });

      res.json({ success: true });
    })
  );

  // ============================================================
  // FR-21: Agent Manifest Tooling - Bulk Operations
  // ============================================================

  /**
   * POST /api/presentations/:id/manifest/slides/bulk
   * Bulk add slides to a presentation's manifest.
   */
  router.post(
    '/:id/manifest/slides/bulk',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as BulkAddSlidesRequest;
      const dryRun = body.dryRun || req.query.dryRun === 'true';

      // Validate required fields
      if (!body.slides || !Array.isArray(body.slides)) {
        throw new AppError('Missing required field: slides (must be an array)', 400);
      }

      // Validate each slide has required fields
      for (let i = 0; i < body.slides.length; i++) {
        const slide = body.slides[i];
        if (!slide.file) {
          throw new AppError(`Slide at index ${i} is missing required field: file`, 400);
        }
        if (!slide.file.endsWith('.html')) {
          throw new AppError(`Slide at index ${i} has invalid file: must end with .html`, 400);
        }
      }

      if (dryRun) {
        // Dry run - return what would happen without persisting
        // For simplicity, we'll just validate and return success
        res.json({
          success: true,
          dryRun: true,
          message: 'Dry run successful - no changes made',
          slides: body.slides.length,
        });
        return;
      }

      try {
        const result = await presentationService.bulkAddSlides(id, body.slides, {
          createGroups: body.createGroups,
          position: body.position,
          onConflict: body.onConflict,
        });

        // Notify clients
        io.emit('presentations:updated', { reason: 'slides-bulk-added', presentationId: id });

        res.status(201).json({
          success: true,
          added: result.added,
          skipped: result.skipped,
          updated: result.updated,
          skippedItems: result.skippedItems,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  /**
   * POST /api/presentations/:id/manifest/groups/bulk
   * Bulk add groups to a presentation's manifest.
   */
  router.post(
    '/:id/manifest/groups/bulk',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as BulkAddGroupsRequest;
      const dryRun = body.dryRun || req.query.dryRun === 'true';

      // Validate required fields
      if (!body.groups || !Array.isArray(body.groups)) {
        throw new AppError('Missing required field: groups (must be an array)', 400);
      }

      // Validate each group has required fields
      for (let i = 0; i < body.groups.length; i++) {
        const group = body.groups[i];
        if (!group.id) {
          throw new AppError(`Group at index ${i} is missing required field: id`, 400);
        }
        if (!group.label) {
          throw new AppError(`Group at index ${i} is missing required field: label`, 400);
        }
        // Validate id format (kebab-case safe)
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id)) {
          throw new AppError(
            `Group at index ${i} has invalid id: must be lowercase kebab-case`,
            400
          );
        }
      }

      if (dryRun) {
        // Dry run - return what would happen without persisting
        res.json({
          success: true,
          dryRun: true,
          message: 'Dry run successful - no changes made',
          groups: body.groups.length,
        });
        return;
      }

      try {
        const result = await presentationService.bulkAddGroups(id, body.groups);

        // Notify clients
        io.emit('presentations:updated', { reason: 'groups-bulk-added', presentationId: id });

        res.status(201).json({
          success: true,
          added: result.added,
          skipped: result.skipped,
          skippedItems: result.skippedItems,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  /**
   * PUT /api/presentations/:id/manifest/sync
   * Sync manifest with filesystem - discovers HTML files and updates manifest.
   */
  router.put(
    '/:id/manifest/sync',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as SyncManifestRequest;

      try {
        await presentationService.syncManifest(id, {
          strategy: body.strategy,
          inferGroups: body.inferGroups,
          inferTitles: body.inferTitles,
        });

        // Notify clients
        io.emit('presentations:updated', { reason: 'manifest-synced', presentationId: id });

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
   * POST /api/presentations/:id/manifest/validate
   * Validate a manifest object with optional file existence checking.
   */
  router.post(
    '/:id/manifest/validate',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as ValidateManifestRequest;

      // Validate request body
      if (!body.manifest) {
        throw new AppError('Missing required field: manifest', 400);
      }

      // First validate against JSON Schema
      const schemaValidation = validate(body.manifest);

      if (!schemaValidation.valid) {
        const errors = schemaValidation.errors?.map((e) => ({
          path: e.field,
          message: e.message,
        })) || [];

        res.json({
          valid: false,
          errors,
          warnings: [],
        });
        return;
      }

      // Then check file existence if requested
      try {
        const result = await presentationService.validateManifest(
          id,
          body.manifest,
          body.checkFiles
        );

        res.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError(error.message, 404);
        }
        throw error;
      }
    })
  );

  /**
   * POST /api/presentations/:id/manifest/template
   * Apply a template to a presentation's manifest.
   */
  router.post(
    '/:id/manifest/template',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = req.body as ApplyTemplateRequest;

      // Validate request body
      if (!body.templateId) {
        throw new AppError('Missing required field: templateId', 400);
      }

      // Get template
      const template = getTemplateById(body.templateId);
      if (!template) {
        throw new AppError(`Template not found: ${body.templateId}`, 404);
      }

      try {
        await presentationService.applyTemplate(
          id,
          template,
          body.merge !== false // Default to true
        );

        // Notify clients
        io.emit('presentations:updated', {
          reason: 'template-applied',
          presentationId: id,
        });

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
  // FR-26: Sync From Index HTML
  // ============================================================

  /**
   * PUT /api/presentations/:id/manifest/sync-from-index
   * Parse index HTML files to auto-populate the manifest with slide-to-tab mappings.
   * Detects index-*.html files as tabs and parses card elements to extract slides.
   */
  router.put(
    '/:id/manifest/sync-from-index',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const body = (req.body || {}) as SyncFromIndexRequest;

      try {
        const result = await presentationService.syncFromIndex(id, {
          strategy: body.strategy,
          inferTabs: body.inferTabs,
          parseCards: body.parseCards,
        });

        // Notify clients
        io.emit('presentations:updated', {
          reason: 'manifest-synced-from-index',
          presentationId: id,
        });

        res.json(result);
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

/**
 * Deep merge helper for PATCH validation (matches service implementation).
 */
function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return source;
  }

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (Array.isArray(sourceValue)) {
        result[key] = sourceValue;
      } else if (sourceValue && typeof sourceValue === 'object') {
        result[key] =
          targetValue && typeof targetValue === 'object'
            ? deepMerge(targetValue, sourceValue)
            : sourceValue;
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result;
}
