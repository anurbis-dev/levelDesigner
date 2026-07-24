# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: light (§7 Tier 4, v4.44.0)**: Component `light` + `LightBehavior` — point / directional / area additive glow after entity draw. Props: `lightType`, `color`, `intensity`, `radius`, `angle`/`spread` (directional), `soft`, `ambient` (max of enabled lights → full-view darken), `enabled`. `Renderer.applyLights` (`lighter` composite); marker body suppressed; never solid. Soft geometry shadows deferred. `DEFAULT_ASSET_COMPONENTS.light`. Tests: LightBehavior, Renderer, GameEngine.integration.
