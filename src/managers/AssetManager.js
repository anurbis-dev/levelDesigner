import { Asset } from '../models/Asset.js';
import { Logger } from '../utils/Logger.js';

/**
 * Asset library management
 */
export class AssetManager {
    constructor(stateManager = null) {
        this.assets = new Map();
        this.categories = new Set();
        this.imageCache = new Map();
        this.stateManager = stateManager;
        this.contentStructure = null; // Store manifest structure
        this.loadDefaultAssets();
    }

    /**
     * Load default asset library (empty - no default assets)
     */
    loadDefaultAssets() {
        // No default assets - all assets loaded from content folder
        Logger.asset.debug('AssetManager: No default assets to load');
    }

    /**
     * Scan content folder and load all JSON files as assets
     * @returns {Promise<Object>} Scan result with statistics
     */
    async scanContentFolder() {
        try {
            Logger.asset.info('AssetManager: Starting content folder scan');
            
            const result = {
                totalFiles: 0,
                loadedAssets: 0,
                categories: new Set(),
                errors: []
            };

            // Load manifest file (with cache busting to ensure fresh data)
            try {
                const timestamp = Date.now();
                const response = await fetch(`./content/manifest.json?v=${timestamp}`);
                if (!response.ok) {
                    Logger.asset.warn('AssetManager: manifest.json not found, building from structure');
                    await this.buildCategoriesFromStructure(result);
                    return result;
                }

                const manifest = await response.json();
                Logger.asset.info('AssetManager: Loaded manifest.json', manifest);
                Logger.asset.info(`AssetManager: Manifest contains ${manifest.files ? manifest.files.length : 0} files`);

                // Store manifest structure for FoldersPanel
                this.contentStructure = manifest.structure;

                // Build categories from structure
                if (manifest.structure) {
                    this.buildCategoriesFromManifest(manifest.structure, '', result);
                }

                // Load JSON files listed in manifest
                if (manifest.files && manifest.files.length > 0) {
                    Logger.asset.info(`AssetManager: Loading ${manifest.files.length} files from manifest`);
                    for (const filePath of manifest.files) {
                        try {
                            await this.loadAssetFromFile(filePath, result);
                        } catch (error) {
                            Logger.asset.error(`AssetManager: Error loading ${filePath}:`, error);
                            result.errors.push(`Failed to load ${filePath}: ${error.message}`);
                        }
                    }
                } else {
                    Logger.asset.warn('AssetManager: No files listed in manifest.json');
                    Logger.asset.warn('AssetManager: Please update manifest.json with your asset files');
                }

                Logger.asset.info(`AssetManager: Content scan complete. Loaded ${result.loadedAssets} assets from ${result.totalFiles} files`);
                Logger.asset.info(`AssetManager: Categories found: ${Array.from(result.categories).join(', ')}`);

                // DO NOT create tabs here - tabs are managed by AssetPanel
                // AssetPanel will create only one default tab 'root' at initialization
                // Other tabs are created by user dragging folders to tabs container

                // Notify state manager about asset changes
                if (this.stateManager) {
                    this.stateManager.notify('assetsChanged');
                }

                return result;
            } catch (error) {
                Logger.asset.error('AssetManager: Error loading manifest:', error);
                result.errors.push(`Manifest error: ${error.message}`);
                return result;
            }
        } catch (error) {
            Logger.asset.error('AssetManager: Error scanning content folder:', error);
            return { totalFiles: 0, loadedAssets: 0, categories: new Set(), errors: [error.message] };
        }
    }

    /**
     * Build categories from manifest structure
     * @param {Object} structure - Manifest structure object
     * @param {string} parentPath - Parent path for recursion
     * @param {Object} result - Result object to update
     */
    buildCategoriesFromManifest(structure, parentPath, result) {
        for (const [key, value] of Object.entries(structure)) {
            const currentPath = parentPath ? `${parentPath}/${key}` : key;
            
            // Only add top-level folders as categories (for tabs)
            // Top-level means parentPath is empty
            if (!parentPath) {
                this.categories.add(key);
                result.categories.add(key);
                Logger.asset.debug(`AssetManager: Added top-level category "${key}"`);
            } else {
                Logger.asset.debug(`AssetManager: Skipped nested folder "${key}" at path "${currentPath}"`);
            }

            // Recursively process nested structure
            if (value && typeof value === 'object' && Object.keys(value).length > 0) {
                this.buildCategoriesFromManifest(value, currentPath, result);
            }
        }
    }

    /**
     * Build categories from known folder structure
     * @param {Object} result - Result object to update
     */
    async buildCategoriesFromStructure(result) {
        const knownCategories = [
            'assets',
            'backgrounds',
            'characters',
            'collectibles',
            'effects',
            'flora',
            'platforms',
            'graphs',
            'maps'
        ];

        for (const category of knownCategories) {
            this.categories.add(category);
            result.categories.add(category);
        }

        Logger.asset.info('AssetManager: Built categories from known structure');
    }

    /**
     * Load asset from JSON file
     * @param {string} filePath - Path to JSON file
     * @param {Object} result - Result object to update
     */
    async loadAssetFromFile(filePath, result) {
        // Add cache busting to ensure fresh data
        const timestamp = Date.now();
        const response = await fetch(`./content/${filePath}?v=${timestamp}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const assetData = await response.json();
        result.totalFiles++;
        Logger.asset.info(`AssetManager: Loading asset file: ${filePath}`);

        // Parse file path
        const pathParts = filePath.split('/');
        const filename = pathParts[pathParts.length - 1].replace('.json', '');
        
        // Determine category from parent folder (can be any folder in path)
        // For "assets/TEST/file.json" -> category is "TEST"
        // For "graphs/file.json" -> category is "graphs"
        // For "maps/subfolder/file.json" -> category is "subfolder"
        const category = pathParts[pathParts.length - 2] || pathParts[0] || 'Uncategorized';

        // Get single image source (support both imgSrc and image fields)
        let imgSrc = null;
        if (assetData.imgSrc) {
            // If imgSrc is array, take first element; otherwise use as is
            imgSrc = Array.isArray(assetData.imgSrc) ? assetData.imgSrc[0] : assetData.imgSrc;
        } else if (assetData.image) {
            imgSrc = assetData.image;
        }

        // Build full path to image relative to content folder
        if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
            const assetDir = pathParts.slice(0, -1).join('/');
            imgSrc = `./content/${assetDir}/${imgSrc}`;
            Logger.asset.info(`AssetManager: Built image path: ${imgSrc}`);
            Logger.asset.info(`AssetManager: Image should be at: content/${assetDir}/${imgSrc.split('/').pop()}`);
        } else if (!imgSrc) {
            Logger.asset.warn(`AssetManager: No image source found for ${assetData.name} in ${filePath}`);
        }

        // Generate UNIQUE ID from full path if not provided
        // This ensures same filename in different folders gets different IDs
        let assetId = assetData.id;
        if (!assetId) {
            // Use full path to ensure uniqueness: "assets/TEST/file" -> "asset_assets_TEST_file"
            const pathForId = pathParts.slice(0, -1).join('_') + '_' + filename;
            assetId = `asset_${pathForId}`.replace(/[^a-zA-Z0-9_]/g, '_');
            Logger.asset.info(`AssetManager: Generated unique ID from path: ${assetId}`);
        }

        // Create asset with normalized data (single image only)
        const asset = this.addAsset({
            id: assetId,
            name: assetData.name,
            type: assetData.type || 'object',
            category: category,
            path: filePath,
            width: assetData.width || 32,
            height: assetData.height || 32,
            color: assetData.color || '#cccccc',
            imgSrc: imgSrc,
            properties: assetData.properties || {},
            tags: assetData.tags || []
        });

        result.loadedAssets++;
        Logger.asset.info(`AssetManager: Loaded asset "${asset.name}" with imgSrc: ${asset.imgSrc}`);
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
     * Get list of categories that have at least one asset
     * Simple logic: return all unique categories from loaded assets
     * @returns {Array<string>} Array of category names with assets
     */
    getCategoriesWithAssets() {
        const categoriesWithAssets = new Set();
        
        // Collect all unique categories from assets
        for (const asset of this.assets.values()) {
            if (asset.category) {
                categoriesWithAssets.add(asset.category);
            }
        }
        
        const result = Array.from(categoriesWithAssets);
        Logger.asset.debug('AssetManager: Categories with assets:', result);
        return result;
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
     * Preload asset images and sync to CanvasRenderer
     */
    async preloadImages() {
        try {
            const assetsWithImages = this.getAllAssets().filter(asset => asset.imgSrc);
            Logger.asset.info(`AssetManager: Preloading ${assetsWithImages.length} images`);
            
            const promises = assetsWithImages.map(async (asset) => {
                try {
                    const img = await this.loadImage(asset.imgSrc);
                    // Sync to CanvasRenderer cache
                    this.syncImageToCanvasRenderer(asset.imgSrc, img);
                    Logger.asset.debug(`✅ Preloaded and synced: ${asset.name}`);
                } catch (error) {
                    Logger.asset.warn(`⚠️ Failed to preload ${asset.name}:`, error);
                }
            });
            
            await Promise.all(promises);
            Logger.asset.info('AssetManager: Image preloading complete');
        } catch (error) {
            Logger.asset.warn('Failed to preload some images:', error);
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
                Logger.asset.warn(`Failed to load image: ${src}`, error);
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
     * Sync image to CanvasRenderer cache
     * @param {string} src - Image source
     * @param {HTMLImageElement} img - Image element
     */
    syncImageToCanvasRenderer(src, img) {
        // Try to find CanvasRenderer through StateManager
        if (this.stateManager && this.stateManager.get('canvasRenderer')) {
            const canvasRenderer = this.stateManager.get('canvasRenderer');
            if (canvasRenderer && canvasRenderer.cacheImage) {
                canvasRenderer.cacheImage(src, img);
                Logger.asset.debug(`✅ AssetManager: Image synced to CanvasRenderer for ${src}`);
            }
        }
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

    /**
     * Add external asset from import
     * @param {Object} assetData - Asset data from import
     * @returns {Asset} Created asset instance
     */
    addExternalAsset(assetData) {
        Logger.asset.info(`💾 AssetManager.addExternalAsset CALLED with:`, {
            id: assetData.id,
            name: assetData.name,
            category: assetData.category,
            path: assetData.path,
            type: assetData.type,
            hasImgSrc: !!assetData.imgSrc,
            imgSrcLength: assetData.imgSrc ? assetData.imgSrc.length : 0,
            imgSrcStart: assetData.imgSrc ? assetData.imgSrc.substring(0, 50) + '...' : 'null'
        });
        
        const asset = new Asset(assetData);
        this.assets.set(asset.id, asset);
        this.categories.add(asset.category);

        // Load image into cache if imgSrc is available
        if (asset.imgSrc && asset.imgSrc.trim() !== '') {
            this.loadImage(asset.imgSrc).then((img) => {
                Logger.asset.debug(`✅ AssetManager: Image cached for ${asset.name}`);
                // Also cache in CanvasRenderer if available
                this.syncImageToCanvasRenderer(asset.imgSrc, img);
            }).catch(error => {
                Logger.asset.warn(`⚠️ AssetManager: Failed to cache image for ${asset.name}:`, error);
            });
        }

        Logger.asset.info(`✅ AssetManager: Stored asset ${asset.name} with path: ${asset.path} | Total assets: ${this.assets.size}`);

        // Update StateManager if available
        if (this.stateManager) {
            this.updateStateManagerCategories();
            // Notify about asset changes
            this.stateManager.set('assetsChanged', Date.now());
            Logger.asset.debug('AssetManager: StateManager notified of asset changes');
        }

        return asset;
    }

    /**
     * Update StateManager with current categories
     */
    updateStateManagerCategories() {
        if (!this.stateManager) return;
        
        const currentOrder = this.stateManager.get('assetTabOrder') || [];
        const newCategories = Array.from(this.categories);
        
        // Add new categories to the end of the order
        const updatedOrder = [...currentOrder];
        newCategories.forEach(category => {
            if (!updatedOrder.includes(category)) {
                updatedOrder.push(category);
            }
        });
        
        // Update StateManager
        this.stateManager.set('assetTabOrder', updatedOrder);
    }

    /**
     * Get assets by category (including external assets)
     * @param {string} category - Category name
     * @returns {Array} Array of assets in category
     */
    getAssetsByCategory(category) {
        return this.getAllAssets().filter(asset => asset.category === category);
    }

    /**
     * Get all available categories
     * @returns {Array} Array of category names
     */
    getCategories() {
        return Array.from(this.categories);
    }

    /**
     * Update an existing asset
     * @param {string} assetId - Asset ID
     * @param {Object} updatedData - Updated asset data
     */
    updateAsset(assetId, updatedData) {
        const asset = this.assets.get(assetId);
        if (!asset) {
            Logger.asset.warn(`Asset not found for update: ${assetId}`);
            return false;
        }

        // Update asset properties (current state - state 2)
        Object.assign(asset, updatedData);
        
        // Update categories if category changed
        if (updatedData.category && updatedData.category !== asset.category) {
            this.categories.add(updatedData.category);
            this.updateStateManagerCategories();
        }

        // Check if current state differs from original state (from JSON file)
        const hasChanges = asset.hasChangesFromOriginal ? asset.hasChangesFromOriginal() : false;

        // Update properties and set hasUnsavedChanges flag only if differs from original
        if (!asset.properties) {
            asset.properties = {};
        }
        
        asset.properties.lastModified = Date.now();
        asset.properties.hasUnsavedChanges = hasChanges;
        
        Logger.asset.debug(`Asset ${asset.name}: hasUnsavedChanges = ${hasChanges}`);
        Logger.asset.info(`Updated asset: ${asset.name}`);
        
        // Notify UI components
        if (this.stateManager) {
            this.stateManager.notify('assetsChanged');
        }
        
        return true;
    }

    /**
     * Clear all assets
     */
    clearExternalAssets() {
        // Clear all assets (no default assets to keep)
        this.assets.clear();
        this.categories.clear();
        
        // Update StateManager
        if (this.stateManager) {
            this.stateManager.set('assetTabOrder', []);
            this.stateManager.set('activeAssetTabs', new Set());
            this.stateManager.notify('assetsChanged');
        }
        
        Logger.asset.info('AssetManager: Cleared all assets');
    }
}
