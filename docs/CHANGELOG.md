# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: asset drop onto viewport showed only selection frames until mouse moved (and same on viewport copies) — `handleDrop` cleared spatial index but not `visibleObjectsCache` (same class of bug as duplicate place).
