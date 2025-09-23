/**
 * Parallax Renderer
 * Handles all parallax-related rendering operations
 */

import { Logger } from './Logger.js';

export class ParallaxRenderer {
    constructor(editor) {
        this.editor = editor;
        this.logger = Logger.parallax || {
            info: console.log,
            debug: console.debug,
            warn: console.warn,
            error: console.error
        };
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

        return {
            x: camera.x - startPosition.x,
            y: camera.y - startPosition.y
        };
    }

    /**
     * Calculate parallax offset for a layer
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
            x: cameraOffset.x * (1 + parallaxOffset),
            y: cameraOffset.y * (1 + parallaxOffset)
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
     */
    renderParallaxObjects(visibleObjects, camera) {
        if (!this.isParallaxEnabled()) {
            // Fallback to normal rendering
            visibleObjects.forEach(obj => {
                this.editor.canvasRenderer.drawObject(obj);
            });
            return;
        }

        const cameraOffset = this.getCameraOffset(camera);

        visibleObjects.forEach(obj => {
            // Get object's effective layer
            const effectiveLayerId = this.editor.renderOperations.getEffectiveLayerId(obj);
            const layer = this.editor.level.getLayerById(effectiveLayerId);

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
