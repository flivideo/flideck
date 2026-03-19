# IMPLEMENTATION_PLAN.md — FliDeck Security Foundations

**Goal**: Close two BLOCKER security issues, fix data integrity gaps, and extract ManifestService from the God class — laying the foundation for B014 (API envelope) and B024 (Type C slides) to be built safely.
**Started**: 2026-03-19
**Target**: 0 BLOCKER issues; `createApiResponse<T>()` helper enforced; PATCH manifest atomic; ManifestService extracted; stripSlideWrapper + PresentationService core paths covered by tests.

## Summary
- Total: 8 | Complete: 0 | In Progress: 0 | Pending: 8 | Failed: 0

---

## Pending

### Wave 1 — Security fixes (3 agents in parallel, non-overlapping files)

- [ ] fix-pid-injection — `server/src/index.ts:327-336`: validate PIDs are numeric before passing to `kill -9`; replace `execSync('sleep 0.5')` with `setTimeout`; re-enable `contentSecurityPolicy` on helmet (currently `false`)
- [ ] fix-command-injection — `server/src/routes/presentations.ts:1056`: replace `exec(`open "${presentation.path}"`)` with `execFile('open', [presentation.path])` to eliminate shell interpolation
- [ ] api-response-helper — create `server/src/utils/responseHelper.ts` exporting `createApiResponse<T>(data: T, context?: object)` and `createErrorResponse(message: string, status: number)`; update `shared/src/types.ts` `ApiResponse<T>` if needed; do NOT change any route handlers yet (helper only)

### Wave 2 — Data integrity (2 items, sequential — both touch PresentationService.ts)

- [ ] fix-deepmerge-proto — fix prototype pollution in both `deepMerge` implementations: (1) `PresentationService.ts:1538` private method — replace `for (const key in source)` with `Object.keys(source)`, add explicit skip of `__proto__`/`constructor`/`prototype`; (2) `presentations.ts:1082` standalone function — same fix; verify `typedDeepMerge` (line 109) is unaffected (already typed, but check it too)
- [ ] patch-toctou-fix — `PresentationService.ts:patchManifest` (line 1496): make read/merge/validate/write atomic by moving the merge inside `patchManifest`; add a `Map<string, Promise<void>>` per-presentation write mutex so concurrent calls queue rather than race; update the PATCH route handler in `presentations.ts` to remove the duplicate route-level merge (lines 722-727) since validation now happens inside the service

### Wave 3 — Architecture + client tests (2 agents in parallel, non-overlapping files)

- [ ] manifest-service-extraction — create `server/src/services/ManifestService.ts`; move the FR-19/FR-21/FR-26 method cluster from `PresentationService.ts` (approx lines 1435–2460: `getManifest`, `putManifest`, `patchManifest`, `bulkAddSlides`, `bulkAddGroups`, `syncManifest`, `validateManifest`, `syncFromIndex`); update `PresentationService` to delegate to `ManifestService`; update all route imports; 0 tsc errors; all 43 existing tests still pass
- [ ] test-render-path — `client/src/harness/__tests__/stripSlideWrapper.test.ts`: test that given a full HTML document string, `stripSlideWrapper` (a) returns body innerHTML without html/head/body wrapper, (b) collects style blocks into `styles`, (c) sets `viewportLock: true` for slides with `scroll-snap-type` or `overflow:hidden` on body or `height: 100vh`, (d) sets `viewportLock: false` for clean slides; minimum 8 tests covering these cases

### Wave 4 — Server tests (after manifest-service-extraction lands)

- [ ] test-core-service — `server/src/services/__tests__/PresentationService.test.ts` (or ManifestService.test.ts if extraction complete): using a real temp directory via `tmp` or `os.tmpdir()`, test: (a) `discoverAll()` returns folder with `presentation.html` but not folder without entry point; (b) `assertSafeId()` throws AppError 400 for `../../../etc` path; (c) `saveAssetOrder()` writes correct order to `index.json` on disk; (d) `deleteTab()` cascade strategy removes child groups and clears group refs from slides; minimum 8 tests

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

- Wave 1 agents are safe to run in parallel — fix-pid-injection only touches `index.ts`, fix-command-injection only touches `presentations.ts:1056`, api-response-helper only touches new file + `shared/types.ts`
- Wave 2 items are SEQUENTIAL — both touch `PresentationService.ts`. Run fix-deepmerge-proto first, patch-toctou-fix second.
- Wave 3 items are safe to run in parallel — manifest-service-extraction is server-only, test-render-path is client-only
- Wave 4 (test-core-service) must wait for Wave 3 manifest-service-extraction to complete — tests should target the correct class boundaries post-extraction
- api-response-helper (Wave 1) is helper-only — route handler updates are Wave 5 (flideck-api-envelope campaign, B014)
- Backlog items addressed: B027 (fix-pid-injection + fix-command-injection), B028 (api-response-helper), B029 (manifest-service-extraction), B030 (test-core-service), B031 (test-render-path), B032 (patch-toctou-fix)
