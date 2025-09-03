# Архитектура 2D Level Editor

## Обзор архитектуры

Редактор построен на модульной архитектуре с четким разделением ответственности между компонентами. Основные принципы:

- **Разделение ответственности** - каждый модуль отвечает за свою область
- **Слабая связанность** - модули взаимодействуют через четко определенные интерфейсы
- **Высокая когезия** - связанная функциональность группируется в одном модуле
- **Расширяемость** - легко добавлять новые типы объектов и функциональность

## Диаграмма архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│                    LevelEditor (Core)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 State Management                        ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      ││
│  │  │StateManager │ │HistoryManager│ │AssetManager │      ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘      ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    UI Layer                             ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      ││
│  │  │CanvasRenderer│ │AssetPanel   │ │DetailsPanel │      ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘      ││
│  │  ┌─────────────┐ ┌─────────────┐                      ││
│  │  │OutlinerPanel│ │FileManager  │                      ││
│  │  └─────────────┘ └─────────────┘                      ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Data Models                            ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      ││
│  │  │GameObject   │ │Group        │ │Asset        │      ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘      ││
│  │  ┌─────────────┐                                      ││
│  │  │Level        │                                      ││
│  │  └─────────────┘                                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Слои архитектуры

### 1. Слой данных (Data Layer)

**Назначение**: Определение структуры данных и бизнес-логики

**Компоненты**:
- `GameObject` - базовый класс для всех игровых объектов
- `Group` - класс для группировки объектов
- `Asset` - модель ассета в библиотеке
- `Level` - модель уровня с метаданными и настройками

**Принципы**:
- Инкапсуляция данных и методов работы с ними
- Сериализация/десериализация в JSON
- Валидация данных
- Неизменяемость ключевых свойств (ID)

### 2. Слой управления (Management Layer)

**Назначение**: Управление состоянием, историей, ассетами и файлами

**Компоненты**:
- `StateManager` - централизованное управление состоянием
- `HistoryManager` - система Undo/Redo
- `AssetManager` - управление библиотекой ассетов
- `FileManager` - файловые операции

**Принципы**:
- Единая точка истины для состояния
- Подписка на изменения (Observer pattern)
- Изоляция побочных эффектов
- Кэширование для производительности

### 3. Слой представления (Presentation Layer)

**Назначение**: Отображение данных и взаимодействие с пользователем

**Компоненты**:
- `CanvasRenderer` - рендеринг на canvas
- `AssetPanel` - панель ассетов
- `DetailsPanel` - панель свойств
- `OutlinerPanel` - панель иерархии

**Принципы**:
- Реактивность на изменения состояния
- Разделение логики отображения и данных
- Переиспользуемость компонентов
- Адаптивность к изменениям данных

### 4. Слой приложения (Application Layer)

**Назначение**: Координация работы всех компонентов

**Компоненты**:
- `LevelEditor` - главный класс приложения

**Принципы**:
- Инициализация и настройка компонентов
- Обработка событий высокого уровня
- Координация между слоями
- Управление жизненным циклом

## Паттерны проектирования

### Observer Pattern

Используется в `StateManager` для уведомления компонентов об изменениях состояния:

```javascript
// Подписка на изменения
stateManager.subscribe('selectedObjects', (newValue, oldValue) => {
    // Реакция на изменение выделения
});

// Уведомление об изменении
stateManager.set('selectedObjects', newSelection);
```

### Command Pattern

Реализован в `HistoryManager` для системы Undo/Redo:

```javascript
// Сохранение состояния
historyManager.saveState(currentState);

// Отмена
const previousState = historyManager.undo();

// Повтор
const nextState = historyManager.redo();
```

### Factory Pattern

Используется в `AssetManager` для создания экземпляров объектов:

```javascript
// Создание объекта из ассета
const asset = assetManager.getAsset('tile_grass');
const gameObject = asset.createInstance(x, y);
```

### Composite Pattern

Реализован в иерархии объектов через `Group`:

```javascript
// Группа может содержать другие группы
const group = new Group();
group.addChild(gameObject);
group.addChild(anotherGroup);
```

## Потоки данных

### 1. Поток создания объекта

```
User Drag → AssetPanel → StateManager → LevelEditor → Level → CanvasRenderer
```

1. Пользователь перетаскивает ассет
2. `AssetPanel` обрабатывает событие drag
3. `StateManager` обновляет состояние мыши
4. `LevelEditor` обрабатывает drop событие
5. `Level` создает новый объект
6. `CanvasRenderer` отображает объект

### 2. Поток изменения выделения

```
User Click → CanvasRenderer → LevelEditor → StateManager → UI Panels
```

1. Пользователь кликает на объект
2. `CanvasRenderer` определяет объект под курсором
3. `LevelEditor` обрабатывает клик
4. `StateManager` обновляет выделение
5. UI панели реагируют на изменение

### 3. Поток сохранения

```
User Action → LevelEditor → FileManager → Browser Download
```

1. Пользователь выбирает "Save Level"
2. `LevelEditor` инициирует сохранение
3. `FileManager` сериализует данные
4. Браузер скачивает файл

## Управление состоянием

### Структура состояния

```javascript
state = {
    // Состояние редактора
    isDirty: boolean,
    currentLevel: Level,
    currentLevelFileName: string,
    
    // UI состояние
    selectedObjects: Set<number>,
    activeAssetTabs: Set<string>,
    selectedAssets: Set<string>,
    rightPanelTab: string,
    
    // Состояние камеры
    camera: { x: number, y: number, zoom: number },
    
    // Состояние мыши
    mouse: { ... },
    
    // Состояние панелей
    outliner: { collapsedTypes: Set<string> }
}
```

### Принципы управления состоянием

1. **Единая точка истины** - все состояние хранится в `StateManager`
2. **Неизменяемость** - состояние обновляется через методы, а не напрямую
3. **Подписки** - компоненты подписываются на нужные части состояния
4. **Изоляция** - изменения состояния не влияют напрямую на UI

## Расширяемость

### Добавление нового типа объекта

1. **Создать класс**:
```javascript
class CustomObject extends GameObject {
    constructor(data) {
        super(data);
        this.type = 'custom';
        this.customProperty = data.customProperty || 'default';
    }
}
```

2. **Обновить рендеринг**:
```javascript
// В CanvasRenderer
drawSingleObject(obj, x, y) {
    if (obj.type === 'custom') {
        this.drawCustomObject(obj, x, y);
    } else {
        // стандартная отрисовка
    }
}
```

3. **Добавить в ассеты**:
```javascript
const customAsset = new Asset({
    name: 'Custom Object',
    type: 'custom',
    category: 'Custom',
    // ... другие свойства
});
```

### Добавление новой UI панели

1. **Создать класс панели**:
```javascript
class CustomPanel {
    constructor(container, stateManager, level) {
        this.container = container;
        this.stateManager = stateManager;
        this.level = level;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.stateManager.subscribe('selectedObjects', () => {
            this.render();
        });
    }
    
    render() {
        // Логика отображения
    }
}
```

2. **Добавить в HTML**:
```html
<div id="custom-panel" class="p-4 tab-content-right hidden">
    <!-- Содержимое панели -->
</div>
```

3. **Инициализировать в LevelEditor**:
```javascript
this.customPanel = new CustomPanel(
    document.getElementById('custom-panel'),
    this.stateManager,
    this.level
);
```

## Производительность

### Оптимизации рендеринга

1. **Кэширование изображений** - изображения загружаются один раз и кэшируются
2. **Обновление по необходимости** - рендеринг происходит только при изменениях
3. **Отсечение невидимых объектов** - объекты вне видимой области не рендерятся
4. **Батчинг операций** - множественные изменения группируются

### Оптимизации памяти

1. **Ограничение истории** - размер стека Undo/Redo ограничен
2. **Очистка подписок** - неиспользуемые подписки удаляются
3. **Ленивая загрузка** - ресурсы загружаются по требованию
4. **Слабая связанность** - компоненты могут быть удалены без влияния на другие

## Тестирование

### Стратегия тестирования

1. **Unit тесты** - для моделей данных и утилит
2. **Integration тесты** - для взаимодействия между компонентами
3. **E2E тесты** - для пользовательских сценариев
4. **Performance тесты** - для проверки производительности

### Примеры тестов

```javascript
// Unit тест для GameObject
describe('GameObject', () => {
    test('should create object with default values', () => {
        const obj = new GameObject();
        expect(obj.id).toBeDefined();
        expect(obj.name).toBe('Unnamed Object');
        expect(obj.type).toBe('object');
    });
    
    test('should serialize to JSON', () => {
        const obj = new GameObject({ name: 'Test' });
        const json = obj.toJSON();
        expect(json.name).toBe('Test');
    });
});

// Integration тест для StateManager
describe('StateManager', () => {
    test('should notify listeners on state change', () => {
        const stateManager = new StateManager();
        const callback = jest.fn();
        
        stateManager.subscribe('selectedObjects', callback);
        stateManager.set('selectedObjects', new Set([1, 2, 3]));
        
        expect(callback).toHaveBeenCalledWith(
            new Set([1, 2, 3]),
            new Set()
        );
    });
});
```

## Безопасность

### Принципы безопасности

1. **Валидация входных данных** - все пользовательские данные проверяются
2. **Санитизация** - потенциально опасные данные очищаются
3. **Ограничение доступа** - компоненты имеют доступ только к нужным данным
4. **Изоляция** - ошибки в одном компоненте не влияют на другие

### Примеры валидации

```javascript
// В GameObject
set x(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new Error('X coordinate must be a number');
    }
    this._x = value;
}

// В FileManager
loadLevel(file) {
    if (!this.isValidFile(file)) {
        throw new Error('Invalid file format');
    }
    // ... загрузка файла
}
```

## Заключение

Архитектура 2D Level Editor обеспечивает:

- **Масштабируемость** - легко добавлять новую функциональность
- **Поддерживаемость** - код легко понимать и изменять
- **Тестируемость** - компоненты можно тестировать изолированно
- **Производительность** - оптимизации на всех уровнях
- **Надежность** - обработка ошибок и валидация данных

Эта архитектура позволяет создавать сложные редакторы уровней, сохраняя при этом простоту разработки и использования.
