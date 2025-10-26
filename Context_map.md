# Context Map - Level Designer v3.52.5

## 📚 Документы для работы с проектом

### 🔧 Основные документы (обязательные для изучения)

1. **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - архитектура проекта, 13 менеджеров, модули
2. **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** - настройка, логирование, правила кода
3. **[QUICK_START.md](./docs/QUICK_START.md)** - быстрый запуск, операции, интерфейс
4. **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - API методы, примеры использования
5. **[COMPREHENSIVE_API_REFERENCE.md](./docs/COMPREHENSIVE_API_REFERENCE.md)** - полный список всех методов
6. **[TOUCH_SUPPORT.md](./docs/TOUCH_SUPPORT.md)** - тач-события, жесты, блокировка
7. **[MOBILE_INTERFACE_SYSTEM.md](./docs/MOBILE_INTERFACE_SYSTEM.md)** - мобильный интерфейс
8. **[EVENT_HANDLER_SYSTEM.md](./docs/EVENT_HANDLER_SYSTEM.md)** - обработчики событий

### 🏗️ Архитектура проекта

#### Основные компоненты:
- **LevelEditor** - главный класс редактора
- **13 менеджеров** - StateManager, ConfigManager, TouchSupportManager, и др.
- **event-system/** - система обработки событий (EventHandlerManager, AutoEventHandlerManager, UniversalWindowHandlers)
- **UI компоненты** - панели, диалоги, контекстные меню
- **Core модули** - операции с объектами, слоями, файлами

#### Ключевые API методы:
- **LevelEditor**: `init()`, `saveLevel()`, `createObject()`, `selectObject()`, `getCachedObject()`
- **StateManager**: `get()`, `set()`, `subscribe()`, `notify()`, `updateComponentStatus()`
- **ConfigManager**: `get()`, `set()`, `loadAllConfigs()`, `syncAllCanvasToGrid()`
- **TouchSupportManager**: `registerElement()`, `calculatePanelSize()`, `getUnifiedResizeMethods()`

### 📁 Панель Content
- Левая сторона Assets (можно переключить вправо)
- Древовидная структура папок из ./content
- Клик по папке → выбор и фильтрация табов

### 📦 Система ассетов
- Автоматическое сканирование ./content при старте
- Манифест: content/manifest.json
- Обновление: update_manifest.bat
- JSON файлы с полями name, type, imgSrc, width, height, color, properties

### 🎮 Тач-поддержка (v3.52.5)
- **TouchSupportManager** - центральный менеджер тач-событий
- **BrowserGesturePreventionManager** - блокировка браузерных жестов
- **TouchInitializationManager** - централизованная инициализация
- **Canvas pan/zoom** - жесты двумя пальцами
- **Унифицированные методы** - `calculatePanelSize()`, `getUnifiedResizeMethods()`

### 🔧 Практические примеры для агента

**📖 Подробные примеры:** См. [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#-практические-примеры-для-агента)

**⚠️ Частые ошибки:** См. [COMMON_MISTAKES.md](./docs/COMMON_MISTAKES.md)

### 📖 Дополнительные документы

- **[USER_MANUAL.md](./docs/USER_MANUAL.md)** - руководство пользователя
- **[UI_CONSTRUCTORS_GUIDE.md](./docs/UI_CONSTRUCTORS_GUIDE.md)** - создание UI компонентов
- **[VERSIONING_GUIDE.md](./docs/VERSIONING_GUIDE.md)** - версионирование
- **[CHANGELOG.md](./docs/CHANGELOG.md)** - история изменений
- **[COMMON_MISTAKES.md](./docs/COMMON_MISTAKES.md)** - частые ошибки
- **[README.md](./docs/README.md)** - обзор документации
- **[content/README.md](./content/README.md)** - структура ассетов

### 🎯 Приоритеты

1. **ARCHITECTURE.md** - структура проекта
2. **DEVELOPMENT_GUIDE.md** - правила работы
3. **API_REFERENCE.md** - использование API
4. **QUICK_START.md** - запуск и операции

### 🤖 Типичные задачи для агента

**📖 Подробные примеры:** См. [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#-практические-примеры-для-агента)

#### Быстрые примеры:
```javascript
// Создание объекта
const obj = levelEditor.createObject('player', 100, 200, { name: 'Player' });

// Управление состоянием
stateManager.set('selectedObject', obj);
const selected = stateManager.get('selectedObject');

// Работа с конфигурацией
configManager.set('grid.size', 32);
const gridSize = configManager.get('grid.size');

// Тач-поддержка
touchManager.registerElement(element, 'panelResizer', { direction: 'horizontal' });

// Обработка событий
eventManager.registerElement(button, 'button', { handlers: { click: this.onClick.bind(this) } });
```

#### Основные операции:
- **Создание объектов**: `levelEditor.createObject(type, x, y, properties)`
- **Управление состоянием**: `stateManager.get/set/subscribe()`
- **Работа с конфигурацией**: `configManager.get/set/loadAllConfigs()`
- **Тач-поддержка**: `touchManager.registerElement()`
- **Обработка событий**: `eventManager.registerElement()`

#### Ключевые принципы:
- Используйте централизованные системы (StateManager, ConfigManager, EventHandlerManager)
- Доверяйте архитектуре - не добавляйте избыточные проверки
- Всегда используйте Logger вместо console
- Наследуйтесь от BaseDialog для диалогов

### 🔗 Быстрая навигация

- **🚀 Запуск**: [QUICK_START.md](./docs/QUICK_START.md#-запуск-за-3-шага)
- **🏗️ Архитектура**: [ARCHITECTURE.md](./docs/ARCHITECTURE.md#-утилитарная-архитектура)
- **📖 API**: [API_REFERENCE.md](./docs/API_REFERENCE.md) | [COMPREHENSIVE_API_REFERENCE.md](./docs/COMPREHENSIVE_API_REFERENCE.md)
- **🤖 Примеры**: [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#-практические-примеры-для-агента)
- **⚠️ Ошибки**: [COMMON_MISTAKES.md](./docs/COMMON_MISTAKES.md)
- **📱 Тач**: [TOUCH_SUPPORT.md](./docs/TOUCH_SUPPORT.md)
- **📱 Мобильный**: [MOBILE_INTERFACE_SYSTEM.md](./docs/MOBILE_INTERFACE_SYSTEM.md)
- **⚡ События**: [EVENT_HANDLER_SYSTEM.md](./docs/EVENT_HANDLER_SYSTEM.md)
