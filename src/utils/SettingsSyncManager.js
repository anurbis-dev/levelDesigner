import { ColorUtils } from './ColorUtils.js';

/**
 * Settings Sync Manager
 * Handles automatic synchronization between settings panel and StateManager
 * 
 * Features:
 * - Universal synchronization for any setting
 * - Bidirectional sync (settings ↔ StateManager)
 * - Extensible mapping system
 * - Custom callback support
 * 
 * Usage:
 * ```javascript
 * const syncManager = new SettingsSyncManager(levelEditor);
 * syncManager.registerMapping('editor.view.newFeature', 'view.newFeature');
 * syncManager.syncSettingToState('editor.view.newFeature', true);
 * ```
 */

export class SettingsSyncManager {
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.stateMapping = {};
        this.reverseMapping = {};
        this.settingCallbacks = {};
        
        // Initialize default mappings
        this.initializeDefaultMappings();
    }

    /**
     * Initialize default setting mappings
     */
    initializeDefaultMappings() {
        // Initialize setting callbacks for special handling
        this.settingCallbacks = {
            'ui.showTooltips': (value) => {
                // Apply showTooltips setting (when tooltips are implemented)
                this.levelEditor.stateManager.set('ui.showTooltips', value);
                // TODO: Apply to actual tooltip system when implemented
            }
        };

        this.stateMapping = {
            // Editor view settings
            'editor.view.grid': 'view.grid',
            'editor.view.snapToGrid': 'view.snapToGrid',
            'editor.view.gameMode': 'view.gameMode',
            'editor.view.objectBoundaries': 'view.objectBoundaries',
            'editor.view.objectCollisions': 'view.objectCollisions',
            'editor.view.parallax': 'view.parallax',
            
            // Editor settings
            'editor.autoSave': 'editor.autoSave',
            'editor.autoSaveInterval': 'editor.autoSaveInterval',
            'editor.undoHistoryLimit': 'editor.undoHistoryLimit',
            'editor.axisConstraint.axisColor': 'editor.axisConstraint.axisColor',
            'editor.axisConstraint.axisWidth': 'editor.axisConstraint.axisWidth',
            
            // Canvas settings
            'canvas.showGrid': 'canvas.showGrid',
            'canvas.snapToGrid': 'canvas.snapToGrid',
            'canvas.gridSize': 'canvas.gridSize',
            'canvas.gridColor': 'canvas.gridColor',
            'canvas.gridThickness': 'canvas.gridThickness',
            'canvas.gridOpacity': 'canvas.gridOpacity',
            'canvas.gridSubdivisions': 'canvas.gridSubdivisions',
            'canvas.gridSubdivColor': 'canvas.gridSubdivColor',
            'canvas.gridSubdivThickness': 'canvas.gridSubdivThickness',
            'canvas.snapTolerance': 'canvas.snapTolerance',
            'canvas.gridType': 'canvas.gridType',
            'canvas.hexOrientation': 'canvas.hexOrientation',
            
            // Grid settings (from GridSettings.js)
            'grid.size': 'canvas.gridSize',
            'grid.color': 'canvas.gridColor',
            'grid.thickness': 'canvas.gridThickness',
            'grid.opacity': 'canvas.gridOpacity',
            'grid.subdivisions': 'canvas.gridSubdivisions',
            'grid.subdivColor': 'canvas.gridSubdivColor',
            'grid.subdivThickness': 'canvas.gridSubdivThickness',
            
            // UI settings
            'ui.compactMode': 'ui.compactMode',
            'ui.showTooltips': 'ui.showTooltips',
            'ui.fontScale': 'ui.fontScale',

            // Panel visibility settings
            'ui.rightPanelVisible': 'view.rightPanel',
            'ui.assetsPanelVisible': 'view.assetsPanel',
            'ui.consoleVisible': 'view.console',
            'ui.toolbarVisible': 'view.toolbar',
            
            // Panel settings
            'panels.rightPanelWidth': 'panels.rightPanelWidth',
            'panels.assetsPanelHeight': 'panels.assetsPanelHeight',
            'panels.consoleHeight': 'panels.consoleHeight'
        };

        // Create reverse mapping
        this.reverseMapping = {};
        Object.entries(this.stateMapping).forEach(([settingPath, stateKey]) => {
            this.reverseMapping[stateKey] = settingPath;
        });
    }

    /**
     * Register a new setting mapping for automatic StateManager synchronization
     * @param {string} settingPath - Path in settings (e.g., 'editor.view.newOption')
     * @param {string} stateKey - Key in StateManager (e.g., 'view.newOption')
     * @param {Function} [onChange] - Optional callback when setting changes
     * 
     * Example usage:
     * syncManager.registerMapping('editor.view.newFeature', 'view.newFeature', (value) => {
     *     console.log('New feature toggled:', value);
     * });
     */
    registerMapping(settingPath, stateKey, onChange = null) {
        this.stateMapping[settingPath] = stateKey;
        this.reverseMapping[stateKey] = settingPath;
        
        if (onChange) {
            this.settingCallbacks[settingPath] = onChange;
        }
    }

    /**
     * Sync a setting value to StateManager
     * @param {string} path - Setting path (e.g., 'editor.view.grid', 'canvas.snapToGrid')
     * @param {any} value - Setting value
     */
    syncSettingToState(path, value) {
        if (!this.levelEditor?.stateManager) return;

        // Check if this setting should be synced to StateManager
        const stateKey = this.stateMapping[path];
        if (stateKey) {
            this.levelEditor.stateManager.set(stateKey, value);
            
            // Special handling for view options that need immediate application
            if (stateKey.startsWith('view.') && this.levelEditor.eventHandlers) {
                const option = stateKey.replace('view.', '');
                this.levelEditor.eventHandlers.applyViewOption(option, value);
                this.levelEditor.eventHandlers.updateViewCheckbox(option, value);
            }
            
            // Special handling for canvas settings that need re-render
            if (stateKey.startsWith('canvas.') && this.levelEditor.render) {
                this.levelEditor.render();
            }
            
            // Call custom callback if exists
            if (this.settingCallbacks[path]) {
                this.settingCallbacks[path](value);
            }
        }
    }

    /**
     * Initialize settings panel with current StateManager values
     * This ensures settings panel shows current state on load
     */
    initializeFromState() {
        if (!this.levelEditor?.stateManager) return;

        // First, sync snap states to ensure consistency
        this.syncSnapToGridStates();

        // Update all settings inputs with current StateManager values
        Object.entries(this.reverseMapping).forEach(([stateKey, settingPath]) => {
            const value = this.levelEditor.stateManager.get(stateKey);
            if (value !== undefined) {
                const input = document.querySelector(`[data-setting="${settingPath}"]`);
                if (input) {
                    if (input.type === 'checkbox') {
                        input.checked = value;
                    } else if (input.type === 'color') {
                        // Convert rgba to hex for color inputs
                        input.value = ColorUtils.toHex(value);
                    } else {
                        input.value = value;
                    }
                }
            }
        });
    }

    /**
     * Sync settings from ConfigManager to StateManager
     * This ensures StateManager has the latest saved values
     */
    syncFromConfigToState() {
        if (!this.levelEditor?.stateManager || !this.levelEditor?.configManager) return;

        // Sync all mapped settings from ConfigManager to StateManager
        Object.entries(this.stateMapping).forEach(([settingPath, stateKey]) => {
            const value = this.levelEditor.configManager.get(settingPath);
            if (value !== undefined) {
                this.levelEditor.stateManager.set(stateKey, value);
            }
        });

        // Apply special UI settings that need immediate effect
        this.applySpecialUISettings();

        // Sync snap to grid between canvas and view states
        this.syncSnapToGridStates();

        // Sync editor.view settings to canvas settings
        this.syncEditorViewToCanvas();

        // Force update all UI elements to ensure they reflect the loaded state
        this.forceUpdateAllViewOptions();
    }

    /**
     * Apply all current UI settings to StateManager
     * This is called when Save Settings is pressed
     */
    applyAllUISettingsToState() {
        if (!this.levelEditor?.stateManager) return;

        // Apply all mapped settings from UI to StateManager
        Object.entries(this.stateMapping).forEach(([settingPath, stateKey]) => {
            const input = document.querySelector(`[data-setting="${settingPath}"]`);
            if (input) {
                let value;
                
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.type === 'number' || input.type === 'range') {
                    value = parseFloat(input.value);
                } else {
                    value = input.value;
                }

                // Apply to StateManager
                this.levelEditor.stateManager.set(stateKey, value);
                
                // Special handling for view options that need immediate application
                if (stateKey.startsWith('view.') && this.levelEditor.eventHandlers) {
                    const option = stateKey.replace('view.', '');
                    this.levelEditor.eventHandlers.applyViewOption(option, value);
                    this.levelEditor.eventHandlers.updateViewCheckbox(option, value);
                }
                
                // Special handling for canvas settings that need re-render
                if (stateKey.startsWith('canvas.') && this.levelEditor.render) {
                    this.levelEditor.render();
                }
                
                // Special handling for grid color conversion
                if ((settingPath === 'grid.color' || settingPath === 'canvas.gridColor') && typeof value === 'string') {
                    // Convert any color format to rgba for canvas
                    const rgbaColor = ColorUtils.toRgba(value, 1);
                    this.levelEditor.stateManager.set('canvas.gridColor', rgbaColor);
                } else if ((settingPath === 'grid.subdivColor' || settingPath === 'canvas.gridSubdivColor') && typeof value === 'string') {
                    // Convert any color format to rgba for canvas
                    const rgbaColor = ColorUtils.toRgba(value, 1);
                    this.levelEditor.stateManager.set('canvas.gridSubdivColor', rgbaColor);
                }
                
                // Special handling for autoSaveInterval (convert minutes to milliseconds)
                if (settingPath === 'editor.autoSaveInterval') {
                    const milliseconds = value * 60000;
                    this.levelEditor.stateManager.set('editor.autoSaveInterval', milliseconds);
                }
                
                // Special handling for snap to grid synchronization
                if (settingPath === 'canvas.snapToGrid') {
                    // Sync to view state for toolbar/menu
                    this.levelEditor.stateManager.set('view.snapToGrid', value);
                } else if (settingPath === 'editor.view.snapToGrid') {
                    // Sync to canvas state
                    this.levelEditor.stateManager.set('canvas.snapToGrid', value);
                }
                
                // Call custom callback if exists
                if (this.settingCallbacks[settingPath]) {
                    this.settingCallbacks[settingPath](value);
                }
            }
        });

        // Apply special UI settings that need immediate effect
        this.applySpecialUISettings();

        // Force update all view options to ensure menu and toolbar are synchronized
        this.forceUpdateAllViewOptions();
    }

    /**
     * Apply special UI settings that need immediate visual effect
     */
    applySpecialUISettings() {
        if (!this.levelEditor?.stateManager) return;

        // Apply font scale globally
        const fontScale = this.levelEditor.stateManager.get('ui.fontScale');
        if (fontScale !== undefined) {
            document.documentElement.style.fontSize = `${fontScale * 16}px`;
        }

        // Apply compact mode
        const compactMode = this.levelEditor.stateManager.get('ui.compactMode');
        if (compactMode !== undefined) {
            if (compactMode) {
                document.body.classList.add('compact-mode');
            } else {
                document.body.classList.remove('compact-mode');
            }
        }
    }

    /**
     * Synchronize snap to grid states between canvas and view
     * Prefers view.snapToGrid as source of truth (set by toolbar/menu)
     */
    syncSnapToGridStates() {
        if (!this.levelEditor?.stateManager) return;

        const canvasSnap = this.levelEditor.stateManager.get('canvas.snapToGrid');
        const viewSnap = this.levelEditor.stateManager.get('view.snapToGrid');

        // If view has a value but canvas doesn't, sync to canvas
        if (viewSnap !== undefined && canvasSnap === undefined) {
            this.levelEditor.stateManager.set('canvas.snapToGrid', viewSnap);
        }
        // If canvas has a value but view doesn't, sync to view
        else if (canvasSnap !== undefined && viewSnap === undefined) {
            this.levelEditor.stateManager.set('view.snapToGrid', canvasSnap);
        }
        // If both have values, prefer view as source of truth (toolbar/menu changes)
        else if (canvasSnap !== undefined && viewSnap !== undefined && canvasSnap !== viewSnap) {
            this.levelEditor.stateManager.set('canvas.snapToGrid', viewSnap);
        }
    }

    /**
     * Synchronize editor.view settings to canvas settings
     * This ensures that settings saved by toolbar/menu are properly loaded
     */
    syncEditorViewToCanvas() {
        if (!this.levelEditor?.stateManager) return;

        // Sync grid settings
        const editorGrid = this.levelEditor.stateManager.get('view.grid');
        const canvasGrid = this.levelEditor.stateManager.get('canvas.showGrid');
        if (editorGrid !== undefined && canvasGrid === undefined) {
            this.levelEditor.stateManager.set('canvas.showGrid', editorGrid);
        }

        // Sync snap settings
        const editorSnap = this.levelEditor.stateManager.get('view.snapToGrid');
        const canvasSnap = this.levelEditor.stateManager.get('canvas.snapToGrid');
        if (editorSnap !== undefined && canvasSnap === undefined) {
            this.levelEditor.stateManager.set('canvas.snapToGrid', editorSnap);
        }
    }


    /**
     * Force update all view options to ensure menu and toolbar synchronization
     * This ensures that all view options are properly applied after Save Settings
     */
    forceUpdateAllViewOptions() {
        if (!this.levelEditor?.stateManager || !this.levelEditor?.eventHandlers) return;

        // Get all current view option values from StateManager
        const viewOptions = [
            'grid', 'snapToGrid', 'gameMode', 'objectBoundaries', 
            'objectCollisions', 'parallax', 'toolbar', 'assetsPanel', 'rightPanel'
        ];

        viewOptions.forEach(option => {
            const value = this.levelEditor.stateManager.get(`view.${option}`);
            if (value !== undefined) {
                // Apply the option to ensure all UI elements are synchronized
                this.levelEditor.eventHandlers.applyViewOption(option, value);
                this.levelEditor.eventHandlers.updateViewCheckbox(option, value);
            }
        });

        // Force update toolbar toggle buttons
        this.forceUpdateToolbarButtons();
        
        // Force update menu toggle states
        this.forceUpdateMenuStates();
    }

    /**
     * Force update all toolbar toggle buttons to ensure they reflect current state
     */
    forceUpdateToolbarButtons() {
        if (!this.levelEditor?.stateManager || !this.levelEditor?.toolbar) return;

        // Update all toolbar toggle buttons based on current StateManager values
        const toolbarMappings = {
            'toggleGrid': 'view.grid',
            'toggleSnapToGrid': 'view.snapToGrid', 
            'toggleParallax': 'view.parallax',
            'toggleObjectBoundaries': 'view.objectBoundaries',
            'toggleObjectCollisions': 'view.objectCollisions'
        };

        Object.entries(toolbarMappings).forEach(([buttonAction, stateKey]) => {
            const value = this.levelEditor.stateManager.get(stateKey);
            if (value !== undefined) {
                this.levelEditor.toolbar.updateToggleButtonState(buttonAction, value);
            }
        });
    }

    /**
     * Force update all menu toggle states to ensure they reflect current state
     */
    forceUpdateMenuStates() {
        if (!this.levelEditor?.stateManager || !this.levelEditor?.eventHandlers?.menuManager) return;

        // Update all menu toggle states based on current StateManager values
        const menuMappings = {
            'toggle-grid': 'view.grid',
            'toggle-snap-to-grid': 'view.snapToGrid',
            'toggle-game-mode': 'view.gameMode',
            'toggle-object-boundaries': 'view.objectBoundaries',
            'toggle-object-collisions': 'view.objectCollisions',
            'toggle-parallax': 'view.parallax',
            'toggle-toolbar': 'view.toolbar',
            'toggle-assets-panel': 'view.assetsPanel',
            'toggle-right-panel': 'view.rightPanel'
        };

        Object.entries(menuMappings).forEach(([menuItemId, stateKey]) => {
            const value = this.levelEditor.stateManager.get(stateKey);
            if (value !== undefined) {
                this.levelEditor.eventHandlers.menuManager.updateToggleState(menuItemId, value);
            }
        });
    }

    /**
     * Save all current StateManager settings to ConfigManager
     * This ensures all settings are saved regardless of which tab is active
     */
    saveAllUISettingsToConfig() {
        if (!this.levelEditor?.configManager || !this.levelEditor?.stateManager) return;

        // Save all mapped settings from StateManager to ConfigManager
        Object.entries(this.stateMapping).forEach(([settingPath, stateKey]) => {
            const value = this.levelEditor.stateManager.get(stateKey);
            if (value !== undefined) {
                // Special handling for autoSaveInterval (convert milliseconds to minutes for storage)
                if (settingPath === 'editor.autoSaveInterval') {
                    // Convert back from milliseconds to minutes for storage
                    const minutes = Math.round(value / 60000);
                    this.levelEditor.configManager.set(settingPath, minutes);
                } else {
                    // Save value as-is
                    this.levelEditor.configManager.set(settingPath, value);
                }
            }
        });
    }

    /**
     * Get state key for a setting path
     * @param {string} settingPath - Setting path
     * @returns {string|null} State key or null if not mapped
     */
    getStateKey(settingPath) {
        return this.stateMapping[settingPath] || null;
    }

    /**
     * Get setting path for a state key
     * @param {string} stateKey - State key
     * @returns {string|null} Setting path or null if not mapped
     */
    getSettingPath(stateKey) {
        return this.reverseMapping[stateKey] || null;
    }

    /**
     * Check if a setting path is mapped for synchronization
     * @param {string} settingPath - Setting path
     * @returns {boolean} True if mapped
     */
    isMapped(settingPath) {
        return settingPath in this.stateMapping;
    }

    /**
     * Get all registered mappings
     * @returns {Object} Object with setting paths as keys and state keys as values
     */
    getAllMappings() {
        return { ...this.stateMapping };
    }

    /**
     * Clear all mappings and callbacks
     */
    clear() {
        this.stateMapping = {};
        this.reverseMapping = {};
        this.settingCallbacks = {};
    }
}
