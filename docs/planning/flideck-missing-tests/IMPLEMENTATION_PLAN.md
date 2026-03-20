# IMPLEMENTATION_PLAN.md — FliDeck Missing Tests

**Goal**: Fill three test coverage gaps: applySlideMetadata field propagation, syncFromIndex cheerio parsing, removeSlide/updateSlide/deleteGroup cascade.
**Started**: 2026-03-20
**Target**: Tests only — no source code changes. All 3 items are independent.

## Summary
- Total: 2 | Complete: 2 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

## In Progress

## Complete

- [x] ps-tests (B049+B051) — 21 tests: applySlideMetadata (8 inc. post-audit no-title fix), removeSlide (4), updateSlide (4), deleteGroup (5); 137 total; tsc clean
- [x] sync-from-index-tests (B050) — 9 tests: flat/tabbed detection, merge/replace, inferTitles, tab group creation, error case; replace-strategy assertion fixed post-audit; 137 total; tsc clean

## Failed / Needs Retry

## Notes & Decisions

- Two agents, zero file overlap: Agent A → PresentationService.test.ts; Agent B → ManifestService.test.ts
- No source code changes — tests only
- 107 server tests on main before this campaign
