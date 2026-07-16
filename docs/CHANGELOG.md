# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **C3**: Multiple game cameras — exclusive `properties.isMain` (Details Main; first placed camera auto-main); jump `.` fallback selected→last→main; cycle `]`/`[` binds focused viewport + selects; chrome menu ★ main; gold frustum for main (`FRAME_COLOR_MAIN`).
- **fix**: auto-created Player Start (`FileManager.createNewLevel`/`ObjectOperations.ensurePlayerStartExists`) had no `playerStart` component — Play-in-editor showed only the static marker, no controllable player. Both now attach the component; regression tests added.
