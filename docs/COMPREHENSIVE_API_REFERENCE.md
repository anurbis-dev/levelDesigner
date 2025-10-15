# Полный справочник API Level Editor v3.50.1

## Обзор

Этот документ содержит полный список всех методов и функций, доступных в Level Editor. Используйте его для понимания существующего API и избежания дублирования функциональности.

> 📖 **Подробная документация:** См. [API_REFERENCE.md](./API_REFERENCE.md) для детальных описаний, примеров кода, обработки ошибок и лучших практик использования API.

## Изменения v3.50.1

### ConsoleContextMenu - Автоматический скролл консоли

#### **Новые методы:**
- `toggleAutoScroll()` - Переключение авто-скролла консоли
- `onAutoScrollToggle` callback - Callback для управления авто-скроллом

#### **Обновленные методы:**
- `setupMenuItems()` - Добавлен пункт "Toggle Auto Scroll"
- `constructor()` - Добавлен callback `onAutoScrollToggle`

## Изменения v3.50.0

### 🎨 **DetailsPanel - Компактный лейаут с унифицированными секциями**

#### **Новые методы:**
- `renderCompactObjectDetails(obj)` - Компактный рендеринг для одиночных объектов
- `renderCompactMultipleObjects(objects)` - Компактный рендеринг для множественного выбора
- `renderCompactLevelDetails()` - Компактный рендеринг для уровня
- `createTransformsSectionHTML(objOrObjects)` - Общий метод создания HTML для трансформаций
- `renderLevelStatistics(stats)` - Статистика уровня в компактном виде
- `renderLevelActions()` - Действия с уровнем в отдельной секции

#### **Улучшенные секции:**
- **Basic Properties**: `renderBasicProperties(obj)` / `renderMultipleBasicProperties(objects)`
- **Transforms**: `renderTransformsSection(obj)` / `renderMultipleTransformsSection(objects)`
- **Visual**: `renderVisualProperties(obj)` / `renderMultipleVisualProperties(objects)`
- **Advanced**: `renderAdvancedProperties(obj)` / `renderMultipleAdvancedProperties(objects)`
- **Custom Properties**: `renderCustomProperties(obj)` / `renderMultipleCustomProperties(objects)`
- **Layer Information**: `renderLayerInfo(obj)` / `renderMultipleLayerInfo(objects)`

#### **Оптимизация кода:**
- Устранено дублирование HTML в методах трансформаций
- Создан общий метод `createTransformsSectionHTML()` для переиспользования
- Сокращено ~60 строк дублированного кода
- Улучшена поддерживаемость и консистентность

---

## Изменения v3.49.6

### AssetPanel - исправления drag-n-drop и tab dragging
**Файл**: `src/ui/AssetPanel.js`
- **ИСПРАВЛЕНО**: Конфликт CSS классов `drag-over` между табами и файлами
- **ДОБАВЛЕНО**: Флаг `tabDraggingSetup` для предотвращения множественных обработчиков
- **ДОБАВЛЕНО**: Корректный cleanup обработчиков событий в `destroy()`
- **Проблема**: При перетаскивании табов срабатывала подсветка drop для файлов
- **Решение**: Разделены CSS классы на `tab-drag-over` для табов и `drag-over` для файлов
- **Технические детали**:
  - `this.tabMouseUpHandler` - ссылка на обработчик tab dragging для cleanup
  - `this.foldersMouseMoveHandler` и `this.foldersMouseUpHandler` - ссылки на обработчики folders resizer
  - Проверка `if (!this.tabDraggingSetup)` предотвращает повторную настройку

### MouseHandlers - проверки на tab dragging
**Файл**: `src/core/MouseHandlers.js`
- **ДОБАВЛЕНО**: Проверки `isDraggingTab` в `handleDragOver()` и `handleDrop()`
- **Проблема**: Глобальные drag обработчики конфликтовали с tab dragging
- **Решение**: Добавлены проверки `e.target.closest('.tab')` и `this.editor.assetPanel?.isDraggingTab`
- **Результат**: Предотвращены конфликты между tab dragging и file drag-n-drop

### CSS стили - разделение drag классов
**Файл**: `styles/main.css`
- **ДОБАВЛЕНО**: Поддержка класса `tab-drag-over` для табов
- **ИЗМЕНЕНО**: CSS правила теперь поддерживают оба класса `drag-over` и `tab-drag-over`
- **Результат**: Разные визуальные эффекты для разных типов drag операций

## Изменения v3.49.3

### DuplicateUtils - исправление позиционирования дубликатов в группах
**Файл**: `src/utils/DuplicateUtils.js`
- **ИСПРАВЛЕНО**: `initializePositions(objects, worldPos, editor)` - исправлено позиционирование внешних объектов при дублировании в режиме редактирования групп
- **Проблема**: При Alt+click+drag внешних объектов в открытой группе дубликаты получали неправильную позицию
- **Решение**: Добавлена проверка принадлежности объекта к активной группе через `isObjectInGroupRecursive()`
- **Логика**: 
  - Объекты внутри группы → группо-относительное позиционирование
  - Внешние объекты → стандартное мировое позиционирование

## Изменения v3.49.2

### ObjectOperations
- **НОВОЕ**: `_sortObjectsByZIndexDescending(objects)` - вспомогательная функция для сортировки объектов по zIndex в убывающем порядке
- **ИЗМЕНЕНО**: `findObjectAtPoint(x, y)` - теперь все объекты обрабатываются по zIndex без приоритета групп

### MouseHandlers  
- **ИЗМЕНЕНО**: `dragSelectedObjects(worldPos, e)` - исправлен порядок операций при перетаскивании в группы, добавлен отложенный рендеринг

### DuplicateOperations
- **ИЗМЕНЕНО**: Добавлен импорт Logger для корректной работы

## Изменения v3.30.2

### AssetImporter - новая утилита импорта ассетов
**Файл**: `src/utils/AssetImporter.js`
- **`constructor(assetManager)`** - инициализация с AssetManager
- **`importFromFolder(folderPath)`** - основной метод импорта ассетов из папки
- **`checkFolderAccess(folderPath)`** - проверка доступности папки
- **`scanFolderStructure(folderPath)`** - анализ структуры папок для определения категорий
- **`scanCategoryFolder(categoryPath, categoryName)`** - сканирование конкретной категории
- **`generateMockAssetsForCategory(categoryName)`** - генерация тестовых ассетов для категории
- **`importAssetsFromStructure(structure, basePath)`** - импорт ассетов по структуре
- **`importCategory(category, basePath)`** - импорт отдельной категории ассетов
- **`updateAssetManagerCategories(categories)`** - обновление категорий в AssetManager
- **`capitalizeFirst(str)`** - утилита для капитализации строк
- **`showFolderPicker()`** - выбор папки пользователем (mock-реализация)

### AssetManager - расширенная функциональность
**Файл**: `src/managers/AssetManager.js`
- **`constructor(stateManager = null)`** - инициализация с StateManager
- **`addExternalAsset(assetData)`** - добавление внешнего ассета в коллекцию
- **`updateStateManagerCategories()`** - синхронизация категорий с StateManager
- **`clearExternalAssets()`** - очистка импортированных ассетов
- **`getCategories()`** - получение списка всех категорий (включая импортированные)

### LevelEditor - интеграция импорта ассетов
**Файл**: `src/core/LevelEditor.js`
- **`importAssets()`** - новый метод для импорта внешних ассетов
- **`static VERSION = '3.30.2'`** - обновление версии

### StateManager - управление категориями ассетов
**Файл**: `src/managers/StateManager.js`
- **`assetTabOrder`** - новое состояние для управления порядком табов ассетов
- **`updateComponentStatus(component, ready)`** - обновление статуса компонентов
- **`areComponentsReady(components)`** - проверка готовности компонентов

## Изменения v3.30.0

### ValidationUtils v2.0 - StateManager-based валидация
**Файл**: `src/utils/ValidationUtils.js`
- **`getStateManager(levelEditor, context)`** - получение StateManager с fallback логикой
- **`getLevelEditor(levelEditor, context)`** - получение levelEditor с fallback на window.editor
- **`hasRequiredComponents(levelEditor, components, context)`** - проверка компонентов через StateManager
- **`updateComponentStatus(levelEditor, component, ready)`** - обновление статуса компонентов
- **`getCachedValidation(levelEditor, key)`** - получение кэшированных результатов валидации
- **`setCachedValidation(levelEditor, key, value, ttl)`** - сохранение результатов с TTL
- **`validateWithCache(levelEditor, key, value, validator, ttl)`** - валидация с кэшированием
- **`clearExpiredCache(levelEditor)`** - очистка устаревших записей кэша
- **`validateNumeric(value, name, min, max)`** - валидация числовых значений с ограничениями
- **`validateFontScale(value)`** - специфическая валидация font scale (0.1-5.0)
- **`validateSpacingScale(value)`** - специфическая валидация spacing (0-5.0)
- **`validateBoolean(value, name)`** - валидация булевых значений
- **`validateString(value, name, maxLength)`** - валидация строк с ограничениями длины
- **`safeGet(obj, path, fallback)`** - безопасный доступ к свойствам с fallback
- **`logValidation(context, action, value, success)`** - консистентное логирование через Logger API

### StateManager - расширенная функциональность валидации
**Файл**: `src/managers/StateManager.js`
- **`validation`** - новое состояние для отслеживания валидации и компонентов
- **`updateComponentStatus(component, ready)`** - обновление статуса готовности компонентов
- **`areComponentsReady(components)`** - проверка готовности нескольких компонентов
- **`setLevelEditorReady(ready)`** - установка статуса готовности levelEditor
- **`getValidationCache(key)`** - получение кэшированных результатов валидации
- **`setValidationCache(key, value, ttl)`** - сохранение результатов с TTL
- **`clearExpiredValidationCache()`** - очистка устаревших записей кэша

### SettingsSyncManager - обновлен для ValidationUtils v2.0
**Файл**: `src/utils/SettingsSyncManager.js`
- **StateManager Integration** - использование новой системы валидации через StateManager
- **Component Status Tracking** - автоматическое обновление статуса компонентов
- **Enhanced Error Handling** - улучшенная обработка ошибок с Logger API
- **Performance Optimization** - использование кэширования для повышения производительности

## Изменения v3.29.0

### ValidationUtils - новая утилита валидации
**Файл**: `src/utils/ValidationUtils.js`
- **`getLevelEditor(levelEditor, context)`** - получение levelEditor с fallback на window.editor
- **`validateNumeric(value, name, min, max)`** - валидация числовых значений с ограничениями
- **`validateFontScale(value)`** - специфическая валидация font scale (0.1-5.0)
- **`validateSpacingScale(value)`** - специфическая валидация spacing (0-5.0)
- **`validateBoolean(value, name)`** - валидация булевых значений
- **`validateString(value, name, maxLength)`** - валидация строк с ограничениями длины
- **`hasRequiredComponents(levelEditor, components, context)`** - проверка наличия компонентов levelEditor
- **`safeGet(obj, path, fallback)`** - безопасный доступ к свойствам с fallback
- **`logValidation(context, action, value, success)`** - консистентное логирование валидации

### SettingsSyncManager - рефакторинг с ValidationUtils
**Файл**: `src/utils/SettingsSyncManager.js`
- **Рефакторинг всех методов** - замена inline проверок на ValidationUtils
- **Устранение дублирования** - 200+ строк дублированного кода заменены на вызовы утилиты
- **Улучшенная надежность** - централизованная валидация с fallback механизмами
- **Консистентное логирование** - единообразные сообщения об ошибках

### SettingsPanel - рефакторинг с ValidationUtils
**Файл**: `src/ui/SettingsPanel.js`
- **`updateSliderDisplay()`** - использует ValidationUtils.validateNumeric()
- **`setupSettingsInputs()`** - использует ValidationUtils для валидации атрибутов
- **Улучшенная обработка ошибок** - консистентные сообщения об ошибках

## Изменения v3.28.0

### MenuManager v3.30.1 - улучшенная обработка курсора
**Файл**: `src/managers/MenuManager.js`
- **`hoverModeEnabled`** - глобальный флаг для управления hover-режимом
- **`setupMenuContainerHoverReset()`** - настройка сброса hover-режима при выходе курсора за пределы контейнера меню
- **Умная активация** - hover-режим включается только после первого клика на пункт меню
- **Автоматическое закрытие** - все меню закрываются при выходе курсора за пределы контейнера
- **Расширенная область hover** - невидимый padding перекрывает зазор между кнопкой и меню
- **Мгновенная реакция** - убрана система задержек, меню реагирует сразу
- **Устранение зазоров** - CSS `mt-0` и `paddingTop: '8px'` для надежной навигации

### SettingsSyncManager - улучшенная синхронизация
**Файл**: `src/utils/SettingsSyncManager.js`
- **`syncing`** - Set для отслеживания активных синхронизаций и предотвращения циклов
- **Интерактивные настройки** - мгновенное применение изменений Font Size и Spacing через CSS Custom Properties
- **Защита от циклов** - система предотвращения бесконечных обновлений между `view.grid` и `canvas.showGrid`
- **Централизованное состояние** - StateManager как единый источник истины для всех настроек

### SettingsPanel - исправленный поток сброса
**Файл**: `src/ui/SettingsPanel.js`
- **Правильный порядок сброса** - ConfigManager.reset() → StateManager обновление → UI рендеринг → сохранение
- **Grid Settings Integration** - перенос "Show Grid" из общих настроек в секцию "Grid & Snapping"
- **AutoSave Configuration** - отключение автосохранения по умолчанию, интервал в минутах
- **Logger Integration** - добавлен импорт Logger для корректной работы логирования

### GridSettings - новая секция настроек
**Файл**: `src/ui/GridSettings.js`
- **`renderGridSettings()`** - рендеринг секции "Grid & Snapping" с параметром "Show Grid"
- **`initializeEventListeners()`** - инициализация обработчиков событий для grid настроек
- **Централизованное состояние** - получение настроек напрямую из StateManager

### CSS Custom Properties - динамическое масштабирование
**Файлы**: `styles/spacing-mode.css`, `styles/settings-panel.css`
- **`--font-scale`** - масштабирование шрифтов с минимальным значением 0.5
- **`--spacing-scale`** - масштабирование отступов с минимальным значением 0.125
- **Минимальные значения** - защита от слишком маленьких размеров через `max()` функции
- **Интерактивное применение** - мгновенное обновление при изменении слайдеров

## Изменения v3.26.1

### SettingsSyncManager - новая система синхронизации настроек
**Файл**: `src/utils/SettingsSyncManager.js`
- **`initializeDefaultMappings()`** - инициализация маппингов настроек
- **`applyAllUISettingsToState()`** - применение всех UI настроек к StateManager
- **`saveAllUISettingsToConfig()`** - сохранение всех UI настроек в ConfigManager
- **`syncSettingToState(path, value)`** - синхронизация отдельной настройки
- **`initializeFromState()`** - инициализация UI из StateManager
- **`syncFromConfigToState()`** - синхронизация из ConfigManager в StateManager
- **`applySpecialUISettings()`** - применение специальных UI настроек (fontScale, compactMode)
- **`forceUpdateAllViewOptions()`** - принудительное обновление всех view options

### Расширенный ConfigManager
**Файл**: `src/managers/ConfigManager.js`
- **`getToolbar()`** - получение настроек тулбара
- **`getShortcuts()`** - получение горячих клавиш
- **`forceSaveAllSettings()`** - принудительное сохранение всех измененных настроек

### SettingsPanel - улучшения UI настроек
**Файл**: `src/ui/SettingsPanel.js`
- **`renderHotkeysSettings()`** - рендеринг секции горячих клавиш
- **`formatShortcut(shortcut)`** - форматирование комбинаций клавиш
- **`setupHotkeyInputs()`** - настройка полей ввода для кастомизации хоткеев
- **`saveHotkey(inputElement)`** - сохранение измененной горячей клавиши
- **`setupEscapeKeyHandler()`** - обработчик клавиши Esc для отмены настроек
- **`removeEscapeKeyHandler()`** - удаление обработчика Esc

### AssetPanel - сохранение состояния
**Файл**: `src/ui/AssetPanel.js`
- **`loadViewMode()`** - загрузка режима отображения (Grid/List/Details)
- **`saveViewMode()`** - сохранение режима отображения
- **`handleToggleGrid()`** - переключение в режим Grid
- **`handleToggleList()`** - переключение в режим List
- **`handleToggleDetails()`** - переключение в режим Details

## Изменения v3.25.0

### CSS Architecture - полная реорганизация
- **Модульная структура** - все стили разделены по компонентам в папке `styles/`
- **Устранение inline стилей** - убраны все inline стили из HTML и JavaScript
- **Унифицированные классы** - консистентные имена классов для форм и компонентов
- **CSS переменные** - добавлены глобальные переменные для accent-color и font-scale

### HoverEffects - новая утилита
**Файл**: `src/utils/HoverEffects.js`
- **`setupHoverListeners(element, effectType, options, excludeClasses)`** - настройка hover эффектов
- **`applyHoverEffect(element, effectType, options)`** - применение эффектов
- **`removeHoverEffect(element)`** - восстановление оригинальных стилей
- **`setupColorHover(colorElement)`** - hover эффекты для цветовых индикаторов
- **`setupGridItemHover(gridItem)`** - hover эффекты для элементов сетки
- **`setupListItemHover(listItem, options)`** - hover эффекты для элементов списка
- **`removeHoverOnly(element)`** - удаление только hover эффектов
- **`cleanup(element)`** - полная очистка hover эффектов и listeners

### Global Styles - глобальные стили
**Файл**: `styles/main.css`
- **`:root`** - CSS переменные `--accent-color` и `--font-scale`
- **`input[type="checkbox"]`** - глобальные стили для чекбоксов
- **`input[type="radio"]`** - глобальные стили для радио кнопок
- **`input[type="range"]`** - глобальные стили для слайдеров

### CSS Files - новые файлы стилей
- **`styles/panels.css`** - стили основных панелей
- **`styles/layers-panel.css`** - стили панели слоев с CSS переменными
- **`styles/settings-panel.css`** - стили панели настроек с унифицированными классами
- **`styles/grid-settings.css`** - стили настроек грида
- **`styles/details-panel.css`** - стили панели деталей
- **`styles/color-chooser.css`** - стили выбора цвета

### LayersPanel - интеграция HoverEffects
- **`createLayerElement()`** - интеграция с HoverEffects utility
- **Устранение inline стилей** - замена на CSS переменные и классы
- **Hover эффекты** - централизованная система через HoverEffects

### AssetPanel - интеграция HoverEffects
- **`createAssetThumbnail()`** - интеграция с HoverEffects utility
- **`addMarqueeHighlight()`** - использование HoverEffects для подсветки
- **`removeMarqueeHighlight()`** - использование HoverEffects для восстановления

### GridSettings - обновление классов
- **HTML структура** - обновлена для использования унифицированных CSS классов
- **`settings-form-group`** - замена `form-group` на стандартные классы
- **`settings-input`** - замена `setting-input` на стандартные классы
- **`settings-label`** - замена `label` на стандартные классы

### Tab Styles Unification - унификация стилей табов
- **`.tab, .tab-right`** - унифицированные стили для всех табов
- **Единообразный внешний вид** - одинаковые padding, font-size, hover эффекты
- **Активные состояния** - синяя нижняя граница для активных табов
- **Устранение дублирования** - убраны inline классы и дублирующиеся стили
- **AssetPanel.js** - упрощены классы табов до базового `.tab` + `.active`
- **index.html** - убраны дублирующиеся классы из HTML табов

## Изменения v3.21.0

### AssetPanel - исправление шапки в режиме Details View

- **`renderDetailsView()`** - исправлено позиционирование sticky header
- **Структура контейнеров** - упрощена для надежного sticky позиционирования
- **Padding management** - динамическое управление padding для разных режимов просмотра

### HexagonalGridRenderer - оптимизация производительности
- **`constructor()`** - `maxHexagonsThreshold: 4500` (было 2000)
- **`render()`** - добавлена проверка `estimatedHexagons > maxHexagonsThreshold` с отключением грида
- **`calculateGridParameters()`** - оптимизирован расчет перехлеста на основе `hexRadius`
- **`drawHexagonalGridSimple()`** - упрощенный рендеринг без LOD системы
- **`addHexagonLinesSimple()`** - прямой расчет вершин без шаблонов

### ConfigManager - расширенные лимиты
- **`validateSetting()`** - `gridSize` лимит увеличен с 128 до 512px

### GridSettings - улучшенная валидация
- **HTML input** - добавлен `oninput` для валидации в реальном времени
- **`max="512"`** - увеличен максимальный размер в интерфейсе

### RenderOperations - оптимизация
- **`render()`** - порог медленных кадров увеличен с 16ms до 20ms
- **Убраны отладочные логи** - очищена консоль

## Изменения v3.19.4

### DiamondGridRenderer

- **`drawDiamondLines(camera, viewportLeft, viewportTop, viewportRight, viewportBottom)`**
  - Добавлен параметр `camera` для корректировки spacing линий в зависимости от зума
  - Улучшен расчет диапазона линий с учетом всех 4 углов viewport
  - Корректировка spacing: `diamondSpacing = gridSize / Math.sqrt(camera.zoom)`

## Изменения v3.19.3

### BaseContextMenu - исправления сепараторов
- `createMenuItem(item, contextData)` - добавлена обработка `type: 'separator'`
- `addSeparatorWithClass(className)` - добавлен метод для сепараторов с CSS классами

### Toolbar - исправления контекстного меню
- `addGridTypeMenuItems()` - исправлена логика вставки элементов перед Settings
- `clearGridTypeMenuItems()` - исправлена очистка только элементов гридов
- `setupGridContextMenu()` - Settings добавляется первым для стабильного порядка

## Изменения v3.19.2

### Toolbar - карусельное переключение типов гридов
- **initializeGridTypes()** - динамическая инициализация типов гридов из доступных рендереров
- **refreshGridTypes()** - обновление списка типов при изменении рендереров
- **cycleGridType()** - переключение на следующий тип грида в карусели
- **updateGridButtonIcon()** - обновление иконки кнопки Grid
- **getCurrentGridType()** - получение текущего типа грида
- **setGridType(gridType)** - установка конкретного типа грида
- **gridTypeConfig** - Map с конфигурацией иконок и названий для каждого типа

### GridRenderers - расширенная поддержка
- **Автоматическое обнаружение** - Toolbar автоматически находит доступные рендереры
- **Конфигурируемые иконки** - легко настраиваемые иконки для каждого типа грида
- **Fallback система** - graceful обработка отсутствующих рендереров

## Изменения v3.18.0

### SnapUtils - новая система снэпа
- **findNearestGridPoint(x, y, gridSize, tolerance)** - поиск ближайшей точки грида в пределах tolerance
- **Адаптивный tolerance** - автоматический расчет на основе размера грида (5-100%)
- **Централизованная логика** - единый метод для всех операций снэпа

### UserPreferencesManager - расширенные настройки
- **snapTolerance** - настройка зоны притяжения к сетке (5-100%)
- **Автоматическое сохранение** - настройки сохраняются в localStorage
- **Синхронизация** - между grid и canvas конфигурациями

### DuplicateOperations - улучшенный снэп
- **updatePreview(worldPos)** - использует единую логику снэпа
- **confirmPlacement(worldPos)** - консистентное финальное размещение
- **Правильная точка привязки** - левый нижний угол первого объекта

### MouseHandlers - оптимизация
- **Кеширование позиций** - worldPosCache для избежания повторных вычислений
- **Улучшенная производительность** - оптимизированы операции перетаскивания

## Изменения v3.17.0

### Console - новый функционал выделения текста
- **setupLogEntrySelection(logEntry)** - настройка выделения для элемента консоли
- **updateAllConsoleSelections()** - обновление всех выделенных строк (оптимизировано)
- **setupExistingConsoleMessages()** - настройка выделения для существующих сообщений
- **cleanupLogEntrySelection(logEntry)** - очистка обработчиков событий

### ConsoleContextMenu - полный рефакторинг v3.25.0
- **Наследование от BaseContextMenu** - унифицирована архитектура контекстных меню
- **Fixed positioning** - контекстное меню позиционируется относительно viewport
- **Console overlay integration** - полная интеграция с оверлеем консоли
- **forceHideMenu()** - принудительное скрытие меню при закрытии консоли
- **State synchronization** - синхронизация состояния логирования между компонентами
- **extractLogData(target)** - извлечение данных о выделенном тексте
- **addCopyOptions(menu, message, timestamp, isSelected)** - добавление опций копирования
- **createMenuItem(text, onClick)** - создание элементов меню с защитой от сброса выделения

## Изменения v3.16.0

### Toolbar - улучшения панорамирования
- **setupScrollingEvents()** - панорамирование средней кнопкой работает на всем тулбаре
- **updateScrolling(e)** - убрано "прилипание" курсора, обычное панорамирование
- **updateButtonAvailability(action, available)** - pointer-events для корректной обработки событий на disabled кнопках

## Изменения v3.19.0

### Toolbar - сохранение позиции скролла
- **loadScrollPosition()** - загрузка сохраненной позиции скролла при инициализации
- **saveDisplayState()** - сохранение позиции скролла в пользовательских настройках
- **stopScrolling()** - сохранение позиции при завершении перетаскивания
- **wheel event handler** - сохранение позиции при скролле колесом мыши
- **toolbarScrollLeft** - новая настройка в пользовательских предпочтениях

### ObjectOperations - исправление видимости удаленных объектов
- **deleteSelectedObjects()** - добавлена инвалидация пространственного индекса
- **invalidateSpatialIndex()** - вызов для корректного обновления рендеринга

### Console - оптимизация сохранения размера
- **setupConsoleResizing()** - сохранение размера только при отпускании мыши
- **mouseup handler** - перенесено сохранение из mousemove в mouseup

## Изменения v3.15.0

### Toolbar - улучшения интерфейса
- **setVisible(visible)** - добавлен автоматический resize canvas при изменении видимости
- **hideToolbar()** - добавлено автоматическое закрытие контекстного меню
- **Оптимизация логирования** - убраны избыточные debug сообщения

### CommandAvailability - новый утилитарный класс
- **getContext(levelEditor)** - сбор контекстной информации для команд
- **check(command, levelEditor)** - проверка доступности команды
- **hasSelectedObjects(levelEditor)** - проверка выделения объектов
- **hasMultipleSelectedObjects(levelEditor)** - проверка множественного выделения
- **isSelectedObjectGroup(levelEditor)** - проверка типа выделенного объекта
- **canUndo(levelEditor)** - проверка доступности undo
- **canRedo(levelEditor)** - проверка доступности redo
- **canPaste()** - проверка возможности вставки

## Изменения v3.14.0

### Toolbar - полная система сохранения настроек
- **saveState()** - сохранение состояний кнопок, секций и видимости
- **loadState()** - загрузка сохраненных состояний
- **loadStateBeforeRender()** - предварительная загрузка для корректного рендеринга
- **updateToggleStates()** - синхронизация с StateManager
- **updateToggleButtonState(action, enabled)** - обновление состояния кнопки
- **updateButtonAvailability(action, available)** - управление доступностью команд
- **updateCommandAvailability()** - проверка доступности команд на основе выделения
- **setVisible(visible)** - управление видимостью с сохранением состояния
- **hideToolbar()** - скрытие toolbar через контекстное меню
- **toggleIcons()** - переключение отображения иконок
- **toggleText()** - переключение отображения текста
- **updateButtonDisplay()** - применение настроек отображения
- **saveDisplayState()** - сохранение настроек отображения
- **setupContextMenu()** - настройка контекстного меню
- **handleTabClick(event)** - обработка кликов по вкладкам
- **handleSectionToggle(event)** - обработка сворачивания секций
- **handleAction(event)** - обработка действий кнопок
- **handleToggleAction(action)** - обработка переключателей

## Изменения v3.13.2

### MouseHandlers - исправление конфликтов средней кнопки мыши
- **handleMouseDown()** - добавлена проверка для игнорирования средней кнопки в панелях
- **handleMouseMove()** - пропуск обработки средней кнопки для событий из right-panel
- **handleMouseUp()** - игнорирование отпускания средней кнопки в панелях
- **Устранение задержки** - ScrollUtils теперь полностью контролирует среднюю кнопку в панелях

## Изменения v3.13.1

### Новые методы и классы
- **ObjectOperations.isObjectInGroupRecursive()** - рекурсивная проверка принадлежности объекта к группе
- **Level.addGroupObjectsToIndex()** - индексация всех объектов группы с правильным topLevelParent
- **ScrollUtils** - рефакторинг системы middle mouse scrolling с предотвращением конфликтов
- **OutlinerPanel.shiftAnchor** - улучшенная логика shift+click выделения с anchor point

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
- `cancelAllActions()` - отмена всех текущих действий (кроме рамки выделения, которая отменяется глобально)

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
- `removeEmptyGroup(targetGroup)` - удаление пустой группы или группы с одним объектом (с автоматическим извлечением объекта)
- `removeEmptyGroups()` - удаление всех пустых групп или групп с одним объектом (с автоматическим извлечением объектов)
- `extractObjectFromGroup(group, childObject)` - извлечение объекта из группы на основной уровень

#### Удаление групп
- **При удалении группы через Delete/DeleteSelectedObjects:**
  - Группа удаляется полностью вместе со всеми дочерними объектами
  - Дети группы также помечаются для удаления (не переносятся на основной уровень)
  - Это отличается от разгруппировки, где дети переносятся на основной уровень

- **При автоматическом удалении пустых групп (removeEmptyGroup/removeEmptyGroups):**
  - Группа удаляется если в ней 0 или 1 объект
  - При удалении группы с одним объектом, объект автоматически извлекается из группы
  - Извлеченный объект перемещается на основной уровень с правильными мировыми координатами
  - Группа удаляется только после успешного извлечения объекта
  - Защищает группы, находящиеся в режиме редактирования

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
- `finishMarqueeSelection()` - завершение выделения рамкой (устарело, используйте глобальную отмену)
- `finishPlacingObjects(worldPos)` - завершение размещения объектов

### ObjectOperations (src/core/ObjectOperations.js)
Операции с объектами.

#### Поиск и проверки
- `findObjectAtPoint(x, y)` - поиск объекта в точке
- `isPointInObject(x, y, obj)` - проверка точки в объекте
- `isPointInGroupBounds(x, y, groupEditMode)` - проверка точки в границах группы
- `isObjectInGroup(obj, group)` - проверка объекта в группе
- `isObjectInGroupRecursive(obj, group)` - рекурсивная проверка объекта в группе (включая вложенные группы)

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

#### Индексация объектов
- `addObjectToIndex(obj, topLevelParent)` - добавление объекта в индекс
- `removeObjectFromIndex(objId)` - удаление объекта из индекса
- `clearObjectsIndex()` - очистка индекса
- `addGroupObjectsToIndex(group)` - рекурсивное добавление всех объектов группы в индекс

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

### FolderPickerDialog (src/ui/FolderPickerDialog.js)
Кастомный диалог выбора папки.

#### Основные методы
- `constructor()` - инициализация диалога
- `show()` - отображение диалога и возврат выбранной папки
- `createDialog()` - создание HTML структуры диалога
- `browseFolder(pathInput)` - выбор папки через File System Access API
- `handleDragDrop(items, pathInput)` - обработка Drag & Drop
- `getFilesFromDirectory(directoryHandle, path)` - получение файлов из папки
- `getFilesFromEntry(entry, path)` - получение файлов из FileSystemEntry
- `updatePathDisplay(pathInput, fullPath)` - обновление отображения пути
- `updateSummary()` - обновление статистики импорта
- `confirm(pathInput)` - подтверждение выбора
- `cancel()` - отмена выбора

### UniversalDialog (src/ui/UniversalDialog.js)
Универсальный диалог для замены браузерных alert, confirm, prompt.

#### Основные методы
- `constructor(title, message, type)` - инициализация диалога
- `static alert(message)` - статический метод для alert
- `static confirm(message)` - статический метод для confirm
- `static prompt(message, defaultValue)` - статический метод для prompt
- `createDialog()` - создание HTML структуры диалога
- `show()` - отображение диалога
- `close()` - закрытие диалога

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

### Toolbar (src/ui/Toolbar.js)
Панель инструментов с кнопками команд и карусельным переключением типов гридов.

#### Основные методы
- `constructor(container, levelEditor, stateManager)` - создание панели
- `render()` - отрисовка панели инструментов
- `createButtonGroup(title, buttons)` - создание группы кнопок
- `createButton(button)` - создание кнопки
- `handleAction(action)` - обработка действия кнопки
- `updateToggleStates()` - обновление состояний переключателей
- `updateToggleButtonState(buttonId, isActive)` - обновление состояния переключателя
- `setVisible(visible)` - установка видимости панели
- `hideToolbar()` - скрытие панели инструментов
- `showToolbar()` - показ панели инструментов
- `toggleToolbar()` - переключение видимости панели

#### Методы карусельного переключения типов гридов (v3.19.3)
- `initializeGridTypes()` - динамическая инициализация типов гридов из доступных рендереров
- `refreshGridTypes()` - обновление списка типов при изменении рендереров
- `cycleGridType()` - переключение на следующий тип грида в карусели
- `updateGridButtonIcon()` - обновление иконки кнопки Grid
- `getCurrentGridType()` - получение текущего типа грида
- `setGridType(gridType)` - установка конкретного типа грида
- `gridTypeConfig` - Map с конфигурацией иконок и названий для каждого типа

#### Система сохранения настроек
- `loadCollapsedStates()` - загрузка состояний свернутых секций
- `saveCollapsedStates()` - сохранение состояний свернутых секций
- `loadDisplaySettings()` - загрузка настроек отображения
- `saveDisplaySettings()` - сохранение настроек отображения
- `loadScrollPosition()` - загрузка позиции скролла
- `saveScrollPosition()` - сохранение позиции скролла
- `updateCommandAvailability()` - обновление доступности команд
- `loadStateBeforeRender()` - загрузка состояния перед рендерингом

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

### GridRenderers (src/utils/gridRenderers/)
Модульная система рендеринга сетки с поддержкой разных типов.

#### BaseGridRenderer (src/utils/gridRenderers/BaseGridRenderer.js)
Базовый класс для всех рендереров сетки.

**Методы:**
- `render(ctx, gridSize, camera, viewport, options)` - основной метод рендеринга (абстрактный)
- `setGridStyle(ctx, color, thickness, opacity, camera)` - установка стиля линий сетки
- `calculateViewportBounds(camera, viewport)` - расчет границ видимой области
- `shouldRenderGrid(gridSize, camera, minGridSize)` - проверка необходимости рендеринга
- `hexToRgba(hexColor, alpha)` - конвертация hex цвета в rgba

#### RectangularGridRenderer (src/utils/gridRenderers/RectangularGridRenderer.js)
Рендерер прямоугольной сетки.

**Специфические методы:**
- `drawGridLines(ctx, startX, startY, endX, endY, gridSize)` - отрисовка вертикальных и горизонтальных линий
- `render()` - отрисовка с поддержкой субдивизий

#### DiamondGridRenderer (src/utils/gridRenderers/DiamondGridRenderer.js)
Рендерер diamond сетки с углами 60° и 120°.

**Специфические методы:**
- `drawDiamondLines(ctx, gridSize, viewportLeft, viewportTop, viewportRight, viewportBottom)` - отрисовка diamond линий

#### HexagonalGridRenderer (src/utils/gridRenderers/HexagonalGridRenderer.js)
Рендерер шестиугольной сетки.

**Специфические методы:**
- `drawHexagonalGrid(ctx, hexRadius, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom)` - отрисовка шестиугольников

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

### OutlinerPanel (src/ui/OutlinerPanel.js) - ОБНОВЛЕН в v3.13.1
Панель структуры с улучшенным поиском и выделением.

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

#### Новые методы v3.9.0
- `handleShiftClick(obj, selectedObjects)` - выделение диапазона объектов (Shift+клик)
- `handleCtrlClick(obj, selectedObjects)` - переключение единичного объекта (Ctrl+клик)
- `getFlatObjectList()` - получение плоского списка объектов в порядке отображения
- `addObjectsToFlatList(objects, flatList)` - рекурсивное добавление объектов в плоский список
- `hasMatchingChildrenRecursive(objects, searchTerm)` - проверка наличия подходящих детей
- `setupContextMenu()` - настройка контекстного меню
- `startInlineRename(object)` - начало переименования объекта
- `toggleGroupCollapse(groupId)` - переключение сворачивания группы

#### Новые методы v3.13.1 - улучшенная логика выделения
- `shiftAnchor` - свойство состояния: точка привязки для shift+click выделения

#### Поиск и фильтрация
- `createSearchBar()` - создание панели поиска
- `filterObjects(objects)` - фильтрация объектов
- `getAllFilteredObjects(objects)` - получение всех отфильтрованных объектов

### OutlinerContextMenu (src/ui/OutlinerContextMenu.js) - НОВЫЙ в v3.9.0
Контекстное меню для объектов в OutlinerPanel.

#### Основные методы
- `constructor(panel, levelEditor, callbacks)` - создание контекстного меню
- `setupMenuItems()` - настройка пунктов меню
- `extractContextData(target)` - извлечение данных контекста из элемента
- `showContextMenu(e, contextData)` - показ контекстного меню
- `calculateMenuPosition(e, menu)` - расчет позиции меню

#### Обработчики
- `handleRenameObject(object)` - переименование объекта
- `handleDeleteObject(object)` - удаление объекта
- `handleToggleVisibility(object)` - переключение видимости
- `handleSelectObject(object)` - выбор объекта
- `handleDuplicateObject(object)` - дублирование объекта
- `handleExpandAllGroups()` - развертывание всех групп
- `handleCollapseAllGroups()` - сворачивание всех групп

### BaseContextMenu (src/ui/BaseContextMenu.js) - ОБНОВЛЕН в v3.9.0
Базовый класс для контекстных меню с улучшенной очисткой обработчиков.

#### Основные методы
- `constructor(panel, callbacks)` - создание базового контекстного меню
- `setupContextMenu()` - настройка контекстного меню
- `showContextMenu(event, contextData)` - показ контекстного меню
- `hideMenu()` - скрытие меню
- `destroy()` - уничтожение меню и очистка обработчиков

#### Новые поля v3.9.0
- `contextMenuHandler` - ссылка на обработчик контекстного меню

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

### DialogReplacer (src/utils/DialogReplacer.js)
Утилита для замены браузерных диалогов на кастомные.

#### Основные методы
- `replace()` - замена браузерных alert, confirm, prompt на кастомные диалоги

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
- `static outliner` - логирование OutlinerPanel (новый в v3.9.0)

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

### SearchUtils (src/utils/SearchUtils.js) - НОВЫЙ в v3.9.0
Унифицированная система поиска для всех панелей.

#### Основные методы
- `static createSearchInput(placeholder, id, className)` - создание поля поиска
- `static createSearchContainer(placeholder, id, className)` - создание контейнера поиска
- `static setupSearchListeners(searchInput, onSearch, onClear)` - настройка обработчиков поиска
- `static filterObjects(objects, searchTerm, nameProperty)` - фильтрация плоского массива объектов
- `static filterObjectsRecursive(objects, searchTerm, nameProperty, childrenProperty)` - рекурсивная фильтрация иерархических объектов
- `static createSearchResultsInfo(totalFiltered, searchTerm, itemType)` - создание информации о результатах поиска
- `static focusSearch(id)` - фокус на поле поиска по ID

### CommandAvailability (src/utils/CommandAvailability.js) - НОВЫЙ в v3.15.0
Утилитарный класс для централизованной проверки доступности команд.

#### Основные методы
- `static getContext(levelEditor)` - сбор контекстной информации (выделение, группы, история)
- `static check(command, levelEditor)` - проверка доступности команды
- `static hasSelectedObjects(levelEditor)` - проверка наличия выделенных объектов
- `static hasMultipleSelectedObjects(levelEditor)` - проверка множественного выделения (2+ объекта)
- `static isSelectedObjectGroup(levelEditor)` - проверка, является ли выделенный объект группой
- `static canUndo(levelEditor)` - проверка доступности операции undo
- `static canRedo(levelEditor)` - проверка доступности операции redo
- `static canPaste()` - проверка возможности вставки из буфера обмена

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

### ScrollUtils (src/utils/ScrollUtils.js)
Утилиты для middle mouse scrolling с предотвращением конфликтов.

#### Статические свойства
- `globalMouseMoveHandler` - единый глобальный обработчик движения мыши
- `globalMouseUpHandler` - единый глобальный обработчик отпускания мыши
- `activeContainers` - Map активных контейнеров с их конфигурациями
- `isGlobalHandlersSetup` - флаг установки глобальных обработчиков

#### Основные методы
- `static setupMiddleMouseScrolling(container, options)` - настройка scrolling для контейнера
- `static addMinimalScrollbarStyles(container, options)` - добавление стилей scrollbar

#### Внутренние методы
- `static setupGlobalHandlers()` - установка глобальных обработчиков (один раз)
- `static startScrolling(container, config, e)` - начало scrolling
- `static updateScrolling(container, config, e)` - обновление позиции scrolling
- `static stopScrolling(container, config)` - остановка scrolling

## Заключение

Этот справочник содержит все доступные методы и функции Level Editor v3.13.2. Используйте его для:

1. **Понимания существующего API** - перед добавлением новой функциональности
2. **Избежания дублирования** - проверки, не существует ли уже нужный метод
3. **Планирования архитектуры** - понимания структуры и связей между компонентами
4. **Отладки** - поиска нужных методов для решения проблем

Все методы сгруппированы по модулям и содержат краткое описание назначения. Для получения подробной информации о параметрах и возвращаемых значениях обращайтесь к исходному коду соответствующих файлов.
