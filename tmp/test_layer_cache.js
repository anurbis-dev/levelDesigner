// Тест кеширования счетчиков слоев
import { Level } from '../src/models/Level.js';
import { GameObject } from '../src/models/GameObject.js';

console.log('=== ТЕСТ КЕШИРОВАНИЯ СЧЕТЧИКОВ СЛОЕВ ===');

// Создаем тестовый уровень
const level = new Level();
console.log('Создан уровень');

// Создаем тестовые объекты
console.time('Создание 100 объектов');
for (let i = 0; i < 100; i++) {
    const obj = new GameObject({
        name: `TestObject_${i}`,
        x: i * 10,
        y: i * 10,
        width: 32,
        height: 32
    });
    level.addObject(obj);
}
console.timeEnd('Создание 100 объектов');

// Проверяем начальные счетчики
const mainLayerId = level.getMainLayerId();
console.log(`Основной слой: ${mainLayerId}`);
console.log(`Объектов в основном слое: ${level.getLayerObjectsCount(mainLayerId)}`);

// Тест кеширования - первый вызов должен вычислить, второй - взять из кеша
console.time('Первый подсчет (вычисление)');
const count1 = level.getLayerObjectsCount(mainLayerId);
console.timeEnd('Первый подсчет (вычисление)');

console.time('Второй подсчет (кеш)');
const count2 = level.getLayerObjectsCount(mainLayerId);
console.timeEnd('Второй подсчет (кеш)');

console.log(`Результаты: ${count1} === ${count2} ? ${count1 === count2}`);

// Тест изменения слоя
const testObj = level.objects[0];
const newLayerId = level.layers[1]?.id;

if (newLayerId) {
    console.log(`\nИзменяем слой объекта ${testObj.name}`);
    console.log(`Старый слой: ${testObj.layerId}`);
    console.log(`Новый слой: ${newLayerId}`);

    const oldCount = level.getLayerObjectsCount(mainLayerId);
    const newCountBefore = level.getLayerObjectsCount(newLayerId);

    level.assignObjectToLayer(testObj.id, newLayerId);

    const oldCountAfter = level.getLayerObjectsCount(mainLayerId);
    const newCountAfter = level.getLayerObjectsCount(newLayerId);

    console.log(`Старый слой (${mainLayerId}): ${oldCount} → ${oldCountAfter}`);
    console.log(`Новый слой (${newLayerId}): ${newCountBefore} → ${newCountAfter}`);
    console.log(`Кеш обновлен корректно: ${oldCountAfter === oldCount - 1 && newCountAfter === newCountBefore + 1}`);
} else {
    console.log('Недостаточно слоев для теста изменения слоя');
}

console.log('\n=== ТЕСТ ЗАВЕРШЕН ===');
