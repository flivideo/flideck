# IMPLEMENTATION_PLAN.md — FliDeck Test Quality Fixes

**Goal**: Fix three structurally broken tests (proto-pollution, write-lock, empty-root guard) identified by the write-path-integrity audit before B014 (API envelope) is safe to build.
**Started**: 2026-03-19
**Target**: All three tests correctly fail when the production code they cover is deleted. Total test count stays ≥ 99 (no regressions).

## Summary
- Total: 3 | Complete: 3 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

(none)

---

## In Progress

(coordinator moves items here with [~])

---

## Complete

- [x] fix-proto-pollution-test — Replaced Object.prototype assertion with written-output inspection using JSON.parse payload; test quality audit identified remaining weakness (B040 raised for next campaign). (2026-03-19)
- [x] fix-write-lock-test — Replaced with additive meta key patches (name + purpose); both keys must survive; mutation-resistant. (2026-03-19)
- [x] fix-empty-root-guard — Guard added to getById; test confirms AppError(400) on empty root; root restored after test. (2026-03-19)

---

## Failed / Needs Retry

(coordinator moves items here with [!], adds failure reason)

---

## Notes & Decisions

- All three fixes are in server-side files only — no client changes
- B037 + B038 modify existing tests in `ManifestService.test.ts` (no new tests, just replacements)
- B039 adds one guard line to `PresentationService.ts` + one new test in `PresentationService.test.ts`
- All three can be done by a single agent in one wave (no file conflicts — B037/B038 touch ManifestService.test.ts, B039 touches PresentationService.ts + PresentationService.test.ts)
- Baseline entering this campaign: 35 client + 64 server = 99 tests
- Backlog items addressed: B037, B038, B039
