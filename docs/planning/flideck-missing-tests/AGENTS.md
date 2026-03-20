# AGENTS.md — FliDeck Missing Tests

## Project Overview

**Project**: FliDeck — local-first presentation harness (React 19 + Vite 7 + Express 5)
**Campaign**: flideck-missing-tests — unit tests for 3 untested production code paths
**Stack**: Express 5 + Vitest + TypeScript (server only — no source code changes)

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
│   ├── PresentationService.ts          # READ ONLY — understand the methods
│   ├── ManifestService.ts              # READ ONLY — understand syncFromIndex
│   └── __tests__/
│       ├── PresentationService.test.ts # Agent A edits this (B049 + B051)
│       └── ManifestService.test.ts     # Agent B edits this (B050)
```

---

## Test Infrastructure (both agents)

```typescript
// Standard test setup in both files:
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
```

**ManifestService** methods are proxied through PresentationService — call `service.syncFromIndex(...)`, `service.bulkAddSlides(...)`, etc. on the PresentationService instance.

---

## Work Unit A: ps-tests (B049 + B051)

**File**: `server/src/services/__tests__/PresentationService.test.ts`

No source code changes. Add two new `describe` blocks.

---

### B049 — applySlideMetadata field propagation

`applySlideMetadata` is private — test it through `service.getById(id)`. When a manifest has a `slides` array with metadata fields, the returned `Presentation.assets` array should carry those values on the `Asset` objects.

Read `PresentationService.ts` lines 403–444 to see exactly which fields are mapped:
- `slide.title` → `asset.name` AND `asset.title`
- `slide.group` → `asset.group`
- `slide.description` → `asset.description`
- `slide.recommended` → `asset.recommended`
- `slide.viewportLock` → `asset.viewportLock`

**Setup**: Create a folder with a `presentation.html` entry point and two additional slide HTML files. Write an `index.json` manifest with a `slides` array containing metadata fields. Call `service.getById(id)` and inspect `presentation.assets`.

```typescript
describe('applySlideMetadata()', () => {
  it('applies title to both asset.name and asset.title', async () => { ... });
  it('applies group to asset.group', async () => { ... });
  it('applies description to asset.description', async () => { ... });
  it('applies recommended to asset.recommended', async () => { ... });
  it('applies viewportLock to asset.viewportLock', async () => { ... });
  it('orders assets by manifest slides array order', async () => { ... });
  it('appends slides not in manifest at end (remaining assets)', async () => { ... });
});
```

**Example setup**:
```typescript
const deckPath = join(tempDir, 'meta-deck');
await mkdir(deckPath);
await writeFile(join(deckPath, 'presentation.html'), '<h1>entry</h1>');
await writeFile(join(deckPath, 'slide-a.html'), '<h1>a</h1>');
await writeFile(join(deckPath, 'slide-b.html'), '<h1>b</h1>');
await writeFile(join(deckPath, 'index.json'), JSON.stringify({
  slides: [
    {
      file: 'slide-a.html',
      title: 'Slide A Title',
      group: 'intro',
      description: 'First slide',
      recommended: true,
      viewportLock: true,
    },
    { file: 'slide-b.html' },
  ]
}, null, 2));

const presentation = await service.getById('meta-deck');
const slideA = presentation!.assets.find(a => a.filename === 'slide-a.html')!;
```

---

### B051 — removeSlide, updateSlide, deleteGroup cascade

Read the source implementations before writing tests:
- `removeSlide` (PresentationService.ts ~line 819)
- `updateSlide` (PresentationService.ts ~line 746) — already has concurrent tests; add basic functional tests
- `deleteGroup` (PresentationService.ts ~line 1023)

**removeSlide** tests:
```typescript
describe('removeSlide()', () => {
  it('removes the slide from the manifest', async () => { ... });
  it('accepts slideId without .html extension', async () => { ... });
  it('throws when slide not found', async () => { ... });
  it('throws when presentation not found', async () => { ... });
});
```

**updateSlide** tests (functional, not concurrent):
```typescript
describe('updateSlide() — field updates', () => {
  it('updates title field', async () => { ... });
  it('updates group field', async () => { ... });
  it('clears title when empty string passed', async () => { ... });
  it('throws when slide not found', async () => { ... });
});
```

**deleteGroup** tests:
```typescript
describe('deleteGroup()', () => {
  it('removes the group from manifest.groups', async () => { ... });
  it('clears group field from slides that were in the deleted group', async () => { ... });
  it('leaves slides from other groups unaffected', async () => { ... });
  it('renumbers remaining groups to fill gaps in order values', async () => { ... });
  it('throws when group not found', async () => { ... });
});
```

**Example deleteGroup setup**:
```typescript
const deckPath = join(tempDir, 'group-deck');
await mkdir(deckPath);
await writeFile(join(deckPath, 'presentation.html'), '<h1>entry</h1>');
await writeFile(join(deckPath, 'index.json'), JSON.stringify({
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
}, null, 2));

await service.deleteGroup('group-deck', 'group-b');

const manifest = JSON.parse(await readFile(join(deckPath, 'index.json'), 'utf-8'));
// group-b is gone
expect(manifest.groups).not.toHaveProperty('group-b');
// slide-2 has no group
expect(manifest.slides[1].group).toBeUndefined();
// other slides unaffected
expect(manifest.slides[0].group).toBe('group-a');
// groups renumbered: group-a=1, group-c=2
expect(manifest.groups['group-a'].order).toBe(1);
expect(manifest.groups['group-c'].order).toBe(2);
```

---

## Work Unit B: sync-from-index-tests (B050)

**File**: `server/src/services/__tests__/ManifestService.test.ts`

No source code changes. Add a `describe('syncFromIndex()')` block.

Read `ManifestService.ts` lines 768–991 carefully before writing any tests to understand the full logic.

Key behaviours to cover:

### Flat presentation (no tabbed index files)

```typescript
describe('syncFromIndex()', () => {
  it('detects flat format when no index-tab-*.html files present', async () => { ... });
  it('adds all HTML files as slides with merge strategy (default)', async () => { ... });
  it('replace strategy starts fresh, discarding existing manifest', async () => { ... });
  it('preserves existing slide metadata on merge strategy', async () => { ... });
});
```

**Setup for flat**:
```typescript
const deckPath = join(tempDir, 'flat-deck');
await mkdir(deckPath);
await writeFile(join(deckPath, 'presentation.html'), '<h1>entry</h1>');
await writeFile(join(deckPath, 'slide-a.html'), '<h1>slide a</h1>');
await writeFile(join(deckPath, 'slide-b.html'), '<h1>slide b</h1>');
await writeFile(join(deckPath, 'index.json'), JSON.stringify({}, null, 2));

const result = await service.syncFromIndex('flat-deck');
expect(result.format).toBe('flat');
const manifest = JSON.parse(await readFile(join(deckPath, 'index.json'), 'utf-8'));
const files = manifest.slides.map((s: { file: string }) => s.file);
expect(files).toContain('presentation.html');
expect(files).toContain('slide-a.html');
```

### Tabbed presentation (index-tab-*.html files present)

```typescript
it('detects tabbed format when index-tab-*.html files present', async () => { ... });
it('creates tab groups from index-tab-*.html filenames', async () => { ... });
```

**Setup for tabbed** (read ManifestService.ts lines 804–970 to understand card detection):
```typescript
const deckPath = join(tempDir, 'tabbed-deck');
await mkdir(deckPath);
// index-tab-intro.html and index-tab-main.html trigger tabbed format
await writeFile(join(deckPath, 'index-tab-intro.html'), '<h1>intro tab</h1>');
await writeFile(join(deckPath, 'index-tab-main.html'), '<h1>main tab</h1>');
await writeFile(join(deckPath, 'slide-a.html'), '<h1>slide a</h1>');
await writeFile(join(deckPath, 'index.json'), JSON.stringify({}, null, 2));

const result = await service.syncFromIndex('tabbed-deck');
expect(result.format).toBe('tabbed');
```

### inferTitles option (reads `<title>` from HTML)

```typescript
it('infers title from <title> tag when inferTitles: true', async () => {
  // Write HTML with a <title> tag
  await writeFile(join(deckPath, 'slide-a.html'), '<html><head><title>My Slide</title></head></html>');
  const result = await service.syncFromIndex('deck', { inferTitles: true });
  // Check manifest slide has title: 'My Slide'
});
```

### Replace vs merge strategy

```typescript
it('replace strategy discards existing manifest content', async () => {
  // Write manifest with existing slide + group
  // Call syncFromIndex with strategy: 'replace'
  // Existing group should be gone, only filesystem files present
});
```

---

## Success Criteria

- [ ] B049: 7+ tests covering all 5 metadata fields + ordering + remaining-assets fallback
- [ ] B051: 13+ tests covering removeSlide (4), updateSlide (4), deleteGroup (5)
- [ ] B050: 8+ tests covering flat/tabbed detection, merge/replace, inferTitles
- [ ] `cd server && npm test` passes — count must be ≥ 135 (107 + ~28 new)
- [ ] `cd server && npx tsc --noEmit` exits 0
- [ ] No source code changes — tests only

---

## Anti-Patterns to Avoid

- **Do NOT test private methods directly** — test `applySlideMetadata` through `service.getById()`
- **Do NOT modify source files** — tests only
- **Do NOT add `any` types** — use proper types from `@flideck/shared` or inline interfaces
- **Do NOT test happy path only** — include at least one error/not-found case per method
- **Do NOT rely on file creation order** for ordering tests — use manifest `slides` array to control order explicitly

---

## Learnings (inherited)

- 107 server tests on main as of 2026-03-20
- ManifestService is tested through PresentationService — call `service.syncFromIndex(...)` not a raw ManifestService instance
- `_resetWriteLocks()` already called in both test file `beforeEach` blocks
- `pool: 'forks'` already in server/vitest.config.ts — singleton isolation handled
- Use `JSON.parse(await readFile(...))` to read written manifests in tests
