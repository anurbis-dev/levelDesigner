# Context Map - Level Designer

## 📚 Документы для работы с проектом

### 🔧 Основные документы (обязательные для изучения)

1. **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - архитектура проекта, менеджеры, модули
2. **[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)** - настройка, логирование, правила кода
3. **[QUICK_START.md](./docs/QUICK_START.md)** - быстрый запуск, операции, интерфейс
4. **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - API методы, примеры использования
5. **[TOUCH_SUPPORT.md](./docs/TOUCH_SUPPORT.md)** - тач-события, жесты, блокировка
6. **[MOBILE_INTERFACE_SYSTEM.md](./docs/MOBILE_INTERFACE_SYSTEM.md)** - мобильный интерфейс
7. **[EVENT_HANDLER_SYSTEM.md](./docs/EVENT_HANDLER_SYSTEM.md)** - обработчики событий

### 📁 Панель Content
- Левая сторона Assets (можно переключить вправо)
- Древовидная структура папок из ./content
- Клик по папке → выбор и фильтрация табов

### 📦 Система ассетов
- Автоматическое сканирование ./content при старте
- Манифест: content/manifest.json
- Обновление: update_manifest.bat
- JSON файлы с полями name, type, imgSrc, width, height, color, properties

### 🎮 Тач-поддержка (v3.51.7)
- TouchSupportManager - центральный менеджер
- BrowserGesturePreventionManager - блокировка жестов
- Canvas pan/zoom - жесты двумя пальцами

### 📖 Дополнительные документы

- **[USER_MANUAL.md](./docs/USER_MANUAL.md)** - руководство пользователя
- **[VERSIONING_GUIDE.md](./docs/VERSIONING_GUIDE.md)** - версионирование
- **[CHANGELOG.md](./docs/CHANGELOG.md)** - история изменений
- **[COMMON_MISTAKES.md](./docs/COMMON_MISTAKES.md)** - частые ошибки
- **[README.md](./docs/README.md)** - обзор документации
- **[content/README.md](./content/README.md)** - структура ассетов

### 🎯 Приоритеты

1. **ARCHITECTURE.md** - структура проекта
2. **DEVELOPMENT_GUIDE.md** - правила работы
3. **API_REFERENCE.md** - использование API
4. **QUICK_START.md** - запуск и операции
