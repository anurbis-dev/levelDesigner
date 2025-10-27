### UnifiedTouchManager (src/event-system/UnifiedTouchManager.js)
Унифицированная система тач-событий.

#### Основные методы:
- `registerElement(element, configType, customConfig, elementId)` - регистрация элемента
- `unregisterElement(element)` - отмена регистрации
- `destroy()` - уничтожение менеджера
- `calculateHorizontalPanelSize()` - расчет размера горизонтальных панелей
- `calculateVerticalPanelSize()` - расчет размера вертикальных панелей

### GlobalEventRegistry (src/event-system/GlobalEventRegistry.js)
Глобальная регистрация событий компонентов.

#### Основные методы:
- `registerComponentHandlers(componentId, handlers, target)` - регистрация глобальных событий
- `unregisterComponentHandlers(componentId)` - отмена регистрации
- `isComponentRegistered(componentId)` - проверка регистрации
- `getRegisteredComponents()` - получение списка компонентов
- `cleanup()` - очистка всех компонентов

### HistoryManager (src/managers/HistoryManager.js)
Управление историей операций.

#### Основные методы:
- `saveState(state, isInitial)` - сохранение состояния
- `undo()` - отмена операции
- `redo()` - повтор операции
- `canUndo()` - проверка возможности отмены
- `canRedo()` - проверка возможности повтора
- `clear()` - очистка истории

### AssetManager (src/managers/AssetManager.js)
Управление ассетами.

#### Основные методы:
- `loadDefaultAssets()` - загрузка стандартных ассетов
- `addAsset(assetData)` - добавление ассета
- `removeAsset(assetId)` - удаление ассета
- `getAsset(assetId)` - получение ассета по ID
- `getAllAssets()` - получение всех ассетов
- `getAssetsByCategory(category)` - получение ассетов по категории
- `getCategories()` - получение всех категорий
- `searchAssets(query)` - поиск ассетов

### FileManager (src/managers/FileManager.js)
Управление файлами.

#### Основные методы:
- `createNewLevel()` - создание нового уровня
- `saveLevel(level, fileName)` - сохранение уровня
- `async loadLevel(file)` - загрузка уровня
- `async loadLevelFromFileInput()` - загрузка уровня из файла
- `isValidFile(file)` - проверка валидности файла
- `getCurrentFileName()` - получение текущего имени файла
- `setCurrentFileName(fileName)` - установка имени файла

### ConfigManager (src/managers/ConfigManager.js)
Централизованное управление всеми настройками редактора.

#### Основные методы:
- `async loadAllConfigs()` - загрузка всех конфигураций
- `async loadUserConfig(configName)` - загрузка пользовательской конфигурации
- `async saveUserConfig(configName, config)` - сохранение пользовательской конфигурации
- `get(path)` - получение настройки по пути
- `set(path, value)` - установка настройки
- `getAll()` - получение всех конфигураций
- `reset()` - сброс к значениям по умолчанию

### UserPreferencesManager (src/managers/UserPreferencesManager.js)
Управление пользовательскими предпочтениями.

#### Основные методы:
- `loadPreferences()` - загрузка предпочтений
- `savePreferences()` - сохранение предпочтений
- `get(key)` - получение предпочтения
- `set(key, value)` - установка предпочтения
- `update(updates)` - обновление предпочтений
- `reset()` - сброс предпочтений
- `getAll()` - получение всех предпочтений

### CacheManager (src/managers/CacheManager.js)
Управление кэшированием данных.

#### Основные методы:
- `getCachedObject(objId)` - получение кэшированного объекта
- `getCachedTopLevelObject(objId)` - получение верхнеуровневого объекта
- `getCachedEffectiveLayerId(obj)` - получение эффективного ID слоя
- `clearCaches()` - очистка всех кэшей
- `invalidateObjectCaches(objId)` - инвалидация кэшей объекта
- `smartCacheInvalidation(invalidationSpec)` - умная инвалидация кэша

### ResizerManager (src/managers/ResizerManager.js)
Унифицированный менеджер для всех разделителей панелей.

#### Основные методы:
- `registerResizer(resizer, panel, panelSide, direction, onDoubleClick)` - регистрация разделителя
- `unregisterResizer(resizer)` - удаление разделителя
- `setupMouseEvents(resizer, panel, panelSide, direction)` - настройка mouse событий
- `setupTouchEvents(resizer, panel, panelSide, direction)` - настройка touch событий
- `handlePanelResize(panel, panelSide, direction, newSize)` - унифицированная логика изменения размера
- `savePanelSize(panelSide, direction, size)` - сохранение размера панели
- `destroy()` - уничтожение менеджера и очистка всех разделителей

---

### BaseModule (src/core/BaseModule.js)
Базовый класс для всех модулей редактора.

#### Методы состояния группы:
- `isInGroupEditMode()` - проверка режима редактирования группы
- `getActiveGroup()` - получение активной группы
- `getGroupEditMode()` - получение состояния режима редактирования группы

#### Методы мыши:
- `isAltKeyPressed()` - проверка нажатия Alt
- `updateMouseState(e, worldPos)` - обновление состояния мыши
- `getMouseState()` - получение состояния мыши
- `getCameraState()` - получение состояния камеры
- `isLeftMouseDown()` - проверка нажатия левой кнопки мыши
- `isRightMouseDown()` - проверка нажатия правой кнопки мыши
- `isDragging()` - проверка перетаскивания
- `isMarqueeSelecting()` - проверка выделения рамкой

#### Методы выделения:
- `getSelectedObjects()` - получение выделенных объектов
- `clearSelection()` - очистка выделения
- `selectObjects(objectIds)` - выделение объектов по ID

---

### DuplicateOperations (src/core/DuplicateOperations.js)
Операции дублирования объектов.

#### Основные методы:
- `startFromSelection()` - начало дублирования из выделения
- `updatePreview(worldPos)` - обновление превью дублирования
- `confirmPlacement(worldPos)` - подтверждение размещения
- `cancel()` - отмена дублирования

### GroupOperations (src/core/GroupOperations.js)
Операции с группами.

#### Основные методы:
- `groupSelectedObjects()` - группировка выделенных объектов
- `openGroupEditMode(group)` - открытие режима редактирования группы
- `closeGroupEditMode()` - закрытие режима редактирования группы
- `ungroupSelectedObjects()` - разгруппировка выделенных объектов
- `removeEmptyGroup(targetGroup)` - удаление пустой группы
- `removeEmptyGroups()` - удаление всех пустых групп
- `extractObjectFromGroup(group, childObject)` - извлечение объекта из группы

### MouseHandlers (src/core/MouseHandlers.js)
Обработчики мыши.

#### Основные обработчики:
- `handleMouseDown(e)` - обработка нажатия мыши
- `handleMouseMove(e)` - обработка движения мыши
- `handleMouseUp(e)` - обработка отпускания мыши
- `handleGlobalMouseMove(e)` - глобальное движение мыши
- `handleGlobalMouseUp(e)` - глобальное отпускание мыши
- `handleWheel(e)` - обработка колесика мыши

### ObjectOperations (src/core/ObjectOperations.js)
Операции с объектами.

#### Поиск и проверки:
- `findObjectAtPoint(x, y)` - поиск объекта в точке
- `isPointInObject(x, y, obj)` - проверка точки в объекте
- `isObjectInGroup(obj, group)` - проверка объекта в группе
- `isObjectInGroupRecursive(obj, group)` - рекурсивная проверка объекта в группе

#### Операции с объектами:
- `deleteSelectedObjects()` - удаление выделенных объектов
- `duplicateSelectedObjects()` - дублирование выделенных объектов
- `focusOnSelection()` - фокус на выделении
- `focusOnAll()` - фокус на всех объектах

### RenderOperations (src/core/RenderOperations.js)
Операции отрисовки.

#### Основные методы:
- `render()` - основная отрисовка
- `drawSelection()` - отрисовка выделения
- `drawGroupEditFrame()` - отрисовка рамки редактирования группы
- `getVisibleObjects(camera)` - получение видимых объектов
- `isObjectVisible(obj, left, top, right, bottom)` - проверка видимости объекта

---

### Level (src/models/Level.js)
Модель уровня с поддержкой системы слоев.

#### Основные методы:
- `constructor(data)` - создание уровня
- `addObject(obj)` - добавление объекта
- `removeObject(objId)` - удаление объекта
- `findObjectById(id)` - поиск объекта по ID
- `getAllObjects()` - получение всех объектов
- `getStats()` - получение статистики уровня

### GameObject (src/models/GameObject.js)
Базовый класс игрового объекта.

#### Основные методы:
- `constructor(data)` - создание объекта
- `generateId()` - генерация ID
- `getBounds()` - получение границ объекта
- `containsPoint(x, y)` - проверка точки в объекте
- `clone()` - клонирование объекта
- `toJSON()` - сериализация в JSON

### Group (src/models/Group.js)
Модель группы объектов.

#### Основные методы:
- `constructor(data)` - создание группы
- `addChild(child)` - добавление дочернего объекта
- `removeChild(childId)` - удаление дочернего объекта
- `getAllChildren()` - получение всех дочерних объектов
- `getBounds()` - получение границ группы
- `clone()` - клонирование группы

### Layer (src/models/Layer.js)
Модель слоя уровня.

#### Основные методы:
- `constructor(data)` - создание слоя
- `toggleVisibility()` - переключение видимости
- `toggleLock()` - переключение блокировки
- `setName(name)` - установка имени
- `setOrder(order)` - установка порядка
- `toJSON()` - сериализация в JSON

---

### UIFactory (src/utils/UIFactory.js)
Фабрика UI элементов.

#### Основные методы:
- `createLabeledInput(options)` - создание поля ввода с меткой
- `createInput(options)` - создание поля ввода
- `createButton(options)` - создание кнопки
- `createPropertyEditor(obj, properties, onPropertyChange)` - создание редактора свойств
- `createTab(options)` - создание вкладки
- `createPanel(options)` - создание панели

### Logger (src/utils/Logger.js)
Централизованная система логирования.

#### Основные методы:
- `static log(category, level, message, ...args)` - основное логирование
- `static time(label)` - начало измерения времени
- `static timeEnd(label)` - окончание измерения времени
- `static setLevel(level)` - установка уровня логирования
- `static setCategoryEnabled(category, enabled)` - включение/отключение категории

---

## 📝 Заключение

Этот справочник содержит все доступные методы и функции Level Editor. Используйте его для:

1. **Понимания существующего API** - перед добавлением новой функциональности
2. **Избежания дублирования** - проверки, не существует ли уже нужный метод
3. **Планирования архитектуры** - понимания структуры и связей между компонентами
4. **Отладки** - поиска нужных методов для решения проблем

Для получения подробной информации о параметрах и возвращаемых значениях обращайтесь к исходному коду соответствующих файлов.

**📚 Связанные документы:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектура системы
- [Development Guide](./DEVELOPMENT_GUIDE.md) - примеры использования
- [COMMON_MISTAKES.md](./COMMON_MISTAKES.md) - частые ошибки
