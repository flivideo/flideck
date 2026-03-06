# Decision: Vite 7 Upgrade Path

**Date:** 2026-03-06
**Status:** Research complete — recommendation included

---

## Current State

| Package | Installed | Specified in package.json |
|---|---|---|
| `vite` | 6.4.1 | `^6.0.6` |
| `@vitejs/plugin-react` | 4.7.0 | `^4.3.4` |
| `@tailwindcss/vite` | 4.1.18 | `^4.1.13` |
| Node.js (runtime) | v25.8.0 | — |

## Target: Vite 7

Latest stable release: **7.3.1** (as of 2026-03-06)

---

## Breaking Changes That Affect FliDeck

### 1. Node.js minimum version — NO IMPACT

Vite 7 requires Node.js `^20.19.0 || >=22.12.0`. The project is running Node.js 25.8.0, which satisfies `>=22.12.0`. No action needed.

### 2. Default build target change — LOW IMPACT

The default `build.target` changed from `'modules'` to `'baseline-widely-available'`, which raises the minimum browser baseline:

| Browser | Vite 6 | Vite 7 |
|---|---|---|
| Chrome | 87 | 107 |
| Edge | 88 | 107 |
| Firefox | 78 | 104 |
| Safari | 14.0 | 16.0 |

FliDeck is a **local-first tool** used by one developer on a modern browser. This change has no practical impact. No `build.target` override is needed in `vite.config.ts`.

### 3. Rollup version — NO CHANGE

Vite 6.4.1 already uses rollup `^4.34.9`. Vite 7.3.1 uses rollup `^4.43.0`. Both are rollup v4 — no rollup major version bump, no breaking change to the build pipeline.

### 4. Sass legacy API removed — NO IMPACT

Vite 7 removes the Sass legacy API. FliDeck does not use Sass; it uses Tailwind CSS v4 via `@tailwindcss/vite`. This removal is irrelevant.

### 5. `splitVendorChunkPlugin` removed — NO IMPACT

This plugin was deprecated in Vite 5.2.7. FliDeck does not use it. No action needed.

### 6. `transformIndexHtml` hook API change — NO IMPACT

The `enforce`/`transform` hook-level properties are removed; `order`/`handler` replacements are required. FliDeck does not define any custom `transformIndexHtml` hooks.

### 7. HMR and iframe srcdoc — NO IMPACT

Vite 7 removes some deprecated internal HMR types (`HMRBroadcaster`, `HMRBroadcasterClient`). FliDeck uses the iframe `srcdoc` pattern to render presentation assets — these are sandboxed iframes that receive their own HTML content directly, not connected to Vite's HMR overlay. The HMR type removals affect plugin authors, not consumers of Vite dev server. No impact expected.

### 8. Server middleware ordering change — LOW / MONITOR

Certain middlewares now run before `configureServer` / `configurePreviewServer` hooks, which can affect CORS header ordering. FliDeck's `vite.config.ts` only configures dev server proxies (to Express on port 5201) and does not use `configureServer` hooks. Low risk; worth a quick smoke-test after upgrade.

### 9. Legacy internal removals — NO IMPACT

`legacy.proxySsrExternalModules`, `ModuleRunnerOptions.root`, and deprecated TypeScript types have been removed. FliDeck does not use SSR or the Environment API.

---

## Plugin Compatibility

| Plugin | Current version | Vite 7 peer dep support | Action needed |
|---|---|---|---|
| `@vitejs/plugin-react` | 4.7.0 | v5.x supports `^4.2.0 \|\| ^5.0.0 \|\| ^6.0.0 \|\| ^7.0.0` | Upgrade to v5.x |
| `@tailwindcss/vite` | 4.1.18 | supports `^5.2.0 \|\| ^6 \|\| ^7` | No version change needed |

### @vitejs/plugin-react upgrade

The currently installed version 4.7.0 does **not** declare Vite 7 in its peer dependencies. Version **5.x** (latest: 5.1.4) explicitly supports Vite 7. This is a minor plugin version bump with no known API changes — the usage in `vite.config.ts` (`react()`) remains identical.

---

## Vitest Compatibility

The project uses Vitest 4.0.18. The Vite 7 announcement notes Vitest 3.2+ is required for Vite 7 compatibility. Vitest 4.x satisfies this requirement. No action needed.

---

## Summary of Required Changes

All changes are confined to `client/package.json`:

```json
"vite": "^7.3.1",
"@vitejs/plugin-react": "^5.1.4"
```

`vite.config.ts` requires **no changes**.

---

## Effort Estimate

**Easy.** Two dependency version bumps in `client/package.json`. No config changes. No code changes. All plugins are compatible. The rollup major version did not change (still v4). The iframe/srcdoc rendering approach is unaffected by Vite's HMR internals.

Post-upgrade smoke test checklist (5 minutes):
- [ ] `npm install` in `client/` resolves cleanly
- [ ] `npm run dev` starts on port 5200
- [ ] Proxy to port 5201 still works
- [ ] Presentation iframe renders correctly
- [ ] `npm run build` produces a clean output
- [ ] `npm test` passes

---

## Recommendation

**Upgrade now.** This is a low-risk, low-effort upgrade. FliDeck uses Vite in a minimal, straightforward way (dev proxy + React plugin + Tailwind) and hits none of Vite 7's meaningful breaking changes. Vite 6 is still maintained but staying current avoids future multi-major leaps. The only required change is bumping `vite` to `^7.3.1` and `@vitejs/plugin-react` to `^5.1.4` in `client/package.json`.
