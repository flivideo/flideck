# AGENTS.md — FliDeck Cleanup 2026

## Project Overview

**Project**: FliDeck — local-first presentation harness for viewing folder-based HTML artifacts
**Campaign**: flideck-cleanup-2026 — technical debt cleanup after 6 weeks of rapid feature development
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest / TanStack Query

## Build & Run Commands

```bash
# Install deps
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm install

# Dev (both client and server)
npm run dev

# Run all tests
npm test

# Run server tests only
cd server && npm test

# Run client tests only
cd client && npm test

# TypeScript type check
npm run typecheck   # or: cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build
```

## Directory Structure

```
flideck/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Sidebar, Header, layout components
│   │   │   └── ui/              # AssetViewer, QuickFilter, etc.
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # PresentationPage, ConfigPage, etc.
│   │   ├── utils/               # displayMode.ts, etc.
│   │   └── test/                # test setup
│   └── src/test/
├── server/
│   ├── src/
│   │   ├── config/              # env.ts (dead), logger.ts (dead), index.ts
│   │   ├── middleware/          # asyncHandler, AppError
│   │   ├── routes/              # presentations.ts, config.ts, assets.ts, etc.
│   │   ├── services/            # PresentationService.ts (1500+ lines)
│   │   ├── utils/               # manifestTemplates.ts, deepMerge, etc.
│   │   └── WatcherManager.ts   # Chokidar file watching
│   └── test/
└── shared/
    └── src/
        └── types.ts             # Shared TypeScript types
```

## Key Files for This Campaign

| File | Role | Issues |
|------|------|--------|
| `server/src/config/env.ts` | Zod env validation | Never imported — dead code |
| `server/src/config/logger.ts` | Pino logger | Never imported — dead code |
| `client/src/components/layout/Sidebar.old.tsx` | Old sidebar | 1071 lines, never imported — dead code |
| `client/src/hooks/useModifierKey.ts` | Modifier key hook | Never imported — dead code |
| `server/src/routes/config.ts` | Config API | Critical bug: watcher restarts without callback |
| `client/src/pages/PresentationPage.tsx` | Main page | postMessage accepts any origin |
| `client/src/components/ui/AssetViewer.tsx` | iframe renderer | Case-sensitive `<head>` match |
| `shared/src/types.ts` | Shared types | Dead `displayMode: 'tabbed'` variant |
| `client/src/utils/displayMode.ts` | Display utils | 4 dead exports |
| `client/src/hooks/useDisplayMode.ts` | Display hook | Dead `useActiveTab` (lines 89-131) |
| `server/src/utils/manifestTemplates.ts` | Templates | Still emits `displayMode: 'tabbed'` (line 54) |
| `server/src/services/PresentationService.ts` | Core service | Path traversal, no disk validation, triple cast |

## Success Criteria

Before marking any work unit complete, verify ALL of the following:

- [ ] TypeScript compiles without errors (`npx tsc --noEmit` in relevant workspace)
- [ ] No new lint errors introduced
- [ ] For dead code removal: `grep -r "ImportedName" src/` returns no hits
- [ ] For bug fixes: the specific bug is demonstrably fixed (describe how you verified)
- [ ] For new test files: `npm test` in the relevant workspace passes all new tests
- [ ] For server changes: server starts without errors
- [ ] For client changes: client builds without errors

## Reference Patterns

### Checking for imports before deleting a file

```bash
# Check if a file is imported anywhere before deleting
grep -r "env" server/src --include="*.ts" | grep -v "env.ts" | grep "import"
grep -r "logger" server/src --include="*.ts" | grep -v "logger.ts" | grep "import"
grep -r "Sidebar.old" client/src --include="*.tsx" --include="*.ts"
grep -r "useModifierKey" client/src --include="*.tsx" --include="*.ts"
```

### Vitest test file structure (server)

```typescript
// server/src/services/__tests__/PresentationService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PresentationService', () => {
  describe('manifestMerge', () => {
    it('should merge slides without overwriting existing order', () => {
      // arrange
      // act
      // assert
    });
  });
});
```

### Vitest test file structure (client)

```typescript
// client/src/utils/__tests__/displayMode.test.ts
import { describe, it, expect } from 'vitest';
import { detectDisplayMode } from '../displayMode';

describe('detectDisplayMode', () => {
  it('returns flat when no groups in manifest', () => {
    expect(detectDisplayMode({})).toBe('flat');
  });
});
```

### Supertest route test pattern

```typescript
import request from 'supertest';
import { createApp } from '../../index';

describe('GET /api/presentations', () => {
  it('returns 200 with presentations array', async () => {
    const res = await request(app).get('/api/presentations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.presentations || res.body)).toBe(true);
  });
});
```

### Path traversal guard pattern

```typescript
// In PresentationService, after computing presentationPath:
const resolvedPath = path.resolve(presentationPath);
const resolvedRoot = path.resolve(this.presentationsRoot);
if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
  throw new AppError(400, 'Invalid presentation ID');
}
```

### postMessage origin validation pattern

```typescript
// In PresentationPage.tsx message handler:
window.addEventListener('message', (event) => {
  // Only accept messages from same origin (iframe srcdoc shares origin)
  if (event.origin !== window.location.origin && event.origin !== 'null') return;
  // ... handle event
});
```

Note: srcdoc iframes have `origin === 'null'` in some browsers. Accept both `window.location.origin` and `'null'`.

### Config watcher fix pattern

In `server/src/routes/config.ts`, when the watcher is restarted after a config change, it currently omits the `handlePresentationChange` callback. The fix is to pass the same callback that the initial watcher setup uses. Look for the pattern where `watcherManager.restart()` or `watcherManager.start()` is called without the callback — add it back.

## Anti-Patterns to Avoid

- **Do NOT delete files without first verifying no imports** — use grep patterns above
- **Do NOT change API response shapes** — response envelope standardisation is Wave 4 research only
- **Do NOT upgrade vite** — the vite 7 evaluation is research only (Wave 4)
- **Do NOT add console.log** — use the existing pattern (console.error for errors at minimum, or wire logger.ts if doing the wire-env-ts task)
- **Do NOT modify test setup files** — tests have an existing setup in `*/src/test/setup.ts`
- **Do NOT use `any` types** — the whole point of the type safety wave is removing these
- **Do NOT amend commits** — always create new commits

## Quality Gates

Non-negotiable before marking complete:

1. `npx tsc --noEmit` passes in the affected workspace (client or server)
2. `npm test` passes in the affected workspace (0 new failures)
3. For dead code: grep confirms no remaining imports
4. For security fixes: describe the attack vector that is now closed

## Learnings

_(Updated by coordinator as waves complete)_

- Research phase (R1-R5) completed 2026-03-06 — all findings are in conversation context summary
- Dead code confirmed: env.ts, logger.ts, Sidebar.old.tsx, useModifierKey.ts, useActiveTab hook
- Config watcher callback bug is critical — live reload breaks after any runtime config API change
- iframe isolation is intentional architecture — do not attempt to replace, only harden
- `displayMode: 'tabbed'` was removed as a UI option but still exists in type system and templates
- 2 HIGH severity npm vulns: rollup (via vite 6) and minimatch (via nodemon)
- All backlog status corrections committed in prior session (2026-03-06)
