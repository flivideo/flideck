# IMPLEMENTATION_PLAN.md — FliDeck API Envelope

**Goal**: Adopt `createApiResponse<T>()` and `createErrorResponse()` from `utils/responseHelper.ts` across all 7 route files — replacing inline envelope construction with the canonical helper.
**Started**: 2026-03-19
**Target**: All 38 route handlers return responses through `createApiResponse` or `createErrorResponse`. 0 TS errors. All existing 100 tests pass.

## Summary
- Total: 2 | Complete: 0 | In Progress: 0 | Pending: 2 | Failed: 0

---

## Pending

### Wave 1 — 2 agents in parallel (non-overlapping files)

- [ ] adopt-envelope-presentations — Adopt createApiResponse in `server/src/routes/presentations.ts` (28 handlers); also replace `res.status(500).json({ success: false, error })` with `createErrorResponse`
- [ ] adopt-envelope-others — Adopt createApiResponse in `assets.ts`, `config.ts`, `query.ts`, `schema.ts`, `templates.ts`, `capabilities.ts` (10 handlers total)

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

- Wave 1 agents are safe to run in parallel — non-overlapping files
- No existing tests assert on HTTP response body shape — safe to change envelope construction
- The `_context` object appears in presentations.ts responses; it passes as the second arg to createApiResponse
- Baseline: 35 client + 65 server = 100 tests — must not regress
- Backlog items addressed: B014
