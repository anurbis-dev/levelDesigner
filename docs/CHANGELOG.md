# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feature: **Game** top-level menu — moved **Play** out of the toolbar into `Game > Play`; added `Game > Build...`, which saves the project and generates `build-game.bat` (via `FileUtils.saveDataDirectly`) that runs `npm run build:game` — browser has no shell/fs access to invoke esbuild itself. Both files need to end up next to `package.json`.
- Fix: `FileUtils.saveDataDirectly`'s native save-picker filter was hardcoded to `.json` regardless of the caller's `mimeType`/filename (would have forced `.bat` saves through a JSON filter) — now derives the picker `accept`/description from the actual filename extension.
