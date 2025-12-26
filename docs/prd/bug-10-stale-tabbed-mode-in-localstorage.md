# BUG-10: Stale "Tabbed" Mode in localStorage Causes Empty Sidebar

## Summary

Users who previously selected "Tabbed" display mode have the value persisted in localStorage. After BUG-9 fix removed the dropdown option, the stale value still loads and causes an empty sidebar because there's no renderer for `mode === 'tabbed'`.

## Problem Statement

**Presentation:** bmad-poem (and any presentation where user previously selected "Tabbed" mode)

**Steps to reproduce:**
1. Before BUG-9 fix: Open presentation, select "Tabbed" mode from dropdown
2. After BUG-9 fix: Refresh page
3. Observe sidebar is completely empty
4. Clicking container tabs (Mary, John, etc.) makes no difference - still empty

**Expected result:**
- Sidebar shows slides
- Container tabs filter content appropriately

**Actual result:**
- Sidebar is completely empty
- No slides visible regardless of mode or tab selection

## Root Cause Analysis

### The Bug

`useDisplayMode.ts` loads mode from localStorage without validating it's still valid:

```typescript
// Lines 54-56
const saved = localStorage.getItem(storageKey);  // Returns "tabbed"
setSessionOverrideState(saved as DisplayMode | null);  // Sets mode to "tabbed"
```

### Why It Breaks

1. **User previously selected "Tabbed"** → saved to localStorage as `"tabbed"`
2. **BUG-9 fix removed dropdown option** but NOT the stored value
3. **Page loads** → localStorage returns `"tabbed"`
4. **activeMode = "tabbed"**
5. **Sidebar rendering** (Sidebar.tsx lines 794-858):
   ```typescript
   {mode === 'flat' && <SidebarFlat ... />}   // false
   {mode === 'grouped' && <SidebarGrouped ... />}  // false
   // No mode === 'tabbed' block exists!
   ```
6. **Nothing renders** → empty sidebar

### BUG-9 Fix Was Incomplete

BUG-9 removed "tabbed" from the dropdown, but didn't handle:
1. Existing localStorage values of "tabbed"
2. Fallback logic for obsolete mode values

## Affected Users

Any user who:
1. Previously used FliDeck before BUG-9 fix
2. Selected "Tabbed" mode on any presentation
3. Still has that value in localStorage

## Proposed Solution

### Option A: Sanitize on Load (Recommended)

Add validation when loading from localStorage:

```typescript
// useDisplayMode.ts - Line 55-56
const saved = localStorage.getItem(storageKey);
// Sanitize: treat obsolete 'tabbed' as null (fall back to auto-detect)
const validModes: DisplayMode[] = ['flat', 'grouped'];
const validatedMode = saved && validModes.includes(saved as DisplayMode)
  ? saved as DisplayMode
  : null;
setSessionOverrideState(validatedMode);
```

### Option B: Fallback in Rendering

Add fallback case in Sidebar.tsx:

```typescript
{(mode === 'grouped' || mode === 'tabbed') && (
  <SidebarGrouped ... />
)}
```

### Option C: Clear on Detection

Clear localStorage if obsolete value detected:

```typescript
if (saved === 'tabbed') {
  localStorage.removeItem(storageKey);
  setSessionOverrideState(null);
}
```

**Recommendation:** Option A - validates input at the source, cleanest solution.

## Files to Modify

1. **`client/src/hooks/useDisplayMode.ts`**
   - Line 14-18: Add validation when reading from localStorage
   - Line 54-56: Add validation when loading on presentation change

## Acceptance Criteria

- [ ] Stale "tabbed" values in localStorage don't cause empty sidebar
- [ ] Mode falls back to auto-detected when invalid value found
- [ ] No data migration needed - handles on-the-fly
- [ ] Existing valid modes (flat/grouped) continue to work

## Testing

1. **Simulate stale data:**
   - Open DevTools → Application → Local Storage
   - Set `flideck:displayMode:bmad-poem` to `"tabbed"`
   - Refresh page
   - Sidebar should show content (not be empty)

2. **Normal operation:**
   - Select "Flat" → works
   - Select "Grouped" → works
   - Refresh → persisted mode loads correctly

## Workaround (Immediate)

Users can fix manually:
1. Open DevTools (F12)
2. Go to Application → Local Storage → localhost:5200
3. Delete keys starting with `flideck:displayMode:`
4. Refresh page

## Priority

**High** - Users actively experiencing empty sidebars with no obvious way to fix.

---

**Added**: 2025-12-26
**Status**: Open
**Type**: Bug
**Found in**: User testing (bmad-poem presentation)
**Root cause**: BUG-9 fix was incomplete - removed UI but not localStorage handling
**Related**: BUG-9 (partial fix)
