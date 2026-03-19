# IMPLEMENTATION_PLAN.md — FliDeck AC Sign-Off

**Goal**: Sign off 292 unchecked acceptance criteria across 34 PRD files. Tick `[x]` on implemented ACs, mark `[-]` on explicitly deferred/archived/dismissed items, leave `[ ]` on genuinely pending or open bugs.
**Started**: 2026-03-19
**Target**: All ACs have been reviewed. No `[ ]` remaining except open bugs (BUG-9, BUG-10, BUG-14) and genuinely pending FRs (FR-29, FR-30, FR-31, FR-32, NFR-1).

## Summary
- Total: 16 | Complete: 16 | In Progress: 0 | Pending: 0 | Failed: 0

---

## Pending

### Wave 1 — Dismiss archived/deferred ACs (no code reading needed)


### Wave 2 — Verify bug-fix ACs against source code

- [ ] verify-bug01-bug02 — Verify BUG-1 (group creation fixed) + BUG-2 (nav after tab click) against client source
- [ ] verify-bug04-bug05 — Verify BUG-4 (display mode persist) + BUG-5 (tabbed empty sidebar) against client source
- [ ] verify-bug06-bug07 — Verify BUG-6 (groups auto-expand) + BUG-7 (performance) against client source
- [ ] verify-bug08-bug11 — Verify BUG-8 (tab system) + BUG-11 (discovery rules) against server source
- [ ] verify-bug15 — Verify BUG-15 (keyboard breaks after iframe click) against client source

### Wave 3 — Verify implemented FR ACs against source code

- [ ] verify-fr04-fr06 — Verify FR-4 (branding) + FR-5 (1 deferred touch AC) + FR-6 (config simplify)
- [ ] verify-fr10-fr11 — Verify FR-10 (query API — brief says implemented) + FR-11 (Claude skill)
- [ ] verify-fr19-fr20 — Verify FR-19 (manifest schema/API) + FR-20 (1 deferred migration AC)
- [ ] verify-fr21 — Verify FR-21 (agent manifest tooling — 15 ACs)
- [ ] verify-fr24-fr25 — Verify FR-24 (container tab navigation) + FR-25 (smart display mode)
- [ ] verify-fr26-fr27 — Verify FR-26 (index HTML sync) + FR-27 (capability discovery)
- [ ] verify-fr28 — Verify FR-28 (resizable sidebar)

---

## In Progress

---

## Complete

- [x] dismiss-archived-fr18 — FR-18 already fully ticked [x] from prior work; no unchecked ACs found
- [x] dismiss-deferred-fr22 — 4 deferred drag-tab ACs corrected from [x] → [-] (were incorrectly ticked)
- [x] dismiss-deferred-fr23 — 17 ACs dismissed [-]
- [x] dismiss-closed-bug3 — BUG-3 already fully ticked [x] from prior work; no unchecked ACs found
- [x] verify-bug01-bug02 — BUG-1 (5) + BUG-2 (7): all already ticked, source-verified. No changes.
- [x] verify-bug04-bug05 — BUG-4: 6 ticked, 1 open (tabbed mode removed); BUG-5: 5 ticked, 1 open (no fallback message)
- [x] verify-bug06-bug07 — BUG-6: 13 ticked; BUG-7: 6 ticked, 2 open (benchmark ACs)
- [x] verify-bug08-bug11 — BUG-8 (7) + BUG-11 (7): all already ticked, source-verified. No changes.
- [x] verify-bug15 — BUG-15 (6): all already ticked, source-verified. No changes.
- [x] verify-fr04-fr06 — FR-4 (4✓) + FR-5 (8✓, 1 dismissed: touch deferred) + FR-6 (9✓). All correct.
- [x] verify-fr10-fr11 — FR-10 (6✓ confirmed in query.ts) + FR-11 (6✓ SKILL.md exists). Both verified.
- [x] verify-fr19-fr20 — FR-19 (8✓) + FR-20 (11✓, 1 corrected [x]→[-]: BMAD Poem migration never done).
- [x] verify-fr21 — FR-21 (15✓): bulk slides/groups, sync, position control, 5 templates, dry run, validate, orphans.
- [x] verify-fr24-fr25 — FR-24 (23✓) + FR-25 (13✓, 2 open: Phase 3 visual enhancements not implemented).
- [x] verify-fr26-fr27 — FR-26 (17✓) + FR-27 (7✓). Both fully verified.
- [x] verify-fr28 — FR-28: 4✓ (localStorage, restore, all modes, flex-1); 8 open (drag ACs — implementation uses S/M/L presets, not drag).

---

## Failed / Needs Retry

---

## Notes & Decisions

- Open bugs — leave ACs as `[ ]`, do NOT tick or dismiss: BUG-9, BUG-10, BUG-14
- Genuinely pending FRs — leave entirely alone: FR-29, FR-30, FR-31, FR-32, NFR-1
- Dismiss convention: change `[ ]` → `[-]` and add a trailing `<!-- dismissed: reason -->` comment inline
- Verify convention: change `[ ]` → `[x]` only when you can cite the source file + line/function that implements it
- When uncertain: leave as `[ ]` — do not speculatively tick
- FR-10: unchecked-acs.md says "Pending" but next-round-brief says "now implemented" — agent must verify before ticking
- FR-11: check if `SKILL.md` exists at repo root
- Wave 1 agents should NOT read any source code — dismissals are based on PRD status text only
