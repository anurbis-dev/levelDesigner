# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: HUD Canvas layout Preview (v4.37.0)**: Canvases dock panel gains a fourth column — static 16:9 layout preview (`src/ui/canvas-hud/CanvasHudPreview.js`) using the same `resolveAnchorStyle` + `.canvas-hud*` CSS as play-mode `CanvasHudRenderer`. Selected widget outlined; click-to-select on preview; live stage of offset/size/text/imgSrc while typing (no history until blur/change). Form split to `CanvasHudForm.js` to stay under the 400-line guardrail. CSS: `.canvas-hud--editor-preview`, `.canvas-hud__widget--selected`, text/progress defaults.

