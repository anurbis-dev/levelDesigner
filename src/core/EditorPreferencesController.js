import { BaseModule } from './BaseModule.js';
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';
import { Logger } from '../utils/Logger.js';

/**
 * Restores UI preferences (panel sizes, tab order) on startup and persists them
 * (auto-save on unload / tab-switch). Split out of EditorLifecycleController.js
 * to stay under the Фаза 1.2 400-line guardrail — see tmp/2D_Editor_REFACTOR_PLAN.md.
 */
export class EditorPreferencesController extends BaseModule {
    /**
     * Apply saved panel sizes to prevent UI flicker
     */
    applySavedPanelSizes() {
        const editor = this.editor;
        if (!editor.userPrefs) return;

        try {
            // Apply panel sizes from user preferences
            this.applyPanelSizesFromPreferences();

            // Apply tab order settings to prevent UI flicker
            this.applyTabOrderSettings();

            // Update canvas after applying saved sizes
            if (editor.canvasRenderer) {
                editor.canvasRenderer.resizeCanvas();
                editor.render();
            }

        } catch (error) {
            Logger.layout.warn('Failed to apply saved panel settings:', error);
        }
    }

    /**
     * Apply panel sizes from user preferences
     */
    applyPanelSizesFromPreferences() {
        const editor = this.editor;
        if (!editor.userPrefs) return;

        try {
            // L/R widths + assets footer height — dock ratios own layout (B5). Console still overlay.
            const consoleHeight = editor.userPrefs.get('consoleHeight');
            if (consoleHeight) {
                const consolePanel = document.getElementById('console-panel');
                if (consolePanel) {
                    const height = Math.max(200, Math.min(window.innerHeight * 0.9, consoleHeight));
                    consolePanel.style.setProperty('height', height + 'px', 'important');
                    consolePanel.style.setProperty('bottom', 'auto', 'important');
                }
            }
        } catch (error) {
            Logger.layout.warn('Failed to apply panel sizes from preferences:', error);
        }
    }

    /**
     * Apply tab order settings to prevent UI flicker
     */
    applyTabOrderSettings() {
        const editor = this.editor;
        if (!editor.userPrefs) return;

        try {
            // Asset tab order (Assets panel internal tabs — still used)
            const assetTabOrder = editor.userPrefs.get('assetTabOrder');
            if (assetTabOrder && Array.isArray(assetTabOrder)) {
                editor.stateManager.set('assetTabOrder', assetTabOrder);
            }

            // Re-render panels to apply tab order
            if (editor.assetPanel) {
                editor.assetPanel.render();
            }

        } catch (error) {
            Logger.ui.warn('Failed to apply tab order settings:', error);
        }
    }

    /**
     * Setup auto-save on page unload
     * Now saves only when page is closed/reloaded, not on every change
     */
    setupAutoSaveOnUnload() {
        // Check if already registered to prevent duplicates
        if (this._autoSaveUnloadRegistered) {
            return;
        }

        const editor = this.editor;

        // Use GlobalEventRegistry for window events
        globalEventRegistry.registerComponentHandlers('level-editor-autosave-unload', {
            beforeunload: () => {
                try {
                    Logger.ui.info('Saving user settings on page unload...');

                    // Save toolbar state
                    if (editor.toolbar) {
                        editor.toolbar.saveState();
                    }

                    // Save current active asset tabs
                    const currentActiveAssetTabs = editor.stateManager.get('activeAssetTabs');
                    if (currentActiveAssetTabs) {
                        const tabsArray = Array.from(currentActiveAssetTabs);
                        editor.configManager.set('editor.view.activeAssetTabs', tabsArray);
                    }

                    // Save current asset panel size if it exists
                    if (editor.assetPanel?.assetSize) {
                        editor.configManager.set('ui.assetSize', editor.assetPanel.assetSize);
                    }

                    // Save current asset panel view mode if it exists
                    if (editor.assetPanel?.viewMode) {
                        editor.configManager.set('ui.assetViewMode', editor.assetPanel.viewMode);
                    }

                    // Save current snap to grid state
                    const snapToGrid = editor.stateManager.get('canvas.snapToGrid');
                    if (snapToGrid !== undefined) {
                        editor.configManager.set('canvas.snapToGrid', snapToGrid);
                    }

                    // Asset tab order (internal Assets tabs)
                    const assetTabOrder = editor.stateManager.get('assetTabOrder');
                    if (assetTabOrder && Array.isArray(assetTabOrder)) {
                        editor.userPrefs.set('assetTabOrder', assetTabOrder);
                    }

                    // L/R widths, tab orders, tabPositions, L/R/assetsVisible — stopped (B5 dock)

                    // Save current grid settings from StateManager
                    const gridSize = editor.stateManager.get('canvas.gridSize');
                    const gridColor = editor.stateManager.get('canvas.gridColor');
                    const gridThickness = editor.stateManager.get('canvas.gridThickness');
                    const gridOpacity = editor.stateManager.get('canvas.gridOpacity');
                    const gridSubdivisions = editor.stateManager.get('canvas.gridSubdivisions');
                    const gridSubdivColor = editor.stateManager.get('canvas.gridSubdivColor');
                    const gridSubdivThickness = editor.stateManager.get('canvas.gridSubdivThickness');

                    if (gridSize !== undefined) {
                        editor.configManager.set('grid.size', gridSize);
                    }
                    if (gridColor !== undefined) {
                        editor.configManager.set('grid.color', gridColor);
                    }
                    if (gridThickness !== undefined) {
                        editor.configManager.set('grid.thickness', gridThickness);
                    }
                    if (gridOpacity !== undefined) {
                        editor.configManager.set('grid.opacity', gridOpacity);
                    }
                    if (gridSubdivisions !== undefined) {
                        editor.configManager.set('grid.subdivisions', gridSubdivisions);
                    }
                    if (gridSubdivColor !== undefined) {
                        editor.configManager.set('grid.subdivColor', gridSubdivColor);
                    }
                    if (gridSubdivThickness !== undefined) {
                        editor.configManager.set('grid.subdivThickness', gridSubdivThickness);
                    }

                    // Dock layout (B1) — ensure latest tree is in config before flush
                    if (editor.dockManager?._inited) {
                        editor.dockManager.persistence?.save(editor.dockManager.getLayoutSnapshot());
                    }

                    // Force save all modified settings immediately
                    if (editor.configManager) {
                        editor.configManager.forceSaveAllSettings();
                    }

                    Logger.ui.info('User settings saved successfully');
                } catch (error) {
                    Logger.ui.error('Failed to save user settings:', error);
                }
            }
        }, 'window');

        this._autoSaveUnloadRegistered = true;
    }

    /**
     * Setup auto-save on page visibility change (tab switch)
     * Saves settings when user switches to another tab or minimizes browser
     */
    setupAutoSaveOnVisibilityChange() {
        // Check if already registered to prevent duplicates
        if (this._autoSaveVisibilityRegistered) {
            return;
        }

        const editor = this.editor;

        // Use GlobalEventRegistry for document events
        globalEventRegistry.registerComponentHandlers('level-editor-autosave-visibility', {
            visibilitychange: () => {
                if (document.hidden) {
                    // Reset any in-progress mouse action (drag/marquee) since the
                    // page won't receive the eventual mouseup while unfocused
                    if (editor.mouseHandlers) {
                        editor.mouseHandlers.handleWindowBlur();
                    }

                    try {
                        Logger.ui.info('Saving user settings on tab switch...');

                        // Force save all modified settings immediately
                        if (editor.configManager) {
                            editor.configManager.forceSaveAllSettings();
                        }

                        Logger.ui.info('User settings saved on tab switch');
                    } catch (error) {
                        Logger.ui.error('Failed to save user settings on tab switch:', error);
                    }
                }
            }
        }, 'document');

        this._autoSaveVisibilityRegistered = true;
    }
}
