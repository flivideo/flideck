# AGENTS.md — FliDeck Docs Cleanup

## Project Overview

**Project**: FliDeck — local-first presentation harness (React 19 + Vite 7 + Express 5)
**Campaign**: flideck-docs-cleanup — three independent cleanup items from the B015 AC sign-off audit
**Stack**: React 19 + Vite 7 (client) / Express 5 + Vitest (server) / TypeScript

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck

# Run all tests (confirm nothing broken)
npm test

# Server tests only (for B040 fix)
cd server && npm test
```

---

## Directory Structure

```
flideck/
├── CHANGELOG.md                          # Create this (B016)
├── docs/prd/
│   └── fr-28-resizable-sidebar.md        # Edit ACs (FR-28 rewrite)
├── server/src/services/
│   ├── ManifestService.ts                # deepMerge guard lives here
│   └── __tests__/
│       └── ManifestService.test.ts       # Fix proto-pollution test here (B040)
├── client/src/
│   ├── hooks/useResizableSidebar.ts      # S/M/L preset implementation
│   └── components/layout/Sidebar.tsx    # S/M/L buttons (lines 746-798)
```

---

## Work Unit: create-changelog (B016)

Create `/Users/davidcruwys/dev/ad/flivideo/flideck/CHANGELOG.md`.

No existing CHANGELOG — create from scratch using **Keep a Changelog** format (https://keepachangelog.com/en/1.0.0/).

**Format:**
```markdown
# Changelog

All notable changes to FliDeck are documented in this file.

## [Unreleased]

## [0.x.0] - YYYY-MM-DD
### Added
- …
### Fixed
- …
### Changed
- …
```

**Features to document** (read each PRD for the one-line summary):

| FR/BUG | File | Date (from git log) | Status |
|--------|------|---------------------|--------|
| FR-16 | `docs/prd/fr-16-agent-slide-api.md` | 2025-12-22 | Added |
| FR-17 | `docs/prd/fr-17-group-management.md` | 2025-12-22 | Added |
| FR-18 | `docs/prd/fr-18-custom-index-integration.md` | — | Archived (skip or note as Removed) |
| FR-19 | `docs/prd/fr-19-manifest-schema-api.md` | 2025-12-26 | Added |
| FR-20 | `docs/prd/fr-20-ui-rendering-modes.md` | 2025-12-26 | Added |
| FR-21 | `docs/prd/fr-21-agent-manifest-tooling.md` | 2025-12-26 | Added |
| FR-22 | `docs/prd/fr-22-tab-management.md` | 2025-12-26 | Added |
| FR-23 | `docs/prd/fr-23-group-reorder-ui.md` | — | Deferred (skip) |
| FR-24 | `docs/prd/fr-24-container-tab-navigation.md` | 2025-12-26 | Added |
| FR-25 | `docs/prd/fr-25-smart-display-mode.md` | 2025-12-26 | Added |
| FR-26 | `docs/prd/fr-26-index-html-sync.md` | 2025-12-26 | Added |
| FR-27 | `docs/prd/fr-27-agent-capability-discovery.md` | 2025-12-26 | Added |
| FR-28 | `docs/prd/fr-28-resizable-sidebar.md` | 2026-01-07 | Added |

For BUG fixes in the same period, run:
`git log --oneline --format="%ad %s" --date=short` and include notable BUG-12, BUG-13, BUG-15 under ### Fixed.

Group entries by approximate release date. Use `[Unreleased]` for anything not yet tagged.

**Success**: `CHANGELOG.md` exists, has at least 13 feature entries, follows Keep a Changelog format.

---

## Work Unit: rewrite-fr28-acs (FR-28 AC Rewrite)

Edit `/Users/davidcruwys/dev/ad/flivideo/flideck/docs/prd/fr-28-resizable-sidebar.md`.

**Current state**: 8 ACs are `[ ]` with `<!-- superseded: ... -->` comments describing drag-to-resize. These describe a design that was replaced.

**What to do**: Replace those 8 `[ ]` ACs with new ACs describing the actual S/M/L preset button implementation. Read `client/src/hooks/useResizableSidebar.ts` and `client/src/components/layout/Sidebar.tsx` (lines 746-798) first to understand the real implementation.

**Known facts about the S/M/L implementation** (verify in source):
- Three preset buttons: S (280px), M (380px), L (480px)
- Active preset is visually highlighted
- Width persists to localStorage (key: `flideck:sidebarWidth`)
- Width restored on page load
- Works in all display modes

**New ACs to add** (mark `[x]` for each one you verify in source):
```
- [x] Three preset buttons (S/M/L) visible in sidebar header for width selection
- [x] S preset sets sidebar width to 280px
- [x] M preset sets sidebar width to 380px (default)
- [x] L preset sets sidebar width to 480px
- [x] Active preset button is visually highlighted
- [x] Selected width persists to localStorage
- [x] Width preference restored on page load
- [x] Works across all display modes (Flat, Grouped)
```

Remove or replace the 8 stale `[ ]` entries — do not leave them as permanent open items.

**Success**: No `[ ]` ACs remain in FR-28 that describe drag-to-resize. New S/M/L ACs are `[x]` and source-verified.

---

## Work Unit: fix-b040-proto-test (B040)

Edit `/Users/davidcruwys/dev/ad/flivideo/flideck/server/src/services/__tests__/ManifestService.test.ts`.

**The problem**: The proto-pollution guard test (around line 138-155) is vacuous. It asserts that the written JSON file does not contain `__proto__` as an own key — but `JSON.parse` in V8 never produces an object with `__proto__` as an own enumerable key regardless of whether the guard exists. The test passes even if the guard is removed.

**The fix**: Change the assertion to check that `Object.prototype` was NOT polluted by the operation. If the guard didn't exist, calling `deepMerge` with `{__proto__: {polluted: true}}` would execute `result['__proto__'] = {polluted: true}` which JavaScript interprets as `Object.prototype.polluted = true`. So the correct test is:

```typescript
// After calling patchManifest with the malicious payload:
expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
```

**Also add** a cleanup to ensure the test is safe even if it fails (don't pollute Object.prototype between tests):

```typescript
afterEach(() => {
  // Clean up any accidental prototype pollution from this test
  delete (Object.prototype as Record<string, unknown>)['polluted'];
});
```

Or use a `try/finally` within the test itself.

**Keep** the existing setup: `JSON.parse('{"__proto__":{"polluted":true}}')` is the right way to create a payload with `__proto__` as an own property — keep that.

**After the fix**: Run `cd server && npm test` and confirm the proto-pollution test still passes and the count is 104 (unchanged).

**Success**: Test asserts `(Object.prototype as Record<string, unknown>)['polluted']` is `undefined`. All 104 server tests pass.

---

## Success Criteria (all work units)

- [ ] `CHANGELOG.md` exists with 13+ feature entries in Keep a Changelog format
- [ ] FR-28 has no `[ ]` drag-to-resize ACs — replaced with `[x]` S/M/L ACs
- [ ] Proto-pollution test asserts `Object.prototype` was not polluted (not file content)
- [ ] `npm test` in server still passes 104 tests

---

## Anti-Patterns to Avoid

- **Do NOT modify source code** for create-changelog or rewrite-fr28-acs — docs only
- **Do NOT add new features** in fix-b040-proto-test — only change the assertion
- **Do NOT change deepMerge itself** — the guard is correct; only the test assertion is wrong
- **Do NOT add `any` types** in the test fix

---

## Learnings

- All 3 items are independent — no shared files, safe to run in parallel
- Proto-pollution test fix is one assertion + optional afterEach cleanup — very small
- FR-28 AC rewrite requires reading two source files before editing the PRD
- 139 tests passing on main as of 2026-03-19 (35 client + 104 server)
