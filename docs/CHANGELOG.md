# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feature (engine Фаза 4, minimal cut): `npm run build:game -- --project=<path> [--out=dist/game]` — reads a saved project file, bundles `src/engine/index.js` via esbuild, writes a self-contained `dist/<out>/{engine.js, project.json, player.html, content/}`. `build:addon`/`build:event` are stubs. No "include in build" flag or asset-usage-graph trimming yet — deferred, see `tmp/2D_Editor_ENGINE_PLAN.md` §4.
- Refactor: `src/ui/dock/ViewportLeafChrome.js` split into `ViewportLeafChrome.js` (icon buttons) + `ViewportLeafMenus.js` (cam/filter/eye dropdown bodies) + `ViewportLeafChromeState.js` (shared hover/close state + DOM sync) — file had grown past the 400-line guardrail after VP-EYE; no behavior change.
