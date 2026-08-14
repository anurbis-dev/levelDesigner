# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Fix: New Project resets default Assets folder (v4.54.1)**: `newProject()` calls `clearProjectFolder()` — drops the FSA grant and rescans served `./content/`. Confirm mentions this when a folder is bound. File → **Clear Project Folder** does the same without creating a new project.
