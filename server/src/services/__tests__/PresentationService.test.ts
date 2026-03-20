import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PresentationService } from '../PresentationService.js';
import { AppError } from '../../middleware/errorHandler.js';

describe('PresentationService', () => {
  let tempDir: string;
  let service: PresentationService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'flideck-test-'));
    service = PresentationService.getInstance();
    service.setRoot(tempDir);
    service._resetWriteLocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ============================================================
  // discoverAll() — presentation discovery
  // ============================================================

  describe('discoverAll()', () => {
    it('returns a presentation for a folder containing presentation.html', async () => {
      const folderPath = join(tempDir, 'my-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<html></html>');

      const results = await service.discoverAll();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('my-deck');
    });

    it('returns a presentation for a folder containing index.html (legacy fallback)', async () => {
      const folderPath = join(tempDir, 'legacy-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'index.html'), '<html></html>');

      const results = await service.discoverAll();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('legacy-deck');
    });

    it('does NOT return a folder with no valid HTML entry point', async () => {
      const folderPath = join(tempDir, 'not-a-presentation');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'readme.txt'), 'this is not a presentation');

      const results = await service.discoverAll();

      expect(results).toHaveLength(0);
    });

    it('presentation.html takes precedence over index.html when both exist', async () => {
      const folderPath = join(tempDir, 'dual-entry');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<html>presentation</html>');
      await writeFile(join(folderPath, 'index.html'), '<html>index</html>');

      const results = await service.discoverAll();

      expect(results).toHaveLength(1);
      const deck = results[0];
      // The entry file (isIndex) should be presentation.html, not index.html
      const indexAsset = deck.assets.find((a) => a.isIndex);
      expect(indexAsset).toBeDefined();
      expect(indexAsset!.filename).toBe('presentation.html');
    });

    it('returns multiple presentations when multiple valid folders exist', async () => {
      const folderA = join(tempDir, 'deck-a');
      const folderB = join(tempDir, 'deck-b');
      await mkdir(folderA);
      await mkdir(folderB);
      await writeFile(join(folderA, 'presentation.html'), '<html></html>');
      await writeFile(join(folderB, 'index.html'), '<html></html>');

      const results = await service.discoverAll();

      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain('deck-a');
      expect(ids).toContain('deck-b');
    });

    it('returns empty array when the root directory contains no valid presentations', async () => {
      const results = await service.discoverAll();
      expect(results).toHaveLength(0);
    });

    it('returns tabbed presentation for folder containing presentation-tab-*.html files', async () => {
      const folderPath = join(tempDir, 'tabbed-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation-tab-intro.html'), '<html>intro</html>');
      await writeFile(join(folderPath, 'presentation-tab-main.html'), '<html>main</html>');

      const results = await service.discoverAll();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('tabbed-deck');
    });
  });

  // ============================================================
  // assertSafeId() — path traversal prevention (via public methods)
  // ============================================================

  describe('path traversal prevention (assertSafeId)', () => {
    it('throws AppError with status 400 for a path traversal attempt via getById', async () => {
      let caughtError: unknown;
      try {
        await service.getById('../../../etc');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AppError);
      expect((caughtError as AppError).statusCode).toBe(400);
    });

    it('throws AppError with status 400 for a path traversal attempt via saveAssetOrder', async () => {
      let caughtError: unknown;
      try {
        await service.saveAssetOrder('../../../etc', ['a.html']);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AppError);
      expect((caughtError as AppError).statusCode).toBe(400);
    });

    it('does NOT throw for a valid presentation ID via getById', async () => {
      const folderPath = join(tempDir, 'valid-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<html></html>');

      // Should not throw - valid ID within root
      const result = await service.getById('valid-deck');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('valid-deck');
    });
  });

  // ============================================================
  // saveAssetOrder() — manifest disk persistence
  // ============================================================

  describe('saveAssetOrder()', () => {
    it('writes the specified order to index.json in the presentation folder', async () => {
      const folderPath = join(tempDir, 'ordered-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<html></html>');
      await writeFile(join(folderPath, 'a.html'), '<html></html>');
      await writeFile(join(folderPath, 'b.html'), '<html></html>');

      await service.saveAssetOrder('ordered-deck', ['b.html', 'a.html', 'presentation.html']);

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as { assets: { order: string[] } };

      expect(manifest.assets.order).toEqual(['b.html', 'a.html', 'presentation.html']);
    });

    it('overwrites an existing manifest order with the new order', async () => {
      const folderPath = join(tempDir, 'reorder-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<html></html>');
      await writeFile(join(folderPath, 'slide1.html'), '<html></html>');
      await writeFile(join(folderPath, 'slide2.html'), '<html></html>');

      // First save
      await service.saveAssetOrder('reorder-deck', ['slide1.html', 'slide2.html']);
      // Second save with different order
      await service.saveAssetOrder('reorder-deck', ['slide2.html', 'slide1.html']);

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as { assets: { order: string[] } };

      expect(manifest.assets.order).toEqual(['slide2.html', 'slide1.html']);
    });
  });

  // ============================================================
  // getById() — additional behaviour
  // ============================================================

  describe('getById()', () => {
    it('returns null for a missing presentation ID', async () => {
      const result = await service.getById('does-not-exist');
      expect(result).toBeNull();
    });

    it('returns the presentation data when the folder has a valid entry point', async () => {
      const folderPath = join(tempDir, 'found-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<html></html>');

      const result = await service.getById('found-deck');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('found-deck');
      expect(result!.name).toBe('Found Deck');
    });

    it('returns null for a folder that exists but has no HTML entry point', async () => {
      const folderPath = join(tempDir, 'empty-folder');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'readme.txt'), 'not an html file');

      const result = await service.getById('empty-folder');
      expect(result).toBeNull();
    });

    it('getById throws AppError(400) when presentationsRoot is not set', async () => {
      // Temporarily clear the root — empty string = unset
      service.setRoot('');

      await expect(service.getById('any-deck')).rejects.toMatchObject({ statusCode: 400 });

      // Restore root for subsequent tests
      service.setRoot(tempDir);
    });
  });

  // ============================================================
  // createPresentation() — folder and manifest creation
  // ============================================================

  describe('createPresentation()', () => {
    it('creates the folder and writes an index.json manifest', async () => {
      await service.createPresentation('new-presentation', 'My New Deck');

      const manifestContent = await readFile(
        join(tempDir, 'new-presentation', 'index.json'),
        'utf-8'
      );
      const manifest = JSON.parse(manifestContent) as { meta: { name: string }; slides: unknown[] };

      expect(manifest.meta.name).toBe('My New Deck');
      expect(Array.isArray(manifest.slides)).toBe(true);
    });

    it('throws if the presentation folder already exists', async () => {
      const folderPath = join(tempDir, 'existing-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<html></html>');

      await expect(service.createPresentation('existing-deck')).rejects.toThrow(
        /already exists/i
      );
    });
  });

  // ============================================================
  // assertSafeId — cache-warm traversal prevention
  // ============================================================

  describe('assertSafeId — cache-warm traversal prevention', () => {
    it('getById blocks traversal even when cache is warm', async () => {
      // Warm the cache with a valid presentation
      const folderPath = join(tempDir, 'valid-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>test</h1>');
      await service.getById('valid-deck'); // populates cache

      // Path traversal attempt must still throw AppError 400 even with a warm cache
      await expect(service.getById('../etc/passwd')).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ============================================================
  // addSlide() — Group 1: append, dedup, legacy migration
  // ============================================================

  describe('addSlide()', () => {
    it('appends a new slide to an empty manifest (creates slides array)', async () => {
      const folderPath = join(tempDir, 'new-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');

      await service.addSlide('new-deck', { file: 'slide-a.html', title: 'Slide A' });

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as { slides: Array<{ file: string; title?: string }> };

      expect(Array.isArray(manifest.slides)).toBe(true);
      expect(manifest.slides).toHaveLength(1);
      expect(manifest.slides[0].file).toBe('slide-a.html');
      expect(manifest.slides[0].title).toBe('Slide A');
    });

    it('throws when slide with same file already exists in manifest (deduplication)', async () => {
      const folderPath = join(tempDir, 'dedup-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');

      // Add the slide once
      await service.addSlide('dedup-deck', { file: 'slide-a.html' });

      // Attempt to add the same file again — must throw
      await expect(
        service.addSlide('dedup-deck', { file: 'slide-a.html' })
      ).rejects.toThrow(/already exists/i);
    });

    it('migrates legacy assets.order manifest to slides array format when adding a slide', async () => {
      const folderPath = join(tempDir, 'legacy-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');
      await writeFile(join(folderPath, 'slide-a.html'), '<h1>a</h1>');
      // Write a legacy manifest (assets.order format)
      await writeFile(
        join(folderPath, 'index.json'),
        JSON.stringify({ assets: { order: ['presentation.html', 'slide-a.html'] } })
      );

      await service.addSlide('legacy-deck', { file: 'slide-b.html', title: 'B' });

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as {
        slides: Array<{ file: string }>;
        assets?: unknown;
      };

      // After addSlide, should use slides array format
      expect(Array.isArray(manifest.slides)).toBe(true);
      // Legacy entries should be migrated
      expect(manifest.slides.some((s) => s.file === 'presentation.html')).toBe(true);
      expect(manifest.slides.some((s) => s.file === 'slide-a.html')).toBe(true);
      // New slide should be appended
      expect(manifest.slides.some((s) => s.file === 'slide-b.html')).toBe(true);
      // Legacy assets key should be gone
      expect(manifest.assets).toBeUndefined();
    });

    it('adds slide with correct group field when group name is specified', async () => {
      const folderPath = join(tempDir, 'grouped-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');

      await service.addSlide('grouped-deck', { file: 'intro.html', title: 'Intro', group: 'chapter-1' });

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as {
        slides: Array<{ file: string; group?: string }>;
      };

      expect(manifest.slides[0].group).toBe('chapter-1');
    });
  });

  // ============================================================
  // saveAssetOrder() slides-format branch — Group 2
  // ============================================================

  describe('saveAssetOrder() — slides-format branch', () => {
    it('reorders slides by given array when manifest already has slides array', async () => {
      const folderPath = join(tempDir, 'slides-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');
      await writeFile(join(folderPath, 'a.html'), '<h1>a</h1>');
      await writeFile(join(folderPath, 'b.html'), '<h1>b</h1>');
      // Pre-populate a slides-format manifest
      await writeFile(
        join(folderPath, 'index.json'),
        JSON.stringify({
          slides: [
            { file: 'a.html', title: 'A' },
            { file: 'b.html', title: 'B' },
            { file: 'presentation.html', title: 'Main' },
          ],
        })
      );

      // Reorder: b first, then a, then presentation.html
      await service.saveAssetOrder('slides-deck', ['b.html', 'a.html', 'presentation.html']);

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as { slides: Array<{ file: string }> };

      expect(Array.isArray(manifest.slides)).toBe(true);
      expect(manifest.slides.map((s) => s.file)).toEqual(['b.html', 'a.html', 'presentation.html']);
    });

    it('preserves slide metadata (title, group) after slides-format reorder', async () => {
      const folderPath = join(tempDir, 'metadata-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');
      await writeFile(join(folderPath, 'a.html'), '<h1>a</h1>');
      await writeFile(join(folderPath, 'b.html'), '<h1>b</h1>');
      await writeFile(
        join(folderPath, 'index.json'),
        JSON.stringify({
          slides: [
            { file: 'a.html', title: 'Alpha', group: 'intro' },
            { file: 'b.html', title: 'Beta', group: 'main' },
          ],
        })
      );

      // Flip the order
      await service.saveAssetOrder('metadata-deck', ['b.html', 'a.html']);

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as {
        slides: Array<{ file: string; title?: string; group?: string }>;
      };

      const aSlide = manifest.slides.find((s) => s.file === 'a.html');
      const bSlide = manifest.slides.find((s) => s.file === 'b.html');

      // Metadata must survive the reorder
      expect(aSlide?.title).toBe('Alpha');
      expect(aSlide?.group).toBe('intro');
      expect(bSlide?.title).toBe('Beta');
      expect(bSlide?.group).toBe('main');
      // Order must be reversed
      expect(manifest.slides[0].file).toBe('b.html');
      expect(manifest.slides[1].file).toBe('a.html');
    });
  });

  // ============================================================
  // deleteTab() cascade strategy — Group 3
  // ============================================================

  describe('deleteTab()', () => {
    /** Helper: write a manifest with a tab, a child group, and slides assigned to that group. */
    async function writeTabManifest(folderPath: string): Promise<void> {
      await writeFile(
        join(folderPath, 'index.json'),
        JSON.stringify({
          slides: [
            { file: 'slide-1.html', group: 'section-a' },
            { file: 'slide-2.html', group: 'section-a' },
            { file: 'slide-3.html' },
          ],
          groups: {
            'tab-main': { label: 'Main Tab', tab: true, order: 1 },
            'section-a': { label: 'Section A', order: 2, parent: 'tab-main' },
          },
        })
      );
    }

    it('cascade strategy deletes tab, child groups, and clears group field from affected slides', async () => {
      const folderPath = join(tempDir, 'cascade-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');
      await writeTabManifest(folderPath);

      await service.deleteTab('cascade-deck', 'tab-main', 'cascade');

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as {
        groups?: Record<string, unknown>;
        slides: Array<{ file: string; group?: string }>;
      };

      // Tab must be removed
      expect(manifest.groups?.['tab-main']).toBeUndefined();
      // Child group must be removed
      expect(manifest.groups?.['section-a']).toBeUndefined();
      // Slides that belonged to the deleted group must have group field cleared
      const slide1 = manifest.slides.find((s) => s.file === 'slide-1.html');
      const slide2 = manifest.slides.find((s) => s.file === 'slide-2.html');
      expect(slide1?.group).toBeUndefined();
      expect(slide2?.group).toBeUndefined();
      // Unrelated slide must be unaffected
      const slide3 = manifest.slides.find((s) => s.file === 'slide-3.html');
      expect(slide3?.group).toBeUndefined(); // was already unset — just confirm no corruption
    });

    it('orphan strategy removes tab but leaves child groups parentless (not deleted)', async () => {
      const folderPath = join(tempDir, 'orphan-deck');
      await mkdir(folderPath);
      await writeFile(join(folderPath, 'presentation.html'), '<h1>main</h1>');
      await writeTabManifest(folderPath);

      // 'orphan' is the default strategy
      await service.deleteTab('orphan-deck', 'tab-main', 'orphan');

      const manifestContent = await readFile(join(folderPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(manifestContent) as {
        groups?: Record<string, { label: string; parent?: string }>;
        slides: Array<{ file: string; group?: string }>;
      };

      // Tab must be removed
      expect(manifest.groups?.['tab-main']).toBeUndefined();
      // Child group must STILL EXIST (orphaned, not deleted)
      expect(manifest.groups?.['section-a']).toBeDefined();
      // Child group must have no parent
      expect(manifest.groups?.['section-a']?.parent).toBeUndefined();
      // Slides keep their group assignment (group itself still exists)
      const slide1 = manifest.slides.find((s) => s.file === 'slide-1.html');
      expect(slide1?.group).toBe('section-a');
    });
  });

  // ============================================================
  // write lock — concurrent addSlide calls
  // ============================================================

  describe('concurrent addSlide calls serialize (write lock)', () => {
    it('both slides survive when two addSlide calls race', async () => {
      const deckPath = join(tempDir, 'concurrent-write-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      await writeFile(join(deckPath, 'index.json'), JSON.stringify({}, null, 2));

      // Fire both simultaneously
      await Promise.all([
        service.addSlide('concurrent-write-deck', { file: 'slide-a.html' }),
        service.addSlide('concurrent-write-deck', { file: 'slide-b.html' }),
      ]);

      // Both must survive
      const manifest = JSON.parse(
        await readFile(join(deckPath, 'index.json'), 'utf-8')
      );
      const files = manifest.slides.map((s: { file: string }) => s.file);
      expect(files).toContain('slide-a.html');
      expect(files).toContain('slide-b.html');
    });
  });

  // ============================================================
  // write lock — concurrent additional method calls
  // ============================================================

  describe('concurrent write lock — additional methods', () => {
    it('both groups survive when two createGroup calls race', async () => {
      const deckPath = join(tempDir, 'concurrent-group-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      await writeFile(join(deckPath, 'index.json'), JSON.stringify({}, null, 2));

      await Promise.all([
        service.createGroup('concurrent-group-deck', 'group-a', 'Group A'),
        service.createGroup('concurrent-group-deck', 'group-b', 'Group B'),
      ]);

      const manifest = JSON.parse(
        await readFile(join(deckPath, 'index.json'), 'utf-8')
      );
      expect(manifest.groups).toHaveProperty('group-a');
      expect(manifest.groups).toHaveProperty('group-b');
    });

    it('both field updates survive when two updateSlide calls race on the same slide', async () => {
      const deckPath = join(tempDir, 'concurrent-update-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      // Manifest with one existing slide
      await writeFile(
        join(deckPath, 'index.json'),
        JSON.stringify({ slides: [{ file: 'slide-a.html' }] }, null, 2)
      );

      // Two concurrent updates to DIFFERENT fields on the same slide
      await Promise.all([
        service.updateSlide('concurrent-update-deck', 'slide-a.html', { title: 'My Title' }),
        service.updateSlide('concurrent-update-deck', 'slide-a.html', { description: 'My Description' }),
      ]);

      const manifest = JSON.parse(
        await readFile(join(deckPath, 'index.json'), 'utf-8')
      );
      const slide = manifest.slides[0];
      expect(slide.title).toBe('My Title');
      expect(slide.description).toBe('My Description');
    });

    it('deleteTab cascade and addSlide complete without error or corruption', async () => {
      const deckPath = join(tempDir, 'concurrent-deletetab-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');

      // Set up a manifest with a tab, a group under it, a slide in that group,
      // and a separate "safe" group not under the tab
      const initialManifest = {
        groups: {
          'tab-a': { label: 'Tab A', order: 1, tab: true },
          'group-under-tab': { label: 'Under Tab', order: 2, parent: 'tab-a' },
          'safe-group': { label: 'Safe', order: 3 },
        },
        slides: [
          { file: 'slide-in-group.html', group: 'group-under-tab' },
        ],
      };
      await writeFile(join(deckPath, 'index.json'), JSON.stringify(initialManifest, null, 2));

      // deleteTab (cascade) races with addSlide (adding to safe-group, not the deleted group)
      await Promise.all([
        service.deleteTab('concurrent-deletetab-deck', 'tab-a', 'cascade'),
        service.addSlide('concurrent-deletetab-deck', { file: 'new-slide.html', group: 'safe-group' }),
      ]);

      const manifest = JSON.parse(
        await readFile(join(deckPath, 'index.json'), 'utf-8')
      );
      // Without the lock: addSlide reads the pre-cascade manifest and writes it back
      // after deleteTab, restoring tab-a and group-under-tab. These assertions would fail.
      expect(manifest.groups).not.toHaveProperty('tab-a');
      expect(manifest.groups).not.toHaveProperty('group-under-tab');
      // Cascade clears group membership on affected slides (does not delete the slide)
      const inGroupSlide = manifest.slides.find(
        (s: { file: string; group?: string }) => s.file === 'slide-in-group.html'
      );
      expect(inGroupSlide).toBeDefined();
      expect(inGroupSlide?.group).toBeUndefined();
      // The new slide from addSlide must also survive
      const files = manifest.slides.map((s: { file: string }) => s.file);
      expect(files).toContain('new-slide.html');
    });
  });

  // ============================================================
  // applySlideMetadata() — metadata field propagation (B049)
  // ============================================================

  describe('applySlideMetadata()', () => {
    async function setupMetaDeck(manifestSlides: object[]): Promise<void> {
      const deckPath = join(tempDir, 'meta-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>entry</h1>');
      await writeFile(join(deckPath, 'slide-a.html'), '<h1>a</h1>');
      await writeFile(join(deckPath, 'slide-b.html'), '<h1>b</h1>');
      await writeFile(join(deckPath, 'index.json'), JSON.stringify({ slides: manifestSlides }, null, 2));
    }

    it('applies title to both asset.name and asset.title', async () => {
      await setupMetaDeck([
        { file: 'slide-a.html', title: 'Slide A Title' },
      ]);

      const presentation = await service.getById('meta-deck');
      const slideA = presentation!.assets.find((a) => a.filename === 'slide-a.html')!;

      expect(slideA.name).toBe('Slide A Title');
      expect(slideA.title).toBe('Slide A Title');
    });

    it('applies group to asset.group', async () => {
      await setupMetaDeck([
        { file: 'slide-a.html', group: 'intro' },
      ]);

      const presentation = await service.getById('meta-deck');
      const slideA = presentation!.assets.find((a) => a.filename === 'slide-a.html')!;

      expect(slideA.group).toBe('intro');
    });

    it('applies description to asset.description', async () => {
      await setupMetaDeck([
        { file: 'slide-a.html', description: 'First slide description' },
      ]);

      const presentation = await service.getById('meta-deck');
      const slideA = presentation!.assets.find((a) => a.filename === 'slide-a.html')!;

      expect(slideA.description).toBe('First slide description');
    });

    it('applies recommended to asset.recommended', async () => {
      await setupMetaDeck([
        { file: 'slide-a.html', recommended: true },
      ]);

      const presentation = await service.getById('meta-deck');
      const slideA = presentation!.assets.find((a) => a.filename === 'slide-a.html')!;

      expect(slideA.recommended).toBe(true);
    });

    it('applies viewportLock to asset.viewportLock', async () => {
      await setupMetaDeck([
        { file: 'slide-a.html', viewportLock: true },
      ]);

      const presentation = await service.getById('meta-deck');
      const slideA = presentation!.assets.find((a) => a.filename === 'slide-a.html')!;

      expect(slideA.viewportLock).toBe(true);
    });

    it('orders assets by manifest slides array order', async () => {
      await setupMetaDeck([
        { file: 'slide-b.html', title: 'B First' },
        { file: 'slide-a.html', title: 'A Second' },
        { file: 'presentation.html', title: 'Entry Last' },
      ]);

      const presentation = await service.getById('meta-deck');
      const filenames = presentation!.assets.map((a) => a.filename);

      expect(filenames[0]).toBe('slide-b.html');
      expect(filenames[1]).toBe('slide-a.html');
      expect(filenames[2]).toBe('presentation.html');
    });

    it('appends slides not in manifest at end (remaining assets fallback)', async () => {
      // Only slide-a.html is in the manifest; slide-b.html and presentation.html are not
      await setupMetaDeck([
        { file: 'slide-a.html', title: 'A' },
      ]);

      const presentation = await service.getById('meta-deck');
      const filenames = presentation!.assets.map((a) => a.filename);

      // slide-a is first (from manifest)
      expect(filenames[0]).toBe('slide-a.html');
      // remaining files appended after
      expect(filenames).toContain('slide-b.html');
      expect(filenames).toContain('presentation.html');
      // remaining come after the manifest entry
      expect(filenames.indexOf('slide-a.html')).toBeLessThan(filenames.indexOf('slide-b.html'));
      expect(filenames.indexOf('slide-a.html')).toBeLessThan(filenames.indexOf('presentation.html'));
    });

    it('slide without title keeps its default formatted name from filename', async () => {
      await setupMetaDeck([
        { file: 'slide-a.html' }, // no title field
      ]);

      const presentation = await service.getById('meta-deck');
      const slideA = presentation!.assets.find((a) => a.filename === 'slide-a.html')!;

      // name should be formatted from filename ('slide-a' → 'Slide A'), not blank
      expect(slideA.name).toBe('Slide A');
      expect(slideA.title).toBeUndefined();
    });
  });

  // ============================================================
  // removeSlide() — manifest slide removal (B051)
  // ============================================================

  describe('removeSlide()', () => {
    async function setupRemoveDeck(): Promise<void> {
      const deckPath = join(tempDir, 'remove-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>entry</h1>');
      await writeFile(join(deckPath, 'slide-a.html'), '<h1>a</h1>');
      await writeFile(join(deckPath, 'slide-b.html'), '<h1>b</h1>');
      await writeFile(
        join(deckPath, 'index.json'),
        JSON.stringify({
          slides: [
            { file: 'presentation.html' },
            { file: 'slide-a.html', title: 'Slide A' },
            { file: 'slide-b.html', title: 'Slide B' },
          ],
        }, null, 2)
      );
    }

    it('removes the slide from the manifest', async () => {
      await setupRemoveDeck();

      await service.removeSlide('remove-deck', 'slide-a.html');

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'remove-deck', 'index.json'), 'utf-8')
      ) as { slides: Array<{ file: string }> };

      const files = manifest.slides.map((s) => s.file);
      expect(files).not.toContain('slide-a.html');
      expect(files).toContain('slide-b.html');
      expect(files).toContain('presentation.html');
    });

    it('accepts slideId without .html extension', async () => {
      await setupRemoveDeck();

      // Pass ID without extension — method should normalise to slide-a.html
      await service.removeSlide('remove-deck', 'slide-a');

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'remove-deck', 'index.json'), 'utf-8')
      ) as { slides: Array<{ file: string }> };

      expect(manifest.slides.map((s) => s.file)).not.toContain('slide-a.html');
    });

    it('throws when slide not found', async () => {
      await setupRemoveDeck();

      await expect(service.removeSlide('remove-deck', 'nonexistent.html')).rejects.toThrow(
        /slide not found/i
      );
    });

    it('throws when presentation not found', async () => {
      await expect(service.removeSlide('does-not-exist', 'slide-a.html')).rejects.toThrow(
        /presentation not found/i
      );
    });
  });

  // ============================================================
  // updateSlide() — field updates (B051)
  // ============================================================

  describe('updateSlide() — field updates', () => {
    async function setupUpdateDeck(): Promise<void> {
      const deckPath = join(tempDir, 'update-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>entry</h1>');
      await writeFile(
        join(deckPath, 'index.json'),
        JSON.stringify({
          slides: [
            { file: 'presentation.html' },
            { file: 'slide-a.html', title: 'Original Title' },
          ],
        }, null, 2)
      );
    }

    it('updates title field', async () => {
      await setupUpdateDeck();

      await service.updateSlide('update-deck', 'slide-a.html', { title: 'New Title' });

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'update-deck', 'index.json'), 'utf-8')
      ) as { slides: Array<{ file: string; title?: string }> };

      const slide = manifest.slides.find((s) => s.file === 'slide-a.html');
      expect(slide?.title).toBe('New Title');
    });

    it('updates group field', async () => {
      await setupUpdateDeck();

      await service.updateSlide('update-deck', 'slide-a.html', { group: 'chapter-1' });

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'update-deck', 'index.json'), 'utf-8')
      ) as { slides: Array<{ file: string; group?: string }> };

      const slide = manifest.slides.find((s) => s.file === 'slide-a.html');
      expect(slide?.group).toBe('chapter-1');
    });

    it('clears title when empty string passed', async () => {
      await setupUpdateDeck();

      await service.updateSlide('update-deck', 'slide-a.html', { title: '' });

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'update-deck', 'index.json'), 'utf-8')
      ) as { slides: Array<{ file: string; title?: string }> };

      const slide = manifest.slides.find((s) => s.file === 'slide-a.html');
      // Empty string is coerced to undefined by the implementation
      expect(slide?.title).toBeUndefined();
    });

    it('throws when slide not found', async () => {
      await setupUpdateDeck();

      await expect(
        service.updateSlide('update-deck', 'nonexistent.html', { title: 'X' })
      ).rejects.toThrow(/slide not found/i);
    });
  });

  // ============================================================
  // deleteGroup() — group removal and cascade (B051)
  // ============================================================

  describe('deleteGroup()', () => {
    async function setupGroupDeck(): Promise<void> {
      const deckPath = join(tempDir, 'group-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>entry</h1>');
      await writeFile(
        join(deckPath, 'index.json'),
        JSON.stringify({
          groups: {
            'group-a': { label: 'Group A', order: 1 },
            'group-b': { label: 'Group B', order: 2 },
            'group-c': { label: 'Group C', order: 3 },
          },
          slides: [
            { file: 'slide-1.html', group: 'group-a' },
            { file: 'slide-2.html', group: 'group-b' },
            { file: 'slide-3.html', group: 'group-c' },
          ],
        }, null, 2)
      );
    }

    it('removes the group from manifest.groups', async () => {
      await setupGroupDeck();

      await service.deleteGroup('group-deck', 'group-b');

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'group-deck', 'index.json'), 'utf-8')
      ) as { groups: Record<string, unknown>; slides: Array<{ file: string; group?: string }> };

      expect(manifest.groups).not.toHaveProperty('group-b');
    });

    it('clears group field from slides that were in the deleted group', async () => {
      await setupGroupDeck();

      await service.deleteGroup('group-deck', 'group-b');

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'group-deck', 'index.json'), 'utf-8')
      ) as { slides: Array<{ file: string; group?: string }> };

      const slide2 = manifest.slides.find((s) => s.file === 'slide-2.html');
      expect(slide2?.group).toBeUndefined();
    });

    it('leaves slides from other groups unaffected', async () => {
      await setupGroupDeck();

      await service.deleteGroup('group-deck', 'group-b');

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'group-deck', 'index.json'), 'utf-8')
      ) as { slides: Array<{ file: string; group?: string }> };

      const slide1 = manifest.slides.find((s) => s.file === 'slide-1.html');
      const slide3 = manifest.slides.find((s) => s.file === 'slide-3.html');
      expect(slide1?.group).toBe('group-a');
      expect(slide3?.group).toBe('group-c');
    });

    it('renumbers remaining groups to fill gaps in order values', async () => {
      await setupGroupDeck();

      // Delete group-b (order: 2) — remaining are group-a (1) and group-c (3)
      await service.deleteGroup('group-deck', 'group-b');

      const manifest = JSON.parse(
        await readFile(join(tempDir, 'group-deck', 'index.json'), 'utf-8')
      ) as { groups: Record<string, { label: string; order: number }> };

      // After renumbering, group-a stays 1, group-c should become 2
      expect(manifest.groups['group-a'].order).toBe(1);
      expect(manifest.groups['group-c'].order).toBe(2);
    });

    it('throws when group not found', async () => {
      await setupGroupDeck();

      await expect(service.deleteGroup('group-deck', 'nonexistent-group')).rejects.toThrow(
        /group not found/i
      );
    });
  });
});
