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
    'join:presentation': {
        presentationId: string;
    };
    'leave:presentation': {
        presentationId: string;
    };
    'presentations:updated': {
        eventType: string;
        filePath: string;
    };
    'presentation:joined': {
        presentationId: string;
    };
    'presentation:left': {
        presentationId: string;
    };
    'config:changed': {
        presentationsRoot: string;
    };
    'content:changed': {
        presentationId: string;
        assetId: string;
        filename: string;
    };
    'structure:changed': {
        eventType: string;
        filePath: string;
        presentationId?: string;
    };
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
    /** Presentation metadata */
    meta?: ManifestMeta;
    /** Aggregate statistics */
    stats?: ManifestStats;
    /** Group definitions */
    groups?: Record<string, GroupDefinition>;
    /** Ordered slides array with metadata */
    slides?: ManifestSlide[];
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
    slides: Array<{
        file: string;
        group?: string;
    }>;
}
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
//# sourceMappingURL=types.d.ts.map