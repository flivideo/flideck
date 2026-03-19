# IMPLEMENTATION_PLAN.md — FliDeck Manifest Locks

**Goal**: Complete the write-lock story — wrap 6 unguarded ManifestService write methods; add concurrent tests for 3 high-risk PresentationService methods; add `_resetWriteLocks()` for test hygiene.
**Started**: 2026-03-19
**Target**: All ManifestService write sites locked; 3 new concurrent tests; `_resetWriteLocks()` in both services and called in `beforeEach`.

## Summary
- Total: 2 | Complete: 2 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

## In Progress

## Complete

- [x] lock-manifest-service (B052+B054a) — 6 ManifestService methods wrapped; _resetWriteLocks() added; 8 withWriteLock usages total; 107 tests pass; tsc clean
- [x] concurrent-tests-and-reset (B053+B054b) — 3 concurrent tests added (createGroup, updateSlide, deleteTab+addSlide); _resetWriteLocks() on PresentationService; beforeEach updated in both test files; 107 tests; tsc clean

## Failed / Needs Retry

## Notes & Decisions

- B052 and B054 split across 2 agents by file: ManifestService.ts (Agent A) vs PresentationService.ts + test files (Agent B)
- The two agents have ZERO file overlap — safe to run in parallel
- 104 server tests on main before this campaign starts
- Methods with return values need `return await this.withWriteLock(...)` not just `await`
