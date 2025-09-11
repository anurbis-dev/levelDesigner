import { GameObject } from './GameObject.js';
import { Group } from './Group.js';
import { Layer } from './Layer.js';
import { GroupTraversalUtils } from '../utils/GroupTraversalUtils.js';

/**
 * Level data model
 */
export class Level {
    constructor(data = {}) {
        // Устанавливаем ID уровня для пространственного индекса
        this.id = data.id || `level_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.meta = {
            name: data.meta?.name || 'Untitled Level',
            version: data.meta?.version || 'dynamic',
            created: data.meta?.created || new Date().toISOString(),
            modified: data.meta?.modified || new Date().toISOString(),
            author: data.meta?.author || '',
            description: data.meta?.description || ''
        };
        
        this.settings = {
            gridSize: data.settings?.gridSize || 32,
            snapToGrid: data.settings?.snapToGrid || true,
            showGrid: data.settings?.showGrid || true,
            backgroundColor: data.settings?.backgroundColor || '#4B5563'
        };
        
        this.camera = {
            x: data.camera?.x || 0,
            y: data.camera?.y || 0,
            zoom: data.camera?.zoom || 1
        };
        
        this.objects = data.objects || [];
        this.nextObjectId = data.nextObjectId || 1;

        // Кеш счетчиков объектов по слоям для оптимизации производительности
        this.layerCountsCache = new Map();

        // Индекс объектов для быстрого поиска (id -> {object, topLevelParent})
        this.objectsIndex = new Map();

        // Initialize layers system
        this.layers = this.initializeLayers(data.layers);

        // Store Main layer ID for consistent reference
        this.mainLayerId = this.layers.length > 0 ? this.layers[0].id : null;

        // Инициализируем кеш счетчиков слоев
        this.rebuildLayerCountsCache();

        // Инициализируем индекс объектов для быстрого поиска
        this.buildObjectsIndex();
    }

    /**
     * Add object to level
     */
    addObject(obj) {
        // Ensure obj is a proper GameObject or Group instance
        let properObj = obj;
        if (!(obj instanceof GameObject) && !(obj instanceof Group)) {
            if (obj.type === 'group') {
                properObj = new Group(obj);
            } else {
                properObj = new GameObject(obj);
            }
        }

        // Only assign ID if not already set (for groups created elsewhere)
        if (!properObj.id) {
            properObj.id = this.nextObjectId++;
        }

        // Assign to Main layer by default (first layer, protected from deletion)
        // Only if layerId is not already set
        if (!properObj.layerId) {
            const mainLayerId = this.getMainLayerId();
            if (mainLayerId) {
                properObj.layerId = mainLayerId;
            }
        }

        this.objects.push(properObj);

        // Добавляем объект в индекс (top-level объект)
        this.addObjectToIndex(properObj, null);

        // Обновляем кеш счетчиков слоев при добавлении объекта
        if (properObj.layerId) {
            this.updateLayerCountCache(properObj.layerId, +1);
            const newCount = this.getLayerObjectsCount(properObj.layerId);
            this.notifyLayerObjectsCountChange(properObj.layerId, newCount, newCount - 1);
        }

        // Ensure all objects have valid layer references
        this.fixLayerReferences();

        this.updateModified();
    }

    /**
     * Remove object from level
     */
    removeObject(objId) {
        // Find object before removing to get its layerId
        const obj = this.findObjectById(objId);
        const layerId = obj?.layerId;

        this.objects = this.objects.filter(obj => obj.id !== objId);

        // Удаляем объект из индекса
        this.removeObjectFromIndex(objId);

        // Обновляем кеш счетчиков слоев при удалении объекта
        if (layerId) {
            this.updateLayerCountCache(layerId, -1);
            const newCount = this.getLayerObjectsCount(layerId);
            this.notifyLayerObjectsCountChange(layerId, newCount, newCount + 1);
        }

        this.updateModified();
    }

    /**
     * Find object by ID
     */
    findObjectById(id) {
        // Сначала пытаемся найти через индекс - O(1)
        const fastResult = this.findObjectByIdFast(id);
        if (fastResult) {
            return fastResult;
        }

        // Fallback на старый метод - O(N×D)
        return GroupTraversalUtils.findInObjects(this.objects, (obj) => obj.id === id);
    }

    /**
     * Find object in group recursively
     */
    findInGroup(group, id) {
        return GroupTraversalUtils.findInGroup(group, (obj) => obj.id === id);
    }

    /**
     * Get all objects flattened (including group children)
     */
    getAllObjects() {
        return GroupTraversalUtils.getAllObjects(this.objects);
    }

    /**
     * Get all children from group recursively
     */
    getGroupChildren(group) {
        return GroupTraversalUtils.getAllChildren(group);
    }

    /**
     * Get level statistics
     */
    getStats() {
        const allObjects = this.getAllObjects();
        const stats = {
            totalObjects: allObjects.length,
            groups: allObjects.filter(obj => obj.type === 'group').length,
            byType: {},
            byLayer: {}
        };

        allObjects.forEach(obj => {
            // Count by type
            if (!stats.byType[obj.type]) {
                stats.byType[obj.type] = 0;
            }
            stats.byType[obj.type]++;
            
            // Count by layer
            const layerId = obj.layerId || this.getMainLayerId();
            if (!stats.byLayer[layerId]) {
                stats.byLayer[layerId] = 0;
            }
            stats.byLayer[layerId]++;
        });

        return stats;
    }

    /**
     * Initialize layers system
     */
    initializeLayers(layersData) {
        if (layersData && layersData.length > 0) {
            return layersData.map(layerData => Layer.fromJSON(layerData));
        }
        
        // Create default Main layer
        const mainLayer = new Layer({
            name: 'Main',
            order: 0,
            visible: true,
            locked: false
        });
        
        return [mainLayer];
    }

    /**
     * Add new layer
     */
    addLayer(name = 'New Layer') {
        const maxOrder = Math.max(...this.layers.map(layer => layer.order), -1);
        const newLayer = new Layer({
            name: name,
            order: maxOrder + 1,
            visible: true,
            locked: false
        });
        
        this.layers.push(newLayer);
        this.updateModified();
        return newLayer;
    }

    /**
     * Remove layer by ID (cannot remove Main layer)
     */
    removeLayer(layerId) {
        const layer = this.getLayerById(layerId);
        if (!layer || layerId === this.getMainLayerId()) {
            return false;
        }
        
        this.layers = this.layers.filter(l => l.id !== layerId);
        this.updateModified();
        return true;
    }

    /**
     * Get layer by ID
     */
    getLayerById(layerId) {
        return this.layers.find(layer => layer.id === layerId);
    }

    /**
     * Get Main layer (searches by name, not position)
     */
    getMainLayer() {
        return this.layers.find(layer => layer.name === 'Main');
    }

    /**
     * Get Main layer ID (the layer that serves as default for new objects)
     * Returns the stored Main layer ID, which was set when the level was created
     */
    getMainLayerId() {
        // Return stored Main layer ID, or fallback to first layer if not set
        return this.mainLayerId || (this.layers.length > 0 ? this.layers[0].id : null);
    }

    /**
     * Fix layer references for objects
     * Ensures all objects have valid layerId references to existing layers
     */
    fixLayerReferences() {
        const mainLayerId = this.getMainLayerId();
        let fixedCount = 0;

        this.objects.forEach(obj => {
            // Only fix objects that have invalid layerId (layer doesn't exist)
            // Don't touch objects that have no layerId - they will be handled by addObject()
            if (obj.layerId && !this.getLayerById(obj.layerId)) {
                if (mainLayerId) {
                    obj.layerId = mainLayerId;
                    fixedCount++;
                }
            }
        });

        if (fixedCount > 0) {
            this.updateModified();
        }

        return fixedCount;
    }

    /**
     * Reorder layers
     */
    reorderLayers(layerIds) {
        const reorderedLayers = [];

        layerIds.forEach((layerId, index) => {
            const layer = this.getLayerById(layerId);
            if (layer) {
                layer.setOrder(index);
                reorderedLayers.push(layer);
            }
        });

        this.layers = reorderedLayers;
        this.updateModified();
    }

    /**
     * Get layers sorted by order
     */
    getLayersSorted() {
        return [...this.layers].sort((a, b) => a.order - b.order);
    }

    /**
     * Get objects count for a specific layer
     */
    getLayerObjectsCount(layerId) {
        // Используем кеш для оптимизации производительности
        if (this.layerCountsCache.has(layerId)) {
            return this.layerCountsCache.get(layerId);
        }

        // Вычисляем и кешируем результат
        const count = this.objects.filter(obj => obj.layerId === layerId).length;
        this.layerCountsCache.set(layerId, count);
        return count;
    }

    /**
     * Обновить счетчик объектов для слоя в кеше
     * @param {string} layerId - ID слоя
     * @param {number} delta - изменение счетчика (+1 или -1)
     */
    updateLayerCountCache(layerId, delta) {
        const currentCount = this.layerCountsCache.get(layerId) || 0;
        const newCount = Math.max(0, currentCount + delta);
        this.layerCountsCache.set(layerId, newCount);
    }

    /**
     * Перестроить кеш счетчиков слоев (при загрузке уровня или массовых изменениях)
     */
    rebuildLayerCountsCache() {
        this.layerCountsCache.clear();

        // Подсчитываем объекты по слоям
        const counts = new Map();
        this.objects.forEach(obj => {
            if (obj.layerId) {
                counts.set(obj.layerId, (counts.get(obj.layerId) || 0) + 1);
            }
        });

        // Заполняем кеш
        for (const [layerId, count] of counts) {
            this.layerCountsCache.set(layerId, count);
        }
    }

    /**
     * Очистить кеш счетчиков слоев (при массовых изменениях)
     */
    clearLayerCountsCache() {
        this.layerCountsCache.clear();
    }

    /**
     * Построить индекс объектов для быстрого поиска
     * O(N×D) - вызывается при создании/загрузке уровня
     */
    buildObjectsIndex() {
        this.objectsIndex.clear();

        // Индексируем все объекты уровня
        const walkObjects = (objects, topLevelParent = null) => {
            for (const obj of objects) {
                // Сохраняем объект и его top-level родителя
                this.objectsIndex.set(obj.id, {
                    object: obj,
                    topLevelParent: topLevelParent
                });

                // Рекурсивно обрабатываем дочерние объекты групп
                if (obj.type === 'group' && obj.children) {
                    walkObjects(obj.children, topLevelParent || obj);
                }
            }
        };

        walkObjects(this.objects);
    }

    /**
     * Найти объект по ID с помощью индекса - O(1)
     * @param {string} objId - ID объекта
     * @returns {Object|null} Объект или null
     */
    findObjectByIdFast(objId) {
        const entry = this.objectsIndex.get(objId);
        return entry ? entry.object : null;
    }

    /**
     * Найти top-level объект для любого объекта - O(1)
     * @param {string} objId - ID объекта
     * @returns {Object|null} Top-level объект или null
     */
    findTopLevelObjectFast(objId) {
        const entry = this.objectsIndex.get(objId);
        return entry ? entry.topLevelParent : null;
    }

    /**
     * Проверить, является ли объект потомком группы - O(1)
     * @param {string} objId - ID объекта
     * @param {string} groupId - ID группы
     * @returns {boolean} true если объект является потомком группы
     */
    isObjectDescendantOfGroupFast(objId, groupId) {
        const entry = this.objectsIndex.get(objId);
        if (!entry || !entry.topLevelParent) {
            return false;
        }

        // Проверяем цепочку родителей
        let current = entry.topLevelParent;
        while (current) {
            if (current.id === groupId) {
                return true;
            }

            // Если текущий объект тоже индексирован, получаем его родителя
            const currentEntry = this.objectsIndex.get(current.id);
            current = currentEntry ? currentEntry.topLevelParent : null;
        }

        return false;
    }

    /**
     * Добавить объект в индекс
     * @param {Object} obj - Объект для добавления
     * @param {Object|null} topLevelParent - Top-level родитель
     */
    addObjectToIndex(obj, topLevelParent = null) {
        this.objectsIndex.set(obj.id, {
            object: obj,
            topLevelParent: topLevelParent
        });
    }

    /**
     * Удалить объект из индекса
     * @param {string} objId - ID объекта для удаления
     */
    removeObjectFromIndex(objId) {
        this.objectsIndex.delete(objId);
    }

    /**
     * Очистить индекс объектов
     */
    clearObjectsIndex() {
        this.objectsIndex.clear();
    }

    /**
     * Assign object to layer
     */
    assignObjectToLayer(objId, layerId) {
        const obj = this.findObjectById(objId);
        if (obj) {
            const oldLayerId = obj.layerId;
            obj.layerId = layerId;
            this.updateModified();

            // Обновляем кеш счетчиков слоев
            if (oldLayerId && oldLayerId !== layerId) {
                this.updateLayerCountCache(oldLayerId, -1);
                this.updateLayerCountCache(layerId, +1);
            } else if (!oldLayerId && layerId) {
                this.updateLayerCountCache(layerId, +1);
            }

            // Notify about layer objects count change
            if (this.onLayerObjectsCountChanged) {
                if (oldLayerId) {
                    const oldCount = this.getLayerObjectsCount(oldLayerId);
                    this.onLayerObjectsCountChanged(oldLayerId, oldCount, oldCount + 1);
                }
                const newCount = this.getLayerObjectsCount(layerId);
                this.onLayerObjectsCountChanged(layerId, newCount, newCount - 1);
            }

            return true;
        }
        return false;
    }

    /**
     * Get objects for specific layer
     */
    getLayerObjects(layerId) {
        return this.objects.filter(obj => obj.layerId === layerId);
    }

    /**
     * Get cached layer objects count from level editor
     * This is more efficient than getLayerObjectsCount for frequent calls
     */
    getCachedLayerObjectsCount(layerId, cachedStats) {
        if (cachedStats && cachedStats.byLayer) {
            return cachedStats.byLayer[layerId] || 0;
        }
        // Fallback to regular method if no cached stats
        return this.getLayerObjectsCount(layerId);
    }

    /**
     * Set callback for layer objects count changes
     */
    setLayerObjectsCountChangeCallback(callback) {
        this.onLayerObjectsCountChanged = callback;
    }

    /**
     * Notify about layer objects count change
     */
    notifyLayerObjectsCountChange(layerId, newCount, oldCount) {
        if (this.onLayerObjectsCountChanged) {
            this.onLayerObjectsCountChanged(layerId, newCount, oldCount);
        }
    }

    /**
     * Update modified timestamp
     */
    updateModified() {
        this.meta.modified = new Date().toISOString();
    }


    /**
     * Serialize level to JSON
     */
    toJSON() {
        return {
            meta: this.meta,
            settings: this.settings,
            camera: this.camera,
            objects: this.objects.map(obj => {
                if (obj.type === 'group') {
                    return Group.fromJSON(obj).toJSON();
                } else {
                    return GameObject.fromJSON(obj).toJSON();
                }
            }),
            layers: this.layers.map(layer => layer.toJSON()),
            nextObjectId: this.nextObjectId,
            mainLayerId: this.mainLayerId
        };
    }

    /**
     * Create level from JSON data
     */
    static fromJSON(data) {
        const level = new Level(data);
        level.objects = data.objects ? data.objects.map(objData => {
            if (objData.type === 'group') {
                return Group.fromJSON(objData);
            } else {
                return GameObject.fromJSON(objData);
            }
        }) : [];

        // Restore Main layer ID from saved data or use first layer
        if (data.mainLayerId) {
            level.mainLayerId = data.mainLayerId;
        }

        // Перестраиваем кеши после загрузки объектов
        level.rebuildLayerCountsCache();
        level.buildObjectsIndex();

        return level;
    }
}
