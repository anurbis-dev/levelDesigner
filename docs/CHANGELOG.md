# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: `materialShaderPreset` canvas filter presets (§7 backlog Tier 1, v4.31.0)**: new `materialPreset` field on GameObject/`Entity` (JSON `{blur?, brightness?, saturate?, hueRotate?, dropShadow?:{x?,y?,blur?,color?}}`, direct field like `color`/`imgSrc`, not a component `properties` bag). New static `Renderer._buildFilterString()` (`src/engine/render/Renderer.js`) turns it into a canvas 2D CSS `filter` string, applied in `_drawSingle` to every entity draw (image or fallback rect); resets to `'none'` for entities without a preset so filters don't leak onto the next entity. Not gated behind a `volume` zone — `volume` (arbitrary-shape visual-effect trigger) is a separate, still-unimplemented §7 item; the filter applies to any entity. No separate reusable catalog asset/editor form yet — `ProjectLoader.assetsById` is still an intentionally empty `Map` (Tier 2+); preset data is inline on the object, same convention as `pathFollower.interpolation`/`stateMachineBehavior.aiPreset`/`PlaySound`. Tests: 3 new cases in `tests/engine/Renderer.test.js` (defaults `ctx.filter` to `'none'`, builds the full CSS filter string from all preset fields, resets to `'none'` for the next entity after a filtered one); full suite 336/336 green.
