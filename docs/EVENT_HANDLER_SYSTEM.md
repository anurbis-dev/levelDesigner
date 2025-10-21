# Руководство по системе обработчиков событий v3.51.10

## Обзор

Централизованная система обработчиков событий (EventHandlerManager) предоставляет унифицированный способ управления всеми событиями UI элементов в редакторе уровней. Система автоматически обрабатывает регистрацию, очистку и управление обработчиками событий.

**Ключевые принципы:**
- **Централизация**: Все обработчики событий управляются через EventHandlerManager
- **Делегирование**: Использование event delegation для эффективности
- **Изоляция**: Обработчики вынесены в отдельные классы, панели содержат только бизнес-логику
- **Автоматическая очистка**: Система автоматически удаляет обработчики при уничтожении элементов

## 📝 Изменения в v3.51.10

### Упрощение архитектуры
- **Удален метод `registerWindowManually()`** - система полностью автоматическая
- **Упрощена очистка** - больше не нужны ручные вызовы `removeDialogEventHandling()`
- **Улучшена читаемость** - убраны лишние абстракции

### Принцип "один класс - одна ответственность"
- **AutoEventHandlerManager** - только обнаружение окон
- **EventHandlerManager** - только регистрация обработчиков  
- **UniversalWindowHandlers** - только создание обработчиков

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

### EventHandlerUtils
Утилиты для упрощения работы с EventHandlerManager.

### AutoEventHandlerManager
Автоматическая система регистрации обработчиков для всех окон. Автоматически обнаруживает новые окна и регистрирует для них обработчики без изменения кода.

### UniversalWindowHandlers
Универсальные обработчики для всех типов окон. Автоматически определяют методы закрытия, применения и обработки событий. **Единый файл для всех компонентов** - больше не нужны отдельные файлы обработчиков для каждого элемента.

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
   // В src/managers/AutoEventHandlerManager.js
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
import { eventHandlerManager } from '../managers/EventHandlerManager.js';
import { EventHandlerUtils } from '../utils/EventHandlerUtils.js';
import { autoEventHandlerManager } from '../managers/AutoEventHandlerManager.js'; // NEW
import { UniversalWindowHandlers } from '../handlers/UniversalWindowHandlers.js'; // NEW
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
// и зарегистрирует обработчики через UniversalWindowHandlers

// Просто создайте панель с правильным ID/классом:
// <div id="asset-panel-container" class="asset-panel-container">
// Обработчики добавятся автоматически!
```

### 3. Автоматическая система (NEW)

```javascript
// Автоматическая регистрация - ничего не нужно делать!
// AutoEventHandlerManager автоматически обнаружит новые окна и зарегистрирует обработчики

// Проверка зарегистрированных окон
const registeredWindows = autoEventHandlerManager.getRegisteredWindows();
console.log('Registered windows:', registeredWindows);
```

### 4. Очистка обработчиков

```javascript
// Автоматическая очистка - система сама удаляет обработчики при закрытии окон
// Никаких дополнительных действий не требуется!
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

### Поддерживаемые типы окон
- `settings` - окна настроек
- `actor-properties` - окна свойств актеров  
- `universal-dialog` - универсальные диалоги
- Любые новые окна с соответствующими ID/классами

### Преимущества автоматической системы
- **Нулевая настройка** - новые окна автоматически получают обработчики
- **Универсальность** - работает с любыми типами окон
- **Отказоустойчивость** - система работает даже если методы не найдены
- **Производительность** - один Observer для всех окон
- **Простота** - не нужно помнить о регистрации обработчиков

### Пример использования
```javascript
// Создание нового окна - обработчики добавятся автоматически!
const newDialog = document.createElement('div');
newDialog.id = 'my-custom-dialog';
newDialog.className = 'custom-dialog-container';
document.body.appendChild(newDialog);

// AutoEventHandlerManager автоматически обнаружит и зарегистрирует обработчики
// Никакого дополнительного кода не требуется!
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
