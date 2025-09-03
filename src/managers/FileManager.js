import { Level } from '../models/Level.js';

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
        
        level.addObject({
            name: 'Enemy Spawn',
            type: 'enemy_spawn',
            x: 150,
            y: 100,
            width: 32,
            height: 32,
            color: 'lightgreen',
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
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.currentFileName = filename;
        return filename;
    }

    /**
     * Load level from file
     */
    async loadLevel(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            if (!this.isValidFile(file)) {
                reject(new Error('Invalid file format'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    const level = Level.fromJSON(data);
                    this.currentFileName = file.name;
                    resolve(level);
                } catch (error) {
                    reject(new Error('Failed to parse level file: ' + error.message));
                }
            };
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            reader.readAsText(file);
        });
    }

    /**
     * Load level from file input
     */
    async loadLevelFromFileInput() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = this.supportedFormats.join(',');
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }
                
                try {
                    const level = await this.loadLevel(file);
                    resolve(level);
                } catch (error) {
                    reject(error);
                }
            };
            
            input.click();
        });
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
        try {
            const data = JSON.parse(jsonString);
            return Level.fromJSON(data);
        } catch (error) {
            throw new Error('Failed to parse level data: ' + error.message);
        }
    }

    /**
     * Save asset library to file
     */
    saveAssetLibrary(assetManager, fileName = 'assets.json') {
        const data = assetManager.exportToJSON();
        
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * Load asset library from file
     */
    async loadAssetLibrary(assetManager) {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const success = assetManager.importFromJSON(event.target.result);
                        if (success) {
                            resolve(true);
                        } else {
                            reject(new Error('Failed to import asset library'));
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse asset library file: ' + error.message));
                    }
                };
                reader.onerror = () => {
                    reject(new Error('Failed to read file'));
                };
                reader.readAsText(file);
            };
            
            input.click();
        });
    }
}
