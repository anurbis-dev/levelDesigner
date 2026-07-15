import { BaseModule } from './BaseModule.js';
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';
import { Logger } from '../utils/Logger.js';

/**
 * Restores UI preferences (console height, asset tab order) on startup and
 * persists them on unload / tab-switch. Dock layout is owned by DockPersistence.
 */
export class EditorPreferencesController extends BaseModule {
    /**
     * Apply saved panel sizes to prevent UI flicker
     */
    applySavedPanelSizes() {
        const editor = this.editor;
        if (!editor.userPrefs) return;

        try {
            this.applyPanelSizesFromPreferences();
            this.applyTabOrderSettings();

            if (editor.canvasRenderer) {
                editor.canvasRenderer.resizeCanvas();
                editor.render();
            }
        } catch (error) {
            Logger.layout.warn('Failed to apply saved panel settings:', error);
        }
    }

    /**
     * Apply panel sizes from user preferences (console overlay only; dock owns tree ratios)
     */
    applyPanelSizesFromPreferences() {
        const editor = this.editor;
        if (!editor.userPrefs) return;

        try {
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
     * Apply asset tab order settings
     */
    applyTabOrderSettings() {
        const editor = this.editor;
        if (!editor.userPrefs) return;

        try {
            const assetTabOrder = editor.userPrefs.get('assetTabOrder');
            if (assetTabOrder && Array.isArray(assetTabOrder)) {
                editor.stateManager.set('assetTabOrder', assetTabOrder);
            }

            if (editor.assetPanel) {
                editor.assetPanel.render();
            }
        } catch (error) {
            Logger.ui.warn('Failed to apply tab order settings:', error);
        }
    }

    /**
     * Persist canvas edit prefs (snap + grid) — independent of panel unload path.
     */
    saveEditingPreferences() {
        const editor = this.editor;
        if (!editor?.stateManager || !editor?.configManager) return;

        const snapToGrid = editor.stateManager.get('canvas.snapToGrid');
        if (snapToGrid !== undefined) {
            editor.configManager.set('canvas.snapToGrid', snapToGrid);
        }

        const gridKeys = [
            ['canvas.gridSize', 'grid.size'],
            ['canvas.gridColor', 'grid.color'],
            ['canvas.gridThickness', 'grid.thickness'],
            ['canvas.gridOpacity', 'grid.opacity'],
            ['canvas.gridSubdivisions', 'grid.subdivisions'],
            ['canvas.gridSubdivColor', 'grid.subdivColor'],
            ['canvas.gridSubdivThickness', 'grid.subdivThickness']
        ];
        for (const [stateKey, configKey] of gridKeys) {
            const value = editor.stateManager.get(stateKey);
            if (value !== undefined) {
                editor.configManager.set(configKey, value);
            }
        }
    }

    /**
     * Persist primary Assets UI + toolbar + dock snapshot (not canvas edit prefs).
     */
    savePanelUiPreferences() {
        const editor = this.editor;

        if (editor.toolbar) {
            editor.toolbar.saveState();
        }

        const currentActiveAssetTabs = editor.stateManager.get('activeAssetTabs');
        if (currentActiveAssetTabs) {
            editor.configManager.set('editor.view.activeAssetTabs', Array.from(currentActiveAssetTabs));
        }

        if (editor.assetPanel?.assetSize) {
            editor.configManager.set('ui.assetSize', editor.assetPanel.assetSize);
        }
        if (editor.assetPanel?.viewMode) {
            editor.configManager.set('ui.assetViewMode', editor.assetPanel.viewMode);
        }

        const assetTabOrder = editor.stateManager.get('assetTabOrder');
        if (assetTabOrder && Array.isArray(assetTabOrder)) {
            editor.userPrefs.set('assetTabOrder', assetTabOrder);
        }

        if (editor.dockManager?._inited) {
            editor.dockManager.persistence?.save(editor.dockManager.getLayoutSnapshot());
        }
    }

    /**
     * Full unload/visibility flush: panel UI + editing prefs + forceSave.
     */
    saveAllUserSettings() {
        const editor = this.editor;
        this.savePanelUiPreferences();
        this.saveEditingPreferences();
        if (editor.configManager) {
            editor.configManager.forceSaveAllSettings();
        }
    }

    /**
     * Setup auto-save on page unload
     */
    setupAutoSaveOnUnload() {
        if (this._autoSaveUnloadRegistered) {
            return;
        }

        globalEventRegistry.registerComponentHandlers('level-editor-autosave-unload', {
            beforeunload: () => {
                try {
                    Logger.ui.info('Saving user settings on page unload...');
                    this.saveAllUserSettings();
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
     */
    setupAutoSaveOnVisibilityChange() {
        if (this._autoSaveVisibilityRegistered) {
            return;
        }

        const editor = this.editor;

        globalEventRegistry.registerComponentHandlers('level-editor-autosave-visibility', {
            visibilitychange: () => {
                if (document.hidden) {
                    if (editor.mouseHandlers) {
                        editor.mouseHandlers.handleWindowBlur();
                    }

                    try {
                        Logger.ui.info('Saving user settings on tab switch...');
                        this.saveAllUserSettings();
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
