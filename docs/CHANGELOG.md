# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feat (engine Фаза 3): Play-in-editor — `src/core/PlayOperations.js` сериализует текущий уровень через `ProjectExporter.export()`, валидирует наличие Player Start (`editor.getPlayerStartCount()`), поднимает `GameEngine` в fullscreen-overlay canvas (вне `ViewportViewManager`/`RenderOperations`, чтобы не конкурировать с editor-рендером); toolbar-кнопка Play/Stop (`toggle-play`), `Esc` останавливает через `EventHandlers.handleKeyDown` (`playMode`-guard блокирует остальные editor-хоткеи во время игры). Без Input/player-controller — сознательно отложено на отдельный шаг.
