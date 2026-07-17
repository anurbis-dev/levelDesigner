import { GameObject } from './GameObject.js';
import {
    isImageAsset,
    getImageDiskSrc,
    resolveTextureSrc,
    assetToPersistable
} from '../ui/asset-editor/AssetVisualMigrate.js';

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
        // Disk texture only for type=image; composites use Sprite.imageAssetId
        this.imgSrc = isImageAsset({ type: this.type })
            ? (data.imgSrc || null)
            : null;
        this.properties = data.properties || {};
        this.tags = data.tags || [];
        this.components = data.components || [];

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
        const disk = isImageAsset(this) ? (getImageDiskSrc(this) || null) : null;
        this._originalState = {
            name: this.name,
            type: this.type,
            category: this.category,
            width: this.width,
            height: this.height,
            color: this.color,
            imgSrc: disk,
            componentsSignature: JSON.stringify(this.components || [])
        };
    }

    /**
     * Check if current state differs from original state
     * @returns {boolean}
     */
    hasChangesFromOriginal() {
        if (!this._originalState) return false;

        const currentImgSrc = isImageAsset(this) ? (getImageDiskSrc(this) || null) : null;
        const originalImgSrc = this._originalState.imgSrc || null;

        const currentWidth = Number(this.width);
        const originalWidth = Number(this._originalState.width);
        const currentHeight = Number(this.height);
        const originalHeight = Number(this._originalState.height);

        const currentColor = (this.color || '').toUpperCase().trim();
        const originalColor = (this._originalState.color || '').toUpperCase().trim();

        const currentName = (this.name || '').trim();
        const originalName = (this._originalState.name || '').trim();
        const currentType = (this.type || '').trim();
        const originalType = (this._originalState.type || '').trim();
        const currentCategory = (this.category || '').trim();
        const originalCategory = (this._originalState.category || '').trim();

        return (
            currentName !== originalName
            || currentType !== originalType
            || currentCategory !== originalCategory
            || currentWidth !== originalWidth
            || currentHeight !== originalHeight
            || currentColor !== originalColor
            || currentImgSrc !== originalImgSrc
            || JSON.stringify(this.components || []) !== (this._originalState.componentsSignature || '[]')
        );
    }

    getOriginalState() {
        return this._originalState ? { ...this._originalState } : null;
    }

    /**
     * Create a game object instance from this asset.
     * @param {number} x
     * @param {number} y
     * @param {string|null} layerId
     * @param {object|null} [assetManager] required to resolve Sprite→Image refs
     */
    createInstance(x = 0, y = 0, layerId = null, assetManager = null) {
        const imgSrc = resolveTextureSrc(this, assetManager);
        const instanceData = {
            id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: this.name,
            type: this.type,
            x,
            y,
            width: this.width,
            height: this.height,
            color: this.color,
            imgSrc,
            visible: true,
            locked: false,
            layerId,
            properties: { ...this.properties },
            components: (this.components || []).map((c) => ({
                ...c,
                properties: { ...(c.properties || {}) }
            }))
        };
        return new GameObject(instanceData);
    }

    /**
     * Serialize asset to JSON (no imgSrc on non-image).
     */
    toJSON() {
        return assetToPersistable(this);
    }

    static fromJSON(data) {
        return new Asset(data);
    }
}
