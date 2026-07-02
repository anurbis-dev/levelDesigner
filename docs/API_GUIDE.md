### LevelEditor (src/core/LevelEditor.js)
Главный класс редактора уровней.

#### Диалоги и окна:
- `async showSplashScreen()` - отображение splash screen диалога с информацией о версии (вручную)
- `maybeShowSplashOnFirstVisit()` - показывает splash screen один раз при первом визите; флаг `levelEditor_hasSeenSplash` в localStorage предотвращает повтор
- `openSettings()` - открытие панели настроек
- `async importAssets()` - импорт ассетов из внешних папок

#### Файловые операции:
- `newLevel()` - создание нового уровня
- `saveLevel()` - сохранение текущего уровня
- `async loadLevel(file)` - загрузка уровня из файла
- `async saveLevelAs()` - сохранение уровня с выбором файла

#### Версия:
- `static VERSION` - текущая версия редактора (строка, например '3.54.5')
- `updateVersionInfo()` - обновление отображения версии в UI

### HorizontalScrollUtils (src/utils/HorizontalScrollUtils.js)
Утилита для настройки горизонтального скролла с поддержкой колеса мыши и средней кнопки.

#### Основные методы:
- `setupHorizontalScrolling(container, options)` - настройка горизонтального скролла для контейнера
- `startScrolling(container, config, e)` - начало скролла средней кнопкой мыши
- `updateScrolling(container, config, e)` - обновление позиции скролла при движении мыши
- `stopScrolling(container, config)` - завершение скролла и сохранение позиции
- `removeScrolling(container)` - удаление обработчиков событий скролла
- `saveScrollPosition(container, config)` - сохранение позиции скролла в пользовательских настройках

#### Опции конфигурации:
- `sensitivity` - чувствительность скролла (по умолчанию: 1.0)
- `preferenceKey` - ключ для сохранения позиции в настройках
- `isScrolling` - флаг активного скролла

#### Особенности:
- **Универсальность**: может использоваться для любых горизонтально скроллируемых контейнеров
- **Курсоры**: автоматическое изменение курсора на "grab" при наведении и "grabbing" при скролле
- **Сохранение состояния**: позиция скролла автоматически сохраняется в пользовательских настройках
- **Скрытие скроллбара**: визуально скрывает скроллбар при сохранении функциональности
- **Конфликт с drag**: корректно обрабатывает конфликты между скроллом и drag-and-drop

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

### AssetPanel (src/ui/AssetPanel.js)
Главная панель ассетов с поддержкой табов, фолдеров и превью.

#### Основные методы:
- `render()` - отрисовка панели ассетов
- `renderPreviews()` - отрисовка превью ассетов
- `createFoldersContainer()` - создание контейнера фолдеров
- `initializeTabsManager()` - инициализация менеджера табов
- `getActiveTabPath()` - получение пути активного таба
- `selectAsset(assetId)` - выбор ассета
- `decreaseAssetSize()` - уменьшение размера ассетов
- `increaseAssetSize()` - увеличение размера ассетов
- `toggleViewMode()` - переключение режима отображения
- `setupContextMenus()` - настройка контекстных меню
- `destroy()` - очистка ресурсов

#### Особенности:
- **Двухпанельная структура**: левая панель с фолдерами, правая с превью ассетов
- **Система табов**: создание табов перетаскиванием папок
- **Multi-select**: поддержка множественного выбора ассетов
- **Гибкие размеры**: настраиваемый размер превью ассетов
- **Поиск и фильтрация**: интегрированный поиск и фильтры по типам
- **Drag-and-drop**: перетаскивание ассетов на канвас
- **Контекстные меню**: правый клик для дополнительных действий

### AssetManager (src/managers/AssetManager.js)
Управление ассетами с поддержкой динамической загрузки из манифеста.

#### Основные методы:
- `loadDefaultAssets()` - загрузка стандартных ассетов
- `scanContentFolder()` - сканирование папки контента и загрузка манифеста
- `buildCategoriesFromManifest(structure, parentPath, result)` - построение категорий из манифеста
- `buildCategoriesFromStructure(result)` - построение категорий из известной структуры
- `loadAssetFromFile(filePath, result)` - загрузка ассета из файла
- `addAsset(assetData)` - добавление ассета
- `removeAsset(assetId)` - удаление ассета
- `getAsset(assetId)` - получение ассета по ID
- `getAllAssets()` - получение всех ассетов
- `getAssetsByCategory(category)` - получение ассетов по категории
- `getCategories()` - получение всех категорий
- `searchAssets(query)` - поиск ассетов

#### Особенности:
- **Манифест-система**: автоматическая загрузка структуры из `content/manifest.json`
- **Динамическое сканирование**: обновление ассетов при изменении файлов
- **Кеширование изображений**: оптимизация загрузки превью
- **Структурированная организация**: поддержка иерархии папок
- **Обработка ошибок**: graceful handling ошибок загрузки файлов

### AssetTabsManager (src/ui/AssetTabsManager.js)
Управление табами панели ассетов с поддержкой горизонтального скролла и drag-and-drop.

#### Основные методы:
- `render()` - отрисовка всех табов с визуальным выделением активных (поддержка multi-select)
- `syncTabToFolder()` - синхронизация визуального выделения табов с выбранными папками (не создает табы автоматически)
- `addFolderTab(folderPath)` - добавление таба для папки (только при дропе)
- `removeFolderTab(folderPath)` - удаление таба папки
- `handleTabClick(e, folderPath)` - обработка клика по табу (поддержка Shift+клик для multi-select)
- `getFolderName(folderPath)` - получение имени папки для отображения в табе
- `setupContextMenu()` - настройка контекстного меню для табов
- `setupTabDragging()` - настройка drag-and-drop для табов с правильными курсорами
- `setupFolderDragToTabs()` - настройка дропа папок на контейнер табов
- `setupHorizontalScrolling()` - настройка горизонтального скролла колесом мыши и средней кнопкой
- `loadScrollPosition()` - загрузка сохраненной позиции скролла из пользовательских настроек
- `saveTabOrder()` - сохранение порядка табов
- `destroy()` - очистка ресурсов

#### Особенности:
- **Multi-select**: поддержка множественного выбора табов через Shift+клик
- **Горизонтальный скролл**: навигация по табам колесом мыши и средней кнопкой
- **Drag-and-drop**: перетаскивание табов с правильными курсорами (палец → схватывание)
- **Сохранение состояния**: позиция скролла сохраняется в пользовательских настройках
- **Контекстное меню**: правый клик на табах для дополнительных действий
- Табы создаются **только** при перетаскивании папок на контейнер табов
- Поддержка **multi-select** через Shift+клик (как на табах, так и на фолдерах)
- Визуальное выделение всех выбранных табов при multi-select
- Синхронизация с выбором папок в FoldersPanel
- Управление состоянием через StateManager (`activeAssetTabs`, `activeAssetTab`)

### FoldersPanel (src/ui/FoldersPanel.js)
Панель иерархической структуры папок ассетов с поддержкой динамического создания фолдеров.

#### Основные методы:
- `render()` - отрисовка панели фолдеров
- `renderFolderContent()` - обновление содержимого фолдеров без пересоздания структуры
- `updateLayout()` - оптимизированное обновление только обрезки имен при ресайзе (без пересоздания элементов)
- `buildFolderStructure()` - построение структуры фолдеров из манифеста и ассетов
- `buildFromManifestStructure(parentFolder, structure, parentPath)` - создание структуры из манифеста
- `addAssetsToStructure(parentFolder, assets)` - добавление ассетов в структуру (создание фолдеров по необходимости)
- `selectFolder(path, event)` - выбор папки (поддержка Shift+клик для multi-select)
- `toggleFolderExpansion(path)` - переключение раскрытия папки
- `toggleFolderExpansionRecursive(path)` - рекурсивное раскрытие/сворачивание папки
- `getFolderByPath(path)` - получение папки по пути
- `getCategoriesInFolder(folder)` - получение категорий ассетов в папке
- `truncateName(name, maxWidth)` - обрезка длинных имен папок
- `refresh()` - обновление структуры при изменении ассетов
- `destroy()` - очистка ресурсов

#### Особенности:
- **Динамическое создание фолдеров**: автоматическое создание папок для ассетов, не входящих в манифест
- **Двухэтапное построение**: сначала из манифеста (включая пустые папки), затем добавление ассетов
- **Multi-select**: поддержка множественного выбора папок через Shift+клик и Ctrl+клик
- **Рекурсивное раскрытие**: Shift+клик на иконке раскрытия для раскрытия всех вложенных папок
- **Умная обрезка имен**: динамическая обрезка длинных имен папок с учетом доступного места
- **Drag-and-drop**: перетаскивание папок на контейнер табов для создания табов
- **Синхронизация с табами**: автоматическая синхронизация выбора с AssetTabsManager
- **ResizeObserver**: автоматическое обновление при изменении размера панели
- **Оптимизация ресайза**: при изменении размеров окна обновляется только текст обрезки без пересоздания элементов DOM (метод `updateLayout()`)

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

### MouseHandlers (src/event-system/MouseHandlers.js)
Обработчики мыши.

#### Основные обработчики:
- `handleMouseDown(e)` - обработка нажатия мыши
- `handleMouseMove(e)` - обработка движения мыши
- `handleMouseUp(e)` - обработка отпускания мыши
- `handleGlobalMouseMove(e)` - глобальное движение мыши
- `handleGlobalMouseUp(e)` - глобальное отпускание мыши
- `handleWheel(e)` - обработка колесика мыши

#### Rotate/Scale жесты (Ctrl+drag / Ctrl+Alt+drag):
- `startObjectTransform(mode, clickInfo, startWorldPos)` - старт жеста, снапшот геометрии выделения
- `transformSelectedObjects(worldPos)` - пересчёт rotate/scale из снапшота на каждый mousemove
- `_snapshotChildrenForScale(group)` - рекурсивный снапшот геометрии детей группы
- `_applyChildScale(children, factor)` - применение масштаба к детям группы из снапшота

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
- `getBounds()` - получение границ объекта (rotation-aware AABB через `WorldPositionUtils.getRotatedRectAABB`)
- `containsPoint(x, y)` - проверка точки в объекте (inverse-rotate hit-test при `rotation !== 0`)
- `clone()` - клонирование объекта
- `toJSON()` - сериализация в JSON

#### Свойства:
- `rotation` - угол поворота в градусах, по часовой стрелке, вокруг центра объекта (default `0`)

### Group (src/models/Group.js)
Модель группы объектов.

#### Основные методы:
- `constructor(data)` - создание группы
- `addChild(child)` - добавление дочернего объекта
- `removeChild(childId)` - удаление дочернего объекта
- `getAllChildren()` - получение всех дочерних объектов
- `getBounds()` - получение границ группы (объединение rotation-aware bounds детей + консервативный AABB собственного `rotation` группы)
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

## 📁 Система манифеста и динамических фолдеров

### Update Manifest (update_manifest.py)
Автоматическое обновление манифеста ассетов на основе структуры папок.

#### Функциональность:
- **Рекурсивное сканирование**: поиск всех JSON файлов в папке `content/`
- **Построение структуры**: создание иерархической структуры папок
- **Включение пустых папок**: добавление папок без файлов в структуру
- **Кеш-бастинг**: обновление манифеста с временными метками
- **Валидация**: проверка корректности JSON файлов

#### Использование:
```bash
# Обновление манифеста
python update_manifest.py

# Или через batch файл
./update_manifest.bat
```

#### Структура манифеста:
```json
{
  "version": "1.0.0",
  "generated": "2024-01-15",
  "structure": {
    "assets": {
      "characters": {
        "player": {},
        "enemies": {}
      },
      "platforms": {
        "blocks": {},
        "ground": {}
      }
    },
    "maps": {},
    "graphs": {}
  },
  "files": [
    "assets/characters/player/player.json",
    "assets/platforms/blocks/block.json"
  ]
}
```

### Динамическое создание фолдеров
Система автоматически создает папки для ассетов, не входящих в манифест.

#### Процесс:
1. **Загрузка манифеста**: AssetManager загружает структуру из `manifest.json`
2. **Построение базовой структуры**: FoldersPanel создает папки из манифеста
3. **Добавление ассетов**: система добавляет ассеты в существующие папки
4. **Создание недостающих папок**: автоматическое создание папок для новых ассетов
5. **Синхронизация**: обновление структуры при изменении ассетов

#### Особенности:
- **Двухэтапное построение**: сначала манифест, затем ассеты
- **Сохранение пустых папок**: папки из манифеста остаются даже без ассетов
- **Автоматическое обновление**: структура обновляется при изменении файлов
- **Нормализация путей**: унификация путей с префиксом `root/`

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
