import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

/**
 * Viewport Operations module for LevelEditor
 * Handles all camera and viewport related operations: zoom, pan, focus.
 * @extends BaseModule
 */
export class ViewportOperations extends BaseModule {
    constructor(editor) {
        super(editor);
        Logger.lifecycle.info('ViewportOperations module initialized.');
    }

    /**
     * Zoom in canvas view
     * @param {number} [factor=1.2] - Zoom factor
     * @param {number} [maxZoom=5.0] - Maximum zoom level
     */
    zoomIn(factor = 1.2, maxZoom = 5.0) {
        const camera = this.editor.stateManager.get('camera');
        const newZoom = Math.min(camera.zoom * factor, maxZoom);
        this.editor.stateManager.update({
            'camera.zoom': newZoom
        });
        this.editor.render();
        
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.viewport.debug(`Zoomed in: ${camera.zoom.toFixed(2)} → ${newZoom.toFixed(2)}`);
        }
    }

    /**
     * Zoom out canvas view
     * @param {number} [factor=1.2] - Zoom factor
     * @param {number} [minZoom=0.1] - Minimum zoom level
     */
    zoomOut(factor = 1.2, minZoom = 0.1) {
        const camera = this.editor.stateManager.get('camera');
        const newZoom = Math.max(camera.zoom / factor, minZoom);
        this.editor.stateManager.update({
            'camera.zoom': newZoom
        });
        this.editor.render();
        
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.viewport.debug(`Zoomed out: ${camera.zoom.toFixed(2)} → ${newZoom.toFixed(2)}`);
        }
    }

    /**
     * Zoom to fit all objects in view
     * @param {number} [padding=50] - Padding around objects
     * @param {number} [maxZoom=1.0] - Maximum zoom level (don't zoom in beyond 1:1)
     */
    zoomToFit(padding = 50, maxZoom = 1.0) {
        if (!this.editor.level || this.editor.level.objects.length === 0) {
            this.resetView();
            return;
        }

        const bounds = this.getSelectionBounds(this.editor.level.objects);
        if (!bounds || bounds.minX === Infinity) {
            this.resetView();
            return;
        }

        const canvas = document.getElementById('main-canvas');
        if (!canvas) {
            Logger.viewport.warn('Canvas element not found');
            return;
        }

        const canvasRect = canvas.getBoundingClientRect();
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;

        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;

        // Calculate zoom to fit all objects with padding
        const zoomX = (canvasWidth - padding * 2) / boundsWidth;
        const zoomY = (canvasHeight - padding * 2) / boundsHeight;
        const zoom = Math.min(zoomX, zoomY, maxZoom);

        // Center the view on the objects
        const centerX = bounds.minX + boundsWidth / 2;
        const centerY = bounds.minY + boundsHeight / 2;

        this.editor.stateManager.update({
            'camera.x': centerX,
            'camera.y': centerY,
            'camera.zoom': zoom
        });

        this.editor.render();
        
        Logger.viewport.info(`Zoomed to fit ${this.editor.level.objects.length} objects (zoom: ${zoom.toFixed(2)})`);
    }

    /**
     * Reset canvas view to default position and zoom
     * @param {Object} [defaults] - Default camera settings
     */
    resetView(defaults = { x: 0, y: 0, zoom: 1.0 }) {
        this.editor.stateManager.update({
            'camera.x': defaults.x,
            'camera.y': defaults.y,
            'camera.zoom': defaults.zoom
        });
        this.editor.render();
        
        Logger.viewport.info('View reset to default');
    }

    /**
     * Focus camera on selected objects
     */
    focusOnSelection() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        if (!selectedObjects || selectedObjects.size === 0) {
            Logger.viewport.info('No objects selected to focus on');
            return;
        }

        const selection = Array.from(selectedObjects)
            .map(id => this.editor.getCachedObject(id))
            .filter(Boolean);

        if (selection.length === 0) {
            Logger.viewport.warn('Selected objects not found');
            return;
        }

        const bounds = this.getSelectionBounds(selection);
        this.focusOnBounds(bounds);
        this.editor.render();
        
        Logger.viewport.info(`Focused on ${selection.length} selected objects`);
    }

    /**
     * Focus camera on all objects in the level
     */
    focusOnAll() {
        if (!this.editor.level || this.editor.level.objects.length === 0) {
            Logger.viewport.info('No objects in level to focus on');
            this.resetView();
            return;
        }

        const bounds = this.getSelectionBounds(this.editor.level.objects);
        this.focusOnBounds(bounds);
        this.editor.render();
        
        Logger.viewport.info(`Focused on all ${this.editor.level.objects.length} objects`);
    }

    /**
     * Focus camera on given bounds (inherited from BaseModule and enhanced)
     * @param {Object} bounds - Bounds to focus on {minX, minY, maxX, maxY}
     * @param {number} [padding=50] - Padding around bounds
     */
    focusOnBounds(bounds, padding = 50) {
        if (!bounds || bounds.minX === Infinity) {
            Logger.viewport.warn('Invalid bounds for focus');
            return;
        }
        
        const canvas = this.editor.canvasRenderer?.canvas;
        if (!canvas) {
            Logger.viewport.warn('Canvas not available');
            return;
        }

        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;
        
        const zoomX = canvas.width / (boundsWidth + padding * 2);
        const zoomY = canvas.height / (boundsHeight + padding * 2);
        
        const newZoom = Math.max(0.1, Math.min(10, Math.min(zoomX, zoomY)));
        const centerX = bounds.minX + boundsWidth / 2;
        const centerY = bounds.minY + boundsHeight / 2;
        
        this.editor.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': centerX - canvas.width / (2 * newZoom),
            'camera.y': centerY - canvas.height / (2 * newZoom)
        });
        
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.viewport.debug(`Focused on bounds: center(${centerX.toFixed(0)}, ${centerY.toFixed(0)}), zoom: ${newZoom.toFixed(2)}`);
        }
    }

    /**
     * Destroy method for cleanup
     */
    destroy() {
        Logger.lifecycle.info('ViewportOperations module destroyed.');
        // No specific DOM elements or event listeners to clean up here.
    }
}
