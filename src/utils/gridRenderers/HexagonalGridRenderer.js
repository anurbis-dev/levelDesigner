import { BaseGridRenderer } from './BaseGridRenderer.js';

export class HexagonalGridRenderer extends BaseGridRenderer {
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

        // Set grid line style (camera is already applied by CanvasRenderer)
        this.setGridStyle(ctx, gridColor, gridThickness, gridOpacity, camera);

        // Draw hexagonal grid with new implementation
        this.drawHexagonalGrid(ctx, hexSize, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation);
        ctx.restore();
    }

    /**
     * Draw hexagonal grid using the new implementation
     */
    drawHexagonalGrid(ctx, hexSize, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom, orientation) {
        // Calculate correct dimensions for each orientation
        let gridCols, gridRows, startCol, startRow;
        
        if (orientation === 'pointy') {
            // Pointy-top orientation: hexWidth is horizontal spacing, hexHeight * 0.75 is vertical spacing
            const horizSpacing = hexWidth;
            const vertSpacing = hexHeight * 0.75;
            
            gridCols = Math.ceil((viewportRight - viewportLeft) / horizSpacing) + 2;
            gridRows = Math.ceil((viewportBottom - viewportTop) / vertSpacing) + 2;
            startCol = Math.floor(viewportLeft / horizSpacing) - 1;
            startRow = Math.floor(viewportTop / vertSpacing) - 1;
        } else {
            // Flat-top orientation: hexHeight * 0.75 is horizontal spacing, hexWidth is vertical spacing
            const horizSpacing = hexHeight * 0.75;
            const vertSpacing = hexWidth;
            
            gridCols = Math.ceil((viewportRight - viewportLeft) / horizSpacing) + 2;
            gridRows = Math.ceil((viewportBottom - viewportTop) / vertSpacing) + 2;
            startCol = Math.floor(viewportLeft / horizSpacing) - 1;
            startRow = Math.floor(viewportTop / vertSpacing) - 1;
        }

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

                // Generate hexagon vertices
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
        }

        // Draw all unique line segments
        ctx.beginPath();
        lineSet.forEach(lineKey => {
            const [p1Str, p2Str] = lineKey.split(':');
            const [x1, y1] = p1Str.split(',').map(Number);
            const [x2, y2] = p2Str.split(',').map(Number);
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        });
        ctx.stroke();
    }
}