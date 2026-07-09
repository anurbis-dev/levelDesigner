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

### ✅ Фаза 1 — модель данных, без UI (Medium) — ЗАВЕРШЕНО (2026-07-08, CodeMaster+BugHunter: добро)
Цель: ввести `LevelSession`/`LevelsManager`/getter-based `editor.level`, одиночный уровень ведёт себя идентично сегодняшнему (regression-safe чекпоинт).
- `src/models/LevelSession.js` (новый)
- `src/core/LevelsManager.js` (новый) — `addLevel`, `setCurrentLevel`, `getVisibleSessions` (пока возвращает один), `getCurrentSession`
- `src/core/LevelEditor.js` — геттер/сеттер вместо поля `this.level`, поля `levelSessions`/`currentLevelId`/`levelOrder`, регистрация `levelsManager` как BaseModule
- `src/managers/HistoryManager.js` — `exportState()`/`importState()`
- Проверка: приложение стартует, открывает/создаёт уровень, всё как раньше (undo, слои, outliner, selection) — фаза невидима пользователю.
- Ревью: CodeMaster + BugHunter параллельно, оба нашли по одной низкорисковой находке (dangling `currentLevelId`/пропущенный cache-cleanup в `destroy()`; shared-by-reference camera/selectedObjects/groupEditMode/outliner при `setCurrentLevel()`) — обе исправлены и перепроверены рантайм-тестом в браузере (chrome-devtools): переключение уровней, изоляция camera/selection/history, отсутствие утечки между сессиями.

### ✅ Фаза 2 — UI панели Levels (Medium-Large) — ЗАВЕРШЕНО (2026-07-08, CodeMaster+BugHunter: добро)
Цель: видеть и управлять списком уровней визуально, но `newLevel()`/`openLevel()` пока заменяют (не добавляют) — в панели ровно 1 айтем.
- `src/ui/panel-structures/LevelsPanelStructure.js` (новый)
- `src/ui/LevelsPanel.js` (новый)
- `src/ui/LevelsContextMenu.js` (новый)
- `index.html` — вложенные `#levels-content-panel`/`#layers-only-content-panel`
- `src/core/LevelEditor.js` — конструирование `LevelsPanel`, смена контейнера `LayersPanel`
- Отклонение от исходного плана (осознанно, обосновано): панель уже полностью функциональна (`+Add` реально добавляет уровень через `LevelsManager.addLevel()` из Фазы 1, а не просто рисует статичный список из 1 айтема) — т.к. `LevelsManager` уже был готов к работе с Фазы 1. Context-меню сознательно ограничено `Make Current`/`Rename` (Close/Save/Duplicate — Фаза 5, т.к. `closeLevel()`/per-session save ещё не существуют). Drag-reorder не реализован (явно Фаза 6 по разделу 10 плана).
- Ревью: CodeMaster + BugHunter параллельно. CodeMaster нашёл high-priority баг — `SearchSectionUtils.showSearchSectionForTab()` не знал про `levelsPanel`, из-за чего search/`+Add`-контролы могли не собраться, если вкладка Layers была скрыта на момент первого рендера — исправлено (добавлен вызов `editor.levelsPanel.renderLevelsSearchControls()` рядом с layers-веткой). BugHunter нашёл medium баг — отсутствие `e.detail` guard в click-хендлере `.level-item` (в отличие от `LayersPanel.handleLayerClick`) давало лишний вызов `setCurrentLevel()` при двойном клике на переименование — исправлено (`e.detail === 1` guard, зеркалит `LayersPanel`). Оба фикса перепроверены рантайм-тестом в браузере.

### ✅ Фаза 3 — композитинг рендера + namespacing кешей (Large, самый рискованный) — ЗАВЕРШЕНО (2026-07-09, CodeMaster+BugHunter: добро)
Цель: несколько видимых уровней реально рисуются одновременно; корректность кешей исправлена.
- `src/core/RenderOperations.js` — параметризация `getVisibleObjects`/`getVisibleObjectsSpatial`/`getVisibleObjectsRegular`/`collectVisibleObjectsRecursive`/`getVisibleLayerIds`/`buildSpatialIndex`/`getEffectiveLayerId`/`findParentLayerId`/`searchInGroupForLayerId` по `level` (дефолт `this.editor.level`, 100% back-compat для существующих вызовов); `render()` переписан на цикл по `getVisibleSessions()`; namespacing `visibleObjectsCache` (ключ `${levelId}_${cameraKey}`) и `visibleLayersCache` (стал `Map<levelId,{layerIds,timestamp}>`); dimming-режимы (groupEditMode/isolate/solo) применяются только при `isCurrent`; grid/фон/selection/hierarchy-highlight/group-edit-frame/duplicate-ghosts/debug-overlays остались строго current-level-only (не композитятся, по плану) и дополнительно гейтятся `currentSessionVisible` (не рисуются, если сам текущий уровень скрыт через eye-icon).
- `src/managers/CacheManager.js` — namespacing `objectCache`/`topLevelObjectCache`/`effectiveLayerCache`/`_layerToObjectIds` через `_namespacedKey(id)` = `${editor.currentLevelId}:${id}` (не явный параметр level — осознанное решение, чтобы не менять сигнатуры ~15 внешних call sites, которые все имплицитно current-level-scoped).
- `src/core/LevelsManager.js` — `getVisibleSessions()`/`toggleLevelVisibility()` уже были готовы с Фазы 1, использованы как есть.
- `src/utils/ParallaxRenderer.js` — `renderParallaxObjects()` получил параметр `level` (был баг — резолвил layer через `editor.level` вместо уровня объекта).
- `src/core/ObjectOperations.js` — `getObjectWorldBounds()` получил параметр `level`.
- Побочные находки и фиксы (не в исходном плане, но напрямую в той же подсистеме): объединены два ранее дублирующихся одноимённых метода `invalidateSpatialIndex()` (второе определение тихо перекрывало первое — pre-existing баг) в один `invalidateSpatialIndex(levelId = null)`; удалён мёртвый код — несуществующее свойство `this.editor.effectiveLayerCache` в `getEffectiveLayerId()` и неиспользуемый метод `clearEffectiveLayerCache()`.
- Ревью: CodeMaster + BugHunter параллельно, затем верификационный проход CodeMaster после фиксов. BugHunter: сразу "добро" (два low-priority замечания — визуальный desync selection при скрытом текущем уровне, неточный perf-guard в `getSelectableObjectsInViewport` — оба исправлены). CodeMaster нашёл 2 high-priority бага: (1) `buildSpatialIndex(level)` не пробрасывал `level` в `getObjectWorldBounds()` — некорректные bounds для вложенных объектов non-current видимых уровней; (2) parallax-ветка `render()` не пробрасывала `level` в `renderParallaxObjects()` — parallax ломался для non-current видимых уровней. Оба исправлены, перепроверены рантайм-тестом с принудительной коллизией id и вложенной группой на non-current уровне, финальная верификация CodeMaster — добро.
- Проверка: рантайм-тесты в браузере — 2 уровня с принудительно колидирующими id, оба видимы, композитинг без "протекания" объектов (подтверждено `getCachedObject('1')` резолвит разные объекты в зависимости от `currentLevelId`); toggle видимости корректно исключает уровень из рендера; isolate/solo/groupEditMode подтверждены ограниченными текущим уровнем; parallax и вложенные группы на non-current уровне работают корректно после фиксов; regression-baseline (одиночный уровень) идентичен поведению до Фазы 3.

### ✅ Фаза 4 — per-level история (Medium) — ЗАВЕРШЕНО (2026-07-09, изменений кода не потребовалось)
Цель: undo/redo никогда не пересекает границы уровня.
- `src/core/LevelsManager.js` — export/import стека в `setCurrentLevel()` — уже реализовано в Фазе 1, использовано как есть.
- `src/core/HistoryOperations.js` — аудит: все обращения идут через `this.editor.level` (прозрачный getter из Фазы 1), правок не потребовалось — подтверждает прогноз плана (раздел 5.3).
- Проверка (рантайм-тест в браузере, точно по сценарию плана): правки в A (2 объекта) → переключение на B (создание + правка) → возврат на A (объекты A не изменились) → Ctrl+Z на A отменяет ТОЛЬКО последнюю правку A → переключение на B → история B полностью не затронута → возврат на A → Redo корректно восстанавливает отменённую правку. `isUndoing`/`isRedoing` флаги не текут между сессиями. Все шаги прошли точно как ожидалось.
- Ревью субагентами не запускалось — фаза не внесла изменений в код (только верификация уже реализованного и уже прошедшего ревью в Фазе 1 механизма), повторное ревью неизменённого кода было бы избыточным.

### ✅ Фаза 5 — файловые операции + меню (Medium) — ЗАВЕРШЕНО (2026-07-09, CodeMaster+BugHunter: добро)
Цель: New/Open реально добавляют вкладки; Close/dirty-tracking работают; Save работает только с текущим.
- `src/core/LevelFileOperations.js` — `newLevel()`/`openLevel()` переписаны на `levelsManager.addLevel()` (больше НЕ вызывают `stateManager.reset()`/confirm-discard — теперь это добавление вкладки, а не замена/дискард); `openLevel()` дополнительно делает best-effort dedup "уже открыт" по `fileName` (Edge Case 8) — переключает на существующую вкладку вместо дубликата; `saveLevel()`/`saveLevelAs()` работают с `session.fileName` (всегда передают явный non-null fileName в `FileManager.saveLevel()`, обходя его собственный global-fallback); мёртвый код после рефакторинга удалён (`_confirmDiscardUnsavedChanges`, `_initializeGroupEditMode`, `_initializeHistory`).
- `src/managers/FileManager.js` — решение: `currentFileName` оставлен как vestigial global (не тронут) — не требует правок, т.к. `LevelFileOperations` теперь всегда передаёт явный fileName, обходя его.
- `config/menu.js` — добавлен пункт `close-level` в меню `Level`.
- `src/core/LevelEditor.js` — `closeLevel()` passthrough → `levelsManager.closeLevel(currentLevelId)`.
- `src/core/LevelsManager.js` — новый `closeLevel(levelId)` (guard "нельзя закрыть последний", confirm при dirty, чистит spatialIndex/visibleLayersCache); новый `hasAnyUnsavedChanges()`.
- Per-session `isDirty` — НЕ редирект всех ~28 `markDirty()`/`markClean()` call sites (мех. риск, 8 файлов) — вместо этого `LevelsManager.setCurrentLevel()` снапшотит/восстанавливает глобальный `stateManager.isDirty` на границе переключения (тот же паттерн что camera/selection с Фазы 1), делая единственный глобальный флаг эффективно per-session без изменения ни одного из 28 call sites. Закрывает gap, отмеченный CodeMaster в ревью Фазы 1 (LevelSession.isDirty был write-once/мёртв).
- Довершено то, что было явно отложено в Фазе 2 "до Фазы 5": пункт "Close" в контекстном меню `LevelsPanel` (`LevelsContextMenu.js`), disabled если открыт единственный уровень.
- Ревью: CodeMaster + BugHunter параллельно, затем верификационный проход. CodeMaster: сразу "добро" по всем 5 проверенным сценариям, только low/medium duplication-замечания (не блокирующие, не исправлялись). BugHunter нашёл 3 бага: (1) High — `addLevel()` не проверял коллизию `level.id` (напр. legacy/ручной JSON с id), из-за чего `levelSessions`/`levelOrder` могли рассинхронизироваться и сломать guard "нельзя закрыть последний уровень" — исправлено (детект коллизии + перегенерация id); (2) Medium — исключение в cache-cleanup внутри `closeLevel()` могло пропустить `setCurrentLevel(nextId)`, оставляя `currentLevelId` висящим на удалённой сессии — исправлено (два независимых try/catch: cache-cleanup non-fatal отдельно от switch/render); (3) Medium — устаревший комментарий у `_hasActiveMouseOperation()` — обновлён. Все три перепроверены рантайм-тестами (включая принудительную id-коллизию и принудительное исключение в cache-cleanup), финальная верификация CodeMaster — добро.
- Известный отложенный gap (не исправлен, low-risk по оценке BugHunter): `_hasActiveMouseOperation()`-guard не централизован в `LevelsManager.setCurrentLevel()`/`addLevel()` — `LevelsPanel.onAddLevel()`/`setCurrentLevelAndNotify()` (клик по вкладке/`+Add`) не проверяют активный mouse-drag перед переключением уровня, в отличие от `newLevel()`/`openLevel()`. Централизация оценена как отдельное архитектурное решение с риском конфликта с `closeLevel()`'s внутренним вызовом `setCurrentLevel()` — оставлено на усмотрение будущей полировки (Фаза 6), не блокирует Фазу 5.

### ✅ Фаза 6 — полировка / edge cases (Small-Medium) — ЗАВЕРШЕНО (2026-07-09, CodeMaster+BugHunter: добро)
Цель: закрыть оставшиеся Edge Cases плана без изменения архитектуры Фаз 1-5.
- `src/ui/LevelsPanel.js` — `_computeDisplayNames()` (Edge Case 1): числовой суффикс `"Untitled Level (2)"` при коллизии имён, только для `.level-name-display`, не мутирует `level.meta.name`; пересчитывается на полном (нефильтрованном поиском) списке сессий при каждом рендере, включая после rename (`_commitRename()` переписан на полный `this.render()` вместо точечного DOM-патча — нужно для пересчёта суффиксов).
- `src/core/LevelEditor.js` / `src/core/LevelsManager.js` — новое поле `levelMRU` (most-recently-current порядок), обновляется в `setCurrentLevel()`/`addLevel()` bootstrap-пути, чистится в `closeLevel()`/`destroy()`/`set level()`. `closeLevel()` при закрытии текущего уровня берёт fallback `levelMRU[levelMRU.length-1] ?? levelOrder[0]` вместо всегда `levelOrder[0]` (Edge Case 2).
- `src/ui/LevelsPanel.js` — drag-reorder списка уровней (`dragstart`/`dragend`/`dragover`/`drop`), зеркалит `LayersPanel.js` 1:1; новый `LevelsManager.reorderLevels(newOrder)` валидирует полную перестановку `levelOrder`, иначе no-op + `Logger.status.warn()`. Drag заблокирован (`draggable=false`) при активном поиске — источник DOM-порядка (`#levels-list`) в этом случае неполный относительно `levelOrder`.
- `src/core/LevelsManager.js` — новый `getVisibleSessionsForRender(sessions?)`: текущий уровень всегда переносится в конец массива компоузинга (рисуется поверх остальных), независимо от позиции таба. Закрывает решение раздела 12 п.2 ("текущий всегда поверх остальных"), не реализованное в Фазе 3 (`RenderOperations.render()` раньше просто итерировал `getVisibleSessions()` в tab-порядке без промоушена текущего уровня наверх) — найдено и исправлено в рамках этой фазы, не регрессия.
- `src/core/LevelsManager.js` — `toggleLevelVisibility()`: soft-cap предупреждение (`Logger.status.warn`) при пересечении порога `VISIBLE_LEVELS_SOFT_CAP=5` снизу вверх (только на самом переходе, не на каждом клике выше порога — Edge Case 5).
- `src/core/LevelsManager.js` — новый `cycleLevel(direction)`; `config/defaults/shortcuts.json` — `editor.nextLevel` (Ctrl+PageDown) / `editor.previousLevel` (Ctrl+PageUp); `src/event-system/EventHandlers.js` — ветки в `handleKeyDown`, стандартный `_matchesShortcut()`-путь.
- ✅ Детект повторного открытия файла (Edge Case 8) — реализовано досрочно в Фазе 5 (`openLevel()` best-effort dedup по `session.fileName`), без изменений в этой фазе.
- Ревью: CodeMaster + BugHunter параллельно. CodeMaster: багов не найдено; low-priority замечание — двойная аллокация сессий за кадр в рендер-цикле (`getVisibleSessions()` + `getVisibleSessionsForRender()` оба звали `getOrderedSessions()`) — исправлено (`getVisibleSessionsForRender(sessions)` принимает уже посчитанный массив). BugHunter нашёл 1 Medium + 3 Low: (1) Medium — drag-reorder при активном search-фильтре тихо no-op без видимого фидбека (лог уходил в console, не в статус-бар) — исправлено (`Logger.status.warn`, плюс `draggable=false` при активном фильтре как основной фикс); (2) Low — `this._draggedElement` хранил ссылку на DOM-узел, стухающую при конкурентном re-render списка — исправлено (`this._draggedLevelId` хранит id, не ссылку); (3) Low — soft-cap warn спамил на каждый toggle выше порога, а не на переходе — исправлено (`visibleCount === CAP+1`); (4) Low, не исправлено — Escape-отмена инлайн-ренейма всё равно помечает `isDirty`, т.к. `_commitRename` не сравнивает новое значение со старым; унаследовано 1:1 из `LayersPanel.renameLayer`, не регрессия Фазы 6, оставлено как есть (симметрично с Layers).
- Проверка (браузер, chrome-devtools): дизамбигуация имён (2× "Untitled Level" → "(2)"/"(3)", `meta.name` не тронут); MRU-fallback при закрытии текущего уровня (закрыт таб, current — не `levelOrder[0]`, а последний из MRU); z-order (`getVisibleSessionsForRender()` всегда возвращает текущий уровень последним); `reorderLevels()` — валидная перестановка применяется, невалидная — no-op с `Logger.status.warn`; `draggable=false` при активном поиске, `true` без фильтра; хоткеи Ctrl+PageDown/PageUp переключают уровни по кругу и корректно возвращаются; soft-cap warning фиксирован в консоли ровно на переходе через порог. Ошибок в консоли, связанных с изменениями, нет.

### ✅ Фаза 7 — Project (Medium) — ЗАВЕРШЕНО (2026-07-09, CodeMaster+BugHunter: добро)
Цель: набор открытых уровней сохраняется/восстанавливается одним файлом; меню `File` и `Settings` приведены к целевой структуре.
- `src/models/Project.js` (новый) — `toJSON(levelSessions, levelOrder, currentLevelId)`/статический `fromJSON(json)`. Т.к. `Level.toJSON()` не сериализует `id` (Edge Case 8), хранит не `currentLevelId`, а `currentLevelIndex` (позиция в `levels`), резолвится обратно в реальный id только после повторного `addLevel()` при загрузке.
- `src/core/ProjectFileOperations.js` (новый, BaseModule) — `newProject()`/`openProject()` (замена всего набора вкладок, единый confirm при несохранённых правках вместо N диалогов — Edge Case 10/11), `saveProject()`/`saveProjectAs()`. `openProject()` парсит все уровни (`Level.fromJSON()`) ДО очистки текущих сессий — невалидная запись не оставляет редактор без единого открытого уровня (Edge Case 3). Каждой фоновой (не-текущей) сессии при загрузке вручную сеется `.history` в формате `HistoryManager.saveState()`, т.к. `addLevel({makeCurrent:false})` не прогоняет её через живой HistoryManager. Новый приватный `_activateBootstrappedSession()` — трюк с временным `currentLevelId=null` перед вызовом `setCurrentLevel()`, чтобы переиспользовать уже проверенный switch-in путь вместо дублирования его логики. Новый приватный `_cleanupAllOpenSessions()` — `editor.level = X` (back-compat сеттер, которым newProject()/openProject() очищают весь набор сессий) не делает per-session cache cleanup, который делает `LevelsManager.closeLevel()` (spatial index/visibleLayersCache/layer-counts/objects-index) — без этого фикса повторные New/Open Project копили orphaned entries по levelId в этих кешах (найдено и исправлено в процессе, не по первоначальному плану).
- `config/menu.js` — переименование `level` → `file`, Project-блок с сепаратором (New/Open/Save/Save As Project), перенос `import-assets` в конец `File`, `project-settings` в `Settings` (перед `editor-settings`) — Раздел 8.
- `src/core/LevelEditor.js` — passthrough-методы `newProject()`/`openProject()`/`saveProject()`/`saveProjectAs()`/`openProjectSettings()` (`closeLevel()` уже существовал с Фазы 5), регистрация `projectFileOperations` как BaseModule, поля `project`/`projectSettingsDialog` + cleanup в `destroy()`.
- `src/ui/ProjectSettingsDialog.js` (новый, extends `BaseDialog`) — сознательно стаб (Открытый вопрос №9 оставлен как есть): редактируется только `project.name`, остальные поля-кандидаты (default asset import path, grid/snap, naming convention) явно отложены с пояснением в UI.
- `src/event-system/EventHandlers.js` — 2 хардкод-селектора `#menu-level` обновлены на `#menu-file` (fallout переименования id меню).
- "Save All" (Открытый вопрос №6) — НЕ реализовано в этой фазе, осталось нерешённым по плану (пользователь отметил technical concerns по batch-download в браузере). Практическая часть проблемы уже закрыта иначе: project-файл самодостаточен и уже эмбеддит полные данные всех открытых уровней одним файлом — отдельная команда "Save All" (по одному файлу на уровень) не обязательна для той же цели.
- Проверка (браузер, chrome-devtools): меню `File`/`Settings` рендерятся с целевой структурой (`Import Assets...` последним в `File`, `Project Settings...` первым в `Settings`); `newProject()` заменяет весь набор вкладок одним свежим уровнем с seeded history baseline; ручной round-trip `Project.toJSON()` → воспроизведённая логика `openProject()` восстанавливает порядок/видимость/currentLevelIndex/per-tab history корректно; `ProjectSettingsDialog` открывается, редактирование имени и Save применяются и закрывают диалог; `_cleanupAllOpenSessions()` подтверждён — после `newProject()` orphaned levelId отсутствует в `renderOperations.spatialIndex`/`visibleLayersCache`. Ошибок в консоли, связанных с изменениями, нет.
- Ревью: CodeMaster + BugHunter параллельно. CodeMaster — добро (2 minor: DOM-запрос в `ProjectSettingsDialog.commitChanges()` не был scoped через `this.container` — исправлено; локальный `_escapeHtml()` не дублирует существующий helper, оставлен как есть). BugHunter нашёл 1 Medium: `openProject()` трактовал ЛЮБОЙ reject `FileUtils.pickFile()` как "user cancelled" (молча возвращался), из-за чего настоящая ошибка внутри file-picker'а (не только штатная отмена) тоже проглатывалась без алерта пользователю — исправлено (различает `'File selection cancelled'`/`'No file selected'` от прочих ошибок, на прочих показывает `alert()`). Остальные 7 пунктов фокуса BugHunter — чисто (порядок cache-cleanup, mouse-guard, dirty-bypass, `currentLevelIndex`-резолюция, диалог до создания project, menu-id fallout — все корректны). Оба фикса перепроверены в браузере (chrome-devtools): консоль чистая, module load без ошибок.

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
**решение**: текущий всегда поверх остальных.
3. **Per-level `HistoryManager` инстансы vs. один инстанс с export/import** (план выбирает export/import ради меньшего риска) — подтвердить, или предпочесть N независимых инстансов (проще ментально, но больше правок в lifecycle/module-регистрации).
**решение**:делаем как проще и надёжнее для общей устойчивости системы.
4. **Фикс коллизии object id**: namespacing кешей по levelId (рекомендовано) vs. глобально уникальные id (отклонено — риск для формата сохранения) — подтвердить вариант A и перепроверить, нет ли другого кода вне CacheManager/RenderOperations, полагающегося на глобальную уникальность object id.
**решение**: namspacing по LevelId
5. **Лимит на кол-во одновременно видимых уровней** — жёсткий cap (5-10) в `toggleLevelVisibility()` или только предупреждение в логах?
**решение**: предупреждение в строке состояния что количество объектов на видимых уровнях может существенно снизить производительность вьюпорта
6. **"Save All" в меню** — включать в Фазу 5 или оставить "Save всегда только текущий" насовсем?
**решение (финал, после Фазы 7)**: Save All не нужен — Project → Save уже закрывает эту задачу: project-файл самодостаточен и эмбеддит `Level.toJSON()` каждого открытого уровня одним файлом (см. Раздел 0.1, `Project.toJSON()`). Отдельная команда Level → Save All (по файлу на уровень) не реализуется. Save All для ассетов также не реализуется по той же причине, плюс сохраняются нерешённые проблемы с batch-download из браузера (окно File Save на каждый файл), упомянутые в исходном черновике решения.
7. **Цвет/иконка уровня в списке** (по аналогии с color-swatch слоя) — слои имеют реальное семантическое использование цвета (гизмо/рамка на canvas). У уровней такого пока нет — декоративный auto-palette swatch или вообще без него?
**решение**: рамка по цвету слоя сейчас не работает. задумывалась как визуальный индикатор в списке. Для уровней то-же самое пока - просто цвет в списке.
8. **"Main Level" концепция** — Edge Case 3 рекомендует НЕ вводить структурно-особый Main Level (в отличие от Main Layer) — подтвердить эту трактовку требования.
**решение**: не вводить. нет необходимости.
9. **Состав `Project Settings`** — какие настройки логически project-scope (а не editor-scope/level-scope)? Кандидаты в Разделе 0.5 (default asset import path, default grid/snap для новых уровней проекта, naming convention) — нужен явный список полей до реализации диалога (Фаза 7).
**решение**: пока оставим как заглушку. нужно добавить окно и вынести какие-то базовые вещи (посмотреть примеры в сети)
10. **`Close Project`** — нужен ли отдельный пункт меню, или "закрыть проект" всегда равно `New Project` (закрыть всё + создать новый пустой проект/уровень), т.к. однооконный браузерный редактор не может остаться "без открытого проекта"?
**решение**: новый проект удаляет текущий. Предупреждать, если есть не сохраненные сущности.
11. **`Open Project` — замена или добавление уже открытых вкладок** — план по умолчанию (Edge Case 11) предполагает замену; подтвердить, не нужен ли merge-режим (открыть уровни проекта, оставив уже открытые уровни как есть).
**решение**: замена текущего открытием нового. ручной merge можно делать до-загрузкой уровней.

---

### Ключевые файлы для реализации

- `src/core/LevelEditor.js`
- `src/core/LevelFileOperations.js`
- `src/core/RenderOperations.js`
- `src/models/Level.js`
- `src/ui/LayersPanel.js`
- `src/managers/CacheManager.js`
- `src/managers/HistoryManager.js`
