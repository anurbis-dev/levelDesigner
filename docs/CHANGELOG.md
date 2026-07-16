# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Engine Phase 2**: Input system and player movement — `src/engine/Input.js` (keyboard state: arrows/WASD → normalized axis), `src/engine/behaviors/PlayerMovementBehavior.js` (runtime player entity driven by Input, per-axis AABB collision), `Scene.spawnPlayer()` (creates player at playerStart marker, hides marker gizmo), `GameEngine` owns Input lifecycle (destroy on stop).
