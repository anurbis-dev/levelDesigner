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
     * @param {object|null} [view] - target ViewportView (VP-HK)
     */
    resetView(defaults = { x: 0, y: 0, zoom: 1.0 }, view = null) {
        const d = defaults || { x: 0, y: 0, zoom: 1.0 };
        const patch = {
            x: d.x ?? 0,
            y: d.y ?? 0,
            zoom: d.zoom ?? 1.0
        };
        const target = this._resolveHotkeyView(view);
        const vvm = this.editor.viewportViewManager;
        if (vvm && target) {
            vvm.focus(target.leafId);
            vvm.updateCamera(patch, target.leafId);
        } else {
            this.editor.stateManager.update({
                'camera.x': patch.x,
                'camera.y': patch.y,
                'camera.zoom': patch.zoom
            });
        }
        this.editor.render();
        
        Logger.viewport.info('View reset to default');
    }

    /**
     * Resolve target viewport for F/A/jump (VP-HK: under cursor → focused → primary).
     * @param {object|null} [view]
     * @returns {object|null}
     */
    _resolveHotkeyView(view = null) {
        if (view) return view;
        const vvm = this.editor.viewportViewManager;
        if (!vvm) return null;
        return vvm.getViewUnderCursor() || vvm.getFocusedView() || vvm.getAnyView?.() || null;
    }

    /**
     * Focus camera on selected objects
     * @param {object|null} [view] - target ViewportView (VP-HK)
     */
    focusOnSelection(view = null) {
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
        this.focusOnBounds(bounds, 50, view);
        this.editor.render();
        
        Logger.viewport.info(`Focused on ${selection.length} selected objects`);
    }

    /**
     * Bind viewport to a Camera object (game source) so pan/zoom keep editing that cam.
     * Legacy single-canvas path copies pose into stateManager.camera (work).
     * @param {Object} cameraObj
     * @param {object|null} [view] - target ViewportView (VP-HK)
     */
    applyCameraObjectToViewport(cameraObj, view = null) {
        if (!cameraObj?.id) {
            Logger.viewport.warn('Camera object missing id');
            return;
        }
        const target = this._resolveHotkeyView(view);
        const canvas = target?.canvas || this.editor.canvasRenderer?.canvas;
        if (!canvas) {
            Logger.viewport.warn('Canvas not available');
            return;
        }

        const vvm = this.editor.viewportViewManager;
        if (vvm && target) {
            vvm.focus(target.leafId);
            // Bind, do not bake into work — pan/zoom must stay on this game camera
            vvm.setSource(target.leafId, { kind: 'game', objectId: cameraObj.id });
            return;
        }

        const zoom = cameraObj.properties?.zoom ?? 1;
        const centerX = cameraObj.x + (cameraObj.width || 0) / 2;
        const centerY = cameraObj.y + (cameraObj.height || 0) / 2;
        this.editor.stateManager.update({
            'camera.zoom': zoom,
            'camera.x': centerX - canvas.width / (2 * zoom),
            'camera.y': centerY - canvas.height / (2 * zoom)
        });
        this.editor.render();
    }

    /**
     * Jump viewport to the selected camera-type object, or the last camera jumped to
     * if nothing is selected. Warns via the status bar when neither is available.
     * @param {object|null} [view] - target ViewportView (VP-HK)
     */
    jumpToCamera(view = null) {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const selectedCamera = selectedObjects && selectedObjects.size > 0
            ? Array.from(selectedObjects)
                .map(id => this.editor.getCachedObject(id))
                .find(obj => obj && obj.type === 'camera')
            : null;

        const session = this.editor.levelsManager?.getCurrentSession();

        if (selectedCamera) {
            this.applyCameraObjectToViewport(selectedCamera, view);
            if (session) session.viewState.lastCameraObjectId = selectedCamera.id;
            Logger.viewport.info(`Jumped to camera ${selectedCamera.id}`);
            return;
        }

        const lastCameraId = session?.viewState.lastCameraObjectId;
        const lastCamera = lastCameraId ? this.editor.getCachedObject(lastCameraId) : null;
        if (lastCamera && lastCamera.type === 'camera') {
            this.applyCameraObjectToViewport(lastCamera, view);
            Logger.viewport.info(`Jumped to remembered camera ${lastCamera.id}`);
            return;
        }

        Logger.status.warn('No camera selected — select or place a camera object to jump to it.');
    }

    /**
     * Focus camera on all objects in the level
     * @param {object|null} [view] - target ViewportView (VP-HK)
     */
    focusOnAll(view = null) {
        if (!this.editor.level || this.editor.level.objects.length === 0) {
            Logger.viewport.info('No objects in level to focus on');
            this.resetView(undefined, view);
            return;
        }

        const bounds = this.getSelectionBounds(this.editor.level.objects);
        this.focusOnBounds(bounds, 50, view);
        this.editor.render();
        
        Logger.viewport.info(`Focused on all ${this.editor.level.objects.length} objects`);
    }

    /**
     * Focus camera on given bounds (inherited from BaseModule and enhanced)
     * @param {Object} bounds - Bounds to focus on {minX, minY, maxX, maxY}
     * @param {number} [padding=50] - Padding around bounds
     * @param {object|null} [view] - target ViewportView (VP-HK)
     */
    focusOnBounds(bounds, padding = 50, view = null) {
        if (!bounds || bounds.minX === Infinity) {
            Logger.viewport.warn('Invalid bounds for focus');
            return;
        }

        const target = this._resolveHotkeyView(view);
        const canvas = target?.canvas || this.editor.canvasRenderer?.canvas;
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
        const patch = {
            zoom: newZoom,
            x: centerX - canvas.width / (2 * newZoom),
            y: centerY - canvas.height / (2 * newZoom)
        };

        const vvm = this.editor.viewportViewManager;
        if (vvm && target) {
            vvm.focus(target.leafId);
            vvm.updateCamera(patch, target.leafId);
        } else {
            this.editor.stateManager.update({
                'camera.zoom': patch.zoom,
                'camera.x': patch.x,
                'camera.y': patch.y
            });
        }
        
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
