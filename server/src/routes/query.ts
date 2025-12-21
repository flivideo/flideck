import { Router } from 'express';
import path from 'path';
import fs from 'fs-extra';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { PresentationService } from '../services/PresentationService.js';
import { loadConfig, collapsePath } from '../config.js';

/**
 * Count presentations in a directory (folders containing index.html)
 */
async function countPresentationsInDir(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const indexPath = path.join(dirPath, entry.name, 'index.html');
        try {
          await fs.access(indexPath);
          count++;
        } catch {
          // No index.html, not a presentation
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Create query routes for external system integration.
 * These are read-only endpoints for discovering FliDeck's current state.
 */
export function createQueryRoutes(): Router {
  const router = Router();
  const presentationService = PresentationService.getInstance();

  /**
   * GET /api/query/routes
   * List available presentation routes (directories).
   * Returns current route plus all routes from history.
   */
  router.get(
    '/routes',
    asyncHandler(async (_req, res) => {
      const config = await loadConfig();
      const currentRoot = presentationService.getRoot();
      const currentRouteName = path.basename(currentRoot);

      // Get presentations for current route
      const currentPresentations = await presentationService.discoverAll();

      // Build routes array: current route first, then history
      const routes = [
        {
          name: currentRouteName,
          path: collapsePath(currentRoot),
          presentationCount: currentPresentations.length,
          isCurrent: true,
        },
      ];

      // Add history routes (excluding current if it's in history)
      for (const historyPath of config.history) {
        if (historyPath !== currentRoot) {
          const routeName = path.basename(historyPath);
          const presentationCount = await countPresentationsInDir(historyPath);
          routes.push({
            name: routeName,
            path: collapsePath(historyPath),
            presentationCount,
            isCurrent: false,
          });
        }
      }

      res.json({
        routes,
        currentRoute: currentRouteName,
      });
    })
  );

  /**
   * GET /api/query/routes/:route
   * Get details for a specific route including its presentations.
   */
  router.get(
    '/routes/:route',
    asyncHandler(async (req, res) => {
      const { route } = req.params;
      const root = presentationService.getRoot();
      const routeName = path.basename(root);

      // Currently only support the active route
      if (route !== routeName) {
        throw new AppError(`Route '${route}' not found. Available: ${routeName}`, 404);
      }

      const presentations = await presentationService.discoverAll();

      res.json({
        name: routeName,
        path: root,
        presentations: presentations.map((p) => ({
          id: p.id,
          name: p.name,
          assetCount: p.assets.length,
          lastModified: new Date(p.lastModified).toISOString(),
        })),
      });
    })
  );

  /**
   * GET /api/query/presentations/:id
   * Get detailed information for a specific presentation including assets.
   */
  router.get(
    '/presentations/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const presentation = await presentationService.getById(id);

      if (!presentation) {
        throw new AppError(`Presentation '${id}' not found`, 404);
      }

      const root = presentationService.getRoot();
      const routeName = path.basename(root);

      // Get file sizes for assets
      const assetsWithSize = await Promise.all(
        presentation.assets.map(async (asset, index) => {
          const filePath = path.join(presentation.path, asset.filename);
          let size = 0;
          try {
            const stat = await fs.stat(filePath);
            size = stat.size;
          } catch {
            // File might not exist or be inaccessible
          }

          return {
            id: asset.id,
            name: asset.filename,
            order: index + 1,
            size,
            lastModified: new Date(asset.lastModified).toISOString(),
          };
        })
      );

      res.json({
        id: presentation.id,
        name: presentation.name,
        route: routeName,
        assets: assetsWithSize,
        totalAssets: presentation.assets.length,
      });
    })
  );

  return router;
}
