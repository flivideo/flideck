import fs from 'fs-extra';
import path from 'path';
import * as cheerio from 'cheerio';
import type {
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
import { AppError } from '../middleware/errorHandler.js';
import * as manifestValidator from '../utils/manifestValidator.js';

const MANIFEST_FILENAME = 'index.json';
const LEGACY_MANIFEST_FILENAME = 'flideck.json';

/**
 * ManifestService owns all manifest read/write/patch/sync/validate/template operations.
 * Extracted from PresentationService to reduce God-class size.
 *
 * Dependencies are injected at construction time to avoid circular references:
 *   - getPresentationPath: resolves a presentationId to an absolute folder path
 *   - assertSafeId:        throws AppError(400) on path-traversal attempts
 *   - formatName:          converts kebab/snake to Title Case (shared with PresentationService)
 *   - invalidateCache:     tells PresentationService to drop cached entries
 */
export class ManifestService {
  private writeLocks = new Map<string, Promise<void>>();

  constructor(
    private getPresentationPath: (id: string) => string,
    private assertSafeId: (folderPath: string) => void,
    private formatName: (name: string) => string,
    private invalidateCache: (id?: string) => void
  ) {}

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Read and parse the manifest file (index.json or legacy flideck.json).
   * Tries index.json first, falls back to flideck.json for backwards compatibility.
   * Returns null if no manifest exists or is invalid.
   */
  async readManifest(folderPath: string): Promise<FlideckManifest | null> {
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
      const parsed = JSON.parse(content);
      // Validate against schema — log warning but don't crash on bad disk state
      const validation = manifestValidator.validate(parsed);
      if (!validation.valid) {
        console.warn(
          `[ManifestService] Invalid manifest at ${manifestPath}: ${(validation.errors ?? []).map((e) => e.message).join(', ')}`
        );
        // Return parsed anyway — let the app work with best-effort data
      }
      const manifest = parsed as FlideckManifest;
      return manifest;
    } catch (error) {
      // Invalid JSON or read error - fall back to default order
      console.warn(`Failed to read manifest at ${manifestPath}:`, error);
      return null;
    }
  }

  /**
   * Write manifest JSON to the presentation folder.
   */
  private async writeManifest(folderPath: string, manifest: FlideckManifest): Promise<void> {
    const manifestPath = path.join(folderPath, MANIFEST_FILENAME);
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  }

  /**
   * Serialises concurrent writes to the same presentation via a per-id mutex.
   * Each caller waits for the previous promise to settle before proceeding.
   */
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

  /**
   * Type-safe deep merge that returns FlideckManifest.
   * Avoids unsafe casts at call sites.
   */
  private typedDeepMerge(
    target: Partial<FlideckManifest>,
    source: Partial<FlideckManifest>
  ): FlideckManifest {
    return this.deepMerge(
      target as Record<string, unknown>,
      source as Record<string, unknown>
    ) as FlideckManifest;
  }

  /**
   * Deep merge helper for PATCH semantics.
   * Objects are merged recursively, arrays are replaced.
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return source;
    }

    const result = { ...target };

    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      const sourceValue = source[key];
      const targetValue = result[key];

      if (Array.isArray(sourceValue)) {
        // Arrays are replaced, not merged
        result[key] = sourceValue;
      } else if (sourceValue && typeof sourceValue === 'object') {
        // Deep merge objects
        result[key] = this.deepMerge(
          (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)
            ? targetValue
            : {}) as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        // Primitives are replaced
        result[key] = sourceValue;
      }
    }

    return result;
  }

  // ============================================================
  // Test helpers
  // ============================================================

  /**
   * Clears all pending write locks. For use in tests only.
   * Prevents stale lock state from leaking between test cases.
   */
  _resetWriteLocks(): void {
    this.writeLocks.clear();
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
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

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
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Validation happens in route handler before this method is called

    // Update timestamp
    if (!manifest.meta) manifest.meta = {};
    manifest.meta.updated = new Date().toISOString().split('T')[0];

    await this.withWriteLock(presentationId, async () => {
      // Write manifest
      await this.writeManifest(folderPath, manifest);

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
  }

  /**
   * Partially update the manifest for a presentation.
   * Uses deep merge semantics for objects, replacement for arrays.
   *
   * @param presentationId - Presentation ID
   * @param updates - Partial manifest updates
   * @throws Error if presentation not found
   */
  async patchManifest(presentationId: string, updates: Partial<FlideckManifest>): Promise<void> {
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest or create new one (inside lock to avoid TOCTOU)
      const currentManifest = await this.readManifest(folderPath);
      const baseManifest = currentManifest || {};

      // Deep merge updates
      const manifest = this.typedDeepMerge(baseManifest, updates);

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Validate merged result before writing
      const validationResult = manifestValidator.validate(manifest);
      if (!validationResult.valid) {
        throw new AppError(
          `Manifest validation failed after merge: ${validationResult.errors
            ?.map((e) => `${e.field}: ${e.message}`)
            .join(', ')}`,
          400
        );
      }

      // Write manifest
      await this.writeManifest(folderPath, manifest);

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
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
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    return await this.withWriteLock(presentationId, async () => {
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
      await this.writeManifest(folderPath, manifest);

      // Invalidate cache
      this.invalidateCache(presentationId);

      return result;
    });
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
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    return await this.withWriteLock(presentationId, async () => {
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
      await this.writeManifest(folderPath, manifest);

      // Invalidate cache
      this.invalidateCache(presentationId);

      return result;
    });
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
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    // Discover all HTML files in folder (outside lock — read-only scan)
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const htmlFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.html'))
      .map((e) => e.name);

    const strategy = options.strategy || 'merge';

    await this.withWriteLock(presentationId, async () => {
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
          } catch (_error) {
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
      await this.writeManifest(folderPath, manifest);

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
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

    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

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
      } catch (_error) {
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
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

    // Verify presentation exists
    if (!(await fs.pathExists(folderPath))) {
      throw new Error(`Presentation not found: ${presentationId}`);
    }

    await this.withWriteLock(presentationId, async () => {
      // Read existing manifest
      const currentManifest = await this.readManifest(folderPath);

      // Apply template
      const newManifest = applyManifestTemplate(currentManifest, template, merge);

      // Update timestamp
      if (!newManifest.meta) newManifest.meta = {};
      newManifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await this.writeManifest(folderPath, newManifest);

      // Invalidate cache
      this.invalidateCache(presentationId);
    });
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
    const folderPath = this.getPresentationPath(presentationId);
    this.assertSafeId(folderPath);

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

    return await this.withWriteLock(presentationId, async () => {
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

            // Get title: prefer HTML <title> tag (canonical), fall back to card title
            const slideFilePath = path.join(folderPath, card.file);
            const htmlTitle = await this.extractTitleFromHtmlFile(slideFilePath);
            const slideTitle = htmlTitle || card.title;

            if (existingSlide) {
              // Update existing slide
              existingSlide.group = groupId;
              if (strategy === 'merge') {
                // For merge: HTML title (canonical) always wins, card title only fills gaps
                if (htmlTitle) {
                  existingSlide.title = htmlTitle;
                } else if (card.title && !existingSlide.title) {
                  existingSlide.title = card.title;
                }
              } else {
                if (slideTitle) existingSlide.title = slideTitle;
              }
            } else {
              // Create new slide entry - prefer HTML title (canonical)
              const newSlide: ManifestSlide = {
                file: card.file,
                group: groupId,
              };
              if (htmlTitle) {
                newSlide.title = htmlTitle;
              } else if (card.title) {
                newSlide.title = card.title;
              }
              manifest.slides!.push(newSlide);
              existingSlideMap.set(card.file, newSlide);
            }

            assignedSlides.add(card.file);
            result.slides.assigned++;
          }
        }
      }

      // Count orphaned slides (HTML files not in any index)
      const nonIndexHtmlFiles = htmlFiles.filter((f) => !f.match(/^index(-[\w-]+)?\.html$/));
      for (const file of nonIndexHtmlFiles) {
        if (!assignedSlides.has(file)) {
          result.slides.orphaned++;

          // For merge strategy, ensure orphaned slides are in manifest
          if (strategy === 'merge' && !existingSlideMap.has(file)) {
            // Try to extract title from the HTML file itself
            const filePath = path.join(folderPath, file);
            const extractedTitle = await this.extractTitleFromHtmlFile(filePath);

            const newSlide: ManifestSlide = { file };
            if (extractedTitle) {
              newSlide.title = extractedTitle;
            }
            manifest.slides!.push(newSlide);
            result.warnings.push(`Slide '${file}' not found in any index file`);
          }
        }
      }

      // Update timestamp
      if (!manifest.meta) manifest.meta = {};
      manifest.meta.updated = new Date().toISOString().split('T')[0];

      // Write manifest
      await this.writeManifest(folderPath, manifest);

      // Invalidate cache
      this.invalidateCache(presentationId);

      return result;
    });
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
  private extractSlideReference(_$: CheerioAPI, $el: Cheerio<AnyNode>): string | null {
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
   * Extract title from an HTML file by reading its <title> tag or first <h1>.
   * Used to provide meaningful names for orphaned slides.
   */
  private async extractTitleFromHtmlFile(filePath: string): Promise<string | undefined> {
    try {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(htmlContent);

      // Try <title> tag first
      const titleTag = $('title').first().text().trim();
      if (titleTag) {
        return titleTag;
      }

      // Fall back to first <h1>
      const h1Text = $('h1').first().text().trim();
      if (h1Text) {
        return h1Text;
      }

      return undefined;
    } catch {
      // File read error - return undefined to use filename fallback
      return undefined;
    }
  }

  /**
   * Extract title from a card element.
   * Tries: h1-h6, .title, .card-title, first text node.
   */
  private extractCardTitle(_$: CheerioAPI, $el: Cheerio<AnyNode>): string | undefined {
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
