import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PresentationService } from '../PresentationService.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { FlideckManifest } from '@flideck/shared';

// ManifestService is injected into PresentationService and is not a standalone singleton.
// All ManifestService methods are proxied through PresentationService's public API.
// We access them via PresentationService.getInstance() with setRoot(tempDir).

describe('ManifestService', () => {
  let tempDir: string;
  let service: PresentationService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'flideck-manifest-test-'));
    service = PresentationService.getInstance();
    service.setRoot(tempDir);
    service._resetWriteLocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ============================================================
  // getManifest() — reading manifest files
  // ============================================================

  describe('getManifest()', () => {
    it('returns null when no manifest file exists', async () => {
      await mkdir(join(tempDir, 'no-manifest-deck'));
      await writeFile(join(tempDir, 'no-manifest-deck', 'presentation.html'), '<h1>test</h1>');

      const result = await service.getManifest('no-manifest-deck');

      expect(result).toBeNull();
    });

    it('reads and parses index.json', async () => {
      const deckPath = join(tempDir, 'indexed-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      const manifest: FlideckManifest = {
        meta: { name: 'Indexed Deck' },
        slides: [{ file: 'presentation.html', title: 'Main' }],
      };
      await writeFile(join(deckPath, 'index.json'), JSON.stringify(manifest, null, 2));

      const result = await service.getManifest('indexed-deck');

      expect(result).not.toBeNull();
      expect(result!.meta?.name).toBe('Indexed Deck');
      expect(result!.slides).toHaveLength(1);
      expect(result!.slides![0].file).toBe('presentation.html');
    });

    it('falls back to flideck.json when index.json is missing (legacy compatibility)', async () => {
      const deckPath = join(tempDir, 'legacy-manifest-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      const legacyManifest: FlideckManifest = {
        assets: { order: ['presentation.html', 'slide-a.html'] },
      };
      await writeFile(join(deckPath, 'flideck.json'), JSON.stringify(legacyManifest, null, 2));

      const result = await service.getManifest('legacy-manifest-deck');

      expect(result).not.toBeNull();
      expect(result!.assets?.order).toEqual(['presentation.html', 'slide-a.html']);
    });
  });

  // ============================================================
  // patchManifest() — partial manifest updates
  // ============================================================

  describe('patchManifest()', () => {
    afterEach(() => {
      // Clean up any accidental prototype pollution from this describe block
      delete (Object.prototype as Record<string, unknown>)['polluted'];
    });

    it('merges a new top-level field while preserving existing fields', async () => {
      const deckPath = join(tempDir, 'patch-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      const initial: FlideckManifest = {
        meta: { name: 'Original Name' },
        slides: [{ file: 'presentation.html', title: 'Main' }],
      };
      await writeFile(join(deckPath, 'index.json'), JSON.stringify(initial, null, 2));

      await service.patchManifest('patch-deck', {
        slides: [{ file: 'presentation.html', title: 'Updated Main' }],
      });

      const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
      const updated = JSON.parse(raw) as FlideckManifest;

      // slides were replaced (arrays are replaced, not merged)
      expect(updated.slides![0].title).toBe('Updated Main');
      // meta must still be present (preserved from original)
      expect(updated.meta?.name).toBe('Original Name');
    });

    it('updates a nested field without clobbering sibling fields', async () => {
      const deckPath = join(tempDir, 'nested-patch-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      const initial: FlideckManifest = {
        meta: { name: 'My Deck', purpose: 'Demo' },
        slides: [],
      };
      await writeFile(join(deckPath, 'index.json'), JSON.stringify(initial, null, 2));

      // Patch only the name within meta — purpose must survive
      await service.patchManifest('nested-patch-deck', {
        meta: { name: 'Renamed Deck' },
      });

      const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
      const updated = JSON.parse(raw) as FlideckManifest;

      expect(updated.meta?.name).toBe('Renamed Deck');
      expect(updated.meta?.purpose).toBe('Demo');
    });

    it('throws AppError(400) for an invalid manifest schema after merge', async () => {
      const deckPath = join(tempDir, 'invalid-schema-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');

      // Patching meta with an unknown property violates additionalProperties:false in the schema
      await expect(
        service.patchManifest('invalid-schema-deck', {
          meta: { name: 'Valid', unknownFieldThatBreaksSchema: 'bad' } as FlideckManifest['meta'],
        })
      ).rejects.toBeInstanceOf(AppError);
    });

    it('proto-pollution guard: __proto__ key in PATCH payload does NOT appear in written manifest', async () => {
      const deckPath = join(tempDir, 'proto-guard-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');

      // Use JSON.parse to create a payload where __proto__ is a real own enumerable key
      // (object literal syntax { '__proto__': ... } does NOT create an own property — the engine
      // treats it as a prototype assignment. JSON.parse does create an own property.)
      const maliciousPayload = JSON.parse('{"__proto__":{"polluted":true}}') as Partial<FlideckManifest>;

      await service.patchManifest('proto-guard-deck', maliciousPayload);

      // Without the guard, deepMerge executes `result['__proto__'] = {polluted: true}`,
      // which V8 interprets as setting result's prototype — this propagates 'polluted'
      // onto Object.prototype, so every subsequent `{}` object inherits it.
      // Checking Object.prototype directly is vacuous because V8's assignment semantics
      // mean deepMerge sets the *result object's* prototype, not Object.prototype itself.
      // The correct proof: a newly created plain object inherits from whatever
      // Object.prototype now looks like — if polluted, `{}.polluted` would be truthy.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(({} as any).polluted).toBeUndefined();
    });

    it('concurrent calls serialize (write lock): both additive meta patches land without data loss', async () => {
      const deckPath = join(tempDir, 'concurrent-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      await writeFile(join(deckPath, 'index.json'), JSON.stringify({}, null, 2));

      // Each patch adds a DIFFERENT key to meta.
      // deepMerge merges objects by key (does not replace), so with the write lock:
      //   patch A reads {}, writes {meta: {name: 'patch-a'}}
      //   patch B reads {meta: {name: 'patch-a'}}, writes {meta: {name: 'patch-a', purpose: 'patch-b'}}
      // Without the lock both patches race to read {}, and only one key survives.
      await Promise.all([
        service.patchManifest('concurrent-deck', { meta: { name: 'patch-a' } }),
        service.patchManifest('concurrent-deck', { meta: { purpose: 'patch-b' } }),
      ]);

      const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
      const final = JSON.parse(raw) as FlideckManifest;

      // With write lock serialising the reads+writes, both keys must survive
      expect(final.meta?.name).toBe('patch-a');
      expect(final.meta?.purpose).toBe('patch-b');
    });
  });

  // ============================================================
  // bulkAddSlides() — conflict resolution strategies
  // ============================================================

  describe('bulkAddSlides()', () => {
    it('new slides are appended to manifest when no conflicts exist', async () => {
      const deckPath = join(tempDir, 'bulk-append-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      await writeFile(join(deckPath, 'slide-a.html'), '<h1>a</h1>');
      await writeFile(join(deckPath, 'slide-b.html'), '<h1>b</h1>');

      const result = await service.bulkAddSlides('bulk-append-deck', [
        { file: 'slide-a.html', title: 'Slide A' },
        { file: 'slide-b.html', title: 'Slide B' },
      ]);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);

      const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(raw) as FlideckManifest;
      expect(manifest.slides).toHaveLength(2);
      expect(manifest.slides![0].file).toBe('slide-a.html');
      expect(manifest.slides![1].file).toBe('slide-b.html');
    });

    it('skip conflict: duplicate file is skipped, returns correct counts', async () => {
      const deckPath = join(tempDir, 'skip-conflict-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      const initial: FlideckManifest = {
        slides: [{ file: 'slide-a.html', title: 'Original A' }],
      };
      await writeFile(join(deckPath, 'index.json'), JSON.stringify(initial, null, 2));

      const result = await service.bulkAddSlides(
        'skip-conflict-deck',
        [
          { file: 'slide-a.html', title: 'Overwrite A' },
          { file: 'slide-b.html', title: 'B' },
        ],
        { onConflict: { duplicateFile: 'skip' } }
      );

      expect(result.skipped).toBe(1);
      expect(result.added).toBe(1);
      expect(result.skippedItems[0].item).toBe('slide-a.html');

      // Original title must be unchanged
      const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(raw) as FlideckManifest;
      const slideA = manifest.slides!.find((s) => s.file === 'slide-a.html');
      expect(slideA?.title).toBe('Original A');
    });

    it('replace conflict: duplicate file is replaced, title is updated', async () => {
      const deckPath = join(tempDir, 'replace-conflict-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      const initial: FlideckManifest = {
        slides: [{ file: 'slide-a.html', title: 'Original A' }],
      };
      await writeFile(join(deckPath, 'index.json'), JSON.stringify(initial, null, 2));

      const result = await service.bulkAddSlides(
        'replace-conflict-deck',
        [{ file: 'slide-a.html', title: 'Replaced A' }],
        { onConflict: { duplicateFile: 'replace' } }
      );

      expect(result.updated).toBe(1);
      expect(result.skipped).toBe(0);

      const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(raw) as FlideckManifest;
      const slideA = manifest.slides!.find((s) => s.file === 'slide-a.html');
      expect(slideA?.title).toBe('Replaced A');
    });

    it('rename conflict: duplicate file gets renamed with counter suffix', async () => {
      const deckPath = join(tempDir, 'rename-conflict-deck');
      await mkdir(deckPath);
      await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
      const initial: FlideckManifest = {
        slides: [{ file: 'slide.html', title: 'Original' }],
      };
      await writeFile(join(deckPath, 'index.json'), JSON.stringify(initial, null, 2));

      const result = await service.bulkAddSlides(
        'rename-conflict-deck',
        [{ file: 'slide.html', title: 'Renamed Copy' }],
        { onConflict: { duplicateFile: 'rename' } }
      );

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(0);

      const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
      const manifest = JSON.parse(raw) as FlideckManifest;

      // Original slide must still be present
      const original = manifest.slides!.find((s) => s.file === 'slide.html');
      expect(original).toBeDefined();

      // Renamed slide must have a counter suffix (e.g., slide-1.html)
      const renamed = manifest.slides!.find((s) => s.file !== 'slide.html');
      expect(renamed).toBeDefined();
      expect(renamed!.file).toMatch(/^slide-\d+\.html$/);
      expect(renamed!.title).toBe('Renamed Copy');
    });
  });
});
