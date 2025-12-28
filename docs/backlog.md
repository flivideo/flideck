# Backlog

Requirements index for FliDeck.

## Requirements

| # | Requirement | Added | Status |
|---|-------------|-------|--------|
| 1 | [FR-1: Initial v0.1.0 Implementation](prd/fr-01-initial-setup.md) | 2025-12-18 | Implemented |
| 2 | [FR-2: JSON-Based Configuration](prd/fr-02-json-config.md) | 2025-12-18 | Implemented |
| 3 | [FR-3: Configuration UI](prd/fr-03-config-ui.md) | 2025-12-18 | Implemented |
| 4 | [FR-4: AppyDave Branding](prd/fr-04-branding.md) | 2025-12-18 | Implemented |
| 5 | [FR-5: Presentation Controls](prd/fr-05-controls.md) | 2025-12-18 | Implemented |
| 6 | [FR-6: Simplify Config UI](prd/fr-06-config-simplify.md) | 2025-12-19 | Implemented |
| 7 | [FR-7: Custom Asset Ordering](prd/fr-07-asset-ordering.md) | 2025-12-19 | Implemented |
| 8 | [FR-8: Sidebar Layout & Presentation Switcher](prd/fr-08-sidebar-layout.md) | 2025-12-19 | Implemented |
| 9 | [FR-9: Quick Filter (Cmd+K)](prd/fr-09-quick-filter.md) | 2025-12-21 | Implemented |
| 10 | [FR-10: Query API for External Systems](prd/fr-10-query-api.md) | 2025-12-21 | Implemented |
| 11 | [FR-11: FliDeck Claude Skill](prd/fr-11-claude-skill.md) | 2025-12-21 | Implemented |
| 12 | [FR-12: Copy Path to Clipboard](prd/fr-12-copy-path-clipboard.md) | 2025-12-21 | Implemented |
| 13 | [FR-13: Default Creation-Time Ordering](prd/fr-13-creation-time-ordering.md) | 2025-12-22 | Implemented |
| 14 | [FR-14: Rename Manifest to index.json](prd/fr-14-rename-manifest.md) | 2025-12-22 | Implemented |
| 15 | [FR-15: Rich Manifest Schema with Groups](prd/fr-15-rich-manifest-schema.md) | 2025-12-22 | Implemented |
| 16 | [FR-16: Agent Slide Management API](prd/fr-16-agent-slide-api.md) | 2025-12-22 | Implemented |
| 17 | [FR-17: Group Management](prd/fr-17-group-management.md) | 2025-12-22 | Implemented |
| 18 | [FR-18: Custom Index Page Integration](prd/fr-18-custom-index-integration.md) | 2025-12-23 | Archived (superseded by FR-20) |
| 19 | [FR-19: Manifest Schema & Data API](prd/fr-19-manifest-schema-api.md) | 2025-12-24 | Implemented |
| 20 | [FR-20: UI Rendering Modes](prd/fr-20-ui-rendering-modes.md) | 2025-12-24 | Implemented |
| 21 | [FR-21: Agent Manifest Tooling](prd/fr-21-agent-manifest-tooling.md) | 2025-12-24 | Implemented |
| 22 | [FR-22: Tab Management](prd/fr-22-tab-management.md) | 2025-12-24 | Implemented |
| 23 | [FR-23: Group Reorder UI](prd/fr-23-group-reorder-ui.md) | 2025-12-24 | Pending (rewritten 2025-12-24) |
| 24 | [FR-24: Container Tab Navigation](prd/fr-24-container-tab-navigation.md) | 2025-12-24 | Implemented |
| 25 | [FR-25: Smart Display Mode with Container Tabs](prd/fr-25-smart-display-mode.md) | 2025-12-24 | Implemented |
| 26 | [FR-26: Index HTML Sync (Self-Healing)](prd/fr-26-index-html-sync.md) | 2025-12-26 | Implemented |
| 27 | [FR-27: Agent Capability Discovery](prd/fr-27-agent-capability-discovery.md) | 2025-12-26 | Implemented |

## Non-Functional Requirements

| # | Requirement | Added | Status |
|---|-------------|-------|--------|
| 1 | [NFR-1: Real-Time File Watching](prd/nfr-01-real-time-file-watching.md) | 2025-12-21 | Implemented |

## Bugs

| # | Bug | Added | Status | Priority |
|---|-----|-------|--------|----------|
| 1 | [BUG-1: Group Creation Fails in Grouped Mode](prd/bug-01-group-creation-fails.md) | 2025-12-24 | Fixed | - |
| 2 | [BUG-2: Navigation Breaks After Container Tab Click](prd/bug-02-navigation-after-tab-click.md) | 2025-12-24 | Fixed | - |
| 3 | [BUG-3: Groups Display in Different Order](prd/bug-03-groups-out-of-order.md) | 2025-12-24 | Open | Medium |
| 4 | [BUG-4: Display Mode Doesn't Persist on Refresh](prd/bug-04-display-mode-no-persist.md) | 2025-12-24 | Fixed | - |
| 5 | [BUG-5: Tabbed Display Mode Shows Empty Sidebar](prd/bug-05-tabbed-mode-empty-sidebar.md) | 2025-12-24 | Fixed | - |
| 6 | [BUG-6: Groups Don't Auto-Expand During Navigation](prd/bug-06-groups-no-auto-expand.md) | 2025-12-24 | Fixed | - |
| 7 | [BUG-7: Performance Degradation / Slow Loading](prd/bug-07-performance-slow-loading.md) | 2025-12-24 | Fixed | - |
| 8 | [BUG-8: Container Tab System Completely Broken](prd/bug-08-tab-system-broken.md) | 2025-12-24 | Fixed (data issue) | - |
| 9 | [BUG-9: Tabbed Display Mode Still Selectable](prd/bug-09-tabbed-mode-still-selectable.md) | 2025-12-26 | Fixed | - |
| 10 | [BUG-10: Stale Tabbed Mode in localStorage](prd/bug-10-stale-tabbed-mode-in-localstorage.md) | 2025-12-26 | Fixed | - |
| 11 | [BUG-11: Presentation Discovery Rules Outdated](prd/bug-11-presentation-discovery-rules.md) | 2025-12-26 | Fixed | - |
| 12 | [BUG-12: Unhelpful Slide Names in Sidebar](prd/bug-12-unhelpful-slide-names.md) | 2025-12-28 | Fixed | - |
| 13 | [BUG-13: Tab Filtering Not Working in Sidebar](prd/bug-13-tab-filtering-not-working.md) | 2025-12-28 | With Developer | High |
| 14 | [BUG-14: Agent API Missing Slide Authoring Specs](prd/bug-14-agent-api-missing-authoring-specs.md) | 2025-12-28 | Open | High |
| 15 | [BUG-15: Keyboard Navigation Breaks After Iframe Click](prd/bug-15-keyboard-breaks-after-iframe-click.md) | 2025-12-28 | Open | **Critical** |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `Draft` | Rough idea, needs refinement |
| `Pending` | Ready for development |
| `With Developer` | Currently being implemented |
| `Implemented` | Complete |
| `Needs Rework` | Issues found |

## Numbering

- **FR-X** - Functional Requirements (user-facing features)
- **NFR-X** - Non-Functional Requirements (technical improvements)

## Adding Requirements

1. Create new file: `docs/prd/fr-XX-short-name.md`
2. Add row to table above
3. Update status as work progresses
