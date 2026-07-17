# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Asset Editor float**: modal `ActorPropertiesWindow` removed; dblclick/open asset → dock floating workspace (`role=assetEditor`) with panels `assetPreview` / `assetIdentity` / `assetComponents` / `assetComponentDetails`; live `assetManager.updateAsset`; state `editingAssetId` / `editingComponentId`; `DockManager.openAssetEditorWorkspace` / `closeAssetEditorWorkspace` / `syncAssetEditorTitle`; View menu stays level types only; type-menu filters asset* vs level types.
