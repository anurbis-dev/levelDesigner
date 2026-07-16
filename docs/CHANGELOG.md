# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: Outliner context menu flicker (open → reselect under cursor → close/reopen) — select target on RMB mousedown before `contextmenu`; do not change selection inside `showContextMenu` (that triggered `updateAllPanels` mid-open).
