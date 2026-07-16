# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feature: **Game** top-level menu — moved **Play** out of the toolbar into `Game > Play`; added `Game > Build...`, which saves the project and downloads a `build-<project name>-game.bat` (plain download, not the native save-picker — see fix below) that runs `npm run build:game` — browser has no shell/fs access to invoke esbuild itself. Both files need to end up next to `package.json`.
- Fix: `FileUtils.saveDataDirectly`'s native save-picker filter was hardcoded to `.json` regardless of the caller's `mimeType`/filename — fixed (derives `accept`/description from the actual extension), but `Game > Build...` switched to a plain `downloadData()` for the `.bat` instead of using it: the picker's 10s timeout races the native dialog without cancelling it, so a slow pick fired both the timeout's download fallback *and* the picker's own write once the user finished — saving the `.bat` twice.
