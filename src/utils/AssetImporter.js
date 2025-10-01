import { Asset } from '../models/Asset.js';
import { Logger } from './Logger.js';
import { FolderPickerDialog } from '../ui/FolderPickerDialog.js';

/**
 * Asset Importer
 * Imports assets from external folders into the editor
 */
export class AssetImporter {
    constructor(assetManager) {
        this.assetManager = assetManager;
        this.logger = Logger.asset || {
            info: console.log,
            error: console.error,
            warn: console.warn,
            debug: console.debug
        };
    }

    /**
     * Import assets from a selected folder
     * @param {string} folderPath - Path to the assets folder
     * @returns {Promise<Object>} Import result with statistics
     */
    async importFromFolder(folderPath) {
        try {
            this.logger.info('Starting asset import from:', folderPath);
            
            // Check if folder exists and is accessible
            if (!await this.checkFolderAccess(folderPath)) {
                throw new Error('Folder is not accessible or does not exist');
            }

            // Scan folder structure
            const folderStructure = await this.scanFolderStructure(folderPath);
            this.logger.debug('Folder structure:', folderStructure);

            // Import assets from each category folder
            const importResults = await this.importAssetsFromStructure(folderStructure, folderPath);
            
            // Update asset manager with new categories
            this.updateAssetManagerCategories(importResults.categories);

            this.logger.info('Asset import completed:', importResults);
            return importResults;

        } catch (error) {
            this.logger.error('Asset import failed:', error);
            throw error;
        }
    }

    /**
     * Check if folder is accessible
     * @param {string} folderPath - Path to check
     * @returns {Promise<boolean>} True if accessible
     */
    async checkFolderAccess(folderPath) {
        try {
            // In a real implementation, this would use File System Access API
            // For now, we'll assume the folder is accessible if the path is provided
            return folderPath && folderPath.length > 0;
        } catch (error) {
            this.logger.error('Folder access check failed:', error);
            return false;
        }
    }

    /**
     * Scan folder structure to find asset categories
     * @param {string} folderPath - Root folder path
     * @returns {Promise<Object>} Folder structure with categories
     */
    async scanFolderStructure(folderPath) {
        // This is a simplified version - in real implementation would use File System Access API
        // For now, we'll return a mock structure based on common asset folder patterns
        const structure = {
            categories: [],
            totalAssets: 0
        };

        // Common asset folder patterns
        const commonCategories = [
            'backgrounds', 'characters', 'platforms', 'collectibles', 
            'effects', 'ui', 'tiles', 'enemies', 'items', 'objects'
        ];

        // In a real implementation, this would scan the actual folder
        // For now, we'll simulate finding these categories
        for (const category of commonCategories) {
            const categoryPath = `${folderPath}/${category}`;
            const assets = await this.scanCategoryFolder(categoryPath, category);
            if (assets.length > 0) {
                structure.categories.push({
                    name: this.capitalizeFirst(category),
                    path: categoryPath,
                    assets: assets
                });
                structure.totalAssets += assets.length;
            }
        }

        return structure;
    }

    /**
     * Scan a specific category folder for assets
     * @param {string} categoryPath - Path to category folder
     * @param {string} categoryName - Name of the category
     * @returns {Promise<Array>} Array of found assets
     */
    async scanCategoryFolder(categoryPath, categoryName) {
        const assets = [];
        
        // In a real implementation, this would scan the actual folder
        // For now, we'll create mock assets based on the category
        const mockAssets = this.generateMockAssetsForCategory(categoryName);
        
        for (const assetData of mockAssets) {
            const asset = new Asset({
                id: assetData.id,
                name: assetData.name,
                type: assetData.type,
                category: this.capitalizeFirst(categoryName),
                width: assetData.width,
                height: assetData.height,
                color: assetData.color,
                imgSrc: assetData.imgSrc,
                properties: assetData.properties,
                tags: assetData.tags
            });
            assets.push(asset);
        }

        return assets;
    }

    /**
     * Generate mock assets for a category (for demonstration)
     * @param {string} categoryName - Name of the category
     * @returns {Array} Array of mock asset data
     */
    generateMockAssetsForCategory(categoryName) {
        const mockAssets = {
            'backgrounds': [
                { id: 'bg-sky', name: 'Sky Background', type: 'background', width: 1024, height: 768, color: '#87CEEB', imgSrc: 'sky.png', properties: { parallax: true }, tags: ['sky', 'background'] },
                { id: 'bg-mountains', name: 'Mountains', type: 'background', width: 1024, height: 512, color: '#8B7355', imgSrc: 'mountains.png', properties: { parallax: true }, tags: ['mountains', 'background'] }
            ],
            'characters': [
                { id: 'char-player', name: 'Player', type: 'character', width: 32, height: 32, color: '#FF6B6B', imgSrc: 'player.png', properties: { health: 100, speed: 5 }, tags: ['player', 'character'] },
                { id: 'char-enemy', name: 'Enemy', type: 'character', width: 32, height: 32, color: '#4ECDC4', imgSrc: 'enemy.png', properties: { health: 50, speed: 3 }, tags: ['enemy', 'character'] }
            ],
            'platforms': [
                { id: 'platform-grass', name: 'Grass Platform', type: 'platform', width: 32, height: 32, color: '#2ECC71', imgSrc: 'grass.png', properties: { solid: true, breakable: false }, tags: ['platform', 'grass'] },
                { id: 'platform-stone', name: 'Stone Platform', type: 'platform', width: 32, height: 32, color: '#95A5A6', imgSrc: 'stone.png', properties: { solid: true, breakable: false }, tags: ['platform', 'stone'] }
            ],
            'collectibles': [
                { id: 'coin-gold', name: 'Gold Coin', type: 'collectible', width: 16, height: 16, color: '#F1C40F', imgSrc: 'coin.png', properties: { value: 10, collectible: true }, tags: ['coin', 'collectible'] },
                { id: 'powerup-mushroom', name: 'Mushroom', type: 'powerup', width: 32, height: 32, color: '#E74C3C', imgSrc: 'mushroom.png', properties: { effect: 'grow', duration: 10000 }, tags: ['powerup', 'mushroom'] }
            ],
            'effects': [
                { id: 'effect-explosion', name: 'Explosion', type: 'effect', width: 64, height: 64, color: '#FF9500', imgSrc: 'explosion.png', properties: { animation: true, duration: 1000 }, tags: ['effect', 'explosion'] },
                { id: 'effect-particle', name: 'Particle', type: 'effect', width: 8, height: 8, color: '#FFD700', imgSrc: 'particle.png', properties: { animation: true, duration: 500 }, tags: ['effect', 'particle'] }
            ],
            'ui': [
                { id: 'ui-button', name: 'Button', type: 'ui', width: 128, height: 32, color: '#3498DB', imgSrc: 'button.png', properties: { interactive: true }, tags: ['ui', 'button'] },
                { id: 'ui-icon', name: 'Icon', type: 'ui', width: 24, height: 24, color: '#9B59B6', imgSrc: 'icon.png', properties: { interactive: false }, tags: ['ui', 'icon'] }
            ]
        };

        return mockAssets[categoryName] || [];
    }

    /**
     * Import assets from folder structure
     * @param {Object} structure - Folder structure with categories
     * @param {string} basePath - Base path for assets
     * @returns {Promise<Object>} Import results
     */
    async importAssetsFromStructure(structure, basePath) {
        const results = {
            categories: [],
            totalImported: 0,
            errors: []
        };

        for (const category of structure.categories) {
            try {
                const categoryResults = await this.importCategory(category, basePath);
                results.categories.push(categoryResults);
                results.totalImported += categoryResults.importedCount;
            } catch (error) {
                this.logger.error(`Failed to import category ${category.name}:`, error);
                results.errors.push({
                    category: category.name,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Import a single category
     * @param {Object} category - Category data
     * @param {string} basePath - Base path for assets
     * @returns {Promise<Object>} Category import results
     */
    async importCategory(category, basePath) {
        const results = {
            name: category.name,
            importedCount: 0,
            assets: []
        };

        for (const asset of category.assets) {
            try {
                // Add external asset to asset manager
                this.assetManager.addExternalAsset(asset);
                results.assets.push(asset);
                results.importedCount++;
                this.logger.debug(`Imported asset: ${asset.name} (${asset.id})`);
            } catch (error) {
                this.logger.error(`Failed to import asset ${asset.name}:`, error);
            }
        }

        return results;
    }

    /**
     * Update asset manager with new categories
     * @param {Array} categories - Array of category names
     */
    updateAssetManagerCategories(categories) {
        // Update StateManager with new categories
        const currentOrder = this.assetManager.stateManager?.get('assetTabOrder') || [];
        const newCategories = categories.map(cat => cat.name);
        
        // Add new categories to the end of the order
        const updatedOrder = [...currentOrder];
        newCategories.forEach(category => {
            if (!updatedOrder.includes(category)) {
                updatedOrder.push(category);
            }
        });

        // Update StateManager
        if (this.assetManager.stateManager) {
            this.assetManager.stateManager.set('assetTabOrder', updatedOrder);
        }
    }

    /**
     * Capitalize first letter of a string
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Show folder picker dialog
     * @returns {Promise<string|null>} Selected folder path or null
     */
    async showFolderPicker() {
        try {
            const dialog = new FolderPickerDialog();
            const folderPath = await dialog.show();
            return folderPath;
        } catch (error) {
            this.logger.error('Folder picker failed:', error);
            return null;
        }
    }
}
