# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Fix: parallax sprite/selection desync on camera zoom/pan**: `ParallaxRenderer.isParallaxEnabled()`/`getParallaxOffset()` read a standalone `stateManager.view.parallax` key that nothing in the current UI sets anymore — the real Parallax toolbar toggle only flips the per-viewport `displayOptions.parallax` flag. Selection bounds, mouse hit-testing, and duplicate-ghost offsets used the dead global key (effectively always parallax-off), while sprite rendering used the per-view flag — so sprites and selection boxes drifted apart as soon as the camera panned/zoomed with parallax on. Both paths now resolve the same per-view flag + that view's own camera.
