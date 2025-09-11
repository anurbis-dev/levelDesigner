// Тест наследования layerId при добавлении объектов в группы
import { Level } from '../src/models/Level.js';
import { GameObject } from '../src/models/GameObject.js';
import { Group } from '../src/models/Group.js';
import { RenderOperations } from '../src/core/RenderOperations.js';

console.log('=== ТЕСТ НАСЛЕДОВАНИЯ LAYERID ===');

// Создаем тестовый уровень
const level = new Level();
console.log('Создан уровень');

// Создаем дополнительные слои для тестирования
const layer1 = level.addLayer('Test Layer 1');
const layer2 = level.addLayer('Test Layer 2');
console.log(`Созданы дополнительные слои: ${layer1.id}, ${layer2.id}`);

// Получаем ID основного слоя
const mainLayerId = level.getMainLayerId();
console.log(`Основной слой: ${mainLayerId}`);

// Создаем mock editor для RenderOperations
const mockEditor = {
    level: level,
    effectiveLayerCache: new Map()
};

// Создаем RenderOperations для тестирования
const renderOps = new RenderOperations();
renderOps.editor = mockEditor;

// Тест 1: Объект без layerId в группе с layerId
console.log('\n--- ТЕСТ 1: Объект без layerId в группе с layerId ---');
const group1 = new Group({
    name: 'TestGroup1',
    x: 0,
    y: 0,
    layerId: layer1.id // Группа имеет определенный слой
});

const obj1 = new GameObject({
    name: 'TestObject1',
    x: 10,
    y: 10,
    layerId: null // Объект без layerId
});

group1.children.push(obj1);
level.addObject(group1);

console.log(`Группа layerId: ${group1.layerId}`);
console.log(`Объект layerId: ${obj1.layerId}`);
const effectiveLayerId1 = renderOps.getEffectiveLayerId(obj1);
console.log(`Effective layerId объекта: ${effectiveLayerId1}`);
console.log(`Ожидаемый результат: ${layer1.id}`);
console.log(`Тест 1 прошел: ${effectiveLayerId1 === layer1.id}`);

// Тест 2: Объект с собственным layerId в группе с другим layerId
console.log('\n--- ТЕСТ 2: Объект с собственным layerId в группе с другим layerId ---');
const group2 = new Group({
    name: 'TestGroup2',
    x: 50,
    y: 50,
    layerId: layer1.id // Группа имеет layer1
});

const obj2 = new GameObject({
    name: 'TestObject2',
    x: 60,
    y: 60,
    layerId: layer2.id // Объект имеет свой собственный layer2
});

group2.children.push(obj2);
level.addObject(group2);

console.log(`Группа layerId: ${group2.layerId}`);
console.log(`Объект layerId: ${obj2.layerId}`);
const effectiveLayerId2 = renderOps.getEffectiveLayerId(obj2);
console.log(`Effective layerId объекта: ${effectiveLayerId2}`);
console.log(`Ожидаемый результат: ${layer2.id} (объект использует свой собственный)`);
console.log(`Тест 2 прошел: ${effectiveLayerId2 === layer2.id}`);

// Тест 3: Объект без layerId в группе без layerId (должен наследовать основной слой)
console.log('\n--- ТЕСТ 3: Объект без layerId в группе без layerId ---');
const group3 = new Group({
    name: 'TestGroup3',
    x: 100,
    y: 100,
    layerId: null // Группа без layerId
});

const obj3 = new GameObject({
    name: 'TestObject3',
    x: 110,
    y: 110,
    layerId: null // Объект без layerId
});

group3.children.push(obj3);
level.addObject(group3);

console.log(`Группа layerId: ${group3.layerId}`);
console.log(`Объект layerId: ${obj3.layerId}`);
const effectiveLayerId3 = renderOps.getEffectiveLayerId(obj3);
console.log(`Effective layerId объекта: ${effectiveLayerId3}`);
console.log(`Ожидаемый результат: ${mainLayerId} (наследование от основного слоя)`);
console.log(`Тест 3 прошел: ${effectiveLayerId3 === mainLayerId}`);

// Тест 4: Вложенные группы - наследование через цепочку
console.log('\n--- ТЕСТ 4: Вложенные группы - наследование через цепочку ---');
const parentGroup = new Group({
    name: 'ParentGroup',
    x: 150,
    y: 150,
    layerId: layer2.id // Родительская группа имеет layer2
});

const childGroup = new Group({
    name: 'ChildGroup',
    x: 160,
    y: 160,
    layerId: null // Дочерняя группа без layerId
});

const nestedObj = new GameObject({
    name: 'NestedObject',
    x: 170,
    y: 170,
    layerId: null // Вложенный объект без layerId
});

childGroup.children.push(nestedObj);
parentGroup.children.push(childGroup);
level.addObject(parentGroup);

console.log(`Родительская группа layerId: ${parentGroup.layerId}`);
console.log(`Дочерняя группа layerId: ${childGroup.layerId}`);
console.log(`Вложенный объект layerId: ${nestedObj.layerId}`);
const effectiveLayerId4 = renderOps.getEffectiveLayerId(nestedObj);
console.log(`Effective layerId вложенного объекта: ${effectiveLayerId4}`);
console.log(`Ожидаемый результат: ${layer2.id} (наследование от родительской группы)`);
console.log(`Тест 4 прошел: ${effectiveLayerId4 === layer2.id}`);

// Тест 5: Проверка метода Group.addChild
console.log('\n--- ТЕСТ 5: Проверка метода Group.addChild ---');
const group5 = new Group({
    name: 'TestGroup5',
    x: 200,
    y: 200,
    layerId: layer1.id
});

const obj5 = new GameObject({
    name: 'TestObject5',
    x: 210,
    y: 210,
    layerId: null
});

// Используем метод addChild вместо прямого добавления
group5.addChild(obj5);
level.addObject(group5);

console.log(`Группа layerId: ${group5.layerId}`);
console.log(`Объект layerId: ${obj5.layerId}`);
const effectiveLayerId5 = renderOps.getEffectiveLayerId(obj5);
console.log(`Effective layerId объекта: ${effectiveLayerId5}`);
console.log(`Ожидаемый результат: ${layer1.id}`);
console.log(`Тест 5 прошел: ${effectiveLayerId5 === layer1.id}`);

// Тест 6: Проверка на уровне всего уровня
console.log('\n--- ТЕСТ 6: Проверка всех объектов уровня ---');
const allObjects = level.getAllObjects();
console.log(`Всего объектов в уровне: ${allObjects.length}`);

let inheritanceTestsPassed = 0;
let totalInheritanceTests = 0;

allObjects.forEach(obj => {
    if (obj.type !== 'group') { // Проверяем только объекты, не группы
        totalInheritanceTests++;
        const effectiveLayerId = renderOps.getEffectiveLayerId(obj);
        const expectedLayerId = obj.layerId ||
            (obj.parent && obj.parent.layerId) ||
            mainLayerId;

        console.log(`Объект ${obj.name}: layerId=${obj.layerId}, effective=${effectiveLayerId}, expected=${expectedLayerId}`);

        if (effectiveLayerId === expectedLayerId) {
            inheritanceTestsPassed++;
        }
    }
});

console.log(`Наследование layerId работает корректно для ${inheritanceTestsPassed}/${totalInheritanceTests} объектов`);

console.log('\n=== ТЕСТ НАСЛЕДОВАНИЯ LAYERID ЗАВЕРШЕН ===');
