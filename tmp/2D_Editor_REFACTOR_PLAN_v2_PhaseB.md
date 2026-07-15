# Замена оконной системы Level Designer на split-tree прототип (Фаза B)

## Context

`tmp/2D_Editor_REFACTOR_PLAN_v2.md` явно откладывал весь `src/ui/*` (Фаза B) до готовности
прототипа новой оконной системы, чтобы не тратить работу на дедуп кода, который будет заменён
целиком. Прототип (`tmp/split-tree-prototype_v1_10.html`) теперь есть — это триггер начать Фазу B.

Задача: полностью заменить нынешний докинг (`PanelPositionManager` + 4 контроллера:
`TabLayoutController`/`TabOrderController`/`TabDragController`/`SplitPaneController`, фиксированные
left/right-tabs-panel + assets-drawer снизу) на generic split-tree/floating-window систему из
прототипа. Реальный контент (Viewport+Toolbar, Outliner, Details, Layers, Assets, Levels)
переезжает в "заглушки" (leaf/floating-window slots) новой системы. Три элемента остаются как
есть, вне докинга: главное меню (`MenuManager`, `<header>`), консоль (`#console-panel`, уже
`position:fixed` overlay — независим от layout), статус-бар (`StatusBar`, `#status-bar`, обычный
flex-child в самом низу). Все три сейчас не имеют ни одной ссылки на `panelPositionManager`
(проверено grep) — перенос в новый `index.html`-скелет чисто механический, без изменения их кода.

Диалоги (`BaseDialog` и потомки: `ActorPropertiesWindow`, `ProjectSettingsDialog`,
`SplashScreenDialog`, `UniversalDialog`, `FolderPickerDialog`) и `SettingsPanel` (монтируется в
`document.body`, не в панельный контейнер) — модальные/полноэкранные оверлеи, не персистентные
рабочие панели. Прототип не моделирует модальные окна вообще (только персистентные leaf/floating
слоты). **Решение: в этой фазе диалоги и SettingsPanel не трогаем** — они продолжают работать как
сейчас, поверх новой докинг-системы, без встраивания в split-tree.

## Оценка прототипа (`tmp/split-tree-prototype_v1_10.html`)

**Сильные стороны:**
- Единая рекурсивная модель дерева (`{type:'split'|'leaf', ...}`) для main-workspace И для дерева
  внутри каждого floating-window — `findNode`/`removeLeaf`/`replaceLeaf`/`insertIntoTree` работают
  одинаково в обоих контекстах через `getTreeOf(workspaceId)/setTreeOf(...)`. Это архитектурно
  чище, чем текущая жёстко зашитая пара `left-tabs-panel`/`right-tabs-panel` + отдельный
  assets-drawer + console-как-overlay.
- Докинг-таргетинг (`detectDropTarget`/`computeZone`/`insertIntoTree`) полностью generic
  относительно workspace — левая/правая/верх/низ/центр зона на любом leaf создаёт новый split-узел.
  Единый обработчик жеста (`startNodeDrag`) переиспользуется для toolbar-chips и pane-заголовков.
- Floating windows — attach-граф (left/right/top/bottom + `groupId`) с edge-snap и каскадным
  сдвигом сгруппированных окон (`restackBottomChain`/`restackRightChain`/`verticalChainWidthSync`)
  — сопоставимо по сложности с Blender-подобным докингом, которого сейчас в проекте нет вообще
  (только 2 фиксированные боковые панели).
- Вся модель (`mainTree` + `floatingWindows`) — plain JSON, естественная точка для persist
  (`updateJson()` уже строит сериализуемый снепшот).

**Узкие места, которые обязательно нужно закрыть до/во время переноса реального контента:**
1. **Нет реконсиляции DOM.** `renderWorkspace`/`renderNode` делают `containerEl.innerHTML = ''` и
   пересоздают поддерево при КАЖДОМ структурном изменении (докинг, снап, collapse floating-окна и
   т.п.). Для placeholder-цветных `div`ов это бесплатно; для реальных `OutlinerPanel` (62KB),
   `LayersPanel` (83KB), `DetailsPanel` (52KB), `AssetPanel` (45KB) — недопустимо: пересоздание DOM
   на каждый drag убьёт scroll-позицию, выделение, открытые dropdown'ы и заново запустит
   конструкторную инициализацию (подписки на `stateManager`, `GlobalEventRegistry` и т.д.) —
   реальная утечка листенеров, т.к. старый контейнер просто выбрасывается без вызова `destroy()`.
   **Это блокер №1** — до переноса реального контента рендер-движок должен научиться реюзать
   существующий DOM-узел контента (реального панеля) через reparent, а не пересоздание.
2. **Нет lifecycle-хуков на leaf.** Ни один путь удаления/замены leaf не вызывает `destroy()` у
   контента — нужен явный adapter-слой между deck-моделью (`contentType`) и реальными классами
   панелей (`editor.outlinerPanel` и т.д.), которые уже имеют `destroy()` (per project convention).
3. **Viewport — особый случай.** Сейчас canvas — фиксированный `position:absolute; inset:0`
   элемент, всегда есть, никогда не ресайзится под панель. В split-tree Viewport-leaf можно
   схлопнуть/уменьшить до 0, свернуть во floating-chrome, закрыть. `CanvasRenderer.resizeCanvas()`
   и render-loop должны переживать 0×0/скрытый контейнер без исключений; при 0 размерах рендер
   логично пропускать. Закрытие Viewport-leaf не должно убивать состояние редактора (selection,
   level data) — только рендер.
4. **Прототип разрешает произвольное дублирование/смену типа leaf** (клик по заголовку меняет
   `contentType` через `openTypeMenu`; drag chip создаёт новый leaf каждый раз). Реальные панели —
   синглтоны (`editor.outlinerPanel` и т.п., по одному экземпляру). Нужно: убрать/задизейблить
   type-menu и duplicate-on-drag-to-self для всех 6 реальных типов — слот либо пуст, либо содержит
   ЕДИНСТВЕННЫЙ существующий экземпляр панели, перемещаемый (не копируемый) между слотами.
5. **Нет persist/restore** — `mainTree`/`floatingWindows` живут только в памяти вкладки. Проект уже
   имеет паттерн (`userPrefs.set/get` + `stateManager.set('panels.*', …)`,
   `EditorPreferencesController.setupAutoSaveOnUnload`) — новую форму состояния нужно туда завести
   по тому же контракту (autosave on unload + restore on init).
6. **Пустое главное дерево = вся рабочая область пуста** (`mainTree=null` после закрытия
   последнего leaf). Нет понятия "обязательный/неубираемый leaf" — для Viewport это нежелательно
   (закрыть единственный видимый рабочий регион редактора не должно быть возможно так же легко,
   как закрыть Details-панель).
7. **z-index не согласован с проектом.** Прототип использует свою шкалу (drop-overlay 400, snap
   overlay 410, type-menu 500, floating windows 10+) — при переносе внутрь реального `index.html`
   нужно свести к единой шкале вместе с существующими диалогами/контекст-меню/сплэш-скрином.
8. **Точечный формат ratio отличается** от текущего (`SplitPaneController` хранит `%` в
   `dataset.splitRatio` строкой; прототип — float 0..1 прямо в JSON-дереве). При переносе брать
   формат прототипа как источник истины (проще, уже JSON-сериализуемый) — не пытаться сохранить
   dataset-подход.

**Итог оценки:** архитектурная модель (generic recursive split-tree + floating windows) — реальное
и оправданное расширение возможностей относительно текущей fixed-2-panel системы, стоит принять
как основу. Но текущий JS прототипа — черновик рендера "для демонстрации drag/split/snap
механики", не готов держать тяжёлый реальный контент без доработки reconciliation-слоя (п.1-2) и
singleton-гварда (п.4). Это и есть основной объём работы Фазы B, а не сам докинг-движок (тот уже
спроектирован разумно и почти не требует изменений в своей геометрии/жестах).

## Реализация — модульная разбивка (по конвенции проекта, см. `CONTRIBUTING.md`/A0 критерий)

Порт прототипа в `src/ui/dock/` (новая директория), решусируя closure-стиль в ES6-классы,
аналогично тому, как `PanelPositionManager` уже декомпозирован на 4 контроллера:

- **`DockTreeModel.js`** — чистые функции без DOM: `findNode/removeLeaf/replaceLeaf/insertIntoTree`,
  модель floating-window (`makeFloatingWindow`, attach/detach graph, snap-математика
  `findFloatingSnapTarget`/`applyFloatingSnap`). Прямой порт соответствующих функций прототипа
  (строки 372-715 в `tmp/split-tree-prototype_v1_10.html`), без изменений логики.
- **`DockRenderer.js`** — рендер дерева/floating-layer в DOM. **Ключевое отличие от прототипа**:
  вместо `containerEl.innerHTML=''` + full rebuild — reconciliation по `node.id`/`contentType`:
  если leaf с данным id уже смонтирован где-то в DOM, `renderLeaf` должен переиспользовать его
  `leaf-body` контейнер через `appendChild` (reparent), не пересоздавать. Это единственная
  содержательная переработка логики прототипа, остальное — перенос почти 1:1.
- **`DockDragController.js`** — порт `startNodeDrag`/`startFloatingDrag`/`startFloatingResize`
  (жесты pointer-based drag, hold-to-detach, double-tap rename, collapse).
- **`DockContentRegistry.js`** — новый файл, которого в прототипе нет: карта
  `contentType → { label, mount(container) }` для 6 реальных типов (`viewport` [canvas+Toolbar
  вместе, как сейчас `#main-panel`], `outliner`, `details`, `layers`, `assets`, `levels`).
  `mount()` либо создаёт панель первый раз (текущий код `EditorLifecycleController.initializeUIComponents`
  делает это уже — конструкторы `OutlinerPanel(container, stateManager, editor)` и т.п. принимают
  контейнер как есть, **менять сами классы панелей не нужно**), либо, если панель уже существует,
  просто передаёт её текущий stable-контейнер `DockRenderer`'у для reparent.
- **`DockPersistence.js`** — сериализация/восстановление `mainTree`+`floatingWindows` через
  `userPrefs`/`stateManager`, по образцу существующего `EditorPreferencesController.setupAutoSaveOnUnload`
  (у него ~120 из ~155 строк — как раз панельное состояние, которое здесь и заменяется; per
  `tmp/2D_Editor_REFACTOR_PLAN_v2.md` п. A7/Фаза B.3, оставшиеся ~35 строк snap/grid выносятся в
  отдельный `saveEditingPreferences()`, не трогаемый этой фазой).
- **`DockManager.js`** — тонкий facade/orchestrator (`constructor(levelEditor)`, `init()`,
  `destroy()`), заменяет `PanelPositionManager.js` как объект на `editor.panelPositionManager`
  (переименовать в `editor.dockManager` со сменой всех call site'ов).

**Call site inventory для переименования/замены `panelPositionManager`** (grep подтверждён,
5 файлов): `src/core/LevelEditor.js`, `src/ui/AssetFoldersController.js`,
`src/managers/ResizerManager.js`, `src/event-system/EventHandlers.js`,
`src/core/EditorLifecycleController.js`. Каждый вызов проверить и переключить на новый
`DockManager` API (часть вызовов типа `togglePanelPosition('folders')` теряет смысл в
generic-докинге — заменяется на "перетащить/задокать программно" эквивалент или на прямой
`insertIntoTree` вызов).

## Порядок переноса (инкрементально, каждый шаг — рабочее состояние `npm run check` + браузер)

1. **B0 — докинг-движок с placeholder-контентом.** Полный порт `DockTreeModel`/`DockRenderer`
   (с reconciliation)/`DockDragController` в новый `index.html`-скелет (структура токен-в-токен из
   прототипа: `#toolbar` chips → `#workspace` → `#split-root`+`#floating-layer`), контент —
   ещё цветные placeholder-`div`ы как в прототипе. Проверка: докинг/сплит/floating/snap/collapse
   работают в реальном приложении без реального контента, `npm run check` зелёный.
2. **B1 — singleton-гвард + persistence.** Задизейблить type-menu/duplicate для 6 реальных типов,
   подключить `DockContentRegistry` (ещё с placeholder mount), подключить `DockPersistence`
   (сохранение/восстановление layout через reload). Проверка в браузере: reload сохраняет layout.
3. **B2 — Viewport (canvas + Toolbar).** Самый рискованный контент — сейчас `canvas` живёт вне
   панельной системы вообще (`#canvas-container` absolute inset:0). Реальный DOM-reparent
   `<canvas>` в `viewport`-leaf безопасен (2D-контекст переживает reparent, в отличие от resize
   буфера), но `CanvasRenderer.resizeCanvas()` должен получить guard на 0×0-контейнер (сейчас
   не проверялся, т.к. канвас всегда был full-viewport). `Toolbar` монтируется как раньше —
   `new Toolbar(toolbarContainer, ...)`, только `toolbarContainer` теперь — стабильный div внутри
   viewport-leaf body, не статичный `#toolbar-container` из старого `index.html`.
4. **B3 — Outliner/Details/Layers/Assets/Levels.** По одной панели за шаг (наименьший риск,
   конструкторы не меняются, меняется только откуда берётся `container`). После каждой — ручная
   проверка (Standard tier: открыть/задокать/свернуть/закрыть панель, убедиться что состояние
   (выделение в Outliner, открытая вкладка в Assets и т.п.) не сбрасывается при перетаскивании).
5. **B4 — фиксы "по ходу переноса"** из `tmp/2D_Editor_REFACTOR_PLAN_v2.md` Фаза B п.3: утечка
   состояния Asset-контроллеров (владение полями `assetPanel` напрямую), двойной источник истины
   `activeTypeFilters`, проверка живости `AssetItemActionsController.handleAssetClick`,
   `renderLevelStats`/`setupCameraStartPositionButton` → новая DOM-версия no-selection view.
6. **B5 — снос старого.** Удалить `PanelPositionManager.js` + `src/ui/panels/*`
   (`TabLayoutController`/`TabOrderController`/`TabDragController`/`SplitPaneController`),
   мёртвый `setupTabDragging()`-блок в старом `index.html` (уже не вызывается — комментарий
   "Tab dragging is managed by PanelPositionManager" подтверждает, что это dead code уже сейчас),
   `styles/panels.css` (докинг-специфичные правила; контент-специфичные файлы типа
   `layers-panel.css`/`details-panel.css`/`settings-panel.css` остаются — стилизуют контент, не
   докинг). Снять устаревшие записи `OVERRIDES` в `scripts/check-file-size.js` для удалённых
   файлов.
7. **B6 — документация.** `DocCodeSync` по `docs/ARCHITECTURE.md`/`Context_map.md`/`CONTRIBUTING.md`
   (новая секция про докинг-архитектуру, замена упоминаний `PanelPositionManager`), обновить
   `tmp/2D_Editor_REFACTOR_PLAN_v2.md` — отметить Фазу B закрытой, зафиксировать фактическую
   разбивку B0-B6 (в файле сейчас Фаза B описана только на уровне намерения).

Каждый шаг — отдельный коммит (per `CONTRIBUTING.md`/v1 правило "clean move → wire → remove old,
раздельно от поведенческих правок"). Тяжёлые шаги (B2 Viewport, B3 по каждой панели) — обязательна
ручная browser-проверка через `chrome-devtools` (Standard/Full tier по таблице в `CLAUDE.md`,
`evaluate_script`/`list_console_messages`, без `take_screenshot`).

## Верификация (сквозная, по завершении всех шагов)

- `npm run check` (lint + check:size + vitest + madge --circular) зелёный.
- Браузер (`chrome-devtools`, `http://localhost:3000/index.html`): создать 3-4-уровневый
  вложенный split, задокать все 6 типов контента, вынести одну панель во floating window,
  застакать 2 floating window через snap, свернуть/развернуть, закрыть и переоткрыть Viewport,
  перезагрузить страницу — layout и содержимое (выделенный объект, открытая asset-вкладка)
  восстанавливаются. `list_console_messages` — 0 новых ошибок на каждом действии.
- Главное меню, консоль (`` ` ``-toggle), статус-бар — работают без изменений в поведении.
- Grep-подтверждение: `grep -rn "panelPositionManager" src` — 0 совпадений после B5 (все
  переключены на `dockManager` или удалены вместе со старым контроллером).
