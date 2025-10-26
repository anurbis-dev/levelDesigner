# 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ ДУБЛИРОВАНИЯ СОБЫТИЙ

## 📋 **НАЙДЕННЫЕ ПРОБЛЕМЫ:**

### **1. AssetPanel.js - множественные прямые addEventListener**
**Элементы с прямыми обработчиками:**
- `foldersResizer` - dblclick, mousedown
- `document` - mousemove, mouseup (глобальные)
- `window` - resize
- `tabButton` - click
- `thumb/item/row` - click, dblclick, dragstart, dragend
- `tabsContainer` - mousedown, mousemove, selectstart
- `dropZone` - dragenter, dragover, dragleave, drop

**Проблема**: Эти элементы могут конфликтовать с EventHandlerManager

### **2. PanelPositionManager.js - дублирование resizer событий**
**Элементы с прямыми обработчиками:**
- `resizer` - dblclick, mousedown
- `document` - mousemove, mouseup (глобальные)
- `tabContainer` - mousedown, mousemove, mouseup, selectstart

**Проблема**: Resizer события могут дублироваться

### **3. LayersPanel.js - множественные обработчики**
**Элементы с прямыми обработчиками:**
- `targetContainer` - contextmenu
- `colorInput` - change, blur
- `document` - keydown
- `nameDisplays` - dblclick
- `nameInputs` - blur, keypress, keydown
- `parallaxInputs` - input, blur
- `layerItems` - contextmenu
- `colorIndicators` - click
- `layersList` - dragstart, dragend, dragover, drop

**Проблема**: Множественные обработчики без централизованного управления

### **4. TouchSupportManager.js - дублирование touch событий**
**Элементы с прямыми обработчиками:**
- `element` - touchstart, touchmove, touchend, touchcancel

**Проблема**: Дублирует UnifiedTouchManager

## 🔧 **ПЛАН ИСПРАВЛЕНИЯ:**

### **Приоритет 1: Критические дублирования**
1. **TouchSupportManager.js** - заменить на UnifiedTouchManager
2. **PanelPositionManager.js** - заменить resizer события на EventHandlerManager
3. **AssetPanel.js** - заменить resizer события на EventHandlerManager

### **Приоритет 2: Множественные обработчики**
4. **LayersPanel.js** - централизовать через EventHandlerManager
5. **AssetPanel.js** - централизовать tab и drag события

### **Приоритет 3: Глобальные события**
6. **Все компоненты** - заменить document/window события на EventHandlerManager

## ⚠️ **РИСКИ:**

### **Высокий риск:**
- **TouchSupportManager** конфликтует с UnifiedTouchManager
- **Resizer события** могут дублироваться между компонентами
- **Глобальные события** (document, window) могут накапливаться

### **Средний риск:**
- **Tab события** могут конфликтовать
- **Drag события** могут дублироваться
- **Context menu события** могут накапливаться

## 🎯 **РЕКОМЕНДАЦИИ:**

### **Немедленные действия:**
1. **Отключить TouchSupportManager** - использовать только UnifiedTouchManager
2. **Проверить resizer дублирование** - убедиться, что каждый resizer регистрируется один раз
3. **Централизовать глобальные события** - использовать EventHandlerManager

### **Долгосрочные действия:**
4. **Мигрировать все компоненты** на EventHandlerManager
5. **Создать утилиты** для типовых обработчиков
6. **Добавить проверки дублирования** в каждый компонент

## 📊 **СТАТИСТИКА:**

### **Файлы с прямыми addEventListener:**
- **UI компоненты**: 15 файлов
- **Менеджеры**: 4 файла  
- **Утилиты**: 18 файлов
- **Всего**: 37 файлов

### **Потенциальные дублирования:**
- **Touch события**: TouchSupportManager vs UnifiedTouchManager
- **Resizer события**: AssetPanel vs PanelPositionManager
- **Tab события**: AssetPanel vs EventHandlers
- **Глобальные события**: множественные document/window обработчики

## 🚨 **КРИТИЧНОСТЬ:**

### **Критично (требует немедленного исправления):**
- TouchSupportManager дублирование
- Resizer события дублирование
- Глобальные события накопление

### **Важно (требует исправления в ближайшее время):**
- Tab события централизация
- Drag события централизация
- Context menu события централизация

### **Желательно (можно исправить позже):**
- Остальные UI компоненты
- Утилиты
- Вспомогательные обработчики
