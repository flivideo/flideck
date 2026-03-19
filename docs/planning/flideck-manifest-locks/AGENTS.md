# AGENTS.md — FliDeck Manifest Locks

## Project Overview

**Project**: FliDeck — local-first presentation harness (React 19 + Vite 7 + Express 5)
**Campaign**: flideck-manifest-locks — lock 6 unguarded ManifestService write methods; concurrent tests; test-hygiene reset method
**Stack**: Express 5 + Vitest + TypeScript (server only)

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck

# Run all tests
npm test

# Server tests only
cd server && npm test
```

---

## Directory Structure

```
flideck/server/src/
├── services/
│   ├── ManifestService.ts              # Agent A edits this
│   ├── PresentationService.ts          # Agent B edits this
│   └── __tests__/
│       ├── ManifestService.test.ts     # Agent B edits this (beforeEach only)
│       └── PresentationService.test.ts # Agent B edits this (tests + beforeEach)
```

---

## Work Unit A: lock-manifest-service (B052 + B054a)

**File**: `server/src/services/ManifestService.ts`

### Part 1 — Wrap 6 unguarded write methods in `withWriteLock`

The `withWriteLock` private method already exists at lines 101–117. The `writeManifest` private helper already exists at lines 92–95. Only `patchManifest` currently uses the lock (line 243). The other 6 write methods do not.

**The 6 methods to wrap:**

#### 1. `setManifest` (around line 204)

Current shape:
```
assertSafeId / pathExists check
// Update timestamp
await this.writeManifest(folderPath, manifest);
this.invalidateCache(presentationId);
```

Wrap **only the write + invalidate** — no read to include:
```typescript
await this.withWriteLock(presentationId, async () => {
  await this.writeManifest(folderPath, manifest);
  this.invalidateCache(presentationId);
});
```

#### 2. `bulkAddSlides` (around line 287)

Current shape: reads manifest at ~line 319, long processing loop, writes at ~line 428, returns result.

Wrap from the read to the return — the method returns a result object so use `return await`:
```typescript
return await this.withWriteLock(presentationId, async () => {
  let manifest = await this.readManifest(folderPath);
  if (!manifest) { manifest = { slides: [] }; }
  // ... all existing slide processing logic ...
  await this.writeManifest(folderPath, manifest);
  this.invalidateCache(presentationId);
  return result;
});
```

#### 3. `bulkAddGroups` (around line 443)

Same pattern as `bulkAddSlides` — reads at ~line 464, writes at ~line 509, returns result:
```typescript
return await this.withWriteLock(presentationId, async () => {
  let manifest = await this.readManifest(folderPath);
  // ... processing ...
  await this.writeManifest(folderPath, manifest);
  this.invalidateCache(presentationId);
  return result;
});
```

#### 4. `syncManifest` (around line 524)

Has a `readdir` call (~line 541) **before** the `readManifest` call (~line 547). Keep `readdir` outside the lock (read-only scan), wrap from `readManifest` onwards:
```typescript
// readdir stays here — outside the lock
const entries = await fs.readdir(folderPath, { withFileTypes: true });
// ... htmlFiles setup ...

const strategy = options.strategy || 'merge';

await this.withWriteLock(presentationId, async () => {
  let manifest = await this.readManifest(folderPath);
  // ... all the merge/replace logic using htmlFiles ...
  await this.writeManifest(folderPath, manifest);
  this.invalidateCache(presentationId);
});
```

#### 5. `applyTemplate` (around line 725)

Reads at ~line 739, writes at ~line 749. Wrap the read-modify-write:
```typescript
await this.withWriteLock(presentationId, async () => {
  const currentManifest = await this.readManifest(folderPath);
  const newManifest = applyManifestTemplate(currentManifest, template, merge);
  if (!newManifest.meta) newManifest.meta = {};
  newManifest.meta.updated = new Date().toISOString().split('T')[0];
  await this.writeManifest(folderPath, newManifest);
  this.invalidateCache(presentationId);
});
```

#### 6. `syncFromIndex` (around line 768)

Has `readdir` and HTML file scanning before the `readManifest` call (~line 814). Keep the filesystem discovery outside the lock, wrap from `readManifest` onwards. The method returns `SyncFromIndexResponse`, so use `return await`:
```typescript
// readdir, htmlFiles scanning, isTabbed detection stay outside the lock
const entries = await fs.readdir(folderPath, { withFileTypes: true });
// ... all the file discovery and result init ...

return await this.withWriteLock(presentationId, async () => {
  let manifest: FlideckManifest;
  if (strategy === 'replace') {
    manifest = { groups: {}, slides: [], tabs: [] };
  } else {
    manifest = (await this.readManifest(folderPath)) || { groups: {}, slides: [], tabs: [] };
    // ...
  }
  // ... all existing processing ...
  await this.writeManifest(folderPath, finalManifest);
  this.invalidateCache(presentationId);
  return result;
});
```

### Part 2 — Add `_resetWriteLocks()` to ManifestService

Add this public method to the ManifestService class (place it near the bottom of the class, before private helpers):

```typescript
/**
 * Clears all pending write locks. For use in tests only.
 * Prevents stale lock state from leaking between test cases.
 */
_resetWriteLocks(): void {
  this.writeLocks.clear();
}
```

### Verification

After changes:
```bash
grep -n "withWriteLock\|writeManifest" server/src/services/ManifestService.ts
```
Every `writeManifest` call should be inside a `withWriteLock` callback (indented further). Count: 7 `withWriteLock` usages (1 declaration + `patchManifest` existing + 6 new).

---

## Work Unit B: concurrent-tests-and-reset (B053 + B054b)

**Files**: `PresentationService.ts`, `PresentationService.test.ts`, `ManifestService.test.ts`

### Part 1 — Add `_resetWriteLocks()` to PresentationService

Edit `server/src/services/PresentationService.ts`. Add the same method as ManifestService (place near other public non-core methods):

```typescript
/**
 * Clears all pending write locks. For use in tests only.
 * Prevents stale lock state from leaking between test cases.
 */
_resetWriteLocks(): void {
  this.writeLocks.clear();
}
```

### Part 2 — Update `beforeEach` in both test files

**PresentationService.test.ts** — find the `beforeEach` block (around line 16) and add the reset call:
```typescript
beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'flideck-test-'));
  service = PresentationService.getInstance();
  service.setRoot(tempDir);
  service._resetWriteLocks();   // ← add this line
});
```

**ManifestService.test.ts** — find the `beforeEach` block (around line 15–25) and add the reset call after service creation:
```typescript
beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'flideck-ms-test-'));
  service = new ManifestService(
    (id) => join(tempDir, id),
    () => {}
  );
  service._resetWriteLocks();   // ← add this line
});
```

### Part 3 — Add 3 concurrent tests to PresentationService.test.ts

Add a new `describe('concurrent write lock — additional methods')` block after the existing concurrent addSlide test. Use the same additive proof pattern: two calls, different data, both must survive.

#### Test 1: `createGroup` concurrent

```typescript
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
```

#### Test 2: `updateSlide` concurrent field updates

```typescript
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
```

#### Test 3: `deleteTab` + `addSlide` concurrent

```typescript
it('deleteTab cascade and addSlide complete without error or corruption', async () => {
  const deckPath = join(tempDir, 'concurrent-deletetab-deck');
  await mkdir(deckPath);
  await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');

  // Set up a manifest with a tab, a group under it, a slide in that group,
  // and a separate "safe" group not under the tab
  const initialManifest = {
    tabs: [{ id: 'tab-a', label: 'Tab A', order: 1 }],
    groups: {
      'group-under-tab': { label: 'Under Tab', order: 1, tab: 'tab-a' },
      'safe-group': { label: 'Safe', order: 2 },
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
  // The new slide must always be present regardless of operation order
  const files = manifest.slides.map((s: { file: string }) => s.file);
  expect(files).toContain('new-slide.html');
  // The manifest must be parseable (not corrupted)
  expect(Array.isArray(manifest.slides)).toBe(true);
});
```

---

## Success Criteria

- [ ] All 6 ManifestService write methods wrapped in `withWriteLock` — verified with `grep -n "writeManifest" ManifestService.ts` (every call indented inside lock)
- [ ] `_resetWriteLocks()` added to ManifestService and PresentationService
- [ ] `service._resetWriteLocks()` called in `beforeEach` of both test files
- [ ] 3 new concurrent tests pass in PresentationService.test.ts
- [ ] `cd server && npm test` passes — count must be ≥ 107 (104 + 3 new)
- [ ] TypeScript: `cd server && npx tsc --noEmit` exits 0

---

## Reference Implementation

- `ManifestService.ts` lines 101–117: `withWriteLock` method (already exists — do NOT rewrite it)
- `ManifestService.ts` lines 243–271: `patchManifest` with lock (the reference for wrapping)
- `ManifestService.test.ts` lines 166–196: reference concurrent test (patchManifest)
- `PresentationService.test.ts` (existing concurrent addSlide test): reference for new tests

---

## Anti-Patterns to Avoid

- **Do NOT rewrite `withWriteLock`** — it already exists in ManifestService; just apply it
- **Do NOT merge the two lock maps** — ManifestService and PresentationService keep separate maps
- **Do NOT wrap `assertSafeId` or `fs.pathExists` checks** — only the read-modify-write block
- **Do NOT wrap `readdir` in syncManifest or syncFromIndex** — keep filesystem scans outside the lock; only the manifest read-modify-write needs serialising
- **Methods with return values must use `return await this.withWriteLock(...)`** — not just `await`
- **Do NOT add `any` types**

---

## Learnings (inherited)

- 104 server tests on main as of 2026-03-19
- pool: 'forks' already in server/vitest.config.ts — singleton isolation handled
- PresentationService uses fs.writeJson directly; ManifestService uses private `writeManifest()` helper — different call sites, same principle
- Concurrent test proof: additive operations with distinct keys are the cleanest proof shape (not overwrites)
