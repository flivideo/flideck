# Assessment: flideck-write-path-integrity

**Campaign**: flideck-write-path-integrity
**Date**: 2026-03-19 → 2026-03-19
**Results**: 3 complete, 0 failed
**Quality audits**: code-quality-audit + test-quality-audit run post-campaign

---

## Results Summary

| Item | Result |
|------|--------|
| fix-assertsafeid-cache | ✅ assertSafeId moved before cache check in getById; warm-cache traversal test added |
| test-manifest-service | ✅ ManifestService.test.ts created — 12 tests |
| test-write-path | ✅ 8 new tests appended to PresentationService.test.ts |

**Final metrics**: 35 client + 64 server = 99 tests passing (+20 net new over 79 baseline), 0 TS errors, build passes.

---

## What Worked Well

1. **assertSafeId fix is structurally correct** — moving the call before the cache check is the right fix, and the warm-cache traversal test proves the guard runs unconditionally. The test WOULD fail if someone moved the call back inside the cache-miss branch.

2. **bulkAddSlides conflict strategy tests are solid** — all three strategies (skip/replace/rename) have specific, mutation-resistant assertions that check counts, titles, and filenames. These would catch a strategy being applied incorrectly.

3. **saveAssetOrder slides-format tests are the best in the suite** — the reorder test uses `toEqual` on the full positional array, and the metadata-preservation test checks all four fields after reorder. Strong regression protection for a branch that had zero coverage.

4. **deleteTab orphan test is stronger than cascade** — it checks all four invariants (tab gone, group exists, group has no parent, slide keeps group reference). Well structured.

5. **ManifestService nested-field preservation test** — directly verifies deep-merge semantics: update one sibling, confirm the other survives. Would catch a replace-instead-of-merge regression immediately.

---

## What Didn't Work

### Audit finding: Proto-pollution guard test does not prove the guard works

`patchManifest` proto-pollution test passes even if `deepMerge`'s `__proto__` guard is completely removed. In V8, `obj['__proto__'] = value` does NOT pollute `Object.prototype` — `Object.defineProperty` is required for actual pollution. The test validates JavaScript engine behaviour, not the custom guard. Deleting lines 148–149 of `ManifestService.ts` would leave the test green.

**Fix for next campaign**: Test via `Object.create(null)` as the base, or use `Object.defineProperty` in the payload, or assert that the `__proto__` key was explicitly skipped (e.g., by checking no `__proto__` key appears in the written manifest JSON).

### Audit finding: Concurrent write-lock test does not prove serialization

The concurrent `patchManifest` test fires two patches that each write mutually exclusive `slides` arrays. It asserts "one of two valid states" exists — which is true with OR without the write lock, because Node.js `fs.writeFile` is atomic for small files. The test cannot distinguish "lock serialized the writes" from "writes happened to not race on a fast machine."

**Fix for next campaign**: Use additive/cumulative patches (e.g., both patches push to a `tags` array) so the only correct outcome is both items present. A missing lock would produce one item; the lock ensures two.

### Audit finding: assertSafeId vacuously passes when presentationsRoot is empty

When `presentationsRoot` is `''` (never set), `path.resolve('')` = `process.cwd()`. Any ID resolves to a path under `process.cwd()`, which starts with `resolvedRoot`, so the check passes silently. `discoverAll` guards this with `if (!this.presentationsRoot) throw` — `getById` does not. The security check is inconsistent across the two entry points.

### Audit finding: deleteTab cascade test can pass if slides are deleted (not just cleared)

The cascade test asserts `slide1?.group` is `undefined`, but optional chaining means this also passes if `slide1` is itself `undefined` (i.e., the slide was deleted from the array). No assertion confirms the `slides` array still has 3 entries after cascade. A broken cascade that deleted slides instead of clearing their group field would silently pass.

---

## Key Learnings — Application

1. **Proto-pollution tests need an observable side effect** — asserting `Object.prototype.x` is undefined is not proof the guard ran; V8 prevents this anyway. The test must verify the guard path was taken, e.g., by asserting the dangerous key does NOT appear in the written output.
2. **Concurrency tests need cumulative state** — two writes that each overwrite the same value cannot prove ordering. Only additive operations (push, increment, append) can detect a missing lock by producing an incorrect count.
3. **Optional chaining in assertions hides undefined subjects** — `expect(slide?.field).toBeUndefined()` passes when `slide` is undefined AND when `slide.field` is undefined. When testing "field is cleared", always assert `slide` is defined first.
4. **Empty-root guard pattern needs to be consistent** — `discoverAll` guards it; `getById` doesn't. Security checks should be applied uniformly, not case-by-case.

---

## Key Learnings — Ralph Loop

1. **Test campaigns need the same quality gate as feature campaigns** — the audits found two HIGH-severity tests that are structurally unable to fail. A test that can't fail gives false confidence and is worse than no test (it crowds out the real coverage gap).
2. **Agent prompts for tests should include "mutation test yourself" instruction** — before committing, agents should delete the key production line and confirm the test catches it. This would have caught both the proto-pollution and lock failures before they landed.
3. **Wave 2 ran cleanly in parallel** — no file conflicts, both agents committed without issue. The AGENTS.md guidance on non-overlapping files worked well.

---

## Promote to Main KDD?

- **Proto-pollution test anti-pattern**: asserting `Object.prototype` is unpolluted is testing V8, not your code. Use `Object.defineProperty` or check the written output for the dangerous key.
- **Concurrency test pattern**: use cumulative operations to prove lock behaviour. Mutually exclusive overwrites prove nothing about ordering.
- **Optional chaining in assertions**: always assert the subject exists before asserting its field is undefined.

---

## Suggestions for Next Campaign (B014 — API Envelope)

- B014 is now safer to build — ManifestService and PresentationService write paths have coverage
- Before B014: fix the two HIGH-severity test gaps above (proto-pollution + write-lock) — add as B037 + B038
- Add `if (!this.presentationsRoot) throw new AppError(400, 'Root not configured')` guard to `getById` — add as B039
- B014 itself: adopt `createApiResponse<T>()` across all route handlers (responseHelper.ts is ready); ensure each route's response shape is covered by at least one existing test before changing it

### AGENTS.md improvements for B014:
- Add to anti-patterns: "do NOT assert `Object.prototype.x` as a proto-pollution test — use written output inspection instead"
- Add to anti-patterns: "do NOT use mutually exclusive overwrites to test write locks — use additive operations"
- Add to quality gates: "for each new test, delete the key production line and confirm the test fails (mutation test)"
