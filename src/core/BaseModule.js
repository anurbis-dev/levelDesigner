/**
 * Base class for editor modules with common helper methods
 * Eliminates code duplication across modules
 */
export class BaseModule {
    constructor(levelEditor) {
        this.editor = levelEditor;
    }

    /**
     * Check if we are currently in group edit mode
     * @returns {boolean} True if group edit mode is active with a valid group
     */
    isInGroupEditMode() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        return groupEditMode && groupEditMode.isActive && groupEditMode.group;
    }

    /**
     * Get the currently active group being edited
     * @returns {Object|null} Active group object or null if not in group edit mode
     */
    getActiveGroup() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        return this.isInGroupEditMode() ? groupEditMode.group : null;
    }

    /**
     * Get full group edit mode state
     * @returns {Object|null} Group edit mode state or null if not active
     */
    getGroupEditMode() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        return this.isInGroupEditMode() ? groupEditMode : null;
    }

    /**
     * Check if Alt key is currently pressed (from mouse or keyboard state)
     * @returns {boolean} True if Alt key is pressed
     */
    isAltKeyPressed() {
        const mouse = this.editor.stateManager.get('mouse');
        return mouse && mouse.altKey;
    }

    /**
     * Update mouse state with common properties
     * @param {Event} e - Mouse event
     * @param {Object} worldPos - World position {x, y}
     */
    updateMouseState(e, worldPos) {
        this.editor.stateManager.update({
            'mouse.x': e.clientX,
            'mouse.y': e.clientY,
            'mouse.worldX': worldPos.x,
            'mouse.worldY': worldPos.y,
            'mouse.altKey': e.altKey
        });
    }

    /**
     * Get selected objects as array of actual objects (not IDs)
     * @returns {Array} Array of selected game objects
     */
    getSelectedObjects() {
        const selectedIds = this.editor.stateManager.get('selectedObjects');
        return Array.from(selectedIds)
            .map(id => this.editor.level.findObjectById(id))
            .filter(Boolean);
    }

    /**
     * Common method to mark level as dirty and trigger updates
     */
    markDirtyAndUpdate() {
        this.editor.stateManager.markDirty();
        this.editor.updateAllPanels();
        this.editor.render();
    }

    /**
     * Save state to history if not already saved recently
     */
    saveStateIfNeeded() {
        this.editor.historyManager.saveState(this.editor.level.objects);
        this.editor.stateManager.markDirty();
    }

    /**
     * Convert screen coordinates to world coordinates
     * @param {Event} e - Mouse event with clientX, clientY
     * @returns {Object} World coordinates {x, y}
     */
    screenToWorld(e) {
        const camera = this.editor.stateManager.get('camera');
        return this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, camera);
    }

    /**
     * Get current mouse state
     * @returns {Object} Mouse state object
     */
    getMouseState() {
        return this.editor.stateManager.get('mouse');
    }

    /**
     * Get current camera state
     * @returns {Object} Camera state {x, y, zoom}
     */
    getCameraState() {
        return this.editor.stateManager.get('camera');
    }

    /**
     * Check if left mouse button is down
     * @returns {boolean} True if left mouse button is pressed
     */
    isLeftMouseDown() {
        const mouse = this.getMouseState();
        return mouse && mouse.isLeftDown;
    }

    /**
     * Check if right mouse button is down
     * @returns {boolean} True if right mouse button is pressed
     */
    isRightMouseDown() {
        const mouse = this.getMouseState();
        return mouse && mouse.isRightDown;
    }

    /**
     * Check if currently dragging objects
     * @returns {boolean} True if dragging
     */
    isDragging() {
        const mouse = this.getMouseState();
        return mouse && mouse.isDragging;
    }

    /**
     * Check if currently in marquee selection mode
     * @returns {boolean} True if marquee selecting
     */
    isMarqueeSelecting() {
        const mouse = this.getMouseState();
        return mouse && mouse.isMarqueeSelecting;
    }

    /**
     * Get selection bounds for given objects
     * @param {Array} objects - Array of objects to get bounds for
     * @returns {Object|null} Bounds {minX, minY, maxX, maxY} or null if no objects
     */
    getSelectionBounds(objects) {
        if (!objects || objects.length === 0) return null;
        
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        objects.forEach(obj => {
            const objBounds = this.editor.objectOperations.getObjectWorldBounds(obj);
            bounds.minX = Math.min(bounds.minX, objBounds.minX);
            bounds.minY = Math.min(bounds.minY, objBounds.minY);
            bounds.maxX = Math.max(bounds.maxX, objBounds.maxX);
            bounds.maxY = Math.max(bounds.maxY, objBounds.maxY);
        });
        return bounds;
    }

    /**
     * Focus camera on given bounds
     * @param {Object} bounds - Bounds to focus on {minX, minY, maxX, maxY}
     */
    focusOnBounds(bounds) {
        if (!bounds || bounds.minX === Infinity) return;
        
        const canvas = this.editor.canvasRenderer.canvas;
        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;
        const padding = 50;
        const zoomX = canvas.width / (boundsWidth + padding * 2);
        const zoomY = canvas.height / (boundsHeight + padding * 2);
        
        const newZoom = Math.max(0.1, Math.min(10, Math.min(zoomX, zoomY)));
        const centerX = bounds.minX + boundsWidth / 2;
        const centerY = bounds.minY + boundsHeight / 2;
        
        this.editor.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': centerX - (canvas.width / 2) / newZoom,
            'camera.y': centerY - (canvas.height / 2) / newZoom
        });
    }

    /**
     * Trigger full UI update and render
     */
    triggerFullUpdate() {
        this.editor.updateAllPanels();
        this.editor.render();
    }

    /**
     * Common pattern: clear selection
     */
    clearSelection() {
        this.editor.stateManager.set('selectedObjects', new Set());
    }

    /**
     * Common pattern: select objects by IDs
     * @param {Array|Set} objectIds - IDs to select
     */
    selectObjects(objectIds) {
        const ids = Array.isArray(objectIds) ? new Set(objectIds) : objectIds;
        this.editor.stateManager.set('selectedObjects', ids);
    }
}
