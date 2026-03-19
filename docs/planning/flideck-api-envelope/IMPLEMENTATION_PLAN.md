# IMPLEMENTATION_PLAN.md — FliDeck API Envelope

**Goal**: Adopt `createApiResponse<T>()` and `createErrorResponse()` from `utils/responseHelper.ts` across all 7 route files — replacing inline envelope construction with the canonical helper.
**Started**: 2026-03-19
**Target**: All 38 route handlers return responses through `createApiResponse` or `createErrorResponse`. 0 TS errors. All existing 100 tests pass.

## Summary
- Total: 2 | Complete: 2 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

(none)

---

## In Progress

(coordinator moves items here with [~])

---

## Complete

- [x] adopt-envelope-presentations — 33 inline constructions replaced in presentations.ts; 0 remaining; _context preserved on 4 GET endpoints; createErrorResponse used for execFile error. (2026-03-19)
- [x] adopt-envelope-others — 10 responses wrapped across 6 files; query.ts/schema.ts/templates.ts/capabilities.ts promoted from raw objects to envelopes. (2026-03-19)

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
