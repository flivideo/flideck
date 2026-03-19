# IMPLEMENTATION_PLAN.md — FliDeck Assertion Strengthening

**Goal**: Replace weak/near-false-positive test assertions identified in the B041 quality audit. Target 4 files, 6 specific fixes.
**Started**: 2026-03-19
**Target**: All 139 tests pass. Each fixed assertion would catch a real regression if the code broke.

## Summary
- Total: 1 | Complete: 0 | In Progress: 0 | Pending: 1 | Failed: 0

---

## Pending

- [ ] strengthen-assertions — Fix 6 weak assertions across 3 test files (see AGENTS.md for exact changes)

---

## In Progress

---

## Complete

---

## Notes & Decisions

- schema: `$schema` = `"http://json-schema.org/draft-07/schema#"`, `title` = `"FliDeck Presentation Manifest"`, `type` = `"object"` — all concrete assertable values
- assets: error path should use `/test-deck/nonexistent` (no extension, known presentation, unknown asset) not `/nonexistent-deck/nonexistent.html`
- capabilities: add `api_summary.presentations` key check
- config: add `history` array check
- Single agent, single wave — all changes are isolated test file edits
