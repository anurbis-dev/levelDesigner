# План рефакторинга levelDesigner — инструкция для Claude Code

> **Обновлено по свежему снепшоту репозитория** (было 99 модулей/47.6k строк на момент первого
> аудита → сейчас 113 модулей/53.8k строк). Повторный прогон madge/jscpd + ручная проверка каждого
> файла, который фигурирует в плане ниже. Короткий вывод: **ни один пункт плана ещё не начат**
> (тестов по-прежнему 0, `window.*` globals на месте, менеджеры всё ещё без общего контракта), и
> при этом появился **третий God Object** (`PanelPositionManager.js`, +991 строка со времени
> первого аудита) — см. новую Фазу 4.5. План ниже перестроен с учётом этого, порядок фаз не менялся
> концептуально, только уточнены цифры и добавлена одна новая фаза.

> Основано на: статическом аудите репозитория (113 собственных JS-модулей в `src/`, 53 770 строк):
> madge (граф зависимостей, циклы), jscpd (дублирование), ручной разбор `LevelEditor.js`,
> `AssetPanel.js`, `PanelPositionManager.js`.
> Тестов в проекте по-прежнему нет ни одного.

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
   на месте, а фиксируй в `docs/refactor-backlog.md` и продолжай текущую фазу. Разбегаться по
   находкам — то, что уже привело код в текущее состояние.

---

## Фаза 0 — Страховочная сетка (обязательна перед всем остальным)

**Зачем:** в проекте 0 тестов и нет `.eslintrc`. Рефакторинг God Object без тестов — это не
рефакторинг, а угадывание. Разбивать `LevelEditor.js` (было 2217/102, сейчас **2399 строк, 105
методов, 46 импортов** — вырос со времени первого аудита), `AssetPanel.js` (3083 строки, 95
методов) и `PanelPositionManager.js` (**новый в списке — 2548 строк, 60 методов**, см. Фазу 4.5)
вслепую — гарантированный источник регрессий, которые всплывут только в ручном тестировании
(или у пользователя).

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

### 0.4 Дополнительная находка при повторном аудите — не блокирует рефакторинг, но стоит знать
`src/models/Level.js` → `toJSON()` не сериализует собственный `id` уровня — это уже задокументировано
прямо в коде `Project.js` как осознанный компромисс ("a fresh id is generated on every `fromJSON()`,
so a saved level id can't be used to identify 'the current level' again after reload"), с обходом
через индекс в массиве `levels[]`. Это не баг, который нужно чинить в рамках этого плана — но
если параллельно будет реализовываться движок (см. `ENGINE_PLAN.md`, аддоны переопределяют уровни
по `id`), эта конкретная деталь станет блокирующей для той работы. Фиксирую здесь, чтобы не
потерялась между двумя документами.

---

## Фаза 1 — Guardrails в CI, чтобы не деградировать дальше

**Зачем:** проект развивается через AI-агентов (в репо уже есть `.claude/agents`, `.qwen/agents`).
Без автоматических ограничений агент неизбежно продолжит добавлять импорты в `LevelEditor.js` и
`AssetPanel.js`, потому что это самый быстрый локальный путь — "просто подключить сюда ещё одно".

### 1.1 Лимит импортов на файл
- `eslint-plugin-import`, правило `import/max-dependencies: [error, {max: 20}]`.
- **Важно:** `LevelEditor.js` (46, было 43 — успел вырасти) и `AssetPanel.js` (16, но 95 методов —
  см. Фазу 4) сейчас превышают лимит. Это ожидаемо. Добавь эти два файла во временный `overrides`
  в `eslint.config.js` с комментарием `// TODO remove after Фаза 3/4` — лимит должен ловить *новые*
  нарушения, а не блокировать коммиты до того, как ты сам разберёшь эти файлы.

### 1.2 Лимит строк на файл
- Кастомное ESLint-правило или скрипт в `scripts/check-file-size.js`, порог 400 строк для новых
  файлов. Для существующих больших файлов (список ниже) — тоже overrides с TODO.

Файлы, которые сейчас превышают 500 строк (актуальный список, для трекинга в backlog — **32 файла,
было 27 при первом аудите**, рост не остановился, пока план не начат):
`AssetPanel.js` (3083), `PanelPositionManager.js` (2548 — **новое, +991 с прошлого аудита, см.
Фазу 4.5**), `LevelEditor.js` (2399), `LayersPanel.js` (2094), `MouseHandlers.js` (1899),
`RenderOperations.js` (1509), `SettingsPanel.js` (1502), `EventHandlers.js` (1496),
`OutlinerPanel.js` (1394), `DetailsPanel.js` (1335), `Toolbar.js` (1319),
`SettingsSyncManager.js` (1059), `SettingsPanelRenderers.js` (1050), `BaseContextMenu.js` (1012),
`ConfigManager.js` (1005), `AssetImporter.js` (953), `Level.js` (849), `AssetTabsManager.js` (837),
`ObjectOperations.js` (835), `LevelsPanel.js` (803 — **новый файл, уже выше порога с рождения**),
`FoldersPanel.js` (745), `EventHandlerManager.js` (741), `MenuManager.js` (726),
`GroupOperations.js` (712), `WorldPositionUtils.js` (632), `AssetManager.js` (621),
`SelectionUtils.js` (615), `ErrorHandler.js` (602), `EventHandlerUtils.js` (546), `Logger.js`
(538), `StateManager.js` (527), `ActorPropertiesWindow.js` (525).

Не рефакторь их все — это просто карта территории. Фазы 3, 4 и 4.5 закрывают три самых критичных.
Отдельно стоит отметить: **`LevelsPanel.js` — новый файл (мультиуровневая поддержка) и сразу
родился на 803 строках**, выше порога Фазы 1.2. Это симптом того же паттерна, который привёл
`LevelEditor.js`/`AssetPanel.js` к их размеру: без работающего guardrail'а новый функционал сразу
пишется одним файлом. Если Фаза 1 будет введена раньше следующей крупной фичи — таких файлов
станет меньше по умолчанию, не постфактум.

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

**Обновление после повторного аудита:** сам файл, где живут эти globals, с прошлого раза вырос с
1557 до 2548 строк (+991) — в нём появилась крупная фича split-pane/drag-detach окон (см. Фазу 4.5).
Это не отменяет и не откладывает эту фазу — все те же `window.*` присвоения на месте, фикс ниже
такой же локальный и низкорисковый, как и был. Но после этой фазы файл всё равно останется большим
God Object'ом — декомпозиция по ответственностям вынесена отдельно в Фазу 4.5, не смешивай эти две
задачи в одном PR.

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

## Фаза 4 — Декомпозиция `AssetPanel.js` (3083 строки, 95 методов)

**Зачем:** этот файл больше `LevelEditor.js` по строкам, но у него всего 16 импортов — поэтому
поверхностный анализ "по числу импортов" (именно так делал ChatGPT в вашем скриншоте) его не
находит. Он не менее критичен для рефакторинга, просто прячется по другой метрике.

Ниже — деление по фактическим методам файла, сгруппированное по ответственности.

### 4.1 `AssetFoldersController` (папки/вкладки)
Методы: `initializeTabsManager`, `getActiveTabPaths`, `getActiveTabPath`, `getAssetsFromFolder`,
`getFolderName`, `addFolderTab`, `removeFolderTab`, `loadFoldersPosition`, `saveFoldersPosition`,
`createFoldersContainer`, `initializeFoldersPanel`, `updateFoldersLayout`, `toggleFoldersPosition`,
`filterByFolder`, `setupFoldersResizer`, `getCurrentTabFolder`, `getActiveTab`.

### 4.2 `AssetViewRenderer` (отрисовка сетки/списка/деталей)
Методы: `render`, `renderTabs`, `renderPreviews`, `renderGridView`, `renderListView`,
`renderDetailsView`, `createAssetThumbnail`, `createAssetListItem`, `createAssetDetailsRow`,
`isValidImageSrc`, `createColorFallback`, `truncateAssetName`, `getImageDimensions`,
`getDefaultColor`, `getAssetTypeFromCategory`, `updateGridViewSizes`.
- Часть этих методов (`isValidImageSrc`, `createColorFallback`, `getImageDimensions`,
  `getDefaultColor`) — чистые функции без обращения к `this`. Их можно вынести не в класс, а в
  `src/utils/AssetRenderUtils.js` как обычные экспортируемые функции — это одновременно и
  декомпозиция, и упрощение тестирования (Фаза 0.2 может покрыть их без моков DOM).

### 4.3 `AssetFilterController` (поиск/фильтр)
Методы: `showAssetFilterMenu`, `updateAssetFilterMenu`, `shouldShowAsset`, `clearSearch`,
`filterAssets`, `renderAssetSearchControls`.
- `shouldShowAsset` и `filterAssets` — приоритет для характеризационных тестов до переноса
  (Фаза 0.2), это чистая логика фильтрации, которую проще всего сломать незаметно.

### 4.4 `AssetSelectionController` (выделение)
Методы: `selectAsset`, `getSelectionContainer`, `getAssetList`, `getSelectableAssetElements`,
`updateSelectionVisuals`, `handleSelectAll`, `handleDeselectAll`.
- Обрати внимание: в проекте уже есть `src/utils/SelectionUtils.js` (615 строк) — прежде чем
  создавать новый контроллер, проверь пересечение ответственности через
  `grep -n "class\|^export" src/utils/SelectionUtils.js`. Возможно, часть логики выделения ассетов
  должна переиспользовать существующий util, а не дублировать его — это прямая профилактика
  дублирования, которое нашёл jscpd между `AssetPanel.js` и `OutlinerPanel.js`.

### 4.5 `AssetDragDropController` (drag & drop)
Методы: `handleThumbnailDragStart`, `handleThumbnailDragEnd`, `addDropTarget`, `removeDropTarget`,
`setupDragAndDrop`, `canDropToActiveFolder`, `isExternalFilesDrag`, `isOverTabsContainer`,
`isOverPreviewsContainer`, `updateOverlayPosition`, `updateDropOverlayStyle`, `handleDragEnter`,
`handleDragOver`, `handleDragLeave`.
- **Важно:** jscpd нашёл клон именно drag-drop логики между `AssetPanel.js` (строки 1008–1038,
  1052–1067) и `OutlinerPanel.js` (205–235, 251–266). При выносе в отдельный контроллер — сразу
  проверь, можно ли сделать `AssetDragDropController` переиспользуемым между `AssetPanel` и
  `OutlinerPanel` (общий базовый класс или общий util), а не просто скопировать в новый файл под
  новым именем. Иначе дублирование просто переедет, а не исчезнет.

### 4.6 `AssetItemActionsController` (контекстные действия над ассетом)
Методы: `setupContextMenus`, `handleAssetOpenEditor`, `handleAssetRename`, `handleAssetDuplicate`,
`handleAssetDelete`, `handleItemDoubleClick`, `handleAssetClick`.
- Проверь пересечение с `grep -n "jscpd" -A3` находкой про клон `AssetPanel.js` [2745:2774] и
  `AssetImporter.js` [698:727] — вероятно, логика импорта/дублирования ассетов частично продублирована,
  стоит унифицировать в момент переноса.

### 4.7 `AssetToolbarController` (тулбар панели ассетов)
Методы: `decreaseAssetSize`, `increaseAssetSize`, `setViewMode`, `loadAssetSize`, `saveAssetSize`,
`loadViewMode`, `saveViewMode`, `handleResetSize`, `handleToggleGrid`, `handleToggleList`,
`handleToggleDetails`, `handleRefresh`, `handleSettings`.

### 4.8 Что остаётся в `AssetPanel.js`
`constructor`, `init`, `destroy`, `setupEventListeners`, `setupAssetPanelHandlers`,
`setupAssetEvents`, `updateContentVisibility`, `handleAssetWheel`, `autoResizePanelHeight`,
`showSaveSuccessMessage`, `showSaveErrorMessage`, `showErrorMessage`,
`shouldShowUnsavedIndicator` — orchestration-слой и мелкие UI-уведомления, не тянут на отдельный
контроллер.

**Порядок выноса:** начни с 4.2 (рендер) — он самый крупный по строкам и наименее рискованный
(чистая отрисовка, легко сверить визуально), закончи 4.5 (drag & drop) — самый связанный с другими
файлами и самый рискованный.

**Критерий готовности Фазы 4:** `AssetPanel.js` — не более ~500–600 строк (orchestration only).
Все сценарии работают вручную: переключение папок/вкладок, grid/list/details view, поиск,
drag&drop ассета на канвас, контекстное меню, изменение размера превью.

---

## Фаза 4.5 — Декомпозиция `PanelPositionManager.js` (новое: 2548 строк, 60 методов)

**Зачем добавлена эта фаза:** этого файла не было среди целей первого аудита в таком масштабе
(тогда — 1557 строк, фигурировал только из-за `window.*` globals в Фазе 2). За время между
аудитами в него добавили крупную фичу — судя по методам, это Blender-style split-pane/detach
window manager (`mergeTabIntoSplit`, `replacePaneInSplit`, `detachFromSplit`,
`_startSplitPaneDetachDrag`, `_setupSplitResizer` и т.д. — примерно 900 строк одного этого блока).
Сейчас это третий по размеру файл в проекте (после `AssetPanel.js` и перед `LevelEditor.js`) и
формально не менее God Object, чем те два — просто до сих пор не разбирался, потому что вырос уже
после первого прохода аудита. Ровно случай, о котором предупреждает правило №4 в разделе "Как
работать с этим документом": не откладывать найденное в бэклог навсегда.

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

---

## Фаза 6 — Точечное устранение дублирования

Дублирование в проекте по-прежнему низкое (1.75% по jscpd, **30 клонов, было 27** — выросло
пропорционально размеру кода, не системная проблема) — отдельной большой фазы не нужно. Делай это
заодно с Фазами 3–4.5, когда трогаешь соответствующие файлы:

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

---

## Фаза 7 — Долгосрочные guardrails (после того как Фазы 3–4.5 закрыты)

**Зачем:** сам по себе рефакторинг — разовое действие. Без изменения процесса разработки
(проект правится AI-агентами через `.claude/agents`) файлы снова начнут расти теми же темпами —
**это уже наблюдаемый факт, не гипотеза**: `LevelEditor.js` вырос на 182 строки, `AssetPanel.js`
на 40, а `PanelPositionManager.js` — на 991 строку между двумя аудитами, и родился ещё один файл
(`LevelsPanel.js`) сразу выше порога в 500 строк. Без Фазы 1, введённой раньше следующей крупной
фичи, аудит через месяц с высокой вероятностью найдёт четвёртый God Object.

1. Снять overrides из Фазы 1.1/1.2 для `LevelEditor.js`, `AssetPanel.js` и `PanelPositionManager.js`
   — после Фаз 3, 4 и 4.5 они должны укладываться в общие лимиты наравне со всеми.
2. Добавить в `docs/` короткий `CONTRIBUTING.md` / `ARCHITECTURE.md` с одним конкретным правилом:
   "перед добавлением новой фичи — найти подходящий существующий Controller/Operations-класс;
   создавать новый файл только если ни один из существующих не подходит по ответственности".
   Это прямая инструкция, которую следующий AI-агент прочитает перед тем, как решить, куда класть
   код — то же самое предлагал ChatGPT, но без опоры на реальную декомпозицию оно осталось бы
   декларацией без механизма проверки.
3. Раз в 2–4 недели прогонять `npx madge --circular src` и `npx jscpd src --min-lines 15` —
   дёшево, ловит деградацию рано.

---

## Сводка: что делать в первую очередь и почему именно в этом порядке

| Фаза | Риск | Ценность | Зависит от |
|---|---|---|---|
| 0. Тесты + линт | — | Без этого всё остальное вслепую | — |
| 1. CI-лимиты | низкий | Останавливает деградацию немедленно (уже наблюдаемую) | Фаза 0 |
| 2. Убрать `window.*` | низкий | Быстрая победа, тренировка процесса | Фаза 0 |
| 3. `LevelEditor.js` | высокий | God Object №1 (растёт: 2217→2399) | Фазы 0–2 |
| 4. `AssetPanel.js` | высокий | God Object №2 (растёт: 3043→3083) | Фазы 0–2 |
| 4.5 `PanelPositionManager.js` | высокий | God Object №3, новый (растёт: 1557→2548) | Фазы 0, 2 |
| 5. `managers/` | средний | Согласованность архитектуры | Фаза 3 |
| 6. Дедуп | низкий | Мелкие точечные правки | попутно с 3–4.5 |
| 7. Долгосрочные правила | — | Не откатиться назад через месяц (уже откатывался) | Фазы 1, 3–5 |

Не начинай Фазу 3 без Фазы 0 — это единственный по-настоящему жёсткий гейт в этом плане. Фаза 4.5
может идти параллельно с Фазой 3/4 (разные файлы, независимые ветки) — жёстко зависит только от
Фазы 2 (тот же файл) и Фазы 0 (тесты).
