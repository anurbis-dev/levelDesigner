# ConsoleContextMenu - Контекстное меню консоли

## Описание

`ConsoleContextMenu` - это модульный компонент для управления контекстным меню консоли в Level Designer. Он предоставляет удобный интерфейс для взаимодействия с логами консоли и управления настройками логирования.

## Назначение

Блок решает следующие задачи:
- **Унификация интерфейса**: Единообразное контекстное меню для всех элементов консоли
- **Блокировка браузерного меню**: Предотвращение появления стандартного ПКМ меню браузера
- **Умное отображение команд**: Показ релевантных команд в зависимости от контекста
- **Управление логированием**: Возможность включения/отключения логирования
- **Копирование данных**: Копирование сообщений и временных меток

## Архитектура

### Основные компоненты

1. **ConsoleContextMenu.js** - Основной класс с логикой
2. **ConsoleContextMenu.css** - Стили для контекстного меню
3. **Интеграция в index.html** - Подключение и использование

### Структура класса

```javascript
class ConsoleContextMenu {
    constructor(consolePanel, consoleOutput, callbacks)
    setupContextMenu()
    extractLogData(target)
    showContextMenu(event, message, timestamp)
    createContextMenu(event, message, timestamp)
    addCopyOptions(menu, message, timestamp)
    addConsoleOptions(menu)
    createMenuItem(text, onClick)
    setupMenuClosing(menu)
    clearConsole()
    toggleLogging()
    copyToClipboard(text)
    getLoggingState()
    setLoggingState(enabled)
    destroy()
}
```

## Использование

### Базовое использование

```javascript
import { ConsoleContextMenu } from './src/ui/ConsoleContextMenu.js';

const consolePanel = document.getElementById('console-panel');
const consoleOutput = document.getElementById('console-output');

const contextMenu = new ConsoleContextMenu(consolePanel, consoleOutput, {
    onLoggingToggle: (enabled) => {
        console.log(`Logging ${enabled ? 'enabled' : 'disabled'}`);
    },
    onConsoleClear: () => {
        console.log('Console cleared');
    },
    onCopyToClipboard: (text) => {
        console.log(`Copied: ${text}`);
    }
});
```

### Расширенное использование

```javascript
// Получение состояния логирования
const isLoggingEnabled = contextMenu.getLoggingState();

// Установка состояния логирования
contextMenu.setLoggingState(false);

// Очистка консоли программно
contextMenu.clearConsole();

// Уничтожение компонента
contextMenu.destroy();
```

## API

### Конструктор

```javascript
new ConsoleContextMenu(consolePanel, consoleOutput, callbacks)
```

**Параметры:**
- `consolePanel` (HTMLElement) - Панель консоли
- `consoleOutput` (HTMLElement) - Контейнер для вывода логов
- `callbacks` (Object) - Объект с колбэками

**Колбэки:**
- `onLoggingToggle(enabled)` - Вызывается при переключении логирования
- `onConsoleClear()` - Вызывается при очистке консоли
- `onCopyToClipboard(text)` - Вызывается при копировании текста

### Методы

#### `getLoggingState()`
Возвращает текущее состояние логирования.

**Возвращает:** `boolean`

#### `setLoggingState(enabled)`
Устанавливает состояние логирования.

**Параметры:**
- `enabled` (boolean) - Включить/выключить логирование

#### `clearConsole()`
Очищает содержимое консоли.

#### `destroy()`
Уничтожает компонент и очищает обработчики событий.

## Стилизация

### CSS классы

- `.console-context-menu` - Контейнер меню
- `.console-context-menu-item` - Элемент меню

### Кастомизация

```css
.console-context-menu {
    background: #your-color;
    border: 1px solid #your-border-color;
    z-index: 10000; /* Высокий z-index для отображения поверх всех элементов */
}

.console-context-menu-item:hover {
    background: #your-hover-color;
}
```

## Особенности реализации

### Умное позиционирование

Система автоматически определяет оптимальную позицию меню на основе:
- Доступного пространства вокруг курсора
- Близости к краям окна
- Размеров консольной панели
- Размеров самого меню

```javascript
calculateOptimalPosition(event, menu) {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const menuSize = this.getMenuDimensions(menu);
    
    // Определение горизонтальной позиции
    if (spaceRight >= menuSize.width + margins.horizontal) {
        x = event.pageX; // Справа от курсора
    } else if (spaceLeft >= menuSize.width + margins.horizontal) {
        x = event.pageX - menuSize.width; // Слева от курсора
    } else {
        x = centerPosition; // По центру
    }
    
    // Аналогично для вертикальной позиции
    // ...
}
```

### Блокировка браузерного меню

```javascript
consolePanel.addEventListener('contextmenu', (e) => {
    e.preventDefault();    // Блокирует браузерное меню
    e.stopPropagation();  // Останавливает всплытие события
    // ... логика показа меню
});
```

### Умное извлечение данных

```javascript
extractLogData(target) {
    const logEntry = target.closest('.log-entry');
    if (logEntry) {
        const textContent = logEntry.textContent;
        const timestampMatch = textContent.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (timestampMatch) {
            return {
                timestamp: timestampMatch[1],
                message: timestampMatch[2]
            };
        }
    }
    return { message: '', timestamp: '' };
}
```

### Адаптивность

Меню автоматически адаптируется к содержимому:
- При клике на лог - показываются команды копирования
- При клике на пустое место - показываются только команды управления

## Интеграция в проект

### 1. Подключение файлов

```html
<link rel="stylesheet" href="src/ui/ConsoleContextMenu.css">
<script type="module">
    import { ConsoleContextMenu } from './src/ui/ConsoleContextMenu.js';
</script>
```

### 2. Инициализация

```javascript
// В функции setupConsole()
const consoleContextMenu = new ConsoleContextMenu(consolePanel, consoleOutput, {
    onLoggingToggle: (enabled) => {
        isLoggingEnabled = enabled;
        logToConsole(`Logging ${enabled ? 'enabled' : 'disabled'}`, 'info');
    },
    onConsoleClear: () => {
        logToConsole('Console cleared', 'info');
    },
    onCopyToClipboard: (text) => {
        logToConsole(`Copied to clipboard: ${text}`, 'info');
    }
});
```

### 3. Использование состояния

```javascript
// В функции logToConsole()
if (!consoleContextMenu.getLoggingState()) return;

// В переопределенных методах console
if (consoleContextMenu.getLoggingState()) {
    logToConsole(args.join(' '), 'log');
}
```

## Тестирование

### Ручное тестирование

1. **Открыть консоль** (клавиша `)
2. **ПКМ на пустом месте** - должны появиться команды "Clear console" и "Logging on/off"
3. **ПКМ на тексте лога** - должны появиться все команды включая копирование
4. **Проверить блокировку браузерного меню** - стандартное ПКМ меню не должно появляться

### Автоматическое тестирование

```javascript
// Тест инициализации
const contextMenu = new ConsoleContextMenu(panel, output, {});
assert(contextMenu.getLoggingState() === true);

// Тест переключения логирования
contextMenu.toggleLogging();
assert(contextMenu.getLoggingState() === false);

// Тест очистки консоли
contextMenu.clearConsole();
assert(output.innerHTML === '');
```

## Совместимость

- **Браузеры**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **ES модули**: Требуется поддержка ES6 модулей
- **Clipboard API**: Используется с fallback для старых браузеров

## Производительность

- **События**: Используются passive listeners где возможно
- **DOM**: Минимизированы операции с DOM через requestAnimationFrame
- **Память**: Автоматическая очистка обработчиков при уничтожении

## Безопасность

- **XSS защита**: Все пользовательские данные экранируются
- **Clipboard**: Используется безопасный Clipboard API
- **События**: Предотвращение всплытия и стандартного поведения

## Поддержка

При возникновении проблем:
1. Проверьте консоль браузера на ошибки
2. Убедитесь в корректности подключения файлов
3. Проверьте совместимость браузера
4. Обратитесь к документации API

## Новые возможности v1.1.0

### Умное позиционирование
- **Автоматическое определение стороны**: Меню появляется с той стороны, где больше места
- **Проверка близости к краям**: Учитывается расстояние до границ окна
- **Адаптивное центрирование**: При недостатке места меню центрируется
- **Ограничение консольной панелью**: Меню старается оставаться в пределах консоли

### Анимации и UX
- **Плавное появление**: Анимация scale и opacity
- **Направленные анимации**: Разные transform-origin в зависимости от позиции
- **Обработка изменения размера**: Автоматическое скрытие при resize
- **Мобильная оптимизация**: Увеличенные touch-цели для мобильных устройств

### Производительность
- **Точное измерение размеров**: Реальное измерение меню вместо оценок
- **Оптимизированные события**: Passive listeners где возможно
- **Правильная очистка**: Корректное удаление обработчиков при уничтожении

## Версионирование

- **v1.1.0** - Умное позиционирование и анимации
  - Умное позиционирование меню
  - Плавные анимации появления/исчезновения
  - Обработка изменения размера окна
  - Мобильная оптимизация
  - Улучшенная производительность

- **v1.0.0** - Первоначальная реализация
- **v2.0.0** - Utility Architecture рефакторинг
  - Базовое контекстное меню
  - Управление логированием
  - Копирование данных
  - Блокировка браузерного меню
