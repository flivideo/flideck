# Assessment: flideck-route-integration-tests

**Campaign**: flideck-route-integration-tests
**Date**: 2026-03-19 → 2026-03-19
**Results**: 5 complete, 0 failed
**Quality audits**: code-quality-audit + test-quality-audit run post-campaign

---

## Results Summary

| Work Unit | Tests Added | Status |
|---|---|---|
| responsehelper-unit | 9 | ✅ |
| light-static-routes (capabilities + schema + templates) | 11 | ✅ |
| query-routes | 6 | ✅ |
| assets-config-routes | 4 | ✅ |
| presentations-routes | 10 | ✅ |
| **Total** | **40** | |

Baseline: 101 tests (35 client + 66 server)
Final: 139 tests (35 client + 104 server)
New test files: 8 (1 unit + 7 route integration)

---

## What Worked Well

1. **Route factory pattern made testing clean** — every route file uses a factory function (`createCapabilitiesRoutes()`, etc.) that returns a plain Router. Mounting it in a minimal `express() + errorHandler` test app took 5 lines and no mocking of the full server.
2. **supertest was already installed** — zero friction to start; `@types/supertest` too. No npm install needed.
3. **Agents discovered a real implementation detail** — asset IDs strip the `.html` extension (so the correct route is `GET /test-deck/index`, not `GET /test-deck/index.html`). This was not in AGENTS.md and was found by running the tests.
4. **Presentations test file was the strongest** — the `_context` key-exact assertion (`toEqual(['presentationsRoot'])`) is genuinely mutation-resistant; it will catch regressions that rename or add fields.
5. **5 work units in 2 waves, clean separation** — no file conflicts, parallel execution worked as designed.

---

## What Didn't Work

1. **PresentationService singleton contamination (HIGH risk)** — Three test files (`query`, `assets`, `presentations`) all call `PresentationService.getInstance().setRoot(tmpRoot)` in `beforeAll` with no `afterAll` reset. With Vitest's default worker pooling, whichever file's `beforeAll` runs last wins; others may see the wrong root. This is not currently failing (Vitest may be running files sequentially by default) but is a latent CI flakiness risk. Raised as B042.
2. **schema.routes.test.ts assertion is near-false-positive** — The OR-based check (`$schema !== undefined || type !== undefined`) passes on almost any object. Should assert a concrete value.
3. **Asset error-path URL mismatch** — `assets.routes.test.ts` uses `nonexistent.html` (with extension) for the 404 path but `index` (no extension) for the happy path. Tests a slightly different code path than intended.
4. **`config.routes.test.ts` uses `as any` for watcherManager** — inconsistent with the `as unknown as Server` pattern used for io.

---

## Key Learnings — Application

- **Asset ID convention**: FliDeck strips `.html` from asset IDs — `index.html` is accessed as `/api/assets/my-deck/index`. Document this in AGENTS.md for future campaigns.
- **PresentationService is a singleton and is NOT test-isolated** — any test that calls `setRoot()` must reset it in `afterAll`, or use `pool: 'forks'` in vitest config to isolate modules per file.
- **errorHandler must be mounted in test apps** — without it, `AppError` thrown in route handlers propagates as an unhandled rejection rather than a 4xx JSON response.
- **Route factory functions accept `_config` (underscore prefix)** — several routes accept `io` but don't use it (schema.ts, templates.ts don't emit events in GET handlers). The underscore prefix signals this — safe to pass a minimal mock.

---

## Key Learnings — Ralph Loop

- **Wave 1 (3 agents) took ~2–3min; Wave 2 (2 agents) took ~3min** — test-writing agents are slower than refactoring agents because they run the full test suite to verify.
- **responseHelper unit test was the fastest** — pure functions with no dependencies finish in under 90 seconds. Lead with these in future campaigns.
- **Static routes (capabilities, schema, templates) are the easiest integration tests** — no PresentationService, no io, no filesystem. A good "warm up" wave for test campaigns.

---

## Promote to Main KDD?

Suggested learnings worth promoting:
- Asset ID strips `.html` extension — document in FliDeck API reference
- PresentationService singleton isolation pattern for tests
- Minimal express app + errorHandler test helper pattern

Human makes final call.

---

## Suggestions for Next Campaign

**B042 (HIGH)** — Fix singleton isolation: add `afterAll` reset in `query.routes.test.ts`, `assets.routes.test.ts`, `presentations.routes.test.ts`. Alternatively configure `pool: 'forks'` in `server/vitest.config.ts`. Do this before CI integration.

**B043 (medium)** — Strengthen weak assertions: schema test, asset content verification, capabilities `api_summary` key check, config `history` array.

**AGENTS.md additions for next campaign:**
- Add asset ID convention (strip `.html`) to Architecture section
- Add PresentationService isolation pattern with `afterAll` example
- Add shared test helper pattern for filesystem-backed tests
