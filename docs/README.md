# 2D Level Editor v3.51.11

Редактор уровней для 2D игр.

## Архитектура
- **Модульная архитектура** - LevelEditor с делегированием в специализированные модули
- **Утилитарные классы** - 9 классов для централизованной бизнес-логики
- **Менеджеры** - 7 менеджеров (состояние, история, ассеты, файлы, меню, конфигурация, предпочтения)
- **BaseModule паттерн** - 25+ helper-методов для всех модулей
- **DRY принципы** - устранение дублирования кода

## Функциональность
- **Управление состоянием** - StateManager с кешированием
- **История изменений** - Undo/Redo через HistoryManager
- **Библиотека ассетов** - AssetManager с категориями
- **Группировка объектов** - система групп
- **Система слоев** - Layer.js с инвертированными z-индексами (верхний слой = максимальный индекс)
- **Гриды** - прямоугольная, diamond, шестиугольная сетка
- **Панель Outliner** - поиск, контекстное меню, выделение диапазона
- **Alt+Drag** - перемещение объектов между группами
- **Дублирование** - создание копий с сохранением позиций
- **Экспорт/Импорт** - сохранение и загрузка через FileUtils
- **View меню** - переключение режимов отображения
- **Тулбар** - полнофункциональный тулбар с кнопками File, Edit, View, Tools, Group
- **Горячие клавиши** - перехват браузерных комбинаций
- **Констрейн оси** - ограничение перемещения по одной оси при Shift
- **Валидация Player Start** - автоматическая проверка обязательного объекта
- **Интерактивный зум** - зум средней кнопкой мыши
- **Контекстные меню** - ContextMenuManager
- **Эффект параллакса** - настройка скорости движения слоев
- **Git интеграция** - GitUtils для работы с репозиторием
- **Интерактивная консоль** - выделение текста, контекстное меню
- **Asset Import System** - импорт внешних ассетов
- **Custom Dialog System** - замена браузерных диалогов
- **Mobile Interface System** - централизованная система мобильного интерфейса
- **Platform-Specific Adaptations** - iOS/Android-специфичные оптимизации
- **Event Handler System** - централизованная система обработчиков событий

## Утилиты
- **ContextMenuManager** - управление контекстными меню
- **WorldPositionUtils** - расчет мировых координат в группах
- **GroupTraversalUtils** - обход иерархии групп
- **UIFactory** - создание UI элементов
- **ValidationUtils** - валидация с кэшированием
- **AssetImporter** - импорт внешних ассетов
- **Logger** - логирование (17 категорий)
- **FileUtils** - файловые операции
- **RenderUtils** - система отрисовки
- **GridRenderers** - рендеринг сетки
- **DuplicateUtils** - дублирование объектов
- **GitUtils** - работа с Git
- **MobileInterfaceManager** - централизованное управление мобильным интерфейсом
- **EventHandlerManager** - централизованное управление обработчиками событий

## Структура проекта

```
├── config/           # Конфигурация
│   ├── defaults/     # Настройки по умолчанию
│   │   ├── canvas.json      # Настройки canvas (размер, фон, камера)
│   │   ├── editor.json      # Настройки редактора (слои, валидация)
│   │   ├── logger.json      # Настройки логирования (уровни, категории)
│   │   ├── panels.json      # Настройки панелей (позиции, размеры)
│   │   ├── shortcuts.json   # Горячие клавиши
│   │   ├── toolbar.json     # Настройки тулбара (кнопки, секции)
│   │   ├── touch.json       # Настройки тач-поддержки
│   │   └── ui.json          # UI настройки (тема, шрифты, отступы)
│   ├── menu.js       # Конфигурация меню (структура, пункты)
│   └── user/         # Пользовательские настройки
│       ├── canvas.json      # Пользовательские настройки canvas
│       ├── editor.json      # Пользовательские настройки редактора
│       ├── panels.json      # Пользовательские настройки панелей
│       ├── ui.json          # Пользовательские UI настройки
│       └── README.md        # Документация по настройкам
├── content/          # Контент проекта
│   ├── assets/       # Ассеты игры
│   │   ├── platforms/        # Платформы и окружение
│   │   └── TEST/             # Тестовые ассеты
│   ├── graphs/       # Графы уровней
│   ├── maps/         # Карты уровней
│   ├── manifest.json # Манифест ассетов
│   ├── README.md     # Документация контента
│   └── UPDATE_ASSETS.md # Инструкции по обновлению ассетов
├── src/              # Исходный код
│   ├── constants/    # Константы
│   │   └── EditorConstants.js # Константы редактора
│   ├── core/         # Core модули
│   │   ├── BaseModule.js          # Базовый класс с helper-методами
│   │   ├── ComponentLifecycle.js  # Жизненный цикл компонентов
│   │   ├── DuplicateOperations.js # Операции дублирования
│   │   ├── EventHandlers.js       # Обработка событий
│   │   ├── GroupOperations.js     # Операции с группами
│   │   ├── HistoryOperations.js   # Операции истории (Undo/Redo)
│   │   ├── LayerOperations.js     # Операции со слоями
│   │   ├── LevelEditor.js         # Главный класс редактора
│   │   ├── LevelFileOperations.js # Файловые операции уровней
│   │   ├── MouseHandlers.js       # Обработка мыши
│   │   ├── ObjectOperations.js    # Операции с объектами
│   │   ├── RenderOperations.js    # Операции рендеринга
│   │   └── ViewportOperations.js  # Операции viewport
│   ├── managers/     # Менеджеры системы
│   │   ├── AssetManager.js        # Управление ассетами
│   │   ├── CacheManager.js        # Управление кешем
│   │   ├── ConfigManager.js       # Управление конфигурацией
│   │   ├── ContextMenuManager.js  # Управление контекстными меню
│   │   ├── FileManager.js         # Файловые операции
│   │   ├── HistoryManager.js      # История изменений (Undo/Redo)
│   │   ├── MenuManager.js         # Управление меню
│   │   ├── StateManager.js        # Управление состоянием
│   │   ├── TouchSupportManager.js # Поддержка тач-событий
│   │   └── UserPreferencesManager.js # Пользовательские настройки
│   ├── models/       # Модели данных
│   │   ├── Asset.js      # Модель ассета
│   │   ├── GameObject.js # Модель игрового объекта
│   │   ├── Group.js      # Модель группы объектов
│   │   ├── Layer.js      # Модель слоя
│   │   └── Level.js      # Модель уровня
│   ├── ui/           # UI компоненты
│   │   ├── ActorPropertiesWindow.js # Окно свойств актера
│   │   ├── AssetContextMenu.js      # Контекстное меню ассетов
│   │   ├── AssetPanel.js            # Панель ассетов
│   │   ├── AssetPanelContextMenu.js # Контекстное меню панели ассетов
│   │   ├── BaseContextMenu.js       # Базовое контекстное меню
│   │   ├── BasePanel.js             # Базовый класс панели
│   │   ├── CanvasContextMenu.js     # Контекстное меню canvas
│   │   ├── CanvasRenderer.js        # Рендерер canvas
│   │   ├── ConsoleContextMenu.js    # Контекстное меню консоли
│   │   ├── DetailsPanel.js          # Панель деталей
│   │   ├── FolderPickerDialog.js    # Диалог выбора папки
│   │   ├── FoldersPanel.js          # Панель папок
│   │   ├── GridSettings.js          # Настройки сетки
│   │   ├── LayersContextMenu.js     # Контекстное меню слоев
│   │   ├── LayersPanel.js           # Панель слоев
│   │   ├── OutlinerContextMenu.js   # Контекстное меню outliner
│   │   ├── OutlinerPanel.js         # Панель outliner
│   │   ├── panel-structures/        # Структуры панелей
│   │   ├── PanelPositionManager.js  # Менеджер позиций панелей
│   │   ├── SettingsPanel.js         # Панель настроек
│   │   ├── Toolbar.js               # Тулбар
│   │   └── UniversalDialog.js       # Универсальный диалог
│   ├── utils/        # Утилитарные классы
│   │   ├── AssetImporter.js      # Импорт ассетов
│   │   ├── ColorUtils.js         # Утилиты для работы с цветами
│   │   ├── CommandAvailability.js # Доступность команд
│   │   ├── DialogReplacer.js     # Замена диалогов
│   │   ├── DuplicateUtils.js     # Утилиты дублирования
│   │   ├── ErrorHandler.js       # Обработка ошибок
│   │   ├── ExtensionErrorUtils.js # Обработка ошибок расширений
│   │   ├── FileUtils.js          # Файловые утилиты
│   │   ├── GitUtils.js           # Git утилиты
│   │   ├── gridRenderers/        # Рендереры сетки
│   │   ├── GroupTraversalUtils.js # Обход групп
│   │   ├── HoverEffects.js       # Hover эффекты
│   │   ├── Logger.js             # Логирование
│   │   ├── ParallaxRenderer.js   # Рендерер параллакса
│   │   ├── PerformanceUtils.js   # Утилиты производительности
│   │   ├── RenderUtils.js        # Утилиты рендеринга
│   │   ├── ScrollUtils.js        # Утилиты скролла
│   │   ├── SearchManager.js      # Менеджер поиска
│   │   ├── SearchSectionUtils.js # Утилиты поиска секций
│   │   ├── SearchUtils.js        # Утилиты поиска
│   │   ├── SelectionUtils.js     # Утилиты выделения
│   │   ├── SettingsSyncManager.js # Синхронизация настроек
│   │   ├── SnapUtils.js          # Утилиты привязки
│   │   ├── TouchSupportUtils.js  # Утилиты тач-поддержки
│   │   ├── UIFactory.js          # Фабрика UI элементов
│   │   ├── ValidationUtils.js    # Утилиты валидации
│   │   └── WorldPositionUtils.js # Утилиты мировых координат
│   └── widgets/      # Виджеты
│       └── ColorChooser.js # Виджет выбора цвета
├── styles/           # Стили
│   ├── base-context-menu.css    # Стили базового контекстного меню
│   ├── canvas-context-menu.css  # Стили контекстного меню canvas
│   ├── color-chooser.css        # Стили выбора цвета
│   ├── console-context-menu.css # Стили контекстного меню консоли
│   ├── details-panel.css        # Стили панели деталей
│   ├── grid-settings.css        # Стили настроек сетки
│   ├── layers-panel.css         # Стили панели слоев
│   ├── main.css                 # Основные стили
│   ├── panels.css               # Стили панелей
│   ├── settings-panel.css       # Стили панели настроек
│   ├── spacing-mode.css         # Стили режима отступов
│   ├── user-settings.css        # Пользовательские стили
│   └── README.md                # Документация стилей
├── docs/             # Документация
│   ├── API_REFERENCE.md              # Справочник API
│   ├── ARCHITECTURE.md               # Архитектура проекта
│   ├── CHANGELOG.md                  # История изменений
│   ├── COMPREHENSIVE_API_REFERENCE.md # Полный справочник API
│   ├── CONSOLE_CONTEXT_MENU.md       # Документация меню консоли
│   ├── DEVELOPMENT_GUIDE.md          # Руководство разработчика
│   ├── QUICK_START.md                # Быстрый старт
│   ├── README.md                     # Этот файл
│   ├── TOUCH_SUPPORT.md              # Документация тач-поддержки
│   ├── USER_MANUAL.md                # Руководство пользователя
│   └── VERSIONING_GUIDE.md           # Руководство по версионированию
├── tmp/              # Временные файлы
│   └── reports/      # Отчеты
├── Context_map.md    # Карта контекста проекта
├── index.html        # Главный HTML файл
├── package.json      # Зависимости проекта
├── start_Editor.bat  # Запуск редактора (Windows)
├── git_commit.bat    # Git операции
├── git_operations.bat # Git операции
├── git_push.ps1      # Git push (PowerShell)
├── push.bat          # Git push (Windows)
├── update_manifest.bat # Обновление манифеста (Windows)
├── update_manifest.js  # Обновление манифеста (Node.js)
├── update_manifest.ps1 # Обновление манифеста (PowerShell)
├── update_manifest.py  # Обновление манифеста (Python)
├── favicon.ico       # Иконка сайта
└── favicon.svg       # Иконка сайта (SVG)
```

## Быстрый старт

1. **Запуск**: `start_server.bat` или `python -m http.server 8000`
2. **Создание**: Перетащите ассеты на canvas
3. **Группировка**: `Ctrl+G`
4. **Сохранение**: `Ctrl+S`

Подробная инструкция в [QUICK_START.md](QUICK_START.md)

## Архитектура

### Утилитарное ядро
- **WorldPositionUtils** - расчет координат в иерархии групп
- **GroupTraversalUtils** - обход и обработка групп
- **UIFactory** - создание UI элементов
- **Logger** - логирование по категориям
- **FileUtils** - файловые операции
- **RenderUtils** - система отрисовки
- **BaseModule** - базовый класс с helper-методами

### Паттерны
- **Factory Pattern** - UIFactory, RenderUtils
- **Utility Pattern** - утилитарные классы
- **Observer Pattern** - StateManager  
- **Command Pattern** - HistoryManager
- **Composite Pattern** - система групп

## Ключевые возможности

### Основные функции
- **Создание объектов** - перетаскивание ассетов на холст
- **Редактирование свойств** - изменение позиции, размера, цвета
- **Система слоев** - организация объектов по слоям
- **Группировка** - создание и управление группами (`Ctrl+G`)
- **Дублирование** - создание копий (`Ctrl+D`)
- **История операций** - Undo/Redo (`Ctrl+Z/Y`)
- **Сохранение проектов** - экспорт в JSON (`Ctrl+S`)
- **Интерактивный зум** - зум средней кнопкой мыши

### Продвинутые операции
- **Режим редактирования групп** - работа внутри групп
- **Alt+Drag** - перемещение объектов между группами
- **Множественное выделение** - `Ctrl+Click` или рамка выделения
- **Фокусировка на объектах** - `F` для выбранного, `A` для всех
- **Контекстные меню** - ПКМ для быстрого доступа

### UI/UX
- **Адаптивный интерфейс** - панели изменяют размер
- **Горячие клавиши** - полная поддержка keyboard shortcuts
- **Визуальная обратная связь** - подсветка, анимации
- **Drag & Drop** - интуитивное взаимодействие
- **Эффект параллакса** - настройка скорости движения слоев

## Документация

- **[Быстрый старт](QUICK_START.md)** - запуск редактора
- **[Архитектура](ARCHITECTURE.md)** - описание архитектуры
- **[API Reference](API_REFERENCE.md)** - API всех утилит
- **[Руководство разработчика](DEVELOPMENT_GUIDE.md)** - гайд для разработчиков  
- **[Руководство пользователя](USER_MANUAL.md)** - руководство пользователя

## Для разработчиков

### Расширение функциональности
```javascript
class MyModule extends BaseModule {
    myCustomOperation() {
        if (this.isInGroupEditMode()) {
            const group = this.getActiveGroup();
            // логика
        }
    }
}
```

### Использование утилит
```javascript
// WorldPositionUtils
const worldPos = WorldPositionUtils.getWorldPosition(obj, levelObjects);

// GroupTraversalUtils  
GroupTraversalUtils.walkAllObjects(level.objects, (obj, depth, parent) => {
    console.log(`Object ${obj.name} at depth ${depth}`);
});

// Logger
Logger.canvas.debug('Drawing object', obj);

// UIFactory
const input = UIFactory.createLabeledInput({
    label: 'Object Name',
    value: obj.name,
    onChange: (e) => obj.name = e.target.value
});
```

## Заключение

Level Editor - инструмент для создания уровней с современной архитектурой JavaScript приложений.

Проект демонстрирует:
- **Архитектурные паттерны**
- **Устранение технического долга**
- **Производительность и читаемость кода**
- **Готовность к промышленному использованию**

**Статус**: Production Ready
