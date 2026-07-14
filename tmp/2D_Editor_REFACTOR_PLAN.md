# План рефакторинга levelDesigner — инструкция для Claude Code

## Статус фаз (обновлять вручную при завершении шага — единственное место, где виден прогресс)

| Фаза | Статус | Заметки |
|---|---|---|
| 0. Страховочная сетка | ✅ done | vitest подключён, eslint работает, knip.json с explicit entry |
| 1. CI-лимиты | ✅ done | import/max-dependencies, scripts/check-file-size.js, knip.json |
| 2. Убрать `window.*` | ✅ done | остался только `DialogReplacer.js` (осознанно, задокументировано) |
| 3. `LevelEditor.js` | ✅ done | 2399→1583 строк; остаток — бэклог, не отдельная фаза |
| 4. `AssetPanel.js` | ✅ done | 3099→1154 строк; `AssetFoldersController`/`AssetViewRenderer`/`AssetFilterController`/`AssetSelectionController`/`AssetDragDropController`/`AssetItemActionsController`/`AssetToolbarController` |
| 4.5 `PanelPositionManager.js` | ✅ done | 2548→74 строк; `TabLayoutController`/`TabOrderController`/`TabDragController`/`SplitPaneController` + общий `PanelSubController` |
| 5. `managers/` (`BaseManager`) | ✅ done | `src/managers/BaseManager.js` создан (init/destroy, без editor-зависимости); все 10 классов в `src/managers/*.js` — `extends BaseManager` (StateManager, ConfigManager, UserPreferencesManager, AssetManager, FileManager, ResizerManager, HistoryManager, CacheManager, MenuManager, ContextMenuManager). `npm run check` зелёный, браузерная проверка пройдена. Закоммичено и запушено. |
| 6. Точечный дедуп | ✅ done | `GitUtils.runGitCommand`, `DiamondGridRenderer.drawDiagonalLines`, `SettingsSyncManager` (3 общих метода), `ImageUtils.getImageDimensions`, `LayersPanel.renameLayer` переиспользован, `OutlinerPanel` (`createOutlinerNameContainer`/`applyLockedRowState`). Rectangular/Hexagonal grid renderers — доп. дублирования с Diamond не найдено, не трогал. |
| 7. Долгосрочные guardrails | [ ] not started | Фаза 4 закрыта — можно стартовать |

> Основано на статическом аудите репозитория: madge (граф зависимостей, циклы), jscpd
> (дублирование), ручной разбор `LevelEditor.js`, `AssetPanel.js`, `PanelPositionManager.js`.
> Актуальный прогресс — в таблице статусов выше, а не в тексте фаз ниже (там числа фиксируют
> состояние на момент постановки задачи, а не текущее).

## Как работать с этим документом

Это не список пожеланий, а последовательность фаз. **Не переходи к следующей фазе, пока не
закрыта текущая.** Каждая фаза — отдельная ветка/набор коммитов, каждый шаг внутри фазы —
отдельный коммит с понятным сообщением. После каждого шага — ручная проверка в браузере
(редактор должен открываться, base-функциональность работать), потому что автотестов ещё нет.

Общие правила на весь рефакторинг:
1. **Никогда не меняй поведение и рефакторинг структуры в одном коммите.** Сначала чистое
   перемещение кода (copy → wire → remove old), потом отдельным коммитом — если нужно —
   исправление багов.
2. **Не удаляй файл, пока новый код не подключён и не проверен вручную.** Порядок: создать новый
   модуль → импортировать его туда, где раньше был инлайн-код → убедиться, что работает → только
   потом вычистить старое.
3. Файл не должен расти в процессе рефакторинга. Если правишь `LevelEditor.js` — правь так, чтобы
   он становился меньше, а не рос.
4. Если в процессе находишь ещё один God Object / глобальное состояние / дублирование — не чини
   на месте, а фиксируй в `tmp/refactor-backlog.md` и продолжай текущую фазу. Разбегаться по
   находкам — то, что уже привело код в текущее состояние.

---

## Фаза 0 — Страховочная сетка (обязательна перед всем остальным)

**Зачем:** в проекте было 0 тестов и не было `.eslintrc`. Рефакторинг God Object без тестов — это
не рефакторинг, а угадывание. Разбивать большие файлы (`LevelEditor.js`, `AssetPanel.js`,
`PanelPositionManager.js`) вслепую — гарантированный источник регрессий, которые всплывут только
в ручном тестировании (или у пользователя).

### 0.1 Подключить тестовый раннер
- Добавить `vitest` (лёгкий, ESM из коробки, не требует сборщика — подходит проекту без бандлера).
- `npm install --save-dev vitest`, добавить скрипт `"test": "vitest run"` в `package.json`.

### 0.2 Написать характеризационные тесты (characterization tests) для кода, который будешь трогать
Не unit-тесты "как должно быть", а тесты "как есть сейчас" — фиксируют текущее поведение перед
переписыванием, чтобы рефакторинг не менял его незаметно.

Приоритет покрытия (в порядке важности для будущих фаз):
- `src/core/ObjectOperations.js`, `GroupOperations.js`, `HistoryOperations.js` — чистая логика
  без DOM, легче всего тестировать, и именно её будем выносить из `LevelEditor.js`.
- `src/managers/StateManager.js` — если он будет использоваться как общая шина состояния при
  декомпозиции, важно не сломать `get/set/update`.
- Логика фильтрации/поиска ассетов (`shouldShowAsset`, `filterAssets` в `AssetPanel.js`) —
  чистые функции, тестировать проще всего, и они переедут в Фазе 4.

Не пытайся покрыть тестами весь проект — только то, что будет двигаться в Фазах 3–4.

### 0.3 Добавить статические проверки, чтобы регресс не остался незамеченным
- `eslint` с `eslint-plugin-import`: правило `import/max-dependencies` (лимит ~20 на файл — см.
  Фазу 1).
- Скрипт проверки циклических зависимостей на базе `madge` (`npx madge --circular src`) —
  сейчас циклов нет, задача — не допустить их появления при переносе кода.

**Критерий готовности Фазы 0:** `npm test` зелёный, `npm run lint` работает без ошибок конфигурации
(предупреждения — ок), `npx madge --circular src` — чисто.

### 0.4 Дополнительная находка при аудите — не блокирует рефакторинг, но стоит знать
`src/models/Level.js` → `toJSON()` не сериализует собственный `id` уровня — это уже задокументировано
прямо в коде `Project.js` как осознанный компромисс ("a fresh id is generated on every `fromJSON()`,
so a saved level id can't be used to identify 'the current level' again after reload"), с обходом
через индекс в массиве `levels[]`. Это не баг, который нужно чинить в рамках этого плана — но
если параллельно будет реализовываться движок (см. `2D_Editor_ENGINE_PLAN.md`, аддоны переопределяют уровни
по `id`), эта конкретная деталь станет блокирующей для той работы. Фиксирую здесь, чтобы не
потерялась между двумя документами.

---

## Фаза 1 — Guardrails в CI, чтобы не деградировать дальше

**Зачем:** проект развивается через AI-агентов (в репо уже есть `.claude/agents`, `.qwen/agents`).
Без автоматических ограничений агент неизбежно продолжит добавлять импорты в `LevelEditor.js` и
`AssetPanel.js`, потому что это самый быстрый локальный путь — "просто подключить сюда ещё одно".

### 1.1 Лимит импортов на файл
- `eslint-plugin-import`, правило `import/max-dependencies: [error, {max: 20}]`.
- Файлы, которые на момент введения правила превышают лимит, получают временный `overrides` в
  `eslint.config.js` с комментарием `// TODO remove after Фаза N` — лимит должен ловить *новые*
  нарушения, а не блокировать коммиты до того, как эти файлы разберут по плану.

### 1.2 Лимит строк на файл
- Скрипт `scripts/check-file-size.js`, порог 400 строк. Актуальный список файлов-превышений и
  причина (какая фаза их разберёт) ведётся живым списком прямо в `OVERRIDES` этого скрипта —
  не дублируй его здесь, он быстро расходится с реальностью. Снимай запись из `OVERRIDES`, когда
  файл ужимается ниже лимита по факту завершения фазы.

### 1.3 Проверка на неиспользуемый экспорт
- `knip` не заработал из коробки, потому что в проекте нет явного entry point для инструмента
  (это plain ES-modules проект, без бандлера, точка входа — инлайн `<script type="module">` в
  `index.html`). Настрой `knip.json` с explicit `entry: ["index.html"]` и `project: ["src/**/*.js"]`
  прежде чем полагаться на его отчёт — иначе он пометит "unused" почти всё, как в первом прогоне.

**Критерий готовности Фазы 1:** CI job (даже локальный npm-скрипт `npm run check`) падает на новом
файле с 25 импортами и не падает на существующем коде благодаря overrides.

---

## Фаза 2 — Убрать глобальное состояние (быстрый и безопасный первый шаг)

**Зачем:** `src/ui/PanelPositionManager.js` пишет состояние напрямую в `window`:
`window.tabDraggingState`, `window.tabDraggingGlobalMouseUp`, `window._tabDraggingRegistered`,
`window.panelInitializationCompleted`. Это состояние логики драг-н-дропа панелей живёт вне класса —
при повторной инициализации редактора (например, при hot-reload в разработке, или если когда-нибудь
появится несколько инстансов редактора на странице) это станет источником трудноуловимых багов,
потому что состояние не сбрасывается вместе с объектом.

Начинать рефакторинг именно с этого, а не с `LevelEditor.js`, потому что:
- файл маленький и локальный, эффект рефакторинга легко проверить руками (потаскать панели);
- это тренировка процесса "рефакторинг без изменения поведения" перед большими файлами.

### 2.1 Инкапсулировать `tabDraggingState`
- Перенести `window.tabDraggingState` в приватное поле `this._tabDraggingState` внутри
  `PanelPositionManager`.
- `window.tabDraggingGlobalMouseUp` — заменить на обычный bound-метод класса, подписка/отписка
  через `this._boundGlobalMouseUp = this._onGlobalMouseUp.bind(this)` в конструкторе, `addEventListener`/
  `removeEventListener` на `document`, а не через глобальную функцию на `window`.
- `window._tabDraggingRegistered` — заменить на приватный флаг `this._globalListenersRegistered`.

### 2.2 `window.panelInitializationCompleted`
- Судя по комментарию в коде ("Global flag for debugging"), это диагностический флаг. Проверить,
  читает ли его что-то ещё (`grep -rn "panelInitializationCompleted" src`). Если нет читателей —
  просто удалить. Если есть — перенести в `stateManager` (в проекте уже есть `StateManager` с
  `get/set` — это его прямое назначение, а не `window`).

### 2.3 `DialogReplacer.js` — window.alert/confirm/prompt
- Это **не баг**, а сознательный паттерн подмены нативных диалогов на кастомные. Не трогать в
  этой фазе, но задокументировать в комментарии над классом, почему это единственное осознанно
  оставленное глобальное состояние в проекте — иначе следующий агент увидит это и по аналогии
  решит, что "так тут принято делать".

**Критерий готовности Фазы 2:** `grep -rn "window\.\w* =" src` не возвращает ничего, кроме
`DialogReplacer.js`. Драг-н-дроп панелей и раскладка на глаз работают так же, как до правок.

---

## Фаза 3 — Декомпозиция `LevelEditor.js` (2399 строк → composition root)

**Зачем:** файл сейчас совмещает две разные роли — (а) точку сборки 40+ подсистем в конструкторе
и (б) владельца бизнес-логики (кэш-инвалидация, применение конфигурации грида, авто-сохранение,
deep clone). Смешение этих ролей и есть причина, по которой файл "притягивает" новый код: непонятно,
куда добавлять новую фичу, если сюда и так добавляют всё подряд.

Целевая архитектура: `LevelEditor.js` **остаётся публичным фасадом** (внешний API не меняется,
чтобы не переписывать всех вызывающих), но внутри становится тонким — только создаёт подсистемы и
делегирует.

### 3.1 Извлечь `EditorConfigController` (было: `applyConfiguration`, `_applyColorConfiguration`,
`_applyGridConfiguration`, `_getGridSettingsFromConfig`, `_applyBasicGridSettings`,
`_applyGridSubdivisionSettings`, `_applyGridTypeSettings`, `_syncGridSettingsToUI`,
`_saveDefaultConfiguration`, `applyConfigurationToLevel`)
- Новый файл `src/core/EditorConfigController.js`, наследуется от `BaseModule` (в проекте уже
  есть этот базовый класс — используй его, а не изобретай новый паттерн).
- В `LevelEditor.js` заменить эти методы на `this.configController = new EditorConfigController(this)`
  и делегирующие вызовы вида `applyConfiguration() { this.configController.apply(); }` — **только
  если** внешний код зовёт `editor.applyConfiguration()` напрямую (проверь через
  `grep -rn "\.applyConfiguration(" src`). Если вызывается только изнутри `LevelEditor.js` —
  делегирующую обёртку не оставляй, зови `this.configController.apply()` напрямую из места
  использования.

### 3.2 Извлечь `EditorCacheController` (было: `getCachedObject`, `getCachedTopLevelObject`,
`getCachedEffectiveLayerId`, `clearCaches`, `invalidateObjectCaches`, `clearSelectableObjectsCache`,
`getSelectableObjectsInViewport`, `smartCacheInvalidation`, `invalidateAfterLayerChanges`,
`invalidateAfterGroupOperations`, `invalidateAfterDuplicateOperations`, `scheduleCacheInvalidation`,
`updateCachedLevelStats`)
- Новый файл `src/core/EditorCacheController.js`.
- Это самая изолированная и самая рискованная для регрессии часть — кэш-инвалидация напрямую
  влияет на корректность рендера. Обязательно покрой характеризационными тестами (Фаза 0.2)
  **до** переноса, не после.

### 3.3 Извлечь `EditorLifecycleController` (было: `setupAutoSaveOnUnload`,
`setupAutoSaveOnVisibilityChange`, `maybeShowSplashOnFirstVisit`, `initializeDOMElements`,
`initializeRenderer`, `initializeUIComponents`, `initializeEventHandlerManager`,
`initializeMenuAndEvents`, `setupPanelSizeListeners`, `applySavedPanelSizes`,
`applyPanelSizesFromPreferences`, `applyTabOrderSettings`)
- Новый файл `src/core/EditorLifecycleController.js` — всё, что относится к запуску/остановке
  редактора и первичной инициализации DOM, а не к рантайм-логике.

### 3.4 Оставить в `LevelEditor.js`
- Конструктор (создание всех подсистем — это и есть его роль как composition root).
- `render()`, `updateCanvas()`, `updateAllPanels()` — тонкие делегирующие точки входа, которые
  дергают панели/рендерер, они и должны быть на верхнем уровне, это ядро публичного API.
- `undo()`, `redo()`, `getLevel()` — публичный API, тонкие делегаты к соответствующим Operations.

### 3.5 Что НЕ делать
- Не переименовывай и не меняй сигнатуру публичных методов `LevelEditor` в этой фазе — снаружи
  (панели, event-handlers) вызывают `this.editor.xxx()` в десятках мест, переименование раздует
  diff и смешает "перенос" с "переименование". Переименования — отдельная фаза, после того как
  структура устаканится.

**Критерий готовности Фазы 3:** `LevelEditor.js` — не более ~600–700 строк, содержит только
инициализацию и тонкие делегаты. `grep -c "import" src/core/LevelEditor.js` — заметно меньше 43
(часть импортов уйдёт в новые контроллеры). Редактор открывается, undo/redo, сохранение,
изменение грида в настройках работают как раньше.

---

## Фаза 4 — Декомпозиция `AssetPanel.js` (исходно 3083 строки/95 методов; текущий размер — в таблице статусов)

**Зачем:** этот файл больше `LevelEditor.js` по строкам, но импортов у него немного — поэтому
поверхностный анализ "по числу импортов" его не находит. Он не менее критичен для рефакторинга,
просто прячется по другой метрике.

Ниже — деление по фактическим методам файла, сгруппированное по ответственности.

### 4.1 `AssetFoldersController` — ✅ done, см. `src/ui/AssetFoldersController.js`
Вынесено как и планировалось: `initializeTabsManager`, `getActiveTabPaths`, `getActiveTabPath`,
`getAssetsFromFolder`, `getFolderName`, `addFolderTab`, `removeFolderTab`, `loadFoldersPosition`,
`saveFoldersPosition`, `createFoldersContainer`, `initializeFoldersPanel`, `updateFoldersLayout`,
`toggleFoldersPosition`, `filterByFolder`, `setupFoldersResizer`, `getCurrentTabFolder`, `getActiveTab`.
Delegate-обёртки на `AssetPanel` оставлены только там, где нашёлся внешний вызывающий код:
`getActiveTabPaths`/`getAssetsFromFolder` (вызывает `AssetViewRenderer.js`), `saveFoldersPosition`/
`updateFoldersLayout` (вызывает `TabLayoutController.js`). Остальные методы вызываются напрямую
через `this.foldersController.*`. `toggleFoldersPosition` и `filterByFolder` оказались мёртвым
кодом (нет вызывающих вне определения) — перенесены как есть, без обёртки.

### 4.2 `AssetViewRenderer` — ✅ done, см. `src/ui/AssetViewRenderer.js`
Фактически вынесено (`truncateAssetName` из исходного списка не существовал в коде — стал
неактуальным пунктом плана; зато `getTypeIconMarkup` вынесен вместе с остальными, т.к. вызывается
только из перенесённых методов): `render`, `renderTabs`, `renderPreviews`, `renderGridView`,
`renderListView`, `renderDetailsView`, `createAssetThumbnail`, `createAssetListItem`,
`createAssetDetailsRow`, `isValidImageSrc`, `createColorFallback`, `getTypeIconMarkup`,
`getImageDimensions`, `getDefaultColor`, `getAssetTypeFromCategory`, `updateGridViewSizes`.
Не `BaseModule` — plain-класс `constructor(assetPanel)`, зеркалит паттерн `AssetTabsManager.js`
(controller принадлежит панели, а не `LevelEditor`).

### 4.3 `AssetFilterController` — ✅ done, см. `src/ui/AssetFilterController.js`
Вынесено: `showAssetFilterMenu`, `updateAssetFilterMenu`, `shouldShowAsset`, `clearSearch`,
`filterAssets`, `renderAssetSearchControls`. Delegate-обёртки на `AssetPanel` только для
`renderAssetSearchControls`/`filterAssets` (вызывает `AssetViewRenderer.js`). `clearSearch`
оказался мёртвым кодом (нет вызывающих) — перенесён как есть, без обёртки.
Характеризационные тесты (`tests/AssetPanel.filter.test.js`, Фаза 0.2) переехали в
`tests/AssetFilterController.test.js` и теперь бьют по `AssetFilterController.prototype`
напрямую вместо `AssetPanel.prototype`.

### 4.4 `AssetSelectionController` — ✅ done, см. `src/ui/AssetSelectionController.js`
Проверено: `SelectionUtils.js` не пересекается по ответственности (это статические DOM/marquee
хелперы без состояния, используются через `BasePanel.setupSelection`, не дублируют
`AssetPanel`-специфичную логику выделения) — дублирования не найдено, интеграция не потребовалась.
Вынесено: `selectAsset`, `getSelectionContainer`, `getAssetList`, `getSelectableAssetElements`,
`updateSelectionVisuals`, `handleSelectAll`, `handleDeselectAll`. Delegate-обёртки на `AssetPanel`
для `selectAsset` (вызывает `FoldersPanel.js`), `getSelectionContainer`/`updateSelectionVisuals`
(полиморфные оверрайды — `BasePanel.js` вызывает их через `this.` на экземпляре `AssetPanel`,
должны существовать напрямую в prototype-цепочке). `getAssetList`/`getSelectableAssetElements`/
`handleSelectAll`/`handleDeselectAll` вызываются только внутри `AssetPanel.js` (конфиг
`setupSelection`, колбэки контекстного меню) — перевызваны напрямую через
`this.selectionController.*`, без обёртки.

### 4.5 `AssetDragDropController` — ✅ done, см. `src/ui/AssetDragDropController.js`
Расследование дублирования (перед переносом): jscpd-находка про клон с `OutlinerPanel.js`
(строки 205–235, 251–266) оказалась **неактуальной** — это координаты из аудита до Фаз 2–3.
Текущий `OutlinerPanel.js` не содержит external-file-drop/overlay логики вообще (только
несвязанная фича "icon paint-drag" для батч-тоггла видимости через mousedown+drag по глазкам).
Делиться нечем — общий базовый класс/util не создавался, перенос сделан по той же схеме, что 4.1–4.4.

Вынесено: `handleThumbnailDragStart`, `handleThumbnailDragEnd`, `addDropTarget`, `removeDropTarget`,
`setupDragAndDrop`, `canDropToActiveFolder`, `isExternalFilesDrag`, `isOverTabsContainer`,
`isOverPreviewsContainer`, `updateOverlayPosition`, `updateDropOverlayStyle`, `handleDragEnter`,
`handleDragOver`, `handleDragLeave`. `handleDrop` (создание ассетов из PNG-файлов) **остался на
`AssetPanel`** — это бизнес-логика создания ассетов, а не drag-протокол, вызывает
`this.dragDropController.*` для предикатов. `dropOverlay`/`dropOverlayResizeObserver`/
`boundHandleDrag*` — поля на `AssetPanel` (не на контроллере), т.к. `handleDrop` тоже их читает.
Delegate-обёртки на `AssetPanel`: `handleThumbnailDragStart`/`handleThumbnailDragEnd` (вызывает
`AssetViewRenderer.js`), `setupDragAndDrop` (внутренний вызов из `setupEventListeners`).
`addDropTarget`/`removeDropTarget` — мёртвый код (нет вызывающих), перенесены как есть.

### 4.6 `AssetItemActionsController` — ✅ done, см. `src/ui/AssetItemActionsController.js`
Уточнение по jscpd-находке из этого пункта: старые координаты `AssetPanel.js` [2745:2774] /
`AssetImporter.js` [698:727] указывали не на методы 4.6 (это UI-обработчики кликов/контекстного
меню, с `AssetImporter.js` не пересекаются), а на `getDefaultColor`/`getAssetTypeFromCategory`/
`getImageDimensions` — те же методы, что уже вынесены в `AssetViewRenderer.js` (Фаза 4.2).
Подтверждённое дублирование **реально существует** между `AssetViewRenderer.js` и
`AssetImporter.js:685,705,724` (побайтово совпадающие lookup-таблицы) — перенесено в Фазу 6
(точечный дедуп) как отдельный пункт, не блокирует 4.6.

Вынесено: `setupContextMenus`, `handleAssetOpenEditor`, `handleAssetRename`, `handleAssetDuplicate`,
`handleAssetDelete`, `handleItemDoubleClick`, `handleAssetClick`. `onSaveAsset`/`onSaveAssetChanges`/
`onShowInExplorer`/панельные колбэки (`onResetSize` и т.д.) остались на `AssetPanel` — не входят
в список методов 4.6, контроллер зовёт их через `assetPanel.*`. `assetContextMenu`/
`panelContextMenu` — поля на `AssetPanel` (не на контроллере), т.к. `destroy()` их читает.
Delegate-обёртка на `AssetPanel`: `handleItemDoubleClick` (вызывает `AssetViewRenderer.js`).
`setupContextMenus`/`handleAssetClick` — внутренние вызовы, перевызваны напрямую.

**Побочная находка (не исправлено, вне рамок структурного переноса):** `handleAssetClick`
вызывает `this.assetManager.getAssetById(assetId)` — такого метода на `AssetManager` нет (только
`assets` Map), вызов бросает исключение. Баг pre-existing, перенесён как есть 1:1. В реальном
double-click UI-пути не задействован (тот идёт через `handleItemDoubleClick`), но может
проявляться при обычном клике с `e.detail === 2`. Кандидат для отдельного багфикса.

### 4.7 `AssetToolbarController` — ✅ done, см. `src/ui/AssetToolbarController.js`
Вынесено: `decreaseAssetSize`, `increaseAssetSize`, `setViewMode`, `loadAssetSize`, `saveAssetSize`,
`loadViewMode`, `saveViewMode`, `handleResetSize`, `handleToggleGrid`, `handleToggleList`,
`handleToggleDetails`, `handleRefresh`, `handleSettings`. Delegate-обёртки на `AssetPanel` для
`handleResetSize`/`handleToggleGrid`/`handleToggleList`/`handleToggleDetails`/`handleRefresh`/
`handleSettings` (вызывает `AssetItemActionsController.js`). Остальные — внутренние вызовы,
перевызваны напрямую через `this.toolbarController.*`.

### 4.8 Фаза 4 закрыта — итог
`AssetPanel.js`: 3099 → 1154 строк (не ~500–600, как было в исходной оценке — orchestration-слой
оказался крупнее: `constructor`, `init`, `destroy`, `setupEventListeners`,
`setupAssetPanelHandlers`, `setupAssetEvents`, `updateContentVisibility`, `handleAssetWheel`,
`handleDrop`/`createTemporaryAssetFromFile` (бизнес-логика создания ассетов, не drag-протокол),
`handleAssetSave`/`handleAssetSaveChanges`/`handleAssetShowInExplorer`, `autoResizePanelHeight`,
`showSaveSuccessMessage`/`showSaveErrorMessage`/`showErrorMessage`, `shouldShowUnsavedIndicator`
плюс делегат-обёртки для методов с внешними вызывающими). Все 7 контроллеров созданы по единому
паттерну `constructor(assetPanel) { this.assetPanel = assetPanel; }`. Все сценарии проверены через
`chrome-devtools` (папки/вкладки, grid/list/details, поиск/фильтр, drag&drop, контекстное меню,
select all/deselect all, изменение размера/вида) — без регрессий, 50/50 unit-тестов проходят.

---

## Фаза 4.5 — ✅ done. Декомпозиция `PanelPositionManager.js` (было 2548 строк/60 методов → 74 строки facade)

Результат: `src/ui/panels/TabLayoutController.js`, `TabOrderController.js`, `TabDragController.js`,
`SplitPaneController.js` + общий `PanelSubController.js` (базовый класс для всех четырёх, не был
запланирован изначально — обнаружен как общая потребность в момент выноса).

### 4.5.1 Извлечь `TabLayoutController` (было: `togglePanelPosition`, `updateFoldersLayout`,
`updateRightPanelLayout`, `initializePanelPositions`, `initializePanelWidths`,
`initializeTabPositions`, `initializePanelStates`, `getPanelPosition`, `ensurePanelExists`,
`createTabsPanel`, `insertPanelIntoLayout`, `createPanelResizer`, `updateResizerPosition`,
`togglePanelCollapse`, `toggleTabPanelCollapse`, `toggleAssetsPanelCollapse`,
`toggleFoldersPanelCollapse`, `handlePanelResize`, `initializeAssetsPanel`,
`setupAssetsPanelResizer`)
- Всё, что относится к базовой раскладке панелей (позиция left/right, размеры, collapse/expand) —
  не про drag и не про split, чистое layout-состояние.

### 4.5.2 Извлечь `TabOrderController` (было: `moveTab`, `_syncTabPosition`,
`savePanelTabOrder`, `applyPanelTabOrder`, `moveTabDOM`, `moveTabElements`,
`updateActiveTabAfterMove`, `getTabClosestToSeparator`, `updateTabEventListeners`)
- Перестановка вкладок внутри панели без drag-жеста (программное перемещение + сохранение порядка).

### 4.5.3 Извлечь `TabDragController` (было: `_initGlobalTabDraggingHandler`,
`setupTabDraggingForPanel`, `_installGlobalTabDragHandlers`, `_cleanupTabDrag`,
`_removeGlobalTabDragHandlers`, `createTemporaryTabContainer`, `removeTemporaryTabContainer`)
- **Это именно те методы, где живут `window.*` globals из Фазы 2.** Если Фаза 2 уже сделана к
  этому моменту — здесь просто переносишь уже инкапсулированное состояние (`this._tabDraggingState`
  и т.д.) в новый файл, ничего заново не переписывая. Если делаешь Фазу 4.5 без Фазы 2 (не
  рекомендуется, но если так вышло) — не переноси `window.*` состояние как есть в новый файл, это
  тиражирование антипаттерна под новым именем; сначала инкапсулируй (Фаза 2), потом переноси.

### 4.5.4 Извлечь `SplitPaneController` (было: `_findSplitDropTarget`, `_showSplitHint`,
`_hideSplitHint`, `_removeSplitHint`, `_extractDraggedTab`, `_collapseSplitPane`,
`mergeTabIntoSplit`, `replacePaneInSplit`, `_createSplitPane`, `_setupSplitResizer`,
`_reactivateAfterTabRemoval`, `_setupSplitPaneHeaderDragging`, `_startSplitPaneDetachDrag`,
`detachFromSplit`, `removeEmptyPanel`, `updatePanelStateAfterRemoval`,
`updatePanelStateAfterCreation`, `updatePanelStateAfterTabAddition`, `savePanelSplits`,
`applyPanelSplits`)
- **Самый крупный кусок — примерно 900 строк, ровно то, что и вызвало рост файла.** Split-pane —
  логически самая сложная и самая свежая часть (Blender-style window manager), поэтому и самая
  рискованная для регрессии. Характеризационные тесты (принцип Фазы 0.2) особенно оправданы именно
  здесь — при переносе легко случайно поменять порядок операций в `mergeTabIntoSplit`/
  `replacePaneInSplit` и тихо сломать конкретный edge case (например, схлопывание последней вкладки
  в split при `_collapseSplitPane`).

### 4.5.5 Что остаётся в `PanelPositionManager.js`
`constructor`, `_updateUI`, `destroy` — тонкий facade/orchestrator, создающий 4 контроллера выше и
делегирующий им, аналогично тому, что запланировано для `LevelEditor.js` в Фазе 3.

**Порядок выноса:** сначала 4.5.1 (layout) — самый изолированный и наименее связанный с остальными
тремя, в последнюю очередь 4.5.4 (split-pane) — самый большой и самый связанный с 4.5.2/4.5.3
(split использует и перестановку вкладок, и drag).

**Критерий готовности Фазы 4.5:** `PanelPositionManager.js` — не более ~150–200 строк (только
facade). Split-pane (создание сплита перетаскиванием вкладки, detach обратно, resize сплита),
обычный drag-n-drop вкладок между панелями и collapse/expand панелей — всё работает вручную
идентично поведению до рефакторинга.

---

## Фаза 5 — Унификация `managers/`

**Зачем:** аудит показал, что `BaseModule` используется event-handlers и Operations-классами, но
**ни один** класс в `src/managers/*.js` от него не наследуется. Это значит, что у "менеджеров" в
проекте фактически нет общего контракта — то, что ChatGPT предложил решить "правилом на словах"
(Manager = только координация), на деле упирается в отсутствие общей базы, которую можно было бы
формально проверять.

### 5.1 Определить, действительно ли `BaseModule` подходит менеджерам
- `BaseModule` сейчас даёт доступ к `this.editor` и хелперы вида `isInGroupEditMode()` — это
  специфично для рантайм-модулей редактора (mouse handlers, operations), не факт, что подходит
  `StateManager`/`ConfigManager`, которые создаются *до* остальных подсистем и не всегда имеют
  доступ к полностью инициализированному `editor`.
- Если не подходит — не тяни их в `BaseModule` силой. Вместо этого создай отдельный
  `src/managers/BaseManager.js` с минимальным контрактом: `init()`, `destroy()`, без обязательной
  зависимости от `editor`. Так у менеджеров появится собственный проверяемый контракт, не ломая
  жизненный цикл, в котором они создаются в конструкторе `LevelEditor` до полной инициализации.

### 5.2 Провести миграцию по одному менеджеру за коммит
- Начни с `CacheManager.js` и `HistoryManager.js` — самые изолированные, без побочных эффектов на
  DOM. `StateManager.js` — в последнюю очередь, он самый связанный.

**Критерий готовности:** все классы в `src/managers/*.js` наследуются от `BaseManager`,
ESLint-правило (по желанию: кастомное) может проверять это автоматически.

**Статус: код готов, не закоммичен.** `src/managers/BaseManager.js` создан (5.1 — отдельный файл,
не `BaseModule`, по описанным выше причинам). Все 10 классов мигрированы (5.2), порядок соблюдён:
`CacheManager`/`HistoryManager` первыми, `StateManager` последним; остальные (`FileManager`,
`ContextMenuManager`, `ResizerManager`, `MenuManager`, `ConfigManager`, `UserPreferencesManager`,
`AssetManager`) — между ними. `HistoryManager` получил новый `destroy()` (раньше не было).
`npm run check` (lint+check:size+vitest 50/50+madge --circular) зелёный, браузерная проверка
(instanceof-цепочка всех 10 инстансов → `BaseManager`, undo/redo, `cacheManager.clearCaches()`) —
без регрессий. Закоммичено вместе с параллельно выполнявшейся Фазой 4 (`LevelEditor.js`,
`AssetPanel.js`, `package.json` и т.д.) и запушено в `origin/master`.

---

## Фаза 6 — Точечное устранение дублирования

Дублирование в проекте по jscpd невысокое — отдельной большой фазы не нужно. Делай это заодно с
Фазами 3–4.5, когда трогаешь соответствующие файлы:

- `utils/GitUtils.js` — три похожих блока (29–57, 68–96, 106–137) — вероятно, три похожих git-
  операции с повторяющейся обвязкой (exec + error handling). Вынести общую обёртку
  `runGitCommand(cmd, options)`.
- `utils/gridRenderers/DiamondGridRenderer.js` / `RectangularGridRenderer.js` /
  `HexagonalGridRenderer.js` — в проекте уже есть `BaseGridRenderer.js`, но часть логики всё равно
  продублирована между тремя рендерерами. Проверить, что именно не вынесено в базовый класс, и
  подвинуть выше по иерархии.
- `utils/SettingsSyncManager.js` (494–514/588–608, 525–557/614–648, 559–576/644–661) — три пары
  почти идентичных блоков внутри одного файла — похоже на copy-paste между похожими настройками.
  Кандидат на параметризованную функцию вместо трёх копий.
- **Новые клоны с прошлого аудита** (появились по мере роста кода, не критичны, но раз уж рядом
  будешь работать в Фазе 4/4.5): `ui/LayersPanel.js` (1102–1120 / 1632–1646) и `ui/OutlinerPanel.js`
  (два внутренних клона, 887–919/1011–1043 и 969–984/1077–1092) — похоже на повторяющуюся логику
  рендера строк списка, кандидат на общий `ListItemRowStructure` (в проекте уже появился файл с
  таким названием для `LevelsPanel` — возможно, стоит унифицировать через него, а не плодить
  третью реализацию).
- **Подтверждено при переносе Фазы 4.6:** `ui/AssetViewRenderer.js` (`getDefaultColor`,
  `getAssetTypeFromCategory`, `getImageDimensions`) побайтово дублирует
  `utils/AssetImporter.js:685,705,724`. Обе стороны — pure lookup-таблицы/промисы без состояния,
  кандидат на общий util (например `utils/AssetCategoryUtils.js`), на который обе стороны бы
  переключились.
  **Сделано (Фаза 6):** только `getImageDimensions` вынесен в `utils/ImageUtils.js` — байт-в-байт
  идентичен в обеих сторонах, риска нет. `getDefaultColor`/`getAssetTypeFromCategory` НЕ слиты —
  у `AssetImporter` 8 категорий (backgrounds/characters/platforms/collectibles/enemies/effects/
  ui/tiles), у `AssetViewRenderer` 6 других (backgrounds/characters/collectibles/enemies/
  environment/objects); часть цветов совпадает по значению случайно, но слияние таблиц изменило
  бы fallback-поведение для категорий, отсутствующих на одной из сторон — оставлено раздельно.

---

## Фаза 7 — Долгосрочные guardrails (после того как Фаза 4 закрыта)

**Зачем:** сам по себе рефакторинг — разовое действие. Без изменения процесса разработки
(проект правится AI-агентами через `.claude/agents`) файлы со временем снова начнут расти теми же
темпами, если не закрепить процесс правилом, а не разовой чисткой.

1. **Уточнение по факту:** `AssetPanel.js` после Фазы 4 — 1154 строки (orchestration-слой оказался
   крупнее исходной оценки ~500–600), override в `scripts/check-file-size.js` остаётся, снимать
   его не планируется. Аналогично `core/LevelEditor.js` (1583 строки) — override из Фазы 3 тоже
   ещё не снят (только `ui/PanelPositionManager.js` реально ушёл из списка после Фазы 4.5, но его
   собственные экстракции `TabLayoutController.js`/`TabDragController.js`/`SplitPaneController.js`
   в списке остались). Пункт 1 в исходной формулировке был основан на неверном допущении — сверять
   актуальный список overrides с `scripts/check-file-size.js` напрямую, а не с этим текстом.
2. Добавить в `docs/` короткий `CONTRIBUTING.md` / `ARCHITECTURE.md` с одним конкретным правилом:
   "перед добавлением новой фичи — найти подходящий существующий Controller/Operations-класс;
   создавать новый файл только если ни один из существующих не подходит по ответственности".
   Это прямая инструкция, которую следующий AI-агент прочитает перед тем, как решить, куда класть
   код — то же самое предлагал ChatGPT, но без опоры на реальную декомпозицию оно осталось бы
   декларацией без механизма проверки.
3. Раз в 2–4 недели прогонять `npx madge --circular src` и `npx jscpd src --min-lines 15` —
   дёшево, ловит деградацию рано.

---

## Сводка: что осталось и почему в этом порядке

(Фазы 0–4.5 закрыты — см. таблицу статусов в начале файла.)

| Фаза | Риск | Ценность | Зависит от |
|---|---|---|---|
| 5. `managers/` (закрыта) | средний | Согласованность архитектуры | Фаза 3 (закрыта) |
| 6. Дедуп | низкий | Мелкие точечные правки | попутно с Фазой 4 (закрыта) |
| 7. Долгосрочные правила | — | Не откатиться назад через месяц | Фаза 1 (закрыта), Фаза 4 (закрыта) |
