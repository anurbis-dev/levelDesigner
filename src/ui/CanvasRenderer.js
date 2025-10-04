import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { Logger } from '../utils/Logger.js';
import { RenderUtils } from '../utils/RenderUtils.js';
import { RectangularGridRenderer } from '../utils/gridRenderers/RectangularGridRenderer.js';
import { DiamondGridRenderer } from '../utils/gridRenderers/DiamondGridRenderer.js';
import { HexagonalGridRenderer } from '../utils/gridRenderers/HexagonalGridRenderer.js';

/**
 * Canvas rendering system
 */
export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.imageCache = new Map();

        // Initialize grid renderers
        this.gridRenderers = new Map();
        this.gridRenderers.set('rectangular', new RectangularGridRenderer());
        this.gridRenderers.set('diamond', new DiamondGridRenderer());
        this.gridRenderers.set('hexagonal', new HexagonalGridRenderer());
    }

    /**
     * Resize canvas to fit container
     */
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container) {
            console.warn('CanvasRenderer.resizeCanvas: No parent container found');
            return;
        }

        const rect = container.getBoundingClientRect();

        // Проверки на валидность размеров контейнера
        if (!rect.width || !rect.height || rect.width <= 0 || rect.height <= 0) {
            console.warn(`CanvasRenderer.resizeCanvas: Invalid container dimensions ${rect.width}x${rect.height}`);
            return;
        }

        // Set canvas size to container size (минимум 1 пиксель для избежания ошибок)
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));

        this.canvas.width = width;
        this.canvas.height = height;

        // Ensure canvas fills the container without scaling
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.style.display = 'block';
        this.canvas.style.objectFit = 'none'; // Prevent scaling

        Logger.canvas.debug(`Canvas resized to ${width}x${height}`);
    }

    /**
     * Clear canvas
     */
    clear() {
        // Проверки на валидность canvas
        if (!this.canvas || !this.ctx) {
            console.warn('CanvasRenderer.clear: Canvas or context not available');
            return;
        }

        if (!this.canvas.width || !this.canvas.height || this.canvas.width <= 0 || this.canvas.height <= 0) {
            console.warn(`CanvasRenderer.clear: Invalid canvas dimensions ${this.canvas.width}x${this.canvas.height}`);
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Set camera transform
     */
    setCamera(camera) {
        // Проверки на валидность camera
        if (!camera) {
            console.warn('CanvasRenderer.setCamera: Camera not provided');
            return;
        }

        if (!camera.zoom || camera.zoom <= 0 || !isFinite(camera.zoom)) {
            console.warn(`CanvasRenderer.setCamera: Invalid camera zoom ${camera.zoom}`);
            return;
        }

        if (!this.ctx) {
            console.warn('CanvasRenderer.setCamera: Context not available');
            return;
        }

        this.ctx.save();
        this.ctx.scale(camera.zoom, camera.zoom);
        this.ctx.translate(-camera.x, -camera.y);
    }

    /**
     * Restore camera transform
     */
    restoreCamera() {
        if (!this.ctx) {
            console.warn('CanvasRenderer.restoreCamera: Context not available');
            return;
        }

        this.ctx.restore();
    }

    /**
     * Draw grid with performance optimizations
     */
    drawGrid(gridSize, camera, backgroundColor = '#4B5563', options = {}) {
        const gridType = options.gridType || 'rectangular';
        const viewport = {
            width: this.canvas.width,
            height: this.canvas.height
        };

        // Add background color to options
        const gridOptions = {
            ...options,
            backgroundColor: backgroundColor
        };

        // Get the appropriate grid renderer
        const gridRenderer = this.gridRenderers.get(gridType);
        if (!gridRenderer) {
            console.warn(`Unknown grid type: ${gridType}, falling back to rectangular`);
            const fallbackRenderer = this.gridRenderers.get('rectangular');
            fallbackRenderer.render(this.ctx, gridSize, camera, viewport, gridOptions);
            return;
        }

        gridRenderer.render(this.ctx, gridSize, camera, viewport, gridOptions);
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
     * Draw axis constraint line
     */
    drawAxisConstraint(axis, startX, startY, camera, config) {
        if (!config.showAxis || !axis) return;
        
        this.ctx.save();
        
        this.ctx.strokeStyle = config.axisColor || '#cccccc';
        this.ctx.lineWidth = (config.axisWidth || 1) / camera.zoom;
        this.ctx.setLineDash([]);
        
        // Get canvas dimensions in world coordinates (after camera transform)
        const canvasWidth = this.canvas.width / camera.zoom;
        const canvasHeight = this.canvas.height / camera.zoom;
        
        if (axis === 'x') {
            // Draw horizontal line through start point, extending to visible area edges
            const y = startY;
            // After camera transform, we need to draw from camera position to camera position + canvas size
            const leftX = camera.x;
            const rightX = camera.x + canvasWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(leftX, y);
            this.ctx.lineTo(rightX, y);
            this.ctx.stroke();
        } else if (axis === 'y') {
            // Draw vertical line through start point, extending to visible area edges
            const x = startX;
            // After camera transform, we need to draw from camera position to camera position + canvas size
            const topY = camera.y;
            const bottomY = camera.y + canvasHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(x, topY);
            this.ctx.lineTo(x, bottomY);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
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

    /**
     * Clear grid caches (call when grid settings change)
     */
    clearGridCaches() {
        this.gridRenderers.forEach(renderer => {
            if (renderer.clearCache) {
                renderer.clearCache();
            }
        });
    }

    /**
     * Get grid cache statistics for debugging
     */
    getGridCacheStats() {
        const stats = {};
        this.gridRenderers.forEach((renderer, type) => {
            if (renderer.getCacheStats) {
                stats[type] = renderer.getCacheStats();
            }
        });
        return stats;
    }
    
    /**
     * Cleanup and destroy renderer
     */
    destroy() {
        Logger.ui.debug('Destroying CanvasRenderer');
        
        // Clear image cache
        this.imageCache.clear();
        
        // Clear grid renderers
        this.gridRenderers.clear();
        
        // Clear canvas
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Clear references
        this.canvas = null;
        this.ctx = null;
        
        Logger.ui.debug('CanvasRenderer destroyed');
    }
}
