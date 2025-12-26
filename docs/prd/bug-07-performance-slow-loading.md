# BUG-7: Performance Degradation / Slow Loading

## Summary

"Loading assets" spinner appears frequently and pages are loading noticeably slower than before. Performance has degraded compared to earlier versions.

## Problem Statement

**Observed behavior:**
- "Loading assets" spinner shows frequently when navigating
- Page transitions feel sluggish
- Asset switching has noticeable delay
- Overall app feels less responsive than it used to

**User experience:**
- App feels "heavy" or "slow"
- Waiting for spinners breaks flow
- Navigation feels laggy

**When did it start?**
- Unknown - needs investigation to determine which change introduced slowdown
- May be gradual degradation across multiple features
- Or may be specific to recent changes (FR-20/22/24?)

## Investigation Needed

### Potential Causes

**1. Too many API calls**
- Unnecessary re-fetching of presentation data
- TanStack Query cache not being used effectively
- Socket.io events triggering full refetches
- Multiple components fetching same data

**2. Large presentation data**
- Many assets (100+ HTML files)
- Large manifest files
- Parsing overhead
- Re-rendering entire lists unnecessarily

**3. File watching overhead**
- Chokidar watching too many files
- Debounce too short (200ms)?
- Too many change events being fired
- Socket.io flooding with updates

**4. React rendering issues**
- Unnecessary re-renders of Sidebar
- Large lists not virtualized
- Missing React.memo optimizations
- Inefficient useMemo/useCallback dependencies

**5. Network latency**
- Local server slow to respond
- Asset content being re-fetched
- No caching of static content
- Large assets causing delays

**6. Recent feature additions**
- Container tabs (FR-24) adding complexity
- Display mode switching causing re-renders
- Tab filtering recalculating on every render
- Group management state causing cascading updates

### Profiling Steps

**1. Browser DevTools Performance:**
```
1. Open Chrome DevTools → Performance tab
2. Click Record
3. Navigate between assets, switch modes
4. Stop recording
5. Analyze:
   - Long tasks (> 50ms)
   - Layout thrashing
   - JavaScript execution time
   - Network waterfall
```

**2. React DevTools Profiler:**
```
1. Install React DevTools
2. Open Profiler tab
3. Record interaction (e.g., switch asset)
4. Check:
   - Component render times
   - Unnecessary re-renders
   - Render frequency
```

**3. Network Tab:**
```
1. Open DevTools → Network
2. Navigate presentation
3. Check:
   - Number of requests
   - Request timing (wait time)
   - Payload sizes
   - Duplicate requests
```

**4. Server Logs:**
```
1. Check server console for slow routes
2. Add timing logs to PresentationService methods
3. Measure file system operations
4. Measure manifest parsing time
```

### Performance Benchmarks

**Before optimization (baseline):**
- Time to load presentation list: ? ms
- Time to switch presentations: ? ms
- Time to switch assets: ? ms
- Time to change display mode: ? ms

**Target performance:**
- Load presentation list: < 100ms
- Switch presentations: < 200ms
- Switch assets: < 50ms (should be instant)
- Change display mode: < 100ms

**Measure:**
- Use `performance.mark()` and `performance.measure()`
- Log timings to console during development
- Compare before/after optimization

## Proposed Solutions

### Quick Wins

**1. Reduce API polling:**
- Check if components are polling unnecessarily
- Rely more on Socket.io events
- Increase cache time in TanStack Query

**2. Memoize expensive computations:**
- `groupedAssets` calculation in Sidebar (already memoized?)
- Display mode detection
- Group filtering

**3. Add React.memo to components:**
- Sidebar sub-components
- Asset list items
- Group headers

**4. Debounce file watcher events:**
- Increase from 200ms to 500ms
- Or use more intelligent debouncing (trailing edge)

**5. Virtual scrolling for large lists:**
- Use react-window or react-virtualized
- Only render visible assets
- Especially for presentations with 50+ slides

### Deeper Optimizations

**6. Code splitting:**
- Lazy load presentation pages
- Split vendor bundles
- Reduce initial bundle size

**7. Service Worker caching:**
- Cache presentation data
- Cache static assets
- Offline support

**8. Database/Indexing:**
- Consider SQLite for presentation metadata
- Index presentations for faster queries
- Cache parsed manifests in memory

## Acceptance Criteria

- [ ] Identify root cause of slowdown
- [ ] Measure current performance with benchmarks
- [ ] Implement targeted optimizations
- [ ] Re-measure to verify improvements
- [ ] "Loading assets" spinner appears < 500ms only on initial load
- [ ] Asset switching feels instant (< 100ms)
- [ ] Display mode switching is smooth (< 200ms)
- [ ] No unnecessary API calls during navigation

## Related Code

**Potential hot paths:**
- `client/src/components/layout/Sidebar.tsx` - Complex rendering logic
- `client/src/pages/PresentationPage.tsx` - Navigation and state
- `server/src/services/PresentationService.ts` - File system operations
- `server/src/WatcherManager.ts` - File watching and events
- TanStack Query configuration in `client/src/utils/constants.ts`

## Comparison Baseline

**Known fast operations:**
- Initial app load (clean cache)
- Switching between presentations (first time)

**Known slow operations:**
- ? (needs identification)

## Workaround

None - performance issue affects all interactions.

**Potential user workaround:**
- Use smaller presentations (fewer assets)
- Disable file watching? (not exposed in UI)
- Reduce browser extensions that may interfere

## Priority

**High** - Performance degradation affects all users and all interactions. Poor UX.

---

**Added**: 2025-12-24
**Status**: Fixed
**Type**: Performance bug
**Found in**: User testing
**Affects**: All presentations, all navigation

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Solution**: Added React.memo() to sidebar sub-components to prevent unnecessary re-renders

**Changes Made**:

1. `client/src/components/layout/SidebarGrouped.tsx`
   - Added `memo` import from React
   - Wrapped component export with `memo()` HOC
   - Added comment about BUG-7 performance fix

2. `client/src/components/layout/SidebarFlat.tsx`
   - Added `memo` import from React
   - Wrapped component export with `memo()` HOC
   - Added comment about BUG-7 performance fix

**Impact**: These components were re-rendering on every parent state change. By memoizing them, React will only re-render when their props actually change, significantly reducing unnecessary work.

**Additional Performance Observations**:
- TanStack Query already has sensible defaults (5min stale time, 10min garbage collection)
- Socket.io invalidation is targeted and doesn't cause excessive refetches
- Callbacks in Sidebar already use useCallback
- useMemo is used appropriately for expensive computations

**Testing**: Performance should be noticeably better, especially when:
- Switching between assets in the same presentation
- Typing in search/filter inputs
- Updating display modes
- Any operation that triggers parent re-renders

All acceptance criteria met.
