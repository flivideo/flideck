# Assessment: flideck-test-quality-fixes

**Campaign**: flideck-test-quality-fixes
**Date**: 2026-03-19 → 2026-03-19
**Results**: 3 complete, 0 failed
**Quality audits**: code-quality-audit + test-quality-audit run post-campaign

---

## Results Summary

| Item | Result |
|------|--------|
| fix-proto-pollution-test | ✅ Replaced assertion with written-output inspection using JSON.parse payload |
| fix-write-lock-test | ✅ Replaced with additive meta key patches (name + purpose); both keys must survive |
| fix-empty-root-guard | ✅ Guard added to getById; test confirms AppError(400) thrown when root is empty |

**Final metrics**: 35 client + 65 server = 100 tests passing (+1 net new over 99 baseline), 0 TS errors, build passes.

---

## What Worked Well

1. **B038 write-lock test is now genuinely mutation-resistant** — patching different `meta` keys (name + purpose) is the canonical additive pattern. Without the lock, one key is lost. With the lock, both survive. The code quality audit confirmed this is excellent.

2. **B039 empty-root guard is clean on both sides** — one guard line in production (consistent with `discoverAll`), one test that calls `setRoot('')` then verifies `AppError(400)`. Isolation is solid: root is restored immediately after the assertion.

3. **Proto-pollution payload construction improved** — using `JSON.parse('{"__proto__":...}')` correctly creates `__proto__` as an own enumerable property (unlike object literal syntax which intercepts it). The intent is now correct even if the final assertion still has a gap.

4. **Code quality audit: all green** — correct placement, correct error type (`AppError(400)` not `Error`), no type issues, layered defence maintained (`getById` now has both the empty-root guard AND `assertSafeId`).

---

## What Didn't Work

### Audit finding: B037 proto-pollution test is STILL structurally weak (third attempt)

The test now uses `JSON.parse('{"__proto__":...}')` to produce a real own enumerable `__proto__` property — this is correct and an improvement. The `deepMerge` guard (`Object.keys`) sees the key and skips it. But the assertion still cannot prove the guard ran:

Without the guard, `deepMerge` would execute `result['__proto__'] = { polluted: true }`. In V8, this assignment sets the **prototype** of `result` (not an own enumerable property). `JSON.stringify` only serialises own enumerable properties, so `__proto__` would never appear in the written JSON regardless. Therefore `Object.prototype.hasOwnProperty.call(written, '__proto__')` is `false` with OR without the guard.

**The guard IS correctly written in production** — it defensively prevents the prototype from being modified on the merged result. The problem is genuinely hard to test in a mutation-resistant way because V8 intercepts `obj['__proto__'] = value` at the engine level.

**Fix for next campaign (B040)**: Test at the in-memory level. After patchManifest, check that the prototype of the merged object was not changed by verifying unrelated objects are unaffected. The most reliable approach is to spy on `Object.keys` or use a `null`-prototype base object in deepMerge so the assignment would succeed as an own property. Alternatively: accept the guard as untestable by standard means and add a comment explaining why.

---

## Key Learnings — Application

1. **Proto-pollution is genuinely hard to unit test** — V8 makes `obj['__proto__'] = value` safe by intercepting it as a prototype assignment, which means the very safety property we want to protect against cannot be simulated in a standard test without engine-level tricks (`Object.defineProperty`, null-prototype objects).
2. **Additive concurrent patch pattern works** — patching different keys within the same object is the right way to prove write-lock serialization. Any test where both patches produce "valid" states even without ordering cannot distinguish locked from unlocked.
3. **Empty-root guards should use AppError, not Error** — generic `Error` is caught by the `asyncHandler` middleware and re-wrapped unpredictably; `AppError(400)` is explicit and testable.

---

## Key Learnings — Ralph Loop

1. **Two audit agents in parallel saves time** — code-quality-audit and test-quality-audit ran simultaneously, no conflict, results arrived independently and were complementary.
2. **Audits can disagree on severity** — code quality audit rated B037 PASS (guard is correct), test quality audit rated it BLOCKER (assertion is still weak). Both are right from their respective lenses; the right call is to carry B037 forward as B040 rather than declaring it done.
3. **Single-agent waves are efficient for small campaigns** — three fixes, no file conflicts, one agent, done in ~7 minutes.

---

## Promote to Main KDD?

- **Proto-pollution via `obj['__proto__'] = value` is safe in V8** — the engine intercepts this as a prototype assignment; `JSON.stringify` will never serialize it. To test a proto-pollution guard, you need null-prototype base objects or `Object.defineProperty`.
- **Additive concurrency test pattern** — confirmed: two patches adding different keys to the same object, then asserting both keys survived, is a reliable write-lock test.

---

## Suggestions for Next Campaign (B040 + B014)

- **B040**: Fix proto-pollution guard test properly. Options: (a) use null-prototype result in deepMerge so `__proto__` assignment lands as own property; (b) use `Object.defineProperty` in the payload; (c) accept unverifiability and document with a code comment explaining why V8 makes this untestable by normal means.
- **B014** (API envelope): Now safer to build — ManifestService and PresentationService write paths have solid coverage (B038, B039). The one remaining weak test (B037) is on the guard, not on the write path.

### AGENTS.md improvements for B014:
- Add to anti-patterns: "do NOT use `Object.prototype.hasOwnProperty.call(obj, '__proto__')` to test a proto-pollution guard — V8 prevents `obj['__proto__'] = value` from creating own properties, so the assertion passes regardless"
- Add: "to test deepMerge proto-pollution resistance, use a null-prototype base object (`Object.create(null)`) so engine interception doesn't mask the bug"
