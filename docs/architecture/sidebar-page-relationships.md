# Sidebar-Page Relationships Architecture

This document captures the architectural relationships between the sidebar and content pages in FliDeck. It serves as a knowledge base for developers to understand how these systems interact.

**Last Updated:** 2025-12-26

---

## Overview

FliDeck has two independent but related systems for organizing content:

1. **Display Modes** - HOW content is rendered in the sidebar (flat, grouped)
2. **Container Tabs** - WHAT content is shown (filtering layer)

These are **orthogonal** concerns that work together:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Container Tabs (FR-24)                        │
│                    ↓ FILTER LAYER                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                Display Mode (FR-20)                      │    │
│  │                ↓ PRESENTATION LAYER                      │    │
│  │  ┌─────────────────┐  ┌───────────────────────────────┐ │    │
│  │  │   Sidebar       │  │   Content Area                │ │    │
│  │  │   - Flat        │  │   - Asset via srcdoc          │ │    │
│  │  │   - Grouped     │  │   - Tab index via src         │ │    │
│  │  └─────────────────┘  └───────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Display Modes

**Location:** `client/src/utils/displayMode.ts`, `client/src/hooks/useDisplayMode.ts`

### Supported Modes

| Mode | Description | Use Case | Renderer |
|------|-------------|----------|----------|
| `flat` | Simple list, no grouping | 1-15 slides | `SidebarFlat.tsx` |
| `grouped` | Collapsible group sections | 15+ slides with groups | `SidebarGrouped.tsx` |
| `tabbed` | **OBSOLETE** | Removed in FR-24 | **No renderer exists** |

### Auto-Detection Logic

```typescript
function detectDisplayMode(presentation): DisplayMode {
  // 1. Check explicit manifest setting (convert obsolete 'tabbed' to 'grouped')
  // 2. If container tabs exist: use 'grouped' if groups exist, else 'flat'
  // 3. If >15 slides AND groups exist: use 'grouped'
  // 4. Otherwise: use 'flat'
  // NEVER returns 'tabbed' (it's obsolete)
}
```

### Mode Persistence

- Stored in localStorage per presentation: `flideck:displayMode:{presentationId}`
- Session override takes precedence over auto-detected mode
- Hook: `useDisplayMode(presentation)` returns `{ mode, autoMode, hasOverride, setOverride, clearOverride }`

---

## Container Tabs (FR-24)

**Location:** `client/src/hooks/useContainerTab.ts`, `client/src/components/ui/TabBar.tsx`

### What Are Container Tabs?

Container tabs are a **navigation layer** that:
1. Display as tabs at the top of the content area
2. Each tab loads a different HTML file (index-{tabname}.html)
3. Filter sidebar content to show only relevant groups
4. Persist in presentation mode (unlike sidebar chrome)

### Manifest Structure

```json
{
  "tabs": [
    { "id": "mary", "label": "Mary", "file": "index-mary.html", "order": 1 },
    { "id": "john", "label": "John", "file": "index-john.html", "order": 2 }
  ],
  "groups": {
    "group-a": { "label": "Group A", "tabId": "mary", "order": 1 },
    "group-b": { "label": "Group B", "tabId": "john", "order": 2 }
  }
}
```

### Tab-to-Content Mapping

| Component | Behavior When Tab Active |
|-----------|-------------------------|
| TabBar | Shows tabs, highlights active one |
| AssetViewer | Loads tab's index file via `src` attribute |
| Sidebar | Filters to show only groups with matching `tabId` |

### Filtering Logic

```typescript
// Sidebar.tsx lines 125-129
for (const [groupId, def] of sortedGroups) {
  // Skip groups that belong to a different tab
  if (activeContainerTabId && def.tabId && def.tabId !== activeContainerTabId) {
    continue;
  }
  // ... include group
}
```

**Important rules:**
- Groups WITH `tabId` matching active tab: **SHOWN**
- Groups WITH `tabId` NOT matching active tab: **HIDDEN**
- Groups WITHOUT `tabId`: **SHOWN IN ALL TABS**
- Root assets (no group): **SHOWN IN ALL TABS**

---

## Content Area Rendering

### Two Rendering Modes

| Condition | Rendering Method | Component Props |
|-----------|-----------------|-----------------|
| Container tab active | iframe `src={tabFile}` | `indexFile` prop |
| Individual asset selected | iframe `srcdoc={content}` | `content` prop |

### State Transitions

```
Initial load
    ↓
Index asset selected (auto)
    ↓
[User clicks container tab] → Tab mode: load index-{tab}.html via src
    ↓
[User clicks sidebar asset] → Asset mode: load asset via srcdoc, clear tab
    ↓
[User navigates prev/next] → Asset mode continues, tab cleared
```

---

## Component Relationships

```
PresentationPage.tsx
├── useContainerTab(id, tabs) → [activeContainerTabId, setActiveContainerTabId]
├── useDisplayMode(presentation) → { mode, ... }
│
├── Header
├── Sidebar
│   ├── mode === 'flat' → SidebarFlat
│   └── mode === 'grouped' → SidebarGrouped
│       ├── groupedAssets (filtered by activeContainerTabId)
│       └── rootAssets (always shown)
│
├── TabBar (if tabs exist)
│   └── onTabChange → setActiveContainerTabId
│
└── AssetViewer
    ├── activeContainerTab ? src={tab.file}
    └── else srcdoc={assetData.content}
```

---

## Common Pitfalls

### 1. Display Mode vs Container Tabs Confusion

**Problem:** "Tabbed" display mode is NOT the same as container tabs.

- "Tabbed" display mode was removed in FR-24 (no renderer exists)
- Container tabs are a navigation/filtering layer
- These are independent systems

### 2. Groups Without tabId

**Problem:** Groups without `tabId` appear in ALL tabs.

This is intentional (FR-25 decision) - root-level content is "universal." However, if you want groups to only appear in specific tabs, they MUST have `tabId` set.

### 3. Empty Sidebar After Tab Click

**Problem:** Sidebar shows nothing after clicking a container tab.

**Causes:**
1. Groups have `tabId` that doesn't match any actual tab
2. Groups all have `tabId` for different tabs
3. "Tabbed" display mode selected (has no renderer)

**Debug:** Check `groupedAssets` in React DevTools - if empty, filtering is excluding all groups.

### 4. Navigation Clears Tab State

**Problem:** Arrow navigation exits tab mode.

This is **intentional** (BUG-2 fix). When navigating between assets with keyboard, the active container tab is cleared because you're switching from "tab index mode" to "individual asset mode."

---

## Key Files

| File | Purpose |
|------|---------|
| `Sidebar.tsx` | Main coordinator, filtering logic |
| `SidebarFlat.tsx` | Flat mode renderer |
| `SidebarGrouped.tsx` | Grouped mode renderer |
| `useDisplayMode.ts` | Display mode state + persistence |
| `displayMode.ts` | Auto-detection logic |
| `useContainerTab.ts` | Container tab state + persistence |
| `TabBar.tsx` | Container tab UI |
| `PresentationPage.tsx` | Orchestrates all state |
| `AssetViewer.tsx` | Content rendering (src vs srcdoc) |

---

## Related Documentation

- `docs/prd/fr-20-ui-rendering-modes.md` - Display modes spec
- `docs/prd/fr-24-container-tab-navigation.md` - Container tabs spec
- `docs/prd/fr-25-smart-display-mode.md` - Smart mode resolution
- `docs/prd/bug-05-tabbed-mode-empty-sidebar.md` - Historical bug
- `docs/prd/bug-08-tab-system-broken.md` - Data configuration issue

---

## Learnings Log

### 2025-12-26: Tabbed Display Mode Bug Rediscovered

**Context:** User reported empty sidebar when selecting "Tabbed" mode on bmad-poem presentation.

**Root Cause:** BUG-5 fix had inverted logic:
- Code: Hide "Tabbed" when NO tabs exist
- Should be: Hide "Tabbed" ALWAYS (since no renderer exists)

**Technical Detail:**
```typescript
// Sidebar.tsx line 682-687 - INVERTED LOGIC
if (m === 'tabbed' && (!selectedPresentation?.tabs || selectedPresentation.tabs.length === 0)) {
  return false;  // Hides when NO tabs (correct)
}
return true;  // Shows when tabs EXIST (wrong - no renderer!)
```

**Fix Required:** Hide "Tabbed" from mode switcher unconditionally since there's no `SidebarTabbed` component.

**Lesson:** The "tabbed" display mode is completely obsolete and should never be selectable. The mode switcher should only show `flat` and `grouped`.
