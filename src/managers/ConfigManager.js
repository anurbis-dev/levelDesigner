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
            panels: null,
            toolbar: null,
            shortcuts: null,
            logger: null
        };
        
        // Track which configs have been modified for selective saving
        this.modifiedConfigs = new Set();
        
        // Debounce saving to prevent excessive localStorage writes
        this.saveTimeout = null;
        this.saveDelay = 100; // 100ms delay
        
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

            // Sync canvas settings to grid settings after loading (for legacy compatibility)
            this.syncAllCanvasToGrid();

            // Sync grid settings to canvas settings after loading
            this.syncAllGridToCanvas();

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
     * Load default configurations from JSON files
     */
    async loadDefaultConfigs() {
        const configs = {};
        const configNames = ['editor', 'ui', 'canvas', 'panels'];

        for (const configName of configNames) {
            try {
                const response = await fetch(`${this.defaultsPath}${configName}.json`);
                if (response.ok) {
                    configs[configName] = await response.json();
                } else {
                    this.log('warn', `Failed to load default config ${configName}.json: ${response.status}`);
                }
            } catch (error) {
                this.log('error', `Error loading default config ${configName}.json:`, error);
            }
        }

        // Add additional default configs that don't have JSON files
        configs.grid = {
            showGrid: configs.canvas?.showGrid ?? true,
            snapToGrid: false,
            size: configs.canvas?.gridSize ?? 32,
            color: configs.canvas?.gridColor ?? '#ffffff',
            opacity: configs.canvas?.gridOpacity ?? 0.1,
            thickness: configs.canvas?.gridThickness ?? 1,
            subdivisions: configs.canvas?.gridSubdivisions ?? 0,
            subdivColor: configs.canvas?.gridSubdivColor ?? '#666666',
            subdivThickness: configs.canvas?.gridSubdivThickness ?? 0.5,
            gridType: configs.canvas?.gridType ?? 'rectangular',
            hexOrientation: configs.canvas?.hexOrientation ?? 'pointy',
            snapTolerance: 80
        };

        configs.camera = {
            zoomSpeed: 0.1,
            panSpeed: 1.0,
            minZoom: 0.1,
            maxZoom: 10.0,
            smoothZoom: true
        };

        configs.selection = {
            outlineColor: '#3B82F6',
            outlineWidth: 2,
            groupOutlineColor: '#3B82F6',
            groupOutlineWidth: 4,
            marqueeColor: '#3B82F6',
            marqueeOpacity: 0.2,
            hierarchyHighlightColor: '#3B82F6',
            activeLayerBorderColor: '#3B82F6'
        };

        configs.assets = {
            thumbnailSize: 64,
            showAssetNames: true,
            defaultAssetPath: './assets/',
            supportedFormats: ['.png', '.jpg', '.jpeg', '.gif', '.svg']
        };

        configs.performance = {
            maxObjectsToRender: 10000,
            cullingEnabled: true,
            renderOnlyVisible: true,
            optimizeGroupRendering: true
        };

        configs.touch = {
            panThreshold: 2,
            zoomThreshold: 0.03,
            panSensitivity: 1.0,
            zoomIntensity: 0.05,
            longPressDelay: 500
        };

        configs.view = {
            grid: configs.canvas?.showGrid ?? true,
            snapToGrid: false,
            parallax: false,
            objectBoundaries: false,
            objectCollisions: false
        };

        configs.toolbar = {
            visible: true,
            position: 'top',
            buttonGroups: {
                file: true,
                edit: true,
                view: true,
                group: true
            },
            buttonStates: {
                'toggle-grid': configs.canvas?.showGrid ?? true,
                'toggle-snap': false,
                'toggle-parallax': false,
                'toggle-boundaries': false,
                'toggle-collisions': false
            },
            collapsedSections: {}
        };

        return configs;
    }

    /**
     * Get default configurations from embedded data (synchronous fallback)
     */
    getDefaultConfigs() {
        // Try to load from JSON files synchronously using XMLHttpRequest
        const configs = {};
        const configNames = ['editor', 'ui', 'canvas', 'panels', 'toolbar', 'shortcuts', 'logger'];

        configNames.forEach(configName => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', `${this.defaultsPath}${configName}.json`, false); // Synchronous
                xhr.send();

                if (xhr.status === 200) {
                    configs[configName] = JSON.parse(xhr.responseText);
                } else {
                    this.log('warn', `Failed to load default config ${configName}.json: ${xhr.status}`);
                }
            } catch (error) {
                this.log('error', `Error loading default config ${configName}.json:`, error);
            }
        });

        // Add additional default configs that don't have JSON files
        configs.grid = {
            showGrid: configs.canvas?.showGrid ?? true,
            snapToGrid: false,
            size: configs.canvas?.gridSize ?? 32,
            color: configs.canvas?.gridColor ?? '#ffffff',
            opacity: configs.canvas?.gridOpacity ?? 0.1,
            thickness: configs.canvas?.gridThickness ?? 1,
            subdivisions: configs.canvas?.gridSubdivisions ?? 0,
            subdivColor: configs.canvas?.gridSubdivColor ?? '#666666',
            subdivThickness: configs.canvas?.gridSubdivThickness ?? 0.5,
            gridType: configs.canvas?.gridType ?? 'rectangular',
            hexOrientation: configs.canvas?.hexOrientation ?? 'pointy',
            snapTolerance: 80
        };

        configs.camera = {
            zoomSpeed: 0.1,
            panSpeed: 1.0,
            minZoom: 0.1,
            maxZoom: 10.0,
            smoothZoom: true
        };

        configs.selection = {
            outlineColor: '#3B82F6',
            outlineWidth: 2,
            groupOutlineColor: '#3B82F6',
            groupOutlineWidth: 4,
            marqueeColor: '#3B82F6',
            marqueeOpacity: 0.2,
            hierarchyHighlightColor: '#3B82F6',
            activeLayerBorderColor: '#3B82F6'
        };

        configs.assets = {
            thumbnailSize: 64,
            showAssetNames: true,
            defaultAssetPath: './assets/',
            supportedFormats: ['.png', '.jpg', '.jpeg', '.gif', '.svg']
        };

        configs.performance = {
            maxObjectsToRender: 10000,
            cullingEnabled: true,
            renderOnlyVisible: true,
            optimizeGroupRendering: true
        };

        configs.touch = {
            panThreshold: 2,
            zoomThreshold: 0.03,
            panSensitivity: 1.0,
            zoomIntensity: 0.05,
            longPressDelay: 500
        };

        configs.view = {
            grid: configs.canvas?.showGrid ?? true,
            snapToGrid: false,
            parallax: false,
            objectBoundaries: false,
            objectCollisions: false
        };

        configs.toolbar = {
            visible: true,
            position: 'top',
            buttonGroups: {
                file: true,
                edit: true,
                view: true,
                group: true
            },
            buttonStates: {
                'toggle-grid': configs.canvas?.showGrid ?? true,
                'toggle-snap': false,
                'toggle-parallax': false,
                'toggle-boundaries': false,
                'toggle-collisions': false
            },
            collapsedSections: {}
        };

        return configs;
    }


    /**
     * Load user configurations from localStorage and files
     */
    loadUserConfigsFromStorage() {
        const configs = {};
        const configNames = ['editor', 'ui', 'canvas', 'panels', 'camera', 'selection', 'assets', 'performance', 'shortcuts', 'view', 'toolbar', 'grid'];
        
        
        configNames.forEach(configName => {
            // Try to load from localStorage first
            const userConfig = this.loadUserConfig(configName);
            if (userConfig) {
                configs[configName] = { ...configs[configName], ...userConfig };
            } else {
                // For ui config, use default values - user changes will be loaded from localStorage later
                if (configName === 'ui') {
                    configs.ui = {
                        fontScale: 1.2,
                        theme: "dark",
                        rightPanelWidth: 320,
                        leftPanelWidth: 300,
                        consoleHeight: 400, // Default starting height
                        assetsPanelHeight: 256,
                        consoleVisible: false,
                        consoleMaxLines: 1000,
                        panelWidth: 300,
                        showTooltips: true,
                        // Panel visibility states
                        rightPanelVisible: true,
                        leftPanelVisible: true,
                        assetsPanelVisible: true
                    };
                } else {
                    // Try to load from file if localStorage is empty
                    const fileConfig = this.loadUserConfigFromFile(configName);
                    if (fileConfig) {
                        configs[configName] = { ...configs[configName], ...fileConfig };
                        this.log('debug', `Loaded user config ${configName} from file`);
                    }
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
            // Try to load from config/user directory synchronously
            const filePath = `${this.userPath}${configName}.json`;

            // Use XMLHttpRequest for synchronous loading
            const xhr = new XMLHttpRequest();
            xhr.open('GET', filePath, false); // Synchronous request
            xhr.send();

            if (xhr.status === 200) {
                const userConfig = JSON.parse(xhr.responseText);
                this.log('debug', `Loaded user config ${configName} from file`);
                return userConfig;
            } else {
                this.log('debug', `User config file ${configName}.json not found or not accessible (status: ${xhr.status})`);
                return null;
            }
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

        // Synchronize grid and canvas settings for compatibility
        if (merged.grid && merged.canvas) {
            // Sync from grid to canvas (SettingsPanel uses grid.* paths)
            merged.canvas.showGrid = merged.grid.showGrid;
            merged.canvas.snapToGrid = merged.grid.snapToGrid;
            merged.canvas.gridSize = merged.grid.size;
            merged.canvas.gridColor = merged.grid.color;
            merged.canvas.gridOpacity = merged.grid.opacity;
            merged.canvas.gridThickness = merged.grid.thickness;
            merged.canvas.gridSubdivisions = merged.grid.subdivisions;
            merged.canvas.gridSubdivColor = merged.grid.subdivColor;
            merged.canvas.gridSubdivThickness = merged.grid.subdivThickness;
            merged.canvas.gridType = merged.grid.gridType;

            // Sync from canvas to grid (for backward compatibility)
            merged.grid.showGrid = merged.canvas.showGrid;
            merged.grid.snapToGrid = merged.canvas.snapToGrid;
            merged.grid.size = merged.canvas.gridSize;
            merged.grid.color = merged.canvas.gridColor;
            merged.grid.opacity = merged.canvas.gridOpacity;
            merged.grid.thickness = merged.canvas.gridThickness;
            merged.grid.subdivisions = merged.canvas.gridSubdivisions;
            merged.grid.subdivColor = merged.canvas.gridSubdivColor;
            merged.grid.subdivThickness = merged.canvas.gridSubdivThickness;
            merged.grid.gridType = merged.canvas.gridType;
        }
        
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
     * Get grid configuration
     */
    getGrid() {
        return this.configs.grid || {};
    }

    /**
     * Get panels configuration
     */
    getPanels() {
        return this.configs.panels || {};
    }

    /**
     * Get toolbar configuration
     */
    getToolbar() {
        return this.configs.toolbar || {};
    }

    /**
     * Get shortcuts configuration
     */
    getShortcuts() {
        return this.configs.shortcuts || {};
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
     * Get touch configuration
     */
    getTouch() {
        return this.configs.touch || {};
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

        // Mark the config section as modified
        const configSection = keys[0];
        this.modifiedConfigs.add(configSection);

        // Note: Auto-save disabled - settings will be saved only on page unload/close
    }

    /**
     * Synchronize all canvas settings to grid settings
     */
    syncAllCanvasToGrid() {
        if (!this.configs.grid || !this.configs.canvas) return;

        // Sync all canvas settings to grid
        this.configs.grid.showGrid = this.configs.canvas.showGrid;
        this.configs.grid.snapToGrid = this.configs.canvas.snapToGrid;
        this.configs.grid.size = this.configs.canvas.gridSize;
        this.configs.grid.color = this.configs.canvas.gridColor;
        this.configs.grid.opacity = this.configs.canvas.gridOpacity;
        this.configs.grid.thickness = this.configs.canvas.gridThickness;
        this.configs.grid.subdivisions = this.configs.canvas.gridSubdivisions;
        this.configs.grid.subdivColor = this.configs.canvas.gridSubdivColor;
        this.configs.grid.subdivThickness = this.configs.canvas.gridSubdivThickness;
        this.configs.grid.snapTolerance = this.configs.canvas.snapTolerance || 80;
        this.configs.grid.gridType = this.configs.canvas.gridType;
    }

    /**
     * Synchronize all grid settings to canvas settings
     */
    syncAllGridToCanvas() {
        if (!this.configs.grid || !this.configs.canvas) return;

        // Sync all grid settings to canvas
        this.configs.canvas.showGrid = this.configs.grid.showGrid;
        this.configs.canvas.snapToGrid = this.configs.grid.snapToGrid;
        this.configs.canvas.gridSize = this.configs.grid.size;
        this.configs.canvas.gridColor = this.configs.grid.color;
        this.configs.canvas.gridOpacity = this.configs.grid.opacity;
        this.configs.canvas.gridThickness = this.configs.grid.thickness;
        this.configs.canvas.gridSubdivisions = this.configs.grid.subdivisions;
        this.configs.canvas.gridSubdivColor = this.configs.grid.subdivColor;
        this.configs.canvas.gridSubdivThickness = this.configs.grid.subdivThickness;
        this.configs.canvas.snapTolerance = this.configs.grid.snapTolerance;
        this.configs.canvas.gridType = this.configs.grid.gridType;
    }

    /**
     * Synchronize grid and canvas settings (DEPRECATED - use SettingsSyncManager instead)
     */
    syncGridCanvasSettings(path, value) {
        if (!this.configs.grid || !this.configs.canvas || !this.configs.editor) return;
        
        if (path.startsWith('grid.')) {
            // Sync from grid to canvas
            const gridKey = path.substring(5); // Remove 'grid.' prefix
            switch (gridKey) {
                case 'showGrid':
                    this.configs.canvas.showGrid = value;
                    break;
                case 'snapToGrid':
                    this.configs.canvas.snapToGrid = value;
                    this.configs.editor.view.snapToGrid = value; // Sync to editor view
                    break;
                case 'size':
                    this.configs.canvas.gridSize = value;
                    break;
                case 'color':
                    this.configs.canvas.gridColor = value;
                    break;
                case 'opacity':
                    this.configs.canvas.gridOpacity = value;
                    break;
                case 'thickness':
                    this.configs.canvas.gridThickness = value;
                    break;
                case 'subdivisions':
                    this.configs.canvas.gridSubdivisions = value;
                    break;
                case 'subdivColor':
                    this.configs.canvas.gridSubdivColor = value;
                    break;
                case 'subdivThickness':
                    this.configs.canvas.gridSubdivThickness = value;
                    break;
                case 'snapTolerance':
                    this.configs.canvas.snapTolerance = value;
                    break;
                case 'gridType':
                    this.configs.canvas.gridType = value;
                    break;
            }
        } else if (path.startsWith('canvas.')) {
            // Sync from canvas to grid
            const canvasKey = path.substring(7); // Remove 'canvas.' prefix
            switch (canvasKey) {
                case 'showGrid':
                    this.configs.grid.showGrid = value;
                    break;
                case 'snapToGrid':
                    this.configs.grid.snapToGrid = value;
                    this.configs.editor.view.snapToGrid = value; // Sync to editor view
                    break;
                case 'gridSize':
                    this.configs.grid.size = value;
                    break;
                case 'gridColor':
                    this.configs.grid.color = value;
                    break;
                case 'gridOpacity':
                    this.configs.grid.opacity = value;
                    break;
                case 'gridThickness':
                    this.configs.grid.thickness = value;
                    break;
                case 'gridSubdivisions':
                    this.configs.grid.subdivisions = value;
                    break;
                case 'gridSubdivColor':
                    this.configs.grid.subdivColor = value;
                    break;
                case 'gridSubdivThickness':
                    this.configs.grid.subdivThickness = value;
                    break;
                case 'snapTolerance':
                    this.configs.grid.snapTolerance = value;
                    break;
                case 'gridType':
                    this.configs.grid.gridType = value;
                    break;
            }
        } else if (path.startsWith('editor.view.')) {
            // Sync from editor view to canvas and grid
            const editorKey = path.substring(12); // Remove 'editor.view.' prefix
            switch (editorKey) {
                case 'snapToGrid':
                    this.configs.canvas.snapToGrid = value;
                    this.configs.grid.snapToGrid = value;
                    break;
                case 'grid':
                    this.configs.canvas.showGrid = value;
                    this.configs.grid.showGrid = value;
                    break;
            }
        }
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
        // Synchronize grid and canvas settings after reset
        if (this.configs.grid && this.configs.canvas) {
            this.configs.canvas.showGrid = this.configs.grid.showGrid;
            this.configs.canvas.snapToGrid = this.configs.grid.snapToGrid;
            this.configs.canvas.gridSize = this.configs.grid.size;
            this.configs.canvas.gridColor = this.configs.grid.color;
            this.configs.canvas.gridOpacity = this.configs.grid.opacity;
            this.configs.canvas.gridThickness = this.configs.grid.thickness;
            this.configs.canvas.gridSubdivisions = this.configs.grid.subdivisions;
            this.configs.canvas.gridSubdivColor = this.configs.grid.subdivColor;
            this.configs.canvas.gridSubdivThickness = this.configs.grid.subdivThickness;
            this.configs.canvas.gridType = this.configs.grid.gridType;
        }
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
                if (keys[1] === 'gridSize' && (typeof value !== 'number' || value < 8 || value > 512)) {
                    return false;
                }
                if (keys[1] === 'gridThickness' && (typeof value !== 'number' || value < 0.1 || value > 5)) {
                    return false;
                }
                if (keys[1] === 'gridSubdivisions' && (typeof value !== 'number' || value < 0 || value > 10)) {
                    return false;
                }
                if (keys[1] === 'gridSubdivThickness' && (typeof value !== 'number' || value < 0.1 || value > 3)) {
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
     * Force save all modified settings immediately
     * Used before page unload/close
     */
    forceSaveAllSettings() {
        if (this.modifiedConfigs.size > 0) {
            this.saveModifiedConfigs();
        }
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
     * Debounced save to prevent excessive localStorage writes
     */
    debouncedSave() {
        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        // Set new timeout
        this.saveTimeout = setTimeout(() => {
            this.saveModifiedConfigs();
        }, this.saveDelay);
    }

    /**
     * Save only modified configurations to localStorage
     */
    saveModifiedConfigs() {
        try {
            // Save only modified config sections
            this.modifiedConfigs.forEach(configName => {
                if (this.configs[configName]) {
                    this.saveUserConfig(configName, this.configs[configName]);
                }
            });
            
            const savedCount = this.modifiedConfigs.size;
            
            // Clear the modified set after saving
            this.modifiedConfigs.clear();
            
            this.log('debug', `Saved ${savedCount} modified config sections`);
        } catch (error) {
            this.log('error', 'Failed to save modified configurations:', error);
        }
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
            
            // Clear modified set since we saved everything
            this.modifiedConfigs.clear();
            
            this.log('info', 'All user configurations saved to localStorage');
        } catch (error) {
            this.log('error', 'Failed to save user configurations:', error);
        }
    }

}
