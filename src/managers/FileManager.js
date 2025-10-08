import { Level } from '../models/Level.js';
import { FileUtils } from '../utils/FileUtils.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

/**
 * File operations for level editor
 */
export class FileManager {
    constructor() {
        this.supportedFormats = ['.json'];
        this.currentFileName = null;
    }

    /**
     * Create new level
     */
    createNewLevel() {
        const level = new Level({
            meta: {
                name: 'Untitled Level',
                created: new Date().toISOString()
            }
        });
        
        // Add default objects
        level.addObject({
            name: 'Player Start',
            type: 'player_start',
            x: 50,
            y: 50,
            width: 32,
            height: 32,
            color: 'lightblue',
            visible: true,
            locked: false,
            properties: {}
        });
        
        this.currentFileName = null;
        return level;
    }

    /**
     * Save level to file
     */
    saveLevel(level, fileName = null) {
        const filename = fileName || this.currentFileName || 'level.json';
        const data = level.toJSON();
        
        FileUtils.downloadData(data, filename, FileUtils.TYPES.JSON);
        
        this.currentFileName = filename;
        return filename;
    }

    /**
     * Load level from file
     */
    async loadLevel(file) {
        return ErrorHandler.tryAsync(
            async () => {
                if (!file) {
                    throw new Error('No file provided');
                }

                if (!this.isValidFile(file)) {
                    throw new Error('Invalid file format');
                }

                const data = await FileUtils.readFileAsJSON(file);
                const level = Level.fromJSON(data);
                this.currentFileName = file.name;
                return level;
            },
            null,
            { 
                source: 'FileManager.loadLevel', 
                showUser: true,
                userMessage: 'Не удалось загрузить уровень. Проверьте формат файла.' 
            }
        );
    }

    /**
     * Load level from file input
     */
    async loadLevelFromFileInput() {
        return ErrorHandler.tryAsync(
            async () => {
                const file = await FileUtils.pickFile(this.supportedFormats, false);
                return await this.loadLevel(file);
            },
            null,
            { 
                source: 'FileManager.loadLevelFromFileInput',
                showUser: false // loadLevel already shows error
            }
        );
    }

    /**
     * Check if file format is supported
     */
    isValidFile(file) {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return this.supportedFormats.includes(extension);
    }

    /**
     * Get current file name
     */
    getCurrentFileName() {
        return this.currentFileName;
    }

    /**
     * Set current file name
     */
    setCurrentFileName(fileName) {
        this.currentFileName = fileName;
    }

    /**
     * Export level data as JSON string
     */
    exportLevelData(level) {
        return JSON.stringify(level.toJSON(), null, 2);
    }

    /**
     * Import level data from JSON string
     */
    importLevelData(jsonString) {
        return ErrorHandler.try(
            () => {
                const data = JSON.parse(jsonString);
                return Level.fromJSON(data);
            },
            null,
            { 
                source: 'FileManager.importLevelData',
                showUser: true,
                userMessage: 'Не удалось импортировать данные уровня. Проверьте формат JSON.' 
            }
        );
    }

    /**
     * Save asset library to file
     */
    saveAssetLibrary(assetManager, fileName = 'assets.json') {
        const data = assetManager.exportToJSON();
        FileUtils.downloadData(data, fileName, FileUtils.TYPES.JSON, false);
    }

    /**
     * Load asset library from file
     */
    async loadAssetLibrary(assetManager) {
        return ErrorHandler.tryAsync(
            async () => {
                const { file, content } = await FileUtils.pickAndReadText('.json');
                const success = assetManager.importFromJSON(content);
                
                if (!success) {
                    throw new Error('Failed to import asset library');
                }
                
                return true;
            },
            false,
            { 
                source: 'FileManager.loadAssetLibrary',
                showUser: true,
                userMessage: 'Не удалось загрузить библиотеку ассетов. Проверьте формат файла.' 
            }
        );
    }
}
