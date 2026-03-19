# Next Round Brief — FliDeck B015 AC Sign-Off

**Goal**: Review and sign off the 292 unchecked acceptance criteria across 34 PRD files in `docs/prd/`. Tick `[x]` on ACs that are implemented, mark dismissed on explicitly deferred/archived items, leave genuinely pending items as-is.

**Background**: A report was generated 2026-03-06 (`docs/planning/flideck-cleanup-2026/learnings/unchecked-acs.md`) cataloguing all unchecked ACs. Many features are built but the PRD checkboxes were never updated.

## Suggested Wave Structure

**Wave 1 — Easy dismissals (no code check needed):**
- FR-18 (Archived — superseded by FR-20): mark all 8 ACs as dismissed
- FR-22/FR-23 deferred items: mark as deferred
- BUG-3 (Closed - Not a Bug): mark 5 ACs as dismissed

**Wave 2 — Verify "Fixed/Implemented" bugs (BUG-1 through BUG-15):**
- Read each BUG PRD + read relevant source files
- Tick ACs that are verifiably in the code

**Wave 3 — Verify "Complete/Implemented" FRs (FR-19, FR-21, FR-24 through FR-28):**
- Read each FR PRD + check implementation
- FR-10 (Query API) is now implemented — all 6 ACs should be ticked
- FR-11 (FliDeck Claude Skill) — check if SKILL.md exists

**Leave as-is (genuinely pending):**
- FR-29 (Slide Notes), FR-30 (Image-to-Slide Script), FR-31 (Image Auto-Discovery), FR-32 (Image Import API), NFR-1 (Real-Time File Watching)

## Key Files
- Full unchecked AC list: `docs/planning/flideck-cleanup-2026/learnings/unchecked-acs.md`
- PRD files live in: `docs/prd/`
- Source: `server/src/routes/`, `server/src/services/`, `client/src/`

## Session State (as of 2026-03-19)
- 139 tests passing (35 client + 104 server)
- All B013 (Vite 7), B041 (route integration tests), B042 (singleton isolation), B043 (assertion strengthening) complete
- Main branch is clean, no open worktrees
