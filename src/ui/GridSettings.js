import { RenderUtils } from '../utils/RenderUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';

/**
 * Grid Settings Module
 * Handles all grid-related settings rendering and synchronization
 */
export class GridSettings {
    constructor(configManager) {
        this.configManager = configManager;
        this.renderTimeout = null;
    }

    /**
     * Render grid settings section
     */
    renderGridSettings() {
        // Use StateManager as single source of truth instead of ConfigManager
        const stateManager = window.editor?.stateManager;
        if (!stateManager) return '<div>Error: StateManager not available</div>';
        
        // Get current values from StateManager
        const gridType = stateManager.get('canvas.gridType') || 'rectangular';
        const hexOrientation = stateManager.get('canvas.hexOrientation') || 'pointy';
        const showGrid = stateManager.get('canvas.showGrid') || false;
        const snapToGrid = stateManager.get('canvas.snapToGrid') || false;
        const gridSize = stateManager.get('canvas.gridSize') || 32;
        const gridColor = stateManager.get('canvas.gridColor') || 'rgba(255, 255, 255, 0.1)';
        const gridThickness = stateManager.get('canvas.gridThickness') || 1;
        const gridOpacity = stateManager.get('canvas.gridOpacity') || 0.1;
        const gridSubdivisions = stateManager.get('canvas.gridSubdivisions') || 0;
        const gridSubdivColor = stateManager.get('canvas.gridSubdivColor') || '#666666';
        const gridSubdivThickness = stateManager.get('canvas.gridSubdivThickness') || 0.5;
        const snapTolerance = stateManager.get('canvas.snapTolerance') || 80;
        
        return `
            <h3>Grid & Snapping Settings</h3>

            <!-- Grid Type Selection -->
            <div class="settings-form-group">
                <label class="settings-label">Grid Type</label>
                <select class="settings-input" name="setting-input" data-setting="canvas.gridType">
                    <option value="rectangular" ${gridType === 'rectangular' ? 'selected' : ''}>Rectangular Grid</option>
                    <option value="diamond" ${gridType === 'diamond' ? 'selected' : ''}>Diamond Grid</option>
                    <option value="hexagonal" ${gridType === 'hexagonal' ? 'selected' : ''}>Hexagonal Grid</option>
                </select>
            </div>

            <!-- Hex Orientation (only visible when hexagonal grid is selected) -->
            <div id="hexOrientationSection" class="settings-form-group" style="display: none;">
                <label class="settings-label">Hex Orientation</label>
                <select class="settings-input" name="setting-input" data-setting="canvas.hexOrientation">
                    <option value="pointy" ${hexOrientation === 'pointy' ? 'selected' : ''}>Pointy Top</option>
                    <option value="flat" ${hexOrientation === 'flat' ? 'selected' : ''}>Flat Top</option>
                </select>
            </div>

            <!-- Grid Layout для компактного размещения -->
            <div class="settings-grid settings-grid-2">

                <!-- Левая колонка -->
                <div class="settings-form-group">
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Size (px)</label>
                        <input type="number" min="8" max="512" step="8" class="settings-input" name="setting-input" data-setting="grid.size" value="${gridSize}" oninput="this.value = Math.min(512, Math.max(8, parseInt(this.value) || 8))"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Color</label>
                        <input type="color" class="settings-input" name="setting-input" data-setting="grid.color" value="${ColorUtils.toHex(gridColor)}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Thickness</label>
                        <input type="number" min="0.1" max="5" step="0.1" class="settings-input" name="setting-input" data-setting="grid.thickness" value="${gridThickness}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Snap Tolerance (%)</label>
                        <input type="number" min="5" max="100" step="5" class="settings-input" name="setting-input" data-setting="canvas.snapTolerance" value="${snapTolerance}"/>
                    </div>
                    <div class="settings-form-item">
                        <label style="display: flex; align-items: center; margin-top: 0.5rem;">
                            <input type="checkbox" class="settings-input" name="setting-input" data-setting="canvas.snapToGrid" ${snapToGrid ? 'checked' : ''} style="margin-right: 0.5rem;">
                            <span style="color: #d1d5db;">Snap To Grid</span>
                        </label>
                    </div>
                    <div class="settings-form-item">
                        <label style="display: flex; align-items: center; margin-top: 0.5rem;">
                            <input type="checkbox" class="settings-input" name="setting-input" data-setting="canvas.showGrid" ${showGrid ? 'checked' : ''} style="margin-right: 0.5rem;">
                            <span style="color: #d1d5db;">Show Grid</span>
                        </label>
                    </div>
                </div>

                <!-- Правая колонка -->
                <div class="settings-form-group">
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Opacity</label>
                        <input type="range" min="0" max="1" step="0.05" class="settings-input" name="setting-input" data-setting="grid.opacity" value="${gridOpacity}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdivisions</label>
                        <input type="number" min="0" max="10" step="1" class="settings-input" name="setting-input" data-setting="grid.subdivisions" value="${gridSubdivisions}" oninput="this.value = Math.min(10, Math.max(0, parseInt(this.value) || 0))"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdiv. Color</label>
                        <input type="color" class="settings-input" name="setting-input" data-setting="grid.subdivColor" value="${ColorUtils.toHex(gridSubdivColor)}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdiv. Thickness</label>
                        <input type="number" min="0.1" max="3" step="0.1" class="settings-input" name="setting-input" data-setting="grid.subdivThickness" value="${gridSubdivThickness}"/>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sync all grid settings from ConfigManager to StateManager
     * This method handles the conversion and application of grid settings
     */
    syncAllGridSettingsToState(changedPath = null, changedValue = null) {
        if (!window.editor || !window.editor.stateManager) return;

        // Get all grid settings from ConfigManager with defaults
        let gridSize = this.configManager.get('canvas.gridSize') ?? 32;
        let gridColor = this.configManager.get('canvas.gridColor') ?? 'rgba(255, 255, 255, 0.1)';
        let gridThickness = this.configManager.get('canvas.gridThickness') ?? 1;
        let gridOpacity = this.configManager.get('canvas.gridOpacity') ?? 0.1;
        let gridSubdivisions = this.configManager.get('canvas.gridSubdivisions') ?? 4;
        let gridSubdivColor = this.configManager.get('canvas.gridSubdivColor') ?? '#666666';
        let gridSubdivThickness = this.configManager.get('canvas.gridSubdivThickness') ?? 0.5;
        let gridType = this.configManager.get('canvas.gridType') ?? 'rectangular';
        let hexOrientation = this.configManager.get('canvas.hexOrientation') ?? 'pointy';
        let snapToGrid = this.configManager.get('canvas.snapToGrid') ?? false;


        // If we have a changed value, use it instead of the stored one
        if (changedPath && changedValue !== undefined) {
            if (changedPath === 'grid.size' || changedPath === 'canvas.gridSize') gridSize = changedValue;
            else if (changedPath === 'grid.color' || changedPath === 'canvas.gridColor') gridColor = changedValue;
            else if (changedPath === 'grid.thickness' || changedPath === 'canvas.gridThickness') gridThickness = changedValue;
            else if (changedPath === 'grid.opacity' || changedPath === 'canvas.gridOpacity') gridOpacity = changedValue;
            else if (changedPath === 'grid.subdivisions' || changedPath === 'canvas.gridSubdivisions') gridSubdivisions = changedValue;
            else if (changedPath === 'grid.subdivColor' || changedPath === 'canvas.gridSubdivColor') gridSubdivColor = changedValue;
            else if (changedPath === 'grid.subdivThickness' || changedPath === 'canvas.gridSubdivThickness') gridSubdivThickness = changedValue;
            else if (changedPath === 'canvas.gridType') gridType = changedValue;
            else if (changedPath === 'canvas.hexOrientation') hexOrientation = changedValue;
            else if (changedPath === 'canvas.snapToGrid') snapToGrid = changedValue;
        }

        // If opacity changed, we need to recalculate colors with new opacity
        if (changedPath === 'grid.opacity' || changedPath === 'canvas.gridOpacity') {
            // Force color recalculation by getting fresh values
            gridColor = this.configManager.get('canvas.gridColor') ?? 'rgba(255, 255, 255, 0.1)';
            gridSubdivColor = this.configManager.get('canvas.gridSubdivColor') ?? '#666666';
        }


        // Convert and set each parameter (always set, using defaults)
        window.editor.stateManager.set('canvas.gridSize', gridSize);

        // Apply opacity to grid color using ColorUtils
        const colorValue = ColorUtils.toRgba(gridColor, gridOpacity);
        window.editor.stateManager.set('canvas.gridColor', colorValue);

        window.editor.stateManager.set('canvas.gridThickness', gridThickness);
        window.editor.stateManager.set('canvas.gridOpacity', gridOpacity);
        window.editor.stateManager.set('canvas.gridSubdivisions', gridSubdivisions);

        // Apply opacity to subdivision color using ColorUtils
        const subdivColorValue = ColorUtils.toRgba(gridSubdivColor, gridOpacity);
        window.editor.stateManager.set('canvas.gridSubdivColor', subdivColorValue);

        window.editor.stateManager.set('canvas.gridSubdivThickness', gridSubdivThickness);
        window.editor.stateManager.set('canvas.gridType', gridType);
        window.editor.stateManager.set('canvas.hexOrientation', hexOrientation);
        window.editor.stateManager.set('canvas.snapToGrid', snapToGrid);
        window.editor.stateManager.set('view.snapToGrid', snapToGrid); // Sync to view state for toolbar/menu

        // Trigger re-render with debounce to prevent excessive calls
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        this.renderTimeout = setTimeout(() => {
            // Clear grid caches when settings change
            if (window.editor?.canvasRenderer?.clearGridCaches) {
                window.editor.canvasRenderer.clearGridCaches();
            }
            
            if (window.editor && window.editor.render) {
                window.editor.render();
            }
        }, 50); // 50ms debounce
    }

    /**
     * Handle grid type change to show/hide hex orientation section
     */
    handleGridTypeChange() {
        const gridTypeSelect = document.querySelector('[data-setting="canvas.gridType"]');
        const hexOrientationSection = document.getElementById('hexOrientationSection');
        
        if (gridTypeSelect && hexOrientationSection) {
            const showHexOrientation = gridTypeSelect.value === 'hexagonal';
            hexOrientationSection.style.display = showHexOrientation ? 'block' : 'none';
        }
    }

    /**
     * Initialize event listeners for grid settings
     */
    initializeEventListeners() {
        // Remove existing event listeners to prevent duplicates
        const gridTypeSelect = document.querySelector('[data-setting="canvas.gridType"]');
        if (gridTypeSelect) {
            // Clone the element to remove all event listeners
            const newGridTypeSelect = gridTypeSelect.cloneNode(true);
            gridTypeSelect.parentNode.replaceChild(newGridTypeSelect, gridTypeSelect);
            
            // Add new event listener
            newGridTypeSelect.addEventListener('change', () => {
                this.handleGridTypeChange();
            });
            
            // Initial call to set correct visibility
            this.handleGridTypeChange();
        }

        // Show Grid checkbox is already handled by SettingsSyncManager
        // No additional synchronization needed
    }
}
