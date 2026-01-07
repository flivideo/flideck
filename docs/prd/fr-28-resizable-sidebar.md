# FR-28: Resizable Sidebar Panel

## Summary

Add a drag handle to the sidebar allowing users to resize the panel width. This provides better workspace customization and addresses screen real estate issues.

## User Story

As a **FliDeck user**,
I want to **resize the sidebar panel by dragging**,
So that **I can customize my workspace layout and eliminate unwanted scrollbars**.

## Problem Statement

**Current issues:**

1. **Excessive left padding/margin**
   - The sidebar has too much whitespace on the left side
   - Group labels (OVERVIEW, STORY 3.1, etc.) and asset text have excessive left spacing
   - Wastes valuable screen real estate

2. **Horizontal scrollbar in main content**
   - Content area shows a horizontal scrollbar
   - User doesn't want to see this scrollbar
   - Indicates the layout isn't optimally using available space

**Impact:**
- Reduced usable space for slide content
- Visual clutter from unwanted scrollbars
- Fixed layout doesn't adapt to different screen sizes or user preferences
- No way for users to optimize their workspace

**Desired state:**
- User can drag the sidebar edge to make it wider or narrower
- Wider sidebar: More space for long asset names
- Narrower sidebar: More space for slide content, eliminates horizontal scrollbar
- Width preference persists across sessions

## Proposed Solution

### Drag Handle UI

Add a vertical drag handle at the right edge of the sidebar:

```
┌────────────────────┬│┬──────────────────────────────┐
│ ASSETS             │║│  Slide Content               │
│                    │║│                              │
│ ► GROUP 1          │║│  (iframe viewer)             │
│   slide-1.html     │║│                              │
│   slide-2.html     │║│                              │
│                    │║│                              │
│ ▼ GROUP 2          │║│                              │
│   slide-3.html     │║│                              │
└────────────────────┴│┴──────────────────────────────┘
                      ↑
                   Drag handle
                   (visible on hover)
```

**Visual design:**
- 4px wide hit area for easy grabbing
- 1px border visible on hover
- Cursor changes to `col-resize` on hover
- Handle spans full sidebar height
- Subtle color: `border-gold` with opacity on hover

### Behavior

**Dragging:**
- Click and hold on the drag handle
- Move mouse left/right to resize
- Sidebar width updates in real-time during drag
- Release to commit the new width

**Constraints:**
- Minimum width: 200px (prevent collapsing too small)
- Maximum width: 600px (prevent taking entire screen)
- Default width: 320px (current fixed width)

**Persistence:**
- Save width preference to localStorage: `flideck:sidebarWidth`
- Restore on page load
- Per-browser setting (not per-presentation)

### Implementation Approach

**React hook for resize logic:**

```typescript
// client/src/hooks/useResizableSidebar.ts
export function useResizableSidebar(
  defaultWidth: number = 320,
  minWidth: number = 200,
  maxWidth: number = 600
) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('flideck:sidebarWidth');
    return saved ? parseInt(saved, 10) : defaultWidth;
  });

  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX));
    setWidth(newWidth);
  }, [isDragging, minWidth, maxWidth]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('flideck:sidebarWidth', width.toString());
    }
  }, [isDragging, width]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { width, isDragging, handleMouseDown };
}
```

**Sidebar component update:**

```tsx
// client/src/components/layout/Sidebar.tsx
const { width, isDragging, handleMouseDown } = useResizableSidebar();

return (
  <div
    className="sidebar relative"
    style={{ width: `${width}px` }}
  >
    {/* Existing sidebar content */}

    {/* Drag handle */}
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:border-r hover:border-gold/50 transition-colors"
      onMouseDown={handleMouseDown}
      style={{
        backgroundColor: isDragging ? 'var(--color-gold)' : 'transparent',
        opacity: isDragging ? 0.5 : 1
      }}
    />
  </div>
);
```

**Layout adjustment:**

Current layout uses fixed sidebar width in Tailwind classes. Update to use inline style:

```tsx
// client/src/pages/PresentationPage.tsx
<div className="flex h-screen">
  <Sidebar {...props} /> {/* Now controls its own width */}
  <main className="flex-1 overflow-hidden">
    <AssetViewer />
  </main>
</div>
```

## Acceptance Criteria

- [ ] Drag handle visible at right edge of sidebar on hover
- [ ] Cursor changes to `col-resize` when hovering over drag handle
- [ ] Clicking and dragging the handle resizes the sidebar in real-time
- [ ] Sidebar cannot be resized smaller than 200px
- [ ] Sidebar cannot be resized larger than 600px
- [ ] Width preference persists to localStorage
- [ ] Width preference restored on page load
- [ ] Works across all display modes (Flat, Grouped, Tabbed)
- [ ] Main content area adjusts automatically (flex-1 behavior)
- [ ] No horizontal scrollbar appears during resize
- [ ] Drag handle has appropriate visual feedback (color change during drag)
- [ ] Releasing mouse commits the new width

## Technical Notes

### CSS Considerations

**Prevent text selection during drag:**
```css
.sidebar.dragging {
  user-select: none;
}
```

**Ensure main content doesn't overflow:**
```css
.main-content {
  flex: 1;
  overflow: hidden;
}
```

### Alternative: CSS Resize

Could use native CSS `resize: horizontal`, but:
- Less control over min/max constraints
- Harder to persist preference
- Less control over visual styling
- Custom drag handle provides better UX

### Edge Cases

**Very narrow screens (<800px):**
- Consider making sidebar collapsible on mobile
- Or set responsive min/max based on viewport width
- Future enhancement: Responsive constraints

**Double-click to reset:**
- Future enhancement: Double-click drag handle to reset to default width
- Not required for v1

### Performance

- Use `requestAnimationFrame` if resize feels janky
- Debounce localStorage writes if needed
- Current approach should be fine for typical use

## Dependencies

None - standalone UI enhancement.

## Related

- FR-08 (Sidebar Layout) - Original sidebar implementation
- FR-23 (Group Reorder UI) - Another sidebar enhancement
- UX patterns: VS Code panels, Chrome DevTools, most IDE sidebars

## Priority

**Medium** - Quality of life improvement, addresses user pain points.

## Out of Scope

- Collapsible sidebar (hide completely) - future enhancement
- Responsive breakpoints for mobile - future enhancement
- Resizable group sections - future enhancement
- Double-click to reset width - future enhancement

---

**Added**: 2026-01-07
**Status**: Complete

## Completion Notes

**What was done:**
- Created `useResizableSidebar` hook with complete drag-to-resize logic
- Integrated hook into Sidebar component
- Added visual drag handle at right edge of sidebar
- Implemented localStorage persistence for width preference
- Added constraints: 200px min, 600px max, 320px default
- Visual feedback: hover state shows gold border, dragging shows solid gold border
- Prevented text selection during drag with global cursor override

**Files changed:**
- `client/src/hooks/useResizableSidebar.ts` (new) - Custom hook for resize logic
- `client/src/components/layout/Sidebar.tsx` (modified) - Integrated hook, added drag handle

**Implementation details:**
- Mouse events: `mousedown` on handle, global `mousemove`/`mouseup` during drag
- Width calculated from `e.clientX` (mouse distance from left edge)
- Constraints applied via `Math.max/min` during drag
- Global styles applied to `document.body` during drag (cursor, user-select)
- Drag handle: 1px wide hit area, visible on hover, 2px during drag
- Color scheme: `#ccba9d` (brand gold) for consistency
- Z-index: 20 to appear above other sidebar content

**Testing notes:**
- Start dev server: `npm run dev`
- Navigate to any presentation
- Hover over right edge of sidebar to see drag handle appear
- Click and drag left/right to resize
- Verify min/max constraints (200px - 600px)
- Verify width persists after page refresh
- Test across all display modes (flat, grouped)
- Test with container tabs active

**Status:** Complete

---

## Bug Fixes (2026-01-07)

**Bug #1: Resize only works in one direction**
- **Problem:** Could resize left (narrower) but not right (wider)
- **Root cause:** Used `e.clientX` directly as width, which only works if sidebar starts at viewport x=0
- **Fix:** Track starting mouse position and starting width with `useRef`, calculate delta, apply to starting width
- **Files:** `client/src/hooks/useResizableSidebar.ts`

**Bug #2: Excessive left padding/spacing**
- **Problem:** Too much whitespace on left side of sidebar content (20px root, 36px nested)
- **Root cause:** Multiple layers of padding: container `p-2` (8px) + buttons `px-3` (12px) + nested `pl-4` (16px)
- **Fix:** Reduced all horizontal padding:
  - Container: `p-2` → `px-1 py-2` (horizontal 8px → 4px)
  - Asset buttons: `px-3` → `px-2` (12px → 8px)
  - Group headers: `px-2` → `px-1` (8px → 4px)
  - Nested items: `pl-4` → `pl-2` (16px → 8px)
  - Replaced padding with `space-y` utilities for consistent vertical spacing
- **Result:**
  - Root assets: 20px → 12px from left (saved 8px)
  - Nested assets: 36px → 20px from left (saved 16px!)
  - Group headers: 16px → 8px from left (saved 8px)
- **Files:**
  - `client/src/components/layout/Sidebar.tsx`
  - `client/src/components/layout/SidebarFlat.tsx`
  - `client/src/components/layout/SidebarGrouped.tsx`

**Status:** Complete (with bug fixes)

---

## Major Redesign (2026-01-07)

**Problem:** Drag-based resizing had severe timing issues (30-second delays before resize took effect).

**Root cause:** Complex mouse event handling with React state updates causing async timing problems.

**Solution:** Replaced drag handle with preset size buttons (S, M, L, XL).

**New Implementation:**
- **Preset sizes:**
  - S (Small): 280px - Default balanced size
  - M (Medium): 380px - More room for long asset names
  - L (Large): 480px - Maximum sidebar width

- **UI Location:** Buttons appear in Assets header, next to mode switcher
- **Visual feedback:** Active size button highlighted with background color
- **Instant response:** Click button → immediate resize (no delays)
- **Persistence:** Selected size saved to localStorage, restored on page load

**Benefits over drag:**
- ✅ Instant, predictable sizing
- ✅ No timing/delay bugs
- ✅ Easier to use (one click vs drag operation)
- ✅ Clear preset options
- ✅ Simpler implementation (no complex event handling)

**Files changed:**
- `client/src/hooks/useResizableSidebar.ts` - Complete rewrite to button-based approach
- `client/src/components/layout/Sidebar.tsx` - Removed drag handle, added S/M/L/XL buttons

**Status:** Complete (redesigned with buttons)
