import { BaseGridRenderer } from './BaseGridRenderer.js';

export class RectangularGridRenderer extends BaseGridRenderer {
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
        const gridSubdivisions = options.subdivisions || 1;
        const gridSubdivColor = options.subdivColor || '#666666';
        const gridSubdivThickness = options.subdivThickness || 0.5;

        // Calculate viewport bounds
        const bounds = this.calculateViewportBounds(camera, viewport);
        const { left: viewportLeft, top: viewportTop, right: viewportRight, bottom: viewportBottom } = bounds;

        // Calculate grid line positions
        const startX = Math.floor(viewportLeft / gridSize) * gridSize - gridSize;
        const startY = Math.floor(viewportTop / gridSize) * gridSize - gridSize;
        const endX = Math.ceil(viewportRight / gridSize) * gridSize + gridSize;
        const endY = Math.ceil(viewportBottom / gridSize) * gridSize + gridSize;

        // Performance check
        const maxLines = 1000;
        const verticalLines = Math.floor((endX - startX) / gridSize);
        const horizontalLines = Math.floor((endY - startY) / gridSize);
        if (verticalLines > maxLines || horizontalLines > maxLines) {
            ctx.restore();
            return;
        }

        // Draw main grid lines
        this.setGridStyle(ctx, gridColor, gridThickness, gridOpacity, camera);
        this.drawGridLines(ctx, startX, startY, endX, endY, gridSize);

        // Draw subdivision lines if enabled
        if (gridSubdivisions > 0) {
            const subdivSize = gridSize / gridSubdivisions;
            this.setGridStyle(ctx, gridSubdivColor, gridSubdivThickness, gridOpacity, camera);
            this.drawGridLines(ctx, startX, startY, endX, endY, subdivSize);
        }

        ctx.restore();
    }

    /**
     * Draw grid lines
     */
    drawGridLines(ctx, startX, startY, endX, endY, gridSize) {
        // Draw vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
    }
}
