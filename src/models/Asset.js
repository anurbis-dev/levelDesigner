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
        
        // Store original state for comparison (state 1 - from JSON file)
        this._originalState = null;
        if (!data._isClone) {
            this.saveOriginalState();
        }
    }

    generateId() {
        return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save current state as original state (from JSON file)
     */
    saveOriginalState() {
        // Normalize imgSrc when saving original state to match comparison logic
        const normalizedImgSrc = (this.imgSrc === null || this.imgSrc === undefined || this.imgSrc === '') ? null : this.imgSrc;
        
        this._originalState = {
            name: this.name,
            type: this.type,
            category: this.category,
            width: this.width,
            height: this.height,
            color: this.color,
            imgSrc: normalizedImgSrc
        };
    }

    /**
     * Check if current state differs from original state
     * @returns {boolean} True if asset has been modified
     */
    hasChangesFromOriginal() {
        if (!this._originalState) return false;

        // Normalize imgSrc values: null, undefined, and empty string are treated as equivalent
        const currentImgSrc = (this.imgSrc === null || this.imgSrc === undefined || this.imgSrc === '') ? null : this.imgSrc;
        const originalImgSrc = (this._originalState.imgSrc === null || this._originalState.imgSrc === undefined || this._originalState.imgSrc === '') ? null : this._originalState.imgSrc;

        // Compare values, converting numbers to ensure type consistency
        const currentWidth = Number(this.width);
        const originalWidth = Number(this._originalState.width);
        const currentHeight = Number(this.height);
        const originalHeight = Number(this._originalState.height);
        
        // Normalize color values (case-insensitive comparison)
        const currentColor = (this.color || '').toUpperCase().trim();
        const originalColor = (this._originalState.color || '').toUpperCase().trim();
        
        // Normalize name, type, category (trim whitespace)
        const currentName = (this.name || '').trim();
        const originalName = (this._originalState.name || '').trim();
        const currentType = (this.type || '').trim();
        const originalType = (this._originalState.type || '').trim();
        const currentCategory = (this.category || '').trim();
        const originalCategory = (this._originalState.category || '').trim();

        return (
            currentName !== originalName ||
            currentType !== originalType ||
            currentCategory !== originalCategory ||
            currentWidth !== originalWidth ||
            currentHeight !== originalHeight ||
            currentColor !== originalColor ||
            currentImgSrc !== originalImgSrc
        );
    }

    /**
     * Get original state
     * @returns {Object} Original state object
     */
    getOriginalState() {
        return this._originalState ? { ...this._originalState } : null;
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
            // Don't set zIndex here - it will be assigned by Level.addObject()
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
