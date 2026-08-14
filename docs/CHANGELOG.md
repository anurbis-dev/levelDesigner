# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: Restore project Assets folder on Open / Recent (v4.55.0)**: FSA handle is stored per project file name (`project:<file>` in IndexedDB). Save / Set Project Folder binds the current folder; Open Project and Open Recent call `restoreProjectFolder`. New Project still unbinds the active folder (default `./content/`) but keeps other projects' handles. Clear Project Folder forgets only the open project's bind.
