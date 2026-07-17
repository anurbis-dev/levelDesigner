# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Asset Editor undo/redo (Phase C closed)**: project-global asset catalog stack in `HistoryManager` (`saveAssetState`/`undoAsset`/`redoAsset`); Ctrl+Z prefers asset undo while Asset Editor open. Freeform drag commits one history step on pointerup; Details text fields history on change (not per keystroke).
