# AGENTS.md — FliDeck Singleton Isolation

_(Inherited from flideck-route-integration-tests. Updated for this campaign.)_

## Project Overview

**Project**: FliDeck — local-first presentation harness
**Campaign**: flideck-singleton-isolation — fix PresentationService singleton contamination in route integration tests (B042)
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest
**Worktree**: `/Users/davidcruwys/dev/ad/flivideo/flideck/.worktrees/flideck-singleton-isolation`

**Current state (2026-03-19, entering this campaign):**
- 139 tests passing (35 client, 104 server) — baseline must not regress
- 3 route test files call `PresentationService.getInstance().setRoot(tmpRoot)` in `beforeAll` with no `afterAll` reset
- `setRoot('')` clears the cache automatically (PresentationService.ts line 79: `this.cache.clear()`)

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck/.worktrees/flideck-singleton-isolation
npm test           # must pass: 139 total (35 client + 104 server)
npm run typecheck  # must pass: 0 errors
```

---

## The Fix

### Step 1 — Add `afterAll` to each of the 3 affected test files

File: `server/src/routes/__tests__/query.routes.test.ts`
- Add `afterAll` to the import line: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';`
- Add after the existing `beforeAll` block:
```typescript
afterAll(() => {
  PresentationService.getInstance().setRoot('');
});
```

File: `server/src/routes/__tests__/assets.routes.test.ts`
- Same import addition and same `afterAll` block

File: `server/src/routes/__tests__/presentations.routes.test.ts`
- Same import addition and same `afterAll` block

### Step 2 — Consider `pool: 'forks'` in vitest config

File: `server/vitest.config.ts`

Current:
```typescript
export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
```

`pool: 'forks'` gives each test file its own Node process — prevents module-level singleton sharing entirely. It is slower but eliminates the class of problem permanently.

**Decision**: Add `pool: 'forks'` only if the test suite still completes in under 30 seconds after adding it. If it slows the suite significantly, skip it — the `afterAll` cleanup is sufficient.

Check timing: run `npm test` and note duration before and after.

---

## Success Criteria

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test` — ≥ 139 tests passing
- [ ] Each of the 3 files has `afterAll` that calls `PresentationService.getInstance().setRoot('')`
- [ ] `afterAll` is imported in each file's vitest import line

---

## Anti-Patterns to Avoid

- **Do NOT add `beforeEach` reset** — `beforeAll` is correct; the root should be set once per file, not per test
- **Do NOT modify source files** — tests only
- **Do NOT import `afterAll` without adding it to the import list** — globals are enabled but explicit imports are cleaner

---

## Quality Gates

1. `npm run typecheck` — 0 errors
2. `npm test` — ≥ 139 tests passing
3. All 3 files have `afterAll` cleanup

---

## Learnings

_(Inherited from flideck-route-integration-tests)_

### Architecture
- `asyncHandler` AND `AppError` are co-located in `server/src/middleware/errorHandler.ts`
- PresentationService is a singleton — `setRoot('')` clears cache and resets root
- Route factory functions accept deps at construction time

### Tests
- 139 total: 35 client, 104 server
- Vitest globals enabled but import explicitly for clarity
- supertest import: `import request from 'supertest';`

### Asset ID convention
- Asset IDs strip `.html` extension: `index.html` → request as `/test-deck/index`

### PresentationService singleton isolation
- `setRoot('')` resets root AND clears cache — sufficient for afterAll cleanup
- `pool: 'forks'` in vitest config gives process-level isolation (stronger but slower)
