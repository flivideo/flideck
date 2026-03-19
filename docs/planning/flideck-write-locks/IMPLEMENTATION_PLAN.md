# IMPLEMENTATION_PLAN.md — FliDeck Write Locks

**Goal**: Serialise all 16 unguarded `fs.writeJson` calls in `PresentationService.ts` so concurrent API requests cannot silently corrupt a manifest.
**Started**: 2026-03-19
**Target**: All 16 write sites inside `withWriteLock`; at least 1 concurrent write test; `npm test` passes.

## Summary
- Total: 1 | Complete: 1 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

## In Progress

## Complete

- [x] write-lock-presentation-service (B047) — `withWriteLock` added; all 16 sites wrapped; concurrent addSlide test added; 104 server tests pass; tsc clean

## Failed / Needs Retry

## Notes & Decisions

- Lock pattern already exists in `ManifestService` — copy verbatim, do NOT merge the two lock maps
- Per-presentation locking is the correct granularity (not service-wide)
- 103 server tests on main before this campaign starts
- The 16 write sites are at lines: 488, 539, 630, 705, 776, 826, 877, 929, 972, 1031, 1083, 1193, 1235, 1297, 1348, 1386
