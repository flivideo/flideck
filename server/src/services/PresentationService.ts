import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import type {
  Presentation,
  Asset,
  FlideckManifest,
  ManifestSlide,
  ManifestTemplate,
  SyncFromIndexResponse,
} from '@flideck/shared';
import { AppError } from '../middleware/errorHandler.js';
import { ManifestService } from './ManifestService.js';

const MANIFEST_FILENAME = 'index.json';

// Entry point patterns in priority order
const ENTRY_POINT_PATTERNS = {
  // Single entry points (priority 1-2)
  PRESENTATION_HTML: 'presentation.html',
  INDEX_HTML: 'index.html',
  // Tabbed patterns (priority 3-4) - use regex
  PRESENTATION_TAB_REGEX: /^presentation-tab-[\w-]+\.html$/,
  INDEX_TAB_REGEX: /^index-[\w-]+\.html$/,
};

/**
 * Entry point discovery result.
 */
interface EntryPointResult {
  /** The entry point file (null if tabbed with no main entry) */
  entryFile: string | null;
  /** Whether this is a tabbed presentation */
  isTabbed: boolean;
  /** Tab files if tabbed (sorted) */
  tabFiles: string[];
}

/**
 * Service for discovering and managing presentations.
 * Uses EventEmitter pattern for notifying consumers of changes.
 */
export class PresentationService extends EventEmitter {
  private static instance: PresentationService;
  private cache = new Map<string, Presentation>();
  private presentationsRoot: string = '';
  private clientUrl: string = 'http://localhost:5200';
  private manifestService!: ManifestService;
  private writeLocks = new Map<string, Promise<void>>();

  private async withWriteLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const current = this.writeLocks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.writeLocks.set(id, next);
    try {
      await current;
      return await fn();
    } finally {
      release();
      if (this.writeLocks.get(id) === next) {
        this.writeLocks.delete(id);
      }
    }
  }

  private constructor() {
    super();
    this.initManifestService();
  }

  private initManifestService(): void {
    this.manifestService = new ManifestService(
      (id) => path.join(this.presentationsRoot, id),
      (folderPath) => this.assertSafeId(folderPath),
      (name) => this.formatName(name),
      (id) => this.invalidateCache(id)
    );
  }

  /**
   * Get the singleton instance of PresentationService.
   */
  static getInstance(): PresentationService {
    if (!PresentationService.instance) {
      PresentationService.instance = new PresentationService();
    }
    return PresentationService.instance;
  }

  /**
   * Set the root directory for presentations.
   */
  setRoot(root: string): void {
    this.presentationsRoot = root;
    this.cache.clear();
  }

  /**
   * Get the current presentations root directory.
   */
  getRoot(): string {
    return this.presentationsRoot;
  }

  /**
   * Set the client URL for generating asset URLs.
   */
  setClientUrl(url: string): void {
    this.clientUrl = url;
  }

  /**
   * Assert that a user-supplied presentation ID does not escape the presentations root.
   * Throws AppError(400) on path traversal attempts.
   */
  private assertSafeId(folderPath: string): void {
    const resolvedPath = path.resolve(folderPath);
    const resolvedRoot = path.resolve(this.presentationsRoot);
    if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
      throw new AppError('Invalid presentation ID', 400);
    }
  }

  /**
   * Find the entry point for a presentation folder.
   * Checks for entry point files in priority order:
   * 1. presentation.html (preferred)
   * 2. index.html (legacy fallback)
   * 3. presentation-tab-*.html files (tabbed, new convention)
   * 4. index-*.html files (tabbed, legacy pattern)
   */
  private async findEntryPoint(folderPath: string): Promise<EntryPointResult | null> {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const htmlFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.html'))
      .map((e) => e.name);

    // Priority 1: presentation.html
    if (htmlFiles.includes(ENTRY_POINT_PATTERNS.PRESENTATION_HTML)) {
      return {
        entryFile: ENTRY_POINT_PATTERNS.PRESENTATION_HTML,
        isTabbed: false,
        tabFiles: [],
      };
    }

    // Priority 2: index.html
    if (htmlFiles.includes(ENTRY_POINT_PATTERNS.INDEX_HTML)) {
      return {
        entryFile: ENTRY_POINT_PATTERNS.INDEX_HTML,
        isTabbed: false,
        tabFiles: [],
      };
    }

    // Priority 3: presentation-tab-*.html files
    const presentationTabFiles = htmlFiles
      .filter((f) => ENTRY_POINT_PATTERNS.PRESENTATION_TAB_REGEX.test(f))
      .sort();
    if (presentationTabFiles.length > 0) {
      return {
        entryFile: null, // No main entry, use first tab
        isTabbed: true,
        tabFiles: presentationTabFiles,
      };
    }

    // Priority 4: index-*.html files (excluding index.html which we already checked)
    const indexTabFiles = htmlFiles
      .filter((f) => ENTRY_POINT_PATTERNS.INDEX_TAB_REGEX.test(f))
      .sort();
    if (indexTabFiles.length > 0) {
      return {
        entryFile: null, // No main entry, use first tab
        isTabbed: true,
        tabFiles: indexTabFiles,
      };
    }

    // No valid entry point found
    return null;
  }

  /**
   * Discover all presentations in the root directory.
   * A valid presentation has an entry point (see findEntryPoint for priority).
   */
  async discoverAll(): Promise<Presentation[]> {
    if (!this.presentationsRoot) {
      throw new Error('Presentations root not configured');
    }

    const rootExists = await fs.pathExists(this.presentationsRoot);
    if (!rootExists) {
      console.warn(`Presentations root does not exist: ${this.presentationsRoot}`);
      return [];
    }

    const entries = await fs.readdir(this.presentationsRoot, { withFileTypes: true });
    const presentations: Presentation[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderPath = path.join(this.presentationsRoot, entry.name);
      const entryPoint = await this.findEntryPoint(folderPath);

      // A valid presentation must have an entry point
      if (entryPoint) {
        const presentation = await this.loadPresentation(entry.name, folderPath, entryPoint);
        presentations.push(presentation);
        this.cache.set(entry.name, presentation);
      }
    }

    // Sort by name
    presentations.sort((a, b) => a.name.localeCompare(b.name));

    this.emit('presentations:discovered', { count: presentations.length });
    return presentations;
  }

  /**
   * Get a single presentation by ID (folder name).
   */
  async getById(id: string): Promise<Presentation | null> {
    if (!this.presentationsRoot) {
      throw new AppError('Root not configured', 400);
    }
    const folderPath = path.join(this.presentationsRoot, id);
    this.assertSafeId(folderPath);

    // Check cache after security validation
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Check if folder exists
    if (!(await fs.pathExists(folderPath))) {
      return null;
    }

    // Check for valid entry point
    const entryPoint = await this.findEntryPoint(folderPath);
    if (!entryPoint) {
      return null;
    }

    const presentation = await this.loadPresentation(id, folderPath, entryPoint);
    this.cache.set(id, presentation);
    return presentation;
  }

  /**
   * Invalidate cache for a specific presentation or all.
   */
  invalidateCache(id?: string): void {
    if (id) {
      this.cache.delete(id);
    } else {
      this.cache.clear();
    }
    this.emit('cache:invalidated', { id });
  }

  /**
   * Load a presentation from disk.
   */
  private async loadPresentation(
    id: string,
    folderPath: string,
    entryPoint?: EntryPointResult
  ): Promise<Presentation> {
    const manifest = await this.readManifest(folderPath);
    const assets = await this.discoverAssets(id, folderPath, manifest, entryPoint);
    const stat = await fs.stat(folderPath);

    // Use manifest name if available, otherwise format folder name
    const name = manifest?.meta?.name || this.formatName(id);

    return {
      id,
      name,
      path: folderPath,
      assets,
      lastModified: stat.mtimeMs,
      groups: manifest?.groups,
      meta: manifest?.meta,
      tabs: manifest?.tabs, // FR-24: Container-level tabs
    };
  }

  /**
   * Discover all HTML assets in a presentation folder.
   * Applies custom ordering from index.json manifest if present.
   * Supports both new `slides` array format and legacy `assets.order` format.
   */
  private async discoverAssets(
    presentationId: string,
    folderPath: string,
    manifest: FlideckManifest | null,
    entryPoint?: EntryPointResult
  ): Promise<Asset[]> {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const assetMap = new Map<string, Asset>();

    // Determine the entry file for this presentation
    const entryFile = this.determineEntryFile(entryPoint, manifest);

    // Build map of all HTML assets from filesystem
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

      const filePath = path.join(folderPath, entry.name);
      const stat = await fs.stat(filePath);
      const isIndex = entry.name === entryFile;
      // Use birthtime (creation time) if available, fall back to mtime
      const createdAt = stat.birthtimeMs || stat.mtimeMs;

      assetMap.set(entry.name, {
        id: path.basename(entry.name, '.html'),
        name: isIndex ? 'Index' : this.formatName(path.basename(entry.name, '.html')),
        filename: entry.name,
        relativePath: entry.name,
        isIndex,
        createdAt,
        lastModified: stat.mtimeMs,
        url: `${this.clientUrl}/presentations/${presentationId}/${entry.name}`,
      });
    }

    // New format: slides array with metadata
    if (manifest?.slides && Array.isArray(manifest.slides)) {
      return this.applySlideMetadata(assetMap, manifest.slides, entryFile);
    }

    // Legacy format: assets.order array
    if (manifest?.assets?.order && Array.isArray(manifest.assets.order)) {
      return this.applyCustomOrder(assetMap, manifest.assets.order);
    }

    // Default ordering: entry file first, then by creation time (oldest first)
    const assets = Array.from(assetMap.values());
    assets.sort((a, b) => {
      if (a.isIndex) return -1;
      if (b.isIndex) return 1;
      return a.createdAt - b.createdAt;
    });

    return assets;
  }

  /**
   * Determine the entry file for a presentation.
   * For tabbed presentations, uses manifest tab order or alphabetical fallback.
   */
  private determineEntryFile(
    entryPoint?: EntryPointResult,
    manifest?: FlideckManifest | null
  ): string {
    // If we have a direct entry file, use it
    if (entryPoint?.entryFile) {
      return entryPoint.entryFile;
    }

    // For tabbed presentations, determine default tab
    if (entryPoint?.isTabbed && entryPoint.tabFiles.length > 0) {
      // Try to use manifest tab order
      if (manifest?.tabs && manifest.tabs.length > 0) {
        // Sort tabs by order field
        const sortedTabs = [...manifest.tabs].sort((a, b) => (a.order || 999) - (b.order || 999));
        const firstTab = sortedTabs[0];

        // Find matching tab file (index-{id}.html or presentation-tab-{id}.html)
        const indexTabFile = `index-${firstTab.id}.html`;
        const presentationTabFile = `presentation-tab-${firstTab.id}.html`;

        if (entryPoint.tabFiles.includes(presentationTabFile)) {
          return presentationTabFile;
        }
        if (entryPoint.tabFiles.includes(indexTabFile)) {
          return indexTabFile;
        }
      }

      // Fallback to alphabetically first tab file
      return entryPoint.tabFiles[0];
    }

    // Ultimate fallback: index.html
    return 'index.html';
  }

  /**
   * Apply slide metadata from manifest to assets.
   * - Preserves order from slides array
   * - Applies title, group, description, recommended from manifest
   * - Self-healing: skips missing files, appends new files
   */
  private applySlideMetadata(
    assetMap: Map<string, Asset>,
    slides: ManifestSlide[],
    _entryFile?: string
  ): Asset[] {
    const orderedAssets: Asset[] = [];
    const includedFilenames = new Set<string>();

    // Process slides in manifest order
    for (const slide of slides) {
      const asset = assetMap.get(slide.file);
      if (asset) {
        // Apply metadata from manifest
        if (slide.title) {
          asset.name = slide.title;
          asset.title = slide.title;
        }
        if (slide.group) {
          asset.group = slide.group;
        }
        if (slide.description) {
          asset.description = slide.description;
        }
        if (slide.recommended !== undefined) {
          asset.recommended = slide.recommended;
        }
        if (slide.viewportLock) {
          asset.viewportLock = slide.viewportLock;
        }

        orderedAssets.push(asset);
        includedFilenames.add(slide.file);
      }
    }

    // Append remaining assets not in manifest (by creation time)
    const remaining = Array.from(assetMap.values())
      .filter((asset) => !includedFilenames.has(asset.filename))
      .sort((a, b) => a.createdAt - b.createdAt);

    return [...orderedAssets, ...remaining];
  }

  /**
   * Apply custom ordering to assets with self-healing behavior.
   * - Files in manifest order come first (if they exist)
   * - Missing files are silently skipped
   * - New files not in manifest are appended alphabetically
   */
  private applyCustomOrder(assetMap: Map<string, Asset>, order: string[]): Asset[] {
    const orderedAssets: Asset[] = [];
    const includedFilenames = new Set<string>();

    // Add assets in manifest order (skip missing files)
    for (const filename of order) {
      const asset = assetMap.get(filename);
      if (asset) {
        orderedAssets.push(asset);
        includedFilenames.add(filename);
      }
    }

    // Append remaining assets not in manifest (alphabetically)
    const remaining = Array.from(assetMap.values())
      .filter((asset) => !includedFilenames.has(asset.filename))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...orderedAssets, ...remaining];
  }

  /**
   * Read and parse the manifest file. Delegates to ManifestService.
   */
  private async readManifest(folderPath: string): Promise<FlideckManifest | null> {
    return this.manifestService.readManifest(folderPath);
  }

  /**
   * Save asset order to the index.json manifest file.
   * Handles both new slides format and legacy assets.order format.
   */
  async saveAssetOrder(presentationId: string, order: string[]): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest or create new one
      let manifest = await this.readManifest(folderPath);
      if (!manifest) {
        manifest = {};
      }

      // If using new slides format, update slides order
      if (manifest.slides && Array.isArray(manifest.slides)) {
        manifest.slides = this.reorderSlides(manifest.slides, order);
      } else {
        // Legacy format: update assets.order
        if (!manifest.assets) {
          manifest.assets = {};
        }
        manifest.assets.order = order;
      }

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache for this presentation
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Save asset order with group assignments to the index.json manifest file.
   * Used when drag-drop changes group assignments.
   */
  async saveAssetOrderWithGroups(
    presentationId: string,
    orderedSlides: Array<{ file: string; group?: string }>
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest or create new one
      let manifest = await this.readManifest(folderPath);
      if (!manifest) {
        manifest = {};
      }

      // If using new slides format, update slides order and groups
      if (manifest.slides && Array.isArray(manifest.slides)) {
        const slideMap = new Map(manifest.slides.map((s) => [s.file, s]));

        manifest.slides = orderedSlides.map(({ file, group }) => {
          const existing = slideMap.get(file);
          if (existing) {
            // Update group if changed
            if (group !== undefined) {
              existing.group = group || undefined; // Remove group if empty string
            }
            return existing;
          }
          // New file not in manifest
          return { file, group: group || undefined };
        });
      } else {
        // Convert to new slides format
        manifest.slides = orderedSlides.map(({ file, group }) => ({
          file,
          group: group || undefined,
        }));
        // Remove legacy assets.order since we're using slides now
        delete manifest.assets;
      }

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache for this presentation
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Reorder slides array while preserving all metadata.
   */
  private reorderSlides(slides: ManifestSlide[], order: string[]): ManifestSlide[] {
    const slideMap = new Map(slides.map((s) => [s.file, s]));
    const reordered: ManifestSlide[] = [];
    const included = new Set<string>();

    // Add slides in new order
    for (const file of order) {
      const slide = slideMap.get(file);
      if (slide) {
        reordered.push(slide);
        included.add(file);
      } else {
        // New file not in manifest
        reordered.push({ file });
        included.add(file);
      }
    }

    // Append any slides from manifest that weren't in order (shouldn't happen, but self-heal)
    for (const slide of slides) {
      if (!included.has(slide.file)) {
        reordered.push(slide);
      }
    }

    return reordered;
  }

  /**
   * Format a kebab-case or snake_case string as a title.
   */
  private formatName(name: string): string {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ============================================================
  // FR-16: Agent Slide Management API Methods
  // ============================================================

  /**
   * Create a new presentation folder and manifest.
   * Does NOT create any HTML files (agent's responsibility).
   *
   * @param id - Presentation ID (becomes folder name)
   * @param name - Optional display name
   * @param slides - Optional initial slides
   * @returns Path to the created presentation folder
   * @throws Error if presentation already exists
   */
  async createPresentation(
    id: string,
    name?: string,
    slides?: Array<{ file: string; title?: string; group?: string }>
  ): Promise<string> {
    const folderPath = path.join(this.presentationsRoot, id);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    await this.withWriteLock(id, async () => {
      // Check if folder already exists
      if (await fs.pathExists(folderPath)) {
        throw new Error(`Presentation already exists: ${id}`);
      }

      // Create folder
      await fs.ensureDir(folderPath);

      // Build manifest
      const manifest: FlideckManifest = {
        meta: {
          name: name || this.formatName(id),
          created: new Date().toISOString().split('T')[0],
          updated: new Date().toISOString().split('T')[0],
        },
        slides:
          slides?.map((s) => ({
            file: s.file,
            title: s.title,
            group: s.group,
          })) || [],
      };

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache();
    });

    return folderPath;
  }

  /**
   * Add a slide to a presentation's manifest.
   * Does NOT create the HTML file (agent's responsibility).
   *
   * @param presentationId - Presentation ID
   * @param slide - Slide metadata
   * @throws Error if presentation not found or slide already exists
   */
  async addSlide(
    presentationId: string,
    slide: {
      file: string;
      title?: string;
      group?: string;
      description?: string;
      recommended?: boolean;
    }
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest or create new one
      let manifest = await this.readManifest(folderPath);
      if (!manifest) {
        manifest = { slides: [] };
      }

      // Ensure slides array exists
      if (!manifest.slides) {
        // Convert legacy format if present
        if (manifest.assets?.order) {
          manifest.slides = manifest.assets.order.map((file) => ({ file }));
          delete manifest.assets;
        } else {
          manifest.slides = [];
        }
      }

      // Check if slide already exists
      const existingIndex = manifest.slides.findIndex((s) => s.file === slide.file);
      if (existingIndex !== -1) {
        throw new Error(`Slide already exists: ${slide.file}`);
      }

      // Build slide entry
      const newSlide: ManifestSlide = {
        file: slide.file,
      };
      if (slide.title) newSlide.title = slide.title;
      if (slide.group) newSlide.group = slide.group;
      if (slide.description) newSlide.description = slide.description;
      if (slide.recommended !== undefined) newSlide.recommended = slide.recommended;

      // Append slide
      manifest.slides.push(newSlide);

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Update metadata for an existing slide in the manifest.
   *
   * @param presentationId - Presentation ID
   * @param slideId - Slide ID (filename without extension)
   * @param updates - Fields to update
   * @throws Error if presentation or slide not found
   */
  async updateSlide(
    presentationId: string,
    slideId: string,
    updates: {
      title?: string;
      group?: string;
      description?: string;
      recommended?: boolean;
    }
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Ensure slides array exists
      if (!manifest.slides) {
        throw new Error(`Slide not found: ${slideId}`);
      }

      // Find slide by ID (filename without extension)
      const filename = slideId.endsWith('.html') ? slideId : `${slideId}.html`;
      const slideIndex = manifest.slides.findIndex((s) => s.file === filename);
      if (slideIndex === -1) {
        throw new Error(`Slide not found: ${slideId}`);
      }

      // Update slide fields
      const slide = manifest.slides[slideIndex];
      if (updates.title !== undefined) {
        slide.title = updates.title || undefined; // Remove if empty string
      }
      if (updates.group !== undefined) {
        slide.group = updates.group || undefined; // Remove if empty string
      }
      if (updates.description !== undefined) {
        slide.description = updates.description || undefined;
      }
      if (updates.recommended !== undefined) {
        slide.recommended = updates.recommended;
      }

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Remove a slide from the manifest.
   * Does NOT delete the HTML file.
   *
   * @param presentationId - Presentation ID
   * @param slideId - Slide ID (filename without extension)
   * @throws Error if presentation or slide not found
   */
  async removeSlide(presentationId: string, slideId: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Ensure slides array exists
      if (!manifest.slides) {
        throw new Error(`Slide not found: ${slideId}`);
      }

      // Find slide by ID (filename without extension)
      const filename = slideId.endsWith('.html') ? slideId : `${slideId}.html`;
      const slideIndex = manifest.slides.findIndex((s) => s.file === filename);
      if (slideIndex === -1) {
        throw new Error(`Slide not found: ${slideId}`);
      }

      // Remove slide
      manifest.slides.splice(slideIndex, 1);

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  // ============================================================
  // FR-17: Group Management Methods
  // ============================================================

  /**
   * Reorder groups in the manifest.
   *
   * @param presentationId - Presentation ID
   * @param order - Array of group IDs in desired order
   * @throws Error if presentation not found
   */
  async reorderGroups(presentationId: string, order: string[]): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Ensure groups object exists
      if (!manifest.groups) {
        manifest.groups = {};
      }

      // Update order values based on position in array
      for (let i = 0; i < order.length; i++) {
        const groupId = order[i];
        if (manifest.groups[groupId]) {
          manifest.groups[groupId].order = i + 1;
        }
      }

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Create a new group in the manifest.
   *
   * @param presentationId - Presentation ID
   * @param id - Group ID (unique identifier)
   * @param label - Display label for the group
   * @throws Error if presentation not found or group already exists
   */
  async createGroup(presentationId: string, id: string, label: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest or create new one
      let manifest = await this.readManifest(folderPath);
      if (!manifest) {
        manifest = { groups: {}, slides: [] };
      }

      // Ensure groups object exists
      if (!manifest.groups) {
        manifest.groups = {};
      }

      // Check if group already exists
      if (manifest.groups[id]) {
        throw new Error(`Group already exists: ${id}`);
      }

      // Find next order value
      const existingOrders = Object.values(manifest.groups).map((g) => g.order);
      const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;

      // Add group
      manifest.groups[id] = { label, order: nextOrder };

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Update a group's label in the manifest.
   *
   * @param presentationId - Presentation ID
   * @param groupId - Group ID
   * @param label - New display label
   * @throws Error if presentation or group not found
   */
  async updateGroup(presentationId: string, groupId: string, label: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Verify group exists
      if (!manifest.groups || !manifest.groups[groupId]) {
        throw new Error(`Group not found: ${groupId}`);
      }

      // Update label
      manifest.groups[groupId].label = label;

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Delete a group from the manifest.
   * Slides in the group move to root level (group property removed).
   *
   * @param presentationId - Presentation ID
   * @param groupId - Group ID to delete
   * @throws Error if presentation or group not found
   */
  async deleteGroup(presentationId: string, groupId: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Verify group exists
      if (!manifest.groups || !manifest.groups[groupId]) {
        throw new Error(`Group not found: ${groupId}`);
      }

      // Remove group
      delete manifest.groups[groupId];

      // Move slides from deleted group to root level
      if (manifest.slides) {
        for (const slide of manifest.slides) {
          if (slide.group === groupId) {
            delete slide.group;
          }
        }
      }

      // Renumber remaining groups to fill gaps
      const sortedGroups = Object.entries(manifest.groups).sort(([, a], [, b]) => a.order - b.order);
      for (let i = 0; i < sortedGroups.length; i++) {
        const [id] = sortedGroups[i];
        manifest.groups[id].order = i + 1;
      }

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  // ============================================================
  // FR-22: Tab Management API Methods
  // ============================================================

  /**
   * Create a new tab (group with tab: true).
   * Tabs are convenience wrappers around groups with tab: true.
   */
  async createTab(presentationId: string, id: string, label: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest or create new one
      let manifest = await this.readManifest(folderPath);
      if (!manifest) {
        manifest = { groups: {}, slides: [] };
      }

      // Ensure groups object exists
      if (!manifest.groups) {
        manifest.groups = {};
      }

      // Check if tab/group already exists
      if (manifest.groups[id]) {
        throw new Error(`Tab already exists: ${id}`);
      }

      // Find next order value
      const existingOrders = Object.values(manifest.groups).map((g) => g.order);
      const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;

      // Add tab (group with tab: true)
      manifest.groups[id] = { label, order: nextOrder, tab: true };

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Delete a tab and handle child groups based on strategy.
   *
   * @param strategy - 'orphan' (default) makes children parentless,
   *                   'cascade' deletes children too,
   *                   'reparent:<tabId>' moves children to another tab
   */
  async deleteTab(
    presentationId: string,
    tabId: string,
    strategy: string = 'orphan'
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Verify tab exists and is actually a tab
      if (!manifest.groups || !manifest.groups[tabId]) {
        throw new Error(`Tab not found: ${tabId}`);
      }

      if (!manifest.groups[tabId].tab) {
        throw new Error(`Group is not a tab: ${tabId}`);
      }

      // Handle child groups based on strategy
      if (manifest.groups) {
        const childGroups = Object.entries(manifest.groups).filter(
          ([, group]) => group.parent === tabId
        );

        if (strategy === 'cascade') {
          // Delete all child groups
          for (const [childId] of childGroups) {
            delete manifest.groups[childId];

            // Remove group assignment from slides
            if (manifest.slides) {
              for (const slide of manifest.slides) {
                if (slide.group === childId) {
                  delete slide.group;
                }
              }
            }
          }
        } else if (strategy.startsWith('reparent:')) {
          // Move children to another tab
          const newParentId = strategy.split(':')[1];

          // Verify new parent exists and is a tab
          if (!manifest.groups[newParentId]) {
            throw new Error(`New parent tab not found: ${newParentId}`);
          }
          if (!manifest.groups[newParentId].tab) {
            throw new Error(`New parent is not a tab: ${newParentId}`);
          }

          // Reparent all children
          for (const [childId] of childGroups) {
            manifest.groups[childId].parent = newParentId;
          }
        } else {
          // Default: orphan - make children parentless
          for (const [childId] of childGroups) {
            delete manifest.groups[childId].parent;
          }
        }
      }

      // Remove the tab
      delete manifest.groups[tabId];

      // Remove tab assignment from any slides
      if (manifest.slides) {
        for (const slide of manifest.slides) {
          if (slide.group === tabId) {
            delete slide.group;
          }
        }
      }

      // Renumber remaining groups to fill gaps
      const sortedGroups = Object.entries(manifest.groups).sort(([, a], [, b]) => a.order - b.order);
      for (let i = 0; i < sortedGroups.length; i++) {
        const [id] = sortedGroups[i];
        manifest.groups[id].order = i + 1;
      }

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Update a tab's label.
   */
  async updateTab(presentationId: string, tabId: string, label: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Verify tab exists and is actually a tab
      if (!manifest.groups || !manifest.groups[tabId]) {
        throw new Error(`Tab not found: ${tabId}`);
      }

      if (!manifest.groups[tabId].tab) {
        throw new Error(`Group is not a tab: ${tabId}`);
      }

      // Update label
      manifest.groups[tabId].label = label;

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Reorder tabs only (groups where tab: true).
   * This is a filtered convenience over reorderGroups.
   */
  async reorderTabs(presentationId: string, order: string[]): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Ensure groups object exists
      if (!manifest.groups) {
        manifest.groups = {};
      }

      // Verify all IDs in order are tabs
      for (const tabId of order) {
        if (!manifest.groups[tabId]) {
          throw new Error(`Tab not found: ${tabId}`);
        }
        if (!manifest.groups[tabId].tab) {
          throw new Error(`Group is not a tab: ${tabId}`);
        }
      }

      // Get non-tab groups to preserve their order
      const nonTabGroups = Object.entries(manifest.groups)
        .filter(([, group]) => !group.tab)
        .sort(([, a], [, b]) => a.order - b.order);

      // Renumber tabs based on new order
      let orderIndex = 1;
      for (const tabId of order) {
        manifest.groups[tabId].order = orderIndex++;
      }

      // Renumber non-tab groups after tabs
      for (const [groupId] of nonTabGroups) {
        manifest.groups[groupId].order = orderIndex++;
      }

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Set a group's parent tab (move group under tab).
   */
  async setGroupParent(
    presentationId: string,
    groupId: string,
    parentTabId: string
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Verify group exists
      if (!manifest.groups || !manifest.groups[groupId]) {
        throw new Error(`Group not found: ${groupId}`);
      }

      // Verify parent exists and is a tab
      if (!manifest.groups[parentTabId]) {
        throw new Error(`Parent tab not found: ${parentTabId}`);
      }

      if (!manifest.groups[parentTabId].tab) {
        throw new Error(`Parent is not a tab: ${parentTabId}`);
      }

      // Set parent
      manifest.groups[groupId].parent = parentTabId;

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Remove a group's parent tab (make group parentless).
   */
  async removeGroupParent(presentationId: string, groupId: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    this.assertSafeId(folderPath);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const manifest = await this.readManifest(folderPath);
      if (!manifest) {
        throw new Error(`No manifest found for: ${presentationId}`);
      }

      // Verify group exists
      if (!manifest.groups || !manifest.groups[groupId]) {
        throw new Error(`Group not found: ${groupId}`);
      }

      // Remove parent
      delete manifest.groups[groupId].parent;

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  // ============================================================
  // FR-19: Manifest Schema & Data API Methods (delegated to ManifestService)
  // ============================================================

  /** Get the raw manifest for a presentation. Delegates to ManifestService. */
  async getManifest(presentationId: string): Promise<FlideckManifest | null> {
    return this.manifestService.getManifest(presentationId);
  }

  /** Replace the entire manifest for a presentation. Delegates to ManifestService. */
  async setManifest(presentationId: string, manifest: FlideckManifest): Promise<void> {
    return this.manifestService.setManifest(presentationId, manifest);
  }

  /** Partially update the manifest with deep merge semantics. Delegates to ManifestService. */
  async patchManifest(presentationId: string, updates: Partial<FlideckManifest>): Promise<void> {
    return this.manifestService.patchManifest(presentationId, updates);
  }

  // ============================================================
  // FR-21: Agent Manifest Tooling Methods (delegated to ManifestService)
  // ============================================================

  /** Bulk add slides to a presentation's manifest. Delegates to ManifestService. */
  async bulkAddSlides(
    presentationId: string,
    slides: Array<{
      file: string;
      title?: string;
      group?: string;
      description?: string;
      recommended?: boolean;
    }>,
    options: {
      createGroups?: boolean;
      position?: 'start' | 'end' | { after: string };
      onConflict?: {
        duplicateFile?: 'skip' | 'replace' | 'rename';
        groupMismatch?: 'keep' | 'update';
      };
    } = {}
  ): Promise<{
    added: number;
    skipped: number;
    updated: number;
    skippedItems: Array<{ item: string; reason: string }>;
  }> {
    return this.manifestService.bulkAddSlides(presentationId, slides, options);
  }

  /** Bulk add groups to a presentation's manifest. Delegates to ManifestService. */
  async bulkAddGroups(
    presentationId: string,
    groups: Array<{
      id: string;
      label: string;
      order?: number;
    }>
  ): Promise<{
    added: number;
    skipped: number;
    skippedItems: Array<{ item: string; reason: string }>;
  }> {
    return this.manifestService.bulkAddGroups(presentationId, groups);
  }

  /** Sync manifest with filesystem. Delegates to ManifestService. */
  async syncManifest(
    presentationId: string,
    options: {
      strategy?: 'merge' | 'replace' | 'addOnly';
      inferGroups?: boolean;
      inferTitles?: boolean;
    } = {}
  ): Promise<void> {
    return this.manifestService.syncManifest(presentationId, options);
  }

  /** Validate a manifest with optional file existence checking. Delegates to ManifestService. */
  async validateManifest(
    presentationId: string,
    manifest: FlideckManifest,
    checkFiles: boolean = false
  ): Promise<{
    valid: boolean;
    errors: Array<{ path: string; message: string }>;
    warnings: Array<{ path: string; message: string }>;
  }> {
    return this.manifestService.validateManifest(presentationId, manifest, checkFiles);
  }

  /** Apply a template to a presentation's manifest. Delegates to ManifestService. */
  async applyTemplate(
    presentationId: string,
    template: ManifestTemplate,
    merge: boolean = true
  ): Promise<void> {
    return this.manifestService.applyTemplate(presentationId, template, merge);
  }

  // ============================================================
  // FR-26: Sync From Index HTML Methods (delegated to ManifestService)
  // ============================================================

  /** Sync manifest from index HTML files. Delegates to ManifestService. */
  async syncFromIndex(
    presentationId: string,
    options: {
      strategy?: 'merge' | 'replace';
      inferTabs?: boolean;
      parseCards?: boolean;
    } = {}
  ): Promise<SyncFromIndexResponse> {
    return this.manifestService.syncFromIndex(presentationId, options);
  }

  /**
   * Clears all pending write locks. For use in tests only.
   * Prevents stale lock state from leaking between test cases.
   */
  _resetWriteLocks(): void {
    this.writeLocks.clear();
  }
}
