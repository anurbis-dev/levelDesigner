# API Reference - 2D Level Editor v3.49.4

## Обзор

Данный документ содержит подробное описание API всех компонентов редактора уровней.

> 🔍 **Быстрый справочник:** См. [COMPREHENSIVE_API_REFERENCE.md](./COMPREHENSIVE_API_REFERENCE.md) для полного списка всех методов и функций в структурированном виде.

## Обновления v3.49.3 - Исправление дублирования в группах

### 🎯 DuplicateUtils - Исправление позиционирования дубликатов
**Файл**: `src/utils/DuplicateUtils.js`

```javascript
// ИСПРАВЛЕНО: initializePositions() теперь корректно обрабатывает внешние объекты в режиме групп
const positionedObjects = DuplicateUtils.initializePositions(objects, worldPos, editor);

// Новая логика проверки принадлежности к группе
if (editor.objectOperations.isInGroupEditMode()) {
    const isObjectInActiveGroup = editor.objectOperations.isObjectInGroupRecursive(obj, activeGroup);
    if (isObjectInActiveGroup) {
        // Группо-относительное позиционирование
        objWorldX = groupWorldPos.x + obj.x;
        objWorldY = groupWorldPos.y + obj.y;
    } else {
        // Стандартное мировое позиционирование для внешних объектов
        const objPos = editor.objectOperations.getObjectWorldPosition(obj);
        objWorldX = objPos.x;
        objWorldY = objPos.y;
    }
}
```

**Исправленная проблема:**
- **Было**: При Alt+click+drag внешних объектов в открытой группе дубликаты получали неправильную позицию
- **Стало**: Внешние объекты корректно дублируются под курсором, внутренние объекты группы сохраняют группо-относительное позиционирование

**Технические детали:**
- Добавлена проверка `isObjectInGroupRecursive(obj, activeGroup)` для определения принадлежности объекта к группе
- Разделена логика позиционирования на два случая: внутренние и внешние объекты группы
- Сохранена полная обратная совместимость со всеми существующими сценариями

## Обновления v3.49.2 - Исправления селекции и перетаскивания

### 🎯 ObjectOperations - Исправление приоритета селекции
**Файл**: `src/core/ObjectOperations.js`

```javascript
// НОВОЕ: Вспомогательная функция для сортировки объектов по zIndex
_sortObjectsByZIndexDescending(objects);

// ИСПРАВЛЕНО: findObjectAtPoint() теперь обрабатывает все объекты по zIndex
// Группы больше не имеют искусственного приоритета
const selectedObject = objectOps.findObjectAtPoint(x, y);
```

**Изменения в логике селекции:**
- **Было**: Группы обрабатывались первыми, потом обычные объекты
- **Стало**: Все объекты обрабатываются вместе по zIndex (от большего к меньшему)
- **Результат**: Выбирается объект с максимальным zIndex независимо от типа

### 🖱️ MouseHandlers - Исправление перетаскивания в группы
**Файл**: `src/core/MouseHandlers.js`

```javascript
// ИСПРАВЛЕНО: dragSelectedObjects() - правильный порядок операций
dragSelectedObjects(worldPos, e) {
    // 1. Инвалидация пространственного индекса ДО перемещения
    this.editor.renderOperations.invalidateSpatialIndex();
    
    // 2. Очистка кешей эффективного слоя
    this.editor.renderOperations.clearEffectiveLayerCacheForObject(obj.id);
    
    // 3. Атомарное перемещение: сначала в группу, потом удаление
    groupEditMode.group.children.push(obj);
    this.editor.level.removeObject(obj.id);
    
    // 4. Отложенный рендеринг для предотвращения фантомов
    return objectsMovedToGroup;
}
```

**Исправления:**
- **Фантомные объекты**: Устранены кратковременные фантомы при перетаскивании в группы
- **Порядок операций**: Объект сначала добавляется в группу, потом удаляется из основного уровня
- **Кеширование**: Используется умная очистка кешей эффективного слоя
- **Рендеринг**: Отложенный рендеринг до завершения всех операций

### 🔧 DuplicateOperations - Исправление Logger
**Файл**: `src/core/DuplicateOperations.js`

```javascript
// ДОБАВЛЕНО: Импорт Logger для корректной работы
import { Logger } from '../utils/Logger.js';
```

**Исправление**: Устранена ошибка `ReferenceError - Logger is not defined`

## Обновления v3.49.0 - Исправления zIndex и рендеринга

### 🎯 Level Operations - Унифицированное управление zIndex
**Файл**: `src/models/Level.js`

```javascript
// Присваивание начального zIndex новому объекту (унифицированный метод)
level.assignInitialZIndex(object, layerId);

// Получение следующего доступного zIndex для нового объекта
const nextZIndex = level.getNextZIndex();

// Обновление индексов всех слоев (при изменении порядка)
level.updateLayerIndices();

// Обновление zIndex всех объектов (при изменении структуры слоев)
level.updateAllObjectZIndices();

// Назначение объекта на слой с пересчетом zIndex
level.assignObjectToLayer(objectId, targetLayerId);
```

**Пример использования**:
```javascript
// Присвоить начальный zIndex новому объекту
const newObject = createGameObject();
editor.level.assignInitialZIndex(newObject, targetLayerId);

// Получить следующий zIndex для нового объекта
const zIndex = editor.level.getNextZIndex();
console.log('Next zIndex:', zIndex); // 1.003 (layer 1, object index 3)
```

### 🎨 Render Operations - Рекурсивный сбор объектов
**Файл**: `src/core/RenderOperations.js`

```javascript
// Рекурсивный сбор всех видимых объектов с их parent позициями
const visibleObjects = renderOps.collectVisibleObjectsRecursive(
    objects,           // массив объектов для обработки
    visibleLayerIds,   // видимые ID слоев
    left, top,         // границы viewport
    right, bottom
);

// Получение всех видимых объектов (использует collectVisibleObjectsRecursive)
const visibleObjects = renderOps.getVisibleObjects(camera);
```

**Пример использования**:
```javascript
// Получить все видимые объекты рекурсивно
const visibleObjects = editor.renderOperations.collectVisibleObjectsRecursive(
    editor.level.objects,
    visibleLayerIds,
    viewportLeft, viewportTop,
    viewportRight, viewportBottom
);

// Каждый объект имеет формат: { obj, parentX, parentY }
visibleObjects.forEach(item => {
    const { obj, parentX, parentY } = item;
    console.log('Object:', obj.name, 'at position:', obj.x + parentX, obj.y + parentY);
});
```

## Предыдущие обновления v3.47.0 - Система индексов глубины (Z-Index)

### 🎯 Level Operations - Система индексов глубины

**Пример использования**:
```javascript
// Получить следующий zIndex для нового объекта
const zIndex = editor.level.getNextZIndex();
console.log('Next zIndex:', zIndex); // 1.003 (layer 1, object index 3)

// Переместить объект на другой слой
editor.level.assignObjectToLayer('obj_123', 'layer_456');
```

### 🎨 Layer Operations - Управление слоями и zIndex
**Файл**: `src/core/LayerOperations.js`

```javascript
// Переместить выбранные объекты на следующий/предыдущий слой
layerOperations.moveSelectedObjectsToLayer(moveUp, moveToExtreme = false);

// Проверить, можно ли перемещать объекты между слоями
layerOperations.canMoveObjectsToLayer();
```

**Пример использования**:
```javascript
// Переместить объекты на следующий слой
editor.layerOperations.moveSelectedObjectsToLayer(true);

// Переместить объекты на первый слой
editor.layerOperations.moveSelectedObjectsToLayer(true, true);
```

### 🏗️ GameObject - Свойства объектов
**Файл**: `src/models/GameObject.js`

```javascript
// Создание объекта с zIndex
const obj = new GameObject({
    name: 'My Object',
    x: 100, y: 100,
    zIndex: 1.005  // layer 1, object index 5
});

// Получение zIndex объекта
const zIndex = obj.zIndex; // 1.005

// Изменение zIndex
obj.zIndex = 2.003; // layer 2, object index 3
```

### 🏢 Group - Наследование zIndex
**Файл**: `src/models/Group.js`

```javascript
// Создание группы с наследованием zIndex для дочерних объектов
const group = new Group({
    name: 'My Group',
    layerId: 'layer_1',
    zIndex: 1.001  // layer 1, object index 1
});

// Дочерние объекты автоматически наследуют zIndex группы
group.children.forEach(child => {
    // child.zIndex будет пересчитан на основе layerId группы
});
```

---

## Обновления v3.46.0 - Фаза 5

### ViewportOperations - Управление viewport и камерой
**Файл**: `src/core/ViewportOperations.js`

```javascript
import { ViewportOperations } from './core/ViewportOperations.js';

// Создание (обычно в LevelEditor)
this.viewportOperations = new ViewportOperations(this);
this.lifecycle.register('viewportOperations', this.viewportOperations, { priority: 7 });

// Zoom operations
viewportOperations.zoomIn(factor = 1.2, maxZoom = 5.0)
viewportOperations.zoomOut(factor = 1.2, minZoom = 0.1)
viewportOperations.zoomToFit(padding = 50, maxZoom = 1.0)
viewportOperations.resetView(defaults = {x: 0, y: 0, zoom: 1.0})

// Focus operations
viewportOperations.focusOnSelection()                    // Фокус на выбранных объектах
viewportOperations.focusOnAll()                         // Фокус на всех объектах
viewportOperations.focusOnBounds(bounds, padding = 50)  // Фокус на заданных границах
```

**Пример использования**:
```javascript
// Зум к выбранным объектам
editor.viewportOperations.focusOnSelection();

// Зум с пользовательским фактором
editor.viewportOperations.zoomIn(1.5, 10.0);  // Увеличить в 1.5 раз, макс 10x

// Сброс с пользовательскими дефолтами
editor.viewportOperations.resetView({x: 100, y: 100, zoom: 0.5});
```

---

### LevelFileOperations - Файловые операции
**Файл**: `src/core/LevelFileOperations.js`

```javascript
import { LevelFileOperations } from './core/LevelFileOperations.js';

// Создание (обычно в LevelEditor)
this.levelFileOperations = new LevelFileOperations(this);
this.lifecycle.register('levelFileOperations', this.levelFileOperations, { priority: 6 });

// File operations
await levelFileOperations.newLevel()           // Создать новый уровень
await levelFileOperations.openLevel()          // Открыть существующий уровень
await levelFileOperations.saveLevel()          // Сохранить текущий уровень
await levelFileOperations.saveLevelAs()        // Сохранить как новый файл
await levelFileOperations.importAssets()       // Импортировать ассеты
```

**Пример использования**:
```javascript
// Создать новый уровень
await editor.levelFileOperations.newLevel();

// Импортировать ассеты
await editor.levelFileOperations.importAssets();
```

**Особенности**:
- Автоматическая валидация Player Start (ровно 1 объект)
- Сохранение/восстановление view states (камера, zoom)
- Автоматическая инициализация групп, слоев, параллакса, истории
- Поддержка отмены операций

---

## Обновления v3.43.0 - Фаза 4.5

### LevelEditor.applyConfiguration() - Разбивка метода
Метод `applyConfiguration()` разбит на 7 специализированных методов для улучшения читаемости и maintainability.

**Основной метод** (публичный):
```javascript
/**
 * Apply configuration settings to editor
 * @description Main entry point for applying configuration. Note: Font scale 
 * and theme are applied immediately in index.html to prevent UI flicker.
 */
applyConfiguration()
```

**Приватные методы**:
```javascript
/**
 * Apply grid configuration settings to StateManager
 * @private
 */
_applyGridConfiguration()

/**
 * Get grid settings from configuration manager
 * @private
 * @returns {Object} Grid settings object
 */
_getGridSettingsFromConfig()

/**
 * Apply basic grid settings (size, color, thickness, opacity)
 * @private
 * @param {Object} settings - Grid settings object
 */
_applyBasicGridSettings(settings)

/**
 * Apply grid subdivision settings
 * @private
 * @param {Object} settings - Grid settings object
 */
_applyGridSubdivisionSettings(settings)

/**
 * Apply grid type settings (rectangular, hexagonal, etc.)
 * @private
 * @param {Object} settings - Grid settings object
 */
_applyGridTypeSettings(settings)

/**
 * Sync grid settings to UI components
 * @private
 */
_syncGridSettingsToUI()

/**
 * Save default configuration settings
 * @private
 */
_saveDefaultConfiguration()
```

**Пример использования** (без изменений для внешнего кода):
```javascript
// Применить настройки конфигурации
levelEditor.applyConfiguration();
```

**Преимущества**:
- Метод стал значительно короче (65→10 строк)
- Каждый метод отвечает за одну задачу (Single Responsibility Principle)
- Легче тестировать и поддерживать
- Полная JSDoc документация

---

## Обновления v3.42.0 - Фаза 4.4

### CacheManager - Менеджер кэширования
**Файл**: `src/managers/CacheManager.js`

```javascript
import { CacheManager } from './managers/CacheManager.js';

// Создание (обычно в LevelEditor)
this.cacheManager = new CacheManager(this);
this.lifecycle.register('cacheManager', this.cacheManager, { priority: 5 });

// API кэширования объектов
cacheManager.getCachedObject(objId)             // O(1) поиск объекта
cacheManager.getCachedTopLevelObject(objId)     // O(1) top-level объект
cacheManager.getCachedEffectiveLayerId(obj)     // O(1) layerId с наследованием
cacheManager.getSelectableObjectsInViewport()   // Кэш с TTL 200ms

// Управление кэшами
cacheManager.clearCaches()                      // Очистить все
cacheManager.invalidateObjectCaches(objId)      // Инвалидация объекта
cacheManager.clearSelectableObjectsCache()      // Очистить viewport кэш

// Умная инвалидация
cacheManager.smartCacheInvalidation({           // Избирательная инвалидация
    objectIds: new Set([...]),
    layerIds: new Set([...]),
    invalidateAll: false,
    reason: 'reason'
})
cacheManager.invalidateAfterLayerChanges(objIds, layerIds)
cacheManager.invalidateAfterGroupOperations(objIds)
cacheManager.invalidateAfterDuplicateOperations(objIds)
cacheManager.scheduleCacheInvalidation()        // Debounced полная (100ms)
```

**Интеграция в LevelEditor**:
```javascript
// Простое делегирование
getCachedObject(objId) {
    return this.cacheManager.getCachedObject(objId);
}

smartCacheInvalidation(spec) {
    this.cacheManager.smartCacheInvalidation(spec);
}
```

**Преимущества**:
- Separation of Concerns (кэширование изолировано)
- O(1) операции для производительности
- Smart invalidation вместо полной очистки
- LevelEditor.js: 2057→1811 строк (-12%)

---

## Обновления v3.41.0 - Фаза 4.3

### LayerOperations - Модуль управления слоями
**Файл**: `src/core/LayerOperations.js`

```javascript
import { LayerOperations } from './core/LayerOperations.js';

// Создание (обычно в LevelEditor)
this.layerOperations = new LayerOperations(this);
this.lifecycle.register('layerOperations', this.layerOperations, { priority: 8 });

// API
layerOperations.moveSelectedObjectsToLayer(moveUp, moveToExtreme)  // Перемещение объектов
layerOperations.assignSelectedObjectsToLayer(objects, up, extreme) // Назначение слоя
layerOperations.batchProcessLayerAssignment(...)                   // Пакетная обработка
layerOperations.findNextUnlockedLayer(layers, id, up)              // Поиск незаблокир. слоя
layerOperations.batchProcessAdjacentLayerAssignment(...)           // Соседние слои
layerOperations.processObjectForLayerAssignment(...)               // Обработка объекта
layerOperations.batchNotifyObjectPropertyChanged(...)              // Группировка уведомл.
layerOperations.batchNotifyLayerCountChanged(...)                  // Группировка счетчиков
layerOperations.flushBatchedNotifications(batched)                 // Отправка уведомлений
layerOperations.canMoveObjectsToLayer()                            // Проверка возможности
```

**Интеграция в LevelEditor**:
```javascript
// Простое делегирование
moveSelectedObjectsToLayer(moveUp, moveToExtreme = false) {
    this.layerOperations.moveSelectedObjectsToLayer(moveUp, moveToExtreme);
}

canMoveObjectsToLayer() {
    return this.layerOperations.canMoveObjectsToLayer();
}
```

**Преимущества**:
- Separation of Concerns (слои изолированы)
- Переиспользование (можно использовать в других компонентах)
- Тестируемость (легко тестировать отдельно)
- Сохранены оптимизации (batch processing, caching, spatial index)
- LevelEditor.js: 2415→2057 строк (-14.8%)

---

## Обновления v3.40.0 - Фаза 4.2

### HistoryOperations - Модуль управления историей
**Файл**: `src/core/HistoryOperations.js`

```javascript
import { HistoryOperations } from './core/HistoryOperations.js';

// Создание (обычно в LevelEditor)
this.historyOperations = new HistoryOperations(this);
this.lifecycle.register('historyOperations', this.historyOperations, { priority: 9 });

// API
historyOperations.undo()                          // Отменить последнее действие
historyOperations.redo()                          // Повторить отмененное
historyOperations.restoreObjectsFromHistory(data) // Восстановить объекты из JSON
historyOperations.rebuildAllIndices()             // Перестроить индексы
historyOperations.restoreGroupEditMode(mode)      // Восстановить режим группы
historyOperations.recalculateGroupBounds()        // Пересчет границ группы
historyOperations.invalidateCachesAfterRestore()  // Инвалидация кешей
historyOperations.restoreSelection(selection)     // Восстановить выделение
historyOperations.finalizeHistoryRestore()        // Финализация (render + panels)
```

**Интеграция в LevelEditor**:
```javascript
// Простое делегирование
undo() {
    this.historyOperations.undo();
}

redo() {
    this.historyOperations.redo();
}
```

**Преимущества**:
- Separation of Concerns (история изолирована)
- Переиспользование (можно использовать в других компонентах)
- Тестируемость (легко тестировать отдельно)
- LevelEditor.js: 2693→2415 строк (-10.3%)

---

## Обновления v3.39.0 - Фаза 4.1

### LevelEditor - Разбивка больших методов

#### init() - разбит на 7 методов
**Файл**: `src/core/LevelEditor.js`

```javascript
// Основной метод (180 строк → 15 строк)
async init() {
    await this.initializeConfiguration();
    const domElements = this.initializeDOMElements();
    this.initializeRenderer(domElements.canvas);
    this.initializeUIComponents(domElements);
    this.initializeMenuAndEvents();
    await this.initializeLevelAndData();
    this.finalizeInitialization();
}

// Приватные методы
initializeConfiguration()        // Конфигурация
initializeDOMElements()          // DOM элементы + валидация
initializeRenderer(canvas)       // Canvas + context menu
initializeUIComponents(elements) // UI панели + регистрация
initializeMenuAndEvents()        // Меню + события
initializeLevelAndData()         // Preload + indices
finalizeInitialization()         // Render + save state
```

#### undo()/redo() - 6 общих приватных методов
**Файл**: `src/core/LevelEditor.js`

```javascript
// Основные методы (160+85 строк → 10+10 строк)
undo() {
    const state = this.historyManager.undo();
    if (!state) return;
    this._restoreObjectsFromHistory(state.objects);
    this._rebuildAllIndices();
    this._restoreGroupEditMode(state.groupEditMode);
    this._recalculateGroupBounds();
    this._invalidateCachesAfterRestore();
    this._restoreSelection(state.selection);
    this._finalizeUndoRedo();
}

// Приватные методы
_restoreObjectsFromHistory(objectsData)  // Десериализация
_rebuildAllIndices()                     // Objects/Layer/Spatial
_restoreGroupEditMode(savedMode)         // Группы
_recalculateGroupBounds()                // Границы
_invalidateCachesAfterRestore()          // Кеши
_restoreSelection(selectionData)         // Выделение
_finalizeUndoRedo()                      // Render + panels
```

**Метрики**:
- Читаемость: +85-90%
- Дублирование: -95% (~150 строк)
- Когнитивная сложность: -80%
- Размер файла: 2914→2693 строк (-7.6%)

---

## Изменения v3.34.0

### Logger - 100% миграция
**Статус**: Все прямые вызовы `console.*` заменены на `Logger.*` (50+ вызовов в 12 файлах)

**Компоненты с Logger:**
- **CanvasRenderer** → `Logger.canvas.*`
- **FileUtils** → `Logger.file.*`
- **AssetManager** → `Logger.asset.*`
- **ConsoleContextMenu** → `Logger.console.*`
- **SettingsPanel** → `Logger.settings.*`
- **DetailsPanel** → `Logger.ui.*`
- **FolderPickerDialog** → `Logger.file.*`
- **Level** → `Logger.level.*` (операции с уровнями и объектами)
- **LayerOperations** → `Logger.layer.*` (операции со слоями)
- **MouseHandlers** → `Logger.mouse.*` (взаимодействие с мышью)
- **DuplicateOperations** → `Logger.duplicate.*` (операции дублирования)

**Новые категории Logger:**
- **LEVEL**: операции с уровнями, объектами и zIndex
- **LAYER**: операции со слоями и их управлением

**Исключения** (fallback механизм):
- `Logger.js` - внутренняя реализация использует console напрямую
- `LevelEditor.log()`, `ConfigManager.log()` - fallback если Logger недоступен

### FileManager - ErrorHandler integration
**Файл**: `src/managers/FileManager.js`

Критичные методы обернуты в `ErrorHandler.tryAsync/try`:

- **`async loadLevel(file)`** - загрузка уровня с автоматической обработкой ошибок
  - Обертка: `ErrorHandler.tryAsync`
  - User message: "Не удалось загрузить уровень. Проверьте формат файла."
  - Возвращает: `Level` или `null`

- **`async loadLevelFromFileInput()`** - загрузка с выбором файла
  - Обертка: `ErrorHandler.tryAsync`
  - Внутри вызывает `loadLevel()` (ошибки обрабатываются там)
  - Возвращает: `Level` или `null`

- **`importLevelData(jsonString)`** - импорт из JSON строки
  - Обертка: `ErrorHandler.try` (sync)
  - User message: "Не удалось импортировать данные уровня. Проверьте формат JSON."
  - Возвращает: `Level` или `null`

- **`async loadAssetLibrary(assetManager)`** - загрузка библиотеки ассетов
  - Обертка: `ErrorHandler.tryAsync`
  - User message: "Не удалось загрузить библиотеку ассетов. Проверьте формат файла."
  - Возвращает: `true` или `false`

**Преимущества ErrorHandler интеграции:**
- Автоматическое логирование всех ошибок
- Понятные сообщения пользователю на русском
- Сохранение истории ошибок для отладки
- Единый стиль обработки ошибок

---

## Изменения v3.33.0

### ErrorHandler - централизованная обработка ошибок
**Файл**: `src/utils/ErrorHandler.js`
- **`init(monitoringService)`** - инициализация с глобальными перехватчиками
- **`handle(error, context)`** - обработка ошибки с контекстом и восстановлением
- **`logError(error, source, metadata)`** - логирование ошибки без показа пользователю
- **`getErrorHistory()`** - получение истории последних 100 ошибок
- **`getStatistics()`** - статистика: total, totalErrors, byType, recentErrors
- **`clearHistory()`** - очистка истории
- **`try(fn, fallback, context)`** - обертка sync функции с обработкой ошибок
- **`tryAsync(fn, fallback, context)`** - обертка async функции с обработкой ошибок
- **`registerStrategy(errorType, strategy)`** - регистрация стратегии восстановления
- **Custom Errors**: NetworkError, ValidationError, PermissionError, FileNotFoundError

### ComponentLifecycle - управление жизненным циклом
**Файл**: `src/core/ComponentLifecycle.js`
- **`register(name, component, options)`** - регистрация компонента (options: priority 1-10, requiresDestroy)
- **`destroy(name)`** - уничтожение компонента по имени
- **`destroyAll()`** - уничтожение всех в порядке приоритетов (от большего к меньшему)
- **`components`** - Map зарегистрированных компонентов

### LevelEditor.destroy() - полная очистка редактора
**Файл**: `src/core/LevelEditor.js`
- **`destroy()`** - уничтожение всех компонентов, очистка кешей, менеджеров, event listeners

### Component destroy() методы
Все UI компоненты теперь имеют метод `destroy()`:
- **AssetPanel, DetailsPanel, OutlinerPanel, LayersPanel, SettingsPanel**
- **ActorPropertiesWindow, Toolbar, MenuManager, CanvasRenderer**
- **EventHandlers** - остановка render loop, удаление всех listeners

## Изменения v3.31.0

### Custom Dialog System - новая система кастомных диалогов
**Файл**: `src/ui/FolderPickerDialog.js`
- **`constructor()`** - инициализация диалога выбора папки
- **`show()`** - отображение диалога и возврат выбранной папки
- **`createDialog()`** - создание HTML структуры диалога
- **`browseFolder(pathInput)`** - выбор папки через File System Access API
- **`handleDragDrop(items, pathInput)`** - обработка Drag & Drop
- **`getFilesFromDirectory(directoryHandle, path)`** - получение файлов из папки
- **`getFilesFromEntry(entry, path)`** - получение файлов из FileSystemEntry
- **`updatePathDisplay(pathInput, fullPath)`** - обновление отображения пути
- **`updateSummary()`** - обновление статистики импорта
- **`confirm(pathInput)`** - подтверждение выбора
- **`cancel()`** - отмена выбора

**Файл**: `src/ui/UniversalDialog.js`
- **`constructor(title, message, type)`** - инициализация универсального диалога
- **`static alert(message)`** - статический метод для alert
- **`static confirm(message)`** - статический метод для confirm
- **`static prompt(message, defaultValue)`** - статический метод для prompt
- **`createDialog()`** - создание HTML структуры диалога
- **`show()`** - отображение диалога
- **`close()`** - закрытие диалога

**Файл**: `src/utils/DialogReplacer.js`
- **`replace()`** - замена браузерных диалогов на кастомные

### AssetImporter - обновленная утилита импорта ассетов
**Файл**: `src/utils/AssetImporter.js`
- **`constructor(assetManager)`** - инициализация с AssetManager
- **`importFromFolder(folderPath)`** - основной метод импорта ассетов из папки
- **`checkFolderAccess(folderPath)`** - проверка доступности папки
- **`scanFolderStructure(folderPath)`** - анализ структуры папок для определения категорий
- **`scanCategoryFolder(categoryPath, categoryName)`** - сканирование конкретной категории
- **`generateMockAssetsForCategory(categoryName)`** - генерация тестовых ассетов для категории
- **`importAssetsFromStructure(structure, basePath)`** - импорт ассетов по структуре
- **`importCategory(category, basePath)`** - импорт отдельной категории ассетов
- **`updateAssetManagerCategories(categories)`** - обновление категорий в AssetManager
- **`capitalizeFirst(str)`** - утилита для капитализации строк
- **`showFolderPicker()`** - выбор папки пользователем (mock-реализация)

### AssetManager - расширенная функциональность
**Файл**: `src/managers/AssetManager.js`
- **`constructor(stateManager = null)`** - инициализация с StateManager
- **`addExternalAsset(assetData)`** - добавление внешнего ассета в коллекцию
- **`updateStateManagerCategories()`** - синхронизация категорий с StateManager
- **`clearExternalAssets()`** - очистка импортированных ассетов
- **`getCategories()`** - получение списка всех категорий (включая импортированные)

### LevelEditor - интеграция импорта ассетов
**Файл**: `src/core/LevelEditor.js`
- **`importAssets()`** - новый метод для импорта внешних ассетов
- **`static VERSION = '3.30.2'`** - обновление версии

### StateManager - управление категориями ассетов
**Файл**: `src/managers/StateManager.js`
- **`assetTabOrder`** - новое состояние для управления порядком табов ассетов
- **`updateComponentStatus(component, ready)`** - обновление статуса компонентов
- **`areComponentsReady(components)`** - проверка готовности компонентов

## Изменения v3.30.0

### ValidationUtils v2.0 - StateManager-based валидация
**Файл**: `src/utils/ValidationUtils.js`
- **`getStateManager(levelEditor, context)`** - получение StateManager с fallback логикой
- **`getLevelEditor(levelEditor, context)`** - получение levelEditor с fallback на window.editor
- **`hasRequiredComponents(levelEditor, components, context)`** - проверка компонентов через StateManager
- **`updateComponentStatus(levelEditor, component, ready)`** - обновление статуса компонентов
- **`getCachedValidation(levelEditor, key)`** - получение кэшированных результатов валидации
- **`setCachedValidation(levelEditor, key, value, ttl)`** - сохранение результатов с TTL
- **`validateWithCache(levelEditor, key, value, validator, ttl)`** - валидация с кэшированием
- **`clearExpiredCache(levelEditor)`** - очистка устаревших записей кэша
- **`validateNumeric(value, name, min, max)`** - валидация числовых значений с ограничениями
- **`validateFontScale(value)`** - специфическая валидация font scale (0.1-5.0)
- **`validateSpacingScale(value)`** - специфическая валидация spacing (0-5.0)
- **`validateBoolean(value, name)`** - валидация булевых значений
- **`validateString(value, name, maxLength)`** - валидация строк с ограничениями длины
- **`safeGet(obj, path, fallback)`** - безопасный доступ к свойствам с fallback
- **`logValidation(context, action, value, success)`** - консистентное логирование через Logger API

### StateManager - расширенная функциональность валидации
**Файл**: `src/managers/StateManager.js`
- **`validation`** - новое состояние для отслеживания валидации и компонентов
- **`updateComponentStatus(component, ready)`** - обновление статуса готовности компонентов
- **`areComponentsReady(components)`** - проверка готовности нескольких компонентов
- **`setLevelEditorReady(ready)`** - установка статуса готовности levelEditor
- **`getValidationCache(key)`** - получение кэшированных результатов валидации
- **`setValidationCache(key, value, ttl)`** - сохранение результатов с TTL
- **`clearExpiredValidationCache()`** - очистка устаревших записей кэша

### SettingsSyncManager - обновлен для ValidationUtils v2.0
**Файл**: `src/utils/SettingsSyncManager.js`
- **StateManager Integration** - использование новой системы валидации через StateManager
- **Component Status Tracking** - автоматическое обновление статуса компонентов
- **Enhanced Error Handling** - улучшенная обработка ошибок с Logger API
- **Performance Optimization** - использование кэширования для повышения производительности

## Изменения v3.29.0

### ValidationUtils - новая утилита валидации
**Файл**: `src/utils/ValidationUtils.js`
- **`getLevelEditor(levelEditor, context)`** - получение levelEditor с fallback на window.editor
- **`validateNumeric(value, name, min, max)`** - валидация числовых значений с ограничениями
- **`validateFontScale(value)`** - специфическая валидация font scale (0.1-5.0)
- **`validateSpacingScale(value)`** - специфическая валидация spacing (0-5.0)
- **`validateBoolean(value, name)`** - валидация булевых значений
- **`validateString(value, name, maxLength)`** - валидация строк с ограничениями длины
- **`hasRequiredComponents(levelEditor, components, context)`** - проверка наличия компонентов
- **`safeGet(obj, path, fallback)`** - безопасный доступ к свойствам с fallback
- **`logValidation(context, action, value, success)`** - консистентное логирование

### SettingsSyncManager - рефакторинг с ValidationUtils
**Файл**: `src/utils/SettingsSyncManager.js`
- **Устранение дублирования** - все методы используют ValidationUtils вместо inline проверок
- **Улучшенная надежность** - централизованная валидация с fallback механизмами
- **Консистентное логирование** - единообразные сообщения об ошибках
- **Упрощенное сопровождение** - изменения в логике валидации в одном месте

### SettingsPanel - рефакторинг с ValidationUtils
**Файл**: `src/ui/SettingsPanel.js`
- **`updateSliderDisplay()`** - использует ValidationUtils.validateNumeric()
- **`setupSettingsInputs()`** - использует ValidationUtils для валидации атрибутов
- **Улучшенная обработка ошибок** - консистентные сообщения об ошибках

## Изменения v3.28.0

### MenuManager v3.30.1 - улучшенная обработка курсора
- **`hoverModeEnabled`** - глобальный флаг для управления hover-режимом
- **`setupMenuContainerHoverReset()`** - настройка сброса hover-режима при выходе курсора
- **Умная активация** - hover-режим включается только после первого клика
- **Автоматическое закрытие** - все меню закрываются при выходе курсора за пределы контейнера
- **Расширенная область hover** - невидимый padding перекрывает зазор между кнопкой и меню
- **Мгновенная реакция** - убрана система задержек, меню реагирует сразу
- **Устранение зазоров** - CSS `mt-0` и `paddingTop: '8px'` для надежной навигации

### SettingsSyncManager - улучшенная синхронизация
- **Защита от циклов** - система `syncing` Set предотвращает бесконечные обновления
- **Интерактивные настройки** - мгновенное применение изменений Font Size и Spacing
- **CSS Custom Properties** - динамическое обновление `--font-scale` и `--spacing-scale`
- **Централизованное состояние** - StateManager как единый источник истины

### SettingsPanel - исправленный поток сброса
- **Правильный порядок** - ConfigManager → StateManager → UI → сохранение
- **Grid Settings Integration** - перенос "Show Grid" в секцию "Grid & Snapping"
- **AutoSave Configuration** - отключение по умолчанию, интервал в минутах
- **Logger Integration** - добавлен импорт Logger для корректной работы

### CSS Custom Properties - динамическое масштабирование
- **`--font-scale`** - масштабирование шрифтов с минимальными значениями
- **`--spacing-scale`** - масштабирование отступов для всех UI элементов
- **Минимальные значения** - защита от слишком маленьких размеров (0.125 для spacing, 0.5 для font)

## Изменения v3.27.0

### AssetPanel - исправление подсветки селекции
- **CSS Architecture Compliance** - устранены все inline-стили, используются только CSS-классы
- **Selection Visual Consistency** - унифицированы стили селекции для Grid, List и Details режимов
- **HoverEffects Integration** - исправлена работа с CSS-классами, сохранение селекции при уводе курсора
- **Empty Space Click** - корректный сброс селекции при клике в пустое место

### HoverEffects - исправление сохранения селекции
- **`removeHoverEffect()`** - исправлен для сохранения классов селекции при восстановлении стилей
- **Selection Classes Preservation** - добавлена логика сохранения `selected`, `active`, `bg-blue-600` классов

### CSS Classes - унификация стилей селекции
- **`.asset-list-item.selected`** - добавлены стили для List режима
- **`.asset-details-row.selected`** - добавлены стили для Details режима
- **`.asset-thumbnail.selected`** - улучшены стили для Grid режима с box-shadow

## Изменения v3.25.0

### ConsoleContextMenu - полный рефакторинг
- **Наследование от BaseContextMenu** - унифицирована архитектура контекстных меню
- **Fixed positioning** - контекстное меню теперь позиционируется относительно viewport
- **Console overlay integration** - полная интеграция с оверлеем консоли
- **Force hide functionality** - принудительное скрытие меню при закрытии консоли
- **State synchronization** - синхронизация состояния логирования между компонентами

### Console Overlay - улучшения
- **Height persistence** - исправлено сохранение размера консоли в пользовательских настройках
- **Resize functionality** - восстановлена возможность изменения размера консоли
- **State synchronization** - исправлен рассинхрон состояния при рестарте
- **Context menu positioning** - контекстное меню появляется под курсором

## Изменения v3.24.0

### CSS Architecture - полная реорганизация
- **Модульная структура** - все стили разделены по компонентам в папке `styles/`
- **Устранение inline стилей** - убраны все inline стили из HTML и JavaScript
- **Унифицированные классы** - консистентные имена классов для форм и компонентов
- **CSS переменные** - добавлены глобальные переменные для accent-color и font-scale
- **HoverEffects utility** - централизованная система hover эффектов

### HoverEffects - новая утилита
**Файл**: `src/utils/HoverEffects.js`
- **`setupHoverListeners()`** - настройка hover эффектов с поддержкой исключений
- **`applyHoverEffect()`** - применение эффектов (brightness, background, color)
- **`removeHoverEffect()`** - восстановление оригинальных стилей
- **`setupColorHover()`** - специализированные hover эффекты для цветовых индикаторов
- **`setupGridItemHover()`** - hover эффекты для элементов сетки
- **`setupListItemHover()`** - hover эффекты для элементов списка

### GridSettings - обновление классов
- **HTML структура** - обновлена для использования унифицированных CSS классов
- **`settings-form-group`** - замена `form-group` на стандартные классы
- **`settings-input`** - замена `setting-input` на стандартные классы
- **`settings-label`** - замена `label` на стандартные классы

### LayersPanel - интеграция HoverEffects
- **`createLayerElement()`** - интеграция с HoverEffects utility
- **`setupColorHover()`** - hover эффекты для цветовых индикаторов слоев
- **`setupListItemHover()`** - hover эффекты для элементов слоев
- **Устранение дублирования** - убрана ручная hover логика

### AssetPanel - интеграция HoverEffects
- **`createAssetThumbnail()`** - интеграция с HoverEffects utility
- **`addMarqueeHighlight()`** - использование HoverEffects для подсветки
- **`removeMarqueeHighlight()`** - использование HoverEffects для восстановления

### Global Styles - глобальные стили
**Файл**: `styles/main.css`
- **`input[type="checkbox"]`** - глобальные стили для чекбоксов с accent-color
- **`input[type="radio"]`** - глобальные стили для радио кнопок
- **`input[type="range"]`** - глобальные стили для слайдеров
- **`:root`** - CSS переменные для accent-color и font-scale

### Tab Styles Unification - унификация стилей табов
**Файлы**: `styles/main.css`, `styles/panels.css`, `src/ui/AssetPanel.js`, `index.html`
- **`.tab, .tab-right`** - унифицированные стили для всех табов в приложении
- **Единообразный внешний вид** - одинаковые padding, font-size, hover эффекты
- **Активные состояния** - синяя нижняя граница для активных табов
- **Устранение дублирования** - убраны inline классы и дублирующиеся стили
- **AssetPanel.js** - упрощены классы табов до базового `.tab` + `.active`
- **index.html** - убраны дублирующиеся классы из HTML табов

## Изменения v3.21.0

### AssetPanel - исправление шапки в режиме Details View

- **`renderDetailsView()`** - исправлено позиционирование шапки с колонками атрибутов
- **Sticky header** - шапка теперь правильно позиционируется встык с табами и следует за горизонтальным скроллом
- **Улучшенная структура** - упрощена структура контейнеров для надежного sticky позиционирования
- **Очистка временных файлов** - удалены временные файлы из папки tmp/

### HexagonalGridRenderer - кардинальная оптимизация
- **`constructor()`** - обновлен лимит `maxHexagonsThreshold` до 4500 гексагонов
- **`render()`** - добавлена проверка плотности с отключением грида при превышении лимита
- **`calculateGridParameters()`** - оптимизирован расчет перехлеста на основе радиуса гексагона
- **`drawHexagonalGridSimple()`** - упрощенный рендеринг без сложной LOD системы
- **`addHexagonLinesSimple()`** - прямой расчет вершин гексагонов без шаблонов

### ConfigManager - расширенные лимиты
- **`validateSetting()`** - увеличен лимит `gridSize` с 128 до 512px
- **Валидация canvas.gridSize** - теперь принимает значения от 8 до 512

### GridSettings - улучшенная валидация
- **HTML input** - добавлен `oninput` для автоматического ограничения ввода
- **`max="512"`** - увеличен максимальный размер грида в интерфейсе
- **Валидация в реальном времени** - `Math.min(512, Math.max(8, parseInt(this.value) || 8))`

### RenderOperations - оптимизация производительности
- **`render()`** - увеличен порог медленных кадров с 16ms до 20ms
- **Убраны отладочные логи** - очищена консоль от спама сообщений

## Изменения v3.19.8

### EventHandlers - исправления View Menu и Game Mode
- **`hideToolbar()`** - добавлен вызов `updateViewCheckbox('toolbar', false)` для синхронизации чекбокса
- **`toggleGameMode(enabled)`** - добавлен вызов `updateViewCheckbox('gameMode', enabled)` и `closeAllDropdowns()`
- **`restorePanelToggleStates()`** - добавлены вызовы `applyPanelVisibility()` для корректного восстановления панелей
- **`restorePanelStates()`** - добавлены проверки на null перед обращением к `style` свойствам
- **Порядок вызовов** - исправлен порядок: `restorePanelToggleStates()` вызывается до `restorePanelStates()`

### MenuManager - улучшения
- **`closeAllDropdowns()`** - используется для закрытия меню View при отключении Game Mode

## Изменения v3.19.4

### DiamondGridRenderer - исправления отрисовки

- **`drawDiamondLines(camera, viewportLeft, viewportTop, viewportRight, viewportBottom)`** - добавлен параметр `camera` для корректировки spacing
- **Корректировка spacing:** `diamondSpacing = gridSize / Math.sqrt(camera.zoom)` для правильной плотности при разных зумах
- **Полное покрытие viewport:** расчет диапазона линий с учетом всех 4 углов viewport (top-left, top-right, bottom-left, bottom-right)
- **Оптимизированные пересечения:** улучшенный алгоритм расчета точек пересечения линий с границами видимости

## Изменения v3.19.3

### BaseContextMenu - исправления позиционирования и сепараторов
- **`createMenuItem(item, contextData)`** - добавлена обработка `type: 'separator'` и `disabled` состояний
- **`addSeparatorWithClass(className)`** - добавлен метод для сепараторов с CSS классами
- **`calculateOptimalPosition(event, menu)`** - улучшено позиционирование с учетом границ панели
- **Унифицированные сепараторы** - единый стиль для всех контекстных меню
- **Поддержка disabled состояний** - отображение недоступных команд как неактивных

### Toolbar - исправления контекстного меню
- **`addGridTypeMenuItems()`** - исправлена логика вставки элементов перед Settings
- **`clearGridTypeMenuItems()`** - исправлена очистка только элементов гридов
- **`setupGridContextMenu()`** - Settings добавляется первым для стабильного порядка

## Изменения v3.19.2

### Toolbar - карусельное переключение типов гридов
- **Ctrl+Click на кнопке Grid** - переключение между типами сетки (Rectangular, Diamond, Hexagonal)
- **Динамические иконки** - иконка кнопки Grid меняется в зависимости от выбранного типа
- **Автоматическое определение типов** - система автоматически подхватывает доступные рендереры
- **Сохранение выбранного типа** - выбранный тип грида сохраняется в пользовательских настройках
- **Гибкая архитектура** - код автоматически адаптируется к изменениям в списке рендереров

### Toolbar - новые методы
- **initializeGridTypes()** - динамическая инициализация типов гридов из доступных рендереров
- **refreshGridTypes()** - обновление списка типов при изменении рендереров
- **cycleGridType()** - переключение на следующий тип грида
- **updateGridButtonIcon()** - обновление иконки кнопки Grid
- **gridTypeConfig** - Map с конфигурацией иконок и названий для каждого типа

### GridRenderers - расширенная поддержка
- **Автоматическое обнаружение** - Toolbar автоматически находит доступные рендереры
- **Конфигурируемые иконки** - легко настраиваемые иконки для каждого типа грида
- **Fallback система** - graceful обработка отсутствующих рендереров

## Изменения v3.18.0

### SnapUtils - новая система снэпа
- **findNearestGridPoint()** - централизованный метод поиска ближайшей точки грида
- **Адаптивный tolerance** - настраиваемая зона притяжения (5-100% от размера грида)
- **Единая логика** - консистентное поведение для всех операций снэпа

### UserPreferencesManager - расширенные настройки
- **snapTolerance** - настройка зоны притяжения к сетке с сохранением в localStorage
- **Автоматическая синхронизация** - между grid и canvas конфигурациями

### DuplicateOperations - улучшенный снэп
- **Правильная точка привязки** - левый нижний угол первого объекта попадает в точку грида
- **Единая логика снэпа** - используется та же логика, что и в dragSelectedObjects
- **Консистентное поведение** - preview и финальное размещение идентичны

### MouseHandlers - оптимизация
- **Кеширование позиций** - избежание повторных вычислений мировых координат
- **Улучшенная производительность** - оптимизированы операции перетаскивания

## Изменения v3.17.0

### Console - новый функционал выделения текста
- **Выделение строк** - левый клик-драг для выделения текста в консоли
- **Контекстное меню** - правый клик для копирования выделенного текста
- **Клавиатурные сочетания** - Ctrl+A для выделения всей строки, Escape для снятия выделения
- **Двойной клик** - выделение всей строки одним кликом
- **Визуальная обратная связь** - синяя полоса и фон для выделенных строк
- **Оптимизированная производительность** - throttling и кэширование для предотвращения фризов

### ConsoleContextMenu - улучшения
- **Умное определение выделения** - автоматически определяет выделенный текст
- **Защита от сброса выделения** - предотвращает потерю выделения при взаимодействии с меню
- **Оптимизированные обработчики событий** - улучшена производительность

### RenderOperations - исправления
- **Исправлена ошибка levelId** - добавлено определение levelId в buildSpatialIndex()
- **Улучшена стабильность** - устранены ошибки при построении пространственного индекса

## Изменения v3.16.0

### Toolbar - улучшения панорамирования
- **Панорамирование средней кнопкой мыши работает на всем тулбаре** - включая активные и неактивные кнопки
- **Убрано "прилипание" курсора** - теперь обычное панорамирование в противоположном направлении движению курсора
- **Исправлено поведение на неактивных кнопках** - pointer-events: none позволяет событиям проходить сквозь disabled кнопки
- **Результат:** единообразное поведение панорамирования во всех областях тулбара

## Изменения v3.15.0

### Toolbar - улучшения интерфейса и производительности
- **setVisible()** - добавлен автоматический вызов resizeCanvas() и render() при изменении видимости toolbar
- **hideToolbar()** - добавлено закрытие контекстного меню после скрытия toolbar
- **Убрано лишнее логирование** - оптимизирована производительность за счет удаления избыточных debug-сообщений
- **Результат:** canvas корректно адаптируется к изменениям видимости toolbar, улучшен пользовательский опыт

### CommandAvailability - новый модуль проверки команд (v3.15.0)
- **CommandAvailability** - утилитарный класс для централизованной проверки доступности команд
- **getContext(levelEditor)** - сбор контекстной информации (выделение, группы, история)
- **check(command, levelEditor)** - проверка доступности конкретной команды
- **Методы проверки состояния:**
  - `hasSelectedObjects()` - проверка наличия выделенных объектов
  - `hasMultipleSelectedObjects()` - проверка множественного выделения
  - `isSelectedObjectGroup()` - проверка, является ли выделенный объект группой
  - `canUndo()` / `canRedo()` - проверка доступности операций истории
  - `canPaste()` - проверка возможности вставки
- **Результат:** единая логика проверки команд, устранение дублирования кода

## Изменения v3.14.0

### Toolbar - полная система сохранения настроек
- **Полная система сохранения пользовательских настроек тулбара** - состояния кнопок, секций, отображения и позиции скролла
- **Запоминание состояния кнопок тулбара** - Grid, Snap, Parallax, Boundaries, Collisions
- **Запоминание свернутых секций тулбара** - File, Edit, View, Group
- **Запоминание настроек отображения** - иконки и текст кнопок
- **Запоминание видимости тулбара** - сохранение состояния show/hide
- **Запоминание позиции скролла** - автоматическое сохранение и восстановление позиции прокрутки
- **Автоматическое сохранение настроек** - в localStorage между сессиями
- **Восстановление всех настроек** - при перезагрузке редактора

### Toolbar - улучшения инициализации
- **Улучшена инициализация тулбара** - отрисовывается сразу в правильном состоянии
- **Устранено визуальное "переключение" тулбара** - при загрузке настроек
- **Оптимизирована система загрузки состояния тулбара** - синхронизация с StateManager
- **Улучшена синхронизация состояния кнопок** - с реальным состоянием функций

### Toolbar - исправления состояний
- **Исправлена проблема с инверсным отображением кнопки Boundaries** - корректное состояние
- **Устранена задержка при переключении состояния кнопок тулбара** - немедленное обновление
- **Исправлена синхронизация визуального состояния** - с реальным состоянием функций

## Изменения v3.13.2

### MouseHandlers - исправление конфликтов средней кнопки мыши
- **handleMouseDown()** - добавлена проверка `if (e.button === 1 && target.closest('#right-panel')) return`
- **handleMouseMove()** - добавлена проверка `if (mouse.isMiddleDown && target.closest('#right-panel')) return`
- **handleMouseUp()** - добавлена проверка `if (e.button === 1 && target.closest('#right-panel')) return`
- **Результат:** полная изоляция обработки средней кнопки мыши между canvas (zoom) и панелями (scroll)

## Изменения v3.13.1

### ObjectOperations
- **Новый метод `isObjectInGroupRecursive(obj, group)`** - рекурсивная проверка принадлежности объекта к группе, включая вложенные группы
- **Параметры:** `obj` (Object) - объект для проверки, `group` (Object) - группа для проверки
- **Возвращает:** `boolean` - true если объект находится в группе или любой подгруппе

### Level
- **Новый метод `addGroupObjectsToIndex(group)`** - рекурсивно добавляет все объекты группы в индекс с правильным topLevelParent
- **Параметры:** `group` (Object) - группа, объекты которой нужно добавить в индекс
- **Использование:** автоматически вызывается при создании групп через Shift+G

### GroupOperations
- **Улучшена индексация при создании групп** - после создания группы вызывается `addGroupObjectsToIndex()` для корректной индексации дочерних объектов

### MouseHandlers
- **Обновлена логика `dragSelectedObjects()`** - использует `isObjectInGroupRecursive()` для корректного определения принадлежности объектов к редактируемым группам

### LayersPanel
- **Исправлены обработчики кликов** - `setupLayersEventListeners()` теперь вызывается в `renderLayersSection()` для корректной установки обработчиков при каждом рендере

### OutlinerPanel
- **Новый state `shiftAnchor`** - точка привязки для shift+click выделения диапазона
- **Обновлена логика `handleShiftClick()`** - использует anchor point вместо последнего выбранного объекта
- **Обновлена логика `handleObjectClick()`** - устанавливает anchor point при обычном клике

### ScrollUtils
- **Рефакторинг системы обработчиков** - глобальные обработчики устанавливаются один раз, контейнеры регистрируются в системе
- **Предотвращение конфликтов** - устранено дублирование обработчиков между панелями
- **Новые статические переменные:**
  - `globalMouseMoveHandler` - единый обработчик движения мыши
  - `globalMouseUpHandler` - единый обработчик отпускания кнопки мыши
  - `activeContainers` - Map активных контейнеров с их конфигурациями
  - `isGlobalHandlersSetup` - флаг установки глобальных обработчиков

## Изменения v3.9.0

### OutlinerPanel
- **Новая система поиска** - интеграция с SearchUtils для унифицированного поиска
- **Улучшенное контекстное меню** - новый класс OutlinerContextMenu с правильной очисткой обработчиков
- **Новая логика выделения** - Shift+клик для диапазона, Ctrl+клик для переключения
- **Поддержка фильтрованного выделения** - выделение работает с отфильтрованным списком при поиске
- **Исправлено переименование** - стиль переименования приведен в соответствие с LayersPanel
- **Исправлено позиционирование иконок** - иконки типов объектов правильно выровнены
- **Новые методы:**
  - `handleShiftClick(obj, selectedObjects)` - выделение диапазона объектов
  - `handleCtrlClick(obj, selectedObjects)` - переключение единичного объекта
  - `getFlatObjectList()` - получение плоского списка объектов в порядке отображения
  - `addObjectsToFlatList(objects, flatList)` - рекурсивное добавление объектов в плоский список

### SearchUtils (новый класс)
- **Унифицированная система поиска** - общие методы для поиска в различных панелях
- **Рекурсивный поиск** - поиск по иерархическим структурам объектов
- **Методы:**
  - `createSearchInput(placeholder, id, className)` - создание поля поиска
  - `createSearchContainer(placeholder, id, className)` - создание контейнера поиска
  - `setupSearchListeners(searchInput, onSearch, onClear)` - настройка обработчиков
  - `filterObjects(objects, searchTerm, nameProperty)` - фильтрация плоского массива
  - `filterObjectsRecursive(objects, searchTerm, nameProperty, childrenProperty)` - рекурсивная фильтрация
  - `createSearchResultsInfo(totalFiltered, searchTerm, itemType)` - информация о результатах
  - `focusSearch(id)` - фокус на поле поиска

### OutlinerContextMenu (новый класс)
- **Контекстное меню для OutlinerPanel** - специализированное меню для объектов
- **Правильная очистка обработчиков** - предотвращение накопления обработчиков событий
- **Правильное позиционирование** - использует границы панели, а не внутреннего контейнера
- **Методы:**
  - `extractContextData(target)` - извлечение данных контекста из элемента
  - `showContextMenu(e, contextData)` - показ контекстного меню

### LayersContextMenu (новый класс)
- **Контекстное меню для LayersPanel** - специализированное меню для операций со слоями
- **Правильное позиционирование** - использует границы панели, а не внутреннего контейнера
- **Поддержка disabled состояний** - отображение недоступных команд как неактивных
- **Методы:**
  - `extractContextData(target)` - извлечение данных контекста из элемента слоя
  - `shouldShowMenuItem(item, contextData)` - проверка видимости элементов меню
  - `calculateMenuPosition(e, menu)` - расчет позиции меню

### DuplicateOperations
- **Исправлено создание ID** - reassignIdsDeep теперь создает строковые ID вместо числовых
- **Улучшена индексация** - дублированные объекты в группах теперь добавляются в индекс

### BaseContextMenu
- **Исправлена очистка обработчиков** - добавлено правильное удаление старых обработчиков
- **Улучшено позиционирование** - автоматическая корректировка относительно панели
- **Новые поля:**
  - `contextMenuHandler` - ссылка на обработчик контекстного меню

### LayersPanel
- **Исправлено позиционирование контекстного меню** - использует `container.parentElement` вместо `container`
- **Интеграция с LayersContextMenu** - специализированное контекстное меню для операций со слоями

### OutlinerPanel
- **Исправлено позиционирование контекстного меню** - использует `container.parentElement` вместо `container`
- **Интеграция с OutlinerContextMenu** - специализированное контекстное меню для объектов

### Logger
- **Добавлена поддержка OutlinerPanel** - новый объект `Logger.outliner` для логирования

## Изменения v3.8.7

### MouseHandlers
- **handleObjectClick()** - Alt+Click теперь работает на любых объектах, автоматически выбирая невыбранные

### LayersPanel  
- **showAllLayers()** - добавлена инвалидация кеша и принудительный рендер
- **hideAllLayers()** - добавлена инвалидация кеша и принудительный рендер
- Удалены методы: moveObjectsToMainLayer(), selectAllLayers(), deselectAllLayers(), handleLayerSelection()
- Удалена переменная selectedLayers и связанная логика

### MouseHandlers
- **handleDrop()** - добавлена проверка заблокированности текущего слоя

## Новые функции v3.8.5

### Улучшения инициализации и обработки ошибок (v3.8.5)
- **Улучшенная обработка ошибок при инициализации** - добавлены try-catch блоки для безопасной загрузки
- **Graceful fallback для ассетов** - предупреждения вместо критических ошибок при проблемах с загрузкой
- **Более стабильная инициализация** - защита от сбоев при загрузке компонентов
- **Улучшенное логирование ошибок** - детальная информация о проблемах инициализации

## Новые функции v3.8.4

### Расширенная документация системы кеширования (v3.8.4)
- **Подробное описание системы умного кеширования** - добавлен отдельный раздел с детальным описанием
- **Принципы работы кеширования** - объяснение спецификации инвалидации и автоматического обновления
- **Fallback механизмы** - описание системы восстановления при ошибках кеширования

## Новые функции v3.8.3

### Улучшения операций с группами и дублированием (v3.8.3)
- **Оптимизация групповых операций** - улучшена производительность работы с группами
- **Улучшенное дублирование** - более стабильная система копирования объектов
- **Дополнительные исправления рендеринга** - мелкие улучшения в RenderOperations

## Новые функции v3.8.2

### Дополнительные улучшения рендеринга (v3.8.2)
- **Оптимизация рендеринга групп** - улучшена производительность отрисовки сложных групповых структур
- **Улучшенная обработка границ** - более точный расчет и отображение границ объектов
- **Стабилизация системы рендеринга** - исправлены мелкие баги в RenderOperations

## Новые функции v3.8.0

### Исправление undo для групп (v3.8.0)
- **Полная переработка системы отмены операций с группами** - исправлены критические баги в undo/redo
- **Корректное восстановление состояния групп** - правильная обработка вложенных объектов и иерархии
- **Улучшенная система истории** - более надежное сохранение и восстановление состояний
- **Специализированное логирование** - добавлена категория HISTORY в Logger для отладки операций отмены

**Исправленные методы:**
- `HistoryManager.saveState()` - корректное сохранение состояния групп
- `HistoryManager.undo()` - правильное восстановление групп и их содержимого
- `HistoryManager.redo()` - корректное повторное выполнение операций с группами
- `LevelEditor.undo()` - улучшенная обработка отмены операций с группами
- `LevelEditor.redo()` - исправленное восстановление состояний групп

## Новые функции v3.6.0

### Полная оптимизация производительности (v3.6.0)
- **Кеширование счетчиков слоев** - O(M×N) → O(1) при подсчете объектов в слоях
- **Индекс объектов** - O(N×D) → O(1) при поиске объектов и определении иерархии
- **Исправление типизации объектов** - устранение ошибки `child.toJSON is not a function`

**Новые методы оптимизации:**
- `Level.buildObjectsIndex()` - построение индекса для быстрого поиска
- `Level.findObjectByIdFast(objId)` - поиск объекта за O(1)
- `Level.findTopLevelObjectFast(objId)` - поиск top-level объекта за O(1)
- `Level.isObjectDescendantOfGroupFast(objId, groupId)` - проверка иерархии за O(1)
- `Level.getLayerObjectsCount(layerId)` - кешированный подсчет объектов в слое
- `LevelEditor.batchNotifyObjectPropertyChanged()` - группировка уведомлений об изменении свойств
- `LevelEditor.batchNotifyLayerCountChanged()` - группировка уведомлений о счетчиках слоев
- `LevelEditor.flushBatchedNotifications()` - отправка сгруппированных уведомлений
- `LevelEditor.smartCacheInvalidation()` - умная инвалидация кешей
- `LevelEditor.invalidateAfterLayerChanges()` - инвалидация после изменения слоев
- `LevelEditor.invalidateAfterGroupOperations()` - инвалидация после групповых операций
- `LevelEditor.invalidateAfterDuplicateOperations()` - инвалидация после дублирования
- `RenderOperations.buildSpatialIndex()` - построение пространственного индекса для рендеринга
- `RenderOperations.getVisibleObjectsSpatial()` - быстрый поиск видимых объектов через индекс
- `RenderOperations.getObjectWorldBounds()` - расчет мировых границ объекта

**Исправленные методы:**
- `Asset.createInstance(x, y)` - возвращает `GameObject` вместо `Object`
- `LevelEditor.deepClone(obj)` - сохраняет типы GameObject/Group
- `Level.addObject(obj)` - проверяет и создает правильные экземпляры
- `Group.addChild(child)` - проверяет и создает правильные экземпляры
- `LevelEditor.getCachedObject(objId)` - использует индекс для быстрого поиска

## Система умного кеширования

### Обзор системы кеширования
Редактор использует многоуровневую систему кеширования для оптимизации производительности:

#### 1. Кеширование счетчиков слоев
- **Назначение**: Быстрый подсчет объектов в слоях без перебора всех объектов
- **Производительность**: O(M×N) → O(1) при подсчете объектов в слоях
- **Методы**:
  - `Level.getLayerObjectsCount(layerId)` - получение кешированного количества
  - `Level.updateLayerCountCache(layerId, delta)` - обновление кеша при изменениях
  - `Level.markLayerCountCacheDirty(layerId)` - пометка для пересчета

#### 2. Индекс объектов
- **Назначение**: Быстрый поиск объектов по ID без перебора массива
- **Производительность**: O(N) → O(1) при поиске объектов
- **Методы**:
  - `Level.buildObjectsIndex()` - построение индекса
  - `Level.findObjectByIdFast(objId)` - быстрый поиск по ID
  - `Level.findTopLevelObjectFast(objId)` - поиск top-level объекта
  - `Level.isObjectDescendantOfGroupFast(objId, groupId)` - проверка иерархии

#### 3. Умная инвалидация кешей
- **Назначение**: Селективная инвалидация только измененных данных
- **Производительность**: Ускорение в 10-100× раз при частичных изменениях
- **Методы**:
  - `LevelEditor.smartCacheInvalidation(spec)` - умная инвалидация
  - `LevelEditor.invalidateAfterLayerChanges()` - после изменения слоев
  - `LevelEditor.invalidateAfterGroupOperations()` - после групповых операций
  - `LevelEditor.invalidateAfterDuplicateOperations()` - после дублирования

#### 4. Пространственный индекс для рендеринга
- **Назначение**: Быстрый поиск видимых объектов в области просмотра
- **Производительность**: O(N) → O(log N) при поиске видимых объектов
- **Методы**:
  - `RenderOperations.buildSpatialIndex()` - построение пространственного индекса
  - `RenderOperations.getVisibleObjectsSpatial()` - поиск видимых объектов
  - `RenderOperations.getObjectWorldBounds()` - расчет мировых границ

### Принципы работы умного кеширования

#### Спецификация инвалидации
```javascript
const invalidationSpec = {
    objects: [objId1, objId2],     // Конкретные объекты
    layers: [layerId1, layerId2],  // Конкретные слои
    selectableObjects: true,       // Кеш выбираемых объектов
    invalidateAll: false           // Не полная инвалидация
};
```

#### Автоматическое обновление кешей
- **При добавлении объекта**: обновляется индекс и счетчики слоев
- **При удалении объекта**: инвалидируются связанные кеши
- **При изменении слоя**: обновляются счетчики слоев
- **При групповых операциях**: селективная инвалидация

#### Fallback механизмы
- **Пересчет при ошибке**: автоматический пересчет при повреждении кеша
- **Полная инвалидация**: при критических ошибках
- **Валидация кешей**: проверка целостности данных

### Наследование layerId для групп (v3.5.0)

### Улучшенная система привязки объектов к слоям (v3.4.1)
- **Полная переработка архитектуры изменения слоев** - методы `assignSelectedObjectsToLayer()` и `processObjectForLayerAssignment()`
- **Корректная обработка всех выбранных объектов** - включая вложенные объекты в группах
- **Предотвращение дублирования обработки** - умная система отслеживания обработанных групп
- **Безопасность и надежность** - проверки существования компонентов и fallback логика
- **Специализированное логирование** - добавлена категория LAYER в Logger

**Новые методы:**
- `LevelEditor.assignSelectedObjectsToLayer(selectedObjects, moveUp, moveToExtreme)` - координация изменения слоя
- `LevelEditor.processObjectForLayerAssignment(objId, targetLayerId, processedGroups)` - обработка индивидуального объекта
- `Logger.layer` - объект для логирования операций со слоями

### Принудительное наследование layerId для групп (v3.8.0)
- **Прямая зависимость** - layerId группы = layerId всех детей
- **Принудительное наследование** - дети ВСЕГДА получают layerId от родительской группы
- **Все операции покрыты** - добавление, группировка, перетаскивание, дублирование, изменение слоя
- **Подсчет с учетом вложенных** - getLayerObjectsCount() включает вложенные объекты
- **Рекурсивное распространение** - наследование работает для вложенных групп

**Обновленные методы:**
- `Group.addChild()` - принудительное наследование при добавлении
- `Group.propagateLayerIdToChildren()` - принудительное распространение
- `GroupOperations.groupSelectedObjects()` - наследование при группировке
- `MouseHandlers.dragSelectedObjects()` - наследование при перетаскивании
- `DuplicateOperations.confirmPlacement()` - наследование при дублировании
- `LevelEditor.processObjectForLayerAssignmentOptimized()` - наследование при изменении слоя
- `Level.assignObjectToLayer()` - наследование при прямом назначении
- `Level.getLayerObjectsCount()` - подсчет с учетом вложенных объектов
- `Level.getLayerObjects()` - получение всех объектов включая вложенные

### Улучшенная логика отображения Group/Ungroup (v3.4.0)
- **Group при множественном выделении** - пункт Group отображается при выделении 2+ объектов любого типа
- **Ungroup при наличии групп** - пункт Ungroup отображается при наличии хотя бы одной группы в выделении
- **Одновременное отображение** - Group и Ungroup могут показываться одновременно
- **Упрощенная логика** - удалены ненужные ограничения на комбинации пунктов меню
- **Подробное логирование** - детальная информация о состоянии выделения для отладки

### Непрерывный мониторинг позиции курсора во время анимации (v3.3.0)
- **Мониторинг в реальном времени** - позиция курсора отслеживается каждый кадр во время анимации
- **Немедленное закрытие при выходе** - меню закрывается сразу если курсор вышел за границы
- **Надежная защита от быстрых движений** - предотвращает все проблемы с резким движением курсора
- **Автоматическое завершение мониторинга** - мониторинг останавливается после завершения анимации
- **Оптимизированная производительность** - использует requestAnimationFrame для эффективного мониторинга

### Умное позиционирование курсора (v3.1.0)
- **Автоматическое позиционирование меню** - меню корректирует позицию, чтобы курсор оказался внутри
- **Защита от преждевременного закрытия** - предотвращает mouseleave при открытии меню
- **Универсальная поддержка** - работает для всех типов контекстных меню (Canvas, Console)
- **Настраиваемое смещение** - 2px отступ от краев меню для надежности
- **Упрощенное закрытие на mouseleave** - меню закрывается при уводе курсора за границы
- **Очистка памяти** - автоматическая очистка обработчиков событий

### Централизованная система управления контекстными меню (v2.7.0)
- **ContextMenuManager** - единый менеджер для всех контекстных меню
- **Автоматическое закрытие конфликтующих меню** - только одно меню активно одновременно
- **Предотвращение показа меню после панорамирования** - интеллектуальное определение движений
- **Синхронизация состояний между компонентами** - устранение race conditions
- **Глобальная блокировка стандартного меню браузера** - чистый UX

### Интерактивный зум средней кнопкой мыши (v2.6.9)
- **Средняя кнопка мыши** - интерактивный зум с фиксацией точки
- **Визуальная обратная связь** - курсор zoom-in при активации
- **Точный контроль зума** - зум происходит относительно точки нажатия
- **Интеграция с камерой** - полная совместимость с существующей системой камеры

## Новые функции v2.6.8

### Улучшения горячих клавиш (v2.6.1-2.6.2)
- **Перехват браузерных комбинаций** - предотвращение конфликтов с браузером
- **Выравнивание подсказок** - клавиши выровнены по правому краю меню
- **Детальная отладка** - логирование для диагностики проблем

### Автосохранение View настроек (v2.6.3)
- **Сохранение состояний** - View настройки сохраняются между сессиями
- **Автоматическое применение** - настройки восстанавливаются при создании/открытии уровней

### Валидация Player Start (v2.6.4-2.6.5)
- **Проверка перед сохранением** - обязательная валидация Player Start
- **Автосоздание** - автоматическое создание Player Start при отсутствии
- **Предупреждения** - информативные сообщения об ошибках

### Оптимизация производительности (v2.6.6)
- **Кеширование статистики** - быстрая проверка состояния уровня
- **Единый источник данных** - оптимизированные запросы к статистике

### Стабильные рамки границ (v2.6.7-2.6.8)
- **Корректный расчет границ** - группы учитывают все дочерние объекты
- **Синхронизация с selection** - рамки object boundaries совпадают с selection
- **Стабильность при зуме** - рамки не смещаются при изменении масштаба

## Модели данных

### GameObject

Базовый класс для всех игровых объектов.

#### Конструктор

```javascript
new GameObject(data = {})
```

**Параметры:**
- `data` (Object) - данные объекта

**Свойства:**
- `id` (string) - уникальный идентификатор
- `name` (string) - имя объекта
- `type` (string) - тип объекта
- `x` (number) - координата X
- `y` (number) - координата Y
- `width` (number) - ширина
- `height` (number) - высота
- `color` (string) - цвет объекта
- `imgSrc` (string|null) - путь к изображению
- `visible` (boolean) - видимость объекта
- `locked` (boolean) - заблокированность объекта
- `properties` (Object) - дополнительные свойства

#### Методы

##### `getBounds()`

Возвращает границы объекта.

**Возвращает:** `Object` - объект с полями `minX`, `minY`, `maxX`, `maxY`

##### `containsPoint(x, y)`

Проверяет, содержит ли объект точку.

**Параметры:**
- `x` (number) - координата X точки
- `y` (number) - координата Y точки

**Возвращает:** `boolean`

##### `clone()`

Создает копию объекта с новым ID.

**Возвращает:** `GameObject`

##### `toJSON()`

Сериализует объект в JSON.

**Возвращает:** `Object`

##### `fromJSON(data)`

Создает объект из JSON данных.

**Параметры:**
- `data` (Object) - данные объекта

**Возвращает:** `GameObject`

### Group

Класс для группировки объектов.

#### Конструктор

```javascript
new Group(data = {})
```

**Наследует от:** `GameObject`

**Дополнительные свойства:**
- `children` (Array) - массив дочерних объектов

#### Методы

##### `addChild(child)`

Добавляет дочерний объект в группу.

**Параметры:**
- `child` (GameObject|Group|Object) - дочерний объект

**Особенности v3.6.0:**
- Автоматически проверяет тип дочернего объекта
- Если передан plain object, создает правильный экземпляр GameObject/Group
- Обеспечивает корректную типизацию всех объектов в group.children
- Предотвращает ошибку `child.toJSON is not a function`

##### `removeChild(childId)`

Удаляет дочерний объект из группы.

**Параметры:**
- `childId` (string) - ID дочернего объекта

##### `getAllChildren()`

Возвращает все дочерние объекты рекурсивно.

**Возвращает:** `Array<GameObject>`

##### `getBounds()`

Возвращает границы группы включая все дочерние объекты.

**Возвращает:** `Object`

### GroupOperations (Core Module)

Основной модуль для работы с группами объектов.

##### `removeEmptyGroup(targetGroup)`

Удаляет конкретную группу, если она пуста или содержит только один дочерний объект.

**Параметры:**
- `targetGroup` (Group) - группа для проверки и потенциального удаления

**Возвращает:** `boolean` - true, если группа была удалена

**Особенности:**
- Проверяет только переданную группу, а не все пустые группы на уровне
- Группа удаляется если в ней 0 или 1 объект
- При удалении группы с одним объектом, объект автоматически извлекается из группы и перемещается на основной уровень
- Защищает группы, находящиеся в режиме редактирования
- Работает с группами любого уровня вложенности
- Автоматически вызывается при операциях drag & drop, удаления объектов и закрытия режима редактирования
- Использует оптимизированную логику без дублирования кода

##### `extractObjectFromGroup(group, childObject)`

Извлекает объект из группы и перемещает его на основной уровень.

**Параметры:**
- `group` (Group) - группа, содержащая объект
- `childObject` (GameObject) - объект для извлечения из группы

**Возвращает:** `boolean` - true, если объект был успешно извлечен

**Особенности:**
- Автоматически конвертирует координаты объекта в мировые координаты
- Сохраняет состояние в истории для возможности отмены
- Очищает кэши рендеринга для извлеченного объекта
- Использует ту же логику, что и MouseHandlers для консистентности
- Все извлеченные объекты перемещаются на основной уровень (не в родительскую группу)

**Пример использования:**
```javascript
const wasRemoved = editor.groupOperations.removeEmptyGroup(someGroup);
if (wasRemoved) {
    editor.updateAllPanels(); // Обновить интерфейс
}
```

##### `removeEmptyGroups()`

Удаляет все пустые группы или группы с одним дочерним объектом на уровне.

**Возвращает:** `boolean` - true, если какие-либо группы были удалены

**Особенности:**
- Группа удаляется если в ней 0 или 1 объект
- При удалении группы с одним объектом, объект автоматически извлекается из группы и перемещается на основной уровень
- Защищает группы, находящиеся в режиме редактирования
- Работает рекурсивно с группами любого уровня вложенности
- Автоматически вызывается при удалении объектов
- Использует оптимизированную логику без дублирования кода

### Layer

Модель слоя уровня.

#### Конструктор

```javascript
new Layer(data = {})
```

**Свойства:**
- `id` (string) - уникальный идентификатор
- `name` (string) - имя слоя
- `visible` (boolean) - видимость слоя
- `locked` (boolean) - заблокированность слоя
- `order` (number) - порядок отображения
- `color` (string) - цвет индикатора слоя

#### Методы

##### `toggleVisibility()`

Переключает видимость слоя.

##### `toggleLock()`

Переключает состояние блокировки слоя.

##### `setName(name)`

Устанавливает имя слоя.

**Параметры:**
- `name` (string) - новое имя слоя

##### `setOrder(order)`

Устанавливает порядок слоя.

**Параметры:**
- `order` (number) - новый порядок

##### `toJSON()`

Сериализует слой в JSON.

**Возвращает:** `Object`

##### `fromJSON(data)`

Создает слой из JSON данных.

**Параметры:**
- `data` (Object) - данные слоя

**Возвращает:** `Layer`

##### `clone()`

Создает копию слоя с новым ID.

**Возвращает:** `Layer`

### Asset

Модель ассета в библиотеке.

#### Конструктор

```javascript
new Asset(data = {})
```

**Свойства:**
- `id` (string) - уникальный идентификатор
- `name` (string) - имя ассета
- `type` (string) - тип ассета
- `category` (string) - категория ассета
- `width` (number) - ширина
- `height` (number) - высота
- `color` (string) - цвет
- `imgSrc` (string|null) - путь к изображению
- `properties` (Object) - дополнительные свойства
- `tags` (Array) - теги для поиска

#### Методы

##### `createInstance(x, y)`

Создает экземпляр игрового объекта из ассета.

**Параметры:**
- `x` (number) - координата X
- `y` (number) - координата Y

**Возвращает:** `GameObject` - экземпляр GameObject с методами toJSON(), clone() и др.

**Особенности v3.6.0:**
- Теперь возвращает правильный экземпляр GameObject вместо plain object
- Обеспечивает корректную сериализацию и работу с группами
- Устраняет ошибку `child.toJSON is not a function`

### Level

Модель уровня.

#### Конструктор

```javascript
new Level(data = {})
```

**Свойства:**
- `meta` (Object) - метаданные уровня
- `settings` (Object) - настройки уровня
- `camera` (Object) - состояние камеры
- `objects` (Array) - массив объектов уровня
- `layers` (Array) - массив слоев уровня
- `nextObjectId` (number) - следующий ID для объектов
- `mainLayerId` (string) - ID основного слоя (сохраняется между сессиями)

#### Методы

##### `addObject(obj)`

Добавляет объект в уровень.

**Параметры:**
- `obj` (GameObject|Group|Object) - объект для добавления

**Особенности v3.6.0:**
- Автоматически проверяет тип объекта
- Если передан plain object, создает правильный экземпляр GameObject/Group
- Обеспечивает корректную типизацию всех объектов в level.objects
- Предотвращает ошибки сериализации

##### `removeObject(objId)`

Удаляет объект из уровня.

**Параметры:**
- `objId` (string) - ID объекта

##### `findObjectById(id)`

Находит объект по ID.

**Параметры:**
- `id` (string) - ID объекта

**Возвращает:** `GameObject|null`

##### `getAllObjects()`

Возвращает все объекты уровня (включая дочерние).

**Возвращает:** `Array<GameObject>`

##### `getStats()`

Возвращает статистику уровня.

**Возвращает:** `Object`

##### `addLayer(name)`

Добавляет новый слой в уровень.

**Параметры:**
- `name` (string) - имя слоя (по умолчанию 'New Layer')

**Возвращает:** `Layer` - созданный слой

##### `removeLayer(layerId)`

Удаляет слой по ID (нельзя удалить слой Main).

**Параметры:**
- `layerId` (string) - ID слоя

**Возвращает:** `boolean` - true, если слой был удален

##### `getLayerById(layerId)`

Находит слой по ID.

**Параметры:**
- `layerId` (string) - ID слоя

**Возвращает:** `Layer|undefined`

##### `getMainLayer()`

Возвращает объект основного слоя (Main layer).

**Возвращает:** `Layer|undefined`

##### `getMainLayerId()`

Возвращает ID основного слоя (Main layer). Основной слой определяется как первый слой при создании уровня и сохраняет свой ID независимо от перестановки слоев в интерфейсе.

**Возвращает:** `string` - ID основного слоя

##### `fixLayerReferences()`

Исправляет ссылки на слои для всех объектов уровня. Убеждается, что все объекты имеют корректные ссылки на существующие слои. Объекты с неправильными или отсутствующими ссылками на слои переназначаются в основной слой.

**Возвращает:** `number` - количество исправленных ссылок

##### `reorderLayers(layerIds)`

Изменяет порядок слоев.

**Параметры:**
- `layerIds` (Array) - массив ID слоев в новом порядке

##### `getLayersSorted()`

Возвращает слои, отсортированные по порядку.

**Возвращает:** `Array<Layer>`

##### `toJSON()`

Сериализует уровень в JSON формат для сохранения.

**Возвращает:** `Object` - сериализованные данные уровня

##### `fromJSON(data)`

Создает уровень из сериализованных JSON данных.

**Параметры:**
- `data` (Object) - сериализованные данные уровня

**Возвращает:** `Level` - восстановленный уровень

## Менеджеры

### StateManager

Управление состоянием приложения.

#### Конструктор

```javascript
new StateManager()
```

#### Методы

##### `getState()`

Возвращает текущее состояние.

**Возвращает:** `Object`

##### `get(key)`

Получает значение свойства состояния.

**Параметры:**
- `key` (string) - ключ свойства

**Возвращает:** `any`

##### `set(key, value)`

Устанавливает значение свойства и уведомляет слушателей.

**Параметры:**
- `key` (string) - ключ свойства
- `value` (any) - новое значение

##### `update(updates)`

Обновляет несколько свойств состояния.

**Параметры:**
- `updates` (Object) - объект с обновлениями

##### `subscribe(key, callback)`

Подписывается на изменения свойства.

**Параметры:**
- `key` (string) - ключ свойства
- `callback` (Function) - функция обратного вызова

**Возвращает:** `Function` - функция отписки

##### `markDirty()`

Отмечает уровень как измененный.

##### `markClean()`

Отмечает уровень как сохраненный.

##### `clearSelection()`

Очищает выделение.

##### `selectObject(objId)`

Выделяет объект.

**Параметры:**
- `objId` (string) - ID объекта

##### `deselectObject(objId)`

Снимает выделение с объекта.

**Параметры:**
- `objId` (string) - ID объекта

##### `setSelection(objIds)`

Устанавливает выделение на указанные объекты.

**Параметры:**
- `objIds` (Array) - массив ID объектов

##### `toggleSelection(objId)`

Переключает выделение объекта.

**Параметры:**
- `objId` (string) - ID объекта

##### `reset()`

Сбрасывает состояние к начальным значениям.

**Примечание:** Включает инициализацию новых состояний `groupEditMode` и `duplicate`.

### HistoryManager

Управление историей изменений.

#### Конструктор

```javascript
new HistoryManager(maxSize = 50)
```

**Параметры:**
- `maxSize` (number) - максимальный размер стека истории

#### Методы

##### `saveState(state, isInitial)`

Сохраняет состояние в историю.

**Параметры:**
- `state` (any) - состояние для сохранения
- `isInitial` (boolean) - является ли это начальным состоянием

##### `undo()`

Отменяет последнее действие.

**Возвращает:** `any|null` - предыдущее состояние

##### `redo()`

Повторяет отмененное действие.

**Возвращает:** `any|null` - следующее состояние

##### `canUndo()`

Проверяет, можно ли отменить действие.

**Возвращает:** `boolean`

##### `canRedo()`

Проверяет, можно ли повторить действие.

**Возвращает:** `boolean`

##### `clear()`

Очищает всю историю.

##### `getHistoryInfo()`

Возвращает информацию об истории.

**Возвращает:** `Object`

##### `pauseRecording()`

Временно отключает запись истории.

##### `resumeRecording()`

Возобновляет запись истории.

### AssetManager

Управление библиотекой ассетов.

#### Конструктор

```javascript
new AssetManager()
```

#### Методы

##### `addAsset(assetData)`

Добавляет ассет в библиотеку.

**Параметры:**
- `assetData` (Object) - данные ассета

**Возвращает:** `Asset`

##### `removeAsset(assetId)`

Удаляет ассет из библиотеки.

**Параметры:**
- `assetId` (string) - ID ассета

**Возвращает:** `boolean`

##### `getAsset(assetId)`

Получает ассет по ID.

**Параметры:**
- `assetId` (string) - ID ассета

**Возвращает:** `Asset|undefined`

##### `getAllAssets()`

Возвращает все ассеты.

**Возвращает:** `Array<Asset>`

##### `getAssetsByCategory(category)`

Возвращает ассеты по категории.

**Параметры:**
- `category` (string) - категория

**Возвращает:** `Array<Asset>`

##### `getCategories()`

Возвращает все категории.

**Возвращает:** `Array<string>`

##### `searchAssets(query)`

Ищет ассеты по запросу.

**Параметры:**
- `query` (string) - поисковый запрос

**Возвращает:** `Array<Asset>`

##### `preloadImages()`

Предзагружает изображения ассетов.

**Возвращает:** `Promise<void>`

##### `loadImage(src)`

Загружает и кэширует изображение.

**Параметры:**
- `src` (string) - путь к изображению

**Возвращает:** `Promise<Image>`

##### `getCachedImage(src)`

Получает кэшированное изображение.

**Параметры:**
- `src` (string) - путь к изображению

**Возвращает:** `Image|undefined`

##### `exportToJSON()`

Экспортирует библиотеку в JSON.

**Возвращает:** `string`

##### `importFromJSON(jsonData)`

Импортирует библиотеку из JSON.

**Параметры:**
- `jsonData` (string) - JSON данные

**Возвращает:** `boolean`

### FileManager

Управление файловыми операциями.

#### Конструктор

```javascript
new FileManager()
```

#### Методы

##### `createNewLevel()`

Создает новый уровень.

**Возвращает:** `Level`

##### `saveLevel(level, fileName)`

Сохраняет уровень в файл.

**Параметры:**
- `level` (Level) - уровень для сохранения
- `fileName` (string|null) - имя файла

**Возвращает:** `string` - имя сохраненного файла

##### `loadLevel(file)`

Загружает уровень из файла.

**Параметры:**
- `file` (File) - файл уровня

**Возвращает:** `Promise<Level>`

##### `loadLevelFromFileInput()`

Загружает уровень через диалог выбора файла.

**Возвращает:** `Promise<Level>`

##### `isValidFile(file)`

Проверяет валидность файла.

**Параметры:**
- `file` (File) - файл для проверки

**Возвращает:** `boolean`

##### `getCurrentFileName()`

Возвращает имя текущего файла.

**Возвращает:** `string|null`

##### `setCurrentFileName(fileName)`

Устанавливает имя текущего файла.

**Параметры:**
- `fileName` (string) - имя файла

##### `exportLevelData(level)`

Экспортирует данные уровня в JSON строку.

**Параметры:**
- `level` (Level) - уровень

**Возвращает:** `string`

##### `importLevelData(jsonString)`

Импортирует данные уровня из JSON строки.

**Параметры:**
- `jsonString` (string) - JSON строка

**Возвращает:** `Level`

##### `saveAssetLibrary(assetManager, fileName)`

Сохраняет библиотеку ассетов в файл.

**Параметры:**
- `assetManager` (AssetManager) - менеджер ассетов
- `fileName` (string) - имя файла

##### `loadAssetLibrary(assetManager)`

Загружает библиотеку ассетов через диалог выбора файла.

**Параметры:**
- `assetManager` (AssetManager) - менеджер ассетов

**Возвращает:** `Promise<boolean>`

## ContextMenuManager

Централизованный менеджер для управления всеми контекстными меню в приложении.

### Конструктор

```javascript
const contextMenuManager = new ContextMenuManager();
```

### Методы

#### registerMenu(name, menuInstance)

Регистрирует экземпляр контекстного меню в системе.

**Параметры:**
- `name` (string) - Уникальное имя меню
- `menuInstance` (Object) - Экземпляр меню

**Пример:**
```javascript
contextMenuManager.registerMenu('canvas', canvasContextMenu);
```

#### unregisterMenu(name)

Удаляет меню из системы управления.

**Параметры:**
- `name` (string) - Имя меню для удаления

#### showMenu(menuName, event, contextData)

Показывает указанное меню, автоматически закрывая все остальные.

**Параметры:**
- `menuName` (string) - Имя меню для показа
- `event` (Event) - Событие мыши
- `contextData` (Object) - Дополнительные данные контекста

**Особенности:**
- Автоматически закрывает все активные меню
- Предотвращает показ меню после панорамирования
- Поддерживает разные типы меню (CanvasContextMenu, ConsoleContextMenu)

#### closeMenu(menuName)

Закрывает указанное меню.

**Параметры:**
- `menuName` (string) - Имя меню для закрытия

#### closeAllMenus(exceptMenuName)

Закрывает все зарегистрированные меню, кроме указанного.

**Параметры:**
- `exceptMenuName` (string, optional) - Имя меню, которое не нужно закрывать

#### closeCurrentMenu()

Закрывает текущее активное меню.

#### getCurrentActiveMenu()

Возвращает имя текущего активного меню.

**Возвращает:** `string|null`

#### hasActiveMenu()

Проверяет, есть ли активное меню.

**Возвращает:** `boolean`

#### getRegisteredMenus()

Возвращает массив имен всех зарегистрированных меню.

**Возвращает:** `Array<string>`

#### destroy()

Очищает все ресурсы и удаляет все зарегистрированные меню.

### Архитектурные особенности

- **Устранение race conditions** - синхронизированная обработка событий мыши
- **Предотвращение конфликтов** - только одно активное меню одновременно
- **Интеллектуальное определение панорамирования** - анализ движения мыши
- **Глобальная блокировка** - предотвращение стандартного меню браузера
- **Умное позиционирование курсора** - автоматическая корректировка позиции меню
- **Непрерывный мониторинг во время анимации** - реальный мониторинг позиции курсора каждый кадр
- **Улучшенная логика Group/Ungroup** - интеллектуальное отображение пунктов меню на основе выделения
- **Автоматическое закрытие** - меню закрывается при уводе курсора за границы
- **Упрощенная логика** - нет необходимости кликать вне меню для закрытия

#### isCursorInsideMenu(menu)

Проверяет, находится ли курсор внутри границ меню.

**Параметры:**
- `menu` (HTMLElement) - Элемент меню для проверки

**Возвращает:** `boolean` - true если курсор внутри границ меню

**Пример использования:**
```javascript
if (!this.isCursorInsideMenu(this.currentMenu)) {
    console.log('Cursor is outside menu bounds');
    this.hideMenu();
}
```

#### handleAnimationEnd(event)

Обрабатывает завершение анимации и проверяет позицию курсора.

**Параметры:**
- `event` (TransitionEvent) - Событие завершения анимации

**Поведение:**
- Проверяет позицию курсора относительно меню
- Закрывает меню если курсор вне границ
- Логирует результаты проверки

**Пример использования:**
```javascript
menu.addEventListener('transitionend', this.handleAnimationEnd.bind(this), { once: true });
```

#### startCursorMonitoring(menu)

Запускает непрерывный мониторинг позиции курсора во время анимации появления меню.

**Параметры:**
- `menu` (HTMLElement) - Элемент меню для мониторинга

**Поведение:**
- Запускает цикл мониторинга с использованием requestAnimationFrame
- Автоматически закрывает меню если курсор вышел за границы
- Останавливается автоматически после завершения анимации или закрытия меню

**Пример использования:**
```javascript
// Вызывается автоматически в showContextMenu()
this.startCursorMonitoring(contextMenu);
```

#### monitorCursorPosition(menu)

Основная функция мониторинга позиции курсора каждый кадр анимации.

**Параметры:**
- `menu` (HTMLElement) - Элемент меню для проверки

**Поведение:**
- Проверяет позицию курсора относительно границ меню каждый кадр
- Закрывает меню если курсор вышел за границы
- Продолжает мониторинг до завершения анимации или закрытия меню

#### hasMultipleSelectedObjects()

Проверяет, выделено ли минимум 2 объекта (используется для отображения пункта Group).

**Возвращает:** `boolean` - true если выделено 2 или более объектов

**Пример использования:**
```javascript
if (this.hasMultipleSelectedObjects()) {
    // Показать пункт Group в меню
    this.showGroupMenuItem();
}
```

#### ensureCursorInsideMenu(event, menuPosition, menu)

Автоматически корректирует позицию меню, чтобы курсор оказался внутри его границ.

**Параметры:**
- `event` (Event) - Событие мыши
- `menuPosition` (Object) - Текущая позиция меню
- `menu` (HTMLElement) - Элемент меню

**Возвращает:** `Object` - Смещение {x, y} для корректировки позиции меню

**Пример использования:**
```javascript
const cursorOffset = this.ensureCursorInsideMenu(event, optimalPosition, contextMenu);
if (cursorOffset.x !== 0 || cursorOffset.y !== 0) {
    contextMenu.style.left = (optimalPosition.x + cursorOffset.x) + 'px';
    contextMenu.style.top = (optimalPosition.y + cursorOffset.y) + 'px';
}
```

### Пример использования

```javascript
// Регистрация меню
contextMenuManager.registerMenu('canvas', canvasMenu);
contextMenuManager.registerMenu('console', consoleMenu);

// Показ меню с автоматическим закрытием других
contextMenuManager.showMenu('canvas', mouseEvent, contextData);

// Проверка состояния
if (contextMenuManager.hasActiveMenu()) {
    const activeMenu = contextMenuManager.getCurrentActiveMenu();
    console.log('Active menu:', activeMenu);
}
```

## CommandAvailability (v3.15.0)

Утилитарный класс для централизованной проверки доступности команд в зависимости от текущего состояния редактора.

### Конструктор

```javascript
// Статический класс, экземпляр не требуется
CommandAvailability.check(command, levelEditor);
```

### Методы

#### getContext(levelEditor)

Сбор контекстной информации для проверки команд.

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

**Возвращает:** `Object` - объект с контекстной информацией:
- `hasSelection` (boolean) - есть ли выделенные объекты
- `hasMultipleSelection` (boolean) - выделено ли 2+ объекта
- `isGroup` (boolean) - является ли выделенный объект группой
- `canUndo` (boolean) - доступна ли операция undo
- `canRedo` (boolean) - доступна ли операция redo
- `canPaste` (boolean) - доступна ли вставка

#### check(command, levelEditor)

Проверка доступности конкретной команды.

**Параметры:**
- `command` (string) - имя команды для проверки
- `levelEditor` (LevelEditor) - экземпляр редактора

**Возвращает:** `boolean` - true если команда доступна

**Поддерживаемые команды:**
- `'duplicate'` - дублирование объектов
- `'deleteSelected'` - удаление выделенных объектов
- `'copy'` / `'cut'` - копирование/вырезание
- `'paste'` - вставка
- `'groupSelected'` - группировка объектов
- `'ungroupSelected'` - разгруппировка
- `'undo'` / `'redo'` - операции истории
- `'focusSelection'` / `'focusAll'` - фокус на объектах
- `'toggleGrid'` / `'toggleSnapToGrid'` / `'toggleParallax'` / `'toggleObjectBoundaries'` / `'toggleObjectCollisions'` - переключатели отображения

#### hasSelectedObjects(levelEditor)

Проверка наличия выделенных объектов.

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

**Возвращает:** `boolean`

#### hasMultipleSelectedObjects(levelEditor)

Проверка множественного выделения (2+ объекта).

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

**Возвращает:** `boolean`

#### isSelectedObjectGroup(levelEditor)

Проверка, является ли выделенный объект группой.

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

**Возвращает:** `boolean`

#### canUndo(levelEditor)

Проверка доступности операции undo.

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

**Возвращает:** `boolean`

#### canRedo(levelEditor)

Проверка доступности операции redo.

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

**Возвращает:** `boolean`

#### canPaste()

Проверка возможности вставки из буфера обмена.

**Возвращает:** `boolean`

### Пример использования

```javascript
import { CommandAvailability } from '../utils/CommandAvailability.js';

// Проверка доступности команды
const canDuplicate = CommandAvailability.check('duplicate', levelEditor);
const canGroup = CommandAvailability.check('groupSelected', levelEditor);

// Получение полного контекста
const context = CommandAvailability.getContext(levelEditor);
if (context.hasSelection && context.hasMultipleSelection) {
    // Доступна группировка
    showGroupButton();
}
```

### Преимущества

- **Централизованная логика** - единое место для проверки доступности команд
- **Устранение дублирования** - повторное использование логики в разных компонентах
- **Согласованность** - одинаковые правила доступности команд во всем приложении
- **Легкость сопровождения** - изменения логики в одном месте

## UI компоненты

### Toolbar

Панель инструментов с кнопками команд и карусельным переключением типов гридов.

**Файл**: `src/ui/Toolbar.js`

#### Конструктор

```javascript
new Toolbar(container, levelEditor, stateManager)
```

**Параметры:**
- `container` (HTMLElement) - контейнер панели
- `levelEditor` (LevelEditor) - экземпляр редактора
- `stateManager` (StateManager) - менеджер состояния

**Свойства v3.19.3:**
- `gridTypes` (Array) - массив доступных типов гридов
- `currentGridTypeIndex` (number) - индекс текущего типа грида
- `gridTypeConfig` (Map) - конфигурация иконок и названий для каждого типа

#### Основные методы

##### `render()`

Отрисовывает панель инструментов.

##### `createButtonGroup(title, buttons)`

Создает группу кнопок.

**Параметры:**
- `title` (string) - заголовок группы
- `buttons` (Array) - массив кнопок

**Возвращает:** `HTMLElement`

##### `createButton(button)`

Создает кнопку.

**Параметры:**
- `button` (Object) - конфигурация кнопки

**Возвращает:** `HTMLElement`

##### `handleAction(action)`

Обрабатывает действие кнопки.

**Параметры:**
- `action` (string) - действие

##### `updateToggleStates()`

Обновляет состояния переключателей.

##### `updateToggleButtonState(buttonId, isActive)`

Обновляет состояние переключателя.

**Параметры:**
- `buttonId` (string) - ID кнопки
- `isActive` (boolean) - активное состояние

##### `setVisible(visible)`

Устанавливает видимость панели.

**Параметры:**
- `visible` (boolean) - видимость

##### `hideToolbar()`

Скрывает панель инструментов.

##### `showToolbar()`

Показывает панель инструментов.

##### `toggleToolbar()`

Переключает видимость панели.

##### `loadCollapsedStates()`

Загружает состояния свернутых секций.

##### `saveCollapsedStates()`

Сохраняет состояния свернутых секций.

##### `loadDisplaySettings()`

Загружает настройки отображения.

##### `saveDisplaySettings()`

Сохраняет настройки отображения.

##### `loadScrollPosition()`

Загружает позицию скролла.

##### `saveScrollPosition()`

Сохраняет позицию скролла.

##### `updateCommandAvailability()`

Обновляет доступность команд.

##### `loadStateBeforeRender()`

Загружает состояние перед рендерингом.

#### Методы карусельного переключения типов гридов (v3.19.3)

##### `initializeGridTypes()`

Динамически инициализирует типы гридов из доступных рендереров.

**Особенности:**
- Автоматически получает список рендереров из `CanvasRenderer.gridRenderers`
- Использует fallback конфигурацию если рендереры недоступны
- Настраивает иконки и названия для каждого типа грида
- Логирует процесс инициализации

**Конфигурация по умолчанию:**
```javascript
const defaultConfig = [
    { type: 'rectangular', icon: '⊞', label: 'Rectangular' },
    { type: 'diamond', icon: '◇', label: 'Diamond' },
    { type: 'hexagonal', icon: '⬡', label: 'Hexagonal' }
];
```

##### `refreshGridTypes()`

Обновляет список типов гридов при изменении рендереров.

**Особенности:**
- Вызывается при добавлении/удалении рендереров
- Проверяет доступность текущего типа грида
- Переключается на первый доступный тип если текущий недоступен
- Обновляет иконку кнопки Grid

**Возвращает:** `void`

##### `cycleGridType()`

Переключает на следующий тип грида в карусели.

**Особенности:**
- Циклическое переключение между доступными типами
- Обновляет конфигурацию и состояние
- Синхронизирует с GridSettings и StateManager
- Сохраняет выбранный тип в пользовательских настройках
- Обновляет иконку кнопки Grid

**Возвращает:** `void`

##### `updateGridButtonIcon()`

Обновляет иконку кнопки Grid в зависимости от текущего типа грида.

**Особенности:**
- Находит кнопку Grid по data-action="toggleGrid"
- Обновляет текст иконки из gridTypeConfig
- Вызывается автоматически при смене типа грида

**Возвращает:** `void`

##### `getCurrentGridType()`

Получает текущий тип грида.

**Возвращает:** `string` - текущий тип грида

##### `setGridType(gridType)`

Устанавливает конкретный тип грида.

**Параметры:**
- `gridType` (string) - тип грида для установки

**Особенности:**
- Проверяет доступность типа грида
- Обновляет индекс и конфигурацию
- Синхронизирует с настройками
- Обновляет иконку кнопки

**Возвращает:** `boolean` - true если тип установлен успешно

### GridSettings

Модуль для управления настройками грида в редакторе уровней.

**Файл**: `src/ui/GridSettings.js`

#### Конструктор

```javascript
new GridSettings(configManager)
```

**Параметры:**
- `configManager` (ConfigManager) - менеджер конфигурации

#### Методы

##### `renderGridSettings()`

Рендерит HTML интерфейс настроек грида.

**Возвращает:** `string` - HTML разметка

**Особенности:**
- Создает двухколоночный макет настроек
- Включает настройки размера, цвета, толщины и прозрачности грида
- Поддерживает подразделения грида с отдельными настройками

##### `syncAllGridSettingsToState()`

Синхронизирует настройки грида из ConfigManager в StateManager.

**Особенности:**
- Конвертирует цвет из HEX в RGBA с учетом прозрачности
- Обновляет все параметры грида в StateManager
- Запускает перерисовку canvas после обновления

**Синхронизируемые параметры:**
- `canvas.gridSize` - размер сетки
- `canvas.gridColor` - цвет сетки (RGBA)
- `canvas.gridThickness` - толщина линий
- `canvas.gridOpacity` - прозрачность

### SettingsPanel

Панель настроек с модульной архитектурой.

**Файл**: `src/ui/SettingsPanel.js`

#### Конструктор

```javascript
new SettingsPanel(container, configManager)
```

**Параметры:**
- `container` (HTMLElement) - контейнер для панели
- `configManager` (ConfigManager) - менеджер конфигурации

#### Методы

##### `show()`

Показывает панель настроек.

##### `hide()`

Скрывает панель настроек.

##### `renderSettingsContent(category)`

Рендерит содержимое для указанной категории настроек.

**Параметры:**
- `category` (string) - категория настроек ('general', 'grid', 'camera', etc.)

**Интеграция с GridSettings:**
- Использует `this.gridSettings.renderGridSettings()` для настроек грида
- Синхронизирует настройки через `this.gridSettings.syncAllGridSettingsToState()`

### CanvasRenderer

Рендеринг на canvas.

#### Конструктор

```javascript
new CanvasRenderer(canvas)
```

**Параметры:**
- `canvas` (HTMLCanvasElement) - элемент canvas

#### Методы

##### `resizeCanvas()`

Изменяет размер canvas под контейнер.

##### `clear()`

Очищает canvas.

##### `setCamera(camera)`

Устанавливает трансформацию камеры.

**Параметры:**
- `camera` (Object) - объект камеры

##### `restoreCamera()`

Восстанавливает трансформацию камеры.

##### `drawGrid(gridSize, camera, backgroundColor, options)`

Рисует сетку выбранного типа.

**Параметры:**
- `gridSize` (number) - размер сетки
- `camera` (Object) - объект камеры
- `backgroundColor` (string) - цвет фона
- `options.gridType` (string) - тип сетки: 'rectangular', 'diamond', 'hexagonal'
- `options.color` (string) - цвет линий сетки
- `options.thickness` (number) - толщина линий
- `options.opacity` (number) - прозрачность линий
- `options.subdivisions` (number) - количество субдивизий (для rectangular)
- `options.subdivColor` (string) - цвет субдивизий
- `options.hexOrientation` (string) - ориентация хексагонального грида: 'pointy', 'flat'

**Внутренняя архитектура:**
```javascript
// Инициализация рендереров в конструкторе
this.gridRenderers = new Map();
this.gridRenderers.set('rectangular', new RectangularGridRenderer());
this.gridRenderers.set('diamond', new DiamondGridRenderer());
this.gridRenderers.set('hexagonal', new HexagonalGridRenderer());

// Выбор рендерера в drawGrid()
const gridRenderer = this.gridRenderers.get(gridType);
gridRenderer.render(this.ctx, gridSize, camera, viewport, options);
```

##### `drawObject(obj, parentX, parentY)`

Рисует объект.

**Параметры:**
- `obj` (GameObject) - объект для рисования
- `parentX` (number) - X координата родителя
- `parentY` (number) - Y координата родителя

##### `drawSingleObject(obj, x, y)`

Рисует одиночный объект.

**Параметры:**
- `obj` (GameObject) - объект
- `x` (number) - X координата
- `y` (number) - Y координата

##### `drawGroup(group, x, y)`

Рисует группу объектов.

**Параметры:**
- `group` (Group) - группа
- `x` (number) - X координата
- `y` (number) - Y координата

##### `drawSelection(obj, camera)`

Рисует выделение объекта.

**Параметры:**
- `obj` (GameObject) - объект
- `camera` (Object) - объект камеры

##### `drawMarquee(marqueeRect, camera)`

Рисует рамку выделения.

**Параметры:**
- `marqueeRect` (Object) - прямоугольник рамки
- `camera` (Object) - объект камеры

##### `drawPlacingObjects(objects, camera)`

Рисует объекты для размещения.

**Параметры:**
- `objects` (Array) - массив объектов
- `camera` (Object) - объект камеры

##### `getObjectBounds(obj)`

Получает границы объекта.

**Параметры:**
- `obj` (GameObject) - объект

**Возвращает:** `Object`

##### `getGroupBounds(group)`

Получает границы группы.

**Параметры:**
- `group` (Group) - группа

**Возвращает:** `Object`

##### `cacheImage(src, img)`

Кэширует изображение.

**Параметры:**
- `src` (string) - путь к изображению
- `img` (Image) - объект изображения

##### `getCachedImage(src)`

Получает кэшированное изображение.

**Параметры:**
- `src` (string) - путь к изображению

**Возвращает:** `Image|undefined`

##### `screenToWorld(screenX, screenY, camera)`

Преобразует экранные координаты в мировые.

**Параметры:**
- `screenX` (number) - экранная X координата
- `screenY` (number) - экранная Y координата
- `camera` (Object) - объект камеры

**Возвращает:** `Object` - мировые координаты

##### `worldToScreen(worldX, worldY, camera)`

Преобразует мировые координаты в экранные.

**Параметры:**
- `worldX` (number) - мировая X координата
- `worldY` (number) - мировая Y координата
- `camera` (Object) - объект камеры

**Возвращает:** `Object` - экранные координаты

### GridRenderers (v3.19.0)

Модульная система рендеринга сетки с поддержкой разных типов.

#### BaseGridRenderer

Базовый класс для всех рендереров сетки.

##### Методы

###### `setGridStyle(ctx, color, thickness, opacity, camera)`

Устанавливает стиль линий сетки.

**Параметры:**
- `ctx` (CanvasRenderingContext2D) - контекст canvas
- `color` (string) - цвет линий
- `thickness` (number) - толщина линий
- `opacity` (number) - прозрачность
- `camera` (Object) - объект камеры

###### `calculateViewportBounds(camera, viewport)`

Рассчитывает границы видимой области.

**Параметры:**
- `camera` (Object) - объект камеры
- `viewport` (Object) - размеры viewport {width, height}

**Возвращает:** `Object` - границы {left, top, right, bottom}

###### `shouldRenderGrid(gridSize, camera, minGridSize)`

Проверяет необходимость рендеринга сетки.

**Параметры:**
- `gridSize` (number) - размер сетки
- `camera` (Object) - объект камеры
- `minGridSize` (number) - минимальный размер сетки в пикселях

**Возвращает:** `boolean`

###### `hexToRgba(hexColor, alpha)`

Конвертирует hex цвет в rgba.

**Параметры:**
- `hexColor` (string) - hex цвет
- `alpha` (number) - прозрачность

**Возвращает:** `string` - rgba цвет

#### RectangularGridRenderer

Рендерер прямоугольной сетки.

##### `render(ctx, gridSize, camera, viewport, options)`

Рисует прямоугольную сетку.

**Параметры:**
- `ctx` (CanvasRenderingContext2D) - контекст canvas
- `gridSize` (number) - размер ячеек
- `camera` (Object) - объект камеры
- `viewport` (Object) - размеры viewport
- `options.color` (string) - цвет линий
- `options.thickness` (number) - толщина линий
- `options.opacity` (number) - прозрачность
- `options.subdivisions` (number) - количество субдивизий
- `options.subdivColor` (string) - цвет субдивизий
- `options.subdivThickness` (number) - толщина субдивизий

#### DiamondGridRenderer

Рендерер diamond сетки.

##### `render(ctx, gridSize, camera, viewport, options)`

Рисует diamond сетку с углами 60° и 120°.

**Параметры:**
- `ctx` (CanvasRenderingContext2D) - контекст canvas
- `gridSize` (number) - размер ячеек
- `camera` (Object) - объект камеры
- `viewport` (Object) - размеры viewport
- `options.color` (string) - цвет линий
- `options.thickness` (number) - толщина линий
- `options.opacity` (number) - прозрачность

#### HexagonalGridRenderer

Рендерер шестиугольной сетки с поддержкой ориентации.

##### `render(ctx, gridSize, camera, viewport, options)`

Рисует шестиугольную сетку с оптимизированным алгоритмом.

**Параметры:**
- `ctx` (CanvasRenderingContext2D) - контекст canvas
- `gridSize` (number) - размер ячеек (используется как радиус хексагона)
- `camera` (Object) - объект камеры
- `viewport` (Object) - размеры viewport
- `options.color` (string) - цвет линий
- `options.thickness` (number) - толщина линий
- `options.opacity` (number) - прозрачность
- `options.hexOrientation` (string) - ориентация: 'pointy' (по умолчанию) или 'flat'

**Особенности:**
- Оптимизированная отрисовка с использованием Set для избежания дублирования линий
- Поддержка двух ориентаций: Pointy Top и Flat Top
- Автоматический расчет размеров и позиций хексагонов
- Интеграция с системой камеры и viewport

### AssetPanel

Панель ассетов.

#### Конструктор

```javascript
new AssetPanel(container, assetManager, stateManager)
```

**Параметры:**
- `container` (HTMLElement) - контейнер панели
- `assetManager` (AssetManager) - менеджер ассетов
- `stateManager` (StateManager) - менеджер состояния

#### Методы

##### `render()`

Отрисовывает панель ассетов.

##### `renderTabs()`

Отрисовывает вкладки категорий.

##### `renderPreviews()`

Отрисовывает превью ассетов.

##### `createAssetThumbnail(asset, selectedAssets)`

Создает миниатюру ассета.

**Параметры:**
- `asset` (Asset) - ассет
- `selectedAssets` (Set) - выбранные ассеты

**Возвращает:** `HTMLElement`

##### `addDropTarget()`

Добавляет стиль цели для перетаскивания.

##### `removeDropTarget()`

Убирает стиль цели для перетаскивания.

### DetailsPanel

Панель свойств объектов.

#### Конструктор

```javascript
new DetailsPanel(container, stateManager, level)
```

**Параметры:**
- `container` (HTMLElement) - контейнер панели
- `stateManager` (StateManager) - менеджер состояния
- `level` (Level) - уровень

#### Методы

##### `render()`

Отрисовывает панель свойств.

##### `renderNoSelection()`

Отрисовывает сообщение об отсутствии выделения.

##### `renderSingleObject(obj)`

Отрисовывает свойства одного объекта.

**Параметры:**
- `obj` (GameObject) - объект

##### `renderMultipleObjects(objects)`

Отрисовывает свойства нескольких объектов.

**Параметры:**
- `objects` (Array) - массив объектов

##### `renderGroupDetails(group)`

Отрисовывает детали группы.

**Параметры:**
- `group` (Group) - группа

##### `renderObjectDetails(obj)`

Отрисовывает детали объекта с поддержкой zIndex.

**Параметры:**
- `obj` (GameObject) - объект

**Особенности zIndex:**
- Отображает тысячные доли индекса глубины (личный индекс объекта)
- Автоматически пересчитывает при изменении слоя
- Вызывает перерисовку канвы при изменении

##### `renderCustomProperties(obj)`

Отрисовывает пользовательские свойства.

**Параметры:**
- `obj` (GameObject) - объект

##### `getSelectedObjects()`

Получает выбранные объекты.

**Возвращает:** `Array<GameObject>`

##### `renderLayersSection()`

Отрисовывает секцию управления слоями.

##### `createLayerElement(layer)`

Создает элемент слоя для отображения.

**Параметры:**
- `layer` (Layer) - слой

**Возвращает:** `HTMLElement`

##### `setupLayersEventListeners()`

Настраивает обработчики событий для управления слоями.

##### `setupLayersDragAndDrop()`

Настраивает drag & drop для изменения порядка слоев.

### OutlinerPanel

Панель иерархии объектов.

### LayersPanel

Продвинутая панель управления слоями с поиском, статистикой и массовыми операциями.

#### Конструктор
```javascript
constructor(container, stateManager, levelEditor)
```

#### Основные методы

##### `initializeCurrentLayer()`
Инициализирует текущий слой как Main слой.

##### `setCurrentLayer(layerId)`
Устанавливает текущий слой для создания новых объектов.
- `layerId` - ID слоя

##### `setCurrentLayerAndNotify(layerId)`
Устанавливает текущий слой и уведомляет другие компоненты.
- `layerId` - ID слоя

##### `showLayerContextMenu(layer, event)`
Показывает контекстное меню для слоя.
- `layer` - объект слоя
- `event` - событие мыши

##### `showLayersMenu(event)`
Показывает меню массовых операций.
- `event` - событие мыши

##### `getFilteredLayers(layers)`
Фильтрует слои по поисковому запросу.
- `layers` - массив слоёв
- **Возвращает:** отфильтрованный массив слоёв

##### `selectAllLayers()`
Выбирает все слои.

##### `deselectAllLayers()`
Снимает выбор со всех слоёв.

##### `showAllLayers()`
Показывает все слои.

##### `hideAllLayers()`
Скрывает все слои.

##### `lockAllLayers()`
Блокирует все слои.

##### `unlockAllLayers()`
Разблокирует все слои.

##### `duplicateLayer(layerId)`
Дублирует слой.
- `layerId` - ID слоя для дублирования

##### `deleteLayer(layerId)`
Удаляет слой (с перемещением объектов в Main слой).
- `layerId` - ID слоя для удаления

##### `moveObjectsToMainLayer(layerId)`
Перемещает все объекты слоя в Main слой.
- `layerId` - ID слоя

##### `updateLayerStyles()`
Обновляет стили слоёв (подсветка активных/текущих).

#### Состояния слоёв

**Активные слои** (border highlight):
- Слои, содержащие выбранные объекты
- Подсвечиваются рамкой
- Может быть несколько активных слоёв

**Текущий слой** (blue background):
- Слой для создания новых объектов
- Подсвечивается синим фоном
- Только один текущий слой

#### Поиск и фильтрация

- Поиск в реальном времени по названию слоя
- Регистронезависимый поиск
- Автоматическое обновление списка при вводе

#### Массовые операции

- Выбор/снятие выбора всех слоёв
- Показать/скрыть все слои
- Заблокировать/разблокировать все слои
- Дублирование и удаление слоёв

#### Конструктор

```javascript
new OutlinerPanel(container, stateManager, level)
```

**Параметры:**
- `container` (HTMLElement) - контейнер панели
- `stateManager` (StateManager) - менеджер состояния
- `level` (Level) - уровень

#### Методы

##### `render()`

Отрисовывает панель иерархии.

##### `groupObjectsByType(objects)`

Группирует объекты по типам.

**Параметры:**
- `objects` (Array) - массив объектов

**Возвращает:** `Object`

##### `renderTypeGroup(type, objects)`

Отрисовывает группу объектов одного типа.

**Параметры:**
- `type` (string) - тип объектов
- `objects` (Array) - массив объектов

##### `renderGroupNode(group, depth, container)`

Отрисовывает узел группы.

**Параметры:**
- `group` (Group) - группа
- `depth` (number) - глубина вложенности
- `container` (HTMLElement) - контейнер

##### `renderObjectNode(obj, depth, container)`

Отрисовывает узел объекта.

**Параметры:**
- `obj` (GameObject) - объект
- `depth` (number) - глубина вложенности
- `container` (HTMLElement) - контейнер

## Основной класс

### LevelEditor

Главный класс редактора уровней.

#### Конструктор

```javascript
new LevelEditor()
```

#### Методы

##### `init()`

Инициализирует редактор.

**Возвращает:** `Promise<void>`

##### `render()`

Отрисовывает canvas.

##### `updateAllPanels()`

Обновляет все панели.

##### `updateLevelStatsPanel()`

Обновляет панель статистики уровня.

##### `getPlayerStartCount()` (v2.6.6)

Возвращает количество Player Start объектов из кешированной статистики.

**Возвращает:** `number` - количество Player Start объектов

##### `updateCachedLevelStats()` (v2.6.6)

Обновляет кеш статистики уровня для оптимизации производительности.

##### `autoCreatePlayerStart()` (v2.6.5)

Автоматически создает Player Start объект в координатах (0,0).

##### `saveViewStates()` (v2.6.3)

Сохраняет текущие состояния View меню команд.

**Возвращает:** `Object` - объект с состояниями View настроек

##### `applySavedViewStates(savedStates)` (v2.6.3)

Применяет сохраненные состояния View меню.

**Параметры:**
- `savedStates` (Object) - сохраненные состояния View

##### `findObjectAtPoint(x, y)`

Находит объект в указанной точке.

**Параметры:**
- `x` (number) - X координата
- `y` (number) - Y координата

**Возвращает:** `GameObject|null`

##### `deleteSelectedObjects()`

Удаляет выбранные объекты. При удалении групп также удаляются все дочерние объекты, включая вложенные группы.

**Особенности:**
- Группы удаляются полностью вместе со всем содержимым на всех уровнях вложенности
- Дети удаляемых групп рекурсивно помечаются для удаления
- Очищаются массивы детей в оставшихся группах
- Это отличается от разгруппировки (`ungroupSelectedObjects()`), где дети переносятся на основной уровень
- Поддерживается удаление объектов из любой глубины вложенности групп

##### `duplicateSelectedObjects()`

Дублирует выбранные объекты.

**Особенности:**
- Создает копии с новыми уникальными ID
- Сохраняет относительные позиции объектов
- Активирует режим размещения с превью
- Использует `DuplicateRenderer` для отображения

##### `groupSelectedObjects()`

Группирует выбранные объекты.

##### `focusOnSelection()`

Фокусируется на выбранных объектах.

##### `focusOnAll()`

Фокусируется на всех объектах.

##### `focusOnBounds(bounds)`

Фокусируется на указанных границах.

**Параметры:**
- `bounds` (Object) - границы

##### `getSelectionBounds(objects)`

Получает границы выбранных объектов.

**Параметры:**
- `objects` (Array) - массив объектов

**Возвращает:** `Object|null`

##### `undo()`

Отменяет последнее действие.

##### `redo()`

Повторяет отмененное действие.

##### `newLevel()`

Создает новый уровень.

**Возвращает:** `Promise<void>`

##### `openLevel()`

Открывает уровень.

**Возвращает:** `Promise<void>`

##### `saveLevel()`

Сохраняет уровень.

##### `saveLevelAs()`

Сохраняет уровень с новым именем.

##### `openAssetsPath()`

Открывает настройки пути к ассетам.

##### `deepClone(obj)`

Создает глубокую копию объекта с сохранением типов.

**Параметры:**
- `obj` (any) - объект для клонирования

**Возвращает:** `GameObject|Group` - копия объекта с сохранением типа

**Особенности v3.6.0:**
- Сохраняет типы GameObject/Group вместо создания plain objects
- Правильно обрабатывает вложенные группы
- Устраняет ошибки сериализации после клонирования
- Используется для дублирования объектов и создания копий для групп

##### `getLevel()`

Получает текущий уровень.

**Возвращает:** `Level`

##### `cancelAllActions()`

Отменяет все текущие действия.

**Отменяет:**
- Размещение объектов
- Перетаскивание
- Дублирование
- Режим редактирования групп

**Примечание:** Выделение рамкой отменяется глобальным обработчиком при нажатии любой кнопки мыши кроме левой.

##### `updatePlacingObjectsPosition(worldPos)`

Обновляет позиции дублированных объектов при движении мыши.

**Параметры:**
- `worldPos` (Object) - мировые координаты мыши

##### `finishPlacingObjects(worldPos)`

Завершает размещение дублированных объектов.

**Параметры:**
- `worldPos` (Object) - мировые координаты размещения

##### `getObjectWorldBounds(obj, excludeIds)`

Получает мировые границы объекта.

**Параметры:**
- `obj` (GameObject) - объект
- `excludeIds` (Array) - ID объектов для исключения из расчета

**Возвращает:** `Object` - границы объекта

##### `enterGroupEditMode(group)`

Входит в режим редактирования группы.

**Параметры:**
- `group` (Group) - группа для редактирования

##### `exitGroupEditMode()`

Выходит из режима редактирования группы.

##### `moveSelectedObjectsToLayer(moveUp, moveToExtreme)` **[v3.4.1]**

Перемещает выбранные объекты в следующий слой (вверх/вниз) с улучшенной обработкой вложенных объектов.

**Параметры:**
- `moveUp` (boolean) - true для перемещения в верхний слой, false для нижнего
- `moveToExtreme` (boolean) - true для перемещения в первый/последний слой, false для смежного

**Особенности v3.4.1:**
- Правильная обработка всех выбранных объектов включая вложенные в группы
- Предотвращение дублирования обработки групп
- Использование эффективного layerId с учетом наследования
- Безопасные проверки существования renderOperations

##### `assignSelectedObjectsToLayer(selectedObjects, moveUp, moveToExtreme)` **[v3.4.1]**

Координирует процесс изменения слоя для всех выбранных объектов.

**Параметры:**
- `selectedObjects` (Set) - множество ID выбранных объектов
- `moveUp` (boolean) - направление перемещения
- `moveToExtreme` (boolean) - режим экстремума

**Возвращает:** `number` - количество перемещенных объектов

##### `processObjectForLayerAssignment(objId, targetLayerId, processedGroups)` **[v3.4.1]**

Обрабатывает индивидуальный объект для изменения слоя.

**Параметры:**
- `objId` (string) - ID объекта для обработки
- `targetLayerId` (string) - целевой ID слоя
- `processedGroups` (Set) - множество уже обработанных групп

**Возвращает:** `Object` - результат с полем moved и информацией об объекте

**Алгоритм работы:**
1. Нахождение top-level объекта (группы)
2. Проверка, не обрабатывался ли уже этот объект
3. Изменение layerId только у top-level объекта
4. Корректное обновление счетчиков и уведомлений

## События

### События мыши

- `mousedown` - нажатие кнопки мыши
- `mousemove` - движение мыши
- `mouseup` - отпускание кнопки мыши
- `wheel` - прокрутка колеса мыши

### События клавиатуры

- `keydown` - нажатие клавиши

### События перетаскивания

- `dragstart` - начало перетаскивания
- `dragover` - перетаскивание над элементом
- `drop` - завершение перетаскивания

### События состояния

- Изменение выделения объектов
- Изменение состояния камеры
- Изменение активных вкладок ассетов
- Изменение выбранных ассетов
- Изменение режима редактирования групп
- Изменение состояния дублирования

## RenderOperations (v2.3.2)

Модуль отрисовки с поддержкой специализированной отрисовки дубликатов.

### Методы отрисовки дубликатов

##### `drawDuplicateObjects(objects, camera)`

Отрисовывает дублируемые объекты с прозрачностью и подсветкой.

**Параметры:**
- `objects` (Array) - массив дублируемых объектов
- `camera` (Object) - объект камеры

**Особенности:**
- Отрисовка с прозрачностью 0.7
- Использует стандартную подсветку выделения
- Поддерживает иерархию групп

##### `getDuplicateObjectBounds(obj, parentX, parentY)`

Вычисляет границы дублируемого объекта без поиска в дереве уровня.

**Параметры:**
- `obj` (Object) - дублируемый объект
- `parentX` (number) - X координата родителя (по умолчанию 0)
- `parentY` (number) - Y координата родителя (по умолчанию 0)

**Возвращает:** `Object` - границы {minX, minY, maxX, maxY}

##### `drawDuplicateHierarchyHighlight(group, depth, parentX, parentY)`

Отрисовывает подсветку иерархии для дублируемых групп.

**Параметры:**
- `group` (Object) - дублируемая группа
- `depth` (number) - глубина вложенности (по умолчанию 0)
- `parentX` (number) - X координата родителя (по умолчанию 0)
- `parentY` (number) - Y координата родителя (по умолчанию 0)

**Особенности:**
- Прозрачность затухает по глубине (decay = 0.6)
- Рекурсивный обход вложенных групп
- Использует прямое вычисление координат

## DuplicateUtils (упрощено в v2.3.2)

Утилиты позиционирования дублируемых объектов.

### Методы

##### `updatePositions(objects, worldPos)`

Обновляет позиции объектов относительно курсора.

**Параметры:**
- `objects` (Array) - массив объектов
- `worldPos` (Object) - мировые координаты

**Возвращает:** `Array` - обновленные объекты

##### `initializePositions(objects, worldPos)`

Инициализирует относительные позиции объектов.

**Параметры:**
- `objects` (Array) - массив объектов
- `worldPos` (Object) - базовые мировые координаты

**Возвращает:** `Array` - объекты с инициализированными смещениями

##### `hasPositionChanged(firstObj, worldPos, threshold)`

Проверяет изменение позиции объекта.

**Параметры:**
- `firstObj` (Object) - первый объект для проверки
- `worldPos` (Object) - текущая позиция курсора
- `threshold` (number) - порог изменения (по умолчанию 1)

**Возвращает:** `boolean` - true если позиция изменилась

## EventHandlers

### Конструктор

```javascript
new EventHandlers(editor)
```

**Параметры:**
- `editor` (LevelEditor) - экземпляр редактора

### Основные методы

#### setupEventListeners()
Инициализация всех слушателей событий.

```javascript
setupEventListeners()
```

#### toggleViewOption(option)
Переключение режимов отображения из View меню.

```javascript
toggleViewOption(option)
```

**Параметры:**
- `option` (string) - название опции ('grid', 'gameMode', 'snapToGrid', 'objectBoundaries', 'objectCollisions')

#### initializeViewStates()
Инициализация состояний View меню при запуске редактора.

```javascript
initializeViewStates()
```

#### toggleGameMode(enabled)
Переключение игрового режима (скрытие/показ UI панелей).

#### saveViewStates() (v2.6.3)
Сохранение текущих состояний View меню команд.

**Возвращает:** `Object` - объект с состояниями View настроек

#### applySavedViewStates(savedStates) (v2.6.3)
Применение сохраненных состояний View меню.

**Параметры:**
- `savedStates` (Object) - сохраненные состояния View

#### updateViewCheckbox(option, enabled) (v2.6.3)
Обновление состояния чекбокса в View меню.

**Параметры:**
- `option` (string) - название опции
- `enabled` (boolean) - новое состояние

```javascript
toggleGameMode(enabled)
```

**Параметры:**
- `enabled` (boolean) - включить игровой режим

#### updateViewCheckbox(option, enabled)
Обновление состояния чекбокса в View меню.

```javascript
updateViewCheckbox(option, enabled)
```

**Параметры:**
- `option` (string) - название опции
- `enabled` (boolean) - состояние чекбокса

## MouseHandlers

Модуль обработки событий мыши и интерактивного взаимодействия.

### Конструктор

```javascript
new MouseHandlers(levelEditor)
```

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

### Основные методы

#### handleMouseDown(e)
Обработка нажатия кнопок мыши.

```javascript
handleMouseDown(e)
```

**Параметры:**
- `e` (MouseEvent) - событие мыши

**Поддерживаемые кнопки:**
- `button === 0` - левая кнопка (выделение, перетаскивание)
- `button === 1` - средняя кнопка (интерактивный зум) **[v2.6.9]**
- `button === 2` - правая кнопка (перемещение камеры)

#### handleMiddleMouseZoom(e) **[v2.6.9]**
Обработка интерактивного зума средней кнопкой мыши.

```javascript
handleMiddleMouseZoom(e)
```

**Параметры:**
- `e` (MouseEvent) - событие мыши

**Особенности:**
- Зум происходит относительно точки нажатия
- Визуальная обратная связь через курсор zoom-in
- Чувствительность: 0.01 (настраивается)
- Диапазон зума: 0.1x - 10x

#### handleWheel(e)
Обработка зума колесиком мыши.

```javascript
handleWheel(e)
```

**Параметры:**
- `e` (WheelEvent) - событие колесика мыши

## BaseModule

Базовый класс для всех модулей редактора с общими helper-методами.

### Конструктор

```javascript
new BaseModule(levelEditor)
```

**Параметры:**
- `levelEditor` (LevelEditor) - экземпляр редактора

### Helper-методы

#### isMiddleMouseDown() **[v2.6.9]**
Проверка нажатия средней кнопки мыши.

```javascript
isMiddleMouseDown()
```

**Возвращает:** `boolean` - true если средняя кнопка нажата

#### isLeftMouseDown()
Проверка нажатия левой кнопки мыши.

```javascript
isLeftMouseDown()
```

**Возвращает:** `boolean` - true если левая кнопка нажата

#### isRightMouseDown()
Проверка нажатия правой кнопки мыши.

```javascript
isRightMouseDown()
```

**Возвращает:** `boolean` - true если правая кнопка нажата

## Обработка ошибок

### Типы ошибок

1. **Ошибки валидации** - неверные данные
2. **Ошибки файлов** - проблемы с загрузкой/сохранением
3. **Ошибки рендеринга** - проблемы с отображением
4. **Ошибки состояния** - неконсистентное состояние
5. **Ошибки дублирования** - проблемы с клонированием объектов
6. **Ошибки режима групп** - проблемы с редактированием групп

### Обработка ошибок

```javascript
try {
    const level = await fileManager.loadLevel(file);
} catch (error) {
    console.error('Failed to load level:', error);
    alert('Error loading level: ' + error.message);
}
```

## Производительность

### Оптимизации

1. **Кэширование изображений** - изображения загружаются один раз
2. **Ленивая загрузка** - ресурсы загружаются по требованию
3. **Батчинг операций** - группировка множественных изменений
4. **Отсечение невидимых объектов** - рендеринг только видимых объектов

### Мониторинг производительности

```javascript
// Измерение времени выполнения
const startTime = performance.now();
// ... операция
const endTime = performance.now();
console.log(`Operation took ${endTime - startTime} milliseconds`);
```

## Безопасность

### Валидация данных

```javascript
// Проверка типа
if (typeof value !== 'number' || isNaN(value)) {
    throw new Error('Value must be a valid number');
}

// Проверка диапазона
if (value < 0 || value > 100) {
    throw new Error('Value must be between 0 and 100');
}

// Санитизация строк
const sanitized = value.replace(/[<>]/g, '');
```

### Ограничения

1. **Размер файлов** - ограничение на размер загружаемых файлов
2. **Количество объектов** - ограничение на количество объектов в уровне
3. **Глубина вложенности** - ограничение на глубину групп
4. **Размер истории** - ограничение на размер стека Undo/Redo

---

## Обновления v3.35.0-3.37.0

### EditorConstants (v3.36.0)

**Файл**: `src/constants/EditorConstants.js`

Централизованные константы редактора, устраняющие magic numbers и улучшающие maintainability.

#### DEFAULT_OBJECT

```javascript
DEFAULT_OBJECT: {
    WIDTH: 32,
    HEIGHT: 32,
    COLOR: '#cccccc',
    VISIBLE: true,
    LOCKED: false
}
```

#### PERFORMANCE

```javascript
PERFORMANCE: {
    CACHE_TIMEOUT_MS: 100,
    SPATIAL_GRID_SIZE: 256,
    MAX_HISTORY_SIZE: 100,
    RENDER_THROTTLE_MS: 16,
    MOUSE_MOVE_THROTTLE_MS: 8,
    WHEEL_THROTTLE_MS: 16,
    RESIZE_DEBOUNCE_MS: 150,
    INPUT_DEBOUNCE_MS: 300
}
```

**Применение**: DuplicateOperations, RenderOperations, ErrorHandler, MouseHandlers

---

### PerformanceUtils (v3.37.0)

**Файл**: `src/utils/PerformanceUtils.js`

Утилиты для оптимизации производительности.

#### throttle(fn, delay)

Ограничивает частоту вызова функции.

```javascript
import { throttle } from './utils/PerformanceUtils.js';

const throttledMove = throttle((e) => handleMove(e), 16);
canvas.addEventListener('mousemove', throttledMove);
```

#### debounce(fn, delay)

Откладывает выполнение до паузы.

```javascript
const debouncedSearch = debounce((query) => search(query), 300);
input.addEventListener('input', (e) => debouncedSearch(e.target.value));
```

#### memoize(fn, keyFn)

Кэширует результаты чистых функций.

```javascript
const memoizedCalc = memoize((x, y) => expensiveCalc(x, y));
const result = memoizedCalc(5, 10); // Вычисляет
const cached = memoizedCalc(5, 10); // Из кэша
```

#### LRUCache

LRU кэш с автоматическим вытеснением.

```javascript
import { LRUCache } from './utils/PerformanceUtils.js';

const cache = new LRUCache(100);
cache.set('key', value);
const val = cache.get('key');
```

**Применение**: MouseHandlers throttled (8ms mousemove, 16ms wheel), CPU -20-30%

---

### ErrorHandler JSDoc (v3.35.0)

**Файл**: `src/utils/ErrorHandler.js`

**Обновления:**
- 100% JSDoc типизация (17 методов)
- Документация Custom Error классов (4 класса)
- 10+ примеров использования
- Полная IDE поддержка

См. исходный код для детальной документации всех методов.

---

*Последнее обновление: 2025-10-05 | Версия: 3.37.0*
