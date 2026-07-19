# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: pathFollower component (§7 backlog item 5/12)**: new behavior `PathFollowerBehavior` (registered in `BehaviorRegistry`) — self-contained kinematic waypoint patrol; `waypoints` (JSON `[{x,y},…]`, offsets from entity spawn position, same asset-local convention as collider freeform `points`); moves `entity.x/y` toward the current target waypoint at `speed` px/sec, pauses `waitAtWaypoint` sec on arrival, then advances per `mode` (`loop` wraps to first, `pingpong` reverses at ends, `once` stops at last). No collision checks against solids and no player/passenger carrying — out of scope for this pass.
