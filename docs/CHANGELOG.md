# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: tileset + tilemap (§7 Tier 3, v4.42.0)**: Component `tilemap` + `TilemapBehavior` — grid of atlas tiles (`tiles` row-major, `-1` empty), `tileWidth`/`tileHeight`/`columns`/`mapWidth`/`mapHeight`, optional `tilesetAssetId` (catalog `tileset` via `scene.assetsById`) or inline `src`/`imageAssetId`. Solid cells via `getSolidRects()` + shared `collectSolidBlockers` (PlayerMovement / movable / mount). `Renderer.drawTiles`; `AssetLoader.collectImageSources` harvests atlas from behavior + assetsById. `solidIndices` null=all non-empty, `[]`=none. No autotiling / paint UI this pass. `DEFAULT_ASSET_COMPONENTS.tilemap`. Tests: TilemapBehavior, Renderer, GameEngine.integration.
