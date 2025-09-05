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

### 1. PowerShell скрипт (`get_git_logs.ps1`)
```powershell
# Использование:
.\get_git_logs.ps1 [количество_коммитов] [файл_вывода]

# Примеры:
.\get_git_logs.ps1 10                    # Последние 10 коммитов
.\get_git_logs.ps1 5 logs.txt           # 5 коммитов в файл logs.txt
```

**Особенности:**
- Отключает пейджер через `$env:GIT_PAGER = "cat"`
- Сохраняет результат в файл
- Выводит результат в консоль
- Обрабатывает ошибки
- Цветной вывод для лучшей читаемости

### 2. Batch скрипт (`get_git_logs.bat`)
```batch
REM Использование:
get_git_logs.bat [количество_коммитов] [файл_вывода]

REM Примеры:
get_git_logs.bat 10
get_git_logs.bat 5 logs.txt
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

### 4. HTML просмотрщик (`git_logs_viewer.html`)
Веб-интерфейс для просмотра git логов с возможностями:
- Настройка количества коммитов
- Просмотр статуса Git
- Отображение текущей ветки
- Удобный интерфейс

## 🔄 Полный Git Workflow для проекта

### Стандартный процесс работы с git:

1. **Проверка статуса:**
   ```bash
   git status
   ```

2. **Получение логов (безопасно):**
   ```bash
   # Используйте батники вместо прямых команд
   .\get_git_logs.ps1 10
   # или
   get_git_logs.bat 10
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

**Создайте `git_workflow.bat` для полной автоматизации:**
```batch
@echo off
echo === Level Editor Git Workflow ===
echo.

echo 1. Checking git status...
git status
echo.

echo 2. Getting recent logs...
call get_git_logs.bat 5
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
.\get_git_logs.ps1 10
get_git_logs.bat 10

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

### Git утилиты:
- `get_git_logs.ps1` - PowerShell скрипт для получения логов
- `get_git_logs.bat` - Batch скрипт для получения логов
- `src/utils/GitUtils.js` - JavaScript утилита для программной работы
- `git_logs_viewer.html` - HTML просмотрщик логов

### Рекомендуемые дополнительные батники:
- `git_workflow.bat` - Полная автоматизация git операций (создать)
- `git_status.bat` - Быстрая проверка статуса (создать)
- `git_commit.bat` - Быстрый коммит с версионированием (создать)

## 🚀 Быстрый старт

### Для агента AI:
1. Используйте `.\get_git_logs.ps1 10` для получения логов
2. Используйте `git status` для проверки изменений
3. Следуйте стандартному workflow выше

### Для разработчиков:
1. Запустите `start_server.bat` для разработки
2. Используйте `git_logs_viewer.html` для анализа истории
3. Создайте собственные батники для автоматизации
