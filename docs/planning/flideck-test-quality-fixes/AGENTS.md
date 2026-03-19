# AGENTS.md — FliDeck Test Quality Fixes

_(Inherited from flideck-write-path-integrity. Updated for this campaign.)_

## Project Overview

**Project**: FliDeck — local-first presentation harness for viewing folder-based HTML artifacts
**Campaign**: flideck-test-quality-fixes — fix three structurally broken tests before B014 (API envelope) is built
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest / TanStack Query

**Current state (2026-03-19, entering this campaign):**
- 0 TypeScript errors in both workspaces
- 0 npm vulnerabilities
- 99 tests passing (35 client, 64 server) — baseline must not regress
- Two tests in `ManifestService.test.ts` are structurally broken (pass even without the code they test):
  1. Proto-pollution test asserts `Object.prototype` is clean — V8 prevents `obj['__proto__'] = value` pollution natively; the deepMerge guard is not what makes it pass
  2. Write-lock test uses mutually-exclusive slide overwrites — cannot distinguish "lock serialized writes" from "writes happened to not race"
- `getById` in `PresentationService.ts` has no empty-root guard (inconsistent with `discoverAll` which throws when root is unset)

---

## Build & Run Commands

```bash
# Run all tests (baseline: 35 client + 64 server = 99 total — must not regress)
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm test

# Run server tests only
cd server && npm test

# TypeScript type check (must pass with 0 errors)
npm run typecheck

# Build
npm run build
```

---

## Directory Structure

```
flideck/
├── server/
│   ├── src/
│   │   ├── middleware/          # errorHandler.ts  ← asyncHandler AND AppError are BOTH here
│   │   ├── services/
│   │   │   ├── PresentationService.ts  (1504 lines — singleton, EventEmitter)
│   │   │   │   └── getById() at line 210  ← add empty-root guard here (B039)
│   │   │   │   └── discoverAll() at line 172  ← has the guard pattern to copy
│   │   │   │   └── assertSafeId() at line 100  ← the guard being tested
│   │   │   ├── ManifestService.ts      (1164 lines)
│   │   │   └── __tests__/
│   │   │       ├── PresentationService.test.ts  ← APPEND one new test (B039)
│   │   │       └── ManifestService.test.ts      ← REPLACE two broken tests (B037, B038)
```

---

## Exact Changes Required

### B037 — Fix proto-pollution test (ManifestService.test.ts ~line 138)

**Current broken test** (passes even without the deepMerge guard):
```typescript
it('proto-pollution guard: __proto__ key in PATCH payload does NOT pollute Object.prototype', async () => {
  // ...setup...
  await service.patchManifest('proto-guard-deck', {
    '__proto__': { polluted: true },
  } as unknown as Partial<FlideckManifest>);

  // ❌ This assertion passes regardless of the guard — V8 prevents __proto__ pollution natively
  expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
});
```

**Fixed test** — assert the dangerous key is ABSENT from the written JSON file:
```typescript
it('proto-pollution guard: __proto__ key in PATCH payload does NOT appear in written manifest', async () => {
  const deckPath = join(tempDir, 'proto-guard-deck');
  await mkdir(deckPath);
  await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');

  await service.patchManifest('proto-guard-deck', {
    '__proto__': { polluted: true },
  } as unknown as Partial<FlideckManifest>);

  // Read the written JSON and confirm __proto__ is NOT a key in the object
  const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
  const written = JSON.parse(raw) as Record<string, unknown>;
  // The guard must have skipped the __proto__ key — it must not appear in the output
  expect(Object.prototype.hasOwnProperty.call(written, '__proto__')).toBe(false);
});
```

**Mutation test**: Delete lines 148–149 of `ManifestService.ts` (the `__proto__` guard in `deepMerge`) and confirm this test FAILS. If it still passes, the fix is wrong.

---

### B038 — Fix write-lock test (ManifestService.test.ts ~line 152)

**Current broken test** (cannot detect a missing lock):
```typescript
it('concurrent calls serialize (write lock): two concurrent patches each land without data loss', async () => {
  // ...setup with slides: []...
  await Promise.all([
    service.patchManifest('concurrent-deck', { slides: [{ file: 'slide-a.html', title: 'A' }] }),
    service.patchManifest('concurrent-deck', { slides: [{ file: 'slide-b.html', title: 'B' }] }),
  ]);
  // ❌ "one of the two states" passes WITH or WITHOUT a lock — writes don't race on small files
  const isValidState = (files.length === 1 && (files[0] === 'slide-a.html' || files[0] === 'slide-b.html'));
  expect(isValidState).toBe(true);
});
```

**Fixed test** — use two patches that each add a **different key to `meta`**; deepMerge merges object keys (does not replace), so the only correct outcome is BOTH keys present:
```typescript
it('concurrent calls serialize (write lock): both additive meta patches land without data loss', async () => {
  const deckPath = join(tempDir, 'concurrent-deck');
  await mkdir(deckPath);
  await writeFile(join(deckPath, 'presentation.html'), '<h1>test</h1>');
  await writeFile(join(deckPath, 'index.json'), JSON.stringify({}, null, 2));

  // Each patch adds a DIFFERENT key to meta.
  // deepMerge merges objects by key (does not replace), so with the write lock:
  //   patch A reads {}, writes {meta: {name: 'A'}}
  //   patch B reads {meta: {name: 'A'}}, writes {meta: {name: 'A', purpose: 'B'}}
  // Without the lock both patches race to read {}, and only one key survives.
  await Promise.all([
    service.patchManifest('concurrent-deck', { meta: { name: 'patch-a' } }),
    service.patchManifest('concurrent-deck', { meta: { purpose: 'patch-b' } }),
  ]);

  const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
  const final = JSON.parse(raw) as FlideckManifest;

  // With write lock serialising the reads+writes, both keys must survive
  expect(final.meta?.name).toBe('patch-a');
  expect(final.meta?.purpose).toBe('patch-b');
});
```

**Why this works**: `patchManifest` reads the current manifest INSIDE the write lock. With the lock, patch B reads the result of patch A (which already wrote `name`), so `purpose` is merged in alongside `name`. Without the lock, both patches read the empty state concurrently and one key is lost on the final write.

**Mutation test**: Remove the `withWriteLock` call from `patchManifest` in `ManifestService.ts` and run this test 5–10 times (`npm test -- --repeat 10` or just run `npm test` multiple times). At least one run should FAIL (one meta key missing due to race). If it never fails, the fix may need a small artificial delay — but try without first.

**`FlideckManifest` shape confirmed**: `meta` is `ManifestMeta?` with `name?: string` and `purpose?: string` fields. No `tags` field exists at the top level of `FlideckManifest`.

---

### B039 — Empty-root guard in getById (PresentationService.ts + PresentationService.test.ts)

**Production fix** — add guard at top of `getById` (line 210):
```typescript
async getById(id: string): Promise<Presentation | null> {
  // Guard: consistent with discoverAll — both throw when root is not configured
  if (!this.presentationsRoot) {
    throw new AppError('Root not configured', 400);
  }
  const folderPath = path.join(this.presentationsRoot, id);
  this.assertSafeId(folderPath);
  // ... rest unchanged
}
```

**New test** — append to `PresentationService.test.ts`:
```typescript
it('getById throws AppError(400) when presentationsRoot is not set', async () => {
  // Create a fresh instance with no root configured
  // PresentationService is a singleton — to test the unset state, temporarily clear the root
  service.setRoot('');  // empty string = unset

  await expect(service.getById('any-deck')).rejects.toMatchObject({ statusCode: 400 });

  // Restore root for subsequent tests
  service.setRoot(tempDir);
});
```

**Mutation test**: Remove the `if (!this.presentationsRoot)` guard from `getById` and confirm this test FAILS. If it still passes, the fix is wrong.

---

## Success Criteria

Before marking any work unit complete:

- [ ] `npm run typecheck` — 0 errors (currently 0; must stay 0)
- [ ] `npm test` — all tests pass; total must be ≥ 99 (no regression from baseline)
- [ ] `npm run build` — succeeds
- [ ] B037: delete the `__proto__` guard lines in `ManifestService.ts` deepMerge → test FAILS
- [ ] B038: remove `withWriteLock` from `patchManifest` → test FAILS (may need to run 3–5 times to trigger the race)
- [ ] B039: remove the `if (!this.presentationsRoot)` guard from `getById` → test FAILS

---

## Anti-Patterns to Avoid

- **Do NOT assert `Object.prototype.x` as a proto-pollution test** — V8 prevents `__proto__` assignment natively; this tests the engine, not your code. Use written-output inspection instead.
- **Do NOT use mutually-exclusive overwrites to test write locks** — two patches that each overwrite the same value cannot detect a missing lock. Use additive operations (push, append, accumulate) so the only correct outcome is both contributions present.
- **Do NOT use `any` types** — both workspaces are clean; keep them that way
- **Do NOT amend commits** — always create new commits
- **Do NOT rewrite existing tests** beyond the two specific broken ones (B037, B038) — append B039 test only
- **Do NOT mock the filesystem** — use real temp directories via `mkdtemp`
- **Do NOT modify `client/` files** — all work is server-side

---

## Quality Gates

Non-negotiable:

1. `npm run typecheck` — 0 errors
2. `npm test` — ≥ 99 tests passing (35 client + 64 server)
3. `npm run build` — succeeds
4. Each fixed test must fail when you delete the production code it covers (mutation test)

---

## Reference Patterns

### AppError import
```typescript
import { AppError } from '../../middleware/errorHandler.js';
```

### discoverAll empty-root guard pattern (copy this into getById)
```typescript
// Line 173 of PresentationService.ts:
if (!this.presentationsRoot) {
  throw new Error('Presentations root not configured');
}
// For getById, use AppError(400) for consistency with assertSafeId:
if (!this.presentationsRoot) {
  throw new AppError('Root not configured', 400);
}
```

### Reading written manifest JSON
```typescript
const raw = await readFile(join(deckPath, 'index.json'), 'utf-8');
const written = JSON.parse(raw) as Record<string, unknown>;
expect(Object.prototype.hasOwnProperty.call(written, '__proto__')).toBe(false);
```

### Checking FlideckManifest schema for additive field
```bash
# Before writing B038 test, read the shared types to find additive fields:
cat /Users/davidcruwys/dev/ad/flivideo/flideck/shared/src/types.ts | grep -A 30 'FlideckManifest'
```

---

## Learnings

_(Inherited from flideck-harness-migration + flideck-cleanup-2026 + flideck-security-foundations + flideck-write-path-integrity)_

### Architecture
- Harness migration complete — `HarnessViewer` is the only render path
- `asyncHandler` AND `AppError` are co-located in `server/src/middleware/errorHandler.ts`
- `server/src/index.ts` does NOT export `createApp` — test service/util functions directly
- ManifestService is a separate class injected into PresentationService — access via `PresentationService.getInstance()` + `setRoot(tempDir)`
- deepMerge is PRIVATE in ManifestService — test it indirectly via patchManifest
- withWriteLock is PRIVATE in ManifestService — test its effect via concurrent patchManifest calls

### Security
- Path traversal guard active via `assertSafeId()` — now runs unconditionally before cache check in `getById`
- 0 npm vulnerabilities — maintain

### Tests
- 99 total tests: 35 client, 64 server
- PresentationService is a singleton — `service.setRoot(tempDir)` in `beforeEach` resets root; cache clears on setRoot
- All server tests use real temp directories — NO mocking
- The dist/ artifact failures (3 stale compiled test files in `dist/`) are pre-existing and acceptable

### Test Anti-Patterns (KEY LEARNINGS from write-path-integrity audit)
- **Proto-pollution via `obj['__proto__'] = value`**: V8 silently ignores this; `Object.prototype` is never actually polluted. Asserting `Object.prototype.x` is undefined proves nothing about your guard. Assert the key is absent from written output instead.
- **Concurrency tests with mutually-exclusive overwrites**: Two patches that each write a complete replacement value cannot distinguish "lock serialized" from "last write won naturally". Use additive operations (push to array, increment counter) so the correct outcome is both contributions present.
- **Optional chaining in existence assertions**: `expect(obj?.field).toBeUndefined()` passes when `obj` is `undefined` AND when `obj.field` is undefined. When testing "field is cleared", assert `obj` is defined first.
- **Empty-root guard consistency**: `discoverAll` guards `!this.presentationsRoot`; `getById` did not — now it will. Apply security checks uniformly.
