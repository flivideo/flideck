# IMPLEMENTATION_PLAN.md — FliDeck Route Integration Tests

**Goal**: Add supertest-based HTTP integration tests for all 7 route files, verifying envelope shape (`{ success, data }`) and HTTP status codes. Also add `createApiResponse` unit tests in `responseHelper.test.ts`.
**Started**: 2026-03-19
**Target**: ≥ 35 new tests. All 101 existing tests still pass. 0 TS errors.

## Summary
- Total: 5 | Complete: 5 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

(none)

---

## In Progress

(none)

---

## Complete

- [x] responsehelper-unit — 9 unit tests in `server/src/utils/__tests__/responseHelper.test.ts`; all shape/null/context/error cases covered. (2026-03-19)
- [x] light-static-routes — 11 tests across capabilities (4), schema (2), templates (5); dynamically resolves template IDs via `getTemplates()`. (2026-03-19)
- [x] query-routes — 6 tests in `query.routes.test.ts`; tmpdir + PresentationService.setRoot() pattern proven. (2026-03-19)
- [x] assets-config-routes — 4 tests (assets: 2, config: 2); key learning: asset IDs strip `.html` extension (use `index` not `index.html`). (2026-03-19)
- [x] presentations-routes — 10 tests covering GET /, GET /:id, GET /:id/manifest, POST /refresh, POST /:id/slides (valid + invalid); _context shape verified. (2026-03-19)

---

## Failed / Needs Retry

(coordinator moves items here with [!], adds failure reason)

---

## Notes & Decisions

- supertest + @types/supertest already installed as devDependencies
- Test helper pattern: `express() + router + errorHandler` — no Socket.io server needed for read routes
- io mock: `{ to: () => ({ emit: () => {} }), emit: () => {} } as unknown as Server`
- PresentationService is a singleton — call `setRoot(tmpdir)` in beforeAll; use `os.tmpdir()` or `tmp` package
- Baseline: 101 tests (35 client + 66 server) — must not regress
- Test file locations: `server/src/utils/__tests__/responseHelper.test.ts` and `server/src/routes/__tests__/*.routes.test.ts`
- Presentations route tests: focus on read paths only (GET /, GET /:id) — not all 28 mutation handlers
