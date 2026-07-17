# Архитектура Level Editor v4.0.2 (Phase A Refactor + Phase B dock: split-tree layout)

**📚 Навигация:**
- [Development Guide](./DEVELOPMENT_GUIDE.md) - примеры использования
- [API Guide](./API_GUIDE.md) - API методы

## 🏗️ Утилитарная архитектура

**Принципы**: DRY, SOLID, Clean Code, единые точки изменений

## 🔄 Жизненный цикл инициализации

### Процесс загрузки редактора

1. **Скрытие интерфейса** - Body скрыт через CSS (`visibility: hidden`) до полной инициализации
2. **Инициализация конфигурации** - `initializeConfiguration()` загружает настройки
3. **Сканирование ассетов** - `assetManager.scanContentFolder()` и `preloadImages()`
4. **Инициализация рендерера** - `initializeRenderer()` создает CanvasRenderer
5. **Синхронизация изображений** - предзагруженные изображения синхронизируются с CanvasRenderer
6. **Инициализация UI компонентов** - создание панелей, toolbar, диалогов (primary roots в `#dock-content-pool`)
7. **`dockManager.init()`** - restore `panels.dock.*`, mount leaves в `#split-root` / `#floating-layer`
8. **Инициализация обработчиков событий** - `initializeEventHandlerManager()`
9. **Инициализация меню** - `initializeMenuAndEvents()`
10. **Инициализация уровня** - `initializeLevelAndData()` создает новый уровень
11. **Финализация** - `finalizeInitialization()`:
    - Первый рендер
    - Обновление версии (`updateVersionInfo()`, `updatePageTitle()`)
    - Обновление всех панелей
    - Сохранение начального состояния в истории
    - Показ интерфейса (`document.body.classList.add('editor-ready')`)

**Важно**: Интерфейс показывается только после полной инициализации, чтобы избежать отображения устаревшей версии и неполностью загруженных элементов.

## 🛠️ Утилиты

### DockManager (Phase B, B0–B5) — единственная оконная система
**Файл**: `src/ui/dock/DockManager.js` (facade → `editor.dockManager`)

Заменяет удалённый `PanelPositionManager` + `src/ui/panels/*` (B5). Layout — binary split-tree + floating windows; нет фиксированных L/R tab shells.

**Модули `src/ui/dock/`:**
| Модуль | Роль |
|--------|------|
| `DockManager` | Facade: `init`/`destroy`, show/hide/toggle contentType, immersive, snapshot |
| `DockTreeModel` | Pure model: `mainTree`, `floatingWindows`, split/leaf ops (без DOM) |
| `DockRenderer` | Reconciliation DOM в `#split-root` / `#floating-layer` |
| `DockDragController` | Drag/drop split, float detach, self-drop clone (Shift) |
| `DockContentRegistry` | contentType → mount; primary reparent / multi-instance copies |
| `DockPanelFactory` | Копии outliner/details/layers/levels/assets/viewport |
| `DockPersistence` | `panels.dock.mainTree` + `panels.dock.floatingWindows` |
| `DockFloatWorkspace` | Relative float pos + edge snap на resize workspace |
| `DockTypeMenu` / `ViewportLeafChrome` | Меню типов / chrome viewport leaf |
| `DockConstants` | `TYPE_ORDER`, `TYPE_META`, `isDockCustomizeKey` (Shift) |

**Content types** (`TYPE_ORDER`): `viewport`, `outliner`, `details`, `layers`, `assets`, `levels`.

**Публичный API** (`editor.dockManager`):
- `init()` — mount shell, restore layout, first render
- `destroy()` — flush persist, teardown renderer/drag/registry
- `showContentType(type, opts?)` / `hideContentType(type)` / `toggleContentType(type)`
- `hasContentType(type)` — leaf present in main or floating
- `getLayoutSnapshot()` / `resetLayout()`
- `enterImmersiveLayout()` / `exitImmersiveLayout()` — Game Mode: viewport-only snapshot

**Persist (активные ключи):** `panels.dock.mainTree`, `panels.dock.floatingWindows`; опционально `panels.dock.floatEdgeSnap`, `panels.dock.floatEdgeMargin`.

**Устаревшие prefs (неактивны после B5):** L/R tab shells, `tabPositions`, `leftPanelTabOrder`/`rightPanelTabOrder`, `leftPanelSplits`/`rightPanelSplits`, fixed L/R widths.

**View → Panels:** per-contentType toggles (не Left/Right/Assets Panel). `EventHandlers.togglePanel` резолвит legacy `leftPanel`→`outliner`, `rightPanel`→`details`, `assetsPanel`→`assets` в dock contentType.

**Alt+1/2/3/4** — `EventHandlers.togglePanel('leftPanel'|'rightPanel'|'toolbar'|'assetsPanel')`; при активном dock 1/2/4 → show/hide outliner/details/assets; toolbar остаётся вне tree.

**Customize key:** `isDockCustomizeKey` — layout-жесты (move/split/clone/float snap) только с **Shift**; free-move float position и corner resize — без Shift.

**Вне shell:** Menu (`<header>`), Console (`#console-panel`), StatusBar — не в dock tree. Диалоги / SettingsPanel — overlays, не leaf'ы.

**Nested splits:** произвольная глубина binary split (`direction: 'row'|'column'`, `ratio`); не legacy «один уровень tab-split в L/R panel».

### MenuManager / ShortcutFormatter — единый источник хоткеев (меню + title tooltips)
**Файлы**: `src/managers/MenuManager.js`, `src/utils/ShortcutFormatter.js`, `src/ui/Toolbar.js`, `src/ui/DetailsPanel.js`
- Пункты `config/menu.js` больше не хранят хардкод-строку хоткея (`shortcut: 'Ctrl+S'`), а ссылаются на дот-путь в `config/defaults/shortcuts.json` через `shortcutKey: 'editor.saveLevel'` — единый источник истины, не дублирующий значение.
- `ShortcutFormatter.format(shortcut)` — строка вида `"Ctrl+Alt+N"`; `resolveLabel(configManager, shortcutKey)` / `formatTitle(base, sc)` — для меню и native `title` tooltips (**U2**).
- `MenuManager.resolveShortcutLabel(shortcutKey)` — делегирует в `ShortcutFormatter.resolveLabel`; `createMenuItem()` → `<span data-shortcut-key="...">`.
- `MenuManager.refreshShortcutLabels()` — обновляет `[data-shortcut-key]` в DOM меню; после rebind `SettingsPanel.saveHotkey()` вызывает `menuManager.refresh()` + `levelEditor.refreshUiShortcutTitles()` (toolbar + viewport toolbar copies).
- **U2 tooltips**: `Toolbar` buttons store `data-base-title` + `data-shortcut-key`; title = `Label (Ctrl+S)` when `ui.showTooltips` is on (Settings → UI); off → no `title`. Details stack-order buttons resolve the same shortcuts live at render.
- **Известное ограничение**: rebind обновляет подписи UI; `EventHandlers.handleKeyDown` читает bindings via `_matchesShortcut` (data-driven) — см. DEVELOPMENT_GUIDE hotkeys.

### MenuManager — generic disabled-состояние и иконки пунктов; единая разметка пунктов (v3.55.0+)
**Файлы**: `src/managers/MenuManager.js`, `src/utils/MenuItemTemplateUtils.js`, `config/menu.js`
- Любой `itemConfig` в `config/menu.js` может иметь поле `disabled: boolean | (editor) => boolean` — дизейбль-предикат (функция или літерал).
- `MenuManager.itemDisabledCheckers` — Map(itemId → checker), заполняется при создании пункта в `createMenuItem()`.
- `MenuManager.refreshDisabledStates()` пересчитывает состояние каждого пункта (toggle CSS-классы `opacity-50 pointer-events-none cursor-not-allowed` + `dataset.menuDisabled`), вызывается при init, при `refresh()`, и реактивно через `setupDisabledStateSubscriptions()` на подписках к `stateManager` ключам `selectedFolders`/`activeAssetTabs`.
- Клик по disabled-пункту блокируется в `setupMenuItemEvents()`.
- **Единая разметка пункта меню** — `MenuItemTemplateUtils` экспортирует три функции для атомной разметки:
  - `renderMenuItemLeadingHtml({ icon, checkboxId, checked })` — единый 18×18px блок слева (иконка или toggle-чекбокс пункта); раньше рендерились с разными размерами/margin, теперь одинаковый блок
  - `renderMenuItemBodyHtml({ leadingHtml, label })` — оборачивает leading+текст в `<span class="flex items-center">` (единый flex-item слева, нужно чтобы trailing при `justify-content:space-between` не «растягивал» центр)
  - `renderMenuItemTrailingHtml(text, { shortcutKey })` — единый trailing-блок справа (хоткей вроде "Alt+3" или стрелка флаут-подменю ▸)
- Используется `MenuManager.createMenuItem()` и `BaseContextMenu.createMenuItem()/createSubmenuItem()` для одиночного источника правды разметки; устраняет дрейф визуалов между dropdown-меню (nav bar) и floating context-меню.
- `MenuManager.createMenuItem()` рендерит иконку, если в `itemConfig.icon` (HTML/SVG-строка или эмодзи) — отрисовывается в leading-блоке перед лейблом, работает для любого меню.
- **Побочный эффект**: nav submenu-триггеры (`createSubmenuItem`) теперь поддерживают иконку (itemConfig.icon); контекстные меню опционально поддерживают `item.shortcut` в trailing-слоте (пока не используется в коде, но слот готов).
- **buildAssetsMenu()** (config/menu.js, top-level "Add" в навигации) генерирует иерархию категория → тип для каждого creatable asset-типа из `AssetTypes.js`, каждый пункт получает иконку через `buildTypeIconSvg(typeId, category.color, 16)` и `disabled: isRootFolderSelected` (дизейблит создание, если выбран корневой каталог 'root' — там ничего создавать нельзя). Использует новый helper `getAssetCategoriesWithTypes()` из `src/constants/AssetTypes.js` (группирует ASSET_TYPES по категориям).

### ResizerManager
**Файл**: `src/managers/ResizerManager.js`
- Унифицированный менеджер для разделителей панелей
- Автоматическое определение устройства и маршрутизация событий
- Поддержка горизонтальных и вертикальных разделителей

### EventHandlerManager (v3.52.5+v3.58.0)
**Файл**: `src/event-system/EventHandlerManager.js`
- Унифицированный менеджер событий UI
- Event delegation для эффективности (click, contextmenu, dragstart, mousedown, mouseup, mouseover — v3.58.0)
- Предотвращение дублирования обработчиков
- **Paint drag паттерн** (v3.58.0): mousedown на иконке → `_startIconPaintDrag()`, mouseover на других иконках того же типа → `_paint*()`, глобальный mouseup → `_endIconPaintDrag()` с батчевым ре-рендером. Используется в LayersPanel (eye/lock), LevelsPanel (eye), OutlinerPanel (eye) для быстрого тогла множества иконок без клика по каждой отдельно

### GlobalEventRegistry (v3.52.5)
**Файл**: `src/event-system/GlobalEventRegistry.js`
- Централизованное управление глобальными событиями
- Предотвращение дублирования
- Автоматическая очистка

### BrowserGesturePreventionManager
**Файл**: `src/managers/BrowserGesturePreventionManager.js`
- Единая система блокировки браузерных жестов
- Умное определение навигационных жестов
- Автоматическая очистка обработчиков

### WorldPositionUtils
**Файл**: `src/utils/WorldPositionUtils.js`
- Расчет мировых координат в иерархии групп
- Устранено дублирование
- `getRotatedRectAABB(x, y, w, h, deg)` — AABB прямоугольника после поворота вокруг его центра
- `rotateBoundsAroundCenter(bounds, deg)` — консервативный AABB для уже вычисленных bounds, повёрнутых вокруг их центра
- `getWorldBounds()` / `isPointInWorldBounds()` учитывают `rotation`: точный inverse-rotate hit-test для одиночных объектов, консервативный AABB для групп

### GroupTraversalUtils (v4.0.0 Phase A: интеграция в LevelEditor)
**Файл**: `src/utils/GroupTraversalUtils.js`
- Система обхода иерархии групп
- 12 методов работы с группами
- `findObjectPath(topLevelObjects, targetId)` — DFS-поиск пути индексов от корня (`Level.objects`) до объекта через вложенные `group.children`; единый источник истины для порядка рендера/hit-test, используется в `Level.compareStackOrder()`
- **v4.0.0 Phase A refactor**: методы `findInObjects()` и `findInGroup()` теперь используются в LevelEditor.js вместо удалённых дублирующихся приватных методов `findObjectInGroup()` и `findObjectInGroupRecursive()` (DRY-улучшение)

### File Menu Structure (v3.57.0 Phase 7)
**Файл**: `config/menu.js`, id `file` (переименовано с `level` в Phase 7)
- **Меню-структура** (новая в Phase 7):
  - Project-операции: New Project, Open Project..., [separator], Save Project, Save Project As...
  - Level-операции: [separator], New Level, Open Level..., [separator], Save Level, Save Level As...
  - Assets: [separator], Import Assets... (перенесено из Settings в Phase 7)
- **Close Level** — удалён из меню (остаётся доступен через крестик на вкладке уровня в LevelsPanel и контекстное меню); сам метод `closeLevel()` не удалён — остаётся в API
- **Import Assets...** — раньше был в Settings меню, перемещён в File для логической группировки файловых операций (Phase 7)
- **Project Settings...** — новый пункт в Settings меню (раньше в File, переместился в Phase 7 для разделения проекта и редактора)

### LevelsPanel (v3.57.0 Phase 6 Complete, v3.58.0: отдельная вкладка)
**Файлы**: `src/ui/LevelsPanel.js`, `src/ui/LevelsContextMenu.js`, `src/ui/panel-structures/LevelsPanelStructure.js`
- **Назначение**: список открытых уровней (LevelSession), теперь отдельная вкладка в правой панели (ранее был вложен в вкладку Layers). DOM-структура: `#levels-content-panel` (независимый tab-content-right div, `index.html:148`)
- **Функциональность**:
  - Кнопка "+Add" добавляет новый уровень как отдельную сессию через `LevelsManager.addLevel()`
  - Клик по элементу списка переключает текущий уровень через `setCurrentLevel()`
  - Eye-icon переключает per-level visibility (Phase 3: видимые уровни рисуются одновременно через `getVisibleSessions()` в `RenderOperations.render()`)
  - **Solo (Ctrl+click eye-icon)**: эксклюзивная видимость одного уровня, зеркалит `LayersPanel.toggleLayerSolo` 1:1; сбрасывает solo у остальных уровней
  - Double-click / контекстное меню "Rename" переименовывает уровень
  - Контекстное меню: "Make Current", "Rename", "Save", "Save As", "Close", "Duplicate" (Phase 5)
  - **Drag-reorder** (Phase 6): перестановка табов в списке через `LevelsManager.reorderLevels(newOrder)`; заблокировано при активном поиске (DOM-источник неполный)
  - **Дизамбигуация имён** (Phase 6): при коллизии имён уровней, визуальный суффикс `"Untitled Level (2)"` только в отображении, реальное `level.meta.name` не меняется
  - **Per-session dirty-индикатор** (Phase 5): точка/звёздочка если есть несохранённые изменения
- **Z-order рендера** (Phase 6): Текущий уровень ВСЕГДА рисуется поверх остальных видимых уровней, независимо от позиции таба (через `LevelsManager.getVisibleSessionsForRender()` в `RenderOperations.render()`)

### Project Model and ProjectFileOperations (v3.57.0 Phase 7)
**Файлы**: `src/models/Project.js`, `src/core/ProjectFileOperations.js`, `src/ui/ProjectSettingsDialog.js`

**Project** — контейнер набора открытых уровней (LevelSession):
- `toJSON(levelSessions, levelOrder, currentLevelId)` — экспортирует self-contained JSON: эмбеддит `Level.toJSON()` каждого открытого уровня + метаданные (per-level `visible` и `fileName`), порядок табов (`levelOrder`), и `currentLevelIndex` (позиция в массиве уровней, т.к. `Level.toJSON()` не сериализует `id`). Браузер не имеет persistent file handle, поэтому project-файл — полная копия, не ссылки.
- `fromJSON(json)` (static) — парсит project-JSON обратно в LevelSession набор (per-level history восстанавливается из exported state в JSON).
- **Назначение**: полная сохранённость multi-level сессии в одном файле (в отличие от single-level `Level.toJSON()`)

**ProjectFileOperations** (BaseModule):
- `newProject()` — создание нового проекта: очищает все открытые уровни, создаёт один пустой с `seeded history baseline` (один undo-шаг для начального состояния). Единый confirm-диалог при несохранённых правках, вместо N диалогов по одному на каждый уровень (Edge Case 10/11).
- `openProject()` — picker + read, затем `openProjectFromData(json, fileName)`.
- `openProjectFromData(json, fileName)` — открытие из JSON (диск или Open Recent): парсит all уровни ДО очистки текущих (Edge Case 3); replace-not-merge; пишет MRU.
- `saveProject()` — сохранение текущего проекта (скачивание в браузер). При отсутствии pinned `project.fileName` имя берётся из `project.name` через `_deriveFileNameFromProjectName()`; auto-имя пересчитывается пока `fileNameIsAuto`. После save — MRU.
- `saveProjectAs()` — сохранение проекта с выбором имени файла (показывает prompt).
- **Per-session history bootstrap**: каждой фоновой (non-current) сессии при загрузке вручную seeded `.history` через `HistoryManager.saveState()` (т.к. `addLevel({makeCurrent:false})` не пропускает живой HistoryManager).
- **Cache cleanup**: `newProject()`/`openProject()` вызывают приватный `_cleanupAllOpenSessions()` для очистки orphaned entries в `renderOperations.spatialIndex`, `visibleLayersCache`, и прочих per-levelId кешах (иначе повторные New/Open Project копили zombie-данные по старым levelId).

### Open Recent (U3)
**Файлы**: `src/managers/RecentFilesManager.js`, `config/menu.js` (`open-recent` dynamic submenu), `MenuManager.rebuildRecentFilesSubmenu`, prefs `editor.recentFiles` / `userPrefs.recentFiles`
- Браузер не даёт стабильный path — в localStorage кладётся snapshot JSON (cap 10, skip >~1.5MB).
- Запись: успешные open/save level и project.
- Меню: File → Open Recent (rebuild on hover) + Clear Recent.

**ProjectSettingsDialog** (extends BaseDialog):
- Диалог редактирования параметров проекта (Phase 7, пока стаб).
- **Текущие поля**: только `project.name` (редактируется через `<input type="text">`).
- **Отложенные поля** (Open Questions #9): default asset import path, default grid/snap для новых уровней проекта, naming convention — явно задокументированы в UI, но реализация отложена.

### AssetPanel System (v3.60.2 Фаза 4 завершена: декомпозиция на 7 компонентов)
**Основные файлы**: `src/ui/AssetPanel.js` (orchestration-слой), `src/ui/AssetViewRenderer.js` (Фаза 4.2 extraction), `src/ui/AssetTabsManager.js`, `src/ui/FoldersPanel.js`

**Multi-instance (dock copies)**: primary and each copy have independent UI state via `AssetPanel.uiStateKey(base)` — primary keeps legacy keys (`selectedAssets`, `activeAssetTabs`, …); copies use `panelUI.<instanceKey>.<base>`. Independent: selection, folder tabs, folder selection, type filters, view size/mode (memory). Shared: `assetManager` catalog, HTML5 drop onto canvas from that panel’s selection. Prefs/config persist **primary only**. Asset marquee flag stays global (`mouse.isAssetMarqueeSelecting`) for mutual exclusion.

**7 контроллеров** (все new AssetPanelController(assetPanel), паттерн владения — plain-класс, не BaseModule):
- **AssetFoldersController** (Фаза 4.1) — навигация по папкам, управление табами папок, переключение активной папки
- **AssetViewRenderer** (Фаза 4.2) — рендеринг превью (grid/list/details), `render()` — one-line delegate из AssetPanel.render()
- **AssetFilterController** (Фаза 4.3) — поиск и фильтрация по типу ассета, скрытие строк фильтра, управление focus
- **AssetSelectionController** (Фаза 4.4) — выделение ассетов (multi-select через Shift+Ctrl), select-all/deselect-all, обновление визуалов
- **AssetDragDropController** (Фаза 4.5) — drag-out ассетов на канвас, external PNG file drop overlay, создание ассетов из файлов
- **AssetItemActionsController** (Фаза 4.6) — контекстные меню (AssetContextMenu, AssetPanelContextMenu), клики по ассетам, open/show-in-explorer
- **AssetToolbarController** (Фаза 4.7) — тулбар (размер превью, режимы просмотра), персистентность, refresh; Panel Settings → `LevelEditor.openSettings('assets')`

**Декомпозиция завершена** (Фаза 4): AssetPanel.js остаётся orchestration-слоем (constructor, init, destroy, setupEventListeners, setupAssetPanelHandlers, setupAssetEvents, updateContentVisibility, handleAssetWheel, handleDrop/createTemporaryAssetFromFile, handleAssetSave/handleAssetSaveChanges/handleAssetShowInExplorer, autoResizePanelHeight, showSaveSuccessMessage/showSaveErrorMessage/showErrorMessage, shouldShowUnsavedIndicator, плюс delegate-методы для контроллеров). Архитектура: 3099→1154 строк (62% сокращение).

**Двухпанельная архитектура**: левая панель фолдеров (FoldersPanel), правая панель превью ассетов (AssetPanel с табами)
- **Система табов**: создание табов перетаскиванием папок на контейнер табов (AssetFoldersController)
- **Multi-select поддержка**: множественный выбор через Shift+клик и Ctrl+клик (AssetSelectionController)
- **Горизонтальный скролл**: навигация по табам колесом мыши и средней кнопкой
- **Drag-and-drop**: перетаскивание ассетов на канвас (AssetDragDropController), импорт PNG из системы
- **Контекстные меню**: правый клик для дополнительных действий (AssetItemActionsController)
- **Фильтрация**: поиск и фильтр по типу ассета (AssetFilterController)
- **Оптимизация производительности**: `FoldersPanel.updateLayout()` обновляет только обрезку имен при ресайзе без пересоздания DOM
- **Type-specific иконки**: когда asset.type соответствует ID из AssetTypes каталога, grid-превью и list-row fallback рендерят minimalist SVG-иконку (через `AssetTypeIcons.buildTypeIconSvg()`) вместо color-swatch + первой буквы имени; ассеты без каталога-типа (регулярный импортированный контент) сохраняют старое поведение (color + буква)

### UIFactory
**Файл**: `src/utils/UIFactory.js`
- Унифицированное создание UI элементов
- 10 методов создания компонентов

### ValidationUtils v2.0
**Файл**: `src/utils/ValidationUtils.js`
- StateManager-based валидация
- Component Readiness Tracking
- Validation Caching
- Enhanced Fallback Logic

### Logger
**Файл**: `src/utils/Logger.js`
- 29 категорий, 4 уровня (DEBUG, INFO, WARN, ERROR)
- Все прямые вызовы console.* заменены на Logger в исполняемом коде

### ErrorHandler
**Файл**: `src/utils/ErrorHandler.js`
- Централизованная обработка ошибок
- Глобальные перехватчики
- Стратегии восстановления

### BaseModule (v4.0.0 Phase A: новый общий метод)
**Файл**: `src/core/BaseModule.js`
- Базовый класс для всех модулей и контроллеров
- Паттерн владения (owner + стандартные сеттеры для `levelEditor`, `stateManager` и др.)
- **v4.0.0 Phase A**: добавлен общий метод `hasActiveMouseOperation()` — проверка активной операции мыши (объединённый хелпер для LevelFileOperations/ProjectFileOperations/других BaseModule-классов, заменил дублирующиеся приватные копии `_hasActiveMouseOperation()` в разных файлах; DRY-улучшение)

### PerformanceUtils (v4.0.0 Phase A: composition-рефакторинг)
**Файл**: `src/utils/PerformanceUtils.js`
- throttle, debounce, memoize
- batchRAF, LRUCache
- Применение: MouseHandlers throttled (8ms mousemove, 16ms wheel)
- **v4.0.0 Phase A**: `memoizeWithInvalidation()` теперь реализован через композицию с `memoize()` вместо дублирования cache-логики (устранено дублирование бизнес-логики кэша)

### SearchUtils
**Файл**: `src/utils/SearchUtils.js`
- Унифицированная система поиска
- Рекурсивный поиск по иерархическим структурам
- Используется в Outliner/Layers/Assets, а также в SettingsPanel (единый поиск в шапке окна, см. ниже)

### SnapUtils (v4.0.0 Phase A: новые статические методы)
**Файл**: `src/utils/SnapUtils.js`
- Утилита для snap-to-grid функциональности
- **v4.0.0 Phase A**: добавлены два новых статических метода:
  - `findNearestSnapGridPoint(anchorX, anchorY, stateManager, level, userPrefs)` — поиск ближайшей точки сетки snap (используется в `DuplicateOperations.confirmPlacement()` и `MouseHandlers.dragSelectedObjects()`)
  - `computeBottomLeftSnapDelta(gridPoint, referenceObject, objectOperations)` — вычисление дельты смещения для bottom-left snapping (устраняет дублирование inline-логики в двух местах)

### Grid Renderers (v4.0.0 Phase A refactor: Template Method pattern)
**Файлы**: `src/utils/gridRenderers/BaseGridRenderer.js`, `src/utils/gridRenderers/RectangularGridRenderer.js`, `src/utils/gridRenderers/DiamondGridRenderer.js`, `src/utils/gridRenderers/HexagonalGridRenderer.js`
- **Template Method паттерн**: `BaseGridRenderer.render()` стал конкретным методом, реализующим Template Method (save ctx state → check shouldRenderGrid → draw background → call `drawGrid()` → restore ctx state), абстрактный метод `drawGrid(ctx, gridSize, camera, viewport, options)` для переопределения в наследниках
- **Наследники** (RectangularGridRenderer, DiamondGridRenderer, HexagonalGridRenderer) теперь реализуют только `drawGrid()` вместо полного `render()` — дублирование boilerplate-кода устранено (DRY-улучшение)

### SettingsPanel — поиск параметров по всему окну
**Файлы**: `src/ui/SettingsPanel.js`, `src/ui/panel-structures/SettingsSectionConstructor.js`
- Один инпут `#settings-search-input` в шапке окна Settings (`.settings-header-controls`, рядом с кнопкой `⋮`), создаётся в `createSettingsPanel()` через `SearchUtils.createSearchInput(...).outerHTML`. Выравнивание по правому краю — за счёт `justify-content: space-between` у `.settings-header` (`styles/settings-panel.css`).
- `setupNewEventHandlers()` вешает `SearchUtils.setupSearchListeners` на этот инпут один раз (guard через `dataset.searchWired`, т.к. `show()`/`hide()` не пересоздают DOM панели). Отдельный keydown-listener на том же инпуте, зарегистрированный раньше слушателя SearchUtils, вызывает `e.stopPropagation()` при Escape с непустым значением — первое нажатие Escape только очищает текст, второе (когда поле уже пусто) всплывает к глобальному Escape-обработчику и закрывает панель.
- `filterSettingsContent(term)` фильтрует всё содержимое `#settings-content` (текущей открытой вкладки): для каждого `<label>` скрывает/показывает `label.parentElement`; `.hotkey-item`/`.hotkey-description` вкладки Hotkeys (там нет `<label>`) обрабатываются отдельно тем же термином; `.settings-section` скрывается целиком, если после фильтра не осталось видимых строк. Вызывается из `setupSettingsInputs()` при каждом рендере/переключении вкладки — уже введённый термин переприменяется к новому содержимому.
- Видимость строк переключается через локальную функцию `setRowVisible(el, visible)`: перед скрытием (`display:none`) исходное значение `style.display` кэшируется в `el.dataset.searchOrigDisplay` и восстанавливается из кэша при показе (а не сбрасывается в пустую строку) — это сохраняет инлайн `display:flex` у обёртки цветового инпута (`SettingsSectionConstructor.createSettingsColorInput`, inline-режим) и других строк с нестандартным инлайн-display.
- Работает одинаково на всех вкладках (включая Grid & Snapping, где лейблы — `.settings-label`), а не только на тех, что используют `createSettingsSection`.
- `createSettingsSection(title, content, options)` поиск больше не добавляет (простой `<h4>{title}</h4>`); единственный оставшийся эффект `options` — секция всегда получает CSS-класс `settings-section` (маркер для `filterSettingsContent`, ранее класс был опциональным).

### SettingsPanel — range-слайдер и единая раскладка параметров (createSettingsRow)
**Файлы**: `src/ui/panel-structures/SettingsSectionConstructor.js`, `src/ui/panel-structures/SettingsPanelRenderers.js`, `src/ui/GridSettings.js`, `src/ui/SettingsPanel.js`, `styles/settings-panel.css`
- **`createSettingsRow(label, forId, controlHtml, options)`** — новый переиспользуемый базовый блок для однострочной раскладки: рендерит label слева (`flex 0 0 40%, text-align: right`) + control справа (заполняет остаток строки). Базовый строительный блок для единообразного применения ко всем типам settings-контролов.
- **`createSettingsRange(rangeConfig)`** теперь **всегда** использует `createSettingsRow` — label слайдера рендерится в одной строке со слайдером, а не над ним (раньше выглядело как `<div>{label}</div><div class="settings-range-wrapper">...</div>`). Сама разметка `.settings-range-wrapper` содержит три элемента: `<input type="range" class="setting-input settings-range-input" data-unit="...">`, `<span class="settings-range-value">` (текущее значение поверх слайдера) и скрытый `<input type="number" class="settings-range-edit" tabindex="-1">` для ручного ввода. Используется во всех вкладках, рендерящихся через `SettingsPanelRenderers.js` (General/Camera/Selection/Touch/Performance и т.д.).
- **Баг: 21 место в `SettingsPanelRenderers.js` (Selection/Touch/Camera/Assets/Performance вкладки)** было ДУБЛИРОВАТЬ label: отдельный вызов `createSettingsLabel(...)` ДО `createSettingsRange({label: ...})`, а сам `createSettingsRange` ВСЕГДА рендерил свой label внутри — то есть label выводился дважды на экране. Эти избыточные отдельные вызовы `createSettingsLabel` **удалены** — label теперь рендерится один раз, внутри `createSettingsRange`/`createSettingsRow`.
- `GridSettings.js` (слайдер `#grid-opacity`) использует свою разметку (класс `settings-input`, а не `setting-input`) и вручную оборачивается в ту же структуру `.settings-range-wrapper` + `.settings-range-value` + `.settings-range-edit` (не вызывает `createSettingsRange`).
- **`createSettingsColorInput()` с опцией `inline: true`** теперь тоже использует `createSettingsRow` вместо дублирующего инлайн-кода (поведение не изменилось, просто переиспользует общий блок).
- `SettingsPanel.setupRangeSliders()` (вызывается в конце `setupSettingsInputs()`) один раз оживляет все `input[type="range"]` внутри `#settings-panel-container`, находя их по типу элемента (а не по CSS-классу — специально, чтобы одинаково работать и для `createSettingsRange`-слайдеров, и для слайдера `GridSettings.js` с другим именем класса): живое обновление `.settings-range-value` на `input` (юнит берётся из `data-unit`), двойной клик по `.settings-range-wrapper` открывает `.settings-range-edit` (класс `.editing` на wrapper), `Enter` кламппит значение по `min`/`max` и диспатчит `input`+`change`, `Escape` отменяет без применения, `blur` — применяет.
- `styles/settings-panel.css`: `.settings-range-wrapper` получил `flex: 1 1 auto; min-width: 0;` — растягивается на всю доступную ширину строки рядом с label (работает только когда wrapper — flex-item внутри `createSettingsRow`). Трек слайдера толще (`height:9px`), `::-webkit-slider-thumb`/`::-moz-range-thumb` скрыты через `opacity:0`, `.settings-range-value` спозиционирован абсолютно по центру с `pointer-events:none`, `.settings-range-wrapper.editing` переключает видимость слайдер/числовой инпут.
- **Progress fill** (цветная заливка трека до текущего значения): CSS custom property `--range-fill` (проценты) управляет градиентом `.settings-range-input::-webkit-slider-runnable-track` (`linear-gradient(to right, var(--accent-color) 0%, ...)`). Firefox использует нативный `::-moz-range-progress`. `setupRangeSliders()` держит `--range-fill` в синхроне через `updateFill()` на каждое событие `input`.

---

## 📊 Менеджеры системы

### StateManager
**Файл**: `src/managers/StateManager.js`
- Централизованное управление состоянием
- Кеширование для производительности

### HistoryManager
**Файл**: `src/managers/HistoryManager.js`
- Полная поддержка Undo/Redo
- Оптимизированное хранение изменений
- `exportState()`/`importState()` — снятие/восстановление undo/redo стека (используется при переключении уровней)

### LevelsManager (v3.57.0 Phase 1-6)
**Файл**: `src/core/LevelsManager.js`
- Управление множеством открытых LevelSession (инфраструктура для multi-level)
- **Основные методы** (Фаза 1-5):
  - `addLevel(level, opts)` — регистрация новой сессии уровня; отслеживает `levelMRU` для fallback
  - `setCurrentLevel(levelId)` — переключение уровня (сохраняет/восстанавливает camera, selectedObjects, groupEditMode, currentLayerId, history без полного `stateManager.reset()`); обновляет `levelMRU`
  - `closeLevel(levelId)` (Фаза 5) — закрытие вкладки уровня; использует MRU fallback при закрытии текущего
  - `getCurrentSession()`, `getOrderedSessions()`, `getVisibleSessions()` — запросы к сессиям
  - `toggleLevelVisibility(levelId)` — управление видимостью уровня в UI; soft-cap warning при >5 видимых
- **Методы Фазы 6** (edge cases и полировка):
  - `getVisibleSessionsForRender(sessions?)` — видимые уровни в порядке рендера (текущий ВСЕГДА в конце)
  - `reorderLevels(newOrder)` — drag-reorder табов уровней; валидирует полную перестановку
  - `cycleLevel(direction)` — циклическое переключение (+1 следующий, -1 предыдущий); используется для Ctrl+PageDown/PageUp
  - `hasAnyUnsavedChanges()` — проверка несохранённых изменений во всех открытых уровнях
- **Жизненный цикл**: **Фаза 1** — внутренняя инфраструктура (LevelSession, history switching). **Фаза 2** — LevelsPanel UI-компонент (список, видимость, переименование). **Фаза 3** — composition-рендеринг нескольких видимых уровней (параметризация `getVisibleSessions()`). **Фаза 5** — closeLevel, per-session save/dirty. **Фаза 6** — levelMRU fallback, cycleLevel, getVisibleSessionsForRender (z-order fix), reorderLevels (drag-reorder UI), soft-cap warning.

### CacheManager (v3.57.0: multi-level namespacing)
**Файл**: `src/managers/CacheManager.js`
- Централизованный менеджер кэшей
- O(1) операции, smart invalidation
- TTL Cache, LRU Strategy
- **Multi-level namespacing** (Фаза 3): `objectCache`, `topLevelObjectCache`, `effectiveLayerCache`, `_layerToObjectIds` используют ключ `${levelId}:${objId}` вместо голого `${objId}` — защита от коллизий object id между одновременно открытыми уровнями (каждый уровень обычно имеет объекты 1, 2, 3..., которые не пересекаются id, но могут конфликтовать в общем кэше при вычислении effective-layer или при bulk-lookups). Внутренний метод `_namespacedKey(id)` возвращает `${editor.currentLevelId}:${id}` — осознанное решение не передавать `level` параметром (не менять ~15 external call sites), вместо этого неявно используется текущий уровень как scope кэша.

### ConfigManager (v4.0.0 Phase A refactor)
**Файл**: `src/managers/ConfigManager.js`
- Управление конфигурацией (editor.json, ui.json, canvas.json и др.)
- **v4.0.0 Phase A**: удалён неиспользуемый мёртвый метод `loadDefaultConfigs()` (~106 строк); единственный живой метод — `getDefaultConfigs()` (DRY-улучшение)

### AssetManager & FileManager (v4.0.0 Phase A: новый null-safe метод)
**Файл**: `src/managers/AssetManager.js`, `src/core/LevelFileOperations.js`
- **AssetManager**: управление библиотекой ассетов, сканирование папки `content/`, кэширование изображений
  - **v4.0.0 Phase A**: добавлен метод `getAssetById(id)` (null-safe алиас к существующему `getAsset(assetId)`, устраняет краш в AssetItemActionsController.handleAssetClick при доступе к несуществующему методу)
  - **AssetTypes каталог** (`src/constants/AssetTypes.js`): 29 предопределённых типов ассетов в 6 категориях (Core: Camera, Actor, Image, ImageAtlas, Volume, Player Start; Visual/Render: SpriteAnimationClip, Tileset, Tilemap, NineSliceSprite, FontTextStyle, ParticleEffect, MaterialShaderPreset, Light; Audio: SoundEffect, MusicTrack, AudioZone; Data/System: DialogueGraph, QuestObjective, ItemDefinition, InventorySchema, LocalizationTable, SaveSchema, InputMap; Navigation/AI: PathSpline, NavMesh, AIBehaviorPreset; Other: Prefab, SequenceCutscene). `Player Start` — это не только тип ассета, но и auto-managed GameObject marker (ровно один на уровень, auto-создание при отсутствии, валидация в DetailsPanel/LevelFileOperations статистике) — через меню Assets → Add → Core → Player Start теперь можно вручную создать placeholder-ассет, который при размещении на уровне создаёт GameObject с `type='player_start'`, распознаваемый существующей системой. Вспомогательные функции `getAssetTypeById(id)`, `getAssetTypesByCategory(categoryId)`, `getAssetCategoriesWithTypes()`
  - **ComponentTypes каталог** (`src/constants/ComponentTypes.js`): 19 типов компонентов (Collider, Trigger, TransformAnimation, SpriteUiAnimation, Interactable, Pickup, DialogueTrigger, DamageHealth, MovablePushable, MountableVehicleSeat, PathFollower, Spawner, StateMachineBehavior, PlayerStart, CheckpointSavePoint, ClimbableLadder, ConveyorZiplineJumpPadPortal, DestructibleContainer, VariableModifier) — editor-side metadata-стабы ({id, type, enabled, properties}), которые прикрепляются к Asset/GameObject; runtime-поведение реализуется в game engine, который импортирует JSON; вспомогательные функции `getComponentTypeById(id)`, `createComponentStub(typeId)`
  - **AssetTypeIcons** (`src/constants/AssetTypeIcons.js`): минималистичная гліфическая библиотека (stroke SVG, 24×24px) для каждого типа ассета/компонента; функция `buildTypeIconSvg(typeId, color, size)` возвращает inline `<svg>` строку
  - **createPlaceholderAsset(typeId, customName?, folderPath = 'root')**: создание заполнителя-ассета без реального контента (цвет и размеры используют опциональные `typeDef.color`/`width`/`height` если заданы, иначе дефолты категории/48×48, type-иконка в превью вместо color-swatch+букв, поле `properties.placeholder = true`); `path` строится от `folderPath` (текущая выбранная папка в Asset panel), а не от категории — иначе ассет попадал бы в отдельную category-папку вместо текущей. Если в `DEFAULT_ASSET_COMPONENTS[typeId]` определены default-компоненты, они автоматически создаются через `createComponentStub()` и прикрепляются к `components[]` ассета
  - **Asset.components** и **GameObject.components**: новые поля (массив component stubs, дефолт `[]`), сохраняются в `toJSON()`, копируются в экземпляры при размещении GameObjects через `createInstance()`; `components` также участвует в `Asset.hasChangesFromOriginal()`/`saveOriginalState()` (dirty-check)
- **FileManager**: сохранение/загрузка уровней
- **Menu Integration** (`config/menu.js`): новое меню "Add" (id остаётся `assets`, вставлено между View и Settings) — иерархия категория→тип→действие (label = имя типа, без префикса "New"); `buildAssetsMenu()` динамически генерирует меню из каталога; каждый пункт вызывает `LevelEditor.createAssetOfType(typeId)`, который берёт текущую папку через `assetPanel.getActiveTabPath()`, передаёт её в `createPlaceholderAsset()` и шлёт `Logger.status.success/error` в строку состояния; `MenuManager.createSubmenuItem()` — поддержка вложенных submenu-ов (flyout dropdown); каждый пункт типа получает иконку из `buildTypeIconSvg()` и `disabled: isRootFolderSelected` (дизейбл при выборе корневой папки); `getAssetCategoriesWithTypes()` gruppирует типы по категориям для обоих меню (nav "Add" и AssetPanelContextMenu "Add")
- **Asset Editor float** (`src/ui/asset-editor/*` + dock contentTypes `assetPreview`/`assetIdentity`/`assetComponents`/`assetComponentDetails`): float dock (`fw.role = 'assetEditor'`); `showActorPropertiesPanel` → `editingAssetId` + `openAssetEditorWorkspace`; live `updateAsset` / `patchEditingComponent`. **Identity** — name/size/color/category/tags (image path read-only from Sprite). **Components** — unique-by-id; **Sprite** owns texture `src`; Add at top. **Details** — live input → Preview/HUD. **Preview** — mini-viewport; sprite body independent of colliders; **all** colliders/triggers as stroke frames; F/A frame. Interactive handles later.

---

## 📦 Core модули

### LevelEditor Controllers (v3.60.0 Phase 3: Фаза 3 декомпозиции)
**Файлы**: `src/core/EditorConfigController.js`, `src/core/EditorLifecycleController.js`, `src/core/EditorPreferencesController.js` (все extends BaseModule)
- **EditorConfigController** — инициализация конфигурации и применение настроек к редактору; основные методы: `applyConfiguration()`, `_applyColorConfiguration()`, `_applyGridConfiguration()`, `_syncGridSettingsToUI()`, `applyConfigurationToLevel()`, `_saveDefaultConfiguration()`. Обрабатывает загрузку конфига, применение grid-параметров, синхронизацию с UI.
- **EditorLifecycleController** — инициализация DOM, рендерера, UI-компонентов и event-системы; основные методы: `initializeDOMElements()`, `initializeRenderer()`, `initializeUIComponents()`, `initializeEventHandlerManager()`, `initializeMenuAndEvents()`, `setupPanelSizeListeners()`, `maybeShowSplashOnFirstVisit()`. Отвечает за bootstrap-этап редактора до полной готовности.
- **EditorPreferencesController** — применение сохранённых пользовательских настроек (размеры панелей, язык, автосохранение); основные методы: `applySavedPanelSizes()`, `applyTabOrderSettings()`, `setupAutoSaveOnUnload()`, `setupAutoSaveOnVisibilityChange()`. Управляет персистентностью пользовательского UI-состояния.
- Извлечение завершено в Фазе 3 декомпозиции LevelEditor.js (было 2399 строк → 1583 строка); LevelEditor.js остаётся в allowlist with comment "Фаза 3 done (2399→1583); остаток — backlog".

### HistoryOperations (v3.40.0)
**Файл**: `src/core/HistoryOperations.js`
- Централизованный модуль undo/redo
- Восстановление состояния

### LayerOperations (v3.41.0 / U4)
**Файл**: `src/core/LayerOperations.js`
- Управление слоями объектов; adjacent / extreme moves (PageUp/PageDown)
- **U4**: `moveSelectedObjectsToLayerId` + `buildMoveToLayerMenuItems` — context menu Move to Layer (Canvas/Outliner); locked/current disabled
- Batch processing, smart caching

### ViewportOperations (v3.44.0)
**Файл**: `src/core/ViewportOperations.js`
- Управление viewport и камерой
- Zoom, pan, focus операции

### Phase B dock + multi-viewport (B0–B5 done; B6 docs)
**Файлы**: `src/ui/dock/*`, `src/core/ViewportViewManager.js`, `src/core/ViewportViewNav.js`, `src/ui/dock/ViewportLeafChrome.js`, `src/utils/TypeFilterMenu.js`, `styles/dock.css`

- **Dock shell only**: `editor.dockManager` (`DockManager` + tree/renderer/drag/persistence/registry/factory). Layout: `panels.dock.mainTree` + `panels.dock.floatingWindows`. `PanelPositionManager` / `src/ui/panels/*` **удалены** (B5); `grep panelPositionManager src` = 0.
- **UI customize key (Shift)**: `isDockCustomizeKey` — only while Shift held: move/split panels, self-drop clone, detach to floating (Shift+drag header gap to empty space — no leaf-header detach icon, DK-ICO), floating snap/ungroup, drop-zone & snap highlights. **DK-CUR**: leaf header drag-gap cursor is `pointer` by default; `grab`/`grabbing` only while `body.dock-customize` (`bindDockCustomizeModeClass` on Shift). **DK-CLS**: leaf-header close × is hidden unless `body.dock-customize` and that header is `:hover` (CSS only; floating-window chrome × unchanged). **DK-GST**: when Shift-drag has no dock drop target, `float-detach-ghost` previews the floating window (`floatDetachLayoutFromClient` + `DockDropOverlay.showFloatDetachGhost`; drop uses the same layout). **DK-CLP**: click leaf header gap (no Shift) collapses a leaf when its parent is a **column** split and the sibling can take space (`leaf.collapsed`, flex `0 0 auto` + hide body/resizer; `sanitizeCollapsedFlags` after restructure). Floating free-move chrome keeps grab without Shift; corner resize grip shows only when pointer is in the window’s bottom band.
- **Floating vs workspace**: on browser/workspace resize, floating clusters keep **relative** position (`DockFloatWorkspace.applyFloatingWorkspaceResize`). Optional edge snap (`panels.dock.floatEdgeSnap`, default on) + margin (`panels.dock.floatEdgeMargin`, default 8px) pins free-moved windows to workspace edges within threshold; edge-affined clusters re-pin on resize.
- **Content types**: viewport, outliner, details, layers, levels, assets. Multi-instance via `DockPanelFactory` (`isMultiInstanceType`); primary parks in content pool, copies destroy on close. Viewport multi-leaf (B4.2).
- **D1 Assets copy UI persist**: copies save tabs/size/viewMode/foldersWidth to `ui.assetCopyUiState[instanceKey]` (`AssetPanel.getCopyUiState` / `patchCopyUiState`; flush on `savePanelUiPreferences`). Primary keeps global `ui.assetSize` / `assetViewMode` / `foldersWidth` + `editor.view.activeAssetTabs*`.
- **D2 Outliner copy filters**: primary only writes `outliner.activeTypeFilters`; secondary leaves keep a local `Set` (search already per-instance; selection/collapsed shared).
- **View → Panels** lists dock contentTypes (`showContentType` / `hideContentType` / `toggleContentType`); Alt+1/2/4 → Outliner/Details/Assets; Immersive Mode snapshots dock layout (viewport-only).
- **ViewportViewManager**: N peer viewport leaves (VP-EQ), each with canvas + `localCamera` + type filters + camera source + **owned** `displayOptions`.
  - **VP-EQ**: leaves are equal for display/filter/work camera. `isPrimary` is only the dock **shell** flag (hosts legacy `#main-canvas` DOM) — not settings authority. `setDisplayFlag` never writes global state; new views seed independent `displayOptions` snapshots. Menu/hotkeys target under-cursor → focused → any. Close ×: any leaf when ≥2 viewports; last one non-closeable; promote-to-shell carries pose/display/filters.
  - **Work camera**: every leaf uses `localCamera`; focused work view mirrors into `stateManager.camera` for level save.
  - **Game camera**: source `{ kind:'game', objectId }` follows level object `type==='camera'`. Pan/zoom/F/A **do not** switch to work — `updateCamera` writes pose into that Camera object (`_applyPoseToGameCamera`). Explicit switch only via chrome **Work camera** / `setSource`. Jump-to-camera binds `source: game` (not a work bake).
  - **C1/C2/C4 camera view**: `drawCameraViewFrames` — dashed world frustum per camera object (center = object center, size = design res / `properties.zoom`). Design size from `properties.aspect` presets (`CAMERA.ASPECT_PRESETS`: 16:9/4:3/1:1/3:2/21:9) or custom `resolutionWidth/Height` (`CameraAspectUtils.getCameraDesignSize`). Skipped for the camera driving the current viewport. **C2**: game-source viewport gets screen-space letterbox (`drawGameCameraAspectMask` via `getAspectSafeRect`) + soft vignette (`properties.vignette`, default `CAMERA.VIGNETTE_STRENGTH`) + optional `letterboxColor`; Details Camera section: Aspect / Resolution / Vignette. **C4 adaptive fit (UI preview)**: `resolveGameCameraObject` / `resolveAdaptiveGameCameraPose` scales view zoom so the design frustum exactly fills the letterbox safe-rect on any viewport size/aspect; `properties.zoom` stays design-space (inverse in `_applyPoseToGameCamera`). Overlay zoom for game source shows design zoom. **Self-camera hide**: game-source leaf does not draw the driving camera object's asset/selection/boundary (only letterbox/vignette/safe-frame + other cameras' frustums).
  - **C3 multi-camera**: exclusive `properties.isMain` (Details Main; first placed auto-main). `getMainCameraObject` / `setMainCamera`. **Toggle** work ↔ last/selected game: hotkey `.` + **click** viewport cam icon; **RMB** cam icon opens source menu (Work + cameras ★). `setSource` always `refreshAllViewportChrome` (icon color/title/active) and stores `lastCameraObjectId` on game bind. Cycle `]`/`[` still cycles game cameras. Main frustum `CAMERA.FRAME_COLOR_MAIN` (gold).
  - **VP-HK**: `getViewUnderCursor()` / `viewFromClientPoint` — hotkeys F/A/Grid/Boundaries/Collisions/Parallax (and jump/cycle camera) target the leaf under the cursor; `getDisplayFlag` / `toggleDisplayFlag` are per-view only. **OL-F**: if F is pressed while the cursor is over Outliner, route to `OutlinerPanel.scrollToSelection()` instead of framing the viewport.
  - **VP-TB**: each secondary leaf mounts its own `Toolbar` copy; View toggles + Focus apply to the paired leaf; File/Edit/Group/Play/Snap remain global.
- **ViewportLeafChrome**: leaf header icons — camera source menu (English UI) + per-view type filter via shared `TypeFilterMenu` + **VP-EYE** eye icon (per-view display checklist); hover-switch between sibling menus after first open (main-menu style). Split across 3 files (400-line guardrail): `ViewportLeafChrome.js` (icon buttons, public API), `ViewportLeafMenus.js` (dropdown bodies), `ViewportLeafChromeState.js` (shared hover/close state + `syncViewportChromeState` DOM sync) — no circular import between them.
- **Input**: secondary canvases share `MouseHandlers` via `ViewportViewNav` (`registerCanvas` + `setPointerCapture` LMB/MMB/RMB). Interaction routing: `_interactionViewLeafId` / `getInteractionView|Camera|Canvas` — never assume `canvasRenderer.canvas` is the gesture leaf after multi-view `render()` restores primary. Global mousemove keeps `mouse.x/y` current for under-cursor hit-tests.
- **Gestures outside leaf**: continue pan/zoom/drag/marquee; outside release **completes** (not cancel); `body.viewport-gesture-mode` blocks UI hover (like `panning-mode`) only for real gestures (`isDragging` / marquee / transform / viewport pan-zoom) — not bare LMB down (avoids swallowing the first panel click). Cursors set only on interaction canvas; end/blur resets all viewport canvases.
- **Render**: multi-target; `visibleObjectsCache` key includes canvas size; sticky interactive cache during drag/transform/marquee; pick/marquee use interaction camera + client→buffer mapping when CSS size ≠ buffer.
  - **VP-BND**: debug overlays (boundaries / hit-test / collisions) and group-edit frame stroke scale use the **frame** camera from `_renderFrame`, not focused `stateManager.camera` — peer zoom no longer changes line width / hit-box padding on sibling views.
  - **VP-OVL**: per-view DOM HUD (`ViewportInfoOverlay`) on `measureEl` — camera name, zoom, active flag badges (P/B/C), level name + object/layer/selection stats. Toggle `displayOptions.infoOverlay` via eye menu **Info** (default on). Updated each `RenderOperations.render`; pointer-events none.
- **Close ×**: any viewport closeable when ≥2 exist; closing shell promotes another leaf (carry pose/display).

### LevelFileOperations (v3.57.0 Phase 5 multi-level)
**Файл**: `src/core/LevelFileOperations.js`
- **Файловые операции уровней с поддержкой multi-level сессий** (Фаза 5):
  - `newLevel()` — создание нового уровня ДОБАВЛЯЕТ его как новую вкладку/LevelSession через `levelsManager.addLevel()`, а не заменяет текущий открытый уровень. Больше НЕ вызывает `stateManager.reset()` — reset сбрасывал бы глобальное UI-состояние (view/panels/ui), что неверно для добавления вкладки.
  - `openLevel()` — открытие уровня из файла ДОБАВЛЯЕТ его как новую сессию; дополнительно проверяет "уже ли открыт" по `fileName` (best-effort dedup) — если файл уже открыт, переключается на существующую вкладку вместо дубликата. Аналогично `newLevel()`, НЕ вызывает `stateManager.reset()`.
  - `saveLevel()` / `saveLevelAs()` — сохраняют per-session имя файла (`session.fileName`), а не глобальное `FileManager.currentFileName`. Гарантирует что сохранение уровня B никогда не перезапишет файл уровня A. После сохранения: `session.isDirty = false`.
  - `closeLevel(levelId)` (новый, Фаза 5) — закрытие вкладки уровня; на `LevelsManager`. Нельзя закрыть последний открытый уровень. Проверяет `session.isDirty` и спрашивает подтверждение при наличии несохранённых изменений. При закрытии текущего уровня переключается на первый из оставшихся уровней в `levelOrder`.
  - Per-level `isDirty` (Фаза 5) — каждая LevelSession трекит свой `isDirty` флаг независимо. `LevelsManager.setCurrentLevel()` снапшотит/восстанавливает глобальный `stateManager.isDirty` при переключении между вкладками, позволяя существующему коду работать без изменений (через единый глобальный флаг).
  - Per-level visible индикатор в LevelsPanel — точка в панели теперь точна для всех вкладок, не только текущей (может быть прочитана из `session.isDirty` каждой открытой сессии).

### PlayOperations (v4.4.0 Фаза 3: Play-in-editor)
**Файл**: `src/core/PlayOperations.js`
- Запуск игрового режима в редакторе через fullscreen canvas overlay; валидирует PlayerStart, сериализует текущий уровень через ProjectExporter, создаёт GameEngine; методы `play()`/`stop()`/`toggle()`/`isPlaying()`
- Триггер — пункт **Game > Play** в главном меню (`config/menu.js`, `LevelEditor.togglePlayMode()`); Toolbar больше не содержит кнопку Play (перенесена в меню).

### GameBuildOperations (v4.5.0, Game menu "Build...")
**Файл**: `src/core/GameBuildOperations.js`
- У браузерного редактора нет shell/fs-доступа для запуска esbuild напрямую. `buildGame()` сохраняет проект (как File > Save Project) и генерирует `build-game.bat`, запускающий `npm run build:game` (через `FileUtils.saveDataDirectly`, native save-picker). Оба файла нужно положить рядом с `package.json`. Триггер — **Game > Build...** в главном меню.

### Engine release build (v4.4.1 Фаза 4, minimal cut)
**Файлы**: `src/engine/index.js` (bundle entry — `GameEngine`/`EntityFactory`/`BehaviorRegistry`/`ProjectLoader`), `scripts/build-game.mjs`, `scripts/build-addon.mjs`/`build-event.mjs` (stubs)
- `npm run build:game -- --project=<saved-project.json> [--out=dist/game]` — reads an editor-saved `Project.toJSON()` file (no live browser access from Node), derives a manifest via the same `ProjectExporter.export()` Play-in-editor uses, bundles `src/engine/index.js` standalone through esbuild, copies `content/` verbatim, writes `player.html`. No "include in build" level flag or asset-usage-graph trimming yet — every level/asset ships as-is; see `tmp/2D_Editor_ENGINE_PLAN.md` §4 for the deferred full-criterion scope.

### RenderOperations (v4.0.0 Phase A refactor + v3.57.0 Phase 3-6 multi-level)
**Файл**: `src/core/RenderOperations.js`
- Операции рендеринга с композитингом нескольких видимых уровней
- **Multi-level композитинг** (Фаза 3): `render()` итерирует по `editor.levelsManager.getVisibleSessions()` и рисует объекты всех видимых уровней в одном кадре. Видимость = `session.visible` (per-level eye-icon в LevelsPanel), не зависит от "текущий" статуса уровня.
- **Z-order рендера** (Фаза 6): Текущий уровень ВСЕГДА рисуется поверх остальных видимых уровней, независимо от позиции таба, через `editor.levelsManager.getVisibleSessionsForRender()` — переносит текущую сессию в конец массива компоузинга (она обрабатывается последней, рисуется поверх). Решение плана раздел 12 пункт 2, не реализованное полностью в Фазе 3 (раньше `render()` просто итерировал по `getVisibleSessions()` в tab-порядке), исправлено в Фазе 6.
- **v4.0.0 Phase A refactor**: добавлены приватные хелперы `_getValidCanvasOrNull(camera, level)` и `_computeExtendedViewportBounds(camera, canvas)`, устраняющие тройное дублирование preamble-проверок в `getVisibleObjectsSpatial()`/`getVisibleObjectsRegular()`/`getVisibleObjects()` (DRY-улучшение)
- **Multi-viewport (Phase B4.2)**: cache key includes canvas buffer size (shared camera ≠ shared frustum); during drag/transform/marquee — sticky visible cache + full cull scan; refresh spatial/visible caches on gesture end
- **Non-composited элементы** (привязаны к текущему уровню только): grid/фон/selection-рамки/hierarchy-highlight/group-edit-frame/duplicate-ghost/debug-overlays (boundaries/collisions) — НЕ рисуются для non-current видимых уровней. Дополнительно гейтятся `currentSessionVisible` (не рендерятся, если сам текущий уровень скрыт через eye-icon).
- **Dimming режимы** (isolate/solo/group-edit-mode) применяются ТОЛЬКО к текущему уровню; non-current видимые уровни всегда рендерятся нормально, независимо от этих режимов текущего.
- **Namespacing кешей**: `visibleObjectsCache` ключируется как `${levelId}_${cameraKey}` (защита от коллизии при совпадении camera-ключей между уровнями); `visibleLayersCache` стал `Map<levelId, {layerIds, timestamp}>`; `CacheManager` использует `${levelId}:${objId}` для всех object-кешей (effectiveLayerCache/objectCache/topLevelObjectCache) — защита от коллизий id объектов между одновременно открытыми уровнями.
- **Параметризация методов**: `getVisibleObjects()`, `getVisibleObjectsSpatial()`, `getVisibleLayerIds()`, `buildSpatialIndex()`, `getEffectiveLayerId()`, `collectVisibleObjectsRecursive()` и прочие получили опциональный параметр `level` (дефолт `this.editor.level`), сохраняя 100% обратную совместимость всех существующих вызовов.
- **Parallax при multi-level**: `renderParallaxObjects()` получила параметр `level`; `ObjectOperations.getObjectWorldBounds()` получила параметр `level` — правильный рендер parallax-объектов на non-current видимых уровнях.
- **Пространственный индекс**: `spatialIndex` был уже `Map<levelId, ...>` с Фазы 1, дополнительных правок не потребовалось.
- **Побочные фиксы**: объединены два дублирующихся метода `invalidateSpatialIndex()` в один `invalidateSpatialIndex(levelId = null)`; удалён мёртвый код (`this.editor.effectiveLayerCache` на несуществующем поле, неиспользуемый `clearEffectiveLayerCache()`).

### ObjectOperations (v4.0.0 Phase A refactor)
**Файл**: `src/core/ObjectOperations.js`
- Операции с объектами
- Выбор, выделение, свойства
- **v4.0.0 Phase A**: добавлен метод `ensurePlayerStartExists()` (логика автосоздания Player Start, перенесена из LevelEditor.js; тонкий делегат остался в LevelEditor.js для обратной совместимости)

### DuplicateOperations
**Файл**: `src/core/DuplicateOperations.js`
- Операции дублирования
- История операций

### GroupOperations
**Файл**: `src/core/GroupOperations.js`
- Операции с группами
- Иерархическая структура

---

## 🔄 Rotate/Scale жесты объектов

Мышиные жесты поворота и масштабирования выделения, работают на любом уровне вложенности (в т.ч. внутри групп).

- **Ctrl+drag** по объекту — вращение выделения вокруг центра общего world bounding box; **Shift** во время вращения — снап к ближайшему **абсолютному** углу с шагом, задаваемым в Settings → Selection ("Rotation Snap (Shift+drag, °)"), по умолчанию 15° (читается из `stateManager.get('selection.rotationSnapDegrees')` с fallback на `TRANSFORM.ROTATION_SNAP_DEGREES` если не задано).
- **Ctrl+Alt+drag** — равномерное масштабирование выделения относительно центра общего bounding box, клампится `TRANSFORM.MIN_SCALE_FACTOR` (0.05) / `TRANSFORM.MAX_SCALE_FACTOR` (20); **Shift** — снап фактора к шагу, задаваемому в Settings → Selection ("Scale Snap (Shift+drag, factor)"), по умолчанию 0.1 (10%, читается из `stateManager.get('selection.scaleSnapFactor')` с fallback на `TRANSFORM.SCALE_SNAP_FACTOR` если не задано).
- Если кликнутый объект не был выделен — становится единственным выделением (как при обычном drag).
- Ctrl+click без drag — по-прежнему toggle selection; Ctrl+drag по пустому месту — marquee toggle (не изменилось).
- **Alt+drag дублирование** теперь срабатывает только без Ctrl (Ctrl+Alt зарезервирован под scale) — см. `MouseHandlers.js`.
- Жест активируется при движении мыши ≥ `TRANSFORM.DRAG_THRESHOLD_PX` (4px) после Ctrl(+Alt)-клика на объекте (`mouse.transformPendingMode`).
- Константы: `TRANSFORM` в `src/constants/EditorConstants.js`.

**Модель данных**:
- `GameObject.rotation` — градусы, по часовой стрелке, вокруг центра объекта, default 0; сериализуется в `toJSON()`; `getBounds()`/`containsPoint()` rotation-aware.
- `Group.getBounds()` — учитывает rotation детей (через их rotation-aware `getBounds()`) и собственный rotation группы (консервативный AABB через `WorldPositionUtils.rotateBoundsAroundCenter`).

**Рендер** (`src/ui/CanvasRenderer.js`):
- `drawSingleObject` вращает вокруг центра объекта через `ctx.translate`/`ctx.rotate`.
- Если объект не имеет загруженного изображения (`obj.imgSrc` не задан/не загружен), вместо пустого цветного прямоугольника рисуется минималистичная SVG-иконка типа ассета (`buildTypeIconSvg`, из `AssetTypeIcons.js`) размером 50% от меньшего измерения (width/height) объекта, центрирована внутри fallback-прямоугольника. Иконка рисуется только для типов из каталога `AssetTypes.js` (вызов `getAssetTypeById(obj.type)` возвращает определение); для пользовательских типов — только цветной прямоугольник. Иконки растеризуются лениво через `getTypeIconImage(typeId)` и кэшируются по ключу `${typeId}|${color}` в `typeIconCache` (цвет берётся из CSS-переменной `--ui-active-text-color`).
- `drawGroup` вращает вокруг центра AABB детей; вложенные повёрнутые группы работают через стек ctx-трансформаций без дополнительного кода.

**Обработка жеста** (`src/event-system/MouseHandlers.js`):
- `startObjectTransform(mode, clickInfo, startWorldPos)` — снимает снапшот геометрии выделения (позиции, размеры, rotation, world-центр) в момент старта жеста, чтобы избежать накопления дрейфа при пересчёте на каждый `mousemove`.
- `transformSelectedObjects(worldPos)` — пересчитывает трансформацию из снапшота на каждое движение.
- `_snapshotChildrenForScale` / `_applyChildScale` — рекурсивный снапшот и масштабирование геометрии детей группы (позиции и размеры).
- История (undo/redo) сохраняется на `mouseup`, как у обычного drag; жест отменяется через `historyOperations.undo()` при отпускании кнопки вне canvas и при `window blur`.

**Rotation-chain через повёрнутых предков** (`WorldPositionUtils`, добавлено 2026-07-02) — position/bounds/hit-test для объекта, вложенного в ПОВЁРНУТУЮ группу-предка, теперь учитывают это вращение (было: только собственный `rotation` объекта, предки трактовались как translation-only — рамка выделения и hit-test расходились с реально отрисованной картинкой при повороте группы).
- `_findPlainPositionAndChain(target, levelObjects)` — DFS, который параллельно с обычной трансляционной суммой (`accX+current.x`) собирает цепочку повёрнутых предков-групп: для каждого предка с `rotation!==0` — `{pivotX, pivotY, rotation}`, где pivot = центр `ancestor.getBounds()` (тот же pivot, что `CanvasRenderer.drawGroup` использует для `ctx.rotate`, — совпадение проверено аналитически и в браузере). Чейн упорядочен снаружи→внутрь.
- `_applyRotationChain(x, y, chain)` — применяет вращения ОТ САМОГО ВНУТРЕННЕГО предка К САМОМУ ВНЕШНЕМУ (зеркалит порядок вложенности `ctx.save/rotate/restore` в рендере — вложенный `ctx.rotate` дочерней группы всегда применяется поверх уже активного вращения родителя).
- Композиция чистых 2D-вращений аддитивна независимо от пивотов — поэтому итоговый угол на экране = `Σ(ancestorRotations) + obj.rotation`; используется в `getWorldBounds`/`isPointInWorldBounds`/`getFrameGeometry` для точного AABB/hit-test/рамки без необходимости трансформировать все 4 угла через цепочку (для простых объектов — только через центр). Для GROUP-целей (у которых есть собственные вложенные повёрнутые дети) используется более общий путь: 4 угла локального (self-contained) bounds пропускаются через `_applyRotationChain`, берётся результирующий min/max.
- `getWorldPosition`/`getWorldBounds`/`isPointInWorldBounds`/`getWorldTransform`/`getFrameGeometry`/`worldPointToLocalPointInGroup`/`worldDeltaToLocalDelta` принимают в расчёт цепочку; поведение для НЕповёрнутых предков и объектов БЕЗ вложенности не изменилось (проверено регрессионными тестами в браузере).

**Единая рамка (frame) для всех режимов** (`RenderOperations`, добавлено 2026-07-02) — раньше `drawObjectSelectionRect` (индивидуальная рамка выделения) и `drawGroupEditFrame` (рамка открытой группы в group-edit-mode) были ДВУМЯ независимыми, руками написанными реализациями; `drawGroupEditFrame` вообще не учитывала rotation — при открытии повёрнутой группы её рамка рисовалась как axis-aligned прямоугольник, не совпадая с реально повёрнутой картинкой внутри. Обе теперь используют один и тот же примитив:
- `RenderOperations.strokeFrame(bounds, camera, {color, width, dash}, rotationDeg)` — единственное место, которое делает `ctx.translate/rotate/strokeRect`. Используется `drawObjectSelectionRect`, `drawAltDragSelectionRect`, `drawGroupEditFrame`, `drawDuplicateObjects`.
- `WorldPositionUtils.getFrameGeometry(obj, levelObjects)` — возвращает `{halfW, halfH, rotationDeg}`: для простых объектов — `obj.width/height` пополам + суммарный rotation (предки+свой); для групп — `group.getBounds(true)` (НЕповёрнутый собственным rotation'ом контент, «как если бы» группа не была повёрнута) + суммарный rotation. Центр рамки берётся ОТДЕЛЬНО из `getWorldBounds`-based bounds (уже включает parallax-сдвиг, инвариантен к rotation) — так рамка всегда совпадает с центром реально отрисованной картинки.
- `RenderOperations.getGroupEditFrameGeometry(group, padding)` — то же самое + паддинг 10px для рамки открытой группы; используется и для live-кадра, и для замороженного снапшота (`groupEditMode.frozenFrameGeometry`, сохраняется вместе с `frozenBounds` при Alt-drag-заморозке).

**Направление drag внутри повёрнутого предка** (`MouseHandlers.dragSelectedObjects`, добавлено 2026-07-02) — раньше мировая дельта курсора (`dx,dy`) добавлялась НАПРЯМУЮ к локальным координатам объекта (`obj.x += dx`), что верно только если ВСЕ предки неповёрнуты; при перетаскивании объекта внутри уже повёрнутой (открытой) группы объект двигался не в ту сторону, куда тянул курсор. Исправлено:
- `WorldPositionUtils.worldDeltaToLocalDelta(dx, dy, obj, levelObjects)` — инвертирует СУММУ ancestor-поворотов (композиция чистых вращений аддитивна и не зависит от пивотов, поэтому для дельты достаточно только суммы углов, без самих пивотов) и возвращает корректную локальную дельту.
- `WorldPositionUtils.worldPointToLocalPointInGroup(worldX, worldY, group, levelObjects)` — конвертирует мировую точку в координаты, локальные для `group` (учитывает ЕЁ собственный rotation как самое внутреннее звено цепочки + все её предки); используется при репарентинге объекта в открытую/активную группу через drag (было: `obj.x -= groupPos.x` — просто трансляция, игнорировала rotation).

**Дубликаты повёрнутых объектов** (`RenderOperations.getDuplicateObjectBounds`, добавлено 2026-07-02) — preview-объекты дублирования не лежат в `level.objects`, поэтому не проходят через DFS-поиск `WorldPositionUtils`; `getDuplicateObjectBounds` — отдельная, ручная реализация того же алгоритма («union bounds детей в локальной системе группы → повернуть как единое целое → сдвинуть») специально для этого detached-поддерева. Раньше полностью игнорировала `rotation` (ни объекта, ни группы), из-за чего рамка превью дубликата оставалась axis-aligned, пока сама картинка уже рисовалась повёрнутой через `CanvasRenderer.drawSingleObject`. Для простых объектов рамка теперь ещё и рисуется ТОЧНО (не консервативным AABB) — `drawDuplicateObjects` для ненулевого `obj.rotation` строит rect из `obj.width/height` вокруг центра AABB и поворачивает его через `strokeFrame(..., obj.rotation)`, как обычная рамка выделения.

**Известные ограничения**:
- Жест rotate/scale и обычный drag внутри повёрнутого предка применяют мировые дельты к локальным координатам корректно ТОЛЬКО по УГЛУ (см. rotation-chain выше — угол не зависит от пивота); но rotation-PIVOT группы вычисляется как центр bounds её ТЕКУЩИХ детей (`Group.getBounds()`), пересчитываемый заново на каждый рендер. Из-за этого перетаскивание ОДНОГО ребёнка внутри повёрнутой группы: (а) может выдать итоговую мировую позицию, чуть отличную от «в точности мировая дельта курсора» (сам двигаемый объект своим перемещением слегка сдвигает pivot ancestor-группы, которую сам же и определяет), и (б) видимая позиция НЕ выделенных соседей по группе тоже слегка «плывёт» вслед за смещением этого pivot.
  - **Разбирался фикс через `excludeIds`** (исключение перетаскиваемого id из суммы bounds ancestor-группы при вычислении её pivot, threaded через `Group.getBounds`/`WorldPositionUtils`/`CanvasRenderer`/`RenderOperations`/`MouseHandlers`) — **откачен 2026-07-02**: вызывал скачок pivot'а уже в момент простого клика/выделения ребёнка (`mouse.isDragging` устанавливается `true` сразу на mousedown, ещё до движения курсора), из-за чего рамка открытой группы рисовалась «вокруг остальных детей без учёта выбранного» ещё ДО начала drag, переставала реагировать на движение перетаскиваемого объекта (bounds его игнорировали — рамка «умирала»), а также ломал `drawAltDragSelectionRect`/`getObjectWorldBoundsWithParallax` для САМОГО перетаскиваемого объекта (`excludeIds` включал `obj.id` при запросе баундов ЭТОГО ЖЕ объекта — срабатывал pre-existing вырожденный early-return `if (excludeIds.includes(obj.id)) return degenerate` в `getWorldBounds`, задуманный для ДРУГОГО случая — «bounds группы без части её детей», а не «не учитывать объект при вычислении пивота предка»). Корректный фикс потребовал бы снимка (freeze) pivot'а строго на старте жеста (а не exclude-переключателя, синхронного с `isDragging`) — не реализован, требует более широкого API-рефакторинга рендера; временно принято как известное ограничение.

---

## 📚 Z-порядок объектов (стек рендер/hit-test)

Объекты **не хранят** `zIndex`. Порядок отрисовки и клика определяется исключительно позицией объекта в массиве-контейнере — `Level.objects` для объектов верхнего уровня, `group.children` для объектов внутри группы (как слои в Photoshop/Figma: чем позже элемент в массиве, тем он выше/ближе к переднему плану). `Layer.index` не затронут и остаётся первичным ключом сортировки (объекты одного слоя всегда рисуются вместе, порядок слоёв как раньше).

**Модель данных**:
- `GameObject`/`Group` не сериализуют `zIndex` в `toJSON()` — поле полностью удалено из модели.

**Сравнение порядка** (`src/models/Level.js`):
- `compareStackOrder(a, b)` — единый компаратор: сначала сравнивает `layerIndex` (через `getLayerById().getIndex()`), при равенстве — путь в дереве объектов (`GroupTraversalUtils.findObjectPath`), поэлементно от корня. Используется и рендером, и hit-test'ом, поэтому клик всегда попадает в объект, который реально нарисован сверху, независимо от глубины вложенности групп.

**Рендер** (`src/core/RenderOperations.js`, `src/ui/CanvasRenderer.js`):
- `RenderOperations.getVisibleObjects()` сортирует видимые объекты через `compareStackOrder` один раз на закешированную выборку (та же TTL/инвалидация, что у видимости).
- `CanvasRenderer.drawGroup()` рисует детей группы в порядке массива `children` без дополнительной сортировки — порядок массива уже есть порядок отрисовки.

**Hit-test** (`src/core/ObjectOperations.js`):
- `_sortObjectsByZIndexDescending(objects)` сортирует кандидатов по `compareStackOrder` в обратном порядке (передний план первым) — тот же компаратор, что у рендера.

**Ручное управление порядком** (`src/core/ObjectOperations.js`):
- `getSiblingArray(obj)` — возвращает контейнер объекта (`parentGroup.children` или `level.objects`).
- `bringToFront(obj)` / `sendToBack(obj)` — перемещает объект в конец/начало контейнера.
- `moveForward(obj)` / `moveBackward(obj)` — меняет объект местами с соседним элементом контейнера.

**UI** (`src/ui/DetailsPanel.js`):
- Секция Advanced: числовое поле «Z-Index» заменено 4 кнопками — «На передний план» / «На задний план» / «Выше» / «Ниже» (`createOrderButtonsRow()` → `applyOrderAction()`), работает для одиночного и множественного выбора.

---

## 🖱️ Цикл выбора перекрывающихся объектов по кликам (Blender-style)

`ObjectOperations.findObjectAtPoint(x, y, skipCycle = false)` (`src/core/ObjectOperations.js`) хит-тестит все candidate-объекты в точке (в group edit mode — через `computeSelectableSet()`/`getSelectableCandidateObjects()`, вне его — через `getSelectableObjectsInViewport()`), сортирует их по стек-порядку (`_sortObjectsByZIndexDescending`, тот же компаратор, что у Z-порядка выше) и выбирает результат одним из двух способов:

- **`_pickFrontMost(x, y, sortedCandidates)`** — обычный front-to-back hit-test, возвращает первый попавший объект. Используется, когда `skipCycle === true`.
- **`_pickWithClickCycle(x, y, sortedCandidates)`** (по умолчанию) — собирает ВСЕ совпадения в точке; при повторном клике в (примерно) той же точке (`tolerance = 4 / camera.zoom`, то есть ~4 экранных px независимо от зума) с тем же набором кандидатов (`candidateKey` — join их id) переходит к следующему совпадению в списке, зацикливаясь через модуль; клик в другое место или изменившийся набор кандидатов сбрасывает цикл на верхний объект. Состояние цикла — `this._clickCycle` (`{x, y, candidateKey, index}`), не персистентное между сессиями.

**Двойной клик** (`MouseHandlers.handleDoubleClick`) физически состоит из двух одиночных кликов — если бы он использовал циклический pick, второй клик двойного клика уже продвинул бы цикл мимо передней группы к моменту, когда dblclick-хендлер решает открыть group edit mode. Поэтому `handleDoubleClick` вызывает `findObjectAtPoint(x, y, true)` — параметр `skipCycle`, форсирующий `_pickFrontMost` (старое, нецикличное поведение).

---

## 👁️ Isolate, Layer Solo и Object Solo (Blender Local View / Solo)

Три независимых, но концептуально похожих механизма временного сужения видимой сцены — все non-destructive (не трогают персистентные `obj.visible`/`layer.visible`).

### Isolate выделения (хоткей `/`)
- `ObjectOperations.toggleIsolateSelection()` — при включении собирает верхнеуровневых предков (через `groupOperations._findParentGroup()`, поднимаясь до корня) для каждого выделенного объекта и сохраняет их id в `stateManager` как `view.isolatedTopLevelIds` (`Set` или `null`, если isolate выключен). Гранулярность — только top-level: изолируется весь верхнеуровневый объект/группа целиком, а не конкретный вложенный потомок.
- Повторный вызов при активном isolate снимает его (`view.isolatedTopLevelIds` → `null`).
- **Рендер**: `RenderOperations.render()` переиспользует существующий паттерн затемнения группового edit-режима (`ctx.filter = 'grayscale(1) opacity(0.4)'`) — теперь применяется и к объектам, не входящим в `isolatedTopLevelIds`, когда isolate активен.
- **Выбор**: `ObjectOperations.getSelectableCandidateObjects()` при активном isolate и вне group edit mode фильтрует `level.objects` до `isolatedTopLevelIds` — затемнённые объекты не кликаются, что синхронизировано с dimming в рендере по построению (один и тот же источник состояния).

### Layer Solo (Ctrl+click на иконку глаза слоя в LayersPanel)
- `Layer.js` — новое transient-поле `soloed` (не сериализуется в `toJSON()`, чисто UI-состояние).
- `LayersPanel.toggleLayerSolo(layerId)` — эксклюзивный solo: сбрасывает `soloed` у ВСЕХ слоёв, затем включает его для целевого (повторный Ctrl+click на уже заsoloенном слое снимает solo). Обработчик клика по `.layer-visibility-btn` разветвляется на solo вместо обычного toggle видимости, если зажат `e.ctrlKey || e.metaKey`.
- `RenderOperations.getVisibleLayerIds()` — solo-aware: если хотя бы один слой заsoloен, видимый набор — только заsoloенные слои (`layers.filter(l => l.soloed)`), независимо от их собственного `layer.visible`; без соло-слоёв поведение как раньше (`layer.visible`).
- Заsoloенный слой в UI подсвечивается жёлтым цветом иконки глаза (`LayersPanel.updateLayerElement`). Видимость/скрытость слоя показывается только формой иконки (открытый/закрытый глаз) — без дополнительного изменения цвета; жёлтая подсветка солированного слоя — отдельный, не связанный с видимостью индикатор.
- Задокументировано как информационная запись в `config/defaults/shortcuts.json` → `mouse.soloLayer` (категория `mouse`, ребиндинг недоступен — см. раздел о хоткеях мыши в API_GUIDE.md/DEVELOPMENT_GUIDE.md).

### Object Solo (Ctrl+click на иконку глаза объекта в OutlinerPanel)
- `ObjectOperations.toggleObjectSolo(obj)` — аналог Layer Solo, но для объектов верхнего уровня и с другой семантикой рендера (полное скрытие, не диммирование). Non-destructive (не трогает `obj.visible`). Эксклюзивный: соло другого объекта заменяет предыдущее; повторный Ctrl+click на уже-соло объекте снимает solo. Состояние — `stateManager` ключ `view.soloedTopLevelObjectId` (id верхнеуровневого объекта или `null`).
- `ObjectOperations.findTopLevelAncestor(obj)` — новый общий хелпер: поднимается через `groupOperations._findParentGroup()` до объекта без родителя. Используется и `toggleIsolateSelection()`, и `toggleObjectSolo()`.
- **Рендер**: `RenderOperations.render()` — при активном `soloedTopLevelObjectId` объекты с `id !== soloedTopLevelObjectId` не рендерятся вообще (`return` до отрисовки), в отличие от диммирования при Isolate. Это соответствует семантике иконки глаза («скрыто» = не нарисовано, а не «приглушено»).
- **Гранулярность**: только top-level — если соло стоит на группе, её дети рендерятся как обычно. Это не отдельный спецкейс, а следствие того, что фильтрация по `soloedTopLevelObjectId` применяется только на верхнем уровне обхода, глубже код не спускается.
- **Выбор**: `ObjectOperations.getSelectableCandidateObjects()` также учитывает `soloedTopLevelObjectId` — скрытые через solo объекты не кликаются, аналогично isolate-фильтрации.
- UI: `OutlinerPanel.updateVisibilityButton()` подсвечивает соло-объект жёлтым цветом иконки глаза (`#fbbf24`), как и Layer Solo; title кнопки — `"Soloed — Ctrl+click to un-solo"`.
- Задокументировано как информационная запись в `config/defaults/shortcuts.json` → `mouse.soloObject` (категория `mouse`, ребиндинг недоступен).

### MenuPositioningUtils — унифицированное позиционирование меню фильтров (v3.55.0+)

**Файл**: `src/utils/MenuPositioningUtils.js`

`createMenuElement` / `showMenu` set `z-index: 10000` so body-fixed popups paint above `#floating-layer` (100) — viewport chrome menus (cam/filter/eye) work inside floating windows.

Три системы меню (ПКМ-контекстные, меню фильтров Outliner/AssetPanel, главное меню nav-bar) теперь одинаково работают с `ui.cursorMenuMargin` благодаря унифицированной логике в `MenuPositioningUtils`.

- **`static getCursorMenuMargin()`** — читает `ui.cursorMenuMargin` из `stateManager` (дефолт 2px из `CURSOR_MENU_MARGIN`, диапазон 0-60, ранее жёстко закодировано в `BaseContextMenu.CURSOR_MENU_MARGIN = 2`). Отдельная копия вместо cross-import, т.к. `BaseContextMenu.getCursorMenuMargin()` — instance-метод, привязанный к иерархии класса.
- **`static setupMenuClosing(menu, triggerElement)`** — persistent `document.addEventListener('mousemove', ...)` на ВСЮ жизнь меню (раньше только ~150мс opening animation, потом срабатывал `mouseleave` и меню закрывалось при малейшем движении). Проверяет через `isInside(x, y, rect, margin)` попадание курсора в пределы `getCursorMenuMargin()` px от кнопки/меню (отдельные rect'ы, union'ируются), `margin` читается живьём на каждый вызов.
- **`static repositionMenu(menu, triggerElement, options)`** — новый метод: пересчитывает позицию меню по **РЕАЛЬНЫМ размерам** (`menu.getBoundingClientRect()`) вместо угадываемых `menuWidth/menuHeight`, переданных в `showMenu()`. Запускается ПОСЛЕ добавления всех пунктов меню в DOM, синхронно до отрисовки браузером — видимого "прыжка" нет. Причина: `showMenu()` вызывается ДО наполнения меню пунктами (нужно для раннего старта `setupMenuClosing()`), поэтому позиция вычисляется по guess'у, но реальная высота (количество фильтров/типов) может отличаться → меню оказывается смещено от кнопки или flip-logic (above/below) срабатывает неверно → на первый же `mousemove` меню закрывается.

**Фикс меню фильтров (Outliner/AssetPanel)**:
- `OutlinerPanel.showFilterMenu()` и `AssetPanel.showAssetFilterMenu()` вызывают `MenuPositioningUtils.repositionMenu(menu, button, {alignment, direction, menuWidth, menuHeight})` после цикла добавления пунктов-фильтров.
- Меню теперь всегда совпадает с кнопкой (правый край с точностью до сотых px) и открывается строго под ней, если нет clip-а у края экрана.
- Ctrl+click мульти-select: Ctrl+клик по чекбоксу только обновляет визуал, фильтр применяется на `keyup` Ctrl (накопленный стейт → `stateManager.update` → `render()`). Обычный клик применяет фильтр немедленно.

**Фикс главного меню (nav bar dropdown)**:
- `MenuManager.setupDropdownCursorMarginWatcher()` — новый persistent `document.addEventListener('mousemove', ...)` для top-level dropdown. Трекает `this.lastCursorX/Y`, при активном `hoverModeEnabled` и открытом dropdown проверяет через `isCursorInsideDropdown(menuElement, dropdown)` попадание курсора в пределах margin, включая открытые вложенные flyout-submenu (`.absolute.left-full:not(.hidden)` — тот же селектор, что в `createSubmenuItem()`), закрывает через `closeAllDropdowns()` если курсор вне всех rect'ов.
- Вызывается один раз в `setupMenuEvents()`.
- Раньше dropdown закрывался нативным `mouseleave` (нулевой margin, `ui.cursorMenuMargin` не действовал вообще) — теперь margin-aware.

---

## 👁️‍🗨️ Видимость объектов (H / Alt+H / Outliner eye icon)

- `ObjectOperations.toggleObjectVisibility(obj)` — единая точка переключения `obj.visible`; для `type === 'group'` каскадом применяет то же значение ко всем потомкам через `GroupTraversalUtils.getAllChildren(obj, true)`. Каскад обязателен не только косметически: `computeSelectableSet()`/`isObjectSelectable()` проверяет лишь собственный флаг `.visible` объекта, без обхода предков — без каскада скрытые потомки группы оставались бы выбираемыми (например через Outliner), хотя и не отрисовывались (рендер уже сам пропускает их через `CanvasRenderer.drawGroup`'s `if (!group.visible) return`).
- `ObjectOperations.toggleVisibilityForSelection()` (хоткей `H`) — применяет `toggleObjectVisibility` ко всем текущим выделенным объектам.
- `ObjectOperations.unhideAllObjects()` (хоткей `Alt+H`) — показывает вообще все скрытые объекты на любом уровне вложенности через `GroupTraversalUtils.getAllObjects(level.objects, true)`.
- `ObjectOperations.afterVisibilityChange()` — общий хвост (сохранение состояния истории, инвалидация spatial index и visible-objects кэша, `render()`, обновление всех панелей), используемый всеми тремя операциями выше.
- **OutlinerPanel** — `createVisibilityButton(item)` создаёт кликабельную SVG-иконку глаза рядом с именем объекта (та же разметка, что в LayersPanel); `updateVisibilityButton(visibilityBtn, nameSpan, obj)` обновляет иконку и красит `nameSpan.style.color` в `#6b7280`, если объект скрыт. Кнопка встроена в keyed-reconciliation рендер (`renderGroupNode`/`renderObjectNode`) — создаётся один раз при отсутствии переиспользуемого узла, обновляется на каждый рендер; клик вызывает `ObjectOperations.toggleObjectVisibility()` напрямую.

---

## ⌫ Backspace-to-reset (Blender-style hover reset)

Глобальный хоткей `Backspace`: наведение курсора мыши (не фокус клавиатуры) на конкретное resettable-поле в DetailsPanel/SettingsPanel сбрасывает его к дефолту; наведение на заголовок/контейнер секции (любой уровень вложенности) сбрасывает все зарегистрированные поля внутри неё.

**Реестр** (`src/utils/ResetRegistry.js`, singleton `ResetRegistry`):
- `scopes: Map<scopeKey, {element, defaultValue}[]>` — панели перерегистрируют свой набор resettable-полей на каждый рендер через `setFields(scopeKey, fields)` (не аккумулируется — полная замена), чтобы реестр всегда отражал текущий DOM.
- `getHoveredElement()` — берёт `document.querySelectorAll(':hover')`, последний элемент в списке — самый глубоко вложенный, то есть реально то, что под курсором.
- `findTargets(hoveredEl)` — идёт вверх по `parentElement`: сначала ищет точное совпадение с зарегистрированным полем (сброс одного поля), иначе — ближайшего предка, который `.contains()` одно или несколько полей (секция работает «сама», без явной разметки — просто за счёт DOM-вложенности, на любой глубине).
- `handleBackspace()` — точка входа. Не мешает обычному редактированию текста: возвращает `false` (обычное удаление символа) в двух случаях — (1) если элемент под курсором одновременно в фокусе как текстовый `INPUT`(не checkbox/radio/range/color)/`TEXTAREA` и НЕ зарегистрирован как resettable-поле (например, поиск в шапке Settings-панели, который лежит внутри `#settings-panel-container` и потому технически "содержит" все resettable-поля текущей вкладки); (2) если под курсором ровно одно поле и оно же сейчас в фокусе.
- `applyDefault(field)` — проставляет `element.value`/`element.checked` и диспатчит `input`/`change`/`blur` DOM-события. Реестр **не содержит commit-логики** (не пишет в state/history/config напрямую) — эти события «проигрывают» ровно то, что уже слушают существующие обработчики каждой панели (история/`notifyPropertyChange` в DetailsPanel; `ConfigManager`/`StateManager` sync в SettingsPanel), поэтому логика персистентности не дублируется.

**Точка входа**: `EventHandlers.handleKeyDown(e)` — `if (e.key === 'Backspace' && ResetRegistry.handleBackspace())` проверяется ДО ветки «фокус в INPUT/TEXTAREA → return», иначе фича не работала бы, когда любой инпут просто в фокусе.

**DetailsPanel** (`registerResettable(element, defaultValue)`):
- `_resettableFields` собирается заново в начале `render()`, коммитится в `ResetRegistry.setFields('detailsPanel', ...)` в конце `render()`; `destroy()` вызывает `ResetRegistry.clear('detailsPanel')`.
- Подключено: поля Transform — x, y, width, height, rotation (дефолты из `TRANSFORM_DEFAULTS`, построена на `DEFAULT_OBJECT` из `EditorConstants.js`, где есть теперь `X: 0, Y: 0, ROTATION: 0` в дополнение к `WIDTH/HEIGHT/COLOR/VISIBLE/LOCKED`), и поле Color в Visual — для одиночного и multi-select выбора.
- Сознательно не подключено: Name, Type (нет осмысленного дефолта), Custom Properties (нет схемы дефолтов).

**SettingsPanel** (`rebuildResetRegistry()`):
- Сканирует все элементы с атрибутом `[data-setting]` (не CSS-класс — обычные вкладки используют `setting-input`, `GridSettings.js` — `settings-input`; `data-setting` единственный по-настоящему общий маркер), для каждого получает дефолт через `configManager.getDefault(path)`. Вызывается в конце `setupSettingsInputs()` — единая точка, покрывает все вкладки, включая Grid.
- Вкладка Hotkeys не участвует: там `.hotkey-input`/`data-shortcut` (не `data-setting`) — read-only декларация с отдельным click-to-rebind, без концепции «дефолта».
- `destroy()` вызывает `ResetRegistry.clear('settingsPanel')`.

**ConfigManager.getDefault(path)** (`src/managers/ConfigManager.js`):
- Зеркало `get(path)` (тот же дот-путь), но читает из `this._defaultConfigsCache` — закешированного **глубокого клона** (`JSON.parse(JSON.stringify(...))`) результата `getDefaultConfigs()`. Глубокое клонирование обязательно: `mergeConfigs()` копирует только топ-level категории, поэтому вложенные пути (например `editor.axisConstraint.showAxis`) иначе делили бы объект с живым `this.configs`, и `set()` порочил бы кэш дефолтов «в обратную сторону».
- Кэш заполняется в `loadAllConfigsAsync()` и пересобирается в `reset()`.

**Хоткей**: задокументирован в `config/defaults/shortcuts.json` → `ui.resetToDefault` (`key: "Backspace"`, без модификаторов), виден в Settings → Hotkeys — как и остальные хоткеи в этом файле, запись чисто документационная: сам хоткей обрабатывается в `EventHandlers.handleKeyDown`, а не читается из конфига.

---

## 🎨 Система слоев

### Архитектурные решения
- **Полная изоляция видимости**: объекты скрытого слоя не выделяются
- **Унифицированная проверка**: computeSelectableSet() проверяет видимость
- **Кеширование**: getVisibleLayerIds() для производительности
- **Наследование layerId**: вложенные объекты наследуют слой от родительской группы

### Принудительное наследование
- **Группы как объекты**: каждая группа может иметь layerId
- **Наследование вниз**: вложенные объекты наследуют layerId от группы
- **Приоритет собственного layerId**: объект использует свой layerId, если установлен

---

## 🚀 Производительность

### Индекс объектов
- **O(1) поиск** вместо O(N×D)
- **O(1) подсчет по слоям** вместо O(M×N)
- **O(1) проверка иерархии** вместо O(D)

### Группировка уведомлений
- **O(1) уведомления** вместо O(M×3)
- Batch processing для массовых операций

### Умная инвалидация кешей
- **Избирательная инвалидация** только измененных данных
- **Отложенный пересчет** грязных кешей

### Пространственный индекс рендеринга
- **O(N) → O(k)** поиск объектов в области видимости
- **20-70× ускорение** для поиска видимых объектов

---

## 🔄 Реактивные обновления панелей при структурных изменениях (v3.55.0)

Раньше КАЖДАЯ операция, добавляющая/удаляющая объекты или слои, должна была явно вызвать `editor.updateAllPanels()` — забытый вызов приводил к видимым багам типа «Isolate не обновляет Outliner» (требовался дополнительный клик по канве, чтобы панели перерисовались).

### Новый механизм на Level-модели

**`src/models/Level.js`**:
- `setStructureChangeCallback(callback)` — регистрирует callback для уведомлений о структурных изменениях.
- `notifyStructureChange(changeType, payload)` — внутренний вызов callback'а при добавлении/удалении объектов и слоёв:
  - `changeType: 'objectAdded'` — вызывается из `addObject()` с `{object}`
  - `changeType: 'objectRemoved'` — вызывается из `removeObject()` с `{objectId}`
  - `changeType: 'objectsRemoved'` — вызывается из нового метода `removeObjects(ids)` с `{ids}` (батчевое удаление)
  - `changeType: 'layerChanged'` — вызывается из `addLayer()`, `removeLayer()`, `reorderLayers()` с `{action: 'add'|'remove'|'reorder', ...}` и дополнительным payload в зависимости от action
- `removeObjects(ids)` — новый метод: батчевое удаление нескольких объектов за один проход (одно обновление слойных счётчиков вместо одного на объект, одно уведомление вместо многих). Заменяет антипаттерн `level.objects = level.objects.filter(...)`

### Интеграция с StateManager и батчингом в LevelEditor

**`src/core/LevelEditor.js`** → `setupLayerObjectsCountTracking()`:
- Вызывается один раз при инициализации уровня.
- Подключает callback через `level.setStructureChangeCallback(...)`, который:
  - Накапливает все структурные изменения в массив за текущий event loop (`this._pendingStructureChanges`).
  - Схлопывает их в ОДНО обновление через `queueMicrotask()` (батчинг: если одна операция вызвала `addObject()` 50 раз, панели рендерятся один раз, не 50).
  - Затем вызывает `updateCachedLevelStats()` и `stateManager.notify('levelStructureChanged', changes)`.
- **Важно**: callback привязан к конкретному экземпляру Level, поэтому `setupLayerObjectsCountTracking()` вызывается ПОВТОРНО из `LevelFileOperations` (методы `newLevel()` и `openLevel()`) сразу после `this.editor.level = ...` — иначе оба callback'а (layer count + structure change) отваливаются при смене уровня.

### Подписка панелей на события

Панели теперь подписываются на событие `'levelStructureChanged'` и обновляются автоматически, независимо от того, через какой код произошло изменение:

**`src/ui/OutlinerPanel.js`**:
```javascript
stateManager.subscribe('levelStructureChanged', () => this.render());
```

**`src/ui/LayersPanel.js`**:
```javascript
stateManager.subscribe('levelStructureChanged', () => this.render());
```

**`src/ui/DetailsPanel.js`** (для уровня level-stats вида без выделения):
```javascript
stateManager.subscribe('levelStructureChanged', () => {
    if (this._mode === 'renderNoSelection') {
        this.render();
    }
});
```

### Следствие: упрощение кода операций

Операции, которые мутируют структуру уровня (добавление, удаление объектов, переразгруппировка), теперь используют модельные методы `Level` вместо прямых мутаций массивов:

- `src/core/GroupOperations.js` — `ungroupSelectedObjects()`, `removeEmptyGroup()`, `removeEmptyGroups()` используют `level.removeObjects(ids)` вместо `level.objects = level.objects.filter(...)`.
- `src/core/ObjectOperations.js` — `deleteSelectedObjects()` использует `level.removeObjects(ids)`.

Явные вызовы `editor.updateAllPanels()` в конце этих операций **больше не нужны** — панели обновятся сами через подписку на `'levelStructureChanged'`.

### Баги, которые это исправляет

**Isolate (`/`) не обновлял Outliner без клика в канву**:
- `ObjectOperations.toggleIsolateSelection()` вызывал `render()`, но не `updateAllPanels()`, из-за чего Outliner не перерисовывался до следующего независимого события.
- Теперь Outliner подписывается на `'levelStructureChanged'` (как и остальные панели) и реагирует автоматически.

---

## 🎨 UI компоненты

### BaseDialog
**Файл**: `src/ui/BaseDialog.js`
- Единый базовый класс для всех диалогов
- Фиксированная высота, динамическая ширина
- Мобильная адаптация
- Предотвращение повторного рендеринга контента

### SplashScreenDialog (v3.54.3)
**Файл**: `src/ui/SplashScreenDialog.js`
- Специальный диалог для splash screen
- Высота по контенту (dialog-container-auto-height)
- Закрытие любой кнопкой мыши на overlay
- Закрытие по клику на само окно (container, изображение, текстовый блок)
- Единая система обработчиков через EventHandlerManager
- Динамическое получение версии

### BaseContextMenu — единая разметка пунктов, disabled-схема, submenu-рендер, фикс margin (v3.55.0+)
**Файлы**: `src/ui/BaseContextMenu.js`, `src/utils/MenuItemTemplateUtils.js`, `styles/base-context-menu.css`
- **Единая визуальная схема**: `createMenuItem()`/`createSubmenuItem()` теперь оба используют `MenuItemTemplateUtils.renderMenuItemLeadingHtml()`, `renderMenuItemBodyHtml()`, `renderMenuItemTrailingHtml()` (как `MenuManager.createMenuItem()`) — третой экспорт утилиты одновременно поддерживает опциональный `item.shortcut` в trailing-слоте контекстных меню (пока не используется, но готово). Все 6 наследников BaseContextMenu (AssetContextMenu, AssetPanelContextMenu, CanvasContextMenu, ConsoleContextMenu, LayersContextMenu, OutlinerContextMenu) автоматически получают единый шаблон и полный disabled-scheme (`opacity-50 pointer-events-none cursor-not-allowed` + `dataset.menuDisabled`) — идентично `MenuManager`. Визуальная сходимость: item rows теперь `className = 'base-context-menu-item px-4 py-2 text-sm hover:bg-gray-700'` (идентично MenuManager's шаблону), разделители (separators) — `'border-t border-gray-600 my-1'`, submenu-триггеры — `'px-4 py-2 text-sm hover:bg-gray-700 flex items-center justify-between'` с явным `<span class="text-xs ml-4">▸</span>`-гліфом (заменяет CSS `::after { content: '▶' }` pseudo-element). CSS-правила в `base-context-menu.css` упрощены: удалены дублирующие padding/font-size/hover-bg (теперь через utility-классы), сохранены только color-var, cursor, flex/align-items, transitions, disabled/active-states, first/last-child radius.
- **Flyout-submenu**: `addSubmenuItem(text, icon, items, options)`/`createSubmenuItem()` — hover-раскрывающееся подменю сбоку, аналогично `MenuManager.createSubmenuItem()`. `handleMenuItemClick()` рекурсивно ищет пункт по id через `findMenuItemById()` (включая вложенные submenu-items); клик по заголовку подменю не закрывает и не выполняет действие (открытие только через hover).
- **Фикс клиппинга вложенных подменю**: `.submenu-flyout` больше не ставит `overflow-y:auto; max-height:320px` безусловно; новый модификатор-класс `.submenu-flyout--scrollable`, применяется ТОЛЬКО к самому глубокому флайауту в цепочке (у которого нет вложенных submenu-детей). Позволяет раскрыть третий уровень вложенности: Add → категория → тип ассета (раньше третий уровень обрезался родительским флайаутом).
- **Фикс cursor margin за пределами меню** (v3.55.0): `BaseContextMenu.setupMenuClosing()` давала видимую зону-иммунитета вокруг открытого меню только в течение ~150–200мс opening animation через `requestAnimationFrame` polling (`startCursorMonitoring`/`stopCursorMonitoring`); после окончания animation цикл завершался и меню тут же закрывалось при любом движении мыши вне его границ, независимо от `ui.cursorMenuMargin` (механизм стал мертвым кодом после удаления `requestAnimationFrame`-loop'а в одном из предыдущих проходов). Исправлено: `setupMenuClosing()` теперь устанавливает один persistent `document` `mousemove`-листенер на ВСЮ жизнь меню (не только animation), который вызывает submenu-aware `isCursorInsideMenu(menu)` — true если курсор в пределах `getCursorMenuMargin()` px от самого меню OR любого открытого `.submenu-flyout.show` потомка на любой глубине вложенности (так hover flyout, рендерящийся вне границ родительского меню через `position:absolute; left:100%`, не закрывает всю иерархию). Listencr удаляется методом `removeMenuCloseWatcher()` (вызов из `hideMenu()` и из пути early-replace в `showContextMenu()`), избегая утечек `document`-level листенеров.
- **Динамический margin вокруг курсора**: настройка `ui.cursorMenuMargin` (дефолт 6px, диапазон 0-60) управляет пикселями immunity-зоны. Метод `getCursorMenuMargin()` читает динамически из ConfigManager.
- `CanvasContextMenu` (`src/ui/CanvasContextMenu.js`) и `AssetPanelContextMenu` (`src/ui/AssetPanelContextMenu.js`) — пункт «Swap Panels» удалён из обоих (были независимые пункты, без общего родителя).

### AssetPanelContextMenu — "Add" submenu (v3.55.0)
**Файл**: `src/ui/AssetPanelContextMenu.js`
- ПКМ по пустому месту в Asset panel теперь содержит первым пунктом "Add" (➕) — flyout-подменю с категориями и типами ассетов.
- Реализовано через `buildAddMenuItems()`, переиспользующий `getAssetCategoriesWithTypes()` из `AssetTypes.js` (тот же каталог и SVG-иконки, что в nav "Add" меню).
- Каждый пункт типа имеет `disabled: isRootFolderSelected()` — дизейблен если выбранная папка — корень 'root'.

### OutlinerPanel
**Файл**: `src/ui/OutlinerPanel.js`
- Унифицированный поиск
- Умное выделение (Shift+клик, Ctrl+клик)
- Фильтрованное выделение
- **F2 — inline-переименование**: `EventHandlers.renameSelectedObject()` переключает вкладку на Outliner (если она не видна на текущей активной панели) и вызывает `OutlinerPanel.startInlineRename(obj)`
- **OL-F — F над списком**: `EventHandlers._outlinerPanelUnderCursor()` → `scrollToSelection()` — single row `scrollIntoView(center)`; multi — average Y midpoints; expands collapsed ancestors first
- **Иконки-глаза видимости**: `createVisibilityButton(item)`/`updateVisibilityButton()` — см. раздел «Видимость объектов» выше
- **Object Solo** (Ctrl+click на иконку глаза объекта): `ObjectOperations.toggleObjectSolo(obj)` — см. раздел «Isolate и Layer Solo» выше
- **Фильтр типов**: `showFilterMenu(button)` — click-outside-to-close (`mousedown`-листенер на `document`) и Ctrl+click мульти-select с применением фильтра на `keyup` — см. раздел «Isolate и Layer Solo» выше

### LayersPanel
**Файл**: `src/ui/LayersPanel.js`
- Двойная система состояний (активные/текущий слой)
- Умное позиционирование меню
- Оптимизированная инициализация
- **Layer Solo** (Ctrl+click на иконку глаза слоя): `toggleLayerSolo(layerId)` — см. раздел «Isolate и Layer Solo» выше

---

## 📁 Asset Management System

### Manifest System
**Файл**: `update_manifest.py`
- **Автоматическое сканирование**: рекурсивный поиск JSON файлов в папке `content/`
- **Структурированная организация**: создание иерархической структуры папок
- **Включение пустых папок**: сохранение папок без файлов в структуре
- **Кеш-бастинг**: обновление манифеста с временными метками для свежих данных
- **Валидация**: проверка корректности JSON файлов

### Dynamic Folder Creation
**Файлы**: `src/managers/AssetManager.js`, `src/ui/FoldersPanel.js`
- **Двухэтапное построение**: сначала из манифеста, затем добавление ассетов
- **Автоматическое создание папок**: для ассетов, не входящих в манифест
- **Нормализация путей**: унификация путей с префиксом `root/`
- **Синхронизация**: автоматическое обновление при изменении файлов
- **ResizeObserver**: динамическое обновление при изменении размера панели

### Asset Loading Pipeline
1. **AssetManager.scanContentFolder()** - загрузка манифеста и сканирование файлов
2. **buildCategoriesFromManifest()** - построение категорий из структуры манифеста
3. **FoldersPanel.buildFolderStructure()** - создание структуры фолдеров
4. **buildFromManifestStructure()** - создание папок из манифеста (включая пустые)
5. **addAssetsToStructure()** - добавление ассетов и создание недостающих папок
6. **StateManager.notify('assetsChanged')** - уведомление об изменениях

### AssetImporter
**Файл**: `src/utils/AssetImporter.js`
- Импорт ассетов из внешних папок
- Автоматический анализ структуры
- Интеграция с AssetManager

---

*Проект следует принципам Clean Code, SOLID, DRY с полной проверкой всех точек взаимодействия.*