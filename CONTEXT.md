---
generated: 2026-04-03
generator: system-context
status: snapshot
sources:
  - CLAUDE.md
  - package.json
  - shared/src/types.ts
  - shared/schema/manifest.schema.json
  - client/src/harness/HarnessViewer.tsx
  - server/src/services/PresentationService.ts
  - docs/prd/
regenerate: "Run /system-context in the repo root"
---

# FliDeck — System Context

## Purpose
Local-first viewer for navigating folders of generated HTML slides (produced by Claude Code agents) without juggling browser tabs or manual file management.

## Domain Concepts
- **Presentation** — A folder on disk containing HTML files. The folder name is the ID. Must contain at least one entry point (`presentation.html`, `index.html`, or tabbed variants).
- **Harness Fragment** — The rendering format: an HTML file with `<html>/<head>/<body>` stripped, leaving only `<style>` blocks and body content, injected into a scoped div with a canonical font stack and CSS tokens. Not iframes.
- **Manifest** (`index.json`) — Optional JSON file controlling slide ordering, grouping, tabs, and metadata. Self-healing: missing files skipped, new files appended, corrupted manifests fall back to default ordering.
- **Group / Tab** — Organizational structures within a presentation. Groups are named containers for slides; tabs are top-level navigation for multi-section decks.

## Design Decisions
- **Harness fragments, not iframes**: Slides inject directly into scoped divs for consistent font stacks and CSS tokens. Tradeoff: slide HTML must be well-behaved (no global style leaks).
- **Agent-friendly API**: The REST API is designed for Claude Code agents to create presentations, add slides, manage manifests, and bulk-sync. `/api/capabilities` enables agent capability discovery.
- **Write locks on filesystem operations**: PresentationService and ManifestService serialize writes to prevent concurrent corruption.
- **Config hot-reload**: Changing `config.json` (especially `presentationsRoot`) triggers a Socket.io event and the UI updates without restart.

## Scope Limits
- Does NOT create or edit slide content — views and organizes pre-existing HTML files. Slide generation is done by external Claude Code agents.
- Does NOT provide visual slide templates — the `templates` API provides manifest structure templates only.
- Does NOT have authentication — single-user, localhost only.
- Does NOT sync to cloud — presentations must exist on the local filesystem.
