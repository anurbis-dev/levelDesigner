# План рефакторинга levelDesigner v2 — инструкция для Claude Code

Продолжение `tmp/2D_Editor_REFACTOR_PLAN.md` (Фазы 0-7, закрыт, v4.0.0, commit `e5a6b5b`).
Основан на независимом аудите CodeMaster текущего состояния (2026-07-14, MemPalace
`drawer_level_designer_architecture_0f760911d65a3d533699ac2f`) — конкретные незакрытые находки
из этого аудита и есть источник фаз ниже, а не повторный обход всего репозитория.

## Ключевое ограничение: раздел UI откладывается целиком

Для панелей/сплитов/докинга/содержимого окон есть рабочий прототип новой оконной системы,
которым предлагается заменить существующие панели целиком (докинг **и** содержимое: AssetPanel,
LayersPanel, OutlinerPanel, DetailsPanel, Toolbar, SettingsPanel, диалоги, контекстные меню).
Поэтому:

- **Фаза A (ниже) — всё, что не находится в `src/ui/`**, кроме случаев, явно помеченных иначе.
  Делается сейчас, обычным порядком.
- **Фаза B — весь `src/ui/*Panel*.js`, `*Dialog*.js`, `*ContextMenu*.js`, `src/ui/panels/*`,
  `src/ui/Asset*Controller.js`, `PanelPositionManager.js` и всё, что от них зависит.** Не трогать
  точечно до готовности прототипа — любой дедуп/рефакторинг внутри этого списка сейчас — потраченная
  работа, если прототип меняет структуру DOM/владения состоянием. Раздел B описан на уровне
  намерения, не на уровне метод-за-методом (детализация — когда будет ясна форма прототипа).

Если в процессе Фазы A возникает пограничный случай (метод и логика, и DOM в одном месте) —
см. прецедент `LevelEditor.js.renderLevelStats`/`setupCameraStartPositionButton` ниже (A2):
логика остаётся, DOM-часть — в Фазу B.

## Общие правила (не изменились с v1)

1. Не менять поведение и структуру в одном коммите: сначала чистое перемещение (copy → wire →
   remove old), потом отдельно — если нужно — исправление багов.
2. Не удалять старый код, пока новый не подключён и не проверен вручную/тестами.
3. Файл, который правишь, должен становиться меньше, а не расти.
4. Новый God Object/дублирование, найденный по пути — не чинить на месте, фиксировать отдельным
   пунктом и продолжать текущий шаг.
5. Критерий готовности каждого шага в Фазе A: `npm run check` зелёный (lint + check:size +
   vitest + madge --circular) + при изменении рантайм-логики — ручная проверка через
   `chrome-devtools` (см. tier-таблицу в `CLAUDE.md`).

---

## Фаза A — не-UI структурные находки аудита

### A0. Формализовать критерий выбора базового класса
**Зачем:** в проекте три параллельных паттерна делегирования (`BaseManager`, `BaseModule`,
голый `constructor(owner)` без общей базы) без явного критерия, когда какой применять —
`CONTRIBUTING.md` называет все три "примерами", не объясняя выбор.

- Дописать в `CONTRIBUTING.md` (после текущего раздела "Практически") новый раздел
  "Какой базовый класс/паттерн выбрать" с готовым текстом:
  ```
  - BaseManager (src/managers/BaseManager.js) — если новый класс создаётся в конструкторе
    LevelEditor ДО того, как остальные подсистемы готовы (т.е. не может полагаться на
    this.editor.*), и его жизненный цикл — init()/destroy(). Пример: ConfigManager, CacheManager.
  - BaseModule (src/core/BaseModule.js) — если новый класс создаётся ПОСЛЕ инициализации editor
    и его методам нужен доступ к this.editor (level, stateManager, другие Operations/managers).
    Пример: ObjectOperations, GroupOperations, LevelFileOperations.
  - Голый constructor(owner) без общей базы — только для одного sub-controller, выносимого из
    конкретной панели/менеджера (owner), если это первый такой sub-controller у owner.
  - PanelSubController-подобный общий класс — как только у owner появляется ВТОРОЙ
    sub-controller (т.е. декомпозиция панели/менеджера продолжается) — создать общий базовый
    класс для этой группы сразу, а не после третьего-четвёртого файла. Не дожидаться, пока
    копипаста в конструкторах/getter-ах наберётся сама.
  ```
- Не blocking для Фазы B, но должно быть готово до неё — правило понадобится при переносе
  Asset-контроллеров на новую систему (сейчас 7 контроллеров без общей базы — ретроактивно вводить
  им базовый класс не входит в Фазу A, т.к. это `src/ui/*`, но новый код в Фазе B должен сразу
  следовать правилу).

### A1. Убрать дублирование обхода дерева объектов в `LevelEditor.js`
**Зачем:** `LevelEditor.js:1300-1430` (`findTopLevelObject`, `findObjectInGroup`, `findObjectById`,
`findObjectInGroupRecursive`, ~130 строк) переизобретает то, что уже есть в
`utils/GroupTraversalUtils.js` (`findInGroup(group, predicate)`, `findInObjects(topLevelObjects, predicate)`)
— подтверждено чтением обоих файлов, семантика идентична.

- Сначала: написать характеризационные тесты на текущее поведение `findObjectById`/
  `findTopLevelObject` (сейчас нет ни одного теста на эти методы — `grep -rl "findObjectById" tests/`
  пусто) — граничные случаи: объект на верхнем уровне, объект в группе, объект во вложенной
  группе, несуществующий id, пустой уровень.
- `findObjectById(objId)` → `GroupTraversalUtils.findInObjects(this.level.objects, obj => obj.id === objId)`.
- `findObjectInGroupRecursive` — удалить, заменяется `GroupTraversalUtils.findInGroup`.
- `findTopLevelObject(objId)` — оставить fast-path через `level.findTopLevelObjectFast` без изменений
  (это не дублирование, отдельная O(1) оптимизация), но recursive fallback-цикл заменить на
  `GroupTraversalUtils.findInGroup(obj, o => o.id === objId)` вместо ручного `findObjectInGroup`.
- `findObjectInGroup` (boolean-версия) — удалить, больше не нужна.
- Ожидаемый эффект: `LevelEditor.js` ~1583 → ~1450 строк без изменения поведения.

**Уточнение (проверено чтением обоих файлов):**
- `findObjectById(objId)` → тело заменяется на
  `return GroupTraversalUtils.findInObjects(this.level.objects, obj => obj.id === objId);`
  (`findInObjects` уже обходит top-level + рекурсивно группы через `findInGroup`, семантика
  идентична текущей реализации строка-в-строку).
- `findTopLevelObject(objId)` — **не менять** fast-path (`level.findTopLevelObjectFast`) и
  структуру логирования. Менять только recursive fallback: цикл
  `for (const obj of this.level.objects) { if (obj.type === 'group') { const found = this.findObjectInGroup(obj, objId); ... } }`
  → `if (obj.type === 'group' && GroupTraversalUtils.findInGroup(obj, o => o.id === objId)) { return obj; }`.
- `findObjectInGroup`/`findObjectInGroupRecursive` — удалить целиком после того, как оба
  вызывающих метода переключены (иначе будет мёртвый код без вызывающих — по правилу v1 "не
  удалять, пока новое не подключено", здесь речь идёт о полном переключении в том же коммите,
  т.к. это тривиальная замена, не поэтапный перенос как для God Object).
- Импорт `GroupTraversalUtils` в `LevelEditor.js` уже есть? Проверить `grep -n "GroupTraversalUtils" src/core/LevelEditor.js`
  перед началом — если нет, добавить `import { GroupTraversalUtils } from '../utils/GroupTraversalUtils.js';`.

### A2. Разделить `ensurePlayerStartExists`/`renderLevelStats`/`setupCameraStartPositionButton`
**Зачем:** `LevelEditor.js:580-695` — три метода, но не одна ответственность. `ensurePlayerStartExists`
(580-632) и `updateLevelStatsPanel` (634-637, backward-compat wrapper) — чистая логика без DOM
(автосоздание Player Start). `renderLevelStats` (639-670) и `setupCameraStartPositionButton`
(672-695) — прямой DOM (`container.innerHTML`, `document.getElementById`) и обслуживают
"no-selection level stats view" в `DetailsPanel` (см. MemPalace `REACTIVE_LEVEL_UPDATES_PLAN.md`).

- `ensurePlayerStartExists`/`updateLevelStatsPanel` — вынести сейчас в `ObjectOperations.js`
  (835 строк, уже в `OVERRIDES`, уже импортирует `GroupTraversalUtils`/`BaseModule`/`Logger` —
  подходит по ответственности без создания нового файла, по правилу A0/`CONTRIBUTING.md`).
  Нужно дополнительно импортировать `GameObject` из `../models/GameObject.js` (сейчас
  `ObjectOperations.js` его не импортирует — проверить точный путь модели перед переносом).
  **Оговорка:** `ObjectOperations.js` и так превышает лимит 400 строк — добавление ~60 строк не
  создаёт новую проблему (файл уже помечен как God Object в `OVERRIDES`), но и не решает её;
  если по ходу Фазы A найдётся более точный дом — не держаться за это решение жёстко.
  В `LevelEditor.js` после переноса остаётся только тонкий делегат:
  `ensurePlayerStartExists() { this.objectOperations.ensurePlayerStartExists(); }` (если
  `grep -rn "\.ensurePlayerStartExists(\|\.updateLevelStatsPanel(" src` покажет внешних
  вызывающих вне `LevelEditor.js` — иначе звать `this.objectOperations.*` напрямую из места
  использования, без обёртки, по правилу v1 3.1).
- `renderLevelStats`/`setupCameraStartPositionButton` — **не трогать**, это DOM-логика панели
  (`container.innerHTML`, `document.getElementById('set-camera-start-position-btn')`),
  обслуживает `DetailsPanel`'s no-selection view — переезжает в Фазу B вместе с `DetailsPanel`.

### A3. Починить `AssetManager.getAssetById`
**Зачем:** `AssetItemActionsController.handleAssetClick` (`src/ui/AssetItemActionsController.js:140`)
вызывает `this.assetManager.getAssetById(assetId)`, которого нет на `AssetManager` (только `assets`
Map) — бросает исключение при `e.detail === 2` в обычном click-хендлере. Баг перенесён 1:1 из
дорефакторингового `AssetPanel.js`, не новый.

- Это правка `src/managers/AssetManager.js` (не `src/ui/*`) — добавить метод
  `getAssetById(id) { return this.assets.get(id) ?? null; }`. Безопасно сделать сейчас независимо
  от будущей замены панелей: API менеджера должен быть корректным вне зависимости от того, кто
  его вызывает. Вызывающий код в `AssetItemActionsController.js` не трогать — это Фаза B.

### A4. `managers/ConfigManager.js` — не дедуп, а удаление мёртвого кода
**Уточнено при проверке:** это не дедуп двух живых методов, а один живой + один мёртвый.
`grep -n "loadDefaultConfigs()\|getDefaultConfigs()" src/managers/ConfigManager.js` показывает:
`getDefaultConfigs()` (строки 226-335, async) вызывается в 3 местах (`loadAllConfigsAsync`
строка 69, плюс строки 503/827/858). `loadDefaultConfigs()` (строки 116-221, тот самый клон) —
**не вызывается нигде** в проекте (только определение, ни одного вызывающего).

- Удалить весь метод `loadDefaultConfigs()` целиком (116-221, ~106 строк вместе с сигнатурой) —
  не рефакторинг-с-дедупом, а прямое удаление мёртвого кода. Перед удалением: финальный
  `grep -rn "loadDefaultConfigs" src` (не только в файле) на случай вызова через
  `editor.configManager.loadDefaultConfigs()` откуда-то ещё.
- Эффект: `ConfigManager.js` сразу -106 строк, jscpd-клон исчезает как побочный эффект, а не
  как цель.

### A5. Точечный дедуп core/event-system (детализировано чтением всех 5 файлов)

**A5.1 — `LevelFileOperations._hasActiveMouseOperation()` ↔ `ProjectFileOperations._hasActiveMouseOperation()`**
Байт-в-байт идентичны (`LevelFileOperations.js:25-30`, `ProjectFileOperations.js:26-31`), оба
класса `extends BaseModule`. Перенести метод в `src/core/BaseModule.js` как
`hasActiveMouseOperation()` (без underscore — публичные методы `BaseModule` без него, см.
`isDragging()`/`isMarqueeSelecting()` рядом) — семантически он и так общего назначения ("есть ли
незавершённый mouse-жест"), не специфичен для file-operations. Удалить приватные копии из обоих
файлов, заменить вызовы `this._hasActiveMouseOperation()` → `this.hasActiveMouseOperation()`.
`grep -rn "_hasActiveMouseOperation" src` — проверить, что вызывающих ровно 2 (по одному на файл)
перед тем, как считать перенос безопасным.

**A5.2 — `core/RenderOperations.js` тройной клон общей preamble-проверки**
`getVisibleObjectsSpatial` (195-214), `getVisibleObjectsRegular` (881-900), `getVisibleObjects`
(951-972) начинаются с идентичного блока (~20 строк):
```
if (!this.editor || !level || !level.objects) return [];
if (!this.editor.canvasRenderer || !this.editor.canvasRenderer.canvas) return [];
const canvas = this.editor.canvasRenderer.canvas;
if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) return [];
if (!camera.zoom || camera.zoom <= 0) return [];
```
Вынести в приватный метод `_getValidCanvasOrNull(camera, level)`, возвращающий `canvas` либо
`null`; в начале каждого из трёх методов: `const canvas = this._getValidCanvasOrNull(camera, level); if (!canvas) return [];`.
Отдельно: `getVisibleObjectsRegular` (902-919) и `getVisibleObjects`/окрестности `_buildVisibleObjectsCacheKey`
(237-261 по исходным координатам аудита) дублируют расчёт `extendedLeft/Top/Right/Bottom` с
паддингом и парал­лакс-поправкой — вынести в `_computeExtendedViewportBounds(camera, canvas)`
→ `{left, top, right, bottom}`. Оба helper-а — чистые функции от аргументов + `this.editor`/
`this.parallaxRenderer`, риск низкий, но `RenderOperations` — рендер-путь, обязательна ручная
проверка в браузере после (viewport culling, parallax) — Standard tier по таблице в `CLAUDE.md`.

**A5.3 — `core/DuplicateOperations.confirmPlacement` ↔ `event-system/MouseHandlers.dragSelectedObjects`**
Оба метода реализуют одну и ту же операцию: "snap текущей позиции курсора к ближайшей точке
сетки, используя нижний-левый угол первого объекта (выделения или дубликата) как якорь" —
`SnapUtils.isSnapToGridEnabled`/`getGridSize`/`findNearestGridPoint` + вычисление
`currentBottomLeftX/Y` через `objectOperations.getObjectWorldPosition` + `dx/dy`. Разница только
в источнике "первого объекта" (`duplicate.objects[0]` vs `selectedObjects` через
`level.findObjectById`). Вынести в `utils/SnapUtils.js` новый статический метод, например
`computeBottomLeftSnapDelta(anchorWorldPos, referenceObject, objectOperations, stateManager, level)`
→ `{dx, dy}`, инкапсулирующий tolerance/gridSize/findNearestGridPoint/bottomLeft-расчёт целиком.
**Перед реализацией** — прочитать оба метода целиком (не только показанные в аудите диапазоны
строк), т.к. `confirmPlacement` и `dragSelectedObjects` могут расходиться в обработке
`snapEnabled === false` ветки и последующем использовании `dx/dy` — если ветки после общего
блока тоже совпадают, расширить извлекаемый диапазон; если нет — извлекать только
подтверждённо идентичную часть, не форсировать унификацию edge-case поведения ради дедупа
(правило v1: не менять поведение при рефакторинге структуры).

Каждый из трёх пунктов — отдельный коммит, `npm run check` после каждого.

### A6. Дедуп `utils/`

**A6.1 — grid renderers: Template Method в `BaseGridRenderer` (детализировано чтением всех 4 файлов)**
Подтверждено: `DiamondGridRenderer.render()`, `RectangularGridRenderer.render()`,
`HexagonalGridRenderer.render()` начинаются с идентичной последовательности —
`ctx.save()` → фон (`options.backgroundColor` → `fillRect`) → `if (!this.shouldRenderGrid(...)) { ctx.restore(); return; }`
→ и заканчиваются `ctx.restore()`. Внутри — разная отрисовка (диагонали/прямоугольники/шестиугольники).
`BaseGridRenderer` уже даёт `shouldRenderGrid`/`calculateViewportBounds`/`setGridStyle`, но не
шаблонизирует сам `render()`.

- В `BaseGridRenderer.js` заменить абстрактный `render()` (сейчас throw) на конкретный
  template-метод:
  ```js
  render(ctx, gridSize, camera, viewport, options = {}) {
      ctx.save();
      if (options.backgroundColor) {
          ctx.fillStyle = options.backgroundColor;
          ctx.fillRect(0, 0, viewport.width, viewport.height);
      }
      if (!this.shouldRenderGrid(gridSize, camera)) {
          ctx.restore();
          return;
      }
      this.drawGrid(ctx, gridSize, camera, viewport, options);
      ctx.restore();
  }

  drawGrid(ctx, gridSize, camera, viewport, options) {
      throw new Error('drawGrid() method must be implemented by subclass');
  }
  ```
- В каждом из трёх подклассов: удалить переопределение `render()`, переименовать оставшееся тело
  (всё, что было после `shouldRenderGrid`-проверки — извлечение `gridColor`/`thickness`/
  `opacity`/специфичных опций, `calculateViewportBounds`, отрисовка) в `drawGrid(ctx, gridSize, camera, viewport, options)`.
  `HexagonalGridRenderer` — при переносе сохранить весь код между `shouldRenderGrid`-проверкой и
  концом метода как есть (включая закомментированные блоки debug/frame-skip — не чистить заодно,
  не относится к этой правке).
- Тройной jscpd-клон исчезает как следствие, не как отдельная цель. Риск: рендер грида — Standard
  tier проверки (переключить все 3 типа сетки в UI настроек, посмотреть на канвасе — но
  переключение самого UI настроек это уже Фаза B панелей; можно дёрнуть напрямую через
  `evaluate_script`: `editor.stateManager.set('canvas.gridType', 'hexagonal')` и т.п., без захода в
  панель настроек).

**A6.2 — `utils/PerformanceUtils.js:92-107` ↔ `:143-157` (self-clone, 16 строк) — низкий приоритет**
`memoize()` и `memoizeWithInvalidation()` совпадают по структуре кэш-обёртки (get key → cache.has →
compute → cache.set), но реализуют разную семантику (обычная память vs инвалидация по deps) —
силовое объединение добавит косвенность ради 16 строк. **Решение: не форсировать извлечение**,
если при реализации не найдётся точка, где общий код действительно ужимается без потери
читаемости (например, `memoizeWithInvalidation` мог бы звать `memoize(fn, keyFn)` внутри и
оборачивать только логикой сброса по `deps` — если это ужимается чисто, сделать; если получается
только ради устранения jscpd-цифры — пропустить, задокументировав решение прямо в файле одной
строкой комментария, чтобы не всплывало заново при следующем прогоне `jscpd`).

### A7. `EditorPreferencesController.setupAutoSaveOnUnload` — ПЕРЕКЛАССИФИЦИРОВАНО в Фазу B, не A

**Пересмотрено после чтения полного тела метода (`EditorPreferencesController.js:129-285`).**
Изначально план предполагал механический сплит на per-domain методы сейчас. При чтении
выяснилось, что из ~155 строк тела `beforeunload`-колбэка:
- toolbar state, right/left panel tab, active asset tabs, asset panel size/viewMode, panel
  widths/heights, tab orders, tab positions, panel visibility (right/left/assets panel DOM) —
  **это ~120 из 155 строк, и это ровно то состояние текущей оконной системы**, которое по
  решению этого плана переезжает в Фазу B (докинг/сплиты/панели целиком).
- Только 2 блока не про панели: `snapToGrid` (176-180) и grid-настройки
  (`gridSize/Color/Thickness/Opacity/Subdivisions/SubdivColor/SubdivThickness`, 241-270) — вместе
  ~35 строк.

Разбивать метод сейчас означает переписывать структуру кода, который на 80% всё равно будет
переписан заново под новую оконную систему в Фазе B — прямое нарушение принципа этого плана
("не трогать то, что заменяется прототипом"). **Решение: A7 снят из Фазы A целиком.**
`setupAutoSaveOnUnload` в его нынешнем виде переезжает в рамку Фазы B (пункт 3) — при переносе
панелей на новую систему естественно потребуется переписать persist-логику под новую форму
состояния, и не-панельные 35 строк (snap/grid) стоит на этом шаге вынести в отдельный
`saveEditingPreferences()`, не привязанный к `beforeunload`-колбэку панелей.

### A8. Синхронизировать документацию с фактическим состоянием
**Зачем:** `docs/ARCHITECTURE.md` и `Context_map.md` фиксируют версию `3.60.2`, факт —
`LevelEditor.VERSION = '4.0.0'` (`LevelEditor.js:50`). `CONTRIBUTING.md` требует
`docs/ARCHITECTURE.md` как карту модулей перед добавлением кода — сейчас эта карта устарела.

- Запустить `DocCodeSync` (после A0-A6, чтобы зафиксировать финальное состояние Фазы A одним
  проходом, а не по кусочкам) — синхронизировать версию, список контроллеров, критерий A0.

**Критерий готовности Фазы A:** `npm run check` зелёный, `npx jscpd src --min-lines 15` не
показывает клонов вне `src/ui/`, `docs/ARCHITECTURE.md`/`Context_map.md` отражают v4.0.0.

---

## Фаза B — оконная система и содержимое панелей (после готовности прототипа)

Не детализируется на уровне методов заранее — форма определяется прототипом. Пункты ниже —
рамка, что должно быть учтено при переносе, собранная из текущего аудита:

1. **Замена докинга/сплитов**: `PanelPositionManager.js` + `TabLayoutController`/
   `TabOrderController`/`TabDragController`/`SplitPaneController` заменяются прототипом целиком.
   `SplitPaneController.js` (1016 строк, уже в `OVERRIDES` с пометкой "not further split") —
   не рефакторить точечно, он весь под замену.
2. **Миграция содержимого панелей**: `AssetPanel.js` + 7 контроллеров, `LayersPanel.js`,
   `OutlinerPanel.js`, `DetailsPanel.js`, `Toolbar.js`, `SettingsPanel.js`, диалоги
   (`BaseDialog.js`, `UniversalDialog.js`, `ActorPropertiesWindow.js`, `SplashScreenDialog.js`),
   контекстные меню — на новую оконную систему.
3. **Исправить при переносе, не раньше:**
   - Утечка состояния: Asset-контроллеры (`AssetToolbarController`, `AssetFilterController`,
     `AssetFoldersController`, `AssetDragDropController`) мутируют поля `assetPanel` напрямую
     вместо владения своим состоянием — при переносе на новую систему заложить нормальное
     владение состоянием с самого начала, а не чинить текущую схему.
   - Двойной источник истины `activeTypeFilters` (`StateManager` + plain-поле `AssetPanel`,
     синхронизация только в конструкторе).
   - Вызывающий код `AssetItemActionsController.handleAssetClick` — после A3 `getAssetById`
     существует и не бросает, но подтвердить, жив ли вообще этот код-путь при новой системе
     кликов, или это dead code для удаления.
   - `renderLevelStats`/`setupCameraStartPositionButton` (см. A2) — перенести DOM-логику в новую
     версию level-stats view.
   - `EditorPreferencesController.setupAutoSaveOnUnload` (см. A7, переклассифицировано сюда) —
     переписать под форму состояния новой оконной системы; заодно вынести не-панельные ~35 строк
     (snapToGrid + grid-настройки) в отдельный `saveEditingPreferences()`, не зависящий от
     `beforeunload`-колбэка панелей.
4. **Дедуп внутри `src/ui/`** (см. полный список клонов из аудита — `AssetContextMenu.js`,
   `AssetPanelContextMenu.js`, `DetailsPanel.js`×2, `FoldersPanel.js`, `LayersPanel.js`↔
   `LevelsPanel.js`, `Toolbar.js`, `BaseDialog.js`↔`SplashScreenDialog.js`,
   `panel-structures/DialogStructures.js`) — делать в процессе миграции на новую систему, если
   соответствующий код переживает перенос без переписывания с нуля. Не дедуплицировать то, что
   будет полностью заменено.
5. **После переноса:** снять устаревшие записи из `scripts/check-file-size.js` `OVERRIDES`
   (весь текущий список `ui/*`), обновить `docs/ARCHITECTURE.md`/`CONTRIBUTING.md` под новую
   структуру.

**Критерий начала Фазы B:** прототип оконной системы согласован и достаточно стабилен для
целевой архитектуры (не обязательно "готов на 100%" — но не должен меняться настолько, чтобы
миграция панелей пошла вхолостую).

---

## Сводка

| Фаза | Объём | Риск | Блокер |
|---|---|---|---|
| A0 Критерий базового класса | правка `CONTRIBUTING.md` | нет | — |
| A1 Дедуп обхода групп | ~130 строк → ~30, требует тестов | средний (затрагивает undo/redo/group edit mode) | тесты сначала |
| A2 ensurePlayerStartExists → ObjectOperations.js | ~60 строк logic-части | низкий | — |
| A3 AssetManager.getAssetById | 1 метод | нет | — |
| A4 ConfigManager: удалить мёртвый `loadDefaultConfigs()` | -106 строк | нет (не вызывается нигде) | финальный grep перед удалением |
| A5.1 `hasActiveMouseOperation` → `BaseModule` | -~15 строк суммарно | нет | — |
| A5.2 RenderOperations preamble-helper | ~20 строк ×3 → 1 helper | средний (рендер-путь, viewport culling) | ручная проверка в браузере |
| A5.3 SnapUtils.computeBottomLeftSnapDelta | зависит от полного чтения обоих методов | средний | сначала дочитать оба метода целиком |
| A6.1 Grid renderers Template Method | 3 `render()` → 1 в базе + 3 `drawGrid()` | средний (рендер-путь, 3 типа сетки) | ручная проверка всех 3 типов сетки |
| A6.2 PerformanceUtils дедуп | 16 строк, низкий приоритет | нет | опционально, не форсировать |
| ~~A7 EditorPreferencesController~~ | **снято из Фазы A** — переехало в Фазу B (см. там) | — | — |
| A8 Doc sync | — | нет | после A0-A6 |
| B (весь UI + persist-логика панелей) | весь `src/ui/` + `setupAutoSaveOnUnload` | высокий (полная замена) | готовность прототипа |
