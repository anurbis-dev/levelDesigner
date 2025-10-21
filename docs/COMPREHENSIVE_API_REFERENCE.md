# Полный справочник API Level Editor v3.51.9

## Обзор

Этот документ содержит полный список всех методов и функций, доступных в Level Editor. Используйте его для понимания существующего API и избежания дублирования функциональности.

> 📖 **Подробная документация:** См. [API_REFERENCE.md](./API_REFERENCE.md) для детальных описаний, примеров кода, обработки ошибок и лучших практик использования API.

## Обновления v3.51.8 - Централизованная система обработчиков событий

### EventHandlerManager (новый)
- `init()` - инициализация менеджера обработчиков событий
- `registerElement(element, type, config, dialogId)` - регистрация элемента с обработчиками
- `unregisterElement(element)` - удаление обработчиков элемента
- `unregisterDialog(dialogId)` - удаление всех обработчиков диалога
- `registerDialogHandlers(dialogId, element, config)` - регистрация обработчиков диалога
- `setupElementEventListeners(element, config)` - настройка обработчиков элемента
- `setupDialogGlobalHandlers(dialogId, globalHandlers)` - настройка глобальных обработчиков диалога
- `setupGlobalEventListeners()` - настройка глобальных обработчиков
- `handleGlobalEscape(e)` - обработка глобального ESC
- `handleGlobalClick(e)` - обработка глобальных кликов
- `getElementConfig(element)` - получение конфигурации элемента
- `getDialogHandlers(dialogId)` - получение обработчиков диалога
- `isElementRegistered(element)` - проверка регистрации элемента
- `getAllRegisteredElements()` - получение всех зарегистрированных элементов
- `getAllRegisteredDialogs()` - получение всех зарегистрированных диалогов
- `destroy()` - уничтожение менеджера

### EventHandlerUtils (новый)
- `addDialogEventHandling(dialogElement, dialogId, handlers, context, eventManager)` - добавление обработчиков диалога
- `addButtonEventHandling(button, handlers, context, eventManager)` - добавление обработчиков кнопки
- `addInputEventHandling(input, handlers, context, eventManager)` - добавление обработчиков поля ввода
- `addFormEventHandling(form, handlers, context, eventManager)` - добавление обработчиков формы
- `addContextMenuEventHandling(menu, handlers, context, eventManager)` - добавление обработчиков контекстного меню
- `removeEventHandling(element, eventManager)` - удаление обработчиков элемента
- `removeDialogEventHandling(dialogId, eventManager)` - удаление обработчиков диалога
- `createDialogHandlers(context, onCancel, onApply, onOverlayClick)` - создание стандартных обработчиков диалога
- `createButtonHandlers(context, onClick, onMouseEnter, onMouseLeave)` - создание стандартных обработчиков кнопки
- `createInputHandlers(context, onChange, onFocus, onBlur, onKeyDown)` - создание стандартных обработчиков поля ввода

## Обновления v3.51.8 - Централизованная система мобильного интерфейса

### MobileInterfaceManager (новый)
- `init()` - инициализация менеджера мобильного интерфейса
- `detectPlatform()` - детекция платформы (iOS/Android/Desktop)
- `setupAdaptationStrategies()` - настройка платформо-специфичных стратегий
- `adaptElement(element)` - адаптация элемента для мобильного интерфейса
- `applyMobileStyles(element, type)` - применение мобильных стилей
- `getDialogDimensions()` - получение оптимальных размеров диалога
- `createIOSDialogStrategy()` - создание iOS-специфичной стратегии диалогов
- `createAndroidDialogStrategy()` - создание Android-специфичной стратегии диалогов
- `createIOSInputStrategy()` - создание стратегии предотвращения зума на iOS
- `createAndroidInputStrategy()` - создание Android-специфичной стратегии input
- `createTouchStrategy()` - создание touch-оптимизаций
- `createGestureStrategy()` - создание стратегии жестов
- `setupEventListeners()` - настройка обработчиков событий
- `setupDialogObserver()` - настройка MutationObserver для диалогов
- `handleNewElement(element)` - обработка новых элементов
- `isDialog(element)` - проверка на диалог
- `isPanel(element)` - проверка на панель
- `registerDialog(element)` - регистрация диалога
- `applyInitialAdaptations()` - применение начальных адаптаций
- `handleOrientationChange()` - обработка изменения ориентации
- `handleResize()` - обработка изменения размера окна
- `on(event, callback)` - подписка на события
- `off(event, callback)` - отписка от событий
- `emit(event, data)` - отправка событий
- `getPlatformInfo()` - получение информации о платформе
- `isMobile()` - проверка мобильного устройства
- `isIOS()` - проверка iOS платформы
- `isAndroid()` - проверка Android платформы
- `destroy()` - уничтожение менеджера

### Платформо-специфичные CSS классы (новые)
- `.platform-ios` - iOS-специфичные стили
- `.platform-android` - Android-специфичные стили
- `.touch-device` - общие touch-оптимизации
- `.screen-small/medium/large` - адаптивные размеры экранов
- `.ios-dialog`, `.android-dialog` - платформо-специфичные диалоги
- `.ios-input`, `.android-input` - платформо-специфичные input поля
- `.touch-optimized` - touch-оптимизированные элементы

## Обновления v3.51.7 - Единая система блокировки браузерных жестов

### BrowserGesturePreventionManager
- `initialize()` - инициализация глобальной системы блокировки жестов
- `registerElement(element, options)` - регистрация элемента для блокировки жестов
- `unregisterElement(element)` - отмена регистрации элемента
- `isBrowserNavigationGesture(deltaX, deltaY, deltaTime, target)` - проверка навигационных жестов
- `updateElementOptions(element, options)` - обновление настроек элемента

### TouchSupportManager (обновлен)
- `getPreventionOptions(config)` - получение опций блокировки для типа конфигурации
- Интеграция с BrowserGesturePreventionManager
- Исправлены настройки для pan/zoom жестов

### TouchInitializationManager (обновлен)
- Централизованная инициализация всех тач-обработчиков
- Исправлены параметры для updateTouchMarquee

## Обновления v3.51.6 - Улучшения интерфейса консоли

### Console System (index.html) - улучшенный интерфейс
- `closeConsole(e)` - новая унифицированная функция для закрытия консоли
- **Кликабельная шапка** - `console-header` с `cursor-pointer hover:bg-gray-800`
- **Увеличенная кнопка X** - `console-close` с отступами `px-3 py-2 text-lg`
- **Touch поддержка** - регистрация в TouchSupportManager для шапки и кнопки через TouchSupportUtils
- **Унифицированная система** - использование `EventHandlers.togglePanel('console')`
- **Адаптивные ограничения** - мобильные устройства: 70% экрана, десктоп: 90% экрана
- **Touch+drag сепаратор** - поддержка изменения размера консоли пальцем
- **Двойной тап сепаратор** - двойной тап на сепараторе закрывает консоль
- **Мобильная детекция** - автоматическое определение мобильных устройств и маленьких окон

### EventHandlers (src/core/EventHandlers.js) - консоль в унифицированной системе
- `togglePanel('console')` - поддержка консоли в универсальной системе управления панелями
- `applyPanelVisibility('console', visible)` - управление видимостью консоли через DOM
- **Fallback поддержка** - совместимость со старыми функциями `hideConsole()`
- **Контекстное меню** - автоматическое скрытие контекстного меню при закрытии консоли

### TouchSupportUtils (src/utils/TouchSupportUtils.js) - интеграция
- `addButtonTouchSupport()` - используется для шапки и кнопки закрытия консоли
- `addResizeTouchSupport()` - используется для сепаратора консоли с адаптивными ограничениями
- `isMobile()` - детекция мобильных устройств для адаптивных ограничений

### PanelPositionManager (src/ui/PanelPositionManager.js) - исправления
- **Исправлены конфликты сепараторов** - устранены конфликты между mouse и touch обработчиками
- **Унифицированная touch архитектура** - все сепараторы используют TouchSupportUtils
- `setupPanelResizer()` - теперь использует TouchSupportUtils.addResizeTouchSupport()
- `setupAssetsPanelResizer()` - теперь использует TouchSupportUtils.addResizeTouchSupport()

### AssetPanel (src/ui/AssetPanel.js) - исправления
- **Правильная touch регистрация** - использует TouchSupportUtils.addLongPressMarqueeTouchSupport()
- **Устранено дублирование** - убрана прямая регистрация через touchSupportManager.registerElement()
- **Унифицированный подход** - следует общей архитектуре touch поддержки

## Обновления v3.51.3

### EventHandlers (src/core/EventHandlers.js) - добавлена поддержка консоли
- `applyPanelVisibility(panel, visible)` - добавлена поддержка панели 'console'
- `updateViewCheckbox(option, enabled)` - добавлен case 'console' для маппирования на 'toggle-console'
- `initializeViewStates()` - добавлена 'console' в массив panelStates
- `saveViewStates()` - добавлена 'console' в массив panelOptions
- `resetPanelToggleStates()` - добавлена 'console' в массив panelToggles
- `restorePanelToggleStates()` - добавлено восстановление состояния консоли

### Menu Configuration (config/menu.js) - добавлена команда консоли
- `toggle-console` - новая команда в секции Panels меню View
- `stateKey: 'console.visible'` - использует существующий ключ состояния
- `action: 'togglePanel'` - использует универсальную систему управления панелями

### Console System (index.html) - унификация управления
- Клавиатурный шорткат клавиши ` - использует `EventHandlers.togglePanel('console')`
- `showConsole()` - сохраняет состояние через `stateManager.set('console.visible', true)`
- `hideConsole()` - сохраняет состояние через `stateManager.set('console.visible', false)`
- Инициализация консоли - использует `stateManager.get('console.visible')` с fallback на `userPrefs`
- Синхронизация после инициализации - обновляет StateManager с актуальным состоянием

### EventHandlers (src/core/EventHandlers.js) - исправления клавиатуры
- `setupKeyboardEvents()` - добавлена обработка клавиши Alt в keydownHandler и keyupHandler
- `keyboard.altKey` - добавлено состояние для отслеживания Alt клавиши в StateManager
- `isAltKeyPressed()` - обновлен для проверки как mouse.altKey, так и keyboard.altKey

### MobileScalingUtils (src/utils/MobileScalingUtils.js) - НОВЫЙ
- `initializeScaling()` - автоматическое определение устройства и применение масштабирования
- `isMobileDevice()` - определение мобильных устройств по userAgent и touch поддержке
- `applyScaling(scaleFactor)` - применение масштабирования через CSS переменные
- `getOptimalTouchSize()` - получение оптимального размера touch-элементов для устройства
- `setupMobileListeners()` - настройка обработчиков поворота экрана и предотвращение зума
- `getDeviceInfo()` - получение информации об устройстве для отладки

### StateManager (src/managers/StateManager.js) - расширение состояний
- `keyboard.altKey` - добавлено состояние для отслеживания Alt клавиши

## Обновления v3.51.2

### MenuPositioningUtils (src/utils/MenuPositioningUtils.js) - НОВЫЙ
Утилита для стандартизированного позиционирования popup меню.

#### Статические свойства
- `MENU_CLASSES` - стандартные CSS классы для popup меню
- `MENU_ITEM_CLASSES` - стандартные CSS классы для элементов меню

#### Основные методы
- `calculateMenuPosition(triggerElement, options)` - расчет оптимальной позиции меню
- `createMenuElement(options)` - создание стандартного элемента меню
- `createMenuItem(options)` - создание стандартного элемента меню
- `setupMenuClosing(menu, triggerElement)` - настройка логики закрытия меню
- `getObjectTypes(objects)` - получение уникальных типов объектов
- `showMenu(menu, triggerElement, options)` - позиционирование и показ меню

### PanelPositionManager (src/ui/PanelPositionManager.js)
Исправления логики активации табов.

#### Новые методы
- `updateActiveTabAfterMove(tabName, fromPanel, toPanel)` - обновление активных табов после перемещения
- `getTabClosestToSeparator(tabs, panelSide)` - поиск таба, ближайшего к сепаратору

#### Исправления
- Исправлена логика активации при переносе табов
- Добавлена активация таба, ближайшего к сепаратору

### EventHandlers (src/core/EventHandlers.js)
Исправления восстановления активных табов.

#### Новые методы
- `activateTabsAfterPanelInitialization()` - активация табов после инициализации панелей

#### Исправления
- Исправлено восстановление активных табов при рестарте
- Устранена проблема авто-селекта при инициализации
- Исправлен порядок инициализации

### OutlinerPanel (src/ui/OutlinerPanel.js)
Оптимизация кода меню фильтра.

#### Исправления
- Исправлено позиционирование меню фильтра при переносе в правую панель
- Оптимизирован код меню фильтра (сокращен с ~50 до ~15 строк)
- Интеграция с MenuPositioningUtils

## Обновления v3.51.1

### PanelPositionManager (src/ui/PanelPositionManager.js)
Исправления и улучшения управления панелями.

#### Новые методы
- `_updateUI()` - унифицированное обновление UI после изменений панелей
- `removeEmptyPanel(panelSide)` - унифицированное удаление пустых панелей

#### Исправления
- Исправлена бесконечная рекурсия в `_updateUI()`
- Унифицирована логика удаления панелей (все панели удаляются полностью)
- Добавлено правильное обрезание табов при переполнении

### EventHandlers (src/core/EventHandlers.js)
Исправления инициализации и активации табов.

#### Новые методы
- `_activatePanelTab(panelSide, preferredTab, tabPositions)` - унифицированная активация табов с валидацией

#### Исправления
- Исправлена инициализация позиций табов (правильный порядок операций)
- Исправлена валидация активных табов (активация только в существующих панелях)
- Удален устаревший метод `setActiveRightPanelTab()`

### TouchSupportManager (src/managers/TouchSupportManager.js)
Централизованный менеджер для обработки тач-событий и жестов.

#### Основные методы
- `registerElement(element, type, config)` - регистрация элемента для тач-поддержки
- `handleTouchStart(event)` - обработка начала тач-события
- `handleTouchMove(event)` - обработка движения тач-события
- `handleTouchEnd(event)` - обработка окончания тач-события
- `setupNavigationPrevention()` - предотвращение браузерных жестов навигации

#### Жесты
- `marqueeSelection` - рамка выделения одним пальцем
- `longPressMarquee` - рамка выделения с долгим нажатием
- `twoFingerPan` - панорамирование двумя пальцами
- `twoFingerContext` - контекстное меню двумя пальцами
- `twoFingerZoom` - зум двумя пальцами
- `twoFingerPanZoom` - комбинированное панорамирование и зум

### TouchSupportUtils (src/utils/TouchSupportUtils.js)
Утилиты для быстрого добавления тач-поддержки к элементам.

#### Методы
- `addButtonTouchSupport(button, onClick, onDoubleClick, onLongPress, touchManager)` - тач-поддержка для кнопок
- `addDragTouchSupport(element, onDragStart, onDrag, onDragEnd, touchManager)` - тач-поддержка для драг-элементов
- `addMarqueeTouchSupport(element, onMarqueeStart, onMarqueeMove, onMarqueeEnd, touchManager)` - рамка выделения
- `addTwoFingerPanZoomSupport(element, onPanMove, onZoomMove, onContextMenu, touchManager)` - панорамирование и зум

## Новые компоненты v3.51.0

### Отдельные состояния табов для левой и правой панелей
- Независимое управление табами в левой и правой панелях
- Корректное отображение контента для активных табов
- Убрано дублирование кода в StateManager

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

#### View меню методы
- `toggleViewOption(option)` - переключение режимов отображения
- `initializeViewStates()` - инициализация состояний View меню
- `toggleGameMode(enabled)` - переключение игрового режима
- `updateViewCheckbox(option, enabled)` - обновление состояния чекбокса

#### Методы управления табами
- `setActivePanelTab(tabName, panelSide)` - установка активного таба в панели
- `activateTabsAfterPanelInitialization()` - активация табов после инициализации панелей
- `_activatePanelTab(panelSide, preferredTab, tabPositions)` - активация таба с валидацией позиции

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

#### Методы отрисовки дубликатов
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
- `set(key, value)` - установка свойства (поддержка вложенных ключей)
- `update(updates)` - обновление нескольких свойств
- `subscribe(key, callback)` - подписка на изменения
- `notifyListeners(key, newValue, oldValue)` - уведомление слушателей

#### Состояния отображения
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

### PanelPositionManager (src/ui/PanelPositionManager.js)
Универсальный менеджер для управления позицией панелей.

#### Основные методы
- `constructor(levelEditor)` - инициализация менеджера
- `togglePanelPosition(panelType)` - переключение позиции панели
- `updateFoldersLayout(position)` - обновление layout панели folders
- `updateRightPanelLayout(position)` - обновление layout правой панели
- `initializePanelPositions()` - инициализация позиций из настроек
- `getPanelPosition(panelType)` - получение текущей позиции панели
- `moveTab(tabName, fromPanel, toPanel)` - перемещение таба между панелями
- `updateActiveTabAfterMove(tabName, fromPanel, toPanel)` - обновление активных табов после перемещения
- `getTabClosestToSeparator(tabs, panelSide)` - поиск таба, ближайшего к сепаратору

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

#### Методы карусельного переключения типов гридов
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

### OutlinerPanel (src/ui/OutlinerPanel.js)
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

#### Расширенные методы выделения
- `handleShiftClick(obj, selectedObjects)` - выделение диапазона объектов (Shift+клик)
- `handleCtrlClick(obj, selectedObjects)` - переключение единичного объекта (Ctrl+клик)
- `getFlatObjectList()` - получение плоского списка объектов в порядке отображения
- `addObjectsToFlatList(objects, flatList)` - рекурсивное добавление объектов в плоский список
- `hasMatchingChildrenRecursive(objects, searchTerm)` - проверка наличия подходящих детей
- `setupContextMenu()` - настройка контекстного меню
- `startInlineRename(object)` - начало переименования объекта
- `toggleGroupCollapse(groupId)` - переключение сворачивания группы
- `shiftAnchor` - свойство состояния: точка привязки для shift+click выделения

#### Поиск и фильтрация
- `createSearchBar()` - создание панели поиска
- `filterObjects(objects)` - фильтрация объектов
- `getAllFilteredObjects(objects)` - получение всех отфильтрованных объектов

### OutlinerContextMenu (src/ui/OutlinerContextMenu.js)
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

### BaseContextMenu (src/ui/BaseContextMenu.js)
Базовый класс для контекстных меню с улучшенной очисткой обработчиков.

#### Основные методы
- `constructor(panel, callbacks)` - создание базового контекстного меню
- `setupContextMenu()` - настройка контекстного меню
- `showContextMenu(event, contextData)` - показ контекстного меню
- `hideMenu()` - скрытие меню
- `destroy()` - уничтожение меню и очистка обработчиков

#### Дополнительные поля
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

### ExtensionErrorUtils (src/utils/ExtensionErrorUtils.js)
Централизованная обработка ошибок браузерных расширений.

#### Основные методы
- `static isExtensionError(error)` - Проверка ошибок расширений
- `static withTimeout(operationPromise, timeoutMs, operation)` - Таймаут для API операций
- `static handleFileSystemError(error, fallbackFunction, context)` - Автоматическая обработка с fallback
- `static createTimeoutPromise(timeoutMs, operation)` - Создание таймаута
- `static getExtensionConflictMessage(operation)` - Пользовательские сообщения об ошибках

#### Константы
- `static EXTENSION_ERROR_PATTERNS` - Паттерны ошибок расширений

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
- `static outliner` - логирование OutlinerPanel

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

### SearchUtils (src/utils/SearchUtils.js)
Унифицированная система поиска для всех панелей.

#### Основные методы
- `static createSearchInput(placeholder, id, className)` - создание поля поиска
- `static createSearchContainer(placeholder, id, className)` - создание контейнера поиска
- `static setupSearchListeners(searchInput, onSearch, onClear)` - настройка обработчиков поиска
- `static filterObjects(objects, searchTerm, nameProperty)` - фильтрация плоского массива объектов
- `static filterObjectsRecursive(objects, searchTerm, nameProperty, childrenProperty)` - рекурсивная фильтрация иерархических объектов
- `static createSearchResultsInfo(totalFiltered, searchTerm, itemType)` - создание информации о результатах поиска
- `static focusSearch(id)` - фокус на поле поиска по ID

### MenuPositioningUtils (src/utils/MenuPositioningUtils.js) - НОВЫЙ v3.51.2
Утилита для стандартизированного позиционирования popup меню.

#### Статические свойства
- `MENU_CLASSES` - стандартные CSS классы для popup меню
- `MENU_ITEM_CLASSES` - стандартные CSS классы для элементов меню

#### Основные методы
- `static calculateMenuPosition(triggerElement, options)` - расчет оптимальной позиции меню
- `static createMenuElement(options)` - создание стандартного элемента меню
- `static createMenuItem(options)` - создание стандартного элемента меню
- `static setupMenuClosing(menu, triggerElement)` - настройка логики закрытия меню
- `static getObjectTypes(objects)` - получение уникальных типов объектов
- `static showMenu(menu, triggerElement, options)` - позиционирование и показ меню

### CommandAvailability (src/utils/CommandAvailability.js)
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

### ValidationUtils (src/utils/ValidationUtils.js)
Утилиты валидации с поддержкой StateManager и кэширования.

#### Основные методы
- `static getStateManager(levelEditor, context)` - получение StateManager с fallback логикой
- `static getLevelEditor(levelEditor, context)` - получение levelEditor с fallback на window.editor
- `static hasRequiredComponents(levelEditor, components, context)` - проверка компонентов через StateManager
- `static updateComponentStatus(levelEditor, component, ready)` - обновление статуса компонентов
- `static getCachedValidation(levelEditor, key)` - получение кэшированных результатов валидации
- `static setCachedValidation(levelEditor, key, value, ttl)` - сохранение результатов с TTL
- `static validateWithCache(levelEditor, key, value, validator, ttl)` - валидация с кэшированием
- `static clearExpiredCache(levelEditor)` - очистка устаревших записей кэша

#### Валидационные методы
- `static validateNumeric(value, name, min, max)` - валидация числовых значений с ограничениями
- `static validateFontScale(value)` - специфическая валидация font scale (0.1-5.0)
- `static validateSpacingScale(value)` - специфическая валидация spacing (0-5.0)
- `static validateBoolean(value, name)` - валидация булевых значений
- `static validateString(value, name, maxLength)` - валидация строк с ограничениями длины
- `static safeGet(obj, path, fallback)` - безопасный доступ к свойствам с fallback
- `static logValidation(context, action, value, success)` - консистентное логирование через Logger API

### HoverEffects (src/utils/HoverEffects.js)
Утилита для настройки hover эффектов UI элементов.

#### Основные методы
- `static setupHoverListeners(element, effectType, options, excludeClasses)` - настройка hover эффектов
- `static applyHoverEffect(element, effectType, options)` - применение эффектов
- `static removeHoverEffect(element)` - восстановление оригинальных стилей
- `static setupColorHover(colorElement)` - hover эффекты для цветовых индикаторов
- `static setupGridItemHover(gridItem)` - hover эффекты для элементов сетки
- `static setupListItemHover(listItem, options)` - hover эффекты для элементов списка
- `static removeHoverOnly(element)` - удаление только hover эффектов
- `static cleanup(element)` - полная очистка hover эффектов и listeners

### SnapUtils (src/utils/SnapUtils.js)
Утилиты для системы снэпа объектов к сетке.

#### Основные методы
- `static findNearestGridPoint(x, y, gridSize, tolerance)` - поиск ближайшей точки грида в пределах tolerance
- **Адаптивный tolerance** - автоматический расчет на основе размера грида (5-100%)
- **Централизованная логика** - единый метод для всех операций снэпа

### AssetImporter (src/utils/AssetImporter.js)
Утилита импорта ассетов из папок.

#### Основные методы
- `constructor(assetManager)` - инициализация с AssetManager
- `importFromFolder(folderPath)` - основной метод импорта ассетов из папки
- `checkFolderAccess(folderPath)` - проверка доступности папки
- `scanFolderStructure(folderPath)` - анализ структуры папок для определения категорий
- `scanCategoryFolder(categoryPath, categoryName)` - сканирование конкретной категории
- `generateMockAssetsForCategory(categoryName)` - генерация тестовых ассетов для категории
- `importAssetsFromStructure(structure, basePath)` - импорт ассетов по структуре
- `importCategory(category, basePath)` - импорт отдельной категории ассетов
- `updateAssetManagerCategories(categories)` - обновление категорий в AssetManager
- `capitalizeFirst(str)` - утилита для капитализации строк
- `showFolderPicker()` - выбор папки пользователем (mock-реализация)

### SettingsSyncManager (src/utils/SettingsSyncManager.js)
Система синхронизации настроек между UI и StateManager.

#### Основные методы
- `initializeDefaultMappings()` - инициализация маппингов настроек
- `applyAllUISettingsToState()` - применение всех UI настроек к StateManager
- `saveAllUISettingsToConfig()` - сохранение всех UI настроек в ConfigManager
- `syncSettingToState(path, value)` - синхронизация отдельной настройки
- `initializeFromState()` - инициализация UI из StateManager
- `syncFromConfigToState()` - синхронизация из ConfigManager в StateManager
- `applySpecialUISettings()` - применение специальных UI настроек (fontScale, compactMode)
- `forceUpdateAllViewOptions()` - принудительное обновление всех view options

#### Дополнительные свойства
- `syncing` - Set для отслеживания активных синхронизаций и предотвращения циклов
- **Интерактивные настройки** - мгновенное применение изменений Font Size и Spacing через CSS Custom Properties
- **Защита от циклов** - система предотвращения бесконечных обновлений между `view.grid` и `canvas.showGrid`
- **Централизованное состояние** - StateManager как единый источник истины для всех настроек

## Дополнительные утилиты

### DuplicateUtils (src/utils/DuplicateUtils.js)
Утилиты позиционирования дублируемых объектов.

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

Этот справочник содержит все доступные методы и функции Level Editor. Используйте его для:

1. **Понимания существующего API** - перед добавлением новой функциональности
2. **Избежания дублирования** - проверки, не существует ли уже нужный метод
3. **Планирования архитектуры** - понимания структуры и связей между компонентами
4. **Отладки** - поиска нужных методов для решения проблем

Все методы сгруппированы по модулям и содержат краткое описание назначения. Для получения подробной информации о параметрах и возвращаемых значениях обращайтесь к исходному коду соответствующих файлов.
