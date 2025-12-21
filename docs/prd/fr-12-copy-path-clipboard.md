# FR-12: Copy Path to Clipboard

**Status:** Implemented
**Added:** 2025-12-21
**Source:** Brainstorm session

---

## User Story

As a user working with AI tools, I want to quickly copy slide paths to my clipboard so I can reference them in Claude Code or other AI contexts.

## Problem

When working with AI tools, users need file paths to reference specific slides. Currently there's no way to get paths without manually navigating the filesystem or constructing URLs.

## Solution

Add a modifier key interaction to the Assets sidebar. When the modifier key is held:
- Hovering over a slide reveals copy buttons
- Hovering over the "Assets" header reveals copy-all buttons

### Single Slide (Modifier + Hover on slide row)

**Normal state:**
```
┌─────────────────────────────┐
│ ∷  index    Index           │  ← click navigates
└─────────────────────────────┘
```

**Modifier held + hover:**
```
┌─────────────────────────────┐
│ ∷  index    Index           │
│   [URL] [Abs] [Rel]         │  ← buttons appear below
└─────────────────────────────┘
```

Click any button → copies that format to clipboard.

### All Slides (Modifier + Hover on "Assets" header)

**Normal state:**
```
┌─────────────────────────────┐
│  ASSETS                     │
├─────────────────────────────┤
│ ∷  index    Index           │
└─────────────────────────────┘
```

**Modifier held + hover on header:**
```
┌─────────────────────────────┐
│  ASSETS                     │
│  [URL] [Abs] [Rel]          │  ← buttons appear below header
├─────────────────────────────┤
│ ∷  index    Index           │
└─────────────────────────────┘
```

Click any button → copies ALL paths (newline-separated) to clipboard.

## Copy Formats

| Button | Format | Example |
|--------|--------|---------|
| **URL** | iframe URL | `http://localhost:5201/presentations/bmad/index.html` |
| **Abs** | Absolute path | `/Users/david/presentations/bmad/index.html` |
| **Rel** | Relative path | `presentations/bmad/index.html` |

## Acceptance Criteria

- [x] Modifier key (suggest Alt/Option) + hover on slide row shows [URL] [Abs] [Rel] buttons
- [x] Buttons appear below the slide name (name stays visible)
- [x] Clicking [URL] copies iframe URL to clipboard
- [x] Clicking [Abs] copies absolute file path to clipboard
- [x] Clicking [Rel] copies relative file path to clipboard
- [x] Toast notification confirms copy (e.g., "Copied absolute path")
- [x] Modifier + hover on "Assets" header shows same three buttons
- [x] Header buttons copy ALL slide paths (newline-separated)
- [x] Releasing modifier key hides buttons
- [x] Normal click behavior (navigation) unaffected when modifier not held

## Technical Notes

- Use `Alt` (Option on Mac) as modifier - less likely to conflict with browser shortcuts
- Track modifier key state via `keydown`/`keyup` events on window
- Buttons only render when modifier state + hover state both true
- Use `navigator.clipboard.writeText()` for copy
- Relative path is relative to presentationsRoot from config

## UI Details

- Buttons should be small, compact (fit in row height)
- Subtle styling - don't distract from main content
- Consider abbreviations: `URL` `ABS` `REL` or icons

---

## Completion Notes

**Implemented:** 2025-12-21

**What was done:**
- Created `useModifierKey` hook to track Alt/Option key state globally
- Added hover tracking for asset rows and "Assets" header
- When Alt + hover on asset row, three copy buttons appear (URL, ABS, REL)
- When Alt + hover on "Assets" header, same buttons copy ALL asset paths (newline-separated)
- Toast notifications (via sonner) confirm successful copy
- Uses `navigator.clipboard.writeText()` for clipboard access

**Path formats:**
- URL: Full iframe URL from asset.url
- ABS: `presentation.path + '/' + asset.filename`
- REL: `presentation.id + '/' + asset.filename` (relative to presentationsRoot)

**Files created:**
- `client/src/hooks/useModifierKey.ts`

**Files modified:**
- `client/src/components/layout/Sidebar.tsx`
