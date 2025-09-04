/**
 * Canvas rendering system
 */
export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.imageCache = new Map();
    }

    /**
     * Resize canvas to fit container
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Set camera transform
     */
    setCamera(camera) {
        this.ctx.save();
        this.ctx.scale(camera.zoom, camera.zoom);
        this.ctx.translate(-camera.x, -camera.y);
    }

    /**
     * Restore camera transform
     */
    restoreCamera() {
        this.ctx.restore();
    }

    /**
     * Draw grid
     */
    drawGrid(gridSize, camera, backgroundColor = '#4B5563') {
        this.ctx.save();
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1 / camera.zoom;
        
        const scaledGridSize = gridSize;
        const startX = camera.x - (camera.x % gridSize);
        const startY = camera.y - (camera.y % gridSize);
        const endX = camera.x + this.canvas.width / camera.zoom;
        const endY = camera.y + this.canvas.height / camera.zoom;
        
        // Draw vertical lines
        for (let x = startX; x < endX; x += scaledGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = startY; y < endY; y += scaledGridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    /**
     * Draw object
     */
    drawObject(obj, parentX = 0, parentY = 0) {
        const absX = obj.x + parentX;
        const absY = obj.y + parentY;
        
        if (obj.type === 'group') {
            this.drawGroup(obj, absX, absY);
        } else {
            this.drawSingleObject(obj, absX, absY);
        }
    }

    /**
     * Draw single object
     */
    drawSingleObject(obj, x, y) {
        console.log('CanvasRenderer.drawSingleObject called:', obj.id, 'at', x, y, 'visible:', obj.visible);
        
        if (!obj.visible) {
            console.log('CanvasRenderer: Object not visible, returning');
            return;
        }
        
        // Draw image if available
        if (obj.imgSrc) {
            console.log('CanvasRenderer: Trying to draw image:', obj.imgSrc);
            const img = this.imageCache.get(obj.imgSrc);
            if (img && img.complete && img.naturalHeight !== 0) {
                console.log('CanvasRenderer: Drawing image at', x, y, 'size:', obj.width, obj.height);
                this.ctx.drawImage(img, x, y, obj.width, obj.height);
                return;
            } else {
                console.log('CanvasRenderer: Image not available or not loaded');
            }
        }
        
        // Draw colored rectangle as fallback
        console.log('CanvasRenderer: Drawing colored rectangle at', x, y, 'size:', obj.width, obj.height, 'color:', obj.color);
        this.ctx.fillStyle = obj.color || '#cccccc';
        this.ctx.fillRect(x, y, obj.width, obj.height);
        
        // Draw border for locked objects
        if (obj.locked) {
            console.log('CanvasRenderer: Drawing locked object border');
            this.ctx.strokeStyle = '#ff6b6b';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, obj.width, obj.height);
        }
    }

    /**
     * Draw group - recursively draw children with proper coordinates
     */
    drawGroup(group, x, y) {
        if (!group.visible) return;
        
        // Draw children with group as parent coordinates
        group.children.forEach(child => {
            this.drawObject(child, x, y);
        });
    }



    /**
     * Draw marquee selection
     */
    drawMarquee(marqueeRect, camera) {
        if (!marqueeRect) return;
        
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        this.ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);
        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        this.ctx.lineWidth = 1 / camera.zoom;
        this.ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);
        this.ctx.restore();
    }

    /**
     * Draw placing objects (preview)
     */
    drawPlacingObjects(objects, camera) {
        console.log('CanvasRenderer.drawPlacingObjects called with:', objects);
        if (!objects || objects.length === 0) {
            console.log('CanvasRenderer: No objects to draw, returning');
            return;
        }
        
        console.log('CanvasRenderer: Drawing', objects.length, 'objects');
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        
        const draw = (obj, parentX = 0, parentY = 0) => {
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;
            console.log('CanvasRenderer: Drawing object', obj.id, 'at', absX, absY, 'type:', obj.type);
            
            if (obj.type === 'group') {
                console.log('CanvasRenderer: Drawing group children');
                // Draw group children
                if (obj.children && obj.children.length > 0) {
                    obj.children.forEach(child => draw(child, absX, absY));
                } else {
                    console.log('CanvasRenderer: Group has no children, drawing as single object');
                    this.drawSingleObject(obj, absX, absY);
                }
            } else {
                console.log('CanvasRenderer: Drawing single object');
                this.drawSingleObject(obj, absX, absY);
            }
        };
        
        objects.forEach(obj => draw(obj, 0, 0));
        
        this.ctx.restore();
        console.log('CanvasRenderer: Finished drawing placing objects');
    }

    /**
     * Get object world bounds
     */
    getObjectBounds(obj) {
        if (obj.type === 'group') {
            return this.getGroupBounds(obj);
        } else {
            return {
                minX: obj.x,
                minY: obj.y,
                maxX: obj.x + obj.width,
                maxY: obj.y + obj.height
            };
        }
    }

    /**
     * Get group bounds including all children
     */
    getGroupBounds(group) {
        if (group.children.length === 0) {
            return {
                minX: group.x,
                minY: group.y,
                maxX: group.x,
                maxY: group.y
            };
        }

        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        
        group.children.forEach(child => {
            const worldX = group.x + child.x;
            const worldY = group.y + child.y;
            
            if (child.type === 'group') {
                // Recursively get bounds for nested groups
                const childGroup = {...child, x: worldX, y: worldY};
                const childBounds = this.getGroupBounds(childGroup);
                bounds.minX = Math.min(bounds.minX, childBounds.minX);
                bounds.minY = Math.min(bounds.minY, childBounds.minY);
                bounds.maxX = Math.max(bounds.maxX, childBounds.maxX);
                bounds.maxY = Math.max(bounds.maxY, childBounds.maxY);
            } else {
                bounds.minX = Math.min(bounds.minX, worldX);
                bounds.minY = Math.min(bounds.minY, worldY);
                bounds.maxX = Math.max(bounds.maxX, worldX + child.width);
                bounds.maxY = Math.max(bounds.maxY, worldY + child.height);
            }
        });
        
        return bounds;
    }

    /**
     * Cache image
     */
    cacheImage(src, img) {
        this.imageCache.set(src, img);
    }

    /**
     * Get cached image
     */
    getCachedImage(src) {
        return this.imageCache.get(src);
    }

    /**
     * Screen to world coordinates
     */
    screenToWorld(screenX, screenY, camera) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (screenX - rect.left) / camera.zoom + camera.x,
            y: (screenY - rect.top) / camera.zoom + camera.y
        };
    }

    /**
     * World to screen coordinates
     */
    worldToScreen(worldX, worldY, camera) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (worldX - camera.x) * camera.zoom + rect.left,
            y: (worldY - camera.y) * camera.zoom + rect.top
        };
    }
}
