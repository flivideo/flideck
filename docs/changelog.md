# Changelog

Implementation history for FliDeck.

## Quick Summary

| Date | What | FRs |
|------|------|-----|
| 2025-12-22 | Rich manifest schema with groups and collapsible sidebar | FR-15 |
| 2025-12-22 | Rename manifest from flideck.json to index.json | FR-14 |
| 2025-12-22 | Default creation-time ordering for assets (oldest first) | FR-13 |
| 2025-12-21 | Quick filter (Cmd+K) for presentations and assets | FR-9 |
| 2025-12-21 | Copy path to clipboard (Alt+hover reveals URL/ABS/REL buttons) | FR-12 |
| 2025-12-21 | Claude skill for FliDeck | FR-11 |
| 2025-12-21 | Query API for external systems | FR-10 |
| 2025-12-21 | Real-time file watching | NFR-1 |
| 2025-12-19 | Simplified config UI (text input, removed folder browser) | FR-6 |
| 2025-12-19 | Presentation controls with keyboard navigation | FR-5 |
| 2025-12-19 | AppyDave branding applied to UI | FR-4 |
| 2025-12-18 | Configuration UI | FR-3 |
| 2025-12-18 | JSON-based configuration with hot reload | FR-2 |
| 2025-12-18 | Documentation scaffolding | - |
| 2025-12-18 | Initial project setup | FR-1 |

---

## Detailed History

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
