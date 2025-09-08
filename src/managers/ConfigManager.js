/**
 * Configuration Manager
 * Handles loading and merging of default and user configuration files
 */

import { Logger } from '../utils/Logger.js';

export class ConfigManager {
    constructor() {
        this.configPath = './config/';
        this.defaultsPath = this.configPath + 'defaults/';
        this.userPath = this.configPath + 'user/';
        
        this.configs = {
            editor: null,
            ui: null,
            canvas: null,
            panels: null
        };
        
        // Load configurations synchronously for immediate application
        this.loadAllConfigsSync();
    }

    /**
     * Safe logging method that works even if Logger is not available
     */
    log(level, message, ...args) {
        try {
            if (typeof Logger !== 'undefined' && Logger.config && Logger.config[level]) {
                Logger.config[level](message, ...args);
            } else {
                console[level === 'error' ? 'error' : 'log'](`[CONFIG] ${message}`, ...args);
            }
        } catch (error) {
            console.log(`[CONFIG] ${message}`, ...args);
        }
    }

    /**
     * Load all configuration files synchronously
     */
    loadAllConfigsSync() {
        try {
            this.log('info', 'Loading configuration files synchronously...');
            
            // Load default configurations from embedded data
            const defaultConfigs = this.getDefaultConfigs();
            
            // Load user configurations from localStorage
            const userConfigs = this.loadUserConfigsFromStorage();
            
            // Merge configurations (user overrides defaults)
            this.configs = this.mergeConfigs(defaultConfigs, userConfigs);
            
            this.log('info', 'Configuration loaded successfully');
            this.log('debug', 'Loaded configs:', this.configs);
            
        } catch (error) {
            this.log('error', 'Failed to load configurations:', error);
            // Fallback to hardcoded defaults
            this.loadFallbackConfigs();
        }
    }

    /**
     * Load all configuration files (async version for backward compatibility)
     */
    async loadAllConfigs() {
        this.loadAllConfigsSync();
    }

    /**
     * Get default configurations from embedded data
     */
    getDefaultConfigs() {
        return {
            // Editor behavior settings
            editor: {
                autoSave: true,
                autoSaveInterval: 300000, // 5 minutes
                undoHistoryLimit: 50,
                showFPS: false,
                showObjectCount: true,
                multiSelectMode: 'additive' // 'additive' or 'replace'
            },

            // UI settings
            ui: {
                theme: 'dark', // 'dark' or 'light'
                fontSize: 'sm',
                fontScale: 1.0,
                compactMode: false,
                rightPanelWidth: 320,
                consoleHeight: 300,
                assetsPanelHeight: 256,
                consoleVisible: false,
                consoleMaxLines: 1000,
                panelWidth: 300,
                showTooltips: true
            },

            // Canvas and grid settings
            canvas: {
                backgroundColor: '#4B5563',
                gridSize: 32,
                showGrid: true,
                gridColor: '#333333',
                gridOpacity: 0.5,
                snapToGrid: false
            },

            // Camera settings
            camera: {
                zoomSpeed: 0.1,
                panSpeed: 1.0,
                minZoom: 0.1,
                maxZoom: 10.0,
                smoothZoom: true
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

            // Panel settings
            panels: {
                rightPanelTabOrder: ['details', 'level', 'outliner'],
                assetTabOrder: []
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
     * Load user configurations from localStorage and files
     */
    loadUserConfigsFromStorage() {
        const configs = {};
        const configNames = ['editor', 'ui', 'canvas', 'panels', 'camera', 'selection', 'assets', 'performance', 'shortcuts'];
        
        // First, try to load from UserPreferencesManager (legacy)
        const legacyPrefs = this.loadLegacyUserPreferences();
        if (legacyPrefs) {
            // Convert legacy preferences to new format
            if (legacyPrefs.fontSize) {
                configs.ui = { ...configs.ui, fontSize: legacyPrefs.fontSize };
            }
            if (legacyPrefs.fontScale) {
                configs.ui = { ...configs.ui, fontScale: legacyPrefs.fontScale };
            }
            if (legacyPrefs.theme) {
                configs.ui = { ...configs.ui, theme: legacyPrefs.theme };
            }
            if (legacyPrefs.compactMode !== undefined) {
                configs.ui = { ...configs.ui, compactMode: legacyPrefs.compactMode };
            }
            if (legacyPrefs.canvasBackgroundColor) {
                configs.canvas = { ...configs.canvas, backgroundColor: legacyPrefs.canvasBackgroundColor };
            }
            if (legacyPrefs.gridSize) {
                configs.canvas = { ...configs.canvas, gridSize: legacyPrefs.gridSize };
            }
            if (legacyPrefs.showGrid !== undefined) {
                configs.canvas = { ...configs.canvas, showGrid: legacyPrefs.showGrid };
            }
            if (legacyPrefs.autoSave !== undefined) {
                configs.editor = { ...configs.editor, autoSave: legacyPrefs.autoSave };
            }
            if (legacyPrefs.autoSaveInterval) {
                configs.editor = { ...configs.editor, autoSaveInterval: legacyPrefs.autoSaveInterval };
            }
        }
        
        configNames.forEach(configName => {
            // Try to load from localStorage first
            const userConfig = this.loadUserConfig(configName);
            if (userConfig) {
                configs[configName] = { ...configs[configName], ...userConfig };
            } else {
                // Try to load from file if localStorage is empty
                const fileConfig = this.loadUserConfigFromFile(configName);
                if (fileConfig) {
                    configs[configName] = { ...configs[configName], ...fileConfig };
                    this.log('debug', `Loaded user config ${configName} from file`);
                }
            }
        });
        
        return configs;
    }

    /**
     * Load legacy user preferences from UserPreferencesManager
     */
    loadLegacyUserPreferences() {
        try {
            const stored = localStorage.getItem('levelEditor_userPrefs');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            this.log('warn', 'Failed to load legacy user preferences:', error);
        }
        return null;
    }

    /**
     * Load user configuration from file (if exists)
     */
    loadUserConfigFromFile(configName) {
        try {
            // Try to load from config/user directory
            const filePath = `${this.userPath}${configName}.json`;
            
            // Since we can't use fetch in this context, we'll use a different approach
            // For now, we'll return null and rely on localStorage
            // In a real implementation, you would need to load the file through the server
            return null;
        } catch (error) {
            this.log('warn', `Failed to load user config ${configName} from file:`, error);
            return null;
        }
    }

    /**
     * Merge user configurations with default configurations
     */
    mergeConfigs(defaultConfigs, userConfigs) {
        const merged = {};
        
        // Start with default configs
        Object.keys(defaultConfigs).forEach(key => {
            merged[key] = { ...defaultConfigs[key] };
        });
        
        // Apply user overrides
        Object.keys(userConfigs).forEach(key => {
            if (merged[key]) {
                merged[key] = this.deepMerge(merged[key], userConfigs[key]);
            } else {
                merged[key] = userConfigs[key];
            }
        });
        
        return merged;
    }

    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        });
        
        return result;
    }

    /**
     * Load fallback configurations if files fail to load
     */
    loadFallbackConfigs() {
        this.log('warn', 'Loading fallback configurations...');
        this.configs = this.getDefaultConfigs();
    }

    /**
     * Get a configuration value by path
     */
    get(path) {
        const keys = path.split('.');
        let current = this.configs;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        
        return current;
    }

    /**
     * Get all configurations
     */
    getAll() {
        return this.configs;
    }

    /**
     * Get editor configuration
     */
    getEditor() {
        return this.configs.editor || {};
    }

    /**
     * Get UI configuration
     */
    getUI() {
        return this.configs.ui || {};
    }

    /**
     * Get canvas configuration
     */
    getCanvas() {
        return this.configs.canvas || {};
    }

    /**
     * Get panels configuration
     */
    getPanels() {
        return this.configs.panels || {};
    }

    /**
     * Get camera configuration
     */
    getCamera() {
        return this.configs.camera || {};
    }

    /**
     * Get selection configuration
     */
    getSelection() {
        return this.configs.selection || {};
    }

    /**
     * Get assets configuration
     */
    getAssets() {
        return this.configs.assets || {};
    }

    /**
     * Get performance configuration
     */
    getPerformance() {
        return this.configs.performance || {};
    }

    /**
     * Get shortcuts configuration
     */
    getShortcuts() {
        return this.configs.shortcuts || {};
    }

    /**
     * Set a setting value by path
     */
    set(path, value) {
        const keys = path.split('.');
        let current = this.configs;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveUserConfigsToStorage();
    }

    /**
     * Get all settings (alias for getAll)
     */
    getAllSettings() {
        return this.configs;
    }

    /**
     * Reset settings to defaults
     */
    reset() {
        this.configs = this.getDefaultConfigs();
        this.saveUserConfigsToStorage();
    }

    /**
     * Export settings as JSON string
     */
    exportSettings() {
        return JSON.stringify(this.configs, null, 2);
    }

    /**
     * Import settings from JSON string
     */
    importSettings(jsonString) {
        try {
            const importedSettings = JSON.parse(jsonString);
            this.configs = this.mergeConfigs(this.getDefaultConfigs(), importedSettings);
            this.saveUserConfigsToStorage();
            return true;
        } catch (error) {
            this.log('error', 'Failed to import settings:', error);
            return false;
        }
    }

    /**
     * Validate a setting value
     */
    validateSetting(path, value) {
        // Basic validation - can be extended
        const keys = path.split('.');
        const category = keys[0];
        
        switch (category) {
            case 'ui':
                if (keys[1] === 'fontScale' && (typeof value !== 'number' || value < 0.5 || value > 3.0)) {
                    return false;
                }
                break;
            case 'canvas':
                if (keys[1] === 'gridSize' && (typeof value !== 'number' || value < 8 || value > 128)) {
                    return false;
                }
                break;
            case 'camera':
                if (keys[1] === 'zoomSpeed' && (typeof value !== 'number' || value < 0.01 || value > 1.0)) {
                    return false;
                }
                break;
        }
        
        return true;
    }

    /**
     * Save settings (alias for saveUserConfigsToStorage)
     */
    saveSettings() {
        this.saveUserConfigsToStorage();
    }

    /**
     * Save user configuration to localStorage as backup
     */
    saveUserConfig(configName, config) {
        try {
            const key = `levelEditor_userConfig_${configName}`;
            localStorage.setItem(key, JSON.stringify(config));
            this.log('info', `Saved user config ${configName} to localStorage`);
        } catch (error) {
            this.log('error', `Failed to save user config ${configName}:`, error);
        }
    }

    /**
     * Load user configuration from localStorage
     */
    loadUserConfig(configName) {
        try {
            const key = `levelEditor_userConfig_${configName}`;
            const saved = localStorage.getItem(key);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            this.log('error', `Failed to load user config ${configName}:`, error);
        }
        return null;
    }

    /**
     * Save all user configurations to localStorage
     */
    saveUserConfigsToStorage() {
        try {
            // Save each configuration section separately
            Object.keys(this.configs).forEach(configName => {
                this.saveUserConfig(configName, this.configs[configName]);
            });
            
            // Also save the complete configuration as backup
            localStorage.setItem('levelEditor_userConfig_complete', JSON.stringify(this.configs));
            
            // Also save to UserPreferencesManager format for compatibility
            this.saveToUserPreferencesManager();
            
            this.log('info', 'All user configurations saved to localStorage');
        } catch (error) {
            this.log('error', 'Failed to save user configurations:', error);
        }
    }

    /**
     * Save settings to UserPreferencesManager format for compatibility
     */
    saveToUserPreferencesManager() {
        try {
            const userPrefs = {
                // Panel sizes
                rightPanelWidth: this.configs.ui?.rightPanelWidth || 320,
                consoleHeight: this.configs.ui?.consoleHeight || 300,
                assetsPanelHeight: this.configs.ui?.assetsPanelHeight || 256,
                
                // Tab order
                rightPanelTabOrder: this.configs.panels?.rightPanelTabOrder || ['details', 'level', 'outliner'],
                assetTabOrder: this.configs.panels?.assetTabOrder || [],
                
                // Console settings
                consoleVisible: this.configs.ui?.consoleVisible || false,
                consoleMaxLines: this.configs.ui?.consoleMaxLines || 1000,
                
                // Canvas settings
                canvasBackgroundColor: this.configs.canvas?.backgroundColor || '#4B5563',
                gridSize: this.configs.canvas?.gridSize || 32,
                showGrid: this.configs.canvas?.showGrid || true,
                
                // Editor settings
                autoSave: this.configs.editor?.autoSave || true,
                autoSaveInterval: this.configs.editor?.autoSaveInterval || 30000,
                
                // UI settings
                theme: this.configs.ui?.theme || 'dark',
                fontSize: this.configs.ui?.fontSize || 'sm',
                fontScale: this.configs.ui?.fontScale || 1.0,
                compactMode: this.configs.ui?.compactMode || false
            };
            
            localStorage.setItem('levelEditor_userPrefs', JSON.stringify(userPrefs));
        } catch (error) {
            this.log('error', 'Failed to save to UserPreferencesManager format:', error);
        }
    }
}
