// Временный файл для отладки добавления объектов в открытую группу
// Исходный код из src/core/MouseHandlers.js и src/core/DuplicateOperations.js
// ФИНАЛЬНАЯ ВЕРСИЯ: Разделены функции для новых и существующих объектов

// ИСХОДНАЯ ВЕРСИЯ - с проблемой "промыргивания"
export function addObjectToGroup_ORIGINAL(editor, newObject, groupEditMode) {
    const groupPos = editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
    newObject.x -= groupPos.x;
    newObject.y -= groupPos.y;
    // ПРОБЛЕМА: объект добавляется сразу после обновления координат
    groupEditMode.group.children.push(newObject);
}

// ВЕРСИЯ ДЛЯ НОВЫХ ОБЪЕКТОВ (ассеты) - Присоединить → Изменить
export function moveNewObjectsToGroup(editor, objectsToMove, targetGroup) {
    if (!objectsToMove || objectsToMove.length === 0 || !targetGroup || targetGroup.type !== 'group') {
        return;
    }

    // ДЛЯ НОВЫХ ОБЪЕКТОВ: Присоединить → Изменить
    // ШАГ 1: ПРИСОЕДИНИТЬ сначала
    targetGroup.children.push(...objectsToMove);

    // ШАГ 2: ИЗМЕНИТЬ после присоединения
    const groupPos = editor.objectOperations.getObjectWorldPosition(targetGroup);
    objectsToMove.forEach(obj => {
        obj.x -= groupPos.x;
        obj.y -= groupPos.y;
    });
}

// ВЕРСИЯ ДЛЯ СУЩЕСТВУЮЩИХ ОБЪЕКТОВ (дубликаты) - Изолировать → Изменить → Присоединить
export function moveExistingObjectsToGroup(editor, objectsToMove, targetGroup) {
    if (!objectsToMove || objectsToMove.length === 0 || !targetGroup || targetGroup.type !== 'group') {
        return;
    }

    // ДЛЯ СУЩЕСТВУЮЩИХ ОБЪЕКТОВ: Изолировать → Изменить → Присоединить
    // ШАГ 1: ИЗОЛИРОВАТЬ
    const idsToMove = new Set(objectsToMove.map(obj => obj.id));
    editor.level.objects = editor.level.objects.filter(obj => !idsToMove.has(obj.id));

    // ШАГ 2: ИЗМЕНИТЬ
    const groupPos = editor.objectOperations.getObjectWorldPosition(targetGroup);
    objectsToMove.forEach(obj => {
        obj.x -= groupPos.x;
        obj.y -= groupPos.y;
    });

    // ШАГ 3: ПРИСОЕДИНИТЬ
    targetGroup.children.push(...objectsToMove);
}

// ПОЛНАЯ ФУНКЦИЯ ДЛЯ ОТЛАДКИ - MouseHandlers.handleDrop
export function handleDrop_DEBUG(editor, e) {
    e.preventDefault();
    
    const mouse = editor.stateManager.get('mouse');
    if (!mouse.isDraggingAsset) return;
    
    editor.historyManager.saveState(editor.level.objects);
    
    const droppedAssetIds = JSON.parse(e.dataTransfer.getData('application/json'));
    const worldPos = editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, editor.stateManager.get('camera'));
    
    const newIds = new Set();
    const objectsForGroup = []; // Objects to be added to group
    let targetGroup = null;

    console.log(`[GROUP ADD DEBUG] 🎯 Processing ${droppedAssetIds.length} assets for drop`);

    droppedAssetIds.forEach((assetId, index) => {
        const asset = editor.assetManager.getAsset(assetId);
        if (asset) {
            const newObject = asset.createInstance(worldPos.x + index * 10, worldPos.y + index * 10);
            console.log(`[GROUP ADD DEBUG] 📦 Created object: ${newObject.name || 'unnamed'} (ID: ${newObject.id})`);
            console.log(`[GROUP ADD DEBUG] 📦 Initial position: x=${newObject.x}, y=${newObject.y}`);

            // Check if we're in group edit mode and the drop point is inside the group bounds
            if (editor.mouseHandlers.isInGroupEditMode() && editor.objectOperations.isPointInGroupBounds(worldPos.x, worldPos.y)) {
                const groupEditMode = editor.mouseHandlers.getGroupEditMode();
                console.log(`[GROUP ADD DEBUG] 🎯 Object will be added to group: ${groupEditMode.group.name} (ID: ${groupEditMode.group.id})`);
                console.log(`[GROUP ADD DEBUG] 📍 Object original position: x=${newObject.x}, y=${newObject.y}`);
                
                // ✨ ИСПРАВЛЕНИЕ: НЕ меняем здесь координаты!
                // Просто собираем "кандидатов" для добавления в группу.
                objectsForGroup.push(newObject);
                targetGroup = groupEditMode.group;
                console.log(`[GROUP ADD DEBUG] 📋 Object added to preparation array`);
            } else {
                // Add to main level
                console.log(`[GROUP ADD DEBUG] 🌍 Object will be added to main level`);
                editor.level.addObject(newObject);
            }

            newIds.add(newObject.id);
        }
    });

    // Move objects to group using atomic operation (new objects from assets)
    // ✨ ИСПРАВЛЕНИЕ: Присоединить → Изменить (для новых объектов)
    if (targetGroup && objectsForGroup.length > 0) {
        console.log(`[GROUP ADD DEBUG] 🎯 Adding ${objectsForGroup.length} NEW objects to group ${targetGroup.name}`);
        console.log(`[GROUP ADD DEBUG] 📊 Group children count before: ${targetGroup.children.length}`);
        console.log(`[GROUP ADD DEBUG] 🔧 NEW OBJECTS: Join first, then transform coordinates!`);
        moveNewObjectsToGroup(editor, objectsForGroup, targetGroup);
        console.log(`[GROUP ADD DEBUG] 📊 Group children count after: ${targetGroup.children.length}`);
    }
    
    console.log(`[GROUP ADD DEBUG] ✅ Drop operation completed`);
    
    editor.stateManager.set('selectedObjects', newIds);
    editor.stateManager.update({
        'mouse.isDraggingAsset': false
    });
    
    editor.render();
    editor.updateAllPanels();
}

// ПОЛНАЯ ФУНКЦИЯ ДЛЯ ОТЛАДКИ - DuplicateOperations.confirmPlacement (для существующих объектов)
export function confirmPlacement_DEBUG(editor, worldPos) {
    const duplicate = editor.stateManager.get('duplicate');
    if (!duplicate || !duplicate.isActive || !Array.isArray(duplicate.objects) || duplicate.objects.length === 0) return;

    editor.historyManager.saveState(editor.level.objects);

    const groupEditMode = editor.stateManager.get('groupEditMode');
    const newIds = new Set();
    const objectsForGroup = []; // Objects to be added to group
    let targetGroup = null;

    console.log(`[DUPLICATE ADD DEBUG] 🎯 Processing ${duplicate.objects.length} duplicates for placement`);

    duplicate.objects.forEach((obj) => {
        const offsetX = obj._offsetX ?? 0;
        const offsetY = obj._offsetY ?? 0;

        // Sanitize and place
        const base = editor.deepClone(obj);
        editor.reassignIdsDeep(base);
        base.x = worldPos.x + offsetX;
        base.y = worldPos.y + offsetY;
        
        console.log(`[DUPLICATE ADD DEBUG] 📦 Created duplicate: ${base.name || 'unnamed'} (ID: ${base.id})`);
        console.log(`[DUPLICATE ADD DEBUG] 📦 Initial position: x=${base.x}, y=${base.y}`);

            if (groupEditMode && groupEditMode.isActive && groupEditMode.group && editor.objectOperations.isPointInGroupBounds(base.x, base.y, groupEditMode)) {
                console.log(`[DUPLICATE ADD DEBUG] 🎯 Duplicate will be added to group: ${groupEditMode.group.name} (ID: ${groupEditMode.group.id})`);
                console.log(`[DUPLICATE ADD DEBUG] 📍 Duplicate world position: x=${base.x}, y=${base.y}`);

                // Дубликаты - это существующие объекты, поэтому их нужно добавить в уровень сначала
                console.log(`[DUPLICATE ADD DEBUG] 📤 Adding duplicate to main level first`);
                editor.level.addObject(base);

                // ✨ ПОДГОТАВЛИВАЕМ для перемещения в группу
                objectsForGroup.push(base);
                targetGroup = groupEditMode.group;
                console.log(`[DUPLICATE ADD DEBUG] 📋 Duplicate added to preparation array`);
            } else {
                console.log(`[DUPLICATE ADD DEBUG] 🌍 Duplicate will stay on main level`);
                editor.level.addObject(base);
            }

        newIds.add(base.id);
    });

    // Move objects to group using atomic operation (existing objects - duplicates)
    // ✨ ИСПРАВЛЕНИЕ: Изолировать → Изменить → Присоединить (для существующих объектов)
    if (targetGroup && objectsForGroup.length > 0) {
        console.log(`[DUPLICATE ADD DEBUG] 🎯 Adding ${objectsForGroup.length} EXISTING objects to group ${targetGroup.name}`);
        console.log(`[DUPLICATE ADD DEBUG] 📊 Group children count before: ${targetGroup.children.length}`);
        console.log(`[DUPLICATE ADD DEBUG] 🔧 EXISTING OBJECTS: Isolate first, then transform coordinates!`);
        moveExistingObjectsToGroup(editor, objectsForGroup, targetGroup);
        console.log(`[DUPLICATE ADD DEBUG] 📊 Group children count after: ${targetGroup.children.length}`);
    }

    console.log(`[DUPLICATE ADD DEBUG] ✅ Placement operation completed`);
    
    editor.stateManager.set('selectedObjects', newIds);
    editor.render();
    editor.updateAllPanels();
}
