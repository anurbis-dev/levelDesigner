import { BaseGridRenderer } from './BaseGridRenderer.js';

export class DiamondGridRenderer extends BaseGridRenderer {
    drawGrid(ctx, gridSize, camera, viewport, options) {
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

        // Draw lines at 60° (going up-right) and 120° (going up-left) —
        // same intersection math, mirrored slope
        this.drawDiagonalLines(ctx, slope60, diamondSpacing, left, top, right, bottom);
        this.drawDiagonalLines(ctx, slope120, diamondSpacing, left, top, right, bottom);
    }

    /**
     * Draw a family of parallel diagonal lines (constant = x + slope * y) clipped to viewport bounds
     */
    drawDiagonalLines(ctx, slope, spacing, left, top, right, bottom) {
        // Calculate all corner constants to ensure full coverage
        const constants = [
            left + slope * top,      // top-left
            right + slope * top,     // top-right
            left + slope * bottom,   // bottom-left
            right + slope * bottom   // bottom-right
        ];
        const minConstant = Math.min(...constants);
        const maxConstant = Math.max(...constants);
        const startLine = Math.floor(minConstant / spacing) - 1;
        const endLine = Math.ceil(maxConstant / spacing) + 1;

        for (let i = startLine; i <= endLine; i++) {
            // Line equation: x + slope * y = constant
            const constant = i * spacing;

            // Find intersection points with viewport bounds
            const intersections = [];

            // Intersect with left edge (x = left)
            const yLeft = (constant - left) / slope;
            if (isFinite(yLeft) && yLeft >= top && yLeft <= bottom) {
                intersections.push({ x: left, y: yLeft });
            }

            // Intersect with right edge (x = right)
            const yRight = (constant - right) / slope;
            if (isFinite(yRight) && yRight >= top && yRight <= bottom) {
                intersections.push({ x: right, y: yRight });
            }

            // Intersect with top edge (y = top)
            const xTop = constant - slope * top;
            if (isFinite(xTop) && xTop >= left && xTop <= right) {
                intersections.push({ x: xTop, y: top });
            }

            // Intersect with bottom edge (y = bottom)
            const xBottom = constant - slope * bottom;
            if (isFinite(xBottom) && xBottom >= left && xBottom <= right) {
                intersections.push({ x: xBottom, y: bottom });
            }

            // Draw line if we have at least 2 intersection points
            // (a single intersection means the line only touches a corner — skip, it's just a point)
            if (intersections.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(intersections[0].x, intersections[0].y);
                ctx.lineTo(intersections[1].x, intersections[1].y);
                ctx.stroke();
            }
        }
    }

}
