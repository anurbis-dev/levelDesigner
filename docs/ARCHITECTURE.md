# Архитектура Level Editor v3.54.4

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
- Универсальное управление позицией панелей
- Централизованное сохранение в StateManager

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

### GroupTraversalUtils
**Файл**: `src/utils/GroupTraversalUtils.js`
- Система обхода иерархии групп
- 12 методов работы с группами

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