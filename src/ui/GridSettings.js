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

        // Axis Constraint settings
        const showAxis = stateManager.get('editor.axisConstraint.showAxis') || true;
        const axisColor = stateManager.get('editor.axisConstraint.axisColor') || '#cccccc';
        const axisWidth = stateManager.get('editor.axisConstraint.axisWidth') || 1;
        
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
                        <input type="number" id="grid-size" min="8" max="512" step="8" class="settings-input" name="setting-input" data-setting="grid.size" value="${gridSize}" oninput="this.value = Math.min(512, Math.max(8, parseInt(this.value) || 8))"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Color</label>
                        <input type="color" id="grid-color" class="settings-input" name="setting-input" data-setting="grid.color" value="${ColorUtils.toHex(gridColor)}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Thickness</label>
                        <input type="number" id="grid-thickness" min="0.1" max="5" step="0.1" class="settings-input" name="setting-input" data-setting="grid.thickness" value="${gridThickness}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Snap Tolerance (%)</label>
                        <input type="number" id="snap-tolerance" min="5" max="100" step="5" class="settings-input" name="setting-input" data-setting="canvas.snapTolerance" value="${snapTolerance}"/>
                    </div>
                    <div class="settings-form-item">
                        <label style="display: flex; align-items: center; margin-top: 0.5rem;">
                            <input type="checkbox" id="snap-to-grid" class="settings-input" name="setting-input" data-setting="canvas.snapToGrid" ${snapToGrid ? 'checked' : ''} style="margin-right: 0.5rem;">
                            <span style="color: var(--ui-text-color, #d1d5db);">Snap To Grid</span>
                        </label>
                    </div>
                    <div class="settings-form-item">
                        <label style="display: flex; align-items: center; margin-top: 0.5rem;">
                            <input type="checkbox" id="show-grid" class="settings-input" name="setting-input" data-setting="canvas.showGrid" ${showGrid ? 'checked' : ''} style="margin-right: 0.5rem;">
                            <span style="color: var(--ui-text-color, #d1d5db);">Show Grid</span>
                        </label>
                    </div>
                </div>

                <!-- Правая колонка -->
                <div class="settings-form-group">
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Opacity</label>
                        <input type="range" id="grid-opacity" min="0" max="1" step="0.05" class="settings-input" name="setting-input" data-setting="grid.opacity" value="${gridOpacity}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdivisions</label>
                        <input type="number" id="grid-subdivisions" min="0" max="10" step="1" class="settings-input" name="setting-input" data-setting="grid.subdivisions" value="${gridSubdivisions}" oninput="this.value = Math.min(10, Math.max(0, parseInt(this.value) || 0))"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdiv. Color</label>
                        <input type="color" id="grid-subdiv-color" class="settings-input" name="setting-input" data-setting="grid.subdivColor" value="${ColorUtils.toHex(gridSubdivColor)}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdiv. Thickness</label>
                        <input type="number" id="grid-subdiv-thickness" min="0.1" max="3" step="0.1" class="settings-input" name="setting-input" data-setting="grid.subdivThickness" value="${gridSubdivThickness}"/>
                    </div>
                </div>
            </div>

            <!-- Axis Constraint Settings -->
            <div class="settings-form-group" style="margin-top: 1.5rem; border-top: 1px solid #374151; padding-top: 1rem;">
                <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Axis Constraint</h4>

                <div class="settings-flex" style="display: flex; gap: 1rem; align-items: center; width: 100%;">
                    <!-- Show Axis Checkbox -->
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="show-axis" class="settings-input" name="setting-input" data-setting="editor.axisConstraint.showAxis"
                               ${showAxis ? 'checked' : ''}
                               style="width: 1rem; height: 1rem;">
                        <label style="font-size: 0.875rem; color: var(--ui-text-color, #d1d5db);">Show Axis</label>
                    </div>

                    <!-- Axis Color -->
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <label style="font-size: 0.875rem; color: var(--ui-text-color, #d1d5db);">Color:</label>
                        <input type="color" id="axis-color" class="settings-input" name="setting-input" data-setting="editor.axisConstraint.axisColor"
                               value="${ColorUtils.toHex(axisColor)}"
                               style="width: 2rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                    </div>

                    <!-- Axis Width -->
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <label style="font-size: 0.875rem; color: var(--ui-text-color, #d1d5db);">Width:</label>
                        <input type="number" id="axis-width" step="1" min="1" max="10" class="settings-input" name="setting-input" data-setting="editor.axisConstraint.axisWidth"
                               value="${axisWidth}"
                               style="width: 4rem; padding: 0.25rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white; text-align: center;">
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

        // Axis constraint settings
        let showAxis = this.configManager.get('editor.axisConstraint.showAxis') ?? true;
        let axisColor = this.configManager.get('editor.axisConstraint.axisColor') ?? '#cccccc';
        let axisWidth = this.configManager.get('editor.axisConstraint.axisWidth') ?? 1;


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
            else if (changedPath === 'editor.axisConstraint.showAxis') showAxis = changedValue;
            else if (changedPath === 'editor.axisConstraint.axisColor') axisColor = changedValue;
            else if (changedPath === 'editor.axisConstraint.axisWidth') axisWidth = changedValue;
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

        // Set axis constraint settings
        window.editor.stateManager.set('editor.axisConstraint.showAxis', showAxis);
        window.editor.stateManager.set('editor.axisConstraint.axisColor', axisColor);
        window.editor.stateManager.set('editor.axisConstraint.axisWidth', axisWidth);

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
        // Don't prevent reinitialization - we need to set up listener every time tab is rendered
        // Remove this line: if (this._eventListenersInitialized) return;
        
        const gridTypeSelect = document.querySelector('[data-setting="canvas.gridType"]');
        if (gridTypeSelect) {
            // Remove old listener if exists
            if (gridTypeSelect._gridTypeChangeHandler) {
                gridTypeSelect.removeEventListener('change', gridTypeSelect._gridTypeChangeHandler);
            }
            
            // Create and store new handler
            gridTypeSelect._gridTypeChangeHandler = () => {
                this.handleGridTypeChange();
            };
            
            // Add new event listener
            gridTypeSelect.addEventListener('change', gridTypeSelect._gridTypeChangeHandler);
            
            // IMPORTANT: Initial call to set correct visibility based on current grid type
            this.handleGridTypeChange();
        }

        // Show Grid checkbox is already handled by SettingsSyncManager
        // No additional synchronization needed
    }
}
