import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { WatcherManager } from './WatcherManager.js';
import { createRoutes } from './routes/index.js';
import { PresentationService } from './services/PresentationService.js';

// Load environment variables
dotenv.config();

// Configuration
const PORT = parseInt(process.env.PORT || '5201', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5200';
// Resolve presentations path relative to project root (server/src -> server -> project root)
const PRESENTATIONS_ROOT =
  process.env.PRESENTATIONS_ROOT ||
  path.resolve(__dirname, '../..', 'presentations');

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
presentationService.setRoot(PRESENTATIONS_ROOT);

// Watcher Manager
const watcherManager = new WatcherManager(io);

// Start watching presentations directory
watcherManager.watch({
  name: 'presentations',
  path: PRESENTATIONS_ROOT,
  event: 'presentations:updated',
  debounceMs: 500,
});

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

// Invalidate cache on file changes
io.on('connection', () => {
  // Listen for our own events to invalidate cache
  const handler = () => {
    presentationService.invalidateCache();
  };
  io.on('presentations:updated', handler);
});

// API Routes
app.use('/api', createRoutes({ io }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    presentationsRoot: PRESENTATIONS_ROOT,
    activeWatchers: watcherManager.getActiveWatchers(),
  });
});

// Static file serving for presentations
// This allows assets to reference relative paths
app.use('/presentations', express.static(PRESENTATIONS_ROOT));

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
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                   FliDeck Server                      ║
╠═══════════════════════════════════════════════════════╣
║  Server:         http://localhost:${PORT}                ║
║  Client URL:     ${CLIENT_URL.padEnd(32)}║
║  Presentations:  ${PRESENTATIONS_ROOT.slice(-32).padEnd(32)}║
╚═══════════════════════════════════════════════════════╝
  `);
});
