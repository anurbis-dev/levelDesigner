# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: volume (§7 Tier 4, v4.47.0)**: Component `volume` + `VolumeBehavior` — arbitrary-shape zone (AABB via shape fields, never solid) applies a materialPreset-shaped canvas filter to the full view while the player is inside. Props: `blur`/`brightness`/`saturate`/`hueRotate`/`dropShadow`, optional `presetAssetId` (catalog `materialShaderPreset` merge when component empty), `priority` (higher wins on overlap), `enabled`. Duck-type `getViewFilter`; `Renderer.applyVolumeFilter` screen-space post-pass after lights (`lastVolumeFilter`). `DEFAULT_ASSET_COMPONENTS.volume`. Tests: VolumeBehavior, Renderer, GameEngine.integration.
