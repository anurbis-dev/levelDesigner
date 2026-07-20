# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: `pathSpline` smooth interpolation for `pathFollower` (§7 backlog Tier 1, v4.29.0)**: new `interpolation` property on `pathFollower` (`'linear'` default, unchanged behavior \| `'smooth'`). In `'smooth'` mode, `PathFollowerBehavior` curves through `waypoints` via Catmull-Rom (`_updateSmooth`/`_catmullRom` in `src/engine/behaviors/PathFollowerBehavior.js`) instead of straight segments — control points are the adjacent waypoints (clamped, not wrapped, at path ends), segment progress `_segT` driven by straight-chord length (approximation, not true arc length). No separate `pathSpline` catalog asset/editor form — `ProjectLoader.assetsById` is still an intentionally empty `Map` (Tier 2+); curve config lives inline on `pathFollower.properties`, same convention as `PlaySound`'s inline params. `ComponentPropertySchema.js` gained `interpolation` select field (`PATH_FOLLOWER_INTERPOLATION_OPTIONS`). Tests: 3 new cases in `tests/engine/PathFollowerBehavior.test.js` (reaches every waypoint exactly like linear mode, curves off the straight chord mid-segment, defaults to `'linear'` when unset); full suite 327/327 green.
