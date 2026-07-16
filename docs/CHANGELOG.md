# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **NUM-SCRUB**: Global numeric fields via `src/utils/NumericInput.js` + `styles/numeric-input.css` — no native spinner arrows anywhere (Settings, Grid, Actor Properties, Layers parallax, Details). `createSettingsInput({type:'number'})` / `UIFactory` coerce to scrub text; `NumericInput.wireAll(root)` after render; leftover `type=number` stripped by CSS + wireAll.
