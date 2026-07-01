# 2D Level Editor v3.54.5

Редактор уровней для 2D игр с модульной архитектурой.

## 🚀 Быстрый старт

**📖 Подробная инструкция:** [QUICK_START.md](./QUICK_START.md)

1. **Запуск**: `start_Editor.bat` или `python -m http.server 8000`
2. **Интерфейс**: Canvas (центр), панели (ассеты, детали, слои, структура)
3. **Создание**: Перетащите ассеты на canvas
4. **Сохранение**: `Ctrl+S`

## 🏗️ Архитектура

**📖 Подробное описание:** [ARCHITECTURE.md](./ARCHITECTURE.md)

### Основные компоненты
- **LevelEditor** - главный класс редактора
- **13 менеджеров** - управление состоянием и ресурсами
- **13 core операций** - модули с бизнес-логикой
- **UI компоненты** - панели, диалоги, контекстные меню

### Ключевые системы
- **StateManager** - управление состоянием с кешированием
- **HistoryManager** - Undo/Redo
- **EventHandlerManager** - события UI
- **GlobalEventRegistry** - глобальные события
- **CacheManager** - кэширование

## 📚 Документация

### Для разработчиков
1. **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** - настройка, примеры кода, правила
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - архитектура, менеджеры, модули
3. **[API_GUIDE.md](./API_GUIDE.md)** - API методы, примеры
4. **[COMMON_MISTAKES.md](./COMMON_MISTAKES.md)** - частые ошибки

### Специализированные
- **[EVENT_HANDLER_SYSTEM.md](./EVENT_HANDLER_SYSTEM.md)** - обработчики событий, тач-жесты
- **[UI_CONSTRUCTORS_GUIDE.md](./UI_CONSTRUCTORS_GUIDE.md)** - создание UI компонентов
- **[DIALOG_SYSTEM.md](./DIALOG_SYSTEM.md)** - система диалогов

### Для пользователей
- **[USER_MANUAL.md](./USER_MANUAL.md)** - руководство пользователя
- **[QUICK_START.md](./QUICK_START.md)** - быстрый старт

### Справочники
- Все методы объединены в [API_GUIDE.md](./API_GUIDE.md)
- **[VERSIONING_GUIDE.md](./VERSIONING_GUIDE.md)** - версионирование
- **[CHANGELOG.md](./CHANGELOG.md)** - история изменений

## 🤖 Для агентов

### Быстрые примеры
```javascript
// Создание объекта
const obj = levelEditor.createObject('player', 100, 200, { name: 'Player' });

// Управление состоянием
stateManager.set('selectedObject', obj);
const selected = stateManager.get('selectedObject');

// События
eventHandlerManager.registerElement(button, { click: onClick }, 'button-id');

```

### Ключевые API
- **LevelEditor**: `init()`, `createObject()`, `selectObject()`, `saveLevel()`
- **StateManager**: `get()`, `set()`, `subscribe()`
- **ConfigManager**: `get()`, `set()`, `loadAllConfigs()`
- **EventHandlerManager**: `registerElement()`

### Принципы
- Используйте централизованные системы
- Доверяйте архитектуре - не добавляйте избыточные проверки
- Используйте Logger вместо console
- Наследуйтесь от BaseDialog

## 📁 Структура проекта

```
src/
├── core/           # Основные модули (LevelEditor, операции)
├── managers/       # 13 менеджеров системы
├── event-system/   # Система обработки событий
├── ui/             # UI компоненты
├── utils/          # Утилиты
└── models/         # Модели данных

config/
├── defaults/       # Конфигурации по умолчанию
└── user/          # Пользовательские настройки

content/           # Ассеты игры
docs/              # Документация
```

## 🔗 Полезные ссылки

- **Context Map**: [Context_map.md](../Context_map.md) - краткий обзор
- **Структура ассетов**: [content/README.md](../content/README.md)

## 🎯 Ключевые возможности

- Создание объектов, редактирование свойств
- Система слоев, группировка, дублирование
- Undo/Redo, сохранение проектов
- Интерактивный зум, pan/zoom
- Тач-поддержка, мобильная адаптация
- Контекстные меню, горячие клавиши

**Статус**: Production Ready v3.54.5
