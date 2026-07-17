# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Asset Editor Components polish**: multi-instance same type (unique ids + labels `Collider` / `Collider 2`); no nested Components header; Add control at top; Preview always re-centers on open (camera not stored); Details live `input` commits so Preview + info overlay update in realtime.
- **Фаза F Animation state machine**: `SpriteAnimationBehavior` supports `states`/`clips`/`defaultState` (named clip catalog + state transitions vs. variables); `PlayerMovementBehavior` writes `speed` to event graph runtime (idle<->walk transitions); new `PlayAnimation` event graph action; backward compatible (no state machine without `states` field).
