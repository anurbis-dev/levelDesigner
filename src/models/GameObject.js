import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';

/**
 * Base class for all game objects in the level editor
 */
export class GameObject {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'Unnamed Object';
        this.type = data.type || 'object';
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.width = data.width || 32;
        this.height = data.height || 32;
        this.color = data.color || '#cccccc';
        this.rotation = data.rotation || 0; // degrees, clockwise, around object center
        this.imgSrc = data.imgSrc || null;
        this.visible = data.visible !== undefined ? data.visible : true;
        this.locked = data.locked || false;
        this.layerId = data.layerId || null;
        this.properties = data.properties || {};
    }

    generateId() {
        return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get world bounds of the object
     */
    getBounds() {
        return WorldPositionUtils.getRotatedRectAABB(this.x, this.y, this.width, this.height, this.rotation || 0);
    }

    /**
     * Check if point is inside object bounds
     */
    containsPoint(x, y) {
        if (this.rotation) {
            // Inverse-rotate the point around the object's center, then test the unrotated rect
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const rad = -this.rotation * Math.PI / 180;
            const dx = x - cx;
            const dy = y - cy;
            const lx = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
            const ly = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
            return lx >= this.x && lx <= this.x + this.width &&
                   ly >= this.y && ly <= this.y + this.height;
        }
        const bounds = this.getBounds();
        return x >= bounds.minX && x <= bounds.maxX &&
               y >= bounds.minY && y <= bounds.maxY;
    }

    /**
     * Clone the object with new ID
     */
    clone() {
        const cloned = new GameObject(this);
        cloned.id = this.generateId();
        return cloned;
    }

    /**
     * Serialize object to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            color: this.color,
            rotation: this.rotation,
            imgSrc: this.imgSrc,
            visible: this.visible,
            locked: this.locked,
            layerId: this.layerId,
            properties: this.properties
        };
    }

    /**
     * Create object from JSON data
     */
    static fromJSON(data) {
        return new GameObject(data);
    }
}
