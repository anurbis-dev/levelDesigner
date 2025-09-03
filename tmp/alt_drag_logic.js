// Alt+drag logic for moving objects out of groups
// Extracted from src/core/LevelEditor.js

// 1. Logic in dragSelectedObjects method (без изменений)
dragSelectedObjects(worldPos) {
    const selectedObjects = this.stateManager.get('selectedObjects');
    const mouse = this.stateManager.get('mouse');
    const groupEditMode = this.stateManager.get('groupEditMode');

    const dx = worldPos.x - mouse.dragStartX;
    const dy = worldPos.y - mouse.dragStartY;

    selectedObjects.forEach(id => {
        const obj = this.level.findObjectById(id);
        if (obj) {
            // Check if object is on main level or inside the currently edited group
            const isOnMainLevel = this.level.objects.some(topObj => topObj.id === obj.id);
            const isInEditedGroup = groupEditMode.isActive && groupEditMode.group &&
                this.isObjectInGroup(obj, groupEditMode.group);

            if (isOnMainLevel) {
                // Object is on main level - move it normally
                obj.x += dx;
                obj.y += dy;

                // If dragged into edited group bounds, move under the group with relative coordinates
                if (!this.stateManager.get('mouse').altKey && groupEditMode.isActive && groupEditMode.group && this.isPointInGroupBounds(obj.x, obj.y, groupEditMode)) {
                    // Convert world -> relative to group's world position
                    const groupPos = this.getObjectWorldPosition(groupEditMode.group);
                    obj.x -= groupPos.x;
                    obj.y -= groupPos.y;

                    // Remove from main level and append into group
                    this.level.objects = this.level.objects.filter(top => top.id !== obj.id);
                    groupEditMode.group.children.push(obj);
                }
            } else if (isInEditedGroup) {
                // Object is inside the currently edited group
                if (this.stateManager.get('mouse').altKey) {
                    // Alt+drag: move in world coordinates by converting to world position first
                    const groupPos = this.getObjectWorldPosition(groupEditMode.group);
                    const worldX = groupPos.x + obj.x;
                    const worldY = groupPos.y + obj.y;
                    
                    // Move in world coordinates
                    const newWorldX = worldX + dx;
                    const newWorldY = worldY + dy;
                    
                    // Convert back to relative coordinates
                    obj.x = newWorldX - groupPos.x;
                    obj.y = newWorldY - groupPos.y;
                } else {
                    // Normal drag: move relative to group
                    obj.x += dx;
                    obj.y += dy;
                }
            }

            // If it's a group, all children move with it automatically
            // because they are positioned relative to the group
        }
    });

    this.stateManager.update({
        'mouse.dragStartX': worldPos.x,
        'mouse.dragStartY': worldPos.y
    });

    this.updateAllPanels();
}

// 2. Logic in handleMouseUp method (ИЗМЕНЕНО)
handleMouseUp(e) {
    const mouse = this.stateManager.get('mouse');
    
    if (e.button === 0) {
        const currentAlt = e.altKey || mouse.altKey;
        const wasDragging = mouse.isDragging; // Save dragging state before resetting
        
        if (mouse.isDragging) {
            this.historyManager.saveState(this.level.objects);
            this.stateManager.markDirty();
        }
        
        this.stateManager.update({
            'mouse.isLeftDown': false,
            'mouse.isDragging': false,
            'mouse.altKey': e.altKey
        });
        
        if (mouse.isMarqueeSelecting) {
            this.finishMarqueeSelection();
        }

        // If we are in group edit mode and released after dragging with Alt
        const groupEditMode = this.stateManager.get('groupEditMode');
        if (groupEditMode.isActive && groupEditMode.group && currentAlt && wasDragging) {
            const selectedIds = this.stateManager.get('selectedObjects');
            
            // ИЗМЕНЕНИЕ: Вычисляем границы группы, ИСКЛЮЧАЯ перетаскиваемые объекты.
            const bounds = this.getObjectWorldBounds(groupEditMode.group, Array.from(selectedIds));

            const selected = Array.from(selectedIds)
                .map(id => this.level.findObjectById(id))
                .filter(Boolean);

            selected.forEach(obj => {
                // Only consider direct children of the edited group
                const isChild = this.isObjectInGroup(obj, groupEditMode.group);
                if (isChild) {
                    // Get current world position and bounds of the object
                    const groupPos = this.getObjectWorldPosition(groupEditMode.group);
                    const worldX = groupPos.x + obj.x;
                    const worldY = groupPos.y + obj.y;
                    const objWidth = obj.width || 32;
                    const objHeight = obj.height || 32;
                    
                    // Object bounds in world coordinates
                    const objBounds = {
                        minX: worldX,
                        minY: worldY,
                        maxX: worldX + objWidth,
                        maxY: worldY + objHeight
                    };
                    
                    // Check if object bounds intersect with group bounds
                    const hasIntersection = objBounds.minX < bounds.maxX && 
                                          objBounds.maxX > bounds.minX && 
                                          objBounds.minY < bounds.maxY && 
                                          objBounds.maxY > bounds.minY;
                    
                    const outside = !hasIntersection;

                    // Теперь эта проверка должна работать корректно
                    if (outside) {
                        // Remove from group's children
                        groupEditMode.group.children = groupEditMode.group.children.filter(c => c.id !== obj.id);
                        // Add to main level at world coordinates
                        obj.x = worldX;
                        obj.y = worldY;
                        this.level.objects.push(obj);
                    }
                }
            });
        }
        
        if (mouse.isPlacingObjects) {
            const worldPos = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.stateManager.get('camera'));
            this.finishPlacingObjects(worldPos);
        }
    }
}

// 3. Helper methods
isObjectInGroup(obj, group) {
    return group.children.some(child => child.id === obj.id);
}

getObjectWorldPosition(target) {
    let result = null;
    const dfs = (current, accX, accY) => {
        if (current.id === target.id) {
            result = { x: accX + current.x, y: accY + current.y };
            return true;
        }
        if (current.type === 'group') {
            const nextX = accX + current.x;
            const nextY = accY + current.y;
            for (const child of current.children) {
                if (dfs(child, nextX, nextY)) return true;
            }
        }
        return false;
    };
    for (const top of this.level.objects) {
        if (dfs(top, 0, 0)) break;
    }
    return result || { x: target.x, y: target.y };
}

// ИЗМЕНЕНО: getObjectWorldBounds теперь принимает массив ID для исключения
getObjectWorldBounds(obj, excludeIds = []) {
    const getWorldPosition = (target) => {
        let result = null;
        const dfs = (current, accX, accY) => {
            if (current.id === target.id) {
                result = { x: accX + current.x, y: accY + current.y };
                return true;
            }
            if (current.type === 'group') {
                const nextX = accX + current.x;
                const nextY = accY + current.y;
                for (const child of current.children) {
                    if (dfs(child, nextX, nextY)) return true;
                }
            }
            return false;
        };
        for (const top of this.level.objects) {
            if (dfs(top, 0, 0)) break;
        }
        return result || { x: target.x, y: target.y };
    };

    if (obj.type !== 'group') {
        const pos = getWorldPosition(obj);
        return {
            minX: pos.x,
            minY: pos.y,
            maxX: pos.x + (obj.width || 0),
            maxY: pos.y + (obj.height || 0)
        };
    }

    const groupPos = getWorldPosition(obj);
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    const walk = (current, baseX, baseY) => {
        // ИЗМЕНЕНИЕ: Не обрабатываем сам объект, если он в списке исключений
        if (excludeIds.includes(current.id)) {
            return;
        }

        if (current.type === 'group') {
            const nextX = baseX + current.x;
            const nextY = baseY + current.y;

            // Если у группы нет дочерних элементов (или все они исключены), 
            // ее собственные координаты должны учитываться в границах.
            let hasVisibleChildren = false;
            if (current.children && current.children.length > 0) {
                 for (const child of current.children) {
                    if (!excludeIds.includes(child.id)) {
                        hasVisibleChildren = true;
                        walk(child, nextX, nextY);
                    }
                }
            }

            if (!hasVisibleChildren) {
                 bounds.minX = Math.min(bounds.minX, nextX);
                 bounds.minY = Math.min(bounds.minY, nextY);
                 bounds.maxX = Math.max(bounds.maxX, nextX);
                 bounds.maxY = Math.max(bounds.maxY, nextY);
            }
            return;
        }

        const absX = baseX + current.x;
        const absY = baseY + current.y;
        bounds.minX = Math.min(bounds.minX, absX);
        bounds.minY = Math.min(bounds.minY, absY);
        bounds.maxX = Math.max(bounds.maxX, absX + (current.width || 0));
        bounds.maxY = Math.max(bounds.maxY, absY + (current.height || 0));
    };

    walk(obj, groupPos.x - obj.x, groupPos.y - obj.y);
    
    // Если после всех исключений границы остались бесконечными (т.е. группа пуста),
    // ее границами будет ее собственная точка привязки.
    if (bounds.minX === Infinity) {
        bounds.minX = groupPos.x;
        bounds.minY = groupPos.y;
        bounds.maxX = groupPos.x;
        bounds.maxY = groupPos.y;
    }

    return bounds;
}
