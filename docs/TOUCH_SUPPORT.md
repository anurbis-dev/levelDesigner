# Touch Support System

Централизованная система поддержки тач-скрина для мобильных устройств.

## Обзор

`TouchSupportManager` предоставляет единый API для обработки тач-событий во всех элементах интерфейса:

- **Панели и разделители** - изменение размера с поддержкой double-tap
- **Перетаскивание табов** - drag & drop с тач-поддержкой
- **Кнопки и элементы управления** - tap, double-tap, long-press
- **Контекстные меню** - long-press для вызова меню

## Архитектура

### TouchSupportManager
Центральный менеджер для регистрации и обработки тач-событий.

### TouchSupportUtils
Утилиты для быстрого добавления тач-поддержки к элементам.

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
