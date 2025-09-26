/**
 * Utility class for common rendering operations
 * Eliminates rendering code duplication and provides consistent drawing methods
 */
export class RenderUtils {
    /**
     * Predefined render styles
     */
    static STYLES = {
        selection: {
            color: '#3B82F6',
            width: 2,
            dashPattern: []
        },
        groupSelection: {
            color: '#3B82F6', 
            width: 4,
            dashPattern: [5, 5]
        },
        altDrag: {
            color: '#FF6B6B',
            width: 3,
            dashPattern: [8, 4]
        },
        groupFrame: {
            color: '#FF6B6B',
            width: 3,
            dashPattern: [10, 5]
        },
        highlight: {
            color: '#4CAF50',
            width: 2,
            dashPattern: [3, 3]
        },
        error: {
            color: '#F44336',
            width: 2,
            dashPattern: [2, 2]
        }
    };

    /**
     * Draw a rectangle with specified style
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} bounds - Rectangle bounds {minX, minY, maxX, maxY}
     * @param {Object} options - Drawing options
     * @param {string} options.color - Stroke color (default: '#3B82F6')
     * @param {number} options.width - Line width (default: 2)
     * @param {Array} options.dashPattern - Line dash pattern (default: [])
     * @param {string} options.fillColor - Fill color (optional)
     * @param {number} options.fillAlpha - Fill opacity 0-1 (default: 0.2)
     * @param {number} options.zoomFactor - Zoom factor to adjust line width (default: 1)
     */
    static drawRect(ctx, bounds, options = {}) {
        const {
            color = '#3B82F6',
            width = 2,
            dashPattern = [],
            fillColor = null,
            fillAlpha = 0.2,
            zoomFactor = 1
        } = options;

        ctx.save();

        // Calculate dimensions
        const rectWidth = bounds.maxX - bounds.minX;
        const rectHeight = bounds.maxY - bounds.minY;

        // Fill if requested
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.globalAlpha = fillAlpha;
            ctx.fillRect(bounds.minX, bounds.minY, rectWidth, rectHeight);
            ctx.globalAlpha = 1.0;
        }

        // Stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = width / zoomFactor;
        ctx.setLineDash(dashPattern);
        ctx.strokeRect(bounds.minX, bounds.minY, rectWidth, rectHeight);

        ctx.restore();
    }

    /**
     * Draw selection rectangle with predefined style
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} bounds - Rectangle bounds
     * @param {string} style - Style name from STYLES
     * @param {number} zoomFactor - Zoom factor for line width adjustment
     */
    static drawSelectionRect(ctx, bounds, style = 'selection', zoomFactor = 1) {
        const styleConfig = this.STYLES[style] || this.STYLES.selection;
        this.drawRect(ctx, bounds, {
            ...styleConfig,
            zoomFactor
        });
    }

    /**
     * Draw selection rectangle for groups
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} bounds - Rectangle bounds
     * @param {boolean} isGroup - Whether this is a group selection
     * @param {number} zoomFactor - Zoom factor
     */
    static drawObjectSelection(ctx, bounds, isGroup = false, zoomFactor = 1) {
        const style = isGroup ? 'groupSelection' : 'selection';
        this.drawSelectionRect(ctx, bounds, style, zoomFactor);
    }

    /**
     * Draw Alt+drag selection rectangle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} bounds - Rectangle bounds
     * @param {number} zoomFactor - Zoom factor
     */
    static drawAltDragRect(ctx, bounds, zoomFactor = 1) {
        this.drawSelectionRect(ctx, bounds, 'altDrag', zoomFactor);
    }

    /**
     * Draw group edit frame with padding
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} bounds - Group bounds
     * @param {number} padding - Padding around group (default: 10)
     * @param {number} zoomFactor - Zoom factor
     */
    static drawGroupFrame(ctx, bounds, padding = 10, zoomFactor = 1) {
        const paddedBounds = {
            minX: bounds.minX - padding,
            minY: bounds.minY - padding,
            maxX: bounds.maxX + padding,
            maxY: bounds.maxY + padding
        };

        this.drawSelectionRect(ctx, paddedBounds, 'groupFrame', zoomFactor);
    }

    /**
     * Draw marquee selection rectangle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} marqueeRect - Marquee rectangle {x, y, width, height}
     * @param {number} zoomFactor - Zoom factor
     */
    static drawMarquee(ctx, marqueeRect, zoomFactor = 1) {
        if (!marqueeRect) return;

        const bounds = {
            minX: marqueeRect.x,
            minY: marqueeRect.y,
            maxX: marqueeRect.x + marqueeRect.width,
            maxY: marqueeRect.y + marqueeRect.height
        };

        this.drawRect(ctx, bounds, {
            color: 'rgba(59, 130, 246, 0.8)',
            width: 1,
            fillColor: 'rgba(59, 130, 246, 0.2)',
            fillAlpha: 1,
            zoomFactor
        });
    }

    /**
     * Draw hierarchy highlight for nested groups
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} bounds - Group bounds
     * @param {number} depth - Nesting depth
     * @param {string} baseColor - Base color (default: '#3B82F6')
     * @param {number} maxAlpha - Maximum alpha (default: 0.25)
     * @param {number} decay - Alpha decay per depth (default: 0.6)
     */
    static drawHierarchyHighlight(ctx, bounds, depth = 0, baseColor = '#3B82F6', maxAlpha = 0.25, decay = 0.6) {
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));
        if (alpha <= 0) return;

        const fillColor = this.hexToRgba(baseColor, alpha);
        
        this.drawRect(ctx, bounds, {
            fillColor,
            fillAlpha: 1,
            color: 'transparent'
        });
    }

    /**
     * Convert hex color to rgba
     * @param {string} hex - Hex color (e.g., '#3B82F6')
     * @param {number} alpha - Alpha value 0-1
     * @returns {string} RGBA color string
     */
    static hexToRgba(hex, alpha = 1) {
        const normalized = hex.replace('#', '');
        const expanded = normalized.length === 3
            ? normalized.split('').map(c => c + c).join('')
            : normalized;
        
        const bigint = parseInt(expanded, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Convert rgba color to hex for display in color inputs
     * @param {string} rgbaColor - RGBA color string (e.g., 'rgba(255, 255, 255, 0.1)')
     * @returns {string} Hex color string (e.g., '#ffffff')
     */
    static rgbaToHex(rgbaColor) {
        if (!rgbaColor || !rgbaColor.startsWith('rgba')) {
            return rgbaColor || '#ffffff';
        }
        
        const match = rgbaColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) {
            return '#ffffff';
        }
        
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }


    /**
     * Draw text with background
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} text - Text to draw
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Text options
     */
    static drawTextWithBackground(ctx, text, x, y, options = {}) {
        const {
            font = '12px Arial',
            textColor = '#ffffff',
            backgroundColor = 'rgba(0, 0, 0, 0.7)',
            padding = 4,
            borderRadius = 4
        } = options;

        ctx.save();
        ctx.font = font;

        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = 12; // Approximate font height

        const bgX = x - padding;
        const bgY = y - textHeight - padding;
        const bgWidth = textWidth + padding * 2;
        const bgHeight = textHeight + padding * 2;

        // Draw background
        ctx.fillStyle = backgroundColor;
        if (borderRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
            ctx.fill();
        } else {
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        }

        // Draw text
        ctx.fillStyle = textColor;
        ctx.fillText(text, x, y);

        ctx.restore();
    }

    /**
     * Create a render style configuration
     * @param {string} color - Color
     * @param {number} width - Line width
     * @param {Array} dashPattern - Dash pattern
     * @returns {Object} Style configuration
     */
    static createStyle(color, width = 2, dashPattern = []) {
        return { color, width, dashPattern };
    }

    /**
     * Register custom render style
     * @param {string} name - Style name
     * @param {Object} config - Style configuration
     */
    static registerStyle(name, config) {
        this.STYLES[name] = { ...config };
    }

    /**
     * Apply canvas transformation for camera
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} camera - Camera object {x, y, zoom}
     */
    static applyCameraTransform(ctx, camera) {
        ctx.save();
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);
    }

    /**
     * Restore canvas transformation
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    static restoreCameraTransform(ctx) {
        ctx.restore();
    }
}
