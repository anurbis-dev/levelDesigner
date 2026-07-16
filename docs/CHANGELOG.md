# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: body-fixed menus (`MenuPositioningUtils`) use `z-index: 10000` so viewport chrome cam/filter/eye (and other popups) work over floating windows (`#floating-layer` was 100 > old `z-50`).
