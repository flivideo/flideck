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
}
