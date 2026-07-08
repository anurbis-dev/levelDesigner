# Multi-Level Support: Implementation Plan

Дата: 2026-07-08. Основа: требования пользователя + исследование текущей архитектуры (Explore-агент) + детальный план (Plan-агент).

## Scope Recap

- Несколько `Level` открыты одновременно в памяти, переключаемые, а не заменяемые целиком при открытии.
- Новая секция **Levels**, структурно скопированная с `LayersPanel` (search, add button, список айтемов с цветом/rename/context menu/drag-reorder), размещённая **над** существующей секцией Layers внутри `#layers-content-panel`.
- Каждый открытый Level имеет независимый **toggle видимости** (глаз) — canvas композитит объекты всех видимых Level одновременно.
- Ровно один Level является **текущим** (current) в любой момент — Outliner и Layers панель (список слоёв) показывают только структуру текущего Level; все правки/undo/selection применяются только к нему. Видимость не зависит от того, текущий ли уровень.
- Новое понятие **Project** — контейнер набора открытых Level (см. Раздел 0), с собственным файлом и Project Settings.
- Меню `Level` переименовывается в **`File`**: команды Level и команды Project разделены сепаратором внутри одного меню (не два отдельных меню). `Import Assets...` переносится из `Settings` в конец меню `File`. В `Settings` добавляется `Project Settings...`.

---

## 0. Project — новая сущность

### 0.1 Зачем

Раньше (Разделы 6, Открытый вопрос №1) план сознательно откладывал понятие "файл проекта" как отдельную фичу вне скоупа. Теперь она входит в скоуп: `Project` — контейнер, который держит вместе несколько уже открытых `LevelSession` (Раздел 1) плюс project-scope настройки, и умеет сохраняться/загружаться одним файлом.

Редактор браузерный: `FileManager.loadLevelFromFileInput()`/сохранение уровня работают через `<input type="file">`/скачивание blob (FileManager.js:87, 47-72) — **нет** persistent file handle (`showOpenFilePicker`/`FileSystemFileHandle` не используются). Значит файл проекта не может хранить просто список путей на диске (они не стабильны между сессиями/браузерами) — он должен быть **самодостаточным**: одним JSON, эмбеддящим сериализованные данные всех открытых уровней.

### 0.2 Новый класс `Project`

Новый файл `src/models/Project.js`:

```js
export class Project {
    constructor(opts = {}) {
        this.name = opts.name ?? 'Untitled Project';
        this.fileName = opts.fileName ?? null;   // имя project-файла (аналог LevelSession.fileName)
        this.isDirty = opts.isDirty ?? false;
        this.settings = opts.settings ?? Project.defaultSettings();
    }

    static defaultSettings() {
        // содержимое — открытый вопрос, см. Раздел 12 п.9
        return {};
    }

    toJSON(levelSessions, levelOrder, currentLevelId) {
        return {
            version: 1,
            name: this.name,
            settings: this.settings,
            currentLevelId,
            levels: levelOrder.map(id => ({
                order: levelOrder.indexOf(id),
                visible: levelSessions.get(id).visible,
                data: levelSessions.get(id).level.toJSON()
            }))
        };
    }

    static fromJSON(json) {
        const project = new Project({ name: json.name, settings: json.settings });
        // levels восстанавливаются через levelsManager.addLevel(Level.fromJSON(entry.data), {visible: entry.visible})
        return project;
    }
}
```

`Project` не хранит сами `Level`/`LevelSession` — это делает `levelSessions`/`levelOrder` на `LevelEditor` (Раздел 1.2), как единственный источник правды; `Project` — метаданные + сериализация, зеркалит отношение `LevelSession` к `Level`.

### 0.3 Новый модуль `ProjectFileOperations`

Новый файл `src/core/ProjectFileOperations.js` (BaseModule, регистрируется рядом с `levelFileOperations`):

- `newProject()` — очищает `levelSessions`/`levelOrder` (закрывает все текущие вкладки, с confirm если есть dirty), создаёт новый `Project`, создаёт один пустой уровень через `levelsManager.addLevel()` (аналог сегодняшнего `newLevel()` при старте).
- `openProject()` — читает project-файл через file input, `Project.fromJSON()`, затем для каждого `entry` в `levels` — `Level.fromJSON(entry.data)` + `levelsManager.addLevel(level, {visible: entry.visible, makeCurrent: entry order === currentLevelId})`, восстанавливает `levelOrder`.
- `saveProject()`/`saveProjectAs()` — `project.toJSON(editor.levelSessions, editor.levelOrder, editor.currentLevelId)`, скачивание blob (зеркалит `FileManager.saveLevel()`), `project.fileName` = имя файла, `project.isDirty = false`.
- `closeProject()` — не входит в первую итерацию (открытый вопрос, см. 12 п.10): при однооконном браузерном редакторе "закрыть проект" эквивалентно `newProject()`.

### 0.4 Project vs Level: разделение ответственности

| Уровень сущности | Что сохраняет | Где живёт |
|---|---|---|
| `Level.toJSON()` | Один уровень (слои/объекты/settings уровня) | Как сегодня, без изменений |
| `LevelSession` | Editor-only состояние одного уровня (visible/viewState/history/fileName) | В памяти, не сериализуется отдельно |
| `Project` | Метаданные набора уровней + project settings + порядок + currentLevelId | Новый project-файл (эмбеддит `Level.toJSON()` каждого открытого уровня) |

Открытие одиночного `.json`-файла уровня (`Open Level...`) остаётся рабочим и не требует project-файла — Project не обязателен для работы с уровнями, это опциональная надстройка (аналогично тому, как отдельный уровень не требует projet, но project требует ≥1 уровня, см. 0.5).

### 0.5 Project Settings

`Project Settings...` (новый пункт меню `Settings`, см. Раздел 8) открывает диалог project-scope настроек — по аналогии с существующим `Editor Settings...` (`action: 'openSettings'`), но для настроек, которые логически принадлежат проекту, а не персональному editor-конфигу. Точный состав полей — открытый вопрос (Раздел 12 п.9); кандидаты: default asset import path, default grid/snap настройки для новых уровней проекта, project-wide naming convention.

---

## 1. Data Model

### 1.1 Новый класс `LevelSession` (обёртка, не поля на самом `Level`)

Новый файл: `src/models/LevelSession.js`

```js
export class LevelSession {
    constructor(level, opts = {}) {
        this.level = level;                 // Level instance
        this.id = level.id;                 // reuse Level.id как session id
        this.visible = opts.visible ?? true; // eye icon state (не зависит от "current")
        this.fileName = opts.fileName ?? null; // per-session имя файла
        this.isDirty = opts.isDirty ?? false;
        this.viewState = opts.viewState ?? {
            camera: { x: 0, y: 0, zoom: 1 },
            selectedObjects: new Set(),
            groupEditMode: { isActive: false, groupId: null, group: null, openGroups: [] },
            currentLayerId: level.getMainLayerId(),
            outliner: { collapsedTypes: new Set(), collapsedGroups: new Set(), activeTypeFilters: new Set(), shiftAnchor: null }
        };
        this.history = { undoStack: [], redoStack: [] };
    }
}
```

`Level.toJSON()`/`fromJSON()` остаются чистой сериализацией "файла уровня" — visible/current/viewState это editor-only понятия, никогда не попадают в level JSON.

### 1.2 Новое состояние `LevelEditor`

`src/core/LevelEditor.js` (рядом с `this.level = null;` line 100, `this.cachedLevelStats` line 106):

```js
this.levelSessions = new Map();   // levelId -> LevelSession
this.currentLevelId = null;
this.levelOrder = [];             // порядок табов
```

`this.level` становится **computed getter/setter** для обратной совместимости с существующими ~294 обращениями к `editor.level`/`getLevel()`:

```js
get level() {
    const session = this.levelSessions.get(this.currentLevelId);
    return session ? session.level : null;
}
set level(newLevel) {
    // back-compat setter на время миграции (LevelFileOperations)
    this._setLevelDirect(newLevel);
}
```

Ключевое решение: **не переписывать все 294 call sites**. `editor.level`/`getLevel()` (line 1760) продолжают работать без изменений, всегда резолвясь в текущий уровень.

### 1.3 Новый модуль `LevelsManager`

Новый файл `src/core/LevelsManager.js` (BaseModule, регистрируется в конструкторе `LevelEditor` рядом с `layerOperations`/`levelFileOperations`):

- `addLevel(level, {makeCurrent=true, visible=true}={})` — оборачивает в `LevelSession`, добавляет в `levelSessions`, опционально переключает current.
- `removeLevel(levelId)` / `closeLevel(levelId)` — закрытие таба (см. Edge Cases).
- `setCurrentLevel(levelId)` — переключение (см. 1.4).
- `toggleLevelVisibility(levelId)`.
- `getOrderedSessions()` — по `levelOrder`.
- `getVisibleSessions()` — сессии с `visible===true`, используется RenderOperations.

### 1.4 Переключение текущего уровня (`setCurrentLevel`)

В отличие от сегодняшних `openLevel()`/`newLevel()` (полный `stateManager.reset()`), переключение между уже открытыми уровнями должно **сохранять-и-восстанавливать** view state, а не сбрасывать:

```js
setCurrentLevel(levelId) {
    const newSession = this.editor.levelSessions.get(levelId);
    if (!newSession || levelId === this.editor.currentLevelId) return;

    const oldSession = this.editor.levelSessions.get(this.editor.currentLevelId);
    if (oldSession) {
        oldSession.viewState.camera = { ...this.editor.stateManager.get('camera') };
        oldSession.viewState.selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
        oldSession.viewState.groupEditMode = { ...this.editor.stateManager.get('groupEditMode') };
        oldSession.viewState.currentLayerId = this.editor.layersPanel?.getCurrentLayerId();
        oldSession.viewState.outliner = { ...this.editor.stateManager.get('outliner') };
        oldSession.history = this.editor.historyManager.exportState();
    }

    this.editor.currentLevelId = levelId;

    this.editor.stateManager.set('camera', newSession.viewState.camera);
    this.editor.stateManager.set('selectedObjects', newSession.viewState.selectedObjects);
    this.editor.stateManager.set('groupEditMode', newSession.viewState.groupEditMode);
    this.editor.stateManager.set('outliner', newSession.viewState.outliner);

    this.editor.clearCaches();
    this.editor.setupLayerObjectsCountTracking();
    this.editor.updateCachedLevelStats();
    this.editor.setCurrentLayer(newSession.viewState.currentLayerId);
    this.editor.historyManager.importState(newSession.history);

    this.editor.stateManager.notify('currentLevelChanged', { levelId, level: newSession.level });
    this.editor.stateManager.notifyListeners('level', newSession.level); // back-compat

    this.editor.render();
    this.editor.updateAllPanels();
}
```

`stateManager.reset()` здесь **не вызывается** — он сбрасывает camera/mouse/selection/outliner/view/panels целиком (StateManager.js:435), что верно для по-настоящему нового уровня при старте приложения, но неверно для переключения табов.

---

## 2. Rendering — композитинг нескольких видимых уровней

### 2.1 Текущие предположения в `RenderOperations.js`

Большинство методов читают `this.editor.level` напрямую: `buildSpatialIndex()` (~55), `getVisibleObjectsSpatial()` (~191, уже ключуется по `levelId` — хорошо), `render()` (~302, single-level), `getVisibleObjects()` (~917-981, single level), `drawSelection()` (~536/552), `getVisibleLayerIds()` (~709).

Важная находка: **`this.spatialIndex` уже `Map<levelId, ...>`** (line ~27) — расширение низкорисковое. `visibleObjectsCache` (line ~19, ключ только по camera-строке, БЕЗ levelId) и `zoomLevelCache` не namespaced и должны быть исправлены (2.3).

### 2.2 Новый `render()`, композитящий все видимые сессии

Переработать `render()` (RenderOperations.js:293-523) в цикл по видимым сессиям вместо единственного `this.editor.level`:

```js
render() {
    const visibleSessions = this.editor.levelsManager.getVisibleSessions();
    if (visibleSessions.length === 0) return;

    this.editor.canvasRenderer.clear();
    this.editor.canvasRenderer.setCamera(camera);

    const currentLevel = this.editor.level;
    // grid/фон всегда из settings текущего уровня

    visibleSessions.forEach(session => {
        const sortedObjects = this.getVisibleObjectsForLevel(session.level, camera);
        sortedObjects.forEach(item => {
            const isCurrent = session.level === currentLevel;
            // isolate/solo/groupEditMode применяются только если isCurrent
        });
    });

    this.drawSelection(); // всегда только для текущего уровня
});
```

`getVisibleObjectsForLevel(level, camera)` = параметризованный `getVisibleObjects()`. Каждый метод `RenderOperations`, читающий `this.editor.level` (35 вхождений), получает опциональный параметр `level = this.editor.level`.

### 2.3 Namespacing кешей

- `spatialIndex` (levelId-keyed) — уже верно, только явно вызывать `buildSpatialIndex(level)` за уровень через `buildAllSpatialIndexes()`.
- `visibleObjectsCache` (line ~19) — ключ должен стать `${levelId}_${cameraKey}`, иначе кеш одного уровня "протекает" в рендер другого при совпадении camera-ключа. **Самый важный фикс корректности в Фазе 3.**
- `visibleLayersCache` (line ~23) — становится `Map<levelId, Set<layerId>>`.
- `CacheManager.objectCache/topLevelObjectCache/effectiveLayerCache` (глобальные Map по `objId`) — см. 2.4, риск коллизий id.

### 2.4 Коллизии object id между уровнями

`Level.addObject()` (Level.js:150-192) назначает id через `nextObjectId++` — **per-instance счётчик с 1**. Два одновременно открытых уровня почти наверняка оба содержат id `1,2,3...`. `CacheManager` (`objectCache`/`effectiveLayerCache`, keyed по голому `objId`) — место утечки.

Варианты:
- **(A, рекомендуется)** Namespace ключи кешей как `${levelId}:${objId}` везде, где CacheManager/RenderOperations ключуют Map по object id.
- (B, отклонено) Глобально уникальные id — риск для формата сохранённых файлов (старые файлы содержат низкие integer id).

`findObjectById`/`objectsIndex` уже per-Level-instance (Level.js:46) — не требуют правок. Точный список мест для (A) — уточнить в начале Фазы 3.

---

## 3. Новая секция "Levels" UI

### 3.1 Решение по файлам

**Новый файл `src/ui/LevelsPanel.js`**, НЕ метод в `LayersPanel.js` (у LayersPanel и так велика сложность: context menu, drag-reorder, search, solo/lock, parallax). Паттерн конструирования — как у `LayersPanel`.

Новые файлы:
- `src/ui/LevelsPanel.js` — зеркалит `LayersPanel.js` 1:1 (constructor, `render()`, `renderLevelsSection()`, `createLevelElement()`, `setupLevelsPanelHandlers()`, `toggleLevelVisibility()`, `renameLevel()`, `deleteLevel()` (закрывает таб), `setCurrentLevel()`).
- `src/ui/LevelsContextMenu.js` — зеркалит `LayersContextMenu.js` (Make Current / Rename / Duplicate(?) / Close / Save / Save As).
- `src/ui/panel-structures/LevelsPanelStructure.js` — зеркалит `LayersPanelStructure.js`: `createLevelsPanelStructure(container)`, `renderLevelsControls(topSection, callbacks)`, id-ы `levels-search`, `add-level-btn`, `levels-list`.

### 3.2 Размещение в DOM

`index.html` line ~148-150, сейчас:
```html
<div id="layers-content-panel" class="tab-content-right layers-panel-container" style="display: none;">
    <!-- Layers content here -->
</div>
```

Меняется на вложенные под-контейнеры (Levels сверху):
```html
<div id="layers-content-panel" class="tab-content-right layers-panel-container" style="display: none;">
    <div id="levels-content-panel" class="levels-panel-container flex-shrink-0"></div>
    <div id="outliner-layers-divider" class="border-t border-gray-700"></div>
    <div id="layers-only-content-panel" class="layers-panel-container flex-grow overflow-y-auto"></div>
</div>
```

`LayersPanel` конструируется теперь над `#layers-only-content-panel` (было `#layers-content-panel`) — т.к. `createLayersPanelStructure(this.container)` строит свою разметку в переданный контейнер, внутренняя логика LayersPanel не меняется, меняется только DOM-узел при конструировании. Фиксированная (не скроллящаяся, `flex-shrink-0`) высота секции Levels (например, 3-4 строки), со своим внутренним скроллом при большом числе уровней.

### 3.3 Изменения конструирования в `LevelEditor.js` (~line 506-507)

```js
const outlinerPanel = document.getElementById('outliner-content-panel');
const layersPanelContainer = document.getElementById('layers-only-content-panel'); // было 'layers-content-panel'
const levelsPanelContainer = document.getElementById('levels-content-panel');      // NEW

this.outlinerPanel = new OutlinerPanel(outlinerPanel, this.stateManager, this);
this.levelsPanel = new LevelsPanel(levelsPanelContainer, this.stateManager, this); // NEW, до LayersPanel
this.layersPanel = new LayersPanel(layersPanelContainer, this.stateManager, this);
```

Также: `this.levelsPanel = null;` (~line 93), в `destroy()` (~line 2270), в lifecycle-регистрацию рядом с `layersPanel`/`outlinerPanel`.

### 3.4 Структура айтема (по образцу `LayersPanel.createLayerElement`, LayersPanel.js:349-421+)

Каждый `.level-item` (`data-level-id`):
- `.level-color` — swatch (см. Открытые вопросы п.7 — нужен ли вообще).
- `.level-name-display` / `.level-name-input` — inline rename (`level.meta.name`).
- `.level-objects-count` — `level.getStats().totalObjects`.
- `.level-visibility-btn` (глаз) — toggles `session.visible`, инвалидирует кеш видимости уровней, `editor.render()`. Solo-концепция не нужна.
- `.level-dirty-indicator` — точка/звёздочка если `session.isDirty`.
- Без lock/parallax на уровне (не запрошено).
- Клик по строке (не по глазу) = `setCurrentLevel(level.id)`; текущий уровень — `bg-blue-600`, как `isCurrent` в `createLayerElement`.
- Context menu: Make Current, Rename, Save, Save As, Close, Duplicate (опционально).
- Drag-reorder: переставляет `editor.levelOrder` (см. Открытые вопросы п.2 — влияет ли порядок на z-order рендера).

### 3.5 Поиск

Регистрация в `SearchManager` под новым id `'levels'` (параллельно `'layers'`), фильтр по `level.meta.name`. Новый DOM id `#levels-search` (не конфликтует с `#layers-search`).

---

## 4. Ограничение области видимости Outliner/LayersPanel

### 4.1 Уже работает "бесплатно"

Т.к. `editor.level`/`getLevel()` (п.1.2) — геттер, резолвящий текущую сессию, `OutlinerPanel.js` и `LayersPanel.js` (оба обращаются исключительно к `getLevel()`) **автоматически** видят только структуру текущего уровня, без единой правки их render-логики.

### 4.2 Что всё же нужно поменять

- `stateManager.subscribe('level', ...)` в `LayersPanel.js:100`, `OutlinerPanel.js:146`, `DetailsPanel.js:42` должны срабатывать и при смене таба — `setCurrentLevel()` (1.4) уже вызывает `notifyListeners('level', newSession.level)`.
- `LayersPanel.initializeCurrentLayer()` (~84-91) должен брать `session.viewState.currentLayerId` вместо дефолта `getMainLayerId()` при каждом рендере — иначе при возврате к уровню забудется выбранный слой.
- `OutlinerPanel`'s `collapsedGroups`/`activeTypeFilters`/`shiftAnchor` (StateManager.js:~99-104) — единый глобальный блоб; при переключении подменяется на `session.viewState.outliner` (уже в 1.4), иначе collapse-состояние "протекает" между уровнями с разными id групп.

### 4.3 Стратегия для 294 обращений к `editor.level`/`getLevel()`

**Не мигрировать.** `getCurrentLevel()` вводится как документированный алиас `getLevel()` для читаемости в НОВОМ коде (LevelsManager, LevelsPanel, RenderOperations' цикл), но все существующие call sites остаются как есть — они корректны благодаря геттеру. Правки нужны только в ~10-15 местах (Разделы 2 и 6).

---

## 5. HistoryManager — история per-level

### 5.1 Рекомендация: per-level история (не глобальная)

Текущий `HistoryManager` — единственный стек, общий на весь процесс. При multi-level переключение таба + Ctrl+Z отменяли бы правку ДРУГОГО уровня — явно неверно. **Per-level история обязательна.**

### 5.2 Реализация: один instance, export/import стека

Вместо N инстансов `HistoryManager`, оставить один, но сделать стеки переключаемыми (тот же паттерн save-on-switch-out/restore-on-switch-in, что и camera/selection в 1.4):

```js
// HistoryManager.js
exportState() {
    return { undoStack: [...this.undoStack], redoStack: [...this.redoStack] };
}
importState(snapshot) {
    this.undoStack = snapshot ? [...snapshot.undoStack] : [];
    this.redoStack = snapshot ? [...snapshot.redoStack] : [];
    this.isRecording = true;
    this.isUndoing = false;
    this.isRedoing = false;
    this.clearOperationFlagTimeout();
}
```

`LevelSession.history` хранит `{undoStack, redoStack}` (те же JSON-строки, что и внутри `HistoryManager` — дёшево копировать). `setCurrentLevel()` уже вызывает export/import (см. 1.4).

### 5.3 `HistoryOperations.js`

5 обращений к `.level` — undo()/redo() восстанавливают `this.editor.level.objects` текущего уровня; т.к. `editor.level` уже резолвится в текущую сессию через геттер — **правок не требуется**, только аудит.

### 5.4 `LevelFileOperations._initializeHistory()` (~line 297-305)

Без изменений по форме, но вызывается только для **новой** созданной/открытой сессии (Раздел 6), никогда для переключения таба (там export/import).

---

## 6. LevelFileOperations — семантика New/Open/Save

### 6.1 Один файл на уровень остаётся базовым форматом; project-файл — опциональная надстройка

`Level.toJSON()`/`fromJSON()` (Level.js:799-848) остаётся форматом одного уровня без изменений. Понятие "несколько уровней в одном файле" теперь покрыто отдельной сущностью `Project` (Раздел 0), а не встраивается в `Level`/`FileManager`. Каждый `LevelSession.fileName` независимо трекает своё имя файла, заменяя единый глобальный `FileManager.currentFileName`.

### 6.2 `newLevel()` (LevelFileOperations.js:45-95)

Переписать на **добавление** сессии вместо замены `editor.level`:

```js
async newLevel() {
    if (this._hasActiveMouseOperation()) { /* ... */ return; }
    const level = this.editor.fileManager.createNewLevel();
    this.editor.levelsManager.addLevel(level, { makeCurrent: true, visible: true });
    this.editor.render();
    this.editor.updateAllPanels();
    Logger.status.success('New level created');
}
```

Ключевое изменение поведения: **больше нет `stateManager.reset()`** в `newLevel()`/`openLevel()` — `reset()` сносит глобальное UI-состояние (`view.*`, `panels.*`, `ui.*`), не относящееся к тому, какой уровень открыт (не хотим, чтобы добавление 2-го уровня сбрасывало fullscreen). Сбрасывается только уровне-скоуп состояние (camera/selection/groupEditMode/outliner/currentLayer/history), и только для НОВОЙ сессии — ровно то, что уже представляет дефолтный `viewState` свежей `LevelSession` (1.1).

### 6.3 `openLevel()` (LevelFileOperations.js:101-168)

Аналогично `newLevel()`: после `loadedLevel = await fileManager.loadLevelFromFileInput()` — вызов `levelsManager.addLevel(loadedLevel, {makeCurrent:true, visible:true, fileName: ...})` вместо `editor.level = loadedLevel`. Плюс проверка "файл уже открыт" (сравнение по `fileName`) — предложить переключиться на уже открытую вкладку вместо повторного открытия (см. Edge Cases п.8).

### 6.4 `saveLevel()`/`saveLevelAs()` (LevelFileOperations.js:174-207)

`fileManager.saveLevel(editor.level)` уже резолвится в "сохранить текущий уровень" через геттер — вызов не меняется, но `FileManager.currentFileName`/`getCurrentFileName()` должны читаться/писаться из `session.fileName` текущей сессии, а не из единого глобального поля — иначе сохранение уровня B после однократного сохранения A молча перезапишет файл A. После сохранения: `session.fileName = fileName`, `session.isDirty = false` (вместо глобального `stateManager.markClean()` — тоже становится per-session, см. 7.1).

### 6.5 Новый метод `closeLevel(levelId)`

На `LevelsManager`:

```js
async closeLevel(levelId) {
    const session = this.editor.levelSessions.get(levelId);
    if (!session) return;
    if (this.editor.levelSessions.size === 1) {
        Logger.status.warn('Cannot close the only open level');
        return;
    }
    if (session.isDirty) {
        const ok = await confirm(`"${session.level.meta.name}" has unsaved changes. Close anyway?`);
        if (!ok) return;
    }
    const wasCurrent = levelId === this.editor.currentLevelId;
    this.editor.levelSessions.delete(levelId);
    this.editor.levelOrder = this.editor.levelOrder.filter(id => id !== levelId);
    this.editor.renderOperations.invalidateSpatialIndex(levelId);
    if (wasCurrent) {
        const nextId = this.editor.levelOrder[0]; // или MRU, см. Открытые вопросы
        this.setCurrentLevel(nextId);
    } else {
        this.editor.render();
    }
    this.editor.levelsPanel.render();
}
```

---

## 7. StateManager / реактивность — новые события

### 7.1 Новые ключи/события

- `'currentLevelChanged'` — `{levelId, level}`, от `setCurrentLevel()`.
- `'levelsListChanged'` — `{levelIds}`, от `addLevel()`/`closeLevel()`/reorder. `LevelsPanel` подписывается (параллель `'levelStructureChanged'` в LayersPanel).
- `'levelVisibilityChanged'` — `{levelId, visible}`, от `toggleLevelVisibility()`.
- Per-session `isDirty` заменяет единый глобальный `stateManager.state.isDirty` для вопроса "есть несохранённые правки" — но глобальный `isDirty` можно оставить как derived (`= any session.isDirty`) для guard на `beforeunload`.

### 7.2 Адаптация существующих подписчиков

| Панель | Текущая подписка | Нужное изменение |
|---|---|---|
| `LayersPanel` | `'level'`, `'levelStructureChanged'`, `'selectedObjects'`, `'layerObjectsCountChanged'`, `'layerChanged'`, `'selection.activeLayerBorderColor'` | Нет — всё резолвится прозрачно; правка `initializeCurrentLayer()` (п.4.2) |
| `OutlinerPanel` | `'level'`, `'levelStructureChanged'`, `'outliner'` | Нет — проверить корректный re-render при подмене `'outliner'` целиком в `setCurrentLevel()` |
| `DetailsPanel` | `'level'` (`(newLevel, oldLevel)`) | Проверить отсутствие кеширования от `oldLevel` |
| `LevelsPanel` (новый) | — | Подписка на все три новых события |

---

## 8. Меню / MenuManager

### 8.1 Переименование `Level` → `File`, добавление блока Project

`config/menu.js` меню `level` (~50-84) переименовывается в `file` (`id: 'file'`, `label: 'File'`). Существующие пункты `new-level`/`open-level`/`save-level`/`save-level-as` (диспатч не меняется — `MenuManager.handleMenuAction()` ~448-455 вызывает `this.editor[item.action](item.actionParam)` по имени, поведение диспатча не зависит от переименования меню) остаются как есть, но дополняются:

- Новый пункт `close-level` (`action: 'closeLevel'`) — после `save-level-as`, перед сепаратором к Project-блоку. Вызывает `editor.closeLevel()` → `levelsManager.closeLevel(currentLevelId)`. Добавить `LevelEditor.closeLevel()` passthrough рядом с `saveLevel()`/`saveLevelAs()` (~line 1664-1670).
- `{ type: 'separator' }` — отделяет блок Level-команд от блока Project-команд (одно меню `File`, а не два отдельных меню, см. Scope Recap).
- Блок Project-команд (действия — `ProjectFileOperations`, Раздел 0.3): `new-project` (`action: 'newProject'`), `open-project` (`action: 'openProject'`), `save-project` (`action: 'saveProject'`), `save-project-as` (`action: 'saveProjectAs'`).
- `{ type: 'separator' }` — перед перенесённым `import-assets`.
- `import-assets` (`action: 'importAssets'`) — **переносится из меню `Settings`** в конец меню `File`, как последний пункт.

Итоговая структура меню `File`:

```
File
├─ New Level          (new-level)
├─ Open Level...       (open-level)
├─ ───────────
├─ Save Level          (save-level)
├─ Save Level As...    (save-level-as)
├─ Close Level         (close-level)          [новый]
├─ ───────────                                 [новый разделитель]
├─ New Project         (new-project)          [новый]
├─ Open Project...     (open-project)         [новый]
├─ Save Project        (save-project)         [новый]
├─ Save Project As...  (save-project-as)      [новый]
├─ ───────────                                 [новый разделитель]
└─ Import Assets...    (import-assets)        [перенесено из Settings]
```

Каждому новому `action` (`closeLevel`/`newProject`/`openProject`/`saveProject`/`saveProjectAs`) нужен passthrough-метод на `LevelEditor` рядом с существующими `newLevel()`/`openLevel()`/`saveLevel()`, делегирующий в `levelsManager`/`projectFileOperations` — тот же паттерн, что и у текущих Level-команд.

### 8.2 Меню `Settings`

Новый пункт `project-settings` (`label: 'Project Settings...'`, `action: 'openProjectSettings'`) — добавляется **перед** существующим `editor-settings`, т.к. `import-assets` из этого меню уходит (см. 8.1). Итоговая структура меню `Settings`:

```
Settings
├─ Project Settings... (project-settings)   [новый]
└─ Editor Settings...  (editor-settings)
```

`openProjectSettings` — новый passthrough на `LevelEditor`, открывающий диалог Project Settings (Раздел 0.5); паттерн диалога зеркалит существующий `openSettings()` (Editor Settings).

### 8.3 Прочее

"Save All" (для уровней) — явно отложено на потом (см. Открытые вопросы п.6), не входит в первую итерацию.

---

## 9. Edge Cases

1. **Коллизия имён** — два уровня "Untitled Level" (вероятно, т.к. `FileManager.createNewLevel()` всегда даёт это имя). `LevelsPanel` должен визуально различать — числовой суффикс только для отображения (`"Untitled Level (2)"`), без мутации `level.meta.name`.
2. **Удаление текущего уровня** — fallback на `levelOrder[0]` или лучше MRU-стек (`levelMRU: string[]`, обновляется на каждый `setCurrentLevel()`).
3. **Закрытие последнего уровня — запрещено** (мирроринг "Main layer нельзя удалить", Level.js:358-369). Отдельная "Main Level" сущность **не нужна** — ограничение чисто "count >= 1", не "конкретный защищённый уровень" (уровни — равноправные пиры, не как Main Layer с ролью дефолта для новых объектов).
4. **Коллизии object id между уровнями в памяти** — фикс через namespacing кешей (2.4), обязателен до релиза Фазы 3, иначе рендер может интермиттентно показывать не тот объект из-за отравления кеша.
5. **Производительность при многих видимых уровнях** — цикл композитинга `O(visibleSessions × visibleObjectsPerLevel)`. Рекомендуется мягкое предупреждение (`Logger.render.warn`) при >5 одновременно видимых уровней, без жёсткого лимита изначально (см. Открытые вопросы п.5).
6. **Undo при переключении текущего уровня** — решено в Разделе 5; проверить, что `HistoryManager.isUndoing`/`isRedoing` явно сбрасываются в `importState()`.
7. **Переименование в пустую строку** — зеркалить guard из `LayersPanel.renameLayer()`.
8. **Повторное открытие уже открытого файла** — сравнение по `fileName` (best-effort, т.к. `Level.toJSON()` не сериализует `this.id` — Level.js:799-814 — id генерируется заново при каждом `fromJSON()`, т.е. два открытия одного файла никогда не определяются как "тот же уровень" по id). Отмечено как nice-to-have на будущее: `toJSON()` стоило бы сохранять `id` для стабильной идентичности между save/reload.
9. **Изоляция `layerCountsCache`/`objectsIndex`/spatial index** — подтверждено: эти три уже корректно per-instance (Level.js:43/46) и `RenderOperations.spatialIndex` уже `Map<levelId,...>` — реальный разрыв изоляции уже, чем казалось: только `CacheManager` и `visibleObjectsCache`/`visibleLayersCache` нужно намспейсить (2.3-2.4).
10. **`New Project` при наличии несохранённых уровней** — должен собрать dirty-сессии со всех открытых `LevelSession` (не только текущей) и показать один общий confirm перед закрытием всех вкладок, а не N отдельных диалогов подряд.
11. **`Open Project` при уже открытых уровнях** — решить: заменяет весь текущий набор вкладок (закрыть всё + открыть уровни проекта) или добавляет уровни проекта к уже открытым? План по умолчанию предполагает замену (зеркалит семантику `newProject()`), см. Открытые вопросы п.11.
12. **`Project.isDirty` vs per-level `isDirty`** — открытие/закрытие уровня, rename, reorder меняют `Project.isDirty`, даже если ни один `Level.toJSON()` не поменялся (сам список/порядок уровней — тоже часть project-файла). Отдельно от `session.isDirty` (Раздел 7.1).

---

## 10. Поэтапное внедрение

### Фаза 1 — модель данных, без UI (Medium)
Цель: ввести `LevelSession`/`LevelsManager`/getter-based `editor.level`, одиночный уровень ведёт себя идентично сегодняшнему (regression-safe чекпоинт).
- `src/models/LevelSession.js` (новый)
- `src/core/LevelsManager.js` (новый) — `addLevel`, `setCurrentLevel`, `getVisibleSessions` (пока возвращает один), `getCurrentSession`
- `src/core/LevelEditor.js` — геттер/сеттер вместо поля `this.level`, поля `levelSessions`/`currentLevelId`/`levelOrder`, регистрация `levelsManager` как BaseModule
- `src/managers/HistoryManager.js` — `exportState()`/`importState()`
- Проверка: приложение стартует, открывает/создаёт уровень, всё как раньше (undo, слои, outliner, selection) — фаза невидима пользователю.

### Фаза 2 — UI панели Levels (Medium-Large)
Цель: видеть и управлять списком уровней визуально, но `newLevel()`/`openLevel()` пока заменяют (не добавляют) — в панели ровно 1 айтем.
- `src/ui/panel-structures/LevelsPanelStructure.js` (новый)
- `src/ui/LevelsPanel.js` (новый)
- `src/ui/LevelsContextMenu.js` (новый)
- `index.html` — вложенные `#levels-content-panel`/`#layers-only-content-panel`
- `src/core/LevelEditor.js` — конструирование `LevelsPanel`, смена контейнера `LayersPanel`

### Фаза 3 — композитинг рендера + namespacing кешей (Large, самый рискованный)
Цель: несколько видимых уровней реально рисуются одновременно; корректность кешей исправлена.
- `src/core/RenderOperations.js` — параметризация `getVisibleObjects`/`getVisibleObjectsSpatial`/`getVisibleLayerIds`/`buildSpatialIndex` по `level`; переписать секцию рисования объектов в `render()` в цикл по `getVisibleSessions()`; фикс namespacing `visibleObjectsCache`/`visibleLayersCache`
- `src/managers/CacheManager.js` — namespacing `objectCache`/`topLevelObjectCache`/`effectiveLayerCache` по levelId
- `src/core/LevelsManager.js` — реальный `getVisibleSessions()` (много), `toggleLevelVisibility()`
- Проверка: открыть 2 уровня, переключить видимость обоих, убедиться в корректном композитинге без "протекания" объектов между уровнями (явный regression-тест на сценарий с одинаковыми numeric id в обоих уровнях).

### Фаза 4 — per-level история (Medium)
Цель: undo/redo никогда не пересекает границы уровня.
- `src/core/LevelsManager.js` — export/import стека в `setCurrentLevel()` (уже описано в 1.4/5.2)
- `src/core/HistoryOperations.js` — аудит (правки не ожидаются)
- Проверка: правки в A, переключение на B, правки в B, возврат на A, Ctrl+Z отменяет только последнюю правку A.

### Фаза 5 — файловые операции + меню (Medium)
Цель: New/Open реально добавляют вкладки; Close/dirty-tracking работают; Save работает только с текущим.
- `src/core/LevelFileOperations.js` — переписать `newLevel()`/`openLevel()` на `levelsManager.addLevel()`; `saveLevel()`/`saveLevelAs()` — работа с `session.fileName`; добавить `closeLevel()`
- `src/managers/FileManager.js` — решить судьбу `currentFileName` (vestigial/fallback)
- `config/menu.js` — пункт `close-level`
- `src/core/LevelEditor.js` — `closeLevel()` passthrough
- Per-session `isDirty` — аудит всех `markDirty()`/`markClean()`, редирект на `session.isDirty` + derived глобальный для unload-guard

### Фаза 6 — полировка / edge cases (Small-Medium)
- Дизамбигуация имён при коллизии (Edge Case 1)
- Детект повторного открытия файла (Edge Case 8)
- MRU-based выбор нового текущего уровня при закрытии (Edge Case 2)
- Drag-reorder списка уровней с персистентностью (аналог `Level.reorderLayers()`, Level.js:423-438, но для `levelOrder`)
- Soft-cap предупреждение по производительности (Edge Case 5)
- Горячие клавиши next/previous level tab (опционально)

### Фаза 7 — Project (Medium)
Цель: набор открытых уровней сохраняется/восстанавливается одним файлом; меню `File` и `Settings` приведены к целевой структуре.
- `src/models/Project.js` (новый) — Раздел 0.2
- `src/core/ProjectFileOperations.js` (новый) — `newProject`/`openProject`/`saveProject`/`saveProjectAs` — Раздел 0.3
- `config/menu.js` — переименование `level` → `file`, Project-блок с сепаратором, перенос `import-assets` в конец `File`, `project-settings` в `Settings` — Раздел 8
- `src/core/LevelEditor.js` — passthrough-методы `closeLevel()`/`newProject()`/`openProject()`/`saveProject()`/`saveProjectAs()`/`openProjectSettings()`, регистрация `projectFileOperations` как BaseModule
- Диалог Project Settings (новый UI, зеркалит существующий Editor Settings dialog) — точный состав полей зависит от решения Открытого вопроса №9
- Проверка: `Save Project` → `Open Project` в свежей сессии восстанавливает набор уровней (видимость/порядок/currentLevelId), `Import Assets...` виден в конце `File`, `Project Settings...` открывается из `Settings`.

---

## 11. Файлы по фазам (сводная таблица)

| Файл | Фаза | Объём |
|---|---|---|
| `src/models/LevelSession.js` (новый) | 1 | Small |
| `src/core/LevelsManager.js` (новый) | 1, 3, 5 | Medium→Large |
| `src/core/LevelEditor.js` | 1, 2, 5 | Medium |
| `src/managers/HistoryManager.js` | 1, 4 | Small |
| `src/ui/panel-structures/LevelsPanelStructure.js` (новый) | 2 | Small |
| `src/ui/LevelsPanel.js` (новый) | 2 | Medium-Large |
| `src/ui/LevelsContextMenu.js` (новый) | 2 | Small-Medium |
| `index.html` | 2 | Small |
| `src/core/RenderOperations.js` | 3 | Large |
| `src/managers/CacheManager.js` | 3 | Medium |
| `src/core/HistoryOperations.js` | 4 | Small (аудит) |
| `src/core/LevelFileOperations.js` | 5 | Medium |
| `src/managers/FileManager.js` | 5 | Small |
| `config/menu.js` | 5 | Small |
| `src/ui/LayersPanel.js` | 4.2 (точечно) | Small |
| `src/ui/OutlinerPanel.js` | не ожидается | — |
| `src/ui/DetailsPanel.js` | аудит | — |
| `src/models/Project.js` (новый) | 7 | Small |
| `src/core/ProjectFileOperations.js` (новый) | 7 | Medium |
| Project Settings dialog (новый UI, файл TBD) | 7 | Small-Medium |

---

## 12. Открытые вопросы (нужно решить до/во время реализации)

1. **Один файл на уровень vs. project-файл** — **решено**: оба формата сосуществуют. `Level.toJSON()` остаётся форматом одного уровня без изменений; сверху вводится `Project` (Раздел 0) — самодостаточный JSON, эмбеддящий сериализованные данные всех открытых уровней (не список путей — браузерный редактор не имеет persistent file handle, см. 0.1).
2. **Порядок табов уровней определяет z-order рендера или это чисто UI-порядок?** План сейчас предполагает tab order == порядок рисования back-to-front. Альтернатива — "текущий уровень всегда поверх" или отдельный explicit z-order control.
3. **Per-level `HistoryManager` инстансы vs. один инстанс с export/import** (план выбирает export/import ради меньшего риска) — подтвердить, или предпочесть N независимых инстансов (проще ментально, но больше правок в lifecycle/module-регистрации).
4. **Фикс коллизии object id**: namespacing кешей по levelId (рекомендовано) vs. глобально уникальные id (отклонено — риск для формата сохранения) — подтвердить вариант A и перепроверить, нет ли другого кода вне CacheManager/RenderOperations, полагающегося на глобальную уникальность object id.
5. **Лимит на кол-во одновременно видимых уровней** — жёсткий cap (5-10) в `toggleLevelVisibility()` или только предупреждение в логах?
6. **"Save All" в меню** — включать в Фазу 5 или оставить "Save всегда только текущий" насовсем?
7. **Цвет/иконка уровня в списке** (по аналогии с color-swatch слоя) — слои имеют реальное семантическое использование цвета (гизмо/рамка на canvas). У уровней такого пока нет — декоративный auto-palette swatch или вообще без него?
8. **"Main Level" концепция** — Edge Case 3 рекомендует НЕ вводить структурно-особый Main Level (в отличие от Main Layer) — подтвердить эту трактовку требования.
9. **Состав `Project Settings`** — какие настройки логически project-scope (а не editor-scope/level-scope)? Кандидаты в Разделе 0.5 (default asset import path, default grid/snap для новых уровней проекта, naming convention) — нужен явный список полей до реализации диалога (Фаза 7).
10. **`Close Project`** — нужен ли отдельный пункт меню, или "закрыть проект" всегда равно `New Project` (закрыть всё + создать новый пустой проект/уровень), т.к. однооконный браузерный редактор не может остаться "без открытого проекта"?
11. **`Open Project` — замена или добавление уже открытых вкладок** — план по умолчанию (Edge Case 11) предполагает замену; подтвердить, не нужен ли merge-режим (открыть уровни проекта, оставив уже открытые уровни как есть).

---

### Ключевые файлы для реализации

- `src/core/LevelEditor.js`
- `src/core/LevelFileOperations.js`
- `src/core/RenderOperations.js`
- `src/models/Level.js`
- `src/ui/LayersPanel.js`
- `src/managers/CacheManager.js`
- `src/managers/HistoryManager.js`
