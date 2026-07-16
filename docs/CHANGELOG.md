# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feat (engine Фаза 2): BehaviorRegistry + 4 MVP-компонента (Collider, Trigger, Interactable, PlayerStart) — `src/engine/BehaviorRegistry.js`, `src/engine/behaviors/{Behavior,AABB,ColliderBehavior,TriggerBehavior,InteractableBehavior,PlayerStartBehavior,registerDefaultBehaviors}.js`; Entity/EntityFactory/Scene/GameEngine обновлены для `_update(dt)` и duck-typed behavior injection; 27 новых тестов (91→118).
