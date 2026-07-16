# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feat (engine Фаза 1): MVP-ядро движка — `src/engine/` (Entity, EntityFactory, Scene, ProjectLoader, Renderer, AssetLoader, GameEngine), самодостаточен (ноль импортов из editor-кода), 21 тест vitest.
- Feat (A1–A3): Assets context menu **Rename** / **Duplicate** / **Delete** — `AssetItemActionsController` (prompt rename → `updateAsset`; clone via `addExternalAsset` as temporary unsaved; delete with confirm, multi if target in selection, in-memory only + `assetsLibraryDirty`).
