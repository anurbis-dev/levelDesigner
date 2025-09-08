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
        
        this.loadAllConfigs();
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
     * Load all configuration files
     */
    async loadAllConfigs() {
        try {
            this.log('info', 'Loading configuration files...');
            
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
     * Get default configurations from embedded data
     */
    getDefaultConfigs() {
        return {
            editor: {
                autoSave: true,
                autoSaveInterval: 300000,
                undoHistoryLimit: 50,
                showFPS: false,
                showObjectCount: true,
                multiSelectMode: 'additive'
            },
            ui: {
                theme: 'dark',
                fontSize: 'sm',
                fontScale: 1.0,
                compactMode: false,
                rightPanelWidth: 320,
                consoleHeight: 300,
                assetsPanelHeight: 256,
                consoleVisible: false,
                consoleMaxLines: 1000
            },
            canvas: {
                backgroundColor: '#4B5563',
                gridSize: 32,
                showGrid: true,
                gridColor: '#333333',
                gridOpacity: 0.5,
                snapToGrid: false
            },
            panels: {
                rightPanelTabOrder: ['details', 'level', 'outliner'],
                assetTabOrder: [],
                selection: {
                    outlineColor: '#3B82F6',
                    outlineWidth: 2,
                    groupOutlineColor: '#3B82F6',
                    groupOutlineWidth: 4,
                    marqueeColor: '#3B82F6',
                    marqueeOpacity: 0.2,
                    hierarchyHighlightColor: '#3B82F6'
                }
            }
        };
    }

    /**
     * Load user configurations from localStorage and files
     */
    loadUserConfigsFromStorage() {
        const configs = {};
        const configNames = ['editor', 'ui', 'canvas', 'panels'];
        
        configNames.forEach(configName => {
            // Try to load from localStorage first
            const userConfig = this.loadUserConfig(configName);
            if (userConfig) {
                configs[configName] = userConfig;
                this.log('debug', `Loaded user config ${configName} from localStorage`);
            } else {
                // Try to load from file if localStorage is empty
                const fileConfig = this.loadUserConfigFromFile(configName);
                if (fileConfig) {
                    configs[configName] = fileConfig;
                    this.log('debug', `Loaded user config ${configName} from file`);
                }
            }
        });
        
        return configs;
    }

    /**
     * Load user configuration from file (if exists)
     */
    loadUserConfigFromFile(configName) {
        try {
            // This is a placeholder - in a real implementation, you would need
            // to load the file through the server or use a different approach
            // For now, we'll just return null and rely on localStorage
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
}
