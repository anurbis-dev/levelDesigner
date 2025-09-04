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
            console.log('DUPLICATE RENDERER: No objects to draw');
            return;
        }

        console.log('DUPLICATE RENDERER: Drawing', objects.length, 'objects');
        console.log('DUPLICATE RENDERER: Camera:', { x: camera.x, y: camera.y, zoom: camera.zoom });
        console.log('DUPLICATE RENDERER: Canvas size:', {
            width: this.canvasRenderer.canvas.width,
            height: this.canvasRenderer.canvas.height
        });
        objects.forEach((obj, i) => {
            console.log(`DUPLICATE RENDERER: Object ${i}: id=${obj.id}, x=${obj.x}, y=${obj.y}, visible=${obj.visible}, type=${obj.type}`);
        });

        // Camera transform is already applied by main renderer, just set alpha and draw in world coordinates
        this.canvasRenderer.ctx.save();
        this.canvasRenderer.ctx.globalAlpha = 0.7;

        const draw = (obj, parentX = 0, parentY = 0) => {
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;

            // Calculate expected screen coordinates
            const screenX = (absX - camera.x) * camera.zoom;
            const screenY = (absY - camera.y) * camera.zoom;

            console.log(`DUPLICATE RENDERER: Drawing object ${obj.id} at world coords (${absX}, ${absY}), screen coords (${screenX}, ${screenY}), type=${obj.type}, visible=${obj.visible}`);
            console.log(`DUPLICATE RENDERER: Canvas viewport check: screenX=${screenX} < canvas.width=${this.canvasRenderer.canvas.width}, screenY=${screenY} < canvas.height=${this.canvasRenderer.canvas.height}`);

            if (obj.type === 'group') {
                // Draw group children
                if (obj.children && obj.children.length > 0) {
                    console.log(`DUPLICATE RENDERER: Group ${obj.id} has ${obj.children.length} children`);
                    obj.children.forEach(child => draw(child, absX, absY));
                } else {
                    console.log(`DUPLICATE RENDERER: Group ${obj.id} has no children, drawing as single`);
                    this.drawSingleObject(obj, screenX, screenY);
                }
            } else {
                this.drawSingleObject(obj, screenX, screenY);
            }
        };

        objects.forEach(obj => draw(obj, 0, 0));

        this.canvasRenderer.ctx.restore();
        console.log('DUPLICATE RENDERER: Finished drawing placing objects');
    }

    /**
     * Draw single object
     */
    drawSingleObject(obj, x, y) {
        console.log(`DUPLICATE RENDERER: drawSingleObject called for ${obj.id} at (${x}, ${y}), visible=${obj.visible}`);

        if (!obj.visible) {
            console.log(`DUPLICATE RENDERER: Object ${obj.id} not visible, skipping`);
            return;
        }

        // Draw image if available
        if (obj.imgSrc) {
            console.log(`DUPLICATE RENDERER: Object ${obj.id} has imgSrc: ${obj.imgSrc}`);
            const img = this.canvasRenderer.imageCache.get(obj.imgSrc);
            if (img && img.complete && img.naturalHeight !== 0) {
                console.log(`DUPLICATE RENDERER: Drawing image for ${obj.id} at (${x}, ${y})`);
                this.canvasRenderer.ctx.drawImage(img, x, y, obj.width, obj.height);
                return;
            } else {
                console.log(`DUPLICATE RENDERER: Image not available for ${obj.id}`);
            }
        }

        // Draw colored rectangle as fallback
        console.log(`DUPLICATE RENDERER: Drawing rectangle for ${obj.id} at (${x}, ${y}), color=${obj.color}, size=${obj.width}x${obj.height}`);
        this.canvasRenderer.ctx.fillStyle = obj.color || '#cccccc';
        this.canvasRenderer.ctx.fillRect(x, y, obj.width, obj.height);

        // Draw border for locked objects
        if (obj.locked) {
            console.log(`DUPLICATE RENDERER: Drawing border for locked object ${obj.id}`);
            this.canvasRenderer.ctx.strokeStyle = '#ff6b6b';
            this.canvasRenderer.ctx.lineWidth = 2;
            this.canvasRenderer.ctx.strokeRect(x, y, obj.width, obj.height);
        }

        console.log(`DUPLICATE RENDERER: Finished drawing ${obj.id}`);
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
