# AGENTS.md — FliDeck Route Integration Tests

_(Inherited from flideck-api-envelope. Updated for this campaign.)_

## Project Overview

**Project**: FliDeck — local-first presentation harness
**Campaign**: flideck-route-integration-tests — add supertest HTTP integration tests for all 7 route files + responseHelper unit tests (B041)
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest
**Worktree**: `/Users/davidcruwys/dev/ad/flivideo/flideck/.worktrees/flideck-route-integration-tests`

**Current state (2026-03-19, entering this campaign):**
- 0 TypeScript errors, 0 npm vulnerabilities
- 101 tests passing (35 client, 66 server) — baseline must not regress
- `createApiResponse<T>()` and `createErrorResponse()` are adopted across all 7 route files
- supertest + @types/supertest are installed as devDependencies — NO install needed
- No HTTP-level route tests exist yet — all 66 server tests are service/utility level

---

## Build & Run Commands

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck/.worktrees/flideck-route-integration-tests
npm test           # must pass: 35 client + 66 server = 101 total (plus your new tests)
npm run typecheck  # must pass: 0 errors
npm run build      # must succeed
```

---

## Directory Structure

```
server/src/
├── utils/
│   ├── responseHelper.ts              ← helper under test
│   └── __tests__/
│       └── responseHelper.test.ts     ← CREATE THIS (responsehelper-unit agent)
├── routes/
│   ├── capabilities.ts
│   ├── schema.ts
│   ├── templates.ts
│   ├── query.ts
│   ├── assets.ts
│   ├── config.ts
│   ├── presentations.ts
│   └── __tests__/                     ← CREATE THIS FOLDER + files
│       ├── capabilities.routes.test.ts
│       ├── schema.routes.test.ts
│       ├── templates.routes.test.ts
│       ├── query.routes.test.ts
│       ├── assets.routes.test.ts
│       ├── config.routes.test.ts
│       └── presentations.routes.test.ts
├── middleware/
│   └── errorHandler.ts                ← import errorHandler for test apps
└── services/
    └── PresentationService.ts         ← singleton, call setRoot() in tests
```

---

## The Test App Helper Pattern

Every route integration test follows the same pattern. Build a minimal express app, mount the router under `/`, attach the error handler, test with supertest.

```typescript
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createCapabilitiesRoutes } from '../capabilities.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', createCapabilitiesRoutes());
  app.use(errorHandler);
  return app;
}

describe('GET /api/capabilities', () => {
  it('returns 200 with envelope', async () => {
    const res = await request(buildApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.name).toBe('FliDeck Presentation Server');
  });
});
```

**Key points:**
- Mount route at `/` in the test app (the actual prefix `/api/capabilities` is added by the parent router in production — in tests, just mount at `/` and request `/`)
- Always attach `errorHandler` so AppError → 4xx responses work correctly
- Import with `.js` extension (ESM TypeScript requirement)

---

## io Mock Pattern

For routes that accept `io: Server`:

```typescript
import type { Server } from 'socket.io';

const mockIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
} as unknown as Server;
```

Pass as: `createSchemaRoutes({ io: mockIo })` or `createTemplateRoutes({ io: mockIo })`.

schema.ts actually uses `_config?: RouteConfig` and ignores `io` completely — you can pass `{}` or `{ io: mockIo }`, either works.

---

## PresentationService Pattern (for query, assets, config, presentations tests)

PresentationService is a singleton. Set a real tmpdir as the root so it has a valid (empty) presentations root:

```typescript
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { PresentationService } from '../../services/PresentationService.js';

let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = path.join(os.tmpdir(), `flideck-test-${Date.now()}`);
  await fs.ensureDir(tmpRoot);
  const service = PresentationService.getInstance();
  service.setRoot(tmpRoot);
});
```

For query/presentations tests that need an actual presentation to fetch, create a minimal one:

```typescript
// Create a minimal presentation in tmpRoot
const presentationDir = path.join(tmpRoot, 'test-deck');
await fs.ensureDir(presentationDir);
await fs.writeFile(path.join(presentationDir, 'index.html'), '<html><body>test</body></html>');
```

Then `GET /presentations/test-deck` will return a real presentation.

---

## What to Test Per Route File

### responseHelper.test.ts (unit — no express)
```typescript
import { createApiResponse, createErrorResponse } from '../responseHelper.js';

// ≥6 tests:
// 1. createApiResponse(data) → { success: true, data }
// 2. createApiResponse(null) → { success: true, data: null }
// 3. createApiResponse(data, context) → { success: true, data, _context: context }
// 4. createErrorResponse('msg') → { success: false, error: 'msg' }
// 5. createApiResponse([1,2,3]) → data is array
// 6. createApiResponse({}) → data is empty object
```

### capabilities.routes.test.ts (≥3 tests)
- `GET /` → 200, `success: true`, `data.name === 'FliDeck Presentation Server'`
- `data.api_summary` is an object
- `data.tips` is an array

### schema.routes.test.ts (≥2 tests)
- `GET /manifest` → 200, `success: true`, `data` is an object (the JSON Schema)
- `data.$schema` or `data.type` exists (it's a JSON Schema)

### templates.routes.test.ts (≥3 tests)
- `GET /manifest` → 200, `success: true`, `data` is an array
- `GET /manifest/basic` → 200, `success: true`, `data.id === 'basic'` (or first template id)
- `GET /manifest/nonexistent-template-xyz` → 404, `success: false`, `error` is a string

To find valid template IDs without hardcoding: call `getTemplates()` in the test or hit `GET /manifest` first and use the first result's id.

### query.routes.test.ts (≥4 tests — needs PresentationService setup)
- `GET /routes` → 200, `success: true`, `data.routes` is an array, `data.currentRoute` is a string
- `GET /routes/:route` with valid route name → 200, `success: true`, `data.presentations` is an array
- `GET /routes/nonexistent-route-xyz` → 404, `success: false`
- `GET /presentations/:id` with valid id → 200, `success: true`, `data.totalAssets` exists

### assets.routes.test.ts (≥2 tests — needs PresentationService setup)
- `GET /presentationId/nonexistent.html` → 404, `success: false`
- `GET /test-deck/index.html` (after creating the file) → 200, `success: true`, `data.content` is a string

### config.routes.test.ts (≥2 tests)
- `GET /` → 200, `success: true`, `data.presentationsRoot` is a string
- Response has no extra `success: true` at root other than via envelope

### presentations.routes.test.ts (≥8 tests — focus on read paths)
- `GET /` → 200, `success: true`, `data` is an array, `_context.presentationsRoot` is a string
- `GET /nonexistent-id-xyz` → 404, `success: false`
- `GET /test-deck` (after creating presentation) → 200, `success: true`, `data.id === 'test-deck'`, `_context.presentationsRoot` exists
- `GET /test-deck/manifest` → 200, `success: true`, `_context.presentationsRoot` exists
- `POST /refresh` → 200, `success: true`
- `POST /` with valid body → 201 or 400/409 (depending on whether folder exists)
- `GET /test-deck/slides` or similar → check envelope shape on mutation endpoints

---

## Success Criteria

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test` — ≥ 101 tests pass (baseline) + new route tests (target ≥ 35 new)
- [ ] `npm run build` — succeeds
- [ ] Every route test file: at minimum, the happy-path GET returns `{ success: true, data: ... }` with status 200
- [ ] Error paths return `{ success: false, error: string }` with correct 4xx status

---

## Anti-Patterns to Avoid

- **Do NOT test mutation endpoints exhaustively** — focus on envelope shape correctness; a few representative read paths per file is sufficient
- **Do NOT hardcode real file system paths** — use `os.tmpdir()` and create temp dirs in beforeAll
- **Do NOT use `any` types** — type the `res.body` access explicitly or use `expect(res.body).toMatchObject({ ... })`
- **Do NOT modify existing test files** — add new files only
- **Do NOT modify source files** — tests only
- **Do NOT use `beforeEach` for PresentationService.setRoot** — `beforeAll` is sufficient (root doesn't change per test)
- **Do NOT import with `.ts` extension** — always use `.js` in ESM TypeScript imports

---

## Quality Gates

1. `npm run typecheck` — 0 errors
2. `npm test` — all tests pass (≥ 101 baseline + new tests)
3. `npm run build` — succeeds
4. No test uses a hardcoded absolute path from the developer's machine

---

## Learnings

_(Inherited from all prior campaigns)_

### Architecture
- `asyncHandler` AND `AppError` are co-located in `server/src/middleware/errorHandler.ts`
- ManifestService is injected into PresentationService — access via `PresentationService.getInstance()` + `setRoot()`
- `server/src/index.ts` does NOT export `createApp` — build minimal test apps directly
- Routes use factory functions (`createCapabilitiesRoutes()`, etc.) — inject deps at construction time

### Tests
- 101 total: 35 client, 66 server
- All server tests are service/utility level; no existing HTTP-level tests
- Vitest globals are enabled (`describe`, `it`, `expect`, `beforeAll` available without import in some configs — but import explicitly for safety)
- supertest import: `import request from 'supertest';`

### Route Import Convention
```typescript
import { createApiResponse, createErrorResponse } from '../utils/responseHelper.js';
```
Note: `.js` extension required in ESM TypeScript (even though file is `.ts`).

### Envelope Shape (reference)
```typescript
// Success:   { success: true, data: T }
// Success + context: { success: true, data: T, _context: { presentationsRoot: string } }
// Error:     { success: false, error: string }
```

### config.ts specifics
- `GET /config` returns `{ success: true, data: { presentationsRoot, history } }`
- `PUT /config` triggers io emit — io mock needed

### presentations.ts specifics
- `GET /`, `GET /:id`, `GET /:id/manifest` all include `_context: { presentationsRoot }`
- `POST /refresh` returns `{ success: true, data: presentations[] }`
