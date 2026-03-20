# Next Round Brief — B057–B060: Assertion Tightening

**Goal**: Tighten four existing tests with stronger assertions. All are low-priority — each is a one-liner addition that closes a gap where a test could pass despite a real regression.

**Background**: B055/B056 are done. The backlog now has only these four low-priority items. No source code changes required — test files only.

## B057 — deleteGroup: prove slides are ungrouped not deleted

In the existing `deleteGroup` cascade test, we assert that slides previously assigned to the deleted group no longer have a `group` field. We don't assert that the slides themselves still exist.

**Fix**: Add `expect(manifest.slides).toHaveLength(n)` to confirm slide count is unchanged after group deletion.

**File**: `server/src/services/__tests__/PresentationService.test.ts`

---

## B058 — syncFromIndex: index-mary.html → tabId:mary pattern

The existing syncFromIndex tabbed tests use `index-tab-*.html` naming. The `index-mary.html` pattern (without the `tab-` prefix) is also supported but not tested.

**Fix**: Add a test with `index-mary.html` / `index-work.html` files and assert that the resulting tabs get IDs `mary` and `work`.

**File**: `server/src/services/__tests__/ManifestService.test.ts`

---

## B059 — removeSlide: physical file is NOT deleted

removeSlide removes a slide from the manifest. It should not touch the filesystem. Currently no test verifies the HTML file still exists after removal.

**Fix**: After calling `removeSlide`, assert `fs.pathExists(join(deckPath, 'slide.html'))` returns true.

**File**: `server/src/services/__tests__/PresentationService.test.ts`

---

## B060 — flat-merge syncFromIndex: toHaveLength guard

The existing flat-merge test checks that specific slides are present in `manifest.slides` but doesn't assert the total length. A bug that duplicates entries would pass.

**Fix**: Add `expect(manifest.slides).toHaveLength(n)` matching the number of HTML files in the fixture.

**File**: `server/src/services/__tests__/ManifestService.test.ts`

---

## Suggested Approach

Single agent, both test files. All four are additive assertions — no structural changes, no setup changes. Estimated: ~10 lines total across both files.

After B057–B060 the backlog has zero pending items. Clean slate.
