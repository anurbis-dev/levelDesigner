# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: canvas context menu (RMB on objects/assets in viewport) missing on secondary viewport leaves and floats — `ViewportViewNav` only called `preventDefault`; now routes to shared `CanvasContextMenu` (same as primary). Assets panel copies use unique ContextMenuManager ids (no primary overwrite).
