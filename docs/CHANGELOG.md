# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: HUD image widgets use catalog Image assets (v4.39.0)**: Canvases image type stores `imageAssetId` (select + drop from Assets), not a disk path/URL. Resolve via `resolveWidgetImageSrc` + `scene.assetsById` (Play export now passes `assetManager`). Shared `AssetRefControl.js`; Asset Editor Sprite `imageAssetId` also accepts drop. Legacy widget `imgSrc` remains a read-only fallback when no asset id is set. Disk path remains only on type=image assets.
