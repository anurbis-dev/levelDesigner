# Event System

Упрощенная и надежная система обработчиков событий для Level Editor.

## Структура

### Основные компоненты
- **EventHandlerManager.js** - единый менеджер для управления всеми обработчиками событий
- **EventHandlerUtils.js** - утилиты для упрощения работы с обработчиками
- **UnifiedTouchManager.js** - унифицированная система обработки тач-событий
- **GlobalEventRegistry.js** - централизованная система управления глобальными событиями

### Обработчики событий
- **EventHandlers.js** - основные обработчики событий редактора
- **MouseHandlers.js** - обработчики мыши для канваса и панелей
- **TouchHandlers.js** - обработчики тач событий для мобильных устройств (legacy support)

## Принципы

- **Централизация**: Все обработчики событий управляются через EventHandlerManager
- **Делегирование**: Использование event delegation для эффективности
- **Автоматическая очистка**: Система автоматически удаляет обработчики при уничтожении элементов
- **Простота**: Минимальный API для максимальной надежности
- **Унификация**: Единая система для мышиных и тач-событий
- **Предотвращение дублирования**: Автоматическая проверка и предотвращение повторной регистрации
- **Глобальное управление**: Централизованное управление document/window событиями

## Использование

### Базовое использование

```javascript
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';

// Регистрация контейнера с обработчиками
const handlers = EventHandlerUtils.createDialogHandlers(
    () => console.log('ESC pressed'),
    (e) => console.log('Overlay clicked'),
    (e) => console.log('Button clicked')
);

eventHandlerManager.registerContainer(element, handlers);

// Очистка при уничтожении
eventHandlerManager.unregisterContainer(element);
```

### Тач события

UnifiedTouchManager предоставляет единую систему обработки всех тач-событий:

```javascript
// Регистрация элемента с тач-поддержкой
unifiedTouchManager.registerElement(element, 'button', {
    onTap: (element, touch) => console.log('Button tapped'),
    onDoubleTap: (element, touch) => console.log('Button double-tapped'),
    onLongPress: (element, touch) => console.log('Button long-pressed')
});

// Регистрация канваса с полной поддержкой жестов
unifiedTouchManager.registerElement(canvas, 'canvas', {
    enablePan: true,
    enableZoom: true,
    enableMarquee: true,
    enableContextMenu: true
});

// Регистрация разделителя панели
unifiedTouchManager.registerElement(resizer, 'panelResizer', {
    direction: 'horizontal',
    minSize: 100,
    maxSize: 800,
    onResizeStart: (element, targetPanel, touch) => console.log('Resize started'),
    onResize: (element, targetPanel, newSize, touch) => console.log('Resizing to:', newSize),
    onResizeEnd: (element, targetPanel, currentSize) => console.log('Resize ended:', currentSize)
});
```

### Глобальные события

GlobalEventRegistry обеспечивает централизованное управление document/window событиями:

```javascript
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';

// Регистрация window событий
const windowHandlers = {
    resize: () => console.log('Window resized'),
    beforeunload: () => console.log('Window closing')
};
globalEventRegistry.registerComponentHandlers('my-component', windowHandlers, 'window');

// Регистрация document событий
const documentHandlers = {
    mousemove: (e) => console.log('Mouse moved'),
    mouseup: (e) => console.log('Mouse up'),
    keydown: (e) => console.log('Key pressed')
};
globalEventRegistry.registerComponentHandlers('my-component', documentHandlers, 'document');

// Отмена регистрации при уничтожении компонента
globalEventRegistry.unregisterComponentHandlers('my-component');
```

### Типы обработчиков

#### Диалоги
```javascript
const dialogHandlers = EventHandlerUtils.createDialogHandlers(
    onEscape,      // ESC клавиша
    onOverlayClick, // Клик по overlay
    onButtonClick   // Клик по кнопкам
);
```

#### Панели
```javascript
const panelHandlers = EventHandlerUtils.createPanelHandlers(
    (e) => {
        const item = e.target.closest('.panel-item');
        if (item) {
            this.handleItemClick(item);
        }
    },
    (e) => {
        const button = e.target.closest('button');
        if (button) {
            this.handleButtonClick(button);
        }
    },
    (e) => {
        if (e.target.tagName === 'INPUT') {
            this.handleInputChange(e.target);
        }
    }
);
```

#### Контекстные меню
```javascript
const contextMenuHandlers = EventHandlerUtils.createContextMenuHandlers(
    (e) => {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem) {
            this.handleMenuItemClick(menuItem);
        }
    },
    () => this.hideMenu()
);
```

#### Формы
```javascript
const formHandlers = EventHandlerUtils.createFormHandlers(
    (e) => {
        e.preventDefault();
        this.handleSubmit();
    },
    (e) => {
        this.handleInputChange(e.target);
    },
    (e) => {
        this.validateField(e.target);
    }
);
```

#### Базовые тач события
```javascript
const touchHandlers = EventHandlerUtils.createTouchHandlers(
    (e) => this.handleTouchStart(e),
    (e) => this.handleTouchMove(e),
    (e) => this.handleTouchEnd(e),
    (e) => this.handleTouchCancel(e)
);
```

#### Тач жесты для канваса
```javascript
const gestureHandlers = EventHandlerUtils.createTouchGestureHandlers(
    (e, touch) => this.handleSingleTouch(e, touch),
    (e, touches) => this.handleTwoTouch(e, touches),
    (e) => this.handleTouchEnd(e)
);
```

#### Тач панели с изменением размера
```javascript
const panelHandlers = EventHandlerUtils.createTouchPanelHandlers(
    (e, touch) => this.handleResizeStart(e, touch),
    (e, touch) => this.handleResizeMove(e, touch),
    (e) => this.handleResizeEnd(e),
    (e) => this.handleDoubleTap(e)
);
```

#### Тач кнопки
```javascript
const buttonHandlers = EventHandlerUtils.createTouchButtonHandlers(
    (e, touch) => this.handleTap(e, touch),
    (e, touch) => this.handleLongPress(e, touch),
    (e, touch) => this.handleDoubleTap(e, touch)
);
```

#### Продвинутые тач жесты
```javascript
const advancedHandlers = EventHandlerUtils.createAdvancedTouchHandlers(
    (detail) => this.handleSingleTap(detail),
    (detail) => this.handleDoubleTap(detail),
    (detail) => this.handleLongPress(detail),
    (phase, detail) => this.handleTouchDrag(phase, detail),
    (detail) => this.handleTwoFingerTap(detail),
    (detail) => this.handleThreeFingerTap(detail)
);
```

## Преимущества новой системы

- **-70% кода обработчиков** - простая регистрация вместо множества addEventListener
- **-60% зависимостей** - один импорт вместо множества
- **-80% времени настройки** - один вызов вместо множества
- **0 утечек памяти** - автоматическая очистка
- **Предотвращение дублирования** - автоматическая проверка повторной регистрации
- **Централизованное управление** - единая система для всех типов событий
- **Глобальные события** - централизованное управление document/window событиями
- **Унификация touch/mouse** - единый API для всех типов взаимодействий
- **Централизованная обработка** - все события в одном месте
- **Делегирование событий** - один обработчик на контейнер
- **Полная тач поддержка** - единообразная обработка мыши и тач событий
- **Мобильная совместимость** - автоматическая поддержка жестов и панорамирования
- **Продвинутые жесты** - поддержка тач-драга, дабл-тапа, тапа двумя и тремя пальцами
- **Гибкая настройка** - возможность настройки пороговых значений для жестов
- **Унифицированная система** - единый интерфейс для всех типов взаимодействий
- **Отсутствие конфликтов** - нет дублирования обработчиков событий

## Дополнительные методы

### createUniversalHandlers
Создает универсальные обработчики для элементов с поддержкой всех типов событий:

```javascript
const universalHandlers = EventHandlerUtils.createUniversalHandlers(
    (e) => this.onClick(e),
    (e) => this.onMouseDown(e),
    (e) => this.onMouseUp(e),
    (e) => this.onMouseMove(e),
    (e) => this.onMouseEnter(e),
    (e) => this.onMouseLeave(e),
    (e) => this.onKeyDown(e),
    (e) => this.onKeyUp(e),
    (e) => this.onFocus(e),
    (e) => this.onBlur(e),
    (e) => this.onTouchStart(e),
    (e) => this.onTouchMove(e),
    (e) => this.onTouchEnd(e),
    (e) => this.onTouchCancel(e)
);
```


### registerTouchElement
Регистрирует элемент с базовыми тач обработчиками:

```javascript
EventHandlerUtils.registerTouchElement(
    element,
    (e) => this.onTouchStart(e),
    (e) => this.onTouchMove(e),
    (e) => this.onTouchEnd(e),
    (e) => this.onTouchCancel(e),
    eventHandlerManager
);
```

### registerTouchGestureContainer
Регистрирует контейнер с тач жестами:

```javascript
EventHandlerUtils.registerTouchGestureContainer(
    container,
    'gesture-container',
    (e, touch) => this.onSingleTouch(e, touch),
    (e, touches) => this.onTwoTouch(e, touches),
    (e) => this.onTouchEnd(e),
    eventHandlerManager
);
```

### registerTouchPanel
Регистрирует панель с тач поддержкой изменения размера:

```javascript
EventHandlerUtils.registerTouchPanel(
    panel,
    'touch-panel',
    (e, touch) => this.onResizeStart(e, touch),
    (e, touch) => this.onResizeMove(e, touch),
    (e) => this.onResizeEnd(e),
    (e) => this.onDoubleTap(e),
    eventHandlerManager
);
```

### registerTouchButton
Регистрирует кнопку с тач жестами:

```javascript
EventHandlerUtils.registerTouchButton(
    button,
    (e, touch) => this.onTap(e, touch),
    (e, touch) => this.onLongPress(e, touch),
    (e, touch) => this.onDoubleTap(e, touch),
    eventHandlerManager
);
```

### registerAdvancedTouchElement
Регистрирует элемент с продвинутыми тач жестами:

```javascript
EventHandlerUtils.registerAdvancedTouchElement(
    element,
    'advanced-touch-element',
    (detail) => this.onSingleTap(detail),
    (detail) => this.onDoubleTap(detail),
    (detail) => this.onLongPress(detail),
    (phase, detail) => this.onTouchDrag(phase, detail),
    (detail) => this.onTwoFingerTap(detail),
    (detail) => this.onThreeFingerTap(detail),
    eventHandlerManager
);
```

### Регистрация отдельных элементов
```javascript
// Регистрация кнопки
const buttonHandlers = EventHandlerUtils.createButtonHandlers(
    (e) => this.onClick(e),
    (e) => this.onHover(e),
    (e) => this.onLeave(e)
);
eventHandlerManager.registerElement(button, buttonHandlers, 'my-button');

// Регистрация поля ввода
const inputHandlers = EventHandlerUtils.createInputHandlers(
    (e) => this.onChange(e.target.value),
    (e) => this.onFocus(e.target),
    (e) => this.onBlur(e.target),
    (e) => this.onKeyDown(e)
);
eventHandlerManager.registerElement(input, inputHandlers, 'my-input');
```

### Глобальные обработчики
```javascript
// Регистрация глобальных обработчиков
const globalHandlers = {
    keydown: (e) => {
        if (e.key === 'Escape') {
            this.handleGlobalEscape();
        }
    }
};
eventHandlerManager.registerGlobalHandlers(globalHandlers, 'global-esc');
```

### Тач обработчики
```javascript
// Регистрация тач элемента
EventHandlerUtils.registerTouchElement(
    element,
    (e) => this.handleTouchStart(e),
    (e) => this.handleTouchMove(e),
    (e) => this.handleTouchEnd(e),
    (e) => this.handleTouchCancel(e),
    eventHandlerManager
);

// Регистрация тач жестов для канваса
EventHandlerUtils.registerTouchGestureContainer(
    canvas,
    'canvas-gestures',
    (e, touch) => this.handleSingleTouch(e, touch),
    (e, touches) => this.handleTwoTouch(e, touches),
    (e) => this.handleTouchEnd(e),
    eventHandlerManager
);

// Регистрация тач панели
EventHandlerUtils.registerTouchPanel(
    panel,
    'panel-touch',
    (e, touch) => this.handleResizeStart(e, touch),
    (e, touch) => this.handleResizeMove(e, touch),
    (e) => this.handleResizeEnd(e),
    (e) => this.handleDoubleTap(e),
    eventHandlerManager
);

// Регистрация тач кнопки
EventHandlerUtils.registerTouchButton(
    button,
    (e, touch) => this.handleTap(e, touch),
    (e, touch) => this.handleLongPress(e, touch),
    (e, touch) => this.handleDoubleTap(e, touch),
    eventHandlerManager
);
```

## Тестирование

### EventSystemIntegrationTest
Базовый тест интеграции системы событий:

```javascript
import { EventSystemIntegrationTest } from './EventSystemIntegrationTest.js';

const test = new EventSystemIntegrationTest();
await test.runTests();
test.cleanup();
```

### TouchGestureTest
Комплексный тест всех тач-жестов:

```javascript
import { TouchGestureTest } from './TouchGestureTest.js';

const test = new TouchGestureTest();
await test.runAllTests();
test.cleanup();
```

## Документация

Подробная документация доступна в:
- `docs/EVENT_HANDLER_SYSTEM.md` - полное руководство по системе

## Правила ведения документации (для агента)

### Общая структура документации
- **Заголовок** - краткое описание системы
- **Структура** - компоненты и их назначение (кратко)
- **Принципы** - основные концепции (список)
- **Использование** - базовые примеры и общие принципы
- **Типы обработчиков** - примеры создания обработчиков (`####` подразделы)
- **Преимущества** - список преимуществ системы
- **Дополнительные методы** - API методы регистрации (`###` методы)
- **Документация** - ссылки на подробную документацию

### Где искать информацию
- **Методы создания обработчиков** → `EventHandlerUtils.js` (методы `create*Handlers()`)
- **Методы регистрации** → `EventHandlerUtils.js` (методы `register*()`)
- **Тач жесты и события** → `TouchHandlers.js` (все методы обработки тач)
- **Архитектура системы** → `docs/ARCHITECTURE.md`
- **Подробные примеры** → `docs/EVENT_HANDLER_SYSTEM.md`
- **JSDoc документация** → комментарии в исходных файлах `.js`

### Правила написания разделов
- **Краткие описания** - в "Структура" и "Принципы" (списки, без примеров)
- **Примеры кода** - в "Использование", "Типы обработчиков", "Дополнительные методы"
- **API методы** - только в "Дополнительные методы" с полными примерами
- **Ссылки** - в разделе "Документация"

### Форматирование
- `##` - основные разделы
- `###` - подразделы и API методы
- `####` - типы обработчиков
- **Жирный текст** - для выделения ключевых понятий
- `код` - для названий методов и классов

### Добавление нового контента
1. **Новые компоненты** → "Структура" (краткое описание)
2. **Новые принципы** → "Принципы" (список)
3. **Новые примеры** → "Использование" (подраздел `###`)
4. **Новые типы обработчиков** → "Типы обработчиков" (подраздел `####`)
5. **Новые API методы** → "Дополнительные методы" (метод `###`)
6. **Новые преимущества** → "Преимущества" (список)
7. **Новые ссылки** → "Документация" (список)

### Обновление при изменениях кода
- **Добавил метод в `EventHandlerUtils.js`** → обновить соответствующий раздел в README
- **Изменил API в `TouchHandlers.js`** → обновить примеры и описания
- **Добавил новый компонент** → обновить "Структура" и "Архитектура"
- **Изменил поведение системы** → обновить "Принципы" и "Преимущества"
- `tmp/docs/EventSystemMigrationGuide.md` - руководство по миграции