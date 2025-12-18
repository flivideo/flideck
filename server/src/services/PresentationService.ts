import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import type { Presentation, Asset } from '@flideck/shared';

/**
 * Service for discovering and managing presentations.
 * Uses EventEmitter pattern for notifying consumers of changes.
 */
export class PresentationService extends EventEmitter {
  private static instance: PresentationService;
  private cache = new Map<string, Presentation>();
  private presentationsRoot: string = '';

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
    const assets = await this.discoverAssets(folderPath);
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
   */
  private async discoverAssets(folderPath: string): Promise<Asset[]> {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const assets: Asset[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

      const filePath = path.join(folderPath, entry.name);
      const stat = await fs.stat(filePath);
      const isIndex = entry.name === 'index.html';

      assets.push({
        id: path.basename(entry.name, '.html'),
        name: isIndex ? 'Index' : this.formatName(path.basename(entry.name, '.html')),
        filename: entry.name,
        relativePath: entry.name,
        isIndex,
        lastModified: stat.mtimeMs,
      });
    }

    // Sort: index first, then alphabetically
    assets.sort((a, b) => {
      if (a.isIndex) return -1;
      if (b.isIndex) return 1;
      return a.name.localeCompare(b.name);
    });

    return assets;
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
