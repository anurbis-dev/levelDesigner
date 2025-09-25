import { RenderUtils } from './RenderUtils.js';

/**
 * Grid rendering system with support for different grid types
 */
export class GridRenderer {
    constructor() {
        this.gridTypes = new Map();
        this.registerDefaultGridTypes();
    }

    /**
     * Register default grid types
     */
    registerDefaultGridTypes() {
        // Standard rectangular grid
        this.gridTypes.set('rectangular', {
            name: 'Rectangular Grid',
            render: this.renderRectangularGrid.bind(this)
        });

        // Isometric grid
        this.gridTypes.set('isometric', {
            name: 'Isometric Grid',
            render: this.renderIsometricGrid.bind(this)
        });

        // Hexagonal grid
        this.gridTypes.set('hexagonal', {
            name: 'Hexagonal Grid',
            render: this.renderHexagonalGrid.bind(this)
        });
    }

    /**
     * Render grid based on type
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} gridSize - Size of grid cells
     * @param {Object} camera - Camera object {x, y, zoom}
     * @param {Object} viewport - Viewport dimensions {width, height}
     * @param {string} gridType - Type of grid to render
     * @param {Object} options - Grid options
     */
    render(ctx, gridSize, camera, viewport, gridType = 'rectangular', options = {}) {
        const gridRenderer = this.gridTypes.get(gridType);
        if (!gridRenderer) {
            console.warn(`Unknown grid type: ${gridType}, falling back to rectangular`);
            gridType = 'rectangular';
        }

        this.gridTypes.get(gridType).render(ctx, gridSize, camera, viewport, options);
    }

    /**
     * Render rectangular grid (current implementation)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} gridSize - Size of grid cells
     * @param {Object} camera - Camera object {x, y, zoom}
     * @param {Object} viewport - Viewport dimensions {width, height}
     * @param {Object} options - Grid options
     */
    renderRectangularGrid(ctx, gridSize, camera, viewport, options = {}) {
        ctx.save();
        
        // Fill background
        if (options.backgroundColor) {
            ctx.fillStyle = options.backgroundColor;
            ctx.fillRect(0, 0, viewport.width, viewport.height);
        }

        // Skip grid drawing if zoomed out too much (performance optimization)
        const minGridSize = 5; // Minimum grid size in pixels
        if (gridSize * camera.zoom < minGridSize) {
            ctx.restore();
            return;
        }

        // Apply grid styling options
        const gridColor = options.color || 'rgba(255, 255, 255, 0.1)';
        const gridThickness = options.thickness || 1;
        const gridOpacity = options.opacity || 0.1;
        const gridSubdivisions = options.subdivisions || 1;
        const gridSubdivColor = options.subdivColor || '#666666';
        const gridSubdivThickness = options.subdivThickness || 0.5;

        // Calculate viewport bounds
        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + viewport.width / camera.zoom;
        const viewportBottom = camera.y + viewport.height / camera.zoom;

        // Start drawing lines before viewport and end after to ensure full coverage
        const startX = Math.floor(viewportLeft / gridSize) * gridSize - gridSize;
        const startY = Math.floor(viewportTop / gridSize) * gridSize - gridSize;
        const endX = Math.ceil(viewportRight / gridSize) * gridSize + gridSize;
        const endY = Math.ceil(viewportBottom / gridSize) * gridSize + gridSize;

        // Higher limit for grid lines (grid is less performance-intensive than objects)
        // Prevents grid from disappearing in chunks during panning
        const maxLines = 1000;

        // Draw main grid lines
        this.drawGridLines(ctx, gridSize, gridColor, gridThickness, gridOpacity, camera, startX, startY, endX, endY, maxLines);

        // Draw subdivision lines if enabled
        if (gridSubdivisions > 1) {
            const subdivSize = gridSize / gridSubdivisions;
            this.drawGridLines(ctx, subdivSize, gridSubdivColor, gridSubdivThickness, gridOpacity, camera, startX, startY, endX, endY, maxLines);
        }

        ctx.restore();
    }

    /**
     * Render isometric grid
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} gridSize - Size of grid cells
     * @param {Object} camera - Camera object {x, y, zoom}
     * @param {Object} viewport - Viewport dimensions {width, height}
     * @param {Object} options - Grid options
     */
    renderIsometricGrid(ctx, gridSize, camera, viewport, options = {}) {
        ctx.save();
        
        // Fill background
        if (options.backgroundColor) {
            ctx.fillStyle = options.backgroundColor;
            ctx.fillRect(0, 0, viewport.width, viewport.height);
        }

        // Skip grid drawing if zoomed out too much or grid size is too small
        const minGridSize = 8; // Increased minimum size for isometric
        if (gridSize * camera.zoom < minGridSize || gridSize < 8) {
            ctx.restore();
            return;
        }

        const gridColor = options.color || 'rgba(255, 255, 255, 0.1)';
        const gridThickness = options.thickness || 1;
        const gridOpacity = options.opacity || 0.1;

        // Calculate viewport bounds
        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + viewport.width / camera.zoom;
        const viewportBottom = camera.y + viewport.height / camera.zoom;

        // Draw isometric grid lines (120° angles)
        this.drawIsometricLines(ctx, gridSize, gridColor, gridThickness, gridOpacity, camera, viewportLeft, viewportTop, viewportRight, viewportBottom);

        ctx.restore();
    }

    /**
     * Render hexagonal grid
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} gridSize - Size of grid cells
     * @param {Object} camera - Camera object {x, y, zoom}
     * @param {Object} viewport - Viewport dimensions {width, height}
     * @param {Object} options - Grid options
     */
    renderHexagonalGrid(ctx, gridSize, camera, viewport, options = {}) {
        ctx.save();
        
        // Fill background
        if (options.backgroundColor) {
            ctx.fillStyle = options.backgroundColor;
            ctx.fillRect(0, 0, viewport.width, viewport.height);
        }

        // Skip grid drawing if zoomed out too much
        const minGridSize = 5;
        if (gridSize * camera.zoom < minGridSize) {
            ctx.restore();
            return;
        }

        const gridColor = options.color || 'rgba(255, 255, 255, 0.1)';
        const gridThickness = options.thickness || 1;
        const gridOpacity = options.opacity || 0.1;

        // Calculate hexagonal grid parameters
        const hexRadius = gridSize / 2;
        const hexWidth = Math.sqrt(3) * hexRadius;  // Width of hexagon
        const hexHeight = 2 * hexRadius;            // Height of hexagon

        // Calculate viewport bounds
        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + viewport.width / camera.zoom;
        const viewportBottom = camera.y + viewport.height / camera.zoom;

        // Draw hexagonal grid
        this.drawHexagonalGrid(ctx, hexRadius, hexWidth, hexHeight, gridColor, gridThickness, gridOpacity, camera, viewportLeft, viewportTop, viewportRight, viewportBottom);

        ctx.restore();
    }

    /**
     * Draw grid lines with specified parameters
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} gridSize - Size of grid cells
     * @param {string} color - Grid line color
     * @param {number} thickness - Grid line thickness
     * @param {number} opacity - Grid line opacity
     * @param {Object} camera - Camera object
     * @param {number} startX - Start X coordinate
     * @param {number} startY - Start Y coordinate
     * @param {number} endX - End X coordinate
     * @param {number} endY - End Y coordinate
     * @param {number} maxLines - Maximum number of lines to draw
     */
    drawGridLines(ctx, gridSize, color, thickness, opacity, camera, startX, startY, endX, endY, maxLines) {
        // Always apply opacity to ensure it works interactively
        if (color.startsWith('rgba')) {
            // Extract RGB values from rgba and apply new opacity
            const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
            if (rgbaMatch) {
                const [, r, g, b] = rgbaMatch;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            } else {
                ctx.strokeStyle = color;
            }
        } else {
            // Convert hex color to rgba with opacity
            ctx.strokeStyle = RenderUtils.hexToRgba(color, opacity);
        }
        ctx.lineWidth = (thickness / camera.zoom);

        const totalVerticalLines = Math.floor((endX - startX) / gridSize);
        const totalHorizontalLines = Math.floor((endY - startY) / gridSize);

        // Draw vertical lines
        if (totalVerticalLines <= maxLines) {
            for (let x = startX; x < endX; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, startY);
                ctx.lineTo(x, endY);
                ctx.stroke();
            }
        }

        // Draw horizontal lines
        if (totalHorizontalLines <= maxLines) {
            for (let y = startY; y < endY; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(startX, y);
                ctx.lineTo(endX, y);
                ctx.stroke();
            }
        }
    }

    /**
     * Draw isometric grid lines
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cellWidth - Width of isometric cell
     * @param {number} cellHeight - Height of isometric cell
     * @param {string} color - Grid line color
     * @param {number} thickness - Grid line thickness
     * @param {number} opacity - Grid line opacity
     * @param {Object} camera - Camera object
     * @param {number} viewportLeft - Viewport left bound
     * @param {number} viewportTop - Viewport top bound
     * @param {number} viewportRight - Viewport right bound
     * @param {number} viewportBottom - Viewport bottom bound
     */
    drawIsometricLines(ctx, gridSize, color, thickness, opacity, camera, viewportLeft, viewportTop, viewportRight, viewportBottom) {
        // Always apply opacity to ensure it works interactively
        if (color.startsWith('rgba')) {
            // Extract RGB values from rgba and apply new opacity
            const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
            if (rgbaMatch) {
                const [, r, g, b] = rgbaMatch;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            } else {
                ctx.strokeStyle = color;
            }
        } else {
            ctx.strokeStyle = RenderUtils.hexToRgba(color, opacity);
        }
        ctx.lineWidth = (thickness / camera.zoom);

        // Apply camera transformation
        ctx.translate(-camera.x * camera.zoom, -camera.y * camera.zoom);
        ctx.scale(camera.zoom, camera.zoom);

        // Simplified isometric grid: three sets of parallel lines at 120° angles
        const spacing = gridSize;
        
        // Calculate grid bounds in world coordinates
        const worldLeft = viewportLeft;
        const worldTop = viewportTop;
        const worldRight = viewportRight;
        const worldBottom = viewportBottom;

        // Start drawing lines before viewport and end after to ensure full coverage
        const startX = Math.floor(worldLeft / spacing) * spacing - spacing;
        const startY = Math.floor(worldTop / spacing) * spacing - spacing;
        const endX = Math.ceil(worldRight / spacing) * spacing + spacing;
        const endY = Math.ceil(worldBottom / spacing) * spacing + spacing;

        // Limit the number of lines to prevent performance issues
        const maxLines = 100; // Reduced from 200 to prevent hanging
        

        // Draw diagonal lines at 60° (going up-right)
        const diagonal1Lines = Math.min(Math.floor((endX - startX) / spacing), maxLines);
        for (let i = 0; i <= diagonal1Lines; i++) {
            const x = startX + i * spacing;
            const y1 = startY;
            const y2 = endY;
            const x1 = x;
            const x2 = x + (y2 - y1) * Math.tan(Math.PI / 3);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Draw diagonal lines at 120° (going up-left)
        const diagonal2Lines = Math.min(Math.floor((endX - startX) / spacing), maxLines);
        for (let i = 0; i <= diagonal2Lines; i++) {
            const x = startX + i * spacing;
            const y1 = startY;
            const y2 = endY;
            const x1 = x;
            const x2 = x - (y2 - y1) * Math.tan(Math.PI / 3);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    /**
     * Draw parallel lines at a specific angle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} startX - Viewport start X
     * @param {number} startY - Viewport start Y
     * @param {number} endX - Viewport end X
     * @param {number} endY - Viewport end Y
     * @param {number} spacing - Line spacing
     * @param {number} angle - Line angle in radians
     */
    drawParallelLines(ctx, startX, startY, endX, endY, spacing, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // Calculate the perpendicular distance between lines
        const perpSpacing = spacing * Math.abs(sin);
        
        // Prevent division by zero and infinite loops
        if (perpSpacing < 0.001) {
            return; // Skip drawing if spacing is too small
        }
        
        // Handle horizontal lines (sin = 0) separately
        if (Math.abs(sin) < 0.001) {
            // Horizontal lines
            const numLines = Math.min(Math.ceil((endY - startY) / spacing) + 2, 1000); // Limit to prevent infinite loops
            const startYOffset = Math.floor(startY / spacing) * spacing;
            
            for (let i = 0; i < numLines; i++) {
                const y = startYOffset + i * spacing;
                if (y >= startY && y <= endY) {
                    ctx.beginPath();
                    ctx.moveTo(startX, y);
                    ctx.lineTo(endX, y);
                    ctx.stroke();
                }
            }
            return;
        }
        
        // Calculate the number of lines needed
        const diagonal = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        const numLines = Math.min(Math.ceil(diagonal / perpSpacing) + 2, 1000); // Limit to prevent infinite loops
        
        // Calculate the starting offset
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const startOffset = -Math.floor(numLines / 2) * perpSpacing;
        
        for (let i = 0; i < numLines; i++) {
            const offset = startOffset + i * perpSpacing;
            
            // Calculate line endpoints
            const lineStartX = centerX + offset * sin;
            const lineStartY = centerY - offset * cos;
            
            // Extend line to cover the entire viewport
            const lineLength = diagonal * 2;
            const lineEndX = lineStartX + lineLength * cos;
            const lineEndY = lineStartY + lineLength * sin;
            
            ctx.beginPath();
            ctx.moveTo(lineStartX, lineStartY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();
        }
    }

    /**
     * Draw hexagonal grid
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} hexRadius - Radius of hexagons
     * @param {number} hexWidth - Width of hexagons
     * @param {number} hexHeight - Height of hexagons
     * @param {string} color - Grid line color
     * @param {number} thickness - Grid line thickness
     * @param {number} opacity - Grid line opacity
     * @param {Object} camera - Camera object
     * @param {number} viewportLeft - Viewport left bound
     * @param {number} viewportTop - Viewport top bound
     * @param {number} viewportRight - Viewport right bound
     * @param {number} viewportBottom - Viewport bottom bound
     */
    drawHexagonalGrid(ctx, hexRadius, hexWidth, hexHeight, color, thickness, opacity, camera, viewportLeft, viewportTop, viewportRight, viewportBottom) {
        // Always apply opacity to ensure it works interactively
        if (color.startsWith('rgba')) {
            // Extract RGB values from rgba and apply new opacity
            const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
            if (rgbaMatch) {
                const [, r, g, b] = rgbaMatch;
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            } else {
                ctx.strokeStyle = color;
            }
        } else {
            ctx.strokeStyle = RenderUtils.hexToRgba(color, opacity);
        }
        ctx.lineWidth = (thickness / camera.zoom);

        // Calculate hex grid spacing
        const hexHorizSpacing = hexWidth;         // Horizontal spacing between hex centers
        const hexVertSpacing = hexHeight * 0.75;  // Vertical spacing between hex centers

        // Calculate starting positions with proper offset
        const startCol = Math.floor(viewportLeft / hexHorizSpacing) - 1;
        const startRow = Math.floor(viewportTop / hexVertSpacing) - 1;
        const endCol = Math.ceil(viewportRight / hexHorizSpacing) + 1;
        const endRow = Math.ceil(viewportBottom / hexVertSpacing) + 1;

        // Draw hexagons in a staggered pattern
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                // Calculate hex center position
                let centerX = col * hexHorizSpacing;
                let centerY = row * hexVertSpacing;

                // Stagger every other row horizontally
                if (row % 2 !== 0) {
                    centerX += hexHorizSpacing / 2;
                }

                // Draw hexagon (pointy-top orientation)
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3 - Math.PI / 6; // 60° * i - 30°
                    const xPos = centerX + hexRadius * Math.cos(angle);
                    const yPos = centerY + hexRadius * Math.sin(angle);

                    if (i === 0) {
                        ctx.moveTo(xPos, yPos);
                    } else {
                        ctx.lineTo(xPos, yPos);
                    }
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
    }

    /**
     * Register a new grid type
     * @param {string} type - Grid type identifier
     * @param {string} name - Human-readable name
     * @param {Function} renderFunction - Function to render this grid type
     */
    registerGridType(type, name, renderFunction) {
        this.gridTypes.set(type, {
            name: name,
            render: renderFunction
        });
    }

    /**
     * Get available grid types
     * @returns {Array} Array of grid type objects
     */
    getAvailableGridTypes() {
        return Array.from(this.gridTypes.entries()).map(([type, config]) => ({
            type,
            name: config.name
        }));
    }
}
