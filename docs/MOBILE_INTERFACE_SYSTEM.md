# Mobile Interface System v3.52.4

## Обзор

Централизованная система для обработки мобильного интерфейса с учетом различий между платформами (iOS/Android). Обеспечивает автоматическую адаптацию диалогов, панелей и других UI компонентов под мобильные устройства.

## Архитектура

### MobileInterfaceManager

Центральный менеджер для управления мобильным интерфейсом.

#### Основные возможности:
- **Детекция платформ** - автоматическое определение iOS/Android/Desktop
- **Платформо-специфичные стратегии** - отдельные оптимизации для каждой платформы
- **Система событий** - уведомления компонентов об изменениях
- **Автоматическая адаптация** - MutationObserver для новых элементов

#### Инициализация:
```javascript
import { mobileInterfaceManager } from './src/managers/MobileInterfaceManager.js';

// Автоматически инициализируется при импорте
console.log(mobileInterfaceManager.getPlatformInfo());
```

## Платформо-специфичные оптимизации

### iOS-специфичные особенности:

#### Safe Area Insets
```css
.platform-ios .ios-dialog {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
}
```

#### Предотвращение зума
```css
.platform-ios .ios-input {
    font-size: 16px !important; /* Предотвращает зум на iOS */
}
```

#### Blur Effects
```css
.platform-ios .ios-dialog {
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}
```

### Android-специфичные особенности:

#### Material Design
```css
.platform-android .android-dialog {
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
```

#### Touch Targets
```css
.platform-android .android-dialog button {
    min-height: 48px; /* Рекомендации Google */
    padding: 12px 20px;
}
```

## API Reference

### Основные методы

#### `detectPlatform()`
Определяет платформу устройства.
```javascript
const platform = mobileInterfaceManager.detectPlatform();
// Возвращает: 'ios', 'android', 'mobile-unknown', 'desktop'
```

#### `adaptElement(element)`
Адаптирует элемент для мобильного интерфейса.
```javascript
const dialog = document.getElementById('my-dialog');
mobileInterfaceManager.adaptElement(dialog);
```

#### `applyMobileStyles(element, type)`
Применяет мобильные стили к элементу.
```javascript
mobileInterfaceManager.applyMobileStyles(dialog, 'dialog');
```

#### `getDialogDimensions()`
Получает оптимальные размеры для диалога.
```javascript
const dimensions = mobileInterfaceManager.getDialogDimensions();
// Возвращает: { maxWidth, maxHeight, margin }
```

### Система событий

#### Подписка на события
```javascript
mobileInterfaceManager.on('elementAdapted', (data) => {
    console.log('Element adapted:', data.element);
});

mobileInterfaceManager.on('orientationChanged', (orientation) => {
    console.log('Orientation changed to:', orientation);
});

mobileInterfaceManager.on('resize', (data) => {
    console.log('Window resized:', data.width, data.height);
});
```

#### Отписка от событий
```javascript
const callback = (data) => console.log(data);
mobileInterfaceManager.on('elementAdapted', callback);
mobileInterfaceManager.off('elementAdapted', callback);
```

### Утилитарные методы

#### `isMobile()`
```javascript
if (mobileInterfaceManager.isMobile()) {
    // Мобильное устройство
}
```

#### `isIOS()`
```javascript
if (mobileInterfaceManager.isIOS()) {
    // iOS устройство
}
```

#### `isAndroid()`
```javascript
if (mobileInterfaceManager.isAndroid()) {
    // Android устройство
}
```

#### `getPlatformInfo()`
```javascript
const info = mobileInterfaceManager.getPlatformInfo();
console.log(info);
// {
//   platform: 'ios',
//   deviceInfo: { ... },
//   isMobile: true,
//   isIOS: true,
//   isAndroid: false
// }
```

## CSS классы

### Платформо-специфичные классы

#### `.platform-ios`
Применяется к `body` на iOS устройствах.
```css
.platform-ios {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
}
```

#### `.platform-android`
Применяется к `body` на Android устройствах.
```css
.platform-android {
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}
```

#### `.touch-device`
Применяется к `body` на touch устройствах.
```css
.touch-device {
    -webkit-overflow-scrolling: touch;
    touch-action: manipulation;
}
```

### Адаптивные размеры экранов

#### `.screen-small` (≤480px)
```css
.screen-small .mobile-adapted {
    max-width: calc(100vw - 0.5rem);
    margin: 0.25rem;
}
```

#### `.screen-medium` (≤768px)
```css
.screen-medium .mobile-adapted {
    max-width: calc(100vw - 1rem);
    margin: 0.5rem;
}
```

#### `.screen-large` (>768px)
```css
.screen-large .mobile-adapted {
    max-width: 90vw;
    margin: 1rem;
}
```

### Платформо-специфичные диалоги

#### `.ios-dialog`
```css
.platform-ios .ios-dialog {
    border-radius: 12px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
}
```

#### `.android-dialog`
```css
.platform-android .android-dialog {
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}
```

## Интеграция с компонентами

### UniversalDialog
```javascript
// Автоматически применяет мобильные стили
const dialog = new UniversalDialog();
await dialog.showAlert('Hello Mobile!');
```

### SettingsPanel
```javascript
// Интегрирован с MobileInterfaceManager
const settingsPanel = new SettingsPanel(container, configManager);
settingsPanel.show(); // Автоматически адаптируется
```

### ActorPropertiesWindow
```javascript
// Наследует мобильную адаптацию от SettingsPanel
const actorWindow = new ActorPropertiesWindow(container, stateManager, levelEditor);
actorWindow.show(actor); // Применяет платформо-специфичные стили
```

## Конфигурация платформ

### iOS конфигурация
```javascript
const iosConfig = {
    preventZoom: true,
    touchTargetSize: 44,
    safeAreaInsets: true,
    viewportMeta: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
    inputFontSize: 16, // Предотвращает зум
    scrollBehavior: 'smooth'
};
```

### Android конфигурация
```javascript
const androidConfig = {
    preventZoom: false,
    touchTargetSize: 48,
    safeAreaInsets: false,
    viewportMeta: 'width=device-width, initial-scale=1.0',
    inputFontSize: 14,
    scrollBehavior: 'auto'
};
```

## Обработка событий

### Изменение ориентации
```javascript
mobileInterfaceManager.on('orientationChanged', (orientation) => {
    if (orientation === 'landscape') {
        // Адаптация для альбомной ориентации
    } else {
        // Адаптация для портретной ориентации
    }
});
```

### Изменение размера окна
```javascript
mobileInterfaceManager.on('resize', (data) => {
    if (data.width <= 480) {
        // Маленький экран
    } else if (data.width <= 768) {
        // Средний экран
    } else {
        // Большой экран
    }
});
```

### Адаптация элементов
```javascript
mobileInterfaceManager.on('elementAdapted', (data) => {
    console.log('Element adapted for platform:', data.platform);
    console.log('Element:', data.element);
});
```

## Лучшие практики

### 1. Использование платформо-специфичных классов
```css
/* Хорошо */
.platform-ios .my-dialog {
    border-radius: 12px;
}

/* Плохо */
.my-dialog {
    border-radius: 12px; /* Применяется везде */
}
```

### 2. Проверка платформы в JavaScript
```javascript
// Хорошо
if (mobileInterfaceManager.isIOS()) {
    // iOS-специфичная логика
}

// Плохо
if (navigator.userAgent.includes('iPhone')) {
    // Ненадежная детекция
}
```

### 3. Использование событийной системы
```javascript
// Хорошо
mobileInterfaceManager.on('orientationChanged', handleOrientationChange);

// Плохо
window.addEventListener('orientationchange', handleOrientationChange);
```

## Отладка

### Логирование
```javascript
// Включить отладочные логи
mobileInterfaceManager.on('elementAdapted', (data) => {
    console.log('📱 Element adapted:', data);
});
```

### Проверка платформы
```javascript
const info = mobileInterfaceManager.getPlatformInfo();
console.log('Platform info:', info);
```

### Проверка адаптации
```javascript
// Проверить, адаптирован ли элемент
const element = document.getElementById('my-dialog');
if (element.classList.contains('mobile-adapted')) {
    console.log('Element is mobile-adapted');
}
```

## Производительность

### Ленивая загрузка
MobileInterfaceManager загружается только при необходимости через динамический импорт.

### Кэширование стратегий
Адаптационные стратегии кэшируются и переиспользуются.

### Event delegation
Централизованная обработка событий через MutationObserver.

## Совместимость

### Поддерживаемые платформы:
- iOS Safari (12+)
- Android Chrome (80+)
- Android Firefox (80+)
- Desktop browsers (Chrome, Firefox, Safari, Edge)

### Поддерживаемые функции:
- Safe area insets (iOS 11+)
- CSS Grid (все современные браузеры)
- CSS Custom Properties (все современные браузеры)
- Touch events (все touch устройства)
