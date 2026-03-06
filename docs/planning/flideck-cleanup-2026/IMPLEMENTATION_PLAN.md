# IMPLEMENTATION_PLAN.md — FliDeck Cleanup 2026

**Goal**: Clean up technical debt accumulated across 6 weeks of rapid feature development — dead code, critical bugs, type safety, test coverage, and dependency security.
**Started**: 2026-03-06
**Completed**: 2026-03-06
**Target**: All HIGH/CRITICAL findings from R1-R5 research addressed; 0 known security vulns; >40% test coverage on pure functions; no dead files.

## Summary
- Total: 21 | Complete: 21 | In Progress: 0 | Pending: 0 | Failed: 0

## In Progress

(nothing)

## Pending

(nothing)

## Complete

### Wave 1: Quick Wins

- [x] dead-code-server — Deleted `server/src/config/env.ts` and `server/src/config/logger.ts`. Commit: `9e5ea8b`. (2026-03-06)
- [x] dead-code-client — Deleted `client/src/components/layout/Sidebar.old.tsx` (1071 lines) and `client/src/hooks/useModifierKey.ts`. Commit: `1b54339`. (2026-03-06)
- [x] fix-config-watcher-bug — CRITICAL BUG FIXED. Watcher restart now passes `onPresentationChange` callback. Live reload no longer breaks after API config change. Commit: `2d7e253`. (2026-03-06)
- [x] dead-code-display-mode — Removed `'tabbed'` from DisplayMode union, deleted 4 dead functions, removed useActiveTab hook, fixed manifestTemplates.ts. Commit: `05cf496`. (2026-03-06)
- [x] fix-iframe-origin — postMessage origin validation added. Case-insensitive `<head>` injection fixed. Commit: `6d43fbd`. (2026-03-06)

### Wave 2: Tests

- [x] test-display-mode-utils — 16 Vitest tests for detectDisplayMode + getDisplayModeLabel. All passing. Commit: `2338f3d`. (2026-03-06)
- [x] test-manifest-helpers — 24 Vitest tests covering manifestTemplates, queryString, manifestValidator. All passing. Commit: `6fcb952`. (2026-03-06)

### Wave 3: Type Safety + Security

- [x] fix-shared-module-resolution — Fixed @flideck/shared not resolving in workspace tsc. Added paths mapping in both tsconfigs. Both workspaces now pass tsc --noEmit with 0 errors. Commit: `343713d`. (2026-03-06)
- [x] wire-env-ts — Added PORT and CLIENT_URL validation to server/src/index.ts. Invalid env fails fast on startup. Commit: `96b43d5`. (2026-03-06)
- [x] path-traversal-guard — Added `assertSafeId()` helper. Guard applied to 26 call sites in PresentationService.ts. Commit: `f0efa38`. (2026-03-06)
- [x] manifest-read-validation — AJV validation added in `tryReadManifestFile`. Invalid disk manifests log warning and degrade gracefully. Commit: `f0efa38`. (2026-03-06)
- [x] fix-deepmerge-types — Added `typedDeepMerge()` private method. Triple cast eliminated. Commit: `f0efa38`. (2026-03-06)

### Wave 4: Dependencies + Research

- [x] dep-patch-nodemon — `npm audit fix` cleared ALL 4 vulnerabilities (2 HIGH, 1 moderate, 1 low). 0 vulns remaining. Commit: `99c43fd`. (2026-03-06)
- [x] dep-evaluate-vite7 — RECOMMENDATION: UPGRADE NOW. Vite 6.4.1 → 7.3.1. Only breaking change: @vitejs/plugin-react must go v4→v5 (two package.json lines). No config changes needed. Both use rollup v4. Commit: `916b5aa`. (2026-03-06)
- [x] dep-response-envelope — 5 shapes documented. Worst: manifest spread into top-level body. Recommended canonical: `{ success: true, data: T }`. Future wave work. Commit: `0c4bd97`. (2026-03-06)

### Wave 5: Docs + Backlog Hygiene

- [x] prd-acceptance-criteria — 49 PRDs audited, 292 unchecked ACs across 34 files. Report: `learnings/unchecked-acs.md`. Commit: `cee5d22`. (2026-03-06)
- [x] changelog-audit — 13 implemented FRs missing from changelog (entire late-Dec build burst FR-16→FR-28). Report: `learnings/missing-changelog.md`. Commit: `079504a`. (2026-03-06)
- [x] capabilities-endpoint-update — 5 missing endpoints added to GET /api/capabilities. Commit: `079504a`. (2026-03-06)

## Failed / Needs Retry

(nothing failed)

## Notes & Decisions

- All 21 work units completed in a single day (2026-03-06) via parallel background agents
- Vite 7 upgrade is recommended — easy (2 lines in client/package.json)
- API envelope standardisation is a future wave — decision doc at `decisions/api-envelope.md`
- 292 unchecked ACs need PO/UAT review — `learnings/unchecked-acs.md`
- 13 missing changelog entries need PO to write — `learnings/missing-changelog.md`
- tsc now clean (0 errors) in both client and server workspaces
- 0 known security vulnerabilities (was 4 — 2 HIGH, 1 moderate, 1 low)
- 40 net-new tests added (16 client + 24 server)
