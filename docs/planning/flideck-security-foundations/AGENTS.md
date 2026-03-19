# AGENTS.md — FliDeck Security Foundations

_(Inherited from flideck-harness-migration. Updated for this campaign.)_

## Project Overview

**Project**: FliDeck — local-first presentation harness for viewing folder-based HTML artifacts
**Campaign**: flideck-security-foundations — close BLOCKER security issues, fix data integrity gaps, extract ManifestService, add test coverage for core render and service paths
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest / TanStack Query

**Current state (2026-03-19):**
- 0 TypeScript errors in both workspaces
- 0 npm vulnerabilities
- 43 tests passing (17 client, 26 server)
- Two BLOCKER security issues open (B027): PID injection in cleanupPort, command injection in presentations route
- `deepMerge` has prototype pollution vulnerability in two locations
- PATCH manifest has TOCTOU race condition
- `PresentationService.ts` is 2,460 lines with 7 responsibility clusters (God class)
- `stripSlideWrapper` and `PresentationService` core paths have zero test coverage

---

## Build & Run Commands

```bash
# Install deps
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm install

# Dev (both client and server)
npm run dev

# Run all tests  (baseline: 17 client + 26 server = 43 total — must not regress)
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
│   │   ├── hooks/               # useConfig, useContainerTab, useDisplayMode, usePresentations,
│   │   │                        #   useQuickFilter, useResizableSidebar, useSocket
│   │   ├── pages/               # PresentationPage.tsx, ConfigPage.tsx
│   │   └── utils/               # displayMode.ts, sidebarOrder.ts
├── server/
│   ├── src/
│   │   ├── middleware/          # errorHandler.ts  ← asyncHandler AND AppError are both here
│   │   ├── routes/              # presentations.ts (1104 lines), config.ts, assets.ts, etc.
│   │   ├── services/            # PresentationService.ts (~2460 lines)
│   │   │                        # ManifestService.ts  ← will exist after manifest-service-extraction
│   │   ├── utils/               # manifestTemplates.ts, manifestValidator.ts, queryString.ts
│   │   │                        # responseHelper.ts  ← will exist after api-response-helper
│   │   ├── config.ts
│   │   ├── WatcherManager.ts
│   │   └── index.ts             # App entry — cleanupPort is at lines 327-336
├── shared/
│   └── src/types.ts             # ApiResponse<T> defined at line 74
└── docs/planning/
    └── flideck-security-foundations/
        ├── IMPLEMENTATION_PLAN.md
        └── AGENTS.md  ← this file
```

---

## Key File Locations (This Campaign)

| Fix | File | Line(s) |
|-----|------|---------|
| PID injection | `server/src/index.ts` | 327–336 (`cleanupPort`) |
| Command injection | `server/src/routes/presentations.ts` | 1056 (`exec(...)`) |
| deepMerge proto pollution | `server/src/services/PresentationService.ts` | 1528–1550 (private `deepMerge`) |
| deepMerge proto pollution | `server/src/routes/presentations.ts` | 1072–1095 (standalone `deepMerge`) |
| TOCTOU race | `server/src/services/PresentationService.ts` | 1496 (`patchManifest`) |
| TOCTOU route-side | `server/src/routes/presentations.ts` | 713–747 (PATCH handler) |
| ApiResponse type | `shared/src/types.ts` | 74–78 |
| ManifestService extraction source | `server/src/services/PresentationService.ts` | ~1435–2460 |

---

## Reference Patterns

### asyncHandler and AppError (same file — do not split import)

```typescript
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
```

### Vitest test — server (use real temp dir, no mocking)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('PresentationService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'flideck-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('discoverAll returns folder with presentation.html', async () => {
    await mkdir(join(tempDir, 'my-deck'));
    await writeFile(join(tempDir, 'my-deck', 'presentation.html'), '<h1>test</h1>');
    // ... exercise PresentationService
  });
});
```

### Vitest test — client (DOMParser available via jsdom)

```typescript
import { describe, it, expect } from 'vitest';
import { stripSlideWrapper } from '../stripSlideWrapper';

describe('stripSlideWrapper', () => {
  it('removes html/head/body wrapper', () => {
    const html = `<!DOCTYPE html><html><head><title>t</title></head><body><div class="slide">content</div></body></html>`;
    const result = stripSlideWrapper(html);
    expect(result.body).toContain('class="slide"');
    expect(result.body).not.toContain('<body');
  });
});
```

### Safe PID pattern (fix for cleanupPort)

```typescript
// Before killing, validate PID is a positive integer
const pids = result.trim().split('\n').filter(pid => /^\d+$/.test(pid.trim()) && Number(pid) > 0);
for (const pid of pids) {
  try { execSync(`kill -9 ${pid}`); } catch { /* already gone */ }
}
// Replace execSync('sleep 0.5') with:
await new Promise(resolve => setTimeout(resolve, 500));
// Note: cleanupPort must become async if using setTimeout
```

### execFile pattern (fix for command injection)

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

// Replace: exec(`open "${presentation.path}"`, callback)
// With:
await execFileAsync('open', [presentation.path]);
```

### createApiResponse helper (what api-response-helper should produce)

```typescript
// server/src/utils/responseHelper.ts
import type { ApiResponse } from '@flideck/shared';

export function createApiResponse<T>(data: T, context?: Record<string, unknown>): ApiResponse<T> & { _context?: Record<string, unknown> } {
  return context
    ? { success: true, data, _context: context }
    : { success: true, data };
}

export function createErrorResponse(message: string): { success: false; error: string } {
  return { success: false, error: message };
}
```

### Write mutex pattern (fix for TOCTOU)

```typescript
// In PresentationService class:
private writeLocks = new Map<string, Promise<void>>();

private async withWriteLock<T>(presentationId: string, fn: () => Promise<T>): Promise<T> {
  const current = this.writeLocks.get(presentationId) ?? Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  this.writeLocks.set(presentationId, next);
  try {
    await current;
    return await fn();
  } finally {
    resolve();
    if (this.writeLocks.get(presentationId) === next) {
      this.writeLocks.delete(presentationId);
    }
  }
}
```

### Path traversal guard (existing — do not change)

```typescript
// assertSafeId already in PresentationService — read it before writing tests for it
// It validates resolvedPath starts with resolvedRoot + path.sep
```

---

## Success Criteria

Before marking any work unit complete:

- [ ] `npm run typecheck` — 0 errors (currently 0; must stay 0)
- [ ] `npm test` — all tests pass; total must be ≥ 43 (new tests add to, never subtract from, the count)
- [ ] `npm run build` — succeeds
- [ ] For security fixes: describe the specific attack vector that is now closed
- [ ] For new test files: minimum 8 tests per file; tests must fail if you break the production code they cover (delete a behaviour and verify the test catches it)
- [ ] For manifest-service-extraction: `PresentationService.ts` line count drops by at least 800 lines; all routes continue to work; no import errors

---

## Anti-Patterns to Avoid

- **Do NOT use `any` types** — both workspaces are clean; keep them that way
- **Do NOT amend commits** — always create new commits
- **Do NOT change route handler response shapes** in this campaign — `api-response-helper` adds the helper only; route migration is B014 (next campaign)
- **Do NOT run deepMerge fixes in parallel with patch-toctou-fix** — both touch `PresentationService.ts`; deepMerge fix must land first
- **Do NOT write test-core-service before manifest-service-extraction lands** — tests should target the post-extraction class boundaries
- **Do NOT add `contentSecurityPolicy: false`** — the fix-pid-injection work unit must re-enable it; any new helmet config must keep CSP active
- **Do NOT use `exec()` with string interpolation** — always `execFile()` with argument arrays for shell commands
- **Do NOT use `for...in` on untrusted objects** — use `Object.keys()` and explicitly skip `__proto__`/`constructor`/`prototype`
- **Do NOT add console.log** — use `console.error` for errors at minimum
- **Do NOT modify test setup files** — vitest config in `*/src/test/setup.ts`

---

## Quality Gates

Non-negotiable:

1. `npm run typecheck` — 0 errors
2. `npm test` — ≥ 43 tests passing (baseline); Wave 3+4 add ≥ 16 new tests (8 client + 8 server)
3. `npm run build` — succeeds
4. For each security fix: the specific attack vector is documented in commit message

---

## Learnings

_(Inherited from flideck-harness-migration + flideck-cleanup-2026. Updated as waves complete.)_

### Architecture
- Harness migration complete — `HarnessViewer` is the only render path; `AssetViewer.tsx` deleted
- `asyncHandler` AND `AppError` are co-located in `server/src/middleware/errorHandler.ts` — not separate files
- `server/src/index.ts` does NOT export `createApp` — test service/util functions directly
- `PresentationService` has TWO deepMerge methods: `typedDeepMerge` (line 109, typed, correct) and `private deepMerge` (line 1528, unsafe `for...in`, needs fix). Only the private one is vulnerable; `typedDeepMerge` should be checked but is likely safe.

### Security
- Path traversal guard active at 26 call sites via `assertSafeId()` in `PresentationService`
- AJV validation active in `tryReadManifestFile`
- 0 npm vulnerabilities — maintain
- postMessage is no longer used (iframe removed) — no origin-check concern

### Tests
- 43 total tests: 17 client (App.test.tsx: 1, displayMode.test.ts: 16), 26 server (sample ×2, manifest.test.ts: 24)
- All existing server tests (`manifest.test.ts`) import from utils directly, not from app entry point
- Client tests run in jsdom environment — `DOMParser` is available; `stripSlideWrapper` is directly testable

### Config & Watcher
- Config watcher callback bug (fixed in cleanup-2026): watcher restart must pass callback
- `server/src/config/` directory does NOT exist — env.ts and logger.ts were deleted in cleanup-2026

### Known Build Warning (not a blocker)
- CSS @import order warning from harness.css Google Fonts declaration — pre-existing, acceptable
