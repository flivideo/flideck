# Next Round Brief — FliDeck Docs Cleanup

**Goal**: Three small documentation cleanup items surfaced by the B015 AC sign-off campaign.

**Background**: B015 audit found stale ACs (FR-28), missing changelog entries (B016), and a known-broken test (B040). All three are low-risk, docs-or-test only — no feature work.

---

## Item 1 — B016: Missing Changelog Entries

Write 13 missing changelog entries for FR-16 through FR-28 (late-Dec build burst that never got documented).

**Source**: git log + PRD files in `docs/prd/`. Each FR/BUG PRD has a Summary and completion notes — changelog entries derive from those.

**Format**: Check existing `CHANGELOG.md` at repo root for the entry format in use.

**Suggested wave structure**: 2–3 agents, each covering 4–5 FRs:
- Agent 1: FR-16, FR-17, FR-18 (archived), FR-19, FR-20
- Agent 2: FR-21, FR-22, FR-23 (deferred), FR-24, FR-25
- Agent 3: FR-26, FR-27, FR-28, BUG fixes from the same period

---

## Item 2 — FR-28 AC Rewrite

Replace 8 stale drag-to-resize ACs in `docs/prd/fr-28-resizable-sidebar.md` with ACs that describe the actual S/M/L preset button implementation.

**Context**: FR-28 was originally designed as drag-to-resize. A 2026-01-07 redesign replaced it with S/M/L preset buttons (280/380/480px). The old drag ACs are permanently open because the feature doesn't exist. The new implementation is in `client/src/hooks/useResizableSidebar.ts` and `client/src/components/layout/Sidebar.tsx` (lines 746-798).

**What to do**: One agent reads the current implementation, then rewrites the 8 open drag ACs to describe what's actually built (S button = 280px, M = 380px, L = 480px, active state highlighted, localStorage persistence, etc.).

**Verified ACs to keep**: 4 ACs are already correctly ticked — localStorage, restore on load, all display modes, flex-1. Don't touch those.

---

## Item 3 — B040: Proto-Pollution Guard Test (Third Attempt)

Fix the broken proto-pollution guard test in `server/src/services/__tests__/ManifestService.test.ts`.

**Context**: Two prior attempts failed:
1. `Object.prototype` assertion — V8 intercepts `obj['__proto__'] = value` as prototype assignment silently
2. Written-output inspection via `JSON.parse` — JSON.stringify never serializes `__proto__` regardless of guard

**Suggested fix** (from BACKLOG.md): Change `deepMerge` to use a null-prototype base object (`Object.create(null)`) so `__proto__` key assignment has nowhere to attach. OR document the behaviour as untestable via normal Node.js means and skip/comment the test with an explanation.

**Decision needed**: Implement the null-prototype fix (changes `deepMerge` in `ManifestService.ts`) OR accept untestable and document it. The null-prototype approach is safe but changes production code behaviour slightly (merged objects won't inherit from Object.prototype — check if any callers rely on `.hasOwnProperty()` etc.).

---

## Session State (as of 2026-03-19)

- 139 tests passing (35 client + 104 server)
- Main branch clean, no open worktrees
- B015 complete — all 34 PRD files reviewed
