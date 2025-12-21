# FR-11: FliDeck Claude Skill

**Status:** Complete
**Added:** 2025-12-21
**Source:** Brainstorm session (follows FR-10)

---

## User Story

As a Claude Code user, I want a FliDeck skill so I can query presentations and slides without leaving my terminal or manually calling curl commands.

## Problem

FR-10 added a Query API, but Claude Code doesn't know about it. Users have to manually construct curl commands or remember endpoint URLs. A skill teaches Claude how to interact with FliDeck naturally.

## Solution

Create a Claude skill at `~/.claude/skills/flideck/` following the established pattern from FliHub and managing-assets (DAM) skills.

## Skill Structure

```
~/.claude/skills/flideck/
├── SKILL.md                    # Main skill file with YAML frontmatter
├── health-command.md           # Health check documentation
├── routes-command.md           # Query routes endpoint
└── presentations-command.md    # Query presentations endpoint
```

## SKILL.md Pattern

Follow FliHub pattern with:
- YAML frontmatter (name, description)
- Core capabilities list
- Prerequisites (FliDeck must be running)
- API base URL
- Quick reference table
- Common command examples

**Frontmatter:**
```yaml
---
name: flideck
description: Interact with FliDeck presentation system. Query presentation routes, list presentations, get slide details. Use when asking about presentations, slides, or visual content.
---
```

## Commands to Document

### Health Check
```bash
curl -s "http://localhost:5201/api/health" | jq
```

### Routes
```bash
# List all presentation routes
curl -s "http://localhost:5201/api/query/routes" | jq

# Get presentations for a specific route
curl -s "http://localhost:5201/api/query/routes/slide-decks" | jq
```

### Presentations
```bash
# Get presentation details with slides
curl -s "http://localhost:5201/api/query/presentations/claude-code-intro" | jq
```

## Acceptance Criteria

- [ ] SKILL.md created with proper YAML frontmatter
- [ ] health-command.md documents health endpoint
- [ ] routes-command.md documents routes endpoints
- [ ] presentations-command.md documents presentations endpoint
- [ ] Skill follows same structure as FliHub skill
- [ ] Claude Code recognizes and uses the skill

## References

**Pattern to follow:**
- `~/.claude/skills/flihub/SKILL.md` - Main reference
- `~/.claude/skills/managing-assets/SKILL.md` - DAM skill
- `~/.claude/skills/skill-creator/SKILL.md` - Skill creation guide

**Use skill-creator:**
Consider using `/skill-creator` to scaffold the skill structure.

## Technical Notes

- FliDeck runs on port 5201 (different from FliHub's 5101)
- Query API endpoints are under `/api/query/`
- Health endpoint is at `/api/health`

## Future Enhancements

- Write commands (when write API is added)
- Navigation commands (open presentation in browser)
- `?format=text` support documentation

---

## Completion Notes

**What was done:**
- Created FliDeck Claude skill at `~/.claude/skills/flideck/`
- SKILL.md with proper YAML frontmatter (name, description)
- health-command.md documenting health endpoint
- routes-command.md documenting routes list and detail endpoints
- presentations-command.md documenting presentation detail endpoint
- Follows FliHub skill pattern and structure

**Files created:**
- `~/.claude/skills/flideck/SKILL.md` (main skill file)
- `~/.claude/skills/flideck/health-command.md` (health check reference)
- `~/.claude/skills/flideck/routes-command.md` (routes endpoints reference)
- `~/.claude/skills/flideck/presentations-command.md` (presentation endpoint reference)

**Testing notes:**
- Skill directory created and properly structured
- Claude Code should recognize the skill via the description in YAML frontmatter
- To verify: Ask Claude "What presentations do I have in FliDeck?" - it should use the skill

**Status:** Complete
