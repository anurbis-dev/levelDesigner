# API Reference - 2D Level Editor

## Обзор

Данный документ содержит подробное описание API всех компонентов редактора уровней.

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
- `child` (GameObject) - дочерний объект

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

**Возвращает:** `Object`

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
- `nextObjectId` (number) - следующий ID для объектов

#### Методы

##### `addObject(obj)`

Добавляет объект в уровень.

**Параметры:**
- `obj` (GameObject) - объект для добавления

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

## UI компоненты

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

##### `drawGrid(gridSize, camera, backgroundColor)`

Рисует сетку.

**Параметры:**
- `gridSize` (number) - размер сетки
- `camera` (Object) - объект камеры
- `backgroundColor` (string) - цвет фона

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

Отрисовывает детали объекта.

**Параметры:**
- `obj` (GameObject) - объект

##### `renderCustomProperties(obj)`

Отрисовывает пользовательские свойства.

**Параметры:**
- `obj` (GameObject) - объект

##### `getSelectedObjects()`

Получает выбранные объекты.

**Возвращает:** `Array<GameObject>`

### OutlinerPanel

Панель иерархии объектов.

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

##### `findObjectAtPoint(x, y)`

Находит объект в указанной точке.

**Параметры:**
- `x` (number) - X координата
- `y` (number) - Y координата

**Возвращает:** `GameObject|null`

##### `deleteSelectedObjects()`

Удаляет выбранные объекты.

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

Создает глубокую копию объекта.

**Параметры:**
- `obj` (any) - объект для клонирования

**Возвращает:** `any`

##### `getLevel()`

Получает текущий уровень.

**Возвращает:** `Level`

##### `cancelAllActions()`

Отменяет все текущие действия.

**Отменяет:**
- Размещение объектов
- Выделение рамкой
- Перетаскивание
- Дублирование
- Режим редактирования групп

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

## DuplicateRenderer

Специальный рендерер для дублированных объектов.

### Конструктор

```javascript
new DuplicateRenderer(canvasRenderer)
```

**Параметры:**
- `canvasRenderer` (CanvasRenderer) - основной рендерер

### Методы

##### `drawPlacingObjects(objects, camera)`

Отрисовывает превью дублированных объектов.

**Параметры:**
- `objects` (Array) - массив объектов для отрисовки
- `camera` (Object) - объект камеры

##### `updateObjectPositions(objects, worldPos)`

Обновляет позиции объектов относительно курсора.

**Параметры:**
- `objects` (Array) - массив объектов
- `worldPos` (Object) - мировые координаты

**Возвращает:** `Array` - обновленные объекты

##### `initializeObjectPositions(objects, worldPos)`

Инициализирует относительные позиции объектов.

**Параметры:**
- `objects` (Array) - массив объектов
- `worldPos` (Object) - базовые мировые координаты

**Возвращает:** `Array` - объекты с инициализированными смещениями

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
