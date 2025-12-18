# FliHub Documentation Migration Instructions

Migrate FliHub docs to match FliDeck's new PRD-based structure.

---

## Target Structure

```
docs/
├── prd/                    # Individual requirement specs
│   ├── fr-01-name.md
│   ├── fr-02-name.md
│   └── nfr-01-name.md
├── planning/               # Architecture docs (keep as-is)
├── uat/                    # Test results (keep as-is)
├── backlog.md              # INDEX ONLY (table with links)
├── changelog.md            # Keep as-is
├── brainstorming-notes.md  # Keep as-is
└── README.md               # Update to match new structure
```

---

## Step 1: Audit Current Structure

```bash
cd /path/to/flihub
ls -la docs/
```

Note what exists:
- [ ] `backlog.md` - does it have inline requirement details?
- [ ] `docs/prd/` - does it exist? what's in it?
- [ ] `handover-queue.md` - exists? (will be deleted)
- [ ] How many FRs/NFRs are documented?

---

## Step 2: Extract Requirements to PRD Files

For each requirement in `backlog.md`:

1. Create file: `docs/prd/fr-XX-short-name.md`
2. Use this template:

```markdown
# FR-XX: [Title]

**Status:** [Copy from backlog - Pending/Implemented]
**Added:** [Copy from backlog]
**Implemented:** [Date if complete, otherwise -]

---

## User Story

[Copy or write: As a [user], I want [goal] so that [benefit]]

## Problem

[What pain exists]

## Solution

[How we're solving it]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes

[Implementation guidance]

## Completion Notes

[If implemented, copy any completion notes. Otherwise: _To be filled by developer._]
```

3. Name files with kebab-case: `fr-01-video-upload.md`, `nfr-01-performance.md`

---

## Step 3: Slim Down backlog.md

Replace the entire file with just the index:

```markdown
# Backlog

Requirements index for FliHub.

## Requirements

| # | Requirement | Added | Status |
|---|-------------|-------|--------|
| 1 | [FR-1: Title](prd/fr-01-name.md) | YYYY-MM-DD | Implemented |
| 2 | [FR-2: Title](prd/fr-02-name.md) | YYYY-MM-DD | Pending |
| 3 | [NFR-1: Title](prd/nfr-01-name.md) | YYYY-MM-DD | Pending |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `Pending` | Ready for development |
| `With Developer` | Currently being implemented |
| `Implemented` | Complete |
| `Needs Rework` | Issues found |

## Numbering

- **FR-X** - Functional Requirements (user-facing features)
- **NFR-X** - Non-Functional Requirements (technical improvements)

## Adding Requirements

1. Create new file: `docs/prd/fr-XX-short-name.md`
2. Add row to table above
3. Update status as work progresses
```

---

## Step 4: Delete handover-queue.md

```bash
rm docs/handover-queue.md
```

The PRD files are now the handover - no separate queue needed.

---

## Step 5: Update docs/README.md

Remove references to `handover-queue.md`. Use this template:

```markdown
# FliHub Documentation

Documentation for FliHub - [description].

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [backlog.md](backlog.md) | Requirements index with status |
| [changelog.md](changelog.md) | Implementation history |
| [brainstorming-notes.md](brainstorming-notes.md) | Ideas and exploration |
| [prd/](prd/) | Individual requirement specs |

---

## Documentation Structure

\`\`\`
docs/
├── prd/                  # Individual requirement specs (FR-XX, NFR-XX)
├── planning/             # Architecture, initial requirements
├── uat/                  # User Acceptance Testing results
├── backlog.md            # Requirements index (status tracking)
├── changelog.md          # Version history
├── brainstorming-notes.md
└── README.md             # This file
\`\`\`
```

---

## Step 6: Verify Commands Work

The shared commands (`/po`, `/dev`, `/progress`) in `.claude/commands/` should already be updated if FliHub inherits from FliVideo.

If FliHub has its own commands, update them to:
- Remove `handover-queue` skill references
- Point to `docs/prd/` for requirements
- Update status in `backlog.md` directly

---

## Quick Reference

| Old Pattern | New Pattern |
|-------------|-------------|
| Inline details in `backlog.md` | Separate PRD files in `docs/prd/` |
| `handover-queue.md` for dev handoff | PRD file IS the handoff |
| `handover-queue` skill | Not needed - update `backlog.md` status directly |
| Status: `With Developer` | Same - but dev reads PRD directly |

---

## Checklist

- [ ] Audit current docs structure
- [ ] Create `docs/prd/` directory if missing
- [ ] Extract each FR/NFR to individual PRD file
- [ ] Slim `backlog.md` to index table only
- [ ] Delete `handover-queue.md`
- [ ] Update `docs/README.md`
- [ ] Verify `/po`, `/dev`, `/progress` commands work
- [ ] Commit changes
