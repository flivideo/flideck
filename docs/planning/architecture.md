# FliDeck Architecture

Cherry-picked technology stack based on lessons learned from Storyline App and FliHub.

---

## Technology Stack

### Frontend

| Package | Version | Source | Rationale |
|---------|---------|--------|-----------|
| **react** | 19.1.1 | Storyline | Latest stable |
| **react-dom** | 19.1.1 | Storyline | Latest stable |
| **typescript** | 5.9.2 | Storyline | Newer, stricter type checking |
| **vite** | 7.1.5 | Storyline | Latest with better ESM support |
| **@tanstack/react-query** | 5.87.1 | Storyline | Latest features, better caching |
| **react-router-dom** | 7.8.2 | Storyline | Proper routing (vs hash-based) |
| **tailwindcss** | 4.1.13 | Storyline | Latest v4 |
| **socket.io-client** | 4.8.1 | Both | Real-time communication |
| **sonner** | 1.7.x | FliHub | Toast notifications (Storyline lacks this) |

### Backend

| Package | Version | Source | Rationale |
|---------|---------|--------|-----------|
| **express** | 5.1.0 | Both | Latest Express |
| **socket.io** | 4.8.1 | Both | Real-time server |
| **typescript** | 5.9.2 | Storyline | Consistency with client |
| **chokidar** | 3.6.0 | Both | File system watching |
| **sharp** | 0.34.3 | Storyline | Image processing |
| **fs-extra** | 11.3.x | FliHub | Enhanced fs operations |
| **dotenv** | 16.4.x | FliHub | Environment configuration |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| **concurrently** | 9.x | Run client + server in parallel |
| **nodemon** | 3.1.x | Server hot reload |
| **tsx** | 4.19.x | TypeScript execution for Node |
| **@vitejs/plugin-react** | 4.4.x | Vite React integration |

---

## Architectural Patterns

### Pattern Sources

| Pattern | Source | Why |
|---------|--------|-----|
| **Socket.io Rooms** | Storyline | Multi-project isolation, scoped broadcasts |
| **WatcherManager** | FliHub | Centralized file watching with debouncing |
| **Service Layer** | Storyline | EventEmitter singletons for complex domain logic |
| **Route Factory** | FliHub | Dependency injection for testability |
| **AppError + asyncHandler** | FliHub | Cleaner error handling |
| **TanStack + Socket invalidation** | Both | Reactive UI without polling |
| **Shared types workspace** | Both | `@shared` path alias (Storyline style) |

---

## Monorepo Structure

```
flideck/
├── package.json                    # npm workspaces root
├── README.md
├── CLAUDE.md
├── .gitignore
├── .env.example
│
├── client/                         # React frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json               # paths: { "@shared/*": ["../shared/*"] }
│   ├── tsconfig.node.json
│   ├── index.html
│   └── src/
│       ├── main.tsx                # Entry point with providers
│       ├── App.tsx                 # Root component with routing
│       ├── config.ts               # Environment config
│       ├── vite-env.d.ts
│       │
│       ├── hooks/
│       │   ├── useSocket.ts        # Socket.io + room management
│       │   ├── useApi.ts           # TanStack Query hooks
│       │   └── use[Feature].ts     # Feature-specific hooks
│       │
│       ├── components/
│       │   ├── layout/             # Layout components
│       │   ├── ui/                 # Reusable UI components
│       │   └── [feature]/          # Feature components
│       │
│       ├── pages/                  # Route pages
│       │
│       └── utils/
│           ├── api.ts              # API client
│           └── constants.ts        # Query keys, etc.
│
├── server/                         # Express backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── nodemon.json
│   └── src/
│       ├── index.ts                # Server entry + Socket.io setup
│       ├── WatcherManager.ts       # Centralized file watching
│       │
│       ├── middleware/
│       │   └── errorHandler.ts     # AppError + asyncHandler
│       │
│       ├── services/               # Business logic (EventEmitter singletons)
│       │   └── [Feature]Service.ts
│       │
│       ├── routes/                 # Express routes (factory pattern)
│       │   ├── index.ts            # Route aggregation
│       │   └── [feature].ts
│       │
│       └── utils/
│           └── pathUtils.ts
│
├── shared/                         # Shared TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   ├── types.ts                    # Core type definitions
│   └── [domain].ts                 # Domain utilities
│
└── docs/
    ├── planning/
    │   └── architecture.md         # This file
    └── [other docs]
```

---

## Package Configuration

### Root package.json

```json
{
  "name": "flideck",
  "private": true,
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "start": "npm start -w server",
    "typecheck": "npm run typecheck -w client && npm run typecheck -w server"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

### Client package.json

```json
{
  "name": "@flideck/client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.8.0",
    "@tanstack/react-query": "^5.87.0",
    "socket.io-client": "^4.8.0",
    "sonner": "^1.7.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.9.0",
    "vite": "^7.1.0"
  }
}
```

### Server package.json

```json
{
  "name": "@flideck/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^5.1.0",
    "socket.io": "^4.8.0",
    "chokidar": "^3.6.0",
    "sharp": "^0.34.0",
    "fs-extra": "^11.3.0",
    "dotenv": "^16.4.0",
    "helmet": "^8.0.0",
    "compression": "^1.7.0",
    "cors": "^2.8.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/fs-extra": "^11.0.0",
    "@types/node": "^22.0.0",
    "@types/compression": "^1.7.0",
    "@types/cors": "^2.8.0",
    "nodemon": "^3.1.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.0"
  }
}
```

### Shared package.json

```json
{
  "name": "@flideck/shared",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.9.0"
  }
}
```

---

## Core Code Patterns

### 1. Socket.io Hook (Hybrid Pattern)

```typescript
// client/src/hooks/useSocket.ts
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useState } from 'react';
import { API_URL } from '../config';

// Singleton socket instance
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });
  }
  return socket;
}

// Connection status hook
export function useSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    setIsConnected(s.connected);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return isConnected;
}

// Room management (Storyline pattern)
export function useProjectRoom(projectId: string | null) {
  useEffect(() => {
    if (!projectId) return;

    const s = getSocket();
    s.emit('join:project', { projectId });

    return () => {
      s.emit('leave:project', { projectId });
    };
  }, [projectId]);
}

// Cache invalidation (FliHub pattern)
export function useSocketInvalidation(event: string, queryKey: string[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    const handler = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    s.on(event, handler);
    return () => { s.off(event, handler); };
  }, [queryClient, event, JSON.stringify(queryKey)]);
}

// Combined hook for feature-specific socket events
export function useFeatureSocket(
  projectId: string | null,
  events: Array<{ event: string; queryKey: string[] }>
) {
  useProjectRoom(projectId);

  const queryClient = useQueryClient();

  useEffect(() => {
    const s = getSocket();
    const handlers = events.map(({ event, queryKey }) => ({
      event,
      handler: () => queryClient.invalidateQueries({ queryKey })
    }));

    handlers.forEach(({ event, handler }) => s.on(event, handler));

    return () => {
      handlers.forEach(({ event, handler }) => s.off(event, handler));
    };
  }, [queryClient, projectId, events]);
}
```

### 2. WatcherManager (FliHub Pattern)

```typescript
// server/src/WatcherManager.ts
import { watch, FSWatcher } from 'chokidar';
import { Server } from 'socket.io';

interface WatchConfig {
  name: string;
  path: string;
  event: string;
  debounceMs?: number;
  room?: string; // Optional room for scoped broadcasts
}

export class WatcherManager {
  private watchers = new Map<string, FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(private io: Server) {}

  watch(config: WatchConfig): void {
    const { name, path, event, debounceMs = 300, room } = config;

    if (this.watchers.has(name)) {
      console.log(`Watcher "${name}" already exists, skipping`);
      return;
    }

    const watcher = watch(path, {
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../,  // Ignore hidden files
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    watcher.on('all', (eventType, filePath) => {
      this.debounceEmit(name, event, debounceMs, room, { eventType, filePath });
    });

    watcher.on('error', (error) => {
      console.error(`Watcher "${name}" error:`, error);
    });

    this.watchers.set(name, watcher);
    console.log(`Started watcher "${name}" on ${path}`);
  }

  private debounceEmit(
    name: string,
    event: string,
    ms: number,
    room?: string,
    data?: unknown
  ): void {
    const timerKey = `${name}:${event}`;
    const existing = this.debounceTimers.get(timerKey);

    if (existing) {
      clearTimeout(existing);
    }

    this.debounceTimers.set(timerKey, setTimeout(() => {
      if (room) {
        this.io.to(room).emit(event, data);
      } else {
        this.io.emit(event, data);
      }
      this.debounceTimers.delete(timerKey);
    }, ms));
  }

  stop(name: string): void {
    const watcher = this.watchers.get(name);
    if (watcher) {
      watcher.close();
      this.watchers.delete(name);
      console.log(`Stopped watcher "${name}"`);
    }
  }

  stopAll(): void {
    for (const [name] of this.watchers) {
      this.stop(name);
    }
  }

  shutdown(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    this.stopAll();
    console.log('WatcherManager shutdown complete');
  }

  getActiveWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }
}
```

### 3. Service Layer (Storyline Pattern)

```typescript
// server/src/services/DataService.ts
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';

interface ServiceEvents {
  'data:loaded': { projectId: string; data: unknown };
  'data:saved': { projectId: string };
  'data:error': { projectId: string; error: Error };
}

export class DataService extends EventEmitter {
  private static instance: DataService;
  private cache = new Map<string, unknown>();

  private constructor() {
    super();
  }

  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  async load<T>(projectId: string, filename: string): Promise<T | null> {
    const cacheKey = `${projectId}:${filename}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as T;
    }

    try {
      const filePath = this.getFilePath(projectId, filename);

      if (!await fs.pathExists(filePath)) {
        return null;
      }

      const data = await fs.readJson(filePath);
      this.cache.set(cacheKey, data);

      this.emit('data:loaded', { projectId, data });
      return data as T;
    } catch (error) {
      this.emit('data:error', { projectId, error: error as Error });
      throw error;
    }
  }

  async save<T>(projectId: string, filename: string, data: T): Promise<void> {
    const cacheKey = `${projectId}:${filename}`;

    try {
      const filePath = this.getFilePath(projectId, filename);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJson(filePath, data, { spaces: 2 });

      this.cache.set(cacheKey, data);
      this.emit('data:saved', { projectId });
    } catch (error) {
      this.emit('data:error', { projectId, error: error as Error });
      throw error;
    }
  }

  invalidateCache(projectId?: string): void {
    if (projectId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${projectId}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  private getFilePath(projectId: string, filename: string): string {
    // Override in subclass or configure via constructor
    return path.join(process.cwd(), 'data', projectId, filename);
  }
}
```

### 4. Route Factory (FliHub Pattern)

```typescript
// server/src/routes/projects.ts
import { Router } from 'express';
import { Server } from 'socket.io';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { DataService } from '../services/DataService';

interface RouteConfig {
  getConfig: () => Config;
  io: Server;
}

export function createProjectRoutes({ getConfig, io }: RouteConfig): Router {
  const router = Router();
  const dataService = DataService.getInstance();

  // GET /api/projects
  router.get('/', asyncHandler(async (req, res) => {
    const config = getConfig();
    const projects = await listProjects(config.projectsRoot);
    res.json({ success: true, data: projects });
  }));

  // GET /api/projects/:id
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = await dataService.load(id, 'project.json');

    if (!data) {
      throw new AppError('Project not found', 404);
    }

    res.json({ success: true, data });
  }));

  // POST /api/projects/:id
  router.post('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data } = req.body;

    await dataService.save(id, 'project.json', data);

    // Emit to project room
    io.to(`project:${id}`).emit('project:updated', { projectId: id });

    res.json({ success: true });
  }));

  // DELETE /api/projects/:id
  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Implementation...

    io.to(`project:${id}`).emit('project:deleted', { projectId: id });
    res.json({ success: true });
  }));

  return router;
}

async function listProjects(rootPath: string): Promise<string[]> {
  // Implementation
  return [];
}
```

### 5. Error Handler (FliHub Pattern)

```typescript
// server/src/middleware/errorHandler.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  console.error('Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Send response
  res.status(statusCode).json({
    success: false,
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
}
```

### 6. Server Entry Point

```typescript
// server/src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { WatcherManager } from './WatcherManager';
import { createProjectRoutes } from './routes/projects';

dotenv.config();

const PORT = process.env.PORT || 5101;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Express app
const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Config
let currentConfig: Config = loadConfig();

function getConfig(): Config {
  return currentConfig;
}

function updateConfig(updates: Partial<Config>): Config {
  currentConfig = { ...currentConfig, ...updates };
  saveConfig(currentConfig);
  return currentConfig;
}

// Watcher Manager
const watcherManager = new WatcherManager(io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join:project', ({ projectId }) => {
    socket.join(`project:${projectId}`);
    socket.emit('project:joined', { projectId });
    console.log(`Socket ${socket.id} joined project:${projectId}`);
  });

  socket.on('leave:project', ({ projectId }) => {
    socket.leave(`project:${projectId}`);
    socket.emit('project:left', { projectId });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Routes
app.use('/api/projects', createProjectRoutes({ getConfig, io }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
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
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Client URL: ${CLIENT_URL}`);
});

// Helper functions
function loadConfig(): Config {
  // Implementation
  return {} as Config;
}

function saveConfig(config: Config): void {
  // Implementation
}

interface Config {
  projectsRoot: string;
  // Add more config options
}
```

### 7. API Client (Storyline Pattern)

```typescript
// client/src/utils/api.ts
import { API_URL } from '../config';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data.data as T;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
```

### 8. TanStack Query Setup

```typescript
// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes (formerly cacheTime)
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster richColors position="bottom-right" />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## Environment Configuration

### .env.example

```bash
# Server
PORT=5101
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Paths
PROJECTS_ROOT=~/projects

# Optional
LOG_LEVEL=info
```

### Client config.ts

```typescript
// client/src/config.ts
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5101';
export const WS_URL = import.meta.env.VITE_WS_URL || API_URL;
```

---

## TypeScript Configuration

### Client tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Server tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Ports

| Service | Port | Environment Variable |
|---------|------|---------------------|
| Server (Express + Socket.io) | 5101 | `PORT` |
| Client (Vite dev) | 5173 | Vite default |

---

## Summary

This architecture combines:

- **Latest dependencies** from Storyline (React 19.1, Vite 7, TypeScript 5.9, TanStack Query 5.87)
- **React Router** from Storyline for proper URL-based routing
- **Sonner** from FliHub for toast notifications
- **WatcherManager** from FliHub for centralized, debounced file watching
- **Service Layer** from Storyline for complex domain logic
- **Route Factory + AppError** from FliHub for clean, testable routes
- **Socket.io rooms** from Storyline for multi-project scalability
- **TanStack Query + Socket.io invalidation** from both for reactive UI

The result is a proven, production-ready foundation for building full-stack TypeScript applications with real-time capabilities.
