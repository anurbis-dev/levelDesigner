# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feat (A1–A3): Assets context menu **Rename** / **Duplicate** / **Delete** — `AssetItemActionsController` (prompt rename → `updateAsset`; clone via `addExternalAsset` as temporary unsaved; delete with confirm, multi if target in selection, in-memory only + `assetsLibraryDirty`).
