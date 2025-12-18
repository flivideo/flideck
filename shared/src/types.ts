// Core domain types for FliDeck

/**
 * A presentation is a folder containing index.html and asset files.
 * The folder is the atomic unit - if it has index.html, it's displayable.
 */
export interface Presentation {
  /** Unique identifier (folder name) */
  id: string;
  /** Display name derived from folder name */
  name: string;
  /** Absolute path to the presentation folder */
  path: string;
  /** List of HTML asset files in this presentation */
  assets: Asset[];
  /** Timestamp when presentation was last modified */
  lastModified: number;
}

/**
 * An asset is a self-contained HTML file within a presentation.
 * Assets may contain embedded CSS, JavaScript, and external font references.
 */
export interface Asset {
  /** Unique identifier (filename without extension) */
  id: string;
  /** Display name derived from filename */
  name: string;
  /** Filename (e.g., 'slides.html') */
  filename: string;
  /** Relative path from presentation root */
  relativePath: string;
  /** Whether this is the index.html entry point */
  isIndex: boolean;
  /** Timestamp when asset was last modified */
  lastModified: number;
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Root directory for presentations */
  presentationsRoot: string;
  /** Server port */
  port: number;
  /** Client URL for CORS */
  clientUrl: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Socket.io event types for real-time updates
 */
export interface SocketEvents {
  // Client -> Server
  'join:presentation': { presentationId: string };
  'leave:presentation': { presentationId: string };

  // Server -> Client
  'presentations:updated': { eventType: string; filePath: string };
  'presentation:joined': { presentationId: string };
  'presentation:left': { presentationId: string };
  'asset:changed': { presentationId: string; assetId: string };
}

/**
 * File watcher event types
 */
export type WatcherEventType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

/**
 * File system change event
 */
export interface FileChangeEvent {
  eventType: WatcherEventType;
  filePath: string;
  presentationId?: string;
}
