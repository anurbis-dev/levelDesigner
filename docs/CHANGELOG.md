# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: particleEffect (§7 Tier 4, v4.43.0)**: Component `particleEffect` + `ParticleEffectBehavior` — continuous/burst VFX (`emitRate`, `burst`, `maxParticles`, `lifetime`, `speed`/`speedVariance`, `angle`/`spread`, `gravityX`/`gravityY`, size/color/alpha over lifetime). Optional sprite via `imageAssetId`/`src`; fallback colored rects. `drawParticles` duck-type in Renderer (skips entity fill). `collectImageSources` preload. Never solid. Deterministic `seed` (LCG) for tests. `DEFAULT_ASSET_COMPONENTS.particleEffect`. No editor paint UI / catalog preset form this pass. Tests: ParticleEffectBehavior, Renderer, GameEngine.integration.
