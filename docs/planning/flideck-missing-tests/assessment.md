# Assessment: FliDeck Missing Tests

**Campaign**: flideck-missing-tests
**Date**: 2026-03-20
**Results**: 2 complete, 0 failed

---

## Results Summary

| Item | Status | Tests | Outcome |
|------|--------|-------|---------|
| ps-tests (B049+B051) | [x] Complete | 21 | applySlideMetadata (8), removeSlide (4), updateSlide (4), deleteGroup (5) |
| sync-from-index-tests (B050) | [x] Complete | 9 | flat/tabbed, merge/replace, inferTitles, error case |
| **Total** | | **137** | +30 from 107 baseline |

2 post-audit fixes:
- ManifestService.test.ts: replace-strategy test had vacuous `not.toContain('old-group')` on a filenames array — replaced with `toHaveLength(0)` which actually proves the manifest was reset
- PresentationService.test.ts: added missing test for slide-without-title keeping its formatted filename as `asset.name`

---

## What Worked Well

- Two parallel agents on non-overlapping files — zero conflicts
- Agent B self-corrected the tabId regex finding in real-time (wrote tests that match actual `tab-intro` behaviour, not assumed `intro` behaviour)
- All 3 coverage gaps were genuinely untested in production — tests found real behaviour immediately
- syncFromIndex tests discovered that replace strategy does NOT add orphan slides (only merge does) — a behaviour nuance that wasn't in the AGENTS.md brief

---

## What Didn't Work

- **Replace-strategy test was initially vacuous** (line 385 — `not.toContain('old-group')` on a filename array is always true). Caught by test quality audit. Fixed post-audit.
- **No-title default name test was missing** for applySlideMetadata. Caught by test quality audit. Added post-audit.

---

## Key Findings from Quality Audits

### Test Quality

**Critical (fixed)**: ManifestService.test.ts replace-strategy test was vacuously true — `not.toContain('old-group')` checking a group ID against a filenames array. The replace strategy behaviour was completely unverified. Fixed with `toHaveLength(0)`.

**High (fixed)**: applySlideMetadata had no test for the guard condition — slide without title must keep its formatted filename as `asset.name`. Without this test, a bug that blanked `asset.name` when title was absent would be invisible.

**Medium (noted, not fixed — backlog):**
- deleteGroup never asserts slide count preserved — a filter-removes-slide bug would be invisible
- Flat-merge test uses `toContain` only — duplicate-entry bug would pass
- No test for simple `index-mary.html → tabId: mary` regex pattern (only `index-tab-*.html` covered)
- removeSlide: no test verifying physical HTML file is NOT deleted

### Code Quality

All low severity — setup helper duplication (four near-identical helpers), one misleading comment on a redundant `setRoot` restore call. No `any` casts, no private member access, clean isolation.

---

## Key Learnings — Application

- `syncFromIndex` replace strategy starts with an empty manifest AND does not auto-add orphan slides (only merge mode adds orphans). The slides array is empty after a replace sync on a flat deck.
- `applySlideMetadata` only sets `asset.name` and `asset.title` when `slide.title` is truthy — no-title slides keep the formatted filename default set by `discoverAssets`.
- `deleteGroup` clears `slide.group` (ungroups) but does NOT remove slides from the array.
- tabId regex captures the full string after `index-` — `index-tab-intro.html` → tabId `tab-intro`, not `intro`.

## Key Learnings — Ralph Loop

- Test quality audits reliably find vacuous assertions that code quality audits miss — especially `not.toContain(X)` where X is the wrong type of value.
- Parallel agents adapted to real API shapes without needing correction (tabId regex self-discovery).
- Production code behaviour discovery (replace doesn't add orphans) only emerged from test failures — worth noting in AGENTS.md.

---

## Suggestions for Next Campaign

### New backlog items from audits

- **B057** — deleteGroup: add `toHaveLength` assertion proving slides are ungrouped not deleted | Priority: low
- **B058** — syncFromIndex: add test for simple `index-mary.html → tabId: mary` pattern | Priority: low
- **B059** — removeSlide: add test verifying physical HTML file is NOT deleted after removeSlide | Priority: low
- **B060** — flat-merge test: tighten with `toHaveLength` to catch duplicate-entry bugs | Priority: low
