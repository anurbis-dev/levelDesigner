# UI Constructors Guide - Level Designer v3.52.5

## 🔗 Быстрые ссылки

- **🚀 Быстрый старт**: [QUICK_START.md](./QUICK_START.md)
- **🏗️ Архитектура**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **📖 API**: [API_GUIDE.md](./API_GUIDE.md)
- **🤖 Примеры**: [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md#-быстрые-примеры-для-агента)
- **⚠️ Ошибки**: [COMMON_MISTAKES.md](./COMMON_MISTAKES.md)
- **⚡ События**: [EVENT_HANDLER_SYSTEM.md](./EVENT_HANDLER_SYSTEM.md)

---

## 📋 Обзор

Руководство по созданию UI компонентов в Level Designer. Описывает все конструкторы интерфейса, их использование и лучшие практики для агентов.

## 🏗️ Архитектура UI конструкторов

### Основные компоненты:
- **BaseDialog** - базовый класс для всех диалогов
- **UIFactory** - фабрика для создания UI элементов
- **DialogStructures** - предопределенные структуры диалогов
- **SettingsSectionConstructor** - конструктор секций настроек

## 🎯 BaseDialog - Базовый класс диалогов

### Конструктор

```javascript
new BaseDialog(config)
```

**Параметры конфигурации:**
```javascript
const config = {
    // Основные параметры
    id: 'my-dialog',                    // Уникальный ID диалога
    title: 'My Dialog',                 // Заголовок диалога
    width: 'auto',                      // Ширина (auto, px, %)
    height: 'calc(100vh - 4rem)',       // Высота
    
    // Отображение элементов
    showCloseButton: true,              // Показать кнопку закрытия
    showFooter: true,                   // Показать подвал
    footerButtons: [],                  // Кнопки в подвале
    
    // Рендеринг контента
    contentRenderer: () => '<div>Content</div>', // Функция рендеринга
    
    // Обработчики событий
    onShow: () => {},                   // При показе
    onHide: () => {},                   // При скрытии
    onConfirm: () => {},                // При подтверждении
    onCancel: () => {}                  // При отмене
};
```

### Создание простого диалога

```javascript
// 1. Создание диалога
const dialog = new BaseDialog({
    id: 'simple-dialog',
    title: 'Simple Dialog',
    contentRenderer: () => '<p>Hello World!</p>',
    onConfirm: () => {
        console.log('Dialog confirmed');
        dialog.hide();
    },
    onCancel: () => {
        console.log('Dialog cancelled');
        dialog.hide();
    }
});

// 2. Показ диалога
dialog.show();

// 3. Скрытие диалога
dialog.hide();

// 4. Уничтожение диалога
dialog.destroy();
```

### Создание диалога с формой

```javascript
class MyFormDialog extends BaseDialog {
    constructor() {
        super({
            id: 'form-dialog',
            title: 'Form Dialog',
            contentRenderer: () => this.renderForm(),
            onConfirm: () => this.handleSubmit(),
            onCancel: () => this.handleCancel()
        });
        
        this.formData = {};
    }
    
    renderForm() {
        return `
            <div class="form-container">
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" value="${this.formData.name || ''}">
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" value="${this.formData.email || ''}">
                </div>
            </div>
        `;
    }
    
    handleSubmit() {
        // Сбор данных формы
        const form = this.container.querySelector('.form-container');
        const formData = new FormData(form);
        
        // Обработка данных
        this.formData = Object.fromEntries(formData);
        console.log('Form submitted:', this.formData);
        
        this.hide();
    }
    
    handleCancel() {
        console.log('Form cancelled');
        this.hide();
    }
}

// Использование
const formDialog = new MyFormDialog();
formDialog.show();
```

### Методы BaseDialog

#### Основные методы:
```javascript
// Показ диалога
dialog.show();

// Скрытие диалога
dialog.hide();

// Уничтожение диалога
dialog.destroy();

// Проверка видимости
const isVisible = dialog.isVisible;

// Получение конфигурации
const config = dialog.config;
```

#### Методы жизненного цикла:
```javascript
// Вызываются автоматически
dialog.onShow();      // При показе
dialog.onHide();      // При скрытии
dialog.onConfirm();   // При подтверждении
dialog.onCancel();    // При отмене
```

## 🏭 UIFactory - Фабрика UI элементов

### Создание элементов ввода

#### Текстовое поле с меткой:
```javascript
const input = UIFactory.createLabeledInput({
    label: 'Object Name',
    type: 'text',
    value: 'My Object',
    placeholder: 'Enter object name',
    onChange: (e) => {
        console.log('Value changed:', e.target.value);
    },
    id: 'object-name-input'
});

// Добавление в DOM
document.body.appendChild(input);
```

#### Простое поле ввода:
```javascript
const input = UIFactory.createInput({
    type: 'number',
    value: 100,
    placeholder: 'Enter value',
    onChange: (e) => {
        console.log('Number changed:', e.target.value);
    },
    id: 'number-input'
});
```

#### Поле ввода с валидацией:
```javascript
const input = UIFactory.createInput({
    type: 'text',
    value: '',
    placeholder: 'Enter valid email',
    onChange: (e) => {
        const email = e.target.value;
        const isValid = email.includes('@');
        
        // Визуальная обратная связь
        e.target.style.borderColor = isValid ? 'green' : 'red';
    },
    id: 'email-input'
});
```

### Создание кнопок

#### Основная кнопка:
```javascript
const button = UIFactory.createButton({
    text: 'Save',
    onClick: () => {
        console.log('Save clicked');
    },
    id: 'save-button'
});
```

#### Вторичная кнопка:
```javascript
const button = UIFactory.createButton({
    text: 'Cancel',
    onClick: () => {
        console.log('Cancel clicked');
    },
    id: 'cancel-button',
    className: UIFactory.CSS.buttonSecondary
});
```

#### Кнопка опасного действия:
```javascript
const button = UIFactory.createButton({
    text: 'Delete',
    onClick: () => {
        if (confirm('Are you sure?')) {
            console.log('Delete confirmed');
        }
    },
    id: 'delete-button',
    className: UIFactory.CSS.buttonDanger
});
```

### Создание панелей и вкладок

#### Панель:
```javascript
const panel = UIFactory.createPanel({
    title: 'Settings',
    content: '<p>Panel content</p>',
    id: 'settings-panel'
});
```

#### Вкладка:
```javascript
const tab = UIFactory.createTab({
    text: 'General',
    active: true,
    onClick: () => {
        console.log('General tab clicked');
    },
    id: 'general-tab'
});
```

### Создание редактора свойств

```javascript
const object = {
    name: 'My Object',
    x: 100,
    y: 200,
    width: 50,
    height: 50
};

const propertyEditor = UIFactory.createPropertyEditor(
    object,
    ['name', 'x', 'y', 'width', 'height'],
    (property, value) => {
        console.log(`Property ${property} changed to ${value}`);
        object[property] = value;
    }
);

// Добавление в DOM
document.body.appendChild(propertyEditor);
```

### CSS классы UIFactory

```javascript
// Доступные CSS классы
UIFactory.CSS = {
    input: 'mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
    inputLabel: 'block text-sm font-medium',
    button: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
    buttonSecondary: 'px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500',
    buttonDanger: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500',
    container: 'mb-3',
    panel: 'bg-gray-800 border border-gray-700 rounded-lg p-4',
    tab: 'px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:bg-gray-700',
    tabActive: 'px-4 py-2 text-sm font-medium border-b-2 border-blue-500 bg-gray-700 text-blue-400'
};
```

## 🏗️ DialogStructures - Предопределенные структуры

### Использование готовых структур

```javascript
import { getDialogStructure } from '../ui/panel-structures/DialogStructures.js';

// Стандартный диалог
const standardConfig = getDialogStructure('standard');
const dialog = new BaseDialog({
    ...standardConfig,
    title: 'Standard Dialog',
    contentRenderer: () => '<p>Standard content</p>'
});

// Диалог настроек
const settingsConfig = getDialogStructure('settings');
const settingsDialog = new BaseDialog({
    ...settingsConfig,
    title: 'Settings',
    contentRenderer: () => this.renderSettings()
});

// Диалог свойств актера
const actorConfig = getDialogStructure('actor-properties');
const actorDialog = new BaseDialog({
    ...actorConfig,
    title: 'Actor Properties',
    contentRenderer: () => this.renderActorProperties()
});
```

### Доступные структуры:
- `standard` - базовый диалог
- `settings` - диалог настроек
- `actor-properties` - диалог свойств актера
- `universal` - универсальный диалог
- `folder-picker` - диалог выбора папки
- `grid-settings` - диалог настроек сетки

## 🔧 SettingsSectionConstructor - Конструктор секций

### Создание секции настроек

`SettingsSectionConstructor.js` — не класс, а модуль с именованными функциями. Каждая
возвращает готовую HTML-строку; ни одна из них не принимает `onChange` — обработчики
событий не встраиваются в разметку, а централизованно навешиваются один раз в
`SettingsPanel.setupSettingsInputs()` по атрибуту `data-setting` (см. ARCHITECTURE.md).

```javascript
import {
    createSettingsSection,
    createSettingsFormGroup,
    createSettingsLabel,
    createSettingsInput,
    createSettingsCheckbox,
    createSettingsRange,
    createSettingsColorInput,
    createSettingsRow
} from '../ui/panel-structures/SettingsSectionConstructor.js';

// Создание группы элементов формы (content — готовая HTML-строка, не массив)
const formGroup = createSettingsFormGroup(`
    ${createSettingsLabel('Canvas Width', 'canvas-width')}
    ${createSettingsInput({ id: 'canvas-width', type: 'number', value: 800, dataSetting: 'canvas.width' })}
    ${createSettingsLabel('Canvas Height', 'canvas-height')}
    ${createSettingsInput({ id: 'canvas-height', type: 'number', value: 600, dataSetting: 'canvas.height' })}
`);

// Создание чекбокса
const checkbox = createSettingsCheckbox({
    id: 'enable-grid',
    label: 'Enable Grid',
    checked: true,
    dataSetting: 'canvas.showGrid'
});

// Создание слайдера (значение отображается поверх трека; клик+драг и дабл-клик
// для ручного ввода обслуживает SettingsPanel.setupRangeSliders())
// Слайдер теперь рендерится в компактной однострочной раскладке через createSettingsRow
const slider = createSettingsRange({
    id: 'zoom-level',
    label: 'Zoom Level',
    min: 0.1,
    max: 3.0,
    step: 0.1,
    value: 1.0,
    dataSetting: 'camera.zoomLevel'
});

// Создание цветового селектора
const colorInput = createSettingsColorInput({
    id: 'background-color',
    label: 'Background Color',
    value: '#000000',
    dataSetting: 'canvas.backgroundColor',
    inline: true  // использует createSettingsRow для компактной раскладки
});

// Создание секции с заголовком (title, content — позиционные аргументы, не объект)
const section = createSettingsSection('General Settings', formGroup);

// createSettingsRow — базовый блок для однострочной раскладки "label слева + control справа"
// (используется внутри createSettingsRange и createSettingsColorInput при inline=true)
// Обычно вызывается через конструкторы выше, но можно и напрямую:
const customRow = createSettingsRow('My Label', 'my-control', '<input type="text">', { /* options */ });
```

## 🤖 Практические примеры для агента

### Создание диалога настроек

```javascript
class SettingsDialog extends BaseDialog {
    constructor(levelEditor) {
        super({
            id: 'settings-dialog',
            title: 'Settings',
            contentRenderer: () => this.renderSettings(),
            onConfirm: () => this.saveSettings(),
            onCancel: () => this.cancelSettings()
        });
        
        this.levelEditor = levelEditor;
        this.settings = this.levelEditor.configManager.get('settings') || {};
    }
    
    renderSettings() {
        return `
            <div class="settings-container">
                <div class="settings-section">
                    <h3>General</h3>
                    <div class="settings-group">
                        <label for="canvas-width">Canvas Width:</label>
                        <input type="number" id="canvas-width" value="${this.settings.canvasWidth || 800}">
                    </div>
                    <div class="settings-group">
                        <label for="canvas-height">Canvas Height:</label>
                        <input type="number" id="canvas-height" value="${this.settings.canvasHeight || 600}">
                    </div>
                </div>
                <div class="settings-section">
                    <h3>Display</h3>
                    <div class="settings-group">
                        <label>
                            <input type="checkbox" id="show-grid" ${this.settings.showGrid ? 'checked' : ''}>
                            Show Grid
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    saveSettings() {
        // Сбор данных формы
        const form = this.container.querySelector('.settings-container');
        const formData = new FormData(form);
        
        // Сохранение настроек
        this.settings = {
            canvasWidth: parseInt(formData.get('canvas-width')),
            canvasHeight: parseInt(formData.get('canvas-height')),
            showGrid: formData.get('show-grid') === 'on'
        };
        
        // Применение настроек
        this.levelEditor.configManager.set('settings', this.settings);
        
        console.log('Settings saved:', this.settings);
        this.hide();
    }
    
    cancelSettings() {
        console.log('Settings cancelled');
        this.hide();
    }
}

// Использование
const settingsDialog = new SettingsDialog(levelEditor);
settingsDialog.show();
```

### Создание кастомного UI компонента

```javascript
class CustomButton extends UIFactory {
    static createCustomButton(options = {}) {
        const {
            text,
            icon,
            onClick,
            variant = 'primary',
            size = 'medium',
            disabled = false,
            id = null
        } = options;
        
        const button = document.createElement('button');
        button.className = `custom-button custom-button--${variant} custom-button--${size}`;
        button.disabled = disabled;
        
        if (id) button.id = id;
        
        // Содержимое кнопки
        let content = '';
        if (icon) {
            content += `<span class="custom-button__icon">${icon}</span>`;
        }
        if (text) {
            content += `<span class="custom-button__text">${text}</span>`;
        }
        button.innerHTML = content;
        
        // Обработчик клика
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        
        return button;
    }
}

// Использование
const button = CustomButton.createCustomButton({
    text: 'Save',
    icon: '💾',
    variant: 'primary',
    size: 'large',
    onClick: () => console.log('Custom button clicked')
});
```

## ⚠️ Лучшие практики

### 1. Всегда используйте BaseDialog для диалогов
```javascript
// ✅ ПРАВИЛЬНО
class MyDialog extends BaseDialog {
    constructor() {
        super({
            id: 'my-dialog',
            title: 'My Dialog',
            contentRenderer: () => this.renderContent()
        });
    }
}

// ❌ НЕПРАВИЛЬНО
class MyDialog {
    constructor() {
        // Создание диалога с нуля
    }
}
```

### 2. Используйте UIFactory для создания элементов
```javascript
// ✅ ПРАВИЛЬНО
const input = UIFactory.createLabeledInput({
    label: 'Name',
    onChange: (e) => this.handleChange(e)
});

// ❌ НЕПРАВИЛЬНО
const input = document.createElement('input');
input.className = 'some-custom-class';
```

### 3. Правильно обрабатывайте события
```javascript
// ✅ ПРАВИЛЬНО
const button = UIFactory.createButton({
    text: 'Click me',
    onClick: () => {
        // Обработка события
        this.handleClick();
    }
});

// ❌ НЕПРАВИЛЬНО
const button = UIFactory.createButton({
    text: 'Click me',
    onClick: this.handleClick // Потеря контекста
});
```

### 4. Очищайте ресурсы
```javascript
// ✅ ПРАВИЛЬНО
class MyDialog extends BaseDialog {
    destroy() {
        // Очистка дополнительных ресурсов
        this.cleanup();
        
        // Вызов родительского метода
        super.destroy();
    }
    
    cleanup() {
        // Очистка слушателей событий, таймеров, etc.
    }
}
```

## 🔗 Связанные документы

- **[DIALOG_SYSTEM.md](./DIALOG_SYSTEM.md)** - архитектура системы диалогов
- **[EVENT_HANDLER_SYSTEM.md](./EVENT_HANDLER_SYSTEM.md)** - обработка событий
- **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** - руководство разработчика
- **[COMMON_MISTAKES.md](./COMMON_MISTAKES.md)** - частые ошибки

## 📝 Заключение

UI конструкторы Level Designer предоставляют мощные инструменты для создания интерфейса:

- **BaseDialog** - для всех диалогов и всплывающих окон
- **UIFactory** - для создания стандартных UI элементов
- **DialogStructures** - для использования готовых структур
- **SettingsSectionConstructor** - для создания секций настроек

Следуйте лучшим практикам и используйте эти инструменты для создания консистентного и функционального интерфейса.
