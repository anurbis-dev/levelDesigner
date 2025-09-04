/**
 * Object Operations module for LevelEditor
 * Handles all object manipulation operations
 */
export class ObjectOperations {
    constructor(levelEditor) {
        this.editor = levelEditor;
    }

    /**
     * Object manipulation methods
     */
    findObjectAtPoint(x, y) {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');

        // In group edit mode, search through all objects including nested ones
        if (groupEditMode && groupEditMode.isActive) {
           const openGroups = Array.isArray(groupEditMode.openGroups) ? groupEditMode.openGroups : (groupEditMode.group ? [groupEditMode.group] : []);
           const openIds = new Set(openGroups.map(g => g.id));
           const selectable = this.computeSelectableSet();

           // 1) Groups first (excluding ALL open groups)
           const allGroups = this.editor.level.getAllObjects().filter(o => o.type === 'group' && !openIds.has(o.id) && selectable.has(o.id));
           for (const grp of [...allGroups].reverse()) {
               if (this.isPointInObject(x, y, grp)) return grp;
           }
           
           // 2) External objects (not in any open group)
           const externalObjects = this.editor.level.objects.filter(o => o.type !== 'group' && selectable.has(o.id));
           for (const obj of [...externalObjects].reverse()) {
               if (this.isPointInObject(x, y, obj)) return obj;
           }
           
           // 3) Then descendants of the deepest open group
           const activeGroup = openGroups.length > 0 ? openGroups[openGroups.length - 1] : null;
           if (activeGroup) {
               const collect = (g) => {
                   const res = [];
                   g.children.forEach(ch => {
                       res.push(ch);
                       if (ch.type === 'group') res.push(...collect(ch));
                   });
                   return res;
               };
               const descendants = collect(activeGroup).filter(o => selectable.has(o.id));
               for (const obj of [...descendants].reverse()) {
                   if (this.isPointInObject(x, y, obj)) return obj;
               }
           }
           return null;
       }

       // Normal mode - hit-test groups first (highest priority) among top-level
       const selectable = this.computeSelectableSet();
       const topLevelGroups = this.editor.level.objects.filter(o => o.type === 'group' && selectable.has(o.id));
       for (const grp of [...topLevelGroups].reverse()) {
           if (this.isPointInObject(x, y, grp)) return grp;
       }

       // Then hit-test top-level non-group objects
       const topLevelObjects = this.editor.level.objects.filter(o => o.type !== 'group' && selectable.has(o.id));
       for (const obj of [...topLevelObjects].reverse()) {
           if (this.isPointInObject(x, y, obj)) {
               return obj;
           }
       }

       return null;
    }

    isPointInObject(x, y, obj) {
        const bounds = this.getObjectWorldBounds(obj);
        return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
    }

    isPointInGroupBounds(x, y, groupEditMode) {
        if (!groupEditMode || !groupEditMode.isActive || !groupEditMode.group) return false;

        const group = groupEditMode.group;
        const bounds = this.getObjectWorldBounds(group);

        // Add some padding to make it easier to drop inside (same as visual frame)
        const padding = 10;
        return x >= bounds.minX - padding && x <= bounds.maxX + padding &&
               y >= bounds.minY - padding && y <= bounds.maxY + padding;
    }

    getObjectCenterWorld(obj, parentGroup = null) {
        // If parentGroup provided, obj.x/obj.y are relative to that group
        if (parentGroup) {
            const parentPos = this.getObjectWorldPosition(parentGroup);
            return {
                x: parentPos.x + obj.x + (obj.width || 0) / 2,
                y: parentPos.y + obj.y + (obj.height || 0) / 2
            };
        }
        // Otherwise, walk from top-level
        const pos = this.getObjectWorldPosition(obj);
        return {
            x: pos.x + (obj.width || 0) / 2,
            y: pos.y + (obj.height || 0) / 2
        };
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
        for (const top of this.editor.level.objects) {
            if (dfs(top, 0, 0)) break;
        }
        return result || { x: target.x, y: target.y };
    }

    isObjectInGroup(obj, group) {
        return group.children.some(child => child.id === obj.id);
    }

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
            for (const top of this.editor.level.objects) {
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

    /**
     * Object operations
     */
    deleteSelectedObjects() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        if (selectedObjects.size === 0) return;

        this.editor.historyManager.saveState(this.editor.level.objects);

        // Delete selected objects - they can be on main level or inside groups
        const idsToDelete = new Set(selectedObjects);

        // Remove from main level
        this.editor.level.objects = this.editor.level.objects.filter(obj => !idsToDelete.has(obj.id));

        // Remove from all groups recursively
        const removeFromGroups = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group') {
                    obj.children = obj.children.filter(child => !idsToDelete.has(child.id));
                    removeFromGroups(obj.children);
                }
            }
        };
        removeFromGroups(this.editor.level.objects);

        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.updateAllPanels();
        this.editor.render();
    }

    duplicateSelectedObjects() {
        console.log('=== DUPLICATE DEBUG START ===');
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        console.log('Selected objects IDs:', Array.from(selectedObjects));
        
        if (selectedObjects.size === 0) {
            console.log('No objects selected, returning');
            return;
        }

        // Get selected objects (they're all on main level now)
        const selected = Array.from(selectedObjects)
            .map(id => this.editor.level.findObjectById(id))
            .filter(Boolean);
        
        console.log('Found selected objects:', selected.length, selected);

        if (selected.length > 0) {
            // Ensure all objects have proper properties for display
            const clonedObjects = selected.map(obj => {
                console.log('Cloning object:', obj);
                const cloned = this.editor.deepClone(obj);
                console.log('Deep cloned object:', cloned);
                
                // Assign new unique IDs
                console.log('Before reassignIdsDeep - nextObjectId:', this.editor.level.nextObjectId);
                this.editor.reassignIdsDeep(cloned);
                console.log('After reassignIdsDeep - nextObjectId:', this.editor.level.nextObjectId, 'cloned:', cloned);
                
                // For groups, ensure all children have proper properties
                if (cloned.type === 'group' && Array.isArray(cloned.children)) {
                    console.log('Processing group children:', cloned.children.length);
                    cloned.children.forEach((child, index) => {
                        console.log(`Processing child ${index}:`, child);
                        child.visible = child.visible !== undefined ? child.visible : true;
                        child.locked = child.locked !== undefined ? child.locked : false;
                        child.width = child.width || 32;
                        child.height = child.height || 32;
                        child.color = child.color || '#cccccc';
                        console.log(`Child ${index} after processing:`, child);
                    });
                }
                
                // Ensure essential properties are set
                cloned.visible = cloned.visible !== undefined ? cloned.visible : true;
                cloned.locked = cloned.locked !== undefined ? cloned.locked : false;
                cloned.width = cloned.width || 32;
                cloned.height = cloned.height || 32;
                cloned.color = cloned.color || '#cccccc';
                
                console.log('Final cloned object:', cloned);
                return cloned;
            });
            
            console.log('All cloned objects:', clonedObjects);
            
            // Initialize positions for placing objects using current mouse position
            const mouse = this.editor.stateManager.get('mouse');
            const camera = this.editor.stateManager.get('camera');
            console.log('Mouse coordinates:', mouse.x, mouse.y);
            console.log('Camera:', camera);
            
            // Use current mouse position or fallback to center of canvas
            const mouseX = mouse.x || this.editor.canvasRenderer.canvas.width / 2;
            const mouseY = mouse.y || this.editor.canvasRenderer.canvas.height / 2;
            const currentWorldPos = this.editor.canvasRenderer.screenToWorld(mouseX, mouseY, camera);
            console.log('Current world position:', currentWorldPos);
            
            // Initialize offsets from current mouse world position
            const initialized = this.editor.duplicateRenderUtils.initializePositions(clonedObjects, currentWorldPos);
            initialized.forEach((o, i) => { clonedObjects[i] = o; });
            
            this.editor.stateManager.update({
                'mouse.isPlacingObjects': true,
                'mouse.placingObjects': clonedObjects,
                'duplicate.isActive': true,
                'duplicate.objects': clonedObjects,
                'duplicate.basePosition': { x: currentWorldPos.x, y: currentWorldPos.y }
            });
            
            console.log('Updated duplicate state:', {
                isActive: this.editor.stateManager.get('duplicate.isActive'),
                objectsCount: this.editor.stateManager.get('duplicate.objects').length,
                basePosition: this.editor.stateManager.get('duplicate.basePosition')
            });
            
            console.log('State updated, isPlacingObjects:', this.editor.stateManager.get('mouse.isPlacingObjects'));
            console.log('Placing objects count:', this.editor.stateManager.get('mouse.placingObjects').length);
            
            // Force render to show the duplicated objects
            this.editor.render();
        }
        console.log('=== DUPLICATE DEBUG END ===');
    }

    focusOnSelection() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const selection = Array.from(selectedObjects).map(id => this.editor.level.findObjectById(id)).filter(Boolean);
        this.focusOnBounds(this.getSelectionBounds(selection));
    }

    focusOnAll() {
        this.focusOnBounds(this.getSelectionBounds(this.editor.level.objects));
    }

    focusOnBounds(bounds) {
        if (!bounds || bounds.minX === Infinity) return;
        
        const canvas = this.editor.canvasRenderer.canvas;
        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;
        const padding = 50;
        const zoomX = canvas.width / (boundsWidth + padding * 2);
        const zoomY = canvas.height / (boundsHeight + padding * 2);
        
        const newZoom = Math.max(0.1, Math.min(10, Math.min(zoomX, zoomY)));
        const centerX = bounds.minX + boundsWidth / 2;
        const centerY = bounds.minY + boundsHeight / 2;
        
        this.editor.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': centerX - (canvas.width / 2) / newZoom,
            'camera.y': centerY - (canvas.height / 2) / newZoom
        });
        
        this.editor.render();
    }

    getSelectionBounds(collection) {
        if (collection.length === 0) return null;
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        collection.forEach(obj => {
            const objBounds = this.getObjectWorldBounds(obj);
            bounds.minX = Math.min(bounds.minX, objBounds.minX);
            bounds.minY = Math.min(bounds.minY, objBounds.minY);
            bounds.maxX = Math.max(bounds.maxX, objBounds.maxX);
            bounds.maxY = Math.max(bounds.maxY, objBounds.maxY);
        });
        return bounds;
    }

    // Compute a set of selectable IDs depending on current edit state
    computeSelectableSet() {
        const selectable = new Set();
        const groupEditMode = this.editor.stateManager.get('groupEditMode');

        if (groupEditMode && groupEditMode.isActive) {
            // Only descendants of the deepest open group are selectable; all other open groups are transparent
            const openGroups = Array.isArray(groupEditMode.openGroups) ? groupEditMode.openGroups : (groupEditMode.group ? [groupEditMode.group] : []);
            const active = openGroups[openGroups.length - 1];
            if (active) {
                const collect = (g) => {
                    const res = [];
                    g.children.forEach(ch => {
                        res.push(ch);
                        if (ch.type === 'group') res.push(...collect(ch));
                    });
                    return res;
                };
                collect(active).forEach(o => selectable.add(o.id));
            }
            // All non-open groups on any level are still selectable (priority for groups), exclude open ones
            const openIds = new Set(openGroups.map(g => g.id));
            this.editor.level.getAllObjects().forEach(o => {
                if (o.type === 'group' && !openIds.has(o.id)) selectable.add(o.id);
            });
            // Also allow selection of external objects (not in any open group)
            this.editor.level.objects.forEach(o => {
                if (o.type !== 'group') selectable.add(o.id);
            });
        } else {
            // Normal mode: only top-level objects selectable
            this.editor.level.objects.forEach(o => selectable.add(o.id));
        }
        return selectable;
    }
}
