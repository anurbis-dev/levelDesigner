/**
 * User Preferences Manager
 * Provides unified access to user preferences through ConfigManager
 */

import { Logger } from '../utils/Logger.js';
import { ConfigManager } from './ConfigManager.js';

export class UserPreferencesManager {
    constructor() {
        this.configManager = new ConfigManager();


        // Map of preference paths to config paths
        this.pathMapping = {
            // UI preferences
            'rightPanelWidth': 'ui.rightPanelWidth',
            'consoleHeight': 'ui.consoleHeight',
            'assetsPanelHeight': 'ui.assetsPanelHeight',
            'assetSize': 'ui.assetSize',
            'assetViewMode': 'ui.assetViewMode',
            'rightPanelTabOrder': 'panels.rightPanelTabOrder',
            'assetTabOrder': 'panels.assetTabOrder',
            'consoleVisible': 'ui.consoleVisible',
            'consoleMaxLines': 'ui.consoleMaxLines',
            'toolbarVisible': 'ui.toolbarVisible',
            'toolbarScrollLeft': 'ui.toolbarScrollLeft',
            'toolbarButtonStates': 'toolbar.buttonStates',
            'toolbarCollapsedSections': 'toolbar.collapsedSections',
            'toolbarShowIcons': 'toolbar.display.showIcons',
            'toolbarShowText': 'toolbar.display.showText',
            'assetsPanelVisible': 'ui.assetsPanelVisible',
            'rightPanelVisible': 'ui.rightPanelVisible',
            'theme': 'ui.theme',
            'fontSize': 'ui.fontSize',
            'fontScale': 'ui.fontScale',
            'compactMode': 'ui.compactMode',
            'foldersPosition': 'ui.foldersPosition',
            'foldersWidth': 'ui.foldersWidth',

            // Canvas/Grid preferences
            'canvasBackgroundColor': 'canvas.backgroundColor',
            'gridSize': 'canvas.gridSize',
            'showGrid': 'canvas.showGrid',
            'gridColor': 'canvas.gridColor',
            'gridOpacity': 'canvas.gridOpacity',
            'gridThickness': 'canvas.gridThickness',
            'gridSubdivisions': 'canvas.gridSubdivisions',
            'gridSubdivColor': 'canvas.gridSubdivColor',
            'gridSubdivThickness': 'canvas.gridSubdivThickness',
            'snapToGrid': 'canvas.snapToGrid',
            'snapTolerance': 'canvas.snapTolerance',
            'gridType': 'canvas.gridType',
            'hexOrientation': 'canvas.hexOrientation',

            // Editor preferences
            'autoSave': 'editor.autoSave',
            'autoSaveInterval': 'editor.autoSaveInterval',
            'multiSelectMode': 'editor.multiSelectMode',

            // Selection preferences
            'selectionOutlineColor': 'panels.selection.outlineColor',
            'selectionOutlineWidth': 'panels.selection.outlineWidth',
            'selectionGroupOutlineColor': 'panels.selection.groupOutlineColor',
            'selectionGroupOutlineWidth': 'panels.selection.groupOutlineWidth',
            'selectionMarqueeColor': 'panels.selection.marqueeColor',
            'selectionMarqueeOpacity': 'panels.selection.marqueeOpacity',
            'selectionHierarchyHighlightColor': 'panels.selection.hierarchyHighlightColor'
        };
    }

    /**
     * Get a preference value
     */
    get(key) {
        const configPath = this.pathMapping[key];
        if (configPath) {
            return this.configManager.get(configPath);
        }
        Logger.preferences.warn(`Unknown preference key: ${key}`);
        return undefined;
    }

    /**
     * Set a preference value and save
     */
    set(key, value) {
        const configPath = this.pathMapping[key];
        if (configPath) {
            this.configManager.set(configPath, value);
            return true;
        }
        Logger.preferences.warn(`Unknown preference key: ${key}`);
        return false;
    }

    /**
     * Update multiple preferences at once
     */
    update(updates) {
        const configUpdates = {};

        for (const [key, value] of Object.entries(updates)) {
            const configPath = this.pathMapping[key];
            if (configPath) {
                this.configManager.set(configPath, value);
            } else {
                Logger.preferences.warn(`Unknown preference key: ${key}`);
            }
        }
    }

    /**
     * Reset preferences to defaults
     */
    reset() {
        this.configManager.reset();
    }

    /**
     * Export preferences as JSON string
     */
    export() {
        return this.configManager.export();
    }

    /**
     * Import preferences from JSON string
     */
    import(jsonString) {
        return this.configManager.import(jsonString);
    }

    /**
     * Get all preferences
     */
    getAll() {
        const allPrefs = {};
        for (const [prefKey, configPath] of Object.entries(this.pathMapping)) {
            allPrefs[prefKey] = this.configManager.get(configPath);
        }
        return allPrefs;
    }

    /**
     * Check if a preference exists
     */
    has(key) {
        return key in this.pathMapping;
    }

    /**
     * Remove a preference (reset to default)
     */
    remove(key) {
        const configPath = this.pathMapping[key];
        if (configPath) {
            this.configManager.remove(configPath);
            return true;
        }
        return false;
    }

}
