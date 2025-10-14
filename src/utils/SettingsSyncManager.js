import { ColorUtils } from './ColorUtils.js';
import { ValidationUtils } from './ValidationUtils.js';

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
        this.bidirectionalSyncSetup = false;
        
        // Initialize default mappings
        this.initializeDefaultMappings();
        
        // Setup bidirectional sync once globally (deferred to ensure levelEditor is ready)
        if (!SettingsSyncManager._globalSyncSetup) {
            SettingsSyncManager._globalSyncSetup = true;
            setTimeout(() => {
                this.setupBidirectionalSync();
                // Apply initial color settings
                this.applyInitialColorSettings();
            }, 100);
        }
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
            'editor.view.grid': 'canvas.showGrid',
            'editor.view.snapToGrid': 'canvas.snapToGrid',
            'editor.view.gameMode': 'view.gameMode',
            'editor.view.objectBoundaries': 'view.objectBoundaries',
            'editor.view.objectCollisions': 'view.objectCollisions',
            'editor.view.parallax': 'view.parallax',
            
            // Editor settings
            'editor.autoSave': 'editor.autoSave',
            'editor.autoSaveInterval': 'editor.autoSaveInterval',
            'editor.undoHistoryLimit': 'editor.undoHistoryLimit',
            'editor.multiSelectMode': 'editor.multiSelectMode',
            'editor.axisConstraint.axisColor': 'editor.axisConstraint.axisColor',
            'editor.axisConstraint.axisWidth': 'editor.axisConstraint.axisWidth',
            'editor.axisConstraint.showAxis': 'editor.axisConstraint.showAxis',
            
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
            'ui.showTooltips': 'ui.showTooltips',
            'ui.fontScale': 'ui.fontScale',
            'ui.spacing': 'ui.spacing',
            'ui.backgroundColor': 'ui.backgroundColor',
            'ui.textColor': 'ui.textColor',
            'ui.activeColor': 'ui.activeColor',
            'ui.activeTextColor': 'ui.activeTextColor',
            'ui.activeTabColor': 'ui.activeTabColor',
            'ui.accentColor': 'ui.accentColor',
            
            // Editor UI settings (from editor.json)
            'editor.ui.backgroundColor': 'ui.backgroundColor',
            'editor.ui.textColor': 'ui.textColor',
            'editor.ui.activeColor': 'ui.activeColor',
            'editor.ui.activeTextColor': 'ui.activeTextColor',
            'editor.ui.activeTabColor': 'ui.activeTabColor',
            
            // Canvas settings
            'canvas.backgroundColor': 'canvas.backgroundColor',
            
            // Editor Canvas settings (from editor.json)
            'editor.canvas.backgroundColor': 'canvas.backgroundColor',

            // Panel visibility settings
            'ui.rightPanelVisible': 'view.rightPanel',
            'ui.assetsPanelVisible': 'view.assetsPanel',
            'ui.consoleVisible': 'view.console',
            'ui.toolbarVisible': 'view.toolbar',
            
            // Panel settings
            'panels.rightPanelWidth': 'panels.rightPanelWidth',
            'panels.assetsPanelHeight': 'panels.assetsPanelHeight',
            'panels.consoleHeight': 'panels.consoleHeight',
            
            // Selection settings
            'panels.selection.outlineColor': 'selection.outlineColor',
            'panels.selection.outlineWidth': 'selection.outlineWidth',
            'panels.selection.groupOutlineColor': 'selection.groupOutlineColor',
            'panels.selection.groupOutlineWidth': 'selection.groupOutlineWidth',
            'panels.selection.marqueeColor': 'selection.marqueeColor',
            'panels.selection.marqueeOpacity': 'selection.marqueeOpacity',
            'panels.selection.hierarchyHighlightColor': 'selection.hierarchyHighlightColor',
            'panels.selection.activeLayerBorderColor': 'selection.activeLayerBorderColor'
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
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'syncSettingToState');
        if (!this.levelEditor) return;

        // Check if this setting should be synced to StateManager
        const stateKey = this.stateMapping[path];
        if (stateKey) {
            // Coerce numeric UI values from range inputs
            if (path === 'ui.fontScale' || path === 'ui.spacing' || path === 'editor.autoSaveInterval' || path === 'editor.axisConstraint.axisWidth') {
                const parsed = ValidationUtils.validateNumeric(value, path);
                if (parsed !== null) {
                    value = parsed;
                }
            }

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
            
            // Special handling for spacing that needs immediate visual update
            if (path === 'ui.spacing') {
                const spacingScale = ValidationUtils.validateSpacingScale(value);
                if (spacingScale !== null) {
                    document.documentElement.style.setProperty('--spacing-scale', String(spacingScale));
                    // Delay inline styles update to ensure DOM is ready
                    setTimeout(() => {
                        this.updateInlineSpacingStyles(spacingScale);
                    }, 50);
                    ValidationUtils.logValidation('SettingsSyncManager', 'Applied spacing scale', spacingScale);
                }
            }

            // Special handling for font scale to update UI immediately on slider move
            if (path === 'ui.fontScale') {
                const fontScale = ValidationUtils.validateFontScale(value);
                if (fontScale !== null) {
                    // Prefer CSS variable driven sizing for consistency
                    document.documentElement.style.setProperty('--font-scale', String(fontScale));
                    // Also set root font-size for components not using var()
                    document.documentElement.style.fontSize = `${fontScale * 16}px`;
                    ValidationUtils.logValidation('SettingsSyncManager', 'Applied font scale', fontScale);
                }
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
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'initializeFromState');
        if (!this.levelEditor) return;

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
        // Get levelEditor with fallback and check required components
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'syncFromConfigToState');
        if (!ValidationUtils.hasRequiredComponents(this.levelEditor, ['stateManager', 'configManager'], 'syncFromConfigToState')) {
            return;
        }

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
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'applyAllUISettingsToState');
        if (!this.levelEditor) return;

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
                
                // Apply to StateManager
                this.levelEditor.stateManager.set(stateKey, value);
                
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
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'applySpecialUISettings');
        if (!this.levelEditor) return;

        // Apply font scale globally
        const fontScale = this.levelEditor.stateManager.get('ui.fontScale');
        if (fontScale !== undefined) {
            const fontScaleNum = ValidationUtils.validateFontScale(fontScale);
            if (fontScaleNum !== null) {
                // Apply both CSS variable and root font-size for widest compatibility
                document.documentElement.style.setProperty('--font-scale', String(fontScaleNum));
                document.documentElement.style.fontSize = `${fontScaleNum * 16}px`;
                ValidationUtils.logValidation('SettingsSyncManager', 'Applied font scale in applySpecialUISettings', fontScaleNum);
            }
        }

        // Apply spacing scale globally
        const spacingScale = this.levelEditor.stateManager.get('ui.spacing');
        if (spacingScale !== undefined) {
            const spacingScaleNum = ValidationUtils.validateSpacingScale(spacingScale);
            if (spacingScaleNum !== null) {
                document.documentElement.style.setProperty('--spacing-scale', String(spacingScaleNum));
                // Delay inline styles update to ensure DOM is ready
                setTimeout(() => {
                    this.updateInlineSpacingStyles(spacingScaleNum);
                }, 100);
                ValidationUtils.logValidation('SettingsSyncManager', 'Applied spacing scale in applySpecialUISettings', spacingScaleNum);
            }
        }

        // Apply color settings globally
        const backgroundColor = this.levelEditor.stateManager.get('ui.backgroundColor');
        const textColor = this.levelEditor.stateManager.get('ui.textColor');
        const activeColor = this.levelEditor.stateManager.get('ui.activeColor');
        const activeTextColor = this.levelEditor.stateManager.get('ui.activeTextColor');
        const activeTabColor = this.levelEditor.stateManager.get('ui.activeTabColor');
        const canvasBackgroundColor = this.levelEditor.stateManager.get('canvas.backgroundColor');
        
        if (backgroundColor) {
            document.documentElement.style.setProperty('--ui-background-color', backgroundColor);
        }
        if (textColor) {
            document.documentElement.style.setProperty('--ui-text-color', textColor);
        }
        if (activeColor) {
            document.documentElement.style.setProperty('--ui-active-color', activeColor);
        }
        if (activeTextColor) {
            document.documentElement.style.setProperty('--ui-active-text-color', activeTextColor);
        }
        if (activeTabColor) {
            document.documentElement.style.setProperty('--ui-active-tab-color', activeTabColor);
        }
        if (canvasBackgroundColor) {
            document.documentElement.style.setProperty('--canvas-background-color', canvasBackgroundColor);
            // Force canvas re-render to apply new background color immediately
            if (this.levelEditor && typeof this.levelEditor.render === 'function') {
                this.levelEditor.render();
            }
        }

        // Apply selection settings globally
        const outlineColor = this.levelEditor.stateManager.get('selection.outlineColor');
        const outlineWidth = this.levelEditor.stateManager.get('selection.outlineWidth');
        const groupOutlineColor = this.levelEditor.stateManager.get('selection.groupOutlineColor');
        const groupOutlineWidth = this.levelEditor.stateManager.get('selection.groupOutlineWidth');
        const marqueeColor = this.levelEditor.stateManager.get('selection.marqueeColor');
        const marqueeOpacity = this.levelEditor.stateManager.get('selection.marqueeOpacity');
        const hierarchyHighlightColor = this.levelEditor.stateManager.get('selection.hierarchyHighlightColor');
        
        if (outlineColor) {
            document.documentElement.style.setProperty('--selection-outline-color', outlineColor);
        }
        if (outlineWidth) {
            document.documentElement.style.setProperty('--selection-outline-width', `${outlineWidth}px`);
        }
        if (groupOutlineColor) {
            document.documentElement.style.setProperty('--selection-group-outline-color', groupOutlineColor);
        }
        if (groupOutlineWidth) {
            document.documentElement.style.setProperty('--selection-group-outline-width', `${groupOutlineWidth}px`);
        }
        if (marqueeColor) {
            document.documentElement.style.setProperty('--selection-marquee-color', marqueeColor);
        }
        if (marqueeOpacity !== undefined) {
            document.documentElement.style.setProperty('--selection-marquee-opacity', marqueeOpacity);
        }
        if (hierarchyHighlightColor) {
            document.documentElement.style.setProperty('--selection-hierarchy-highlight-color', hierarchyHighlightColor);
        }
    }

    /**
     * Apply initial color settings on startup
     */
    applyInitialColorSettings() {
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'applyInitialColorSettings');
        if (!this.levelEditor) return;

        // Apply color settings from StateManager (which should have defaults or loaded values)
        const backgroundColor = this.levelEditor.stateManager.get('ui.backgroundColor');
        const textColor = this.levelEditor.stateManager.get('ui.textColor');
        const activeColor = this.levelEditor.stateManager.get('ui.activeColor');
        const activeTextColor = this.levelEditor.stateManager.get('ui.activeTextColor');
        const activeTabColor = this.levelEditor.stateManager.get('ui.activeTabColor');
        const accentColor = this.levelEditor.stateManager.get('ui.accentColor');
        const canvasBackgroundColor = this.levelEditor.stateManager.get('canvas.backgroundColor');

        if (backgroundColor) {
            document.documentElement.style.setProperty('--ui-background-color', backgroundColor);
        }
        if (textColor) {
            document.documentElement.style.setProperty('--ui-text-color', textColor);
        }
        if (activeColor) {
            document.documentElement.style.setProperty('--ui-active-color', activeColor);
        }
        if (activeTextColor) {
            document.documentElement.style.setProperty('--ui-active-text-color', activeTextColor);
        }
        if (activeTabColor) {
            document.documentElement.style.setProperty('--ui-active-tab-color', activeTabColor);
        }
        if (accentColor) {
            document.documentElement.style.setProperty('--accent-color', accentColor);
        }
        if (canvasBackgroundColor) {
            document.documentElement.style.setProperty('--canvas-background-color', canvasBackgroundColor);
        }

        // Apply selection settings globally
        const outlineColor = this.levelEditor.stateManager.get('selection.outlineColor');
        const outlineWidth = this.levelEditor.stateManager.get('selection.outlineWidth');
        const groupOutlineColor = this.levelEditor.stateManager.get('selection.groupOutlineColor');
        const groupOutlineWidth = this.levelEditor.stateManager.get('selection.groupOutlineWidth');
        const marqueeColor = this.levelEditor.stateManager.get('selection.marqueeColor');
        const marqueeOpacity = this.levelEditor.stateManager.get('selection.marqueeOpacity');
        const hierarchyHighlightColor = this.levelEditor.stateManager.get('selection.hierarchyHighlightColor');
        
        if (outlineColor) {
            document.documentElement.style.setProperty('--selection-outline-color', outlineColor);
        }
        if (outlineWidth) {
            document.documentElement.style.setProperty('--selection-outline-width', `${outlineWidth}px`);
        }
        if (groupOutlineColor) {
            document.documentElement.style.setProperty('--selection-group-outline-color', groupOutlineColor);
        }
        if (groupOutlineWidth) {
            document.documentElement.style.setProperty('--selection-group-outline-width', `${groupOutlineWidth}px`);
        }
        if (marqueeColor) {
            document.documentElement.style.setProperty('--selection-marquee-color', marqueeColor);
        }
        if (marqueeOpacity !== undefined) {
            document.documentElement.style.setProperty('--selection-marquee-opacity', marqueeOpacity);
        }
        if (hierarchyHighlightColor) {
            document.documentElement.style.setProperty('--selection-hierarchy-highlight-color', hierarchyHighlightColor);
        }
    }

    /**
     * Update inline spacing styles for gap and margin properties
     */
    updateInlineSpacingStyles(spacingScale) {
        // Validate spacing scale
        const validSpacingScale = ValidationUtils.validateSpacingScale(spacingScale);
        if (validSpacingScale === null) return;
        
        // Find all elements with inline gap styles
        const elementsWithGap = document.querySelectorAll('[style*="gap:"]');
        elementsWithGap.forEach(element => {
            const style = element.getAttribute('style');
            const gapMatch = style.match(/gap:\s*([0-9.]+rem)/);
            if (gapMatch) {
                const originalGap = gapMatch[1];
                const newGap = `calc(${originalGap} * max(${validSpacingScale}, 0))`;
                element.style.gap = newGap;
            }
        });

        // Find all elements with inline margin styles
        const elementsWithMargin = document.querySelectorAll('[style*="margin"]');
        elementsWithMargin.forEach(element => {
            const style = element.getAttribute('style');
            
            // Update margin-top
            const marginTopMatch = style.match(/margin-top:\s*([0-9.]+rem)/);
            if (marginTopMatch) {
                const originalMargin = marginTopMatch[1];
                const newMargin = `calc(${originalMargin} * max(${validSpacingScale}, 0))`;
                element.style.marginTop = newMargin;
            }
            
            // Update margin-bottom
            const marginBottomMatch = style.match(/margin-bottom:\s*([0-9.]+rem)/);
            if (marginBottomMatch) {
                const originalMargin = marginBottomMatch[1];
                const newMargin = `calc(${originalMargin} * max(${validSpacingScale}, 0))`;
                element.style.marginBottom = newMargin;
            }
            
            // Update margin-left
            const marginLeftMatch = style.match(/margin-left:\s*([0-9.]+rem)/);
            if (marginLeftMatch) {
                const originalMargin = marginLeftMatch[1];
                const newMargin = `calc(${originalMargin} * max(${validSpacingScale}, 0))`;
                element.style.marginLeft = newMargin;
            }
            
            // Update margin-right
            const marginRightMatch = style.match(/margin-right:\s*([0-9.]+rem)/);
            if (marginRightMatch) {
                const originalMargin = marginRightMatch[1];
                const newMargin = `calc(${originalMargin} * max(${validSpacingScale}, 0))`;
                element.style.marginRight = newMargin;
            }
            
            // Update general margin
            const marginMatch = style.match(/margin:\s*([0-9.]+rem)/);
            if (marginMatch) {
                const originalMargin = marginMatch[1];
                const newMargin = `calc(${originalMargin} * max(${validSpacingScale}, 0))`;
                element.style.margin = newMargin;
            }
        });

        // Find all elements with inline padding styles
        const elementsWithPadding = document.querySelectorAll('[style*="padding"]');
        elementsWithPadding.forEach(element => {
            const style = element.getAttribute('style');
            
            // Update padding-top
            const paddingTopMatch = style.match(/padding-top:\s*([0-9.]+rem)/);
            if (paddingTopMatch) {
                const originalPadding = paddingTopMatch[1];
                const newPadding = `calc(${originalPadding} * max(${validSpacingScale}, 0))`;
                element.style.paddingTop = newPadding;
            }
            
            // Update padding-bottom
            const paddingBottomMatch = style.match(/padding-bottom:\s*([0-9.]+rem)/);
            if (paddingBottomMatch) {
                const originalPadding = paddingBottomMatch[1];
                const newPadding = `calc(${originalPadding} * max(${validSpacingScale}, 0))`;
                element.style.paddingBottom = newPadding;
            }
            
            // Update padding-left
            const paddingLeftMatch = style.match(/padding-left:\s*([0-9.]+rem)/);
            if (paddingLeftMatch) {
                const originalPadding = paddingLeftMatch[1];
                const newPadding = `calc(${originalPadding} * max(${validSpacingScale}, 0))`;
                element.style.paddingLeft = newPadding;
            }
            
            // Update padding-right
            const paddingRightMatch = style.match(/padding-right:\s*([0-9.]+rem)/);
            if (paddingRightMatch) {
                const originalPadding = paddingRightMatch[1];
                const newPadding = `calc(${originalPadding} * max(${validSpacingScale}, 0))`;
                element.style.paddingRight = newPadding;
            }
            
            // Update general padding
            const paddingMatch = style.match(/padding:\s*([0-9.]+rem)/);
            if (paddingMatch) {
                const originalPadding = paddingMatch[1];
                const newPadding = `calc(${originalPadding} * max(${validSpacingScale}, 0))`;
                element.style.padding = newPadding;
            }
        });

        // Find all elements with inline styles containing calc() expressions
        const elementsWithCalc = document.querySelectorAll('[style*="calc("]');
        elementsWithCalc.forEach(element => {
            const style = element.getAttribute('style');
            
            // Update calc expressions that don't already have spacing-scale
            const calcMatch = style.match(/calc\(([^)]*)\)/g);
            if (calcMatch) {
                calcMatch.forEach(calcExpr => {
                    if (!calcExpr.includes('--spacing-scale')) {
                        // This is a calc expression without spacing-scale, update it
                        const newCalcExpr = calcExpr.replace(/calc\(([^)]*)\)/, `calc($1 * max(var(--spacing-scale, 1.0), 0))`);
                        element.style.cssText = element.style.cssText.replace(calcExpr, newCalcExpr);
                    }
                });
            }
        });
    }

    /**
     * Synchronize snap to grid states between canvas and view
     * Prefers view.snapToGrid as source of truth (set by toolbar/menu)
     */
    syncSnapToGridStates() {
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'syncSnapToGridStates');
        if (!this.levelEditor) return;

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
     * Synchronize editor.view settings to canvas settings (bidirectional)
     * This ensures that settings saved by toolbar/menu are properly loaded and vice versa
     */
    syncEditorViewToCanvas() {
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'syncEditorViewToCanvas');
        if (!this.levelEditor) return;

        // Grid is handled by canvas.showGrid as single source of truth
        // No need to sync between view.grid and canvas.showGrid

        // Sync snap settings (bidirectional)
        const editorSnap = this.levelEditor.stateManager.get('view.snapToGrid');
        const canvasSnap = this.levelEditor.stateManager.get('canvas.snapToGrid');
        
        if (editorSnap !== undefined && canvasSnap === undefined) {
            this.levelEditor.stateManager.set('canvas.snapToGrid', editorSnap);
        } else if (canvasSnap !== undefined && editorSnap === undefined) {
            this.levelEditor.stateManager.set('view.snapToGrid', canvasSnap);
        } else if (editorSnap !== undefined && canvasSnap !== undefined && editorSnap !== canvasSnap) {
            // If both exist but are different, prefer canvas.snapToGrid as it's the primary source
            this.levelEditor.stateManager.set('view.snapToGrid', canvasSnap);
        }
    }

    /**
     * Setup bidirectional synchronization between view and canvas states
     * This ensures that changes in one state are automatically reflected in the other
     */
    setupBidirectionalSync() {
        // Get levelEditor with fallback
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'setupBidirectionalSync');
        if (!this.levelEditor) return;

        // Prevent multiple setups
        if (this.bidirectionalSyncSetup) return;
        this.bidirectionalSyncSetup = true;

        // Prevent infinite loops by tracking sync operations
        this.syncing = new Set();

        // Check if subscriptions already exist to prevent duplicates
        if (this.levelEditor.stateManager._hasSyncManagerSubscriptions) return;
        this.levelEditor.stateManager._hasSyncManagerSubscriptions = true;

        // Only sync snapToGrid (grid is handled by canvas.showGrid as single source of truth)
        // Sync view.snapToGrid <-> canvas.snapToGrid (bidirectional)
        this.levelEditor.stateManager.subscribe('view.snapToGrid', (value) => {
            if (this.syncing.has('canvas.snapToGrid')) return;
            this.syncing.add('view.snapToGrid');
            this.levelEditor.stateManager.set('canvas.snapToGrid', value);
            this.syncing.delete('view.snapToGrid');
        });

        this.levelEditor.stateManager.subscribe('canvas.snapToGrid', (value) => {
            if (this.syncing.has('view.snapToGrid')) return;
            this.syncing.add('canvas.snapToGrid');
            this.levelEditor.stateManager.set('view.snapToGrid', value);
            this.syncing.delete('canvas.snapToGrid');
        });
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
            let value;
            if (option === 'grid') {
                value = this.levelEditor.stateManager.get('canvas.showGrid');
            } else if (option === 'snapToGrid') {
                value = this.levelEditor.stateManager.get('canvas.snapToGrid');
            } else {
                value = this.levelEditor.stateManager.get(`view.${option}`);
            }
            
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
        // Get levelEditor with fallback and check required components
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'forceUpdateToolbarButtons');
        if (!ValidationUtils.hasRequiredComponents(this.levelEditor, ['stateManager'], 'forceUpdateToolbarButtons')) {
            return;
        }

        // Check if toolbar is available using StateManager
        if (!this.levelEditor.toolbar) {
            ValidationUtils.logValidation('SettingsSyncManager', 'Toolbar not available, skipping toolbar update');
            // Update component status in StateManager
            ValidationUtils.updateComponentStatus(this.levelEditor, 'toolbar', false);
            return;
        }

        // Update component status in StateManager
        ValidationUtils.updateComponentStatus(this.levelEditor, 'toolbar', true);

        // Update all toolbar toggle buttons based on current StateManager values
        const toolbarMappings = {
            'toggleGrid': 'canvas.showGrid',
            'toggleSnapToGrid': 'canvas.snapToGrid', 
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
        // Get levelEditor with fallback and check required components
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'forceUpdateMenuStates');
        if (!ValidationUtils.hasRequiredComponents(this.levelEditor, ['stateManager', 'eventHandlers'], 'forceUpdateMenuStates')) {
            return;
        }
        
        if (!this.levelEditor.eventHandlers.menuManager) {
            ValidationUtils.logValidation('SettingsSyncManager', 'MenuManager not available, skipping menu update');
            // Update component status in StateManager
            ValidationUtils.updateComponentStatus(this.levelEditor, 'menuManager', false);
            return;
        }

        // Update component status in StateManager
        ValidationUtils.updateComponentStatus(this.levelEditor, 'menuManager', true);

        // Update all menu toggle states based on current StateManager values
        const menuMappings = {
            'toggle-grid': 'canvas.showGrid',
            'toggle-snap-to-grid': 'canvas.snapToGrid',
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
        // Get levelEditor with fallback and check required components
        this.levelEditor = ValidationUtils.getLevelEditor(this.levelEditor, 'saveAllUISettingsToConfig');
        if (!ValidationUtils.hasRequiredComponents(this.levelEditor, ['configManager', 'stateManager'], 'saveAllUISettingsToConfig')) {
            return;
        }

        // Save all mapped settings from StateManager to ConfigManager
        Object.entries(this.stateMapping).forEach(([settingPath, stateKey]) => {
            const value = this.levelEditor.stateManager.get(stateKey);
            if (value !== undefined) {
                // Save value as-is
                this.levelEditor.configManager.set(settingPath, value);
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
