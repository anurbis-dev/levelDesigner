# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: nineSliceSprite (§7 Tier 4, v4.45.0)**: Component `nineSliceSprite` + `NineSliceSpriteBehavior` — 3×3 border-preserving stretch into entity box. Props: `imageAssetId`/`src`, `borderLeft`/`Right`/`Top`/`Bottom` (src px), `fillCenter`. Duck-type `drawNineSlice` in Renderer; `collectImageSources`; never solid. Fallback color rect if image missing. `DEFAULT_ASSET_COMPONENTS.nineSliceSprite`. No 9-slice paint UI. Tests: NineSliceSpriteBehavior, Renderer, GameEngine.integration.

