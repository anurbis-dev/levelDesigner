# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Fix: parallax layers shifting on pure zoom (no pan)**: `ParallaxRenderer.getCameraOffset()` compared raw `camera.x/y` (the viewport's top-left corner) against `parallax.startPosition` — but raw camera.x/y is entangled with zoom itself (`camera.x = centerX - canvasWidth/(2*zoom)`), so just zooming in/out with zero actual panning still shifted every parallax layer. New `ParallaxRenderer.getCameraCenter(camera)` derives the zoom-invariant viewport-center world point; `getCameraOffset` and all 5 "capture start position" call sites (level load, project load, Details panel button, x2 in LevelEditor) now use the center instead of raw camera.x/y. Real panning still shifts layers as before; zooming alone (center-anchored or cursor-anchored near center) no longer does.
