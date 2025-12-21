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
  /** Full URL to view this asset in the browser */
  url?: string;
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
  'config:changed': { presentationsRoot: string };

  // Granular file change events for real-time updates
  'content:changed': { presentationId: string; assetId: string; filename: string };
  'structure:changed': { eventType: string; filePath: string; presentationId?: string };
}

/**
 * Configuration response from /api/config
 */
export interface ConfigResponse {
  /** Current presentations root path (with tilde notation) */
  presentationsRoot: string;
  /** Previously used presentation roots */
  history: string[];
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

/**
 * FliDeck manifest file structure (flideck.json)
 * Used for custom asset ordering within presentations
 */
export interface FlideckManifest {
  /** Asset configuration */
  assets?: {
    /** Custom ordering of assets by filename (e.g., ["intro.html", "main.html"]) */
    order?: string[];
  };
}

/**
 * Request body for updating asset order
 */
export interface UpdateAssetOrderRequest {
  /** Ordered array of asset filenames */
  order: string[];
}
