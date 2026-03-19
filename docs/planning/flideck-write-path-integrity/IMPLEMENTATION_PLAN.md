# IMPLEMENTATION_PLAN.md — FliDeck Write-Path Integrity

**Goal**: Close the `assertSafeId` cache-bypass gap (security), then add ManifestService + PresentationService write-path tests — the critical missing coverage before B014 (API envelope) is safe to build.
**Started**: 2026-03-19
**Target**: `assertSafeId` runs unconditionally in `getById`; ManifestService write path covered by ≥12 tests; PresentationService write path covered by ≥8 new tests; total test count ≥107 (79 baseline + 28 new).

## Summary
- Total: 3 | Complete: 0 | In Progress: 0 | Pending: 3 | Failed: 0

---

## Pending

### Wave 1 — Security fix (1 agent)

- [ ] fix-assertsafeid-cache — `server/src/services/PresentationService.ts`: in `getById` (lines 210–233), move `assertSafeId(folderPath)` call to BEFORE the `this.cache.has(id)` check so path traversal is blocked even on cache hits; add a test to `PresentationService.test.ts` confirming traversal is blocked when the cache is warm

### Wave 2 — Test coverage (2 agents in parallel, non-overlapping files)

- [ ] test-manifest-service — create `server/src/services/__tests__/ManifestService.test.ts`; minimum 12 tests covering: `getManifest` (null when missing, reads index.json, falls back to flideck.json legacy), `patchManifest` (merges fields preserving untouched keys, validates before writing, atomic write via lock), `bulkAddSlides` (skip conflict, replace conflict, rename conflict counter), `deepMerge` proto-pollution guard via patchManifest (PATCH payload with `__proto__` key must not pollute Object.prototype)
- [ ] test-write-path — add to `server/src/services/__tests__/PresentationService.test.ts`; minimum 8 new tests covering: `addSlide` (appends to manifest, deduplicates by file, migrates legacy assets.order format to slides array), `saveAssetOrder` with an existing slides-format manifest (must use reorderSlides branch not legacy assets.order branch), `deleteTab` cascade strategy (removes tab, removes child groups, clears group field from affected slides)

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
