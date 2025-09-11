// Тест исправлений наследования layerId
import { Level } from '../src/models/Level.js';
import { GameObject } from '../src/models/GameObject.js';
import { Group } from '../src/models/Group.js';

console.log('=== ТЕСТ ИСПРАВЛЕНИЙ НАСЛЕДОВАНИЯ LAYERID ===');

try {
    // Создаем тестовый уровень
    const level = new Level();
    console.log('Создан уровень');

    // Создаем дополнительные слои для тестирования
    const layer1 = level.addLayer('Test Layer 1');
    console.log(`Создан слой: ${layer1.id}`);

    // Получаем ID основного слоя
    const mainLayerId = level.getMainLayerId();
    console.log(`Основной слой: ${mainLayerId}`);

    // Тест 1: Добавление объекта в группу через addChild
    console.log('\n--- ТЕСТ 1: Group.addChild() ---');
    const group1 = new Group({
        name: 'TestGroup1',
        x: 0,
        y: 0,
        layerId: layer1.id
    });

    const obj1 = new GameObject({
        name: 'TestObject1',
        x: 10,
        y: 10,
        layerId: null // Объект без layerId
    });

    console.log(`Группа layerId: ${group1.layerId}`);
    console.log(`Объект layerId до addChild: ${obj1.layerId}`);

    group1.addChild(obj1);
    level.addObject(group1);

    console.log(`Объект layerId после addChild: ${obj1.layerId}`);
    console.log(`Тест 1: ${obj1.layerId === layer1.id ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);

    // Тест 2: Вложенные группы
    console.log('\n--- ТЕСТ 2: Вложенные группы ---');
    const parentGroup = new Group({
        name: 'ParentGroup',
        x: 100,
        y: 100,
        layerId: layer1.id
    });

    const childGroup = new Group({
        name: 'ChildGroup',
        x: 110,
        y: 110,
        layerId: null
    });

    const nestedObj = new GameObject({
        name: 'NestedObject',
        x: 120,
        y: 120,
        layerId: null
    });

    console.log(`Родительская группа layerId: ${parentGroup.layerId}`);
    console.log(`Дочерняя группа layerId до: ${childGroup.layerId}`);
    console.log(`Вложенный объект layerId до: ${nestedObj.layerId}`);

    childGroup.addChild(nestedObj);
    parentGroup.addChild(childGroup);
    level.addObject(parentGroup);

    console.log(`Дочерняя группа layerId после: ${childGroup.layerId}`);
    console.log(`Вложенный объект layerId после: ${nestedObj.layerId}`);
    console.log(`Тест 2: ${childGroup.layerId === layer1.id && nestedObj.layerId === layer1.id ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);

    console.log('\n=== ТЕСТ ЗАВЕРШЕН ===');

} catch (error) {
    console.error('Ошибка выполнения теста:', error);
}
