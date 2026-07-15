# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **B0 (Phase B dock):** split-tree engine port in `src/ui/dock/` (`DockTreeModel`, `DockRenderer` with leaf reparent by `node.id`, `DockDragController`, `DockDropOverlay`, `DockManager`); `styles/dock.css`; `index.html` shell `#dock-workspace` + chips; legacy panel DOM in `#dock-legacy-offtree`; `editor.dockManager` wired with placeholders (real panels B2–B3).
- Refactor: Фаза A плана `tmp/2D_Editor_REFACTOR_PLAN_v2.md` (не-UI структурные находки аудита) завершена.
- **A0**: CONTRIBUTING.md — добавлен раздел "Какой базовый класс/паттерн выбрать" с критериями выбора BaseManager/BaseModule/голый constructor/PanelSubController
- **A1**: LevelEditor.js — удалены `findObjectInGroup`/`findObjectInGroupRecursive` (дублирующие обход дерева групп); интеграция с `GroupTraversalUtils.findInObjects`/`findInGroup`; файл сокращён ~1583→1500 строк; добавлен тест tests/LevelEditor.findObject.test.js (характеризационные тесты для A1)
- **A2**: `ensurePlayerStartExists()` логика автосоздания Player Start перенесена из LevelEditor.js в ObjectOperations.js; делегат остался в LevelEditor.js
- **A3**: AssetManager.js — добавлен метод `getAssetById(id)` (null-safe алиас), устраняет краш в AssetItemActionsController
- **A4**: ConfigManager.js — удалён неиспользуемый мёртвый метод `loadDefaultConfigs()` (~106 строк)
- **A5.1**: BaseModule.js — добавлен общий метод `hasActiveMouseOperation()` (заменил дублирующиеся приватные копии в LevelFileOperations/ProjectFileOperations)
- **A5.2**: RenderOperations.js — добавлены приватные хелперы `_getValidCanvasOrNull()` и `_computeExtendedViewportBounds()` (устранено тройное дублирование preamble-проверок)
- **A5.3**: SnapUtils.js — добавлены статические методы `findNearestSnapGridPoint()` и `computeBottomLeftSnapDelta()` (устранено дублирование inline-логики snap-to-grid)
- **A6.1**: BaseGridRenderer.js — Template Method паттерн: `render()` стал конкретным, `drawGrid()` абстрактный; наследники реализуют только `drawGrid()`
- **A6.2**: PerformanceUtils.js — `memoizeWithInvalidation()` переведена на композицию с `memoize()` (устранено дублирование cache-логики)
- **A8**: Документация синхронизирована с кодом: Context_map.md, ARCHITECTURE.md, CHANGELOG.md обновлены на v4.0.0
- Fix: `AssetManager.loadImage()` теперь вызывает `window.editor?.render?.()` после успешного кэширования изображения — устраняет баг, когда объект, отрисованный до завершения асинхронной загрузки картинки, оставался плейсхолдером до случайного следующего render()
