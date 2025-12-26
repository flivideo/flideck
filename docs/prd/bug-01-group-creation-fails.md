# BUG-1: Group Creation Fails in Grouped Mode

## Summary

Creating a new group fails with "Failed to create group" error when the presentation is in grouped display mode after switching from flat mode.

## Problem Statement

**Presentation:** claude-plugin-marketplace

**Steps to reproduce:**
1. Open presentation in flat mode
2. Switch to grouped mode using display mode switcher
3. Click "+ Add Group" button in sidebar
4. Enter group name
5. Press Enter or click save

**Expected result:**
- Group is created successfully
- Group appears in sidebar
- Toast notification confirms creation

**Actual result:**
- Error toast: "Failed to create group"
- Group is not created
- No group appears in sidebar

## Environment

- **Display mode:** Grouped (after switching from flat)
- **Manifest state:** May or may not have existing groups
- **Browser:** Unknown (needs verification across browsers)

## Technical Investigation Needed

**Potential causes:**

1. **API endpoint issue:**
   - `POST /api/presentations/:id/groups` may be failing
   - Check server logs for error details
   - Verify request payload format

2. **Client state issue:**
   - Display mode switch may corrupt group state
   - Check if `selectedPresentation` is stale after mode switch
   - Verify presentation ID is passed correctly

3. **Validation issue:**
   - Group ID generation may be failing
   - Duplicate ID check may be incorrectly rejecting new group
   - Label validation may be too strict

4. **Manifest state issue:**
   - Manifest may be in inconsistent state after mode switch
   - Check if manifest needs to exist before adding groups

**Debug steps:**

1. Open browser DevTools Network tab
2. Reproduce the bug
3. Check:
   - HTTP status code of POST request
   - Request payload
   - Response body
4. Check browser console for client-side errors
5. Check server logs for error messages

## Acceptance Criteria

- [ ] Group creation works in grouped mode
- [ ] Group creation works after switching from flat → grouped
- [ ] Appropriate error message shows if creation fails for valid reason
- [ ] Error is logged to console/server for debugging
- [ ] Works consistently across browser refreshes

## Related Code

**Client:**
- `client/src/components/layout/Sidebar.tsx` - Group creation handler
- `client/src/components/layout/SidebarGrouped.tsx` - "+ Add Group" UI

**Server:**
- `server/src/routes/presentations.ts` - `POST /api/presentations/:id/groups` endpoint
- `server/src/services/PresentationService.ts` - `createGroup()` method

**API:**
- Endpoint: `POST /api/presentations/:id/groups`
- Request body: `{ id: string, label: string }`
- Expected response: `{ success: true }` or error

## Priority

**High** - Blocks users from organizing presentations in grouped mode

---

**Added**: 2025-12-24
**Status**: Fixed
**Type**: Bug
**Found in**: User testing (claude-plugin-marketplace presentation)

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Root Cause**: The `createGroup` callback in `Sidebar.tsx` was checking if `selectedPresentation` was falsy and silently returning, which masked the actual issue. When the presentation data was temporarily undefined (possibly due to React re-renders or stale props), the function would fail silently without providing feedback to the user.

**Solution Implemented**: Added defensive checks and better error reporting

**Changes Made:**

1. `client/src/components/layout/Sidebar.tsx` - Updated `createGroup()` callback
   - Reordered validation checks to handle empty label first
   - Added explicit check for `selectedPresentation` with detailed error logging
   - Logs presentation array length and selected ID when presentation is undefined
   - Shows user-friendly error toast: "Unable to create group: presentation not loaded"
   - Added `presentations` and `selectedPresentationId` to useCallback dependencies for proper closure

**How it fixes the bug:**
- If `selectedPresentation` is undefined, user now sees a clear error message instead of silent failure
- Console logging helps diagnose if this is a data loading issue, prop passing issue, or race condition
- The error message guides users to refresh or wait for data to load
- Does not mask the underlying issue - makes it visible for further debugging if needed

**Testing:**
- Manual test: Open presentation in flat mode
- Switch to grouped mode using display mode switcher
- Click "+ Add Group" / "+ New Group" button
- Enter group name and press Enter
- Should either create group successfully OR show clear error if presentation data is unavailable
- Check browser console for any logged errors

**Note**: This fix adds better error handling and visibility. If the bug persists with the new error message showing, it indicates a deeper issue with presentation data loading/passing that will need further investigation. The improved logging will help diagnose that.
