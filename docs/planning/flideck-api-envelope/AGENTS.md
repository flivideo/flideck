# AGENTS.md — FliDeck API Envelope

_(Inherited from flideck-test-quality-fixes. Updated for this campaign.)_

## Project Overview

**Project**: FliDeck — local-first presentation harness
**Campaign**: flideck-api-envelope — adopt `createApiResponse<T>()` across all route handlers (B014)
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest

**Current state (2026-03-19, entering this campaign):**
- 0 TypeScript errors, 0 npm vulnerabilities
- 100 tests passing (35 client, 65 server) — baseline must not regress
- `createApiResponse<T>()` and `createErrorResponse()` exist in `server/src/utils/responseHelper.ts` but are not used by any route handler
- Route handlers manually construct `{ success: true, data: X }` or return raw objects

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm test           # must pass: 35 client + 65 server = 100 total
npm run typecheck  # must pass: 0 errors
npm run build      # must succeed
```

---

## Directory Structure

```
server/src/
├── utils/
│   └── responseHelper.ts      ← import createApiResponse + createErrorResponse from here
├── routes/
│   ├── presentations.ts       ← Agent A (28 handlers)
│   ├── assets.ts              ← Agent B
│   ├── config.ts              ← Agent B
│   ├── query.ts               ← Agent B
│   ├── schema.ts              ← Agent B
│   ├── templates.ts           ← Agent B
│   └── capabilities.ts        ← Agent B
```

---

## The Two Helpers

```typescript
// Import line (add to top of each route file):
import { createApiResponse, createErrorResponse } from '../utils/responseHelper.js';

// Success with data:
res.json(createApiResponse(data));
// → { success: true, data }

// Success with data + context:
res.json(createApiResponse(data, { presentationsRoot: collapsePath(config.presentationsRoot) }));
// → { success: true, data, _context: { presentationsRoot: '...' } }

// Success with no data (mutation endpoints that currently return { success: true }):
res.json(createApiResponse(null));
// → { success: true, data: null }

// Error:
res.status(500).json(createErrorResponse('something failed'));
// → { success: false, error: 'something failed' }
```

---

## Response Pattern Inventory & What to Change

### presentations.ts — Agent A

Read the FULL file before editing. These are all the patterns to replace:

| Current pattern | Replace with |
|----------------|--------------|
| `res.json({ _context: { presentationsRoot: collapsePath(...) }, success: true, data: X })` | `res.json(createApiResponse(X, { presentationsRoot: collapsePath(config.presentationsRoot) }))` |
| `res.json({ success: true })` (mutation-only, no data) | `res.json(createApiResponse(null))` |
| `res.status(201).json({ success: true })` | `res.status(201).json(createApiResponse(null))` |
| `res.status(201).json({ success: true, path: folderPath })` | `res.status(201).json(createApiResponse({ path: folderPath }))` |
| `res.status(201).json({ success: true, added, skipped, updated, skippedItems })` | `res.status(201).json(createApiResponse({ added, skipped, updated, skippedItems }))` |
| `res.json({ success: true, dryRun: true, message, slides })` | `res.json(createApiResponse({ dryRun: true, message, slides }))` |
| `res.json({ success: true, dryRun: true, message, groups })` | `res.json(createApiResponse({ dryRun: true, message, groups }))` |
| `res.json({ _context: { presentationsRoot }, ...manifest })` (manifest spread) | `res.json(createApiResponse(manifest ?? null, { presentationsRoot: collapsePath(config.presentationsRoot) }))` |
| `res.json({ valid: false, errors, warnings: [] })` | `res.json(createApiResponse({ valid: false, errors, warnings: [] }))` |
| `res.json(result)` (validate endpoint) | `res.json(createApiResponse(result))` |
| `res.status(500).json({ success: false, error: string })` | `res.status(500).json(createErrorResponse(errorMessage))` |

**Specific tricky cases in presentations.ts:**

1. **GET /:id/manifest (lines ~660-673)** — currently spreads manifest into response:
   ```typescript
   // Current:
   res.json({ _context: { presentationsRoot: collapsePath(config.presentationsRoot) }, ...manifest });
   // Fixed:
   res.json(createApiResponse(manifest, { presentationsRoot: collapsePath(config.presentationsRoot) }));
   ```
   When no manifest exists, it currently returns `{ _context: {...} }` — fix to:
   ```typescript
   res.json(createApiResponse(null, { presentationsRoot: collapsePath(config.presentationsRoot) }));
   ```

2. **GET / and GET /:id** — already have `_context`; pass it as second arg to createApiResponse.

3. **Success-only mutations** — 7+ handlers returning `res.json({ success: true })` → `res.json(createApiResponse(null))`.

---

### assets.ts — Agent B

Currently: `res.json({ success: true, data: { content, asset } })`
Fix: `res.json(createApiResponse({ content, asset }))`

---

### config.ts — Agent B

Currently:
- `res.json({ success: true, data: { presentationsRoot, history } })`
- `res.json({ success: true, data: { presentationsRoot } })`

Fix: use createApiResponse for both.

---

### query.ts — Agent B

Currently returns raw objects with NO envelope. Three handlers:
- `res.json({ routes, currentRoute })` → `res.json(createApiResponse({ routes, currentRoute }))`
- `res.json({ name, path, presentations })` → `res.json(createApiResponse({ name, path, presentations }))`
- `res.json({ id, name, route, assets, totalAssets })` → `res.json(createApiResponse({ id, name, route, assets, totalAssets }))`

---

### schema.ts — Agent B

Currently: `res.json(schema)` → `res.json(createApiResponse(schema))`

---

### templates.ts — Agent B

Currently: `res.json(templates)` and `res.json(template)` → wrap each in createApiResponse.

---

### capabilities.ts — Agent B

Currently: `res.json(CAPABILITIES)` → `res.json(createApiResponse(CAPABILITIES))`

---

## Success Criteria

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test` — 100 tests pass (35 client + 65 server)
- [ ] `npm run build` — succeeds
- [ ] Every `res.json({` in route files either uses `createApiResponse(...)` or `createErrorResponse(...)` — no more inline envelope construction
- [ ] Import line added to each modified route file

---

## Anti-Patterns to Avoid

- **Do NOT use `any` types** — `createApiResponse<T>` is generic; TypeScript will infer T from the data arg
- **Do NOT change the `_context` behaviour** — it moves from being spread manually to the second arg of createApiResponse; the output shape is identical
- **Do NOT modify test files** — this campaign is route files only
- **Do NOT modify client/ files** — all changes are server-side
- **Do NOT amend commits** — create new commits
- **Do NOT skip the import** — the import must use `.js` extension: `'../utils/responseHelper.js'`
- **Read each route file fully before editing** — patterns vary; do not guess

---

## Quality Gates

1. `npm run typecheck` — 0 errors
2. `npm test` — ≥ 100 tests passing
3. `npm run build` — succeeds
4. No inline `{ success: true, data:` construction left in any route file (verify with grep after)

---

## Learnings

_(Inherited from all prior campaigns)_

### Architecture
- `asyncHandler` AND `AppError` are co-located in `server/src/middleware/errorHandler.ts`
- ManifestService is injected into PresentationService — access via `PresentationService.getInstance()` + `setRoot()`
- `server/src/index.ts` does NOT export `createApp` — test service/util functions directly

### Tests
- 100 total: 35 client, 65 server
- No existing tests assert on HTTP response body shape — safe to change envelope construction
- All server tests are service/utility level; they don't call route handlers

### Route Import Convention
```typescript
import { createApiResponse, createErrorResponse } from '../utils/responseHelper.js';
```
Note: `.js` extension required in ESM TypeScript (even though file is `.ts`).
