# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: checkpointSavePoint component (§7 backlog item 8/12)**: new behavior `CheckpointSaveBehavior` (registered in `BehaviorRegistry`) — self-contained checkpoint/save point, empty property schema (trigger zone = entity box, no shape override, same minimalism as `playerStart`). Each tick, while not yet active, AABB-checks overlap with `scene.player`; on overlap calls public `activate(scene)` (duck-typed hook, future Event Graph action target like `setState`/`spawnOne`) which deactivates the previous `scene.activeCheckpoint` (single source of truth — only one checkpoint active at a time) and records `scene.checkpointPosition`. Actual respawn lives in `Scene.js`: `spawnPlayer()`/new `respawnPlayer()` now share a `_createPlayer()` helper; `respawnPlayer()` is a no-op if `scene.player` is alive, otherwise recreates it at `checkpointPosition` if set, else at the cached `playerStart` marker position. `GameEngine._update()` calls `scene.respawnPlayer()` whenever `scene.player` is missing — the first engine-level reaction to `DamageHealthBehavior.destroyOnDeath`, which previously just left `scene.player = null` with no recovery path.
