import { BaseGridRenderer } from './BaseGridRenderer.js';

export class HexagonalGridRenderer extends BaseGridRenderer {
    constructor() {
        super();
        
        // Simple caching for performance
        this.gridCache = new Map(); // Cache for different grid configurations
        this.lastCacheKey = null;
        this.cacheTimeout = 100; // Cache timeout in ms
        this.lastCacheTime = 0;
        this.maxCacheSize = 20; // Reduced cache size
        
        // Performance limits - disable grid when too dense
        this.maxHexagonsThreshold = 4500; // Disable grid when more than 4500 hexagons
    }

    render(ctx, gridSize, camera, viewport, options = {}) {
        ctx.save();

        // Fill background
        if (options.backgroundColor) {
            ctx.fillStyle = options.backgroundColor;
            ctx.fillRect(0, 0, viewport.width, viewport.height);
        }

        // Skip rendering if grid is too small
        if (!this.shouldRenderGrid(gridSize, camera)) {
            ctx.restore();
            return;
        }

        // Debug: Log first render after restart (only once)
        // if (!this.lastCacheTime) {
        //     console.log('🔧 HexagonalGridRenderer: First render after restart');
        // }

        // Performance check - skip frames if overloaded (only after first render)
        // Disabled to prevent flickering - LOD system handles performance
        // if (this.lastCacheTime > 0) {
        //     this.skipFrames++;
        //     if (this.skipFrames < this.frameSkipThreshold) {
        //         ctx.restore();
        //         return;
        //     }
        //     this.skipFrames = 0;
        // }

        const gridColor = options.color || 'rgba(255, 255, 255, 0.1)';
        const gridThickness = options.thickness || 1;
        const gridOpacity = options.opacity || 0.1;
        const orientation = options.hexOrientation || 'pointy';

        // Calculate hexagonal grid parameters
        const hexSize = gridSize / 2; // Use gridSize as radius
        const hexWidth = Math.sqrt(3) * hexSize;  // Width of hexagon
        const hexHeight = 2 * hexSize;            // Height of hexagon

        // Calculate viewport bounds
        const bounds = this.calculateViewportBounds(camera, viewport);
        const { left: viewportLeft, top: viewportTop, right: viewportRight, bottom: viewportBottom } = bounds;

        // Check if grid is too dense - disable it completely
        const estimatedHexagons = this.estimateHexagonCount(hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation);
        if (estimatedHexagons > this.maxHexagonsThreshold) {
            // Grid too dense - don't render it
            ctx.restore();
            return;
        }


        // Set grid line style (camera is already applied by CanvasRenderer)
        this.setGridStyle(ctx, gridColor, gridThickness, gridOpacity, camera);

        // Use simple cached rendering
        this.drawHexagonalGridSimple(ctx, hexSize, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation, camera);
        
        ctx.restore();
    }


    /**
     * Simple hexagonal grid rendering with basic caching
     */
    drawHexagonalGridSimple(ctx, hexSize, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation, camera) {
        // Create cache key based on grid parameters and viewport
        const cacheKey = this.createCacheKey(hexSize, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation, camera);
        
        // Check if we can use cached data
        const now = performance.now();
        if (this.lastCacheKey === cacheKey && (now - this.lastCacheTime) < this.cacheTimeout) {
            this.drawCachedGrid(ctx, cacheKey);
            return;
        }

        // Calculate grid parameters
        const gridParams = this.calculateGridParameters(hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation);
        
        // Generate simple grid data
        const gridData = this.generateSimpleGridData(gridParams, hexSize, orientation);
        
        // Cache the grid data
        this.cacheGridData(cacheKey, gridData);
        
        // Draw the grid
        this.drawGridData(ctx, gridData);
        
        // Update cache state
        this.lastCacheKey = cacheKey;
        this.lastCacheTime = now;
    }

    /**
     * Create cache key for grid configuration
     */
    createCacheKey(hexSize, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation, camera) {
        // Round values to reduce cache misses due to floating point precision
        const precision = 10;
        const roundedLeft = Math.round(viewportLeft * precision) / precision;
        const roundedTop = Math.round(viewportTop * precision) / precision;
        const roundedRight = Math.round(viewportRight * precision) / precision;
        const roundedBottom = Math.round(viewportBottom * precision) / precision;
        const roundedHexSize = Math.round(hexSize * precision) / precision;
        const roundedZoom = Math.round(camera.zoom * 100) / 100;
        
        return `${orientation}_${roundedHexSize}_${roundedLeft}_${roundedTop}_${roundedRight}_${roundedBottom}_${roundedZoom}`;
    }

    /**
     * Calculate grid parameters
     */
    calculateGridParameters(hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation) {
        let gridCols, gridRows, startCol, startRow, horizSpacing, vertSpacing;
        
        if (orientation === 'pointy') {
            horizSpacing = hexWidth;
            vertSpacing = hexHeight * 0.75;
        } else {
            horizSpacing = hexHeight * 0.75;
            vertSpacing = hexWidth;
        }
        
        // Calculate minimal overlap - add only what's needed for hexagon radius
        const hexRadius = hexWidth / 2; // For pointy orientation, radius is half width
        const extraCols = Math.ceil(hexRadius / horizSpacing) + 1;
        const extraRows = Math.ceil(hexRadius / vertSpacing) + 1;
        
        gridCols = Math.ceil((viewportRight - viewportLeft) / horizSpacing) + extraCols;
        gridRows = Math.ceil((viewportBottom - viewportTop) / vertSpacing) + extraRows;
        startCol = Math.floor(viewportLeft / horizSpacing) - Math.floor(extraCols / 2);
        startRow = Math.floor(viewportTop / vertSpacing) - Math.floor(extraRows / 2);
        
        return {
            gridCols,
            gridRows,
            startCol,
            startRow,
            horizSpacing,
            vertSpacing,
            hexWidth,
            hexHeight
        };
    }


    /**
     * Generate simple grid data without complex optimizations
     */
    generateSimpleGridData(gridParams, hexSize, orientation) {
        const { gridCols, gridRows, startCol, startRow, horizSpacing, vertSpacing, hexWidth, hexHeight } = gridParams;
        
        // Use Set to avoid duplicate lines
        const lineSet = new Set();
        
        // Collect all unique line segments
        for (let row = startRow; row < startRow + gridRows; row++) {
            for (let col = startCol; col < startCol + gridCols; col++) {
                let centerX, centerY;
                
                if (orientation === 'pointy') {
                    const xShift = (row % 2 !== 0) ? hexWidth / 2 : 0;
                    centerX = (col * hexWidth) + xShift + (hexWidth / 2);
                    centerY = (row * hexHeight * 0.75) + (hexHeight / 2);
                } else {
                    const yShift = (col % 2 !== 0) ? hexWidth / 2 : 0;
                    centerX = (col * hexHeight * 0.75) + (hexHeight * 0.75 / 2);
                    centerY = (row * hexWidth) + yShift + (hexWidth / 2);
                }

                // Generate hexagon vertices directly
                this.addHexagonLinesSimple(lineSet, centerX, centerY, hexSize, orientation);
            }
        }

        return {
            lines: Array.from(lineSet),
            gridParams
        };
    }

    /**
     * Add hexagon lines directly without template
     */
    addHexagonLinesSimple(lineSet, centerX, centerY, hexSize, orientation) {
        // Generate hexagon vertices directly
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angleDeg = (orientation === 'pointy') ? (60 * i - 30) : (60 * i);
            const angleRad = Math.PI / 180 * angleDeg;
            vertices.push({
                x: centerX + hexSize * Math.cos(angleRad),
                y: centerY + hexSize * Math.sin(angleRad)
            });
        }
        
        // Add line segments to set (avoiding duplicates)
        for (let i = 0; i < 6; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % 6];
            const p1_fixed = { x: parseFloat(p1.x.toFixed(4)), y: parseFloat(p1.y.toFixed(4)) };
            const p2_fixed = { x: parseFloat(p2.x.toFixed(4)), y: parseFloat(p2.y.toFixed(4)) };
            const key = p1_fixed.x < p2_fixed.x || (p1_fixed.x === p2_fixed.x && p1_fixed.y < p2_fixed.y)
                ? `${p1_fixed.x},${p1_fixed.y}:${p2_fixed.x},${p2_fixed.y}`
                : `${p2_fixed.x},${p2_fixed.y}:${p1_fixed.x},${p1_fixed.y}`;
            lineSet.add(key);
        }
    }

    /**
     * Cache grid data
     */
    cacheGridData(cacheKey, gridData) {
        // Limit cache size
        if (this.gridCache.size >= this.maxCacheSize) {
            const firstKey = this.gridCache.keys().next().value;
            this.gridCache.delete(firstKey);
        }
        
        this.gridCache.set(cacheKey, {
            data: gridData,
            timestamp: performance.now()
        });
    }

    /**
     * Draw cached grid data
     */
    drawCachedGrid(ctx, cacheKey) {
        const cached = this.gridCache.get(cacheKey);
        if (cached) {
            this.drawGridData(ctx, cached.data);
        }
    }

    /**
     * Draw grid data
     */
    drawGridData(ctx, gridData) {
        const { lines } = gridData;
        
        // Draw all unique line segments
        ctx.beginPath();
        lines.forEach(lineKey => {
            const [p1Str, p2Str] = lineKey.split(':');
            const [x1, y1] = p1Str.split(',').map(Number);
            const [x2, y2] = p2Str.split(',').map(Number);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        });
        ctx.stroke();
    }

    /**
     * Clear cache (call when grid settings change)
     */
    clearCache() {
        this.gridCache.clear();
        this.hexagonTemplate = null;
        this.lastCacheKey = null;
        this.lastCacheTime = 0;
    }

    /**
     * Estimate number of hexagons that would be rendered
     */
    estimateHexagonCount(hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation) {
        let horizSpacing, vertSpacing;
        
        if (orientation === 'pointy') {
            horizSpacing = hexWidth;
            vertSpacing = hexHeight * 0.75;
        } else {
            horizSpacing = hexHeight * 0.75;
            vertSpacing = hexWidth;
        }
        
        const gridCols = Math.ceil((viewportRight - viewportLeft) / horizSpacing) + 2;
        const gridRows = Math.ceil((viewportBottom - viewportTop) / vertSpacing) + 2;
        
        return gridCols * gridRows;
    }


    /**
     * Get cache statistics for debugging
     */
    getCacheStats() {
        return {
            cacheSize: this.gridCache.size,
            maxCacheSize: this.maxCacheSize,
            lastCacheKey: this.lastCacheKey,
            lastCacheTime: this.lastCacheTime,
            maxHexagonsThreshold: this.maxHexagonsThreshold
        };
    }
}