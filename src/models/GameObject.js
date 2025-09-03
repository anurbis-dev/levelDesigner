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
        this.imgSrc = data.imgSrc || null;
        this.visible = data.visible !== undefined ? data.visible : true;
        this.locked = data.locked || false;
        this.properties = data.properties || {};
    }

    generateId() {
        return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get world bounds of the object
     */
    getBounds() {
        return {
            minX: this.x,
            minY: this.y,
            maxX: this.x + this.width,
            maxY: this.y + this.height
        };
    }

    /**
     * Check if point is inside object bounds
     */
    containsPoint(x, y) {
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
            imgSrc: this.imgSrc,
            visible: this.visible,
            locked: this.locked,
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
