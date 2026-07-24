# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: fontTextStyle (§7 Tier 4, v4.46.0)**: Component `fontTextStyle` + `FontTextStyleBehavior` — canvas text in entity box (font family/size/weight/style, align, verticalAlign, outline, shadow, word-wrap). Optional `styleAssetId` merges catalog `fontTextStyle` asset fields when component fields empty. Duck-type `drawText` in Renderer (skips entity fill); never solid. No FontFace / custom .woff preload. `DEFAULT_ASSET_COMPONENTS.fontTextStyle`. Tests: FontTextStyleBehavior, Renderer, GameEngine.integration.
