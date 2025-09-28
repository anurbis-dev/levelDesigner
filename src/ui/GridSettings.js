import { RenderUtils } from '../utils/RenderUtils.js';

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
        return `
            <h3>Grid & Snapping Settings</h3>

            <!-- Grid Type Selection -->
            <div class="settings-form-group">
                <label class="settings-label">Grid Type</label>
                <select class="settings-input" name="setting-input" data-setting="canvas.gridType">
                    <option value="rectangular" ${(this.configManager.get('canvas.gridType') || 'rectangular') === 'rectangular' ? 'selected' : ''}>Rectangular Grid</option>
                    <option value="diamond" ${(this.configManager.get('canvas.gridType') || 'rectangular') === 'diamond' ? 'selected' : ''}>Diamond Grid</option>
                    <option value="hexagonal" ${(this.configManager.get('canvas.gridType') || 'rectangular') === 'hexagonal' ? 'selected' : ''}>Hexagonal Grid</option>
                </select>
            </div>

            <!-- Hex Orientation (only visible when hexagonal grid is selected) -->
            <div id="hexOrientationSection" class="settings-form-group" style="display: none;">
                <label class="settings-label">Hex Orientation</label>
                <select class="settings-input" name="setting-input" data-setting="canvas.hexOrientation">
                    <option value="pointy" ${(this.configManager.get('canvas.hexOrientation') || 'pointy') === 'pointy' ? 'selected' : ''}>Pointy Top</option>
                    <option value="flat" ${(this.configManager.get('canvas.hexOrientation') || 'pointy') === 'flat' ? 'selected' : ''}>Flat Top</option>
                </select>
            </div>

            <!-- Grid Layout для компактного размещения -->
            <div class="settings-grid settings-grid-2">

                <!-- Левая колонка -->
                <div class="settings-form-group">
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Size (px)</label>
                        <input type="number" min="8" max="512" step="8" class="settings-input" name="setting-input" data-setting="grid.size" value="${this.configManager.get('grid.size') || 32}" oninput="this.value = Math.min(512, Math.max(8, parseInt(this.value) || 8))"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Color</label>
                        <input type="color" class="settings-input" name="setting-input" data-setting="grid.color" value="${RenderUtils.rgbaToHex(this.configManager.get('grid.color')) || '#ffffff'}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Thickness</label>
                        <input type="number" min="0.1" max="5" step="0.1" class="settings-input" name="setting-input" data-setting="grid.thickness" value="${this.configManager.get('grid.thickness') || 1}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Snap Tolerance (%)</label>
                        <input type="number" min="5" max="100" step="5" class="settings-input" name="setting-input" data-setting="canvas.snapTolerance" value="${this.configManager.get('canvas.snapTolerance') || 80}"/>
                    </div>
                </div>

                <!-- Правая колонка -->
                <div class="settings-form-group">
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Opacity</label>
                        <input type="range" min="0" max="1" step="0.05" class="settings-input" name="setting-input" data-setting="grid.opacity" value="${this.configManager.get('grid.opacity') || 0.1}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdivisions</label>
                        <input type="number" min="0" max="10" step="1" class="settings-input" name="setting-input" data-setting="grid.subdivisions" value="${this.configManager.get('grid.subdivisions') || 0}" oninput="this.value = Math.min(10, Math.max(0, parseInt(this.value) || 0))"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdiv. Color</label>
                        <input type="color" class="settings-input" name="setting-input" data-setting="grid.subdivColor" value="${RenderUtils.rgbaToHex(this.configManager.get('grid.subdivColor')) || '#666666'}"/>
                    </div>
                    <div class="settings-form-item">
                        <label class="settings-label">Grid Subdiv. Thickness</label>
                        <input type="number" min="0.1" max="3" step="0.1" class="settings-input" name="setting-input" data-setting="grid.subdivThickness" value="${this.configManager.get('grid.subdivThickness') || 0.5}"/>
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
        let gridSize = this.configManager.get('grid.size') ?? 32;
        let gridColor = this.configManager.get('grid.color') ?? '#ffffff';
        let gridThickness = this.configManager.get('grid.thickness') ?? 1;
        let gridOpacity = this.configManager.get('grid.opacity') ?? 0.1;
        let gridSubdivisions = this.configManager.get('grid.subdivisions') ?? 4;
        let gridSubdivColor = this.configManager.get('grid.subdivColor') ?? '#666666';
        let gridSubdivThickness = this.configManager.get('grid.subdivThickness') ?? 0.5;
        let gridType = this.configManager.get('canvas.gridType') ?? 'rectangular';
        let hexOrientation = this.configManager.get('canvas.hexOrientation') ?? 'pointy';


        // If we have a changed value, use it instead of the stored one
        if (changedPath && changedValue !== undefined) {
            if (changedPath === 'grid.size') gridSize = changedValue;
            else if (changedPath === 'grid.color') gridColor = changedValue;
            else if (changedPath === 'grid.thickness') gridThickness = changedValue;
            else if (changedPath === 'grid.opacity') gridOpacity = changedValue;
            else if (changedPath === 'grid.subdivisions') gridSubdivisions = changedValue;
            else if (changedPath === 'grid.subdivColor') gridSubdivColor = changedValue;
            else if (changedPath === 'grid.subdivThickness') gridSubdivThickness = changedValue;
            else if (changedPath === 'canvas.gridType') gridType = changedValue;
            else if (changedPath === 'canvas.hexOrientation') hexOrientation = changedValue;
        }

        // If opacity changed, we need to recalculate colors with new opacity
        if (changedPath === 'grid.opacity') {
            // Force color recalculation by getting fresh values
            gridColor = this.configManager.get('grid.color') ?? '#ffffff';
            gridSubdivColor = this.configManager.get('grid.subdivColor') ?? '#666666';
        }


        // Convert and set each parameter (always set, using defaults)
        window.editor.stateManager.set('canvas.gridSize', gridSize);

        // Convert main grid color
        let colorValue = gridColor;
        if (gridColor.startsWith('#')) {
            const r = parseInt(gridColor.slice(1, 3), 16);
            const g = parseInt(gridColor.slice(3, 5), 16);
            const b = parseInt(gridColor.slice(5, 7), 16);
            colorValue = `rgba(${r}, ${g}, ${b}, ${gridOpacity})`;
        }
        window.editor.stateManager.set('canvas.gridColor', colorValue);

        window.editor.stateManager.set('canvas.gridThickness', gridThickness);
        window.editor.stateManager.set('canvas.gridOpacity', gridOpacity);
        window.editor.stateManager.set('canvas.gridSubdivisions', gridSubdivisions);

        // Convert subdivision color
        let subdivColorValue = gridSubdivColor;
        if (gridSubdivColor.startsWith('#')) {
            const r = parseInt(gridSubdivColor.slice(1, 3), 16);
            const g = parseInt(gridSubdivColor.slice(3, 5), 16);
            const b = parseInt(gridSubdivColor.slice(5, 7), 16);
            subdivColorValue = `rgba(${r}, ${g}, ${b}, ${gridOpacity})`;
        }
        window.editor.stateManager.set('canvas.gridSubdivColor', subdivColorValue);

        window.editor.stateManager.set('canvas.gridSubdivThickness', gridSubdivThickness);
        window.editor.stateManager.set('canvas.gridType', gridType);
        window.editor.stateManager.set('canvas.hexOrientation', hexOrientation);

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
    }
}
