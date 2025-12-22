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

### Unified Manifest & Ordering System

**Status:** Promoted to FR-13, FR-14, FR-15
**Date:** 2025-12-22

**The Problem:**
Three different ordering systems exist that don't talk to each other:
1. `flideck.json` - FliDeck's sidebar order (simple array)
2. `index.yaml` - Agent's rich metadata (file, title, group, type, tags)
3. `index.html` - Static HTML with hardcoded card order

This causes:
- Default order is alphabetical, not creation time
- Sidebar order doesn't match index.html order
- No groupings/tabs in sidebar (BMAD-poem has sections in index.html but flat sidebar)
- Agents and FliDeck write different files with different schemas

**Decisions Made:**

1. **Rename `flideck.json` → `index.json`** - aligns with "index is the root" convention used by SoloDeck and other agents

2. **One file, shared schema** - both agents and FliDeck read/write the same file
   - Agents can CREATE it (when building new decks)
   - Agents can UPDATE it (add/remove/modify slides)
   - FliDeck can REORDER it (drag-drop in sidebar)

3. **Default order = creation time** - when no manifest exists, sort by file mtime, not alphabetically

4. **Rich schema with groups** - expand beyond simple order array to include title, group, type metadata

5. **FliDeck API as schema guardian (future)** - agents should prefer calling FliDeck API over direct file writes, with fallback to direct writes when FliDeck is offline

6. **Hybrid index.html rendering** - SoloDeck generates cards with IDs, small JS script reorders DOM based on index.json:
   ```html
   <div id="card-slides" class="asset-card">...</div>
   <script>
     fetch('index.json').then(r => r.json()).then(data => {
       const grid = document.querySelector('.assets-grid');
       data.assets.order.forEach(file => {
         const card = document.getElementById('card-' + file.replace('.html', ''));
         if (card) grid.appendChild(card);
       });
     });
   </script>
   ```

**Layers:**

| Layer | Scope | Status |
|-------|-------|--------|
| 1 | Default sort = creation time | → FR-13 |
| 1 | Rename flideck.json → index.json | → FR-14 |
| 2 | Rich schema with groups, sidebar groupings | → FR-15 |
| 3 | API endpoints for agents | → FR-16 |
| 3 | Hybrid index.html with JS reorder | SoloDeck change (not FliDeck) |

**Note on Hybrid index.html:** FliDeck already serves `index.json` via the query API (FR-10). SoloDeck can fetch it at `http://localhost:5201/api/presentations/:id`. The JS reorder script is a SoloDeck pattern change, not a FliDeck feature.

**Open Questions:**
- [ ] Fallback behavior when FliDeck is offline - agents write index.json directly
- [ ] SoloDeck changes needed for hybrid index.html (card IDs + JS fetch/reorder)

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
| Unified Manifest & Ordering | FR-13, FR-14, FR-15, FR-16 | 2025-12-22 |

<!--
When a brainstorm becomes a requirement:
1. Add row to this table
2. Remove or minimize the brainstorm section above
3. Write full requirement in backlog.md
-->
