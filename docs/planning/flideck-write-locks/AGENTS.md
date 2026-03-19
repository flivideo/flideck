# AGENTS.md — FliDeck Write Locks

## Project Overview

**Project**: FliDeck — local-first presentation harness (React 19 + Vite 7 + Express 5)
**Campaign**: flideck-write-locks — serialise concurrent manifest writes in PresentationService
**Stack**: Express 5 + Vitest + TypeScript (server only — no client changes)

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck

# Run all tests
npm test

# Server tests only (faster feedback)
cd server && npm test
```

---

## Directory Structure

```
flideck/server/src/
├── services/
│   ├── PresentationService.ts          # EDIT THIS — add lock, wrap 16 write sites
│   ├── ManifestService.ts              # READ ONLY — reference lock implementation
│   └── __tests__/
│       ├── PresentationService.test.ts # EDIT THIS — add concurrent write test
│       └── ManifestService.test.ts     # READ ONLY — see concurrent test as reference
```

---

## Work Unit: write-lock-presentation-service (B047)

### The problem

`PresentationService.ts` has 16 raw `fs.writeJson` calls with no locking. Each method reads the manifest, modifies it in memory, then writes it back. Two concurrent requests (e.g. agent calling `addSlide` while UI calls `saveAssetOrder`) race: read-old → modify → write-old, silently discarding the other write.

### Step 1 — Add the lock infrastructure to PresentationService

Find the class definition in `PresentationService.ts`. Add two members immediately after the class opening line (alongside existing private fields):

```typescript
private writeLocks = new Map<string, Promise<void>>();

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
```

This is a verbatim copy of the pattern from `ManifestService.ts` (lines 33 and 101–117). Do NOT modify ManifestService.

### Step 2 — Wrap each of the 16 methods

Each method follows this read-modify-write pattern:

```typescript
async someMethod(presentationId: string, ...args): Promise<...> {
  const folderPath = path.join(this.presentationsRoot, presentationId);
  this.assertSafeId(folderPath);
  const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

  // Read
  let manifest = await this.readManifest(folderPath);
  if (!manifest) { manifest = {}; }

  // ... modify manifest in memory ...

  // Write
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  this.invalidateCache(presentationId);
}
```

Wrap the read-modify-write block in `withWriteLock`:

```typescript
async someMethod(presentationId: string, ...args): Promise<...> {
  const folderPath = path.join(this.presentationsRoot, presentationId);
  this.assertSafeId(folderPath);
  const manifestPath = path.join(folderPath, MANIFEST_FILENAME);

  await this.withWriteLock(presentationId, async () => {
    // Read
    let manifest = await this.readManifest(folderPath);
    if (!manifest) { manifest = {}; }

    // ... modify manifest in memory ...

    // Write
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
    this.invalidateCache(presentationId);
  });
}
```

**The 16 write sites** (all in `PresentationService.ts`):

| Line | Method |
|------|--------|
| 488 | `saveAssetOrder` |
| 539 | `saveAssetOrderWithGroups` |
| 630 | `addSlide` |
| 705 | `updateSlide` |
| 776 | `removeSlide` |
| 826 | `createGroup` |
| 877 | `updateGroup` |
| 929 | `deleteGroup` |
| 972 | `createTab` |
| 1031 | `updateTab` |
| 1083 | `deleteTab` |
| 1193 | `reorderTabs` |
| 1235 | `setGroupParent` |
| 1297 | `removeGroupParent` |
| 1348 | `reorderGroups` |
| 1386 | `createPresentation` |

Verify all 16 are wrapped: `grep -n "fs\.writeJson" server/src/services/PresentationService.ts` — after the change, every line listed should be inside a `withWriteLock` callback.

### Step 3 — Add a concurrent write test

Edit `server/src/services/__tests__/PresentationService.test.ts`.

Add a new `describe('write lock')` block modelled on the ManifestService concurrent test (ManifestService.test.ts lines 166–196). The test should:

1. Create a temp presentation folder with a `presentation.html` and empty `index.json`
2. Fire two `addSlide` calls simultaneously with **different** slide filenames
3. After both settle, read back the manifest and assert **both slides are present**

Pattern from ManifestService (adapt for addSlide):

```typescript
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
```

---

## Success Criteria

- [ ] `private writeLocks` map and `private async withWriteLock` method added to PresentationService
- [ ] All 16 `fs.writeJson` calls are inside a `withWriteLock(presentationId, ...)` callback — verified with grep
- [ ] At least 1 concurrent write test added to PresentationService.test.ts
- [ ] `cd server && npm test` passes — count must be ≥ 104 (103 existing + at least 1 new)
- [ ] TypeScript compiles: `cd server && npx tsc --noEmit` exits 0
- [ ] Public method signatures unchanged

---

## Reference Implementation

Read `server/src/services/ManifestService.ts` lines 33 and 101–117 for the exact lock pattern.
Read `server/src/services/__tests__/ManifestService.test.ts` lines 166–196 for the concurrent test pattern.

---

## Anti-Patterns to Avoid

- **Do NOT merge ManifestService and PresentationService lock maps** — they are separate services that own their own locks
- **Do NOT lock at service level** — per-presentation locks (`id` as key) are the correct granularity
- **Do NOT change public method signatures** — callers must not be affected
- **Do NOT lock `assertSafeId` or pre-manifest-path setup** — only the read-modify-write block needs the lock
- **Do NOT use `createPresentation` with an `id` arg for the test** — use a plain folder name, not a path

---

## Learnings (inherited)

- 103 server tests on main as of 2026-03-19 (sample.test.ts deleted in 93d6c75)
- All prior campaigns: pool: 'forks' required in server/vitest.config.ts for singleton isolation — already in place
- `assertSafeId` must be called before cache check in `getById` — already fixed (B034)
- Proto-pollution test uses `({} as any).polluted` assertion — already correct (B046, 93d6c75)
