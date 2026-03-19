# AGENTS.md — FliDeck (inherited from flideck-harness-migration)

## Project Overview

**Project**: FliDeck — local-first presentation harness for viewing folder-based HTML artifacts
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest / TanStack Query

**Current state (2026-03-08):**
- Harness migration complete — iframe/srcdoc rendering removed; HarnessViewer is the only rendering path
- 0 TypeScript errors in both workspaces
- 0 npm vulnerabilities
- 43 tests passing (17 client, 26 server)
- All 519 HTML files across 17 presentations migrated to v2 harness-fragment format
- 5 Type C slides remain deferred (B024) — see Known Problematic Slides below

**Presentations root**: Determined by `config.json` → `presentationsRoot`. Read this file to get the actual path.

---

## Build & Run Commands

```bash
# Install deps
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm install

# Dev (both client and server)
npm run dev

# Run all tests  (currently: 17 client + 26 server = 43 total)
npm test

# Run server tests only
cd server && npm test

# Run client tests only
cd client && npm test

# TypeScript type check (must pass with 0 errors)
npm run typecheck
# or: cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit

# Lint
npm run lint

# Build (produces CSS warning about @import order in harness.css — known, not a blocker)
npm run build
```

**Dev ports:**
- Client: `localhost:5200`
- Server: `localhost:5201`

---

## Directory Structure

```
flideck/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Header.tsx, Sidebar.tsx, SidebarFlat.tsx, SidebarGrouped.tsx
│   │   │   └── ui/              # EmptyState.tsx, LoadingSpinner.tsx, QuickFilter.tsx, TabBar.tsx
│   │   ├── harness/             # HarnessViewer.tsx, harness.css, harness-utils.ts,
│   │   │                        #   stripSlideWrapper.ts, useKeyboardBridge.ts
│   │   ├── hooks/               # useConfig.ts, useContainerTab.ts, useDisplayMode.ts,
│   │   │                        #   usePresentations.ts, useQuickFilter.ts, useResizableSidebar.ts,
│   │   │                        #   useSocket.ts
│   │   ├── pages/               # PresentationPage.tsx, ConfigPage.tsx, etc.
│   │   ├── utils/               # displayMode.ts, sidebarOrder.ts, etc.
│   │   └── test/                # App.test.tsx (1 test), vitest setup
├── server/
│   ├── src/
│   │   ├── middleware/          # asyncHandler.ts, AppError, errorHandler.ts
│   │   ├── routes/              # presentations.ts, config.ts, assets.ts, etc.
│   │   ├── services/            # PresentationService.ts (core, ~1500 lines), __tests__/manifest.test.ts
│   │   ├── utils/               # manifestTemplates.ts, manifestValidator.ts, queryString.ts, deepMerge.ts
│   │   ├── config.ts            # loadConfig(), addToHistory(), hot-reload
│   │   ├── WatcherManager.ts    # Chokidar file watching with debounce
│   │   └── index.ts             # Express app entry — does NOT export createApp
├── shared/
│   └── src/
│       └── types.ts             # Shared TypeScript types (FlideckManifest, etc.)
├── tools/
│   ├── migrate-type-a.js        # Wrapper-strip toolchain (Type A slides)
│   └── migrate-type-b.js        # JS-hoist toolchain (Type B slides)
├── playwright/
│   ├── pipeline.js              # Visual diff pipeline (--compare, --compare-all flags)
│   └── harness-shell.html       # Standalone wrapper for testing harness fragments
├── docs/
│   └── planning/
│       ├── BACKLOG.md           # Master feature register (B### IDs)
│       ├── flideck-cleanup-2026/
│       └── flideck-harness-migration/
└── config.json                  # gitignored; contains presentationsRoot path
```

---

## Reference Patterns

### Vitest test file structure (server)

```typescript
// server/src/services/__tests__/manifest.test.ts  ← real example
import { describe, it, expect } from 'vitest';
import { getTemplates, applyTemplate } from '../../utils/manifestTemplates.js';
import { validate } from '../../utils/manifestValidator.js';
import type { FlideckManifest } from '@flideck/shared';

describe('manifestTemplates', () => {
  it('returns a non-empty array of templates', () => {
    const templates = getTemplates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
  });
});
```

### Vitest test file structure (client)

```typescript
// client/src/utils/__tests__/displayMode.test.ts  ← real example
import { describe, it, expect } from 'vitest';
import { detectDisplayMode } from '../displayMode';

describe('detectDisplayMode', () => {
  it('returns flat when no groups in manifest', () => {
    expect(detectDisplayMode({})).toBe('flat');
  });
});
```

**Note**: `server/src/index.ts` does NOT export a `createApp` function. Server tests should import directly from service/util modules, not from the app entry point.

### Path traversal guard (active in PresentationService.ts)

```typescript
const resolvedPath = path.resolve(presentationPath);
const resolvedRoot = path.resolve(this.presentationsRoot);
if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
  throw new AppError(400, 'Invalid presentation ID');
}
```

### asyncHandler pattern (routes)

```typescript
// asyncHandler AND AppError are co-located in errorHandler.ts — not separate files
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

router.get('/presentations/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // ... logic
  res.json({ success: true, data: presentation, _context: { presentationsRoot } });
}));
```

### HarnessViewer usage (PresentationPage.tsx)

```tsx
import { HarnessViewer } from '../harness/HarnessViewer';

// Full prop signature: content, baseUrl, presentationMode?, viewportLock?, onNavigate?
<HarnessViewer
  content={assetContent}
  baseUrl={assetBaseUrl}
  presentationMode={isPresentationMode}   // optional, default false
  viewportLock={slide.viewportLock}       // optional, default false
  onNavigate={handleNavigate}             // optional
/>
```

---

## Mock Patterns

**Current test approach: no mocking.** All server tests (`manifest.test.ts`) test pure utility functions (manifestTemplates, manifestValidator, queryString) directly — no HTTP, no filesystem, no mocks needed. Client tests (`displayMode.test.ts`) test pure transform functions.

If a future campaign adds route-level tests, pattern for supertest:
```typescript
// Do NOT import createApp — it doesn't exist.
// Instead, test service/util functions directly, or build a minimal test app:
import express from 'express';
import { createRoutes } from '../../routes/index.js';
// ... construct a test app manually
```

If a future campaign needs to mock PresentationService in route tests:
```typescript
vi.mock('../../services/PresentationService.js', () => ({
  PresentationService: {
    getInstance: vi.fn().mockReturnValue({
      getAll: vi.fn().mockResolvedValue([]),
    }),
  },
}));
```

---

## Success Criteria

Before marking any work unit complete:

- [ ] `npm run typecheck` passes with 0 errors in affected workspace
- [ ] `npm test` passes — all 43 tests still green (no regressions)
- [ ] No new lint errors introduced
- [ ] For any new functionality: at least one test covers it
- [ ] For server changes: server starts without errors (`npm run dev`)
- [ ] For client changes: client builds without errors (`npm run build`)
- [ ] For dead code removal: `grep -r "SymbolName" src/` returns no hits before deleting

---

## Anti-Patterns to Avoid

- **Do NOT use `any` types** in TypeScript — both workspaces are clean; keep them that way
- **Do NOT amend commits** — always create new commits
- **Do NOT delete files without first verifying no imports** — grep before delete
- **Do NOT change API response shapes** without updating API docs in CLAUDE.md — response envelope is inconsistent (B014 pending); don't make it worse
- **Do NOT modify original presentation folders** — all content lives in canonical (non-v2) folders after production cleanup; originals are gone
- **Do NOT add console.log** — use console.error for errors; no debug logging in production paths
- **Do NOT modify test setup files** — vitest config is in `*/src/test/setup.ts`
- **Do NOT add Google Fonts via @import inside harness.css** — there is already a known CSS warning from this; fonts load correctly, don't add more @imports at non-first position
- **Do NOT touch Type C slides without explicit decisions** — `agent-inventory/slides.html`, `dam-overview/slides.html`, `claude-code-system-prompt*/index.html`, `consultants-plugin/architecture-slides.html` are deferred (B024); webcam + keyboard-nav conflicts must be resolved first

---

## Quality Gates

Non-negotiable before marking complete:

1. `npm run typecheck` — 0 errors (currently 0; must stay 0)
2. `npm test` — 43/43 passing (currently 43; must not regress)
3. `npm run build` — succeeds (1 known CSS warning is acceptable; new warnings are not)
4. For security-sensitive changes: describe the attack vector that is now closed

---

## Known Deferred Items (from BACKLOG.md)

| B### | Item | Priority |
|------|------|----------|
| B013 | Vite 7 upgrade: 2-line change in client/package.json (vite 6→7, plugin-react v4→v5) | low |
| B014 | API envelope standardisation: adopt `{ success: true, data: T }` across all 5 shapes | medium |
| B015 | Review 292 unchecked acceptance criteria across 34 PRD files | medium |
| B016 | Write 13 missing changelog entries (FR-16 through FR-28) | low |
| B022 | Playwright pipeline: deviant palette token injection overrides cause false-positive diffs | medium |
| B023 | bmad-poem: 2 slides fetch from localhost:4321 — server reachability strategy needed | low |
| B024 | Type C slides deferred: 5 files need explicit migration decisions | medium |
| B025 | Playwright CI integration: wire --compare-all into CI pipeline | low |

---

## Known Problematic Slides (Type C — still deferred)

| File | Problem | Status |
|------|---------|--------|
| `agent-inventory/slides.html` | Full keyboard nav + webcam overlay — competing with harness nav | DEFERRED (B024) |
| `dam-overview/slides.html` | scroll-snap teleprompter — competing nav | DEFERRED (B024) |
| `claude-code-system-prompt/index.html` | `fetch('index.json')` relative URL — base URL not resolved | DEFERRED (B024) |
| `claude-code-system-prompt-v1/index.html` | Same fetch pattern | DEFERRED (B024) |
| `consultants-plugin/architecture-slides.html` | Complex interactive — warning comment added, content intact | DEFERRED (B024) |
| `bmad-poem/story-2-5-sat-cheatsheet.html` | `fetch('http://localhost:4321/...')` — live API | DEFERRED (B023) |
| `bmad-poem/story-2-6-sat-cheatsheet.html` | Same localhost:4321 pattern | DEFERRED (B023) |

---

## Harness Architecture (Reference)

Slides are rendered via `HarnessViewer` — iframe rendering was removed in Phase 7.

**Fragment format** (produced by `tools/migrate-type-a.js` / `tools/migrate-type-b.js`):
```html
<!-- harness-fragment: type-a -->
<style>/* original styles verbatim */</style>
<div class="slide-content"><!-- original body content --></div>
```

**Harness files** (`client/src/harness/`):
- `HarnessViewer.tsx` — mounts fragment into `.harness-slide` div, re-executes scripts, manages `<base>` tag and scoped styles
- `harness.css` — canonical font stack (Bebas Neue, Oswald, Roboto, Roboto Mono) + 10 CSS token vars
- `harness-utils.ts` — `copyCommand`, `copyInline` globals injected into `window`
- `stripSlideWrapper.ts` — DOMParser-based wrapper stripping, viewport-lock auto-detection
- `useKeyboardBridge.ts` — capture-phase guard protecting Cmd+Arrow nav shortcuts

**CSS token baseline (harness-injected):**
```css
--brand-brown: #342d2d;  --brand-gold: #ccba9d;   --brand-yellow: #ffde59;
--white: #ffffff;        --brand-gray: #595959;
--doc-blue: #3b82f6;     --runtime-purple: #8b5cf6; --success-green: #22c55e;
--issue-amber: #f59e0b;  --pain-red: #ef4444;
```

**Viewport-lock**: Slides with `height: 100vh; overflow: hidden` get `.harness-slide--viewport-lock` CSS class. Auto-detected via heuristic (scroll-snap-type, overflow:hidden, height 100/95vh). `height: 100%` (no vh unit) is NOT auto-detected — requires `viewport-lock: true` in manifest.

---

## Learnings

_(Accumulated across flideck-cleanup-2026 and flideck-harness-migration)_

### Architecture
- Harness migration is complete — `HarnessViewer` is the only rendering path. `AssetViewer.tsx` was deleted.
- iframe isolation was intentional architecture; the harness is a deliberate replacement, not a workaround
- FliDeck keyboard shortcuts require Cmd/Ctrl modifier — no conflict with slide keyboard handlers using plain arrow keys. `useKeyboardBridge` is a capture-phase safety net only.
- Script injection uses DOM mutation (`container.innerHTML = body`), NOT `dangerouslySetInnerHTML` — required for post-injection script re-execution
- Base URL: `<base>` tag inserted into `document.head` on each content change; cleaned up on unmount
- Font loading: `@import` in harness.css, loaded once at app startup via index.css (causes known @import-order CSS warning in build — not a blocker)

### Config & Watcher
- Config watcher callback bug (fixed): watcher restart must pass `onPresentationChange` callback — omitting it silently breaks live reload after any API config change
- `config.ts` exports: `loadConfig()`, `addToHistory()`, `getConfigPath()` — config hot-reload is built in
- `server/src/config/` directory no longer exists (env.ts, logger.ts were dead code, deleted)

### Security
- Path traversal guard active at 26 call sites in PresentationService.ts via `assertSafeId()`
- AJV validation active in `tryReadManifestFile` — invalid disk manifests log warning and degrade gracefully
- postMessage origin validation: srcdoc iframes have `origin === 'null'` in some browsers; accept both `window.location.origin` and `'null'`
- 0 npm vulnerabilities (was 4: 2 HIGH rollup/minimatch, 1 moderate, 1 low — all cleared)

### Type System
- `displayMode: 'tabbed'` was fully removed — type union, 4 dead exports, `useActiveTab` hook, template emission all deleted
- `@flideck/shared` path alias requires `paths` mapping in both client and server tsconfigs — without it, `tsc --noEmit` fails in workspace context despite runtime resolution working
- Triple cast (`as any as T`) was replaced with `typedDeepMerge()` private method

### Tests & Quality
- 43 total tests: 17 client (App.test.tsx: 1, displayMode.test.ts: 16), 26 server (sample ×2, manifest.test.ts: 24)
- Server tests (manifest.test.ts) cover: manifestTemplates, queryString, manifestValidator — all pure functions, no mocking needed
- `server/src/index.ts` does NOT export `createApp` or any testable function — route tests must import service/util modules directly

### Migration Toolchain (for B024 / future Type C work)
- 91% of slides were Type A — mechanical toolchain handles the vast majority
- Asset copy is required in both migrate-type-a.js and migrate-type-b.js — without copying PNGs/SVGs, image-heavy slides fail at 80-87% pixel diff
- **Pipeline false positives**: Many slides use CSS tokens (--pain-red, --doc-blue etc.) not defined in their own :root — they relied on rendering context. `screenshotWithTokens()` in pipeline.js injects harness tokens into original screenshots before diffing; without this, 16-25% false-positive diffs appear
- Residual diffs (1-2%): long text-heavy slides show ~1.87% after token fix — font anti-aliasing from @import vs `<link>` difference. Not a migration issue — classify as "review" quality.
- Viewport-lock pixel diffs (5-11%) are expected for arcade/fullscreen slides with fixed dimensions — content is correct; accept as manual-review; they need `viewport-lock: true` manifest flag
- Deviant palettes (consultants-plugin: --brand-brown/#3E2723, --brand-gold/#B8860B; n8n-story-gen) are intentional — do NOT normalise them
- `height: 100%` (no vh unit) is NOT auto-detected by viewport-lock heuristic — claudemas-12-days and deck-systems-arcade slides needed explicit manifest flag
- bmad-poem (64% of corpus) is 95% pure HTML/CSS — high volume, low complexity
- Playwright pipeline: `node pipeline.js --compare [name]` compares `[name]` vs `[name]-v2`; `--compare-all` runs all 540 slides

### Known Vite Warning (not a blocker)
- Build emits: `@import rules must precede all rules aside from @charset and @layer` in harness.css — caused by Google Fonts @import position relative to :root CSS vars. Build succeeds; fonts load correctly. Fix is B013 (Vite 7 upgrade) or a future harness.css restructure.
