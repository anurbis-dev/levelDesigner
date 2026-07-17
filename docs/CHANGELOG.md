# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Asset visual model**: new **Sprite** component owns image `src`; Identity no longer edits imgSrc; content JSON migrated with sprite; load/import ensure Sprite; `imgSrc` mirrored for engine placement.
- **Preview colliders**: draw **all** colliders/triggers as stroke frames (palette + corners), never tint/crop sprite; selected emphasized.
- **Realtime Details→Preview**: `updateAsset` uses `set('assetsChanged')`; live patch paints previews immediately; Components list skips re-render on pure prop edits.
