# План исправлений: H1, M6–M9

Создано: 2026-07-01  
Источник: TECHNICAL_AUDIT_PLAN.md (ранее descoped из-за отсутствия браузерной верификации)  
Статус: теперь выполняется — chrome-devtools MCP доступен

Легенда: ⬜ не начато · 🔄 в работе · ✅ выполнено и проверено в браузере · ⏳ код написан, браузерная верификация pending

---

## M9 — buildSpatialIndex: многократный пересбор ⏳

**Проблема:**  
`buildSpatialIndex()` вызывается из 6 мест (GroupOperations, LayerOperations, HistoryOperations, CacheManager.scheduleCacheInvalidation, LevelEditor init, авто-rebuild в getVisibleObjectsSpatial). При загрузке уровня или batch-операциях возможна цепочка вызовов подряд. Каждый вызов — O(N) по всем объектам.

**Текущая защита:** флаг `isBuildingSpatialIndex` — блокирует только *конкурентные* вызовы, не последовательные.

**Решение:**
1. Добавить флаг `_spatialIndexDirty = false` в конструктор RenderOperations.
2. Все вызовы `buildSpatialIndex()` во внешних местах заменить на `markSpatialIndexDirty()` — устанавливает флаг, не строит.
3. В начале `getVisibleObjectsSpatial()` (уже вызывается из render-loop) — если `_spatialIndexDirty`, вызвать `buildSpatialIndex()` и сбросить флаг.
4. При явно необходимом немедленном пересборе (LevelEditor init, openLevel) — оставить прямой вызов.

**Затрагиваемые файлы:**
- `src/core/RenderOperations.js` — добавить флаг и метод `markSpatialIndexDirty()`
- `src/core/GroupOperations.js:136` — заменить вызов
- `src/core/LayerOperations.js:142` — заменить вызов
- `src/core/HistoryOperations.js:78` — заменить вызов
- `src/managers/CacheManager.js:287` — заменить вызов (внутри scheduleCacheInvalidation)

**Браузерный тест:**
```js
// Подсчёт вызовов buildSpatialIndex за 3 секунды перетаскивания
let count = 0;
const orig = levelEditor.renderOperations.buildSpatialIndex.bind(levelEditor.renderOperations);
levelEditor.renderOperations.buildSpatialIndex = function() { count++; return orig(); };
setTimeout(() => console.log('buildSpatialIndex calls:', count), 3000);
// До фикса: ожидать N > 1 при drag/undo; после: только при явных операциях
```

**Риск:** низкий — spatial index остаётся консистентным, просто строится лениво.

---

## H1 — saveState: дорогой JSON.stringify на каждый drag ⬜ (требует браузерного замера — пропущено, chrome-devtools MCP недоступен)

**Проблема:**  
`HistoryManager.saveState()` делает `JSON.stringify` всего массива объектов. Вызывается на `mouseup` после drag (MouseHandlers:305). При 200+ объектах stringify может занять 10–30 мс, блокируя UI.

**Диагностика сначала:**  
Измерить реальное время — если < 5ms, фикс не нужен.

**Решение (если медленно):**  
Обернуть stringify в `requestIdleCallback` с fallback на `setTimeout(0)` для старых браузеров. `saveState` возвращает Promise вместо void (внутреннее изменение, API не меняется снаружи).

```js
// HistoryManager.saveState — сделать async через requestIdleCallback
saveState(objects, selection, isInitial, groupEditMode) {
    if (!this.isRecording && !isInitial) return;
    // Немедленная быстрая проверка на дублирование (только метаданные — длина + timestamp)
    // Полный stringify — через idle callback
    const save = () => {
        const stateData = { objects, selection: selection ? Array.from(selection) : [], ... };
        const stateSnapshot = JSON.stringify(stateData);
        if (!isInitial && stateSnapshot === this.undoStack[this.undoStack.length - 1]) return;
        this.undoStack.push(stateSnapshot);
        if (this.undoStack.length > this.maxSize) this.undoStack.shift();
        if (!isInitial) this.redoStack = [];
    };
    if (isInitial) { save(); }
    else if (typeof requestIdleCallback !== 'undefined') { requestIdleCallback(save, { timeout: 500 }); }
    else { setTimeout(save, 0); }
}
```

**Затрагиваемые файлы:**
- `src/managers/HistoryManager.js` — только метод `saveState()`

**Браузерный тест:**
```js
// До фикса: замерить время одного saveState
const t0 = performance.now();
levelEditor.historyManager.saveState(levelEditor.level.objects, levelEditor.stateManager.get('selectedObjects'));
console.log('saveState duration:', performance.now() - t0, 'ms');
// После фикса: mouseup больше не блокируется; undo всё ещё работает корректно
```

**Риск:** средний — undo после drag может сохраниться с небольшой задержкой. Добавить pending-флаг чтобы undo дождался сохранения.

---

## M7 — getSelectableObjectsInViewport без spatial index ⏳

**Проблема:**  
`CacheManager.getSelectableObjectsInViewport()` итерирует ВСЕ selectable объекты и вручную проверяет AABB против viewport. Уже есть кэш по `cameraKey` с TTL 200ms, но при первом вызове или смене камеры — O(N) без ускорения.

**Решение:**  
В начале `getSelectableObjectsInViewport()`, если spatial index существует и актуален — использовать `renderOperations.getVisibleObjectsSpatial()` для получения кандидатов, затем фильтровать по selectability. Получаем O(k) где k ≪ N — только объекты в viewport ячейках.

```js
getSelectableObjectsInViewport() {
    const camera = this.editor.stateManager.get('camera');
    const cameraKey = `${camera.x}_${camera.y}_${camera.scale}`;
    const currentTime = performance.now();
    
    if (this.selectableObjectsCache.has(cameraKey) &&
        currentTime - this.selectableObjectsCacheTimestamp < this.selectableCacheTimeout) {
        return this.selectableObjectsCache.get(cameraKey);
    }

    // Используем spatial index если доступен
    const renderOps = this.editor.renderOperations;
    let candidates;
    if (renderOps && renderOps.spatialIndex.size > 0) {
        candidates = new Set(renderOps.getVisibleObjectsSpatial(camera).map(o => o.id));
    } else {
        // fallback: старая логика
        candidates = this.editor.objectOperations.computeSelectableSet();
    }

    const selectableObjects = this.editor.objectOperations.computeSelectableSet();
    const selectableInViewport = new Set();
    candidates.forEach(objId => {
        if (selectableObjects.has(objId)) selectableInViewport.add(objId);
    });

    this.selectableObjectsCache.set(cameraKey, selectableInViewport);
    this.selectableObjectsCacheTimestamp = currentTime;
    if (this.selectableObjectsCache.size > 5) {
        this.selectableObjectsCache.delete(this.selectableObjectsCache.keys().next().value);
    }
    return selectableInViewport;
}
```

**Затрагиваемые файлы:**
- `src/managers/CacheManager.js` — метод `getSelectableObjectsInViewport()`

**Браузерный тест:**
```js
// Замерить время до/после
const t0 = performance.now();
for (let i = 0; i < 100; i++) {
    levelEditor.cacheManager.clearSelectableObjectsCache();
    levelEditor.cacheManager.getSelectableObjectsInViewport();
}
console.log('100x getSelectableObjectsInViewport:', performance.now() - t0, 'ms');
```

**Риск:** низкий — при отсутствии spatial index падает на старую логику.

---

## M8 — effectiveLayerCache: полная очистка при layer-изменении ⏳

**Проблема:**  
В `smartCacheInvalidation()` при `layerIds.size > 0` делается `this.effectiveLayerCache.clear()` — стирается кэш ВСЕХ объектов, хотя изменился только один layer и только его объекты имеют dirty effectiveLayerId.

**Решение:**  
Добавить обратный индекс `_layerToObjectIds: Map<layerId, Set<objId>>` в CacheManager, строить его лениво при `getCachedEffectiveLayerId()`. При layer-изменении инвалидировать только записи объектов этого layer.

```js
// В getCachedEffectiveLayerId — после расчёта, добавляем в reverse index:
if (!this._layerToObjectIds) this._layerToObjectIds = new Map();
const layerSet = this._layerToObjectIds.get(effectiveLayerId) || new Set();
layerSet.add(obj.id);
this._layerToObjectIds.set(effectiveLayerId, layerSet);

// В smartCacheInvalidation при layerIds.size > 0:
layerIds.forEach(layerId => {
    const objIds = this._layerToObjectIds?.get(layerId);
    if (objIds) {
        objIds.forEach(objId => this.effectiveLayerCache.delete(objId));
        this._layerToObjectIds.delete(layerId);
    } else {
        // fallback если индекс не прогрет
        this.effectiveLayerCache.clear();
    }
});
```

**Затрагиваемые файлы:**
- `src/managers/CacheManager.js` — `getCachedEffectiveLayerId()` и `smartCacheInvalidation()`
- `src/managers/CacheManager.js` — `clearCaches()` — добавить `this._layerToObjectIds?.clear()`

**Браузерный тест:**
```js
// Добавить объекты на 2 разных layer, прогреть кэш, изменить layer 1
// Проверить что effectiveLayerCache объектов layer 2 не сброшен
const cacheSize = () => levelEditor.cacheManager.effectiveLayerCache.size;
console.log('before:', cacheSize()); // ожидаем N
// [выбрать layer 1, переименовать]
console.log('after:', cacheSize()); // до фикса: 0; после: N - (объекты layer1)
```

**Риск:** низкий — при промахе индекса fallback на clearAll.

---

## M6 — ctx.save/restore: избыточные вызовы в recursive traversal ⏳

**Проблема:**  
В `drawHierarchyHighlightForGroup()` (строки 604/612) и `drawDuplicateHierarchyHighlight()` (строки 935/943) — `ctx.save()/restore()` на КАЖДЫЙ дочерний объект группы в рекурсии. При группе из 50+ объектов — 100+ дорогих API-вызовов вместо 2.

Единственное что меняется между итерациями: `fillStyle` и `globalAlpha` (уже вычислен до цикла, одинаков для всего depth).

**Решение:**  
Вынести `ctx.save()`/`ctx.restore()` за пределы forEach-цикла — один раз на весь traversal данного depth. `fillStyle` в цикле не меняется — он зависит от depth (вычислен до forEach). Выставляем его один раз перед циклом.

```js
// БЫЛО: save/restore внутри forEach
drawHierarchyHighlightForGroup(group, depth = 0) {
    ...
    const rgba = RenderUtils.hexToRgba(baseColor, alpha);
    // СТАЛО:
    const ctx = this.editor.canvasRenderer.ctx;
    ctx.save();
    ctx.fillStyle = rgba; // одно значение для всего depth
    group.children.forEach(child => {
        if (child.type === 'group') {
            const bounds = ...;
            ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
            // Рекурсия с restore/save вокруг неё НЕ нужна — дочерние вызовы делают save/restore сами
            this.drawHierarchyHighlightForGroup(child, depth + 1);
        }
    });
    ctx.restore();
}
```

**Затрагиваемые файлы:**
- `src/core/RenderOperations.js:590–618` — `drawHierarchyHighlightForGroup()`
- `src/core/RenderOperations.js:918–948` — `drawDuplicateHierarchyHighlight()`

**Браузерный тест:**  
Создать группу из 20+ объектов, измерить время render():
```js
const t0 = performance.now();
for (let i = 0; i < 60; i++) levelEditor.render();
console.log('60 renders:', performance.now() - t0, 'ms');
// Визуально: highlights должны отрисовываться идентично как до фикса
```

**Риск:** очень низкий — изменение только группировки ctx state вызовов, не логики рисования.

---

## Порядок выполнения

1. **M9** — наибольший эффект, наименьший риск (lazy rebuild spatial index)
2. **H1** — профилирование сначала, deferred stringify только если нужно
3. **M7** — делегируем spatial index для fiterования selectable
4. **M8** — selective layer cache invalidation
5. **M6** — упрощение ctx state management в recursive traversal
