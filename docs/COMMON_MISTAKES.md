# Частые ошибки

**📚 Навигация:**
- [Development Guide](./DEVELOPMENT_GUIDE.md) - примеры кода
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектурные принципы
- [API Guide](./API_GUIDE.md) - API методы

## ⚠️ Быстрые правила

- ❌ **НЕ используйте `console.log`** → ✅ **Используйте `Logger`**
- ❌ **НЕ проверяйте `stateManager`** → ✅ **Доверяйте архитектуре**
- ❌ **НЕ дублируйте BaseDialog** → ✅ **Наследуйтесь от него**
- ❌ **НЕ создавайте обработчики с нуля** → ✅ **Используйте EventHandlerManager**
- ❌ **НЕ вешайте непассивные wheel-листенеры без необходимости** → ✅ **По умолчанию passive, только там где нужен preventDefault — non-passive**
- ❌ **НЕ работайте с DOM напрямую** → ✅ **Используйте UIFactory**

**📖 Подробные примеры:** См. разделы ниже

---

## ❌ НЕПРАВИЛЬНО: Проверки stateManager

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
renderGeneralSettings() {
    const stateManager = this.levelEditor?.stateManager;
    if (!stateManager) {
        return '<div>Error: StateManager not available</div>';
    }
    return renderGeneralSettings(stateManager);
}
```

## ✅ ПРАВИЛЬНО: Доверие архитектуре

```javascript
// ✅ ДЕЛАЙТЕ ТАК
renderGeneralSettings() {
    return renderGeneralSettings(this.levelEditor?.stateManager);
}
```

## ❌ НЕПРАВИЛЬНО: Дублирование BaseDialog

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
updateDialogSize() {
    const container = document.getElementById('settings');
    container.style.width = '600px';
    // ... дублирование логики
}
```

## ✅ ПРАВИЛЬНО: Наследование

```javascript
// ✅ ДЕЛАЙТЕ ТАК
updateDialogSize() {
    super.updateDialogSize();
}
```

## ❌ НЕПРАВИЛЬНО: Прямое использование console

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
console.log('Debug info:', data);
console.error('Error occurred:', error);
console.warn('Warning:', warning);
```

## ✅ ПРАВИЛЬНО: Использование Logger

```javascript
// ✅ ДЕЛАЙТЕ ТАК
Logger.ui.debug('Debug info:', data);
Logger.ui.error('Error occurred:', error);
Logger.ui.warn('Warning:', warning);
```

## ❌ НЕПРАВИЛЬНО: Избыточные проверки компонентов

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
if (this.levelEditor && this.levelEditor.stateManager && this.levelEditor.configManager) {
    // логика
}
```

## ✅ ПРАВИЛЬНО: Минимальные проверки

```javascript
// ✅ ДЕЛАЙТЕ ТАК
if (this.levelEditor) {
    // логика - архитектура гарантирует наличие всех компонентов
}
```

## ❌ НЕПРАВИЛЬНО: Дублирование логики кэширования

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
class MyComponent {
    constructor() {
        this.cache = new Map();
    }
    
    getCachedData(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        // ... логика кэширования
    }
}
```

## ✅ ПРАВИЛЬНО: Использование CacheManager

```javascript
// ✅ ДЕЛАЙТЕ ТАК
const cachedData = cacheManager.getCachedData(key, () => {
    // логика получения данных
    return expensiveOperation();
});
```

## ❌ НЕПРАВИЛЬНО: Прямая работа с DOM

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
const button = document.createElement('button');
button.className = 'some-custom-class';
button.addEventListener('click', this.onClick.bind(this));
```

## ✅ ПРАВИЛЬНО: Использование EventHandlerManager

```javascript
// ✅ ДЕЛАЙТЕ ТАК
const button = UIFactory.createButton({
    text: 'Click me',
    onClick: this.onClick.bind(this)
});

eventManager.registerElement(button, 'button', {
    handlers: { click: this.onClick.bind(this) },
    context: this
});
```

## ❌ НЕПРАВИЛЬНО: Дублирование методов в окнах

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
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
```

## ✅ ПРАВИЛЬНО: Унифицированные методы

```javascript
// ✅ ДЕЛАЙТЕ ТАК
class ActorPropertiesWindow {
    onConfirm() {
        this.apply();  // Прямой вызов унифицированного метода
    }
    
    apply() {
        // ... вся логика применения изменений в одном месте
    }
}
```

## ❌ НЕПРАВИЛЬНО: Дублирование обработчиков разделителей

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
class PanelPositionManager {
    setupPanelResizer(resizer, panel, panelSide) {
        // Mouse события
        resizer.addEventListener('mousedown', (e) => {
            // ... mouse логика
        });

        // Дублирование логики!
    }
}
```

## ✅ ПРАВИЛЬНО: Использование ResizerManager

```javascript
// ✅ ДЕЛАЙТЕ ТАК
// В TabLayoutController (часть PanelPositionManager) или других контроллерах/панелях
class TabLayoutController {
    setupPanelResizer(resizer, panel, panelSide) {
        // Единая система управления
        if (this.levelEditor?.resizerManager) {
            this.levelEditor.resizerManager.registerResizer(resizer, panel, panelSide, 'horizontal');
        } else {
            // Fallback на legacy код
            this.setupLegacyPanelResizer(resizer, panel, panelSide);
        }
    }
}
```


## Принципы

### 1. Доверие архитектуре
- Не добавляйте избыточные проверки существования компонентов
- Архитектура гарантирует наличие всех необходимых компонентов
- Используйте optional chaining только когда это действительно необходимо

### 2. Централизованные системы
- Всегда используйте централизованные системы (StateManager, ConfigManager, EventHandlerManager)
- Не создавайте дублирующую логику
- Используйте готовые утилиты и менеджеры

### 3. Логирование
- Всегда используйте Logger вместо console
- Выбирайте правильный уровень логирования (debug, info, warn, error)
- Используйте правильную категорию для логирования

### 4. Наследование
- Наследуйтесь от BaseDialog для диалогов
- Используйте super.method() для вызова родительских методов
- Не дублируйте логику базовых классов

### 5. Обработка событий
- Используйте EventHandlerManager для регистрации обработчиков
- Всегда используйте .bind(this) для привязки контекста
- Не создавайте обработчики событий с нуля
 - Для wheel-событий: по умолчанию `{ passive: true }`. Ставьте `{ passive: false }` только если требуется `preventDefault()` (масштабирование канвы, Ctrl+wheel в AssetPanel).

### 6. UI компоненты
- Используйте UIFactory для создания UI элементов
- Не работайте с DOM напрямую
- Используйте готовые CSS классы из UIFactory.CSS

