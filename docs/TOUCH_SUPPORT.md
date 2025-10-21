# Touch Support System

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

### BrowserGesturePreventionManager
Единая система блокировки браузерных жестов с умным определением навигационных жестов.

### TouchSupportUtils
Утилиты для быстрого добавления тач-поддержки к элементам.

### TouchInitializationManager
Централизованная инициализация всех тач-обработчиков при старте редактора.

### Конфигурация
Настройки в `config/defaults/touch.json` для кастомизации поведения.

## Использование

### Базовое использование

```javascript
// Регистрация элемента для тач-поддержки
touchManager.registerElement(element, 'panelResizer', {
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
});
```

### Использование утилит

```javascript
// Добавление тач-поддержки к кнопке
TouchSupportUtils.addButtonTouchSupport(
    button, 
    () => console.log('Button tapped'),
    () => console.log('Button double-tapped'),
    () => console.log('Button long-pressed'),
    touchManager
);

// Добавление тач-поддержки к перетаскиваемому элементу
TouchSupportUtils.addDragTouchSupport(
    element,
    (element, touch) => console.log('Drag started'),
    (element, touch, touchData) => console.log('Dragging'),
    (element, touchData) => console.log('Drag ended'),
    touchManager
);
```

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

## Новые жесты (v3.51.1)

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

### Основные настройки

```json
{
  "touchSupport": {
    "enabled": true,
    "doubleTapThreshold": 300,
    "singleTapDelay": 50,
    "longPressDelay": 500,
    "minTouchSize": 44
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
      "doubleTapToggle": true
    },
    "tabDraggers": {
      "enabled": true,
      "direction": "horizontal",
      "doubleTapThreshold": 300,
      "dragThreshold": 10
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

### С PanelPositionManager
```javascript
// Автоматическая регистрация разделителей
this.levelEditor.touchSupportManager.registerElement(resizer, 'panelResizer', config);
```

### С контекстными меню
```javascript
// Long-press для вызова меню
TouchSupportUtils.addContextMenuTouchSupport(
    element,
    (element) => showContextMenu(element),
    touchManager
);
```

### С перетаскиванием табов
```javascript
// Тач-поддержка для перетаскивания
TouchSupportUtils.addDragTouchSupport(
    tabContainer,
    onDragStart,
    onDrag,
    onDragEnd,
    touchManager
);
```

## Примеры

### Полный пример панели с тач-поддержкой

```javascript
class TouchPanel {
    constructor(touchManager) {
        this.touchManager = touchManager;
        this.setupPanel();
    }
    
    setupPanel() {
        const panel = document.createElement('div');
        const resizer = document.createElement('div');
        
        // Добавить тач-поддержку к разделителю
        this.touchManager.registerElement(resizer, 'panelResizer', {
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
        });
        
        return panel;
    }
}
```

## API Reference

### TouchSupportManager

#### Методы
- `registerElement(element, configType, customConfig)` - регистрация элемента
- `unregisterElement(element)` - отмена регистрации
- `updateConfig(element, newConfig)` - обновление конфигурации
- `getConfig(element)` - получение конфигурации
- `isRegistered(element)` - проверка регистрации
- `clear()` - очистка всех регистраций
- `destroy()` - уничтожение менеджера

### TouchSupportUtils

#### Методы
- `addButtonTouchSupport()` - тач-поддержка для кнопок
- `addDragTouchSupport()` - тач-поддержка для перетаскивания
- `addResizeTouchSupport()` - тач-поддержка для изменения размера
- `addContextMenuTouchSupport()` - тач-поддержка для контекстных меню
- `isTouchSupported()` - проверка поддержки тач-событий
- `isMobile()` - проверка мобильного устройства
- `getOptimalTouchSize()` - оптимальный размер тач-цели
- `applyTouchStyles()` - применение тач-стилей
- `createTouchButton()` - создание тач-кнопки
- `hapticFeedback()` - тактильная обратная связь
