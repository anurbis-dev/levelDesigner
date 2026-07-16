# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: after RMB pan, releasing over panels/UI no longer opens that panel's context menu (`wasPanning` / `suppressContextMenu` capture block + global mouseup finishes pan path).
- Feature: Canvas/Outliner context menus — stack order (Bring to Front / Send to Back / Bring Forward / Send Backward) via `ObjectOperations.applyStackOrderActionToSelection` (same as Details); separators around layer-move block.
