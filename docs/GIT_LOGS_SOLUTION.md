# Git Workflow и получение логов - Полное руководство

## Проблема
Команды `git log` подвисают в терминале из-за пейджера, что не позволяет агенту читать результаты. Также отсутствуют удобные инструменты для работы с git в проекте.

## Решение
Создана комплексная система для работы с git, включающая специальные батники, утилиты и веб-интерфейс.

## 🚀 Специальные батники проекта

### 1. `start_server.bat` - Запуск сервера разработки
```batch
@echo off
echo Starting Level Editor development server...
python -m http.server 8000
pause
```

**Назначение:**
- Автоматический запуск локального сервера для разработки
- Открытие браузера с редактором уровней
- Простое управление сервером разработки

**Использование:**
- Двойной клик для запуска
- Автоматическое открытие `http://localhost:8000`
- `Ctrl+C` для остановки сервера

### 2. `start_server.ps1` - PowerShell версия запуска
```powershell
Write-Host "Starting Level Editor development server..." -ForegroundColor Green
python -m http.server 8000
```

**Преимущества:**
- Цветной вывод в консоли
- Лучшая интеграция с Windows PowerShell
- Расширенные возможности настройки

## 📋 Git утилиты для получения логов

### 1. PowerShell скрипт (`tmp/gitUtils/get_git_logs.ps1`)
```powershell
# Использование:
.\tmp\gitUtils\get_git_logs.ps1 [количество_коммитов] [файл_вывода]

# Примеры:
.\tmp\gitUtils\get_git_logs.ps1 10                    # Последние 10 коммитов
.\tmp\gitUtils\get_git_logs.ps1 5 logs.txt           # 5 коммитов в файл logs.txt
```

**Особенности:**
- Отключает пейджер через `$env:GIT_PAGER = "cat"`
- Сохраняет результат в файл
- Выводит результат в консоль
- Обрабатывает ошибки
- Цветной вывод для лучшей читаемости

### 2. Batch скрипт (`tmp/gitUtils/get_git_logs.bat`)
```batch
REM Использование:
tmp\gitUtils\get_git_logs.bat [количество_коммитов] [файл_вывода]

REM Примеры:
tmp\gitUtils\get_git_logs.bat 10
tmp\gitUtils\get_git_logs.bat 5 logs.txt
```

**Особенности:**
- Совместимость с Windows CMD
- Простая настройка параметров по умолчанию
- Автоматическое отображение результата
- Работает без PowerShell

### 3. JavaScript утилита (`src/utils/GitUtils.js`)
```javascript
// Получение логов
const logs = await GitUtils.getLogs(10);

// Сохранение в файл
await GitUtils.saveLogsToFile(5, 'logs.txt');

// Получение статуса
const status = await GitUtils.getStatus();

// Получение текущей ветки
const branch = await GitUtils.getCurrentBranch();
```

### 4. HTML просмотрщик (`tmp/gitUtils/git_logs_viewer.html`)
Веб-интерфейс для просмотра git логов с возможностями:
- Настройка количества коммитов
- Просмотр статуса Git
- Отображение текущей ветки
- Удобный интерфейс

**Использование:**
- Откройте `tmp/gitUtils/git_logs_viewer.html` в браузере
- Или запустите через локальный сервер: `http://localhost:8000/tmp/gitUtils/git_logs_viewer.html`

## 🔄 Полный Git Workflow для проекта

### Стандартный процесс работы с git:

1. **Проверка статуса:**
   ```bash
   git status
   ```

2. **Получение логов (безопасно):**
   ```bash
   # Используйте батники вместо прямых команд
   .\tmp\gitUtils\get_git_logs.ps1 10
   # или
   tmp\gitUtils\get_git_logs.bat 10
   ```

3. **Добавление изменений:**
   ```bash
   git add .
   # или выборочно
   git add src/core/LevelEditor.js
   ```

4. **Коммит с версионированием:**
   ```bash
   git commit -m "v2.2.0: Описание изменений"
   ```

5. **Пуш в репозиторий:**
   ```bash
   git push origin master
   ```

### Автоматизация через батники:

**Используйте `tmp/gitUtils/git_workflow.bat` для полной автоматизации:**
```batch
@echo off
echo === Level Editor Git Workflow ===
echo.

echo 1. Checking git status...
git status
echo.

echo 2. Getting recent logs...
call tmp\gitUtils\get_git_logs.bat 5
echo.

echo 3. Adding all changes...
git add .
echo.

echo 4. Committing changes...
git commit -m "v2.2.0: Automated commit - %date% %time%"
echo.

echo 5. Pushing to repository...
git push origin master
echo.

echo === Workflow completed ===
pause
```

## 🎯 Рекомендации по использованию

### Для агента AI:
1. **PowerShell скрипт** - основной метод для Windows
2. **Batch скрипт** - резервный метод
3. **JavaScript утилита** - для интеграции в код
4. **HTML просмотрщик** - для визуального анализа

### Команды для терминала:
```bash
# Безопасное получение логов (используйте батники)
.\tmp\gitUtils\get_git_logs.ps1 10
tmp\gitUtils\get_git_logs.bat 10

# Прямые команды (если батники недоступны)
git --no-pager log --oneline -10
set GIT_PAGER=cat && git log --oneline -10
```

### Для разработчиков:
- Используйте `GitUtils.js` в Node.js проектах
- Интегрируйте скрипты в CI/CD процессы
- Настройте алиасы для удобства
- Создайте собственные батники для частых операций

## Тестирование
Все методы протестированы и работают корректно:
- ✅ PowerShell скрипт
- ✅ Batch скрипт  
- ✅ JavaScript утилита (требует Node.js)
- ✅ HTML просмотрщик

## 📁 Файлы решения

### Специальные батники проекта:
- `start_server.bat` - Запуск сервера разработки (Windows CMD)
- `start_server.ps1` - Запуск сервера разработки (PowerShell)

### Git утилиты (основные файлы в tmp/gitUtils/):
- `tmp/gitUtils/get_git_logs.ps1` - PowerShell скрипт для получения логов
- `tmp/gitUtils/get_git_logs.bat` - Batch скрипт для получения логов
- `src/utils/GitUtils.js` - JavaScript утилита для программной работы
- `tmp/gitUtils/git_logs_viewer.html` - HTML просмотрщик логов

### Дополнительные батники (основные файлы в tmp/gitUtils/):
- `tmp/gitUtils/git_workflow.bat` - Полная автоматизация git операций
- `tmp/gitUtils/git_status.bat` - Быстрая проверка статуса
- `tmp/gitUtils/git_commit.bat` - Быстрый коммит с версионированием

### Обёртки для удобства (в корневой папке):
- `get_git_logs.bat` - Обёртка для `tmp/gitUtils/get_git_logs.bat`
- `get_git_logs.ps1` - Обёртка для `tmp/gitUtils/get_git_logs.ps1`
- `git_workflow.bat` - Обёртка для `tmp/gitUtils/git_workflow.bat`
- `git_status.bat` - Обёртка для `tmp/gitUtils/git_status.bat`
- `git_commit.bat` - Обёртка для `tmp/gitUtils/git_commit.bat`

## 🚀 Быстрый старт

### Для агента AI:
1. Используйте `.\get_git_logs.ps1 10` для получения логов (обёртка)
2. Используйте `.\git_status.bat` для проверки статуса (обёртка)
3. Следуйте стандартному workflow выше

### Для разработчиков:
1. Запустите `start_server.bat` для разработки
2. Используйте `tmp/gitUtils/git_logs_viewer.html` для анализа истории
3. Используйте обёртки в корневой папке для удобства
4. Или используйте прямые пути к `tmp/gitUtils/` для прямого доступа
