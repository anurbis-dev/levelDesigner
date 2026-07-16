/**
 * Parallax Renderer
 * Handles all parallax-related rendering operations
 */

import { Logger } from './Logger.js';

export class ParallaxRenderer {
    constructor(editor) {
        this.editor = editor;
        this.logger = Logger.parallax;
    }

    /**
     * Check if parallax mode is enabled
     */
    isParallaxEnabled() {
        return this.editor.stateManager.get('view.parallax') === true;
    }

    /**
     * Get parallax state from state manager
     */
    getParallaxState() {
        return this.editor.stateManager.get('parallax') || {};
    }

    /**
     * Get camera offset from start position
     */
    getCameraOffset(camera) {
        const parallaxState = this.getParallaxState();
        const startPosition = parallaxState.startPosition || { x: 0, y: 0 };
        const levelSettings = this.editor.level?.settings || {};
        const multiplierX = levelSettings.parallaxHorizontal ?? 1;
        const multiplierY = levelSettings.parallaxVertical ?? 1;

        return {
            x: (camera.x - startPosition.x) * multiplierX,
            y: (camera.y - startPosition.y) * multiplierY
        };
    }

    /**
     * Drawing shift for a layer so that after camera transform
     * screen ≈ (world − camera × (1 + parallaxOffset)) × zoom.
     *
     * Formula: shift = cameraOffset × parallaxOffset
     * - −0.8 → scroll 0.2 (far / slow)
     * - 0    → scroll 1.0 (no parallax)
     * - 0.5  → scroll 1.5 (near / fast)
     * - −1   → scroll 0   (screen-fixed UI)
     *
     * Do not use (1 + parallaxOffset) as the shift multiplier — that doubles
     * motion for any non-zero offset and jumps discontinuously vs offset 0.
     */
    getParallaxOffset(layer) {
        if (!layer) return { x: 0, y: 0 };

        const parallaxOffset = layer.parallaxOffset || 0;

        // Zero offset means no parallax effect
        if (parallaxOffset === 0) {
            return { x: 0, y: 0 };
        }

        const cameraOffset = this.getCameraOffset(this.editor.stateManager.get('camera'));

        return {
            x: cameraOffset.x * parallaxOffset,
            y: cameraOffset.y * parallaxOffset
        };
    }

    /**
     * Check if a layer participates in parallax
     */
    isLayerParallaxEnabled(layer) {
        if (!layer) return false;
        return (layer.parallaxOffset || 0) !== 0;
    }

    /**
     * Apply parallax transformation to object coordinates
     */
    applyParallaxToObject(obj, effectiveLayerId) {
        const layer = this.editor.level.getLayerById(effectiveLayerId);

        if (!this.isLayerParallaxEnabled(layer)) {
            // Layer doesn't participate in parallax, render normally
            return null;
        }

        const parallaxOffset = this.getParallaxOffset(layer);

        return {
            x: obj.x - parallaxOffset.x,
            y: obj.y - parallaxOffset.y
        };
    }

    /**
     * Render objects with parallax effect applied
     * @param {Array} visibleObjects
     * @param {Object} camera
     * @param {Level} level - level these objects belong to (defaults to current level;
     *   pass explicitly when called from RenderOperations.render()'s composited loop for
     *   a non-current visible session, so effective-layer/layer lookups resolve against
     *   the right level's own layer tree instead of the current level's)
     */
    renderParallaxObjects(visibleObjects, camera, level = this.editor.level) {
        // Caller decides whether parallax applies (global or per-view VP-HK flag).
        // Do not re-check view.parallax here — secondary leaves may override globally off.

        const cameraOffset = this.getCameraOffset(camera);

        visibleObjects.forEach(obj => {
            // Get object's effective layer
            const effectiveLayerId = this.editor.renderOperations.getEffectiveLayerId(obj, level);
            const layer = level.getLayerById(effectiveLayerId);

            if (!layer || !this.isLayerParallaxEnabled(layer)) {
                // Layer not found or doesn't participate in parallax, render normally
                this.editor.canvasRenderer.drawObject(obj);
                return;
            }

            // Calculate parallax offset for this layer
            const parallaxOffset = this.getParallaxOffset(layer);

            // Temporarily modify object position for rendering
            const originalX = obj.x;
            const originalY = obj.y;

            obj.x = originalX - parallaxOffset.x;
            obj.y = originalY - parallaxOffset.y;

            // Render object with parallax offset
            this.editor.canvasRenderer.drawObject(obj);

            // Restore original position
            obj.x = originalX;
            obj.y = originalY;
        });
    }

    /**
     * Convert screen coordinates to world coordinates considering parallax
     */
    screenToWorldWithParallax(screenX, screenY, camera, effectiveLayerId) {
        const layer = this.editor.level.getLayerById(effectiveLayerId);

        if (!this.isParallaxEnabled() || !this.isLayerParallaxEnabled(layer)) {
            // No parallax or layer doesn't participate, use normal conversion
            return this.editor.canvasRenderer.screenToWorld(screenX, screenY, camera);
        }

        // Get parallax offset for the layer
        const parallaxOffset = this.getParallaxOffset(layer);

        // Adjust screen coordinates by parallax offset before conversion
        const adjustedScreenX = screenX + parallaxOffset.x * camera.zoom;
        const adjustedScreenY = screenY + parallaxOffset.y * camera.zoom;

        return this.editor.canvasRenderer.screenToWorld(adjustedScreenX, adjustedScreenY, camera);
    }

    /**
     * Convert world coordinates to screen coordinates considering parallax
     */
    worldToScreenWithParallax(worldX, worldY, camera, effectiveLayerId) {
        const layer = this.editor.level.getLayerById(effectiveLayerId);

        if (!this.isParallaxEnabled() || !this.isLayerParallaxEnabled(layer)) {
            // No parallax or layer doesn't participate, use normal conversion
            return this.editor.canvasRenderer.worldToScreen(worldX, worldY, camera);
        }

        // Get parallax offset for the layer
        const parallaxOffset = this.getParallaxOffset(layer);

        // Adjust world coordinates by parallax offset before conversion
        const adjustedWorldX = worldX + parallaxOffset.x;
        const adjustedWorldY = worldY + parallaxOffset.y;

        return this.editor.canvasRenderer.worldToScreen(adjustedWorldX, adjustedWorldY, camera);
    }

    /**
     * Get effective world bounds for object considering parallax
     */
    getObjectWorldBoundsWithParallax(obj, effectiveLayerId) {
        const layer = this.editor.level.getLayerById(effectiveLayerId);

        if (!this.isParallaxEnabled() || !this.isLayerParallaxEnabled(layer)) {
            // No parallax or layer doesn't participate, use normal bounds
            return this.editor.objectOperations.getObjectWorldBounds(obj);
        }

        // Apply parallax transformation to bounds
        const parallaxOffset = this.getParallaxOffset(layer);
        const originalBounds = this.editor.objectOperations.getObjectWorldBounds(obj);

        if (!originalBounds) return null;

        return {
            minX: originalBounds.minX - parallaxOffset.x,
            minY: originalBounds.minY - parallaxOffset.y,
            maxX: originalBounds.maxX - parallaxOffset.x,
            maxY: originalBounds.maxY - parallaxOffset.y
        };
    }
}
