# BUG-14: Agent API Missing Slide Authoring Specifications

## Summary

The FliDeck API tells agents what operations are available (CRUD for slides, tabs, groups) but does NOT tell agents HOW to write HTML slides that integrate properly with the FliDeck harness. This results in slides that break keyboard navigation, iframe communication, and other framework features.

## Problem Statement

**Current state:**
- FR-27 provides capability discovery: "here are the API endpoints you can call"
- Agents can create slides, update manifests, manage tabs/groups via API
- But agents don't know the **technical requirements** for HTML content

**What's missing:**
- How should slides handle keyboard events?
- How should slides communicate with the parent FliDeck frame?
- What HTML structure is expected for index/landing pages?
- What card structure allows FliDeck to parse and sync?
- What script should be included for postMessage bridging?

**Impact:**
- Agent-generated slides break keyboard navigation (BUG-15)
- Index pages don't integrate with FliDeck's sync features
- Clicks inside iframe don't update FliDeck's state
- Each agent has to reverse-engineer FliDeck's expectations

## The Fundamental Issue

FliDeck's architecture has **two rendering contexts** separated by an iframe boundary:

```
┌─────────────────────────────────────────────────────────────────────┐
│  FLIDECK HARNESS (React)                                            │
│  - Knows about keyboard shortcuts (Cmd+Arrow, F, Escape)            │
│  - Knows about presentation state (current slide, current tab)      │
│  - Needs to receive events FROM slides                              │
├─────────────────────────────────────────────────────────────────────┤
│  IFRAME (Agent-Generated HTML)                                      │
│  - Static HTML, doesn't know about FliDeck                          │
│  - Has its own keyboard handlers (arrow keys for internal nav)      │
│  - Has clickable elements (cards that should update FliDeck state)  │
│  - NEEDS TO COMMUNICATE with parent harness                         │
└─────────────────────────────────────────────────────────────────────┘
```

**The contract between harness and content is undocumented.**

## What Agents Need to Know

### 1. Keyboard Integration

Slides should include a script that forwards FliDeck control keys to parent:

```html
<script>
  // Forward FliDeck hotkeys to parent harness
  document.addEventListener('keydown', (e) => {
    const isFliDeckKey =
      e.key === 'Escape' ||
      e.key === 'F' ||
      (e.metaKey && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key));

    if (isFliDeckKey) {
      window.parent.postMessage({
        type: 'flideck:keydown',
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey
      }, '*');
    }
  });
</script>
```

### 2. Navigation Integration (Index Pages)

When a card is clicked in an index page, it should notify FliDeck:

```html
<script>
  document.querySelectorAll('[data-slide]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const slideFile = card.dataset.slide;
      window.parent.postMessage({
        type: 'flideck:navigate',
        slide: slideFile
      }, '*');
    });
  });
</script>
```

### 3. Card Structure for Sync

For `sync-from-index` to work, cards should follow a structure:

```html
<div class="card" data-slide="my-slide.html">
  <h3 class="card-title">Slide Title</h3>
  <p class="card-description">Optional description</p>
</div>
```

### 4. HTML Metadata

Slides should include metadata FliDeck can extract:

```html
<head>
  <title>E1.1 Initiative Scorecard</title>
  <meta name="flideck:group" content="epic1">
  <meta name="flideck:order" content="1">
</head>
```

## Proposed Solution: Authoring Specs API

Extend FR-27's `/api/capabilities` or create new endpoint:

### GET /api/authoring-specs

Returns technical specifications for writing FliDeck-compatible HTML:

```json
{
  "version": "1.0",
  "harness": {
    "keyboardBridge": {
      "description": "Script to include for keyboard forwarding",
      "script": "<script>document.addEventListener('keydown', ...);</script>",
      "hotkeys": ["Escape", "F", "Cmd+ArrowLeft", "Cmd+ArrowRight", "Cmd+Home", "Cmd+End"]
    },
    "navigationBridge": {
      "description": "How to notify FliDeck when user clicks a card",
      "messageType": "flideck:navigate",
      "payload": { "slide": "filename.html" }
    }
  },
  "cardStructure": {
    "description": "HTML structure for index page cards",
    "template": "<div class='card' data-slide='{{file}}'><h3>{{title}}</h3></div>",
    "requiredAttributes": ["data-slide"],
    "optionalAttributes": ["data-group", "data-order"]
  },
  "metadata": {
    "title": "Use <title> tag for slide name in sidebar",
    "group": "Use <meta name='flideck:group'> to assign to group",
    "order": "Use <meta name='flideck:order'> for sort order"
  },
  "templates": {
    "slide": "GET /api/templates/slide - basic slide template",
    "index": "GET /api/templates/index - index page template with cards"
  }
}
```

### GET /api/templates/slide

Returns a complete HTML template agents can use:

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{SLIDE_TITLE}}</title>
  <meta name="flideck:group" content="{{GROUP_ID}}">
  <style>/* Base styles */</style>
</head>
<body>
  <div class="slide-content">
    {{CONTENT}}
  </div>

  <!-- FliDeck Integration -->
  <script>
    // Keyboard bridge
    document.addEventListener('keydown', (e) => {
      // ... forwarding code
    });
  </script>
</body>
</html>
```

### GET /api/templates/index

Returns template for index/landing pages with card grid and navigation integration.

## Acceptance Criteria

- [ ] `/api/authoring-specs` endpoint returns complete integration specifications
- [ ] Keyboard bridge script documented and provided
- [ ] Navigation bridge for card clicks documented and provided
- [ ] Card HTML structure for sync-from-index documented
- [ ] HTML metadata conventions documented
- [ ] `/api/templates/slide` returns usable slide template
- [ ] `/api/templates/index` returns usable index page template
- [ ] Agent using specs produces slides that don't break keyboard navigation
- [ ] Knowledge base updated with authoring guidelines

## Why This Matters

**Without this:** Every agent that creates FliDeck content has to:
1. Reverse-engineer how FliDeck works
2. Copy-paste scripts from existing slides
3. Hope they got it right
4. Debug when keyboard/navigation breaks

**With this:** Agents can:
1. Query `/api/authoring-specs` to understand requirements
2. Use `/api/templates/*` as starting points
3. Know exactly what postMessage events FliDeck expects
4. Produce slides that "just work"

## Related

- FR-27 (Agent Capability Discovery) - provides WHAT apis exist, not HOW to write content
- BUG-15 (Keyboard breaks after iframe click) - symptom of missing integration
- Knowledge Base Section 5 (Iframe Boundary) - documents the problem conceptually
- Knowledge Base Section 6 (Agent-FliDeck Contract) - needs expansion with authoring specs

## Priority

**High** - Root cause of integration failures. Prevents future bugs.

---

**Added**: 2025-12-28
**Status**: Open
**Type**: Feature / Architecture Gap
**Found in**: Analysis of keyboard navigation failures
