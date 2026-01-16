import { Router, Request, Response } from 'express';
import { MockupsService } from '../services/MockupsService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import path from 'path';

const router = Router();
const mockupsService = MockupsService.getInstance();

/**
 * GET /api/mockups/scan
 * Scan mockups directory and return all images with metadata
 */
router.get(
  '/scan',
  asyncHandler(async (_req: Request, res: Response) => {
    const mockups = await mockupsService.scan();
    res.json(mockups);
  })
);

/**
 * POST /api/mockups/refresh
 * Force refresh mockups cache
 */
router.post(
  '/refresh',
  asyncHandler(async (_req: Request, res: Response) => {
    const mockups = await mockupsService.refresh();
    res.json({
      success: true,
      message: 'Mockups cache refreshed',
      count: mockups.length,
    });
  })
);

/**
 * GET /api/mockups
 * Get all mockups (uses cache)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { dimension, model, search } = req.query;

    let mockups;

    if (dimension && typeof dimension === 'string') {
      mockups = await mockupsService.getByDimension(dimension);
    } else if (model && typeof model === 'string') {
      mockups = await mockupsService.getByModel(model);
    } else if (search && typeof search === 'string') {
      mockups = await mockupsService.search(search);
    } else {
      mockups = await mockupsService.getAll();
    }

    res.json(mockups);
  })
);

/**
 * GET /api/mockups/stats
 * Get mockups cache statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = mockupsService.getStats();
    const dimensions = await mockupsService.getDimensions();
    const models = await mockupsService.getModels();
    const folders = await mockupsService.getFolders();

    res.json({
      ...stats,
      dimensions,
      models,
      folders,
    });
  })
);

/**
 * GET /api/mockups/dimensions
 * Get list of all unique dimensions
 */
router.get(
  '/dimensions',
  asyncHandler(async (_req: Request, res: Response) => {
    const dimensions = await mockupsService.getDimensions();
    res.json(dimensions);
  })
);

/**
 * GET /api/mockups/models
 * Get list of all unique models
 */
router.get(
  '/models',
  asyncHandler(async (_req: Request, res: Response) => {
    const models = await mockupsService.getModels();
    res.json(models);
  })
);

/**
 * GET /api/mockups/folders
 * Get list of all unique folders
 */
router.get(
  '/folders',
  asyncHandler(async (_req: Request, res: Response) => {
    const folders = await mockupsService.getFolders();
    res.json(folders);
  })
);

/**
 * GET /api/mockups/metadata/:id
 * Get metadata for specific mockup
 */
router.get(
  '/metadata/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const mockup = await mockupsService.getById(id);

    if (!mockup) {
      res.status(404).json({ error: 'Mockup not found' });
      return;
    }

    res.json(mockup.metadata);
  })
);

/**
 * GET /api/mockups/image/:id
 * Serve full-resolution image
 */
router.get(
  '/image/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const mockup = await mockupsService.getById(id);

    if (!mockup) {
      res.status(404).json({ error: 'Mockup not found' });
      return;
    }

    const imageBuffer = await mockupsService.getImage(id);
    const ext = path.extname(mockup.filename).toLowerCase();

    // Set appropriate content type
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.set('Content-Type', contentType);
    res.send(imageBuffer);
  })
);

/**
 * GET /api/mockups/thumbnail/:id
 * Serve thumbnail image (for now, just returns full image - can add resizing later)
 */
router.get(
  '/thumbnail/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const mockup = await mockupsService.getById(id);

    if (!mockup) {
      res.status(404).json({ error: 'Mockup not found' });
      return;
    }

    // TODO: Add image resizing/thumbnail generation
    // For now, just return the full image
    const imageBuffer = await mockupsService.getImage(id);
    const ext = path.extname(mockup.filename).toLowerCase();

    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.set('Content-Type', contentType);
    res.send(imageBuffer);
  })
);

/**
 * GET /api/mockups/:id
 * Get mockup by ID with full metadata
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const mockup = await mockupsService.getById(id);

    if (!mockup) {
      res.status(404).json({ error: 'Mockup not found' });
      return;
    }

    res.json(mockup);
  })
);

export default router;
