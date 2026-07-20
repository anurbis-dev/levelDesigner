# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: camera render layers (v4.26.0)**: runtime-side layer filtering for active game camera. `CameraBehavior` gained new method `getRenderLayers()` returning array of layer ids from `this.properties.renderLayers` (empty/unset → `null`, meaning all layers). `Renderer.renderScene()` gained 4th parameter `renderLayers` (default null) and filters `scene.entities` by `entity.layerId`, skipping entities whose `layerId` is not in the filter (entities without `layerId` always render). `GameEngine` new field `this.cameraRenderLayers` populated in `_updateCamera()` from `behavior.getRenderLayers()` and passed to `renderer.renderScene()` for per-frame filtering. `ComponentPropertySchema` camera component added `renderLayers` field (kind `stringList`, default `[]`) for Details editor form. Tests: all 315 tests pass (CameraBehavior.test.js, Renderer.test.js, GameEngine.integration.test.js updated). Closes §7 Camera asset backlog extension post-release.
