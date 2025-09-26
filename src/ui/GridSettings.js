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
            <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 1rem;">Grid & Snapping Settings</h3>

            <!-- Grid Type Selection -->
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Type</label>
                <select class="setting-input" name="setting-input" data-setting="canvas.gridType" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;">
                    <option value="rectangular" ${(this.configManager.get('canvas.gridType') || 'rectangular') === 'rectangular' ? 'selected' : ''}>Rectangular Grid</option>
                    <option value="diamond" ${(this.configManager.get('canvas.gridType') || 'rectangular') === 'diamond' ? 'selected' : ''}>Diamond Grid</option>
                    <option value="hexagonal" ${(this.configManager.get('canvas.gridType') || 'rectangular') === 'hexagonal' ? 'selected' : ''}>Hexagonal Grid</option>
                </select>
            </div>

            <!-- Hex Orientation (only visible when hexagonal grid is selected) -->
            <div id="hexOrientationSection" style="margin-bottom: 1.5rem; display: none;">
                <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Hex Orientation</label>
                <select class="setting-input" name="setting-input" data-setting="canvas.hexOrientation" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;">
                    <option value="pointy" ${(this.configManager.get('canvas.hexOrientation') || 'pointy') === 'pointy' ? 'selected' : ''}>Pointy Top</option>
                    <option value="flat" ${(this.configManager.get('canvas.hexOrientation') || 'pointy') === 'flat' ? 'selected' : ''}>Flat Top</option>
                </select>
            </div>

            <!-- Grid Layout для компактного размещения -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">

                <!-- Левая колонка -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Size (px)</label>
                        <input type="number" min="8" max="128" step="8" class="setting-input" name="setting-input" data-setting="grid.size" value="${this.configManager.get('grid.size') || 32}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Color</label>
                        <input type="color" class="setting-input" name="setting-input" data-setting="grid.color" value="${RenderUtils.rgbaToHex(this.configManager.get('grid.color')) || '#ffffff'}" style="width:100%; height: 2.5rem; border:1px solid #4b5563; border-radius:0.25rem; cursor:pointer;"/>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Thickness</label>
                        <input type="number" min="0.1" max="5" step="0.1" class="setting-input" name="setting-input" data-setting="grid.thickness" value="${this.configManager.get('grid.thickness') || 1}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Snap Tolerance (%)</label>
                        <input type="number" min="5" max="100" step="5" class="setting-input" name="setting-input" data-setting="canvas.snapTolerance" value="${this.configManager.get('canvas.snapTolerance') || 80}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
                    </div>
                </div>

                <!-- Правая колонка -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Opacity</label>
                        <input type="range" min="0" max="1" step="0.05" class="setting-input" name="setting-input" data-setting="grid.opacity" value="${this.configManager.get('grid.opacity') || 0.1}" style="width:100%;"/>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Subdivisions</label>
                        <input type="number" min="1" max="10" step="1" class="setting-input" name="setting-input" data-setting="grid.subdivisions" value="${this.configManager.get('grid.subdivisions') || 4}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Subdiv. Color</label>
                        <input type="color" class="setting-input" name="setting-input" data-setting="grid.subdivColor" value="${RenderUtils.rgbaToHex(this.configManager.get('grid.subdivColor')) || '#666666'}" style="width:100%; height: 2.5rem; border:1px solid #4b5563; border-radius:0.25rem; cursor:pointer;"/>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Subdiv. Thickness</label>
                        <input type="number" min="0.1" max="3" step="0.1" class="setting-input" name="setting-input" data-setting="grid.subdivThickness" value="${this.configManager.get('grid.subdivThickness') || 0.5}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
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
        // Handle grid type change
        const gridTypeSelect = document.querySelector('[data-setting="canvas.gridType"]');
        if (gridTypeSelect) {
            gridTypeSelect.addEventListener('change', () => {
                this.handleGridTypeChange();
            });
            // Initial call to set correct visibility
            this.handleGridTypeChange();
        }
    }
}
