# Замена оконной системы Level Designer на split-tree прототип (Фаза B)

**Status:** B0–B5 done · **next = B6** (docs)  
**Inventory date:** 2026-07-15 (call sites / init order / persist keys / index shell)

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

## Inventory (код, 2026-07-15)

### External call sites `panelPositionManager` (5 файлов)

| File | Call |
|------|------|
| `LevelEditor.js:119-120` | `new PanelPositionManager` + lifecycle register prio 2 |
| `LevelEditor.js:455` | `.tabLayoutController.togglePanelPosition('rightPanel')` |
| `EventHandlers.js:564` | `.tabLayoutController.initializePanelPositions()` |
| `EventHandlers.js:855` | `.tabLayoutController.ensurePanelExists(config.side)` |
| `EventHandlers.js:874` | `.splitPaneController.removeEmptyPanel(config.side)` |
| `AssetFoldersController.js:327-328` | `.tabLayoutController.togglePanelPosition('folders')` |
| `ResizerManager.js:229-230` | `.panelPositionManager._updateUI()` (**no-op** сегодня) |
| `EditorLifecycleController.js:230` | guard `._initializing` на subscribe `tabPositions` |

### Init order (сейчас)

1. `LevelEditor` ctor → StateManager, ResizerManager, **PanelPositionManager**, ops, lifecycle/prefs  
2. `init()` → config → `initializeDOMElements`  
3. assets scan/preload  
4. `initializeRenderer` + first `resizeCanvas()`  
5. **`initializeUIComponents`** (Asset/Details/Outliner/Levels/Layers/Settings/ActorProps/Toolbar/StatusBar)  
6. EventHandlerManager + Menu + `setupEventListeners` + panel size listeners  
7. `initializeViewStates` → **`initializePanelPositions()`** (tabs/resizers/splits/assets)  
8. `applySavedPanelSizes` (console + tab orders; widths/assets уже PPM)  
9. finalize → render, autosave unload, `body.editor-ready`

**Target init (после B):** DOM shell → core + `DockManager` → UIComponents в registry hosts →
`dockManager.init()` restore+mount → events/menu (**без** `initializePanelPositions`).

### DOM shell (`index.html`)

```
body.flex.flex-col.h-screen
├── header (#menu-container)                    // вне dock
├── #canvas-container.absolute → #main-canvas   // сейчас bottom layer; B2 → leaf measure
├── div.flex.flex-grow…                         // PPM insert: left/right-tabs dynamic
│   └── #main-workspace → #main-panel
│       ├── #toolbar-container
│       └── #canvas-viewport                    // measure target resizeCanvas
├── #details|levels|layers|outliner-content-panel  // off-tree до tab init
├── #resizer-assets + footer#assets-panel
├── #status-bar                                 // вне dock
└── #console-panel                              // вне dock
```

### Content types

| contentType | Cardinality | Instance / Notes |
|-------------|-------------|------------------|
| `viewport` | **singleton** | canvas + Toolbar; host `#canvas-viewport`; **не** клонируется (один editor canvas) |
| `outliner` | **multi** | primary: `editor.outlinerPanel`; self-drop / extra leaf → **отдельный instance** (B4) |
| `details` | **multi** | primary: `editor.detailsPanel`; extra → clone/factory (B4) |
| `layers` | **multi** | primary: `editor.layersPanel`; extra → clone/factory (B4) |
| `assets` | **multi** | primary: `editor.assetPanel`; не fixed footer; extra → clone/factory (B4) |
| `levels` | **multi** | primary: `editor.levelsPanel`; extra → clone/factory (B4) |

**Primary** = первый/«канонический» instance, на который смотрит legacy `editor.*Panel` и существующие call sites.  
**Copy** = независимый UI-instance того же `contentType` (свой DOM root, scroll, local UI state); данные уровня/selection — shared через editor/stateManager, не deep-copy document.

### Persist keys

**Сейчас (panels / UI):**  
`panels.rightPanelWidth|leftPanelWidth|assetsPanelHeight|consoleHeight|foldersWidth` (+ previous*),  
`tabPositions`, `left|rightPanelTabOrder`, `left|rightPanelSplits`, `tabPosition_*`,  
`view.leftPanel|rightPanel|assetsPanel`, visibility prefs, `foldersPosition`, `rightPanelPosition`.

**Новые (dock):** `panels.dock.mainTree`, `panels.dock.floatingWindows`.  
**Стоп после B5:** splits / tabPositions / tab orders L-R / fixed L-R widths.  
**Оставить:** console height, asset tab order, toolbar, grid/snap.

Нет `panels.dock.*` при restore → default tree (не миграция старых splits).

### Default tree (first run)

```
row:
  left  ~0.25 → column(outliner, layers)
  center ~0.5 → viewport
  right ~0.25 → column(details, levels)
assets → bottom dock под workspace (зафиксировать в B1, допустим floating)
```

Viewport: не close-кнопкой (View hide / chip reopen без уничтожения состояния редактора).

### Corrections vs ранняя версия этого плана

| Было в плане | Факт |
|--------------|------|
| `resizeCanvas` без 0×0 guard | **Уже есть** (`CanvasRenderer.js:30-47`) — после reparent только проверить |
| — | Stale ids `#left-panel`/`#right-panel`/`#resizer-x` в prefs/listeners — снос в B5 |
| — | Assets + console + toolbar сейчас **вне** L/R tab dock; assets = ResizerManager footer |

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
   пересоздают поддерево при КАЖДОМ структурном изменении. Для placeholder-цветных `div`ов это
   бесплатно; для реальных панелей — недопустимо (scroll, selection, dropdowns, listener leaks).
   **Блокер №1** — reparent existing content root по `node.id`, не recreate.
2. **Нет lifecycle-хуков на leaf.** Close leaf → detach/hide в off-tree pool; `destroy()` панелей
   только на teardown приложения. Нужен adapter `contentType` ↔ `editor.*Panel`.
3. **Viewport — особый случай.** Canvas сейчас absolute full-area; в leaf — 0×0/hidden/floating.
   `resizeCanvas` уже guard'ит 0×0; render-loop должен пропускать пустой viewport. Close viewport
   не убивает selection/level data — только рендер. Prefer non-closeable + chip reopen.
4. **Cardinality (post-B1 UX + B4 multi-instance):**
   - type-menu **on**: free type → assign; уже open multi-type → **swap** (или assign на copy-slot — см. B4);
   - self-drop **on** (прототип): drop на собственный leaf → tree-clone + zone split;
   - **B0–B3:** mount pool по `contentType` (last-wins) — достаточно для primary wire;
   - **B4:** multi panel types — **реальное копирование UI-instance** (не last-wins):
     self-drop / второй leaf того же type → factory `createPanelInstance(type)` + root keyed by `node.id`;
     viewport остаётся singleton (self-drop viewport → либо no-op, либо split с warning / только layout placeholder — зафиксировать в B4: prefer **block clone** или **second leaf without second canvas**);
   - close non-primary copy → destroy/park instance; primary close → hide + reopen path;
   - move between slots — drag-drop; reopen missing primary — `showContentType` / View.
5. **Persist/restore** — `userPrefs`/`stateManager` + autosave unload (контракт
   `EditorPreferencesController`; snap/grid → отдельно, не эта фаза).
6. **Пустое mainTree** — empty-zone + chips; viewport не должен пропадать «в один клик».
7. **z-index** — свести шкалу прототипа (drop 400 / snap 410 / menu 500 / float 10+) к
   диалогам/контекст-меню/splash проекта.
8. **Ratio** — float 0..1 в JSON-дереве (формат прототипа), не `dataset.splitRatio` %.

**Итог:** модель split-tree + floating — принять. Основной объём Фазы B = reconciliation +
singleton + wire real content, не переписывание геометрии/жестов.

## Реализация — модульная разбивка

Порт в `src/ui/dock/` (ES6-классы, как PPM → 4 controllers):

- **`DockTreeModel.js`** — pure, без DOM: tree ops + floating attach/snap (порт ~372–715
  прототипа, логика 1:1).
- **`DockRenderer.js`** — DOM. **Отличие от прототипа:** reconciliation по `node.id` —
  `leaf-body` reparent через `appendChild`, не `innerHTML=''` wipe контента. Chrome
  (headers/resizers) можно пересоздавать; content roots — нет.
- **`DockDragController.js`** — `startNodeDrag` / floating drag-resize / hold-to-detach /
  rename / collapse.
- **`DockContentRegistry.js`** — `contentType → { label, mount, singleton }` для 6 типов.
  `mount()`: first time — ctor path (как `initializeUIComponents`); later — stable root
  reparent. **Классы панелей не менять.**
- **`DockPersistence.js`** — `mainTree`+`floatingWindows` через userPrefs/stateManager.
- **`DockManager.js`** — facade (`init`/`destroy`) → `editor.dockManager` (замена
  `panelPositionManager`).
- **`styles/dock.css`** — порт прототипа + z-index проекта.

**API migration**

| Old | New |
|-----|-----|
| `editor.panelPositionManager` | `editor.dockManager` |
| `initializePanelPositions()` | `dockManager.init()` + restore |
| `togglePanelPosition('rightPanel'\|'folders')` | show/focus leaf / `insertIntoTree` |
| `ensurePanelExists` / `removeEmptyPanel` | tree ops |
| `_updateUI()` | удалить call site |
| View menu: Left/Right/Assets Panel | per-`contentType` toggles → `dockManager.showContentType` / hide (B3.1) |
| `togglePanel('leftPanel'\|'rightPanel'\|'assetsPanel')` | `toggleDockContent(type)` (B3.1) |
| prefs `view.leftPanel\|rightPanel\|assetsPanel` | presence in `panels.dock.mainTree` (+ floats) / optional `view.dock.*` |

## Порядок переноса (каждый шаг: `npm run check` + browser, отдельный коммит)

### B0 — докинг-движок + placeholders  ✅

- [x] `DockTreeModel` / `DockRenderer` (reconciliation) / `DockDragController` / `DockDropOverlay` / `DockManager` → `src/ui/dock/`
- [x] `styles/dock.css`
- [x] `index.html` shell: `#dock-workspace` → `#split-root` + `#floating-layer` + chips; menu/console/status as-is; legacy DOM in `#dock-legacy-offtree`
- [x] Wire `editor.dockManager`; placeholders (цветные div)
- [x] QA: `npm run check` green (lint + size + vitest + circular)

**Commit:** `feat(dock): B0 split-tree engine with placeholder content`

### B1 — singleton-гвард + persistence  ✅

- [x] `DockContentRegistry` (placeholder mount ok)
- [x] Type-menu: restored post-B1 with singleton **swap** — see §4
- [x] Self-drop duplicate restored (prototype): drop on own leaf → `makeLeaf` clone + zone split
- [x] Chips только для **missing** (закрытых) типов (chips strip later removed; reopen API remains)
- [x] Viewport non-closeable / reopen path (`showContentType` + chips/View)
- [x] `DockPersistence` load/save; keys `panels.dock.mainTree` / `panels.dock.floatingWindows`
- [x] Default assets = bottom strip under L/C/R workspace

**Commit:** `feat(dock): B1 singleton registry + layout persistence`

### B2 — Viewport (canvas + Toolbar)  ✅

- [x] Viewport leaf hosts: canvas measure + toolbar container (`_mountViewport`)
- [x] ResizeObserver → `resizeCanvas()`; 0×0 guard verified (park/offtree quiet skip)
- [x] Canvas inside `#canvas-viewport` (leaf measure), not full-screen absolute under header

**Commit:** `feat(dock): B2 viewport and toolbar in dock leaf`

### B3 — Outliner / Details / Layers / Levels / Assets  ✅

Порядок: Outliner → Details → Layers → Levels → Assets.  
**Пока primary-only:** container source + reparent; ctor primary path не ломать.  
Multi-instance **не** в scope B3 (last-wins pool ок, один leaf на type в default tree).

- [x] `DockContentRegistry._mountPrimaryPanel` — reparent by `#*-content-panel` / `#assets-panel`
- [x] CSS leaf fill for panel roots; `#resizer-assets` hidden under dock
- [x] Assets: no fixed footer height (skip autoResize / assetsPanelHeight prefs when dock active)
- [x] `applyPanelVisibility` skip assets/L-R when dock; search controls still init
- [x] QA: `npm run check` + `tmp/check-b3.mjs` (all 5 roots in leaf bodies, non-zero size)

**Commit:** `feat(dock): B3 primary panels in dock leaves`

### B3.1 — View → Panels: список окон под dock  ✅

Сейчас `config/menu.js` + `EventHandlers.togglePanel` всё ещё legacy **Left / Right / Assets Panel**  
(`view.leftPanel|rightPanel|assetsPanel`). Chips-strip убран — **меню View = reopen path**.

**Menu (`config/menu.js`, section Panels)**
- [x] Убрать (или не показывать): `toggle-left-panel`, `toggle-right-panel`, `toggle-assets-panel`.
- [x] Добавить toggles по contentType (labels = `TYPE_META`):
  - Viewport, Outliner, Details, Layers, Assets, Levels  
  - плюс **вне dock** как сейчас: Toolbar, Console, Status Bar.
- [x] `stateKey` / checkmark = «primary (или любой) leaf этого type present»  
  (sync из dock tree, не из старых `view.leftPanel`…).
- [x] Shortcuts: remap `ui.toggleLeftPanel` / `Right` / `Assets` → Outliner/Details/Assets  
  (legacy key names kept as aliases).

**Handlers**
- [x] `EventHandlers.togglePanel` / `applyPanelVisibility`:  
  dock types → `editor.dockManager.showContentType(type)` / `hideContentType`  
  (`hideContentType` / `toggleContentType` on `DockManager`).
- [x] Immersive/game mode: `enterImmersiveLayout` / `exitImmersiveLayout` (snapshot → viewport-only).
- [x] Menu checkbox refresh on dock structure change (`onStructureChange` → `syncDockPanelMenuCheckboxes`).

**Вне scope B3.1:** multi-instance «N copies» в меню (только present/absent primary-or-any);  
кол-во копий — не пункт меню (B4 layout only).

**QA**
- [x] View → закрыть Layers → leaf gone; снова Layers → `showContentType` restore.
- [x] Viewport toggle: hide/show без destroy canvas state (non-closeable policy).
- [x] Console / Status / Toolbar без регрессий.
- [x] `npm run check` + `tmp/check-b3.1.mjs` (hide/show layers, viewport park, menu ids, legacy alias, immersive)

**Commit:** `feat(dock): B3.1 View menu content-type panels`

### B4 — multi-instance: реальное копирование панелей  ✅

Цель: self-drop / второй leaf того же `contentType` даёт **рабочую копию UI**, не пустой last-wins slot.

**Scope (multi):** `outliner`, `details`, `layers`, `assets`, `levels`.  
**Вне scope (singleton):** `viewport` — один canvas/toolbar; self-drop viewport = **no-op** (или только structural refuse + log), без второго canvas.

**Модель / registry**
- [x] `DockContentRegistry`: `singleton: false` для multi-types; root map key = **`node.id`** (не contentType).
- [x] Primary map `contentType → primaryNodeId` (или `editor.*Panel` ↔ primary leaf id) для legacy API.
- [x] Factory: `DockPanelFactory.createPanelCopy` → new panel class instance; primary остаётся `editor.outlinerPanel` и т.д.
- [x] Close copy: unmount + `destroy()` instance (`reconcileLiveLeaves`); close primary: hide/pool + reopen, **не** destroy editor state.
- [x] Self-drop path уже делает `makeLeaf` + split — B4 **mount** второго instance; viewport self-drop blocked.
- [x] Type-menu: два leaf одного type допустимы (`+`); singleton swap `⇄`; assign free type ok.
- [x] Persist: tree уже хранит N leaf с одним contentType; restore → factory per leaf (primary = first claim / sticky primaryLeafId).

**Панели (на каждую multi-type)**
- [x] Instance: `instanceKey` + scoped search/context-menu ids; container-scoped DOM queries.
- [x] Shared data only: selection, level, assets catalog через `levelEditor` / `stateManager`.
- [x] Local UI state per instance: scroll/search/filter local to instance (shared filters still via state where primary already shared).
- [x] Не дублировать document/level data.

**QA**
- [x] Self-drop Outliner → 2 Outliner: оба mount + hierarchy (`tmp/check-b4.mjs`).
- [x] Layers×2 deep-check; other multi types via factory (same path).
- [x] Close secondary → primary жив; re-render keeps 2× layers.
- [x] Viewport singleton (no clone); `npm run check` green.

**Commit:** `feat(dock): B4 multi-instance panel copies`

### B4.2 — multi-viewport + work/game cameras  ✅

- [x] `ViewportViewManager`: work camera (primary ↔ `stateManager.camera`) vs game cameras (`type===camera` objects)
- [x] Viewport multi-instance: secondary canvas leaf; primary shell + toolbar; self-drop clone
- [x] Per-view type display filter + camera source in leaf header (🎥 / filter)
- [x] Secondary nav: wheel zoom + middle/alt pan; game-source unlocks to free work on pan
- [x] `RenderOperations` multi-frame draw; `CanvasRenderer.setTarget`
- [x] QA: `tmp/check-b4.2.mjs`

**Deferred:** full MouseHandlers input on secondary (selection tools still primary-focused); persist per-view camera in dock snapshot.

**Commit:** `feat(dock): B4.2 multi-viewport work/game cameras`

### B4.1 — фиксы «по ходу» (только если регрессии B3/B4)

Из v2 Фаза B.3: ownership Asset-контроллеров, dual `activeTypeFilters`,
`handleAssetClick` liveness, Details no-selection DOM (`renderLevelStats` /
`setupCameraStartPositionButton`). Не расширять scope без регрессии.

### B5 — снос старого  ✅

- [x] Delete `PanelPositionManager.js` + `src/ui/panels/*` (+ `PanelSubController`)
- [x] Dead `setupTabDragging` в `index.html`
- [x] Dock-rules в `styles/panels.css` (content CSS оставить)
- [x] OVERRIDES в `scripts/check-file-size.js`
- [x] Stale prefs/listeners `#left-panel`/`#right-panel`/`#resizer-x`
- [x] `grep panelPositionManager src` → **0**

**Commit:** `refactor(dock): B5 remove PanelPositionManager`

### B6 — документация

- [ ] DocCodeSync: `ARCHITECTURE.md`, `Context_map.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- [ ] `tmp/2D_Editor_REFACTOR_PLAN_v2.md` — Фаза B closed + фактическая разбивка B0–B6 (+ B3.1 View menu, B4 multi-instance)

Каждый шаг — отдельный коммит (clean move → wire → remove old, отдельно от behavior).  
B2/B3/B3.1/B4: chrome-devtools Standard/Full tier (`evaluate_script` / `list_console_messages`,
**без** `take_screenshot`).

## Risks

| Risk | Mitigation |
|------|------------|
| Full rebuild убивает listeners | reconciliation до real content (B0) |
| Dual layout transition | shell swap B0; real panels B2/B3 |
| Prefs | нет `panels.dock.*` → default tree |
| ResizerManager L/R widths | ratios в tree; ResizerManager → dialogs only после B5 |
| Multi-instance + global panel ids | B4: scoped roots; primary pointer for legacy |
| Two panels fighting one DOM id | factory + no shared `#outliner-panel` singleton node for copies |
| Viewport clone | blocked — singleton only |

## Верификация (сквозная, после всех шагов)

- `npm run check` (lint + check:size + vitest + madge --circular) зелёный.
- Браузер: 3–4-уровневый nested split, все 6 типов, floating + snap stack, collapse,
  close/reopen non-viewport, reload → layout + selection/asset-tab. 0 new console errors.
- **View → Panels:** 6 contentType toggles (не Left/Right); hide/show через dock; Toolbar/Console/Status ok.
- **Multi-instance:** ≥1 self-drop copy (e.g. Outliner×2) — оба interactive после reload.
- Консоль (`` ` ``), статус-бар — без изменения поведения.
- `grep -rn "panelPositionManager" src` → 0 после B5.
