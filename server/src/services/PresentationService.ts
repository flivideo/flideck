import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import * as cheerio from 'cheerio';
import type {
  Presentation,
  Asset,
  FlideckManifest,
  ManifestSlide,
  ManifestTemplate,
  ParsedCard,
  ParsedIndexResult,
  SyncFromIndexResponse,
  TabDefinition,
} from '@flideck/shared';
import type { AnyNode } from 'domhandler';
import type { Cheerio, CheerioAPI } from 'cheerio';
import { applyTemplate as applyManifestTemplate } from '../utils/manifestTemplates.js';

const MANIFEST_FILENAME = 'index.json';
const LEGACY_MANIFEST_FILENAME = 'flideck.json';

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

  private constructor() {
    super();
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
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    const folderPath = path.join(this.presentationsRoot, id);

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
   * Read and parse the manifest file (index.json or legacy flideck.json).
   * Tries index.json first, falls back to flideck.json for backwards compatibility.
   * Returns null if no manifest exists or is invalid.
   */
  private async readManifest(folderPath: string): Promise<FlideckManifest | null> {
    // Try index.json first (preferred)
    const manifest = await this.tryReadManifestFile(path.join(folderPath, MANIFEST_FILENAME));
    if (manifest) return manifest;

    // Fall back to legacy flideck.json
    return this.tryReadManifestFile(path.join(folderPath, LEGACY_MANIFEST_FILENAME));
  }

  /**
   * Attempt to read and parse a manifest file at the given path.
   * Returns null if file doesn't exist or is invalid.
   */
  private async tryReadManifestFile(manifestPath: string): Promise<FlideckManifest | null> {
    try {
      if (!(await fs.pathExists(manifestPath))) {
        return null;
      }

      const content = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(content) as FlideckManifest;
    } catch (error) {
      // Invalid JSON or read error - fall back to default order
      console.warn(`Failed to read manifest at ${manifestPath}:`, error);
      return null;
    }
  }

  /**
   * Save asset order to the index.json manifest file.
   * Handles both new slides format and legacy assets.order format.
   */
  async saveAssetOrder(presentationId: string, order: string[]): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

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
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
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
      slides: slides?.map((s) => ({
        file: s.file,
        title: s.title,
        group: s.group,
      })) || [],
    };

    // Write manifest
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache();

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const sortedGroups = Object.entries(manifest.groups)
      .sort(([, a], [, b]) => a.order - b.order);
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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
      const childGroups = Object.entries(manifest.groups)
        .filter(([, group]) => group.parent === tabId);

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
    const sortedGroups = Object.entries(manifest.groups)
      .sort(([, a], [, b]) => a.order - b.order);
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
  }

  /**
   * Update a tab's label.
   */
  async updateTab(presentationId: string, tabId: string, label: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
  }

  /**
   * Reorder tabs only (groups where tab: true).
   * This is a filtered convenience over reorderGroups.
   */
  async reorderTabs(presentationId: string, order: string[]): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
  }

  /**
   * Remove a group's parent tab (make group parentless).
   */
  async removeGroupParent(presentationId: string, groupId: string): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

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
  }

  // ============================================================
  // FR-19: Manifest Schema & Data API Methods
  // ============================================================

  /**
   * Get the raw manifest for a presentation.
   * Returns null if no manifest exists.
   *
   * @param presentationId - Presentation ID
   * @returns The manifest object or null
   * @throws Error if presentation not found
   */
  async getManifest(presentationId: string): Promise<FlideckManifest | null> {
    const folderPath = path.join(this.presentationsRoot, presentationId);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    return this.readManifest(folderPath);
  }

  /**
   * Replace the entire manifest for a presentation.
   * Validates the manifest before writing.
   *
   * @param presentationId - Presentation ID
   * @param manifest - The new manifest object (must be valid)
   * @throws Error if presentation not found or manifest is invalid
   */
  async setManifest(presentationId: string, manifest: FlideckManifest): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Validation happens in route handler before this method is called

    // Update timestamp
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.updated = new Date().toISOString().split('T')[0];

    // Write manifest
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache(presentationId);
  }

  /**
   * Partially update the manifest for a presentation.
   * Uses deep merge semantics for objects, replacement for arrays.
   *
   * @param presentationId - Presentation ID
   * @param updates - Partial manifest updates
   * @throws Error if presentation not found
   */
  async patchManifest(
    presentationId: string,
    updates: Partial<FlideckManifest>
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Read existing manifest or create new one
    const currentManifest = await this.readManifest(folderPath);
    const baseManifest = currentManifest || {};

    // Deep merge updates
    const manifest = this.deepMerge(baseManifest, updates) as FlideckManifest;

    // Update timestamp
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.updated = new Date().toISOString().split('T')[0];

    // Write manifest
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache(presentationId);
  }

  /**
   * Deep merge helper for PATCH semantics.
   * Objects are merged recursively, arrays are replaced.
   */
  private deepMerge(target: any, source: any): any {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return source;
    }

    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (Array.isArray(sourceValue)) {
          // Arrays are replaced, not merged
          result[key] = sourceValue;
        } else if (sourceValue && typeof sourceValue === 'object') {
          // Deep merge objects
          result[key] =
            targetValue && typeof targetValue === 'object'
              ? this.deepMerge(targetValue, sourceValue)
              : sourceValue;
        } else {
          // Primitives are replaced
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  // ============================================================
  // FR-21: Agent Manifest Tooling Methods
  // ============================================================

  /**
   * Bulk add slides to a presentation's manifest.
   * Supports auto-creating groups, position control, and conflict resolution.
   *
   * @param presentationId - Presentation ID
   * @param slides - Array of slides to add
   * @param options - Bulk operation options
   * @returns Operation result with counts
   */
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
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Read existing manifest or create new one
    let manifest = await this.readManifest(folderPath);
    if (!manifest) {
      manifest = { slides: [] };
    }

    // Ensure slides array exists
    if (!manifest.slides) {
      manifest.slides = [];
    }

    // Ensure groups object exists if we'll be auto-creating
    if (options.createGroups && !manifest.groups) {
      manifest.groups = {};
    }

    const result = {
      added: 0,
      skipped: 0,
      updated: 0,
      skippedItems: [] as Array<{ item: string; reason: string }>,
    };

    const slidesToAdd: ManifestSlide[] = [];

    // Process each slide
    for (const slide of slides) {
      const existingIndex = manifest.slides.findIndex((s) => s.file === slide.file);
      const conflictStrategy = options.onConflict?.duplicateFile || 'skip';

      // Handle duplicates
      if (existingIndex !== -1) {
        if (conflictStrategy === 'skip') {
          result.skipped++;
          result.skippedItems.push({
            item: slide.file,
            reason: 'File already exists in manifest',
          });
          continue;
        } else if (conflictStrategy === 'replace') {
          // Remove existing and add as new
          manifest.slides.splice(existingIndex, 1);
          result.updated++;
        } else if (conflictStrategy === 'rename') {
          // Generate unique filename
          const baseName = path.basename(slide.file, '.html');
          let counter = 1;
          let newFile = slide.file;
          while (manifest.slides.some((s) => s.file === newFile)) {
            newFile = `${baseName}-${counter}.html`;
            counter++;
          }
          slide.file = newFile;
          result.added++;
        }
      } else {
        result.added++;
      }

      // Auto-create group if needed
      if (slide.group && options.createGroups && manifest.groups) {
        if (!manifest.groups[slide.group]) {
          const existingOrders = Object.values(manifest.groups).map((g) => g.order);
          const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;
          manifest.groups[slide.group] = {
            label: this.formatName(slide.group),
            order: nextOrder,
          };
        }
      }

      // Validate group exists if specified
      if (slide.group && manifest.groups && !manifest.groups[slide.group]) {
        result.skipped++;
        result.skippedItems.push({
          item: slide.file,
          reason: `Group '${slide.group}' does not exist`,
        });
        continue;
      }

      // Build slide entry
      const newSlide: ManifestSlide = { file: slide.file };
      if (slide.title) newSlide.title = slide.title;
      if (slide.group) newSlide.group = slide.group;
      if (slide.description) newSlide.description = slide.description;
      if (slide.recommended !== undefined) newSlide.recommended = slide.recommended;

      slidesToAdd.push(newSlide);
    }

    // Apply position
    const position = options.position || 'end';
    if (position === 'start') {
      manifest.slides = [...slidesToAdd, ...manifest.slides];
    } else if (position === 'end') {
      manifest.slides = [...manifest.slides, ...slidesToAdd];
    } else if (typeof position === 'object' && 'after' in position) {
      const afterIndex = manifest.slides.findIndex((s) => s.file === position.after);
      if (afterIndex === -1) {
        throw new Error(`Slide not found for 'after' position: ${position.after}`);
      }
      manifest.slides.splice(afterIndex + 1, 0, ...slidesToAdd);
    }

    // Update timestamp
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.updated = new Date().toISOString().split('T')[0];

    // Write manifest
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache(presentationId);

    return result;
  }

  /**
   * Bulk add groups to a presentation's manifest.
   *
   * @param presentationId - Presentation ID
   * @param groups - Array of groups to add
   * @returns Operation result with counts
   */
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
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Read existing manifest or create new one
    let manifest = await this.readManifest(folderPath);
    if (!manifest) {
      manifest = { groups: {}, slides: [] };
    }

    // Ensure groups object exists
    if (!manifest.groups) {
      manifest.groups = {};
    }

    const result = {
      added: 0,
      skipped: 0,
      skippedItems: [] as Array<{ item: string; reason: string }>,
    };

    // Find next order value if not explicitly set
    const existingOrders = Object.values(manifest.groups).map((g) => g.order);
    let nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;

    // Process each group
    for (const group of groups) {
      // Check if group already exists
      if (manifest.groups[group.id]) {
        result.skipped++;
        result.skippedItems.push({
          item: group.id,
          reason: 'Group already exists',
        });
        continue;
      }

      // Add group
      manifest.groups[group.id] = {
        label: group.label,
        order: group.order !== undefined ? group.order : nextOrder++,
      };
      result.added++;
    }

    // Update timestamp
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.updated = new Date().toISOString().split('T')[0];

    // Write manifest
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache(presentationId);

    return result;
  }

  /**
   * Sync manifest with filesystem - discovers HTML files and updates manifest.
   * Supports multiple strategies: merge, replace, addOnly.
   *
   * @param presentationId - Presentation ID
   * @param options - Sync options
   */
  async syncManifest(
    presentationId: string,
    options: {
      strategy?: 'merge' | 'replace' | 'addOnly';
      inferGroups?: boolean;
      inferTitles?: boolean;
    } = {}
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Discover all HTML files in folder
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const htmlFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.html'))
      .map((e) => e.name);

    const strategy = options.strategy || 'merge';
    let manifest = await this.readManifest(folderPath);

    if (strategy === 'replace' || !manifest) {
      // Start fresh
      manifest = {
        slides: [],
        groups: {},
      };
    } else {
      // Ensure slides array exists for merge/addOnly
      if (!manifest.slides) {
        manifest.slides = [];
      }
    }

    // Build map of existing slides
    const existingSlides = new Map(manifest.slides?.map((s) => [s.file, s]) || []);

    // Process each HTML file
    const newSlides: ManifestSlide[] = [];

    for (const filename of htmlFiles) {
      const existing = existingSlides.get(filename);

      if (strategy === 'addOnly' && existing) {
        // Keep existing slide as-is
        newSlides.push(existing);
        continue;
      }

      const slide: ManifestSlide = { file: filename };

      // Infer title from HTML if requested
      if (options.inferTitles) {
        try {
          const htmlPath = path.join(folderPath, filename);
          const htmlContent = await fs.readFile(htmlPath, 'utf-8');
          const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            slide.title = titleMatch[1].trim();
          }
        } catch (error) {
          // Ignore errors reading HTML
        }
      }

      // Infer group from filename prefix (e.g., api-reference.html -> api group)
      if (options.inferGroups) {
        const parts = filename.split('-');
        if (parts.length > 1) {
          const prefix = parts[0];
          slide.group = prefix;

          // Auto-create group if it doesn't exist
          if (manifest.groups && !manifest.groups[prefix]) {
            const existingOrders = Object.values(manifest.groups).map((g) => g.order);
            const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;
            manifest.groups[prefix] = {
              label: this.formatName(prefix),
              order: nextOrder,
            };
          }
        }
      }

      // Merge with existing metadata if strategy is merge
      if (strategy === 'merge' && existing) {
        // Keep existing metadata, only update what's not set
        newSlides.push({
          ...existing,
          title: existing.title || slide.title,
          group: existing.group || slide.group,
        });
      } else {
        newSlides.push(slide);
      }
    }

    manifest.slides = newSlides;

    // Update timestamp
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.updated = new Date().toISOString().split('T')[0];

    // Write manifest
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache(presentationId);
  }

  /**
   * Validate a manifest object with optional file existence checking.
   *
   * @param presentationId - Presentation ID (for file checking)
   * @param manifest - Manifest to validate
   * @param checkFiles - Whether to verify files exist on disk
   * @returns Validation result with errors and warnings
   */
  async validateManifest(
    presentationId: string,
    manifest: FlideckManifest,
    checkFiles: boolean = false
  ): Promise<{
    valid: boolean;
    errors: Array<{ path: string; message: string }>;
    warnings: Array<{ path: string; message: string }>;
  }> {
    const errors: Array<{ path: string; message: string }> = [];
    const warnings: Array<{ path: string; message: string }> = [];

    const folderPath = path.join(this.presentationsRoot, presentationId);

    // Check if files exist if requested
    if (checkFiles && manifest.slides) {
      for (let i = 0; i < manifest.slides.length; i++) {
        const slide = manifest.slides[i];
        const filePath = path.join(folderPath, slide.file);
        const exists = await fs.pathExists(filePath);

        if (!exists) {
          errors.push({
            path: `slides[${i}].file`,
            message: `File not found: ${slide.file}`,
          });
        }
      }

      // Check for orphan files (files not in manifest)
      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const htmlFiles = entries
          .filter((e) => e.isFile() && e.name.endsWith('.html'))
          .map((e) => e.name);

        const manifestFiles = new Set(manifest.slides.map((s) => s.file));

        for (const filename of htmlFiles) {
          if (!manifestFiles.has(filename)) {
            warnings.push({
              path: 'slides',
              message: `File exists but not in manifest: ${filename}`,
            });
          }
        }
      } catch (error) {
        // Ignore errors reading directory
      }
    }

    // Validate group references
    if (manifest.slides && manifest.groups) {
      for (let i = 0; i < manifest.slides.length; i++) {
        const slide = manifest.slides[i];
        if (slide.group && !manifest.groups[slide.group]) {
          errors.push({
            path: `slides[${i}].group`,
            message: `Group '${slide.group}' does not exist`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Apply a template to a presentation's manifest.
   *
   * @param presentationId - Presentation ID
   * @param template - Template to apply
   * @param merge - If true, merge with existing; if false, replace
   */
  async applyTemplate(
    presentationId: string,
    template: ManifestTemplate,
    merge: boolean = true
  ): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Read existing manifest
    const currentManifest = await this.readManifest(folderPath);

    // Apply template
    const newManifest = applyManifestTemplate(currentManifest, template, merge);

    // Update timestamp
    if (!newManifest.meta) newManifest.meta = {};
    newManifest.meta.updated = new Date().toISOString().split('T')[0];

    // Write manifest
    await fs.writeJson(manifestPath, newManifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache(presentationId);
  }

  // ============================================================
  // FR-26: Sync From Index HTML Methods
  // ============================================================

  /**
   * Sync manifest from index HTML files.
   * Parses index-*.html files to detect tabs and card elements,
   * then populates the manifest with slide-to-tab mappings.
   *
   * @param presentationId - Presentation ID
   * @param options - Sync options
   * @returns Detailed sync result
   */
  async syncFromIndex(
    presentationId: string,
    options: {
      strategy?: 'merge' | 'replace';
      inferTabs?: boolean;
      parseCards?: boolean;
    } = {}
  ): Promise<SyncFromIndexResponse> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    const strategy = options.strategy || 'merge';
    const inferTabs = options.inferTabs !== false; // default true
    const parseCards = options.parseCards !== false; // default true

    // Initialize result
    const result: SyncFromIndexResponse = {
      success: true,
      format: 'flat',
      tabs: { created: [], updated: [] },
      groups: { created: [], updated: [] },
      slides: { assigned: 0, skipped: 0, orphaned: 0 },
      warnings: [],
    };

    // Discover all files in folder
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const allFiles = entries.filter((e) => e.isFile()).map((e) => e.name);
    const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

    // Detect presentation format
    const indexFiles = htmlFiles.filter((f) => f.match(/^index(-[\w-]+)?\.html$/));
    const tabbedIndexFiles = indexFiles.filter((f) => f.match(/^index-[\w-]+\.html$/));
    const isTabbed = inferTabs && tabbedIndexFiles.length > 0;
    result.format = isTabbed ? 'tabbed' : 'flat';

    // Read existing manifest or start fresh
    let manifest: FlideckManifest;
    if (strategy === 'replace') {
      manifest = { groups: {}, slides: [], tabs: [] };
    } else {
      manifest = (await this.readManifest(folderPath)) || { groups: {}, slides: [], tabs: [] };
      if (!manifest.groups) manifest.groups = {};
      if (!manifest.slides) manifest.slides = [];
      if (!manifest.tabs) manifest.tabs = [];
    }

    // Build map of existing slides for merge
    const existingSlideMap = new Map(manifest.slides?.map((s) => [s.file, s]) || []);

    // Track which slides are assigned to avoid duplicates
    const assignedSlides = new Set<string>();

    if (isTabbed && parseCards) {
      // Process each tabbed index file
      const parsedResults: ParsedIndexResult[] = [];

      for (const indexFile of tabbedIndexFiles) {
        const parsed = await this.parseIndexHtml(folderPath, indexFile, result.warnings);
        if (parsed) {
          parsedResults.push(parsed);
        }
      }

      // Sort by filename to get consistent order
      parsedResults.sort((a, b) => a.file.localeCompare(b.file));

      // Create/update tabs
      for (let i = 0; i < parsedResults.length; i++) {
        const parsed = parsedResults[i];
        const existingTab = manifest.tabs?.find((t) => t.id === parsed.tabId);

        if (existingTab) {
          // Update existing tab
          existingTab.label = parsed.label;
          existingTab.file = parsed.file;
          existingTab.order = i + 1;
          result.tabs.updated.push(parsed.tabId);
        } else {
          // Create new tab
          const newTab: TabDefinition = {
            id: parsed.tabId,
            label: parsed.label,
            file: parsed.file,
            order: i + 1,
          };
          if (!manifest.tabs) manifest.tabs = [];
          manifest.tabs.push(newTab);
          result.tabs.created.push(parsed.tabId);
        }

        // Create group for this tab's slides
        const groupId = `${parsed.tabId}-slides`;
        const existingGroup = manifest.groups?.[groupId];

        if (existingGroup) {
          // Update existing group
          existingGroup.tabId = parsed.tabId;
          result.groups.updated.push(groupId);
        } else {
          // Create new group
          if (!manifest.groups) manifest.groups = {};
          manifest.groups[groupId] = {
            label: parsed.label,
            order: i + 1,
            tabId: parsed.tabId,
          };
          result.groups.created.push(groupId);
        }

        // Assign slides from this index to the group
        for (const card of parsed.cards) {
          if (assignedSlides.has(card.file)) {
            // Slide already assigned to another tab (first wins)
            result.warnings.push(
              `Slide '${card.file}' found in multiple index files, assigned to first`
            );
            continue;
          }

          const existingSlide = existingSlideMap.get(card.file);
          if (existingSlide) {
            // Update existing slide
            if (strategy === 'merge') {
              // Preserve existing metadata, only update group
              existingSlide.group = groupId;
              if (card.title && !existingSlide.title) {
                existingSlide.title = card.title;
              }
            } else {
              existingSlide.group = groupId;
              if (card.title) existingSlide.title = card.title;
            }
          } else {
            // Create new slide entry
            const newSlide: ManifestSlide = {
              file: card.file,
              group: groupId,
            };
            if (card.title) newSlide.title = card.title;
            manifest.slides!.push(newSlide);
            existingSlideMap.set(card.file, newSlide);
          }

          assignedSlides.add(card.file);
          result.slides.assigned++;
        }
      }
    }

    // Count orphaned slides (HTML files not in any index)
    const nonIndexHtmlFiles = htmlFiles.filter(
      (f) => !f.match(/^index(-[\w-]+)?\.html$/)
    );
    for (const file of nonIndexHtmlFiles) {
      if (!assignedSlides.has(file)) {
        result.slides.orphaned++;

        // For merge strategy, ensure orphaned slides are in manifest
        if (strategy === 'merge' && !existingSlideMap.has(file)) {
          manifest.slides!.push({ file });
          result.warnings.push(`Slide '${file}' not found in any index file`);
        }
      }
    }

    // Update timestamp
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.updated = new Date().toISOString().split('T')[0];

    // Write manifest
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache
    this.invalidateCache(presentationId);

    return result;
  }

  /**
   * Parse an index HTML file to extract card elements and their slide references.
   *
   * @param folderPath - Path to presentation folder
   * @param indexFile - Index HTML filename (e.g., 'index-mary.html')
   * @param warnings - Array to push warnings to
   * @returns Parsed result or null if parsing fails
   */
  private async parseIndexHtml(
    folderPath: string,
    indexFile: string,
    warnings: string[]
  ): Promise<ParsedIndexResult | null> {
    const filePath = path.join(folderPath, indexFile);

    try {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(htmlContent);

      // Extract tab ID from filename (e.g., 'index-mary.html' -> 'mary')
      const tabIdMatch = indexFile.match(/^index-([\w-]+)\.html$/);
      if (!tabIdMatch) {
        warnings.push(`Could not extract tab ID from filename: ${indexFile}`);
        return null;
      }

      const tabId = tabIdMatch[1];
      const label = this.formatName(tabId);

      // Find all card elements using multiple patterns
      const cards: ParsedCard[] = [];
      const seenFiles = new Set<string>();

      // Try multiple selectors for card detection
      const cardSelectors = [
        '.card[href$=".html"]', // Link card
        'a.card[href$=".html"]', // Anchor with card class
        '.card a[href$=".html"]', // Nested link in card
        '.asset-card[href$=".html"]',
        'a.asset-card[href$=".html"]',
        '.asset-card a[href$=".html"]',
        '[data-slide]', // Data attribute
        '[data-file]', // Alternative data attribute
        'a[href$=".html"]:not([href^="index"])', // Any non-index HTML link
      ];

      const allCardElements: Cheerio<AnyNode>[] = [];

      for (const selector of cardSelectors) {
        $(selector).each((_i, el) => {
          allCardElements.push($(el));
        });
      }

      // Process found elements
      let order = 0;
      for (const $el of allCardElements) {
        const slideRef = this.extractSlideReference($, $el);

        if (!slideRef) {
          // Try to find slide reference in onclick
          const onclick = $el.attr('onclick') || '';
          const onclickMatch = onclick.match(/['"]([^'"]+\.html)['"]/);
          if (onclickMatch) {
            const file = onclickMatch[1];
            if (!seenFiles.has(file) && !file.startsWith('index')) {
              const title = this.extractCardTitle($, $el);
              cards.push({ file, title, order: order++ });
              seenFiles.add(file);
            }
          }
          continue;
        }

        // Skip if already seen or if it's an index file
        if (seenFiles.has(slideRef) || slideRef.startsWith('index')) {
          continue;
        }

        const title = this.extractCardTitle($, $el);
        cards.push({ file: slideRef, title, order: order++ });
        seenFiles.add(slideRef);
      }

      if (cards.length === 0) {
        warnings.push(`No cards found in ${indexFile}`);
      }

      return {
        tabId,
        label,
        file: indexFile,
        cards,
      };
    } catch (error) {
      warnings.push(`Failed to parse ${indexFile}: ${error}`);
      return null;
    }
  }

  /**
   * Extract slide reference from a card element.
   * Tries multiple patterns: href, data-slide, data-file.
   */
  private extractSlideReference(
    _$: CheerioAPI,
    $el: Cheerio<AnyNode>
  ): string | null {
    // Try href attribute
    let href = $el.attr('href');
    if (href && href.endsWith('.html') && !href.startsWith('index')) {
      // Remove any path components, just get filename
      return path.basename(href);
    }

    // Try nested link
    const $nestedLink = $el.find('a[href$=".html"]').first();
    if ($nestedLink.length) {
      href = $nestedLink.attr('href');
      if (href && !href.startsWith('index')) {
        return path.basename(href);
      }
    }

    // Try data-slide attribute
    const dataSlide = $el.attr('data-slide');
    if (dataSlide && dataSlide.endsWith('.html')) {
      return path.basename(dataSlide);
    }

    // Try data-file attribute
    const dataFile = $el.attr('data-file');
    if (dataFile && dataFile.endsWith('.html')) {
      return path.basename(dataFile);
    }

    return null;
  }

  /**
   * Extract title from a card element.
   * Tries: h1-h6, .title, .card-title, first text node.
   */
  private extractCardTitle(
    _$: CheerioAPI,
    $el: Cheerio<AnyNode>
  ): string | undefined {
    // Try heading elements
    const $heading = $el.find('h1, h2, h3, h4, h5, h6').first();
    if ($heading.length) {
      const text = $heading.text().trim();
      if (text) return text;
    }

    // Try title class
    const $title = $el.find('.title, .card-title').first();
    if ($title.length) {
      const text = $title.text().trim();
      if (text) return text;
    }

    // Fall back to first line of text content
    const text = $el.text().trim();
    if (text) {
      const firstLine = text.split('\n')[0].trim();
      // Limit length and clean up
      if (firstLine && firstLine.length <= 100) {
        return firstLine;
      }
    }

    return undefined;
  }
}
