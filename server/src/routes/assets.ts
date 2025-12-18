import { Router } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { PresentationService } from '../services/PresentationService.js';

/**
 * Create asset routes for serving HTML content.
 */
export function createAssetRoutes(): Router {
  const router = Router();
  const presentationService = PresentationService.getInstance();

  /**
   * GET /api/assets/:presentationId/:assetId
   * Serve the raw HTML content of an asset.
   */
  router.get(
    '/:presentationId/:assetId',
    asyncHandler(async (req, res) => {
      const { presentationId, assetId } = req.params;

      const presentation = await presentationService.getById(presentationId);
      if (!presentation) {
        throw new AppError('Presentation not found', 404);
      }

      const asset = presentation.assets.find((a) => a.id === assetId);
      if (!asset) {
        throw new AppError('Asset not found', 404);
      }

      const assetPath = path.join(presentation.path, asset.filename);

      if (!(await fs.pathExists(assetPath))) {
        throw new AppError('Asset file not found', 404);
      }

      const content = await fs.readFile(assetPath, 'utf-8');
      res.json({ success: true, data: { content, asset } });
    })
  );

  return router;
}
