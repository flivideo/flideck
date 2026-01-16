import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';

/**
 * Mockup image metadata structure
 */
export interface MockupMetadata {
  meta: {
    filename: string;
    dimension: string;
    folder: string;
    generatedDate?: string;
    generatedBy?: string;
  };
  generation?: {
    model: string;
    router?: string;
    prompt?: string;
    promptFile?: string;
    cost?: number | null;
    generationTime?: number | null;
    seed?: string | number | null;
    parameters?: Record<string, unknown>;
  };
  design?: {
    concept?: string;
    styleCategory?: string;
    formFactor?: string;
    interactionModel?: string;
    tags?: string[];
    notes?: string;
    inspirationSource?: string;
  };
  manufacturing?: {
    feasibility?: string;
    method?: string;
    estimatedCost?: number;
    notes?: string;
    analysisFile?: string;
  };
  comparison?: {
    variantOf?: string;
    compareWith?: string[];
  };
  status?: string;
}

/**
 * Mockup image with parsed metadata
 */
export interface MockupImage {
  id: string;
  path: string;
  relativePath: string;
  filename: string;
  folder: string;
  dimension: string;
  metadata: MockupMetadata | null;
  thumbnailUrl: string;
  fullUrl: string;
  hasMetadata: boolean;
}

/**
 * Service for discovering and managing VibeDeck mockup images.
 */
export class MockupsService extends EventEmitter {
  private static instance: MockupsService;
  private cache: MockupImage[] = [];
  private mockupsRoot: string = '';
  private lastScanTime: number = 0;

  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of MockupsService.
   */
  static getInstance(): MockupsService {
    if (!MockupsService.instance) {
      MockupsService.instance = new MockupsService();
    }
    return MockupsService.instance;
  }

  /**
   * Set the root directory for mockups.
   */
  setRoot(root: string): void {
    this.mockupsRoot = root;
    this.cache = [];
    this.lastScanTime = 0;
  }

  /**
   * Get the current mockups root directory.
   */
  getRoot(): string {
    return this.mockupsRoot;
  }

  /**
   * Recursively find all image files in directory.
   */
  private async findImages(dir: string, results: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip manufacturing-analysis folder
          if (entry.name === 'manufacturing-analysis') continue;
          // Skip hidden folders
          if (entry.name.startsWith('.')) continue;

          await this.findImages(fullPath, results);
        } else if (entry.isFile()) {
          // Match image files
          if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
            results.push(fullPath);
          }
        }
      }
    } catch (err) {
      console.error(`Error scanning directory ${dir}:`, err);
    }

    return results;
  }

  /**
   * Load metadata for an image.
   */
  private async loadMetadata(imagePath: string): Promise<MockupMetadata | null> {
    const ext = path.extname(imagePath);
    const jsonPath = imagePath.replace(new RegExp(`${ext}$`, 'i'), '.json');

    try {
      if (await fs.pathExists(jsonPath)) {
        const content = await fs.readFile(jsonPath, 'utf8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.error(`Error loading metadata for ${imagePath}:`, err);
    }

    return null;
  }

  /**
   * Generate unique ID from file path.
   */
  private generateId(imagePath: string): string {
    const relativePath = path.relative(this.mockupsRoot, imagePath);
    return relativePath.replace(/[\/\\]/g, '-').replace(/\.(png|jpg|jpeg)$/i, '');
  }

  /**
   * Infer dimension from folder path.
   */
  private inferDimension(relativePath: string): string {
    if (relativePath.startsWith('skins/') || relativePath.startsWith('skins\\')) {
      return 'skins';
    }
    if (relativePath.startsWith('design-variations/') || relativePath.startsWith('design-variations\\')) {
      return 'design-variations';
    }
    if (relativePath.startsWith('reference-images/') || relativePath.startsWith('reference-images\\')) {
      return 'reference-images';
    }
    return 'unknown';
  }

  /**
   * Scan mockups directory and build cache.
   */
  async scan(): Promise<MockupImage[]> {
    if (!this.mockupsRoot) {
      throw new Error('Mockups root not configured');
    }

    if (!(await fs.pathExists(this.mockupsRoot))) {
      throw new Error(`Mockups root does not exist: ${this.mockupsRoot}`);
    }

    console.log(`Scanning mockups from: ${this.mockupsRoot}`);

    // Find all images
    const imagePaths = await this.findImages(this.mockupsRoot);
    console.log(`Found ${imagePaths.length} images`);

    // Build mockup objects
    const mockups: MockupImage[] = [];

    for (const imagePath of imagePaths) {
      const metadata = await this.loadMetadata(imagePath);
      const relativePath = path.relative(this.mockupsRoot, imagePath);
      const id = this.generateId(imagePath);
      const filename = path.basename(imagePath);
      const folder = path.dirname(relativePath);
      const dimension = metadata?.meta?.dimension || this.inferDimension(relativePath);

      mockups.push({
        id,
        path: imagePath,
        relativePath,
        filename,
        folder,
        dimension,
        metadata,
        thumbnailUrl: `/api/mockups/thumbnail/${id}`,
        fullUrl: `/api/mockups/image/${id}`,
        hasMetadata: metadata !== null,
      });
    }

    // Update cache
    this.cache = mockups;
    this.lastScanTime = Date.now();

    // Emit update event
    this.emit('updated', mockups);

    return mockups;
  }

  /**
   * Get all mockups (from cache or scan).
   */
  async getAll(forceRefresh = false): Promise<MockupImage[]> {
    if (forceRefresh || this.cache.length === 0) {
      return this.scan();
    }
    return this.cache;
  }

  /**
   * Get a single mockup by ID.
   */
  async getById(id: string): Promise<MockupImage | null> {
    const mockups = await this.getAll();
    return mockups.find((m) => m.id === id) || null;
  }

  /**
   * Get mockups filtered by dimension.
   */
  async getByDimension(dimension: string): Promise<MockupImage[]> {
    const mockups = await this.getAll();
    return mockups.filter((m) => m.dimension === dimension);
  }

  /**
   * Get mockups filtered by model.
   */
  async getByModel(model: string): Promise<MockupImage[]> {
    const mockups = await this.getAll();
    return mockups.filter((m) => {
      const metadataModel = m.metadata?.generation?.model;
      if (!metadataModel) return false;
      return metadataModel.toLowerCase().includes(model.toLowerCase());
    });
  }

  /**
   * Search mockups by filename or metadata.
   */
  async search(query: string): Promise<MockupImage[]> {
    const mockups = await this.getAll();
    const lowerQuery = query.toLowerCase();

    return mockups.filter((m) => {
      // Search filename
      if (m.filename.toLowerCase().includes(lowerQuery)) return true;

      // Search metadata
      if (m.metadata) {
        const metadataStr = JSON.stringify(m.metadata).toLowerCase();
        if (metadataStr.includes(lowerQuery)) return true;
      }

      return false;
    });
  }

  /**
   * Get unique dimensions from all mockups.
   */
  async getDimensions(): Promise<string[]> {
    const mockups = await this.getAll();
    const dimensions = new Set(mockups.map((m) => m.dimension));
    return Array.from(dimensions).sort();
  }

  /**
   * Get unique models from all mockups.
   */
  async getModels(): Promise<string[]> {
    const mockups = await this.getAll();
    const models = new Set<string>();

    for (const mockup of mockups) {
      const model = mockup.metadata?.generation?.model;
      if (model && model !== 'UNKNOWN') {
        models.add(model);
      }
    }

    return Array.from(models).sort();
  }

  /**
   * Get unique folders from all mockups.
   */
  async getFolders(): Promise<string[]> {
    const mockups = await this.getAll();
    const folders = new Set(mockups.map((m) => m.folder));
    return Array.from(folders).sort();
  }

  /**
   * Get image file buffer.
   */
  async getImage(id: string): Promise<Buffer> {
    const mockup = await this.getById(id);
    if (!mockup) {
      throw new Error(`Mockup not found: ${id}`);
    }

    return fs.readFile(mockup.path);
  }

  /**
   * Get cache stats.
   */
  getStats() {
    return {
      totalImages: this.cache.length,
      lastScanTime: this.lastScanTime,
      root: this.mockupsRoot,
    };
  }

  /**
   * Force refresh cache.
   */
  async refresh(): Promise<MockupImage[]> {
    return this.scan();
  }
}
