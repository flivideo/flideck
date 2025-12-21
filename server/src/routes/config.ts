import { Router } from 'express';
import type { Server } from 'socket.io';
import fs from 'fs/promises';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import {
  loadConfig,
  saveConfig,
  expandPath,
  collapsePath,
  type Config,
} from '../config.js';
import { PresentationService } from '../services/PresentationService.js';
import { WatcherManager } from '../WatcherManager.js';

interface RouteConfig {
  io: Server;
  watcherManager: WatcherManager;
}

/**
 * Create config routes with dependency injection.
 */
export function createConfigRoutes({ io, watcherManager }: RouteConfig): Router {
  const router = Router();
  const presentationService = PresentationService.getInstance();

  /**
   * GET /api/config
   * Get current configuration.
   */
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const config = await loadConfig();

      // Return with collapsed paths for display
      res.json({
        success: true,
        data: {
          presentationsRoot: collapsePath(config.presentationsRoot),
          history: config.history.map(collapsePath),
        },
      });
    })
  );

  /**
   * PUT /api/config
   * Update configuration (presentationsRoot).
   */
  router.put(
    '/',
    asyncHandler(async (req, res) => {
      const { presentationsRoot } = req.body;

      if (!presentationsRoot || typeof presentationsRoot !== 'string') {
        throw new AppError('presentationsRoot is required', 400);
      }

      // Expand and validate the new path
      const expandedPath = expandPath(presentationsRoot);

      // Check if path exists
      try {
        const stat = await fs.stat(expandedPath);
        if (!stat.isDirectory()) {
          throw new AppError('Path is not a directory', 400);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new AppError('Directory does not exist', 404);
        }
        throw error;
      }

      // Load current config
      const currentConfig = await loadConfig();
      const previousRoot = currentConfig.presentationsRoot;

      // Only update if actually changed
      if (expandedPath !== previousRoot) {
        // Add previous root to history
        const newHistory = [previousRoot, ...currentConfig.history.filter((h) => h !== previousRoot)].slice(0, 10);

        const newConfig: Config = {
          presentationsRoot: expandedPath,
          history: newHistory,
        };

        // Save config
        await saveConfig(newConfig);

        // Stop old watcher, update service, start new watcher
        watcherManager.stop('presentations');
        presentationService.setRoot(expandedPath);
        watcherManager.watch({
          name: 'presentations',
          path: expandedPath,
          event: 'presentations:updated',
          debounceMs: 500,
          onChangeCallback: () => {
            presentationService.invalidateCache();
          },
        });

        // Invalidate cache
        presentationService.invalidateCache();

        // Notify clients
        io.emit('config:changed', {
          presentationsRoot: collapsePath(expandedPath),
        });

        console.log(`Config updated: presentationsRoot = ${expandedPath}`);
      }

      res.json({
        success: true,
        data: {
          presentationsRoot: collapsePath(expandedPath),
        },
      });
    })
  );

  return router;
}
