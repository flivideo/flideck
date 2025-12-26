# BUG-4: Display Mode Doesn't Persist on Refresh

## Summary

Display mode selection is lost on page refresh. Mode resets to "auto" instead of remembering the user's choice.

## Problem Statement

**Presentation:** bmad-agents (and all presentations)

**Steps to reproduce:**
1. Open a presentation (auto-detects to "Grouped" mode, for example)
2. Switch display mode to "Flat" using mode switcher
3. Sidebar updates to flat list view (expected)
4. Refresh the page (F5 or Cmd+R)
5. Observe display mode

**Expected result:**
- Display mode persists as "Flat"
- User's choice is remembered
- Mode saved in manifest or localStorage

**Actual result:**
- Display mode resets to auto-detected mode ("Grouped")
- User's choice is lost
- Must re-select preferred mode on every refresh

## Root Cause Analysis

**Current behavior (from code review):**

`useDisplayMode` hook (client/src/hooks/useDisplayMode.ts):
- Uses `sessionOverride` state (line 10)
- `sessionOverride` is component state, NOT localStorage
- Resets to `null` when presentation changes (line 19-21)
- On page refresh, component re-mounts → state is lost

**Why it doesn't persist:**
```typescript
// Line 9: Session override in React state (not persisted)
const [sessionOverride, setSessionOverride] = useState<DisplayMode | null>(null);

// Line 16: Falls back to autoMode when no override
const activeMode = sessionOverride || autoMode;
```

React state is ephemeral. Page refresh = component unmount = state lost.

## Expected Persistence Behavior

**Two persistence options:**

### Option 1: Persist in Manifest (Recommended)
Store display mode in presentation's `index.json`:
```json
{
  "meta": {
    "displayMode": "flat"
  }
}
```

**Pros:**
- Mode is part of presentation definition
- Shared across all users (if presentation is shared)
- Already supported by schema (line 10 of displayMode.ts checks this)

**Cons:**
- Requires API call to update manifest
- Changes the source file

### Option 2: Persist in localStorage
Store display mode per presentation:
```typescript
localStorage.setItem('flideck:displayMode:bmad-agents', 'flat');
```

**Pros:**
- No file changes
- User-specific preference
- Faster (no API call)

**Cons:**
- Not shared across browsers/devices
- Not visible to other users
- Per-user override vs presentation default

**Recommendation:** **Option 1 (Manifest)** with Option 2 as fallback
- If user sets mode, save to manifest via API
- If API fails, fall back to localStorage
- Check localStorage first, then manifest, then auto-detect

## Proposed Solution

### Implementation Steps

1. **Update useDisplayMode hook:**
   ```typescript
   // Add localStorage key
   const storageKey = presentation?.id
     ? `flideck:displayMode:${presentation.id}`
     : null;

   // Load from localStorage on mount
   const [sessionOverride, setSessionOverride] = useState<DisplayMode | null>(() => {
     if (!storageKey) return null;
     try {
       const saved = localStorage.getItem(storageKey);
       return saved as DisplayMode | null;
     } catch {
       return null;
     }
   });

   // Persist to localStorage when changed
   const setOverride = (mode: DisplayMode | null) => {
     setSessionOverride(mode);
     if (storageKey && mode) {
       localStorage.setItem(storageKey, mode);
     } else if (storageKey) {
       localStorage.removeItem(storageKey);
     }
   };
   ```

2. **Optionally: Add API call to save to manifest**
   ```typescript
   // When user changes mode, save to manifest
   await api.patch(`/presentations/${presentationId}/manifest`, {
     meta: { displayMode: mode }
   });
   ```

3. **Priority order:**
   - localStorage override (user preference)
   - Manifest `meta.displayMode` (presentation default)
   - Auto-detection (fallback)

## Acceptance Criteria

- [ ] Display mode persists across page refreshes
- [ ] Persists in localStorage per presentation
- [ ] Optionally: Can save to manifest via API
- [ ] Clearing override removes from localStorage
- [ ] Auto mode uses detection (no localStorage entry)
- [ ] Works for all display modes (flat, grouped, tabbed)
- [ ] Changing presentation clears previous override

## Related Code

**Client:**
- `client/src/hooks/useDisplayMode.ts` - Display mode state management (needs update)
- `client/src/components/layout/Sidebar.tsx` - Mode switcher UI

**Comparison:**
- `client/src/hooks/useActiveTab.ts` - Already persists to localStorage (reference implementation)
- `client/src/hooks/useContainerTab.ts` - Container tabs persist correctly

## Workaround

**Temporary workaround:**
1. Edit `index.json` manually:
   ```json
   {
     "meta": {
       "displayMode": "flat"
     }
   }
   ```
2. Refresh page → mode is persisted

## Priority

**Medium** - Annoying UX issue but has manual workaround. Affects all presentations.

---

**Added**: 2025-12-24
**Status**: Fixed
**Type**: Bug
**Found in**: User testing (bmad-agents and other presentations)
**Affects**: All presentations, all display modes
**Related**: useActiveTab hook already implements localStorage persistence correctly

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Root Cause**: `useDisplayMode` hook used React `useState` for session override, which doesn't persist across page refreshes.

**Solution**: Added localStorage persistence to `useDisplayMode`, following the same pattern as `useActiveTab` (which already persisted correctly).

**Changes Made**:

1. `client/src/hooks/useDisplayMode.ts` - Complete rewrite of persistence logic
   - Added `storageKey` based on presentation ID: `flideck:displayMode:{presentationId}`
   - Changed from simple `useState` to `useState` with localStorage initializer
   - Created `setOverride` function that persists to localStorage
   - Added `clearOverride` function that removes from localStorage
   - Added useEffect to load from localStorage when presentation changes
   - Pattern matches `useActiveTab` for consistency

**Behavior**:
- Display mode override is now persisted per-presentation in localStorage
- Survives page refreshes
- Survives browser restarts
- Each presentation has independent mode preference
- Clearing override removes from localStorage and returns to auto mode

**Testing**:
1. Select "Grouped" mode on a presentation
2. Refresh page
3. Mode remains "Grouped" (not reset to auto)
4. Click "Auto" to clear override
5. Refresh page
6. Auto-detection kicks in again

All acceptance criteria met.
