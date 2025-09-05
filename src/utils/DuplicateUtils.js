/**
 * Duplicate objects utilities
 * Handles rendering and positioning of duplicated objects during placement
 * @version dynamic - Utility Architecture
 */

import { Logger } from './Logger.js';

export class DuplicateUtils {
    /**
     * Draw placing objects (preview)
     */
    static drawPlacingObjects(canvasRenderer, objects, camera) {
        Logger.canvas.debug('DuplicateUtils.drawPlacingObjects called with:', objects);
        if (!objects || objects.length === 0) {
            Logger.canvas.debug('No objects to draw, returning');
            return;
        }

        Logger.canvas.debug('Drawing', objects.length, 'objects');
        
        canvasRenderer.ctx.save();
        canvasRenderer.ctx.globalAlpha = 0.7;

        const draw = (obj, parentX = 0, parentY = 0) => {
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;

            // Calculate expected screen coordinates
            const screenX = (absX - camera.x) * camera.zoom;
            const screenY = (absY - camera.y) * camera.zoom;

            Logger.canvas.debug(`Drawing object ${obj.id} at world coords (${absX}, ${absY}), screen coords (${screenX}, ${screenY}), type=${obj.type}`);

            if (obj.type === 'group') {
                // Draw group children
                if (obj.children && obj.children.length > 0) {
                    Logger.canvas.debug(`Group ${obj.id} has ${obj.children.length} children`);
                    obj.children.forEach(child => draw(child, absX, absY));
                } else {
                    Logger.canvas.debug(`Group ${obj.id} has no children, drawing as single`);
                    this.drawSingleObject(canvasRenderer, obj, screenX, screenY);
                }
            } else {
                this.drawSingleObject(canvasRenderer, obj, screenX, screenY);
            }
        };

        objects.forEach(obj => draw(obj, 0, 0));

        canvasRenderer.ctx.restore();
        Logger.canvas.debug('Finished drawing placing objects');
    }

    /**
     * Draw single object
     */
    static drawSingleObject(canvasRenderer, obj, x, y) {
        Logger.canvas.debug(`Drawing single object ${obj.id} at (${x}, ${y}), visible=${obj.visible}`);

        if (!obj.visible) {
            Logger.canvas.debug(`Object ${obj.id} not visible, skipping`);
            return;
        }

        // Draw image if available
        if (obj.imgSrc) {
            Logger.canvas.debug(`Object ${obj.id} has imgSrc: ${obj.imgSrc}`);
            const img = canvasRenderer.imageCache.get(obj.imgSrc);
            if (img && img.complete && img.naturalHeight !== 0) {
                Logger.canvas.debug(`Drawing image for ${obj.id} at (${x}, ${y})`);
                canvasRenderer.ctx.drawImage(img, x, y, obj.width, obj.height);
                return;
            } else {
                Logger.canvas.debug(`Image not available for ${obj.id}`);
            }
        }

        // Draw colored rectangle as fallback
        Logger.canvas.debug(`Drawing rectangle for ${obj.id} at (${x}, ${y}), color=${obj.color}, size=${obj.width}x${obj.height}`);
        canvasRenderer.ctx.fillStyle = obj.color || '#cccccc';
        canvasRenderer.ctx.fillRect(x, y, obj.width, obj.height);

        // Draw border for locked objects
        if (obj.locked) {
            Logger.canvas.debug(`Drawing border for locked object ${obj.id}`);
            canvasRenderer.ctx.strokeStyle = '#ff6b6b';
            canvasRenderer.ctx.lineWidth = 2;
            canvasRenderer.ctx.strokeRect(x, y, obj.width, obj.height);
        }

        Logger.canvas.debug(`Finished drawing ${obj.id}`);
    }

    /**
     * Update object positions to follow mouse cursor
     */
    static updatePositions(objects, worldPos) {
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
     * Initialize object positions for duplication
     */
    static initializePositions(objects, worldPos) {
        if (!objects || objects.length === 0) return objects;

        return objects.map((obj, index) => {
            // Save relative offset from cursor position
            const offsetX = obj.x - worldPos.x;
            const offsetY = obj.y - worldPos.y;

            return { ...obj, _offsetX: offsetX, _offsetY: offsetY };
        });
    }

    /**
     * Check if position has changed significantly
     */
    static hasPositionChanged(firstObj, worldPos, threshold = 1) {
        if (!firstObj) return true;

        const expectedX = worldPos.x; // First object has no offset
        const expectedY = worldPos.y; // First object has no offset

        return Math.abs(firstObj.x - expectedX) >= threshold ||
               Math.abs(firstObj.y - expectedY) >= threshold;
    }

    /**
     * Draw group outline for placing preview
     */
    static drawGroupOutline(canvasRenderer, bounds, camera) {
        canvasRenderer.ctx.save();
        canvasRenderer.ctx.strokeStyle = '#00ff00';
        canvasRenderer.ctx.lineWidth = 2 / camera.zoom;
        canvasRenderer.ctx.setLineDash([5, 5]);
        canvasRenderer.ctx.strokeRect(
            bounds.minX, bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        canvasRenderer.ctx.restore();
    }
}

// Legacy compatibility: Export the same interface as duplicateRenderUtils
export const duplicateRenderUtils = {
    /**
     * Draw placing objects
     */
    drawPlacingObjects: (canvasRenderer, objects, camera) => {
        return DuplicateUtils.drawPlacingObjects(canvasRenderer, objects, camera);
    },

    /**
     * Update object positions
     */
    updatePositions: (objects, worldPos) => {
        return DuplicateUtils.updatePositions(objects, worldPos);
    },

    /**
     * Initialize positions
     */
    initializePositions: (objects, worldPos) => {
        return DuplicateUtils.initializePositions(objects, worldPos);
    },

    /**
     * Check position change
     */
    hasPositionChanged: (firstObj, worldPos) => {
        return DuplicateUtils.hasPositionChanged(firstObj, worldPos);
    }
};
