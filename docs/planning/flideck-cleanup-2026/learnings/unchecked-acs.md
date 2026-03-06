# Unchecked Acceptance Criteria Report

Generated: 2026-03-06

## Summary

- PRDs audited: 49
- PRDs with all ACs checked (or no ACs): 15
- PRDs with unchecked ACs: 34
- Total unchecked ACs: 292

## PRDs with Unchecked ACs

### BUG-1: Group Creation Fails in Grouped Mode (Status: Fixed)

- [ ] Group creation works in grouped mode
- [ ] Group creation works after switching from flat → grouped
- [ ] Appropriate error message shows if creation fails for valid reason
- [ ] Error is logged to console/server for debugging
- [ ] Works consistently across browser refreshes

### BUG-2: Navigation Breaks After Container Tab Click (Status: Fixed)

- [ ] Clicking a container tab loads its index file
- [ ] Pressing Cmd+arrow after clicking tab navigates to assets (not stuck on index)
- [ ] Iframe updates correctly when navigating
- [ ] Sidebar highlight stays in sync with iframe content
- [ ] Navigation works forward and backward (Cmd+← and Cmd+→)
- [ ] Navigation works for first/last (Cmd+Home, Cmd+End)
- [ ] No console errors during navigation

### BUG-3: Groups Display in Different Order (Status: Closed - Not a Bug)

- [ ] Sidebar groups display in order specified by manifest `groups[].order`
- [ ] Index.html groups display in same order as sidebar
- [ ] Clicking a group in sidebar scrolls to correct section in index.html
- [ ] Order persists after page refresh
- [ ] Reordering groups via API updates both sidebar and index.html

### BUG-4: Display Mode Doesn't Persist on Refresh (Status: Fixed)

- [ ] Display mode persists across page refreshes
- [ ] Persists in localStorage per presentation
- [ ] Optionally: Can save to manifest via API
- [ ] Clearing override removes from localStorage
- [ ] Auto mode uses detection (no localStorage entry)
- [ ] Works for all display modes (flat, grouped, tabbed)
- [ ] Changing presentation clears previous override

### BUG-5: Tabbed Display Mode Shows Empty Sidebar (Status: Fixed)

- [ ] Presentations without container tabs never show empty sidebar
- [ ] "Tabbed" mode either works correctly or is disabled
- [ ] If "Tabbed" is selected but not applicable, fallback to "Grouped"
- [ ] User sees helpful message explaining why mode changed
- [ ] Auto-detection never selects "Tabbed" when it would break sidebar
- [ ] Mode switcher UI makes valid modes clear

### BUG-6: Groups Don't Auto-Expand During Keyboard Navigation (Status: Fixed)

- [ ] Navigating to asset in collapsed group expands that group
- [ ] Expansion is smooth and visually clear
- [ ] Works for Cmd+→ (next), Cmd+← (prev), Cmd+Home, Cmd+End
- [ ] Works when clicking assets in QuickFilter (Cmd+K)
- [ ] Doesn't auto-expand when just clicking group header
- [ ] Doesn't auto-expand when manually selecting collapsed asset
- [ ] Only auto-expands during keyboard navigation
- [ ] Collapsed state persists in localStorage after auto-expand
- [ ] Multiple groups can be expanded during sequential navigation
- [ ] Navigating through multiple collapsed groups in sequence
- [ ] Navigating backward (Cmd+←) from last asset in expanded group to last in collapsed group
- [ ] All groups collapsed → navigate to first asset → should expand first group
- [ ] Nested groups (if we ever implement that)

### BUG-7: Performance Degradation / Slow Loading (Status: Fixed)

- [ ] Identify root cause of slowdown
- [ ] Measure current performance with benchmarks
- [ ] Implement targeted optimizations
- [ ] Re-measure to verify improvements
- [ ] "Loading assets" spinner appears < 500ms only on initial load
- [ ] Asset switching feels instant (< 100ms)
- [ ] Display mode switching is smooth (< 200ms)
- [ ] No unnecessary API calls during navigation

### BUG-8: Container Tab System Completely Broken (Status: Fixed - Data issue, not code bug)

- [ ] Container tabs render in TabBar
- [ ] Clicking tab loads corresponding index file
- [ ] Active tab is highlighted
- [ ] Sidebar filters to show tab's groups
- [ ] Tab state persists in localStorage
- [ ] All tabs in bmad-poem work correctly
- [ ] Works in both normal and presentation mode

### BUG-9: Tabbed Display Mode Still Selectable (Status: Open)

- [ ] "Tabbed" option never appears in mode switcher dropdown
- [ ] Mode switcher only shows "Flat" and "Grouped"
- [ ] Existing presentations with `displayMode: 'tabbed'` in manifest fall back to grouped (already working)
- [ ] No empty sidebar states possible from mode selection
- [ ] Auto mode detection continues to work correctly

### BUG-10: Stale "Tabbed" Mode in localStorage Causes Empty Sidebar (Status: Open)

- [ ] Stale "tabbed" values in localStorage don't cause empty sidebar
- [ ] Mode falls back to auto-detected when invalid value found
- [ ] No data migration needed - handles on-the-fly
- [ ] Existing valid modes (flat/grouped) continue to work

### BUG-11: Presentation Discovery Rules Outdated (Status: Fixed)

- [ ] Folders with `presentation.html` are discovered as valid presentations
- [ ] Folders with only `index.html` are still discovered (backwards compatibility)
- [ ] Folders with `presentation-tab-*.html` files are discovered even without main entry point
- [ ] Folders with `index-*.html` files are discovered even without main entry point
- [ ] Default view for tabbed presentations respects tab order from manifest
- [ ] If no manifest, default to alphabetically first tab
- [ ] bmad-poem (with only `index-*.html` files) is discovered and loads correctly

### BUG-14: Agent API Missing Slide Authoring Specifications (Status: Open)

- [ ] `/api/authoring-specs` endpoint returns complete integration specifications
- [ ] Keyboard bridge script documented and provided
- [ ] Navigation bridge for card clicks documented and provided
- [ ] Card HTML structure for sync-from-index documented
- [ ] HTML metadata conventions documented
- [ ] `/api/templates/slide` returns usable slide template
- [ ] `/api/templates/index` returns usable index page template
- [ ] Agent using specs produces slides that don't break keyboard navigation
- [ ] Knowledge base updated with authoring guidelines

### BUG-15: Keyboard Navigation Breaks After Clicking Slide from Tab Landing Page (Status: Complete)

- [ ] Cmd+Arrow works after clicking a tab in the tab bar
- [ ] Cmd+Arrow works after clicking a card inside the tab landing page
- [ ] Cmd+Arrow works after clicking a slide in the sidebar
- [ ] State (selectedAssetId, currentAssetIndex) updates correctly on ALL navigation paths
- [ ] Keyboard bridge script is present in ALL iframe content
- [ ] Works with existing bmad-poem presentation

### FR-4: AppyDave Branding (Status: Implemented)

- [ ] Brand colors applied to FliDeck frame
- [ ] Typography follows AppyDave guidelines
- [ ] Sample presentation uses brand styling
- [ ] Consistent look across app and content

### FR-5: Presentation Controls (Status: Implemented)

- [ ] Touch/swipe support (optional - deferred to future FR)

### FR-6: Simplify Config UI (Status: Implemented)

- [ ] `FolderBrowser.tsx` deleted
- [ ] `GET /api/config/browse` endpoint removed
- [ ] `useBrowseDirectory` hook removed
- [ ] `DirectoryEntry` and `BrowseResponse` types removed from shared/types.ts
- [ ] `browse` query key removed from constants.ts
- [ ] ConfigPage no longer has Browse button
- [ ] Text input + Apply button still works
- [ ] History list still displays and is clickable
- [ ] No TypeScript errors after cleanup

### FR-10: Query API for External Systems (Status: Pending)

- [ ] `GET /api/query/routes` returns all configured presentation routes
- [ ] `GET /api/query/routes/:route` returns presentations for that route
- [ ] `GET /api/query/presentations/:id` returns assets for that presentation
- [ ] All endpoints return proper JSON with consistent structure
- [ ] 404 returned for non-existent routes or presentations
- [ ] Endpoints are read-only (no side effects)

### FR-11: FliDeck Claude Skill (Status: Complete)

- [ ] SKILL.md created with proper YAML frontmatter
- [ ] health-command.md documents health endpoint
- [ ] routes-command.md documents routes endpoints
- [ ] presentations-command.md documents presentations endpoint
- [ ] Skill follows same structure as FliHub skill
- [ ] Claude Code recognizes and uses the skill

### FR-18: Custom Index Page Integration (Status: Archived - superseded by FR-20)

- [ ] JavaScript library available at `/flideck-index.js`
- [ ] Standard mode: Simple list rendering with optional section headers
- [ ] Grouped mode: Section headers from group definitions
- [ ] Tabbed mode: Tab UI with group-based content switching
- [ ] Reorder events propagate to custom index.html
- [ ] Tab state persists across page refreshes
- [ ] BMAD Poem index.html migrated to use the library
- [ ] Documentation for custom index page authors

### FR-19: Manifest Schema & Data API (Status: Complete)

- [ ] JSON Schema file created at `shared/schema/manifest.schema.json`
- [ ] `GET /api/schema/manifest` returns the schema
- [ ] `GET /api/presentations/:id/manifest` returns raw manifest
- [ ] `PUT /api/presentations/:id/manifest` replaces manifest with validation
- [ ] `PATCH /api/presentations/:id/manifest` merges partial updates
- [ ] Validation errors return structured error response
- [ ] TypeScript types generated from or synced with JSON Schema
- [ ] Existing endpoints (reorder, slides, groups) internally use manifest API

### FR-20: UI Rendering Modes (Status: Complete)

- [ ] BMAD Poem presentation migrated to use tabbed mode (optional)

### FR-21: Agent Manifest Tooling (Status: Completed)

- [ ] `/api/schema/manifest` returns full JSON Schema (FR-19)
- [ ] Schema includes descriptions and examples for each field
- [ ] `POST .../slides/bulk` adds multiple slides in one request
- [ ] `POST .../groups/bulk` adds multiple groups in one request
- [ ] `PUT .../sync` synchronizes manifest with filesystem
- [ ] Position control: start, end, after specific slide
- [ ] `GET /api/templates/manifest` lists available templates
- [ ] `POST .../template` applies template to presentation
- [ ] At least 3 built-in templates (simple, tutorial, persona-tabs)
- [ ] Duplicate file handling: skip, replace, rename
- [ ] Group mismatch handling: keep, update
- [ ] `POST .../validate` validates manifest against schema
- [ ] File existence checking option
- [ ] Orphan file detection (files not in manifest)
- [ ] Dry run mode for bulk operations

### FR-22: Tab Management (Status: Complete - API and UI implemented, some features deferred)

- [ ] Drag tab headers to reorder (deferred - less critical)
- [ ] Drag group headers to reorder in grouped mode (deferred)
- [ ] Drag group headers to reorder within tab in tabbed mode (deferred)
- [ ] Visual drop zone indicators (deferred)

### FR-23: Group Reorder UI (Status: Deferred)

- [ ] Group headers show drag handle (⋮⋮) on hover
- [ ] Group headers are draggable (not just the icon)
- [ ] Dragging group header shows visual feedback (transparency)
- [ ] Drop zones appear between groups during drag
- [ ] Dropping updates group order optimistically in UI
- [ ] API call persists order to manifest
- [ ] Order persists after page refresh
- [ ] Other users see updated order via Socket.io event
- [ ] Undo action available if drag was accidental (toast with "Undo"?)
- [ ] Cannot drag group above index.html asset
- [ ] Dragging group doesn't interfere with asset drag-and-drop
- [ ] Works with collapsed groups (group stays collapsed after reorder)
- [ ] Works with empty groups (groups with no assets)
- [ ] Works when sidebar is filtered by container tab (FR-24)
- [ ] Keyboard alternative for reordering (up/down arrows on focused group?)
- [ ] Screen reader announces drag state ("Dragging Introduction group")
- [ ] Screen reader announces drop zones ("Drop before Getting Started")

### FR-24: Container Tab Navigation (Status: Implemented)

- [ ] Tab bar renders between header and content area
- [ ] Tab bar is to the right of sidebar
- [ ] Tabs display label and optional subtitle
- [ ] Active tab is visually highlighted
- [ ] "+ New Tab" button at end of tab bar
- [ ] Tab bar horizontally scrolls if many tabs
- [ ] Clicking tab loads corresponding file into iframe
- [ ] Active tab persists to localStorage per presentation
- [ ] Sidebar filters groups by active tab
- [ ] Slides filter to show only slides in active tab's groups
- [ ] Tab bar remains visible when header/sidebar hidden
- [ ] Tab navigation works in presentation mode
- [ ] Tab bar repositions appropriately (top of viewport?)
- [ ] `tabs` array in manifest defines tabs
- [ ] `tabs[].file` specifies index file to load
- [ ] `groups[].tab` links group to a tab
- [ ] Missing `tabs` array = no tab bar (backward compatible)
- [ ] Create tab via API adds to `tabs` array
- [ ] Delete tab removes from `tabs` array
- [ ] Rename tab updates `tabs[].label`
- [ ] Reorder tabs updates `tabs[].order`
- [ ] Presentations without `tabs` array work as before
- [ ] Legacy `groups[].tab: true` deprecated but still functional?

### FR-25: Smart Display Mode with Container Tabs (Status: Implemented)

- [ ] When `tabs[]` exists and a tab is active, sidebar shows ONLY that tab's content
- [ ] Ungrouped assets filter by tab (via `tabId` on asset or group assignment)
- [ ] Switching tabs updates sidebar content immediately
- [ ] Filtering works in both flat and grouped display modes
- [ ] No assets/groups from other tabs are visible
- [ ] When `tabs[]` exists, "Tabbed" option is hidden
- [ ] Mode switcher shows only "Flat" and "Grouped" options
- [ ] Mode switching still works (affects HOW filtered content is rendered)
- [ ] Auto-detection never returns "tabbed" when container tabs exist
- [ ] Presentations without `tabs[]` work as before (no regression)
- [ ] Empty tabs (no groups/assets) show empty state in sidebar
- [ ] Ungrouped assets in a tab show under "Ungrouped" section
- [ ] Assets not assigned to any tab (orphans) - show in all tabs? or hidden? (TBD)
- [ ] Sidebar header shows active tab context (optional, nice-to-have)
- [ ] Switching tabs has smooth transition (optional)

### FR-26: Index HTML Sync (Status: Implemented)

- [ ] Detects `index-*.html` files as tabs
- [ ] Creates `tabs[]` entries with correct id, label, file, order
- [ ] Label derived from filename (e.g., "index-mary.html" → "Mary")
- [ ] Handles single index.html (no tabs created)
- [ ] Detects cards with `href` attribute
- [ ] Detects cards with `data-slide` attribute
- [ ] Detects cards with onclick containing .html reference
- [ ] Extracts card order from DOM position
- [ ] Extracts title from card text content
- [ ] Creates groups per tab with correct `tabId`
- [ ] Assigns slides to groups based on source index file
- [ ] Preserves existing slide metadata (doesn't overwrite)
- [ ] "merge" strategy adds to existing, "replace" starts fresh
- [ ] Handles cards with no detectable slide reference (skipped with warning)
- [ ] Handles duplicate slides across tabs (assigns to first found)
- [ ] Handles slides not in any index (remains ungrouped)
- [ ] Returns detailed report of what was parsed/created

### FR-27: Agent Capability Discovery API (Status: Implemented)

- [ ] `GET /api/capabilities` returns structured capability description
- [ ] Response includes all concepts (presentation, tab, group, slide, manifest)
- [ ] Response includes common workflows with examples
- [ ] Response includes API summary organized by category
- [ ] Response includes practical tips for agents
- [ ] Response is human-readable (not just JSON Schema)
- [ ] Response includes version number for compatibility checking
- [ ] Response updates automatically when new features are added

### FR-28: Resizable Sidebar Panel (Status: Complete)

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

### FR-29: Slide Notes in Manifest (Status: Pending)

- [ ] `shared/src/types.ts` updated with `notes?: string` in `ManifestSlide` interface
- [ ] JSON Schema in `/api/schema/manifest` includes `notes` field with type `string`, marked as optional
- [ ] TypeScript compiler accepts manifests with and without `notes` field
- [ ] `POST /api/presentations/:id/slides` accepts `notes` in request body
- [ ] `PUT /api/presentations/:id/slides/:slideId` can update `notes` field
- [ ] `POST /api/presentations/:id/manifest/slides/bulk` accepts `notes` for each slide
- [ ] `GET /api/presentations/:id` returns slides with `notes` field if present
- [ ] `GET /api/presentations/:id/manifest` returns raw manifest with `notes`
- [ ] Notes written to `index.json` when creating slides
- [ ] Notes persist across server restarts
- [ ] Notes survive manifest sync operations (don't get deleted)
- [ ] Existing manifests without `notes` load successfully
- [ ] Slides without `notes` display normally in UI
- [ ] No validation errors for missing `notes` field
- [ ] CLAUDE.md API table mentions `notes` parameter where applicable
- [ ] `/api/capabilities` workflow examples show `notes` usage
- [ ] JSON Schema documentation describes `notes` field purpose

### FR-30: Image-to-Slide Script (Status: Pending)

- [ ] A script or agent workflow can accept a list of image URLs and a presentation name
- [ ] Images are downloaded to `{presentationsRoot}/{presentation-name}/` as `slide-NN.{ext}`
- [ ] One HTML wrapper is generated per image using the standard template
- [ ] `index.json` is created with all slides registered in order with meaningful titles
- [ ] The resulting folder, when opened in FliDeck, renders all images correctly
- [ ] Calling `PUT /api/presentations/{id}/manifest/sync` after creation picks up the presentation without a restart
- [ ] Works with a mix of local file paths and remote URLs

### FR-31: Image File Auto-Discovery (Status: Pending)

- [ ] FliDeck discovers `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg` files in presentation folders
- [ ] Image files appear as slides in the sidebar alongside HTML slides
- [ ] Clicking an image slide loads it in the iframe (centered, black background, aspect ratio preserved via `object-fit: contain`)
- [ ] Image slides are ordered by filesystem creation time by default (per FR-13)
- [ ] `index.json` can override `title`, `order`, and `group` for image slides
- [ ] Image slides work in flat, grouped, and tabbed presentation types
- [ ] A presentation folder containing only image files (no HTML at all) is valid and renders correctly
- [ ] A mixed folder (HTML slides + image slides) renders both types correctly in order
- [ ] The auto-generated HTML wrapper is not written to disk — it is generated in memory at serve time

### FR-32: Image Import API (Status: Pending)

- [ ] `POST /api/presentations/:id/import/images` accepts an array of image URLs and/or local paths
- [ ] Images are downloaded/copied to the presentation folder with sequential naming (`slide-NN.{ext}`)
- [ ] HTML wrapper files are generated for each image (when `generateWrappers: true`)
- [ ] `index.json` is updated with the new slide entries including titles
- [ ] The presentation cache is refreshed after import — slides appear in FliDeck UI without a manual sync
- [ ] Partial failures do not abort the batch — successful images are still imported
- [ ] Response includes per-image status (ok / error / skipped) and a summary
- [ ] If the presentation folder does not exist, it is created automatically
- [ ] Naming conflicts are handled according to the `onConflict` strategy (default: skip)
- [ ] Endpoint is documented in the capabilities response (`GET /api/capabilities`)

### NFR-1: Real-Time File Watching (Status: Pending)

- [ ] When a presentation HTML file is modified externally, the iframe updates within 1 second
- [ ] When a new HTML file is added to a presentation folder, the sidebar updates
- [ ] When an HTML file is deleted, the sidebar updates
- [ ] When an HTML file is renamed, the sidebar updates
- [ ] No manual page refresh required for any of the above
- [ ] Changes to non-HTML files (e.g., CSS, JS, images) also trigger iframe reload

## PRDs with All ACs Checked (or No ACs)

- BUG-12 (Unhelpful Slide Names - Fixed)
- BUG-13 (Tab Filtering Not Working - Fixed)
- FR-01 (Initial Setup - Implemented)
- FR-02 (JSON Config - Implemented)
- FR-03 (Config UI - Implemented)
- FR-07 (Asset Ordering - Pending header, but ACs checked)
- FR-08 (Sidebar Layout - Pending header, but ACs checked)
- FR-09 (Quick Filter - Implemented)
- FR-12 (Copy Path to Clipboard - Implemented)
- FR-13 (Creation-Time Ordering - Implemented)
- FR-14 (Rename Manifest - Implemented)
- FR-15 (Rich Manifest Schema - Implemented)
- FR-16 (Agent Slide API - Implemented)
- FR-17 (Group Management - Implemented)
- FR-20-SAT (UI Rendering Modes Story Acceptance Test - no ACs)

## Notes

- Several PRDs marked as "Fixed" or "Implemented" still have unchecked ACs — these should be
  verified against the actual implementation and ticked off if done, or investigated if not.
- BUG-3 is "Closed - Not a Bug" but has 5 unchecked ACs — these may be irrelevant.
- FR-18 is "Archived (superseded by FR-20)" but has 8 unchecked ACs — these can be dismissed.
- FR-22 and FR-23 unchecked items are explicitly marked as deferred.
- FR-23 is entirely deferred with 17 unchecked ACs.
- The highest unchecked AC counts are: FR-24 (23), FR-26 (17), FR-23 (17), FR-29 (17), FR-21 (15), FR-25 (15).
