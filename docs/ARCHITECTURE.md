# Архитектура Level Editor v3.54.5

**📚 Навигация:**
- [Development Guide](./DEVELOPMENT_GUIDE.md) - примеры использования
- [API Guide](./API_GUIDE.md) - API методы

## 🏗️ Утилитарная архитектура

**Принципы**: DRY, SOLID, Clean Code, единые точки изменений

## 🔄 Жизненный цикл инициализации

### Процесс загрузки редактора

1. **Скрытие интерфейса** - Body скрыт через CSS (`visibility: hidden`) до полной инициализации
2. **Инициализация конфигурации** - `initializeConfiguration()` загружает настройки
3. **Сканирование ассетов** - `assetManager.scanContentFolder()` и `preloadImages()`
4. **Инициализация рендерера** - `initializeRenderer()` создает CanvasRenderer
5. **Синхронизация изображений** - предзагруженные изображения синхронизируются с CanvasRenderer
6. **Инициализация UI компонентов** - создание панелей, toolbar, диалогов
7. **Инициализация обработчиков событий** - `initializeEventHandlerManager()`
8. **Инициализация меню** - `initializeMenuAndEvents()`
9. **Инициализация уровня** - `initializeLevelAndData()` создает новый уровень
10. **Финализация** - `finalizeInitialization()`:
    - Первый рендер
    - Обновление версии (`updateVersionInfo()`, `updatePageTitle()`)
    - Обновление всех панелей
    - Сохранение начального состояния в истории
    - Показ интерфейса (`document.body.classList.add('editor-ready')`)

**Важно**: Интерфейс показывается только после полной инициализации, чтобы избежать отображения устаревшей версии и неполностью загруженных элементов.

## 🛠️ Утилиты

### PanelPositionManager
**Файл**: `src/ui/PanelPositionManager.js`
- Универсальное управление позицией панелей (`#left-tabs-panel`, `#right-tabs-panel`)
- Централизованное сохранение в StateManager
- `moveTab(tabName, fromPanel, toPanel)` — перемещение вкладки между панелями; при необходимости создаёт целевую панель через `ensurePanelExists()`
- **Tab drag**: `setupTabDraggingForPanel(panel)` стартует drag; глобальные обработчики в `_installGlobalTabDragHandlers()` покрывают сортировку внутри панели, cross-panel перенос и создание новой панели. Состояние хранится в `this._pendingDrag` (не в `window.tabDraggingState`) — легаси хендлер очищает глобальное состояние до выполнения нашего `mouseup`.
- Визуалы drag: ghost `.tab-drag-ghost`, drop-zone `.tab-drop-zone`, зона создания панели `.tab-new-panel-zone`; скоупинг — только прямые дети `#left-tabs-panel` / `#right-tabs-panel`
- ~~`TabMoveContextMenu`~~ — удалён (контекстное меню «Move to» заменено drag-and-drop)

### ResizerManager
**Файл**: `src/managers/ResizerManager.js`
- Унифицированный менеджер для разделителей панелей
- Автоматическое определение устройства и маршрутизация событий
- Поддержка горизонтальных и вертикальных разделителей

### EventHandlerManager (v3.52.5)
**Файл**: `src/event-system/EventHandlerManager.js`
- Унифицированный менеджер событий UI
- Event delegation для эффективности
- Предотвращение дублирования обработчиков

### GlobalEventRegistry (v3.52.5)
**Файл**: `src/event-system/GlobalEventRegistry.js`
- Централизованное управление глобальными событиями
- Предотвращение дублирования
- Автоматическая очистка

### BrowserGesturePreventionManager
**Файл**: `src/managers/BrowserGesturePreventionManager.js`
- Единая система блокировки браузерных жестов
- Умное определение навигационных жестов
- Автоматическая очистка обработчиков

### WorldPositionUtils
**Файл**: `src/utils/WorldPositionUtils.js`
- Расчет мировых координат в иерархии групп
- Устранено дублирование
- `getRotatedRectAABB(x, y, w, h, deg)` — AABB прямоугольника после поворота вокруг его центра
- `rotateBoundsAroundCenter(bounds, deg)` — консервативный AABB для уже вычисленных bounds, повёрнутых вокруг их центра
- `getWorldBounds()` / `isPointInWorldBounds()` учитывают `rotation`: точный inverse-rotate hit-test для одиночных объектов, консервативный AABB для групп

### GroupTraversalUtils
**Файл**: `src/utils/GroupTraversalUtils.js`
- Система обхода иерархии групп
- 12 методов работы с группами
- `findObjectPath(topLevelObjects, targetId)` — DFS-поиск пути индексов от корня (`Level.objects`) до объекта через вложенные `group.children`; единый источник истины для порядка рендера/hit-test, используется в `Level.compareStackOrder()`

### AssetPanel System
**Файлы**: `src/ui/AssetPanel.js`, `src/ui/AssetTabsManager.js`, `src/ui/FoldersPanel.js`
- **Двухпанельная архитектура**: левая панель фолдеров, правая панель превью ассетов
- **Система табов**: создание табов перетаскиванием папок на контейнер табов
- **Multi-select поддержка**: множественный выбор через Shift+клик и Ctrl+клик
- **Горизонтальный скролл**: навигация по табам колесом мыши и средней кнопкой
- **Drag-and-drop**: перетаскивание папок на табы и ассетов на канвас
- **Контекстные меню**: правый клик для дополнительных действий
- **Синхронизация состояния**: автоматическая синхронизация между фолдерами и табами
- **Оптимизация производительности**: `FoldersPanel.updateLayout()` обновляет только обрезку имен при ресайзе без пересоздания DOM, `AssetPanel.updateGridViewSizes()` обновляет только стили grid

### UIFactory
**Файл**: `src/utils/UIFactory.js`
- Унифицированное создание UI элементов
- 10 методов создания компонентов

### ValidationUtils v2.0
**Файл**: `src/utils/ValidationUtils.js`
- StateManager-based валидация
- Component Readiness Tracking
- Validation Caching
- Enhanced Fallback Logic

### Logger
**Файл**: `src/utils/Logger.js`
- 29 категорий, 4 уровня (DEBUG, INFO, WARN, ERROR)
- Все прямые вызовы console.* заменены на Logger в исполняемом коде

### ErrorHandler
**Файл**: `src/utils/ErrorHandler.js`
- Централизованная обработка ошибок
- Глобальные перехватчики
- Стратегии восстановления

### PerformanceUtils
**Файл**: `src/utils/PerformanceUtils.js`
- throttle, debounce, memoize
- batchRAF, LRUCache
- Применение: MouseHandlers throttled (8ms mousemove, 16ms wheel)

### SearchUtils
**Файл**: `src/utils/SearchUtils.js`
- Унифицированная система поиска
- Рекурсивный поиск по иерархическим структурам

---

## 📊 Менеджеры системы

### StateManager
**Файл**: `src/managers/StateManager.js`
- Централизованное управление состоянием
- Кеширование для производительности

### HistoryManager
**Файл**: `src/managers/HistoryManager.js`
- Полная поддержка Undo/Redo
- Оптимизированное хранение изменений

### CacheManager (v3.42.0)
**Файл**: `src/managers/CacheManager.js`
- Централизованный менеджер кэшей
- O(1) операции, smart invalidation
- TTL Cache, LRU Strategy

### ConfigManager
**Файл**: `src/managers/ConfigManager.js`
- Управление конфигурацией (editor.json, ui.json, canvas.json и др.)

### AssetManager & FileManager
- AssetManager: управление библиотекой ассетов
- FileManager: сохранение/загрузка уровней

---

## 📦 Core модули

### HistoryOperations (v3.40.0)
**Файл**: `src/core/HistoryOperations.js`
- Централизованный модуль undo/redo
- Восстановление состояния

### LayerOperations (v3.41.0)
**Файл**: `src/core/LayerOperations.js`
- Управление слоями объектов
- Batch processing, smart caching

### ViewportOperations (v3.44.0)
**Файл**: `src/core/ViewportOperations.js`
- Управление viewport и камерой
- Zoom, pan, focus операции

### LevelFileOperations (v3.44.0)
**Файл**: `src/core/LevelFileOperations.js`
- Файловые операции уровней
- Создание, открытие, сохранение

### RenderOperations
**Файл**: `src/core/RenderOperations.js`
- Операции рендеринга
- Пространственный индекс для O(k) поиска

### ObjectOperations
**Файл**: `src/core/ObjectOperations.js`
- Операции с объектами
- Выбор, выделение, свойства

### DuplicateOperations
**Файл**: `src/core/DuplicateOperations.js`
- Операции дублирования
- История операций

### GroupOperations
**Файл**: `src/core/GroupOperations.js`
- Операции с группами
- Иерархическая структура

---

## 🔄 Rotate/Scale жесты объектов

Мышиные жесты поворота и масштабирования выделения, работают на любом уровне вложенности (в т.ч. внутри групп).

- **Ctrl+drag** по объекту — вращение выделения вокруг центра общего world bounding box; **Shift** во время вращения — дискретные шаги (константа `TRANSFORM.ROTATION_SNAP_DEGREES`, 10°).
- **Ctrl+Alt+drag** — равномерное масштабирование выделения относительно центра общего bounding box, клампится `TRANSFORM.MIN_SCALE_FACTOR` (0.05) / `TRANSFORM.MAX_SCALE_FACTOR` (20).
- Если кликнутый объект не был выделен — становится единственным выделением (как при обычном drag).
- Ctrl+click без drag — по-прежнему toggle selection; Ctrl+drag по пустому месту — marquee toggle (не изменилось).
- **Alt+drag дублирование** теперь срабатывает только без Ctrl (Ctrl+Alt зарезервирован под scale) — см. `MouseHandlers.js`.
- Жест активируется при движении мыши ≥ `TRANSFORM.DRAG_THRESHOLD_PX` (4px) после Ctrl(+Alt)-клика на объекте (`mouse.transformPendingMode`).
- Константы: `TRANSFORM` в `src/constants/EditorConstants.js`.

**Модель данных**:
- `GameObject.rotation` — градусы, по часовой стрелке, вокруг центра объекта, default 0; сериализуется в `toJSON()`; `getBounds()`/`containsPoint()` rotation-aware.
- `Group.getBounds()` — учитывает rotation детей (через их rotation-aware `getBounds()`) и собственный rotation группы (консервативный AABB через `WorldPositionUtils.rotateBoundsAroundCenter`).

**Рендер** (`src/ui/CanvasRenderer.js`):
- `drawSingleObject` вращает вокруг центра объекта через `ctx.translate`/`ctx.rotate`.
- `drawGroup` вращает вокруг центра AABB детей; вложенные повёрнутые группы работают через стек ctx-трансформаций без дополнительного кода.

**Обработка жеста** (`src/event-system/MouseHandlers.js`):
- `startObjectTransform(mode, clickInfo, startWorldPos)` — снимает снапшот геометрии выделения (позиции, размеры, rotation, world-центр) в момент старта жеста, чтобы избежать накопления дрейфа при пересчёте на каждый `mousemove`.
- `transformSelectedObjects(worldPos)` — пересчитывает трансформацию из снапшота на каждое движение.
- `_snapshotChildrenForScale` / `_applyChildScale` — рекурсивный снапшот и масштабирование геометрии детей группы (позиции и размеры).
- История (undo/redo) сохраняется на `mouseup`, как у обычного drag; жест отменяется через `historyOperations.undo()` при отпускании кнопки вне canvas и при `window blur`.

**Известные ограничения v1**:
- Рамка выделения (`RenderOperations`/`CanvasRenderer` selection frame) рисует AABB повёрнутого объекта, а не сам повёрнутый контур.
- Hit-test детей внутри повёрнутой группы не учитывает поворот родителя — родительские фреймы в цепочке трактуются как translation-only.
- Жест применяет мировые дельты к локальным координатам объекта — корректно только пока родительская группа не повёрнута.

---

## 📚 Z-порядок объектов (стек рендер/hit-test)

Объекты **не хранят** `zIndex`. Порядок отрисовки и клика определяется исключительно позицией объекта в массиве-контейнере — `Level.objects` для объектов верхнего уровня, `group.children` для объектов внутри группы (как слои в Photoshop/Figma: чем позже элемент в массиве, тем он выше/ближе к переднему плану). `Layer.index` не затронут и остаётся первичным ключом сортировки (объекты одного слоя всегда рисуются вместе, порядок слоёв как раньше).

**Модель данных**:
- `GameObject`/`Group` не сериализуют `zIndex` в `toJSON()` — поле полностью удалено из модели.

**Сравнение порядка** (`src/models/Level.js`):
- `compareStackOrder(a, b)` — единый компаратор: сначала сравнивает `layerIndex` (через `getLayerById().getIndex()`), при равенстве — путь в дереве объектов (`GroupTraversalUtils.findObjectPath`), поэлементно от корня. Используется и рендером, и hit-test'ом, поэтому клик всегда попадает в объект, который реально нарисован сверху, независимо от глубины вложенности групп.

**Рендер** (`src/core/RenderOperations.js`, `src/ui/CanvasRenderer.js`):
- `RenderOperations.getVisibleObjects()` сортирует видимые объекты через `compareStackOrder` один раз на закешированную выборку (та же TTL/инвалидация, что у видимости).
- `CanvasRenderer.drawGroup()` рисует детей группы в порядке массива `children` без дополнительной сортировки — порядок массива уже есть порядок отрисовки.

**Hit-test** (`src/core/ObjectOperations.js`):
- `_sortObjectsByZIndexDescending(objects)` сортирует кандидатов по `compareStackOrder` в обратном порядке (передний план первым) — тот же компаратор, что у рендера.

**Ручное управление порядком** (`src/core/ObjectOperations.js`):
- `getSiblingArray(obj)` — возвращает контейнер объекта (`parentGroup.children` или `level.objects`).
- `bringToFront(obj)` / `sendToBack(obj)` — перемещает объект в конец/начало контейнера.
- `moveForward(obj)` / `moveBackward(obj)` — меняет объект местами с соседним элементом контейнера.

**UI** (`src/ui/DetailsPanel.js`):
- Секция Advanced: числовое поле «Z-Index» заменено 4 кнопками — «На передний план» / «На задний план» / «Выше» / «Ниже» (`createOrderButtonsRow()` → `applyOrderAction()`), работает для одиночного и множественного выбора.

---

## 🎨 Система слоев

### Архитектурные решения
- **Полная изоляция видимости**: объекты скрытого слоя не выделяются
- **Унифицированная проверка**: computeSelectableSet() проверяет видимость
- **Кеширование**: getVisibleLayerIds() для производительности
- **Наследование layerId**: вложенные объекты наследуют слой от родительской группы

### Принудительное наследование
- **Группы как объекты**: каждая группа может иметь layerId
- **Наследование вниз**: вложенные объекты наследуют layerId от группы
- **Приоритет собственного layerId**: объект использует свой layerId, если установлен

---

## 🚀 Производительность

### Индекс объектов
- **O(1) поиск** вместо O(N×D)
- **O(1) подсчет по слоям** вместо O(M×N)
- **O(1) проверка иерархии** вместо O(D)

### Группировка уведомлений
- **O(1) уведомления** вместо O(M×3)
- Batch processing для массовых операций

### Умная инвалидация кешей
- **Избирательная инвалидация** только измененных данных
- **Отложенный пересчет** грязных кешей

### Пространственный индекс рендеринга
- **O(N) → O(k)** поиск объектов в области видимости
- **20-70× ускорение** для поиска видимых объектов

---

## 🎨 UI компоненты

### BaseDialog
**Файл**: `src/ui/BaseDialog.js`
- Единый базовый класс для всех диалогов
- Фиксированная высота, динамическая ширина
- Мобильная адаптация
- Предотвращение повторного рендеринга контента

### SplashScreenDialog (v3.54.3)
**Файл**: `src/ui/SplashScreenDialog.js`
- Специальный диалог для splash screen
- Высота по контенту (dialog-container-auto-height)
- Закрытие любой кнопкой мыши на overlay
- Закрытие по клику на само окно (container, изображение, текстовый блок)
- Единая система обработчиков через EventHandlerManager
- Динамическое получение версии

### BaseContextMenu
**Файл**: `src/ui/BaseContextMenu.js`
- Умное позиционирование
- Правильная очистка обработчиков
- Поддержка disabled состояний

### OutlinerPanel
**Файл**: `src/ui/OutlinerPanel.js`
- Унифицированный поиск
- Умное выделение (Shift+клик, Ctrl+клик)
- Фильтрованное выделение

### LayersPanel
**Файл**: `src/ui/LayersPanel.js`
- Двойная система состояний (активные/текущий слой)
- Умное позиционирование меню
- Оптимизированная инициализация

---

## 📁 Asset Management System

### Manifest System
**Файл**: `update_manifest.py`
- **Автоматическое сканирование**: рекурсивный поиск JSON файлов в папке `content/`
- **Структурированная организация**: создание иерархической структуры папок
- **Включение пустых папок**: сохранение папок без файлов в структуре
- **Кеш-бастинг**: обновление манифеста с временными метками для свежих данных
- **Валидация**: проверка корректности JSON файлов

### Dynamic Folder Creation
**Файлы**: `src/managers/AssetManager.js`, `src/ui/FoldersPanel.js`
- **Двухэтапное построение**: сначала из манифеста, затем добавление ассетов
- **Автоматическое создание папок**: для ассетов, не входящих в манифест
- **Нормализация путей**: унификация путей с префиксом `root/`
- **Синхронизация**: автоматическое обновление при изменении файлов
- **ResizeObserver**: динамическое обновление при изменении размера панели

### Asset Loading Pipeline
1. **AssetManager.scanContentFolder()** - загрузка манифеста и сканирование файлов
2. **buildCategoriesFromManifest()** - построение категорий из структуры манифеста
3. **FoldersPanel.buildFolderStructure()** - создание структуры фолдеров
4. **buildFromManifestStructure()** - создание папок из манифеста (включая пустые)
5. **addAssetsToStructure()** - добавление ассетов и создание недостающих папок
6. **StateManager.notify('assetsChanged')** - уведомление об изменениях

### AssetImporter
**Файл**: `src/utils/AssetImporter.js`
- Импорт ассетов из внешних папок
- Автоматический анализ структуры
- Интеграция с AssetManager

---

*Проект следует принципам Clean Code, SOLID, DRY с полной проверкой всех точек взаимодействия.*