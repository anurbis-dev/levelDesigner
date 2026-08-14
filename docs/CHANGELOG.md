# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: Ctrl+S saves selected assets** — over Assets panel (or Asset Editor) `Ctrl+S` persists selected/editing library assets instead of the level.
- **Fix: unsaved-dot stayed after asset save** — `renderPreviews` skipped rebuild when only dirty flags changed; cache now includes dirty/name/tmp/`lastSaved`, and save calls `invalidatePreviewCache` + `assetsChanged`.
