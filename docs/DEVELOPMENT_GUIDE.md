# Руководство разработчика - 2D Level Editor

**📚 Навигация:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектура системы
- [API_GUIDE.md](./API_GUIDE.md) - API методы
- [EVENT_HANDLER_SYSTEM.md](./EVENT_HANDLER_SYSTEM.md) - система событий
- [COMMON_MISTAKES.md](./COMMON_MISTAKES.md) - частые ошибки

## ⚠️ КРИТИЧЕСКИ ВАЖНО ДЛЯ АГЕНТА

**ПЕРЕД ДОБАВЛЕНИЕМ ЛЮБОГО КОДА:**
1. **Прочитай документацию** - особенно [ARCHITECTURE.md](./ARCHITECTURE.md), [API_GUIDE.md](./API_GUIDE.md) и [COMMON_MISTAKES.md](./COMMON_MISTAKES.md)
2. **Проверь существующие решения** - используй готовые компоненты (BaseDialog, UIFactory, Logger)
3. **Изучи похожий код** - найди примеры аналогичной функциональности
4. **Следуй архитектуре** - не дублируй код, используй централизованные системы

**Всегда используй:**
- ✅ `Logger.category.method()` вместо `console.log()`
- ✅ `stateManager` для состояния
- ✅ `eventHandlerManager` для событий
- ✅ `BaseDialog` для диалогов
- ✅ `UIFactory` для UI элементов

**Никогда не делай:**
- ❌ Не проверяй `if (!stateManager)` - доверяй архитектуре
- ❌ Не создавай новые диалоги без наследования от BaseDialog
- ❌ Не используй прямые addEventListener
- ❌ Не дублируй существующую функциональность

## 🤖 Быстрые примеры для агента

### Создание объекта:
```javascript
const obj = levelEditor.createObject('player', 100, 200, { name: 'Player' });
levelEditor.selectObject(obj.id);
```

### Управление состоянием:
```javascript
stateManager.set('selectedObject', obj);
const selected = stateManager.get('selectedObject');
stateManager.subscribe('selectedObject', (newObj) => console.log('Selected:', newObj));
```

### Работа с конфигурацией:
```javascript
configManager.set('grid.size', 32);
const gridSize = configManager.get('grid.size');
await configManager.loadAllConfigs();
```

### Создание диалога:
```javascript
const dialog = new BaseDialog({
    id: 'my-dialog',
    title: 'My Dialog',
    contentRenderer: () => '<p>Content</p>',
    onConfirm: () => dialog.hide()
});
dialog.show();
```

### Создание UI элементов:
```javascript
// createLabeledInput создает контейнер с flex-лейаутом (label 40% справа + input flex 1)
const input = UIFactory.createLabeledInput({
    label: 'Name',
    type: 'text',
    onChange: (e) => console.log(e.target.value)
});
// Используется в DetailsPanel (Basic Properties, Visual) и других панелях
```


### Обработка событий:
```javascript
eventManager.registerElement(button, 'button', {
    handlers: { click: this.onClick.bind(this) },
    context: this
});
```

**⚠️ Частые ошибки:** [COMMON_MISTAKES.md](./COMMON_MISTAKES.md)

---

### Требования

- Современный браузер с поддержкой ES6 модулей
- Локальный веб-сервер (для работы с модулями)
- Текстовый редактор с поддержкой JavaScript

### Управление версиями

**Централизованная система версий**: Версия проекта управляется из **одного места** - статической переменной `LevelEditor.VERSION` в файле `src/core/LevelEditor.js`.

```javascript
export class LevelEditor {
    static VERSION = '3.54.5'; // ← ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ
}
```

**Семантическое версионирование с правилом сброса:**
- **Major (X.0.0)** - breaking changes в архитектуре
- **Minor (X.Y.0)** - новые features, обратно совместимые
- **Patch (X.Y.Z)** - исправления багов и мелкие изменения

**Правило сброса версий:**
- При повышении **Major** → сбрасываем Minor и Patch в 0
- При повышении **Minor** → сбрасываем Patch в 0
- **Patch** увеличивается для мелких изменений

**Оптимизированное использование версии:**
- Версия отображается **только в необходимых местах**: консоли при старте и header главного окна
- Console команды (`version`) и логирование получают версию динамически
- `package.json` синхронизируется вручную при обновлениях

**Места отображения версии:**
1. **Консоль при старте** - `🚀 Level Editor v{VERSION} - Utility Architecture`
2. **Header главного окна** - `2D Level Editor v{VERSION}` для пользователей  
3. **Console команда `version`** - по запросу пользователя

**Для обновления версии:**
1. Определите тип изменения (Major/Minor/Patch)
2. Измените `LevelEditor.VERSION` в `src/core/LevelEditor.js`
3. Обновите версию в `package.json` для синхронизации
4. Все места отображения обновятся автоматически

**Избегайте дублирования версии** в других местах - используйте динамическое получение из `LevelEditor.VERSION`.

## ⚠️ Принципы архитектуры

- **SettingsPanel наследует BaseDialog** - используйте его функционал
- **stateManager всегда доступен** через `this.levelEditor.stateManager`
- **НЕ добавляйте проверки** `if (!stateManager)` - это нарушает архитектуру
- **Используйте наследование** вместо дублирования кода

## Система логирования

### Использование Logger

Проект использует централизованную систему логирования через `Logger`. **Никогда не используйте** `console.log/error/warn` напрямую!

```javascript
import { Logger } from '../utils/Logger.js';

// ✅ ПРАВИЛЬНО
Logger.mouse.debug('Alt+drag detected');
Logger.preferences.error('Failed to save:', error);
Logger.layout.info('Panel resized');

// ❌ НЕПРАВИЛЬНО  
console.log('Debug message');
console.error('Error message');
```

### Категории логирования (29 доступных)

**Основные системы**:
- `Logger.duplicate` - операции дублирования
- `Logger.render` - процессы рендеринга
- `Logger.ui` - UI операции
- `Logger.event` - обработка событий
- `Logger.asset` - работа с ресурсами
- `Logger.camera` - операции камеры

**Специализированные**:
- `Logger.mouse` - события мыши
- `Logger.state` - изменения состояния
- `Logger.git` - Системные операции
- `Logger.console` - работа с консолью
- `Logger.layout` - управление панелями

**Конфигурации**:
- `Logger.settings` - настройки редактора  
- `Logger.preferences` - пользовательские предпочтения
- `Logger.file` - файловые операции
- `Logger.history` - история изменений

### Уровни логирования

В `src/utils/Logger.js` настроен уровень `INFO`:

```javascript
static currentLevel = Logger.LEVELS.INFO; // Production оптимизация
```

**Доступные уровни**:
- `DEBUG` (0) - детальная отладка (отключено в production)
- `INFO` (1) - важные события (включено)
- `WARN` (2) - предупреждения (включено)
- `ERROR` (3) - критические ошибки (включено)

### Отладка приложения

Для детальной отладки временно измените уровень:

```javascript
// В src/utils/Logger.js для отладки:
static currentLevel = Logger.LEVELS.DEBUG;

// Верните обратно для production:
static currentLevel = Logger.LEVELS.INFO;
```

## Работа с File System Access API

### Обработка ошибок расширений

**ВАЖНО**: File System Access API может конфликтовать с браузерными расширениями (блокировщики рекламы, средства безопасности). Всегда используйте `ExtensionErrorUtils` для работы с этими API.

```javascript
import { ExtensionErrorUtils } from '../utils/ExtensionErrorUtils.js';

// ✅ ПРАВИЛЬНО - с таймаутом и fallback
const directoryHandle = await ExtensionErrorUtils.withTimeout(
    window.showDirectoryPicker({ mode: 'read' }),
    10000,
    'Directory picker'
);

// ✅ ПРАВИЛЬНО - автоматическая обработка ошибок
await ExtensionErrorUtils.handleFileSystemError(
    error,
    () => this.showInputDialog(), // fallback
    { logger: Logger.ui, operation: 'Directory picker' }
);

// ❌ НЕПРАВИЛЬНО - без защиты от расширений
const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
```

### Паттерны ошибок расширений

ExtensionErrorUtils автоматически определяет следующие типы ошибок:
- `message channel closed`
- `extension context invalidated`
- `receiving end does not exist`
- `could not establish connection`
- `timeout - possible extension conflict`

### Таймауты для File System Access API

**Рекомендуемые таймауты**:
- **Directory picker**: 10 секунд
- **File picker**: 10 секунд
- **File reading**: 15 секунд
- **File writing**: 10 секунд
- **Stream operations**: 5 секунд

### Fallback стратегии

При конфликтах с расширениями используйте fallback методы:
- **FolderPickerDialog**: fallback на input dialog
- **FileUtils**: fallback на download метод
- **AssetPanel**: пользовательские сообщения об ошибках

### Запуск локального сервера

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Откройте `http://localhost:8000/index.html` в браузере.

## Правила создания отчётов

**ПРАВИЛО**: Все отчёты создаются и ведутся в папке `./tmp/reports`. Ключевые изменения из отчётов должны отражаться в основной документации проекта.

### Текущие отчёты
- `LOGGER_MIGRATION_REPORT.md` - миграция системы логирования (73 лога)
- `TMP_MIGRATION_REPORT.md` - миграция временных файлов (DuplicateUtils)
- `REFACTORING_REPORT.md` - общий рефакторинг (280+ строк устранено)

### Создание новых отчётов
```bash
# Создавайте отчёты в правильной папке
echo "# Новый отчёт" > ./tmp/reports/FEATURE_REPORT.md

# НЕ создавайте в docs/ - это для основной документации
```

### Интеграция отчётов
После завершения работы **обязательно** перенесите ключевую информацию из отчёта в основные документы:
- `docs/ARCHITECTURE.md` - архитектурные изменения
- `docs/DEVELOPMENT_GUIDE.md` - новые правила разработки  
- `docs/README.md` - обновление описания возможностей

## Структура проекта

```
levelDesigner/
├── index.html              # Основная версия с модульной архитектурой
├── src/                    # Исходный код
│   ├── models/            # Модели данных
│   ├── managers/          # Менеджеры системы
│   ├── ui/                # UI компоненты
│   │   ├── BaseDialog.js  # Базовый класс для диалогов
│   │   └── panel-structures/ # Структуры панелей и диалогов
│   └── core/              # Основная логика
├── docs/                  # Документация
└── README.md              # Основная документация
```

## CSS Architecture (updated)

**Модульная структура стилей** в папке `styles/`:

```
styles/
├── main.css              # Основные стили и глобальные стили
├── compact-mode.css      # Стили компактного режима
├── panels.css           # Стили основных панелей
├── layers-panel.css     # Стили панели слоев
├── settings-panel.css   # Стили панели настроек
├── grid-settings.css    # Стили настроек грида
├── details-panel.css    # Стили панели деталей
├── color-chooser.css    # Стили выбора цвета
├── base-context-menu.css    # Базовые стили контекстных меню
├── canvas-context-menu.css  # Стили контекстного меню канвы
├── console-context-menu.css # Стили контекстного меню консоли
└── user-settings.css    # Пользовательские настройки стилей
```

**Принципы CSS архитектуры:**
- **Устранение inline стилей** - все стили вынесены в отдельные файлы
- **Унифицированные классы** - консистентные имена классов для форм и компонентов
- **CSS переменные** - централизованное управление цветами и размерами
- **Модульность** - каждый компонент имеет свой CSS файл
- **Производительность** - CSS файлы кэшируются браузером
- **Единообразие UI** - унифицированные стили для одинаковых элементов (табы, кнопки, формы)

**HoverEffects Utility:**
- **Файл**: `src/utils/HoverEffects.js`
- **Назначение**: Централизованная система hover эффектов
- **Методы**: `setupHoverListeners()`, `applyHoverEffect()`, `removeHoverEffect()`
- **Типы эффектов**: brightness, background, color, class

**Unified Tab System:**
- **Файлы**: `styles/main.css`, `styles/panels.css`
- **Назначение**: Единообразные стили для всех табов в приложении
- **Классы**: `.tab`, `.tab-right` - унифицированные стили
- **Особенности**: одинаковые padding, font-size, hover эффекты, активные состояния

## Унификация методов диалогов (обновлено v3.52.7)

### Принципы унификации
Все диалоговые окна должны использовать единые методы для совместимости с UniversalWindowHandlers.

#### Стандартные методы:
- `apply()` - применение изменений (обязательный)
- `cancel()` - отмена изменений (опциональный)
- `hide()` - скрытие окна (обязательный)

#### Пример унификации ActorPropertiesWindow:
```javascript
// ❌ ДО (дублирование)
class ActorPropertiesWindow {
    onConfirm() {
        this.applyChanges();  // Вызов старого метода
    }
    
    applyChanges() {
        // ... логика применения изменений
    }
    
    apply() {
        this.applyChanges();  // Дублирующий метод-обертка
    }
}

// ✅ ПОСЛЕ (унификация)
class ActorPropertiesWindow {
    onConfirm() {
        this.apply();  // Прямой вызов унифицированного метода
    }
    
    apply() {
        // ... вся логика применения изменений в одном месте
    }
}
```

#### Преимущества унификации:
- **Совместимость с UniversalWindowHandlers** - автоматическое обнаружение методов
- **Устранение дублирования** - один метод вместо нескольких
- **Упрощение архитектуры** - меньше кода для поддержки
- **Единая точка изменений** - вся логика в одном месте

## Система разделителей (обновлено v3.52.6)

### ResizerManager - Унифицированная система
Все разделители панелей теперь управляются через единый ResizerManager.

#### Основные принципы:
- **Единая точка управления** - все разделители регистрируются в ResizerManager
- **Fallback совместимость** - система работает даже при недоступности ResizerManager
- **Централизованное сохранение** - все размеры сохраняются автоматически

#### Регистрация разделителя:
```javascript
// Dock split ratios — внутри src/ui/dock (DockRenderer / DockTreeModel), не через ResizerManager.
// ResizerManager — для non-dock UI (диалоги, legacy drawers):
if (this.levelEditor?.resizerManager) {
    this.levelEditor.resizerManager.registerResizer(
        resizerElement,    // DOM элемент разделителя
        panelElement,      // DOM элемент панели
        'left',            // Сторона панели ('left', 'right', 'assets', 'folders')
        'horizontal'       // Направление ('horizontal', 'vertical')
    );
} else {
    // Fallback на legacy код
    this.setupLegacyResizer(resizerElement, panelElement, panelSide);
}
```

#### Legacy поддержка:
```javascript
// Fallback методы для совместимости
setupLegacyPanelResizer(resizer, panel, panelSide) {
    // Старая логика mouse событий
    resizer.addEventListener('mousedown', (e) => {
        // ... legacy код
    });
}
```

## Система разделителей панелей

Редактор использует гибкую систему разделителей для настройки размеров панелей с поддержкой дабл-клика для сворачивания/разворачивания:

### Универсальная функция применения стилей

```javascript
// Универсальная функция для всех разделителей панелей
function applyPanelStyles(panel, size, direction = 'width', display = 'flex') {
    if (direction === 'width') {
        panel.style.width = size + 'px';
        panel.style.flex = '0 0 auto';
    } else {
        panel.style.height = size + 'px';
        panel.style.flexShrink = '0';
    }
    panel.style.display = display;
}
```

**Параметры:**
- `panel` - DOM элемент панели
- `size` - размер в пикселях
- `direction` - направление: `'width'` или `'height'`
- `display` - отображение: `'flex'` или `'none'`

**Использование:**
```javascript
// Для правой панели (вертикальный разделитель)
applyPanelStyles(rightPanel, newWidth, 'width', 'flex');

// Для панели ассетов (горизонтальный разделитель)
applyPanelStyles(assetsPanel, newHeight, 'height', 'flex');

// Сворачивание любой панели
applyPanelStyles(anyPanel, 0, 'width', 'none');
```

### Дабл-клик разделителей

Все разделители поддерживают дабл-клик для быстрого сворачивания/разворачивания:

```javascript
// Обработчик дабл-клика для правого разделителя
resizerX.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const currentWidth = rightPanel.offsetWidth;
    const minWidth = 0;
    
    if (currentWidth <= minWidth) {
        // Восстановить предыдущий размер
        const newWidth = Math.min(previousRightPanelWidth, maxWidth);
        applyPanelStyles(rightPanel, newWidth, 'width', 'flex');
        
        // Обновить StateManager и preferences
        if (window.editor && window.editor.stateManager) {
            window.editor.stateManager.set('panels.rightPanelWidth', newWidth);
        }
        userPrefs.set('rightPanelWidth', newWidth);
    } else {
        // Сохранить текущий размер и свернуть
        previousRightPanelWidth = currentWidth;
        applyPanelStyles(rightPanel, 0, 'width', 'none');
        
        // Обновить StateManager и preferences
        if (window.editor && window.editor.stateManager) {
            window.editor.stateManager.set('panels.rightPanelWidth', 0);
        }
        userPrefs.set('rightPanelWidth', 0);
    }
    
    // Обновить canvas
    if (window.editor && window.editor.canvasRenderer) {
        window.editor.canvasRenderer.resizeCanvas();
        window.editor.render();
    }
});
```

### Вертикальный разделитель (между canvas и правой панелью)

```javascript
// Обработка mousedown для вертикального разделителя
resizerX.addEventListener('mousedown', (e) => {
    isResizingX = true;
    isAnyResizing = true;
    initialMouseX = e.clientX;
    initialRightPanelWidth = rightPanel.offsetWidth;
    // ... настройка курсора и блокировка событий
});

// Обработка mousemove с ограничениями
if (isResizingX) {
    const mouseDelta = e.clientX - initialMouseX;
    const containerWidth = mainContainer.clientWidth;
    const resizerWidth = 6;
    
    // Ограничение диапазона: 0 до (containerWidth - resizerWidth)
    let newWidth = initialRightPanelWidth - mouseDelta;
    if (newWidth < 0) newWidth = 0;
    const maxWidth = Math.max(0, containerWidth - resizerWidth);
    if (newWidth > maxWidth) newWidth = maxWidth;
    
    // Остановка обновлений при упоре в границы
    if (lastAppliedRightWidth !== null && newWidth === lastAppliedRightWidth) {
        return;
    }
    
    rightPanel.style.width = newWidth + 'px';
    rightPanel.style.flex = '0 0 auto';
    lastAppliedRightWidth = newWidth;
    
    // Обновление canvas в реальном времени
    if (window.editor && window.editor.canvasRenderer) {
        window.editor.canvasRenderer.resizeCanvas();
        window.editor.render();
    }
}
```

### Горизонтальный разделитель (между canvas и панелью ассетов)

```javascript
// Обработка mousemove для горизонтального разделителя
if (isResizingAssets) {
    const mouseDelta = e.clientY - initialMouseY;
    const newHeight = initialAssetsPanelHeight - mouseDelta;
    
    assetsPanel.style.height = newHeight + 'px';
    assetsPanel.style.flexShrink = '0';
    
    // Обновление canvas в реальном времени
    if (window.editor && window.editor.canvasRenderer) {
        window.editor.canvasRenderer.resizeCanvas();
        window.editor.render();
    }
}
```

### Ключевые особенности системы разделителей

1. **Гибкие ограничения** - панели могут сжиматься до нуля или расширяться до максимума
2. **Остановка при упоре** - разделитель перестает обновлять панель при достижении границ
3. **Обновление в реальном времени** - canvas обновляется во время перетаскивания
4. **Сохранение настроек** - размеры панелей сохраняются в localStorage
5. **Адаптивность** - панели корректно реагируют на изменение размера окна браузера

## Система настроек и конфигурации

### Обзор архитектуры

Редактор использует многоуровневую систему настроек для гибкой конфигурации:

```
┌─────────────────────────────────────┐
│         Settings Panel UI          │ ← Пользовательский интерфейс
├─────────────────────────────────────┤
│        SettingsSyncManager         │ ← Синхронизация UI ↔ StateManager
├─────────────────────────────────────┤
│  UserPreferencesManager  ConfigManager │ ← Управление конфигурацией
├─────────────────────────────────────┤
│   localStorage / JSON файлы        │ ← Хранение настроек
└─────────────────────────────────────┘
```

### Типы настроек

**1. Системные настройки** (`config/defaults/*.json`):
- `editor.json` - настройки редактора (autoSave, axis constraints, etc.)
- `ui.json` - настройки интерфейса (fontScale, spacingH, spacingV, elementSize, panel sizes)
- `canvas.json` - настройки canvas (grid, colors, snap settings)
- `panels.json` - настройки панелей (tabs order, visibility)
- `shortcuts.json` - горячие клавиши
- `toolbar.json` - настройки тулбара

**2. Пользовательские настройки** (`config/user/*.json`):
- Сохраняются в localStorage
- Переопределяют дефолтные значения
- Синхронизируются при каждом запуске

### Менеджеры настроек

**ConfigManager**:
```javascript
class ConfigManager {
    // Загрузка всех конфигураций
    async loadAllConfigsSync()

    // Получение значений по пути
    get(path) // 'ui.fontScale' → 1.2

    // Получение ИСТИННОГО дефолта по пути (не текущего значения), из закешированного
    // глубокого клона getDefaultConfigs(); используется Backspace-to-reset (ResetRegistry)
    getDefault(path)

    // Установка значений
    set(path, value)

    // Сброс к дефолтным
    reset()
}
```

**UserPreferencesManager**:
```javascript
class UserPreferencesManager {
    // Маппинг пользовательских ключей на конфиг-пути
    pathMapping = {
        'assetSize': 'ui.assetSize',
        'toolbarButtonStates': 'toolbar.buttonStates'
    }

    // Удобный API для пользовательских настроек
    set(key, value)
    get(key)
}
```

**SettingsSyncManager**:
```javascript
class SettingsSyncManager {
    // Маппинг UI элементов на StateManager
    stateMapping = {
        'ui.compactMode': 'ui.compactMode',
        'canvas.snapToGrid': 'canvas.snapToGrid'
    }

    // Синхронизация UI ↔ StateManager
    applyAllUISettingsToState()
    syncSettingToState(path, value)
}
```

### Горячие клавиши

Горячие клавиши вынесены в отдельный файл `config/defaults/shortcuts.json`:

```json
{
  "editor": {
    "undo": {"key": "Z", "ctrlKey": true, "description": "Undo"},
    "delete": {"key": "Delete", "description": "Delete objects"}
  },
  "ui": {
    "focusLayersSearch": {"key": "L", "ctrlKey": true, "description": "Focus search"}
  }
}
```

**Кастомизация хоткеев**:
- Доступна через Settings → Hotkeys
- Изменения сохраняются в `config/user/shortcuts.json`
- Перезаписывают дефолтные значения

**Категория `mouse`**: описывает мышиные жесты (`rotateObjects`, `scaleObjects` — см. Rotate/Scale жесты объектов выше; `soloLayer` — Ctrl+click иконки глаза слоя в LayersPanel, см. ARCHITECTURE.md → «Isolate и Layer Solo»). `SettingsPanel` рендерит её в отдельной секции "Mouse Gestures" в Settings → Hotkeys как информационную — поля имеют `data-static="true"` и пропускаются `setupHotkeyInputs()`, ребиндинг недоступен.

**`ui.resetToDefault`** (`key: "Backspace"`): документирует Backspace-to-reset (см. раздел «Backspace-to-reset» в ARCHITECTURE.md) — как и остальные записи в `shortcuts.json`, это чисто документационная запись, видна в Settings → Hotkeys; сам хоткей функционально обрабатывается напрямую в `EventHandlers.handleKeyDown` через `ResetRegistry.handleBackspace()`, не читается из конфига.

**`ui.toggleLeftPanel`/`toggleRightPanel`/`toggleToolbar`/`toggleAssetsPanel`** (`Alt+1`/`Alt+2`/`Alt+3`/`Alt+4`): тоггл видимости панелей, обрабатывается в `EventHandlers.handleKeyDown`.

**`editor.renameObject`** (`F2`), **`editor.isolateSelection`** (`/`), **`editor.hideSelected`** (`H`), **`editor.unhideAll`** (`Alt+H`): см. ARCHITECTURE.md → «Цикл выбора перекрывающихся объектов по кликам», «Isolate и Layer Solo», «Видимость объектов».

**Единый источник хоткеев в главном меню** (`config/menu.js` + `MenuManager` + `ShortcutFormatter`, см. ARCHITECTURE.md → «MenuManager / ShortcutFormatter»): пункты меню больше не хранят хардкод-строку хоткея, а ссылаются на дот-путь в `shortcuts.json` через `shortcutKey: 'editor.saveLevel'`. Ребинд в Settings → Hotkeys живо обновляет подпись в меню (`MenuManager.refreshShortcutLabels()`), но не сам обработчик нажатия — `EventHandlers.handleKeyDown` не читает `shortcuts.json` в рантайме (известное архитектурное ограничение).

### Сохранение настроек

**Отложенное сохранение**:
- Настройки накапливаются в памяти (`modifiedConfigs`)
- Сохраняются только при закрытии страницы (`beforeunload`)
- Уменьшает нагрузку на localStorage

**События сохранения**:
```javascript
// Сохранение при закрытии вкладки
window.addEventListener('beforeunload', () => {
    configManager.forceSaveAllSettings();
});

// Сохранение при переключении вкладок
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        configManager.forceSaveAllSettings();
    }
});
```

## Добавление новых функций

### 1. Создание новых диалогов

**⚠️ КРИТИЧЕСКИ ВАЖНО**: Все методы render в Settings Panel переведены на рефакторированные конструкторы. При создании новых диалогов используйте **BaseDialog** и **SettingsSectionConstructor** для единообразия.

Для создания новых всплывающих окон используйте **BaseDialog**:

```javascript
import { BaseDialog } from './BaseDialog.js';
import { getDialogStructure } from './panel-structures/DialogStructures.js';

// Создание диалога с предопределенной структурой
const config = {
    ...getDialogStructure('standard'),
    title: 'My Dialog',
    contentRenderer: () => '<div>Dialog content</div>',
    onConfirm: () => console.log('Confirmed'),
    onCancel: () => console.log('Cancelled')
};

const dialog = new BaseDialog(config);
dialog.show();
```

**Преимущества BaseDialog:**
- Фиксированная высота по размеру окна браузера
- Динамическая ширина на основе контента
- Плавная инициализация без скачков размеров
- Автоматическая мобильная адаптация
- Единообразное управление событиями

**См. подробную документацию:** `docs/DIALOG_SYSTEM.md`

### 2. Добавление нового типа объекта

#### Создание класса объекта

```javascript
// src/models/CustomObject.js
import { GameObject } from './GameObject.js';

export class CustomObject extends GameObject {
    constructor(data = {}) {
        super(data);
        this.type = 'custom';
        this.customProperty = data.customProperty || 'default';
    }

    // Специфичные методы
    doCustomAction() {
        // Логика объекта
    }

    toJSON() {
        return {
            ...super.toJSON(),
            customProperty: this.customProperty
        };
    }

    static fromJSON(data) {
        const obj = new CustomObject(data);
        obj.customProperty = data.customProperty;
        return obj;
    }
}
```

#### Обновление рендеринга

```javascript
// src/ui/CanvasRenderer.js
import { CustomObject } from '../models/CustomObject.js';

export class CanvasRenderer {
    drawSingleObject(obj, x, y) {
        if (obj.type === 'custom') {
            this.drawCustomObject(obj, x, y);
        } else {
            // стандартная отрисовка
        }
    }

    drawCustomObject(obj, x, y) {
        // Специальная отрисовка для кастомного объекта
        this.ctx.fillStyle = obj.color;
        this.ctx.fillRect(x, y, obj.width, obj.height);
        
        // Дополнительные элементы
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, obj.width, obj.height);
    }
}
```

#### Добавление в ассеты

```javascript
// src/managers/AssetManager.js
import { CustomObject } from '../models/CustomObject.js';

export class AssetManager {
    loadDefaultAssets() {
        // ... существующие ассеты
        
        const customAssets = [
            {
                id: 'custom_object',
                name: 'Custom Object',
                type: 'custom',
                category: 'Custom',
                width: 32,
                height: 32,
                color: '#ff6b6b',
                properties: { customProperty: 'value' }
            }
        ];

        customAssets.forEach(assetData => {
            const asset = new Asset(assetData);
            this.assets.set(asset.id, asset);
        });
    }
}
```

### 2. Добавление новой UI панели

#### Создание класса панели

```javascript
// src/ui/CustomPanel.js
export class CustomPanel {
    constructor(container, stateManager, level) {
        this.container = container;
        this.stateManager = stateManager;
        this.level = level;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Подписка на изменения состояния
        this.stateManager.subscribe('selectedObjects', () => {
            this.render();
        });
    }

    render() {
        this.container.innerHTML = `
            <h3 class="text-lg font-bold mb-3">Custom Panel</h3>
            <div id="custom-content">
                <!-- Содержимое панели -->
            </div>
        `;
    }

    // Дополнительные методы
    updateCustomData() {
        // Логика обновления
    }
}
```

#### Добавление в HTML

```html
<!-- index-modular.html -->
<div id="right-panel" class="w-80 bg-gray-900 flex flex-col flex-shrink-0">
    <div class="flex border-b border-gray-700 flex-shrink-0">
        <button data-tab="details" class="tab-right flex-1 p-2 text-sm font-medium active">Details</button>
        <button data-tab="level" class="tab-right flex-1 p-2 text-sm font-medium">Level</button>
        <button data-tab="outliner" class="tab-right flex-1 p-2 text-sm font-medium">Outliner</button>
        <button data-tab="custom" class="tab-right flex-1 p-2 text-sm font-medium">Custom</button>
    </div>
    <div class="flex-grow overflow-y-auto">
        <!-- ... существующие панели ... -->
        <div id="custom-content-panel" class="p-4 tab-content-right hidden">
            <!-- Содержимое кастомной панели -->
        </div>
    </div>
</div>
```

#### Инициализация в LevelEditor

```javascript
// src/core/LevelEditor.js
import { CustomPanel } from '../ui/CustomPanel.js';

export class LevelEditor {
    async init() {
        // ... существующая инициализация
        
        const customPanel = document.getElementById('custom-content-panel');
        this.customPanel = new CustomPanel(customPanel, this.stateManager, this);
    }

    setupRightPanelTabs() {
        const tabs = document.querySelectorAll('.tab-right');
        const contents = document.querySelectorAll('.tab-content-right');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // ... существующая логика
                
                const tabName = tab.dataset.tab;
                if (tabName === 'custom') {
                    this.customPanel.render();
                }
            });
        });
    }
}
```

### 3. Разработка продвинутой панели слоёв

#### Архитектурные принципы

**Двойная система состояний:**
- **Активные слои** - слои с выбранными объектами (border highlight)
- **Текущий слой** - слой для создания новых объектов (blue background)

**Централизованное управление:**
```javascript
// LevelEditor - единая точка управления
getCurrentLayer() // Получение текущего слоя
setCurrentLayer(layerId) // Установка текущего слоя

// LayersPanel - локальное кеширование
this.currentLayerId = null; // Кеш для производительности
```

#### Ключевые методы

⚠️ **Важно про `updateAllPanels()` (v3.55.0+)**:  
При добавлении/удалении объектов или слоёв используйте модельные методы Level (`addObject()`, `removeObject()`, `removeObjects()`, `addLayer()`, `removeLayer()`, `reorderLayers()`) вместо прямых мутаций массивов. Панели (Outliner, Layers, Details) автоматически подпишутся на событие `'levelStructureChanged'` и перерисуются без явного вызова `updateAllPanels()` — последний нужен только для non-структурных изменений (примеры: `set('selectedObjects', ...)`, изменение свойств конфига/камеры, которые StateManager уже синхронизирует сам).

**Инициализация:**
```javascript
initializeCurrentLayer() {
    const level = this.levelEditor.getLevel();
    if (level) {
        this.currentLayerId = level.getMainLayerId();
        this.levelEditor.setCurrentLayer(this.currentLayerId);
    }
}
```

**Управление состоянием:**
```javascript
setCurrentLayer(layerId) {
    const level = this.levelEditor.getLevel();
    const layer = level.getLayerById(layerId);
    if (!layer) return;
    
    this.currentLayerId = layerId;
    this.updateLayerStyles();
}

setCurrentLayerAndNotify(layerId) {
    this.setCurrentLayer(layerId);
    this.levelEditor.setCurrentLayer(layerId);
    this.levelEditor.updateAllPanels();
}
```

**Контекстные меню:**
```javascript
showLayerContextMenu(layer, event) {
    // Умное позиционирование с проверкой границ
    const menuWidth = 192;
    const menuHeight = 200;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = event.clientX;
    let top = event.clientY;
    
    // Корректировка позиции при выходе за экран
    if (left + menuWidth > viewportWidth) {
        left = viewportWidth - menuWidth - 10;
    }
    if (top + menuHeight > viewportHeight) {
        top = viewportHeight - menuHeight - 10;
    }
    
    left = Math.max(10, left);
    top = Math.max(10, top);
}
```

**Поиск и фильтрация:**
```javascript
getFilteredLayers(layers) {
    if (!this.searchFilter) return layers;
    
    const filter = this.searchFilter.toLowerCase();
    return layers.filter(layer => 
        layer.name.toLowerCase().includes(filter)
    );
}

setupSearch() {
    const searchInput = this.container.querySelector('#layers-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        this.searchFilter = e.target.value;
        this.render();
    });
}
```

**Массовые операции:**
```javascript
selectAllLayers() {
    const level = this.levelEditor.getLevel();
    const allLayerIds = level.layers.map(layer => layer.id);
    this.selectedLayers = new Set(allLayerIds);
    this.updateLayerStyles();
}

showAllLayers() {
    const level = this.levelEditor.getLevel();
    level.layers.forEach(layer => {
        layer.visible = true;
    });
    this.stateManager.markDirty();
    this.render();
}
```

#### Оптимизация производительности

**Кеширование статистики:**
```javascript
updateLayersStats() {
    const level = this.levelEditor.getLevel();
    const stats = level.getLayersStats(); // Кешированный метод
    
    // Обновление только при изменении
    if (this.lastStatsHash !== stats.hash) {
        this.renderLayersStats(stats);
        this.lastStatsHash = stats.hash;
    }
}
```

**Избирательное обновление стилей:**
```javascript
updateLayerStyles() {
    const layerElements = this.container.querySelectorAll('.layer-item');
    layerElements.forEach(element => {
        const layerId = element.dataset.layerId;
        const isActive = this.isLayerActive(layerId);
        const isCurrent = layerId === this.currentLayerId;
        const isSelected = this.selectedLayers.has(layerId);
        
        // Обновление только изменённых стилей
        this.applyLayerStyles(element, { isActive, isCurrent, isSelected });
    });
}
```

#### Обработка событий

**Подписка на изменения:**
```javascript
setupEventListeners() {
    // Изменения уровня - только инициализация, не сброс
    this.stateManager.subscribe('level', () => {
        if (!this.currentLayerId) {
            this.initializeCurrentLayer();
        }
        this.render();
    });
    
    // Изменения выделения - обновление активных слоёв
    this.stateManager.subscribe('selectedObjects', () => {
        this.updateLayerStyles();
    });
    
    // Изменения счётчиков слоёв - обновление статистики
    this.stateManager.subscribe('layerObjectsCountChanged', (layerId, changeData) => {
        this.updateLayerObjectsCount(layerId);
    });
}
```

**Горячие клавиши:**
```javascript
setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            this.selectAllLayers();
        }
        
        if (e.key === 'Delete' && this.selectedLayers.size > 0) {
            this.deleteSelectedLayers();
        }
    });
}
```

#### Тестирование панели слоёв

**Unit тесты:**
```javascript
// tests/LayersPanel.test.js
describe('LayersPanel', () => {
    test('should initialize current layer on startup', () => {
        const panel = new LayersPanel(container, stateManager, levelEditor);
        expect(panel.currentLayerId).toBe(level.getMainLayerId());
    });
    
    test('should not reset current layer when moving objects', () => {
        panel.setCurrentLayer('custom-layer');
        // Симуляция перемещения объектов
        stateManager.set('level', JSON.parse(JSON.stringify(level)));
        expect(panel.currentLayerId).toBe('custom-layer');
    });
});
```

**Integration тесты:**
```javascript
test('should create new objects in current layer', () => {
    panel.setCurrentLayer('background-layer');
    const newObject = asset.createInstance(100, 100);
    level.addObject(newObject);
    expect(newObject.layerId).toBe('background-layer');
});
```

### 4. Добавление новых горячих клавиш

Хоткеи регистрируются в `config/defaults/shortcuts.json` (единый источник истины) и обрабатываются в `EventHandlers.handleKeyDown()`:

```javascript
// config/defaults/shortcuts.json
{
  "editor": {
    "copy": { "key": "c", "ctrlKey": true },
    "cut": { "key": "x", "ctrlKey": true },
    "paste": { "key": "v", "ctrlKey": true }
  }
}

// src/event-system/EventHandlers.js — в handleKeyDown()
if (this._matchesShortcut(e, 'editor.copy')) {
    e.preventDefault();
    this.editor.copySelectedObjects();
} else if (this._matchesShortcut(e, 'editor.cut')) {
    e.preventDefault();
    this.editor.cutSelectedObjects();
} else if (this._matchesShortcut(e, 'editor.paste')) {
    e.preventDefault();
    this.editor.pasteObjects();
}

// src/core/LevelEditor.js — методы API
copySelectedObjects() {
    const selectedIds = this.stateManager.get('selectedObjects');
    if (!selectedIds || selectedIds.size === 0) return;
    // Сохранить в буфер обмена (deep-clone, отвязанные от живого дерева)
    const objects = Array.from(selectedIds)
        .map(id => this.level.findObjectById(id))
        .filter(Boolean);
    this.clipboard = objects.map(obj => this.deepClone(obj));
}

cutSelectedObjects() {
    this.copySelectedObjects();
    this.deleteSelectedObjects();
}

pasteObjects() {
    if (!this.clipboard || this.clipboard.length === 0) return;
    // Вставка только если курсор над канвой (mouse.isOverCanvas === true); иначе no-op с warning
    if (!this.stateManager.get('mouse')?.isOverCanvas) {
        Logger.status.warn('Paste ignored — move the cursor over the canvas first');
        return;
    }
    // Переиспользуем интерактивный flow размещения (ghost следует за мышью, клик подтверждает)
    // Несколько объектов центрируются по union bounding-box (anchorCenter)
    this.duplicateOperations.startFromObjects(this.clipboard);
}
```

## Тестирование

### Unit тесты

```javascript
// tests/GameObject.test.js
import { GameObject } from '../src/models/GameObject.js';

describe('GameObject', () => {
    test('should create object with default values', () => {
        const obj = new GameObject();
        expect(obj.id).toBeDefined();
        expect(obj.name).toBe('Unnamed Object');
        expect(obj.type).toBe('object');
        expect(obj.x).toBe(0);
        expect(obj.y).toBe(0);
    });

    test('should create object with custom data', () => {
        const data = { name: 'Test', x: 100, y: 200 };
        const obj = new GameObject(data);
        expect(obj.name).toBe('Test');
        expect(obj.x).toBe(100);
        expect(obj.y).toBe(200);
    });

    test('should check point containment', () => {
        const obj = new GameObject({ x: 10, y: 10, width: 20, height: 20 });
        expect(obj.containsPoint(15, 15)).toBe(true);
        expect(obj.containsPoint(5, 5)).toBe(false);
        expect(obj.containsPoint(35, 35)).toBe(false);
    });

    test('should serialize to JSON', () => {
        const obj = new GameObject({ name: 'Test' });
        const json = obj.toJSON();
        expect(json.name).toBe('Test');
        expect(json.id).toBe(obj.id);
    });
});
```

### Integration тесты

```javascript
// tests/StateManager.test.js
import { StateManager } from '../src/managers/StateManager.js';

describe('StateManager', () => {
    let stateManager;

    beforeEach(() => {
        stateManager = new StateManager();
    });

    test('should notify listeners on state change', () => {
        const callback = jest.fn();
        stateManager.subscribe('selectedObjects', callback);
        
        stateManager.set('selectedObjects', new Set([1, 2, 3]));
        
        expect(callback).toHaveBeenCalledWith(
            new Set([1, 2, 3]),
            new Set()
        );
    });

    test('should handle multiple listeners', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        
        stateManager.subscribe('selectedObjects', callback1);
        stateManager.subscribe('selectedObjects', callback2);
        
        stateManager.set('selectedObjects', new Set([1]));
        
        expect(callback1).toHaveBeenCalled();
        expect(callback2).toHaveBeenCalled();
    });

    test('should unsubscribe listeners', () => {
        const callback = jest.fn();
        const unsubscribe = stateManager.subscribe('selectedObjects', callback);
        
        unsubscribe();
        stateManager.set('selectedObjects', new Set([1]));
        
        expect(callback).not.toHaveBeenCalled();
    });
});
```

### E2E тесты

```javascript
// tests/e2e/level-editor.test.js
describe('Level Editor E2E', () => {
    beforeEach(async () => {
        await page.goto('http://localhost:8000/index-modular.html');
        await page.waitForSelector('#main-canvas');
    });

    test('should create new level', async () => {
        await page.click('#new-level');
        await page.waitForSelector('.outliner-item');
        
        const objects = await page.$$('.outliner-item');
        expect(objects.length).toBeGreaterThan(0);
    });

    test('should place asset on canvas', async () => {
        // Выбрать ассет
        await page.click('.asset-thumbnail[data-asset-id="any_asset_id"]');
        
        // Перетащить на canvas
        const canvas = await page.$('#main-canvas');
        const canvasBox = await canvas.boundingBox();
        
        await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
        await page.mouse.down();
        await page.mouse.up();
        
        // Проверить, что объект создан
        const selectedObjects = await page.evaluate(() => {
            return window.editor.stateManager.get('selectedObjects').size;
        });
        
        expect(selectedObjects).toBe(1);
    });

    test('should save and load level', async () => {
        // Создать объект
        await page.click('.asset-thumbnail[data-asset-id="any_asset_id"]');
        const canvas = await page.$('#main-canvas');
        const canvasBox = await canvas.boundingBox();
        await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
        await page.mouse.down();
        await page.mouse.up();
        
        // Сохранить уровень
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('#save-level')
        ]);
        
        expect(download.suggestedFilename()).toMatch(/\.json$/);
    });
});
```

## Отладка

### Консольные команды

```javascript
// Доступ к редактору
window.editor

// Получить состояние
window.editor.stateManager.getState()

// Получить текущий уровень
window.editor.level

// Получить выбранные объекты
window.editor.stateManager.get('selectedObjects')

// Добавить объект программно
const obj = new GameObject({ name: 'Debug Object', x: 100, y: 100 });
window.editor.level.addObject(obj);
window.editor.render();

// Очистить выделение
window.editor.stateManager.clearSelection();

// Установить камеру
window.editor.stateManager.set('camera', { x: 0, y: 0, zoom: 1 });
```

### Логирование

```javascript
// Включить детальное логирование
localStorage.setItem('debug', 'true');

// Отключить логирование
localStorage.removeItem('debug');

// Логирование в коде
if (localStorage.getItem('debug')) {
    console.log('Debug info:', data);
}
```

## Производительность

### Профилирование

```javascript
// Измерение времени выполнения
const startTime = performance.now();
// ... операция
const endTime = performance.now();
console.log(`Operation took ${endTime - startTime} milliseconds`);

// Профилирование памяти
if (performance.memory) {
    console.log('Memory usage:', {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
    });
}
```

### Оптимизации

1. **Дебаунсинг событий**:
```javascript
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Использование
const debouncedRender = debounce(() => this.render(), 16);
```

2. **Виртуализация списков**:
```javascript
// Для больших списков объектов
class VirtualizedList {
    constructor(container, items, itemHeight) {
        this.container = container;
        this.items = items;
        this.itemHeight = itemHeight;
        this.visibleStart = 0;
        this.visibleEnd = 0;
    }

    updateVisibleRange(scrollTop, containerHeight) {
        this.visibleStart = Math.floor(scrollTop / this.itemHeight);
        this.visibleEnd = Math.min(
            this.visibleStart + Math.ceil(containerHeight / this.itemHeight),
            this.items.length
        );
    }
}
```

## Развертывание

### Сборка для продакшена

```bash
# Минификация JavaScript
npx terser src/**/*.js -o dist/editor.min.js

# Оптимизация изображений
npx imagemin assets/*.png --out-dir=dist/assets

# Создание архива
zip -r level-editor.zip dist/ index-modular.html
```

### Tailwind CSS (локальная сборка)

- Не используем CDN `cdn.tailwindcss.com` в продакшене.
- Локальная сборка подключается как `styles/tailwind.build.css`.

Скрипты:
```bash
npm run build:css   # одноразовая сборка
npm run watch:css   # вотч в разработке
```

Исходники:
- `tailwind.config.js`
- `styles/tailwind.css` → `styles/tailwind.build.css`

Dev-фолбек: если `tailwind.build.css` отсутствует, `index.html` загружает CDN автоматически, но это только для разработки.

## Поддержка браузеров

### Полифиллы

```javascript
// Для старых браузеров
if (!window.Set) {
    window.Set = function() {
        this.items = [];
        this.add = function(item) {
            if (this.items.indexOf(item) === -1) {
                this.items.push(item);
            }
        };
        this.has = function(item) {
            return this.items.indexOf(item) !== -1;
        };
        this.delete = function(item) {
            const index = this.items.indexOf(item);
            if (index !== -1) {
                this.items.splice(index, 1);
            }
        };
        this.size = this.items.length;
    };
}
```

### Feature detection

```javascript
// Проверка поддержки функций
const features = {
    es6Modules: 'noModule' in HTMLScriptElement.prototype,
    canvas: !!document.createElement('canvas').getContext,
    dragDrop: 'draggable' in document.createElement('div'),
    fileAPI: 'File' in window && 'FileReader' in window
};

if (!features.es6Modules) {
    console.warn('ES6 modules not supported, using fallback');
}
```

## Новые возможности

### Режим редактирования групп

Редактор поддерживает специальный режим для работы с объектами внутри групп:

```javascript
// Вход в режим редактирования группы
enterGroupEditMode(group) {
    this.stateManager.update({
        'groupEditMode': {
            isActive: true,
            groupId: group.id,
            group: group,
            openGroups: [group]
        }
    });
    this.updateAllPanels();
    this.render();
}

// Выход из режима
exitGroupEditMode() {
    this.stateManager.update({
        'groupEditMode': {
            isActive: false,
            groupId: null,
            group: null,
            openGroups: []
        }
    });
    this.updateAllPanels();
    this.render();
}
```

### Alt+Drag функциональность

Позволяет перемещать объекты между группами:

```javascript
// Проверка пересечения границ для Alt+Drag
handleAltDragInGroup(object, group) {
    const objectBounds = this.getObjectWorldBounds(object);
    const groupBounds = this.getObjectWorldBounds(group, [object.id]);
    
    // Проверяем, полностью ли объект внутри группы
    const isCompletelyInside = 
        objectBounds.minX >= groupBounds.minX &&
        objectBounds.minY >= groupBounds.minY &&
        objectBounds.maxX <= groupBounds.maxX &&
        objectBounds.maxY <= groupBounds.maxY;
    
    return !isCompletelyInside; // Перемещаем, если не полностью внутри
}
```

**Важно**: Alt+Drag дублирование срабатывает только без Ctrl (`!(e.ctrlKey || e.metaKey)` в `MouseHandlers.js`) — комбинация Ctrl+Alt+drag зарезервирована под жест масштабирования (см. ниже).

### Rotate/Scale жесты объектов

Мышиные жесты трансформации выделения, работают на любом уровне вложенности (в т.ч. внутри групп):

- **Ctrl+drag** по объекту — вращение выделения вокруг центра общего world bounding box; **Shift** — снап к ближайшему абсолютному углу с шагом, задаваемым в Settings → Selection ("Rotation Snap (Shift+drag, °)"), по умолчанию 15° (читается из `stateManager.get('selection.rotationSnapDegrees')` с fallback на `TRANSFORM.ROTATION_SNAP_DEGREES` если не задано).
- **Ctrl+Alt+drag** — равномерное масштабирование выделения относительно центра общего bounding box; фактор клампится `TRANSFORM.MIN_SCALE_FACTOR` (0.05) / `TRANSFORM.MAX_SCALE_FACTOR` (20); **Shift** — снап фактора к шагу, задаваемому в Settings → Selection ("Scale Snap (Shift+drag, factor)"), по умолчанию 0.1 (10%, читается из `stateManager.get('selection.scaleSnapFactor')` с fallback на `TRANSFORM.SCALE_SNAP_FACTOR` если не задано).
- Клик по невыделенному объекту при старте жеста — объект становится единственным выделением, как при обычном drag.
- Жест активируется после Ctrl(+Alt)-клика на объекте при движении мыши ≥ `TRANSFORM.DRAG_THRESHOLD_PX` (4px).

```javascript
// src/constants/EditorConstants.js
export const TRANSFORM = {
    ROTATION_SNAP_DEGREES: 15,  // Fallback если selection.rotationSnapDegrees не задано; user-configurable в Settings → Selection
    SCALE_SNAP_FACTOR: 0.1,     // Fallback если selection.scaleSnapFactor не задано; user-configurable в Settings → Selection
    MIN_SCALE_FACTOR: 0.05,
    MAX_SCALE_FACTOR: 20,
    DRAG_THRESHOLD_PX: 4
};
```

Реализация — `MouseHandlers.startObjectTransform()` / `transformSelectedObjects()` (`src/event-system/MouseHandlers.js`): геометрия выделения снимается снапшотом при старте жеста и пересчитывается из снапшота на каждый `mousemove`, чтобы избежать накопления дрейфа. История сохраняется на `mouseup`, как у обычного drag; жест отменяется через `historyOperations.undo()` при отпускании вне canvas и при `window blur`.

Рамка выделения повёрнутых объектов рисуется повёрнутой (`RenderOperations.drawObjectSelectionRect`, через общий `strokeFrame`/`getFrameGeometry`). Параметр Rotation доступен в панели Details (секция Transform).

**Rotation-chain через повёрнутых предков (фикс 2026-07-02)**: `WorldPositionUtils` (`getWorldPosition`/`getWorldBounds`/`isPointInWorldBounds`/`getFrameGeometry`/`worldPointToLocalPointInGroup`/`worldDeltaToLocalDelta`) теперь корректно учитывает поворот РОДИТЕЛЬСКИХ групп — раньше рамка выделения и hit-test для объекта внутри повёрнутой группы расходились с реально отрисованной картинкой (предки трактовались как translation-only). См. подробности в `ARCHITECTURE.md` → «Rotation-chain через повёрнутых предков».

**Открытие повёрнутой группы (фикс 2026-07-02)**: обнаружилось, что фикс выше не покрывал сам group-edit-mode:
1. Рамка открытой группы (`drawGroupEditFrame`) не учитывала rotation вообще (рисовала axis-aligned прямоугольник) — исправлено, теперь использует тот же `strokeFrame`/`getFrameGeometry`, что и обычная рамка выделения (см. «Единая рамка» в `ARCHITECTURE.md`).
2. Перетаскивание объекта ВНУТРИ открытой повёрнутой группы двигало его не туда, куда тянул курсор (мировая дельта добавлялась к локальным координатам напрямую) — исправлено через `worldDeltaToLocalDelta`/`worldPointToLocalPointInGroup`.
3. Дубликаты повёрнутых объектов: рамка превью не учитывала rotation оригинала (`getDuplicateObjectBounds` игнорировала его полностью) — исправлено, теперь rotation-aware; для простых объектов рамка ещё и рисуется точно повёрнутой, не консервативным AABB.

**Разобрано и ОТКАЧЕНО (2026-07-02): попытка стабилизировать rotation-pivot группы через `excludeIds`**. Симптом: перетаскивание ОДНОГО ребёнка внутри повёрнутой группы сдвигало РЕНДЕРНУЮ позицию его невыделенных соседей (rotation-pivot группы = центр bounds её текущих детей, пересчитывается каждый кадр). Попытка фикса — исключать перетаскиваемый id из суммы bounds при вычислении pivot (`Group.getBounds` + новый параметр, threaded через `WorldPositionUtils`/`CanvasRenderer`/`RenderOperations`/`MouseHandlers`) — вызвала МНОЖЕСТВЕННУЮ регрессию:
- скачок рамки/позиции уже при простом клике/выделении ребёнка (не только при реальном drag — `mouse.isDragging` становится `true` сразу на mousedown);
- рамка открытой группы переставала учитывать выделенного ребёнка при простом выборе (рисовалась «вокруг остальных»);
- рамка «умирала» — переставала реагировать на движение перетаскиваемого объекта;
- ломался alt-drag-out highlight и bounds самого перетаскиваемого объекта (пере-использование `excludeIds` для ДВУХ разных целей — pivot-стабильности и «исключить объект из бандов целиком» — вызывало вырожденный early-return в `getWorldBounds`, когда `obj.id` оказывался и целью запроса, и в списке исключений одновременно).

Откачен полностью — код вернулся к состоянию «направление drag верное, но rotation-pivot группы зависит от текущих позиций детей» (см. «Известные ограничения» ниже). Корректный фикс потребовал бы freeze-снимка pivot'а на старте жеста, а не exclude-переключателя синхронного с `isDragging` — не реализовано, отдельная, более крупная задача.

**Известные ограничения**:
- Rotation-pivot группы = центр bounds её текущих детей, пересчитывается на каждый рендер. Перетаскивание ОДНОГО ребёнка внутри повёрнутой группы может: (а) слегка сместить итоговую world-позицию самого перетаскиваемого объекта относительно «идеальной» мировой дельты курсора, и (б) слегка сдвинуть видимую позицию НЕ выделенных соседей по группе. Подробности и разбор отменённой попытки фикса — см. `ARCHITECTURE.md` → «Rotate/Scale жесты объектов» → «Известные ограничения».

## 📚 Дополнительная информация

Дополнительные примеры и подробные описания API доступны в:
- [API_GUIDE.md](./API_GUIDE.md) - полный список методов
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектурные решения
- [COMMON_MISTAKES.md](./COMMON_MISTAKES.md) - частые ошибки
