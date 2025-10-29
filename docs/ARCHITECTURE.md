# Архитектура Level Editor v3.53.0

**📚 Навигация:**
- [Development Guide](./DEVELOPMENT_GUIDE.md) - примеры использования
- [API Guide](./API_GUIDE.md) - API методы

## 🏗️ Утилитарная архитектура

**Принципы**: DRY, SOLID, Clean Code, единые точки изменений

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

### AssetTabsManager
**Файл**: `src/ui/AssetTabsManager.js`
- Управление табами панели ассетов
- Изолированная логика табов, включая контекстные меню и drag-and-drop
- Делегирование от AssetPanel для улучшения модульности

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
- 19 категорий, 4 уровня (DEBUG, INFO, WARN, ERROR)
- 100% покрытие - все прямые вызовы console.* заменены
- Fallback механизм

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

## 📁 Asset Import System

### AssetImporter
**Файл**: `src/utils/AssetImporter.js`
- Импорт ассетов из внешних папок
- Автоматический анализ структуры
- Интеграция с AssetManager

---

*Проект следует принципам Clean Code, SOLID, DRY с полной проверкой всех точек взаимодействия.*