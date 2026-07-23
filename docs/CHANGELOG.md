# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Fix: Canvases uses global editor commands (v4.38.1)**: Removed panel-local Delete/Duplicate buttons (form + widgets list + Delete canvas). Delete / X and Shift+D route to `CanvasHudPanel` when the Canvases dock is under the cursor (same registry `:hover` pattern as Outliner / Asset Preview F/A). Widget delete preferred; else selected canvas. `deleteSelection()` / `duplicateSelection()` on the panel.
