import { Asset } from '../models/Asset.js';
import { Logger } from '../utils/Logger.js';

/**
 * Asset library management
 */
export class AssetManager {
    constructor() {
        this.assets = new Map();
        this.categories = new Set();
        this.imageCache = new Map();
        this.loadDefaultAssets();
    }

    /**
     * Load default asset library
     */
    loadDefaultAssets() {
        const defaultAssets = {
            'Tiles': [
                { 
                    id: 'tile_grass', 
                    name: 'Grass', 
                    type: 'tile', 
                    category: 'Tiles',
                    width: 32, 
                    height: 32, 
                    color: '#2ecc71', 
                    imgSrc: null,
                    properties: { walkable: true, solid: false }
                },
                { 
                    id: 'tile_dirt', 
                    name: 'Dirt', 
                    type: 'tile', 
                    category: 'Tiles',
                    width: 32, 
                    height: 32, 
                    color: '#95a5a6', 
                    imgSrc: null,
                    properties: { walkable: true, solid: false }
                },
                { 
                    id: 'tile_stone', 
                    name: 'Stone', 
                    type: 'tile', 
                    category: 'Tiles',
                    width: 32, 
                    height: 32, 
                    color: '#7f8c8d', 
                    imgSrc: null,
                    properties: { walkable: false, solid: true }
                }
            ],
            'Enemies': [
                { 
                    id: 'enemy_slime', 
                    name: 'Slime', 
                    type: 'enemy', 
                    category: 'Enemies',
                    width: 32, 
                    height: 32, 
                    color: '#e74c3c', 
                    imgSrc: null,
                    properties: { health: 10, speed: 1, damage: 5 }
                },
                { 
                    id: 'enemy_goblin', 
                    name: 'Goblin', 
                    type: 'enemy', 
                    category: 'Enemies',
                    width: 32, 
                    height: 32, 
                    color: '#27ae60', 
                    imgSrc: null,
                    properties: { health: 15, speed: 2, damage: 8 }
                }
            ],
            'Items': [
                { 
                    id: 'item_coin', 
                    name: 'Coin', 
                    type: 'item', 
                    category: 'Items',
                    width: 16, 
                    height: 16, 
                    color: '#f1c40f', 
                    imgSrc: null,
                    properties: { value: 10, collectible: true }
                },
                { 
                    id: 'item_health', 
                    name: 'Health Potion', 
                    type: 'item', 
                    category: 'Items',
                    width: 16, 
                    height: 16, 
                    color: '#e74c3c', 
                    imgSrc: null,
                    properties: { healAmount: 25, collectible: true }
                }
            ],
            'Prefabs': []
        };

        Object.entries(defaultAssets).forEach(([category, assets]) => {
            this.categories.add(category);
            assets.forEach(assetData => {
                const asset = new Asset(assetData);
                this.assets.set(asset.id, asset);
            });
        });
    }

    /**
     * Add asset to library
     */
    addAsset(assetData) {
        const asset = new Asset(assetData);
        this.assets.set(asset.id, asset);
        this.categories.add(asset.category);
        return asset;
    }

    /**
     * Remove asset from library
     */
    removeAsset(assetId) {
        return this.assets.delete(assetId);
    }

    /**
     * Get asset by ID
     */
    getAsset(assetId) {
        return this.assets.get(assetId);
    }

    /**
     * Get all assets
     */
    getAllAssets() {
        return Array.from(this.assets.values());
    }

    /**
     * Get assets by category
     */
    getAssetsByCategory(category) {
        return this.getAllAssets().filter(asset => asset.category === category);
    }

    /**
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categories);
    }

    /**
     * Search assets by name or tags
     */
    searchAssets(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllAssets().filter(asset => 
            asset.name.toLowerCase().includes(lowerQuery) ||
            asset.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Preload asset images
     */
    async preloadImages() {
        try {
            const promises = this.getAllAssets()
                .filter(asset => asset.imgSrc)
                .map(asset => this.loadImage(asset.imgSrc));
            
            await Promise.all(promises);
        } catch (error) {
            console.warn('Failed to preload some images:', error);
            // Don't throw - let the editor continue with partial asset loading
        }
    }

    /**
     * Load and cache image
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            if (this.imageCache.has(src)) {
                resolve(this.imageCache.get(src));
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.imageCache.set(src, img);
                resolve(img);
            };
            img.onerror = (error) => {
                console.warn(`Failed to load image: ${src}`, error);
                reject(error);
            };
            img.src = src;
        });
    }

    /**
     * Get cached image
     */
    getCachedImage(src) {
        return this.imageCache.get(src);
    }

    /**
     * Export asset library to JSON
     */
    exportToJSON() {
        const data = {
            categories: Array.from(this.categories),
            assets: this.getAllAssets().map(asset => asset.toJSON())
        };
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import asset library from JSON
     */
    importFromJSON(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Clear existing assets
            this.assets.clear();
            this.categories.clear();
            
            // Import categories
            if (data.categories) {
                data.categories.forEach(category => this.categories.add(category));
            }
            
            // Import assets
            if (data.assets) {
                data.assets.forEach(assetData => {
                    const asset = Asset.fromJSON(assetData);
                    this.assets.set(asset.id, asset);
                });
            }
            
            return true;
        } catch (error) {
            Logger.asset.error('Failed to import asset library:', error);
            return false;
        }
    }
}
