# Решение проблемы с получением Git логов

## Проблема
Команды `git log` подвисают в терминале из-за пейджера, что не позволяет агенту читать результаты.

## Решение
Созданы несколько простых и надёжных методов для безопасного получения git логов:

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

## Рекомендации по использованию

### Для агента AI:
1. **PowerShell скрипт** - основной метод для Windows
2. **Batch скрипт** - резервный метод
3. **JavaScript утилита** - для интеграции в код

### Команды для терминала:
```bash
# Безопасное получение логов
git --no-pager log --oneline -10

# Или с переменной окружения
set GIT_PAGER=cat && git log --oneline -10
```

### Для разработчиков:
- Используйте `GitUtils.js` в Node.js проектах
- Интегрируйте скрипты в CI/CD процессы
- Настройте алиасы для удобства

## Тестирование
Все методы протестированы и работают корректно:
- ✅ PowerShell скрипт
- ✅ Batch скрипт  
- ✅ JavaScript утилита (требует Node.js)
- ✅ HTML просмотрщик

## Файлы решения
- `get_git_logs.ps1` - PowerShell скрипт
- `get_git_logs.bat` - Batch скрипт
- `src/utils/GitUtils.js` - JavaScript утилита
- `git_logs_viewer.html` - HTML просмотрщик
- `test_git_utils.js` - тестовый скрипт
