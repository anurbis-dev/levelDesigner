# Руководство по системе обработчиков событий v3.52.5

## 🔗 Быстрые ссылки

- **🚀 Быстрый старт**: [QUICK_START.md](./QUICK_START.md)
- **🏗️ Архитектура**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **📖 API**: [API_REFERENCE.md](./API_REFERENCE.md)
- **🤖 Примеры**: [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md#-быстрые-примеры-для-агента)
- **⚠️ Ошибки**: [COMMON_MISTAKES.md](./COMMON_MISTAKES.md)
- **🎯 UI**: [UI_CONSTRUCTORS_GUIDE.md](./UI_CONSTRUCTORS_GUIDE.md)

---

## Обзор

Упрощенная и надежная система обработчиков событий (EventHandlerManager) предоставляет единый способ управления всеми событиями UI элементов в редакторе уровней. Система использует event delegation для максимальной эффективности и автоматически обрабатывает очистку обработчиков.

## 📋 Краткое резюме системы

### 🎯 Назначение обработчиков
1. **Централизованная регистрация**: `eventHandlerManager.registerContainer(element, handlers)`
2. **Готовые конфигурации**: `EventHandlerUtils.createDialogHandlers()`, `createPanelHandlers()`, etc.
3. **Event delegation**: Один обработчик на контейнер для всех дочерних элементов

### 🧹 Очистка обработчиков
1. **Автоматическая очистка**: `eventHandlerManager.unregisterContainer(element)`
2. **Полная очистка**: `eventHandlerManager.cleanup()`
3. **Предотвращение утечек**: Все обработчики автоматически удаляются при уничтожении элементов

### 🔄 Жизненный цикл
```
Создание элемента → Регистрация контейнера → Использование → Очистка → Удаление
```

### ⚠️ Критически важно
- **Обязательная очистка**: Всегда вызывайте `unregisterContainer()` перед удалением DOM
- **Event delegation**: Используйте селекторы для обработки событий дочерних элементов
- **Готовые конфигурации**: Используйте EventHandlerUtils для типовых случаев

## 📝 Основные принципы

- **Event delegation** - один обработчик на контейнер вместо множества addEventListener
- **Готовые конфигурации** - EventHandlerUtils для типовых случаев
- **Автоматическая очистка** - нет утечек памяти
- **Простота использования** - минимальный API для максимальной функциональности

## 🚀 Быстрый старт

### Базовое использование

```javascript
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';

// Создание обработчиков для диалога
const dialogHandlers = EventHandlerUtils.createDialogHandlers(
    () => console.log('ESC pressed'),
    (e) => console.log('Overlay clicked'),
    (e) => console.log('Button clicked')
);

// Регистрация контейнера
eventHandlerManager.registerContainer(dialogElement, dialogHandlers);

// Очистка при уничтожении
eventHandlerManager.unregisterContainer(dialogElement);
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
const panelHandlers = SimpleEventHandlerUtils.createPanelHandlers(
    onItemClick,    // Клик по элементам
    onButtonClick,  // Клик по кнопкам
    onInputChange   // Изменения в полях ввода
);
```

#### Контекстные меню
```javascript
const contextMenuHandlers = SimpleEventHandlerUtils.createContextMenuHandlers(
    onMenuItemClick, // Клик по элементам меню
    onMenuClose      // Закрытие меню
);
```

## 🏗️ Архитектура

### Основные компоненты

#### EventHandlerManager
- **Назначение**: Единый менеджер для всех обработчиков событий
- **Принцип**: Event delegation - один обработчик на контейнер
- **Очистка**: Автоматическое удаление обработчиков при уничтожении элементов

#### EventHandlerUtils
- **Назначение**: Готовые конфигурации для типовых случаев
- **Типы**: Диалоги, панели, контекстные меню, формы
- **Преимущество**: Упрощение создания обработчиков

### Поток обработки событий

```
1. Событие → 2. Event delegation → 3. Селектор → 4. Обработчик → 5. Действие
```

1. **Событие**: Пользователь взаимодействует с элементом
2. **Event delegation**: Событие всплывает к контейнеру
3. **Селектор**: Проверяется соответствие селектору
4. **Обработчик**: Вызывается соответствующий обработчик
5. **Действие**: Выполняется нужное действие

## 📊 Преимущества системы

- **Простота** - один вызов вместо множества addEventListener
- **Производительность** - event delegation и меньше обработчиков
- **Надежность** - автоматическая очистка без утечек памяти
- **Централизация** - все события в одном месте

## 🔧 API Reference

### EventHandlerManager

#### registerContainer(element, handlers, id)
Регистрирует контейнер с обработчиками событий.

**Параметры:**
- `element` (HTMLElement) - DOM элемент контейнера
- `handlers` (Object) - объект с обработчиками событий
- `id` (string, optional) - уникальный идентификатор

**Пример:**
```javascript
eventHandlerManager.registerContainer(
    dialogElement, 
    dialogHandlers, 
    'my-dialog'
);
```

#### unregisterContainer(element)
Удаляет обработчики событий для контейнера.

**Параметры:**
- `element` (HTMLElement) - DOM элемент контейнера

**Пример:**
```javascript
eventHandlerManager.unregisterContainer(dialogElement);
```

#### cleanup()
Очищает все зарегистрированные обработчики.

**Пример:**
```javascript
eventHandlerManager.cleanup();
```

#### registerElement(element, handlers, elementId)
Регистрирует отдельный элемент с прямыми обработчиками событий.

**Параметры:**
- `element` (HTMLElement) - DOM элемент
- `handlers` (Object) - объект с обработчиками событий
- `elementId` (string, optional) - уникальный идентификатор

**Пример:**
```javascript
const handlers = {
    click: (e) => this.onClick(e),
    mouseenter: (e) => this.onHover(e),
    mouseleave: (e) => this.onLeave(e)
};

eventHandlerManager.registerElement(button, handlers, 'my-button');
```

#### registerGlobalHandlers(handlers, handlerId)
Регистрирует глобальные обработчики событий.

**Параметры:**
- `handlers` (Object) - объект с глобальными обработчиками
- `handlerId` (string) - уникальный идентификатор

**Пример:**
```javascript
const handlers = {
    keydown: (e) => {
        if (e.key === 'Escape') {
            this.handleGlobalEscape();
        }
    }
};

eventHandlerManager.registerGlobalHandlers(handlers, 'global-esc');
```

#### unregisterElement(element)
Удаляет обработчики событий для отдельного элемента.

**Параметры:**
- `element` (HTMLElement) - DOM элемент

**Пример:**
```javascript
eventHandlerManager.unregisterElement(button);
```

#### unregisterGlobalHandlers(handlerId)
Удаляет глобальные обработчики событий.

**Параметры:**
- `handlerId` (string) - идентификатор обработчиков

**Пример:**
```javascript
eventHandlerManager.unregisterGlobalHandlers('global-esc');
```

### EventHandlerUtils

#### createDialogHandlers(onEscape, onOverlayClick, onButtonClick)
Создает конфигурацию обработчиков для диалога.

**Параметры:**
- `onEscape` (Function) - обработчик ESC клавиши
- `onOverlayClick` (Function) - обработчик клика по overlay
- `onButtonClick` (Function) - обработчик клика по кнопкам

**Возвращает:** Object с конфигурацией обработчиков

**Пример:**
```javascript
const dialogHandlers = EventHandlerUtils.createDialogHandlers(
    () => this.close(),
    (e) => {
        if (e.target === this.element) {
            this.close();
        }
    },
    (e) => {
        const button = e.target.closest('button');
        if (button) {
            this.handleButtonClick(button);
        }
    }
);
```

#### createPanelHandlers(onItemClick, onButtonClick, onInputChange)
Создает конфигурацию обработчиков для панели.

**Параметры:**
- `onItemClick` (Function) - обработчик клика по элементам
- `onButtonClick` (Function) - обработчик клика по кнопкам
- `onInputChange` (Function) - обработчик изменений в полях ввода

**Возвращает:** Object с конфигурацией обработчиков

**Пример:**
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

#### createContextMenuHandlers(onMenuItemClick, onMenuClose)
Создает конфигурацию обработчиков для контекстного меню.

**Параметры:**
- `onMenuItemClick` (Function) - обработчик клика по элементам меню
- `onMenuClose` (Function) - обработчик закрытия меню

**Возвращает:** Object с конфигурацией обработчиков

**Пример:**
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

#### createFormHandlers(onSubmit, onInputChange, onValidation)
Создает конфигурацию обработчиков для формы.

**Параметры:**
- `onSubmit` (Function) - обработчик отправки формы
- `onInputChange` (Function) - обработчик изменений в полях
- `onValidation` (Function) - обработчик валидации

**Возвращает:** Object с конфигурацией обработчиков

**Пример:**
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

#### createButtonHandlers(onClick, onHover, onLeave)
Создает обработчики для отдельной кнопки.

**Параметры:**
- `onClick` (Function) - обработчик клика
- `onHover` (Function, optional) - обработчик наведения
- `onLeave` (Function, optional) - обработчик ухода курсора

**Возвращает:** Object с обработчиками

**Пример:**
```javascript
const buttonHandlers = EventHandlerUtils.createButtonHandlers(
    (e) => this.onClick(e),
    (e) => this.onHover(e),
    (e) => this.onLeave(e)
);
```

#### createInputHandlers(onChange, onFocus, onBlur, onKeyDown)
Создает обработчики для поля ввода.

**Параметры:**
- `onChange` (Function) - обработчик изменения
- `onFocus` (Function, optional) - обработчик фокуса
- `onBlur` (Function, optional) - обработчик потери фокуса
- `onKeyDown` (Function, optional) - обработчик нажатия клавиш

**Возвращает:** Object с обработчиками

**Пример:**
```javascript
const inputHandlers = EventHandlerUtils.createInputHandlers(
    (e) => this.onChange(e.target.value),
    (e) => this.onFocus(e.target),
    (e) => this.onBlur(e.target),
    (e) => this.onKeyDown(e)
);
```

#### createUniversalHandlers(windowInstance, windowType)
Создает универсальные обработчики для окон (обратная совместимость).

**Параметры:**
- `windowInstance` (Object) - экземпляр окна
- `windowType` (string) - тип окна

**Возвращает:** Object с конфигурацией обработчиков

**Пример:**
```javascript
const universalHandlers = EventHandlerUtils.createUniversalHandlers(
    this, 'settings-dialog'
);
```

## 🎯 Примеры использования

### Создание диалога

```javascript
class MyDialog {
    constructor() {
        this.element = this.createDialog();
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        const handlers = EventHandlerUtils.createDialogHandlers(
            () => this.close(),
            (e) => {
                if (e.target === this.element) {
                    this.close();
                }
            },
            (e) => {
                const button = e.target.closest('button');
                if (button) {
                    this.handleButtonClick(button);
                }
            }
        );
        
        eventHandlerManager.registerContainer(this.element, handlers);
    }
    
    destroy() {
        eventHandlerManager.unregisterContainer(this.element);
        this.element.remove();
    }
}
```

### Создание панели

```javascript
class MyPanel {
    constructor() {
        this.element = this.createPanel();
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        const handlers = EventHandlerUtils.createPanelHandlers(
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
        
        eventHandlerManager.registerContainer(this.element, handlers);
    }
    
    destroy() {
        eventHandlerManager.unregisterContainer(this.element);
        this.element.remove();
    }
}
```

## ⚠️ Важные моменты

### Обязательная очистка
```javascript
// ✅ Правильно
class MyComponent {
    destroy() {
        eventHandlerManager.unregisterContainer(this.element);
        this.element.remove();
    }
}
```

### Использование селекторов
```javascript
// ✅ Конкретные селекторы
const handlers = {
    click: {
        selector: '.dialog-button, .panel-button',
        handler: (e) => {
            const button = e.target.closest('button');
            if (button) {
                this.handleButtonClick(button);
            }
        }
    }
};
```




## 🎉 Заключение

Система обработчиков событий предоставляет простой и надежный способ управления событиями:

- **Простота** - минимальный API для максимальной функциональности
- **Надежность** - автоматическая очистка и предотвращение утечек
- **Производительность** - event delegation и оптимизированная обработка
- **Единообразие** - все компоненты используют одну систему