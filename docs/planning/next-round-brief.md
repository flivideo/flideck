# Next Round Brief — B052/B053: ManifestService Write Locks + Concurrent Tests

**Goal**: Complete the write-lock story by locking ManifestService's 6 unguarded write methods, and add concurrent tests for the highest-risk PresentationService methods.

**Background**: B047 added `withWriteLock` to all 16 PresentationService-owned write methods. However, `ManifestService` has 6 delegated write methods with no lock, and the two `writeLocks` maps are entirely separate — a concurrent `addSlide` (PresentationService lock) + `bulkAddSlides` (ManifestService, no lock) on the same presentation ID will NOT serialise. Also, only one concurrent test exists (addSlide); the highest-risk methods have none.

## B052 — ManifestService write locks (HIGH)

Unguarded write methods in `ManifestService.ts`:
- `setManifest` (line ~204)
- `bulkAddSlides` (line ~319)
- `bulkAddGroups` (line ~464)
- `syncManifest` (line ~547)
- `applyTemplate` (line ~739)
- `syncFromIndex` (line ~768)

Only `patchManifest` (line ~243) already uses `withWriteLock`.

**Suggested approach**: Same pattern as PresentationService — the `withWriteLock` implementation is already on ManifestService (lines 101–117), just not applied to these 6 methods. Wrap each method's read-modify-write block.

**Success criteria**:
- All 6 methods wrapped in `withWriteLock`
- `npm test` passes (104 server tests + any new)

## B053 — Concurrent write tests for high-risk methods (HIGH)

Missing concurrent tests (same additive proof pattern as the existing addSlide test):

1. **`createGroup`** — two concurrent createGroup calls; both groups must survive
2. **`updateSlide`** — two concurrent calls updating different fields on same slide; both field values must survive
3. **`deleteTab` + `addSlide`** — concurrent cascade delete while adding a slide to a group under that tab

**Success criteria**:
- At least 3 new concurrent tests, one per scenario above
- All tests would fail if `withWriteLock` were removed from the respective method
- `npm test` passes

## B054 — Reset writeLocks between tests (MEDIUM, optional)

`writeLocks` Map is never cleared in `beforeEach`. If a future test leaves a stuck lock, subsequent tests in the same worker could timeout. Low risk now but worth fixing preemptively.

**Approach**: Add `_resetWriteLocks(): void { this.writeLocks.clear(); }` to PresentationService (and ManifestService), call in `beforeEach` alongside `setRoot`.

## Session state (as of 2026-03-19)

- 104 server tests passing, 35 client tests — total 139
- Main branch clean, pushed (`4c54f46`)
- `ManifestService.ts` already has `withWriteLock` at lines 101–117 — apply it to the 6 unguarded methods
- `PresentationService.ts` is the reference for the concurrent test shape
