# AGENTS.md — FliDeck AC Sign-Off

## Project Overview

**Project**: FliDeck — local-first presentation harness (React 19 + Vite 7 + Express 5)
**Campaign**: flideck-ac-signoff — sign off 292 unchecked acceptance criteria across 34 PRD files
**Stack**: React 19 + Vite 7 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest

This is a **documentation review campaign**, not a code campaign. Agents read PRD files, verify claims against source code, and update checkboxes. No new code is written.

---

## Build & Run Commands

```bash
# Confirm tests still pass (run after any accidental file change)
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm test

# TypeScript check
cd client && npx tsc --noEmit
cd ../server && npx tsc --noEmit
```

---

## Directory Structure

```
flideck/
├── docs/prd/                        # PRD files — these are what agents modify
│   ├── bug-01-group-creation-fails.md
│   ├── bug-02-navigation-after-tab-click.md
│   ├── bug-03-groups-out-of-order.md
│   ├── ... (one file per BUG/FR/NFR)
├── client/src/
│   ├── components/layout/           # Sidebar, TabBar, Header
│   ├── components/ui/               # AssetViewer, QuickFilter
│   ├── hooks/                       # useDisplayMode, useKeyboardBridge, etc.
│   ├── pages/                       # PresentationPage, ConfigPage
│   └── utils/                       # displayMode.ts
├── server/src/
│   ├── routes/                      # presentations.ts, config.ts, assets.ts, etc.
│   ├── services/
│   │   ├── PresentationService.ts   # Core discovery + manifest
│   │   └── ManifestService.ts       # Manifest CRUD
│   └── utils/
│       └── responseHelper.ts        # createApiResponse
├── shared/src/
│   └── types.ts                     # Shared TypeScript types
└── SKILL.md                         # FliDeck skill (check existence for FR-11)
```

---

## Checkbox Convention (CRITICAL — read before editing any file)

Three states used in PRD files:

| Markdown | Meaning | When to use |
|----------|---------|-------------|
| `- [x] …` | Verified implemented | You found the implementation in source code and can cite it |
| `- [-] …` | Dismissed or deferred | AC is from an archived/superseded FR, a closed non-bug, or explicitly deferred |
| `- [ ] …` | Not verified / pending | Genuinely not implemented, or open bug — **leave as-is** |

**Dismiss format** — add an inline comment:
```markdown
- [-] Group creation works in grouped mode <!-- dismissed: BUG-3 closed - not a bug -->
```

**Verify format** — tick only, no comment needed:
```markdown
- [x] JSON Schema file created at `shared/schema/manifest.schema.json`
```

**When uncertain** — ALWAYS leave as `[ ]`. Never speculatively tick.

---

## Decision Rules

### Wave 1 (dismissals) — read PRD header only, do NOT read source

- **FR-18**: Header says "ARCHIVED — superseded by FR-20". Dismiss all 8 ACs with: `<!-- dismissed: FR-18 archived, superseded by FR-20 -->`
- **FR-22 deferred items**: The 4 drag-tab ACs are marked "(deferred - less critical)" / "(deferred)" in the PRD. Dismiss with: `<!-- dismissed: explicitly deferred in FR-22 -->`
- **FR-23**: Header or status says "Deferred". Dismiss all 17 ACs with: `<!-- dismissed: FR-23 entirely deferred -->`
- **BUG-3**: Status is "Closed - Not a Bug". Dismiss all 5 ACs with: `<!-- dismissed: BUG-3 closed - not a bug -->`

### Wave 2 (bug verification)

For each "Status: Fixed" or "Status: Complete" bug PRD:
1. Read the PRD to understand what was fixed
2. Read the relevant source file(s) to find the fix
3. For each AC: tick `[x]` if you find the implementation, leave `[ ]` if not found
4. For "Status: Open" bugs (BUG-9, BUG-10, BUG-14): do NOT modify — leave all ACs as `[ ]`

### Wave 3 (FR verification)

For each "Status: Implemented" or "Status: Complete" FR PRD:
1. Read the PRD to understand what was built
2. Read the relevant source file(s) to verify
3. For each AC: tick `[x]` if found, leave `[ ]` if not found
4. For single deferred ACs within an otherwise-implemented FR: dismiss with `<!-- dismissed: deferred -->`
5. **FR-10 special case**: unchecked-acs.md says "Pending" but the next-round-brief says it's now implemented. Check `server/src/routes/` for a query route before deciding.
6. **FR-11 special case**: Check if `SKILL.md` exists at `/Users/davidcruwys/dev/ad/flivideo/flideck/SKILL.md` before ticking ACs.

### Never touch these files (genuinely pending)

- `docs/prd/fr-29-slide-notes.md`
- `docs/prd/fr-30-image-to-slide-script.md`
- `docs/prd/fr-31-image-file-auto-discovery.md`
- `docs/prd/fr-32-image-import-api.md`
- `docs/prd/nfr-01-real-time-file-watching.md`

---

## Source File Quick-Reference (for verification agents)

| What to verify | Where to look |
|----------------|---------------|
| Tab navigation, tab bar renders | `client/src/components/layout/TabBar.tsx` (if exists) or search for `tabs` in `PresentationPage.tsx` |
| Display mode persist (localStorage) | `client/src/hooks/useDisplayMode.ts` |
| Groups auto-expand on keyboard nav | `client/src/components/layout/Sidebar*.tsx` |
| Keyboard navigation | `client/src/hooks/useKeyboardBridge.ts`, `PresentationPage.tsx` |
| Presentation discovery rules | `server/src/services/PresentationService.ts` — `discoverAll()` |
| Manifest schema endpoint | `server/src/routes/schema.ts` or `manifest.ts` |
| Query API (FR-10) | `server/src/routes/` — search for `/query` |
| Agent capability endpoint (FR-27) | `server/src/routes/capabilities.ts` |
| Resizable sidebar | `client/src/components/layout/Sidebar*.tsx` — look for drag handle / localStorage width |
| Index HTML sync (FR-26) | `server/src/routes/presentations.ts` — `sync-from-index` endpoint |
| Branding (FR-4) | `client/src/` — look for brand colors / AppyDave palette |
| Config simplify (FR-6) | Check that `FolderBrowser.tsx` does NOT exist in `client/src/` |
| Claude skill (FR-11) | `SKILL.md` at repo root |
| Container tabs API (FR-24) | `server/src/routes/presentations.ts` — `/tabs` endpoints |
| Smart display mode (FR-25) | `client/src/hooks/useDisplayMode.ts` or `PresentationPage.tsx` |

---

## Success Criteria

Before marking any work unit complete:

- [ ] All target ACs in the assigned PRD files have been reviewed (none skipped)
- [ ] `[x]` ticks are backed by a source citation (you actually read the file)
- [ ] `[-]` dismissals include the inline comment explaining why
- [ ] `[ ]` items left open are genuinely not found or are open bugs
- [ ] No PRD files outside the assigned scope were modified
- [ ] Report back: N ticked, M dismissed, P left open — with a brief note on anything surprising

---

## Anti-Patterns to Avoid

- **Never speculatively tick** — "the feature sounds implemented" is not enough; find the code
- **Never modify open-bug PRDs** (BUG-9, BUG-10, BUG-14) — leave all their ACs as `[ ]`
- **Never modify pending PRDs** (FR-29, 30, 31, 32, NFR-1)
- **Never write new code** — this campaign is read-only except for PRD checkbox updates
- **Never run tests to verify ACs** — verify by reading source, not by running the app
- **Never dismiss by inference** — only dismiss when the PRD explicitly says archived/deferred/closed

---

## Quality Gates

1. Every AC in assigned files has been explicitly reviewed (no skipped lines)
2. Report includes a count: X ticked / Y dismissed / Z left open
3. No modification to any source file (`.ts`, `.tsx`, `.json` etc.) — PRD `.md` files only

---

## Learnings

_(Updated by coordinator as waves complete)_

- Wave 1 is pure text editing — no source reading, 4 agents can run in parallel safely
- Each PRD file is independent — no risk of conflict between agents working on different PRDs
- FR-10 status conflict (unchecked-acs says Pending, brief says implemented) — must verify in code
- 139 tests passing on main as of 2026-03-19 — this campaign should not change that count
