# Dialog System Architecture

## 📋 Обзор

Система диалогов Level Editor v3.52.3 обеспечивает единообразное поведение всех всплывающих окон с фиксированной высотой и динамической шириной.

## 🏗️ Архитектура

### BaseDialog
**Файл**: `src/ui/BaseDialog.js`

Базовый класс для всех всплывающих окон, предоставляющий:
- Фиксированную высоту по размеру окна браузера
- Динамическую ширину на основе контента
- Мобильную адаптацию
- Единообразное позиционирование и стили
- Автоматическое управление событиями
- **Плавную инициализацию без скачков размеров**

### DialogStructures
**Файл**: `src/ui/panel-structures/DialogStructures.js`

Предопределенные структуры для различных типов диалогов:
- `StandardDialogStructure` - базовый диалог
- `SettingsDialogStructure` - диалог настроек
- `ActorPropertiesDialogStructure` - диалог свойств актера
- `UniversalDialogStructure` - универсальный диалог
- `FolderPickerDialogStructure` - диалог выбора папки
- `GridSettingsDialogStructure` - диалог настроек сетки

### SettingsSectionConstructor
**Файл**: `src/ui/panel-structures/SettingsSectionConstructor.js`

Конструктор для создания секций SettingsPanel с единообразным стилем:
- `createSettingsSection()` - создание секции с заголовком
- `createSettingsFormGroup()` - создание группы элементов формы
- `createSettingsGrid()` - создание сетки элементов
- `createSettingsCheckbox()` - создание чекбокса с лейблом
- `createSettingsRange()` - создание слайдера с отображением значения
- `createSettingsColorInput()` - создание цветового селектора
- `createSettingsInput()` - создание текстового поля
- `createSettingsLabel()` - создание лейбла

## 🔄 Критические изменения v3.52.3

### Полная пересборка Settings Panel
- **Все методы render** переведены на рефакторированные конструкторы
- **Удален дублирующий код** (~400+ строк HTML)
- **DialogSizeManager обновлен** для работы с новой структурой
- **Добавлена поддержка stateManager** в рефакторированных рендерерах

### Обновленные компоненты:
- `renderGeneralSettings()` → `renderGeneralSettingsRefactored()`
- `renderColorsSettings()` → `renderColorsSettingsRefactored()`
- `renderSelectionSettings()` → `renderSelectionSettingsRefactored()`
- `renderTouchSettings()` → `renderTouchSettingsRefactored()`
- `renderCameraSettings()` → `renderCameraSettingsRefactored()`
- `renderAssetsSettings()` → `renderAssetsSettingsRefactored()`
- `renderPerformanceSettings()` → `renderPerformanceSettingsRefactored()`

### DialogSizeManager v3.52.3
- **Добавлен параметр `stateManager`** для рефакторированных рендереров
- **Автоматическое определение** рефакторированных функций по имени
- **Поддержка передачи stateManager** в рефакторированные функции
- **Обновлен метод `updateDialogSize()`** в SettingsPanel

## 🚀 Использование

### Создание простого диалога

```javascript
import { BaseDialog } from './BaseDialog.js';
import { getDialogStructure } from './panel-structures/DialogStructures.js';

// Создание диалога с предопределенной структурой
const config = {
    ...getDialogStructure('standard'),
    title: 'My Dialog',
    contentRenderer: () => '<div>Dialog content here</div>',
    onConfirm: () => console.log('Confirmed'),
    onCancel: () => console.log('Cancelled')
};

const dialog = new BaseDialog(config);
dialog.show();
```

### Использование SettingsSectionConstructor

```javascript
import { 
    createSettingsSection, 
    createSettingsFormGroup, 
    createSettingsGrid, 
    createSettingsCheckbox, 
    createSettingsRange, 
    createSettingsColorInput 
} from './ui/panel-structures/SettingsSectionConstructor.js';

// Создание секции с настройками UI
const uiSettingsContent = createSettingsFormGroup(`
    ${createSettingsCheckbox({
        id: 'ui-show-tooltips',
        dataSetting: 'ui.showTooltips',
        checked: settings.ui?.showTooltips,
        label: 'Show Tooltips'
    })}
    
    ${createSettingsGrid(`
        ${createSettingsRange({
            id: 'ui-font-scale',
            dataSetting: 'ui.fontScale',
            value: settings.ui?.fontScale || 1.0,
            min: 0.5,
            max: 2,
            step: 0.1,
            label: 'Font Scale'
        })}
        ${createSettingsRange({
            id: 'ui-spacing',
            dataSetting: 'ui.spacing',
            value: settings.ui?.spacing || 1.0,
            min: 0,
            max: 2,
            step: 0.1,
            label: 'Spacing'
        })}
    `, { columns: 2, gap: '1rem' })}
`);

const section = createSettingsSection('UI Settings', uiSettingsContent);
```

### Создание кастомного диалога

```javascript
const config = {
    id: 'custom-dialog',
    title: 'Custom Dialog',
    width: '600px',
    showCloseButton: true,
    showFooter: true,
    footerButtons: [
        {
            id: 'save',
            text: 'Save',
            class: 'dialog-btn-save',
            backgroundColor: '#2563eb',
            textColor: 'white',
            action: () => console.log('Save clicked')
        }
    ],
    contentRenderer: () => this.renderCustomContent(),
    onShow: () => console.log('Dialog shown'),
    onHide: () => console.log('Dialog hidden')
};

const dialog = new BaseDialog(config);
```

### Рефакторинг существующих диалогов

Пример рефакторинга UniversalDialog:

```javascript
// Старый подход
export class UniversalDialog {
    createDialog(type, message) {
        // Создание DOM элементов вручную
        this.overlay = document.createElement('div');
        // ... много кода
    }
}

// Новый подход
export class UniversalDialogRefactored {
    createDialog(type, message) {
        const config = {
            ...getDialogStructure('universal'),
            title: this.getTitle(type),
            contentRenderer: () => this.renderContent(type, message),
            footerButtons: this.getFooterButtons(type)
        };
        
        this.currentDialog = new BaseDialog(config);
        this.currentDialog.show();
    }
}
```

## 🎨 CSS Стили

### Базовые классы
- `.dialog-overlay` - оверлей диалога
- `.dialog-container` - контейнер диалога
- `.dialog-header` - заголовок диалога
- `.dialog-content` - область контента
- `.dialog-footer` - подвал диалога

### Модификаторы
- `.mobile-dialog` - мобильная адаптация
- `.dialog-btn-*` - стили кнопок

## 📱 Мобильная адаптация

BaseDialog автоматически применяет мобильные стили через `MobileInterfaceManager`:
- Адаптивные размеры
- Touch-friendly элементы
- Правильное позиционирование

## 🔧 Конфигурация

### Основные параметры
- `id` - уникальный идентификатор диалога
- `title` - заголовок диалога
- `width` - ширина (по умолчанию 'auto', рассчитывается автоматически)
- `height` - высота (по умолчанию 'calc(100vh - 4rem)')
- `showCloseButton` - показывать кнопку закрытия
- `showFooter` - показывать подвал

### Инициализация диалогов

Диалоги создаются с использованием техники "скрытой инициализации":

1. **Конструктор** - создание конфигурации (без DOM элементов)
2. **show()** - создание скрытой DOM структуры (`visibility: hidden`)
3. **Рендер контента** - отображение содержимого диалога
4. **Применение масштабирования** - Font Scale и Spacing применяются к отрендеренному контенту
5. **Расчет размеров** - определение оптимальной ширины на основе контента с учетом масштабирования
6. **Применение стилей** - установка финальных размеров
7. **Показ** - установка `visibility: visible` с правильными размерами

Это предотвращает видимые скачки размеров при инициализации диалогов.

### Кнопки подвала
```javascript
footerButtons: [
    {
        id: 'unique-id',
        text: 'Button Text',
        class: 'css-class',
        backgroundColor: '#color',
        textColor: '#color',
        action: () => { /* custom action */ }
    }
]
```

### Обработчики событий
- `onShow` - при показе диалога
- `onHide` - при скрытии диалога
- `onConfirm` - при подтверждении
- `onCancel` - при отмене

## 📊 Преимущества

1. **Единообразие** - все диалоги выглядят и ведут себя одинаково
2. **Фиксированная высота** - предотвращает скачки размеров
3. **Динамическая ширина** - оптимальное использование пространства
4. **Мобильная адаптация** - автоматическая поддержка мобильных устройств
5. **Легкость использования** - простой API для создания диалогов
6. **Расширяемость** - легко добавлять новые типы диалогов
7. **Плавная инициализация** - окна создаются скрытыми и показываются только с финальными размерами

## 🔄 Миграция

Для миграции существующих диалогов:

1. Импортируйте `BaseDialog` и `getDialogStructure`
2. Определите структуру диалога
3. Создайте конфигурацию с `contentRenderer`
4. Замените ручное создание DOM на `new BaseDialog(config)`
5. Удалите старый код создания DOM элементов

## 📝 Примеры

См. `src/ui/UniversalDialogRefactored.js` для полного примера рефакторинга существующего диалога.

## 🔄 Процесс инициализации

### Последовательность создания диалога

```javascript
// 1. Создание конфигурации (без DOM)
const config = {
    id: 'my-dialog',
    title: 'My Dialog',
    contentRenderer: () => '<div>Content</div>'
};

// 2. Создание экземпляра (DOM еще не создан)
const dialog = new BaseDialog(config);

// 3. Показ диалога (создание скрытой DOM структуры)
dialog.show();

// 4. Автоматическая последовательность:
//    - Создание DOM с visibility: hidden
//    - Рендер контента диалога
//    - Применение Font Scale и Spacing к контенту
//    - Расчет оптимальной ширины с учетом масштабирования
//    - Применение финальных размеров
//    - Установка visibility: visible
```

### Предотвращение скачков размеров

Система использует `visibility: hidden` вместо `display: none` для предотвращения пересчета layout при показе диалога. Это обеспечивает:

- Плавное появление диалога с правильными размерами
- Отсутствие видимых промежуточных состояний
- Стабильную работу на всех устройствах
