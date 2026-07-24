# Context Map - Level Designer v4.36.0 (Phase A done; Phase B dock B0–B5 done; §7 backlog 12/12 done: camera/pickup/damageHealth/movablePushable/mountableVehicleSeat/pathFollower/spawner/stateMachineBehavior/checkpointSavePoint/climbableLadder/conveyorZiplineJumpPadPortal/variableModifier/destructibleContainer; §7 Tier 1 all 4 done: soundEffect (PlaySound action), pathSpline (smooth Catmull-Rom), aiBehaviorPreset (aiPreset shorthand), materialShaderPreset (materialPreset field + filter string); §7 Tier 2 real assetRegistry (ProjectExporter embeds assets in manifest, ProjectLoader populates assetsById Map from manifest.assets, Scene.assetsById attaches registry per-level, EntityFactory.fromAssetData() spawns prefabs/composites at runtime, SpawnObject action registered); §7 Tier 3 questObjective (QuestRunner tracks concurrent quest state, StartQuest action, objective conditions evaluated via EventGraphRuntime), saveSchema (SaveGame.save/load/clear static methods, SaveGame/LoadGame Event Graph actions); HUD Canvas runtime + authoring UI (CanvasHudRenderer/CanvasHudBinding runtime, CanvasHudModel/CanvasHudPanel editor UI, Level.canvases CRUD helpers, Scene.canvases Map, camera.canvasIds with idMultiSelect field kind), v4.36.0)

## ⚠️ КРИТИЧЕСКИ ВАЖНО - ЧИТАТЬ ПЕРВЫМ

**ПЕРЕД ДОБАВЛЕНИЕМ КОДА:**
1. **Прочитай документацию** - [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md), [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [API_GUIDE.md](./docs/API_GUIDE.md)
2. **Проверь готовые решения** - используй BaseDialog, UIFactory, Logger
3. **Не дублируй код** - следуй архитектуре

**Всегда:** ✅ Logger, stateManager, eventHandlerManager, BaseDialog  
**Никогда:** ❌ console.log, if (!stateManager), прямые addEventListener

**КОМАНДЫ ТЕРМИНАЛА:** ❌ НЕ запускай серверы (`python -m http.server`, `npx serve`, `start_Editor.bat`/`start_Editor.vbs`) - они всегда запущены. Для git команд добавляй `| cat`.

## 🎯 Быстрый старт для агента

### Основные компоненты (v4.0.2 Phase B dock closed B0–B5; Phase A Refactor done)
- **LevelEditor** — координатор; multi-level sessions; `project`; controllers Config/Lifecycle/Preferences; **`viewportViewManager`** (multi-viewport B4.2); **`dockManager`** (единственный layout; B5 удалил `PanelPositionManager`)
- **Dock (Phase B)**: `src/ui/dock/` — `DockManager`, `DockTreeModel`, `DockRenderer`, `DockDragController`, `DockContentRegistry`, `DockPanelFactory`, `DockTypeMenu`, `ViewportLeafChrome`, `DockFloatWorkspace`, `DockPersistence` (`panels.dock.mainTree` + `panels.dock.floatingWindows`). ContentTypes: viewport/outliner/details/layers/assets/levels + **asset editor** (`role=assetEditor`): Sprite component owns image; Preview draws all collider frames (not crop); live Details→Preview; F/A. Multi-instance copies; nested binary splits (row/column). View menu = per-contentType, не Left/Right panel. **Assets copies**: UI-independent (`AssetPanel.uiStateKey` → `panelUI.<instanceKey>.*` for selection/tabs/filters); **D1** persist per copy under `ui.assetCopyUiState[instanceKey]` (tabs/size/viewMode/foldersWidth); primary still uses global prefs; catalog + canvas drop shared. **Outliner copies**: search + type filters independent (D2); selection/collapsed shared
- **Asset Editor**: `src/ui/asset-editor/*` + `constants/ComponentPropertySchema.js` — open via `showActorPropertiesPanel(asset)`; `editingAssetId` / `editingComponentId`; live `updateAsset`; **Image**=disk `imgSrc`, **Sprite**=`imageAssetId`→Image; collider shapes freeform edit; preview overlays. Layout: `panels.dock.assetEditorLayout` (rel pos/size + tree) survives close
- **ViewportViewManager** + **ViewportViewNav** — N viewport leaves (work/game camera, per-view type filters, shared MouseHandlers, pointer-capture, gesture UI lock `viewport-gesture-mode`); game source adaptive fit via `CameraAspectUtils` (C4)
- **TypeFilterMenu** — shared type filter UX (Outliner / Assets / Viewport chrome)
- **Контроллеры инициализации**: EditorConfigController, EditorLifecycleController, EditorPreferencesController
- **Менеджеры**: StateManager, ConfigManager, HistoryManager, EventHandlerManager, GlobalEventRegistry, LevelsManager, MenuManager, …
- **Core ops**: ObjectOperations, LayerOperations, HistoryOperations, DuplicateOperations, GroupOperations, RenderOperations (multi-level + multi-viewport cull), ViewportOperations, LevelFileOperations, ProjectFileOperations
- **UI**: Asset/Details/Layers/Levels/Outliner/Settings panels; BaseDialog, SplashScreen, ProjectSettingsDialog
- **UI text rule**: tooltips, menus, parameters in the editor UI are **English** (agent/docs may stay Russian)

### Ключевые API (Phase 7 Project: контейнер многоуровневого проекта)
```javascript
// LevelEditor файловые операции (v3.57.0 Phase 5 multi-level)
// Все методы работают с LevelSession (вкладка уровня), а не с единым глобальным уровнем
// Несколько уровней открыты одновременно, переключаются через LevelsPanel или меню
levelEditor.newLevel() // добавляет вкладку, переключает на новую (не заменяет текущую)
levelEditor.openLevel() // добавляет вкладку из файла, dedup по fileName (не дублирует уже открытые)
levelEditor.saveLevel() // сохраняет текущий уровень, использует per-session fileName; при отсутствии имени показывает prompt "Enter file name:" (не сохраняет под дефолтом без спроса)
levelEditor.saveLevelAs() // сохраняет с выбором имени (показывает prompt), обновляет per-session fileName для текущей сессии
levelEditor.closeLevel(levelId) // закрывает вкладку (нельзя закрыть последний открытый уровень, спрашивает подтверждение при dirty); доступен через крестик на вкладке и контекстное меню уровня (не в меню File)
levelEditor.levelsManager.setCurrentLevel(levelId) // переключение между открытыми уровнями (вкладками), сохраняет/восстанавливает view state, history; отслеживает levelMRU для fallback
levelEditor.nextLevel() / levelEditor.previousLevel() // новые хоткеи (Ctrl+PageDown/PageUp Phase 6) для циклического переключения между открытыми уровнями через levelsManager.cycleLevel(±1)
levelEditor.levelsManager.cycleLevel(direction) // циклическое переключение: direction=+1 (следующий), -1 (предыдущий), обрывается если открыт единственный уровень
levelEditor.levelsManager.toggleLevelVisibility(levelId) // переключение видимости уровня (eye-icon в LevelsPanel)
levelEditor.levelsManager.toggleLevelSolo(levelId) // Ctrl+click на eye-icon уровня, эксклюзивный solo (зеркалит LayersPanel.toggleLayerSolo), сбрасывает solo у остальных; getVisibleSessions() если есть soloed-уровни возвращает только их
levelEditor.levelsManager.getVisibleSessionsForRender() // сессии видимых уровней в порядке рендера (текущий уровень ВСЕГДА в конце, рисуется поверх остальных, независимо от позиции таба) — Phase 6 решение, видимо с Phase 3
levelEditor.levelsManager.reorderLevels(newOrder) // переупорядочивание открытых уровней (табы), newOrder — полная перестановка id; Phase 6 drag-reorder в LevelsPanel

// LevelEditor Project-операции (v3.57.0 Phase 7)
// Проект = контейнер набора открытых уровней (LevelSession), самодостаточный JSON с embedded Level.toJSON() каждого уровня + видимость/порядок/currentLevelIndex
levelEditor.newProject() // создание нового проекта: очищает все открытые уровни, создаёт один пустой с seeded history baseline; единый confirm при несохранённых правках вместо N диалогов
levelEditor.openProject() // открытие проекта из файла: парсит все уровни из project-JSON, заменяет весь набор открытых вкладок (Edge Case 11); unit confirm при dirty
levelEditor.saveProject() // сохранение текущего проекта; при отсутствии project.fileName берёт имя из project.name через _deriveFileNameFromProjectName() (заменяет /, \ на -), не спрашивает имя файла; требует предварительного newProject()/openProject()
levelEditor.saveProjectAs() // сохранение проекта с выбором имени файла (показывает prompt)
levelEditor.openRecentFile(id) // U3: открыть level/project из MRU-кэша (editor.recentFiles)
levelEditor.clearRecentFiles() // U3: очистить Open Recent
levelEditor.recentFilesManager // RecentFilesManager: list/remember/open/clear; snapshot JSON в userPrefs
levelEditor.moveSelectedObjectsToLayerId(layerId) // U4: перенос selection на слой (context menu)
levelEditor.buildMoveToLayerMenuItems() // U4: пункты flyout Move to Layer
levelEditor.openProjectSettings() // открытие ProjectSettingsDialog; пока стаб (редактируется только project.name)
levelEditor.project // текущий Project экземпляр (инициализируется при New/Open/Save Project); null до первого вызова
levelEditor.projectFileOperations // BaseModule: newProject/openProject/openProjectFromData/saveProject/saveProjectAs

// LevelEditor основное
levelEditor.createObject(type, x, y, properties)
levelEditor.selectObject(id)
levelEditor.getCachedObject(id)
levelEditor.showSplashScreen() // v3.54.1
levelEditor.createAssetOfType(typeId) // создание placeholder-ассета по типу в текущей выбранной папке (Add меню → category → Type)

// MenuManager disabled states и margin-aware dropdown (v3.55.0+)
// Любой пункт меню (itemConfig в config/menu.js) может иметь `disabled: boolean | (editor) => boolean`
// MenuManager.refreshDisabledStates() пересчитывает состояние, вызывается при init, refresh(), и реактивно на stateManager
// Отвечает за визуальное отключение (CSS-классы opacity-50/pointer-events-none) и блокировку клика
// setupDropdownCursorMarginWatcher() — новый persistent mousemove-листенер для top-level dropdown (раньше mouseleave без margin), закрывает dropdown при выходе курсора за пределы margin (ui.cursorMenuMargin), включая открытые flyout-submenu

// BaseContextMenu (v3.55.0+): единая разметка пунктов, disabled-схема, flyout-submenu
// Все 6 наследников (AssetContextMenu, AssetPanelContextMenu, CanvasContextMenu, ConsoleContextMenu, LayersContextMenu, OutlinerContextMenu) получили единый визуальный шаблон:
// - createMenuItem()/createSubmenuItem() используют MenuItemTemplateUtils (три экспорта: renderMenuItemLeadingHtml, renderMenuItemBodyHtml, renderMenuItemTrailingHtml) для одиночного источника правды разметки пункта [leading | body | trailing]
// - item rows: 'base-context-menu-item px-4 py-2 text-sm hover:bg-gray-700' (идентично MenuManager); separators: 'border-t border-gray-600 my-1'; submenu-триггеры с явным ▸-гліфом
// - применяют полный disabled-scheme (opacity-50/pointer-events-none/cursor-not-allowed, как MenuManager)
// - contextMenu.addSubmenuItem(text, icon, items, options) — flyout подменю (раскрывается hover), в т.ч. вложенные уровни
// - items может быть Array или Function (re-resolve на каждый open) — U4 Move to Layer list
// - фикс клиппинга: .submenu-flyout--scrollable применяется ТОЛЬКО к самому глубокому подменю в цепочке
// - item.shortcut в trailing-слоте (Canvas/Outliner: PageUp/PageDown для Move Layer Up/Down)

// MenuPositioningUtils (v3.55.0+): унифицированный cursor margin для всех меню (v3.55.0)
// getCursorMenuMargin() — читает ui.cursorMenuMargin из StateManager (дефолт 2px, диапазон 0-60)
// setupMenuClosing(menu, triggerElement) — persistent document mousemove-листенер на ВСЮ жизнь меню (раньше только opening-анимация)
// repositionMenu(menu, triggerElement, options) — пересчитывает позицию по реальным размерам после добавления пунктов (синхронно, без видимого прыжка)
// Применяется: BaseContextMenu (было и раньше), OutlinerPanel/AssetPanel (меню фильтров), MenuManager (top-level dropdown через новый setupDropdownCursorMarginWatcher)

// Dock layout (Phase B, editor.dockManager) — binary split-tree + floating windows
// contentTypes: viewport | outliner | details | layers | assets | levels
levelEditor.dockManager.init() // restore panels.dock.mainTree + floatingWindows, mount leaves
levelEditor.dockManager.showContentType(type, opts?) // reopen closed panel (floating if main non-empty)
levelEditor.dockManager.hideContentType(type) // remove leaf; content parks in pool
levelEditor.dockManager.toggleContentType(type) // → boolean present after toggle
levelEditor.dockManager.hasContentType(type) // leaf in main or floating
levelEditor.dockManager.getLayoutSnapshot() // { mainTree, floatingWindows }
levelEditor.dockManager.resetLayout() // default tree + save
levelEditor.dockManager.enterImmersiveLayout() / exitImmersiveLayout() // Game Mode viewport-only
// Nested splits: DockTreeModel binary tree (direction row|column, ratio); Shift = layout customize
// Persist: panels.dock.mainTree, panels.dock.floatingWindows (stale: tabPositions, L/R tabOrder/splits/widths)
// Multi-instance: DockPanelFactory self-drop clone; multi-viewport via ViewportViewManager

// AssetTypes / ComponentTypes (каталоги типов)
import { getAssetTypeById, getAssetTypesByCategory, ASSET_CATEGORIES, DEFAULT_ASSET_COMPONENTS } from 'src/constants/AssetTypes.js' // 29 типов ассетов: Camera (follow-target/deadzone/bounds, реализован), Actor, Image, Player Start (auto-managed spawn marker, со своим компонентом), Tilemap, Sound, Dialogue, Quest, Prefab и т.д.; DEFAULT_ASSET_COMPONENTS = {player_start: ['playerStart'], camera: ['camera']} автоматически прикрепляет компонент при создании placeholder
import { getComponentTypeById, createComponentStub } from 'src/constants/ComponentTypes.js' // 20 типов компонентов: Collider, Trigger, Interactable, PathFollower, Spawner, Camera (follow-target/deadzone/bounds) и т.д.
import { buildTypeIconSvg } from 'src/constants/AssetTypeIcons.js' // type-specific SVG icons (24×24 stroke glyphs, inline, растеризуются как data-URI Image в CanvasRenderer для canvas-рендера и AssetPanel для preview)
assetManager.createPlaceholderAsset(typeId, customName?, folderPath?) // создать заполнитель ассета (без imgSrc, используются опциональные typeDef.width/height/color если заданы, иначе 48×48 + цвет категории, отображается с type-иконкой в AssetPanel и на canvas); автоматически создаёт и прикрепляет компоненты из DEFAULT_ASSET_COMPONENTS[typeId] (сейчас только player_start → playerStart)
asset.components // массив component stubs [{id, type, enabled, properties}], наследуется при размещении GameObject
gameObject.components // component stubs in toJSON(); asset-side edit in asset editor float (assetComponents panel), not modal

// CanvasRenderer — рендеринг объектов на canvas (src/ui/CanvasRenderer.js)
canvasRenderer.drawSingleObject(obj, x, y) // рендер single объекта с rotation-поддержкой; если нет изображения (obj.imgSrc не загружен), рисует цветной fallback-прямоугольник + type-иконку (если type из каталога)
canvasRenderer.getTypeIconImage(typeId) // растеризует buildTypeIconSvg() в data-URI Image, кэширует по ${typeId}|${цвет}, триггерит render() при онлоаде иконки
canvasRenderer.typeIconCache // Map кэш type-иконок, чистится в destroy() вместе с imageCache

// BaseModule (v4.0.0 Phase A: новый общий метод)
baseModule.hasActiveMouseOperation() // проверка активной операции мыши (объединённый хелпер для LevelFileOperations/ProjectFileOperations/других BaseModule-классов, заменил дублирующиеся _hasActiveMouseOperation() приватные копии)

// SnapUtils (v4.0.0 Phase A: новые статические методы)
SnapUtils.findNearestSnapGridPoint(anchorX, anchorY, stateManager, level, userPrefs) // поиск ближайшей точки сетки snap (используется в DuplicateOperations.confirmPlacement и MouseHandlers.dragSelectedObjects)
SnapUtils.computeBottomLeftSnapDelta(gridPoint, referenceObject, objectOperations) // вычисление дельты смещения для bottom-left snapping

// StateManager
stateManager.get(key)
stateManager.set(key, value)
stateManager.subscribe(key, callback)

// ConfigManager
configManager.get(path)
configManager.set(path, value)
configManager.loadAllConfigs()
configManager.getDefault(path) // истинный дефолт (из getDefaultConfigs(), кэш), не текущее значение — для Backspace-to-reset

// EventHandlerManager (v3.58.0+: paint drag через mousedown/mouseover/mouseup делегирование)
eventHandlerManager.registerElement(element, handlers, elementId)
eventHandlerManager.registerTouchElement(element, configType, config, elementId)
// registerContainer config поддерживает event-delegation для config.click / config.contextmenu / config.dragstart и новые (v3.58.0):
// config.mousedown / config.mouseup / config.mouseover — паттерн идентичен click/dragstart
// Используется для paint-drag иконок: .layer-visibility-btn / .layer-lock-btn (LayersPanel), 
// .level-visibility-btn (LevelsPanel), mousedown → _startIconPaintDrag, mouseover → _paint*(), mouseup → _endIconPaintDrag

// GlobalEventRegistry
globalEventRegistry.registerComponentHandlers(componentId, handlers, target)

// Реактивные обновления панелей на структурные изменения уровня (v3.55.0)
stateManager.subscribe('levelStructureChanged', (changes) => {...}) // событие при add/remove объектов/слоёв
levelEditor.level.setStructureChangeCallback(callback) // регистрация callback для структурных изменений
levelEditor.level.removeObjects(ids) // батчевое удаление объектов (одно уведомление вместо многих)

// Copy/Paste/Duplicate (Ctrl+C/X/V, Shift+D, interactive mouse-follow placement)
levelEditor.copySelectedObjects() // Ctrl+C, сохраняет deep-clone выделения в levelEditor.clipboard
levelEditor.cutSelectedObjects() // Ctrl+X, копирует и удаляет
levelEditor.pasteObjects() // Ctrl+V, вставляет из clipboard (интерактивный flow, как Shift+D); no-op если курсор не над канвой
levelEditor.duplicateSelectedObjects() // Shift+D
levelEditor.duplicateOperations.startFromObjects(selected) // общий flow для Paste и Duplicate: объекты размещаются под курсором (если mouse.isOverCanvas) или в центре канвы; несколько объектов центрируются по union bounding-box (anchorCenter); interactive mouse-follow ghost до клика подтверждения

// Z-порядок объектов (array-order stacking, без zIndex)
levelEditor.level.compareStackOrder(a, b) // компаратор: layerIndex, затем путь в дереве
levelEditor.objectOperations.bringToFront(obj)
levelEditor.objectOperations.sendToBack(obj)
levelEditor.objectOperations.moveForward(obj)
levelEditor.objectOperations.moveBackward(obj)

// Backspace-to-reset (hover-based, Blender-style) — см. src/utils/ResetRegistry.js
ResetRegistry.setFields(scopeKey, fields) // fields = [{element, defaultValue}], панель регистрирует на каждый render()
ResetRegistry.handleBackspace() // точка входа из EventHandlers.handleKeyDown, наведение мышью (:hover), не фокус; false также если под курсором+в фокусе нерегистрированный текстовый input/textarea (напр. поиск в шапке SettingsPanel)
detailsPanel.registerResettable(element, defaultValue) // Transform (x/y/width/height/rotation) и Color
settingsPanel.rebuildResetRegistry() // сканирует [data-setting], вызывается в конце setupSettingsInputs()

// Цикл выбора перекрывающихся объектов по кликам (Blender-style)
objectOperations.findObjectAtPoint(x, y, skipCycle = false) // по умолчанию циклит совпадения в точке; skipCycle=true (двойной клик) — старое поведение, всегда передний объект
objectOperations._pickWithClickCycle(x, y, sortedCandidates) // внутренний, цикл по повторным кликам в той же точке (tolerance ~4 экранных px)
objectOperations._pickFrontMost(x, y, sortedCandidates) // внутренний, нецикличный front-to-back pick

// Isolate / Layer Solo / Object Solo (non-destructive временное сужение видимой сцены)
objectOperations.toggleIsolateSelection() // хоткей `/`, top-level-гранулярность, state в stateManager.get('view.isolatedTopLevelIds')
layersPanel.toggleLayerSolo(layerId) // Ctrl+click иконки глаза слоя, эксклюзивный solo, Layer.soloed (transient, не сериализуется)
objectOperations.toggleObjectSolo(obj) // Ctrl+click иконки глаза объекта в Outliner, full-hide (не dim), эксклюзивный, state в stateManager.get('view.soloedTopLevelObjectId')
objectOperations.findTopLevelAncestor(obj) // общий хелпер toggleIsolateSelection/toggleObjectSolo, поднимается через groupOperations._findParentGroup()

// Видимость объектов (H / Alt+H / Outliner eye icon)
objectOperations.toggleObjectVisibility(obj) // общая точка переключения obj.visible, каскад на детей для групп
objectOperations.toggleVisibilityForSelection() // хоткей H
objectOperations.unhideAllObjects() // хоткей Alt+H

// Единый источник хоткеев в главном меню
ShortcutFormatter.format(shortcut) // src/utils/ShortcutFormatter.js — {key,ctrlKey,altKey,shiftKey,metaKey} → "Ctrl+Alt+N"
menuManager.refreshShortcutLabels() // перечитывает [data-shortcut-key] в DOM меню после ребинда хоткея

// Параллакс множители уровня (независимо по осям, на основе смещения камеры)
level.settings.parallaxHorizontal // множитель горизонтального параллакса (дефолт 1, сохраняется в JSON)
level.settings.parallaxVertical // множитель вертикального параллакса (дефолт 1, сохраняется в JSON)
// ParallaxRenderer.getCameraOffset() — cameraDelta × level multipliers (H/V);
// getParallaxOffset(layer) — shift = cameraOffset × layer.parallaxOffset
// (scroll factor = 1 + offset; NOT ×(1+offset) as shift — that doubled motion)
```

## 📁 Основные файлы (Phase 7 Project завершена)

### Core
- `src/core/LevelEditor.js` - главный класс, `this.level` = computed getter/setter через `levelSessions` + `currentLevelId` (v3.57.0 Phase 1+)
- `src/core/LevelsManager.js` - управление множеством открытых LevelSession: addLevel, setCurrentLevel, closeLevel (Phase 1, 3, 5); cycleLevel, getVisibleSessionsForRender, reorderLevels, levelMRU fallback, soft-cap warning (Phase 6)
- `src/ui/dock/DockManager.js` - facade layout (`editor.dockManager`): init/destroy, show/hide/toggle contentType, immersive, snapshot
  - `DockTreeModel.js` - pure binary split-tree + floatingWindows model
  - `DockRenderer.js` / `DockDragController.js` - DOM reconciliation + Shift-drag layout
  - `DockContentRegistry.js` / `DockPanelFactory.js` - mount primary roots + multi-instance copies
  - `DockPersistence.js` - `panels.dock.mainTree` + `panels.dock.floatingWindows`
  - `DockFloatWorkspace.js` / `ViewportLeafChrome.js` / `DockTypeMenu.js` / `DockConstants.js`
- `src/models/LevelSession.js` - editor-only обёртка над Level (visible, fileName, isDirty, viewState, history per-session) — Phase 1
- `src/core/LevelFileOperations.js` - файловые операции уровня (Phase 5: newLevel/openLevel добавляют вкладки, saveLevel/saveLevelAs работают per-session, closeLevel закрывает вкладку)
- `src/models/Project.js` - модель проекта (Phase 7): `toJSON(levelSessions, levelOrder, currentLevelId)` эмбеддит Level.toJSON() каждого уровня + видимость/порядок/currentLevelIndex; статический `fromJSON(json)` парсит проект-файл
- `src/models/ProjectExporter.js` - трансформер editor-Project в runtime-Project манифест (engine plan Фаза 0); статический `export(levelSessions, levelOrder, project, opts)` возвращает `{formatVersion, name, entryLevelId, levels: [{id, data}], assets: [...]}` — если `opts.assetManager` передан, embedдит `assetManager.getAllAssets().map(asset => asset.toJSON())` как `assets[]`, иначе `assets: []` (полностью обратно совместимо)
- `src/core/ProjectFileOperations.js` - файловые операции проекта (Phase 7, BaseModule): `newProject()`/`openProject()`/`openProjectFromData()`/`saveProject()`/`saveProjectAs()`, replace-not-merge; MRU remember
- `src/managers/RecentFilesManager.js` - U3 Open Recent: MRU level/project snapshots в `editor.recentFiles`
- `src/core/ObjectOperations.js` - операции с объектами
- `src/core/LayerOperations.js` - операции со слоями
- `src/core/RenderOperations.js` - рендеринг (multi-level compositing + multi-viewport: per-canvas frustum/cache, sticky interactive cull)
- `src/core/PlayOperations.js` - Play-in-editor (Фаза 3 движка: `play()`/`stop()`/`toggle()`/`isPlaying()`)
- `src/core/ViewportViewManager.js` - registry of viewport leaves (camera source, pose, type filters)
- `src/core/ViewportViewNav.js` - secondary canvas MouseHandlers bind + pointer-capture
- `src/event-system/MouseHandlers.js` - мышь: rotate/scale; multi-view interaction pin (`getInteractionView|Camera|Canvas`); outside-leaf complete; viewport-gesture-mode
- `src/constants/EditorConstants.js` - константы, включая `TRANSFORM` (rotate/scale жесты)
- `src/utils/WorldPositionUtils.js` - мировые координаты, rotation-aware bounds (`getRotatedRectAABB`, `rotateBoundsAroundCenter`)
- `src/utils/GroupTraversalUtils.js` - обход иерархии групп, включая `findObjectPath()` (путь индексов для z-порядка)
- `src/models/Level.js` - модель уровня, `compareStackOrder()` — единый компаратор z-порядка (без `zIndex`, объекты не хранят его); level-scope `eventGraph`/`dialogues`/`items`/`inventory`/`npcInventories` (LOGIC_SYSTEMS + Items dock; runtime `Scene.js`)
- `src/models/Layer.js` - модель слоя, включая transient `soloed` (Layer Solo, не сериализуется)
- `src/event-system/EventHandlers.js` - клавиатурные хоткеи (`handleKeyDown`), Alt+1/2/4 → dock outliner/details/assets (legacy left/right/assets keys), F2 (`renameSelectedObject`); `syncDockPanelMenuCheckboxes`

### Managers
- `src/managers/StateManager.js` - состояние
- `src/managers/ConfigManager.js` - конфигурация
- `src/managers/HistoryManager.js` - undo/redo, `exportState()`/`importState()` для per-level history
- `src/managers/EventHandlerManager.js` - события
- `src/event-system/GlobalEventRegistry.js` - глобальные события
- `src/managers/MenuManager.js` - главное меню, `shortcutKey` labels; dynamic submenu `rebuildRecentFilesSubmenu` (Open Recent)
- `src/managers/AssetManager.js` - управление библиотекой ассетов (сканирование, кэширование), placeholder-создание по каталогу типов через `createPlaceholderAsset(typeId)` с опциональными компонентами
- `src/core/LevelsManager.js` - управление открытыми уровнями (LevelSession)

### Constants & Catalogs
- `src/constants/AssetTypes.js` - каталог 29 типов ассетов (Camera, Actor, Image, Player Start, Tilemap и т.д.) в 6 категориях; `DEFAULT_ASSET_COMPONENTS` для auto-attach компонентов; `getAssetTypeById()`, `getAssetCategoriesWithTypes()`
- `src/constants/ComponentTypes.js` - каталог 20 типов компонентов (Collider, Trigger, Interactable, PlayerStart, Camera и т.д.); `createComponentStub()`
- `src/constants/AssetTypeIcons.js` - минималистичные SVG-иконки (24×24 px) для каждого типа; `buildTypeIconSvg()`

### UI
- `src/ui/dock/` - Phase B dock shell (tree, render, drag, content registry, panel factory, type menu, viewport chrome)
- `src/ui/dock/ViewportLeafChrome.js` - viewport leaf header: Work/Game camera menu + type filter (English UI; hover-switch menus)
- `src/utils/TypeFilterMenu.js` - shared type-filter dropdown
- `src/ui/BaseDialog.js` - базовый диалог
- `src/ui/SplashScreenDialog.js` - splash screen диалог
- `src/ui/ProjectSettingsDialog.js` - диалог настроек проекта (Phase 7, extends BaseDialog, пока стаб: редактируется только `project.name`)
- `src/ui/LevelsPanel.js` - панель списка открытых уровней (Phase 2 multi-level: визуализация вкладок; Phase 5: полный workflow с Close/Save в контекстном меню, per-session dirty-индикатор; Phase 6: drag-reorder, дизамбигуация имён при коллизии; v3.58.0: paint drag на eye-icon — mousedown + drag по иконкам применяет взятое значение ко всем пройденным, temp-отключение draggable для строки на время драга)
- `src/ui/LevelsContextMenu.js` - контекстное меню для уровней (Make Current, Rename)
- `src/ui/panel-structures/LevelsPanelStructure.js` - DOM-структура и рендер LevelsPanel
- `src/ui/AssetPanel.js` - панель ассетов (Фаза 4 завершена: 3099→1154 строк; orchestration-слой, 7 контроллеров извлечены); держит viewRenderer, folderController, filterController, selectionController, dragDropController, itemActionsController, toolbarController; методы init, destroy, setupEventListeners, handleAssetWheel, handleDrop, handleAssetSave, showSaveSuccessMessage, autoResizePanelHeight
- `src/ui/AssetViewRenderer.js` - рендеринг grid/list/details превью ассетов (614 строк, Фаза 4.2); методы `render()`, `renderTabs()`, `renderPreviews()`, `renderGridView()`, `renderListView()`, `renderDetailsView()`, `createAssetThumbnail()`, `createAssetListItem()`, `createAssetDetailsRow()`, `isValidImageSrc()`, `createColorFallback()`, `getTypeIconMarkup()`, `updateGridViewSizes()`, `getImageDimensions()`, `getAssetTypeFromCategory()`, `getDefaultColor()`
- `src/ui/AssetFoldersController.js` - навигация по папкам (Фаза 4.1); управление табами папок, переключение активной папки, синхронизация с FoldersPanel
- `src/ui/AssetFilterController.js` - фильтрация и поиск (Фаза 4.3); поиск ассетов по имени, фильтр по типу, управление видимостью строк фильтра
- `src/ui/AssetSelectionController.js` - выделение ассетов (Фаза 4.4); multi-select через Shift+Ctrl+клик, select-all/deselect-all, обновление визуалов выделения
- `src/ui/AssetDragDropController.js` - перетаскивание и импорт (Фаза 4.5); drag-out ассетов на canvas, external PNG file drop overlay, создание ассетов из файлов
- `src/ui/AssetItemActionsController.js` - действия с ассетами (Фаза 4.6); контекстные меню (AssetContextMenu, AssetPanelContextMenu), клики по ассетам, open/show-in-explorer, rename
- `src/ui/AssetToolbarController.js` - управление тулбаром (Фаза 4.7); размер превью (zoom), режимы просмотра (grid/list/details), персистентность; `handleSettings()` → `openSettings('assets')`
- `src/ui/LayersPanel.js` - панель слоев, включая Layer Solo (`toggleLayerSolo`), paint drag на eye/lock-иконках (v3.58.0: mousedown + drag по иконкам того же типа применяет взятое значение, батчевый tail в `_endIconPaintDrag()` инвалидирует кэши и ре-рендерит)
- `src/ui/OutlinerPanel.js` - иерархия объектов, включая eye-icon видимости (`createVisibilityButton`), Object Solo (Ctrl+click на глаз), paint drag на eye-icon (v3.58.0: mousedown + drag по глазам других объектов применяет взятое значение, per-node listeners без EventHandlerManager-делегирования), Ctrl+click мульти-select в фильтре типов (`showFilterMenu` → `MenuPositioningUtils.repositionMenu()` после добавления пунктов для совпадения с кнопкой), и F2 inline-rename (`startInlineRename`)
- `src/ui/DetailsPanel.js` - свойства выделенных объектов (Transform, Visual, Advanced, Custom Properties), плюс Camera-секция для объектов типа `'camera'` с полем Zoom (`renderCameraObjectProperties()`); уровень-широкие параметры когда ничего не выбрано (Stats, Camera с множителями Parallax H/V); новый `createDualFieldRow(label, fields)` для однострочных пар контролов; методы `renderLevelStatistics()`, `renderLevelActions()`, `setupParallaxMultiplierInputs(level)`
- `src/ui/SettingsPanel.js` - настройки редактора; единый поиск параметров в шапке окна (`#settings-search-input`, `filterSettingsContent()`, скрытие/показ строк через `setRowVisible()` с кэшем исходного `style.display` в `dataset.searchOrigDisplay`), секции строятся через `createSettingsSection` (`src/ui/panel-structures/SettingsSectionConstructor.js`, поиска в шапке секции больше нет); range-слайдеры (без видимого thumb, значение поверх трека, цветная заливка трека до текущего значения через `--range-fill`, dblclick → ручной ввод) рендерятся через `createSettingsRange` → `createSettingsRow` (компактная однострочная раскладка), оживляются через `setupRangeSliders()` с обновлением заливки на каждый `input` (метод `updateSliderDisplay()` удалён); чекбокс `#settings-auto-apply` в футере (`SettingsPanel.autoApply`, persisted `localStorage['levelEditor_settingsAutoApply']`, дефолт `true`) — вкл: live-apply на каждый инпут, кнопки Cancel/Apply Changes задизейблены (`updateAutoApplyUI()`); выкл: live-apply отключён, `cancelSettings()` откатывает через `restoreOriginalValues()` (снимок всех ключей из `syncManager.getAllMappings()` + `logger.colors`, см. `storeOriginalValues()`)
- `src/ui/dialogues/DialoguesPanel.js` - dock panel для уровня-широкого каталога диалогов (3-column list/list/form layout, как ItemsPanel); операции CRUD через HistoryManager `setDialoguesProvider()`
- `src/ui/dialogues/DialogueModel.js` - чистые helper-функции для операций с диалогами
- `src/ui/items/ItemsPanel.js` - dock panel для уровня-широкого каталога предметов (3-column list/list/form layout); операции CRUD через HistoryManager `setInventoryProvider()`
- `src/ui/items/ItemModel.js` - чистые helper-функции для операций с предметами
- `src/ui/canvas-hud/CanvasHudPanel.js` - dock panel HUD Canvases (canvases | widgets | form | **Preview**); add canvas/widget UI only; Delete/Shift+D via `deleteSelection`/`duplicateSelection` (EventHandlers routes when panel under cursor); `canvasesRevision`; live preview stage; preview drag commit (`_commitWidgetOffset`)
- `src/ui/canvas-hud/CanvasHudPreview.js` - 16:9 layout preview + click-select + pointer-drag move (`screenDeltaToOffsetDelta`, anchor-aware); те же anchor math + `.canvas-hud*` CSS, что play-mode
- `src/ui/canvas-hud/CanvasHudForm.js` - canvas meta + widget form (inline rows, scrub numbers, anchor grid, binding/action); image = `imageAssetId` via AssetRefControl (no disk path)
- `src/ui/canvas-hud/CanvasHudFormFields.js` - `inlineRow`, `scrubNumberInput`/`numberPairRow` (NumericInput scrub), `anchorIconPicker` 3×3
- `src/ui/AssetRefControl.js` - shared catalog asset ref select + drop from Assets panel (`createAssetRefControl`, `wireAssetDropTarget`); used by Canvases image + Asset Editor `assetRef` fields
- `src/ui/canvas-hud/CanvasHudModel.js` - CRUD + `duplicateWidget()`; Event Graph name scan; `WIDGET_TYPES`/`ANCHOR_OPTIONS`/`BINDING_SOURCE_OPTIONS`; image widgets store `imageAssetId`

### Utils
- `src/utils/Logger.js` - логирование (19 категорий)
- `src/utils/UIFactory.js` - создание UI элементов; `createLabeledInput(options)` теперь использует однострочный flex-лейаут (label flex 0 0 40% справа + input flex 1) вместо стека, применяется к DetailsPanel Basic Properties (Name/Type) и Visual (Color)
- `src/utils/ValidationUtils.js` - валидация
- `src/utils/ResetRegistry.js` - Backspace-to-reset (hover-based), singleton `ResetRegistry`, вызывается из `EventHandlers.handleKeyDown`
- `src/utils/ShortcutFormatter.js` - `ShortcutFormatter.format(shortcut)` — единый формат хоткея (`"Ctrl+Alt+N"`), используется `MenuManager` и `SettingsPanel.formatShortcut()`

### Docs — Engine Runtime (engine plan Фаза 0–1)
- `docs/RUNTIME_SCHEMA.md` - контракт runtime-схемы: per-type `schemaVersion`/`properties` для 29 asset-типов и 19 component-типов, плюс раздел `## Versioning` про `Level.meta.version` (semver уровня, отдельная ось от `LevelEditor.VERSION`)
- `docs/CONTENT_MODEL.md` - три типа контент-паков движка: Project (база+патчи), Addon (overrides/additions), Special Event (без overrides); различие editor-Project (табы редактора) от runtime-Project (релиз), роль `ProjectExporter`
- **Фаза 1 MVP-ядро** (`src/engine/` самодостаточен, ноль импортов из `src/constants|core|managers|models|ui|utils|widgets`):
  - `src/engine/Entity.js` - тонкий runtime-класс (id/name/type/x/y/width/height/color/rotation/imgSrc/materialPreset/visible/layerId/properties/components/children)
  - `src/engine/EntityFactory.js` - `fromGameObjectData(data)` → Entity, рекурсивно для children; новый `fromAssetData(assetData, placement, assetsById)` — engine-native спавн префабов/композитов из `Asset.toJSON()` (без editor-import), поддержка composite asset sprite-image разрешения через `assetsById` Map
  - `src/engine/Scene.js` - уровень рантайма (entities, layers, settings, camera, assetsById Map, quests Map, dialogues Map, questRunner, dialogueRunner, dialogueActive), методы `getLayersSorted/getLayerById/getVisibleLayerIds()`
  - `src/engine/ProjectLoader.js` - `load(manifest, opts)` → {levelsById, entryLevelId, assetsById: Map<id, assetData>, eventsById: Map()}; assetsById построена из `manifest.assets[]` (keyed by asset id, заполняется ProjectExporter if provided, иначе пусто); `loadLevel(levelId, registries)` → Scene с attachedным `scene.assetsById = registries.assetsById`
  - `src/engine/render/ParallaxController.js` - чистые функции `getCameraOffset/getParallaxOffset` (портированы 1:1 из ParallaxRenderer)
  - `src/engine/render/Renderer.js` - Canvas 2D рендер (setCamera/restoreCamera/clear/drawBackground/drawEntity/renderScene), порт CanvasRenderer без editor-флагов; `renderScene(scene, camera, parallaxStartPosition, renderLayers = null)` 4-й параметр фильтрует сущности по `layerId` (пропускает те, чьи слои не в массиве; null = все слои), сущности без `layerId` рендерятся всегда; `_buildFilterString(preset)` static — преобразует `materialPreset` JSON в CSS 2D filter-строку (blur/brightness/saturate/hueRotate/dropShadow), применяется в `_drawSingle()` перед рисованием каждого объекта, сбрасывается в 'none' после (§7 materialShaderPreset Tier 1, v4.31.0); tilemap `drawTiles` duck-type (§7 v4.42.0); particleEffect `drawParticles` duck-type (§7 v4.43.0); nineSliceSprite `drawNineSlice` duck-type (§7 v4.45.0); light: marker suppress + `applyLights` ambient+`lighter` post-pass (§7 v4.44.0)
  - `src/engine/AssetLoader.js` - `LOADABLE_ASSET_TYPES/DATA_ONLY_ASSET_TYPES`, `collectImageSources(scene)`, `loadImages(sources)` с guard `typeof Image !== 'undefined'`
  - `src/engine/AudioPlayer.js` - static `play` (SFX one-shot); `playMusic`/`stopMusic` (single music channel, optional linear crossfade sec); `playAmbient`/`stopAmbient` (audioZone channel); browser-guarded, no-op without `Audio` (§7 soundEffect v4.27.0; musicTrack/audioZone v4.41.0)
  - `src/engine/SaveGame.js` - static `save(scene, schema)`, `load(scene, schema)`, `clear()` — browser-guarded localStorage persistence (no-op if localStorage unavailable); snapshots named event-graph variables and/or inventory into JSON; schema keys: `variables`, `inventory` (§7 Tier 3 saveSchema, v4.35.0)
  - `src/engine/GameEngine.js` - оркестратор (constructor, loadProject async, tick); `_updateCamera()` делегирует `camera`-маркеру уровня (`CameraBehavior.computeCamera`), без маркера — legacy hard-center на игроке; новое поле `this.cameraRenderLayers` заполняется из `behavior.getRenderLayers()` и передаётся в `renderer.renderScene()` для фильтра слоёв (или null если маркер отсутствует); start/stop requestAnimationFrame-цикл; создаёт/уничтожает Input
  - `src/engine/Input.js` - клавиатурный стейт; `DEFAULT_ACTIONS` / `setInputMap` / `isActionDown` (§7 inputMap); `getAxis()` через actions; `isDown()`/`destroy()`; level field `Level.inputMap` / `Scene.inputMap`
  - `src/engine/QuestRunner.js` - интерпретатор quest state machine (tracks concurrent non-modal quests); методы `startQuest(questId)` (warns on unknown), `getStatus(questId)` (returns `'inactive'|'active'|'completed'`), `isObjectiveComplete(questId, objectiveId)`; `tick()` polls incomplete objectives' condition via `evalSpec` against `scene.eventGraphRuntime`, applies quest reward (array of `{type,itemId,count?,to?,from?}` Effects) via `scene.getBag()` when all objectives complete (§7 Tier 3 questObjective, v4.34.0)
  - **Фаза 2 MVP-поведения** (`src/engine/behaviors/` дочерние классы, `src/engine/BehaviorRegistry.js` реестр):
    - `src/engine/BehaviorRegistry.js` - `register(type, Class)`, `get(type)`, `has(type)`, явная регистрация (не import-side-effects)
    - `src/engine/behaviors/Behavior.js` - базовый класс (`entity`, `properties`, `enabled`, no-op `update(dt, scene)`)
    - `src/engine/behaviors/AABB.js` - чистые функции `getEntityBounds(entity, properties)`, `rectsIntersect(a, b)` (стабильная AABB-коллизия)
    - `src/engine/behaviors/ColliderBehavior.js` - `getBounds()` (duck-typed для Trigger)
    - `src/engine/behaviors/TriggerBehavior.js` - `checkEntities(candidates)` → `{entered, exited}`, `isOverlapping(id)`, `update(dt, scene)` — зовёт `checkEntities(scene.getAllEntities())`
    - `src/engine/behaviors/InteractableBehavior.js` - `radius`/`hint` (properties), `isInRange(point)`
    - `src/engine/behaviors/PlayerStartBehavior.js` - `getSpawnPosition()`
    - `src/engine/behaviors/PlayerMovementBehavior.js` - runtime-поведение (не component-тип схемы) управляемого игрока; читает `scene.input.getAxis()`, движет entity, per-axis AABB-коллизия
    - `src/engine/behaviors/CameraBehavior.js` - `computeCamera(scene, camera, canvas)` (не через generic `update(dt,scene)` — вызывается напрямую из `GameEngine._updateCamera()`); `getRenderLayers()` возвращает массив layer id из `this.properties.renderLayers` или null (= все слои, конвенция Фазы A `collidesWith: []`); `followTargetId`/`deadzoneWidth`/`deadzoneHeight`/`bounds`/`renderLayers` properties (§7 backlog "Camera asset", закрыт 2026-07-17; renderLayers расширение v4.26.0)
    - `src/engine/behaviors/PickupBehavior.js` - AABB-проверка пересечения с `scene.player` каждый тик, `scene.inventory.add(itemId, count)` и опциональное удаление entity; properties: `itemId`/`count`/`destroyOnPickup` (§7 backlog "pickup", закрыт 2026-07-18)
    - `src/engine/behaviors/DamageHealthBehavior.js` - AABB-проверка пересечения с другими сущностями, имеющими damageHealth, каждый тик; при пересечении с `contactDamage>0` источником — урон один раз + `invulnerabilityDuration` i-frame; properties: `maxHealth`/`currentHealth`/`contactDamage`/`invulnerabilityDuration`/`destroyOnDeath`/`layer`/`collidesWith` (§7 backlog "damageHealth", закрыт 2026-07-19)
    - `src/engine/behaviors/MovablePushableBehavior.js` - duck-typed hook `tryPush(dx,dy,scene)` (как `TriggerBehavior.isOverlapping`); вызывается `PlayerMovementBehavior` при коллизии, сдвигает entity, проверяет свободу позиции (AABB, исключая triggers); properties: `layer`/`collidesWith` (§7 backlog "movablePushable" 3/12, закрыт 2026-07-19)
    - `src/engine/behaviors/MountableVehicleSeatBehavior.js` - монтируемое транспортное средство; нажатие E в пределах `mountRadius` монтирует игрока, второе E демонтирует; во время езды — управление через `scene.input.getAxis()`, AABB-коллизии, player.visible=false; properties: `mountRadius`/`speed`/`layer`/`collidesWith` (§7 backlog "mountableVehicleSeat" 4/12, закрыт 2026-07-19)
    - `src/engine/behaviors/PathFollowerBehavior.js` - кинематическое поведение, движет entity по последовательности waypoints (offsets от spawn-позиции); каждый тик двигает entity.x/y к текущей target-waypoint, затем переход по mode; без коллизий, без переноса игрока; properties: `waypoints` (JSON)/`speed` (px/sec, дефолт 100)/`mode` (`loop`|`pingpong`|`once`, дефолт)/`waitAtWaypoint` (сек, дефолт 0)/`interpolation` (`'linear'` дефолт | `'smooth'` = Catmull-Rom spline, v4.29.0) (§7 backlog "pathFollower" 5/12, закрыт 2026-07-19)
    - `src/engine/behaviors/SpawnerBehavior.js` - периодический спавнер сущностей; каждый тик проверяет лимиты и таймер, при достижении интервала создаёт сущность из `template` через `EntityFactory.fromGameObjectData()` и добавляет в `scene.entities`; поддерживает список живых спавненных сущностей с прунингом; properties: `template` (JSON GameObject)/`interval` (сек, дефолт 3, <=0 отключает)/`maxAlive` (дефолт 0=неограничено)/`maxSpawns` (дефолт 0=неограничено)/`spawnOffsetX`/`spawnOffsetY` (дефолт 0); метод `spawnOne(scene)` для Event Graph actions (§7 backlog "spawner" 6/12, закрыт 2026-07-19)
    - `src/engine/behaviors/StateMachineBehavior.js` - AI finite-state machine; каждый тик evaluates текущего state's `transitions` в порядке (первый match wins) — condition либо `{type:'distance', op, value}` (расстояние до scene.player) либо `{var, op, value}` (via ConditionEvaluator.evalSpec против scene.eventGraphRuntime, тот же механизм что spriteUiAnimation's Фаза F state machine, но этот компонент движет entity, тот — переключает sprite clips); per-state `movement`: 'patrol' (пингует между `waypoints`, spawn-relative offsets), 'chase'/'flee' (прямо к/от scene.player на `speed`), unset/'idle' (нет движения); properties: `defaultState` (string)/`states` (JSON array {name, movement, speed, waypoints, transitions}, overrides aiPreset if set)/`aiPreset` (JSON {aggroRadius?, leashRadius?, speed?, chaseSpeed?, waypoints?, fov?}, convenience shorthand expands to patrol→chase→leash machine, v4.30.0); публичный метод `setState(name)` — duck-typed hook для future Event Graph "SetAIState" action, не wire-ed (§7 backlog "stateMachineBehavior" 7/12, закрыт 2026-07-19)
    - `src/engine/behaviors/CheckpointSaveBehavior.js` - сохранённая точка возрождения; AABB-проверка пересечения с `scene.player` каждый тик, на пересечении вызывает `activate(scene)` — деактивирует предыдущий `scene.activeCheckpoint` и сохраняет позицию в `scene.checkpointPosition`; `Scene.respawnPlayer()` использует эту позицию при воскрешении после смерти (см. DamageHealthBehavior.destroyOnDeath), иначе возвращает игрока к playerStart маркеру; empty property schema (§7 backlog "checkpointSavePoint" 8/12, закрыт 2026-07-19)
    - `src/engine/behaviors/ClimbableLadderBehavior.js` - лестница для лазания; не твёрдое препятствие (duck-type `isOverlapping()` исключает из PlayerMovementBehavior solids-скана). Самодостаточное поведение: `getBounds()` возвращает zone bounds (shape/offset/size), `getClimbSpeed()` возвращает скорость лазания (px/sec, дефолт 100). PlayerMovementBehavior._findLadder() каждый тик ищет ladder-зону пересекающую игрока; при пересечении горизонтальный ввод нулируется (вертикальное-только движение) и скорость переходит на climbSpeed вместо normal walk-speed; без коллизии-bypass, твёрдые препятствия остаются активны. Properties: `climbSpeed`, shape/offset/geometry поля (box/circle/freeform) как collider/trigger (§7 backlog "climbableLadder" 9/12, закрыт 2026-07-20)
    - `src/engine/behaviors/AudioZoneBehavior.js` - volume-zone ambient/music on player enter/exit; props `src`/`volume`/`loop`/`channel`/`stopOnExit`/`crossfade` + shape; never solid (§7 audioZone v4.41.0)
    - `src/engine/behaviors/TilemapBehavior.js` - grid atlas layer; `getSolidRects`/`drawTiles`/`collectImageSources`; tilesetAssetId via assetsById; solidIndices (§7 tileset+tilemap v4.42.0)
    - `src/engine/behaviors/ParticleEffectBehavior.js` - continuous/burst VFX; `drawParticles`/`collectImageSources`; emitRate/burst/gravity/size·color·alpha; optional sprite; never solid (§7 particleEffect v4.43.0)
    - `src/engine/behaviors/LightBehavior.js` - point/directional/area glow; `drawLight`; ambient max darken; never solid (§7 light v4.44.0)
    - `src/engine/behaviors/NineSliceSpriteBehavior.js` - 3×3 border stretch UI frames; `drawNineSlice`/`collectImageSources`; never solid (§7 nineSliceSprite v4.45.0)
    - `src/engine/behaviors/AABB.js` - `getEntityBounds`/`rectsIntersect`/`matchesLayer`/`collectSolidBlockers` (expands tilemap solid cells for movement)
    - `src/engine/behaviors/registerDefaultBehaviors.js` - регистрирует collider/trigger/interactable/playerStart/spriteUiAnimation/dialogueTrigger/camera/pickup/damageHealth/movablePushable/mountableVehicleSeat/pathFollower/spawner/stateMachineBehavior/checkpointSavePoint/climbableLadder/conveyorZiplineJumpPadPortal/variableModifier/destructibleContainer/audioZone/tilemap/particleEffect/light/nineSliceSprite в `BehaviorRegistry`
    - Обновлены: `Entity.js` (`behaviors: []`), `EntityFactory.js` (компоненты → behaviors через реестр), `Scene.js` (`getAllEntities()`, `findPlayerStartEntity()`, `getPlayerStart()`, `spawnPlayer(speed)`, `_createPlayer()` helper, `respawnPlayer(speed)` для воскрешения, `checkpointPosition`/`activeCheckpoint`/`_playerStartMarker` кеш, `findCameraEntity()`, `hideCameraMarker()` — кеширует `scene.cameraEntity`), `GameEngine.js` (регистрация + `_update(dt)` вызывает `respawnPlayer()` если `scene.player` falsy, Input управление, `dt` вычисление из requestAnimationFrame)
  - **Фаза D Event Graph MVP** (`src/engine/eventgraph/`, Фаза D LOGIC_SYSTEMS_PLAN):
    - `src/engine/eventgraph/EventGraphNodeRegistry.js` - реестр узлов (тип → функция-обработчик), явная регистрация, минимальный API как BehaviorRegistry
    - `src/engine/eventgraph/EventGraphRuntime.js` - интерпретатор графа (переменные, ходьба по рёбрам, синхронизация с TriggerBehavior, pub/sub-мост для OnCustomEvent); `tick(dt)` также вызывает `scene.questRunner?.tick()` для опроса условий цели квестов
    - `src/engine/eventgraph/registerDefaultEventGraphNodes.js` - MVP-словарь узлов (Entry: OnStart/OnTick/OnCollisionEnter/OnCollisionExit/OnInteract/OnTimer/OnCustomEvent/OnDialogueEnded; Conditions: Compare/And/Or/Not; Actions: SetVariable/SetComponentEnabled/Teleport/DestroyObject/EmitCustomEvent/StartDialogue/PlayAnimation/PlaySound/PlayMusic/StopMusic/SpawnObject/StartQuest/SaveGame/LoadGame); SpawnObject `{assetId, x?, y?, layerId?}`; StartQuest `{questId}`; SaveGame/LoadGame `{variables?, inventory?}`; PlayMusic/StopMusic `{src?, volume?, loop?, crossfade?}` (§7 musicTrack v4.41.0)
    - Обновлены: `Behavior.js` (`.type` и `.enabled` live после конструкции), `Scene.js` (`.eventGraph` + `.destroyEntity(id)`), `GameEngine.js` (вызов `registerDefaultEventGraphNodes()` и создание `EventGraphRuntime`), `TriggerBehavior.js` (пересылка enter/exit → `scene.eventGraphRuntime.notifyCollision()`), `PlayerMovementBehavior.js` (фильтр из solids объектов с отключённым `.enabled` и TriggerBehavior)
  - **Фаза E Dialogue MVP** (`src/engine/`, Фаза E LOGIC_SYSTEMS_PLAN):
    - `src/engine/DialogueRunner.js` - интерпретатор Dialogue Graph ({formatVersion, startNode, nodes:[{id,speaker,text,choices?,next?}]}); методы getCurrentNode(), getVisibleChoices() (фильтр по condition через evalSpec), advance(choiceIndex?), isEnded()
    - `src/engine/eventgraph/ConditionEvaluator.js` - вынесенный общий compareOp/evalSpec({var,op,value}) для Event Graph (Compare/And/Or/Not, Фаза D) и DialogueRunner (Фаза E)
    - `src/engine/behaviors/DialogueTriggerBehavior.js` - новый component-тип `dialogueTrigger` (data-holder: dialogueId + layer), запуск диалога через Event Graph StartDialogue action + trigger/interactable связка
    - Обновлены: `src/engine/eventgraph/registerDefaultEventGraphNodes.js` (entry OnDialogueEnded для диспатча, action StartDialogue создаёт DialogueRunner), `src/engine/eventgraph/EventGraphRuntime.js` (polling _checkDialogueEnded() в tick), `src/engine/Scene.js` (`dialogues` Map, `dialogueRunner`, `dialogueActive`, `inventory`, `npcInventories`/`getBag`, `itemDefs`), `src/engine/DialoguePlayHud.js` (Play choices + item pick), `src/ui/items/ItemsPanel.js` (dock `items`), `src/engine/behaviors/PlayerMovementBehavior.js` (return рано если scene.dialogueActive), `src/engine/behaviors/registerDefaultBehaviors.js` (зарегистрирован dialogueTrigger)
  - **Фаза F Animation state machine** (`src/engine/`, Фаза F LOGIC_SYSTEMS_PLAN):
    - `src/engine/behaviors/SpriteAnimationBehavior.js` — расширен: `properties.states` (array `{name, clip, transitions: [{condition:{var,op,value}, target}]}`), `properties.clips` (named `{clipName: frames[]}` catalog заменяет flat `frames`), `properties.defaultState` (initial state name); `_checkTransitions()` evaluates первый matching condition против `scene.eventGraphRuntime`, `play(clipName)` метод для Event Graph override (state machine resumes на следующем transition); обратно совместим (без `states` = Фаза B)
    - `src/engine/behaviors/PlayerMovementBehavior.js` — пишет `speed` variable в `scene.eventGraphRuntime` каждый tick (entity's скорость когда движется, 0 когда idle/нет input/диалог паузирует), используется state machine transitions (idle<->walk)
    - `src/engine/eventgraph/registerDefaultEventGraphNodes.js` — новый action `PlayAnimation` (params: `objectId`, `clip`) — находит animation behavior и вызывает `.play()`
    - `src/constants/ComponentPropertySchema.js` — `spriteUiAnimation` схема добавила 3 новых поля: `clips` (kind 'json'), `defaultState` (kind 'text'), `states` (kind 'json'), свободный JSON-текст паттерн как existing `frames`
  - **HUD Canvas rendering** (v4.33.0):
    - `src/engine/CanvasHudRenderer.js` - DOM-based Play-overlay renderer для level-scope HUD Canvases; читает `scene.canvases` (Map) + `scene.activeCanvasIds` (set by active camera's `CameraBehavior.getCanvasIds()` в каждом tick); polling signature-diff на rAF (hash of canvas ids + widget values) управляет re-render; создаёт/обновляет widget DOM-элементы (button/text/image/progressBar/panel) на основе canvas definitions; экспортирует публичные методы `start()`, `stop()`, `sync()`
    - `src/engine/CanvasHudBinding.js` - чистые helper-функции для anchor resolution и data-binding (unit-testable без jsdom): `resolveAnchorStyle(anchor, offsetX, offsetY)` → CSS absolute-position style, `resolveBindingValue(scene, binding)` → значение из event-graph variable или inventory count, `resolveProgressFraction(scene, binding)` → fraction clamped [0,1] для progress-bar fill, `resolveDisplayText(scene, widget)` → display text (bound или static)
    - `src/constants/ComponentPropertySchema.js` — `camera` схема добавила новое поле: `canvasIds` (kind 'idMultiSelect', source 'canvases', default `[]`) — HUD Canvas ids which active camera shows; editor renders as dynamic checkbox group populated from `level.canvases`
    - Обновлены: `src/engine/Scene.js` (новое поле `canvases: Map`, `activeCanvasIds: array|null`), `src/engine/behaviors/CameraBehavior.js` (новый метод `getCanvasIds()` возвращает массив или null; note: opposite convention от `getRenderLayers()` которая null = "all layers", здесь null = "no HUD canvas"), `src/engine/GameEngine.js` (`_updateCamera()` теперь также пишет `scene.activeCanvasIds = behavior.getCanvasIds()`), `src/core/PlayOperations.js` (mount `CanvasHudRenderer` рядом с `DialoguePlayHud` на `#play-overlay`), `styles/main.css` (добавлены CSS-классы для `.canvas-hud` и `.canvas-hud__widget*` стили)
    - Tests: new `tests/engine/CameraBehavior.test.js` (getCanvasIds describe block), new `tests/engine/CanvasHudBinding.test.js` (pure anchor/binding helpers)

## 🏗️ Архитектурные принципы

### Централизованные системы
1. **StateManager** - единый источник состояния
2. **ConfigManager** - конфигурация
3. **EventHandlerManager** - все события UI
4. **GlobalEventRegistry** - глобальные события
5. **CacheManager** - кэширование (v3.57.0 Phase 3: namespacing object-кешей по levelId через `${levelId}:${objId}` для защиты от коллизий id между одновременно открытыми уровнями)

### Модульная архитектура
- Каждая операция в отдельном файле (ObjectOperations, LayerOperations, etc.)
- BaseModule паттерн с 25+ helper-методами
- Lifecycle через ComponentLifecycle

### Принципы
- **DRY** - нет дублирования
- **SOLID** - single responsibility
- **Clean Code** - понятный код
- **Централизация** - единые точки изменений

## 🎮 Типичные задачи

### Создание объекта
```javascript
const obj = levelEditor.createObject('player', 100, 200, { name: 'Player' });
levelEditor.selectObject(obj.id);
```

### Управление состоянием
```javascript
stateManager.set('selectedObject', obj);
const selected = stateManager.get('selectedObject');
```

### Работа с конфигурацией
```javascript
configManager.set('grid.size', 32);
const gridSize = configManager.get('grid.size');
```

### Регистрация событий
```javascript
eventHandlerManager.registerElement(button, { click: onClick }, 'button-id');
```

## 📚 Документация (приоритет)

1. **DEVELOPMENT_GUIDE.md** - настройка, примеры, правила кода
2. **ARCHITECTURE.md** - архитектура, менеджеры, модули
3. **API_GUIDE.md** - методы, примеры
4. **QUICK_START.md** - запуск, операции

## ⚠️ Частые ошибки

- ❌ `console.log` → ✅ `Logger.category.method()`
- ❌ Проверка `if (!stateManager)` → ✅ Доверяй архитектуре
- ❌ Дублирование BaseDialog → ✅ Наследование
- ❌ Прямые события → ✅ EventHandlerManager

## 🔧 Версионирование

Версия в одном месте: `src/core/LevelEditor.js` → `static VERSION = '4.35.0'` (Phase A refactor + Phase B dock B0–B5 + §7 backlog all 12/12 done: camera/pickup/damageHealth/movablePushable/mountableVehicleSeat/pathFollower/spawner/stateMachineBehavior/checkpointSavePoint/climbableLadder/conveyorZiplineJumpPadPortal/variableModifier/destructibleContainer; §7 Tier 1 all 4 done: soundEffect/pathSpline/aiBehaviorPreset/materialShaderPreset; §7 Tier 2 real assetRegistry: ProjectExporter embeds assets[] in manifest, ProjectLoader populates assetsById Map from manifest.assets, Scene.assetsById per-level, EntityFactory.fromAssetData() for prefab/composite spawning, SpawnObject action; §7 Tier 3 questObjective: QuestRunner tracks concurrent quest state, StartQuest action wired in EventGraphRuntime, objective conditions evaluated via ConditionEvaluator; §7 Tier 3 saveSchema: SaveGame.save/load/clear static methods for localStorage persistence, SaveGame/LoadGame Event Graph actions; HUD Canvas runtime + data model: Level.canvases[], Scene.canvases Map, camera.canvasIds component property, CanvasHudRenderer/CanvasHudBinding helpers, no editor UI yet; layout = `editor.dockManager`)

Версия отображается динамически после полной инициализации через `updateVersionInfo()` и `updatePageTitle()`. Интерфейс скрыт до завершения загрузки, чтобы избежать отображения устаревшей версии. Pre-push hook блокирует коммит без бампа версии (`.claude/settings.json`).

## 🚀 Команды

```bash
# Запуск (рекомендуется start_Editor.vbs для полностью бесфликерного запуска)
./start_Editor.vbs
# или
./start_Editor.bat

# Обновление манифеста
./update_manifest.bat
```

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Команды терминала

### ❌ НИКОГДА не запускай эти команды (они зависают):
- `python -m http.server 8000` - сервер всегда запущен пользователем
- `npx serve` / `serve -p 8000` - сервер всегда запущен пользователем
- `npm run start:node` - запускает сервер, который зависает
- `npm run watch:css` - watch режим зависает (используй `build:css` вместо этого)
- `start_Editor.bat` / `start_Editor.vbs` - лаунчер всегда запущен пользователем
- Любые команды запуска серверов без флага `is_background=true`

### ✅ Правила для команд терминала:
1. **Долгоработающие процессы** (серверы, watch режимы) - используй `is_background=true`
2. **Git команды** - добавляй `| cat` в конце для избежания пейджера:
   ```bash
   git log --oneline -10 | cat
   git diff | cat
   ```
3. **Команды с интерактивным вводом** - добавляй флаги `--yes`, `-y`, `--non-interactive`
4. **Проверка процессов** - используй быстрые команды без ожидания:
   ```powershell
   Get-Process | Where-Object {...} | Select-Object -First 10
   ```

### ✅ Примеры корректных команд:
```bash
# Git с cat (без пейджера)
git log --oneline -10 | cat

# npm install с флагом yes
npm install --yes package-name

# Проверка версии (быстрая команда)
node --version
python --version

# Сборка CSS (быстрая, завершается сразу)
npm run build:css

# Обновление манифеста (быстрая, завершается сразу)
node update_manifest.js
# или через bat (рекомендуется)
update_manifest.bat
```

### ✅ Node.js команды которые МОЖНО запускать:
- `npm run build:css` - сборка CSS (быстрая, завершается)
- `npm run validate:version` - проверка синхронизации версий (быстрая, завершается)
- `node update_manifest.js` - обновление манифеста (быстрая, завершается)
- `npm install --yes <package>` - установка пакетов с флагом yes
- `node --version`, `npm --version` - проверка версий

## 🛠️ Полезные инструменты для агента

### Автоматические проверки:
- ✅ `npm run validate:version` - проверка синхронизации версий перед коммитом
- ✅ `read_lints` - встроенная проверка ошибок линтера

### Доступные инструменты агента:
- ✅ `codebase_search` - семантический поиск по коду
- ✅ `grep` - поиск по файлам (быстрее чем codebase_search для точных совпадений)
- ✅ `read_file` - чтение файлов
- ✅ `read_lints` - проверка ошибок линтера
- ✅ `glob_file_search` - поиск файлов по паттерну

### Рекомендации для эффективной работы:
1. **Перед изменением кода**: используй `codebase_search` для понимания архитектуры
2. **Перед коммитом**: запускай `npm run validate:version` для проверки версий
3. **После изменений**: проверяй `read_lints` на ошибки
4. **Для поиска**: используй `grep` для точных совпадений, `codebase_search` для семантики