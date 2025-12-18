# FliDeck Documentation

Documentation for FliDeck - Local-first presentation harness for folder-based HTML artifacts.

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

```
docs/
├── prd/                  # Individual requirement specs (FR-XX, NFR-XX)
├── planning/             # Architecture, initial requirements
├── uat/                  # User Acceptance Testing results
├── backlog.md            # Requirements index (status tracking)
├── changelog.md          # Version history
├── brainstorming-notes.md
└── README.md             # This file
```

---

## Workflow

```
Stakeholder (David)
       │
       ▼
┌─────────────────┐
│  /po Agent      │  ← Requirements gathering
│  backlog.md     │  ← Index with status
│  prd/*.md       │  ← Detailed specs
└────────┬────────┘
         │ status → "With Developer"
         ▼
┌─────────────────┐
│  /dev Agent     │  ← Reads PRD, implements
│  [code]         │  ← Code changes
└────────┬────────┘
         │ status → "Implemented"
         ▼
┌─────────────────┐
│  /uat Agent     │  ← Testing (optional)
│  uat/*.md       │  ← Test results
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  changelog.md   │  ← History updated
└─────────────────┘
```

---

## Related

- **Application code**: `../`
- **Slash commands**: `../.claude/commands/` (inherited from FliVideo)
- **Skills**: `../.claude/skills/` (inherited from FliVideo)
