# Руководство разработчика - 2D Level Editor

## Настройка среды разработки

### Требования

- Современный браузер с поддержкой ES6 модулей
- Локальный веб-сервер (для работы с модулями)
- Текстовый редактор с поддержкой JavaScript

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

Откройте `http://localhost:8000/index-modular.html` в браузере.

## Структура проекта

```
levelDesigner/
├── index.html              # Оригинальная версия (монолитная)
├── index-modular.html      # Новая модульная версия
├── src/                    # Исходный код
│   ├── models/            # Модели данных
│   ├── managers/          # Менеджеры системы
│   ├── ui/                # UI компоненты
│   └── core/              # Основная логика
├── docs/                  # Документация
└── README.md              # Основная документация
```

## Добавление новых функций

### 1. Добавление нового типа объекта

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

### 3. Добавление новых горячих клавиш

```javascript
// src/core/LevelEditor.js
setupKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;
        
        // ... существующие горячие клавиши
        
        if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
            e.preventDefault();
            this.copySelectedObjects();
        } else if (e.key.toLowerCase() === 'v' && e.ctrlKey) {
            e.preventDefault();
            this.pasteObjects();
        }
    });
}

copySelectedObjects() {
    const selectedObjects = this.stateManager.get('selectedObjects');
    const objects = Array.from(selectedObjects)
        .map(id => this.level.findObjectById(id))
        .filter(Boolean);
    
    // Сохранить в буфер обмена
    this.clipboard = objects.map(obj => this.deepClone(obj));
}

pasteObjects() {
    if (!this.clipboard) return;
    
    this.historyManager.saveState(this.level.objects);
    
    const newIds = new Set();
    this.clipboard.forEach(obj => {
        obj.id = this.level.nextObjectId++;
        obj.x += 20; // Смещение для видимости
        obj.y += 20;
        this.level.objects.push(obj);
        newIds.add(obj.id);
    });
    
    this.stateManager.set('selectedObjects', newIds);
    this.updateAllPanels();
    this.render();
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
        await page.click('.asset-thumbnail[data-asset-id="tile_grass"]');
        
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
        await page.click('.asset-thumbnail[data-asset-id="tile_grass"]');
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

### CDN развертывание

```html
<!-- Использование CDN для зависимостей -->
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/terser@5.0.0/dist/bundle.min.js"></script>
```

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

## Заключение

Это руководство покрывает основные аспекты разработки и расширения 2D Level Editor. Для получения дополнительной информации обратитесь к API Reference и Architecture документации.
