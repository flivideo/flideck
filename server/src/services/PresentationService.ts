import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import type { Presentation, Asset, FlideckManifest } from '@flideck/shared';

const MANIFEST_FILENAME = 'flideck.json';

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
    const assets = await this.discoverAssets(id, folderPath);
    const stat = await fs.stat(folderPath);

    return {
      id,
      name: this.formatName(id),
      path: folderPath,
      assets,
      lastModified: stat.mtimeMs,
    };
  }

  /**
   * Discover all HTML assets in a presentation folder.
   * Applies custom ordering from flideck.json manifest if present.
   */
  private async discoverAssets(presentationId: string, folderPath: string): Promise<Asset[]> {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const assetMap = new Map<string, Asset>();

    // Build map of all HTML assets
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

      const filePath = path.join(folderPath, entry.name);
      const stat = await fs.stat(filePath);
      const isIndex = entry.name === 'index.html';

      assetMap.set(entry.name, {
        id: path.basename(entry.name, '.html'),
        name: isIndex ? 'Index' : this.formatName(path.basename(entry.name, '.html')),
        filename: entry.name,
        relativePath: entry.name,
        isIndex,
        lastModified: stat.mtimeMs,
        url: `${this.clientUrl}/presentations/${presentationId}/${entry.name}`,
      });
    }

    // Try to read manifest for custom ordering
    const manifest = await this.readManifest(folderPath);
    const customOrder = manifest?.assets?.order;

    if (customOrder && Array.isArray(customOrder)) {
      // Apply custom ordering with self-healing
      return this.applyCustomOrder(assetMap, customOrder);
    }

    // Default ordering: index first, then alphabetically
    const assets = Array.from(assetMap.values());
    assets.sort((a, b) => {
      if (a.isIndex) return -1;
      if (b.isIndex) return 1;
      return a.name.localeCompare(b.name);
    });

    return assets;
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
   * Read and parse the flideck.json manifest file.
   * Returns null if manifest doesn't exist or is invalid.
   */
  private async readManifest(folderPath: string): Promise<FlideckManifest | null> {
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

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
   * Save asset order to the flideck.json manifest file.
   */
  async saveAssetOrder(presentationId: string, order: string[]): Promise<void> {
    const folderPath = path.join(this.presentationsRoot, presentationId);
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

    // Read existing manifest or create new one
    let manifest = await this.readManifest(folderPath);
    if (!manifest) {
      manifest = {};
    }

    // Update asset order
    if (!manifest.assets) {
      manifest.assets = {};
    }
    manifest.assets.order = order;

    // Write manifest
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Invalidate cache for this presentation
    this.invalidateCache(presentationId);
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
