import { Logger } from '../utils/Logger.js';

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
        this.parallaxOffset = data.parallaxOffset !== undefined ? data.parallaxOffset : 0;
        // Layer index for z-index calculation (calculated based on order)
        this.index = data.index !== undefined ? data.index : 0;
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
        // Note: layer index is managed separately by Level.updateLayerIndices()
    }

    /**
     * Update layer index (for z-index calculation)
     */
    setIndex(index) {
        const oldIndex = this.index;
        this.index = index;

        // Log index change
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug(`Layer "${this.name}" index updated: ${oldIndex} → ${index}`);
        }
    }

    /**
     * Get layer index for z-index calculation
     */
    getIndex() {
        return this.index;
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
            color: this.color,
            parallaxOffset: this.parallaxOffset,
            index: this.index
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
