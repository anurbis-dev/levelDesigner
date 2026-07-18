# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: movablePushable component (§7 backlog item 3/12)**: new behavior `MovablePushableBehavior` (registered in `BehaviorRegistry`) — Sokoban-style box, solid by default (`getBounds()`); `PlayerMovementBehavior._moveAxis` duck-type-calls `blocker.tryPush(dx,dy,scene)` on a blocking solid before reverting a blocked step, letting the box slide along; push only succeeds if the destination is itself clear of other solids (walls, other boxes); `layer`/`collidesWith` gate which solids block the destination.
