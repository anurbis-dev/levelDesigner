/**
 * Duplicate objects renderer
 * Handles rendering of duplicated objects during placement
 */

export class DuplicateRenderer {
    constructor(canvasRenderer) {
        this.canvasRenderer = canvasRenderer;
    }

    /**
     * Draw placing objects (preview)
     */
    drawPlacingObjects(objects, camera) {
        if (!objects || objects.length === 0) {
            return;
        }

        this.canvasRenderer.ctx.save();
        this.canvasRenderer.ctx.globalAlpha = 0.7;

        const draw = (obj, parentX = 0, parentY = 0) => {
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;

            if (obj.type === 'group') {
                // Draw group children
                if (obj.children && obj.children.length > 0) {
                    obj.children.forEach(child => draw(child, absX, absY));
                } else {
                    this.drawSingleObject(obj, absX, absY);
                }
            } else {
                this.drawSingleObject(obj, absX, absY);
            }
        };

        objects.forEach(obj => draw(obj, 0, 0));

        this.canvasRenderer.ctx.restore();
    }

    /**
     * Draw single object
     */
    drawSingleObject(obj, x, y) {
        if (!obj.visible) {
            return;
        }

        // Draw image if available
        if (obj.imgSrc) {
            const img = this.canvasRenderer.imageCache.get(obj.imgSrc);
            if (img && img.complete && img.naturalHeight !== 0) {
                this.canvasRenderer.ctx.drawImage(img, x, y, obj.width, obj.height);
                return;
            }
        }

        // Draw colored rectangle as fallback
        this.canvasRenderer.ctx.fillStyle = obj.color || '#cccccc';
        this.canvasRenderer.ctx.fillRect(x, y, obj.width, obj.height);

        // Draw border for locked objects
        if (obj.locked) {
            this.canvasRenderer.ctx.strokeStyle = '#ff6b6b';
            this.canvasRenderer.ctx.lineWidth = 2;
            this.canvasRenderer.ctx.strokeRect(x, y, obj.width, obj.height);
        }
    }

    /**
     * Draw group outline for placing preview
     */
    drawGroupOutline(bounds, camera) {
        this.canvasRenderer.ctx.save();
        this.canvasRenderer.ctx.strokeStyle = '#00ff00';
        this.canvasRenderer.ctx.lineWidth = 2 / camera.zoom;
        this.canvasRenderer.ctx.setLineDash([5, 5]);
        this.canvasRenderer.ctx.strokeRect(
            bounds.minX, bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        this.canvasRenderer.ctx.restore();
    }

    /**
     * Update object positions to follow mouse cursor
     */
    updateObjectPositions(objects, worldPos) {
        if (!objects || objects.length === 0) return objects;

        return objects.map((obj, index) => {
            // Use saved offsets to maintain relative positions
            const offsetX = obj._offsetX ?? 0;
            const offsetY = obj._offsetY ?? 0;

            // Calculate new position based on cursor position and saved offset
            const newX = worldPos.x + offsetX;
            const newY = worldPos.y + offsetY;

            return { ...obj, x: newX, y: newY };
        });
    }

    /**
     * Check if position has changed significantly
     */
    hasPositionChanged(firstObj, worldPos, threshold = 1) {
        if (!firstObj) return true;

        const expectedX = worldPos.x; // First object has no offset
        const expectedY = worldPos.y; // First object has no offset

        return Math.abs(firstObj.x - expectedX) >= threshold ||
               Math.abs(firstObj.y - expectedY) >= threshold;
    }

    /**
     * Initialize object positions for duplication
     */
    initializeObjectPositions(objects, worldPos) {
        if (!objects || objects.length === 0) return objects;

        return objects.map((obj, index) => {
            // Save relative offset from cursor position
            const offsetX = obj.x - worldPos.x;
            const offsetY = obj.y - worldPos.y;

            return { ...obj, _offsetX: offsetX, _offsetY: offsetY };
        });
    }
}

// Standalone functions for easy integration
export const duplicateRenderUtils = {
    /**
     * Draw placing objects
     */
    drawPlacingObjects: (canvasRenderer, objects, camera) => {
        const renderer = new DuplicateRenderer(canvasRenderer);
        return renderer.drawPlacingObjects(objects, camera);
    },

    /**
     * Update object positions
     */
    updatePositions: (objects, worldPos) => {
        const renderer = new DuplicateRenderer(null);
        return renderer.updateObjectPositions(objects, worldPos);
    },

    /**
     * Initialize positions
     */
    initializePositions: (objects, worldPos) => {
        const renderer = new DuplicateRenderer(null);
        return renderer.initializeObjectPositions(objects, worldPos);
    },

    /**
     * Check position change
     */
    hasPositionChanged: (firstObj, worldPos) => {
        const renderer = new DuplicateRenderer(null);
        return renderer.hasPositionChanged(firstObj, worldPos);
    }
};
