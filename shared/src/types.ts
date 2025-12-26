// Core domain types for FliDeck

/**
 * A presentation is a folder containing index.html and asset files.
 * The folder is the atomic unit - if it has index.html, it's displayable.
 */
export interface Presentation {
  /** Unique identifier (folder name) */
  id: string;
  /** Display name derived from folder name or manifest meta.name */
  name: string;
  /** Absolute path to the presentation folder */
  path: string;
  /** List of HTML asset files in this presentation */
  assets: Asset[];
  /** Timestamp when presentation was last modified */
  lastModified: number;
  /** Group definitions from manifest (if present) */
  groups?: Record<string, GroupDefinition>;
  /** Metadata from manifest (if present) */
  meta?: ManifestMeta;
  /** Container-level tabs from manifest (if present, FR-24) */
  tabs?: TabDefinition[];
}

/**
 * An asset is a self-contained HTML file within a presentation.
 * Assets may contain embedded CSS, JavaScript, and external font references.
 */
export interface Asset {
  /** Unique identifier (filename without extension) */
  id: string;
  /** Display name derived from filename or manifest title */
  name: string;
  /** Filename (e.g., 'slides.html') */
  filename: string;
  /** Relative path from presentation root */
  relativePath: string;
  /** Whether this is the index.html entry point */
  isIndex: boolean;
  /** Timestamp when asset was created (birthtime, falls back to mtime) */
  createdAt: number;
  /** Timestamp when asset was last modified */
  lastModified: number;
  /** Full URL to view this asset in the browser */
  url?: string;
  /** Group ID this asset belongs to (from manifest) */
  group?: string;
  /** Title from manifest (if provided) */
  title?: string;
  /** Description from manifest (if provided) */
  description?: string;
  /** Whether this slide is recommended (from manifest) */
  recommended?: boolean;
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
 * Display mode for rendering presentations
 */
export type DisplayMode = 'flat' | 'grouped' | 'tabbed';

/**
 * Manifest metadata for presentation-level information
 */
export interface ManifestMeta {
  /** Display name for the presentation */
  name?: string;
  /** Purpose or description of the presentation */
  purpose?: string;
  /** Source path for collection data */
  collection_source?: string;
  /** Path to component library */
  component_library?: string;
  /** Creation date (ISO format) */
  created?: string;
  /** Last updated date (ISO format) */
  updated?: string;
  /** Rendering mode for the sidebar (FR-20) */
  displayMode?: DisplayMode;
}

/**
 * Manifest statistics for aggregate counts
 */
export interface ManifestStats {
  /** Total number of slides */
  total_slides?: number;
  /** Number of groups */
  groups?: number;
  /** Allow additional stats */
  [key: string]: unknown;
}

/**
 * Group definition for organizing slides
 */
export interface GroupDefinition {
  /** Display label for the group */
  label: string;
  /** Sort order (lower = earlier) */
  order: number;
  /** If true, this group becomes a tab in tabbed mode (FR-20) */
  tab?: boolean;
  /** Parent group ID - nests this group under a tab (FR-20, FR-24) */
  parent?: string;
  /** Which container tab this group belongs to (FR-24) */
  tabId?: string;
}

/**
 * Tab definition for container-level navigation (FR-24)
 */
export interface TabDefinition {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional subtitle shown under label */
  subtitle?: string;
  /** Index HTML file to load for this tab */
  file: string;
  /** Sort order (lower = earlier) */
  order: number;
}

/**
 * Slide definition in the manifest
 */
export interface ManifestSlide {
  /** Filename (e.g., 'intro.html') */
  file: string;
  /** Display title */
  title?: string;
  /** Description */
  description?: string;
  /** Slide type (e.g., 'cards', 'checklist') */
  type?: string;
  /** Group ID this slide belongs to */
  group?: string;
  /** Structure description */
  structure?: string;
  /** Preview description */
  preview?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Whether this slide is recommended */
  recommended?: boolean;
  /** Additional notes */
  notes?: string | null;
}

/**
 * FliDeck manifest file structure (index.json, or legacy flideck.json)
 * Supports both new rich schema and legacy format
 */
export interface FlideckManifest {
  // New rich format
  /** Presentation metadata */
  meta?: ManifestMeta;
  /** Aggregate statistics */
  stats?: ManifestStats;
  /** Group definitions */
  groups?: Record<string, GroupDefinition>;
  /** Ordered slides array with metadata */
  slides?: ManifestSlide[];
  /** Container-level tabs (FR-24) */
  tabs?: TabDefinition[];

  // Legacy format (still supported)
  /** Legacy asset configuration */
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

/**
 * Request body for updating asset order with groups
 */
export interface UpdateAssetOrderWithGroupsRequest {
  /** Ordered slides with group assignments */
  slides: Array<{ file: string; group?: string }>;
}

// ============================================================
// FR-16: Agent Slide Management API Types
// ============================================================

/**
 * Request body for creating a new presentation
 */
export interface CreatePresentationRequest {
  /** Presentation ID (becomes folder name) */
  id: string;
  /** Optional display name */
  name?: string;
  /** Optional initial slides */
  slides?: Array<{
    file: string;
    title?: string;
    group?: string;
  }>;
}

/**
 * Response from creating a presentation
 */
export interface CreatePresentationResponse {
  success: boolean;
  /** Path to the created presentation folder */
  path: string;
}

/**
 * Request body for adding a slide to a presentation
 */
export interface AddSlideRequest {
  /** Filename (e.g., 'new-slide.html') */
  file: string;
  /** Display title */
  title?: string;
  /** Group ID */
  group?: string;
  /** Description */
  description?: string;
  /** Whether slide is recommended */
  recommended?: boolean;
}

/**
 * Request body for updating slide metadata
 */
export interface UpdateSlideRequest {
  /** Display title */
  title?: string;
  /** Group ID */
  group?: string;
  /** Description */
  description?: string;
  /** Whether slide is recommended */
  recommended?: boolean;
}

// ============================================================
// FR-17: Group Management API Types
// ============================================================

/**
 * Request body for reordering groups
 */
export interface ReorderGroupsRequest {
  /** Ordered array of group IDs */
  order: string[];
}

/**
 * Request body for creating a new group
 */
export interface CreateGroupRequest {
  /** Group ID (must be unique, kebab-case) */
  id: string;
  /** Display label */
  label: string;
}

/**
 * Request body for updating a group
 */
export interface UpdateGroupRequest {
  /** Display label */
  label: string;
}

// ============================================================
// FR-22: Tab Management API Types
// ============================================================

/**
 * Strategy for handling child groups when deleting a tab
 */
export type DeleteTabStrategy = 'orphan' | 'cascade';

/**
 * Request body for creating a new tab
 */
export interface CreateTabRequest {
  /** Tab ID (must be unique, kebab-case) */
  id: string;
  /** Display label */
  label: string;
}

/**
 * Request body for updating a tab
 */
export interface UpdateTabRequest {
  /** Display label */
  label: string;
}

/**
 * Request body for reordering tabs
 */
export interface ReorderTabsRequest {
  /** Ordered array of tab IDs */
  order: string[];
}

/**
 * Request body for setting a group's parent tab
 */
export interface SetGroupParentRequest {
  /** Parent tab ID */
  parent: string;
}

// ============================================================
// FR-21: Agent Manifest Tooling Types
// ============================================================

/**
 * Strategy for handling conflicts when adding bulk slides
 */
export type DuplicateFileStrategy = 'skip' | 'replace' | 'rename';
export type GroupMismatchStrategy = 'keep' | 'update';

/**
 * Conflict resolution options for bulk operations
 */
export interface ConflictOptions {
  /** How to handle duplicate filenames */
  duplicateFile?: DuplicateFileStrategy;
  /** How to handle group mismatches */
  groupMismatch?: GroupMismatchStrategy;
}

/**
 * Position specification for inserting slides
 */
export type SlidePosition = 'start' | 'end' | { after: string };

/**
 * Request body for bulk adding slides
 */
export interface BulkAddSlidesRequest {
  /** Array of slides to add */
  slides: Array<{
    file: string;
    title?: string;
    group?: string;
    description?: string;
    recommended?: boolean;
  }>;
  /** Auto-create groups if they don't exist */
  createGroups?: boolean;
  /** Position to insert slides */
  position?: SlidePosition;
  /** Conflict resolution options */
  onConflict?: ConflictOptions;
  /** Dry run mode - return what would happen without persisting */
  dryRun?: boolean;
}

/**
 * Request body for bulk adding groups
 */
export interface BulkAddGroupsRequest {
  /** Array of groups to add */
  groups: Array<{
    id: string;
    label: string;
    order?: number;
  }>;
  /** Dry run mode - return what would happen without persisting */
  dryRun?: boolean;
}

/**
 * Strategy for syncing manifest with filesystem
 */
export type SyncStrategy = 'merge' | 'replace' | 'addOnly';

/**
 * Request body for syncing manifest with filesystem
 */
export interface SyncManifestRequest {
  /** Sync strategy */
  strategy?: SyncStrategy;
  /** Auto-detect groups from filename prefixes */
  inferGroups?: boolean;
  /** Extract titles from HTML title tags */
  inferTitles?: boolean;
}

/**
 * Request body for validating manifest
 */
export interface ValidateManifestRequest {
  /** Manifest to validate */
  manifest: FlideckManifest;
  /** Check if all referenced files exist on disk */
  checkFiles?: boolean;
}

/**
 * Validation error details
 */
export interface ManifestValidationError {
  /** Path to the field with error (e.g., 'slides[2].file') */
  path: string;
  /** Error message */
  message: string;
}

/**
 * Validation warning details
 */
export interface ManifestValidationWarning {
  /** Path to the field with warning */
  path: string;
  /** Warning message */
  message: string;
}

/**
 * Response from manifest validation
 */
export interface ValidateManifestResponse {
  /** Whether manifest is valid */
  valid: boolean;
  /** Validation errors */
  errors?: ManifestValidationError[];
  /** Validation warnings */
  warnings?: ManifestValidationWarning[];
}

/**
 * Manifest template definition
 */
export interface ManifestTemplate {
  /** Template ID */
  id: string;
  /** Display name */
  name: string;
  /** Description of template use case */
  description: string;
  /** Template structure */
  structure: Partial<FlideckManifest>;
}

/**
 * Request body for applying a template
 */
export interface ApplyTemplateRequest {
  /** Template ID to apply */
  templateId: string;
  /** Merge with existing manifest or replace */
  merge?: boolean;
}

/**
 * Result from a bulk operation
 */
export interface BulkOperationResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Number of items added */
  added?: number;
  /** Number of items skipped */
  skipped?: number;
  /** Number of items updated */
  updated?: number;
  /** Items that were skipped with reasons */
  skippedItems?: Array<{
    item: string;
    reason: string;
  }>;
  /** Error message if failed */
  error?: string;
}

// ============================================================
// FR-26: Sync From Index HTML Types
// ============================================================

/**
 * Request body for syncing manifest from index HTML files
 */
export interface SyncFromIndexRequest {
  /** Strategy for updating manifest: 'merge' adds to existing, 'replace' starts fresh */
  strategy?: 'merge' | 'replace';
  /** Auto-detect tabs from index-*.html files (default: true) */
  inferTabs?: boolean;
  /** Parse card elements in index HTML to extract slides (default: true) */
  parseCards?: boolean;
}

/**
 * Result from a parsed index HTML file
 */
export interface ParsedIndexResult {
  /** Tab ID derived from filename */
  tabId: string;
  /** Display label for the tab */
  label: string;
  /** Index file path */
  file: string;
  /** Cards/slides found in this index */
  cards: ParsedCard[];
}

/**
 * A card element parsed from index HTML
 */
export interface ParsedCard {
  /** Slide filename reference */
  file: string;
  /** Title extracted from card content */
  title?: string;
  /** Order within the index (0-based DOM position) */
  order: number;
}

/**
 * Response from sync-from-index operation
 */
export interface SyncFromIndexResponse {
  /** Whether operation succeeded */
  success: boolean;
  /** Detected presentation format */
  format: 'flat' | 'tabbed';
  /** Tabs created or updated */
  tabs: {
    created: string[];
    updated: string[];
  };
  /** Groups created or updated */
  groups: {
    created: string[];
    updated: string[];
  };
  /** Slide assignment summary */
  slides: {
    /** Slides successfully assigned to groups */
    assigned: number;
    /** Cards with undetectable slide references */
    skipped: number;
    /** Slides not found in any index file */
    orphaned: number;
  };
  /** Warning messages for issues encountered */
  warnings: string[];
}
