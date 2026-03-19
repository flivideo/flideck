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
});
