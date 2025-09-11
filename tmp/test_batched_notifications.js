// Тест группировки уведомлений для оптимизации производительности
import { Level } from '../src/models/Level.js';
import { GameObject } from '../src/models/GameObject.js';

console.log('=== ТЕСТ ГРУППИРОВКИ УВЕДОМЛЕНИЙ ===');

// Создаем тестовый уровень
const level = new Level();

// Создаем mock LevelEditor для тестирования
const mockStateManager = {
    listeners: new Map(),
    notifyListeners: function(event, ...args) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(args);
    },
    getNotificationCount: function(event) {
        return this.listeners.get(event)?.length || 0;
    }
};

const mockLevelEditor = {
    level,
    stateManager: mockStateManager,
    getCachedObject: (id) => level.findObjectById(id),
    getCachedEffectiveLayerId: (obj) => obj.layerId,
    getCachedTopLevelObject: (id) => level.findTopLevelObjectFast(id),
    invalidateObjectCaches: () => {}
};

// Создаем тестовые объекты
console.time('Создание тестовых объектов');
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
console.timeEnd('Создание тестовых объектов');

// Создаем систему группировки уведомлений
const batchedNotifications = {
    objectPropertyChanges: new Map(),
    layerCountChanges: new Map()
};

// Тест группировки уведомлений
console.log(`\nТестируем группировку уведомлений для ${level.objects.length} объектов:`);

// Имитируем процесс изменения слоев с группировкой уведомлений
console.time('Изменение слоев с группировкой уведомлений');
const layers = level.getLayersSorted();
if (layers.length >= 2) {
    const targetLayerId = layers[1].id;
    const processedGroups = new Set();

    // Имитируем процесс изменения слоев для нескольких объектов
    const testObjects = level.objects.slice(0, 10); // Первые 10 объектов

    testObjects.forEach(obj => {
        if (obj.layerId !== targetLayerId) {
            // Группируем уведомления вместо отправки отдельных
            mockLevelEditor.batchNotifyObjectPropertyChanged(
                batchedNotifications,
                obj,
                'layerId',
                obj.layerId,
                targetLayerId
            );

            mockLevelEditor.batchNotifyLayerCountChanged(
                batchedNotifications,
                obj.layerId,
                targetLayerId
            );

            // Имитируем изменение слоя
            const oldLayerId = obj.layerId;
            obj.layerId = targetLayerId;
            level.updateLayerCountCache(oldLayerId, -1);
            level.updateLayerCountCache(targetLayerId, +1);
        }
    });

    console.timeEnd('Изменение слоев с группировкой уведомлений');

    // Анализируем сгруппированные уведомления
    console.log(`\nАнализ сгруппированных уведомлений:`);
    console.log(`- Изменений свойств объектов: ${batchedNotifications.objectPropertyChanges.size}`);
    console.log(`- Изменений счетчиков слоев: ${batchedNotifications.layerCountChanges.size}`);

    let totalPropertyChanges = 0;
    for (const [property, changes] of batchedNotifications.objectPropertyChanges) {
        console.log(`  - Свойство '${property}': ${changes.length} изменений`);
        totalPropertyChanges += changes.length;
    }

    console.log(`- Всего изменений свойств: ${totalPropertyChanges}`);
    console.log(`- Экономия уведомлений: ${totalPropertyChanges - batchedNotifications.objectPropertyChanges.size} (группировка по свойствам)`);

    // Тестируем отправку уведомлений
    console.log(`\nОтправка сгруппированных уведомлений:`);
    mockLevelEditor.flushBatchedNotifications(batchedNotifications);

    console.log(`- Отправлено уведомлений 'objectPropertyChanged': ${mockStateManager.getNotificationCount('objectPropertyChanged')}`);
    console.log(`- Отправлено уведомлений 'objectsPropertyChanged': ${mockStateManager.getNotificationCount('objectsPropertyChanged')}`);

} else {
    console.log('Недостаточно слоев для тестирования');
}

console.log('\n=== ТЕСТ ЗАВЕРШЕН ===');
