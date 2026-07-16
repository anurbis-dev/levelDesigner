# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **DET-LIVE**: Details numeric fields — no spinner arrows; horizontal click-drag scrub or type; live multi-viewport redraw on input (vignette/zoom/aspect/transform). Transform/camera fields refresh live during canvas drag/pan/zoom (`refreshDetailsLive` all instances). `notifyPropertyChange` no longer re-fires `selectedObjects` (was rebuilding panels and breaking live edit).
- **CAM-HIDE**: Game-camera viewport hides the driving camera's own asset (sprite/gizmo/selection/boundary); keeps letterbox, vignette, safe-frame, other frustums.
