# FR-19: Manifest Schema & Data API

## Summary

Formalize the `index.json` manifest schema and expose it via API endpoints. This creates a self-documenting data layer that both FliDeck UI and external agents (Claude, SoloDeck) can consume without needing separate documentation.

## Problem Statement

**Current state (after FR-14/15/16/17):**
- `index.json` is the canonical manifest filename (FR-14)
- Rich schema with groups, slides, metadata exists (FR-15)
- Slide CRUD API exists (FR-16)
- Group CRUD API exists (FR-17)

**What's missing:**
- Schema is implicitly defined in TypeScript types (`shared/src/types.ts`) - not queryable
- No way for agents to discover the schema programmatically
- No direct "get/set entire manifest" endpoints (only granular slide/group endpoints)
- No formal validation layer - malformed manifests fail unpredictably
- Documentation and code can drift apart

**Impact:**
- Claude agents need embedded documentation to understand manifest structure
- Agents must make multiple API calls instead of one manifest read/write
- FR-20 (UI modes) and FR-21 (agent tooling) need a formalized data foundation

## Proposed Solution

### 1. Formal JSON Schema Definition

Create a JSON Schema document that defines the manifest structure:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "FliDeck Presentation Manifest",
  "type": "object",
  "properties": {
    "meta": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "purpose": { "type": "string" },
        "created": { "type": "string", "format": "date" },
        "updated": { "type": "string", "format": "date" }
      }
    },
    "stats": {
      "type": "object",
      "properties": {
        "total_slides": { "type": "integer" },
        "groups": { "type": "integer" }
      }
    },
    "groups": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "order": { "type": "integer" },
          "tab": { "type": "boolean", "description": "If true, this group appears as a tab in tabbed mode" }
        },
        "required": ["label", "order"]
      }
    },
    "slides": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "title": { "type": "string" },
          "group": { "type": "string" },
          "recommended": { "type": "boolean" },
          "tags": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["file"]
      }
    }
  }
}
```

### 2. New API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schema/manifest` | Returns JSON Schema definition |
| GET | `/api/presentations/:id/manifest` | Returns raw manifest JSON |
| PUT | `/api/presentations/:id/manifest` | Full manifest replacement (validates against schema) |
| PATCH | `/api/presentations/:id/manifest` | Partial update (merge semantics) |

### 3. Validation Layer

- All manifest writes validate against JSON Schema before persisting
- Invalid manifests return 400 with detailed validation errors
- Self-healing on read: missing files in manifest are filtered, new files appended

### 4. Schema Versioning

```json
{
  "$schema": "https://flideck.local/schema/manifest/v1",
  "meta": { ... }
}
```

Future schema changes increment version. Reader handles migrations.

## Acceptance Criteria

- [ ] JSON Schema file created at `shared/schema/manifest.schema.json`
- [ ] `GET /api/schema/manifest` returns the schema
- [ ] `GET /api/presentations/:id/manifest` returns raw manifest
- [ ] `PUT /api/presentations/:id/manifest` replaces manifest with validation
- [ ] `PATCH /api/presentations/:id/manifest` merges partial updates
- [ ] Validation errors return structured error response
- [ ] TypeScript types generated from or synced with JSON Schema
- [ ] Existing endpoints (reorder, slides, groups) internally use manifest API

## Technical Notes

- Consider using `ajv` for JSON Schema validation
- PATCH semantics: deep merge for objects, replace for arrays (or use JSON Patch RFC 6902)
- Schema endpoint could include examples for each field
- Cache schema in memory (it's static)

## Builds On

- **FR-14** (Rename to index.json) - Filename convention settled
- **FR-15** (Rich manifest schema) - Schema structure defined in TypeScript
- **FR-16** (Agent slide API) - Granular slide CRUD exists
- **FR-17** (Group management) - Granular group CRUD exists

This FR formalizes and extends that foundation with schema self-documentation and direct manifest access.

## Dependents

- **FR-20** (UI Rendering Modes) - consumes manifest API
- **FR-21** (Agent Manifest Tooling) - consumes schema + manifest API

## Priority

**High** - Foundation for FR-20 and FR-21

---

**Added**: 2025-12-24
**Status**: Complete

## Completion Notes

**What was done:**
- Created formal JSON Schema at `shared/schema/manifest.schema.json` with full validation rules
- Installed and configured `ajv` and `ajv-formats` for JSON Schema validation
- Created `manifestValidator.ts` utility with `validate()`, `validateOrThrow()`, and `getSchema()` functions
- Added `getManifest()`, `setManifest()`, and `patchManifest()` methods to PresentationService
- Implemented deep merge helper for PATCH semantics (objects merged, arrays replaced)
- Created `GET /api/schema/manifest` endpoint to expose JSON Schema
- Created `GET /api/presentations/:id/manifest` endpoint to retrieve raw manifest
- Created `PUT /api/presentations/:id/manifest` endpoint with full validation
- Created `PATCH /api/presentations/:id/manifest` endpoint with merge validation
- All manifest write operations validate against schema before persisting
- Validation errors return structured 400 responses with detailed field-level errors
- Updated CLAUDE.md API documentation table

**Files created:**
- `/Users/davidcruwys/dev/ad/flivideo/flideck/shared/schema/manifest.schema.json` - JSON Schema definition
- `/Users/davidcruwys/dev/ad/flivideo/flideck/server/src/utils/manifestValidator.ts` - Validation utility
- `/Users/davidcruwys/dev/ad/flivideo/flideck/server/src/routes/schema.ts` - Schema routes

**Files modified:**
- `/Users/davidcruwys/dev/ad/flivideo/flideck/server/src/services/PresentationService.ts` - Added manifest CRUD methods
- `/Users/davidcruwys/dev/ad/flivideo/flideck/server/src/routes/presentations.ts` - Added manifest endpoints
- `/Users/davidcruwys/dev/ad/flivideo/flideck/server/src/routes/index.ts` - Registered schema routes
- `/Users/davidcruwys/dev/ad/flivideo/flideck/CLAUDE.md` - Updated API documentation
- `/Users/davidcruwys/dev/ad/flivideo/flideck/package.json` - Added ajv dependencies

**Testing notes:**
- `GET /api/schema/manifest` - Returns full JSON Schema with examples
- `GET /api/presentations/:id/manifest` - Returns raw manifest or {} if none exists
- `PUT /api/presentations/:id/manifest` - Validates and replaces entire manifest
- `PATCH /api/presentations/:id/manifest` - Validates merged result before applying partial updates
- Invalid manifests return 400 with structured error messages
- All operations emit Socket.io events to notify clients

**Schema features:**
- Full property definitions with types, descriptions, and constraints
- Pattern validation for filenames (must be .html without path separators)
- Legacy `assets.order` format documented for backwards compatibility
- Example manifest included in schema
- Schema versioned with `$id: "https://flideck.local/schema/manifest/v1"`

**TL;DR:** Formal JSON Schema created and exposed via API. Manifest GET/PUT/PATCH endpoints implemented with validation. Foundation ready for FR-20 and FR-21.
