# Dialog System Architecture

## 📋 Обзор

Система диалогов Level Editor обеспечивает единообразное поведение всех всплывающих окон с фиксированной высотой и динамической шириной.

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

## 🔄 Критические изменения

### Полная пересборка Settings Panel
- **Все методы render** переведены на рефакторированные конструкторы
- **Удален дублирующий код** (~400+ строк HTML)
- **DialogSizeManager обновлен** для работы с новой структурой
- **Добавлена поддержка stateManager** в рефакторированных рендерерах

### Обновленные компоненты:
- `renderGeneralSettings()` → `renderGeneralSettingsRefactored()`
- `renderColorsSettings()` → `renderColorsSettingsRefactored()`
- `renderSelectionSettings()` → `renderSelectionSettingsRefactored()`
- `renderCameraSettings()` → `renderCameraSettingsRefactored()`
- `renderAssetsSettings()` → `renderAssetsSettingsRefactored()`
- `renderPerformanceSettings()` → `renderPerformanceSettingsRefactored()`

### DialogSizeManager
- **Добавлен параметр `stateManager`** для рефакторированных рендереров
- **Автоматическое определение** рефакторированных функций по имени
- **Поддержка передачи stateManager** в рефакторированные функции
- **Обновлен метод `updateDialogSize()`** в SettingsPanel

## ⚠️ Принципы

- **SettingsPanel всегда создается с levelEditor** - проверки на `stateManager` избыточны
- **Используйте наследование** от BaseDialog
- **НЕ дублируйте логику** - используйте super.method()
- **НЕ добавляйте проверки** `if (!stateManager)` - это нарушает архитектуру

## Использование

```javascript
// Простой диалог
const config = {
    ...getDialogStructure('standard'),
    title: 'My Dialog',
    contentRenderer: () => '<div>Content</div>'
};
const dialog = new BaseDialog(config);
dialog.show();
```

## CSS классы

- `.dialog-overlay` - оверлей
- `.dialog-container` - контейнер
- `.dialog-header` - заголовок
- `.dialog-content` - контент
- `.dialog-footer` - подвал

## Параметры

- `id` - идентификатор
- `title` - заголовок
- `width` - ширина (auto)
- `height` - высота (calc(100vh - 4rem))
- `showCloseButton` - кнопка закрытия
- `showFooter` - подвал
- `footerButtons` - кнопки подвала
- `contentRenderer` - функция рендера контента
