# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Chore: sync `LevelEditor.VERSION` to `4.25.1`**: static version field had drifted from `package.json` across the last 3 releases (conveyorZiplineJumpPadPortal/variableModifier/destructibleContainer bumped `package.json` but not `LevelEditor.js`), failing `npm run validate:version`.
