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

Централизованная система обработчиков событий (EventHandlerManager) предоставляет унифицированный способ управления всеми событиями UI элементов в редакторе уровней. Система автоматически обрабатывает регистрацию, очистку и управление обработчиками событий.

## 📋 Краткое резюме системы

### 🎯 Назначение обработчиков
1. **Прямое назначение**: `eventHandlerManager.registerElement(element, type, config)`
2. **Автоматическое назначение**: AutoEventHandlerManager обнаруживает новые окна через MutationObserver
3. **Универсальные обработчики**: UniversalWindowHandlers создает стандартные обработчики для всех типов окон

### 🧹 Очистка обработчиков
1. **Автоматическая очистка**: `eventHandlerManager.unregisterElement(element)` или `unregisterDialog(dialogId)`
2. **Полная очистка**: `eventHandlerManager.destroy()`
3. **Предотвращение утечек**: Все обработчики сохраняются в `cleanupFunctions` Map и автоматически удаляются

### 🔄 Жизненный цикл
```
Создание элемента → Регистрация обработчиков → Использование → Очистка → Удаление
```

### ⚠️ Критически важно
- **Порядок инициализации**: AutoEventHandlerManager ДО LevelEditor
- **Обязательная очистка**: Всегда вызывайте `unregisterElement()` перед удалением DOM
- **Привязка контекста**: Используйте `.bind(this)` для всех обработчиков

## 📝 Изменения в v3.51.10

### Упрощение архитектуры
- **Удален метод `registerWindowManually()`** - система полностью автоматическая
- **Упрощена очистка** - больше не нужны ручные вызовы `removeDialogEventHandling()`
- **Улучшена читаемость** - убраны лишние абстракции

### Принцип "один класс - одна ответственность"
- **AutoEventHandlerManager** - только обнаружение окон
- **EventHandlerManager** - только регистрация обработчиков
- **UniversalWindowHandlers** - только создание обработчиков

## 📝 Последние изменения

### Исправления контекстных меню
- **Исправлена ошибка "No context menu instance found for BaseContextMenu"** - улучшена логика обнаружения экземпляров контекстных меню
- **Исправлен класс для поиска** - изменен с `context-menu` на `base-context-menu` для корректного обнаружения
- **Улучшена обработка null экземпляров** - добавлена graceful обработка случаев без экземпляров
- **Оптимизирован код** - убрано дублирование логики, создан вспомогательный метод `checkAndRegisterContextMenu`
- **Убраны избыточные логи** - упрощено логирование для лучшей производительности

### Архитектурные улучшения
- **Унифицированная логика** - единый метод для проверки и регистрации контекстных меню
- **Улучшена читаемость** - код стал более лаконичным и понятным
- **Сохранена функциональность** - все исправления работают без потери функциональности

## 📝 Предыдущие изменения

### Исправления ошибок
- **Исправлена ошибка `className.includes is not a function`** - добавлена безопасная проверка типа className
- **Оптимизированы проверки элементов** - добавлены строгие проверки для предотвращения обработки неподходящих элементов
- **Улучшена обработка DOMTokenList** - className теперь всегда преобразуется в строку

### Поддержка панелей интерфейса
- **Добавлена поддержка панелей** - система теперь автоматически обнаруживает и регистрирует обработчики для панелей интерфейса
- **Новые типы окон** - добавлены типы `asset-panel` и `layers-panel` в список обнаруживаемых окон
- **Обработчики элементов панелей** - созданы специфичные обработчики для элементов интерфейса панелей:
  - Кнопки слоев (видимость, блокировка, цвет)
  - Поля ввода (имя слоя, параллакс)
  - Элементы списка слоев
  - Кнопки действий панели

### Оптимизация производительности
- **Улучшена фильтрация элементов** - MutationObserver теперь проверяет только подходящие элементы
- **Предотвращение дублирования** - добавлены проверки для избежания повторной обработки элементов
- **Строгие проверки типов** - добавлены проверки tagName и наличия идентификаторов

### Архитектурные улучшения
- **Раздельная логика для диалогов и панелей** - разные обработчики для разных типов интерфейса
- **Унифицированные обработчики элементов** - общие обработчики для типов элементов интерфейса
- **Автоматическая регистрация дочерних элементов** - панели автоматически регистрируют обработчики для своих дочерних элементов

### Исправления кода
- **Все комментарии на английском** - приведены в соответствие с правилами проекта
- **Корректная обработка переменных** - исправлены ссылки на переименованные переменные
- **Улучшена читаемость кода** - рефакторинг для лучшей организации логики

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Порядок инициализации

**Правильный порядок инициализации компонентов:**

1. **AutoEventHandlerManager** - должен быть инициализирован ПЕРВЫМ
2. **LevelEditor** - создается ПОСЛЕ инициализации AutoEventHandlerManager
3. **Окна и компоненты** - создаются в конструкторе LevelEditor
4. **Принудительная проверка** - все созданные окна проверяются после создания LevelEditor

### Почему это важно?

- **AutoEventHandlerManager** использует MutationObserver для отслеживания новых DOM элементов
- Если окна создаются до инициализации AutoEventHandlerManager, они не будут обнаружены
- Результат: обработчики событий не регистрируются, окна не реагируют на события

### Правильная последовательность в index.html:

```javascript
// ✅ ПРАВИЛЬНО - сначала AutoEventHandlerManager
window.autoEventHandlerManager = autoEventHandlerManager;
autoEventHandlerManager.init();

// ✅ ПРАВИЛЬНО - потом LevelEditor
const editor = new LevelEditor(userPrefs);
window.editor = editor;

// ✅ ПРАВИЛЬНО - принудительная проверка всех окон
const windows = document.querySelectorAll('[id*="overlay"], [id*="dialog"], [id*="window"]');
windows.forEach(window => {
    autoEventHandlerManager.checkForNewWindow(window);
});

// ✅ ПРАВИЛЬНО - регистрация отложенных окон после инициализации LevelEditor
if (autoEventHandlerManager && typeof autoEventHandlerManager.registerPendingWindows === 'function') {
    autoEventHandlerManager.registerPendingWindows();
}
```

### ❌ НЕПРАВИЛЬНО:

```javascript
// ❌ НЕПРАВИЛЬНО - LevelEditor создается до AutoEventHandlerManager
const editor = new LevelEditor(userPrefs); // Окна создаются здесь
autoEventHandlerManager.init(); // Слишком поздно!
```

## Основные компоненты

### EventHandlerManager
Центральный менеджер для управления всеми обработчиками событий. Поддерживает:
- Обычные обработчики для отдельных элементов
- Делегированные обработчики для контейнеров
- Автоматическую очистку при уничтожении элементов

**Основные методы:**
- `registerElement(element, type, config, dialogId)` - регистрация элемента с обработчиками
- `unregisterElement(element)` - удаление обработчиков элемента
- `unregisterDialog(dialogId)` - удаление всех обработчиков диалога
- `getElementConfig(element)` - получение конфигурации элемента
- `getDialogHandlers(dialogId)` - получение обработчиков диалога
- `isElementRegistered(element)` - проверка регистрации элемента
- `getAllRegisteredElements()` - получение всех зарегистрированных элементов
- `getAllRegisteredDialogs()` - получение всех зарегистрированных диалогов
- `destroy()` - уничтожение менеджера

### EventHandlerUtils
Утилиты для упрощения работы с EventHandlerManager.

### AutoEventHandlerManager
Автоматическая система регистрации обработчиков для всех окон. Автоматически обнаруживает новые окна и регистрирует для них обработчики без изменения кода.

**Основные методы:**
- `init()` - инициализация менеджера
- `checkForNewWindow(element)` - проверка нового элемента на наличие окон
- `detectWindowType(element)` - определение типа окна по ID и классам
- `registerPendingWindows()` - регистрация отложенных окон после инициализации LevelEditor
- `getRegisteredWindows()` - получение списка зарегистрированных окон

### UniversalWindowHandlers
Универсальные обработчики для всех типов окон. Автоматически определяют методы закрытия, применения и обработки событий. **Единый файл для всех компонентов** - больше не нужны отдельные файлы обработчиков для каждого элемента.

**Основные методы:**
- `createUniversalHandlers(windowInstance, windowType)` - создание универсальных обработчиков для окон
- `createContextMenuHandlers(contextMenuInstance, menuType)` - создание обработчиков для контекстных меню
- `createPanelHandlers(panelInstance, panelType)` - создание обработчиков для панелей
- `handleEscape(windowInstance, windowType)` - обработка нажатия ESC
- `handleOverlayClick(windowInstance, windowType)` - обработка клика по overlay
- `handleClick(e, windowInstance, windowType)` - обработка кликов внутри окна

## 🔧 Важные технические детали

### Регистрация обработчиков ESC

**Правильная регистрация глобальных обработчиков ESC:**

```javascript
// ✅ ПРАВИЛЬНО - ESC регистрируется как keydown с проверкой клавиши
globalHandlers: {
    keydown: (e) => {
        if (e.key === 'Escape') {
            handlers.onEscape();
        }
    }
}
```

**❌ НЕПРАВИЛЬНО:**

```javascript
// ❌ НЕПРАВИЛЬНО - ESC не может быть зарегистрирован как отдельное событие
globalHandlers: {
    escape: handlers.onEscape // Не работает!
}
```

### Маппинг обработчиков событий

**AutoEventHandlerManager правильно маппит обработчики для EventHandlerManager:**

```javascript
// UniversalWindowHandlers создает:
{
    onClick: handler,
    onContextMenu: handler,
    onEscape: handler
}

// AutoEventHandlerManager преобразует в:
{
    handlers: {
        click: handler,        // onClick → click
        contextmenu: handler   // onContextMenu → contextmenu
    },
    globalHandlers: {
        keydown: (e) => {      // onEscape → keydown с проверкой
            if (e.key === 'Escape') handler();
        }
    }
}
```

## 📋 Создание новых окон

### Требования для автоматической работы

**Для автоматической регистрации обработчиков окно должно:**

1. **Иметь правильный ID или класс:**
   ```html
   <div id="my-window-overlay" class="my-window-container">
   ```

2. **Быть зарегистрировано в AutoEventHandlerManager:**
   ```javascript
   // В src/event-system/AutoEventHandlerManager.js
   const windowTypes = [
       { id: 'my-window-overlay', class: 'my-window-container', type: 'my-window', instance: 'MyWindow' }
   ];
   ```

3. **Иметь экземпляр в window.editor:**
   ```javascript
   // В LevelEditor.js
   this.myWindow = new MyWindow(container, stateManager, this);
   ```

4. **Предоставлять универсальные методы:**
   ```javascript
   // В MyWindow.js
   cancel() { this.hide(); }  // Для закрытия
   apply() { this.save(); }   // Для применения (опционально)
   ```

### Создание DOM элементов

**✅ ПРАВИЛЬНО - создавать DOM при первом показе:**
```javascript
show() {
    let overlay = document.getElementById(this.overlayId);
    if (!overlay) {
        this.createWindowElement(); // Создаем только при первом показе
    }
    overlay.style.display = 'flex';
}
```

**❌ НЕПРАВИЛЬНО - создавать DOM в конструкторе:**
```javascript
constructor() {
    this.createWindowElement(); // Слишком рано!
}
```

## Быстрый старт

### 1. Импорт системы

```javascript
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { autoEventHandlerManager } from '../event-system/AutoEventHandlerManager.js'; // NEW
import { UniversalWindowHandlers } from '../event-system/UniversalWindowHandlers.js'; // NEW
```

### 2. Базовое использование

#### Для диалогов:
```javascript
// Создание обработчиков диалога
const dialogHandlers = EventHandlerUtils.createDialogHandlers(
    this,                    // контекст
    this.onCancel.bind(this), // обработчик отмены
    this.onApply.bind(this),  // обработчик применения
    this.onOverlayClick.bind(this) // обработчик клика по overlay
);

// Регистрация диалога
EventHandlerUtils.addDialogEventHandling(
    dialogElement,           // элемент диалога
    'my-dialog',            // ID диалога
    dialogHandlers,         // обработчики
    this,                   // контекст
    eventHandlerManager     // менеджер
);
```

#### Для панелей (автоматическая система):
```javascript
// ❌ СТАРЫЙ подход - ручная регистрация (устарело)
// const handlersConfig = SomeHandlers.createDelegatedHandlers(this);
// eventHandlerManager.registerElement(...);

// ✅ НОВЫЙ подход - автоматическая система
// Ничего не нужно делать! AutoEventHandlerManager автоматически обнаружит панель
// и зарегистрирует обработчики через специализированные обработчики элементов

// Просто создайте панель с правильным ID/классом:
// <div id="layers-content-panel" class="layers-panel-container">
// Обработчики добавятся автоматически!

// Поддерживаемые элементы панелей:
// - .layer-item - элементы слоев
// - .layer-visibility-btn - кнопки видимости
// - .layer-lock-btn - кнопки блокировки
// - .layer-color - цветовые индикаторы
// - #layers-search - поле поиска
// - #add-layer-btn - кнопка добавления слоя (Shift+Click для добавления 3 слоев)
// - [id^="layer-name-"] - поля редактирования имен слоев
// - .layer-parallax-input - поля параллакса
```

### 3. Автоматическая система (NEW)

```javascript
// Автоматическая регистрация - ничего не нужно делать!
// AutoEventHandlerManager автоматически обнаружит новые окна и зарегистрирует обработчики

// Проверка зарегистрированных окон
const registeredWindows = autoEventHandlerManager.getRegisteredWindows();
console.log('Registered windows:', registeredWindows);
```

## 🎯 Система назначения обработчиков

### Как работает назначение обработчиков

Система назначения работает через **централизованную регистрацию** - все обработчики регистрируются через EventHandlerManager, который управляет их жизненным циклом.

#### Процесс назначения:
```javascript
// 1. Создание элемента
const button = document.createElement('button');
button.id = 'my-button';

// 2. Регистрация обработчиков через EventHandlerManager
eventHandlerManager.registerElement(button, 'button', {
    handlers: {
        click: this.onClick.bind(this),
        mouseenter: this.onHover.bind(this),
        mouseleave: this.onLeave.bind(this)
    },
    context: this,
    dialogId: 'my-dialog' // опционально
});

// 3. EventHandlerManager автоматически:
// - Добавляет обработчики к элементу
// - Сохраняет cleanup functions
// - Регистрирует элемент в Map
```

#### Автоматическое назначение (AutoEventHandlerManager):
```javascript
// 1. Создание DOM элемента
const dialog = document.createElement('div');
dialog.id = 'settings-overlay';
dialog.className = 'settings-container';

// 2. Добавление в DOM
document.body.appendChild(dialog);

// 3. AutoEventHandlerManager автоматически:
// - Обнаруживает новый элемент через MutationObserver
// - Определяет тип окна по ID и классам
// - Создает универсальные обработчики
// - Регистрирует их в EventHandlerManager
```

### Типы назначения обработчиков

#### 1. Прямое назначение (для отдельных элементов):
```javascript
// Для кнопок, полей ввода, etc.
eventHandlerManager.registerElement(element, 'button', {
    handlers: {
        click: this.onClick.bind(this)
    },
    context: this
});
```

#### 2. Диалоговые обработчики (для окон):
```javascript
// Для диалогов с глобальными обработчиками
eventHandlerManager.registerElement(dialogElement, 'dialog', {
    handlers: {
        click: this.onDialogClick.bind(this)
    },
    globalHandlers: {
        keydown: this.onGlobalKeyDown.bind(this)
    },
    context: this,
    dialogId: 'settings-dialog'
});
```

#### 3. Автоматическое назначение (для панелей):
```javascript
// Для панелей интерфейса - автоматически через AutoEventHandlerManager
// Просто создайте элемент с правильным ID/классом:
const panel = document.createElement('div');
panel.id = 'layers-content-panel';
panel.className = 'layers-panel-container';

// Обработчики добавятся автоматически!
```

### Конфигурация обработчиков

#### Базовая конфигурация:
```javascript
const config = {
    handlers: {
        // Локальные обработчики элемента
        click: this.onClick.bind(this),
        mouseenter: this.onHover.bind(this),
        mouseleave: this.onLeave.bind(this)
    },
    globalHandlers: {
        // Глобальные обработчики (ESC, overlay click)
        keydown: this.onGlobalKeyDown.bind(this),
        click: this.onOverlayClick.bind(this)
    },
    context: this, // Контекст для вызова методов
    dialogId: 'my-dialog' // ID диалога для группировки
};
```

#### Расширенная конфигурация:
```javascript
const config = {
    handlers: {
        click: this.onClick.bind(this),
        keydown: this.onKeyDown.bind(this),
        contextmenu: this.onContextMenu.bind(this)
    },
    globalHandlers: {
        keydown: (e) => {
            if (e.key === 'Escape') {
                this.onEscape();
            }
        },
        click: (e) => {
            if (e.target === this.overlay) {
                this.onOverlayClick();
            }
        }
    },
    context: this,
    dialogId: 'settings-dialog',
    elementId: 'settings-button', // ID элемента для отладки
    type: 'dialog' // Тип элемента
};
```

### Универсальные обработчики (UniversalWindowHandlers)

#### Создание универсальных обработчиков:
```javascript
// Для диалогов
const dialogHandlers = UniversalWindowHandlers.createUniversalHandlers(
    dialogInstance, 'settings'
);

// Для контекстных меню
const contextMenuHandlers = UniversalWindowHandlers.createContextMenuHandlers(
    contextMenuInstance, 'asset-context-menu'
);

// Для панелей
const panelHandlers = UniversalWindowHandlers.createPanelHandlers(
    panelInstance, 'layers-panel'
);
```

#### Автоматическое определение методов:
```javascript
// UniversalWindowHandlers автоматически определяет:
// - Методы закрытия (close, hide, destroy)
// - Методы применения (apply, save, confirm)
// - Обработчики событий (onClick, onEscape, onOverlayClick)

// Если методы не найдены, используются стандартные:
// - close() -> hide()
// - apply() -> save()
// - onEscape() -> close()
```

### Отладка назначения обработчиков

#### Проверка зарегистрированных элементов:
```javascript
// Получить все зарегистрированные элементы
const elements = eventHandlerManager.getAllRegisteredElements();
console.log('Registered elements:', elements);

// Проверить конкретный элемент
const config = eventHandlerManager.getElementConfig(element);
console.log('Element config:', config);

// Проверить диалоговые обработчики
const dialogHandlers = eventHandlerManager.getDialogHandlers('settings-dialog');
console.log('Dialog handlers:', dialogHandlers);
```

#### Логирование назначения:
```javascript
// EventHandlerManager автоматически логирует назначение:
// "🎯 Element registered" - при регистрации элемента
// "🎯 Dialog registered" - при регистрации диалога
// "🎯 Global handlers registered" - при регистрации глобальных обработчиков

// AutoEventHandlerManager логирует:
// "🔄 AutoEventHandlerManager: Window detected" - при обнаружении окна
// "🔄 AutoEventHandlerManager: Window registered" - при регистрации окна
```

### Как работает автоматическая очистка

Система очистки работает через **cleanup functions** - функции, которые сохраняются при регистрации обработчиков и вызываются при их удалении.

#### Процесс регистрации:
```javascript
// При регистрации элемента
eventHandlerManager.registerElement(element, 'button', config);

// Внутри EventHandlerManager:
// 1. Добавляются обработчики событий
element.addEventListener('click', handler);

// 2. Сохраняются cleanup functions
cleanupFunctions.push(() => {
    element.removeEventListener('click', handler);
});

// 3. Cleanup functions сохраняются в Map
this.cleanupFunctions.set(element, cleanupFunctions);
```

#### Процесс очистки:
```javascript
// При удалении элемента
eventHandlerManager.unregisterElement(element);

// Внутри EventHandlerManager:
// 1. Получаются cleanup functions
const cleanupFunctions = this.cleanupFunctions.get(element);

// 2. Вызываются все cleanup functions
cleanupFunctions.forEach(cleanup => cleanup());

// 3. Удаляются из Map
this.cleanupFunctions.delete(element);
```

### Когда происходит очистка

#### ✅ Автоматическая очистка (рекомендуется):
```javascript
// 1. При закрытии диалога
dialogElement.style.display = 'none';
eventHandlerManager.unregisterElement(dialogElement);

// 2. При уничтожении компонента
component.destroy();
eventHandlerManager.unregisterElement(component.element);

// 3. При полной очистке
eventHandlerManager.destroy();
```

#### ❌ Проблемы при неправильной очистке:
```javascript
// ❌ НЕПРАВИЛЬНО - удаление DOM элемента без очистки обработчиков
element.remove(); // Обработчики остаются в памяти!

// ❌ НЕПРАВИЛЬНО - прямая очистка без EventHandlerManager
element.removeEventListener('click', handler); // Частичная очистка
```

### Ручная очистка обработчиков

#### Для отдельных элементов:
```javascript
// Удаление обработчиков конкретного элемента
eventHandlerManager.unregisterElement(buttonElement);

// Проверка регистрации
if (eventHandlerManager.isElementRegistered(element)) {
    eventHandlerManager.unregisterElement(element);
}
```

#### Для диалогов:
```javascript
// Удаление всех обработчиков диалога
eventHandlerManager.unregisterDialog('settings-dialog');

// Это удалит:
// - Обработчики самого диалога
// - Глобальные обработчики (ESC, overlay click)
// - Все дочерние элементы диалога
```

#### Полная очистка:
```javascript
// Уничтожение всего EventHandlerManager
eventHandlerManager.destroy();

// Это удалит:
// - Все зарегистрированные элементы
// - Все глобальные обработчики
// - Все диалоговые обработчики
// - Все cleanup functions
```

### Предотвращение утечек памяти

#### ✅ Правильный паттерн:
```javascript
class MyDialog {
    constructor() {
        this.element = document.createElement('div');
        this.element.id = 'my-dialog';
        
        // Регистрация обработчиков
        eventHandlerManager.registerElement(this.element, 'dialog', {
            handlers: {
                click: this.onClick.bind(this),
                keydown: this.onKeyDown.bind(this)
            },
            context: this
        });
    }
    
    destroy() {
        // ✅ ПРАВИЛЬНО - очистка перед удалением DOM
        eventHandlerManager.unregisterElement(this.element);
        this.element.remove();
    }
}
```

#### ❌ Неправильный паттерн:
```javascript
class MyDialog {
    constructor() {
        this.element = document.createElement('div');
        
        // Прямая регистрация обработчиков
        this.element.addEventListener('click', this.onClick.bind(this));
    }
    
    destroy() {
        // ❌ НЕПРАВИЛЬНО - удаление DOM без очистки обработчиков
        this.element.remove(); // Утечка памяти!
    }
}
```

### Отладка системы очистки

#### Проверка зарегистрированных элементов:
```javascript
// Получить все зарегистрированные элементы
const registeredElements = eventHandlerManager.getAllRegisteredElements();
console.log('Registered elements:', registeredElements);

// Проверить конкретный элемент
const isRegistered = eventHandlerManager.isElementRegistered(element);
console.log('Element registered:', isRegistered);
```

#### Логирование очистки:
```javascript
// EventHandlerManager автоматически логирует очистку
// В консоли будут сообщения:
// "🎯 Element unregistered" - при удалении элемента
// "🎯 Dialog unregistered" - при удалении диалога
// "🎯 EventHandlerManager destroyed" - при полной очистке
```

## Детальное руководство

### Типы элементов

#### Dialog (Диалог)
Для диалоговых окон с полным набором обработчиков.

```javascript
const dialogHandlers = {
    onEscape: this.onCancel.bind(this),           // ESC клавиша
    onOverlayClick: this.onCancel.bind(this),     // клик по overlay
    onClick: (e) => {                            // клики внутри диалога
        if (e.target.id === 'cancel-btn') {
            this.onCancel();
        } else if (e.target.id === 'apply-btn') {
            this.onApply();
        }
    },
    onContextMenu: (e) => {                       // контекстное меню
        e.preventDefault();
        e.stopPropagation();
    }
};

EventHandlerUtils.addDialogEventHandling(
    dialogElement,
    'settings-dialog',
    dialogHandlers,
    this,
    eventHandlerManager
);
```

#### Button (Кнопка)
Для кнопок с обработчиками кликов и hover эффектов.

```javascript
const buttonHandlers = EventHandlerUtils.createButtonHandlers(
    this,
    this.onButtonClick.bind(this),      // клик
    this.onButtonHover.bind(this),      // hover
    this.onButtonLeave.bind(this)       // leave
);

EventHandlerUtils.addButtonEventHandling(
    buttonElement,
    buttonHandlers,
    this,
    eventHandlerManager
);
```

#### Input (Поле ввода)
Для полей ввода с обработчиками фокуса, клавиатуры и изменений.

```javascript
const inputHandlers = EventHandlerUtils.createInputHandlers(
    this,
    this.onInputChange.bind(this),      // изменение значения
    this.onInputFocus.bind(this),       // фокус
    this.onInputBlur.bind(this),        // потеря фокуса
    this.onInputKeyDown.bind(this)      // нажатие клавиш
);

EventHandlerUtils.addInputEventHandling(
    inputElement,
    inputHandlers,
    this,
    eventHandlerManager
);
```

#### Form (Форма)
Для форм с обработчиками отправки и сброса.

```javascript
const formHandlers = {
    onSubmit: this.onFormSubmit.bind(this),
    onReset: this.onFormReset.bind(this),
    onChange: this.onFormChange.bind(this)
};

EventHandlerUtils.addFormEventHandling(
    formElement,
    formHandlers,
    this,
    eventHandlerManager
);
```

#### ContextMenu (Контекстное меню)
Для контекстных меню с обработчиками кликов и hover эффектов.

```javascript
const menuHandlers = {
    onClick: this.onMenuItemClick.bind(this),
    onContextMenu: this.onMenuContext.bind(this),
    onMouseEnter: this.onMenuItemHover.bind(this),
    onMouseLeave: this.onMenuItemLeave.bind(this)
};

EventHandlerUtils.addContextMenuEventHandling(
    menuElement,
    menuHandlers,
    this,
    eventHandlerManager
);
```

## Продвинутое использование

### Прямая работа с EventHandlerManager

```javascript
// Прямая регистрация элемента
eventHandlerManager.registerElement(
    element,                    // DOM элемент
    'button',                   // тип элемента
    {                           // конфигурация
        handlers: {
            click: this.onClick.bind(this),
            mouseenter: this.onHover.bind(this)
        },
        context: this
    },
    'my-dialog'                 // ID диалога (опционально)
);

// Получение конфигурации элемента
const config = eventHandlerManager.getElementConfig(element);

// Проверка регистрации
const isRegistered = eventHandlerManager.isElementRegistered(element);

// Получение всех зарегистрированных элементов
const allElements = eventHandlerManager.getAllRegisteredElements();
```

#### Panel (Панель)
Для панелей интерфейса с автоматической регистрацией обработчиков для дочерних элементов.

```javascript
// Панели автоматически обнаруживаются и регистрируют обработчики для своих элементов
// Поддерживаемые элементы панелей:

const panelElements = {
    // Элементы слоев
    '.layer-item': 'layerItemClick',
    '.layer-visibility-btn': 'layerButtonClick',
    '.layer-lock-btn': 'layerButtonClick',
    '.layer-color': 'layerColorClick',

    // Поля ввода
    '#layers-search': 'searchInput',
    '[id^="layer-name-"]': 'layerNameInput',
    '.layer-parallax-input': 'parallaxInput',

    // Кнопки действий
    '#add-layer-btn': 'addButtonClick'
};

// Обработчики создаются автоматически системой
// Нет необходимости в ручной регистрации
```

### Обработка ошибок

```javascript
try {
    EventHandlerUtils.addDialogEventHandling(
        dialogElement,
        'my-dialog',
        handlers,
        this,
        eventHandlerManager
    );
} catch (error) {
    Logger.ui.error('Failed to setup dialog handlers:', error);
}
```

### Условная регистрация

```javascript
// Регистрация только если элемент существует
if (dialogElement && dialogElement.id) {
    EventHandlerUtils.addDialogEventHandling(
        dialogElement,
        dialogElement.id,
        handlers,
        this,
        eventHandlerManager
    );
}
```

## Упрощенная архитектура (NEW)

### Принцип работы
**Универсальная система** - один файл `UniversalWindowHandlers.js` обрабатывает все типы компонентов автоматически. Больше не нужны отдельные файлы обработчиков для каждого элемента.

### Преимущества упрощения:
- **Меньше файлов** - один UniversalWindowHandlers вместо множества
- **Автоматическая работа** - новые компоненты работают без кода
- **Единая логика** - все обработчики в одном месте
- **Легче поддерживать** - изменения в одном файле
- **Меньше ошибок** - нет дублирования кода

### Новая упрощенная структура

```javascript
// ❌ СТАРЫЙ подход - много файлов
SomeHandlers.js
ToolbarHandlers.js  
SettingsHandlers.js
// ... и так далее для каждого компонента

// ✅ НОВЫЙ подход - один универсальный файл
UniversalWindowHandlers.js  // обрабатывает ВСЕ компоненты автоматически
```

### Автоматическое использование

```javascript
// В AssetPanel.js - НИЧЕГО НЕ НУЖНО ДЕЛАТЬ!
class AssetPanel {
    setupCentralizedEventHandlers() {
        // AssetPanel будет автоматически обнаружен и обработан
        // AutoEventHandlerManager + UniversalWindowHandlers сделают всё сами
        Logger.ui.debug('AssetPanel: Will be handled automatically');
    }
}

// Просто создайте DOM элемент с правильным ID:
// <div id="asset-panel-container" class="asset-panel-container">
// Обработчики добавятся автоматически!
```

### Преимущества упрощенной системы

1. **Производительность**: Один обработчик на контейнер вместо множества на каждый элемент
2. **Динамичность**: Автоматическая работа с динамически добавляемыми элементами
3. **Память**: Меньше потребление памяти за счет меньшего количества обработчиков
4. **Простота**: Легче управлять обработчиками для больших списков элементов
5. **Универсальность**: Один файл обрабатывает все типы компонентов
6. **Автоматизация**: Новые компоненты работают без дополнительного кода

## Лучшие практики

### 1. Используйте автоматическую систему
- **НЕ создавайте отдельные файлы** обработчиков для каждого компонента
- **Используйте UniversalWindowHandlers** для всех типов окон
- **Полагайтесь на AutoEventHandlerManager** для автоматической регистрации

```javascript
// ✅ Правильно - автоматическая система
// Ничего не нужно делать! Просто создайте DOM элемент:
// <div id="asset-panel-container" class="asset-panel-container">
// AutoEventHandlerManager автоматически обнаружит и зарегистрирует обработчики

// ❌ Неправильно - ручная регистрация (устарело)
// export class SomeHandlers { ... }
// eventHandlerManager.registerElement(...);
```

### 2. Всегда используйте привязку контекста

```javascript
// ✅ Правильно
const handlers = {
    onClick: this.onClick.bind(this)
};

// ❌ Неправильно
const handlers = {
    onClick: this.onClick  // потеря контекста
};
```

### 2. Автоматическая очистка

```javascript
// Система автоматически очищает обработчики при закрытии окон
// Никаких дополнительных действий не требуется!
```

### 3. Используйте стандартные шаблоны

```javascript
// ✅ Используйте готовые шаблоны
const handlers = EventHandlerUtils.createDialogHandlers(
    this, onCancel, onApply, onOverlayClick
);

// ❌ Не создавайте обработчики с нуля
const handlers = {
    onEscape: this.onCancel.bind(this),
    onOverlayClick: this.onCancel.bind(this),
    onClick: (e) => { /* много кода */ }
};
```

### 4. Группируйте связанные обработчики

```javascript
// ✅ Группировка по функциональности
const dialogHandlers = EventHandlerUtils.createDialogHandlers(
    this, this.onCancel, this.onApply, this.onOverlayClick
);

const inputHandlers = EventHandlerUtils.createInputHandlers(
    this, this.onChange, this.onFocus, this.onBlur, this.onKeyDown
);
```

### 5. Используйте осмысленные ID диалогов

```javascript
// ✅ Понятные ID
EventHandlerUtils.addDialogEventHandling(
    element, 'settings-dialog', handlers, this, eventHandlerManager
);

// ❌ Непонятные ID
EventHandlerUtils.addDialogEventHandling(
    element, 'dialog1', handlers, this, eventHandlerManager
);
```

## Интеграция с существующими компонентами

### BaseContextMenu (автоматическая система)

```javascript
// ✅ НОВЫЙ подход - автоматическая система
// В BaseContextMenu.js - автоматическая интеграция с AutoEventHandlerManager
class BaseContextMenu {
    setupNewEventHandlers() {
        // Добавляем класс для автоматического обнаружения
        this.currentMenu.classList.add('base-context-menu');
        
        // Сохраняем экземпляр на элементе для AutoEventHandlerManager
        this.currentMenu._contextMenuInstance = this;
        
        // AutoEventHandlerManager автоматически обнаружит контекстное меню
        // и зарегистрирует обработчики через UniversalWindowHandlers
        // Никакого дополнительного кода не требуется!
    }
}

// Просто создайте контекстное меню с правильным классом:
// <div class="base-context-menu" id="my-context-menu">
// Обработчики добавятся автоматически!
```

### AssetPanel (автоматическая система)

```javascript
// ✅ НОВЫЙ подход - автоматическая система
// В AssetPanel.js - НИЧЕГО НЕ НУЖНО ДЕЛАТЬ!
class AssetPanel {
    init() {
        // AssetPanel будет автоматически обнаружен AutoEventHandlerManager
        // и обработан UniversalWindowHandlers
        // Никакого дополнительного кода не требуется!
    }
}

// Просто создайте DOM элемент с правильным ID:
// <div id="asset-panel-container" class="asset-panel-container">
// Обработчики добавятся автоматически!
```

### SettingsPanel

```javascript
// В методе show()
setupNewEventHandlers() {
    const dialogHandlers = {
        onEscape: this.cancelSettings.bind(this),
        onOverlayClick: this.cancelSettings.bind(this),
        onClick: (e) => {
            // Обработка всех кликов внутри диалога
            if (e.target.id === 'cancel-settings') {
                this.cancelSettings();
            } else if (e.target.id === 'save-settings') {
                this.saveSettings();
            }
            // ... другие обработчики
        }
    };

    EventHandlerUtils.addDialogEventHandling(
        overlay,
        'settings-overlay',
        dialogHandlers,
        this,
        eventHandlerManager
    );
}

// В методе hide()
hide() {
    // Система автоматически очищает обработчики
    overlay.style.display = 'none';
}
```

### ActorPropertiesWindow

```javascript
// Аналогично SettingsPanel
setupNewEventHandlers() {
    const dialogHandlers = EventHandlerUtils.createDialogHandlers(
        this,
        this.cancel.bind(this),
        this.apply.bind(this),
        this.cancel.bind(this)
    );

    EventHandlerUtils.addDialogEventHandling(
        overlay,
        'actor-properties-overlay',
        dialogHandlers,
        this,
        eventHandlerManager
    );
}
```

### UniversalDialog

```javascript
// В методе show()
show() {
    const dialogHandlers = {
        onEscape: this.close.bind(this),
        onOverlayClick: this.close.bind(this),
        onClick: (e) => {
            if (e.target.classList.contains('dialog-btn')) {
                const buttonType = e.target.dataset.type;
                if (buttonType === 'primary') {
                    this.resolve(true);
                } else {
                    this.resolve(false);
                }
            }
        }
    };

    EventHandlerUtils.addDialogEventHandling(
        overlay,
        'universal-dialog-overlay',
        dialogHandlers,
        this,
        eventHandlerManager
    );
}
```

## 🐛 Отладка и диагностика

### Проверка инициализации

**Проверка правильности инициализации в консоли браузера:**

```javascript
// Проверка доступности AutoEventHandlerManager
console.log('AutoEventHandlerManager:', window.autoEventHandlerManager);

// Проверка инициализации
console.log('Initialized:', window.autoEventHandlerManager?.initialized);

// Проверка зарегистрированных окон
console.log('Registered windows:', window.autoEventHandlerManager?.getRegisteredWindows());
```

### Проверка регистрации элементов

```javascript
// Проверка всех зарегистрированных элементов
const allElements = eventHandlerManager.getAllRegisteredElements();
console.log('Registered elements:', allElements);

// Проверка конкретного элемента
const isRegistered = eventHandlerManager.isElementRegistered(element);
console.log('Element registered:', isRegistered);

// Получение конфигурации элемента
const config = eventHandlerManager.getElementConfig(element);
console.log('Element config:', config);
```

### Логирование событий

```javascript
// В EventHandlerManager добавлено автоматическое логирование
// Все события логируются с категорией 'ui'
Logger.ui.debug('Event handler registered', { elementId, type, dialogId });
```

### Типичные проблемы и решения

**Проблема: "AutoEventHandlerManager not found"**
- **Причина**: Окно создается до инициализации AutoEventHandlerManager
- **Решение**: Создавать DOM элементы при первом показе, а не в конструкторе

**Проблема: "ESC не работает"**
- **Причина**: Неправильная регистрация обработчика ESC
- **Решение**: ESC должен регистрироваться как `keydown` с проверкой клавиши

**Проблема: "Кнопки не реагируют"**
- **Причина**: Неправильный маппинг обработчиков событий
- **Решение**: Проверить, что AutoEventHandlerManager правильно преобразует `onClick` → `click`

**Проблема: "Окно не обнаруживается"**
- **Причина**: Неправильный ID/класс или отсутствие в windowTypes
- **Решение**: Добавить окно в массив windowTypes в AutoEventHandlerManager

## Миграция со старой системы

### До (старая система)

```javascript
// ❌ Старый подход - обработчики в компоненте
class AssetPanel {
    setupEventListeners() {
        // Множество отдельных обработчиков
        this.container.addEventListener('click', this.handleClick.bind(this));
        this.container.addEventListener('mouseenter', this.handleHover.bind(this));
        this.container.addEventListener('change', this.handleChange.bind(this));
        // ... много кода для каждого элемента
    }
    
    handleClick(e) {
        // Логика обработки в компоненте
        if (e.target.id === 'button1') {
            this.doSomething();
        }
    }
}
```

### После (новая система)

```javascript
// ✅ Новый подход - автоматическая система
// В AssetPanel.js - НИЧЕГО НЕ НУЖНО ДЕЛАТЬ!
class AssetPanel {
    init() {
        // AssetPanel будет автоматически обнаружен AutoEventHandlerManager
        // и обработан UniversalWindowHandlers
        // Никакого дополнительного кода не требуется!
    }
}

// Просто создайте DOM элемент с правильным ID:
// <div id="asset-panel-container" class="asset-panel-container">
// Обработчики добавятся автоматически!
```

### Преимущества новой системы

1. **Централизация**: Все обработчики в одном месте
2. **Делегирование**: Один обработчик вместо множества
3. **Изоляция**: Логика обработки отделена от бизнес-логики
4. **Переиспользование**: Обработчики можно использовать в разных компонентах
5. **Автоматическая очистка**: Система сама удаляет обработчики

## Автоматическая система обработчиков (NEW)

### Принцип работы
AutoEventHandlerManager автоматически обнаруживает новые окна в DOM и регистрирует для них обработчики без изменения кода.

### Как это работает
1. **MutationObserver** отслеживает изменения в DOM
2. **Автоматическое обнаружение** окон по ID и классам
3. **Универсальные обработчики** для всех типов окон
4. **Автоматическая регистрация** в EventHandlerManager

### Поддерживаемые типы окон и панелей
- `settings` - окна настроек (ID: `settings-overlay`, класс: `settings-container`)
- `actor-properties` - окна свойств актеров (ID: `actor-properties-overlay`, класс: `actor-properties-container`)
- `universal-dialog` - универсальные диалоги (ID: `universal-dialog-overlay`, класс: `universal-dialog-container`)
- `asset-panel` - панель ассетов (ID: `asset-panel-container`, класс: `asset-panel-container`)
- `layers-panel` - панель слоев (ID: `layers-content-panel`, класс: `layers-panel-container`)
- Любые новые окна и панели с соответствующими ID/классами

### Поддерживаемые типы контекстных меню
- `base-context-menu` - базовые контекстные меню (основной класс)
- `canvas-context-menu` - контекстные меню канваса
- `asset-context-menu` - контекстные меню ассетов
- `asset-panel-context-menu` - контекстные меню панели ассетов
- `console-context-menu` - контекстные меню консоли
- `layers-context-menu` - контекстные меню слоев
- `outliner-context-menu` - контекстные меню аутлайнера

### Преимущества автоматической системы
- **Нулевая настройка** - новые окна, панели и контекстные меню автоматически получают обработчики
- **Универсальность** - работает с любыми типами окон, панелей и контекстных меню
- **Отказоустойчивость** - система работает даже если методы не найдены
- **Производительность** - один Observer для всех окон, панелей и контекстных меню
- **Автоматическая регистрация элементов** - дочерние элементы панелей и контекстных меню регистрируются автоматически
- **Простота** - не нужно помнить о регистрации обработчиков
- **Централизованное управление** - все обработчики управляются через единую систему

### Пример использования

#### Для диалогов:
```javascript
// Создание нового окна - обработчики добавятся автоматически!
const newDialog = document.createElement('div');
newDialog.id = 'my-custom-dialog';
newDialog.className = 'custom-dialog-container';
document.body.appendChild(newDialog);

// AutoEventHandlerManager автоматически обнаружит и зарегистрирует обработчики
// Никакого дополнительного кода не требуется!
```

#### Для панелей:
```javascript
// Создание новой панели - обработчики добавятся автоматически!
const newPanel = document.createElement('div');
newPanel.id = 'my-custom-panel';
newPanel.className = 'custom-panel-container';
document.body.appendChild(newPanel);

// Добавляем элементы панели
const layerItem = document.createElement('div');
layerItem.className = 'layer-item';
layerItem.dataset.layerId = 'layer-1';
newPanel.appendChild(layerItem);

// AutoEventHandlerManager автоматически обнаружит панель и зарегистрирует
// обработчики для всех её элементов (кнопок, полей ввода, элементов списка)
```

#### Для контекстных меню:
```javascript
// Создание нового контекстного меню - обработчики добавятся автоматически!
const newContextMenu = document.createElement('div');
newContextMenu.className = 'base-context-menu'; // Основной класс для обнаружения
newContextMenu.id = 'my-custom-context-menu';

// Добавляем элементы меню
const menuItem = document.createElement('div');
menuItem.className = 'base-context-menu-item';
menuItem.textContent = 'Custom Action';
newContextMenu.appendChild(menuItem);

document.body.appendChild(newContextMenu);

// AutoEventHandlerManager автоматически обнаружит контекстное меню и зарегистрирует
// обработчики для всех его элементов (клики, hover эффекты, закрытие)
```

### После (новая система)

```javascript
// Один метод для всех обработчиков
setupNewEventHandlers() {
    const handlers = EventHandlerUtils.createDialogHandlers(
        this, this.onCancel, this.onApply, this.onOverlayClick
    );
    
    EventHandlerUtils.addDialogEventHandling(
        overlay, 'my-dialog', handlers, this, eventHandlerManager
    );
}

// Автоматическая очистка
hide() {
    // Система автоматически очищает обработчики
    overlay.style.display = 'none';
}
```

## Заключение

Новая система обработчиков событий предоставляет:

- ✅ **Централизованное управление** - все обработчики в одном месте
- ✅ **Автоматическую очистку** - предотвращение утечек памяти
- ✅ **Упрощенный API** - готовые шаблоны для типовых случаев
- ✅ **Безопасность** - обработка ошибок и проверки существования
- ✅ **Отладку** - логирование и методы для проверки состояния
- ✅ **Автоматическое обнаружение** - новые окна работают без дополнительного кода

### Ключевые принципы для успешного использования:

1. **Соблюдайте порядок инициализации** - AutoEventHandlerManager должен быть инициализирован первым
2. **Создавайте DOM при показе** - не в конструкторе, а при первом вызове show()
3. **Предоставляйте универсальные методы** - cancel() и apply() для совместимости
4. **Используйте правильные ID/классы** - для автоматического обнаружения
5. **Проверяйте логи** - система предоставляет подробную отладочную информацию

Используйте эту систему для всех новых компонентов и постепенно мигрируйте существующие компоненты для улучшения архитектуры и надежности кода.
