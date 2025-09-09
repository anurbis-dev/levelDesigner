import { GameObject } from './GameObject.js';
import { Group } from './Group.js';
import { Layer } from './Layer.js';
import { GroupTraversalUtils } from '../utils/GroupTraversalUtils.js';

/**
 * Level data model
 */
export class Level {
    constructor(data = {}) {
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
        
        // Initialize layers system
        this.layers = this.initializeLayers(data.layers);
    }

    /**
     * Add object to level
     */
    addObject(obj) {
        obj.id = this.nextObjectId++;
        // Assign to Main layer by default (search by name, not position)
        const mainLayerId = this.getMainLayerId();
        if (mainLayerId) {
            obj.layerId = mainLayerId;
        } else if (this.layers.length > 0) {
            // Fallback to first layer if Main layer not found
            obj.layerId = this.layers[0].id;
        }
        this.objects.push(obj);
        this.updateModified();
    }

    /**
     * Remove object from level
     */
    removeObject(objId) {
        this.objects = this.objects.filter(obj => obj.id !== objId);
        this.updateModified();
    }

    /**
     * Find object by ID
     */
    findObjectById(id) {
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
            byType: {}
        };

        allObjects.forEach(obj => {
            if (!stats.byType[obj.type]) {
                stats.byType[obj.type] = 0;
            }
            stats.byType[obj.type]++;
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
     * Get Main layer ID (searches by name, not position)
     */
    getMainLayerId() {
        const mainLayer = this.getMainLayer();
        return mainLayer ? mainLayer.id : null;
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
        // Count objects that belong to this layer
        return this.objects.filter(obj => obj.layerId === layerId).length;
    }

    /**
     * Assign object to layer
     */
    assignObjectToLayer(objId, layerId) {
        const obj = this.findObjectById(objId);
        if (obj) {
            obj.layerId = layerId;
            this.updateModified();
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
            nextObjectId: this.nextObjectId
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
        return level;
    }
}
