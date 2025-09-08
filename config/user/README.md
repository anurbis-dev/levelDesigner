# Пользовательские настройки Level Editor

## Как работают настройки

### 🏗️ **Двухуровневая система конфигурации**

1. **Дефолтные настройки** (`config/defaults/`) - базовые настройки редактора
2. **Пользовательские настройки** - переопределяют дефолтные

### 💾 **Где сохраняются настройки**

#### В браузере (основной способ):
- **localStorage** - автоматически сохраняются при изменениях
- **Ключи**: `levelEditor_userConfig_editor`, `levelEditor_userConfig_ui`, etc.
- **Преимущества**: Быстро, автоматически, работает везде

#### В файлах (для продвинутых пользователей):
- **Папка**: `config/user/`
- **Формат**: JSON файлы
- **Преимущества**: Можно версионировать, делиться, резервное копирование

## 📁 **Структура пользовательских настроек**

```
config/user/
├── README.md              # Эта документация
├── example-ui.json        # Пример UI настроек
├── example-canvas.json    # Пример canvas настроек
├── editor.json            # Настройки редактора (создать при необходимости)
├── ui.json                # UI настройки (создать при необходимости)
├── canvas.json            # Canvas настройки (создать при необходимости)
└── panels.json            # Настройки панелей (создать при необходимости)
```

## 🎨 **Примеры пользовательских настроек**

### UI настройки (`ui.json`):
```json
{
  "fontScale": 1.2,
  "theme": "light",
  "rightPanelWidth": 400,
  "consoleHeight": 400,
  "assetsPanelHeight": 300,
  "consoleVisible": true
}
```

### Canvas настройки (`canvas.json`):
```json
{
  "backgroundColor": "#2D3748",
  "gridSize": 64,
  "showGrid": true,
  "gridColor": "#4A5568",
  "gridOpacity": 0.3
}
```

### Editor настройки (`editor.json`):
```json
{
  "autoSave": true,
  "autoSaveInterval": 60000,
  "undoHistoryLimit": 100,
  "showFPS": true
}
```

## 🔧 **Как создать пользовательские настройки**

### Способ 1: Через интерфейс редактора
1. Откройте настройки редактора
2. Измените нужные параметры
3. Настройки автоматически сохранятся в localStorage

### Способ 2: Создать JSON файлы
1. Скопируйте примеры из `example-*.json`
2. Переименуйте в нужные имена (`ui.json`, `canvas.json`, etc.)
3. Отредактируйте значения под свои предпочтения
4. Перезапустите редактор

### Способ 3: Через консоль браузера
```javascript
// Сохранить UI настройки
editor.configManager.saveUserConfig('ui', {
  fontScale: 1.5,
  theme: 'dark',
  rightPanelWidth: 350
});

// Сохранить Canvas настройки
editor.configManager.saveUserConfig('canvas', {
  backgroundColor: '#1A202C',
  gridSize: 48,
  showGrid: true
});
```

## 📋 **Доступные настройки**

### UI настройки (`ui.json`):
- `fontScale` - масштаб шрифта (0.5 - 2.0)
- `theme` - тема интерфейса ('dark', 'light')
- `rightPanelWidth` - ширина правой панели (px)
- `consoleHeight` - высота консоли (px)
- `assetsPanelHeight` - высота панели ассетов (px)
- `consoleVisible` - видимость консоли (true/false)
- `compactMode` - компактный режим (true/false)

### Canvas настройки (`canvas.json`):
- `backgroundColor` - цвет фона (#hex)
- `gridSize` - размер сетки (px)
- `showGrid` - показывать сетку (true/false)
- `gridColor` - цвет сетки (#hex)
- `gridOpacity` - прозрачность сетки (0.0 - 1.0)
- `snapToGrid` - привязка к сетке (true/false)

### Editor настройки (`editor.json`):
- `autoSave` - автосохранение (true/false)
- `autoSaveInterval` - интервал автосохранения (ms)
- `undoHistoryLimit` - лимит истории отмены (число)
- `showFPS` - показывать FPS (true/false)
- `showObjectCount` - показывать количество объектов (true/false)

### Panels настройки (`panels.json`):
- `rightPanelTabOrder` - порядок вкладок правой панели
- `assetTabOrder` - порядок вкладок ассетов
- `selection.*` - настройки выделения объектов

## 🔄 **Приоритет загрузки настроек**

1. **Пользовательские файлы** (`config/user/*.json`) - высший приоритет
2. **localStorage** - средний приоритет
3. **Дефолтные настройки** (`config/defaults/*.json`) - базовый уровень

## ⚠️ **Важные замечания**

- **Файлы в `config/user/` не версионируются** в git (добавлены в .gitignore)
- **localStorage очищается** при очистке данных браузера
- **Рекомендуется** использовать localStorage для обычной работы
- **JSON файлы** полезны для резервного копирования и обмена настройками

## 🆘 **Устранение неполадок**

### Настройки не применяются:
1. Проверьте синтаксис JSON файлов
2. Убедитесь, что файлы находятся в `config/user/`
3. Перезапустите редактор
4. Проверьте консоль браузера на ошибки

### Сброс к дефолтным настройкам:
```javascript
// Очистить localStorage
localStorage.removeItem('levelEditor_userConfig_ui');
localStorage.removeItem('levelEditor_userConfig_canvas');
localStorage.removeItem('levelEditor_userConfig_editor');
localStorage.removeItem('levelEditor_userConfig_panels');

// Перезапустить редактор
location.reload();
```
