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

## Принципы

- **SettingsPanel всегда создается с levelEditor** - проверки избыточны
- **Используйте наследование** от BaseDialog
- **Минимальный код** - только необходимое
