# Touch Support System v3.52.5

**📚 Связанные документы:**
- [EventHandlerSystem.md](./EVENT_HANDLER_SYSTEM.md) - система обработки событий
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектура проекта
- [Development Guide](./DEVELOPMENT_GUIDE.md) - примеры использования

> **🔄 ОБНОВЛЕНИЕ v3.52.5**: Система тач-поддержки была полностью рефакторена и унифицирована. Теперь используется **UnifiedTouchManager** вместо отдельных TouchSupportManager и TouchHandlers.

## 🆕 Новая унифицированная архитектура

### UnifiedTouchManager
**Файл**: `src/event-system/UnifiedTouchManager.js`

Новый унифицированный менеджер, который объединяет функциональность:
- **TouchSupportManager** - продвинутое распознавание жестов
- **TouchHandlers** - обработка raw touch событий (legacy поддержка)
- **EventHandlerManager** - централизованная регистрация событий
- **Предотвращение дублирования** - автоматическая проверка повторной регистрации

#### Основные методы:
- `registerElement(element, configType, customConfig, elementId)` - регистрация элемента
- `unregisterElement(element)` - отмена регистрации
- `destroy()` - уничтожение менеджера
- `calculateHorizontalPanelSize()` - расчет размера горизонтальных панелей
- `calculateVerticalPanelSize()` - расчет размера вертикальных панелей

#### Интеграция с EventHandlerManager:
```javascript
// Автоматическая интеграция через EventHandlerManager
eventHandlerManager.registerTouchElement(element, 'panelResizer', config, 'my-resizer');
```

### GlobalEventRegistry
**Файл**: `src/event-system/GlobalEventRegistry.js`

Централизованная система управления глобальными событиями:
- **Document события** - централизованное управление document событиями
- **Window события** - централизованное управление window событиями
- **Предотвращение дублирования** - автоматическая проверка повторной регистрации
- **Автоматическая очистка** - при уничтожении компонентов

---

Централизованная система поддержки тач-скрина для мобильных устройств.

## Обзор

`TouchSupportManager` + `BrowserGesturePreventionManager` предоставляют единый API для обработки тач-событий во всех элементах интерфейса:

- **Панели и разделители** - изменение размера с поддержкой double-tap
- **Canvas pan/zoom** - жесты двумя пальцами для навигации и масштабирования
- **Перетаскивание табов** - drag & drop с тач-поддержкой
- **Кнопки и элементы управления** - tap, double-tap, long-press
- **Контекстные меню** - long-press для вызова меню
- **Браузерные жесты** - умная блокировка навигационных жестов

## Архитектура

### TouchSupportManager
Центральный менеджер для регистрации и обработки тач-событий.

**Основные методы:**
- `registerElement(element, configType, customConfig)` - регистрация элемента
- `unregisterElement(element)` - отмена регистрации
- `updateConfig(element, newConfig)` - обновление конфигурации
- `getConfig(element)` - получение конфигурации
- `isRegistered(element)` - проверка регистрации
- `clear()` - очистка всех регистраций
- `destroy()` - уничтожение менеджера
- `calculatePanelSize(element, config, input, initialData)` - расчет размера панели
- `calculateHorizontalPanelSize(element, input, initialData)` - расчет ширины
- `calculateVerticalPanelSize(element, input, initialData)` - расчет высоты
- `getUnifiedResizeMethods()` - получение методов для внешнего использования
- `getPreventionOptions(config)` - получение опций блокировки жестов

### BrowserGesturePreventionManager
Единая система блокировки браузерных жестов с умным определением навигационных жестов.

**Основные методы:**
- `initialize()` - инициализация глобальной системы блокировки жестов
- `registerElement(element, options)` - регистрация элемента для блокировки жестов
- `unregisterElement(element)` - отмена регистрации элемента
- `isBrowserNavigationGesture(deltaX, deltaY, deltaTime, target)` - проверка навигационных жестов
- `updateElementOptions(element, options)` - обновление настроек элемента

### TouchSupportUtils
Утилиты для быстрого добавления тач-поддержки к элементам.

**Основные методы:**
- `addButtonTouchSupport()` - тач-поддержка для кнопок
- `addDragTouchSupport()` - тач-поддержка для перетаскивания
- `addMarqueeTouchSupport()` - тач-поддержка для рамки селекта
- `addLongPressMarqueeTouchSupport()` - тач-поддержка для рамки селекта с длительным нажатием
- `addTwoFingerPanSupport()` - тач-поддержка для двухпальцевого панарамирования
- `addTwoFingerZoomSupport()` - тач-поддержка для двухпальцевого зума
- `addTwoFingerPanZoomSupport()` - комбинированная поддержка панарамирования и зума
- `addTwoFingerContextSupport()` - тач-поддержка для двухпальцевого контекстного меню
- `updateTouchAction()` - обновление touch-action для элемента
- `disableTouchGestures()` - отключение жестов для элемента
- `enableTouchGestures()` - включение жестов для элемента
- `isTouchSupported()` - проверка поддержки тач-событий
- `isMobile()` - проверка мобильного устройства

### TouchInitializationManager
Централизованная инициализация всех тач-обработчиков при старте редактора.

**Основные методы:**
- `initializeAllTouchSupport()` - инициализация всех тач-обработчиков
- `initializeCanvasTouchSupport()` - инициализация тач-поддержки для канваса
- `initializeConsoleTouchSupport()` - инициализация тач-поддержки для консоли
- `initializeAssetPanelTouchSupport()` - инициализация тач-поддержки для панели ассетов

### Конфигурация
Настройки в `config/defaults/touch.json` для кастомизации поведения.

## Использование

### Базовое использование (НОВЫЙ API v3.52.5)

```javascript
// Через UnifiedTouchManager (рекомендуемый способ)
unifiedTouchManager.registerElement(element, 'panelResizer', {
    direction: 'horizontal',
    minSize: 100,
    maxSize: 800,
    onResizeStart: (element, targetPanel, touch) => {
        console.log('Resize started');
    },
    onResize: (element, targetPanel, newSize, touch) => {
        console.log('Resizing to:', newSize);
    },
    onResizeEnd: (element, targetPanel, currentSize) => {
        console.log('Resize ended:', currentSize);
    },
    onDoubleTap: (element, touch) => {
        console.log('Double tap detected');
    }
}, 'my-resizer');

// Через EventHandlerManager (автоматическая интеграция)
eventHandlerManager.registerTouchElement(element, 'panelResizer', {
    direction: 'horizontal',
    minSize: 100,
    maxSize: 800,
    onResizeStart: (element, targetPanel, touch) => {
        console.log('Resize started');
    },
    onResize: (element, targetPanel, newSize, touch) => {
        console.log('Resizing to:', newSize);
    },
    onResizeEnd: (element, targetPanel, currentSize) => {
        console.log('Resize ended:', currentSize);
    },
    onDoubleTap: (element, touch) => {
        console.log('Double tap detected');
    }
}, 'my-resizer');

// Глобальные события через GlobalEventRegistry
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';

const windowHandlers = {
    resize: () => console.log('Window resized'),
    orientationchange: () => console.log('Orientation changed')
};
globalEventRegistry.registerComponentHandlers('touch-component', windowHandlers, 'window');

const documentHandlers = {
    touchstart: (e) => console.log('Touch started'),
    touchend: (e) => console.log('Touch ended')
};
globalEventRegistry.registerComponentHandlers('touch-component', documentHandlers, 'document');
```

### Использование утилит (ОБНОВЛЕНО v3.52.5)

```javascript
// Добавление тач-поддержки к кнопке (через UnifiedTouchManager)
TouchSupportUtils.addButtonTouchSupport(
    button, 
    () => console.log('Button tapped'),
    () => console.log('Button double-tapped'),
    () => console.log('Button long-pressed'),
    unifiedTouchManager  // Используем UnifiedTouchManager вместо TouchSupportManager
);

// Добавление тач-поддержки к перетаскиваемому элементу
TouchSupportUtils.addDragTouchSupport(
    element,
    (element, touch) => console.log('Drag started'),
    (element, touch, touchData) => console.log('Dragging'),
    (element, touchData) => console.log('Drag ended'),
    unifiedTouchManager  // Используем UnifiedTouchManager
);
```

## Объединение обработчиков

### Множественные конфигурации на одном элементе (ОБНОВЛЕНО v3.52.5)

UnifiedTouchManager поддерживает объединение нескольких типов жестов на одном элементе. Это позволяет, например, canvas поддерживать одновременно marquee selection, pan, zoom и context menu.

#### Как работает объединение

1. **Первая регистрация** - элемент регистрируется с первым типом конфигурации
2. **Последующие регистрации** - дополнительные типы объединяются с существующей конфигурацией
3. **Сохранение обработчиков** - все обработчики сохраняются без конфликтов

#### Пример объединения (НОВЫЙ API)

```javascript
// Первая регистрация - marquee selection
unifiedTouchManager.registerElement(canvas, 'marqueeSelection', {
    onMarqueeStart: (element, data) => { /* ... */ },
    onMarqueeMove: (element, data) => { /* ... */ },
    onMarqueeEnd: (element, data) => { /* ... */ }
}, 'canvas-marquee');

// Вторая регистрация - pan/zoom (объединяется с существующей)
unifiedTouchManager.registerElement(canvas, 'twoFingerPanZoom', {
    onPanStart: (element, data) => { /* ... */ },
    onPanMove: (element, data) => { /* ... */ },
    onPanEnd: (element, data) => { /* ... */ },
    onZoomStart: (element, data) => { /* ... */ },
    onZoomMove: (element, data) => { /* ... */ },
    onZoomEnd: (element, data) => { /* ... */ }
}, 'canvas-pan-zoom');

// Третья регистрация - context menu (объединяется с существующей)
unifiedTouchManager.registerElement(canvas, 'twoFingerContext', {
    onTwoFingerTap: (element, data) => { /* ... */ }
}, 'canvas-context');
```

#### Правила объединения

1. **Приоритет существующих обработчиков** - существующие обработчики сохраняются
2. **Добавление новых обработчиков** - новые обработчики добавляются к существующим
3. **Обработчики событий настраиваются один раз** - при первой регистрации элемента
4. **Динамическое получение конфигурации** - обработчики всегда получают актуальную конфигурацию

#### Поддерживаемые комбинации

- **Marquee + Pan/Zoom** - выделение рамкой + панорамирование/масштабирование
- **Pan + Zoom + Context** - полный набор двухпальцевых жестов
- **Button + Long Press** - кнопка с поддержкой длительного нажатия
- **Resizer + Double Tap** - разделитель с переключением по двойному тапу

#### Важные замечания

- **Не перезаписывайте обработчики** - используйте объединение вместо замены
- **Проверяйте наличие обработчиков** - перед вызовом проверяйте `if (config.onHandler)`
- **Используйте TouchSupportUtils** - для стандартных комбинаций жестов
- **Тестируйте комбинации** - убедитесь, что все жесты работают корректно
- **Используйте унифицированные методы** - для resize логики используйте `calculatePanelSize()` и связанные методы

## Типы конфигураций

### panelResizer
Для разделителей панелей (горизонтальных и вертикальных).

```javascript
{
    type: 'resize',
    direction: 'horizontal', // 'horizontal' or 'vertical'
    minSize: 100,
    maxSize: 600,
    doubleTapThreshold: 300,
    onResize: (element, targetPanel, newSize, touch) => {},
    onDoubleTap: (element, touch) => {}
}
```

### tabDragger
Для перетаскиваемых элементов (табы, элементы списка).

```javascript
{
    type: 'drag',
    direction: 'horizontal',
    doubleTapThreshold: 300,
    onDrag: (element, touch, touchData) => {},
    onDragStart: (element, touch) => {},
    onDragEnd: (element, touchData) => {}
}
```

### button
Для кнопок и интерактивных элементов.

```javascript
{
    type: 'click',
    doubleTapThreshold: 300,
    longPressDelay: 500,
    onTap: (element) => {},
    onDoubleTap: (element, touch) => {},
    onLongPress: (element, touch) => {}
}
```

## События

### Touch Events
- `touchstart` - начало касания
- `touchmove` - движение касания
- `touchend` - окончание касания
- `touchcancel` - отмена касания

### Gesture Events

## Новые жесты (v3.52.5)

### Рамка селекта (Marquee Selection)
Однопальцевый тап + драг для создания рамки выбора объектов.

```javascript
TouchSupportUtils.addMarqueeTouchSupport(
    canvasElement,
    (element, touch, data) => {
        // Начало рамки селекта
        console.log('Marquee start:', data.startX, data.startY);
    },
    (element, touch, data) => {
        // Обновление рамки селекта
        console.log('Marquee move:', data.deltaX, data.deltaY);
    },
    (element, data) => {
        // Завершение рамки селекта
        console.log('Marquee end:', data.deltaX, data.deltaY);
    },
    touchManager
);
```

**Touch-action**: `pan-x pan-y` - разрешает панарамирование, блокирует зум

### Рамка селекта с длительным нажатием (Long Press Marquee)
Длительное нажатие + драг для создания рамки выбора (позволяет обычный скролл при коротком тапе+драге).

```javascript
TouchSupportUtils.addLongPressMarqueeTouchSupport(
    assetPanelElement,
    (element, touch, data) => {
        // Начало рамки селекта после длительного нажатия
        console.log('Long press marquee start:', data.startX, data.startY);
    },
    (element, touch, data) => {
        // Обновление рамки селекта
        console.log('Long press marquee move:', data.deltaX, data.deltaY);
    },
    (element, data) => {
        // Завершение рамки селекта
        console.log('Long press marquee end:', data.deltaX, data.deltaY);
    },
    touchManager,
    500 // Задержка длительного нажатия в миллисекундах
);
```

**Touch-action**: `auto` - разрешает все стандартные жесты браузера (включая скролл)

### Двухпальцевое панарамирование
Два пальца + драг для перемещения канвы.

```javascript
TouchSupportUtils.addTwoFingerPanSupport(
    canvasElement,
    (element, data) => {
        // Начало панарамирования
        console.log('Pan start:', data.centerX, data.centerY);
    },
    (element, data) => {
        // Обновление панарамирования
        console.log('Pan move:', data.deltaX, data.deltaY);
    },
    (element, data) => {
        // Завершение панарамирования
        console.log('Pan end:', data.deltaX, data.deltaY);
    },
    touchManager
);
```

**Touch-action**: `pan-x pan-y` - разрешает панарамирование, блокирует зум

### Двухпальцевое контекстное меню
Краткий тап двумя пальцами для вызова контекстного меню.

```javascript
TouchSupportUtils.addTwoFingerContextSupport(
    canvasElement,
    (element, data) => {
        // Двухпальцевый тап
        console.log('Two finger tap:', data.centerX, data.centerY);
        // Показать контекстное меню
        showContextMenu(data.centerX, data.centerY);
    },
    touchManager
);
```

**Touch-action**: `auto` - разрешает все стандартные жесты браузера

### Двухпальцевый зум
Два пальца + разведение/сведение для масштабирования.

```javascript
TouchSupportUtils.addTwoFingerZoomSupport(
    canvasElement,
    (element, data) => {
        // Начало зума
        console.log('Zoom start:', data.scale);
    },
    (element, data) => {
        // Обновление зума
        console.log('Zoom move:', data.scale, data.scaleDelta);
        // Применить зум к канве
        applyZoom(data.scale, data.centerX, data.centerY);
    },
    (element, data) => {
        // Завершение зума
        console.log('Zoom end:', data.scale);
    },
    touchManager
);
```

**Touch-action**: `manipulation` - разрешает зум, блокирует панарамирование

## Управление Touch-Action

### Динамическое изменение жестов
```javascript
// Переключить элемент на другой тип жеста
TouchSupportUtils.updateTouchAction(element, 'twoFingerZoom', touchManager);

// Временно отключить все жесты
TouchSupportUtils.disableTouchGestures(element, touchManager);

// Включить жесты обратно
TouchSupportUtils.enableTouchGestures(element, touchManager);
```

### Значения Touch-Action

- `auto` - разрешает все стандартные жесты браузера
- `none` - блокирует все жесты (для точного контроля)
- `manipulation` - разрешает тап и зум, блокирует панарамирование
- `pan-x pan-y` - разрешает панарамирование, блокирует зум
- `pan-x` - разрешает только горизонтальное панарамирование
- `pan-y` - разрешает только вертикальное панарамирование

### Gesture Events
- `tap` - одиночное касание
- `doubleTap` - двойное касание
- `longPress` - длительное нажатие
- `drag` - перетаскивание
- `resize` - изменение размера

## Конфигурация

### Настройки пользователя

Touch жесты автоматически загружают настройки из конфигурации пользователя при инициализации:

```javascript
// Настройки pan/zoom загружаются из конфигурации
const touchConfig = this.configManager?.get('touchSupport.elements.twoFingerPan') || {};
const zoomConfig = this.configManager?.get('touchSupport.elements.twoFingerZoom') || {};

// Применение настроек
this.stateManager.set('touch.panThreshold', touchConfig.minMovement || 5);
this.stateManager.set('touch.panSensitivity', touchConfig.sensitivity || 1.0);
this.stateManager.set('touch.zoomIntensity', zoomConfig.sensitivity || 0.1);
```

#### Доступные настройки

- **`touchSupport.elements.twoFingerPan.minMovement`** - минимальное движение для pan (по умолчанию: 5)
- **`touchSupport.elements.twoFingerPan.sensitivity`** - чувствительность pan (по умолчанию: 1.0)
- **`touchSupport.elements.twoFingerZoom.sensitivity`** - чувствительность zoom (по умолчанию: 1.0)

#### Сохранение настроек

Настройки автоматически сохраняются при изменении в окне настроек редактора.

### Основные настройки

```json
{
  "touchSupport": {
    "enabled": true,
    "doubleTapThreshold": 300,
    "singleTapDelay": 50,
    "longPressDelay": 500,
    "minTouchSize": 44,
    "minMovement": 5,
    "visualFeedback": {
      "enabled": true,
      "resizeCursor": true,
      "dragOpacity": 0.7,
      "highlightColor": "#3b82f6"
    },
    "gestures": {
      "doubleTap": true,
      "longPress": true,
      "swipe": false,
      "pinch": true,
      "marquee": true,
      "twoFingerPan": true,
      "twoFingerContext": true,
      "twoFingerZoom": true
    },
    "accessibility": {
      "announceChanges": false,
      "highContrast": false,
      "reducedMotion": false
    },
    "performance": {
      "throttleResize": true,
      "throttleDrag": true,
      "throttleInterval": 16
    }
  }
}
```

### Настройки элементов

```json
{
  "elements": {
    "panelResizers": {
      "enabled": true,
      "direction": "auto",
      "minSize": 100,
      "maxSize": 800,
      "doubleTapToggle": true,
      "minMovement": 5
    },
    "tabDraggers": {
      "enabled": true,
      "direction": "horizontal",
      "doubleTapThreshold": 300,
      "dragThreshold": 10,
      "minMovement": 5
    },
    "buttons": {
      "enabled": true,
      "doubleTapThreshold": 300,
      "longPressDelay": 500,
      "visualFeedback": true
    },
    "contextMenus": {
      "enabled": true,
      "longPressDelay": 500,
      "tapToClose": true
    },
    "marqueeSelection": {
      "enabled": true,
      "minMovement": 5,
      "visualFeedback": true
    },
    "longPressMarquee": {
      "enabled": true,
      "minMovement": 5,
      "longPressDelay": 500,
      "visualFeedback": true
    },
    "twoFingerPan": {
      "enabled": true,
      "minMovement": 5,
      "sensitivity": 1.0
    },
    "twoFingerContext": {
      "enabled": true,
      "tapThreshold": 200
    },
    "twoFingerZoom": {
      "enabled": true,
      "minScale": 0.1,
      "maxScale": 10,
      "sensitivity": 1.0
    }
  }
}
```

## CSS Стили

### Обязательные стили для тач-элементов

```css
.touch-element {
    touch-action: none;
    user-select: none;
    min-height: 44px;
    min-width: 44px;
}
```

### Стили для разделителей

```css
.resizer, .resizer-y {
    touch-action: none;
    user-select: none;
}
```

## Производительность

### Оптимизации
- Throttling для resize и drag событий
- Минимальный размер тач-целей (44px)
- Отключение стандартных браузерных жестов
- Эффективная очистка обработчиков

### Рекомендации
- Используйте `TouchSupportUtils` для стандартных элементов
- Настраивайте `throttleInterval` для плавности
- Минимизируйте количество обработчиков
- Очищайте регистрации при удалении элементов

## Отладка

### Логирование
```javascript
// Включить отладочные логи
Logger.ui.debug('TouchSupportManager: Element registered', element);
```

### Проверка поддержки
```javascript
// Проверить поддержку тач-событий
if (TouchSupportUtils.isTouchSupported()) {
    console.log('Touch support available');
}

// Проверить мобильное устройство
if (TouchSupportUtils.isMobile()) {
    console.log('Mobile device detected');
}
```

## Интеграция

### С ResizerManager (ОБНОВЛЕНО v3.52.5)
```javascript
// Автоматическая регистрация разделителей через ResizerManager
this.levelEditor.resizerManager.registerResizer(
    resizerElement, 
    panelElement, 
    'left', 
    'horizontal'
);

// Автоматическое переключение touch поддержки через UnifiedTouchManager
this.stateManager.subscribe('touch.enabled', (enabled) => {
    this.resizerManager.updateAllResizersTouchSupport();
});
```

### С PanelPositionManager (ОБНОВЛЕНО v3.52.5)
```javascript
// Автоматическая регистрация разделителей через UnifiedTouchManager
this.levelEditor.unifiedTouchManager.registerElement(resizer, 'panelResizer', config, 'panel-resizer');
```

### С контекстными меню (ОБНОВЛЕНО v3.52.5)
```javascript
// Long-press для вызова меню через UnifiedTouchManager
TouchSupportUtils.addContextMenuTouchSupport(
    element,
    (element) => showContextMenu(element),
    unifiedTouchManager  // Используем UnifiedTouchManager
);
```

### С перетаскиванием табов (ОБНОВЛЕНО v3.52.5)
```javascript
// Тач-поддержка для перетаскивания через UnifiedTouchManager
TouchSupportUtils.addDragTouchSupport(
    tabContainer,
    onDragStart,
    onDrag,
    onDragEnd,
    unifiedTouchManager  // Используем UnifiedTouchManager
);
```

## Примеры

### Полный пример панели с тач-поддержкой (ОБНОВЛЕНО v3.52.5)

```javascript
class TouchPanel {
    constructor(unifiedTouchManager) {
        this.unifiedTouchManager = unifiedTouchManager;
        this.setupPanel();
    }
    
    setupPanel() {
        const panel = document.createElement('div');
        const resizer = document.createElement('div');
        
        // Добавить тач-поддержку к разделителю через UnifiedTouchManager
        this.unifiedTouchManager.registerElement(resizer, 'panelResizer', {
            direction: 'horizontal',
            minSize: 200,
            maxSize: 600,
            onResizeStart: (element, targetPanel, touch) => {
                element.classList.add('resizing');
            },
            onResize: (element, targetPanel, newSize, touch) => {
                targetPanel.style.width = newSize + 'px';
            },
            onResizeEnd: (element, targetPanel, currentSize) => {
                element.classList.remove('resizing');
                this.saveSize(currentSize);
            },
            onDoubleTap: (element, touch) => {
                this.toggleCollapse();
            }
        }, 'panel-resizer');
        
        return panel;
    }
    
    destroy() {
        // Автоматическая очистка через UnifiedTouchManager
        this.unifiedTouchManager.unregisterElement(this.resizer);
    }
}
```

## Унифицированная система resize

### Единая логика для touch и mouse

TouchSupportManager предоставляет унифицированные методы расчета размеров панелей, которые используются как для touch, так и для mouse событий. Это устраняет дублирование кода и обеспечивает консистентное поведение.

#### Основные методы

```javascript
// Главный метод для расчета размера панели
touchSupportManager.calculatePanelSize(element, config, input, initialData)

// Специализированные методы
touchSupportManager.calculateHorizontalPanelSize(element, input, initialData)
touchSupportManager.calculateVerticalPanelSize(element, input, initialData)

// Получить методы для внешнего использования
const resizeMethods = touchSupportManager.getUnifiedResizeMethods();
```

#### Поддерживаемые типы разделителей

**Горизонтальные разделители:**
- **Left panel** - использует расстояние от левого края
- **Right panel** - использует расстояние от правого края  
- **Folders resizer** - автоматически определяет позицию (left/right)

**Вертикальные разделители:**
- **Console resizer** - палец вниз = панель больше
- **Assets resizer** - палец вниз = панель меньше

#### Пример использования

```javascript
// В mouse handler
const handleMouseMove = (e) => {
    const newSize = this.levelEditor.touchSupportManager.calculateHorizontalPanelSize(
        resizer, 
        e, 
        { startX: e.clientX, startY: e.clientY }
    );
    this.handlePanelResize(panel, panelSide, 'horizontal', newSize);
};

// В touch handler (автоматически используется)
// TouchSupportManager автоматически вызывает calculatePanelSize
```

#### Преимущества унификации

- **Единая логика** - touch и mouse используют одинаковые расчеты
- **Легкость поддержки** - изменения в одном месте
- **Консистентность** - поведение идентично для всех типов ввода
- **Меньше багов** - нет расхождений между touch и mouse
- **Переиспользование** - методы доступны для других частей кода

## API Reference (ОБНОВЛЕНО v3.52.5)

### UnifiedTouchManager

#### Основные методы
- `registerElement(element, configType, customConfig, elementId)` - регистрация элемента
- `unregisterElement(element)` - отмена регистрации
- `destroy()` - уничтожение менеджера

#### Интеграция с EventHandlerManager
- `eventHandlerManager.registerTouchElement(element, configType, customConfig, elementId)` - автоматическая интеграция
- `eventHandlerManager.unregisterTouchElement(element)` - автоматическая отмена регистрации

### GlobalEventRegistry (НОВЫЙ v3.52.5)

#### Основные методы
- `registerComponentHandlers(componentId, handlers, target)` - регистрация глобальных событий
- `unregisterComponentHandlers(componentId)` - отмена регистрации
- `isComponentRegistered(componentId)` - проверка регистрации
- `getRegisteredComponents()` - получение списка компонентов
- `cleanup()` - очистка всех компонентов

#### Параметры
- `componentId` (string) - уникальный идентификатор компонента
- `handlers` (Object) - объект с обработчиками событий
- `target` (string) - цель регистрации ('document' или 'window')

### TouchSupportManager (Legacy - используется внутри UnifiedTouchManager)

#### Основные методы
- `registerElement(element, configType, customConfig)` - регистрация элемента
- `unregisterElement(element)` - отмена регистрации
- `updateConfig(element, newConfig)` - обновление конфигурации
- `getConfig(element)` - получение конфигурации
- `isRegistered(element)` - проверка регистрации
- `clear()` - очистка всех регистраций
- `destroy()` - уничтожение менеджера

#### Унифицированные методы resize
- `calculatePanelSize(element, config, input, initialData)` - расчет размера панели
- `calculateHorizontalPanelSize(element, input, initialData)` - расчет ширины
- `calculateVerticalPanelSize(element, input, initialData)` - расчет высоты
- `getUnifiedResizeMethods()` - получение методов для внешнего использования

### TouchSupportUtils (ОБНОВЛЕНО v3.52.5)

#### Методы
- `addButtonTouchSupport(element, onTap, onDoubleTap, onLongPress, touchManager)` - тач-поддержка для кнопок
- `addDragTouchSupport(element, onDragStart, onDrag, onDragEnd, touchManager)` - тач-поддержка для перетаскивания
- `addMarqueeTouchSupport(element, onMarqueeStart, onMarqueeMove, onMarqueeEnd, touchManager)` - тач-поддержка для рамки селекта
- `addLongPressMarqueeTouchSupport(element, onMarqueeStart, onMarqueeMove, onMarqueeEnd, touchManager, longPressDelay)` - тач-поддержка для рамки селекта с длительным нажатием
- `addTwoFingerPanSupport(element, onPanStart, onPanMove, onPanEnd, touchManager)` - тач-поддержка для двухпальцевого панарамирования
- `addTwoFingerZoomSupport(element, onZoomStart, onZoomMove, onZoomEnd, touchManager)` - тач-поддержка для двухпальцевого зума
- `addTwoFingerPanZoomSupport(element, onPanStart, onPanMove, onPanEnd, onZoomStart, onZoomMove, onZoomEnd, touchManager)` - комбинированная поддержка панарамирования и зума
- `addTwoFingerContextSupport(element, onTwoFingerTap, touchManager)` - тач-поддержка для двухпальцевого контекстного меню
- `updateTouchAction(element, actionType, touchManager)` - обновление touch-action для элемента
- `disableTouchGestures(element, touchManager)` - отключение жестов для элемента
- `enableTouchGestures(element, touchManager)` - включение жестов для элемента
- `isTouchSupported()` - проверка поддержки тач-событий
- `isMobile()` - проверка мобильного устройства
