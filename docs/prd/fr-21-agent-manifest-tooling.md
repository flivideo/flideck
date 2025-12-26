# FR-21: Agent Manifest Tooling

## Summary

Provide robust tooling for AI agents (Claude, SoloDeck) to create, update, and maintain presentation manifests. This completes the producer side of the manifest ecosystem.

## Problem Statement

**Current state:**
- Agents can create slides but manifest management is manual or ad-hoc
- No bulk operations for adding multiple slides to groups
- No templates for common presentation structures
- No merge/conflict resolution when agent adds to existing presentation
- Agent must know manifest schema from documentation (not queryable)

**Impact:**
- SoloDeck workflow is fragile - manifest easily gets out of sync
- Agents duplicate manifest structure knowledge
- No standardization across agent-generated presentations

## Proposed Solution

### 1. Schema Discovery (via FR-19)

Agents query schema before generating:

```bash
curl /api/schema/manifest
# Returns JSON Schema with descriptions, examples, constraints
```

### 2. Bulk Operations API

New endpoints optimized for agent workflows:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/presentations/:id/manifest/slides/bulk` | Add multiple slides |
| POST | `/api/presentations/:id/manifest/groups/bulk` | Add multiple groups |
| PUT | `/api/presentations/:id/manifest/sync` | Sync manifest with filesystem |

**Bulk add slides:**
```json
POST /api/presentations/my-deck/manifest/slides/bulk
{
  "slides": [
    { "file": "intro.html", "title": "Introduction", "group": "overview" },
    { "file": "api-ref.html", "title": "API Reference", "group": "api" },
    { "file": "examples.html", "title": "Examples", "group": "api" }
  ],
  "createGroups": true,  // Auto-create groups if missing
  "position": "end"      // "start" | "end" | "after:slideId"
}
```

**Sync manifest with filesystem:**
```json
PUT /api/presentations/my-deck/manifest/sync
{
  "strategy": "merge",  // "merge" | "replace" | "addOnly"
  "inferGroups": true,  // Group by filename prefix (e.g., api-*.html → api group)
  "inferTitles": true   // Extract title from HTML <title> tag
}
```

### 3. Manifest Templates

Pre-defined structures for common presentation types:

```json
GET /api/templates/manifest
[
  {
    "id": "simple",
    "name": "Simple Presentation",
    "description": "Flat list, no grouping",
    "structure": { "groups": {}, "slides": [] }
  },
  {
    "id": "tutorial",
    "name": "Tutorial Series",
    "description": "Grouped by chapter",
    "structure": {
      "groups": {
        "intro": { "label": "Introduction", "order": 1 },
        "basics": { "label": "Basics", "order": 2 },
        "advanced": { "label": "Advanced", "order": 3 },
        "summary": { "label": "Summary", "order": 4 }
      }
    }
  },
  {
    "id": "persona-tabs",
    "name": "Persona-Based Tabs",
    "description": "Tabbed by persona/audience",
    "structure": {
      "meta": { "displayMode": "tabbed" },
      "groups": {
        "developer": { "label": "Developer", "order": 1, "tab": true },
        "designer": { "label": "Designer", "order": 2, "tab": true },
        "manager": { "label": "Manager", "order": 3, "tab": true }
      }
    }
  }
]
```

**Apply template:**
```json
POST /api/presentations/:id/manifest/template
{
  "templateId": "tutorial",
  "merge": true  // Merge with existing or replace
}
```

### 4. Conflict Resolution

When agent adds slides to existing presentation:

```json
POST /api/presentations/my-deck/manifest/slides/bulk
{
  "slides": [...],
  "onConflict": {
    "duplicateFile": "skip",     // "skip" | "replace" | "rename"
    "groupMismatch": "update"    // "keep" | "update" | "ask"
  }
}
```

### 5. Validation & Dry Run

```json
POST /api/presentations/:id/manifest/validate
{
  "manifest": { ... },
  "checkFiles": true  // Verify all referenced files exist
}

// Response
{
  "valid": false,
  "errors": [
    { "path": "slides[2].file", "message": "File not found: missing.html" }
  ],
  "warnings": [
    { "path": "slides[5]", "message": "File exists but not in manifest: orphan.html" }
  ]
}
```

**Dry run for bulk operations:**
```json
POST /api/presentations/:id/manifest/slides/bulk?dryRun=true
{
  "slides": [...]
}
// Returns what would happen without persisting
```

## Acceptance Criteria

### Schema Discovery
- [ ] `/api/schema/manifest` returns full JSON Schema (FR-19)
- [ ] Schema includes descriptions and examples for each field

### Bulk Operations
- [ ] `POST .../slides/bulk` adds multiple slides in one request
- [ ] `POST .../groups/bulk` adds multiple groups in one request
- [ ] `PUT .../sync` synchronizes manifest with filesystem
- [ ] Position control: start, end, after specific slide

### Templates
- [ ] `GET /api/templates/manifest` lists available templates
- [ ] `POST .../template` applies template to presentation
- [ ] At least 3 built-in templates (simple, tutorial, persona-tabs)

### Conflict Resolution
- [ ] Duplicate file handling: skip, replace, rename
- [ ] Group mismatch handling: keep, update

### Validation
- [ ] `POST .../validate` validates manifest against schema
- [ ] File existence checking option
- [ ] Orphan file detection (files not in manifest)
- [ ] Dry run mode for bulk operations

## Technical Notes

- Bulk operations should be transactional (all or nothing)
- Consider rate limiting for large bulk operations
- Template storage: could be JSON files in `server/templates/` or DB
- Sync operation needs to handle HTML title extraction carefully (DOM parsing)

## Dependencies

- **FR-19** (Manifest Schema & API) - Provides schema and base manifest endpoints

## Extends

- **FR-16** (Agent Slide API) - FR-16 provides single-slide CRUD; this FR adds bulk operations, templates, and validation that FR-16 explicitly excluded from scope

## Priority

**Medium** - Enables reliable agent workflows

---

**Added**: 2025-12-24
**Status**: Completed
**Completed**: 2025-12-24

## Implementation Notes

All features from this FR have been successfully implemented:

### TypeScript Types
- Added comprehensive types to `shared/src/types.ts`:
  - `BulkAddSlidesRequest`, `BulkAddGroupsRequest`
  - `SyncManifestRequest`, `ValidateManifestRequest`, `ApplyTemplateRequest`
  - `BulkOperationResult`, `ManifestTemplate`
  - Conflict resolution types: `DuplicateFileStrategy`, `GroupMismatchStrategy`, `ConflictOptions`

### Service Layer (`PresentationService.ts`)
- `bulkAddSlides()` - Bulk add slides with auto-create groups, position control, conflict resolution
- `bulkAddGroups()` - Bulk add groups
- `syncManifest()` - Sync manifest with filesystem (merge/replace/addOnly strategies)
- `validateManifest()` - Validate manifest with file existence checking
- `applyTemplate()` - Apply template to presentation

### Templates System (`manifestTemplates.ts`)
Created 5 built-in templates:
- **simple** - Flat list, no grouping
- **tutorial** - Grouped by chapter (intro/basics/advanced/summary)
- **persona-tabs** - Tabbed by persona (developer/designer/manager)
- **api-docs** - Structured for API reference
- **component-library** - Organized for UI component showcases

### API Endpoints

**Bulk Operations (presentations.ts):**
- `POST /api/presentations/:id/manifest/slides/bulk` - Bulk add slides
- `POST /api/presentations/:id/manifest/groups/bulk` - Bulk add groups
- `PUT /api/presentations/:id/manifest/sync` - Sync manifest with filesystem
- `POST /api/presentations/:id/manifest/validate` - Validate manifest
- `POST /api/presentations/:id/manifest/template` - Apply template

**Templates (templates.ts):**
- `GET /api/templates/manifest` - List all templates
- `GET /api/templates/manifest/:id` - Get specific template

### Features Implemented

**Conflict Resolution:**
- Duplicate file handling: skip (default), replace, rename
- Auto-rename generates unique filenames (e.g., `slide-1.html`, `slide-2.html`)

**Position Control:**
- Insert at start, end, or after specific slide
- Validated with error if "after" slide not found

**Auto-Create Groups:**
- `createGroups: true` option creates missing groups automatically
- Uses formatted group ID as label (e.g., "api" -> "Api")

**Sync Strategies:**
- **merge** - Preserve existing metadata, add new files
- **replace** - Start fresh with filesystem files
- **addOnly** - Only add missing files, don't modify existing

**Infer Metadata:**
- `inferGroups: true` - Group by filename prefix (e.g., `api-reference.html` -> `api` group)
- `inferTitles: true` - Extract from HTML `<title>` tags

**Validation:**
- JSON Schema validation via FR-19
- File existence checking with `checkFiles: true`
- Orphan file detection (files not in manifest)
- Group reference validation

**Dry Run:**
- Both bulk operations support `dryRun` query param or body field
- Returns what would happen without persisting changes

### Testing

Build successful with TypeScript compilation passing. All routes registered and endpoints ready for agent consumption.

### Documentation Updates

- Updated `CLAUDE.md` with all new endpoints
- All types exported from `@flideck/shared` for client/agent usage
