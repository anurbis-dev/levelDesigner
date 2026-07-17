# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Play dialogue HUD**: choices buttons + item picker (`DialoguePlayHud` on play overlay); inventory strip with item display names.
- **Items & Inventory dock**: level `items[]` definitions, player bag seed, per-object NPC bags (`npcInventories`); history + undo.
- **NPC bags runtime**: `Scene.getBag` / `npcInventories`; dialogue effects `to`/`from`; `itemPick` deposits into speaker bag.
