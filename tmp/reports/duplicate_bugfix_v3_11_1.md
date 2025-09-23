# Отчет об исправлении бага дублирования множественных объектов
**Версия:** 3.11.1
**Дата:** 23 сентября 2025
**Тип изменения:** Patch (исправление бага)

## Проблема

Дублирование множества выбранных объектов (Shift+D) работало некорректно - все дублированные объекты размещались в одной точке вместо сохранения своих относительных позиций.

## Корень проблемы

В методе `startFromSelection()` класса `DuplicateOperations` была неправильная последовательность операций:

1. Сначала все клонированные объекты устанавливались на одну позицию курсора
2. Затем рассчитывались относительные смещения на основе уже измененных позиций

Это приводило к тому, что все объекты получали нулевые смещения (`offsetX = 0`, `offsetY = 0`) и при размещении оказывались на одной точке.

## Исправление

**Файл:** `src/core/DuplicateOperations.js`

**Изменения:**
- Переместил вызов `initializePositions()` перед установкой позиций объектов
- Теперь смещения рассчитываются на основе оригинальных позиций объектов, а не измененных
- Упростил код, используя метод `getSelectedObjects()` из `BaseModule`

**Код до исправления:**
```javascript
// Set correct initial positions for all clones
clones.forEach((cloned, index) => {
    cloned.x = worldPos.x;
    cloned.y = worldPos.y;
});

// Initialize offsets relative to the cursor (now with adjusted worldPos)
const initialized = this.editor.duplicateRenderUtils.initializePositions(clones, worldPos, this.editor);
```

**Код после исправления:**
```javascript
// Initialize offsets relative to the cursor BEFORE setting positions
// This ensures we calculate offsets based on original object positions
const initialized = this.editor.duplicateRenderUtils.initializePositions(clones, worldPos, this.editor);

// Apply initial positions so preview is visible immediately (even without mouse move)
const positioned = this.editor.duplicateRenderUtils.updatePositions(initialized, worldPos, this.editor);
```

## Тестирование

- ✅ Дублирование одиночных объектов работает корректно
- ✅ Дублирование множественных объектов сохраняет относительные позиции
- ✅ Дублирование групп объектов работает корректно
- ✅ Предварительный просмотр дублирования отображается правильно
- ✅ Отмена дублирования работает корректно

## Влияние

- **Функциональность:** Восстановлена работа дублирования множественных объектов
- **Производительность:** Без изменений
- **Совместимость:** Полностью обратно совместимо
- **Документация:** Требует обновления с описанием исправления

## Следующие шаги

1. Обновить основную документацию
2. Синхронизировать версию в package.json
3. Создать Git коммит с новой версией
4. Запушить изменения в репозиторий
