# Полный справочник API Level Editor v2.5.0

## Обзор

Этот документ содержит полный список всех методов и функций, доступных в Level Editor. Используйте его для понимания существующего API и избежания дублирования функциональности.

> 📖 **Подробная документация:** См. [API_REFERENCE.md](./API_REFERENCE.md) для детальных описаний, примеров кода, обработки ошибок и лучших практик использования API.

## Основные классы

### LevelEditor (src/core/LevelEditor.js)
Главный класс редактора уровней.

#### Статические свойства
- `VERSION` - версия редактора (строка)

#### Основные методы
- `constructor()` - инициализация редактора
- `async init()` - инициализация всех компонентов
- `render()` - отрисовка canvas
- `updateAllPanels()` - обновление всех панелей UI
- `updateLevelStatsPanel()` - обновление статистики уровня
- `cancelAllActions()` - отмена всех текущих действий

#### Операции с файлами
- `async newLevel()` - создание нового уровня
- `async openLevel()` - открытие уровня из файла
- `saveLevel()` - сохранение уровня
- `saveLevelAs()` - сохранение уровня с новым именем
- `openAssetsPath()` - открытие настроек путей к ассетам
- `openSettings()` - открытие панели настроек

#### История операций
- `undo()` - отмена последнего действия
- `redo()` - повтор последнего действия

#### Утилиты
- `deepClone(obj)` - глубокое клонирование объекта
- `reassignIdsDeep(obj)` - переназначение ID в объекте и его поддереве
- `getLevel()` - получение текущего уровня
- `hexToRgba(hex, alpha)` - конвертация hex в rgba
- `computeSelectableSet()` - вычисление множества выбираемых объектов

#### Делегированные методы
- `focusOnSelection()` - фокус на выделении
- `focusOnAll()` - фокус на всех объектах
- `deleteSelectedObjects()` - удаление выделенных объектов
- `duplicateSelectedObjects()` - дублирование выделенных объектов
- `groupSelectedObjects()` - группировка выделенных объектов
- `ungroupSelectedObjects()` - разгруппировка выделенных объектов

#### Обработчики событий мыши
- `handleMouseDown(e)` - обработка нажатия мыши
- `handleMouseMove(e)` - обработка движения мыши
- `handleMouseUp(e)` - обработка отпускания мыши
- `handleGlobalMouseMove(e)` - глобальное движение мыши
- `handleGlobalMouseUp(e)` - глобальное отпускание мыши
- `handleWheel(e)` - обработка колесика мыши
- `handleDragOver(e)` - обработка перетаскивания
- `handleDrop(e)` - обработка сброса
- `handleDoubleClick(e)` - обработка двойного клика

#### Операции с объектами
- `findObjectAtPoint(x, y)` - поиск объекта в точке
- `isPointInObject(x, y, obj)` - проверка точки в объекте
- `getObjectWorldBounds(obj, excludeIds)` - получение мировых границ объекта
- `getObjectWorldPosition(obj)` - получение мировой позиции объекта
- `getSelectionBounds(collection)` - получение границ выделения

## Базовые модули

### BaseModule (src/core/BaseModule.js)
Базовый класс для всех модулей редактора.

#### Методы состояния группы
- `isInGroupEditMode()` - проверка режима редактирования группы
- `getActiveGroup()` - получение активной группы
- `getGroupEditMode()` - получение состояния режима редактирования группы

#### Методы мыши
- `isAltKeyPressed()` - проверка нажатия Alt
- `updateMouseState(e, worldPos)` - обновление состояния мыши
- `getMouseState()` - получение состояния мыши
- `getCameraState()` - получение состояния камеры
- `isLeftMouseDown()` - проверка нажатия левой кнопки мыши
- `isRightMouseDown()` - проверка нажатия правой кнопки мыши
- `isDragging()` - проверка перетаскивания
- `isMarqueeSelecting()` - проверка выделения рамкой

#### Методы выделения
- `getSelectedObjects()` - получение выделенных объектов
- `clearSelection()` - очистка выделения
- `selectObjects(objectIds)` - выделение объектов по ID

#### Утилиты
- `markDirtyAndUpdate()` - пометка как измененный и обновление
- `saveStateIfNeeded()` - сохранение состояния при необходимости
- `screenToWorld(e)` - конвертация экранных координат в мировые
- `getSelectionBounds(objects)` - получение границ выделения
- `focusOnBounds(bounds)` - фокус на границах
- `triggerFullUpdate()` - полное обновление UI

## Модули операций

### DuplicateOperations (src/core/DuplicateOperations.js)
Операции дублирования объектов.

#### Основные методы
- `startFromSelection()` - начало дублирования из выделения
- `updatePreview(worldPos)` - обновление превью дублирования
- `confirmPlacement(worldPos)` - подтверждение размещения
- `cancel()` - отмена дублирования

#### Приватные методы
- `_sanitizeForPlacement(obj)` - очистка объекта для размещения

### EventHandlers (src/core/EventHandlers.js)
Обработчики событий.

#### Основные методы
- `setupEventListeners()` - настройка всех обработчиков событий
- `setupCanvasEvents()` - настройка событий canvas
- `setupKeyboardEvents()` - настройка клавиатурных событий
- `setupMenuEvents()` - настройка событий меню
- `setupRightPanelTabs()` - настройка вкладок правой панели
- `setupStateListeners()` - настройка слушателей состояния

#### View меню методы (v2.5.0)
- `toggleViewOption(option)` - переключение режимов отображения
- `initializeViewStates()` - инициализация состояний View меню
- `toggleGameMode(enabled)` - переключение игрового режима
- `updateViewCheckbox(option, enabled)` - обновление состояния чекбокса

### GroupOperations (src/core/GroupOperations.js)
Операции с группами.

#### Основные методы
- `groupSelectedObjects()` - группировка выделенных объектов (группа добавляется в Main слой)
- `openGroupEditMode(group)` - открытие режима редактирования группы
- `closeGroupEditMode()` - закрытие режима редактирования группы
- `ungroupSelectedObjects()` - разгруппировка выделенных объектов (дети добавляются в Main слой)
- `removeEmptyGroup(targetGroup)` - удаление пустой группы
- `removeEmptyGroups()` - удаление всех пустых групп

#### Удаление групп
- **При удалении группы через Delete/DeleteSelectedObjects:**
  - Группа удаляется полностью вместе со всеми дочерними объектами
  - Дети группы также помечаются для удаления (не переносятся на основной уровень)
  - Это отличается от разгруппировки, где дети переносятся на основной уровень

#### Вспомогательные методы
- `getOpenGroups()` - получение открытых групп
- `getActiveEditedGroup()` - получение активной редактируемой группы

### MouseHandlers (src/core/MouseHandlers.js)
Обработчики мыши.

#### Основные обработчики
- `handleMouseDown(e)` - обработка нажатия мыши
- `handleMouseMove(e)` - обработка движения мыши
- `handleMouseUp(e)` - обработка отпускания мыши
- `handleGlobalMouseMove(e)` - глобальное движение мыши
- `handleGlobalMouseUp(e)` - глобальное отпускание мыши
- `handleWheel(e)` - обработка колесика мыши
- `handleDragOver(e)` - обработка перетаскивания
- `handleDrop(e)` - обработка сброса
- `handleDoubleClick(e)` - обработка двойного клика

#### Вспомогательные методы
- `handleObjectClick(e, obj, worldPos)` - обработка клика по объекту
- `handleEmptyClick(e, worldPos)` - обработка клика по пустому месту
- `dragSelectedObjects(worldPos)` - перетаскивание выделенных объектов
- `updateMarquee(worldPos)` - обновление выделения рамкой
- `finishMarqueeSelection()` - завершение выделения рамкой
- `finishPlacingObjects(worldPos)` - завершение размещения объектов

### ObjectOperations (src/core/ObjectOperations.js)
Операции с объектами.

#### Поиск и проверки
- `findObjectAtPoint(x, y)` - поиск объекта в точке
- `isPointInObject(x, y, obj)` - проверка точки в объекте
- `isPointInGroupBounds(x, y, groupEditMode)` - проверка точки в границах группы
- `isObjectInGroup(obj, group)` - проверка объекта в группе

#### Операции с объектами
- `deleteSelectedObjects()` - удаление выделенных объектов
- `duplicateSelectedObjects()` - дублирование выделенных объектов
- `focusOnSelection()` - фокус на выделении
- `focusOnAll()` - фокус на всех объектах

#### Утилиты
- `getObjectCenterWorld(obj, parentGroup)` - получение центра объекта в мировых координатах
- `getObjectWorldPosition(target)` - получение мировой позиции объекта
- `getObjectWorldBounds(obj, excludeIds)` - получение мировых границ объекта
- `computeSelectableSet()` - вычисление множества выбираемых объектов

### RenderOperations (src/core/RenderOperations.js)
Операции отрисовки.

#### Основные методы
- `render()` - основная отрисовка
- `drawSelection()` - отрисовка выделения
- `drawGroupEditFrame()` - отрисовка рамки редактирования группы
- `getVisibleObjects(camera)` - получение видимых объектов
- `isObjectVisible(obj, left, top, right, bottom)` - проверка видимости объекта

#### Методы отрисовки
- `drawSelectionRect(bounds, isGroup, camera)` - отрисовка прямоугольника выделения
- `drawAltDragSelectionRect(bounds, camera)` - отрисовка прямоугольника Alt+перетаскивания
- `drawHierarchyHighlightForGroup(group, depth)` - отрисовка подсветки иерархии групп

#### Методы отрисовки дубликатов (v2.3.2)
- `drawDuplicateObjects(objects, camera)` - отрисовка дублируемых объектов с подсветкой
- `getDuplicateObjectBounds(obj, parentX, parentY)` - вычисление границ дублируемого объекта
- `drawDuplicateHierarchyHighlight(group, depth, parentX, parentY)` - подсветка иерархии дублируемых групп
- `drawDuplicateObject(obj, parentX, parentY)` - рекурсивная отрисовка дублируемого объекта
- `hexToRgba(hex, alpha)` - конвертация hex в rgba

## Менеджеры

### StateManager (src/managers/StateManager.js)
Управление состоянием редактора.

#### Основные методы
- `getState()` - получение всего состояния
- `get(key)` - получение свойства по ключу (поддержка вложенных ключей)
- `set(key, value)` - установка свойства (поддержка вложенных ключей v2.5.0)
- `update(updates)` - обновление нескольких свойств
- `subscribe(key, callback)` - подписка на изменения
- `notifyListeners(key, newValue, oldValue)` - уведомление слушателей

#### Новые состояния (v2.5.0)
- `view.grid` - отображение сетки
- `view.gameMode` - игровой режим
- `view.snapToGrid` - привязка к сетке
- `view.objectBoundaries` - границы объектов
- `view.objectCollisions` - коллизии объектов
- `canvas.showGrid` - отображение сетки на canvas
- `canvas.snapToGrid` - привязка к сетке на canvas

#### Методы состояния
- `markDirty()` - пометка как измененный
- `markClean()` - пометка как сохраненный
- `clearSelection()` - очистка выделения
- `selectObject(objId)` - выделение объекта
- `deselectObject(objId)` - снятие выделения с объекта
- `setSelection(objIds)` - установка выделения
- `toggleSelection(objId)` - переключение выделения
- `reset()` - сброс состояния

### HistoryManager (src/managers/HistoryManager.js)
Управление историей операций.

#### Основные методы
- `saveState(state, isInitial)` - сохранение состояния
- `undo()` - отмена операции
- `redo()` - повтор операции
- `canUndo()` - проверка возможности отмены
- `canRedo()` - проверка возможности повтора
- `clear()` - очистка истории

#### Утилиты
- `getHistoryInfo()` - получение информации об истории
- `pauseRecording()` - приостановка записи
- `resumeRecording()` - возобновление записи

### AssetManager (src/managers/AssetManager.js)
Управление ассетами.

#### Основные методы
- `loadDefaultAssets()` - загрузка стандартных ассетов
- `addAsset(assetData)` - добавление ассета
- `removeAsset(assetId)` - удаление ассета
- `getAsset(assetId)` - получение ассета по ID
- `getAllAssets()` - получение всех ассетов
- `getAssetsByCategory(category)` - получение ассетов по категории
- `getCategories()` - получение всех категорий
- `searchAssets(query)` - поиск ассетов

#### Работа с изображениями
- `async preloadImages()` - предзагрузка изображений
- `loadImage(src)` - загрузка изображения
- `getCachedImage(src)` - получение кэшированного изображения

#### Импорт/экспорт
- `exportToJSON()` - экспорт в JSON
- `importFromJSON(jsonData)` - импорт из JSON

### FileManager (src/managers/FileManager.js)
Управление файлами.

#### Основные методы
- `createNewLevel()` - создание нового уровня
- `saveLevel(level, fileName)` - сохранение уровня
- `async loadLevel(file)` - загрузка уровня
- `async loadLevelFromFileInput()` - загрузка уровня из файла
- `isValidFile(file)` - проверка валидности файла
- `getCurrentFileName()` - получение текущего имени файла
- `setCurrentFileName(fileName)` - установка имени файла

#### Утилиты
- `exportLevelData(level)` - экспорт данных уровня
- `importLevelData(jsonString)` - импорт данных уровня
- `saveAssetLibrary(assetManager, fileName)` - сохранение библиотеки ассетов
- `async loadAssetLibrary(assetManager)` - загрузка библиотеки ассетов

### ConfigManager (src/managers/ConfigManager.js)
Централизованное управление всеми настройками редактора.

#### Основные методы
- `get(path)` - получение настройки по пути
- `set(path, value)` - установка настройки
- `reset()` - сброс к значениям по умолчанию
- `getAllSettings()` - получение всех настроек
- `exportSettings()` - экспорт настроек
- `importSettings(jsonString)` - импорт настроек
- `validateSetting(path, value)` - валидация настройки

#### Специфичные конфигурации
- `getEditor()` - настройки редактора
- `getUI()` - настройки интерфейса
- `getCanvas()` - настройки холста
- `getCamera()` - настройки камеры
- `getSelection()` - настройки выделения
- `getAssets()` - настройки ассетов
- `getPerformance()` - настройки производительности
- `getShortcuts()` - горячие клавиши

### UserPreferencesManager (src/managers/UserPreferencesManager.js)
Управление пользовательскими предпочтениями.

#### Основные методы
- `loadPreferences()` - загрузка предпочтений
- `savePreferences()` - сохранение предпочтений
- `get(key)` - получение предпочтения
- `set(key, value)` - установка предпочтения
- `update(updates)` - обновление предпочтений
- `reset()` - сброс предпочтений
- `getAll()` - получение всех предпочтений

#### Утилиты
- `export()` - экспорт предпочтений
- `import(jsonString)` - импорт предпочтений
- `has(key)` - проверка наличия предпочтения
- `remove(key)` - удаление предпочтения

## Модели данных

### Asset (src/models/Asset.js)
Модель ассета.

#### Основные методы
- `constructor(data)` - создание ассета
- `generateId()` - генерация ID
- `createInstance(x, y)` - создание экземпляра объекта
- `toJSON()` - сериализация в JSON
- `static fromJSON(data)` - создание из JSON

### GameObject (src/models/GameObject.js)
Базовый класс игрового объекта.

#### Основные методы
- `constructor(data)` - создание объекта
- `generateId()` - генерация ID
- `getBounds()` - получение границ объекта
- `containsPoint(x, y)` - проверка точки в объекте
- `clone()` - клонирование объекта
- `toJSON()` - сериализация в JSON
- `static fromJSON(data)` - создание из JSON

### Group (src/models/Group.js)
Модель группы объектов.

#### Основные методы
- `constructor(data)` - создание группы
- `addChild(child)` - добавление дочернего объекта
- `removeChild(childId)` - удаление дочернего объекта
- `getAllChildren()` - получение всех дочерних объектов
- `getBounds()` - получение границ группы
- `containsPoint(x, y)` - проверка точки в группе
- `clone()` - клонирование группы
- `toJSON()` - сериализация в JSON
- `static fromJSON(data)` - создание из JSON

### Layer (src/models/Layer.js)
Модель слоя уровня с поддержкой визуального управления.

#### Свойства
- `id` - уникальный идентификатор слоя
- `name` - имя слоя
- `visible` - видимость слоя
- `locked` - блокировка слоя
- `order` - порядок отображения в интерфейсе
- `color` - цвет индикатора слоя

#### Основные методы
- `constructor(data)` - создание слоя
- `toggleVisibility()` - переключение видимости
- `toggleLock()` - переключение блокировки
- `setName(name)` - установка имени
- `setOrder(order)` - установка порядка
- `toJSON()` - сериализация в JSON
- `static fromJSON(data)` - создание из JSON
- `clone()` - создание копии слоя

### Level (src/models/Level.js)
Модель уровня с поддержкой системы слоев.

#### Свойства
- `meta` - метаданные уровня (имя, версия, дата создания/модификации)
- `settings` - настройки уровня (размер сетки, привязка, цвет фона)
- `camera` - состояние камеры (позиция, зум)
- `objects` - массив объектов уровня
- `layers` - массив слоев уровня
- `nextObjectId` - счетчик ID для новых объектов
- `mainLayerId` - ID основного слоя (сохраняется между сессиями)

#### Основные методы
- `constructor(data)` - создание уровня
- `addObject(obj)` - добавление объекта с автоматическим назначением в Main слой
- `removeObject(objId)` - удаление объекта
- `findObjectById(id)` - поиск объекта по ID
- `findInGroup(group, id)` - поиск в группе
- `getAllObjects()` - получение всех объектов
- `getGroupChildren(group)` - получение дочерних объектов группы
- `getStats()` - получение статистики уровня
- `updateModified()` - обновление времени модификации

#### Методы работы со слоями
- `initializeLayers(layersData)` - инициализация системы слоев
- `addLayer(name)` - добавление нового слоя
- `removeLayer(layerId)` - удаление слоя (нельзя удалить Main слой)
- `getLayerById(layerId)` - поиск слоя по ID
- `getMainLayer()` - получение объекта Main слоя
- `getMainLayerId()` - получение ID Main слоя (постоянный)
- `getLayerObjects(layerId)` - получение объектов слоя
- `getLayerObjectsCount(layerId)` - подсчет объектов в слое
- `assignObjectToLayer(objId, layerId)` - назначение объекта слою
- `reorderLayers(layerIds)` - изменение порядка слоев
- `getLayersSorted()` - получение отсортированных слоев
- `fixLayerReferences()` - исправление ссылок на слои

#### Сериализация
- `toJSON()` - сериализация уровня в JSON (включая mainLayerId)
- `static fromJSON(data)` - создание уровня из JSON (восстанавливает mainLayerId)

## UI компоненты

### AssetPanel (src/ui/AssetPanel.js)
Панель ассетов.

#### Основные методы
- `constructor(container, assetManager, stateManager)` - создание панели
- `init()` - инициализация
- `setupEventListeners()` - настройка обработчиков событий
- `render()` - отрисовка панели
- `renderTabs()` - отрисовка вкладок
- `renderPreviews()` - отрисовка превью

#### Обработчики событий
- `handleTabClick(e, category)` - обработка клика по вкладке
- `handleThumbnailClick(e, asset)` - обработка клика по миниатюре
- `handleThumbnailDragStart(e, asset)` - обработка начала перетаскивания
- `handleAssetMouseDown(e)` - обработка нажатия мыши
- `handleAssetMouseMove(e)` - обработка движения мыши
- `handleAssetMouseUp(e)` - обработка отпускания мыши
- `handleGlobalAssetMouseMove(e)` - глобальное движение мыши
- `handleGlobalAssetMouseUp(e)` - глобальное отпускание мыши

#### Утилиты
- `createAssetThumbnail(asset, selectedAssets)` - создание миниатюры ассета
- `finishAssetMarqueeSelection()` - завершение выделения рамкой
- `addDropTarget()` - добавление стиля drop target
- `removeDropTarget()` - удаление стиля drop target
- `setupTabDragging()` - настройка перетаскивания вкладок

### LayersPanel (src/ui/LayersPanel.js)
Панель управления слоями с визуальным интерфейсом и подсчетом объектов.

#### Основные методы
- `constructor(container, stateManager, levelEditor)` - создание панели
- `render()` - отрисовка панели слоев
- `renderLayersSection()` - отрисовка секции слоев
- `createLayerElement(layer)` - создание элемента слоя
- `updateAllLayersObjectsCount()` - обновление счетчиков объектов
- `setupLayersEventListeners()` - настройка обработчиков событий

#### Управление слоями
- `showColorPicker(layer, event)` - показ цветового пикера для слоя
- `hideColorPicker()` - скрытие цветового пикера
- `updateLayerElement(layerId, layer)` - обновление визуального состояния слоя

#### Drag & Drop
- `setupLayersDragAndDrop()` - настройка перетаскивания слоев
- `handleDragStart(e, layerId)` - обработка начала перетаскивания
- `handleDrop(e, targetLayerId)` - обработка сброса слоя

### CanvasRenderer (src/ui/CanvasRenderer.js)
Рендерер canvas.

#### Основные методы
- `constructor(canvas)` - создание рендерера
- `resizeCanvas()` - изменение размера canvas
- `clear()` - очистка canvas
- `setCamera(camera)` - установка камеры
- `restoreCamera()` - восстановление камеры

#### Методы отрисовки
- `drawGrid(gridSize, camera, backgroundColor)` - отрисовка сетки
- `drawObject(obj, parentX, parentY)` - отрисовка объекта
- `drawSingleObject(obj, x, y)` - отрисовка одного объекта
- `drawGroup(group, x, y)` - отрисовка группы
- `drawMarquee(marqueeRect, camera)` - отрисовка выделения рамкой
- `drawPlacingObjects(objects, camera)` - отрисовка размещаемых объектов

#### Утилиты
- `getObjectBounds(obj)` - получение границ объекта
- `getGroupBounds(group)` - получение границ группы
- `cacheImage(src, img)` - кэширование изображения
- `getCachedImage(src)` - получение кэшированного изображения
- `screenToWorld(screenX, screenY, camera)` - конвертация экранных координат в мировые
- `worldToScreen(worldX, worldY, camera)` - конвертация мировых координат в экранные

### DetailsPanel (src/ui/DetailsPanel.js)
Панель деталей.

#### Основные методы
- `constructor(container, stateManager, levelEditor)` - создание панели
- `setupEventListeners()` - настройка обработчиков событий
- `render()` - отрисовка панели
- `renderNoSelection()` - отрисовка при отсутствии выделения
- `renderSingleObject(obj)` - отрисовка одного объекта
- `renderMultipleObjects(objects)` - отрисовка нескольких объектов

#### Специализированные методы
- `renderGroupDetails(group)` - отрисовка деталей группы
- `renderObjectDetails(obj)` - отрисовка деталей объекта
- `renderCustomProperties(obj)` - отрисовка пользовательских свойств

#### Утилиты
- `getSelectedObjects()` - получение выделенных объектов
- `getAllChildren(group)` - получение всех дочерних объектов
- `updateTabTitle()` - обновление заголовка вкладки

### OutlinerPanel (src/ui/OutlinerPanel.js)
Панель структуры.

#### Основные методы
- `constructor(container, stateManager, levelEditor)` - создание панели
- `setupEventListeners()` - настройка обработчиков событий
- `render()` - отрисовка панели
- `groupObjectsByType(objects)` - группировка объектов по типу
- `renderTypeGroup(type, objects)` - отрисовка группы типов

#### Специализированные методы
- `renderGroupNode(group, depth, container)` - отрисовка узла группы
- `renderObjectNode(obj, depth, container)` - отрисовка узла объекта
- `handleObjectClick(e, obj)` - обработка клика по объекту

### SettingsPanel (src/ui/SettingsPanel.js)
Панель настроек.

#### Основные методы
- `constructor(container, settingsManager)` - создание панели
- `init()` - инициализация
- `createSettingsPanel()` - создание панели настроек
- `setupEventListeners()` - настройка обработчиков событий
- `show()` - показ панели
- `hide()` - скрытие панели

#### Методы отрисовки
- `renderSettingsContent(category)` - отрисовка содержимого настроек
- `renderGeneralSettings()` - отрисовка общих настроек
- `renderGridSettings()` - отрисовка настроек сетки
- `renderCameraSettings()` - отрисовка настроек камеры
- `renderSelectionSettings()` - отрисовка настроек выделения
- `renderAssetSettings()` - отрисовка настроек ассетов
- `renderShortcutSettings()` - отрисовка настроек горячих клавиш
- `renderPerformanceSettings()` - отрисовка настроек производительности

#### Утилиты
- `setupSettingsInputs()` - настройка полей ввода
- `resetSettings()` - сброс настроек
- `exportSettings()` - экспорт настроек
- `importSettings(event)` - импорт настроек
- `saveSettings()` - сохранение настроек

## Утилиты

### FileUtils (src/utils/FileUtils.js)
Утилиты для работы с файлами.

#### Статические константы
- `TYPES` - поддерживаемые типы файлов

#### Основные методы
- `static downloadData(data, filename, mimeType, prettyJson)` - скачивание данных
- `static readFileAsText(file)` - чтение файла как текст
- `static readFileAsJSON(file)` - чтение файла как JSON
- `static pickFile(accept, multiple)` - выбор файла
- `static pickAndReadText(accept)` - выбор и чтение текстового файла
- `static pickAndReadJSON(accept)` - выбор и чтение JSON файла

#### Утилиты
- `static validateFileType(file, allowedExtensions)` - валидация типа файла
- `static getFileExtension(filename)` - получение расширения файла
- `static getFileBaseName(filename)` - получение имени файла без расширения
- `static formatFileSize(bytes)` - форматирование размера файла
- `static createDataURL(file)` - создание data URL
- `static isFileAPISupported()` - проверка поддержки File API
- `static downloadBatch(files, delay)` - пакетное скачивание
- `static readMultipleFiles(files, format)` - чтение нескольких файлов
- `static createBackupFilename(originalFilename, suffix)` - создание имени резервной копии

### GitUtils (src/utils/GitUtils.js)
Утилиты для работы с Git.

#### Основные методы
- `static async getLogs(commits, format)` - получение логов Git
- `static async getCurrentBranch()` - получение текущей ветки
- `static async getStatus()` - получение статуса Git
- `static async saveLogsToFile(commits, filename)` - сохранение логов в файл

### GroupTraversalUtils (src/utils/GroupTraversalUtils.js)
Утилиты для обхода иерархии групп.

#### Основные методы
- `static getAllChildren(group, includeGroups)` - получение всех дочерних объектов
- `static getAllObjects(topLevelObjects, includeGroups)` - получение всех объектов
- `static walkGroup(group, callback, depth, parent)` - обход группы
- `static walkAllObjects(topLevelObjects, callback)` - обход всех объектов
- `static findInGroup(group, predicate)` - поиск в группе
- `static findInObjects(topLevelObjects, predicate)` - поиск в объектах

#### Утилиты
- `static countInGroup(group, filter)` - подсчет объектов в группе
- `static getGroupStats(group)` - получение статистики группы
- `static transformGroupChildren(group, transformer)` - преобразование дочерних объектов
- `static removeFromGroup(group, shouldRemove)` - удаление из группы

### Logger (src/utils/Logger.js)
Централизованная система логирования.

#### Статические константы
- `LEVELS` - уровни логирования
- `CATEGORIES` - категории логирования
- `timings` - хранилище таймингов

#### Основные методы
- `static log(category, level, message, ...args)` - основное логирование
- `static time(label)` - начало измерения времени
- `static timeEnd(label)` - окончание измерения времени
- `static group(groupName, callback)` - группировка логов
- `static data(category, title, data)` - логирование данных
- `static setLevel(level)` - установка уровня логирования
- `static setCategoryEnabled(category, enabled)` - включение/отключение категории
- `static createLogger(category, level)` - создание логгера

#### Специализированные логгеры
- `static duplicate` - логирование дублирования
- `static render` - логирование отрисовки
- `static canvas` - логирование canvas
- `static mouse` - логирование мыши
- `static event` - логирование событий
- `static group` - логирование групп
- `static state` - логирование состояния
- `static file` - логирование файлов
- `static asset` - логирование ассетов
- `static ui` - логирование UI
- `static git` - логирование Git
- `static console` - логирование консоли
- `static layout` - логирование макета
- `static settings` - логирование настроек
- `static preferences` - логирование предпочтений

#### Утилиты
- `static utils.trace(className, methodName, args)` - трассировка функций
- `static utils.stateChange(property, oldValue, newValue)` - логирование изменений состояния
- `static utils.error(error, context)` - логирование ошибок
- `static utils.assert(condition, message)` - проверка утверждений

### RenderUtils (src/utils/RenderUtils.js)
Утилиты для отрисовки.

#### Статические константы
- `STYLES` - предопределенные стили отрисовки

#### Основные методы
- `static drawRect(ctx, bounds, options)` - отрисовка прямоугольника
- `static drawSelectionRect(ctx, bounds, style, zoomFactor)` - отрисовка прямоугольника выделения
- `static drawObjectSelection(ctx, bounds, isGroup, zoomFactor)` - отрисовка выделения объекта
- `static drawAltDragRect(ctx, bounds, zoomFactor)` - отрисовка прямоугольника Alt+перетаскивания
- `static drawGroupFrame(ctx, bounds, padding, zoomFactor)` - отрисовка рамки группы
- `static drawMarquee(ctx, marqueeRect, zoomFactor)` - отрисовка выделения рамкой
- `static drawHierarchyHighlight(ctx, bounds, depth, baseColor, maxAlpha, decay)` - отрисовка подсветки иерархии

#### Утилиты
- `static hexToRgba(hex, alpha)` - конвертация hex в rgba
- `static drawGrid(ctx, gridSize, camera, viewport, options)` - отрисовка сетки
- `static drawTextWithBackground(ctx, text, x, y, options)` - отрисовка текста с фоном
- `static createStyle(color, width, dashPattern)` - создание стиля
- `static registerStyle(name, config)` - регистрация стиля
- `static applyCameraTransform(ctx, camera)` - применение трансформации камеры
- `static restoreCameraTransform(ctx)` - восстановление трансформации камеры

### UIFactory (src/utils/UIFactory.js)
Фабрика UI элементов.

#### Статические константы
- `CSS` - CSS классы

#### Основные методы
- `static createLabeledInput(options)` - создание поля ввода с меткой
- `static createInput(options)` - создание поля ввода
- `static createButton(options)` - создание кнопки
- `static createPropertyEditor(obj, properties, onPropertyChange)` - создание редактора свойств
- `static createTab(options)` - создание вкладки
- `static createPanel(options)` - создание панели
- `static createAssetThumbnail(options)` - создание миниатюры ассета

#### Утилиты
- `static setLoadingState(element, loading, loadingText)` - установка состояния загрузки
- `static createGrid(options)` - создание сетки

### WorldPositionUtils (src/utils/WorldPositionUtils.js)
Утилиты для работы с мировыми координатами.

#### Основные методы
- `static getWorldPosition(target, levelObjects)` - получение мировой позиции
- `static getWorldBounds(obj, levelObjects, excludeIds)` - получение мировых границ
- `static getWorldCenter(obj, levelObjects)` - получение мирового центра
- `static isPointInWorldBounds(x, y, obj, levelObjects)` - проверка точки в мировых границах

## Дополнительные утилиты

### DuplicateUtils (src/utils/DuplicateUtils.js)
Утилиты позиционирования дублируемых объектов (упрощено в v2.3.2).

#### Основные методы
- `static updatePositions(objects, worldPos)` - обновление позиций объектов
- `static initializePositions(objects, worldPos)` - инициализация относительных позиций
- `static hasPositionChanged(firstObj, worldPos, threshold)` - проверка изменения позиции

#### Legacy совместимость
- `duplicateRenderUtils` - экспорт для обратной совместимости
- `drawPlacingObjects(canvasRenderer, objects, camera)` - отрисовка размещаемых объектов

## Заключение

Этот справочник содержит все доступные методы и функции Level Editor v2.4.3. Используйте его для:

1. **Понимания существующего API** - перед добавлением новой функциональности
2. **Избежания дублирования** - проверки, не существует ли уже нужный метод
3. **Планирования архитектуры** - понимания структуры и связей между компонентами
4. **Отладки** - поиска нужных методов для решения проблем

Все методы сгруппированы по модулям и содержат краткое описание назначения. Для получения подробной информации о параметрах и возвращаемых значениях обращайтесь к исходному коду соответствующих файлов.
