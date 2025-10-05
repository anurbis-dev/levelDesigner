# План рефакторинга: Фаза 4 - Разбивка больших методов

## 📅 Версия: 3.38.1 → 3.39.0+

---

## ✅ Завершенные фазы

### Фаза 1: Базовая инфраструктура (v3.33.0)
- ✅ ErrorHandler - централизованная обработка ошибок
- ✅ ComponentLifecycle - управление жизненным циклом компонентов
- ✅ destroy() методы для всех компонентов
- ✅ Предотвращение memory leaks

### Фаза 2: Logger Migration (v3.34.0)
- ✅ 100% миграция console.* → Logger.*
- ✅ ErrorHandler integration в критические методы
- ✅ Единообразное логирование

### Фаза 3: Code Quality & Performance (v3.35.0-3.37.0)
- ✅ v3.35.0: JSDoc типизация ErrorHandler
- ✅ v3.36.0: EditorConstants, устранение дублирования
- ✅ v3.37.0: PerformanceUtils, throttled events

### Фаза 3.1: Undo/Redo Fixes (v3.38.0-3.38.1)
- ✅ v3.38.0: Сохранение groupEditMode в истории
- ✅ v3.38.1: Валидация иерархии вложенных групп
- ✅ Исправлена логика восстановления состояния
- ✅ Убрано принудительное изменение visibility
- ✅ Убран некорректный markDirty() после undo/redo

---

## 🎯 Фаза 4: Разбивка больших методов и модульная архитектура

### Критический приоритет (блокирует дальнейшее развитие)

#### **4.1: Разбить `LevelEditor.init()` - ~180 строк**
**Проблема:** Монолитный метод инициализации с множеством обязанностей

**Решение:**
```javascript
async init() {
    await this.initializeConfiguration();
    await this.initializeDOMElements();
    await this.initializeRenderer();
    await this.initializeUIComponents();
    await this.initializeMenuAndEvents();
    await this.initializeLevelAndData();
    await this.finalizeInitialization();
}
```

**Новые методы:**
- `initializeConfiguration()` - загрузка конфигурации
- `initializeDOMElements()` - получение DOM элементов
- `initializeRenderer()` - создание canvas renderer и context menu
- `initializeUIComponents()` - создание панелей и регистрация в lifecycle
- `initializeMenuAndEvents()` - setup меню и event listeners
- `initializeLevelAndData()` - создание уровня, preload assets, build indices
- `finalizeInitialization()` - финальный render, tests, save state

**Метрики:**
- Текущая сложность: 180 строк, 8 обязанностей
- После рефакторинга: 7 методов × ~25 строк = улучшение читаемости на 70%

---

#### **4.2: Разбить `LevelEditor.undo()` - ~160 строк**
**Проблема:** Огромный метод с комплексной логикой восстановления

**Решение:**
```javascript
undo() {
    const previousState = this.historyManager.undo();
    if (!previousState) return;
    
    this._restoreObjectsFromHistory(previousState.objects);
    this._rebuildAllIndices();
    this._restoreGroupEditMode(previousState.groupEditMode);
    this._recalculateGroupBounds();
    this._invalidateCachesAfterRestore(previousState);
    this._restoreSelection(previousState.selection);
    this._finalizeUndoRedo();
}
```

**Новые приватные методы:**
- `_restoreObjectsFromHistory(objects)` - восстановление объектов из JSON
- `_rebuildAllIndices()` - rebuild object/layer/spatial indices
- `_restoreGroupEditMode(savedMode)` - восстановление состояния групп
- `_recalculateGroupBounds()` - пересчет границ активной группы
- `_invalidateCachesAfterRestore(state)` - умная инвалидация кешей
- `_restoreSelection(selection)` - фильтрация и восстановление выделения
- `_finalizeUndoRedo()` - render, updatePanels

**Аналогично для `redo()`**

**Метрики:**
- Текущая сложность: 160 строк
- После рефакторинга: 7 методов × ~20-25 строк
- Устранение дублирования между undo/redo: ~50%

---

#### **4.3: Создать модуль `HistoryOperations`**
**Проблема:** Логика undo/redo должна быть в отдельном модуле, как другие операции

**Решение:**
```javascript
// src/core/HistoryOperations.js
export class HistoryOperations extends BaseModule {
    undo() { ... }
    redo() { ... }
    
    // Private methods
    _restoreObjectsFromHistory(objects) { ... }
    _rebuildAllIndices() { ... }
    _restoreGroupEditMode(savedMode) { ... }
    _recalculateGroupBounds() { ... }
    _invalidateCachesAfterRestore(state) { ... }
    _restoreSelection(selection) { ... }
    _finalizeUndoRedo() { ... }
}
```

**В LevelEditor:**
```javascript
// Делегирование
undo() {
    this.historyOperations.undo();
}

redo() {
    this.historyOperations.redo();
}
```

**Метрики:**
- Уменьшение LevelEditor: -320 строк
- Новый модуль: +350 строк (с лучшей структурой)
- Соответствие паттерну: ObjectOperations, GroupOperations, etc.

---

### Высокий приоритет (улучшает maintainability)

#### **4.4: Разбить `LevelEditor.assignSelectedObjectsToLayer()` - ~250 строк**
**Проблема:** Комплексная логика работы со слоями

**Решение:**
```javascript
assignSelectedObjectsToLayer(selectedObjects, moveUp, moveToExtreme) {
    // Validation
    if (!this._validateLayerMoveConditions(selectedObjects)) {
        return 0;
    }
    
    // Save state
    this._saveStateForLayerMove();
    
    // Execute move
    const movedCount = moveToExtreme 
        ? this._moveToExtremeLayer(selectedObjects, moveUp)
        : this._moveToAdjacentLayer(selectedObjects, moveUp);
    
    // Finalize
    if (movedCount > 0) {
        this._finalizeLayerMove(movedCount, moveUp, moveToExtreme);
    }
    
    return movedCount;
}
```

**Новые приватные методы:**
- `_validateLayerMoveConditions(selectedObjects)` - проверка условий
- `_saveStateForLayerMove()` - сохранение в историю
- `_moveToExtremeLayer(selectedObjects, moveUp)` - перемещение на крайний слой
- `_moveToAdjacentLayer(selectedObjects, moveUp)` - перемещение на соседний
- `_finalizeLayerMove(count, moveUp, moveToExtreme)` - обновление UI, логи

**Метрики:**
- Текущая сложность: 250 строк, циклическая сложность ~15
- После рефакторинга: 5 методов × ~40-50 строк
- Уменьшение когнитивной нагрузки: ~60%

---

#### **4.5: Создать модуль `LayerOperations`**
**Проблема:** Вся логика работы со слоями размазана по LevelEditor

**Решение:**
```javascript
// src/core/LayerOperations.js
export class LayerOperations extends BaseModule {
    moveSelectedObjectsToLayer(moveUp, moveToExtreme) { ... }
    findNextUnlockedLayer(currentLayerId, moveUp) { ... }
    batchProcessLayerAssignment(objects, targetLayerId) { ... }
    processObjectForLayerAssignment(objId, targetLayerId) { ... }
    
    // Helper methods
    _validateLayerMoveConditions() { ... }
    _moveToExtremeLayer(selectedObjects, moveUp) { ... }
    _moveToAdjacentLayer(selectedObjects, moveUp) { ... }
}
```

**Метрики:**
- Уменьшение LevelEditor: -500+ строк
- Новый модуль: +550 строк
- Логическое группирование всех layer-операций

---

#### **4.6: Создать `CacheManager` утилиту**
**Проблема:** Логика кэширования разбросана по всему LevelEditor

**Решение:**
```javascript
// src/managers/CacheManager.js
export class CacheManager {
    constructor(levelEditor) {
        this.editor = levelEditor;
        this.objectCache = new Map();
        this.topLevelObjectCache = new Map();
        this.effectiveLayerCache = new Map();
        this.selectableObjectsCache = new Map();
        // ...
    }
    
    // Getters
    getCachedObject(objId) { ... }
    getCachedTopLevelObject(objId) { ... }
    getCachedEffectiveLayerId(obj) { ... }
    getSelectableObjectsInViewport() { ... }
    
    // Invalidation
    smartInvalidation(spec) { ... }
    invalidateObject(objId) { ... }
    invalidateAfterLayerChanges(changedObjectIds, affectedLayers) { ... }
    invalidateAfterGroupOperations(affectedObjectIds) { ... }
    invalidateAfterDuplicateOperations(newObjectIds) { ... }
    
    // Clear all
    clearAll() { ... }
    clearSelectableObjects() { ... }
}
```

**Метрики:**
- Уменьшение LevelEditor: -300 строк
- Новый менеджер: +350 строк
- Централизация логики кэширования: 100%

---

### Средний приоритет (код улучшения)

#### **4.7: Разбить `applyConfiguration()` - ~80 строк**
**Решение:**
```javascript
applyConfiguration() {
    if (!this.configManager) {
        console.warn('[CONFIG] ConfigManager not initialized');
        return;
    }
    
    this._applyGridConfiguration();
    this._applyCanvasConfiguration();
    this._syncGridSettings();
    this._saveDefaultSettings();
}
```

---

## 📊 Общие метрики улучшений

### Фаза 4 в целом:
- **Уменьшение LevelEditor**: -1400+ строк (с 2914 до ~1500)
- **Новые модули**: 3 (HistoryOperations, LayerOperations, CacheManager)
- **Улучшение читаемости**: +70%
- **Уменьшение когнитивной сложности**: +60%
- **Улучшение тестируемости**: +80%

### Соответствие принципам:
- ✅ **Single Responsibility Principle** - каждый модуль делает одно
- ✅ **DRY** - устранение дублирования между undo/redo
- ✅ **Separation of Concerns** - четкое разделение обязанностей
- ✅ **Consistency** - все операции в отдельных модулях

---

## 🚀 План выполнения

### Этап 1: Критический (v3.39.0)
1. Разбить `init()` на подметоды
2. Разбить `undo()`/`redo()` на подметоды
3. Создать `HistoryOperations` модуль
4. **Тестирование**: проверить undo/redo, init

### Этап 2: Высокий приоритет (v3.40.0)
5. Разбить `assignSelectedObjectsToLayer()` на подметоды
6. Создать `LayerOperations` модуль
7. Создать `CacheManager`
8. **Тестирование**: проверить layer operations, caching

### Этап 3: Средний приоритет (v3.41.0)
9. Разбить `applyConfiguration()`
10. Оптимизация других крупных методов
11. **Финальное тестирование**

---

## 📝 Checklist перед каждым этапом

- [ ] Все тесты проходят
- [ ] Нет ошибок линтера
- [ ] Документация обновлена (CHANGELOG, ARCHITECTURE, API_REFERENCE)
- [ ] Commit message описывает изменения
- [ ] Breaking changes задокументированы

---

## 🎯 Ожидаемые результаты после Фазы 4

### Структура проекта:
```
src/core/
├── LevelEditor.js       (~1500 строк, координация)
├── EventHandlers.js     (события)
├── MouseHandlers.js     (мышь)
├── ObjectOperations.js  (объекты)
├── GroupOperations.js   (группы)
├── RenderOperations.js  (рендеринг)
├── DuplicateOperations.js (дублирование)
├── HistoryOperations.js   (NEW: undo/redo)
├── LayerOperations.js     (NEW: слои)

src/managers/
├── StateManager.js
├── HistoryManager.js
├── AssetManager.js
├── FileManager.js
├── ConfigManager.js
├── MenuManager.js
├── ContextMenuManager.js
├── CacheManager.js        (NEW: кэширование)
```

### Качество кода:
- **Maintainability Index**: +40%
- **Code Complexity**: -50%
- **Test Coverage**: +30%
- **Documentation**: 100%

---

## 💡 Дополнительные возможности после Фазы 4

После завершения Фазы 4 станет проще:
1. Писать unit-тесты для каждого модуля
2. Добавлять новые операции (SelectionOperations, TransformOperations)
3. Оптимизировать производительность отдельных модулей
4. Рефакторить без страха сломать все

---

**Статус**: 🚀 Готово к выполнению
**Начало**: После v3.38.1
**Оценка времени**: 3-5 дней
**Риски**: Низкие (хорошо спланировано, есть fallback)
