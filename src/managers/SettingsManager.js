/**
 * Settings Manager for Level Editor
 */
export class SettingsManager {
    constructor() {
        this.settings = {
            // Grid settings
            grid: {
                size: 32,
                snapToGrid: false,
                showGrid: true,
                color: '#333333',
                opacity: 0.5
            },

            // Camera settings
            camera: {
                zoomSpeed: 0.1,
                panSpeed: 1.0,
                minZoom: 0.1,
                maxZoom: 10.0,
                smoothZoom: true
            },

            // Editor behavior
            editor: {
                autoSave: true,
                autoSaveInterval: 300000, // 5 minutes
                undoHistoryLimit: 50,
                showFPS: false,
                showObjectCount: true,
                multiSelectMode: 'additive' // 'additive' or 'replace'
            },

            // Selection settings
            selection: {
                outlineColor: '#3B82F6',
                outlineWidth: 2,
                groupOutlineColor: '#3B82F6',
                groupOutlineWidth: 4,
                marqueeColor: '#3B82F6',
                marqueeOpacity: 0.2,
                hierarchyHighlightColor: '#3B82F6'
            },

            // Asset settings
            assets: {
                thumbnailSize: 64,
                showAssetNames: true,
                defaultAssetPath: './assets/',
                supportedFormats: ['.png', '.jpg', '.jpeg', '.gif', '.svg']
            },

            // Performance settings
            performance: {
                maxObjectsToRender: 10000,
                cullingEnabled: true,
                renderOnlyVisible: true,
                optimizeGroupRendering: true
            },

            // UI settings
            ui: {
                theme: 'dark', // 'dark' or 'light'
                panelWidth: 300,
                showTooltips: true,
                compactMode: false,
                fontScale: 1.0
            },

            // Keyboard shortcuts
            shortcuts: {
                duplicate: 'Shift+D',
                group: 'Shift+G',
                ungroup: 'Alt+G',
                delete: 'Delete',
                undo: 'Ctrl+Z',
                redo: 'Ctrl+Y',
                focusSelection: 'F',
                focusAll: 'A',
                newLevel: 'Ctrl+N',
                openLevel: 'Ctrl+O',
                saveLevel: 'Ctrl+S',
                saveLevelAs: 'Ctrl+Shift+S'
            }
        };

        this.loadSettings();
    }

    /**
     * Get a setting value by path
     */
    get(path) {
        const keys = path.split('.');
        let current = this.settings;
        
        for (const key of keys) {
            if (current[key] === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Set a setting value by path
     */
    set(path, value) {
        const keys = path.split('.');
        let current = this.settings;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveSettings();
    }

    /**
     * Reset settings to defaults
     */
    reset() {
        localStorage.removeItem('levelEditor_settings');
        // Reinitialize settings to defaults
        this.settings = {
            // Grid settings
            grid: {
                size: 32,
                snapToGrid: false,
                showGrid: true,
                color: '#333333',
                opacity: 0.5
            },

            // Camera settings
            camera: {
                zoomSpeed: 0.1,
                panSpeed: 1.0,
                minZoom: 0.1,
                maxZoom: 10.0,
                smoothZoom: true
            },

            // Editor behavior
            editor: {
                autoSave: true,
                autoSaveInterval: 300000, // 5 minutes
                undoHistoryLimit: 50,
                showFPS: false,
                showObjectCount: true,
                multiSelectMode: 'additive' // 'additive' or 'replace'
            },

            // Selection settings
            selection: {
                outlineColor: '#3B82F6',
                outlineWidth: 2,
                groupOutlineColor: '#3B82F6',
                groupOutlineWidth: 4,
                marqueeColor: '#3B82F6',
                marqueeOpacity: 0.2,
                hierarchyHighlightColor: '#3B82F6'
            },

            // Asset settings
            assets: {
                thumbnailSize: 64,
                showAssetNames: true,
                defaultAssetPath: './assets/',
                supportedFormats: ['.png', '.jpg', '.jpeg', '.gif', '.svg']
            },

            // Performance settings
            performance: {
                maxObjectsToRender: 10000,
                cullingEnabled: true,
                renderOnlyVisible: true,
                optimizeGroupRendering: true
            },

            // UI settings
            ui: {
                theme: 'dark', // 'dark' or 'light'
                panelWidth: 300,
                showTooltips: true,
                compactMode: false,
                fontScale: 1.0
            },

            // Keyboard shortcuts
            shortcuts: {
                duplicate: 'Shift+D',
                group: 'Shift+G',
                ungroup: 'Alt+G',
                delete: 'Delete',
                undo: 'Ctrl+Z',
                redo: 'Ctrl+Y',
                focusSelection: 'F',
                focusAll: 'A',
                newLevel: 'Ctrl+N',
                openLevel: 'Ctrl+O',
                saveLevel: 'Ctrl+S',
                saveLevelAs: 'Ctrl+Shift+S'
            }
        };
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('levelEditor_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = this.mergeSettings(this.settings, parsed);
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('levelEditor_settings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    /**
     * Merge saved settings with defaults
     */
    mergeSettings(defaults, saved) {
        const result = { ...defaults };
        
        for (const key in saved) {
            if (saved.hasOwnProperty(key)) {
                if (typeof saved[key] === 'object' && saved[key] !== null && !Array.isArray(saved[key])) {
                    result[key] = this.mergeSettings(defaults[key] || {}, saved[key]);
                } else {
                    result[key] = saved[key];
                }
            }
        }
        
        return result;
    }

    /**
     * Get all settings
     */
    getAllSettings() {
        return { ...this.settings };
    }

    /**
     * Update multiple settings at once
     */
    updateSettings(newSettings) {
        this.settings = this.mergeSettings(this.settings, newSettings);
        this.saveSettings();
    }

    /**
     * Export settings as JSON
     */
    exportSettings() {
        return JSON.stringify(this.settings, null, 2);
    }

    /**
     * Import settings from JSON
     */
    importSettings(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.updateSettings(imported);
            return true;
        } catch (error) {
            console.error('Failed to import settings:', error);
            return false;
        }
    }

    /**
     * Validate setting value
     */
    validateSetting(path, value) {
        // Add validation logic here if needed
        switch (path) {
            case 'camera.minZoom':
                return value >= 0.01 && value <= 1;
            case 'camera.maxZoom':
                return value >= 1 && value <= 50;
            case 'grid.size':
                return value >= 1 && value <= 256;
            case 'editor.undoHistoryLimit':
                return value >= 1 && value <= 1000;
            default:
                return true;
        }
    }
}
