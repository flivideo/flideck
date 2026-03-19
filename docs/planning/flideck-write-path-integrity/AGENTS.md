# AGENTS.md — FliDeck Write-Path Integrity

_(Inherited from flideck-security-foundations. Updated for this campaign.)_

## Project Overview

**Project**: FliDeck — local-first presentation harness for viewing folder-based HTML artifacts
**Campaign**: flideck-write-path-integrity — close assertSafeId cache-bypass, add ManifestService + PresentationService write-path test coverage
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest / TanStack Query

**Current state (2026-03-19, entering this campaign):**
- 0 TypeScript errors in both workspaces
- 0 npm vulnerabilities
- 79 tests passing (35 client, 44 server) — baseline must not regress
- `assertSafeId` is called after the cache check in `getById` — traversal blocked on cache miss but not cache hit
- ManifestService write pipeline (patchManifest, bulkAddSlides, syncFromIndex, deepMerge) has zero test coverage
- PresentationService write-path (addSlide, deleteTab cascade, saveAssetOrder slides-format branch) has zero test coverage

---

## Build & Run Commands

```bash
# Install deps
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm install

# Dev (both client and server)
npm run dev

# Run all tests (baseline: 35 client + 44 server = 79 total — must not regress)
npm test

# Run server tests only
cd server && npm test

# Run client tests only
cd client && npm test

# TypeScript type check (must pass with 0 errors)
npm run typecheck

# Lint
npm run lint

# Build (1 known CSS @import warning in harness.css — acceptable, not a blocker)
npm run build
```

**Dev ports:** Client `localhost:5200`, Server `localhost:5201`

---

## Directory Structure

```
flideck/
├── client/
│   ├── src/
│   │   ├── components/layout/   # Header.tsx, Sidebar.tsx, SidebarFlat.tsx, SidebarGrouped.tsx
│   │   ├── components/ui/       # EmptyState.tsx, LoadingSpinner.tsx, QuickFilter.tsx, TabBar.tsx
│   │   ├── harness/             # HarnessViewer.tsx, harness.css, harness-utils.ts,
│   │   │                        #   stripSlideWrapper.ts, useKeyboardBridge.ts
│   │   │   └── __tests__/       # stripSlideWrapper.test.ts (18 tests — DO NOT MODIFY)
│   │   ├── hooks/               # useConfig, useContainerTab, useDisplayMode, usePresentations,
│   │   │                        #   useQuickFilter, useResizableSidebar, useSocket
│   │   ├── pages/               # PresentationPage.tsx, ConfigPage.tsx
│   │   └── utils/               # displayMode.ts, sidebarOrder.ts
├── server/
│   ├── src/
│   │   ├── middleware/          # errorHandler.ts  ← asyncHandler AND AppError are BOTH here
│   │   ├── routes/              # presentations.ts (1047 lines), config.ts, assets.ts, etc.
│   │   ├── services/
│   │   │   ├── PresentationService.ts  (1504 lines — singleton, EventEmitter)
│   │   │   ├── ManifestService.ts      (1164 lines — injected into PresentationService)
│   │   │   └── __tests__/
│   │   │       ├── PresentationService.test.ts  (250 lines, 18 tests — APPEND new tests here)
│   │   │       └── ManifestService.test.ts      ← CREATE THIS FILE (does not exist yet)
│   │   ├── utils/               # manifestTemplates.ts, manifestValidator.ts, queryString.ts
│   │   │                        # responseHelper.ts  ← createApiResponse<T> helper (unused by routes yet)
│   │   ├── config.ts
│   │   ├── WatcherManager.ts
│   │   └── index.ts
├── shared/
│   └── src/types.ts             # ApiResponse<T> defined at line 74
└── docs/planning/
    └── flideck-write-path-integrity/
        ├── IMPLEMENTATION_PLAN.md
        └── AGENTS.md  ← this file
```

---

## Key Method Locations (This Campaign)

| Work | File | Location |
|------|------|----------|
| assertSafeId fix | `server/src/services/PresentationService.ts` | `getById` lines 210–233; move assertSafeId before cache check |
| ManifestService.getManifest | `server/src/services/ManifestService.ts` | line 184 |
| ManifestService.patchManifest | `server/src/services/ManifestService.ts` | lines 234–272 (uses withWriteLock) |
| ManifestService.bulkAddSlides | `server/src/services/ManifestService.ts` | lines 287–434 (conflict resolution: skip/replace/rename) |
| ManifestService.deepMerge (private) | `server/src/services/ManifestService.ts` | lines 137–170 (Object.keys + proto guard) |
| ManifestService.withWriteLock (private) | `server/src/services/ManifestService.ts` | lines 101–117 |
| PresentationService.addSlide | `server/src/services/PresentationService.ts` | lines 643–706 |
| PresentationService.saveAssetOrder | `server/src/services/PresentationService.ts` | lines 474–489 (has legacy + slides-format branch) |
| PresentationService.deleteTab | `server/src/services/PresentationService.ts` | lines ~1188+ |
| Existing test file | `server/src/services/__tests__/PresentationService.test.ts` | 250 lines — read before adding tests |

---

## Reference Patterns

### asyncHandler and AppError (same file — always import together)

```typescript
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
```

### Vitest test — server (use real temp dir, no mocking)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ManifestService', () => {
  let tempDir: string;
  let service: ManifestService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'flideck-test-'));
    // ManifestService needs presentationsRoot + assertSafeId
    // Get it via PresentationService.getInstance() and setRoot()
    // OR instantiate ManifestService directly if it has its own constructor
    // READ ManifestService.ts constructor before writing this — do not guess
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });
});
```

### How ManifestService is accessed (important — read before writing tests)

ManifestService is instantiated inside PresentationService. Before writing tests, READ:
- `PresentationService.ts` lines 50–70 to understand how `manifestService` is created and whether it can be accessed directly
- `ManifestService.ts` constructor to understand if it can be instantiated standalone

If ManifestService can only be reached via PresentationService, use:
```typescript
const ps = PresentationService.getInstance();
ps.setRoot(tempDir);
// then call ps.patchManifest(), ps.bulkAddSlides() etc. — these delegate to manifestService
```

### Proto-pollution guard test pattern

```typescript
it('patchManifest with __proto__ key does not pollute Object.prototype', async () => {
  // Create a presentation folder
  await mkdir(join(tempDir, 'my-deck'));
  await writeFile(join(tempDir, 'my-deck', 'presentation.html'), '<h1>test</h1>');
  service.setRoot(tempDir);

  // PATCH with a payload containing __proto__
  await service.patchManifest('my-deck', {
    '__proto__': { polluted: true }
  } as unknown as Partial<FlideckManifest>);

  // Object.prototype must not be polluted
  expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
});
```

### Legacy manifest migration test pattern (for addSlide)

```typescript
it('addSlide migrates legacy assets.order manifest to slides array', async () => {
  await mkdir(join(tempDir, 'my-deck'));
  await writeFile(join(tempDir, 'my-deck', 'presentation.html'), '<h1>main</h1>');
  await writeFile(join(tempDir, 'my-deck', 'slide-a.html'), '<h1>a</h1>');
  // Write a LEGACY manifest (assets.order format)
  await writeFile(
    join(tempDir, 'my-deck', 'index.json'),
    JSON.stringify({ assets: { order: ['presentation.html', 'slide-a.html'] } })
  );
  service.setRoot(tempDir);

  await service.addSlide('my-deck', { file: 'slide-b.html', title: 'B' });

  const manifest = JSON.parse(await readFile(join(tempDir, 'my-deck', 'index.json'), 'utf-8'));
  // After addSlide, should use slides array format
  expect(Array.isArray(manifest.slides)).toBe(true);
  expect(manifest.slides.some((s: { file: string }) => s.file === 'slide-b.html')).toBe(true);
});
```

### assertSafeId cache-bypass test pattern

```typescript
it('getById blocks traversal even when cache is warm', async () => {
  // First, warm the cache with a valid presentation
  await mkdir(join(tempDir, 'valid-deck'));
  await writeFile(join(tempDir, 'valid-deck', 'presentation.html'), '<h1>test</h1>');
  service.setRoot(tempDir);
  await service.getById('valid-deck'); // warms cache

  // Now request a traversal ID — should still throw AppError 400
  await expect(service.getById('../etc/passwd')).rejects.toMatchObject({ statusCode: 400 });
});
```

### Path traversal guard (existing — call is being moved, not changed)

```typescript
// assertSafeId validates resolvedPath starts with resolvedRoot + path.sep
// Moving it BEFORE the cache check in getById is the fix
// Current code (to change):
async getById(id: string): Promise<Presentation | null> {
  if (this.cache.has(id)) { return this.cache.get(id)!; }  // ← traversal bypasses here
  const folderPath = path.join(this.presentationsRoot, id);
  this.assertSafeId(folderPath);  // ← should be BEFORE the cache check
  ...
}
// Fixed code:
async getById(id: string): Promise<Presentation | null> {
  const folderPath = path.join(this.presentationsRoot, id);
  this.assertSafeId(folderPath);  // ← runs first, always
  if (this.cache.has(id)) { return this.cache.get(id)!; }
  ...
}
```

---

## Success Criteria

Before marking any work unit complete:

- [ ] `npm run typecheck` — 0 errors (currently 0; must stay 0)
- [ ] `npm test` — all tests pass; total must be ≥ 107 (79 baseline + 28 new minimum)
- [ ] `npm run build` — succeeds
- [ ] For fix-assertsafeid-cache: include a warm-cache traversal test confirming the fix works
- [ ] For test-manifest-service: minimum 12 tests; `ManifestService.test.ts` is a NEW file
- [ ] For test-write-path: minimum 8 NEW tests APPENDED to existing `PresentationService.test.ts`; do NOT rewrite existing tests
- [ ] Every new test must fail if you delete the production code behaviour it covers (mutation test: delete a line and verify test catches it)

---

## Anti-Patterns to Avoid

- **Do NOT use `any` types** — both workspaces are clean; keep them that way
- **Do NOT amend commits** — always create new commits
- **Do NOT rewrite existing tests** in `PresentationService.test.ts` — append only
- **Do NOT mock the filesystem** — use real temp directories via `mkdtemp`; mocked tests gave false confidence in prior campaigns
- **Do NOT guess ManifestService constructor** — read the file before writing tests; the singleton/injection pattern matters
- **Do NOT use `for...in` on untrusted objects** — use `Object.keys()` (only relevant if adding new merge logic)
- **Do NOT add console.log** — use `console.error` for errors at minimum
- **Do NOT modify `client/` files** in this campaign — all work is server-side

---

## Quality Gates

Non-negotiable:

1. `npm run typecheck` — 0 errors
2. `npm test` — ≥ 107 tests passing (79 baseline + 28 new); the 1 pre-existing dist artifact failure is acceptable (it was failing before this campaign)
3. `npm run build` — succeeds
4. For fix-assertsafeid-cache: a test with a WARM cache must confirm traversal is blocked

---

## Learnings

_(Inherited from flideck-harness-migration + flideck-cleanup-2026 + flideck-security-foundations. Updated as waves complete.)_

### Architecture
- Harness migration complete — `HarnessViewer` is the only render path; `AssetViewer.tsx` deleted
- `asyncHandler` AND `AppError` are co-located in `server/src/middleware/errorHandler.ts` — not separate files
- `server/src/index.ts` does NOT export `createApp` — test service/util functions directly
- ManifestService is a separate class injected into PresentationService — it is NOT a singleton on its own; access via `PresentationService.getInstance()` or check its constructor
- ManifestService public API: `getManifest`, `setManifest`, `patchManifest`, `bulkAddSlides`, `bulkAddGroups`, `syncManifest`, `validateManifest`, `applyTemplate`, `syncFromIndex`
- deepMerge is PRIVATE in ManifestService — test it indirectly via patchManifest
- withWriteLock is PRIVATE in ManifestService — test its effect via concurrent patchManifest calls

### Security
- Path traversal guard active via `assertSafeId()` — but currently skipped on cache hit in `getById`; this campaign fixes that
- 0 npm vulnerabilities — maintain
- CSP now active (re-enabled in security-foundations)

### Tests
- 79 total tests: 35 client (App: 1, displayMode: 16, stripSlideWrapper: 18), 44 server (sample×3, manifest.ts: 24, PresentationService.test.ts: 17)
- PresentationService is a singleton — call `service.setRoot(tempDir)` in `beforeEach` to reset root; cache clears on setRoot
- All server tests use real temp directories — NO mocking
- `manifest.test.ts` tests pure utility functions (templates, validator, queryString) — do not conflict with new ManifestService tests
- The dist/ artifact failure (`dist/server/src/services/__tests__/manifest.test.js`) is pre-existing and acceptable

### Config & Watcher
- Config watcher callback bug (fixed in cleanup-2026): watcher restart must pass callback
- `server/src/config/` directory does NOT exist — env.ts and logger.ts were deleted in cleanup-2026

### Known Build Warning (not a blocker)
- CSS @import order warning from harness.css Google Fonts declaration — pre-existing, acceptable
