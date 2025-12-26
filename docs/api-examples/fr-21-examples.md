# FR-21: Agent Manifest Tooling - API Examples

This document provides curl examples for testing the FR-21 endpoints.

## Prerequisites

Server running on `http://localhost:5201`

## 1. List Available Templates

```bash
curl http://localhost:5201/api/templates/manifest | jq
```

Expected: Array of 5 templates (simple, tutorial, persona-tabs, api-docs, component-library)

## 2. Get Specific Template

```bash
curl http://localhost:5201/api/templates/manifest/tutorial | jq
```

## 3. Bulk Add Slides

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/slides/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [
      {
        "file": "intro.html",
        "title": "Introduction",
        "group": "overview"
      },
      {
        "file": "api-ref.html",
        "title": "API Reference",
        "group": "api"
      },
      {
        "file": "examples.html",
        "title": "Examples",
        "group": "api"
      }
    ],
    "createGroups": true,
    "position": "end"
  }' | jq
```

**With conflict resolution:**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/slides/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [
      {
        "file": "intro.html",
        "title": "New Intro"
      }
    ],
    "onConflict": {
      "duplicateFile": "replace"
    }
  }' | jq
```

**Dry run:**

```bash
curl -X POST "http://localhost:5201/api/presentations/my-deck/manifest/slides/bulk?dryRun=true" \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [
      {"file": "test.html"}
    ]
  }' | jq
```

## 4. Bulk Add Groups

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/groups/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "groups": [
      {
        "id": "getting-started",
        "label": "Getting Started",
        "order": 1
      },
      {
        "id": "advanced",
        "label": "Advanced Topics",
        "order": 2
      }
    ]
  }' | jq
```

## 5. Sync Manifest with Filesystem

**Merge strategy (default):**

```bash
curl -X PUT http://localhost:5201/api/presentations/my-deck/manifest/sync \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "merge",
    "inferGroups": true,
    "inferTitles": true
  }' | jq
```

**Replace strategy:**

```bash
curl -X PUT http://localhost:5201/api/presentations/my-deck/manifest/sync \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "replace",
    "inferGroups": false,
    "inferTitles": false
  }' | jq
```

## 6. Validate Manifest

**Schema validation only:**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/validate \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "meta": {
        "name": "Test Presentation"
      },
      "slides": [
        {
          "file": "intro.html",
          "title": "Introduction"
        }
      ]
    },
    "checkFiles": false
  }' | jq
```

**With file existence checking:**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/validate \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {
      "slides": [
        {
          "file": "intro.html"
        },
        {
          "file": "missing.html"
        }
      ]
    },
    "checkFiles": true
  }' | jq
```

Expected: Errors for missing files, warnings for orphan files

## 7. Apply Template

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/template \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "tutorial",
    "merge": true
  }' | jq
```

**Replace mode (don't merge):**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/template \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "api-docs",
    "merge": false
  }' | jq
```

## Position Control Examples

**Insert at start:**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/slides/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [{"file": "first.html"}],
    "position": "start"
  }' | jq
```

**Insert after specific slide:**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/slides/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [{"file": "middle.html"}],
    "position": {"after": "intro.html"}
  }' | jq
```

## Conflict Resolution Examples

**Skip duplicates (default):**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/slides/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [{"file": "existing.html"}],
    "onConflict": {
      "duplicateFile": "skip"
    }
  }' | jq
```

**Rename duplicates:**

```bash
curl -X POST http://localhost:5201/api/presentations/my-deck/manifest/slides/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [{"file": "existing.html"}],
    "onConflict": {
      "duplicateFile": "rename"
    }
  }' | jq
```

Expected: Creates `existing-1.html`, `existing-2.html`, etc.

## Expected Response Formats

### Bulk Add Slides Success

```json
{
  "success": true,
  "added": 3,
  "skipped": 0,
  "updated": 0,
  "skippedItems": []
}
```

### Bulk Add with Skips

```json
{
  "success": true,
  "added": 2,
  "skipped": 1,
  "updated": 0,
  "skippedItems": [
    {
      "item": "existing.html",
      "reason": "File already exists in manifest"
    }
  ]
}
```

### Validation Errors

```json
{
  "valid": false,
  "errors": [
    {
      "path": "slides[1].file",
      "message": "File not found: missing.html"
    }
  ],
  "warnings": [
    {
      "path": "slides",
      "message": "File exists but not in manifest: orphan.html"
    }
  ]
}
```

## Agent Workflow Example

Complete workflow for creating a new presentation with template:

```bash
# 1. Create presentation (FR-16)
curl -X POST http://localhost:5201/api/presentations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-api-docs",
    "name": "My API Documentation"
  }'

# 2. Apply template
curl -X POST http://localhost:5201/api/presentations/my-api-docs/manifest/template \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "api-docs",
    "merge": false
  }'

# 3. Bulk add slides (agent generates HTML files first)
curl -X POST http://localhost:5201/api/presentations/my-api-docs/manifest/slides/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "slides": [
      {"file": "index.html", "title": "Overview", "group": "overview"},
      {"file": "auth.html", "title": "Authentication", "group": "authentication"},
      {"file": "users.html", "title": "Users API", "group": "endpoints"},
      {"file": "posts.html", "title": "Posts API", "group": "endpoints"}
    ],
    "createGroups": false
  }'

# 4. Sync to catch any files agent created but forgot to add
curl -X PUT http://localhost:5201/api/presentations/my-api-docs/manifest/sync \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "addOnly",
    "inferGroups": true,
    "inferTitles": true
  }'

# 5. Validate final result
curl -X POST http://localhost:5201/api/presentations/my-api-docs/manifest/validate \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": {},
    "checkFiles": true
  }'
```
