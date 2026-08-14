# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Fix: tiny asset thumbnails were blurry** — grid/list/details (and UIFactory) thumbs now `image-rendering: pixelated` + `object-fit: contain`, same nearest-neighbor as the canvas.
