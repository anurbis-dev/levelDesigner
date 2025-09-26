import { BaseGridRenderer } from './BaseGridRenderer.js';

export class DiamondGridRenderer extends BaseGridRenderer {
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

        // Calculate viewport bounds
        const bounds = this.calculateViewportBounds(camera, viewport);
        const { left: viewportLeft, top: viewportTop, right: viewportRight, bottom: viewportBottom } = bounds;

        // Set grid line style (camera is already applied by CanvasRenderer)
        this.setGridStyle(ctx, gridColor, gridThickness, gridOpacity, camera);

        // Draw diamond grid lines (60° and 120° angles)
        this.drawDiamondLines(ctx, gridSize, viewportLeft, viewportTop, viewportRight, viewportBottom);
        ctx.restore();
    }


    /**
     * Draw diamond grid lines at 60° and 120° angles
     */
    drawDiamondLines(ctx, gridSize, viewportLeft, viewportTop, viewportRight, viewportBottom) {
        // Calculate grid line positions with diamond offset
        // Diamond grid needs to be offset by half grid size for proper centering
        const offsetX = gridSize / 2;
        const offsetY = gridSize / 2;
        
        const startX = Math.floor((viewportLeft - offsetX) / gridSize) * gridSize + offsetX - gridSize;
        const startY = Math.floor((viewportTop - offsetY) / gridSize) * gridSize + offsetY - gridSize;
        const endX = Math.ceil((viewportRight - offsetX) / gridSize) * gridSize + offsetX + gridSize;
        const endY = Math.ceil((viewportBottom - offsetY) / gridSize) * gridSize + offsetY + gridSize;

        // Performance check (same as rectangular grid)
        const maxLines = 1000;
        const diagonalLines = Math.floor((endX - startX) / gridSize);
        if (diagonalLines > maxLines) {
            return;
        }

        // Calculate the correct slope for 60° angle (tan(60°) = √3)
        const slope60 = Math.tan(Math.PI / 3); // √3 ≈ 1.732
        const slope120 = -Math.tan(Math.PI / 3); // -√3 ≈ -1.732

        // Draw diagonal lines at 60° (going up-right)
        for (let x = startX; x <= endX; x += gridSize) {
            const y1 = startY;
            const y2 = endY;
            const x1 = x;
            const x2 = x + (y2 - y1) * slope60;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Draw diagonal lines at 120° (going up-left)
        for (let x = startX; x <= endX; x += gridSize) {
            const y1 = startY;
            const y2 = endY;
            const x1 = x;
            const x2 = x + (y2 - y1) * slope120;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

    }

}
