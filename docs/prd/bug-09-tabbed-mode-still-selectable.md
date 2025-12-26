# BUG-9: Tabbed Display Mode Still Selectable (Empty Sidebar)

## Summary

When a presentation has container tabs (like bmad-poem with Mary, John, Winston, Epic 1), the mode switcher dropdown incorrectly shows "Tabbed" as an option. Selecting it causes an empty sidebar because no renderer exists for that mode.

## Problem Statement

**Presentation:** bmad-poem (and any presentation with container tabs defined)

**Steps to reproduce:**
1. Open a presentation that HAS container tabs (`tabs[]` array in manifest)
2. Click the mode switcher icon (next to "ASSETS" header)
3. Observe that "Flat", "Grouped", AND "Tabbed" options are shown
4. Select "Tabbed"
5. Observe sidebar becomes empty

**Expected result:**
- "Tabbed" option should NOT be visible (mode is obsolete, removed in FR-24)
- Only "Flat" and "Grouped" should be available

**Actual result:**
- "Tabbed" is visible and selectable
- Selecting it results in completely empty sidebar
- Assets section shows nothing
- Navigation is broken

## Root Cause Analysis

### The Bug

In `Sidebar.tsx` lines 682-687, the filter logic is **inverted**:

```typescript
{(['flat', 'grouped', 'tabbed'] as const).filter(m => {
  // BUG: Logic is backwards!
  // Hide tabbed mode when NO container tabs are present
  if (m === 'tabbed' && (!selectedPresentation?.tabs || selectedPresentation.tabs.length === 0)) {
    return false;  // Hides when NO tabs
  }
  return true;  // SHOWS when tabs EXIST - but no renderer!
})}
```

### Why It Breaks

1. **"Tabbed" display mode is obsolete** - removed in FR-24 when SidebarTabbed component was deleted
2. **No renderer exists** for `mode === 'tabbed'` in Sidebar.tsx (lines 800-864)
3. The rendering logic only handles `flat` and `grouped`:

```typescript
{mode === 'flat' && (
  <SidebarFlat ... />
)}
{mode === 'grouped' && (
  <SidebarGrouped ... />
)}
// NO mode === 'tabbed' block!
```

### BUG-5 Fix Was Incorrect

BUG-5 completion notes claimed:
> "Presentations WITH container tabs: Can select flat/grouped (tabbed hidden in dropdown)"

But the code does the **opposite** - it hides "tabbed" when tabs DON'T exist, and shows it when they DO exist.

## Affected Data

The bmad-poem manifest shows the issue:

```json
{
  "groups": {
    "david": { "label": "David", "order": 1 }
  },
  "tabs": [
    { "id": "mary", "label": "Mary", "file": "index-mary.html", "order": 1 },
    { "id": "john", "label": "John", "file": "index-john.html", "order": 2 },
    { "id": "winston", "label": "Winston", "file": "index-winston.html", "order": 3 },
    { "id": "epic1", "label": "Epic 1", "file": "index-epic1.html", "order": 4 }
  ]
}
```

Because `tabs[]` exists, "Tabbed" option is shown. Selecting it → empty sidebar.

## Proposed Solution

### Simple Fix (Recommended)

Hide "Tabbed" unconditionally since the mode is obsolete:

```typescript
// Sidebar.tsx - Mode switcher dropdown
{(['flat', 'grouped'] as const).map((m) => (
  // Remove 'tabbed' entirely from the array
  <button key={m} ...>
    {getDisplayModeLabel(m)}
  </button>
))}
```

### Alternative Fix

If "tabbed" needs to remain for backwards compatibility, ensure it never renders empty:

```typescript
// Add fallback in rendering section
{(mode === 'tabbed' || mode === 'grouped') && (
  <SidebarGrouped ... />
)}
```

But this is less clean - better to remove the obsolete option entirely.

## Files to Modify

1. **`client/src/components/layout/Sidebar.tsx`**
   - Line 682-687: Remove 'tabbed' from mode array entirely
   - Or: Fix filter logic to hide 'tabbed' unconditionally

2. **`client/src/utils/displayMode.ts`**
   - Already correct: never returns 'tabbed' from auto-detection
   - No changes needed

## Acceptance Criteria

- [ ] "Tabbed" option never appears in mode switcher dropdown
- [ ] Mode switcher only shows "Flat" and "Grouped"
- [ ] Existing presentations with `displayMode: 'tabbed'` in manifest fall back to grouped (already working)
- [ ] No empty sidebar states possible from mode selection
- [ ] Auto mode detection continues to work correctly

## Testing

1. **bmad-poem (has tabs):**
   - Mode switcher shows: Auto, Flat, Grouped (NOT Tabbed)
   - Both modes render correctly
   - Container tabs continue to work

2. **bmad-agents (no tabs):**
   - Mode switcher shows: Auto, Flat, Grouped (NOT Tabbed)
   - Both modes render correctly

3. **Legacy manifest with `displayMode: 'tabbed'`:**
   - Falls back to 'grouped' (existing behavior)

## Related Issues

- **BUG-5**: Original "tabbed mode empty sidebar" fix (this bug is the fix being incomplete)
- **FR-24**: Container tab navigation (removed SidebarTabbed component)
- **FR-25**: Smart display mode (pending, handles mode detection)

## Priority

**High** - User-facing bug that makes presentations unusable when wrong mode selected.

---

**Added**: 2025-12-26
**Status**: Open
**Type**: Bug
**Found in**: User testing (bmad-poem presentation)
**Affects**: All presentations with container tabs when "Tabbed" mode selected
**Related**: BUG-5 (incomplete fix), FR-24 (tab system changes)
