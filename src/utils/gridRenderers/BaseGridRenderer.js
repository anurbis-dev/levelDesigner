import { ColorUtils } from '../ColorUtils.js';

/**
 * Base class for all grid renderers
 * Provides common functionality and interface
 */
export class BaseGridRenderer {
    /**
     * Render grid method - to be implemented by subclasses
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} gridSize - Size of grid cells
     * @param {Object} camera - Camera object {x, y, zoom}
     * @param {Object} viewport - Viewport dimensions {width, height}
     * @param {Object} options - Grid options
     */
    render(ctx, gridSize, camera, viewport, options = {}) {
        throw new Error('render() method must be implemented by subclass');
    }

    /**
     * Apply camera transformation to context (legacy method, camera is now handled by CanvasRenderer)
     * @deprecated Camera transformation is now handled at CanvasRenderer level
     */
    applyCameraTransform(ctx, camera, viewport) {
        // Camera is already applied by CanvasRenderer.setCamera()
        // This method is kept for compatibility but does nothing
        return ctx;
    }

    /**
     * Restore camera transformation (legacy method)
     * @deprecated Camera restoration is now handled by CanvasRenderer
     */
    restoreCameraTransform(ctx) {
        // Camera restoration is handled by CanvasRenderer.restoreCamera()
        // This method is kept for compatibility but does nothing
    }

    /**
     * Check if grid should be rendered based on zoom level
     * @param {number} gridSize - Size of grid cells
     * @param {Object} camera - Camera object {x, y, zoom}
     * @param {number} minGridSize - Minimum grid size in pixels to render
     * @returns {boolean} - True if grid should be rendered
     */
    shouldRenderGrid(gridSize, camera, minGridSize = 5) {
        return gridSize * camera.zoom >= minGridSize;
    }

    /**
     * Calculate viewport bounds in world coordinates
     * @param {Object} camera - Camera object {x, y, zoom}
     * @param {Object} viewport - Viewport dimensions {width, height}
     * @returns {Object} - Viewport bounds {left, top, right, bottom}
     */
    calculateViewportBounds(camera, viewport) {
        return {
            left: camera.x,
            top: camera.y,
            right: camera.x + viewport.width / camera.zoom,
            bottom: camera.y + viewport.height / camera.zoom
        };
    }

    /**
     * Set grid line style for rendering
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} color - Grid line color
     * @param {number} thickness - Grid line thickness
     * @param {number} opacity - Grid line opacity
     * @param {Object} camera - Camera object {x, y, zoom}
     */
    setGridStyle(ctx, color, thickness, opacity, camera) {
        if (color.startsWith('rgba')) {
            const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
            if (rgbaMatch) {
                const [, r, g, b] = rgbaMatch;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            } else {
                ctx.strokeStyle = color;
            }
        } else {
            ctx.strokeStyle = this.colorToRgba(color, opacity);
        }
        ctx.lineWidth = thickness / camera.zoom;
    }

    /**
     * Convert hex color to rgba
     * @param {string} hexColor - Hex color string
     * @param {number} alpha - Alpha value (0-1)
     * @returns {string} RGBA color string
     */
    colorToRgba(color, alpha = 1) {
        return ColorUtils.toRgba(color, alpha);
    }
}
