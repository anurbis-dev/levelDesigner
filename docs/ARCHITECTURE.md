# Архитектура Level Editor v3.55.0

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
6. **Инициализация UI компонентов** - создание панелей, toolbar, диалогов
7. **Инициализация обработчиков событий** - `initializeEventHandlerManager()`
8. **Инициализация меню** - `initializeMenuAndEvents()`
9. **Инициализация уровня** - `initializeLevelAndData()` создает новый уровень
10. **Финализация** - `finalizeInitialization()`:
    - Первый рендер
    - Обновление версии (`updateVersionInfo()`, `updatePageTitle()`)
    - Обновление всех панелей
    - Сохранение начального состояния в истории
    - Показ интерфейса (`document.body.classList.add('editor-ready')`)

**Важно**: Интерфейс показывается только после полной инициализации, чтобы избежать отображения устаревшей версии и неполностью загруженных элементов.

## 🛠️ Утилиты

### PanelPositionManager
**Файл**: `src/ui/PanelPositionManager.js`
- Универсальное управление позицией панелей (`#left-tabs-panel`, `#right-tabs-panel`)
- Централизованное сохранение в StateManager
- `moveTab(tabName, fromPanel, toPanel)` — перемещение вкладки между панелями; при необходимости создаёт целевую панель через `ensurePanelExists()`
- **Tab drag**: `setupTabDraggingForPanel(panel)` стартует drag; глобальные обработчики в `_installGlobalTabDragHandlers()` покрывают сортировку внутри панели, cross-panel перенос и создание новой панели. Состояние хранится в `this._pendingDrag` (не в `window.tabDraggingState`) — легаси хендлер очищает глобальное состояние до выполнения нашего `mouseup`.
- Визуалы drag: ghost `.tab-drag-ghost`, drop-zone `.tab-drop-zone`, зона создания панели `.tab-new-panel-zone`; скоупинг — только прямые дети `#left-tabs-panel` / `#right-tabs-panel`
- ~~`TabMoveContextMenu`~~ — удалён (контекстное меню «Move to» заменено drag-and-drop)
- **Alt+1/2/3/4** — глобальный тоггл видимости панелей (левая / правая / toolbar / панель ассетов), обрабатывается в `EventHandlers.handleKeyDown` через уже существующий `EventHandlers.togglePanel('leftPanel'|'rightPanel'|'toolbar'|'assetsPanel')` (не метод `PanelPositionManager`, но общий с пунктами меню View код пути)

### MenuManager / ShortcutFormatter — единый источник хоткеев в главном меню
**Файлы**: `src/managers/MenuManager.js`, `src/utils/ShortcutFormatter.js`
- Пункты `config/menu.js` больше не хранят хардкод-строку хоткея (`shortcut: 'Ctrl+S'`), а ссылаются на дот-путь в `config/defaults/shortcuts.json` через `shortcutKey: 'editor.saveLevel'` — единый источник истины, не дублирующий значение.
- `ShortcutFormatter.format(shortcut)` — форматирует объект хоткея (`{key, ctrlKey, altKey, shiftKey, metaKey}`) в строку вида `"Ctrl+Alt+N"`; общий примитив, используется и `MenuManager`, и `SettingsPanel.formatShortcut()` (теперь тонкая обёртка над ним) — рассинхронизация формата исключена по построению.
- `MenuManager.resolveShortcutLabel(shortcutKey)` — резолвит `shortcutKey` через `configManager.getShortcuts()` в отображаемую строку; `MenuManager.createMenuItem()` рендерит её в `<span data-shortcut-key="...">`.
- `MenuManager.refreshShortcutLabels()` — перечитывает все `[data-shortcut-key]`-спаны в уже отрисованном DOM меню и обновляет их текст. Вызывается один раз из `MenuManager.initialize()` (защитно, на случай если `ConfigManager` ещё грузился при первом рендере меню) и из `SettingsPanel.saveHotkey()` сразу после того как ребинд уже персистирован через `configManager.set('shortcuts.category.action', ...)` — так подпись в меню сразу отражает новый хоткей без перезагрузки страницы.
- **Известное ограничение**: ребинд в Settings → Hotkeys обновляет только отображаемую подпись в меню. `EventHandlers.handleKeyDown` — хардкод-цепочка `if/else`, не читающая `shortcuts.json` в рантайме; фактическая обработка нажатия клавиш не зависит от ребинда.

### MenuManager — generic disabled-состояние и иконки пунктов; единая разметка иконок (v3.55.0)
**Файлы**: `src/managers/MenuManager.js`, `src/utils/MenuItemTemplateUtils.js`, `config/menu.js`
- Любой `itemConfig` в `config/menu.js` может иметь поле `disabled: boolean | (editor) => boolean` — дизейбль-предикат (функция или літерал).
- `MenuManager.itemDisabledCheckers` — Map(itemId → checker), заполняется при создании пункта в `createMenuItem()`.
- `MenuManager.refreshDisabledStates()` пересчитывает состояние каждого пункта (toggle CSS-классы `opacity-50 pointer-events-none cursor-not-allowed` + `dataset.menuDisabled`), вызывается при init, при `refresh()`, и реактивно через `setupDisabledStateSubscriptions()` на подписках к `stateManager` ключам `selectedFolders`/`activeAssetTabs`.
- Клик по disabled-пункту блокируется в `setupMenuItemEvents()`.
- **Единая разметка иконок**: `MenuManager.createMenuItem()` и `BaseContextMenu.createMenuItem()/createSubmenuItem()` теперь оба используют `MenuItemTemplateUtils.renderMenuItemIconHtml(icon)` для одиночного источника правды рендера иконки (`<span class="menu-item-icon" style="width:18px;height:18px;margin-right:8px">...</span>`, 18×18 flex box с margin). Устраняет дрейф визуалов между dropdown-меню (nav bar) и floating context-меню.
- `MenuManager.createMenuItem()` также рендерит иконку, если в `itemConfig.icon` (HTML/SVG-строка или эмодзи) — отрисовывается в `<span class="menu-item-icon">` перед лейблом, работает для любого меню.
- **buildAssetsMenu()** (config/menu.js, top-level "Add" в навигации) генерирует иерархию категория → тип для каждого creatable asset-типа из `AssetTypes.js`, каждый пункт получает иконку через `buildTypeIconSvg(typeId, category.color, 16)` и `disabled: isRootFolderSelected` (дизейблит создание, если выбран корневой каталог 'root' — там ничего создавать нельзя). Использует новый helper `getAssetCategoriesWithTypes()` из `src/constants/AssetTypes.js` (группирует ASSET_TYPES по категориям).

### ResizerManager
**Файл**: `src/managers/ResizerManager.js`
- Унифицированный менеджер для разделителей панелей
- Автоматическое определение устройства и маршрутизация событий
- Поддержка горизонтальных и вертикальных разделителей

### EventHandlerManager (v3.52.5)
**Файл**: `src/event-system/EventHandlerManager.js`
- Унифицированный менеджер событий UI
- Event delegation для эффективности
- Предотвращение дублирования обработчиков

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

### GroupTraversalUtils
**Файл**: `src/utils/GroupTraversalUtils.js`
- Система обхода иерархии групп
- 12 методов работы с группами
- `findObjectPath(topLevelObjects, targetId)` — DFS-поиск пути индексов от корня (`Level.objects`) до объекта через вложенные `group.children`; единый источник истины для порядка рендера/hit-test, используется в `Level.compareStackOrder()`

### AssetPanel System
**Файлы**: `src/ui/AssetPanel.js`, `src/ui/AssetTabsManager.js`, `src/ui/FoldersPanel.js`
- **Двухпанельная архитектура**: левая панель фолдеров, правая панель превью ассетов
- **Система табов**: создание табов перетаскиванием папок на контейнер табов
- **Multi-select поддержка**: множественный выбор через Shift+клик и Ctrl+клик
- **Горизонтальный скролл**: навигация по табам колесом мыши и средней кнопкой
- **Drag-and-drop**: перетаскивание папок на табы и ассетов на канвас
- **Контекстные меню**: правый клик для дополнительных действий
- **Синхронизация состояния**: автоматическая синхронизация между фолдерами и табами
- **Оптимизация производительности**: `FoldersPanel.updateLayout()` обновляет только обрезку имен при ресайзе без пересоздания DOM, `AssetPanel.updateGridViewSizes()` обновляет только стили grid
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

### PerformanceUtils
**Файл**: `src/utils/PerformanceUtils.js`
- throttle, debounce, memoize
- batchRAF, LRUCache
- Применение: MouseHandlers throttled (8ms mousemove, 16ms wheel)

### SearchUtils
**Файл**: `src/utils/SearchUtils.js`
- Унифицированная система поиска
- Рекурсивный поиск по иерархическим структурам
- Используется в Outliner/Layers/Assets, а также в SettingsPanel (единый поиск в шапке окна, см. ниже)

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

### CacheManager (v3.42.0)
**Файл**: `src/managers/CacheManager.js`
- Централизованный менеджер кэшей
- O(1) операции, smart invalidation
- TTL Cache, LRU Strategy

### ConfigManager
**Файл**: `src/managers/ConfigManager.js`
- Управление конфигурацией (editor.json, ui.json, canvas.json и др.)

### AssetManager & FileManager
**Файл**: `src/managers/AssetManager.js`, `src/core/LevelFileOperations.js`
- **AssetManager**: управление библиотекой ассетов, сканирование папки `content/`, кэширование изображений
  - **AssetTypes каталог** (`src/constants/AssetTypes.js`): 29 предопределённых типов ассетов (Camera, Actor, Image, ImageAtlas, Volume, SpriteAnimationClip, Tileset, Tilemap, NineSliceSprite, FontTextStyle, ParticleEffect, MaterialShaderPreset, Light, ParallaxLayer, SoundEffect, MusicTrack, AudioZone, DialogueGraph, QuestObjective, ItemDefinition, InventorySchema, LocalizationTable, SaveSchema, InputMap, PathSpline, NavMesh, AIBehaviorPreset, Prefab, SequenceCutscene), разбитые на категории (Core, Visual/Render, Audio, Data/System, Navigation/AI, Other) с цветовыми кодами и описаниями; вспомогательные функции `getAssetTypeById(id)`, `getAssetTypesByCategory(categoryId)`
  - **ComponentTypes каталог** (`src/constants/ComponentTypes.js`): 19 типов компонентов (Collider, Trigger, TransformAnimation, SpriteUiAnimation, Interactable, Pickup, DialogueTrigger, DamageHealth, MovablePushable, MountableVehicleSeat, PathFollower, Spawner, StateMachineBehavior, PlayerStart, CheckpointSavePoint, ClimbableLadder, ConveyorZiplineJumpPadPortal, DestructibleContainer, VariableModifier) — editor-side metadata-стабы ({id, type, enabled, properties}), которые прикрепляются к Asset/GameObject; runtime-поведение реализуется в game engine, который импортирует JSON; вспомогательные функции `getComponentTypeById(id)`, `createComponentStub(typeId)`
  - **AssetTypeIcons** (`src/constants/AssetTypeIcons.js`): минималистичная гліфическая библиотека (stroke SVG, 24×24px) для каждого типа ассета/компонента; функция `buildTypeIconSvg(typeId, color, size)` возвращает inline `<svg>` строку
  - **createPlaceholderAsset(typeId, customName?, folderPath = 'root')**: создание заполнителя-ассета без реального контента (категория-базированный цвет, type-иконка в превью вместо color-swatch+букв, поле `properties.placeholder = true`); `path` строится от `folderPath` (текущая выбранная папка в Asset panel), а не от категории — иначе ассет попадал бы в отдельную category-папку вместо текущей
  - **Asset.components** и **GameObject.components**: новые поля (массив component stubs, дефолт `[]`), сохраняются в `toJSON()`, копируются в экземпляры при размещении GameObjects через `createInstance()`; `components` также участвует в `Asset.hasChangesFromOriginal()`/`saveOriginalState()` (dirty-check)
- **FileManager**: сохранение/загрузка уровней
- **Menu Integration** (`config/menu.js`): новое меню "Add" (id остаётся `assets`, вставлено между View и Settings) — иерархия категория→тип→действие (label = имя типа, без префикса "New"); `buildAssetsMenu()` динамически генерирует меню из каталога; каждый пункт вызывает `LevelEditor.createAssetOfType(typeId)`, который берёт текущую папку через `assetPanel.getActiveTabPath()`, передаёт её в `createPlaceholderAsset()` и шлёт `Logger.status.success/error` в строку состояния; `MenuManager.createSubmenuItem()` — поддержка вложенных submenu-ов (flyout dropdown); каждый пункт типа получает иконку из `buildTypeIconSvg()` и `disabled: isRootFolderSelected` (дизейбл при выборе корневой папки); `getAssetCategoriesWithTypes()` gruppирует типы по категориям для обоих меню (nav "Add" и AssetPanelContextMenu "Add")
- **ActorPropertiesWindow** (`src/ui/ActorPropertiesWindow.js`): диалог редактирования Asset-свойств (несмотря на название, работает с Asset-экземплярами через `assetManager.updateAsset()`); новая секция "Components" — список текущих component-стабов (icon + label + delete-кнопка) и "+ Add" control (dropdown типов + submit), работает с рабочей копией компонентов в памяти (`this._workingComponents`) до Apply, отмена откатывает компоненты вместе с другими полями

---

## 📦 Core модули

### HistoryOperations (v3.40.0)
**Файл**: `src/core/HistoryOperations.js`
- Централизованный модуль undo/redo
- Восстановление состояния

### LayerOperations (v3.41.0)
**Файл**: `src/core/LayerOperations.js`
- Управление слоями объектов
- Batch processing, smart caching

### ViewportOperations (v3.44.0)
**Файл**: `src/core/ViewportOperations.js`
- Управление viewport и камерой
- Zoom, pan, focus операции

### LevelFileOperations (v3.44.0)
**Файл**: `src/core/LevelFileOperations.js`
- Файловые операции уровней
- Создание, открытие, сохранение

### RenderOperations
**Файл**: `src/core/RenderOperations.js`
- Операции рендеринга
- Пространственный индекс для O(k) поиска

### ObjectOperations
**Файл**: `src/core/ObjectOperations.js`
- Операции с объектами
- Выбор, выделение, свойства

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

- **Ctrl+drag** по объекту — вращение выделения вокруг центра общего world bounding box; **Shift** во время вращения — снап к ближайшему **абсолютному** углу с шагом `TRANSFORM.ROTATION_SNAP_DEGREES` (10°): общий delta корректируется так, чтобы итоговый rotation первого объекта снапшота лёг на кратный шагу угол (выделение остаётся жёстким).
- **Ctrl+Alt+drag** — равномерное масштабирование выделения относительно центра общего bounding box, клампится `TRANSFORM.MIN_SCALE_FACTOR` (0.05) / `TRANSFORM.MAX_SCALE_FACTOR` (20); **Shift** — снап фактора к шагу `TRANSFORM.SCALE_SNAP_FACTOR` (10%).
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

### BaseContextMenu — DOM-иконки, disabled-схема, submenu-рендер, фикс margin (v3.55.0)
**Файлы**: `src/ui/BaseContextMenu.js`, `src/utils/MenuItemTemplateUtils.js`, `styles/base-context-menu.css`
- **Единая визуальная схема**: `createMenuItem()`/`createSubmenuItem()` теперь оба используют `MenuItemTemplateUtils.renderMenuItemIconHtml(icon)` (как `MenuManager.createMenuItem()`) и применяют полный disabled-scheme (`opacity-50 pointer-events-none cursor-not-allowed` + `dataset.menuDisabled`) — идентично `MenuManager` (основное меню). Все 6 наследников BaseContextMenu (AssetContextMenu, AssetPanelContextMenu, CanvasContextMenu, ConsoleContextMenu, LayersContextMenu, OutlinerContextMenu) автоматически получают единый шаблон. Визуальная сходимость: item rows теперь `className = 'base-context-menu-item px-4 py-2 text-sm hover:bg-gray-700'` (идентично MenuManager's 'action' шаблону), разделители (separators) — `'border-t border-gray-600 my-1'`, submenu-триггеры — `'px-4 py-2 text-sm hover:bg-gray-700 flex items-center justify-between'` с явным `<span class="text-xs ml-4">▸</span>`-гліфом (заменяет CSS `::after { content: '▶' }` pseudo-element). CSS-правила в `base-context-menu.css` упрощены: удалены дублирующие padding/font-size/hover-bg (теперь через utility-классы), сохранены только color-var, cursor, flex/align-items, transitions, disabled/active-states, first/last-child radius.
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