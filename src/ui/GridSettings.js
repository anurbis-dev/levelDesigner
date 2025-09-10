/**
 * Grid Settings Module
 * Handles all grid-related settings rendering and synchronization
 */
export class GridSettings {
    constructor(configManager) {
        this.configManager = configManager;
    }

    /**
     * Render grid settings section
     */
    renderGridSettings() {
        return `
            <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 1rem;">Grid & Snapping Settings</h3>

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
                        <input type="color" class="setting-input" name="setting-input" data-setting="grid.color" value="${this.configManager.get('grid.color') || '#ffffff'}" style="width:100%; height: 2.5rem; border:1px solid #4b5563; border-radius:0.25rem; cursor:pointer;"/>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Thickness</label>
                        <input type="number" min="0.1" max="5" step="0.1" class="setting-input" name="setting-input" data-setting="grid.thickness" value="${this.configManager.get('grid.thickness') || 1}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
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
                        <input type="color" class="setting-input" name="setting-input" data-setting="grid.subdivColor" value="${this.configManager.get('grid.subdivColor') || '#666666'}" style="width:100%; height: 2.5rem; border:1px solid #4b5563; border-radius:0.25rem; cursor:pointer;"/>
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
    syncAllGridSettingsToState() {
        if (!window.levelEditor || !window.levelEditor.stateManager) return;
        
        // Get all grid settings from ConfigManager
        const gridSize = this.configManager.get('grid.size');
        const gridColor = this.configManager.get('grid.color');
        const gridThickness = this.configManager.get('grid.thickness');
        const gridOpacity = this.configManager.get('grid.opacity');
        
        // Convert and set each parameter
        if (gridSize !== undefined) {
            window.levelEditor.stateManager.set('canvas.gridSize', gridSize);
        }
        
        if (gridColor !== undefined) {
            let colorValue = gridColor;
            if (gridColor.startsWith('#')) {
                const opacity = gridOpacity !== undefined ? gridOpacity : 0.1;
                const r = parseInt(gridColor.slice(1, 3), 16);
                const g = parseInt(gridColor.slice(3, 5), 16);
                const b = parseInt(gridColor.slice(5, 7), 16);
                colorValue = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }
            window.levelEditor.stateManager.set('canvas.gridColor', colorValue);
        }
        
        if (gridThickness !== undefined) {
            window.levelEditor.stateManager.set('canvas.gridThickness', gridThickness);
        }
        
        if (gridOpacity !== undefined) {
            window.levelEditor.stateManager.set('canvas.gridOpacity', gridOpacity);
        }
        
        // Trigger re-render to apply changes
        window.levelEditor.render();
    }
}
