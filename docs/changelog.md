# Changelog

Implementation history for FliDeck.

## Quick Summary

| Date       | What                                                             | FRs    |
| ---------- | ---------------------------------------------------------------- | ------ |
| 2026-01-07 | Resizable sidebar with S/M/L preset size buttons                 | FR-28  |
| 2025-12-28 | Extract slide titles from HTML `<title>` tags in sync-from-index | BUG-12 |
| 2025-12-26 | Agent capability discovery API (`GET /api/capabilities`)         | FR-27  |
| 2025-12-26 | Index HTML sync — parse index files to populate manifest         | FR-26  |
| 2025-12-24 | Smart display mode filtering when container tabs are present     | FR-25  |
| 2025-12-24 | Container-level tab bar; each tab loads a separate index file    | FR-24  |
| 2025-12-24 | Tab CRUD API and UI with group-tab relationship management       | FR-22  |
| 2025-12-24 | Agent manifest tooling: bulk ops, templates, validation, sync    | FR-21  |
| 2025-12-24 | Flat/grouped/tabbed rendering modes with auto-detection          | FR-20  |
| 2025-12-24 | Formal manifest JSON schema, GET/PUT/PATCH manifest endpoints    | FR-19  |
| 2025-12-22 | Group CRUD API and UI (create, rename, delete via sidebar)       | FR-17  |
| 2025-12-22 | Agent slide management API (create presentation, add/update/delete slides) | FR-16  |
| 2025-12-22 | Rich manifest schema with groups and collapsible sidebar         | FR-15  |
| 2025-12-22 | Rename manifest from flideck.json to index.json                  | FR-14  |
| 2025-12-22 | Default creation-time ordering for assets (oldest first)         | FR-13  |
| 2025-12-21 | Quick filter (Cmd+K) for presentations and assets                | FR-9   |
| 2025-12-21 | Copy path to clipboard (Alt+hover reveals URL/ABS/REL buttons)   | FR-12  |
| 2025-12-21 | Claude skill for FliDeck                                         | FR-11  |
| 2025-12-21 | Query API for external systems                                   | FR-10  |
| 2025-12-21 | Real-time file watching                                          | NFR-1  |
| 2025-12-19 | Simplified config UI (text input, removed folder browser)        | FR-6   |
| 2025-12-19 | Presentation controls with keyboard navigation                   | FR-5   |
| 2025-12-19 | AppyDave branding applied to UI                                  | FR-4   |
| 2025-12-19 | Sidebar layout: assets at top, presentation switcher in header   | FR-8   |
| 2025-12-19 | Custom asset ordering with drag-and-drop and flideck.json manifest | FR-7  |
| 2025-12-18 | Configuration UI                                                 | FR-3   |
| 2025-12-18 | JSON-based configuration with hot reload                         | FR-2   |
| 2025-12-18 | Documentation scaffolding                                        | -      |
| 2025-12-18 | Initial project setup                                            | FR-1   |

---

## Detailed History

### 2026-01-07 - Resizable Sidebar Panel

**Commit:** `pending`
**FRs:** FR-28

**What was done:**

- Created `useResizableSidebar` hook with preset size buttons (S/M/L): 280px, 380px, 480px
- Added size buttons to Assets header next to the mode switcher
- Width preference persisted to `localStorage` key `flideck:sidebarWidth` and restored on load
- Reduced excessive sidebar padding (root 20px → 12px, nested 36px → 20px)
- Initial drag-handle approach replaced with button-based presets due to timing/async issues with React state

**Files changed:**

- `client/src/hooks/useResizableSidebar.ts` (new) - Hook for preset size logic
- `client/src/components/layout/Sidebar.tsx` (modified) - S/M/L buttons, reduced padding
- `client/src/components/layout/SidebarFlat.tsx` (modified) - Reduced padding
- `client/src/components/layout/SidebarGrouped.tsx` (modified) - Reduced padding

---

### 2025-12-26 - Agent Capability Discovery API

**Commit:** `pending`
**FRs:** FR-27

**What was done:**

- Created `GET /api/capabilities` endpoint returning structured, human-readable capability description
- Response includes concepts (presentation, tab, group, slide, manifest) with `when_to_use` guidance
- Response includes common workflows with step-by-step examples (add slide, create tabbed, sync, query, sync-from-index)
- Response includes full API summary organised by category and practical agent tips
- Version number included for compatibility checking

**Files changed:**

- `server/src/routes/capabilities.ts` (new) - Route with CAPABILITIES object
- `server/src/routes/index.ts` (modified) - Registered capabilities route
- `CLAUDE.md` (modified) - Added endpoint to API table

---

### 2025-12-26 - Index HTML Sync (Self-Healing Manifest)

**Commit:** `pending`
**FRs:** FR-26

**What was done:**

- Added `PUT /api/presentations/:id/manifest/sync-from-index` endpoint
- Detects `index-*.html` files as tabs (e.g., `index-mary.html` → tab id "mary")
- Parses card elements using multiple patterns: `.card`, `.asset-card`, `[data-slide]`, `a[href$=".html"]`
- Creates `tabs[]` entries and per-tab groups with `tabId` assignments in the manifest
- Assigns slides to groups based on which index file referenced them
- Supports `merge` (default) and `replace` strategies
- Returns detailed sync report: tabs/groups created or updated, slides assigned/skipped/orphaned, warnings
- Uses `cheerio` for server-side HTML parsing

**Files changed:**

- `server/package.json` (modified) - Added cheerio dependency
- `shared/src/types.ts` (modified) - Added SyncFromIndexRequest/Response, ParsedCard, ParsedIndexResult types
- `server/src/services/PresentationService.ts` (modified) - Added syncFromIndex and HTML parsing methods
- `server/src/routes/presentations.ts` (modified) - Added sync-from-index route
- `CLAUDE.md` (modified) - Documented new endpoint

---

### 2025-12-24 - Smart Display Mode with Container Tabs

**Commit:** `pending`
**FRs:** FR-25

**What was done:**

- Fixed sidebar filtering so ungrouped assets (no group property) appear in all tabs
- Hidden "Tabbed" mode option from mode switcher when `presentation.tabs` exists (only Flat/Grouped shown)
- Updated `detectDisplayMode()` to never return `'tabbed'` when container tabs are present
- Removed FR-24 workaround that forced `rawMode === 'tabbed'` to render as grouped
- Clarified that container tabs (WHAT to show) and display mode (HOW to render) are orthogonal

**Files changed:**

- `client/src/components/layout/Sidebar.tsx` (modified) - Filtering fix, mode switcher update, removed workaround
- `client/src/utils/displayMode.ts` (modified) - Auto-detection skips 'tabbed' when container tabs exist

---

### 2025-12-24 - Container Tab Navigation

**Commit:** `pending`
**FRs:** FR-24

**What was done:**

- Moved tab bar from inside iframe content to the FliDeck container level (between header and content area)
- Each tab loads a separate index HTML file into the iframe (`index-mary.html`, `index-john.html`, etc.)
- Tab bar persists in presentation mode (header/sidebar hidden, tabs remain visible)
- Created `TabBar` component with horizontal scroll, active highlighting, and subtitle support
- Created `useContainerTab` hook with localStorage persistence per presentation
- AssetViewer updated to support both `srcdoc` (sidebar assets) and `src` (tab index files) modes
- Sidebar filters groups and slides by active container tab; backward compatible when no `tabs[]` array

**Files changed:**

- `client/src/components/ui/TabBar.tsx` (new)
- `client/src/hooks/useContainerTab.ts` (new)
- `shared/src/types.ts` (modified) - Added TabDefinition, extended Presentation/FlideckManifest/GroupDefinition
- `server/src/services/PresentationService.ts` (modified) - Parse tabs[] from manifest
- `client/src/components/ui/AssetViewer.tsx` (modified) - Dual mode, error handling
- `client/src/pages/PresentationPage.tsx` (modified) - TabBar integration, container tab logic
- `client/src/components/layout/Sidebar.tsx` (modified) - Filter groups by activeContainerTabId

---

### 2025-12-24 - Tab Management

**Commit:** `pending`
**FRs:** FR-22

**What was done:**

- Added Tab CRUD API endpoints: `POST`, `PUT`, `DELETE /api/presentations/:id/tabs/:tabId`, `PUT .../tabs/order`
- Tab deletion supports three strategies via query param: `orphan` (default), `cascade`, `reparent:<tabId>`
- Added Group-Tab relationship API: `PUT/DELETE /api/presentations/:id/groups/:groupId/parent`
- Sidebar UI: "+ New Tab" button, inline rename, context menu (rename/delete) on tab headers
- Delete confirmation shown when tab has child groups
- Group context menu "Move to tab" submenu and drag group header onto tab header

**Files changed:**

- `shared/src/types.ts` (modified) - Added CreateTabRequest, UpdateTabRequest, ReorderTabsRequest, SetGroupParentRequest
- `server/src/services/PresentationService.ts` (modified) - Added createTab, deleteTab, updateTab, reorderTabs, setGroupParent, removeGroupParent
- `server/src/routes/presentations.ts` (modified) - Added 6 new tab and group-parent endpoints
- `client/src/components/layout/Sidebar.tsx` (modified) - Tab management state and handlers
- `client/src/components/layout/SidebarTabbed.tsx` (modified) - Tab management UI

---

### 2025-12-24 - Agent Manifest Tooling

**Commit:** `pending`
**FRs:** FR-21

**What was done:**

- Added bulk slide operations: `POST .../manifest/slides/bulk` with position control, auto-create groups, conflict resolution (skip/replace/rename)
- Added bulk group operations: `POST .../manifest/groups/bulk`
- Added filesystem sync: `PUT .../manifest/sync` with merge/replace/addOnly strategies and `inferGroups`/`inferTitles` options
- Added manifest validation: `POST .../manifest/validate` with file existence checking and orphan detection
- Added template system: 5 built-in templates (simple, tutorial, persona-tabs, api-docs, component-library)
- Added template endpoints: `GET /api/templates/manifest`, `GET /api/templates/manifest/:id`, `POST .../manifest/template`
- All bulk operations support `dryRun` mode

**Files changed:**

- `shared/src/types.ts` (modified) - Added bulk operation, sync, validation, and template types
- `server/src/services/PresentationService.ts` (modified) - Added bulkAddSlides, bulkAddGroups, syncManifest, validateManifest, applyTemplate
- `server/src/routes/presentations.ts` (modified) - Added 5 new endpoints
- `server/src/routes/templates.ts` (new) - Template listing and retrieval
- `server/src/data/manifestTemplates.ts` (new) - 5 built-in template definitions

---

### 2025-12-24 - UI Rendering Modes

**Commit:** `pending`
**FRs:** FR-20

**What was done:**

- Implemented three sidebar rendering modes: flat (simple list), grouped (collapsible headers), tabbed (tab bar with nested groups)
- Auto-detection based on slide count: flat (0-15 slides), grouped (15-50), tabbed (50+ or explicit tab groups)
- Manual override via manifest `meta.displayMode` or per-session UI toggle in sidebar header
- Refactored Sidebar into mode-specific components: `SidebarFlat`, `SidebarGrouped`, `SidebarTabbed`
- Implemented cross-group drag-drop: drag assets between groups, drag assets to tab headers
- Created `/flideck-index.js` library for optional custom index.html integration (Socket.io reorder sync, tab state persistence)

**Files changed:**

- `client/src/utils/displayMode.ts` (new)
- `client/src/hooks/useDisplayMode.ts` (new)
- `client/src/components/layout/SidebarFlat.tsx` (new)
- `client/src/components/layout/SidebarGrouped.tsx` (new)
- `client/src/components/layout/SidebarTabbed.tsx` (new)
- `server/public/flideck-index.js` (new)
- `shared/src/types.ts` (modified) - Added DisplayMode type, updated GroupDefinition/ManifestMeta
- `client/src/components/layout/Sidebar.tsx` (modified) - Complete refactor for multi-mode support
- `server/src/index.ts` (modified) - Static file serving for public directory

---

### 2025-12-24 - Manifest Schema & Data API

**Commit:** `pending`
**FRs:** FR-19

**What was done:**

- Created formal JSON Schema at `shared/schema/manifest.schema.json` with full validation rules and examples
- Installed `ajv` and `ajv-formats` for JSON Schema validation
- Created `manifestValidator.ts` utility with `validate()`, `validateOrThrow()`, and `getSchema()` functions
- Added `GET /api/schema/manifest` endpoint to expose the JSON Schema
- Added `GET /api/presentations/:id/manifest` to retrieve raw manifest JSON
- Added `PUT /api/presentations/:id/manifest` for full replacement with schema validation
- Added `PATCH /api/presentations/:id/manifest` for deep-merge partial updates
- Validation errors return structured 400 responses with field-level detail

**Files changed:**

- `shared/schema/manifest.schema.json` (new) - JSON Schema definition
- `server/src/utils/manifestValidator.ts` (new) - Validation utility
- `server/src/routes/schema.ts` (new) - Schema routes
- `server/src/services/PresentationService.ts` (modified) - Added getManifest, setManifest, patchManifest
- `server/src/routes/presentations.ts` (modified) - Added manifest endpoints
- `server/src/routes/index.ts` (modified) - Registered schema routes

---

### 2025-12-22 - Group Management

**Commit:** `pending`
**FRs:** FR-17

**What was done:**

- Added Group CRUD API: `PUT .../groups/order`, `POST .../groups`, `PUT .../groups/:groupId`, `DELETE .../groups/:groupId`
- Delete group moves slides to root level (no group assignment)
- Group IDs auto-generated as kebab-case from label
- Sidebar context menu (⋮) on group headers with Rename and Delete options
- Inline edit mode for renaming groups (Enter to save, Escape to cancel)
- "+ New Group" button at bottom of groups section

**Files changed:**

- `shared/src/types.ts` (modified) - Added ReorderGroupsRequest, CreateGroupRequest, UpdateGroupRequest
- `server/src/services/PresentationService.ts` (modified) - Added reorderGroups, createGroup, updateGroup, deleteGroup
- `server/src/routes/presentations.ts` (modified) - Added 4 group endpoints
- `client/src/components/layout/Sidebar.tsx` (modified) - Group management UI
- `client/src/utils/api.ts` (modified) - Added delete method

---

### 2025-12-22 - Agent Slide Management API

**Commit:** `pending`
**FRs:** FR-16

**What was done:**

- Added `POST /api/presentations` to create a presentation folder and `index.json` manifest
- Added `POST /api/presentations/:id/slides` to append a slide to the manifest
- Added `PUT /api/presentations/:id/slides/:slideId` to update slide metadata (title, group, description, recommended)
- Added `DELETE /api/presentations/:id/slides/:slideId` to remove a slide from the manifest (HTML file not touched)
- Presentation IDs validated as folder-name safe; slide files must end with `.html`
- Legacy `assets.order` format auto-converted to `slides[]` format when adding slides
- All endpoints return 400/404/409 codes and emit `presentations:updated` socket event

**Files changed:**

- `shared/src/types.ts` (modified) - Added CreatePresentationRequest/Response, AddSlideRequest, UpdateSlideRequest
- `server/src/services/PresentationService.ts` (modified) - Added createPresentation, addSlide, updateSlide, removeSlide
- `server/src/routes/presentations.ts` (modified) - Added 4 new endpoints

---

### 2025-12-19 - Sidebar Layout & Presentation Switcher

**Commit:** `pending`
**FRs:** FR-8

**What was done:**

- Moved Assets section to top of sidebar (above presentations) for camera-overlay-friendly recording
- Added presentation dropdown (▼) in header showing all presentations with current one marked
- Dropdown closes on selection, click outside, or Escape
- Presentations section removed from sidebar on PresentationPage (handled by header dropdown)
- PresentationPage fetches all presentations to populate the dropdown

**Files changed:**

- `client/src/components/layout/Sidebar.tsx` (modified) - Reordered sections, added showPresentations prop
- `client/src/components/layout/Header.tsx` (modified) - Added dropdown with presentations
- `client/src/pages/PresentationPage.tsx` (modified) - Pass presentations to Header, hide sidebar presentations

---

### 2025-12-19 - Custom Asset Ordering

**Commit:** `pending`
**FRs:** FR-7

**What was done:**

- Added `FlideckManifest` type with `assets.order` array for persisting custom slide order
- PresentationService reads `flideck.json` manifest and applies self-healing ordering: missing files skipped, new files appended alphabetically, corrupted manifest falls back to default
- Added `PUT /api/presentations/:id/order` endpoint to save new asset order
- Native HTML5 drag-and-drop in Sidebar with drag handle and drop-target highlighting
- Dropping saves new order to `flideck.json` automatically; external changes detected by watcher

**Files changed:**

- `shared/src/types.ts` (modified) - Added FlideckManifest and UpdateAssetOrderRequest types
- `server/src/services/PresentationService.ts` (modified) - Manifest reading and self-healing ordering logic
- `server/src/routes/presentations.ts` (modified) - Added PUT order endpoint
- `client/src/components/layout/Sidebar.tsx` (modified) - Drag-and-drop UI
- `CLAUDE.md` (modified) - Updated documentation

---

### 2025-12-22 - Rich Manifest Schema with Groups

**Commit:** `pending`
**FRs:** FR-15

**What was done:**

- Added rich schema types: `ManifestMeta`, `ManifestStats`, `GroupDefinition`, `ManifestSlide`
- Extended Asset type with `group`, `title`, `description`, `recommended` fields
- Extended Presentation type with `groups` and `meta` fields
- PresentationService parses both new `slides[]` format and legacy `assets.order`
- Sidebar groups assets by their `group` property with collapsible sections
- Groups sorted by `order` value, "Ungrouped" appears last
- Slides display `title` from manifest, recommended slides show ★ indicator
- Group collapse state persisted in localStorage

**Files created:**

- None (types added to existing shared/src/types.ts)

**Files modified:**

- `shared/src/types.ts` - Added schema types, extended Asset and Presentation
- `server/src/services/PresentationService.ts` - Parse new schema, apply slide metadata
- `client/src/components/layout/Sidebar.tsx` - Grouped sections with collapsible UI

---

### 2025-12-22 - Rename Manifest to index.json

**Commit:** `pending`
**FRs:** FR-14

**What was done:**

- Changed manifest filename from `flideck.json` to `index.json`
- Added backwards compatibility: reads `flideck.json` if `index.json` doesn't exist
- New saves always write to `index.json`
- Updated CLAUDE.md with new filename and backwards compatibility note

**Files modified:**

- `server/src/services/PresentationService.ts` - Updated constants, added fallback read logic
- `shared/src/types.ts` - Updated FlideckManifest comment
- `CLAUDE.md` - Updated file discovery and asset ordering sections

---

### 2025-12-22 - Default Creation-Time Ordering

**Commit:** `pending`
**FRs:** FR-13

**What was done:**

- Changed default asset ordering from alphabetical to creation time (oldest first)
- Added `createdAt` field to Asset interface using `birthtimeMs` (falls back to `mtimeMs`)
- `index.html` still always appears first regardless of creation time
- When manifest exists, custom order is still respected (no change)

**Files modified:**

- `shared/src/types.ts` - Added createdAt field to Asset interface
- `server/src/services/PresentationService.ts` - Updated discoverAssets to capture birthtime and sort by creation time

---

### 2025-12-21 - Quick Filter (Cmd+K)

**Commit:** `pending`
**FRs:** FR-9

**What was done:**

- Created QuickFilter modal component with VS Code/Raycast-style UI
- Created useQuickFilter hook for global Cmd+K keyboard shortcut
- On HomePage: filters and navigates to presentations
- On PresentationPage: filters and navigates to assets
- Keyboard support: Arrow keys navigate, Enter selects, Escape closes
- Real-time filtering with case-insensitive substring matching
- Uses React Portal for proper overlay stacking

**Files created:**

- `client/src/components/ui/QuickFilter.tsx`
- `client/src/hooks/useQuickFilter.ts`

**Files modified:**

- `client/src/pages/HomePage.tsx`
- `client/src/pages/PresentationPage.tsx`

---

### 2025-12-21 - Real-Time File Watching

**Commit:** `pending`
**FRs:** NFR-1

**What was done:**

- Server emits granular socket events: `content:changed` for file modifications, `structure:changed` for add/remove/rename
- Added `parseAssetPath()` helper to extract presentationId/assetId from file paths
- New `useContentChanges()` hook listens for content changes and triggers iframe reload via `reloadKey`
- AssetViewer accepts `reloadKey` prop to force iframe refresh without full page reload
- Reduced debounce from 500ms to 200ms for faster response

**Files modified:**

- `server/src/index.ts` - Added parseAssetPath, handlePresentationChange, granular event emission
- `client/src/hooks/useSocket.ts` - Added useContentChanges hook
- `client/src/pages/PresentationPage.tsx` - Integrated useContentChanges hook
- `client/src/components/ui/AssetViewer.tsx` - Added reloadKey prop support
- `shared/src/types.ts` - Added content:changed and structure:changed event types

---

### 2025-12-21 - Query API for External Systems

**Commit:** `pending`
**FRs:** FR-10

**What was done:**

- Created `/api/query/routes` endpoint - lists available presentation routes
- Created `/api/query/routes/:route` endpoint - returns presentations for a route
- Created `/api/query/presentations/:id` endpoint - returns detailed asset info with file sizes
- All endpoints return proper JSON with consistent structure
- 404 errors for non-existent routes or presentations

**Files created:**

- `server/src/routes/query.ts`

**Files modified:**

- `server/src/routes/index.ts` - Register query routes

---

### 2025-12-21 - Claude Skill for FliDeck

**Commit:** `pending`
**FRs:** FR-11

**What was done:**

- Created FliDeck Claude skill at `~/.claude/skills/flideck/`
- SKILL.md with proper YAML frontmatter (name, description)
- health-command.md documenting health endpoint
- routes-command.md documenting routes list and detail endpoints
- presentations-command.md documenting presentation detail endpoint
- Follows FliHub skill pattern and structure

**Files created:**

- `~/.claude/skills/flideck/SKILL.md`
- `~/.claude/skills/flideck/health-command.md`
- `~/.claude/skills/flideck/routes-command.md`
- `~/.claude/skills/flideck/presentations-command.md`

---

### 2025-12-21 - Copy Path to Clipboard

**Commit:** `pending`
**FRs:** FR-12

**What was done:**

- Alt/Option + hover on asset row reveals copy buttons (URL, ABS, REL)
- Alt/Option + hover on "Assets" header reveals buttons to copy ALL paths
- Clicking a button copies the path format to clipboard
- Toast notification confirms successful copy
- Created `useModifierKey` hook for tracking Alt key state

**Keyboard interaction:**

- Hold `Alt` (Option on Mac) + hover over asset → shows copy buttons
- Hold `Alt` (Option on Mac) + hover over "Assets" header → shows copy-all buttons

**Files created:**

- `client/src/hooks/useModifierKey.ts`

**Files modified:**

- `client/src/components/layout/Sidebar.tsx`

---

### 2025-12-19 - Simplified Config UI

**Commit:** `pending`
**FRs:** FR-6

**What was done:**

- Removed FolderBrowser component and server-side browse endpoint
- Simplified ConfigPage to three sections: Current Folder, History, Add Folder
- Add Folder now uses simple text input (paste path, press Enter)
- Removed unused types, hooks, and query keys

**Files deleted:**

- `client/src/components/config/FolderBrowser.tsx`

**Files modified:**

- `server/src/routes/config.ts` - removed browse endpoint
- `client/src/pages/ConfigPage.tsx` - simplified UI
- `client/src/hooks/useConfig.ts` - removed useBrowseDirectory
- `client/src/utils/constants.ts` - removed browse query key
- `shared/src/types.ts` - removed DirectoryEntry, BrowseResponse

---

### 2025-12-19 - Presentation Controls

**Commit:** `pending`
**FRs:** FR-5

**What was done:**

- Implemented presentation mode (`F` key) - hides header/sidebar for distraction-free viewing
- Added keyboard navigation with modifier keys (`Cmd/Ctrl+Arrow`, `Cmd/Ctrl+Home/End`)
- Added progress indicator (hidden in presentation mode)
- Added presentation mode button to header for discoverability
- Implemented postMessage bridge for keyboard events from iframe
- Presentation's internal controls work normally (no conflicts)

**Keyboard shortcuts:**

- `F` - Toggle presentation mode
- `Escape` - Exit presentation mode
- `Cmd/Ctrl + ←/→` - Previous/next asset
- `Cmd/Ctrl + Home/End` - First/last asset

**Files changed:**

- `client/src/pages/PresentationPage.tsx` (modified)
- `client/src/components/layout/Header.tsx` (modified)
- `client/src/components/ui/AssetViewer.tsx` (modified)

---

### 2025-12-19 - AppyDave Branding

**Commit:** `pending`
**FRs:** FR-4

**What was done:**

- Added Google Fonts (Bebas Neue, Oswald, Roboto) to index.html
- Created brand color CSS variables with semantic mappings
- Implemented AppyDave two-tone logo ("Appy" gold, "Dave" yellow) in Header
- Applied brand typography: BebasNeue for h1/buttons, Oswald for h2-h6 (uppercase), Roboto for body
- Updated all components with brand color scheme (brown, gold, yellow, blue)
- Implemented consistent hover states and 200ms transition animations

**Files changed:**

- `client/index.html` (modified)
- `client/src/index.css` (modified)
- `client/src/components/layout/Header.tsx` (modified)
- `client/src/components/layout/Sidebar.tsx` (modified)
- `client/src/components/ui/EmptyState.tsx` (modified)
- `client/src/components/ui/LoadingSpinner.tsx` (modified)
- `client/src/pages/HomePage.tsx` (modified)
- `client/src/pages/ConfigPage.tsx` (modified)

---

### 2025-12-18 - Configuration UI

**Commit:** `pending`
**FRs:** FR-3

**What was done:**

- Added configuration screen accessible via gear icon in header
- Created ConfigPage with current folder display, history list, and folder input
- Implemented server endpoints: GET/PUT /api/config
- Real-time updates via Socket.io config:changed event

**Files created:**

- `server/src/routes/config.ts`
- `client/src/hooks/useConfig.ts`
- `client/src/pages/ConfigPage.tsx`

**Files modified:**

- `server/src/routes/index.ts`
- `server/src/config.ts`
- `shared/src/types.ts`
- `client/src/App.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/utils/api.ts`
- `client/src/utils/constants.ts`

---

### 2025-12-18 - JSON-Based Configuration

**Commit:** `pending`
**FRs:** FR-2

**What was done:**

- Replaced environment variable config with JSON-based configuration
- Created `config.json` (gitignored) and `config.example.json` (committed)
- Added tilde (`~`) path expansion for user home directory
- Implemented hot reload - config changes apply without server restart
- Added history tracking for previously used presentation roots
- Enhanced WatcherManager with server-side callbacks

**Files changed:**

- `config.example.json` (new)
- `config.json` (new, gitignored)
- `.gitignore` (modified)
- `server/src/config.ts` (new)
- `server/src/index.ts` (modified)
- `server/src/WatcherManager.ts` (modified)

---

### 2025-12-18 - Documentation Scaffolding

**Commit:** `pending`

**What was done:**

- Created documentation structure (docs/)
- Set up backlog.md, changelog.md, brainstorming-notes.md
- Created prd/ and uat/ directories

**Files changed:**

- `docs/README.md` (new)
- `docs/backlog.md` (new)
- `docs/changelog.md` (new)
- `docs/brainstorming-notes.md` (new)

---

### 2025-12-18 - Initial Project Setup

**Commit:** `99128b2`
**FRs:** FR-1

**What was done:**

- Created FliDeck presentation harness
- React 19 + Vite + TailwindCSS client (port 5200)
- Express 5 + Socket.io + Chokidar server (port 5201)
- Shared TypeScript types
- File discovery from PRESENTATIONS_ROOT
- Real-time updates via Socket.io
- TanStack Query for server state

**Files changed:**

- `client/` - React frontend
- `server/` - Express backend
- `shared/` - TypeScript types
- `docs/planning/` - Architecture and requirements

---

<!--
Template for new entries:

### YYYY-MM-DD - [Title]

**Commit:** `xxxxxxx`
**FRs:** FR-X, FR-Y

**What was done:**
- [Change 1]
- [Change 2]

**Files changed:**
- `path/to/file.ts` (new/modified)

-->
