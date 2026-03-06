# API Response Envelope Decision

## Current State

| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| GET /api/presentations | GET | `{ _context: { presentationsRoot }, success: true, data: [...] }` |
| GET /api/presentations/:id | GET | `{ _context: { presentationsRoot }, success: true, data: {...} }` |
| POST /api/presentations/refresh | POST | `{ success: true, data: [...] }` |
| PUT /api/presentations/:id/order | PUT | `{ success: true }` |
| POST /api/presentations | POST | `{ success: true, path: folderPath }` |
| POST /api/presentations/:id/slides | POST | `{ success: true }` |
| PUT /api/presentations/:id/slides/:slideId | PUT | `{ success: true }` |
| DELETE /api/presentations/:id/slides/:slideId | DELETE | `{ success: true }` |
| PUT /api/presentations/:id/groups/order | PUT | `{ success: true }` |
| POST /api/presentations/:id/groups | POST | `{ success: true }` |
| PUT /api/presentations/:id/groups/:groupId | PUT | `{ success: true }` |
| DELETE /api/presentations/:id/groups/:groupId | DELETE | `{ success: true }` |
| POST /api/presentations/:id/tabs | POST | `{ success: true }` |
| PUT /api/presentations/:id/tabs/:tabId | PUT | `{ success: true }` |
| DELETE /api/presentations/:id/tabs/:tabId | DELETE | `{ success: true }` |
| PUT /api/presentations/:id/tabs/order | PUT | `{ success: true }` |
| PUT /api/presentations/:id/groups/:groupId/parent | PUT | `{ success: true }` |
| DELETE /api/presentations/:id/groups/:groupId/parent | DELETE | `{ success: true }` |
| GET /api/presentations/:id/manifest | GET | `{ _context: { presentationsRoot }, ...manifest }` (spread) |
| PUT /api/presentations/:id/manifest | PUT | `{ success: true }` |
| PATCH /api/presentations/:id/manifest | PATCH | `{ success: true }` |
| POST /api/presentations/:id/manifest/slides/bulk (dry-run) | POST | `{ success: true, dryRun: true, message, slides: count }` |
| POST /api/presentations/:id/manifest/slides/bulk (live) | POST | `{ success: true, added, skipped, updated, skippedItems }` |
| POST /api/presentations/:id/manifest/groups/bulk (dry-run) | POST | `{ success: true, dryRun: true, message, groups: count }` |
| POST /api/presentations/:id/manifest/groups/bulk (live) | POST | `{ success: true, added, skipped, skippedItems }` |
| PUT /api/presentations/:id/manifest/sync | PUT | `{ success: true }` |
| POST /api/presentations/:id/manifest/validate (schema fail) | POST | `{ valid: false, errors: [...], warnings: [] }` |
| POST /api/presentations/:id/manifest/validate (pass) | POST | Raw result from service (shape unknown at route level) |
| POST /api/presentations/:id/manifest/template | POST | `{ success: true }` |
| PUT /api/presentations/:id/manifest/sync-from-index | PUT | Raw result from service (`res.json(result)`) |
| GET /api/assets/:presentationId/:assetId | GET | `{ success: true, data: { content, asset } }` |
| GET /api/capabilities | GET | Raw CAPABILITIES object (large static object, no envelope) |
| GET /api/schema/manifest | GET | Raw schema object (no envelope) |
| GET /api/templates/manifest | GET | Raw templates array (no envelope) |
| GET /api/templates/manifest/:id | GET | Raw template object (no envelope) |

## Inconsistencies Found

Five distinct response shapes are in use:

**Shape 1: Full envelope with `_context` and `data`**
`{ _context: { presentationsRoot }, success: true, data: T }`
Used by: GET /api/presentations, GET /api/presentations/:id

**Shape 2: Partial envelope with `success` and named fields (no `data` key)**
`{ success: true, path? | added? | skipped? | updated? | dryRun? | message? | ... }`
Used by: POST /api/presentations (adds `path`), bulk operations (add counts), dry-run responses

**Shape 3: Minimal success-only envelope**
`{ success: true }`
Used by: The majority of mutation endpoints (PUT order, POST slides, PUT slides, DELETE slides, all group/tab mutations, PUT/PATCH manifest, PUT sync, POST template)

**Shape 4: Manifest spread with `_context`**
`{ _context: { presentationsRoot }, ...manifest }`
Used by: GET /api/presentations/:id/manifest — the manifest fields are spread directly into the response rather than nested under `data`. This makes the response shape entirely dynamic and unpredictable.

**Shape 5: Raw object/array with no envelope**
`res.json(rawValue)` with no wrapping
Used by: GET /api/capabilities (large static object), GET /api/schema/manifest (JSON Schema), GET /api/templates/manifest (array), GET /api/templates/manifest/:id (object), PUT /api/presentations/:id/manifest/sync-from-index (service result), POST /api/presentations/:id/manifest/validate pass-through

## Recommendation

**Canonical shape: `{ success: true, data: T }` for data-bearing responses; `{ success: true }` for mutations with no meaningful return value**

Rationale:

1. The `data` wrapper already exists on the two highest-traffic read endpoints (GET presentations list and GET single presentation). Extending it to all responses is the path of least resistance.
2. `_context` should remain optional and additive — it is genuinely useful for agents that need to know `presentationsRoot`. It should NOT be removed, but it should be consistently present on all endpoints where the path context is relevant (currently only the GET presentation routes include it).
3. The manifest spread (Shape 4) is the most problematic pattern. Spreading manifest fields into the top-level response object means callers cannot distinguish envelope keys from manifest keys. It should be wrapped: `{ _context, success: true, data: manifest }`.
4. Raw object returns (Shape 5) for schema, templates, and capabilities are defensible for developer-tool / introspection endpoints that return self-describing documents. However the inconsistency adds cognitive overhead for agents that need to understand the API. These should also be wrapped.
5. Bulk operation responses that include counts (`added`, `skipped`, `updated`) should move those counts into `data`: `{ success: true, data: { added, skipped, updated, skippedItems } }`.

### Canonical shapes after migration

**Read endpoint with context:**
```json
{
  "_context": { "presentationsRoot": "~/path" },
  "success": true,
  "data": { ... }
}
```

**Read endpoint without context:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Mutation with no return payload:**
```json
{ "success": true }
```

**Mutation with result payload (bulk, create with path):**
```json
{
  "success": true,
  "data": { "added": 3, "skipped": 1, "updated": 0, "skippedItems": [...] }
}
```

**Error (already handled by errorHandler middleware, no change needed):**
```json
{ "success": false, "error": "...", "statusCode": 404 }
```

## Migration Notes

### Endpoints that need to change

| Endpoint | Change Required |
|----------|----------------|
| GET /api/presentations/:id/manifest | Wrap manifest under `data` instead of spreading; add `success: true` |
| POST /api/presentations | Move `path` under `data`: `{ success: true, data: { path } }` |
| POST /api/presentations/refresh | Already has `{ success: true, data: [...] }` — no change |
| POST /api/presentations/:id/manifest/slides/bulk | Move counts under `data` |
| POST /api/presentations/:id/manifest/groups/bulk | Move counts under `data` |
| POST /api/presentations/:id/manifest/validate | Wrap in `{ success: true, data: result }` or `{ success: false, ... }` |
| PUT /api/presentations/:id/manifest/sync-from-index | Wrap service result under `data` |
| GET /api/capabilities | Wrap under `{ success: true, data: CAPABILITIES }` |
| GET /api/schema/manifest | Wrap under `{ success: true, data: schema }` |
| GET /api/templates/manifest | Wrap under `{ success: true, data: [...] }` |
| GET /api/templates/manifest/:id | Wrap under `{ success: true, data: template }` |

### Client-side changes needed

The React client consumes responses via TanStack Query. The relevant selectors are in the query hooks (likely `client/src/hooks/` or `client/src/queries/`). Each hook that calls a currently-unwrapped endpoint needs its `select` function updated to read `.data` instead of the raw value.

Endpoints currently returning raw values that the client likely accesses directly:
- `/api/schema/manifest` — if consumed by client
- `/api/templates/manifest` and `/:id` — if consumed by client
- `/api/presentations/:id/manifest` — the manifest spread is the highest-risk change

The `_context` field on presentation endpoints is already present and consumed by agents, not by the React client's TanStack Query selectors. No client changes needed for `_context`.

### Estimated effort

- Backend route changes: ~2–3 hours (mechanical, ~12 `res.json()` call sites)
- Client TanStack Query selector updates: ~1–2 hours (depends on which raw endpoints the client actually consumes)
- Agent integration tests / curl examples in docs: ~1 hour
- Total: ~4–6 hours

## Decision

Adopt `{ success: true, data: T }` as the universal envelope for all data-bearing responses, with `_context` remaining optional and additive on presentation-scoped endpoints. Mutations that return no payload keep `{ success: true }`.

The manifest spread pattern (GET /api/presentations/:id/manifest) is the highest-priority fix because it makes the response shape structurally unpredictable. All other raw-object returns (schema, templates, capabilities) are lower risk but should be wrapped in the same wave to establish a uniform contract.

Do not change the error envelope — the existing errorHandler middleware already produces a consistent error shape and is not part of this inconsistency.

Implement in a dedicated cleanup wave (do not mix with feature work) so the diff stays reviewable and client-side selector updates can be done atomically.
