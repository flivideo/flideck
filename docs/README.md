# FliDeck Documentation

Documentation for FliDeck - Local-first presentation harness for folder-based HTML artifacts.

> **Status: inactive.** FliDeck is not in active development (last commit 2026-10-09; backlog closed, 60/60 done). There is no `uat/` folder.

---

## Quick Links

| Document                                         | Purpose                        |
| ------------------------------------------------ | ------------------------------ |
| [backlog.md](backlog.md)                         | Requirements index with status |
| [changelog.md](changelog.md)                     | Implementation history         |
| [brainstorming-notes.md](brainstorming-notes.md) | Ideas and exploration          |
| [prd/](prd/)                                     | Individual requirement specs   |

---

## Documentation Structure

```
docs/
├── prd/                  # Individual requirement specs (FR-XX, NFR-XX, bugs)
├── planning/             # Architecture, requirements, BACKLOG.md, and one folder per work round
├── architecture/         # Knowledge base, sidebar/page relationships
├── api-examples/         # Worked API examples
├── agent-guide.md        # Creating or modifying presentations as an agent
├── harness-authoring-standard.md  # How a slide must be written to render
├── backlog.md            # Requirements index (status tracking)
├── changelog.md          # Implementation history
├── brainstorming-notes.md
├── developer-handover-2025-12-24*.md, analysis-2025-12-24-tab-architecture.md, flihub-migration-instructions.md  # Dated historical notes
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
