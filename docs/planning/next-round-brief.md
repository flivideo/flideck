# Next Round Brief — B047: PresentationService Write Locks

**Goal**: Serialise all 16 unguarded `fs.writeJson` calls in `PresentationService.ts` so concurrent API requests can't silently corrupt a manifest.

**Background**: `ManifestService.patchManifest` already has a correct per-presentation write lock (`withWriteLock`, `_locks: Map<string, Promise<void>>`). `PresentationService` has 16 raw `fs.writeJson` calls with no locking. Any two concurrent requests (e.g. an agent calling `POST /slides/bulk` while the UI drags to reorder) will race: read-old → modify → write-old, silently discarding the other write.

## The 16 unguarded write sites (all in PresentationService.ts)

Lines: 488, 539, 630, 705, 776, 826, 877, 929, 972, 1031, 1083, 1193, 1235, 1297, 1348, 1386

Each corresponds to a mutation method:
`saveAssetOrder`, `saveAssetOrderWithGroups`, `addSlide`, `updateSlide`, `removeSlide`,
`createGroup`, `updateGroup`, `deleteGroup`, `createTab`, `updateTab`, `deleteTab`,
`reorderTabs`, `setGroupParent`, `removeGroupParent`, `reorderGroups`, `createPresentation`

## Suggested approach

The lock pattern already exists in `ManifestService` — copy it into `PresentationService`:

```typescript
private writeLocks = new Map<string, Promise<void>>();

private async withWriteLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = this.writeLocks.get(id) ?? Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  this.writeLocks.set(id, next);
  try {
    await prev;
    return await fn();
  } finally {
    resolve();
    if (this.writeLocks.get(id) === next) this.writeLocks.delete(id);
  }
}
```

Then wrap each method's read-modify-write block in `withWriteLock(id, async () => { ... })`.

## What NOT to do

- Do NOT merge the two lock maps (ManifestService and PresentationService each manage their own writes)
- Do NOT lock at a higher level (e.g. locking the whole service) — per-presentation locks are the right granularity
- Do NOT change the public method signatures

## Success criteria

- All 16 `fs.writeJson` calls are inside a `withWriteLock` block
- Existing concurrent write-lock test in ManifestService still passes
- Add at least 1 new concurrent write test in PresentationService (e.g. two simultaneous `addSlide` calls — both slides must survive)
- `npm test` passes: 103 server tests + any new ones

## Session state (as of 2026-03-19)

- 103 server tests passing, 35 client tests — total 138
- Main branch clean, pushed
- `ManifestService.ts` is the reference implementation for the lock pattern
