# IMPLEMENTATION_PLAN.md — FliDeck Write-Path Integrity

**Goal**: Close the `assertSafeId` cache-bypass gap (security), then add ManifestService + PresentationService write-path tests — the critical missing coverage before B014 (API envelope) is safe to build.
**Started**: 2026-03-19
**Target**: `assertSafeId` runs unconditionally in `getById`; ManifestService write path covered by ≥12 tests; PresentationService write path covered by ≥8 new tests; total test count ≥107 (79 baseline + 28 new).

## Summary
- Total: 3 | Complete: 3 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

### Wave 1 — Security fix (1 agent)

- [x] fix-assertsafeid-cache — assertSafeId moved before cache check; warm-cache traversal test added; 79→80 tests. Commit: see worktree. (2026-03-19)

### Wave 2 — Test coverage (2 agents in parallel, non-overlapping files)

- [x] test-manifest-service — ManifestService.test.ts created, 12 tests: getManifest (null/index.json/flideck.json), patchManifest (merge/nested/validation/proto-pollution/write-lock), bulkAddSlides (skip/replace/rename). (2026-03-19)
- [x] test-write-path — 8 tests appended to PresentationService.test.ts: addSlide (append/dedup/legacy migration/group field), saveAssetOrder slides-format branch (reorder + metadata), deleteTab cascade + orphan strategies. (2026-03-19)

---

## In Progress

(coordinator moves items here with [~])

---

## Complete

(coordinator moves items here with [x], adds outcome notes)

---

## Failed / Needs Retry

(coordinator moves items here with [!], adds failure reason)

---

## Notes & Decisions

- Wave 1 has 1 agent (single file touch, quick fix)
- Wave 2 agents are safe to run in parallel — test-manifest-service creates a NEW file (`ManifestService.test.ts`), test-write-path APPENDS to existing `PresentationService.test.ts`; no overlap
- Wave 2 must run AFTER Wave 1 so the assertSafeId fix is in place when traversal tests are written
- B033 (deepMerge consolidation) was found to be already resolved on main — presentations.ts had no standalone deepMerge after security-foundations merge; ManifestService has the only copy (correct Object.keys impl). Marked Done in BACKLOG.
- Test baseline entering this campaign: 35 client + 44 server = 79 total (1 dist artifact failure is pre-existing, not a real test)
- Backlog items addressed: B034 (fix-assertsafeid-cache), B035 (test-manifest-service), B036 (test-write-path)
