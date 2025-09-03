import { GameObject } from './GameObject.js';
import { Group } from './Group.js';

/**
 * Level data model
 */
export class Level {
    constructor(data = {}) {
        this.meta = {
            name: data.meta?.name || 'Untitled Level',
            version: data.meta?.version || '1.0.0',
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
    }

    /**
     * Add object to level
     */
    addObject(obj) {
        obj.id = this.nextObjectId++;
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
        for (const obj of this.objects) {
            if (obj.id === id) return obj;
            if (obj.type === 'group') {
                const found = this.findInGroup(obj, id);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Find object in group recursively
     */
    findInGroup(group, id) {
        for (const child of group.children) {
            if (child.id === id) return child;
            if (child.type === 'group') {
                const found = this.findInGroup(child, id);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Get all objects flattened (including group children)
     */
    getAllObjects() {
        const result = [];
        for (const obj of this.objects) {
            result.push(obj);
            if (obj.type === 'group') {
                result.push(...this.getGroupChildren(obj));
            }
        }
        return result;
    }

    /**
     * Get all children from group recursively
     */
    getGroupChildren(group) {
        const result = [];
        for (const child of group.children) {
            result.push(child);
            if (child.type === 'group') {
                result.push(...this.getGroupChildren(child));
            }
        }
        return result;
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
