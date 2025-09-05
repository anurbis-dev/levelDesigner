import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { Logger } from '../utils/Logger.js';

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
        const rect = container.getBoundingClientRect();
        
        // Set canvas size to container size
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Ensure canvas fills the container without scaling
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.canvas.style.display = 'block';
        this.canvas.style.objectFit = 'none'; // Prevent scaling
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
     * Draw grid with performance optimizations
     */
    drawGrid(gridSize, camera, backgroundColor = '#4B5563') {
        this.ctx.save();
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Skip grid drawing if zoomed out too much (performance optimization)
        const minGridSize = 5; // Minimum grid size in pixels
        if (gridSize * camera.zoom < minGridSize) {
            this.ctx.restore();
            return;
        }
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1 / camera.zoom;
        
        const scaledGridSize = gridSize;
        const startX = camera.x - (camera.x % gridSize);
        const startY = camera.y - (camera.y % gridSize);
        const endX = camera.x + this.canvas.width / camera.zoom;
        const endY = camera.y + this.canvas.height / camera.zoom;
        
        // Limit number of grid lines for performance
        const maxLines = 200;
        const totalVerticalLines = Math.floor((endX - startX) / scaledGridSize);
        const totalHorizontalLines = Math.floor((endY - startY) / scaledGridSize);
        
        // Draw vertical lines
        if (totalVerticalLines <= maxLines) {
            for (let x = startX; x < endX; x += scaledGridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, startY);
                this.ctx.lineTo(x, endY);
                this.ctx.stroke();
            }
        }
        
        // Draw horizontal lines
        if (totalHorizontalLines <= maxLines) {
            for (let y = startY; y < endY; y += scaledGridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(startX, y);
                this.ctx.lineTo(endX, y);
                this.ctx.stroke();
            }
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
        if (!obj.visible) {
            return;
        }
        
        // Draw image if available
        if (obj.imgSrc) {
            const img = this.imageCache.get(obj.imgSrc);
            if (img && img.complete && img.naturalHeight !== 0) {
                this.ctx.drawImage(img, x, y, obj.width, obj.height);
                return;
            }
        }
        
        // Draw colored rectangle as fallback
        this.ctx.fillStyle = obj.color || '#cccccc';
        this.ctx.fillRect(x, y, obj.width, obj.height);
        
        // Draw border for locked objects
        if (obj.locked) {
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
        Logger.canvas.debug('drawPlacingObjects called with:', objects);
        if (!objects || objects.length === 0) {
            Logger.canvas.debug('No objects to draw, returning');
            return;
        }
        
        Logger.canvas.debug('Drawing', objects.length, 'objects');
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        
        const draw = (obj, parentX = 0, parentY = 0) => {
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;
            Logger.canvas.debug('Drawing object', obj.id, 'at', absX, absY, 'type:', obj.type);
            
            if (obj.type === 'group') {
                Logger.canvas.debug('Drawing group children');
                // Draw group children
                if (obj.children && obj.children.length > 0) {
                    obj.children.forEach(child => draw(child, absX, absY));
                } else {
                    Logger.canvas.debug('Group has no children, drawing as single object');
                    this.drawSingleObject(obj, absX, absY);
                }
            } else {
                Logger.canvas.debug('Drawing single object');
                this.drawSingleObject(obj, absX, absY);
            }
        };
        
        objects.forEach(obj => draw(obj, 0, 0));
        
        this.ctx.restore();
        Logger.canvas.debug('Finished drawing placing objects');
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
