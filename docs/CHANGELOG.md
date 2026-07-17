# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Visual ownership cleanup**: only **Image** assets store disk/`imgSrc`; **Sprite** uses `imageAssetId` → Image (no path). Base asset no longer mirrors texture from components. Content JSON migrated (strip Sprite from images). Thumbs/preview/placement resolve via AssetManager.
