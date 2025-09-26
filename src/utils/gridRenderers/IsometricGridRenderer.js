import { BaseGridRenderer } from './BaseGridRenderer.js';

export class IsometricGridRenderer extends BaseGridRenderer {
    render(ctx, gridSize, camera, viewport, options = {}) {
        ctx.save();

        // Fill background
        if (options.backgroundColor) {
            ctx.fillStyle = options.backgroundColor;
            ctx.fillRect(0, 0, viewport.width, viewport.height);
        }

        // Skip rendering if grid is too small (increased minimum for isometric)
        if (gridSize * camera.zoom < 8 || gridSize < 8) {
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

        // Draw isometric grid lines (120° angles)
        this.drawIsometricLines(ctx, gridSize, viewportLeft, viewportTop, viewportRight, viewportBottom);
        ctx.restore();
    }


    /**
     * Draw isometric grid lines at 60° and 120° angles
     */
    drawIsometricLines(ctx, gridSize, viewportLeft, viewportTop, viewportRight, viewportBottom) {
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
        const maxLines = 100;

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

}
