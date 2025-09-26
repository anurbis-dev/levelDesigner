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
        this.drawDiamondLines(ctx, gridSize, camera, viewportLeft, viewportTop, viewportRight, viewportBottom);
        ctx.restore();
    }


    /**
     * Draw diamond grid lines at 60° and 120° angles
     */
    drawDiamondLines(ctx, gridSize, camera, viewportLeft, viewportTop, viewportRight, viewportBottom) {
        // Calculate the correct slope for 60° angle (tan(60°) = √3)
        const slope60 = Math.tan(Math.PI / 3); // √3 ≈ 1.732
        const slope120 = -Math.tan(Math.PI / 3); // -√3 ≈ -1.732

        // Calculate diamond grid spacing
        // Use gridSize directly since camera transform is already applied
        const diamondSpacing = gridSize;


        // Use viewport bounds directly, like RectangularGridRenderer
        // Add small epsilon to avoid precision issues with lines passing through exact corners
        const epsilon = 1e-10;
        const left = viewportLeft - epsilon;
        const top = viewportTop - epsilon;
        const right = viewportRight + epsilon;
        const bottom = viewportBottom + epsilon;

        // Performance check
        const maxLines = 1000;
        const width = right - left;
        const height = bottom - top;
        const linesCount = Math.floor(width / diamondSpacing) + Math.floor(height / diamondSpacing);
        if (linesCount > maxLines) {
            return;
        }

        // Draw lines at 60° (going up-right)
        // These lines have constant x + slope60 * y
        // Calculate all corner constants to ensure full coverage
        const constants60 = [
            left + slope60 * top,      // top-left
            right + slope60 * top,     // top-right
            left + slope60 * bottom,   // bottom-left
            right + slope60 * bottom   // bottom-right
        ];
        const minConstant60 = Math.min(...constants60);
        const maxConstant60 = Math.max(...constants60);
        const startLine60 = Math.floor(minConstant60 / diamondSpacing) - 1;
        const endLine60 = Math.ceil(maxConstant60 / diamondSpacing) + 1;


        let drawnLines60 = 0;
        for (let i = startLine60; i <= endLine60; i++) {
            // Line equation: x + slope60 * y = constant
            const constant = i * diamondSpacing;

            // Find intersection points with viewport bounds
            // Intersect with left/right/top/bottom edges
            const intersections = [];

            // Intersect with left edge (x = left)
            const yLeft = (constant - left) / slope60;
            if (isFinite(yLeft) && yLeft >= top && yLeft <= bottom) {
                intersections.push({ x: left, y: yLeft });
            }

            // Intersect with right edge (x = right)
            const yRight = (constant - right) / slope60;
            if (isFinite(yRight) && yRight >= top && yRight <= bottom) {
                intersections.push({ x: right, y: yRight });
            }

            // Intersect with top edge (y = top)
            const xTop = constant - slope60 * top;
            if (isFinite(xTop) && xTop >= left && xTop <= right) {
                intersections.push({ x: xTop, y: top });
            }

            // Intersect with bottom edge (y = bottom)
            const xBottom = constant - slope60 * bottom;
            if (isFinite(xBottom) && xBottom >= left && xBottom <= right) {
                intersections.push({ x: xBottom, y: bottom });
            }

            // Draw line if we have at least 2 intersection points
            if (intersections.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(intersections[0].x, intersections[0].y);
                ctx.lineTo(intersections[1].x, intersections[1].y);
                ctx.stroke();
                drawnLines60++;
            } else if (intersections.length === 1) {
                // Special case: line passes through exactly one corner
                // This can happen when the line goes through the exact corner of viewport
                // We'll skip this line as it's just a point
            }
        }


        // Draw lines at 120° (going up-left)
        // These lines have constant x + slope120 * y
        // Calculate all corner constants to ensure full coverage
        const constants120 = [
            left + slope120 * top,      // top-left
            right + slope120 * top,     // top-right
            left + slope120 * bottom,   // bottom-left
            right + slope120 * bottom   // bottom-right
        ];
        const minConstant120 = Math.min(...constants120);
        const maxConstant120 = Math.max(...constants120);
        const startLine120 = Math.floor(minConstant120 / diamondSpacing) - 1;
        const endLine120 = Math.ceil(maxConstant120 / diamondSpacing) + 1;

        let drawnLines120 = 0;
        for (let i = startLine120; i <= endLine120; i++) {
            // Line equation: x + slope120 * y = constant
            const constant = i * diamondSpacing;

            // Find intersection points with viewport bounds
            const intersections = [];

            // Intersect with left edge (x = left)
            const yLeft = (constant - left) / slope120;
            if (isFinite(yLeft) && yLeft >= top && yLeft <= bottom) {
                intersections.push({ x: left, y: yLeft });
            }

            // Intersect with right edge (x = right)
            const yRight = (constant - right) / slope120;
            if (isFinite(yRight) && yRight >= top && yRight <= bottom) {
                intersections.push({ x: right, y: yRight });
            }

            // Intersect with top edge (y = top)
            const xTop = constant - slope120 * top;
            if (isFinite(xTop) && xTop >= left && xTop <= right) {
                intersections.push({ x: xTop, y: top });
            }

            // Intersect with bottom edge (y = bottom)
            const xBottom = constant - slope120 * bottom;
            if (isFinite(xBottom) && xBottom >= left && xBottom <= right) {
                intersections.push({ x: xBottom, y: bottom });
            }

            // Draw line if we have at least 2 intersection points
            if (intersections.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(intersections[0].x, intersections[0].y);
                ctx.lineTo(intersections[1].x, intersections[1].y);
                ctx.stroke();
                drawnLines120++;
            } else if (intersections.length === 1) {
                // Special case: line passes through exactly one corner
                // This can happen when the line goes through the exact corner of viewport
                // We'll skip this line as it's just a point
            }
        }

    }

}
