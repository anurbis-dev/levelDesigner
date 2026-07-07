# Context Map - Level Designer v3.54.5

## ⚠️ КРИТИЧЕСКИ ВАЖНО - ЧИТАТЬ ПЕРВЫМ

**ПЕРЕД ДОБАВЛЕНИЕМ КОДА:**
1. **Прочитай документацию** - [DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md), [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [API_GUIDE.md](./docs/API_GUIDE.md)
2. **Проверь готовые решения** - используй BaseDialog, UIFactory, Logger
3. **Не дублируй код** - следуй архитектуре

**Всегда:** ✅ Logger, stateManager, eventHandlerManager, BaseDialog  
**Никогда:** ❌ console.log, if (!stateManager), прямые addEventListener

**КОМАНДЫ ТЕРМИНАЛА:** ❌ НЕ запускай серверы (`python -m http.server`, `npx serve`, `start_Editor.bat`) - они всегда запущены. Для git команд добавляй `| cat`.

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
levelEditor.showSplashScreen() // v3.54.1

// StateManager
stateManager.get(key)
stateManager.set(key, value)
stateManager.subscribe(key, callback)

// ConfigManager
configManager.get(path)
configManager.set(path, value)
configManager.loadAllConfigs()
configManager.getDefault(path) // истинный дефолт (из getDefaultConfigs(), кэш), не текущее значение — для Backspace-to-reset

// EventHandlerManager
eventHandlerManager.registerElement(element, handlers, elementId)
eventHandlerManager.registerTouchElement(element, configType, config, elementId)

// GlobalEventRegistry
globalEventRegistry.registerComponentHandlers(componentId, handlers, target)

// Реактивные обновления панелей на структурные изменения уровня (v3.55.0)
stateManager.subscribe('levelStructureChanged', (changes) => {...}) // событие при add/remove объектов/слоёв
levelEditor.level.setStructureChangeCallback(callback) // регистрация callback для структурных изменений
levelEditor.level.removeObjects(ids) // батчевое удаление объектов (одно уведомление вместо многих)

// Z-порядок объектов (array-order stacking, без zIndex)
levelEditor.level.compareStackOrder(a, b) // компаратор: layerIndex, затем путь в дереве
levelEditor.objectOperations.bringToFront(obj)
levelEditor.objectOperations.sendToBack(obj)
levelEditor.objectOperations.moveForward(obj)
levelEditor.objectOperations.moveBackward(obj)

// Backspace-to-reset (hover-based, Blender-style) — см. src/utils/ResetRegistry.js
ResetRegistry.setFields(scopeKey, fields) // fields = [{element, defaultValue}], панель регистрирует на каждый render()
ResetRegistry.handleBackspace() // точка входа из EventHandlers.handleKeyDown, наведение мышью (:hover), не фокус; false также если под курсором+в фокусе нерегистрированный текстовый input/textarea (напр. поиск в шапке SettingsPanel)
detailsPanel.registerResettable(element, defaultValue) // Transform (x/y/width/height/rotation) и Color
settingsPanel.rebuildResetRegistry() // сканирует [data-setting], вызывается в конце setupSettingsInputs()

// Цикл выбора перекрывающихся объектов по кликам (Blender-style)
objectOperations.findObjectAtPoint(x, y, skipCycle = false) // по умолчанию циклит совпадения в точке; skipCycle=true (двойной клик) — старое поведение, всегда передний объект
objectOperations._pickWithClickCycle(x, y, sortedCandidates) // внутренний, цикл по повторным кликам в той же точке (tolerance ~4 экранных px)
objectOperations._pickFrontMost(x, y, sortedCandidates) // внутренний, нецикличный front-to-back pick

// Isolate / Layer Solo / Object Solo (non-destructive временное сужение видимой сцены)
objectOperations.toggleIsolateSelection() // хоткей `/`, top-level-гранулярность, state в stateManager.get('view.isolatedTopLevelIds')
layersPanel.toggleLayerSolo(layerId) // Ctrl+click иконки глаза слоя, эксклюзивный solo, Layer.soloed (transient, не сериализуется)
objectOperations.toggleObjectSolo(obj) // Ctrl+click иконки глаза объекта в Outliner, full-hide (не dim), эксклюзивный, state в stateManager.get('view.soloedTopLevelObjectId')
objectOperations.findTopLevelAncestor(obj) // общий хелпер toggleIsolateSelection/toggleObjectSolo, поднимается через groupOperations._findParentGroup()

// Видимость объектов (H / Alt+H / Outliner eye icon)
objectOperations.toggleObjectVisibility(obj) // общая точка переключения obj.visible, каскад на детей для групп
objectOperations.toggleVisibilityForSelection() // хоткей H
objectOperations.unhideAllObjects() // хоткей Alt+H

// Единый источник хоткеев в главном меню
ShortcutFormatter.format(shortcut) // src/utils/ShortcutFormatter.js — {key,ctrlKey,altKey,shiftKey,metaKey} → "Ctrl+Alt+N"
menuManager.refreshShortcutLabels() // перечитывает [data-shortcut-key] в DOM меню после ребинда хоткея
```

## 📁 Основные файлы

### Core
- `src/core/LevelEditor.js` - главный класс
- `src/core/ObjectOperations.js` - операции с объектами
- `src/core/LayerOperations.js` - операции со слоями
- `src/core/RenderOperations.js` - рендеринг
- `src/event-system/MouseHandlers.js` - обработка мыши, в т.ч. rotate/scale жесты (`startObjectTransform`, `transformSelectedObjects`)
- `src/constants/EditorConstants.js` - константы, включая `TRANSFORM` (rotate/scale жесты)
- `src/utils/WorldPositionUtils.js` - мировые координаты, rotation-aware bounds (`getRotatedRectAABB`, `rotateBoundsAroundCenter`)
- `src/utils/GroupTraversalUtils.js` - обход иерархии групп, включая `findObjectPath()` (путь индексов для z-порядка)
- `src/models/Level.js` - модель уровня, `compareStackOrder()` — единый компаратор z-порядка (без `zIndex`, объекты не хранят его)
- `src/models/Layer.js` - модель слоя, включая transient `soloed` (Layer Solo, не сериализуется)
- `src/event-system/EventHandlers.js` - клавиатурные хоткеи (`handleKeyDown`), в т.ч. Alt+1..4 (тоггл панелей), F2 (`renameSelectedObject`)

### Managers
- `src/managers/StateManager.js` - состояние
- `src/managers/ConfigManager.js` - конфигурация
- `src/managers/HistoryManager.js` - undo/redo
- `src/managers/EventHandlerManager.js` - события
- `src/event-system/GlobalEventRegistry.js` - глобальные события
- `src/managers/MenuManager.js` - главное меню, единый источник хоткей-подписей через `shortcutKey` (`resolveShortcutLabel`, `refreshShortcutLabels`)

### UI
- `src/ui/BaseDialog.js` - базовый диалог
- `src/ui/SplashScreenDialog.js` - splash screen диалог
- `src/ui/AssetPanel.js` - панель ассетов
- `src/ui/LayersPanel.js` - панель слоев, включая Layer Solo (`toggleLayerSolo`)
- `src/ui/OutlinerPanel.js` - иерархия объектов, включая eye-icon видимости (`createVisibilityButton`), Object Solo (Ctrl+click на глаз), Ctrl+click мульти-select и click-outside-to-close в фильтре типов (`showFilterMenu`), и F2 inline-rename (`startInlineRename`)
- `src/ui/DetailsPanel.js` - свойства
- `src/ui/SettingsPanel.js` - настройки редактора; единый поиск параметров в шапке окна (`#settings-search-input`, `filterSettingsContent()`, скрытие/показ строк через `setRowVisible()` с кэшем исходного `style.display` в `dataset.searchOrigDisplay`), секции строятся через `createSettingsSection` (`src/ui/panel-structures/SettingsSectionConstructor.js`, поиска в шапке секции больше нет); range-слайдеры (без видимого thumb, значение поверх трека, цветная заливка трека до текущего значения через `--range-fill`, dblclick → ручной ввод) рендерятся через `createSettingsRange` → `createSettingsRow` (компактная однострочная раскладка), оживляются через `setupRangeSliders()` с обновлением заливки на каждый `input` (метод `updateSliderDisplay()` удалён); чекбокс `#settings-auto-apply` в футере (`SettingsPanel.autoApply`, persisted `localStorage['levelEditor_settingsAutoApply']`, дефолт `true`) — вкл: live-apply на каждый инпут, кнопки Cancel/Apply Changes задизейблены (`updateAutoApplyUI()`); выкл: live-apply отключён, `cancelSettings()` откатывает через `restoreOriginalValues()` (снимок всех ключей из `syncManager.getAllMappings()` + `logger.colors`, см. `storeOriginalValues()`)

### Utils
- `src/utils/Logger.js` - логирование (19 категорий)
- `src/utils/UIFactory.js` - создание UI
- `src/utils/ValidationUtils.js` - валидация
- `src/utils/ResetRegistry.js` - Backspace-to-reset (hover-based), singleton `ResetRegistry`, вызывается из `EventHandlers.handleKeyDown`
- `src/utils/ShortcutFormatter.js` - `ShortcutFormatter.format(shortcut)` — единый формат хоткея (`"Ctrl+Alt+N"`), используется `MenuManager` и `SettingsPanel.formatShortcut()`

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

Версия в одном месте: `src/core/LevelEditor.js` → `static VERSION = '3.54.5'`

Версия отображается динамически после полной инициализации через `updateVersionInfo()` и `updatePageTitle()`. Интерфейс скрыт до завершения загрузки, чтобы избежать отображения устаревшей версии.

## 🚀 Команды

```bash
# Запуск
./start_Editor.bat

# Обновление манифеста
./update_manifest.bat
```

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Команды терминала

### ❌ НИКОГДА не запускай эти команды (они зависают):
- `python -m http.server 8000` - сервер всегда запущен пользователем
- `npx serve` / `serve -p 8000` - сервер всегда запущен пользователем
- `npm run start:node` - запускает сервер, который зависает
- `npm run watch:css` - watch режим зависает (используй `build:css` вместо этого)
- `start_Editor.bat` - запускает сервер, который зависает
- Любые команды запуска серверов без флага `is_background=true`

### ✅ Правила для команд терминала:
1. **Долгоработающие процессы** (серверы, watch режимы) - используй `is_background=true`
2. **Git команды** - добавляй `| cat` в конце для избежания пейджера:
   ```bash
   git log --oneline -10 | cat
   git diff | cat
   ```
3. **Команды с интерактивным вводом** - добавляй флаги `--yes`, `-y`, `--non-interactive`
4. **Проверка процессов** - используй быстрые команды без ожидания:
   ```powershell
   Get-Process | Where-Object {...} | Select-Object -First 10
   ```

### ✅ Примеры корректных команд:
```bash
# Git с cat (без пейджера)
git log --oneline -10 | cat

# npm install с флагом yes
npm install --yes package-name

# Проверка версии (быстрая команда)
node --version
python --version

# Сборка CSS (быстрая, завершается сразу)
npm run build:css

# Обновление манифеста (быстрая, завершается сразу)
node update_manifest.js
# или через bat (рекомендуется)
update_manifest.bat
```

### ✅ Node.js команды которые МОЖНО запускать:
- `npm run build:css` - сборка CSS (быстрая, завершается)
- `npm run validate:version` - проверка синхронизации версий (быстрая, завершается)
- `node update_manifest.js` - обновление манифеста (быстрая, завершается)
- `npm install --yes <package>` - установка пакетов с флагом yes
- `node --version`, `npm --version` - проверка версий

## 🛠️ Полезные инструменты для агента

### Автоматические проверки:
- ✅ `npm run validate:version` - проверка синхронизации версий перед коммитом
- ✅ `read_lints` - встроенная проверка ошибок линтера

### Доступные инструменты агента:
- ✅ `codebase_search` - семантический поиск по коду
- ✅ `grep` - поиск по файлам (быстрее чем codebase_search для точных совпадений)
- ✅ `read_file` - чтение файлов
- ✅ `read_lints` - проверка ошибок линтера
- ✅ `glob_file_search` - поиск файлов по паттерну

### Рекомендации для эффективной работы:
1. **Перед изменением кода**: используй `codebase_search` для понимания архитектуры
2. **Перед коммитом**: запускай `npm run validate:version` для проверки версий
3. **После изменений**: проверяй `read_lints` на ошибки
4. **Для поиска**: используй `grep` для точных совпадений, `codebase_search` для семантики