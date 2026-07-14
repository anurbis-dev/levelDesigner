# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Refactor: Фаза 6 (точечный дедуп) — `GitUtils.js` (общий `runGitCommand()` вместо трёх копий spawn-обвязки), `DiamondGridRenderer.js` (общий `drawDiagonalLines()` вместо двух копий 60°/120°), `SettingsSyncManager.js` (`applyColorSettings`/`applySelectionSettings`/`applyStatusBarColors` вынесены из `applySpecialUISettings`/`applyInitialColorSettings`), новый `src/utils/ImageUtils.js` (`getImageDimensions`, использует `AssetImporter`/`AssetViewRenderer`; `getDefaultColor`/`getAssetTypeFromCategory` оставлены раздельными — разные наборы категорий, слияние изменило бы поведение), `LayersPanel.js` (dblclick-обработчик переиспользует `renameLayer()`), `OutlinerPanel.js` (`createOutlinerNameContainer()`/`applyLockedRowState()` общие для `renderGroupNode`/`renderObjectNode`).
- Фаза 7 (долгосрочные guardrails) — новый `CONTRIBUTING.md` (правило: перед новым файлом искать подходящий Controller/Operations-класс), `npm run check:dedup` (`npx jscpd --min-lines 15`), overrides в `scripts/check-file-size.js` сверены с фактическим размером файлов (41 актуальных, stale нет). Рефакторинг из `tmp/2D_Editor_REFACTOR_PLAN.md` завершён (Фазы 0–7).
