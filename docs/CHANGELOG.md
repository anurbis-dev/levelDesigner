# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix **VP-EQ**: viewport leaves equal for display/filter/work camera — `setDisplayFlag` no longer writes global state; each view owns seeded `displayOptions`; work pose always `localCamera` (focused mirrors to level-save camera); menu/hotkeys target under-cursor/focused/any; last viewport only non-closeable; promote-to-shell carries pose/display/filters.
