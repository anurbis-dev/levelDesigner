# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Fix: `stateMachineBehavior` AI no longer detects the player through its own back (v4.28.0)**: `type:'distance'` transition conditions were fully omnidirectional — an NPC "saw" the player at any angle, including directly behind itself. `StateMachineBehavior` now tracks a facing heading (`_facingX`/`_facingY`, initial `(1,0)`, overridable via new `properties.facingX`/`facingY`), updated to the entity's last actual movement direction inside `patrol`/`chase`/`flee` (`_setFacing`, same one-tick-lag convention as Фаза F's `speed` write). `_evalCondition('distance', ...)` now also gates on `_isWithinSight()`: a `fov`-degree cone centered on that facing, default `180°` (front half — excludes only directly behind); level authors can widen it per-condition via `condition.fov` (`360` restores the old fully-omnidirectional check). `ComponentPropertySchema.js` gained `facingX`/`facingY` fields for the Details form. Tests: 3 new cases in `tests/engine/StateMachineBehavior.test.js` (behind-facing blocks the transition, explicit `fov:360` overrides it, facing follows patrol movement so a stationary player transitions from hidden to visible as the NPC turns); full suite 324/324 green.
