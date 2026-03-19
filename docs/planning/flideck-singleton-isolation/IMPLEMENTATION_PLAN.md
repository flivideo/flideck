# IMPLEMENTATION_PLAN.md — FliDeck Singleton Isolation

**Goal**: Fix PresentationService singleton contamination risk in route integration tests. Add `afterAll` cleanup to 3 test files + optionally add `pool: 'forks'` to vitest config.
**Started**: 2026-03-19
**Target**: No test file leaves PresentationService.root set after it completes. All 139 tests still pass. 0 TS errors.

## Summary
- Total: 1 | Complete: 0 | In Progress: 0 | Pending: 1 | Failed: 0

---

## Pending

- [ ] singleton-afterall — Add `afterAll(() => PresentationService.getInstance().setRoot(''))` to `query.routes.test.ts`, `assets.routes.test.ts`, `presentations.routes.test.ts`; also add `afterAll` import to each file's import line; consider adding `pool: 'forks'` to `server/vitest.config.ts` for deeper isolation

---

## In Progress

---

## Complete

---

## Failed / Needs Retry

---

## Notes & Decisions

- `PresentationService.setRoot('')` clears the cache automatically (line 79 of PresentationService.ts)
- `pool: 'forks'` gives each test file its own Node process — stronger isolation but slower; weigh against benefit
- The fix is 3 small file edits — single agent, single wave
