/**
 * Duplicate objects utilities
 * Handles positioning of duplicated objects during placement
 * @version dynamic - Utility Architecture
 */

import { Logger } from './Logger.js';

export class DuplicateUtils {
    /**
     * Update object positions to follow mouse cursor
     */
    static updatePositions(objects, worldPos) {
        if (!objects || objects.length === 0) return objects;

        return objects.map((obj, index) => {
            // Use saved offsets to maintain relative positions
            const offsetX = obj._offsetX ?? 0;
            const offsetY = obj._offsetY ?? 0;

            // Calculate new position based on cursor position and saved offset
            const newX = worldPos.x + offsetX;
            const newY = worldPos.y + offsetY;

            return { ...obj, x: newX, y: newY };
        });
    }

    /**
     * Initialize object positions for duplication
     */
    static initializePositions(objects, worldPos) {
        if (!objects || objects.length === 0) return objects;

        return objects.map((obj, index) => {
            // Save relative offset from cursor position
            const offsetX = obj.x - worldPos.x;
            const offsetY = obj.y - worldPos.y;

            return { ...obj, _offsetX: offsetX, _offsetY: offsetY };
        });
    }

    /**
     * Check if position has changed significantly
     */
    static hasPositionChanged(firstObj, worldPos, threshold = 1) {
        if (!firstObj) return true;

        const expectedX = worldPos.x; // First object has no offset
        const expectedY = worldPos.y; // First object has no offset

        return Math.abs(firstObj.x - expectedX) >= threshold ||
               Math.abs(firstObj.y - expectedY) >= threshold;
    }

}

// Legacy compatibility: Export the same interface as duplicateRenderUtils
export const duplicateRenderUtils = {
    /**
     * Update object positions
     */
    updatePositions: (objects, worldPos) => {
        return DuplicateUtils.updatePositions(objects, worldPos);
    },

    /**
     * Initialize positions
     */
    initializePositions: (objects, worldPos) => {
        return DuplicateUtils.initializePositions(objects, worldPos);
    },

    /**
     * Check position change
     */
    hasPositionChanged: (firstObj, worldPos) => {
        return DuplicateUtils.hasPositionChanged(firstObj, worldPos);
    }
};
