# Changelog

All notable changes to FliDeck are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.6.0] - 2026-03-19

### Added

- **API response envelope standardisation (B014):** All API routes now return responses via a consistent `createApiResponse` helper, eliminating format inconsistencies between endpoints.
- **Route integration tests (B041):** Full integration test coverage for presentations, assets, config, query, schema, templates, and capabilities routes (35+ new tests).
- **Empty-root guard (B039):** `getById` now rejects requests when `presentationsRoot` is unset, preventing confusing 500 errors on unconfigured installs.

### Fixed

- **Prototype-pollution guard (security):** `deepMerge` implementations hardened to reject `__proto__` keys, preventing prototype pollution via malformed manifest PATCH payloads.
- **PATCH manifest atomicity (data-integrity):** Manifest PATCH operations are now serialised through a write mutex, eliminating a race condition that could corrupt `index.json` under concurrent writes.
- **PID injection in `cleanupPort` (security):** Shell-escape added around port argument; CSP header re-enabled after prior accidental disable.
- **`assertSafeId` runs before cache check (security):** Path-traversal guard is now enforced even when a cached presentation is returned, closing a bypass window.
- **Vite 6 → 7 upgrade (B013):** Client build toolchain upgraded to Vite 7 and `@vitejs/plugin-react` v5; `dist/` excluded from Vitest glob to prevent test double-counting.
- **Singleton isolation in route tests (B042):** `afterAll` resets added to route integration tests so `PresentationService` singleton state does not leak between test suites.

## [0.5.0] - 2026-03-08

### Added

- **Embedded HarnessViewer:** Replaced the `srcdoc` iframe rendering model with an embedded harness that strips `<html>/<head>/<body>` wrappers and injects slide HTML fragments directly into a scoped div. Eliminates cross-origin iframe restrictions.
- **Viewport-lock manifest flag (B021):** Slides can declare `"viewportLock": true` in the manifest to opt in to fixed-viewport rendering for arcade-style slides.
- **`@scope` CSS isolation:** Injected slide styles are now wrapped in `@scope` to prevent FliDeck chrome styles from leaking into slide content.

### Fixed

- **BUG-15 — Keyboard navigation after iframe click:** Cmd+Arrow navigation was silently captured by iframe after a user clicked inside a tab landing page. Resolved as a side-effect of replacing the iframe model with `HarnessViewer`; keyboard events now always reach the FliDeck container. (Playwright-verified 2026-03-06.)

## [0.4.0] - 2026-01-07

### Added

- **FR-28 — Resizable sidebar with S/M/L presets:** Three preset-width buttons (S = 280 px, M = 380 px, L = 480 px) allow users to quickly resize the sidebar. The active preset is visually highlighted; the selected width is persisted to `localStorage` and restored on page load.

## [0.3.0] - 2025-12-30

### Fixed

- **BUG-13 — Sidebar not filtered by active container tab:** Selecting a container tab (e.g., EPIC1) now correctly filters the sidebar to show only the groups that belong to that tab. Previously all groups from all tabs were shown simultaneously.

## [0.2.0] - 2025-12-28

### Fixed

- **BUG-12 — Unhelpful slide names in sidebar:** Slide titles are now extracted from each file's HTML `<title>` tag. Previously the sidebar showed repeated generic basenames (e.g., "Scorecard", "Scorecard", "Scorecard") with no way to distinguish slides.

## [0.1.0] - 2025-12-26

### Added

- **FR-19 — Manifest Schema & Data API:** Formalised the `index.json` manifest schema and exposed it via `GET /api/schema/manifest`. Agents can now query the schema programmatically instead of relying on embedded documentation. Also adds `GET /PUT /PATCH /api/presentations/:id/manifest` endpoints for reading and replacing the full manifest.
- **FR-20 — UI Rendering Modes:** Implemented flat, grouped, and tabbed rendering modes in the sidebar. Grouped mode renders section headers for mid-size presentations (~20 slides); tabbed mode supports 100+ slide presentations with major category separation.
- **FR-21 — Agent Manifest Tooling:** Added bulk-add endpoints (`POST /api/presentations/:id/manifest/slides/bulk`, `POST /api/presentations/:id/manifest/groups/bulk`), manifest templates (`GET /api/templates/manifest`), sync (`PUT /api/presentations/:id/manifest/sync`), and validation (`POST /api/presentations/:id/manifest/validate`) to give AI agents robust manifest management without manual JSON editing.
- **FR-22 — Tab Management:** Full CRUD API and UI for tabs (`POST /PUT /DELETE /PUT-order /api/presentations/:id/tabs`), plus group-tab relationship endpoints (`PUT/DELETE /api/presentations/:id/groups/:groupId/parent`). Completes the structural management layer started by FR-17.
- **FR-24 — Container Tab Navigation:** Moved the tab bar from inside iframe content to the FliDeck container level. Each tab loads a separate index HTML file (e.g., `index-mary.html`); the tab bar persists in presentation mode, enabling navigation between major sections without the sidebar.
- **FR-25 — Smart Display Mode with Container Tabs:** Sidebar now filters by the active container tab when tabs are present. Display mode (flat/grouped) applies only to the filtered content of the active tab, removing the confusing "Tabbed" mode label.
- **FR-26 — Index HTML Sync (Self-Healing Manifest):** New endpoint `PUT /api/presentations/:id/manifest/sync-from-index` parses agent-generated index HTML files to automatically populate slide-to-tab mappings in the manifest, removing the need for agents to call multiple setup APIs.
- **FR-27 — Agent Capability Discovery API:** `GET /api/capabilities` returns a self-describing, human-readable list of FliDeck's capabilities, concepts, and workflows so AI agents can discover available features dynamically without embedded documentation.

## [0.0.1] - 2025-12-22

### Added

- **FR-16 — Agent Slide Management API:** REST endpoints for agents to create, update, and delete slides via FliDeck's API (`POST /api/presentations`, `POST/PUT/DELETE /api/presentations/:id/slides`). Makes FliDeck the single source of truth for manifest schema so agents do not need to know schema internals.
- **FR-17 — Group Management:** API and sidebar UI for creating, renaming, reordering, and deleting groups without manually editing JSON (`POST/PUT/DELETE/PUT-order /api/presentations/:id/groups`).
