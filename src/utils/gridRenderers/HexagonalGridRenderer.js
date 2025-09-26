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

        // Calculate hexagonal grid parameters
        const hexRadius = gridSize / 2;
        const hexWidth = Math.sqrt(3) * hexRadius;  // Width of hexagon
        const hexHeight = 2 * hexRadius;            // Height of hexagon

        // Calculate viewport bounds
        const bounds = this.calculateViewportBounds(camera, viewport);
        const { left: viewportLeft, top: viewportTop, right: viewportRight, bottom: viewportBottom } = bounds;

        // Set grid line style (camera is already applied by CanvasRenderer)
        this.setGridStyle(ctx, gridColor, gridThickness, gridOpacity, camera);

        // Draw hexagonal grid
        this.drawHexagonalGrid(ctx, hexRadius, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom);
        ctx.restore();
    }


    /**
     * Draw hexagonal grid
     */
    drawHexagonalGrid(ctx, hexRadius, hexWidth, hexHeight, viewportLeft, viewportTop, viewportRight, viewportBottom) {
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
}
