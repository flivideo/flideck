# Assessment: FliDeck Manifest Locks

**Campaign**: flideck-manifest-locks
**Date**: 2026-03-19
**Results**: 2 complete, 0 failed

---

## Results Summary

| Item | Status | Outcome |
|------|--------|---------|
| lock-manifest-service (B052+B054a) | [x] Complete | 6 ManifestService methods wrapped; _resetWriteLocks() added; 8 withWriteLock usages; tsc clean |
| concurrent-tests-and-reset (B053+B054b) | [x] Complete | 3 concurrent tests + _resetWriteLocks() + beforeEach updates; 107 tests pass; tsc clean |

Post-audit fix: deleteTab+addSlide test strengthened with 4 additional assertions proving the cascade ran — original assertions passed even without the lock.

---

## What Worked Well

- Two parallel agents with zero file overlap ran cleanly without conflicts
- ManifestService already had the lock infrastructure; wrapping 6 methods was mechanical
- `return await this.withWriteLock(...)` pattern applied correctly to all 3 methods with return values
- Test agents adapted to the real `deleteTab` API shape (groups with `tab: true`) without needing correction

---

## What Didn't Work

- **deleteTab+addSlide concurrent test was initially vacuous** — the original assertions (`files.toContain('new-slide.html')` + `Array.isArray`) pass under all race orderings, with or without the lock. Caught by test quality audit. Fixed post-audit by adding 4 assertions that verify the cascade ran (tab-a absent, group-under-tab absent, slide-in-group ungrouped, new-slide present). The stronger assertions would fail without the lock.

---

## Key Findings from Quality Audits

### Code Quality (medium, no action needed)

- `PresentationService._resetWriteLocks()` doesn't cascade to ManifestService's internal lock map. Since both services use `finally: release()`, stale live locks are structurally impossible — this is a documentation gap not a correctness bug.
- `bulkAddSlides` rename strategy mutates the caller-supplied input array in-place (pre-existing, not introduced by this campaign) — worth a future B### item if agent callers pass reusable arrays.
- File I/O (title extraction) held inside lock in `syncManifest` / `syncFromIndex` — latency concern only, not a correctness issue.

### Test Quality (critical fixed, medium noted)

- **Fixed**: deleteTab+addSlide test now asserts cascade completion, not just new-slide presence.
- **Medium**: createGroup concurrent test produces two groups with `order: 1` (both see empty groups, both compute `nextOrder = 1`). The lock prevents data loss but not the order collision. Separate production concern; not a test bug.

---

## Key Learnings — Application

- The complete write-lock story: PresentationService owns 16 direct writes (B047) + ManifestService owns 7 write paths (`patchManifest` pre-existing + 6 now locked). Cross-service calls are not co-ordinated (separate lock maps) — acceptable because the two method sets are non-overlapping.
- Lock boundary for methods with pre-write filesystem scans (`readdir`): keep scans outside the lock, wrap only the read-manifest-to-write-manifest block.
- Concurrent test proof requires additive operations — both writes must independently change distinct state. A test that passes regardless of ordering is not a proof.

## Key Learnings — Ralph Loop

- Test quality audits catch vacuous proofs that code quality audits miss — the two skills are genuinely complementary.
- Parallel agents on non-overlapping files worked cleanly; zero merge conflicts.
- Post-audit test fixes are routine and fast if the test structure is already correct — the fix was 5 lines replacing 3.

---

## Suggestions for Next Campaign

### New backlog items from audits

- **B055** — `bulkAddSlides` rename strategy mutates caller input array in place; fix by operating on a copy (`{ ...slide }`) — medium
- **B056** — createGroup order collision: two concurrent createGroup calls both get `order: 1` because they both read an empty groups object; fix by making order assignment part of the locked block (it already is) but seeding with a timestamp or UUID as tiebreaker — low

### AGENTS.md improvements

- Add note: concurrent test proof requires additive, distinct-key operations — overwrite patterns are not proofs
- Add note: `return await this.withWriteLock(...)` is required for methods with return values — just `await` causes the lock to release before the caller receives the value
