import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { WatcherManager, type ChangeEventData } from './WatcherManager.js';
import { createRoutes } from './routes/index.js';
import { PresentationService } from './services/PresentationService.js';
import { loadConfig, getConfigPath, addToHistory, type Config } from './config.js';

// Load environment variables (for PORT and CLIENT_URL only)
dotenv.config();

// Configuration (PORT and CLIENT_URL remain as env vars - they're startup-only)
const PORT = parseInt(process.env.PORT || '5201', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5200';

// Mutable state for hot-reloadable config
let currentConfig: Config;
let currentPresentationsRoot: string;

/**
 * Parse a file path to extract presentation and asset information.
 * Returns null if the path is not a valid presentation asset.
 */
function parseAssetPath(filePath: string, presentationsRoot: string): { presentationId: string; assetId: string; filename: string } | null {
  // Get relative path from presentations root
  const relativePath = path.relative(presentationsRoot, filePath);
  if (!relativePath || relativePath.startsWith('..')) {
    return null;
  }

  // Split into parts: first part is presentation folder, rest is the file path
  const parts = relativePath.split(path.sep);
  if (parts.length < 2) {
    return null;
  }

  const presentationId = parts[0];
  const filename = parts[parts.length - 1];

  // Only handle files that are presentation assets (HTML, CSS, JS, images, etc.)
  const ext = path.extname(filename).toLowerCase();
  const assetExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.json'];
  if (!assetExtensions.includes(ext)) {
    return null;
  }

  // Asset ID is filename without extension
  const assetId = path.basename(filename, ext);

  return { presentationId, assetId, filename };
}

/**
 * Handle file system changes in presentations directory.
 * Emits granular socket events based on change type.
 */
function handlePresentationChange(data: ChangeEventData): void {
  const { eventType, filePath } = data;
  const assetInfo = parseAssetPath(filePath, currentPresentationsRoot);

  // Always invalidate cache for any change
  presentationService.invalidateCache();

  // Determine if this is a content change (file modified) or structure change (file added/removed)
  const isContentChange = eventType === 'change';
  const isStructureChange = ['add', 'unlink', 'addDir', 'unlinkDir'].includes(eventType);

  if (isContentChange && assetInfo) {
    // Content changed - emit specific event for iframe reload
    io.emit('content:changed', {
      presentationId: assetInfo.presentationId,
      assetId: assetInfo.assetId,
      filename: assetInfo.filename,
    });
    console.log(`Content changed: ${assetInfo.presentationId}/${assetInfo.filename}`);
  }

  if (isStructureChange) {
    // Structure changed - emit event for sidebar refresh
    io.emit('structure:changed', {
      eventType,
      filePath,
      presentationId: assetInfo?.presentationId,
    });
    console.log(`Structure changed (${eventType}): ${filePath}`);

    // Also emit the legacy event for structure changes only
    io.emit('presentations:updated', data);
  }
}

// Express app
const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for serving HTML assets
  })
);
app.use(compression());
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Initialize services
const presentationService = PresentationService.getInstance();
const watcherManager = new WatcherManager(io);

/**
 * Static files for flideck-index.js library
 */
app.use(express.static(path.join(process.cwd(), 'public')));

/**
 * Dynamic static file serving middleware
 * Uses current presentations root which can change at runtime
 */
app.use('/presentations', (req, res, next) => {
  // Create static handler with current root on each request
  // This allows hot-reload of the presentations directory
  express.static(currentPresentationsRoot)(req, res, next);
});

/**
 * Handle config changes - update watchers, service, and notify clients
 */
async function handleConfigChange(newConfig: Config, previousRoot?: string): Promise<void> {
  const rootChanged = previousRoot && previousRoot !== newConfig.presentationsRoot;

  if (rootChanged) {
    console.log(`Presentations root changed: ${previousRoot} -> ${newConfig.presentationsRoot}`);

    // Add previous root to history
    currentConfig = await addToHistory(newConfig, previousRoot);

    // Stop the old presentation watcher
    watcherManager.stop('presentations');

    // Update the presentation service root
    presentationService.setRoot(newConfig.presentationsRoot);

    // Start new watcher for the new path
    watcherManager.watch({
      name: 'presentations',
      path: newConfig.presentationsRoot,
      event: 'presentations:updated',
      debounceMs: 200,
      onChangeCallback: handlePresentationChange,
    });

    // Invalidate cache to force re-discovery
    presentationService.invalidateCache();

    // Notify clients that config changed
    io.emit('config:changed', {
      presentationsRoot: newConfig.presentationsRoot,
    });

    console.log('Config hot-reload complete');
  }

  // Update current state
  currentConfig = newConfig;
  currentPresentationsRoot = newConfig.presentationsRoot;
}

/**
 * Initialize the server with config
 */
async function initialize(): Promise<void> {
  // Load initial config
  currentConfig = await loadConfig();
  currentPresentationsRoot = currentConfig.presentationsRoot;

  console.log(`Loaded config: presentationsRoot = ${currentPresentationsRoot}`);

  // Initialize presentation service with config
  presentationService.setRoot(currentPresentationsRoot);
  presentationService.setClientUrl(CLIENT_URL);

  // Start watching presentations directory
  watcherManager.watch({
    name: 'presentations',
    path: currentPresentationsRoot,
    event: 'presentations:updated',
    debounceMs: 200, // Faster debounce for real-time feel
    onChangeCallback: handlePresentationChange,
  });

  // Start watching config.json for hot-reload
  watcherManager.watch({
    name: 'config',
    path: getConfigPath(),
    event: 'config:updated',
    debounceMs: 500,
    onChangeCallback: async () => {
      // Reload config when config.json changes
      try {
        const previousRoot = currentPresentationsRoot;
        const newConfig = await loadConfig();
        await handleConfigChange(newConfig, previousRoot);
      } catch (error) {
        console.error('Failed to reload config:', error);
      }
    },
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join:presentation', ({ presentationId }) => {
    socket.join(`presentation:${presentationId}`);
    socket.emit('presentation:joined', { presentationId });
    console.log(`Socket ${socket.id} joined presentation:${presentationId}`);
  });

  socket.on('leave:presentation', ({ presentationId }) => {
    socket.leave(`presentation:${presentationId}`);
    socket.emit('presentation:left', { presentationId });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Note: Cache invalidation and config reload are handled via watcher callbacks
// See initialize() for callback setup

// API Routes
app.use('/api', createRoutes({ io, watcherManager }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    presentationsRoot: currentPresentationsRoot,
    activeWatchers: watcherManager.getActiveWatchers(),
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  watcherManager.shutdown();

  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
async function start(): Promise<void> {
  try {
    await initialize();

    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                   FliDeck Server                      ║
╠═══════════════════════════════════════════════════════╣
║  Server:         http://localhost:${PORT}                ║
║  Client URL:     ${CLIENT_URL.padEnd(32)}║
║  Presentations:  ${currentPresentationsRoot.slice(-32).padEnd(32)}║
║  Config:         config.json (hot-reload enabled)     ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
