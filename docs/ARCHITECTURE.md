# Архитектура Level Editor v3.4.0

## 🏗️ Утилитарная архитектура

**Принципы**: DRY, SOLID, Clean Code, единые точки изменений

**Компоненты:**
- **8 утилитарных классов** - централизованная бизнес-логика
- **7 менеджеров** - управление состоянием и ресурсами
- **BaseModule паттерн** - 25+ helper-методов для всех модулей
- **Полное устранение дублирования** - централизованные алгоритмы

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

## 🎨 Система слоев v3.4.0

### Архитектурные решения
- **Полная изоляция видимости**: объекты скрытого слоя не выделяются
- **Унифицированная проверка**: `computeSelectableSet()` проверяет видимость
- **Кеширование**: `getVisibleLayerIds()` для производительности
- **Автоочистка**: selection снимается при скрытии слоя
- **Закрытие групп**: открытые группы закрываются автоматически
- **Outliner независимость**: работает со скрытыми объектами
- **Привязка View опций**: Boundaries/Collisions учитывают видимость

### Проверенные точки взаимодействия
- ✅ `ObjectOperations.computeSelectableSet()` - фильтрация по видимости
- ✅ `MouseHandlers.finishMarqueeSelection()` - рамка выделения
- ✅ `RenderOperations.getVisibleObjects()` - рендеринг только видимых
- ✅ `LayersPanel.handleLayerVisibilityChanged()` - управление видимостью

---

*Проект следует принципам Clean Code, SOLID, DRY с полной проверкой всех точек взаимодействия при добавлении функционала.*