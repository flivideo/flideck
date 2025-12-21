# Brainstorming Notes

Ideas and exploration for FliDeck.

---

## Active Brainstorms

### Content Search (Cmd+Shift+F)

**Status:** Parked (future)
**Date:** 2025-12-21

**The Problem:**
Sometimes you remember something was mentioned in a slide but don't remember which presentation or slide it's in. Filtering by name (FR-9) won't help - you need to search inside the HTML content.

**Ideas:**
- Server parses HTML files and builds searchable index
- Cmd+Shift+F opens content search (distinct from Cmd+K name filter)
- Results show matches with context snippets
- Could be slow for many presentations - may need indexing strategy

**Open Questions:**
- [ ] How to index? On-demand parsing vs background indexing?
- [ ] What to search? Text content only, or also HTML attributes?
- [ ] How to display results? Snippet preview? Jump to match?

**Notes:**
Emerged from Cmd+K brainstorm as "Problem B". Decided to ship name filtering first (FR-9), then revisit content search when the need becomes clearer.

---

### Top-Level Keyboard Shortcuts

**Status:** Captured (small)
**Date:** 2025-12-21

**The Problem:**
Navigation between major pages (home/dashboard, presentation routes, presentations) feels clunky. The existing keyboard shortcuts work well *within* a presentation (next/prev slide), but getting *between* major areas needs improvement.

**Ideas:**
- Cmd+H or Cmd+1 → Home/Dashboard
- Cmd+2/3/4 → Jump to specific presentation route
- Escape from presentation → back to route list
- Breadcrumb-style navigation shortcuts

**Scope:**
Small - probably just needs a list of what's missing and a quick implementation. Doesn't warrant full brainstorming.

**Notes:**
Captured via idea-capture pattern. When ready, promote to a small FR.

---

<!--
Template:

### [Topic Name]
**Status:** Exploring
**Date:** YYYY-MM-DD

**The Problem:**
[What pain or opportunity exists]

**Ideas:**
- Idea 1
- Idea 2

**Open Questions:**
- [ ] Question 1
- [ ] Question 2

**Notes:**
[Any additional context]

---
-->

---

## Parked Ideas

_Ideas not pursuing now but might revisit later._

---

## Promoted to Requirements

| Brainstorm | Promoted To | Date |
|------------|-------------|------|
| Quick Filter (Cmd+K) | FR-9 | 2025-12-21 |
| Query API (stats) | FR-10 | 2025-12-21 |
| Claude Skill | FR-11 | 2025-12-21 |
| Copy Path to Clipboard | FR-12 | 2025-12-21 |

<!--
When a brainstorm becomes a requirement:
1. Add row to this table
2. Remove or minimize the brainstorm section above
3. Write full requirement in backlog.md
-->
