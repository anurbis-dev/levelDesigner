// Тест индекса объектов для быстрого поиска
import { Level } from '../src/models/Level.js';
import { GameObject } from '../src/models/GameObject.js';

console.log('=== ТЕСТ ИНДЕКСА ОБЪЕКТОВ ===');

// Создаем тестовый уровень
const level = new Level();
console.log('Создан уровень');

// Создаем иерархическую структуру объектов
console.time('Создание иерархической структуры');
const group1 = new GameObject({
    name: 'Group1',
    type: 'group',
    x: 0,
    y: 0,
    width: 100,
    height: 100
});
group1.children = [];

for (let i = 0; i < 50; i++) {
    const obj = new GameObject({
        name: `Object_${i}`,
        x: i * 10,
        y: i * 10,
        width: 32,
        height: 32
    });
    group1.children.push(obj);
}

const group2 = new GameObject({
    name: 'Group2',
    type: 'group',
    x: 200,
    y: 0,
    width: 100,
    height: 100
});
group2.children = [];

for (let i = 50; i < 100; i++) {
    const obj = new GameObject({
        name: `Object_${i}`,
        x: i * 10,
        y: i * 10,
        width: 32,
        height: 32
    });
    group2.children.push(obj);
}

level.addObject(group1);
level.addObject(group2);

// Добавляем еще 50 одиночных объектов
for (let i = 100; i < 150; i++) {
    const obj = new GameObject({
        name: `Single_${i}`,
        x: i * 5,
        y: i * 5,
        width: 32,
        height: 32
    });
    level.addObject(obj);
}
console.timeEnd('Создание иерархической структуры');

console.log(`Создано: ${level.objects.length} top-level объектов`);
console.log(`Всего объектов: ${level.getAllObjects().length}`);

// Строим индекс
console.time('Построение индекса');
level.buildObjectsIndex();
console.timeEnd('Построение индекса');

// Тест поиска объектов
const testObjId = group1.children[10].id;
const testGroupId = group2.id;

console.log(`\nТестируем поиск объекта ${testObjId}:`);

// Тест быстрого поиска
console.time('Быстрый поиск через индекс');
const fastResult = level.findObjectByIdFast(testObjId);
console.timeEnd('Быстрый поиск через индекс');

console.time('Стандартный поиск');
const standardResult = level.findObjectById(testObjId);
console.timeEnd('Стандартный поиск');

console.log(`Результаты совпадают: ${fastResult?.id === standardResult?.id}`);

// Тест поиска top-level объекта
console.log(`\nТестируем поиск top-level объекта для ${testObjId}:`);

console.time('Быстрый поиск top-level');
const fastTopLevel = level.findTopLevelObjectFast(testObjId);
console.timeEnd('Быстрый поиск top-level');

console.log(`Найден top-level объект: ${fastTopLevel?.name} (id: ${fastTopLevel?.id})`);

// Тест проверки принадлежности группе
console.log(`\nТестируем проверку принадлежности группе:`);
console.time('Проверка принадлежности группе');
const isDescendant = level.isObjectDescendantOfGroupFast(testObjId, group1.id);
console.timeEnd('Проверка принадлежности группе');

console.log(`Объект ${testObjId} является потомком группы ${group1.name}: ${isDescendant}`);

// Тест производительности множественного поиска
console.log(`\nТест множественного поиска (100 объектов):`);
const testIds = level.getAllObjects().slice(0, 100).map(obj => obj.id);

console.time('Множественный поиск через индекс');
const fastResults = testIds.map(id => level.findObjectByIdFast(id));
console.timeEnd('Множественный поиск через индекс');

console.time('Множественный поиск стандартный');
const standardResults = testIds.map(id => level.findObjectById(id));
console.timeEnd('Множественный поиск стандартный');

const allMatch = fastResults.every((fast, i) => fast?.id === standardResults[i]?.id);
console.log(`Все результаты совпадают: ${allMatch}`);

console.log('\n=== ТЕСТ ЗАВЕРШЕН ===');
