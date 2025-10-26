# Частые ошибки

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

# Частые ошибки

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
createObject(type, x, y) {
    console.log('Creating object:', type);
    console.error('Error creating object');
}
```

## ✅ ПРАВИЛЬНО: Использование Logger

```javascript
// ✅ ДЕЛАЙТЕ ТАК
import { Logger } from '../utils/Logger.js';

createObject(type, x, y) {
    Logger.ui.debug('Creating object:', type);
    Logger.ui.error('Error creating object');
}
```

## ❌ НЕПРАВИЛЬНО: Избыточные проверки компонентов

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
updatePanel() {
    if (!this.levelEditor) return;
    if (!this.levelEditor.stateManager) return;
    if (!this.levelEditor.configManager) return;
    // ... код
}
```

## ✅ ПРАВИЛЬНО: Минимальные проверки

```javascript
// ✅ ДЕЛАЙТЕ ТАК
updatePanel() {
    if (!this.levelEditor) return;
    // stateManager и configManager всегда доступны
    // ... код
}
```

## ❌ НЕПРАВИЛЬНО: Дублирование логики кэширования

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
getObject(objId) {
    if (this.cache.has(objId)) {
        return this.cache.get(objId);
    }
    const obj = this.findObject(objId);
    this.cache.set(objId, obj);
    return obj;
}
```

## ✅ ПРАВИЛЬНО: Использование CacheManager

```javascript
// ✅ ДЕЛАЙТЕ ТАК
getObject(objId) {
    return this.levelEditor.cacheManager.getCachedObject(objId);
}
```

## ❌ НЕПРАВИЛЬНО: Прямая работа с DOM

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
setupEventHandlers() {
    document.getElementById('button').addEventListener('click', handler);
    document.getElementById('input').addEventListener('change', handler);
}
```

## ✅ ПРАВИЛЬНО: Использование EventHandlerManager

```javascript
// ✅ ДЕЛАЙТЕ ТАК
setupEventHandlers() {
    this.levelEditor.eventHandlerManager.registerElement(
        buttonElement, 'button', { onClick: handler }
    );
    this.levelEditor.eventHandlerManager.registerElement(
        inputElement, 'input', { onChange: handler }
    );
}
```

## ❌ НЕПРАВИЛЬНО: Прямая работа с тач-событиями

```javascript
// ❌ НЕ ДЕЛАЙТЕ ТАК
element.addEventListener('touchstart', (e) => {
    // ... сложная логика обработки тач-событий
});
```

## ✅ ПРАВИЛЬНО: Использование TouchSupportManager

```javascript
// ✅ ДЕЛАЙТЕ ТАК
this.levelEditor.touchSupportManager.registerElement(
    element, 'panelResizer', {
        direction: 'horizontal',
        onResize: (element, targetPanel, newSize) => {
            targetPanel.style.width = newSize + 'px';
        }
    }
);
```

## Принципы

- **SettingsPanel всегда создается с levelEditor** - проверки избыточны
- **Используйте наследование** от BaseDialog
- **Минимальный код** - только необходимое
- **Доверяйте архитектуре** - не добавляйте избыточные проверки
- **Используйте централизованные системы** - StateManager, ConfigManager, EventHandlerManager, TouchSupportManager, CacheManager
- **Никогда не используйте console напрямую** - всегда используйте Logger
