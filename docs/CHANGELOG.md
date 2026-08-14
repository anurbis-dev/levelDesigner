# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Fix: drop new empty Level asset 404** — `openLevelFromAsset` fetched `./content/${asset.path}`. Placeholder has no map file / no `levelSrc` (only catalog `path`), so HTTP 404 and no tab. Now loads only `properties.levelSrc` (FSA then `./content/`); otherwise opens an empty level named after the asset.
