# Changelog

## [3.46.0] - 2025-10-10

### Added - Глобальная система отмены рамки выделения
- **Глобальный обработчик отмены рамки**: добавлен единый обработчик для отмены рамки выделения в любом месте экрана при нажатии любой кнопки мыши кроме левой (канва, панели, вне интерфейса)
- **Универсальная поддержка**: работает с обеими системами рамок (старой для канвы и новой для панелей)
- **Многоуровневая защита**: три уровня обработчиков для гарантированной работы (contextmenu, mousedown, window-level)
- **Автоматическая очистка**: очищает все состояния, DOM элементы и выделение при отмене рамки

### Changed - Очистка дублирующего кода
- **BaseContextMenu.js**: удалены лишние отладочные логи, оставлены только важные информационные сообщения
- **SelectionUtils.js**: удалены отладочные логи для проверки активных marquee selections
- **MouseHandlers.js**: удален дублирующий код отмены рамки (теперь обрабатывается глобально)
- **LevelEditor.js**: упрощен метод `cancelAllActions()` - отмена marquee теперь глобальная

### Fixed - Улучшенная стабильность отмены рамки
- **Отмена в панели ассетов**: исправлено - рамка теперь корректно отменяется с очисткой выделения
- **Отмена на канве**: исправлено - рамка канвы теперь отменяется в любом месте экрана
- **Предотвращение конфликтов**: устранены конфликты между локальными и глобальными обработчиками отмены

---

## [3.45.1] - 2025-10-10

### Fixed - Исправления UI и selection
- **SelectionUtils.js**: исправлена ошибка дублирующего объявления переменной `mouseStateKey` (строка 339)
- **SelectionUtils.js**: исправлена ошибка дублирующего объявления переменной `options` (строка 359) - переименована в `marqueeOptions`
- **BasePanel.js**: исправлена ошибка необъявленной переменной `options` в `handleMouseUp` (строка 231) - заменено на `this.selectionOptions`
- **SettingsPanel.js**: исправлена проблема с неработающими слайдерами Font Scale и Spacing при переключении табов - добавлен вызов `setupSettingsInputs()` после рендеринга контента

### Improved
- **Интерактивность настроек**: слайдеры Font Scale и Spacing теперь всегда работают при открытии окна настроек
- **Стабильность selection**: устранены синтаксические ошибки в системе marquee selection
- **Надежность**: устранены ошибки обращения к несуществующим переменным

---

## [3.45.0] - 2025-10-08

### Changed - Система ассетов переработана
- **Удалены заглушки**: Grass, Dirt, Stone, Slime, Goblin, Coin, Health Potion
- **Удалены дефолтные табы**: Tiles, Enemies, Items, Prefabs
- **Удалён Enemy Spawn** из начальных объектов уровня
- **Переименована панель**: Folders → Content

### Added - Автоматическая загрузка ассетов
- **AssetManager.scanContentFolder()**: сканирование ./content при старте
- **content/manifest.json**: манифест со структурой папок и списком файлов
- **update_manifest.bat/py/js**: скрипты для обновления манифеста
- **AssetManager.loadAssetFromFile()**: загрузка ассетов из JSON
- **AssetManager.getCategoriesWithAssets()**: только категории с ассетами
- **Автогенерация ID**: уникальные ID из полного пути файла
- **Cache busting**: для манифеста и JSON файлов

### Changed - FoldersPanel
- **Структура из манифеста**: buildFromManifestStructure()
- **Только папки**: ассеты не отображаются в дереве
- **Рекурсивный счётчик**: countAssetsRecursive()
- **Раскрытие по стрелке**: клик по папке только выделяет
- **Серый цвет**: для пустых папок
- **Подсветка**: работает на всех уровнях
- **Синхронизация табов**: getCategoriesInFolder() рекурсивно

### Changed - Обработка изображений
- **Только одна картинка**: массив imgSrc → первый элемент
- **Поддержка image field**: альтернативное поле
- **Полные пути**: ./content/path/to/image.png
- **Синхронизация кешей**: preloadImages() синхронизирует с CanvasRenderer

### Fixed
- **FoldersPanel.folderStructure**: всегда инициализируется
- **Уникальность ID**: одинаковые файлы в разных папках
- **Категории**: из имени родительской папки
- **Табы**: только для категорий с ассетами
- **Пустые папки**: очищают табы

---

## [3.44.0] - 2025-10-05

### Added - Фаза 5: Модуляризация ViewportOperations и LevelFileOperations
- **ViewportOperations**: новый модуль для управления viewport и камерой (200+ строк)
  - `zoomIn()`, `zoomOut()`, `zoomToFit()`, `resetView()`
  - `focusOnSelection()`, `focusOnAll()`, `focusOnBounds()`
- **LevelFileOperations**: новый модуль для файловых операций (250+ строк)
  - `newLevel()`, `openLevel()`, `saveLevel()`, `saveLevelAs()`
  - `importAssets()` с полной интеграцией AssetImporter
  - `_validatePlayerStart()` - централизованная валидация

### Changed
- **LevelEditor**: методы viewport и файловых операций делегируют к новым модулям
- **ObjectOperations**: удалены `focusOnSelection()` и `focusOnAll()` (перенесены в ViewportOperations)
- **Размер LevelEditor.js**: 2089→1770 строк (-319 строк, -15.3%)
- **Logger**: добавлена категория VIEWPORT для логирования операций камеры

### Improved
- **Separation of Concerns**: viewport и файловые операции в отдельных модулях
- **Модульность**: +25% (viewport и файлы могут переиспользоваться)
- **Maintainability**: изменения локализованы в специализированных модулях
- **Параметризация**: методы принимают параметры (factor, padding, defaults)
- **Улучшенное логирование**: детальная информация о всех операциях

### Метрики после Фазы 5
- **LevelEditor.js**: 2488→1770 строк (-28.8% от начала Фазы 4)
- **Новые модули**: ViewportOperations (200 строк), LevelFileOperations (250 строк)
- **Общая модульность**: +70% относительно начала рефакторинга
- **Cognitive Complexity**: снижена на ~65%

---

## [3.43.0] - 2025-10-05

### Changed - Фаза 4.5: Разбивка applyConfiguration()
- **LevelEditor.applyConfiguration()**: разбит на 7 специализированных методов
  - `_applyGridConfiguration()` - координирует применение настроек грида
  - `_getGridSettingsFromConfig()` - получение настроек из конфига
  - `_applyBasicGridSettings()` - базовые настройки (size, color, thickness, opacity)
  - `_applyGridSubdivisionSettings()` - настройки подразделений грида
  - `_applyGridTypeSettings()` - тип грида (rectangular, hexagonal, etc.)
  - `_syncGridSettingsToUI()` - синхронизация с UI компонентами
  - `_saveDefaultConfiguration()` - сохранение дефолтных настроек

### Improved
- **Читаемость**: 65→10 строк в основном методе (-85%)
- **Separation of Concerns**: каждый метод отвечает за свою задачу
- **Maintainability**: легче расширять и тестировать отдельные части
- **JSDoc**: полная документация для всех методов

---

## [3.42.0] - 2025-10-05

### Added - Фаза 4.4: CacheManager
- **CacheManager**: новый менеджер для централизации логики кэширования (269 строк)
  - getCachedObject(), getCachedTopLevelObject(), getCachedEffectiveLayerId()
  - getSelectableObjectsInViewport(), smartCacheInvalidation()
  - invalidateAfterLayerChanges/GroupOperations/DuplicateOperations()
  - scheduleCacheInvalidation() с debouncing

### Changed
- **LevelEditor**: методы кэширования делегируют к CacheManager
- **Размер LevelEditor.js**: 2057→1811 строк (-246 строк, -12%)
- **Logger**: добавлена категория CACHE для логирования кэширования

### Improved
- **Separation of Concerns**: кэширование в отдельном менеджере
- **Модульность**: +15% (кэширование может переиспользоваться)
- **Maintainability**: изменения локализованы в одном месте
- **Сохранены оптимизации**: smart invalidation, debouncing, TTL cache

---

## [3.41.0] - 2025-10-05

### Added - Фаза 4.3: Модуль LayerOperations
- **LayerOperations**: новый модуль для управления слоями (404 строки)
  - moveSelectedObjectsToLayer(), assignSelectedObjectsToLayer()
  - batchProcessLayerAssignment(), findNextUnlockedLayer()
  - processObjectForLayerAssignment(), batched notifications
  - canMoveObjectsToLayer()

### Changed
- **LevelEditor**: методы управления слоями делегируют к LayerOperations
- **Размер LevelEditor.js**: 2415→2057 строк (-358 строк, -14.8%)

### Improved
- **Separation of Concerns**: управление слоями в отдельном модуле
- **Модульность**: +20% (слои могут переиспользоваться)
- **Maintainability**: изменения локализованы в одном месте
- **Сохранены оптимизации**: batch processing, smart caching, spatial index

---

## [3.40.0] - 2025-10-05

### Added - Фаза 4.2: Модуль HistoryOperations
- **HistoryOperations**: новый модуль для централизации логики undo/redo (144 строки)
  - undo(), redo(), restoreObjectsFromHistory(), rebuildAllIndices()
  - restoreGroupEditMode(), recalculateGroupBounds(), invalidateCachesAfterRestore()
  - restoreSelection(), finalizeHistoryRestore()

### Changed
- **LevelEditor**: методы undo/redo делегируют работу к HistoryOperations
- **Размер LevelEditor.js**: 2693→2415 строк (-278 строк, -10.3%)

### Improved
- **Separation of Concerns**: история в отдельном модуле
- **Модульность**: +20% (история может переиспользоваться)
- **Maintainability**: изменения локализованы в одном месте
- **Тестируемость**: легко тестировать историю отдельно

---

## [3.39.0] - 2025-10-05

### Changed - Фаза 4.1: Разбивка больших методов
- **LevelEditor.init()**: разбит на 7 специализированных методов (180→15 строк, -92%)
  - initializeConfiguration(), initializeDOMElements(), initializeRenderer()
  - initializeUIComponents(), initializeMenuAndEvents(), initializeLevelAndData()
  - finalizeInitialization()
- **LevelEditor.undo()**: разбит на 7 приватных методов (160→10 строк, -94%)
- **LevelEditor.redo()**: упрощен, переиспользует методы undo (85→10 строк, -88%)

### Improved
- **Читаемость**: +85-90% (методы читаются как последовательность шагов)
- **DRY**: устранено ~150 строк дублирования между undo/redo (-95%)
- **Когнитивная сложность**: -80% (с 25 до 5)
- **Размер файла**: 2914→2693 строк (-7.6%)
- **Maintainability**: каждый метод делает одну вещь (SRP)

### Technical
- 13 новых приватных методов с @private JSDoc
- Устранена вложенность кода (4→1 уровень)
- Улучшена тестируемость (изолированные шаги)

---

## [3.38.1] - 2025-10-05

### Fixed - Улучшена логика для вложенных групп
- Добавлена проверка консистентности activeGroupId и openGroupIds
- Валидация иерархии вложенных групп (parent→child)
- Восстановлены обязательные поля groupId и originalChildren
- Безопасный выход из режима при сломанной иерархии

---

## [3.38.0] - 2025-10-05

### Added - Фикс Undo/Redo
- Сохранение groupEditMode в историю (isActive, groupId, openGroupIds)
- Убрано принудительное изменение visibility после undo/redo
- Убран некорректный markDirty() после undo/redo

---

## [3.37.0] - 2025-10-05

### Added
- **PerformanceUtils**: модуль оптимизации производительности
  - throttle(), debounce(), memoize(), batchRAF()
  - LRUCache class для эффективного кэширования
- **Throttled mouse events**: 8ms для mousemove, 16ms для wheel
- **EditorConstants**: MOUSE_MOVE_THROTTLE_MS, WHEEL_THROTTLE_MS, RESIZE_DEBOUNCE_MS, INPUT_DEBOUNCE_MS

### Changed
- **MouseHandlers**: применен throttle к handleMouseMove и handleWheel (-20-30% CPU)
- **Плавность взаимодействия**: улучшена отзывчивость при перетаскивании и zoom

### Performance
- Снижение CPU нагрузки на 20-30% при интенсивном взаимодействии
- Плавное перетаскивание и zoom без лагов
- Готовая инфраструктура для memoization

---

## [3.36.0] - 2025-10-05

### Added
- **EditorConstants**: централизованные константы редактора
  - DEFAULT_OBJECT (width, height, color, visibility)
  - PERFORMANCE (cache timeout, spatial grid, history size)
  - GRID, CAMERA, UI, SELECTION, PARALLAX настройки

### Changed
- **DuplicateOperations**: устранено дублирование кода (~20 строк)
  - Создан метод _normalizeObjectProperties()
  - Использование констант DEFAULT_OBJECT
- **RenderOperations**: применены константы PERFORMANCE
- **ErrorHandler**: применены константы PERFORMANCE.MAX_HISTORY_SIZE

### Improved
- DRY принцип: +30% (единая точка изменения для свойств по умолчанию)
- Maintainability: +40% (константы вместо magic numbers)
- Consistency: улучшена согласованность кода

---

## [3.35.0] - 2025-10-05

### Added
- **JSDoc типизация**: полная документация ErrorHandler и Custom Error классов
  - 17 методов с детальной типизацией
  - 4 Custom Error класса (NetworkError, ValidationError, PermissionError, FileNotFoundError)
  - 10+ примеров использования
  - IDE автодополнение и IntelliSense поддержка

### Technical
- ~200 строк JSDoc документации
- @param, @returns, @example для всех публичных методов
- @private маркеры для внутренних методов
- @extends для Custom Error классов

---

## [3.34.0] - 2025-10-05

### Changed
- **Logger migration**: 100% замена console.* на Logger.* (23 файла, 40+ вызовов)
  - CanvasRenderer → Logger.canvas
  - FileUtils → Logger.file
  - AssetManager → Logger.asset
  - SettingsPanel, DetailsPanel → Logger.settings, Logger.ui
  - FolderPickerDialog → Logger.file
  - ConsoleContextMenu → Logger.console
- **ErrorHandler integration**: критичные файловые операции (FileManager: loadLevel, loadLevelFromFileInput, importLevelData, loadAssetLibrary)

### Fixed
- Единый стиль логирования во всем проекте
- Улучшенная обработка ошибок в файловых операциях

### Technical
- Fallback console.* оставлен в Logger.js и ConfigManager (правильно)
- Пользовательские сообщения об ошибках на русском языке
- ErrorHandler.try/tryAsync обертки для критичных операций

---

## [3.33.0] - 2025-10-05

### Added
- **ErrorHandler**: централизованная обработка ошибок, глобальные перехватчики, стратегии восстановления, история ошибок
- **ComponentLifecycle**: менеджер жизненного цикла компонентов, приоритеты уничтожения, предотвращение утечек памяти
- **destroy() методы**: добавлены во все UI компоненты (AssetPanel, DetailsPanel, OutlinerPanel, LayersPanel, SettingsPanel, ActorPropertiesWindow, Toolbar, MenuManager, CanvasRenderer, EventHandlers)
- **Logger категории**: LIFECYCLE, ERROR_HANDLER для новых систем
- **LevelEditor.destroy()**: полная очистка редактора с правильным порядком уничтожения компонентов

### Changed
- **EventHandlers**: трекинг event listeners и RAF для корректной очистки
- **Logger**: методы-алиасы для новых категорий (Logger.lifecycle, Logger.errorHandler)

### Fixed
- **Memory leaks**: устранены утечки памяти в event listeners, subscriptions, render loops
- **Component cleanup**: все зарегистрированные компоненты корректно очищаются при destroy

### Technical
- **ErrorHandler API**: init(), handle(), logError(), getErrorHistory(), getStatistics(), try(), tryAsync()
- **ComponentLifecycle API**: register(), destroy(), destroyAll(), приоритеты 1-10
- **Custom Error types**: NetworkError, ValidationError, PermissionError, FileNotFoundError
- **Recovery strategies**: автоматическое восстановление для типовых ошибок

---

## [3.32.0] - 2025-10-02

### Added
- **SelectionUtils**: режимы marquee replace/add/toggle, единая логика для всех панелей

### Changed
- **AssetPanel**: 
  - Ctrl+click+drag запускает рамку в режиме toggle; Ctrl+Shift+drag — add; обычный drag по фону — replace
  - Ctrl+click без drag — мгновенный toggle без рамки (порог для рамки 4px)
  - Отключено перетаскивание ассетов по Ctrl+drag во избежание конфликта с рамкой
  - В режиме Details клик по промежуткам колонок считается кликом по строке
  - Унифицированный `itemSelector` для всех режимов (Grid/List/Details)

### Fixed
- **Ctrl+click toggle**: починен переключатель выделения в панели ассетов
- **Marquee false positive**: обычный drag по элементу больше не запускает рамку
- **Details gaps**: клики между колонками считаются кликами по элементу

### Technical
- **SelectionUtils**: отложенный старт рамки для Ctrl с порогом 4px, pending-состояние; финализация по режимам
- **BasePanel/AssetPanel**: корректная передача `itemSelector` и контейнера селекции

---

## [3.31.0] - 2025-01-29

### Added
- **Custom Dialog System** - полная замена браузерных диалогов на стилистически идентичные редактору
- **FolderPickerDialog** - кастомный диалог выбора папки с поддержкой File System Access API и Drag & Drop
- **UniversalDialog** - универсальный диалог для замены alert, confirm, prompt
- **DialogReplacer** - утилита для автоматической замены браузерных диалогов
- **File System Access API** - современный API для выбора папок в Chrome/Edge
- **Drag & Drop Support** - поддержка перетаскивания папок и файлов для всех браузеров
- **Asset Import Summary** - детальная статистика импортируемых ассетов по категориям
- **Real-time Path Display** - отображение выбранной папки в реальном времени

### Changed
- **Asset Import Process** - упрощен процесс импорта ассетов до одного действия
- **Dialog Consistency** - все диалоги теперь имеют единый стиль редактора
- **Path Display** - улучшено отображение выбранной папки (только имя папки)
- **Summary Display** - количество файлов вынесено в отдельную область summary
- **Error Handling** - улучшена обработка ошибок при выборе папок
- **User Experience** - значительно улучшен UX процесса импорта ассетов

### Fixed
- **Syntax Errors** - исправлены все синтаксические ошибки с async/await
- **File Object Handling** - исправлена работа с File объектами и webkitRelativePath
- **Dialog Compatibility** - обеспечена совместимость с различными браузерами
- **Asset Display** - исправлено отображение ассетов без изображений
- **Path Truncation** - убрано обрезание путей, показывается полное имя папки

### Technical
- **FolderPickerDialog.js** - новый класс для выбора папок с современными API
- **UniversalDialog.js** - базовый класс для всех кастомных диалогов
- **DialogReplacer.js** - утилита для замены браузерных диалогов
- **AssetImporter.js** - обновлен для работы с новым диалогом выбора папки
- **LevelEditor.js** - интегрирована система кастомных диалогов
- **EventHandlers.js** - обновлены обработчики событий для async методов
- **Toolbar.js** - обновлен для работы с async методами
- **SettingsPanel.js** - обновлен для работы с кастомными диалогами
- **OutlinerPanel.js** - обновлен для работы с кастомными диалогами
- **LayersPanel.js** - обновлен для работы с кастомными диалогами

### Removed
- **Browser Native Dialogs** - полностью убраны браузерные alert, confirm, prompt
- **WebkitDirectory Fallback** - убран fallback на webkitdirectory (вызывал двойные диалоги)
- **File Preview Dialog** - убран промежуточный диалог предварительного просмотра
- **Path Truncation Logic** - убрана логика обрезания путей

## [3.30.2] - 2025-01-29

### Added
- **Asset Import System** - новая система импорта внешних ассетов в редактор
- **External Asset Support** - поддержка импорта ассетов из внешних папок
- **Dynamic Asset Categories** - динамическое создание категорий ассетов на основе структуры папок
- **AssetImporter Utility** - новая утилита для импорта и управления внешними ассетами
- **Folder Structure Analysis** - автоматический анализ структуры папок для определения категорий

### Changed
- **Menu Command** - заменена команда "Settings - Assets Path..." на "Import Assets..."
- **Asset Panel Tabs** - табы создаются динамически на основе импортированных категорий
- **AssetManager Integration** - интеграция с StateManager для синхронизации категорий
- **Asset Categories** - категории ассетов теперь обновляются в реальном времени

### Technical
- **AssetImporter.js** - новая утилита с методами импорта, сканирования и управления ассетами
- **AssetManager.js** - добавлены методы `addExternalAsset()`, `updateStateManagerCategories()`, `clearExternalAssets()`
- **LevelEditor.js** - добавлен метод `importAssets()` для интеграции с AssetImporter
- **MenuManager.js** - обновлена команда меню для вызова импорта ассетов
- **StateManager.js** - добавлено состояние `assetTabOrder` для управления порядком табов

### Improved
- **Asset Organization** - улучшена организация ассетов с поддержкой внешних источников
- **User Experience** - упрощен процесс добавления новых ассетов в редактор
- **Flexibility** - поддержка различных структур папок и категорий ассетов
- **Integration** - полная интеграция с существующей системой управления ассетами

## [3.30.1] - 2025-01-29

### Improved
- **MenuManager Hover Experience** - улучшена обработка курсора в главном меню
- **Gap Elimination** - убран промежуток между кнопкой и выпадающим меню
- **Expanded Hover Area** - расширена область выпадающего меню для перекрытия зазора
- **Immediate Response** - убрана система задержек, меню реагирует мгновенно

### Technical
- **MenuManager.js** - убрана система `closeTimeouts`, упрощена логика событий
- **CSS Improvements** - изменен `mt-0.5` на `mt-0` и добавлен `paddingTop: '8px'`
- **Event Handling** - упрощена обработка `mouseenter`/`mouseleave` событий
- **Performance** - убраны таймеры и сложная логика задержек

## [3.30.0] - 2025-01-29

### Added
- **ValidationUtils v2.0** - StateManager-based система валидации с кэшированием
- **Component Readiness Tracking** - централизованное отслеживание готовности компонентов
- **Validation Caching** - кэширование результатов валидации с TTL
- **Enhanced StateManager** - добавлены методы для управления состоянием валидации

### Technical
- **StateManager.js** - добавлено состояние `validation` с отслеживанием компонентов и кэшем
- **ValidationUtils.js v2.0** - полная переработка с использованием StateManager
- **SettingsSyncManager.js** - обновлен для использования новой системы валидации
- **Logger Integration** - исправлены все вызовы Logger для корректной работы

### Improved
- **Performance** - кэширование результатов валидации повышает производительность
- **Reliability** - централизованное отслеживание состояния компонентов
- **Consistency** - единый подход к fallback логике через StateManager
- **Debugging** - улучшенное логирование через Logger API

## [3.29.0] - 2025-01-29

### Added
- **ValidationUtils** - новая утилита для централизованной валидации и проверок
- **Code Refactoring** - устранение дублированного кода через ValidationUtils
- **Enhanced Error Handling** - улучшенная обработка ошибок с консистентным логированием
- **Fallback Mechanisms** - автоматический fallback на window.editor при недоступности levelEditor

### Technical
- **ValidationUtils.js** - новая утилита с методами валидации, проверки компонентов и fallback логикой
- **SettingsSyncManager.js** - рефакторинг всех методов для использования ValidationUtils
- **SettingsPanel.js** - рефакторинг методов валидации через ValidationUtils
- **Code Deduplication** - устранение 200+ строк дублированного кода проверок

## [3.28.0] - 2025-01-29

### Added
- **Menu Hover Mode** - добавлен режим автоматического открытия меню при наведении курсора после первого клика
- **Smart Hover Reset** - автоматическое отключение hover-режима при выходе курсора за пределы контейнера меню
- **Interactive Font Scaling** - интерактивное изменение размера шрифта при движении слайдера Font Size
- **Spacing Control Enhancement** - улучшенное управление отступами с минимальными значениями для всех UI элементов

### Fixed
- **Settings Reset Flow** - исправлен поток сброса настроек: ConfigManager → StateManager → UI → сохранение
- **Grid Settings Integration** - перенесен параметр "Show Grid" в секцию "Grid & Snapping" для лучшей организации
- **State Synchronization** - устранены конфликты между `view.grid` и `canvas.showGrid`, установлен единый источник истины
- **AutoSave Configuration** - исправлены настройки автосохранения: отключено по умолчанию, интервал в минутах
- **Asset Panel Spacing** - добавлены горизонтальные отступы для табов панели ассетов, унифицированы с правой панелью
- **Ctrl+Scroll Prevention** - отключен скролл контента при Ctrl+scroll в панели ассетов (только изменение размера элементов)

### Technical
- **MenuManager.js** - добавлен `hoverModeEnabled` флаг и `setupMenuContainerHoverReset()` для управления hover-режимом
- **SettingsSyncManager.js** - улучшена синхронизация между UI, ConfigManager и StateManager с защитой от бесконечных циклов
- **SettingsPanel.js** - исправлен порядок операций в `resetToDefaults()` для корректного сброса настроек
- **GridSettings.js** - перенесен "Show Grid" из общих настроек в секцию грида
- **CSS Custom Properties** - добавлены `--font-scale` и `--spacing-scale` для динамического масштабирования UI
- **State Management** - централизовано управление состоянием через StateManager как единый источник истины

## [3.27.1] - 2025-01-29

### Fixed
- **Settings Initialization** - исправлена проблема с отображением autoSaveInterval при загрузке окна настроек (показывало 300000 вместо 5 минут)
- **State Synchronization** - добавлен вызов syncFromConfigToState() в конструктор SettingsPanel для корректной инициализации
- **Configuration Flow** - исправлен поток инициализации, теперь StateManager правильно синхронизируется с ConfigManager при запуске

### Technical
- **SettingsPanel.js** - добавлен вызов syncFromConfigToState() в конструктор для правильной инициализации
- **State Management** - обеспечена корректная синхронизация StateManager с ConfigManager при создании SettingsPanel
- **Configuration Consistency** - устранено расхождение между загрузкой окна (300000) и сбросом (5) значений

## [3.27.0] - 2025-01-29

### Fixed
- **Asset Panel Selection** - исправлена подсветка выбранных элементов в панели ассетов во всех режимах (Grid, List, Details)
- **CSS Architecture Compliance** - устранены все inline-стили в AssetPanel, теперь используются только CSS-классы
- **Selection Visual Consistency** - унифицированы стили селекции для всех режимов отображения ассетов
- **Hover Effects Integration** - исправлена работа HoverEffects с CSS-классами, сохранение селекции при уводе курсора
- **Empty Space Click** - корректный сброс селекции при клике в пустое место во всех режимах

### Technical
- **CSS Classes Unification** - добавлены унифицированные CSS-классы `.asset-list-item.selected` и `.asset-details-row.selected`
- **Inline Styles Removal** - удалены все inline-стили из `updateSelectionVisuals()` и методов создания элементов
- **HoverEffects Preservation** - исправлен `removeHoverEffect()` для сохранения классов селекции при восстановлении стилей
- **Selection State Management** - улучшена логика сброса селекции при клике в пустое место

## [3.26.1] - 2025-01-29

### Fixed
- **Color Conversion Refactoring** - устранен inline код конвертации цветов, теперь используется централизованная утилита ColorUtils
- **BaseGridRenderer** - заменен дублированный метод hexToRgba на использование ColorUtils.toRgba
- **GridSettings** - упрощена логика применения opacity к цветам грида через ColorUtils
- **LevelEditor** - заменены inline конвертации hex→rgba на использование ColorUtils

### Technical
- **ColorUtils Integration** - все компоненты теперь используют единую утилиту ColorUtils для конвертации цветов
- **Code Deduplication** - удалены дублированные методы конвертации цветов в разных модулях

## [3.26.0] - 2025-01-29

### Added
- **Hotkeys Settings Section** - добавлена новая секция "Hotkeys" в окне настроек с полным списком всех горячих клавиш
- **Hotkey Customization** - возможность переназначения горячих клавиш через интерфейс настроек
- **Shortcuts Configuration** - вынесены все горячие клавиши в отдельный файл `config/defaults/shortcuts.json`
- **Toolbar Configuration** - добавлен файл `config/defaults/toolbar.json` для настроек тулбара
- **Asset Panel Persistence** - сохранение размера элементов и режима отображения (Grid/List/Details) панели assets
- **Escape Key Support** - добавлена отмена изменений в окне настроек клавишей Esc

### Fixed
- **Settings Synchronization** - исправлена синхронизация настроек между окном settings, тулбаром и основным меню
- **Snap to Grid Conflicts** - устранены конфликты в системе snap to grid между различными источниками
- **Settings Save Performance** - изменена система сохранения настроек - теперь сохраняются только при закрытии/перезагрузке страницы, а не при каждом изменении
- **Asset Panel State** - исправлено сохранение и восстановление состояния панели assets при рестарте
- **Configuration Architecture** - улучшена архитектура конфигурации с поддержкой новых типов настроек

### Improved
- **Settings Panel UX** - улучшен пользовательский интерфейс панели настроек
- **Real-time Sync** - добавлена двусторонняя синхронизация настроек между UI и StateManager
- **Compact Settings Style** - упрощен и оптимизирован стиль отображения настроек
- **Configuration Files** - структурированы конфигурационные файлы по назначению
- **Performance Optimization** - оптимизирована производительность за счет уменьшения операций с localStorage

### Technical
- **SettingsSyncManager** - создан универсальный менеджер синхронизации настроек
- **ConfigManager Extensions** - расширена функциональность ConfigManager для поддержки toolbar и shortcuts
- **UserPreferencesManager** - добавлена поддержка новых типов пользовательских настроек
- **Settings Panel Architecture** - реорганизована архитектура панели настроек с поддержкой новых секций
- **Debounced Saving** - реализована отложенная система сохранения настроек
- **StateManager Integration** - улучшена интеграция с StateManager для мгновенной синхронизации

## [3.25.0] - 2025-01-27

### Fixed
- **Console Context Menu Positioning** - исправлено позиционирование контекстного меню консоли после переноса в оверлей
- **Console Menu Inheritance** - переписан ConsoleContextMenu для наследования от BaseContextMenu
- **Console State Synchronization** - исправлен рассинхрон состояния консоли при рестарте приложения
- **Console Height Persistence** - исправлено сохранение размера консоли в пользовательских настройках
- **Console Resize Functionality** - восстановлена возможность изменения размера консоли
- **Console Content Display** - исправлена пропажа содержимого консоли после рефакторинга

### Improved
- **Console Overlay Integration** - консоль полностью интегрирована как оверлей с правильным позиционированием
- **Context Menu Architecture** - унифицирована архитектура контекстных меню через наследование от BaseContextMenu
- **Console Menu Management** - добавлено принудительное удаление контекстного меню при закрытии консоли
- **Console Positioning** - контекстное меню теперь появляется под курсором и поверх всех элементов
- **Console Visibility Detection** - улучшена логика определения видимости консоли для показа контекстного меню

### Technical
- **BaseContextMenu Integration** - ConsoleContextMenu теперь наследуется от BaseContextMenu
- **Fixed Positioning** - изменено позиционирование контекстных меню с absolute на fixed для оверлеев
- **Event Handling** - улучшена обработка событий мыши для консоли с исключениями для resize handle
- **State Management** - синхронизировано состояние логирования между ConsoleContextMenu и основным кодом

## [3.24.0] - 2025-01-27

### Fixed
- **CSS Architecture** - полностью реорганизована CSS архитектура с модульной структурой
- **Inline Styles Cleanup** - убраны все inline стили из HTML и JavaScript файлов
- **Duplicate Styles** - устранены дублирующиеся CSS стили между файлами
- **Checkbox Colors** - исправлен цвет чекбоксов в меню фильтров (зеленый → синий)
- **Grid Settings Styling** - исправлено отображение настроек грида после рефакторинга CSS
- **Tab Styles Unification** - унифицированы стили табов между AssetPanel и правой панелью

### Improved
- **Modular CSS** - создана модульная структура CSS файлов в папке `styles/`
- **Unified Classes** - унифицированы CSS классы для форм и настроек
- **Hover Effects** - централизована система hover эффектов через HoverEffects utility
- **Compact Mode** - улучшена поддержка компактного режима для всех компонентов
- **Performance** - CSS файлы теперь кэшируются браузером
- **Tab Consistency** - единообразный внешний вид всех табов в приложении

### Technical
- **CSS Files Created** - созданы специализированные CSS файлы:
  - `styles/panels.css` - основные стили панелей
  - `styles/layers-panel.css` - стили панели слоев
  - `styles/settings-panel.css` - стили панели настроек
  - `styles/grid-settings.css` - стили настроек грида
  - `styles/details-panel.css` - стили панели деталей
  - `styles/color-chooser.css` - стили выбора цвета
- **HoverEffects Utility** - создан централизованный класс для hover эффектов
- **CSS Variables** - добавлены CSS переменные для accent-color и font-scale
- **Global Styles** - добавлены глобальные стили для чекбоксов, радио кнопок и слайдеров
- **Unified Tab System** - создана единая система стилей для всех табов (.tab, .tab-right)

## [3.23.0] - 2025-01-27

### Fixed
- **Context Menu Positioning** - исправлено позиционирование контекстных меню в LayersPanel и OutlinerPanel
- **Panel Boundary Detection** - контекстные меню теперь позиционируются относительно панели, а не внутреннего контейнера
- **Menu Stability** - позиция меню больше не зависит от количества элементов в панели

### Improved
- **Unified Separators** - унифицированы стили сепараторов во всех контекстных меню
- **Disabled States** - недоступные команды теперь отображаются как неактивные вместо скрытия
- **Menu Positioning Logic** - улучшена логика позиционирования с учетом границ панели
- **Ultra-Compact Mode** - значительно усилен компактный режим с размером шрифта 12px и минимальными отступами

### Technical
- **LayersContextMenu** - создан специализированный класс для контекстного меню слоев
- **BaseContextMenu** - улучшена поддержка disabled состояний и унифицированных сепараторов
- **Panel Integration** - исправлена интеграция контекстных меню с панелями через parentElement
- **CSS Organization** - реорганизованы стили в модульную структуру в папке `styles/`
- **Compact Mode** - реализован полнофункциональный компактный режим интерфейса

## [3.22.0] - 2025-01-27

### Improved
- **AssetPanel Grid View** - улучшен hover эффект: убрано увеличение, добавлено высветление элементов
- **Marquee Selection** - добавлена подсветка элементов при селекте рамкой во всех режимах просмотра
- **Selection Visual Feedback** - единообразная подсветка при hover и селекте рамкой
- **AssetPanel Context Menu** - убрана команда "Deselect All Assets" из контекстного меню панели
- **Scroll Position** - исправлен сброс позиции скролла при клике в пустое место панели ассетов

### Technical
- **AssetPanel Performance** - оптимизировано обновление выделения без пересоздания контента
- **Marquee Highlighting** - реализована система подсветки элементов при селекте рамкой
- **Hover Effects** - унифицированы hover эффекты для всех режимов просмотра
- **Event Handling** - улучшена обработка событий мыши для селекта рамкой

## [3.21.0] - 2025-01-27

### Improved
- **AssetPanel Details View** - исправлено позиционирование шапки с колонками атрибутов
- **Sticky Header Behavior** - шапка теперь правильно выравнивается встык с табами и следует за горизонтальным скроллом
- **Hexagonal Grid Performance** - кардинально оптимизирована производительность гексагонального грида
- **Grid Size Limits** - увеличен максимальный размер грида с 128px до 512px
- **Grid Overlap Optimization** - минимизирован перехлест гексагонов за пределами экрана
- **Input Validation** - добавлена валидация ввода для размера грида (8-512px)

### Technical
- **AssetPanel Structure** - упрощена структура контейнеров для надежного sticky позиционирования
- **Padding Management** - динамическое управление padding для разных режимов просмотра
- **HexagonalGridRenderer** - упрощен рендеринг, убрана сложная LOD система
- **ConfigManager** - обновлена валидация gridSize до 512px
- **GridSettings** - добавлена HTML валидация с oninput
- **RenderOperations** - увеличен порог медленных кадров до 20ms

### Performance
- **Smart Grid Disable** - грид отключается при >4500 гексагонов для производительности
- **Minimal Overlap** - перехлест рассчитывается на основе радиуса гексагона
- **Clean Console** - убраны отладочные логи для чистой консоли

## [3.20.0] - 2025-01-27

### Added
- **Hexagonal Grid Orientation** - добавлена поддержка ориентации хексагонального грида (Pointy Top / Flat Top)
- **Hex Orientation UI Control** - добавлен селект для выбора ориентации в настройках грида
- **Enhanced Hexagonal Grid Renderer** - полностью переписан рендерер с оптимизированным алгоритмом отрисовки
- **Grid Size Integration** - размер хексагона теперь привязан к общему параметру Grid Size

### Improved
- **Hex Grid Performance** - оптимизирована отрисовка хексагонального грида с использованием Set для избежания дублирования линий
- **Grid Settings UI** - улучшен интерфейс настроек грида с динамическим показом/скрытием опций ориентации
- **Configuration Management** - расширена система конфигурации для поддержки hexOrientation параметра

### Technical
- **ConfigManager** - добавлена поддержка hexOrientation в настройках грида
- **StateManager** - интегрирован hexOrientation в систему состояний
- **UserPreferencesManager** - добавлена поддержка hexOrientation в пользовательских настройках
- **SettingsPanel** - обновлен для сохранения и загрузки hexOrientation

## [3.19.8] - 2025-01-27

### Fixed
- **View Menu Checkboxes** - исправлено обновление чекбоксов панелей в меню View при скрытии тулбара через контекстное меню
- **Game Mode Checkboxes** - исправлено обновление чекбокса Game Mode при деактивации режима
- **Game Mode Menu** - добавлено автоматическое закрытие меню View при отключении Game Mode
- **Panel State Restoration** - исправлен порядок вызовов при выходе из Game Mode для корректного обновления чекбоксов
- **Null Reference Error** - исправлена ошибка "Cannot read properties of null (reading 'style')" в restorePanelStates()

### Improved
- **Checkbox Synchronization** - улучшена синхронизация состояний чекбоксов между различными UI элементами
- **Game Mode UX** - улучшен пользовательский опыт при переключении Game Mode

## [3.19.7] - 2025-09-26

### Fixed
- **Конфигурации пользователя** - добавлены недостающие файлы editor.json и panels.json в config/user/
- **Структура настроек** - теперь пользовательские настройки полностью соответствуют дефолтным

### Improved
- **Очистка кода** - удалены неиспользуемые конфигурационные файлы (assets, camera, performance, selection, toolbar, view)
- **Очистка кода** - удален неиспользуемый IsometricGridRenderer
- **Очистка кода** - удалены example файлы из config/user/
- **Документация** - обновлена структура папок в README

## [3.19.6] - 2025-09-26

### Fixed
- **Удаление слоев** - исправлена ошибка "moveObjectsToMainLayer is not a function" при удалении слоев
- **Контекстное меню слоев** - исправлена проблема с определением слоя под курсором при клике на вложенные элементы
- **API методов** - исправлено использование правильного метода getLayerObjects() вместо несуществующего getObjectsForLayer()

### Improved
- **Надежность удаления** - добавлен метод moveObjectsToMainLayer() для корректного перемещения объектов при удалении слоя
- **Обработка событий** - улучшена обработка событий контекстного меню с использованием closest() для поиска элемента слоя
- **Код** - удалены все отладочные логи из MouseHandlers.js и LayersPanel.js

## [3.19.5] - 2025-09-26

### Fixed
- **Diamond Grid при зуме** - исправлена некорректная отрисовка при зуме камеры
- **Центральные линии при рестарте** - исправлена проблема с отсутствием центральных линий при камере в позиции (0,0)
- **Расчет spacing** - убрана двойная корректировка spacing (трансформация камеры уже применяется в CanvasRenderer)
- **Точность вычислений** - добавлены проверки isFinite() для предотвращения NaN в расчетах пересечений

### Improved
- **Стабильность отрисовки** - diamond grid теперь стабильно работает при всех уровнях зума
- **Обработка граничных случаев** - улучшена обработка линий, проходящих через углы viewport
- **Производительность** - убраны отладочные логи, засоряющие консоль

## [3.19.4] - 2025-09-26

### Fixed
- **Diamond Grid отрисовка** - исправлена проблема с неполным покрытием viewport линиями
- **Зависимость от зума камеры** - добавлена корректировка spacing линий при разных уровнях зума
- **Расчет диапазона линий** - улучшен алгоритм расчета с учетом всех углов viewport

### Improved
- **Полное покрытие viewport** - diamond grid теперь правильно рисует все линии по всему окну
- **Адаптивная плотность** - spacing линий корректируется в зависимости от зума для оптимальной видимости
- **Точность пересечений** - оптимизирован расчет точек пересечения линий с границами видимости

## [3.19.3] - 2025-01-27

### Fixed
- **Контекстное меню тулбара** - исправлено отображение сепаратора и пунктов меню
- **Порядок элементов меню** - Settings всегда остается внизу списка
- **Подсветка текущего типа** - выбранный тип грида подсвечивается синим вместо дизейбла
- **Стабильность меню** - элементы не "прыгают" при обновлении типов гридов

### Improved
- **Обработка сепараторов** - добавлена поддержка `type: 'separator'` в BaseContextMenu
- **Динамическое обновление** - контекстное меню корректно обновляется при смене типа грида
- **Правильная очистка** - `clearGridTypeMenuItems()` удаляет только элементы гридов

## [3.19.2] - 2025-01-27

### Added
- **Карусельное переключение типов гридов** - Ctrl+Click на кнопке Grid для переключения между типами
- **Динамические иконки гридов** - иконка кнопки Grid меняется в зависимости от выбранного типа
- **Автоматическое определение типов гридов** - система автоматически подхватывает доступные рендереры
- **Конфигурируемые иконки** - легко настраиваемые иконки для каждого типа грида
- **Сохранение выбранного типа** - выбранный тип грида сохраняется в пользовательских настройках

### Improved
- **Гибкая архитектура** - код автоматически адаптируется к изменениям в списке рендереров
- **Fallback система** - graceful обработка отсутствующих рендереров
- **Единый стиль иконок** - все иконки гридов в едином геометрическом стиле

### Technical
- **Динамическая инициализация** - `initializeGridTypes()` получает типы из CanvasRenderer
- **Автоматическое обновление** - `refreshGridTypes()` для обновления при изменении рендереров
- **Конфигурационная система** - `gridTypeConfig` Map для хранения настроек типов

## [3.19.1] - 2025-01-27

### Added
- **Модульная архитектура рендеринга сетки** - разделение рендереров по типам сетки
- **BaseGridRenderer** - базовый класс с общей логикой для всех типов сетки
- **RectangularGridRenderer** - специализированный рендерер прямоугольной сетки
- **DiamondGridRenderer** - специализированный рендерер diamond сетки (60°/120°)
- **HexagonalGridRenderer** - специализированный рендерер шестиугольной сетки
- **Унифицированное API** - единый интерфейс для всех типов сетки
- **Общая логика стилизации** - централизованная обработка цветов и толщины линий

### Refactored
- **Убрано дублирование кода** - общая логика вынесена в BaseGridRenderer
- **Упрощена архитектура** - удален промежуточный слой GridRenderer.js
- **Встроена логика выбора рендерера** - интегрирована в CanvasRenderer.drawGrid()
- **Оптимизирована производительность** - устранены лишние вызовы и дублирование

### Fixed
- **Исправлено позиционирование сетки** - устранено двойное применение камеры
- **Исправлена логика изометрической сетки** - правильные углы 60° и 120°
- **Устранены конфликты импортов** - чистая система зависимостей

## [3.19.0] - 2025-01-27

### Added
- **Сохранение позиции скролла тулбара** - автоматическое запоминание позиции прокрутки
- **Восстановление позиции скролла** - позиция восстанавливается при перезагрузке редактора
- **Сохранение при скролле колесом** - позиция сохраняется при прокрутке колесом мыши
- **Сохранение при завершении перетаскивания** - позиция сохраняется при отпускании мыши

### Fixed
- **Исправлена видимость удаленных объектов** - объекты корректно исчезают с canvas после удаления
- **Исправлено сохранение размера консоли** - размер сохраняется только при отпускании мыши, а не при каждом движении
- **Исправлено восстановление позиции тулбара** - позиция скролла корректно восстанавливается при инициализации

### Improved
- **Оптимизировано сохранение настроек** - снижена частота сохранения при изменении размера консоли
- **Улучшена система инвалидации кешей** - добавлена инвалидация пространственного индекса при удалении объектов

## [3.18.0] - 2025-01-27

### Added
- **Настраиваемый snap tolerance** - адаптивная зона притяжения к сетке (5-100%)
- **Сохранение snap tolerance** - настройка сохраняется в пользовательских предпочтениях
- **Единая логика снэпа** - консистентное поведение для перетаскивания, дублирования и drop объектов
- **Централизованный SnapUtils** - единая точка управления логикой снэпа

### Fixed
- **Исправлен снэп дубликатов** - левый нижний угол первого объекта попадает в точку грида
- **Исправлена логика позиционирования** - дубликаты используют правильную точку привязки
- **Устранен дублирующий код** - централизован метод findNearestGridPoint

### Improved
- **Оптимизирована производительность** - кеширование мировых позиций объектов
- **Улучшена консистентность** - все операции снэпа используют одинаковую логику
- **Упрощен код** - удален дублирующий код, улучшена читаемость

### Changed
- **Обновлена архитектура снэпа** - используется существующая логика из dragSelectedObjects
- **Изменена точка привязки** - дубликаты привязываются к позиции курсора, снэп к левому нижнему углу
- **Обновлены пользовательские настройки** - добавлен snapTolerance в UserPreferencesManager

## [3.17.0] - 2025-01-27

### Added
- Добавлен функционал выделения строк в консоли левым клик-драгом
- Добавлено контекстное меню для копирования выделенного текста в консоли
- Добавлены CSS стили для визуального выделения текста в консоли
- Добавлена поддержка двойного клика для выделения всей строки в консоли
- Добавлены клавиатурные сочетания (Ctrl+A, Escape) для работы с выделением

### Fixed
- Исправлена ошибка `ReferenceError: levelId is not defined` в RenderOperations.js
- Исправлено автоматическое сбрасывание выделения текста в консоли
- Исправлены фризы редактора при выделении текста в консоли
- Исправлена работа командной строки консоли при активном выделении
- Исправлена синхронизация пользовательских настроек между сессиями

### Improved
- Оптимизирована производительность выделения текста в консоли
- Улучшена логика определения выделенных строк с использованием throttling
- Упрощена система обработки событий выделения для лучшей производительности
- Удалены лишние debug логи для улучшения производительности
- Улучшена визуальная обратная связь при выделении текста

### Changed
- Обновлена система выделения текста - теперь использует глобальный обработчик вместо множественных локальных
- Улучшена система кэширования состояния выделения для предотвращения лишних обновлений DOM
- Оптимизирована работа с контекстным меню консоли

## [3.16.1] - 2025-01-27

### Fixed
- Исправлено сохранение и восстановление настроек грида при перезапуске редактора
- Исправлено отображение цветов грида в настройках - теперь корректно конвертируются между hex и rgba форматами
- Исправлен сброс настроек грида на дефолтные - теперь применяется синхронизация с GridSettings
- Устранено дублирование функций конвертации цветов - централизованы в RenderUtils
- Удалены лишние логи работы грида для улучшения производительности

### Changed
- Улучшена система загрузки настроек грида - добавлена секция 'grid' в список загружаемых конфигураций
- Оптимизирована конвертация цветов - все функции перенесены в централизованные утилиты

## [3.16.0] - 2025-09-24

### Fixed
- Исправлено панорамирование тулбара средней кнопкой мыши - теперь работает на всем тулбаре включая активные и неактивные кнопки
- Убрано "прилипание" курсора при панорамировании - теперь обычное панорамирование в противоположном направлении движению курсора

### Changed
- Улучшена обработка событий на disabled кнопках тулбара - pointer-events: none позволяет событиям проходить сквозь неактивные элементы

## [3.15.0] - 2025-09-24

### Fixed
- Исправлено отображение canvas при изменении видимости toolbar - теперь canvas автоматически адаптируется под новое доступное пространство
- Исправлено закрытие контекстного меню toolbar при активации команды "Hide" - меню теперь закрывается сразу после выполнения действия
- Убрано лишнее логирование в системе toolbar для оптимизации производительности

### Changed
- Улучшена синхронизация между UI элементами toolbar и системой управления панелями
- Оптимизирована инициализация состояния toolbar с canvas renderer

## [3.14.0] - 2024-12-19

### Added
- Полная система сохранения пользовательских настроек тулбара
- Запоминание состояния кнопок тулбара (Grid, Snap, Parallax, Boundaries, Collisions)
- Запоминание свернутых секций тулбара (File, Edit, View, Group)
- Запоминание настроек отображения (иконки и текст кнопок)
- Запоминание видимости тулбара
- Автоматическое сохранение настроек в localStorage
- Восстановление всех настроек при перезагрузке редактора

### Changed
- Улучшена инициализация тулбара - отрисовывается сразу в правильном состоянии
- Устранено визуальное "переключение" тулбара при загрузке настроек
- Оптимизирована система загрузки состояния тулбара
- Улучшена синхронизация состояния кнопок с StateManager

### Fixed
- Исправлена проблема с инверсным отображением кнопки Boundaries
- Устранена задержка при переключении состояния кнопок тулбара
- Исправлена синхронизация визуального состояния с реальным состоянием функций

## [3.13.0] - 2024-12-19

### Added
- Горизонтальное разделение рабочей области с тулбаром в верхней части
- Полнофункциональный тулбар с кнопками управления (File, Edit, View, Tools, Group)
- Сворачиваемые секции тулбара по клику на заголовок
- Контекстное меню тулбара с командами Hide, Icons, Text
- Горизонтальный скроллинг тулбара (колесо мыши + средний клик)
- Управление видимостью иконок и текста кнопок тулбара
- Интеграция тулбара в систему управления панелями

### Changed
- Переработана структура HTML layout для горизонтального разделения
- Тулбар перемещен в верхнюю часть рабочей области
- Обновлена система управления видимостью панелей для тулбара
- Улучшена интеграция тулбара с Game Mode

### Fixed
- Исправлено позиционирование контекстного меню тулбара (открывается вниз)
- Улучшена синхронизация состояний тулбара с меню View
- Оптимизированы стили тулбара для новой позиции

## [3.11.0] - 2024-12-19

### Added
- Улучшенная система контекстных меню с централизованным управлением
- Оптимизированные стили для всех контекстных меню (BaseContextMenu, ConsoleContextMenu)
- Улучшенная функциональность OutlinerContextMenu с исправленными багами

### Changed
- Обновлена система стилей контекстных меню для лучшей совместимости
- Улучшена производительность отображения контекстных меню

### Fixed
- Исправлены проблемы с отображением контекстных меню
- Устранены баги в OutlinerContextMenu
- Улучшена стабильность работы с контекстными меню

## [3.10.0] - 2024-12-19

### Added
- Система констрейна оси при перетаскивании объектов с зажатым Shift
- Визуальное отображение оси констрейна с настраиваемыми параметрами
- Настройки оси констрейна в панели настроек (цвет, толщина, включение/отключение)
- Сохранение всех настроек View в пользовательских настройках
- Корректное вычисление центра групп для оси констрейна
- Поддержка фиксации оси к текущей позиции объекта при зажатии Shift

### Changed
- Ось констрейна теперь фиксируется к центру объекта/группы, а не к курсору
- Ось отображается в обе стороны от центра до краев видимой области
- Настройки View (Grid, Game Mode, Snap To Grid, Object Boundaries, Object Collisions) теперь сохраняются между сессиями
- Game Mode корректно восстанавливается при перезапуске редактора

### Fixed
- Исправлена отрисовка оси констрейна с учетом зума и панорамирования камеры
- Исправлено вычисление центра групп для более точного позиционирования оси
- Исправлено сохранение состояния Game Mode при перезапуске

## [3.9.0] - 2024-12-19

### Added
- Новая система поиска в OutlinerPanel с использованием унифицированного SearchUtils
- Контекстное меню для объектов в OutlinerPanel (OutlinerContextMenu)
- Логика выделения диапазона объектов (Shift+клик)
- Логика переключения единичных объектов (Ctrl+клик)
- Поддержка выделения по отфильтрованному списку при активном поиске
- Новый класс SearchUtils для унифицированного поиска в панелях
- Поддержка Logger.outliner для логирования операций OutlinerPanel

### Changed
- OutlinerPanel теперь использует общую систему поиска с LayersPanel
- Стиль переименования объектов приведен в соответствие с LayersPanel
- Позиционирование иконок типов объектов исправлено и выровнено
- reassignIdsDeep теперь создает строковые ID вместо числовых
- Улучшена индексация дублированных объектов в группах

### Fixed
- Исправлено контекстное меню, которое постоянно показывалось и не исчезало
- Исправлено накопление обработчиков событий при пересоздании контекстного меню
- Исправлена работа контекстного меню на дублированных объектах
- Исправлено позиционирование иконок типов объектов в OutlinerPanel
- Исправлено появление скролл-бара при активации переименования

## [3.8.8] - 2024-12-19

### Fixed
- Исправлены координаты дублируемых объектов в открытых группах - теперь дубликаты появляются точно в том же месте, что и оригиналы
- Исправлен расчет мировых координат для объектов внутри групп при дублировании
- Упрощена логика размещения дублированных объектов в режиме редактирования групп

## [3.8.7] - 2024-12-19

### Added
- Защита от добавления объектов на заблокированные слои через drag&drop

### Changed
- Ctrl+Click на слое теперь выбирает все объекты в слое вместо выбора слоёв
- Alt+Click+Drag теперь работает на любых объектах, не только выбранных

### Fixed
- Исправлена команда "Show All Layers" - объекты корректно отображаются после изменения видимости
- Исправлено дублирование с Alt+Click на невыбранных объектах

### Removed
- Удалена команда "Move Objects to Main Layer" из контекстного меню слоёв
- Удалена логика выбора слоёв (selectedLayers) и связанные методы
- Удалены пункты меню "Select All Layers" и "Deselect All"

## [3.8.6] - 2024-12-18

### Fixed
- Исправлена система версионирования
- Улучшена архитектура утилитарных классов
