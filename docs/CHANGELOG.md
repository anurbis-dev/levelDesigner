# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: spawner component (§7 backlog item 6/12)**: new behavior `SpawnerBehavior` (registered in `BehaviorRegistry`) — self-contained periodic entity spawner; `template` (JSON, full GameObject-shaped data consumed by `EntityFactory.fromGameObjectData` — no runtime asset registry exists yet, so the spawned entity's data lives inline, same convention as `pathFollower.waypoints`), `interval` (sec, default 3, `<=0` disables), `maxAlive`/`maxSpawns` (default 0 = unlimited), `spawnOffsetX`/`spawnOffsetY` (default 0, asset-local offset from the spawner's own position). Spawned entities get id `${entity.id}__spawnN` and are pushed directly into `scene.entities`. Public `spawnOne(scene)` hook exposed for a future Event Graph "SpawnObject" action — not wired this pass.
