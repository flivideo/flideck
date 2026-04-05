---
generated: 2026-04-05
generator: system-context
status: snapshot
sources:
  - CLAUDE.md
  - package.json
  - Procfile
  - start.sh
  - .env.example
  - config.example.json
  - shared/src/types.ts
  - shared/schema/manifest.schema.json
  - server/src/index.ts
  - server/src/WatcherManager.ts
  - server/src/services/PresentationService.ts
  - server/src/services/ManifestService.ts
  - server/src/routes/capabilities.ts
  - client/src/App.tsx
  - client/src/harness/HarnessViewer.tsx
  - client/src/harness/stripSlideWrapper.ts
  - docs/backlog.md
  - docs/planning/requirements.md
  - docs/planning/architecture.md
  - tools/migrate-type-a.js
  - tools/migrate-type-b.js
  - context.globs.json
regenerate: "Run /system-context in the repo root"
---

# FliDeck — System Context

## Purpose
Local-first viewer for navigating folders of generated HTML slides (produced by Claude Code agents) without juggling browser tabs or manual file management.

## Core Abstractions
- **Presentation** — A folder on disk containing HTML files. The folder name is the ID. Must contain at least one entry point (`presentation.html`, `index.html`, or tabbed variants like `presentation-tab-*.html` / `index-*.html`). The folder is the atomic unit of discovery — no database, no registration; existence of an entry point makes it visible.
- **Harness Fragment** — The rendering format: an HTML file with `<html>/<head>/<body>` stripped via DOMParser, leaving only `<style>` blocks and body content. Injected into a scoped `.harness-slide` div with a canonical font stack (Bebas Neue, Oswald, Roboto, Roboto Mono) and 10 CSS token vars. Replaces iframes — styles are prefixed with `.harness-slide` to prevent bleed.
- **Manifest** (`index.json`) — Optional JSON file inside a presentation folder controlling slide ordering, grouping, tabs, and metadata. Self-healing: missing files are silently skipped, new files appear at end alphabetically, corrupted manifests fall back to default ordering. Legacy `flideck.json` files are read but new writes always go to `index.json`.
- **Group / Tab** — Organizational structures within a presentation. Groups are named containers for slides (collapsible sidebar sections). Tabs are top-level navigation containers for multi-audience/multi-perspective decks. Groups can belong to tabs via `tabId`. Tabs reference their own index HTML file.
- **WatcherManager** — Centralized Chokidar-based file watcher that debounces filesystem events and emits Socket.io events. Two watchers run: one on `presentationsRoot` (200ms debounce) for slide changes, one on `config.json` (500ms debounce) for hot-reload.

## Key Workflows
### Viewing a presentation (happy path)
1. User opens FliDeck at `localhost:5200`. The homepage lists all discovered presentations from `presentationsRoot`.
2. User clicks a presentation. React Router navigates to `/presentation/:id`. TanStack Query fetches presentation data; sidebar populates with assets (flat, grouped, or tabbed view based on manifest `displayMode`).
3. User clicks an asset in the sidebar. `HarnessViewer` strips the HTML wrapper, scopes styles, injects the fragment, re-executes inline scripts, and sets a `<base>` tag for relative asset resolution.
4. Keyboard shortcuts (`Cmd+Arrow`) navigate between assets. `Cmd+K` opens quick filter. `F` toggles presentation mode (hides chrome).

### Agent creates/manages slides (API workflow)
1. Agent discovers capabilities via `GET /api/capabilities` — returns concepts, workflows, and available endpoints.
2. Agent creates a presentation folder via `POST /api/presentations` with an ID, optional name, and initial slides.
3. Agent writes HTML slide files to the folder on disk, then registers them in the manifest via `POST /api/presentations/:id/slides` or bulk-adds via `POST /api/presentations/:id/manifest/slides/bulk` (with conflict resolution: skip, replace, rename).
4. Agent can sync manifest from filesystem (`PUT .../manifest/sync`), validate it (`POST .../manifest/validate`), or parse existing index HTML files to auto-populate (`PUT .../manifest/sync-from-index`).
5. Every filesystem write triggers WatcherManager → Socket.io → TanStack Query invalidation → UI updates in real time.

### Changing the presentations root
1. User edits `config.json` (or uses the Config page at `/config`). The `presentationsRoot` field points to any folder with presentation subfolders.
2. WatcherManager detects the config change, PresentationService hot-reloads: stops old watcher, starts new one, invalidates cache, emits `config:changed` via Socket.io. Previous root is saved to `history` (max 10 entries).
3. UI rebuilds the presentation list without restart.

### Migrating legacy slides to harness format
1. Run `tools/migrate-type-a.js` (pure CSS slides) or `tools/migrate-type-b.js` (CSS + safe JS patterns) against a presentation folder.
2. Tool strips `<html>/<head>/<body>`, adds `<!-- harness-fragment: type-a -->` comment, outputs to a `-v2/` sibling folder.
3. FliDeck discovers the migrated folder as a new presentation.

## Design Decisions
- **Harness fragments, not iframes**: Slides inject directly into scoped divs. This gives consistent font rendering, CSS token access, and eliminates iframe security/sizing headaches. *Alternative*: srcdoc iframes (used in early versions). *Rejected*: inconsistent font loading, no CSS token inheritance, complex height calculation, no keyboard bridge.
- **Agent-first API surface**: The REST API (40+ endpoints) is designed for Claude Code agents to create, manage, and bulk-sync presentations without human interaction. `/api/capabilities` enables self-documenting agent discovery. *Alternative*: human-only CRUD. *Rejected*: FliDeck's primary content producers are agents, not humans.
- **Filesystem as source of truth, manifest as overlay**: Presentations exist because folders exist. The manifest adds metadata but isn't required. This means agents can drop HTML files and FliDeck sees them immediately. *Alternative*: database-backed registry. *Rejected*: adds deployment complexity for a localhost tool.
- **Write locks on filesystem operations**: PresentationService and ManifestService serialize writes per presentation ID using promise-chain locks. *Alternative*: no locking (rely on OS). *Rejected*: concurrent agent writes to the same manifest caused data loss during bulk operations.
- **Config hot-reload via Chokidar**: Changing `config.json` triggers live update without restart. *Alternative*: require server restart. *Rejected*: breaks the "always-on viewer" UX when switching between presentation sets.
- **Technology cherry-picked from Storyline + FliHub**: React 19, Express 5, TanStack Query, Socket.io, Chokidar — patterns validated in sibling apps. WatcherManager from FliHub, service layer from Storyline, route factory from FliHub.

## Non-obvious Constraints
- **Slide HTML must be well-behaved**: Because slides render in a scoped div (not an iframe), global CSS selectors like `* { margin: 0 }` or `body { background: black }` in a slide will leak into the host if not properly scoped. The harness prefixes extracted `<style>` blocks with `.harness-slide`, but inline `style` attributes on elements that match host selectors can still cause issues.
- **External scripts are not re-fetched**: `stripSlideWrapper` extracts and re-executes inline `<script>` tags, but `<script src="...">` external scripts are deliberately skipped at PoC stage. Slides relying on external JS will break silently.
- **Viewport-lock auto-detection is heuristic**: `stripSlideWrapper` detects scroll-snap, `overflow: hidden` on body, and `100vh`/`95vh` heights to classify slides as viewport-lock. False positives apply `overflow: auto` instead of `overflow: hidden`, which can cause unexpected scrollbars.
- **Entry point priority matters**: `presentation.html` beats `index.html` beats `presentation-tab-*.html` beats `index-*.html`. A folder with both `presentation.html` and `index.html` uses the former as entry point. Renaming files changes which is the default view.
- **Manifest schema validation is non-blocking**: Invalid manifests log a warning but the app continues with best-effort data. A slide with a typo in its group ID won't crash — it just appears ungrouped.
- **Port 5200/5201 must be free**: The client dev server hardcodes 5200, server hardcodes 5201. `start.sh` checks and refuses to start a second instance, but raw `npm run dev` will fail silently or pick a different port, breaking the CORS configuration.
- **Tilde paths are expanded server-side**: `config.json` accepts `~/path` but expansion happens in Node at load time. The client sees the expanded absolute path.

## Expert Mental Model
- **Think "folder watcher with a REST API", not "presentation app"**: FliDeck doesn't own or understand slide content. It watches a directory tree, serves what it finds, and provides an API for agents to organize the metadata around those files. The moment you think of it as a presentation builder, you'll expect editing features that don't exist and won't be built.
- **The manifest is an overlay, not a requirement**: An expert knows that presentations work fine without `index.json`. The manifest adds ordering, grouping, tabs, and metadata — but a folder with just `index.html` and some `.html` files is a fully functional presentation. Start without a manifest; add one when organization matters.
- **Socket.io is the reactivity backbone, not polling**: Every filesystem change flows through WatcherManager → Socket.io → TanStack Query invalidation. If the UI isn't updating, check: (1) is the watcher running? (2) is Socket.io connected? (3) is the query key being invalidated? Don't add polling — fix the event chain.
- **Two audiences, one API**: The REST API serves both the React frontend (read-heavy, TanStack Query) and Claude Code agents (write-heavy, bulk operations). The `_context` object on response payloads exists specifically so agents know which `presentationsRoot` they're talking to without a separate config call.
- **Harness fragments are a compile step, not runtime**: The `tools/migrate-type-*.js` scripts are run once to convert legacy slides. At runtime, `stripSlideWrapper` handles both migrated fragments and full HTML documents. But migrated fragments are faster to process because the wrapper is already stripped.

## Scope Limits
- Does NOT create or edit slide content — views and organizes pre-existing HTML files. Slide generation is done by external Claude Code agents.
- Does NOT provide visual slide templates — the `templates` API provides manifest structure templates (metadata scaffolding) only, not visual designs.
- Does NOT have authentication or multi-user support — single-user, localhost only. No sessions, no RBAC.
- Does NOT sync to cloud or remote storage — presentations must exist on the local filesystem accessible to the Node server.
- Does NOT re-fetch external `<script src="...">` or `<link rel="stylesheet">` tags — font loading is the harness's responsibility via `harness.css`; other external resources in slides are not supported.
- Does NOT support non-HTML content — images, PDFs, videos within presentation folders are served statically but not rendered in the viewer. Only `.html` files appear as navigable assets.

## Failure Modes
- **Silent slide rendering failure**: A slide with global CSS resets (e.g., `* { font-size: 0 }`) will make the entire FliDeck UI invisible because styles bleed despite `.harness-slide` scoping. Recognition: host navigation disappears after selecting a specific slide. Fix: check the slide's `<style>` blocks for overly broad selectors.
- **Manifest corruption from concurrent writes**: If two agents write to the same manifest simultaneously and the write lock fails (e.g., process crash mid-write), `index.json` can end up with truncated JSON. Recognition: presentation loads but shows no groups/ordering. Fix: delete the corrupted `index.json` — FliDeck falls back to filesystem-based discovery.
- **Stale cache after watcher crash**: If Chokidar's watcher dies (happens with very large `presentationsRoot` directories or on NFS mounts), new files won't appear in the UI. Recognition: files exist on disk but don't show in the UI; server logs show no watcher events. Fix: `POST /api/presentations/refresh` forces a cache invalidation, or restart the server.
- **CORS mismatch on non-standard ports**: If the server starts on a port other than 5201 (e.g., port conflict), the client's hardcoded `CLIENT_URL` won't match, and all API calls fail silently with CORS errors. Recognition: browser console shows CORS preflight failures. Fix: ensure both `.env` PORT and client proxy config agree.
- **Broken keyboard shortcuts in viewport-lock slides**: Slides that call `stopPropagation` on keydown events steal Cmd+Arrow navigation. `useKeyboardBridge` uses capture-phase listeners to protect FliDeck shortcuts, but slides that override `addEventListener` itself (rare) can still break this. Recognition: arrow navigation stops working on a specific slide.
- **Config hot-reload race condition**: If `config.json` is written incrementally (editor saves partial content), the 500ms debounce may trigger a reload with invalid JSON. PresentationService logs the error and keeps the previous config, but the watcher may have already stopped for the old path. Recognition: server log shows "Failed to reload config" and UI stops updating. Fix: save config atomically or restart the server.
