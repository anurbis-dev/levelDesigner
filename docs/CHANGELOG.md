# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **UI English-only**: user-facing Russian strings in Dialogues panel, dock chrome (tooltips/empty states/type menu), TypeFilterMenu, ErrorHandler, FileManager → English.

- **Dialogue items + multi-NPC (Фаза I)**: `participants` / `speakerId`; player `choices` as replies; `giveItem`/`takeItem` effects, `requireItem`, `itemPick` on choices; `Inventory` + `Scene.inventory` / `level.inventory` seed. Dialogues panel authoring for all of the above.
