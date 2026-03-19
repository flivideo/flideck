# IMPLEMENTATION_PLAN.md — FliDeck Test Quality Fixes

**Goal**: Fix three structurally broken tests (proto-pollution, write-lock, empty-root guard) identified by the write-path-integrity audit before B014 (API envelope) is safe to build.
**Started**: 2026-03-19
**Target**: All three tests correctly fail when the production code they cover is deleted. Total test count stays ≥ 99 (no regressions).

## Summary
- Total: 3 | Complete: 0 | In Progress: 0 | Pending: 3 | Failed: 0

---

## Pending

- [ ] fix-proto-pollution-test — Replace Object.prototype assertion with written-output inspection: after patching with `__proto__` key, read index.json and assert the dangerous key is absent from the JSON (B037)
- [ ] fix-write-lock-test — Replace mutually-exclusive slide overwrites with additive `tags` array patches; both patches must be present in the final file — missing lock would produce only one (B038)
- [ ] fix-empty-root-guard — Add `if (!this.presentationsRoot) throw new AppError('Root not configured', 400)` at the top of `getById` (consistent with `discoverAll`); add a test that calls `getById` before `setRoot` and expects AppError(400) (B039)

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

- All three fixes are in server-side files only — no client changes
- B037 + B038 modify existing tests in `ManifestService.test.ts` (no new tests, just replacements)
- B039 adds one guard line to `PresentationService.ts` + one new test in `PresentationService.test.ts`
- All three can be done by a single agent in one wave (no file conflicts — B037/B038 touch ManifestService.test.ts, B039 touches PresentationService.ts + PresentationService.test.ts)
- Baseline entering this campaign: 35 client + 64 server = 99 tests
- Backlog items addressed: B037, B038, B039
