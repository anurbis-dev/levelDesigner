# Архитектура Level Editor v3.6.0

## 🏗️ Утилитарная архитектура

**Принципы**: DRY, SOLID, Clean Code, единые точки изменений

**Компоненты:**
- **8 утилитарных классов** - централизованная бизнес-логика
- **7 менеджеров** - управление состоянием и ресурсами
- **BaseModule паттерн** - 25+ helper-методов для всех модулей
- **Строгая типизация объектов** - все объекты имеют правильные типы GameObject/Group
- **Полное устранение дублирования** - централизованные алгоритмы
- **Безопасная сериализация** - корректная работа toJSON() для всех объектов

---

## 🛠️ Утилиты

### ContextMenuManager
**Файл**: `src/managers/ContextMenuManager.js`
- Централизованное управление контекстными меню
- Автоматическое закрытие конфликтующих меню
- Синхронизация состояний панорамирования

### WorldPositionUtils
**Файл**: `src/utils/WorldPositionUtils.js`
- Расчет мировых координат в иерархии групп
- Устранено дублирование: было 3 копии алгоритма
- Методы: getWorldPosition, getWorldBounds, isPointInWorldBounds

### GroupTraversalUtils
**Файл**: `src/utils/GroupTraversalUtils.js`
- Система обхода иерархии групп
- 12 методов работы с группами
- Устранено дублирование: было 4 копии алгоритмов

### UIFactory
**Файл**: `src/utils/UIFactory.js`
- Унифицированное создание UI элементов
- 10 методов создания компонентов
- Устранено дублирование CSS классов

### Logger
**Файл**: `src/utils/Logger.js`
- Профессиональная система логирования
- 17 категорий, 4 уровня (DEBUG, INFO, WARN, ERROR)
- 73 лога мигрировано из 10 файлов

### FileUtils & RenderUtils & DuplicateUtils & GitUtils
- FileUtils: универсальные файловые операции
- RenderUtils: параметризованная система отрисовки
- DuplicateUtils: операции дублирования объектов
- GitUtils: интеграция с Git

---

## 📊 Менеджеры системы

### StateManager
**Файл**: `src/managers/StateManager.js`
- Централизованное управление состоянием
- Кеширование для производительности
- Синхронизация между компонентами

### HistoryManager
**Файл**: `src/managers/HistoryManager.js`
- Полная поддержка Undo/Redo
- Оптимизированное хранение изменений
- Автоматическое управление памятью

### AssetManager & FileManager
- AssetManager: управление библиотекой ассетов
- FileManager: сохранение/загрузка уровней

### MenuManager & ConfigManager & UserPreferencesManager
- MenuManager: централизованное управление меню
- ConfigManager: управление конфигурацией
- UserPreferencesManager: предпочтения пользователя

---

## 🎨 Система слоев v3.4.1

### Архитектурные решения v3.4.1
- **Полная изоляция видимости**: объекты скрытого слоя не выделяются
- **Унифицированная проверка**: `computeSelectableSet()` проверяет видимость
- **Кеширование**: `getVisibleLayerIds()` для производительности
- **Автоочистка**: selection снимается при скрытии слоя
- **Закрытие групп**: открытые группы закрываются автоматически
- **Outliner независимость**: работает со скрытыми объектами
- **Привязка View опций**: Boundaries/Collisions учитывают видимость
- **Наследование layerId**: вложенные объекты наследуют слой от родительской группы

### Наследование layerId для групп

**Принцип работы:**
- **Группы как объекты**: каждая группа может иметь собственный `layerId`
- **Наследование вниз**: вложенные объекты наследуют `layerId` от ближайшей родительской группы
- **Приоритет собственного layerId**: объект использует свой `layerId`, если он установлен
- **Fallback на Main layer**: если ни объект, ни его группы не имеют `layerId`

**Алгоритм наследования:**
```
Если объект имеет layerId → использовать его
Иначе искать вверх по иерархии ближайшую группу с layerId
Если найдена группа с layerId → наследовать его
Иначе использовать Main layer
```

**Преимущества:**
- ✅ **Организация контента**: объекты группируются логически по слоям
- ✅ **Массовое управление**: изменение layerId группы влияет на все вложенные объекты
- ✅ **Гибкость**: отдельные объекты могут переопределять слой группы
- ✅ **Производительность**: эффективный поиск эффективного layerId

### Улучшенная архитектура изменения слоев

**Новые методы v3.4.1:**
- ✅ `LevelEditor.assignSelectedObjectsToLayer()` - координация изменения слоя для всех выбранных объектов
- ✅ `LevelEditor.processObjectForLayerAssignment()` - обработка индивидуального объекта/группы
- ✅ `Logger.layer` - специализированное логирование операций со слоями

**Принцип работы новой архитектуры:**
```
1. Выбор объектов → assignSelectedObjectsToLayer()
2. Для каждого объекта → processObjectForLayerAssignment()
3. Нахождение top-level объекта (группы)
4. Предотвращение дублирования обработки
5. Изменение layerId только у top-level объекта
6. Корректное обновление счетчиков и уведомлений
```

**Безопасность и надежность:**
- ✅ Проверки существования `renderOperations` перед вызовом
- ✅ Fallback логика при отсутствии компонентов
- ✅ Предотвращение ошибок "Cannot read properties of undefined"
- ✅ Graceful degradation при проблемах инициализации

### Проверенные точки взаимодействия
- ✅ `ObjectOperations.computeSelectableSet()` - фильтрация по видимости с учетом наследования
- ✅ `MouseHandlers.finishMarqueeSelection()` - рамка выделения
- ✅ `RenderOperations.getVisibleObjects()` - рендеринг только видимых с учетом наследования
- ✅ `RenderOperations.getEffectiveLayerId()` - расчет эффективного layerId
- ✅ `DetailsPanel.getEffectiveLayerId()` - отображение правильного слоя в UI
- ✅ `LayersPanel.handleLayerVisibilityChanged()` - управление видимостью

---

## 🔧 Архитектура типизации объектов v3.6.0

### Проблема
До версии 3.6.0 существовала критическая проблема с типизацией объектов:
- Объекты создавались как plain JavaScript objects вместо экземпляров классов
- Отсутствовали методы `toJSON()`, `clone()` и другие
- Возникала ошибка `child.toJSON is not a function` при сериализации групп

### Решение
**Полная переработка системы создания и управления объектами:**

#### 1. Гарантированная типизация при создании
```javascript
// Asset.createInstance() - исправлено
createInstance(x, y) {
    const instanceData = { /* ... */ };
    return new GameObject(instanceData); // Вместо plain object
}
```

#### 2. Сохранение типов при клонировании
```javascript
// LevelEditor.deepClone() - исправлено
deepClone(obj) {
    if (obj.type === 'group') {
        return new Group({ ...obj, children: obj.children.map(this.deepClone) });
    } else {
        return new GameObject(obj);
    }
}
```

#### 3. Проверка типов при добавлении
```javascript
// Level.addObject() - исправлено
addObject(obj) {
    let properObj = obj;
    if (!(obj instanceof GameObject) && !(obj instanceof Group)) {
        if (obj.type === 'group') {
            properObj = new Group(obj);
        } else {
            properObj = new GameObject(obj);
        }
    }
    // ... добавление в уровень
}
```

#### 4. Защита от plain objects в группах
```javascript
// Group.addChild() - исправлено
addChild(child) {
    let properChild = child;
    if (!(child instanceof GameObject)) {
        if (child.type === 'group') {
            properChild = new Group(child);
        } else {
            properChild = new GameObject(child);
        }
    }
    this.children.push(properChild);
}
```

### Архитектурные преимущества

#### ✅ **Надежность и безопасность**
- Все объекты имеют полную функциональность
- Отсутствие ошибок сериализации
- Корректная работа HistoryManager

#### ✅ **Единые точки изменений**
- Все проверки типов централизованы
- Легко добавлять новые типы объектов
- Простое расширение функциональности

#### ✅ **Обратная совместимость**
- Plain objects автоматически преобразуются
- Существующий код продолжает работать
- Плавная миграция на новую архитектуру

#### ✅ **Производительность**
- Минимальные накладные расходы на проверки
- Быстрое создание экземпляров
- Оптимизированная сериализация

### Проверенные точки взаимодействия
- ✅ `Asset.createInstance()` - создание из ассетов
- ✅ `LevelEditor.deepClone()` - дублирование объектов
- ✅ `Level.addObject()` - добавление в уровень
- ✅ `Group.addChild()` - добавление в группы
- ✅ `GroupOperations.groupSelectedObjects()` - группировка
- ✅ `DuplicateOperations` - операции дублирования
- ✅ `HistoryManager.saveState()` - сериализация истории

---

*Проект следует принципам Clean Code, SOLID, DRY с полной проверкой всех точек взаимодействия при добавлении функционала.*