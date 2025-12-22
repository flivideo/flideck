import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import type {
  Presentation,
  Asset,
  FlideckManifest,
  ManifestSlide,
} from '@flideck/shared';

const MANIFEST_FILENAME = 'index.json';
const LEGACY_MANIFEST_FILENAME = 'flideck.json';

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
   * Discover all presentations in the root directory.
   * A valid presentation is a folder containing index.html.
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
      const indexPath = path.join(folderPath, 'index.html');

      // A valid presentation must have index.html
      if (await fs.pathExists(indexPath)) {
        const presentation = await this.loadPresentation(entry.name, folderPath);
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
    const indexPath = path.join(folderPath, 'index.html');

    if (!(await fs.pathExists(indexPath))) {
      return null;
    }

    const presentation = await this.loadPresentation(id, folderPath);
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
  private async loadPresentation(id: string, folderPath: string): Promise<Presentation> {
    const manifest = await this.readManifest(folderPath);
    const assets = await this.discoverAssets(id, folderPath, manifest);
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
    manifest: FlideckManifest | null
  ): Promise<Asset[]> {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const assetMap = new Map<string, Asset>();

    // Build map of all HTML assets from filesystem
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

      const filePath = path.join(folderPath, entry.name);
      const stat = await fs.stat(filePath);
      const isIndex = entry.name === 'index.html';
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
      return this.applySlideMetadata(assetMap, manifest.slides);
    }

    // Legacy format: assets.order array
    if (manifest?.assets?.order && Array.isArray(manifest.assets.order)) {
      return this.applyCustomOrder(assetMap, manifest.assets.order);
    }

    // Default ordering: index first, then by creation time (oldest first)
    const assets = Array.from(assetMap.values());
    assets.sort((a, b) => {
      if (a.isIndex) return -1;
      if (b.isIndex) return 1;
      return a.createdAt - b.createdAt;
    });

    return assets;
  }

  /**
   * Apply slide metadata from manifest to assets.
   * - Preserves order from slides array
   * - Applies title, group, description, recommended from manifest
   * - Self-healing: skips missing files, appends new files
   */
  private applySlideMetadata(assetMap: Map<string, Asset>, slides: ManifestSlide[]): Asset[] {
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
}
