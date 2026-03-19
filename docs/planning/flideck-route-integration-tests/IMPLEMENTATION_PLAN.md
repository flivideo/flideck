# IMPLEMENTATION_PLAN.md — FliDeck Route Integration Tests

**Goal**: Add supertest-based HTTP integration tests for all 7 route files, verifying envelope shape (`{ success, data }`) and HTTP status codes. Also add `createApiResponse` unit tests in `responseHelper.test.ts`.
**Started**: 2026-03-19
**Target**: ≥ 35 new tests. All 101 existing tests still pass. 0 TS errors.

## Summary
- Total: 5 | Complete: 0 | In Progress: 0 | Pending: 5 | Failed: 0

---

## Pending

### Wave 1 — 3 agents in parallel (non-overlapping files)

- [ ] responsehelper-unit — Unit tests for `createApiResponse` + `createErrorResponse` in `server/src/utils/__tests__/responseHelper.test.ts` (≥6 tests: data shape, null data, context merge, error shape, type inference)
- [ ] light-static-routes — Integration tests for `capabilities`, `schema`, `templates` routes in `server/src/routes/__tests__/` (3 files, ≥9 tests: envelope shape, status 200, 404 on missing template)
- [ ] query-routes — Integration tests for `query` routes in `server/src/routes/__tests__/query.routes.test.ts` (≥6 tests: envelope shape on /routes, /routes/:route, /presentations/:id; 404 on unknown route)

### Wave 2 — 2 agents in parallel (non-overlapping files)

- [ ] assets-config-routes — Integration tests for `assets` + `config` routes in `server/src/routes/__tests__/` (≥6 tests: config GET envelope, assets 404 on missing file)
- [ ] presentations-routes — Integration tests for key `presentations` endpoints: GET /, GET /refresh, GET /:id (envelope + _context shape), GET /:id/manifest (≥8 tests, not all 28 handlers — focus on read paths and envelope correctness)

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

- supertest + @types/supertest already installed as devDependencies
- Test helper pattern: `express() + router + errorHandler` — no Socket.io server needed for read routes
- io mock: `{ to: () => ({ emit: () => {} }), emit: () => {} } as unknown as Server`
- PresentationService is a singleton — call `setRoot(tmpdir)` in beforeAll; use `os.tmpdir()` or `tmp` package
- Baseline: 101 tests (35 client + 66 server) — must not regress
- Test file locations: `server/src/utils/__tests__/responseHelper.test.ts` and `server/src/routes/__tests__/*.routes.test.ts`
- Presentations route tests: focus on read paths only (GET /, GET /:id) — not all 28 mutation handlers
