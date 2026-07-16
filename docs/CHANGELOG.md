# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feature **U4**: Context menu **Move to Layer** (Canvas + Outliner) — flyout of all layers; current layer / locked disabled; also **Move Layer Up/Down** (PageUp/PageDown). API: `LayerOperations.moveSelectedObjectsToLayerId` + `buildMoveToLayerMenuItems`. Outliner ensures right-clicked object is in selection. `BaseContextMenu` submenus accept function-valued `items` (resolved each open).
