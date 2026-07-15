import { BaseModule } from './BaseModule.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { Logger } from '../utils/Logger.js';

/**
 * Applies ConfigManager settings (grid, colors) to StateManager/Level.
 * Extracted from LevelEditor.js (init-time config / DOM bootstrap).
 */
export class EditorConfigController extends BaseModule {
    /**
     * Apply configuration settings to editor
     * @description Main entry point for applying configuration. Note: Font scale
     * and theme are applied immediately in index.html to prevent UI flicker.
     */
    applyConfiguration() {
        if (!this.editor.configManager) {
            Logger.settings.warn('ConfigManager not initialized, skipping configuration');
            return;
        }

        // Apply different configuration sections
        this._applyGridConfiguration();
        this._applyColorConfiguration();
        this._syncGridSettingsToUI();
        this._saveDefaultConfiguration();
    }

    /**
     * Apply color configuration settings to StateManager
     * @private
     */
    _applyColorConfiguration() {
        // Apply UI colors
        const uiColors = this.editor.configManager.get('ui');
        if (uiColors) {
            this.editor.stateManager.set('ui.backgroundColor', uiColors.backgroundColor);
            this.editor.stateManager.set('ui.textColor', uiColors.textColor);
            this.editor.stateManager.set('ui.activeColor', uiColors.activeColor);
            this.editor.stateManager.set('ui.activeTextColor', uiColors.activeTextColor);
            this.editor.stateManager.set('ui.activeTabColor', uiColors.activeTabColor);
            this.editor.stateManager.set('ui.accentColor', uiColors.accentColor);
            this.editor.stateManager.set('ui.resizerColor', uiColors.resizerColor);
        }

        // Apply canvas colors
        const canvasColors = this.editor.configManager.get('canvas');
        if (canvasColors) {
            this.editor.stateManager.set('canvas.backgroundColor', canvasColors.backgroundColor);
        }

        // Apply selection colors
        const selectionColors = this.editor.configManager.get('selection');
        if (selectionColors) {
            this.editor.stateManager.set('selection.outlineColor', selectionColors.outlineColor);
            this.editor.stateManager.set('selection.outlineWidth', selectionColors.outlineWidth);
            this.editor.stateManager.set('selection.groupOutlineColor', selectionColors.groupOutlineColor);
            this.editor.stateManager.set('selection.groupOutlineWidth', selectionColors.groupOutlineWidth);
            this.editor.stateManager.set('selection.marqueeColor', selectionColors.marqueeColor);
            this.editor.stateManager.set('selection.marqueeOpacity', selectionColors.marqueeOpacity);
            this.editor.stateManager.set('selection.hierarchyHighlightColor', selectionColors.hierarchyHighlightColor);
            this.editor.stateManager.set('selection.activeLayerBorderColor', selectionColors.activeLayerBorderColor);
        }

        // Apply logger colors
        const loggerColors = this.editor.configManager.get('logger.colors');
        if (loggerColors) {
            this.editor.stateManager.set('logger.colors', loggerColors);
        }
    }

    /**
     * Apply grid configuration settings to StateManager
     * @private
     */
    _applyGridConfiguration() {
        // Get all grid settings from config
        const gridSettings = this._getGridSettingsFromConfig();

        // Apply basic grid settings
        this._applyBasicGridSettings(gridSettings);

        // Apply grid subdivision settings
        this._applyGridSubdivisionSettings(gridSettings);

        // Apply grid type settings
        this._applyGridTypeSettings(gridSettings);
    }

    /**
     * Get grid settings from configuration manager
     * @private
     * @returns {Object} Grid settings object
     */
    _getGridSettingsFromConfig() {
        return {
            size: this.editor.configManager.get('grid.size'),
            color: this.editor.configManager.get('grid.color'),
            thickness: this.editor.configManager.get('grid.thickness'),
            opacity: this.editor.configManager.get('grid.opacity'),
            subdivisions: this.editor.configManager.get('grid.subdivisions'),
            subdivColor: this.editor.configManager.get('grid.subdivColor'),
            subdivThickness: this.editor.configManager.get('grid.subdivThickness'),
            type: this.editor.configManager.get('canvas.gridType'),
            hexOrientation: this.editor.configManager.get('canvas.hexOrientation')
        };
    }

    /**
     * Apply basic grid settings (size, color, thickness, opacity)
     * @private
     * @param {Object} settings - Grid settings object
     */
    _applyBasicGridSettings(settings) {
        if (settings.size !== undefined) {
            this.editor.stateManager.set('canvas.gridSize', settings.size);
        }

        if (settings.color !== undefined) {
            const opacity = settings.opacity !== undefined ? settings.opacity : 0.1;
            const colorValue = ColorUtils.toRgba(settings.color, opacity);
            this.editor.stateManager.set('canvas.gridColor', colorValue);
        }

        if (settings.thickness !== undefined) {
            this.editor.stateManager.set('canvas.gridThickness', settings.thickness);
        }

        if (settings.opacity !== undefined) {
            this.editor.stateManager.set('canvas.gridOpacity', settings.opacity);
        }
    }

    /**
     * Apply grid subdivision settings
     * @private
     * @param {Object} settings - Grid settings object
     */
    _applyGridSubdivisionSettings(settings) {
        if (settings.subdivisions !== undefined) {
            this.editor.stateManager.set('canvas.gridSubdivisions', settings.subdivisions);
        }

        if (settings.subdivColor !== undefined) {
            const opacity = settings.opacity !== undefined ? settings.opacity : 0.1;
            const subdivColorValue = ColorUtils.toRgba(settings.subdivColor, opacity);
            this.editor.stateManager.set('canvas.gridSubdivColor', subdivColorValue);
        }

        if (settings.subdivThickness !== undefined) {
            this.editor.stateManager.set('canvas.gridSubdivThickness', settings.subdivThickness);
        }
    }

    /**
     * Apply grid type settings (rectangular, hexagonal, etc.)
     * @private
     * @param {Object} settings - Grid settings object
     */
    _applyGridTypeSettings(settings) {
        if (settings.type !== undefined) {
            this.editor.stateManager.set('canvas.gridType', settings.type);
        }

        if (settings.hexOrientation !== undefined) {
            this.editor.stateManager.set('canvas.hexOrientation', settings.hexOrientation);
        }
    }

    /**
     * Sync grid settings to UI components
     * @private
     */
    _syncGridSettingsToUI() {
        if (this.editor.settingsPanel && this.editor.settingsPanel.gridSettings) {
            this.editor.settingsPanel.gridSettings.syncAllGridSettingsToState();
        }
    }

    /**
     * Save default configuration settings
     * @private
     */
    _saveDefaultConfiguration() {
        if (this.editor.configManager) {
            this.editor.configManager.saveSettings();
        }
    }

    /**
     * Apply configuration to level settings
     */
    applyConfigurationToLevel() {
        if (!this.editor.level || !this.editor.configManager) return;

        // Apply canvas settings to level
        const canvasConfig = this.editor.configManager.getCanvas();

        if (canvasConfig.backgroundColor) {
            this.editor.level.settings.backgroundColor = canvasConfig.backgroundColor;
        }

        if (canvasConfig.gridSize) {
            this.editor.level.settings.gridSize = canvasConfig.gridSize;
        }

        if (canvasConfig.showGrid !== undefined) {
            this.editor.level.settings.showGrid = canvasConfig.showGrid;
        }
    }
}
