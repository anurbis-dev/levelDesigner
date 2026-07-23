# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: Canvases editor UX (v4.38.0)**: Preview click-drag moves widgets (`offsetX`/`offsetY`, anchor-aware; commit on release). Duplicate widget (form + widgets list). Anchor is a 3×3 icon grid (not dropdown). Form fields are single-row (label|control); numeric fields use `NumericInput` scrub like Details. Split helpers to `CanvasHudFormFields.js`; `duplicateWidget` in model. CSS: `.canvas-hud-anchor-grid`, drag cursors.

