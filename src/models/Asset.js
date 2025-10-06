import { GameObject } from './GameObject.js';

/**
 * Asset definition for the asset library
 */
export class Asset {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'Unnamed Asset';
        this.type = data.type || 'object';
        this.category = data.category || 'Misc';
        this.path = data.path || ''; // Relative path from root folder
        this.width = data.width || 32;
        this.height = data.height || 32;
        this.color = data.color || '#cccccc';
        this.imgSrc = data.imgSrc || null;
        this.properties = data.properties || {};
        this.tags = data.tags || [];
    }

    generateId() {
        return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create a game object instance from this asset
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} layerId - Layer ID for the new object (optional)
     */
    createInstance(x = 0, y = 0, layerId = null) {
        const instanceData = {
            id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: this.name,
            type: this.type,
            x: x,
            y: y,
            width: this.width,
            height: this.height,
            color: this.color,
            imgSrc: this.imgSrc,
            visible: true,
            locked: false,
            layerId: layerId, // Will be set by level.addObject() if not provided
            properties: { ...this.properties }
        };

        // Create proper GameObject instance instead of plain object
        return new GameObject(instanceData);
    }

    /**
     * Serialize asset to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            category: this.category,
            path: this.path,
            width: this.width,
            height: this.height,
            color: this.color,
            imgSrc: this.imgSrc,
            properties: this.properties,
            tags: this.tags
        };
    }

    /**
     * Create asset from JSON data
     */
    static fromJSON(data) {
        return new Asset(data);
    }
}
