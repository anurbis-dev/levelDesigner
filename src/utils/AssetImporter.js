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
    }

    /**
     * Import assets from a selected folder
     * @param {string} folderPath - Path to the assets folder
     * @param {Array} selectedFiles - Array of selected files from FolderPickerDialog
     * @returns {Promise<Object>} Import result with statistics
     */
    async importFromFolder(folderPath, selectedFiles = null) {
        try {
            console.log('🚀 IMPORT FROM FOLDER STARTED - DIRECT CONSOLE LOG');
            console.log(`📂 folderPath: "${folderPath}"`);
            console.log(`📁 selectedFiles:`, selectedFiles);
            
            Logger.asset.info('🚀 IMPORT FROM FOLDER STARTED');
            Logger.asset.info(`📂 folderPath: "${folderPath}"`);
            Logger.asset.info(`📁 selectedFiles: ${selectedFiles ? `Array with ${selectedFiles.length} items` : 'NULL/UNDEFINED'}`);

            // CRITICAL CHECK: Log the exact condition evaluation
            Logger.asset.info(`🔍 CONDITION CHECK: selectedFiles=${!!selectedFiles}, length=${selectedFiles ? selectedFiles.length : 'N/A'}, condition result=${selectedFiles && selectedFiles.length > 0}`);

            if (selectedFiles && selectedFiles.length > 0) {
                console.log(`✅ TAKING REAL FILES PATH: Processing ${selectedFiles.length} real files from folder`);
                Logger.asset.info(`✅ TAKING REAL FILES PATH: Processing ${selectedFiles.length} real files from folder`);

                // Debug: Check for nested files
                const nestedFiles = selectedFiles.filter(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
                Logger.asset.info(`🔍 NESTED FILES CHECK: Found ${nestedFiles.length} files with folder structure out of ${selectedFiles.length} total`);
                
                if (nestedFiles.length > 0) {
                    nestedFiles.slice(0, 3).forEach((f, i) => {
                        Logger.asset.info(`Nested file ${i + 1}: ${f.webkitRelativePath}`);
                    });
                } else {
                    Logger.asset.warn(`❌ NO NESTED FILES FOUND! All files might be at root level.`);
                }

                const importResults = await this.processSelectedFiles(selectedFiles);

                // Update asset manager with new categories
                this.updateAssetManagerCategories(importResults.categories);

                Logger.asset.info('Asset import completed:', importResults);
                return importResults;
            } else {
                console.log('🚨 TAKING MOCK/FALLBACK PATH - This should NOT happen with real imports!');
                console.log(`🚨 selectedFiles is:`, selectedFiles, `(type: ${typeof selectedFiles})`);
                
                Logger.asset.error('🚨 TAKING MOCK/FALLBACK PATH - This should NOT happen with real imports!');
                Logger.asset.error(`🚨 selectedFiles is: ${selectedFiles} (type: ${typeof selectedFiles})`);
                if (selectedFiles) {
                    Logger.asset.error(`🚨 selectedFiles.length is: ${selectedFiles.length} (type: ${typeof selectedFiles.length})`);
                }

                Logger.asset.warn('🔄 FALLBACK: Using mock implementation for backward compatibility');

                // Check if folder exists and is accessible
                if (!await this.checkFolderAccess(folderPath)) {
                    throw new Error('Folder is not accessible or does not exist');
                }

                // Scan folder structure
                const folderStructure = await this.scanFolderStructure(folderPath);
                Logger.asset.debug('Folder structure:', folderStructure);

                // Import assets from each category folder
                const importResults = await this.importAssetsFromStructure(folderStructure, folderPath);

                // Update asset manager with new categories
                this.updateAssetManagerCategories(importResults.categories);

                Logger.asset.info('Asset import completed:', importResults);
                return importResults;
            }

        } catch (error) {
            console.log('💥 ASSET IMPORT ERROR - DIRECT CONSOLE LOG:', error);
            Logger.asset.error('Asset import failed:', error);
            throw error;
        }
    }

    /**
     * Process selected files from FolderPickerDialog
     * @param {Array} selectedFiles - Array of file objects with webkitRelativePath
     * @returns {Promise<Object>} Import results
     */
    async processSelectedFiles(selectedFiles) {
        Logger.asset.info(`🔄 Processing ${selectedFiles.length} selected files`);

        // Store all files for image search
        this.allSelectedFiles = selectedFiles;

        // Filter for JSON files only - these contain asset definitions
        const jsonFiles = selectedFiles.filter(file => {
            const fileName = file.name || (file.webkitRelativePath ? file.webkitRelativePath.split('/').pop() : '');
            return fileName.toLowerCase().endsWith('.json');
        });

        Logger.asset.info(`📄 Found ${jsonFiles.length} JSON files out of ${selectedFiles.length} total files`);
        
        if (jsonFiles.length === 0) {
            Logger.asset.warn(`⚠️ No JSON files found! Looking for .json files that contain asset definitions.`);
            return {
                imported: 0,
                failed: 0,
                categories: [],
                assets: []
            };
        }
        
        const results = {
            imported: 0,
            failed: 0,
            categories: new Set(),
            assets: []
        };

        // Process only JSON files
        for (const jsonFile of jsonFiles) {
            try {
                Logger.asset.info(`📄 Processing JSON file: ${jsonFile.name}`);
                const asset = await this.processJsonAssetFile(jsonFile);
                if (asset) {
                    results.imported++;
                    results.categories.add(asset.category);
                    results.assets.push(asset);
                    
                    // Add to asset manager
                    this.assetManager.addExternalAsset(asset);
                    Logger.asset.info(`✅ JSON asset imported: ${asset.name}`);
                }
            } catch (error) {
                Logger.asset.error(`❌ Failed to process JSON file ${jsonFile.name}:`, error);
                results.failed++;
            }
        }

        return {
            ...results,
            categories: Array.from(results.categories)
        };
    }

    /**
     * Process a JSON asset file and load associated image
     * @param {File} jsonFile - JSON file containing asset definition
     * @returns {Promise<Asset|null>} Created asset or null
     */
    async processJsonAssetFile(jsonFile) {
        Logger.asset.info(`📄 Processing JSON asset file: ${jsonFile.name}`);
        
        try {
            // Read JSON content
            const { FileUtils } = await import('./FileUtils.js');
            const jsonContent = await FileUtils.readFileAsText(jsonFile);
            const assetData = JSON.parse(jsonContent);
            
            Logger.asset.debug(`📄 JSON content loaded:`, assetData);
            
            // Determine category from file path
            const category = this.determineCategoryFromPath(jsonFile.webkitRelativePath);
            
            // Try to find and load images
            let imageSources = [];
            let primaryImgSrc = null;
            let hasImageError = false;
            
            // Handle multiple images (imgSrc array)
            if (assetData.imgSrc && Array.isArray(assetData.imgSrc)) {
                Logger.asset.info(`🖼️ Processing multiple images: ${assetData.imgSrc.length} images`);
                for (const imgPath of assetData.imgSrc) {
                    const fullImgPath = this.getFullImagePath(imgPath, jsonFile.webkitRelativePath);
                    const foundImgFile = this.findImageFile(fullImgPath);
                    if (foundImgFile) {
                        try {
                            const dataUrl = await FileUtils.createDataURL(foundImgFile);
                            imageSources.push({
                                path: imgPath,
                                dataUrl: dataUrl,
                                filename: foundImgFile.name
                            });
                            if (!primaryImgSrc) primaryImgSrc = dataUrl;
                        } catch (error) {
                            Logger.asset.warn(`⚠️ Failed to load image ${imgPath}:`, error);
                            hasImageError = true;
                        }
                    } else {
                        Logger.asset.warn(`⚠️ Image file not found: ${fullImgPath}`);
                        hasImageError = true;
                    }
                }
            } 
            // Handle single image (legacy support)
            else if (assetData.image || assetData.imgSrc) {
                const imgPath = assetData.image || assetData.imgSrc;
                const fullImgPath = this.getFullImagePath(imgPath, jsonFile.webkitRelativePath);
                const foundImgFile = this.findImageFile(fullImgPath);
                if (foundImgFile) {
                    try {
                        const dataUrl = await FileUtils.createDataURL(foundImgFile);
                        imageSources.push({
                            path: imgPath,
                            dataUrl: dataUrl,
                            filename: foundImgFile.name
                        });
                        primaryImgSrc = dataUrl;
                    } catch (error) {
                        Logger.asset.warn(`⚠️ Failed to load image ${imgPath}:`, error);
                        hasImageError = true;
                    }
                } else {
                    Logger.asset.warn(`⚠️ Image file not found: ${fullImgPath}`);
                    hasImageError = true;
                }
            } else {
                Logger.asset.warn(`⚠️ No image path found in JSON file: ${jsonFile.name}`);
                hasImageError = true;
            }
            
            // Create asset with or without image
            const asset = await this.createAssetFromJsonData(assetData, category, jsonFile.webkitRelativePath, primaryImgSrc, imageSources, hasImageError);
            
            return asset;
            
        } catch (error) {
            Logger.asset.error(`❌ Failed to process JSON file ${jsonFile.name}:`, error);
            return null;
        }
    }

    /**
     * Find image file by path in selected files
     * @param {string} imagePath - Path to image file
     * @returns {File|null} Found image file or null
     */
    findImageFile(imagePath) {
        Logger.asset.debug(`🔍 Looking for image file: ${imagePath}`);
        
        // Search through all selected files for matching path
        for (const file of this.allSelectedFiles || []) {
            if (file.webkitRelativePath === imagePath) {
                Logger.asset.debug(`✅ Found image file: ${file.name}`);
                return file;
            }
        }
        
        Logger.asset.warn(`❌ Image file not found: ${imagePath}`);
        return null;
    }

    /**
     * Get full image path by combining relative path with JSON file directory
     * @param {string} imagePath - Relative image path from JSON
     * @param {string} jsonFilePath - JSON file path
     * @returns {string} Full image path
     */
    getFullImagePath(imagePath, jsonFilePath) {
        if (!imagePath) return '';
        
        // If imagePath is already absolute or starts with folder name, use as is
        if (imagePath.includes('/') && !imagePath.startsWith('./')) {
            return imagePath;
        }
        
        // Get directory from JSON file path
        const jsonDir = jsonFilePath ? 
            jsonFilePath.substring(0, jsonFilePath.lastIndexOf('/')) : 
            '';
        
        // Combine directory with image path
        return jsonDir ? `${jsonDir}/${imagePath}` : imagePath;
    }

    /**
     * Determine category from file path
     * @param {string} filePath - File path
     * @returns {string} Category name
     */
    determineCategoryFromPath(filePath) {
        if (!filePath) return 'objects';
        
        const pathParts = filePath.split('/');
        
        // Use the first folder name as the category, fallback to 'objects' if no folder structure
        if (pathParts.length > 1) {
            return pathParts[0].toLowerCase();
        }
        
        return 'objects';
    }

    /**
     * Create asset from JSON data with image handling
     * @param {Object} jsonData - Asset data from JSON
     * @param {string} category - Asset category
     * @param {string} filePath - File path
     * @param {string|null} primaryImgSrc - Primary image data URL
     * @param {Array} imageSources - All image sources
     * @param {boolean} hasImageError - Whether there were image loading errors
     * @returns {Promise<Asset>} Created asset
     */
    async createAssetFromJsonData(jsonData, category, filePath, primaryImgSrc, imageSources, hasImageError) {
        Logger.asset.info(`🎨 Creating asset from JSON data: ${jsonData.name || 'Unnamed'}`);
        
        try {
            // Get image dimensions or use defaults
            let dimensions = { width: 32, height: 32 };
            if (primaryImgSrc && !hasImageError) {
                try {
                    dimensions = await this.getImageDimensions(primaryImgSrc);
                } catch (error) {
                    Logger.asset.warn(`⚠️ Failed to get image dimensions, using defaults:`, error);
                }
            }
            
            // Create asset data
            const assetId = `json_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Use error icon if there were image loading issues
            const finalImgSrc = hasImageError ? this.createErrorIcon() : primaryImgSrc;
            
            const assetData = {
                id: assetId,
                name: jsonData.name || 'Unnamed Asset',
                type: jsonData.type || this.getAssetTypeFromCategory(category),
                category: category,
                imgSrc: finalImgSrc,
                width: jsonData.width || dimensions.width,
                height: jsonData.height || dimensions.height,
                color: jsonData.color || this.getDefaultColor(category),
                imageSources: imageSources,
                properties: {
                    created: jsonData.properties?.created || new Date().toISOString(),
                    isTemporary: false,
                    hasImageError: hasImageError,
                    sourceFile: filePath,
                    lastModified: Date.now()
                }
            };
            
            Logger.asset.info(`✅ Asset created from JSON: ${assetData.name} (${assetData.width}x${assetData.height})${hasImageError ? ' [IMAGE ERROR]' : ''}`);
            return assetData;
            
        } catch (error) {
            Logger.asset.error(`❌ Failed to create asset from JSON data:`, error);
            return null;
        }
    }

    /**
     * Create asset from JSON data and image file
     * @param {Object} jsonData - Asset data from JSON
     * @param {File} imageFile - Image file
     * @param {string} category - Asset category
     * @param {string} filePath - File path
     * @returns {Promise<Asset>} Created asset
     */
    async createAssetFromJsonAndImage(jsonData, imageFile, category, filePath) {
        Logger.asset.info(`🎨 Creating asset from JSON and image: ${jsonData.name || 'Unnamed'}`);
        
        try {
            // Create data URL for image
            const { FileUtils } = await import('./FileUtils.js');
            const imgSrc = await FileUtils.createDataURL(imageFile);
            
            // Get image dimensions
            const dimensions = await this.getImageDimensions(imgSrc);
            
            // Create asset data
            const assetId = `json_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Support multiple image sources from JSON
            const imageSources = [];
            if (jsonData.imgSrc && Array.isArray(jsonData.imgSrc)) {
                // Multiple images specified in JSON
                for (const imgPath of jsonData.imgSrc) {
                    const fullImgPath = this.getFullImagePath(imgPath, filePath);
                    const foundImgFile = this.findImageFile(fullImgPath);
                    if (foundImgFile) {
                        const dataUrl = await FileUtils.createDataURL(foundImgFile);
                        imageSources.push({
                            path: imgPath,
                            dataUrl: dataUrl,
                            filename: foundImgFile.name
                        });
                    }
                }
            } else if (jsonData.image || jsonData.imgSrc) {
                // Single image (legacy support)
                const imgPath = jsonData.image || jsonData.imgSrc;
                const fullImgPath = this.getFullImagePath(imgPath, filePath);
                const foundImgFile = this.findImageFile(fullImgPath);
                if (foundImgFile) {
                    const dataUrl = await FileUtils.createDataURL(foundImgFile);
                    imageSources.push({
                        path: imgPath,
                        dataUrl: dataUrl,
                        filename: foundImgFile.name
                    });
                }
            }
            
            // Fallback to the found image file if no sources from JSON
            if (imageSources.length === 0 && imageFile) {
                imageSources.push({
                    path: imageFile.name,
                    dataUrl: imgSrc,
                    filename: imageFile.name
                });
            }
            
            const assetData = {
                id: assetId,
                name: jsonData.name || imageFile.name.replace(/\.[^/.]+$/, ""),
                type: jsonData.type || this.getAssetTypeFromCategory(category),
                category: category,
                path: filePath,
                width: dimensions.width,
                height: dimensions.height,
                color: jsonData.color || this.getDefaultColor(category),
                imgSrc: imgSrc, // Primary image for display
                imageSources: imageSources, // All available images
                properties: {
                    sourceFile: imageFile.name,
                    fileSize: imageFile.size,
                    lastModified: Date.now(),
                    jsonData: jsonData,
                    hasMultipleImages: imageSources.length > 1
                },
                tags: [category, 'imported', 'json']
            };
            
            const asset = new Asset(assetData);
            Logger.asset.info(`✅ Asset created from JSON: ${asset.name} with ${imageSources.length} image(s)`);
            return asset;
            
        } catch (error) {
            Logger.asset.error(`❌ Failed to create asset from JSON:`, error);
            throw error;
        }
    }

    /**
     * Process a single file and create asset (DEPRECATED - use processJsonAssetFile)
     * @param {File} file - File object to process
     * @returns {Promise<Asset|null>} Created asset or null if unsupported
     */
    async processFile(file) {
        console.log('🔎 processFile CALLED with file object:', file);
        console.log('🔍 File properties:', {
            name: file?.name,
            type: file?.type,
            size: file?.size,
            webkitRelativePath: file?.webkitRelativePath,
            isUndefined: file === undefined,
            keys: file ? Object.keys(file) : 'FILE IS UNDEFINED'
        });
        
        if (!file) {
            Logger.asset.error('❌ processFile: file is undefined/null');
            return null;
        }
        
        // file.name should already be fixed in processSelectedFiles, but double-check
        if (!file.name) {
            Logger.asset.error('❌ processFile: file.name is still undefined after fixes. File object:', file);
            return null;
        }
        
        Logger.asset.info(`🔎 processFile CALLED: ${file.name} | Type: ${file.type} | Size: ${file.size}`);
        
        const fileName = file.name.toLowerCase();
        const relativePath = file.webkitRelativePath || file.name;

        Logger.asset.info(`📍 PATH ANALYSIS: fileName="${fileName}", webkitRelativePath="${file.webkitRelativePath || 'UNDEFINED'}", relativePath="${relativePath}"`);

        const pathParts = relativePath.split('/');
        Logger.asset.info(`📂 PATH PARTS: [${pathParts.join(' → ')}], length=${pathParts.length}`);

        // Determine category from folder structure - use first folder as category
        let category = 'objects'; // default
        if (pathParts.length > 1) {
            const folderName = pathParts[0].toLowerCase();
            // Map common folder names to categories
            const categoryMap = {
                'backgrounds': 'backgrounds',
                'characters': 'characters',
                'platforms': 'platforms',
                'collectibles': 'collectibles',
                'enemies': 'enemies',
                'effects': 'effects',
                'ui': 'ui',
                'tiles': 'tiles',
                'items': 'collectibles',
                'objects': 'objects',
                'environment': 'environment',
                'props': 'objects',
                'sprites': 'sprites',
                'textures': 'textures',
                'sounds': 'sounds',
                'music': 'music'
            };
            category = categoryMap[folderName] || folderName;
            
            Logger.asset.debug(`processFile: Mapped folder "${folderName}" to category "${category}"`);
            
            // Log structure for nested folders
            if (pathParts.length > 2) {
                Logger.asset.info(`📁 Deep folder structure: ${pathParts.join('/')} -> category: ${category}`);
            }
        }

        // file.type should already be fixed in processSelectedFiles, but double-check
        if (!file.type) {
            Logger.asset.error('❌ processFile: file.type is still undefined after fixes. File object:', file);
            return null;
        }

        // Create asset based on file type
        Logger.asset.debug(`processFile: Checking file type. file.type="${file.type}", isImage=${file.type?.startsWith('image/')}, isJSON=${fileName.endsWith('.json')}`);
        
        if (file.type && file.type.startsWith('image/')) {
            Logger.asset.info(`🖼️ Creating IMAGE ASSET for: ${file.name} with PATH: "${relativePath}"`);
            const result = await this.createImageAsset(file, category, relativePath);
            Logger.asset.info(`🎯 IMAGE ASSET RESULT: ${result ? `SUCCESS (path: "${result.path}")` : 'FAILED - null returned'}`);
            return result;
        } else if (fileName.endsWith('.json')) {
            Logger.asset.info(`📄 Creating DATA ASSET for: ${file.name} with PATH: "${relativePath}"`);
            const result = await this.createDataAsset(file, category, relativePath);
            Logger.asset.info(`🎯 DATA ASSET RESULT: ${result ? `SUCCESS (path: "${result.path}")` : 'FAILED - null returned'}`);
            return result;
        } else {
            Logger.asset.warn(`⚠️ SKIPPING unsupported file: ${file.name} (type: ${file.type || 'unknown'})`);
            return null;
        }
    }

    /**
     * Create image asset from file
     * @param {File} file - Image file
     * @param {string} category - Asset category
     * @param {string} filePath - Full file path for folder structure
     * @returns {Promise<Asset>} Created asset
     */
    async createImageAsset(file, category, filePath) {
        Logger.asset.info(`🎨 createImageAsset STARTED: ${file.name} | Category: ${category} | Path: ${filePath}`);
        
        try {
            // Try to create data URL for image display
            let imgSrc = '';
            let actualDimensions = { width: 64, height: 64 };
            
            try {
        const { FileUtils } = await import('./FileUtils.js');
                Logger.asset.debug('FileUtils imported successfully');

        // Create data URL for the image
                Logger.asset.debug('Creating data URL for image...');
                imgSrc = await FileUtils.createDataURL(file);
                Logger.asset.debug(`Data URL created, length: ${imgSrc.length} chars`);

                // Get actual image dimensions
                Logger.asset.debug('Getting image dimensions...');
                actualDimensions = await this.getImageDimensions(imgSrc);
                Logger.asset.debug(`Actual image dimensions: ${actualDimensions.width}x${actualDimensions.height}`);
                
            } catch (imageError) {
                Logger.asset.warn(`⚠️ Failed to load image data for ${file.name}, using fallback:`, imageError);
                // Use default dimensions and empty imgSrc
                actualDimensions = this.getDefaultDimensions(category, file.name);
            }

        // Create asset with unique ID
            const assetId = `temp_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            Logger.asset.debug(`Generated asset ID: ${assetId}`);

        const assetData = {
            id: assetId,
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            type: this.getAssetTypeFromCategory(category),
            category: category,
                path: filePath,
                width: actualDimensions.width,
                height: actualDimensions.height,
                color: this.getDefaultColor(category), // Category-based color
                imgSrc: imgSrc, // Real data URL if successful, empty if failed
            properties: {
                sourceFile: file.name,
                    fileSize: file.size || 0,
                    lastModified: Date.now(),
                    isTemporary: true // Mark as temporary
                },
                tags: [category, 'imported', 'temporary']
            };

            Logger.asset.info(`🔍 ASSET DATA PATH CHECK: filePath parameter="${filePath}", assetData.path="${assetData.path}"`);
            
            if (!assetData.path || assetData.path === file.name) {
                Logger.asset.error(`❌ CRITICAL: Asset path is empty or just filename! Expected folder structure, got: "${assetData.path}"`);
            }

            Logger.asset.debug(`Asset data prepared:`, {
                id: assetData.id,
                name: assetData.name,
                type: assetData.type,
                category: assetData.category,
                path: assetData.path,
                dimensions: `${assetData.width}x${assetData.height}`,
                hasImage: !!imgSrc,
                imgSrcLength: imgSrc ? imgSrc.length : 0,
                imgSrcStart: imgSrc ? imgSrc.substring(0, 50) + '...' : 'null',
                isTemporary: true
            });

        const asset = new Asset(assetData);
            Logger.asset.info(`✅ createImageAsset COMPLETED: ${asset.name} (${assetId}) with path: ${filePath} | Image: ${imgSrc ? 'YES' : 'NO'}`);
        return asset;
        } catch (error) {
            Logger.asset.error(`💥 createImageAsset FAILED for ${file.name}:`, error);
            throw error;
        }
    }

    /**
     * Create data asset from JSON file
     * @param {File} file - JSON file
     * @param {string} category - Asset category
     * @param {string} filePath - Full file path for folder structure
     * @returns {Promise<Asset>} Created asset
     */
    async createDataAsset(file, category, filePath) {
        // Create TEMPORARY data asset without reading actual file
        Logger.asset.warn(`⚠️ Creating TEMPORARY data asset without file reading for testing folder structure`);

        const assetId = `temp_data_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const assetData = {
            id: assetId,
            name: file.name.replace(/\.[^/.]+$/, ""),
            type: 'data',
            category: category,
            path: filePath,
            width: 32, // Default dimensions for data assets
            height: 32,
            color: '#666666',
            imgSrc: '', // No image for data assets
            properties: {
                sourceFile: file.name,
                fileSize: file.size || 0,
                lastModified: Date.now(),
                isTemporary: true, // Mark as temporary
                data: {} // Empty data for temporary assets
            },
            tags: [category, 'data', 'imported', 'temporary']
        };

        Logger.asset.info(`🔍 ASSET DATA PATH CHECK: filePath parameter="${filePath}", assetData.path="${assetData.path}"`);

        const asset = new Asset(assetData);
        Logger.asset.debug(`Created temporary data asset: ${asset.name} (${assetId}) with path: ${filePath}`);
        return asset;
    }

    /**
     * Get default dimensions based on category and filename
     * @param {string} category - Asset category  
     * @param {string} filename - Filename to analyze
     * @returns {Object} Default dimensions
     */
    getDefaultDimensions(category, filename) {
        const categoryDefaults = {
            'backgrounds': { width: 1920, height: 1080 },
            'characters': { width: 64, height: 64 },
            'platforms': { width: 32, height: 32 },
            'collectibles': { width: 24, height: 24 },
            'enemies': { width: 48, height: 48 },
            'effects': { width: 64, height: 64 },
            'ui': { width: 32, height: 32 },
            'tiles': { width: 32, height: 32 }
        };
        
        return categoryDefaults[category] || { width: 64, height: 64 }; // Default fallback
    }

    /**
     * Get default color based on category
     * @param {string} category - Asset category
     * @returns {string} Default color hex
     */
    getDefaultColor(category) {
        const categoryColors = {
            'backgrounds': '#87CEEB',
            'characters': '#FF6B6B', 
            'platforms': '#2ECC71',
            'collectibles': '#F1C40F',
            'enemies': '#E74C3C',
            'effects': '#9B59B6',
            'ui': '#3498DB',
            'tiles': '#95A5A6'
        };
        
        return categoryColors[category] || '#CCCCCC'; // Default gray
    }

    /**
     * Get image dimensions from data URL (not used in temporary mode)
     * @param {string} dataUrl - Image data URL
     * @returns {Promise<{width: number, height: number}>} Image dimensions
     */
    getImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
        });
    }

    /**
     * Get asset type from category
     * @param {string} category - Category name
     * @returns {string} Asset type
     */
    getAssetTypeFromCategory(category) {
        const typeMap = {
            'backgrounds': 'background',
            'characters': 'character',
            'platforms': 'platform',
            'collectibles': 'collectible',
            'enemies': 'enemy',
            'effects': 'effect',
            'ui': 'ui',
            'tiles': 'tile'
        };
        return typeMap[category] || 'object';
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
            Logger.asset.error('Folder access check failed:', error);
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
                Logger.asset.error(`Failed to import category ${category.name}:`, error);
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

                Logger.asset.debug(`Imported asset: ${asset.name} (${asset.id})`);
            } catch (error) {
                Logger.asset.error(`Failed to import asset ${asset.name}:`, error);
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
     * @returns {Promise<{folderName: string, files: Array}|null>} Selected folder data or null
     */
    async showFolderPicker() {
        try {
            const dialog = new FolderPickerDialog();
            const folderData = await dialog.show();
            return folderData;
        } catch (error) {
            Logger.asset.error('Folder picker failed:', error);
            return null;
        }
    }

    /**
     * Create error icon (exclamation mark) as data URL
     * @returns {string} Data URL for error icon
     */
    createErrorIcon() {
        // Create a simple SVG with exclamation mark
        const svg = `
            <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" fill="#ff6b6b" rx="4"/>
                <text x="16" y="22" font-family="Arial, sans-serif" font-size="20" font-weight="bold" 
                      text-anchor="middle" fill="white">!</text>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }
}
