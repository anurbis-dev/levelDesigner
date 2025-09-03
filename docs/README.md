# 2D Level Editor

Модульный редактор уровней для 2D игр с современной архитектурой и расширяемым функционалом.

## Особенности

- **Модульная архитектура** - код разделен на логические компоненты
- **Типизированные модели данных** - четкие интерфейсы для всех объектов
- **Система управления состоянием** - централизованное управление состоянием приложения
- **История изменений** - полная поддержка Undo/Redo
- **Управление ассетами** - библиотека ассетов с категориями и поиском
- **Группировка объектов** - создание и управление группами объектов
- **Префабы** - создание переиспользуемых шаблонов
- **Экспорт/Импорт** - сохранение и загрузка уровней в JSON формате

## Структура проекта

```
src/
├── models/           # Модели данных
│   ├── GameObject.js # Базовый класс для игровых объектов
│   ├── Group.js      # Класс для групп объектов
│   ├── Asset.js      # Модель ассета
│   └── Level.js      # Модель уровня
├── managers/         # Менеджеры системы
│   ├── StateManager.js    # Управление состоянием
│   ├── HistoryManager.js  # История изменений
│   ├── AssetManager.js    # Управление ассетами
│   └── FileManager.js     # Файловые операции
├── ui/               # UI компоненты
│   ├── CanvasRenderer.js  # Рендеринг на canvas
│   ├── AssetPanel.js      # Панель ассетов
│   ├── DetailsPanel.js    # Панель свойств
│   └── OutlinerPanel.js   # Панель иерархии
└── core/             # Основная логика
    └── LevelEditor.js # Главный класс редактора
```

## Быстрый старт

1. Откройте `index-modular.html` в браузере
2. Используйте панель ассетов для выбора объектов
3. Перетащите ассеты на canvas для размещения
4. Используйте правую панель для редактирования свойств
5. Сохраните уровень через меню Level → Save Level

## Архитектура

### Модели данных

Все объекты в редакторе наследуются от базового класса `GameObject`, который предоставляет:
- Уникальный ID
- Позицию и размеры
- Свойства видимости и блокировки
- Методы для работы с границами
- Сериализацию в JSON

### Менеджеры

- **StateManager** - централизованное управление состоянием с подписками на изменения
- **HistoryManager** - система Undo/Redo с ограниченным размером истории
- **AssetManager** - управление библиотекой ассетов с кэшированием изображений
- **FileManager** - операции с файлами (сохранение/загрузка уровней и ассетов)

### UI компоненты

Каждый UI компонент инкапсулирует свою логику и подписывается на изменения состояния:
- **CanvasRenderer** - отрисовка на canvas с поддержкой камеры и зума
- **AssetPanel** - отображение и выбор ассетов с поддержкой множественного выбора
- **DetailsPanel** - редактирование свойств выбранных объектов
- **OutlinerPanel** - иерархическое отображение объектов уровня

## Расширение функционала

### Добавление новых типов объектов

1. Создайте новый класс, наследующий от `GameObject`
2. Добавьте логику рендеринга в `CanvasRenderer`
3. Обновите `AssetManager` для поддержки нового типа
4. При необходимости добавьте специальную логику в `DetailsPanel`

### Добавление новых ассетов

```javascript
const newAsset = new Asset({
    name: 'My Asset',
    type: 'custom_type',
    category: 'Custom',
    width: 32,
    height: 32,
    color: '#ff0000',
    imgSrc: 'path/to/image.png',
    properties: { customProp: 'value' }
});

assetManager.addAsset(newAsset);
```

### Добавление новых UI панелей

1. Создайте новый класс панели
2. Подпишитесь на нужные изменения состояния
3. Добавьте панель в HTML
4. Инициализируйте в `LevelEditor`

## API

### StateManager

```javascript
// Подписка на изменения
const unsubscribe = stateManager.subscribe('selectedObjects', (newValue, oldValue) => {
    console.log('Selection changed:', newValue);
});

// Обновление состояния
stateManager.set('selectedObjects', new Set([1, 2, 3]));
stateManager.update({ camera: { x: 100, y: 100 } });

// Получение состояния
const selected = stateManager.get('selectedObjects');
```

### AssetManager

```javascript
// Получение ассетов
const allAssets = assetManager.getAllAssets();
const tiles = assetManager.getAssetsByCategory('Tiles');
const searchResults = assetManager.searchAssets('grass');

// Добавление ассета
const asset = new Asset({ name: 'New Asset', type: 'tile' });
assetManager.addAsset(asset);

// Кэширование изображений
await assetManager.preloadImages();
```

### FileManager

```javascript
// Создание нового уровня
const level = fileManager.createNewLevel();

// Сохранение уровня
fileManager.saveLevel(level, 'my-level.json');

// Загрузка уровня
const level = await fileManager.loadLevelFromFileInput();
```

## Формат файлов

### Уровень (.json)

```json
{
  "meta": {
    "name": "Level Name",
    "version": "1.0.0",
    "created": "2024-01-01T00:00:00.000Z",
    "modified": "2024-01-01T00:00:00.000Z"
  },
  "settings": {
    "gridSize": 32,
    "snapToGrid": true,
    "showGrid": true,
    "backgroundColor": "#4B5563"
  },
  "camera": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "objects": [
    {
      "id": 1,
      "name": "Player Start",
      "type": "player_start",
      "x": 50,
      "y": 50,
      "width": 32,
      "height": 32,
      "color": "lightblue"
    }
  ],
  "nextObjectId": 2
}
```

### Библиотека ассетов (.json)

```json
{
  "categories": ["Tiles", "Enemies", "Items"],
  "assets": [
    {
      "id": "tile_grass",
      "name": "Grass",
      "type": "tile",
      "category": "Tiles",
      "width": 32,
      "height": 32,
      "color": "#2ecc71",
      "imgSrc": "path/to/grass.png",
      "properties": { "walkable": true }
    }
  ]
}
```

## Лицензия

MIT License
