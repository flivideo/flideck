# IMPLEMENTATION_PLAN.md — FliDeck Assertion Strengthening

**Goal**: Replace weak/near-false-positive test assertions identified in the B041 quality audit. Target 4 files, 6 specific fixes.
**Started**: 2026-03-19
**Target**: All 139 tests pass. Each fixed assertion would catch a real regression if the code broke.

## Summary
- Total: 1 | Complete: 1 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

(none)

---

## In Progress

---

## Complete

- [x] strengthen-assertions — 6 assertions fixed across schema (1), assets (2), capabilities (2) test files; 139 tests pass. (2026-03-19)

---

## Notes & Decisions

- schema: `$schema` = `"http://json-schema.org/draft-07/schema#"`, `title` = `"FliDeck Presentation Manifest"`, `type` = `"object"` — all concrete assertable values
- assets: error path should use `/test-deck/nonexistent` (no extension, known presentation, unknown asset) not `/nonexistent-deck/nonexistent.html`
- capabilities: add `api_summary.presentations` key check
- config: add `history` array check
- Single agent, single wave — all changes are isolated test file edits
