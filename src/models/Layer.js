/**
 * Layer data model for level editor
 */
export class Layer {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || 'New Layer';
        this.visible = data.visible !== undefined ? data.visible : true;
        this.locked = data.locked !== undefined ? data.locked : false;
        this.order = data.order || 0;
        this.color = data.color || '#3B82F6'; // Default blue color for layer indicator
    }

    /**
     * Generate unique ID for layer
     */
    generateId() {
        return 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Toggle layer visibility
     */
    toggleVisibility() {
        this.visible = !this.visible;
    }

    /**
     * Toggle layer lock state
     */
    toggleLock() {
        this.locked = !this.locked;
    }

    /**
     * Update layer name
     */
    setName(name) {
        if (name && name.trim()) {
            this.name = name.trim();
        }
    }

    /**
     * Update layer order
     */
    setOrder(order) {
        this.order = order;
    }

    /**
     * Serialize layer to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            visible: this.visible,
            locked: this.locked,
            order: this.order,
            color: this.color
        };
    }

    /**
     * Create layer from JSON data
     */
    static fromJSON(data) {
        return new Layer(data);
    }

    /**
     * Clone layer with new ID
     */
    clone() {
        const cloned = new Layer(this.toJSON());
        cloned.id = this.generateId();
        return cloned;
    }
}
