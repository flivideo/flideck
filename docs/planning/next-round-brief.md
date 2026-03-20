# Next Round Brief — B055/B056: Input Mutation + Concurrent Order Collision

**Goal**: Fix two small correctness bugs surfaced during the write-lock campaign audits. Both are in ManifestService. Neither requires test infrastructure changes — just a source fix + a targeted test.

**Background**: Write-lock and missing-test campaigns are complete (137 tests, tsc clean). These are the two remaining pending items before the backlog is clear of medium/high-priority work.

## B055 — bulkAddSlides mutates caller input array (MEDIUM)

`bulkAddSlides` in `ManifestService` operates on the caller's input array directly in the rename/conflict path instead of working on a copy. If the caller holds a reference to the array, its elements are silently mutated.

**Fix**: shallow-copy each slide object before modifying — `{ ...slide }` — at the point where rename/conflict resolution writes back to the element.

**Test**: pass an array of slides with a filename collision, capture the original array, call `bulkAddSlides`, assert the original elements are unchanged.

**Files**: `server/src/services/ManifestService.ts`, `server/src/services/__tests__/ManifestService.test.ts`

---

## B056 — createGroup concurrent order collision (LOW)

Two concurrent `createGroup` calls both read `groups` before either writes, compute `order: 1` from an empty map, and both write `order: 1`. The second write wins but both groups end up with the same order value until the next explicit reorder.

**Fix**: compute order inside the write lock, after acquiring it — so the second call sees the first group already written.

**Test**: fire two concurrent `createGroup` calls, await both, assert the resulting groups have distinct `order` values (0 and 1, or 1 and 2 — whatever the convention is).

**Files**: `server/src/services/ManifestService.ts`, `server/src/services/__tests__/ManifestService.test.ts`

---

## Suggested Approach

Run both as a single agent — same file pair, low risk, no parallelism benefit. Estimated additions: ~20 lines of source, ~15 lines of tests.

After fixing B055/B056, the backlog has only low-priority items (B057–B060, all assertion tightening). A good stopping point for the current work cycle.
