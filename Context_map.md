# Context Map - Level Designer v3.54.0

## ⚠️ КРИТИЧЕСКИ ВАЖНО - ЧИТАТЬ ПЕРВЫМ

**ПЕРЕД ДОБАВЛЕНИЕМ КОДА:**
1. **Прочитай документацию** - [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md), [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [API_GUIDE.md](./docs/API_GUIDE.md)
2. **Проверь готовые решения** - используй BaseDialog, UIFactory, Logger
3. **Не дублируй код** - следуй архитектуре

**Всегда:** ✅ Logger, stateManager, eventHandlerManager, BaseDialog  
**Никогда:** ❌ console.log, if (!stateManager), прямые addEventListener

## 🎯 Быстрый старт для агента

### Основные компоненты
- **LevelEditor** - главный класс, координатор всех систем
- **11 менеджеров** - StateManager, ConfigManager, HistoryManager, EventHandlerManager, GlobalEventRegistry
- **13 core операций** - ObjectOperations, LayerOperations, HistoryOperations, DuplicateOperations, GroupOperations, RenderOperations, ViewportOperations, LevelFileOperations
- **UI компоненты** - панели (AssetPanel, DetailsPanel, LayersPanel, OutlinerPanel, SettingsPanel), диалоги (BaseDialog, SplashScreenDialog)

### Ключевые API
```javascript
// LevelEditor
levelEditor.createObject(type, x, y, properties)
levelEditor.selectObject(id)
levelEditor.saveLevel()
levelEditor.getCachedObject(id)
levelEditor.showSplashScreen() // v3.54.0

// StateManager
stateManager.get(key)
stateManager.set(key, value)
stateManager.subscribe(key, callback)

// ConfigManager
configManager.get(path)
configManager.set(path, value)
configManager.loadAllConfigs()

// EventHandlerManager
eventHandlerManager.registerElement(element, handlers, elementId)
eventHandlerManager.registerTouchElement(element, configType, config, elementId)

// GlobalEventRegistry
globalEventRegistry.registerComponentHandlers(componentId, handlers, target)
```

## 📁 Основные файлы

### Core
- `src/core/LevelEditor.js` - главный класс
- `src/core/ObjectOperations.js` - операции с объектами
- `src/core/LayerOperations.js` - операции со слоями
- `src/core/RenderOperations.js` - рендеринг
- `src/core/MouseHandlers.js` - обработка мыши

### Managers
- `src/managers/StateManager.js` - состояние
- `src/managers/ConfigManager.js` - конфигурация
- `src/managers/HistoryManager.js` - undo/redo
- `src/managers/EventHandlerManager.js` - события
- `src/event-system/GlobalEventRegistry.js` - глобальные события

### UI
- `src/ui/BaseDialog.js` - базовый диалог
- `src/ui/SplashScreenDialog.js` - splash screen диалог
- `src/ui/AssetPanel.js` - панель ассетов
- `src/ui/LayersPanel.js` - панель слоев
- `src/ui/DetailsPanel.js` - свойства

### Utils
- `src/utils/Logger.js` - логирование (19 категорий)
- `src/utils/UIFactory.js` - создание UI
- `src/utils/ValidationUtils.js` - валидация

## 🏗️ Архитектурные принципы

### Централизованные системы
1. **StateManager** - единый источник состояния
2. **ConfigManager** - конфигурация
3. **EventHandlerManager** - все события UI
4. **GlobalEventRegistry** - глобальные события
5. **CacheManager** - кэширование

### Модульная архитектура
- Каждая операция в отдельном файле (ObjectOperations, LayerOperations, etc.)
- BaseModule паттерн с 25+ helper-методами
- Lifecycle через ComponentLifecycle

### Принципы
- **DRY** - нет дублирования
- **SOLID** - single responsibility
- **Clean Code** - понятный код
- **Централизация** - единые точки изменений

## 🎮 Типичные задачи

### Создание объекта
```javascript
const obj = levelEditor.createObject('player', 100, 200, { name: 'Player' });
levelEditor.selectObject(obj.id);
```

### Управление состоянием
```javascript
stateManager.set('selectedObject', obj);
const selected = stateManager.get('selectedObject');
```

### Работа с конфигурацией
```javascript
configManager.set('grid.size', 32);
const gridSize = configManager.get('grid.size');
```

### Регистрация событий
```javascript
eventHandlerManager.registerElement(button, { click: onClick }, 'button-id');
```

## 📚 Документация (приоритет)

1. **DEVELOPMENT_GUIDE.md** - настройка, примеры, правила кода
2. **ARCHITECTURE.md** - архитектура, менеджеры, модули
3. **API_GUIDE.md** - методы, примеры
4. **QUICK_START.md** - запуск, операции

## ⚠️ Частые ошибки

- ❌ `console.log` → ✅ `Logger.category.method()`
- ❌ Проверка `if (!stateManager)` → ✅ Доверяй архитектуре
- ❌ Дублирование BaseDialog → ✅ Наследование
- ❌ Прямые события → ✅ EventHandlerManager

## 🔧 Версионирование

Версия в одном месте: `src/core/LevelEditor.js` → `static VERSION = '3.54.0'`

## 🚀 Команды

```bash
# Запуск
./start_Editor.bat

# Обновление манифеста
./update_manifest.bat
```
