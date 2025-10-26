# Тестирование системы событий v3.52.5

## 🧪 Как запустить тесты

### 1. Запустите редактор
```bash
start_Editor.bat
```

### 2. Откройте консоль браузера (F12)

### 3. Загрузите простой тест
```javascript
// Загрузите модуль теста
import('./src/event-system/SimpleEventTest.js').then(module => {
    const test = new module.SimpleEventTest();
    test.runBasicTests();
});
```

### 4. Или запустите полный тест интеграции
```javascript
// Загрузите модуль теста
import('./src/event-system/EventSystemIntegrationTest.js').then(module => {
    const test = new module.EventSystemIntegrationTest();
    test.runTests();
});
```

## 🔍 Что проверяют тесты

### SimpleEventTest
- ✅ Существование EventHandlerManager
- ✅ Существование UnifiedTouchManager  
- ✅ Базовая регистрация элементов
- ✅ Очистка элементов

### EventSystemIntegrationTest
- ✅ Инициализация UnifiedTouchManager
- ✅ Регистрация touch элементов
- ✅ Регистрация canvas с mouse + touch
- ✅ Очистка всех элементов

### TouchGestureTest
- ✅ Все touch жесты (pan, zoom, marquee, context)
- ✅ Интеграция с LevelEditor
- ✅ Обработка событий

## 🚨 Возможные ошибки

### "TouchSupportAdapter is not defined"
- **Причина**: Тест ссылается на удаленный файл
- **Решение**: Используйте обновленные тесты

### "UnifiedTouchManager is not defined"
- **Причина**: Модуль не загружен
- **Решение**: Убедитесь, что UnifiedTouchManager.js существует

### "EventHandlerManager methods not found"
- **Причина**: Старая версия EventHandlerManager
- **Решение**: Обновите EventHandlerManager.js

## 📊 Интерпретация результатов

### ✅ PASS - Тест прошел
Система работает корректно

### ❌ FAIL - Тест не прошел
Есть проблемы в коде, нужно исправить

### ⏭️ SKIP - Тест пропущен
Зависимости недоступны, но это нормально

## 🛠️ Отладка

Если тесты не проходят:

1. **Проверьте консоль браузера** на ошибки
2. **Убедитесь, что все файлы загружены**
3. **Проверьте, что EventHandlerManager инициализирован**
4. **Убедитесь, что UnifiedTouchManager создан**

## 📝 Пример успешного вывода

```
🧪 Starting Simple Event System Tests...

📊 Simple Test Results:
========================
✅ EventHandlerManager exists
✅ UnifiedTouchManager exists  
✅ Basic element registration

📈 Summary:
✅ Passed: 3
❌ Failed: 0
⏭️ Skipped: 0
📊 Total: 3

🎉 All tests passed! Event system is working correctly.
```
