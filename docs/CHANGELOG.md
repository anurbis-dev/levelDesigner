# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: mountableVehicleSeat component (§7 backlog item 4/12)**: new behavior `MountableVehicleSeatBehavior` (registered in `BehaviorRegistry`) — self-contained, polls `scene.input.isDown('e')` directly (own edge-detect, no Event Graph node required); mounts when player is within `mountRadius`, hides `scene.player` and snaps it to the vehicle; while mounted drives the vehicle entity itself (`speed`/`layer`/`collidesWith`, same AABB-blocking pattern as `PlayerMovementBehavior`) and keeps `scene.player` position synced each tick (camera keeps following `scene.player` unchanged); second E press dismounts to a fixed offset beside the vehicle. `PlayerMovementBehavior.update()` gained one guard line: `if (scene.mountedVehicle) return;` (same pattern as the existing `dialogueActive` pause). Parked (unmounted) vehicle is solid via `getBounds()`.
