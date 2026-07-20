# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: climbableLadder component (§7 backlog item 9/12)**: new behavior `ClimbableLadderBehavior` (registered in `BehaviorRegistry`) — ladder zone, never solid (`isOverlapping()` exists purely as the duck-type marker `PlayerMovementBehavior`'s existing solids filter already excludes, same convention as `TriggerBehavior`). Exposes `getBounds()` (same shape/offset schema as `collider`/`trigger`: box/circle/freeform + `climbSpeed`, default `100`) and `getClimbSpeed()`. `PlayerMovementBehavior` gained `_findLadder(scene)` — each tick, if the player's bounds overlap an enabled ladder zone, horizontal input is ignored (vertical-only climb) and speed switches from the player's normal walk speed to the ladder's `climbSpeed`; normal solid-blocking (colliders) still applies per-axis while climbing. No Event Graph integration (no `OnLadderEnter`), no auto-centering on the ladder's horizontal axis — not requested, same discipline as the rest of §7.
