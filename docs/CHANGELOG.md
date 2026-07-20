# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: destructibleContainer component (§7 backlog item 12/12, closes the §7 backlog)**: new behavior `DestructibleContainerBehavior` (registered in `BehaviorRegistry`) subclasses `DamageHealthBehavior` to reuse its health-pool/contact-damage/invulnerability logic and solid-while-alive side effect verbatim (no `isOverlapping()` override). `DamageHealthBehavior` gained an extracted `_onDeath(scene)` hook (pure refactor, no behavior change) so `DestructibleContainerBehavior` can override it: on death it spawns a loot entity (`EntityFactory.fromGameObjectData`, same reuse pattern as `SpawnerBehavior`) carrying a `pickup` component (`itemId`/`count`) at its own position — the player walks over it like any other Pickup, rather than the item being granted directly. No `itemId` set → no loot spawned, `destroyOnDeath` still applies. `contactDamage` intentionally left out of the editor schema (a container shouldn't damage others) but still defaults to 0 at runtime via the inherited constructor. Tests: `tests/engine/DestructibleContainerBehavior.test.js` (8 tests).
