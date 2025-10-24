# Event System

Централизованная система обработчиков событий для Level Editor.

## Структура

### Менеджеры событий
- **AutoEventHandlerManager.js** - автоматическое обнаружение и регистрация обработчиков для всех окон
- **EventHandlerManager.js** - центральный менеджер для управления всеми обработчиками событий

### Обработчики событий
- **EventHandlers.js** - основные обработчики событий редактора
- **MouseHandlers.js** - обработчики мыши для канваса и панелей
- **UniversalWindowHandlers.js** - универсальные обработчики для всех типов окон

### Утилиты
- **EventHandlerUtils.js** - утилиты для упрощения работы с EventHandlerManager

## Принципы

- **Централизация**: Все обработчики событий управляются через EventHandlerManager
- **Делегирование**: Использование event delegation для эффективности
- **Изоляция**: Обработчики вынесены в отдельные классы
- **Автоматическая очистка**: Система автоматически удаляет обработчики при уничтожении элементов

## Использование

```javascript
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { autoEventHandlerManager } from '../event-system/AutoEventHandlerManager.js';
```

## Документация

Подробная документация доступна в `docs/EVENT_HANDLER_SYSTEM.md`.
