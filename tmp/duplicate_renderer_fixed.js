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
        console.log('DuplicateRenderer.drawPlacingObjects called with:', objects);
        if (!objects || objects.length === 0) {
            console.log('DuplicateRenderer: No objects to draw, returning');
            return;
        }
        
        console.log('DuplicateRenderer: Drawing', objects.length, 'objects');
        this.canvasRenderer.ctx.save();
        this.canvasRenderer.ctx.globalAlpha = 0.7;
        
        const draw = (obj, parentX = 0, parentY = 0) => {
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;
            console.log('DuplicateRenderer: Drawing object', obj.id, 'at', absX, absY, 'type:', obj.type);
            
            if (obj.type === 'group') {
                console.log('DuplicateRenderer: Drawing group children');
                // Draw group children
                if (obj.children && obj.children.length > 0) {
                    obj.children.forEach(child => draw(child, absX, absY));
                } else {
                    console.log('DuplicateRenderer: Group has no children, drawing as single object');
                    this.drawSingleObject(obj, absX, absY);
                }
            } else {
                console.log('DuplicateRenderer: Drawing single object');
                this.drawSingleObject(obj, absX, absY);
            }
        };
        
        objects.forEach(obj => draw(obj, 0, 0));
        
        this.canvasRenderer.ctx.restore();
        console.log('DuplicateRenderer: Finished drawing placing objects');
    }

    /**
     * Draw single object
     */
    drawSingleObject(obj, x, y) {
        console.log('DuplicateRenderer.drawSingleObject called:', obj.id, 'at', x, y, 'visible:', obj.visible);
        
        if (!obj.visible) {
            console.log('DuplicateRenderer: Object not visible, returning');
            return;
        }
        
        // Draw image if available
        if (obj.imgSrc) {
            console.log('DuplicateRenderer: Trying to draw image:', obj.imgSrc);
            const img = this.canvasRenderer.imageCache.get(obj.imgSrc);
            if (img && img.complete && img.naturalHeight !== 0) {
                console.log('DuplicateRenderer: Drawing image at', x, y, 'size:', obj.width, obj.height);
                this.canvasRenderer.ctx.drawImage(img, x, y, obj.width, obj.height);
                return;
            } else {
                console.log('DuplicateRenderer: Image not available or not loaded');
            }
        }
        
        // Draw colored rectangle as fallback
        console.log('DuplicateRenderer: Drawing colored rectangle at', x, y, 'size:', obj.width, obj.height, 'color:', obj.color);
        this.canvasRenderer.ctx.fillStyle = obj.color || '#cccccc';
        this.canvasRenderer.ctx.fillRect(x, y, obj.width, obj.height);
        
        // Draw border for locked objects
        if (obj.locked) {
            console.log('DuplicateRenderer: Drawing locked object border');
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

        console.log('DuplicateRenderer: Updating object positions to:', worldPos);
        console.log('DuplicateRenderer: Total objects to update:', objects.length);

        return objects.map((obj, index) => {
            // Берём сохранённое смещение, если есть
            const offsetX = obj._offsetX ?? 0;
            const offsetY = obj._offsetY ?? 0;

            const newX = worldPos.x + offsetX;
            const newY = worldPos.y + offsetY;

            console.log(`DuplicateRenderer: Object ${index}: ${obj.id}`);
            console.log(`  Offset: (${offsetX}, ${offsetY})`);
            console.log(`  New position: (${newX}, ${newY})`);

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

        console.log('DuplicateRenderer: Initializing object positions at:', worldPos);

        return objects.map((obj, index) => {
            // Сохраняем относительное смещение
            const offsetX = obj.x - worldPos.x;
            const offsetY = obj.y - worldPos.y;

            console.log(`DuplicateRenderer: Initialized object ${obj.id} offset: (${offsetX}, ${offsetY})`);

            return { ...obj, _offsetX: offsetX, _offsetY: offsetY };
        });
    }
}

// Standalone functions for easy integration
export const duplicateRenderUtils = {
    /**
     * Draw placing objects with debug info
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
