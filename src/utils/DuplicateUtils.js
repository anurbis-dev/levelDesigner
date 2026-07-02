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
    static updatePositions(objects, worldPos, editor = null) {
        if (!objects || objects.length === 0) return objects;

        return objects.map((obj, index) => {
            // Use saved offsets to maintain relative positions
            const offsetX = obj._offsetX ?? 0;
            const offsetY = obj._offsetY ?? 0;

            // Calculate new position based on cursor position and saved offset
            let newX, newY;

            // Simplified: always place preview at cursor position (world coordinates)
            // This matches how objects appear under cursor during normal placement
            newX = worldPos.x + offsetX;
            newY = worldPos.y + offsetY;

            return { ...obj, x: newX, y: newY };
        });
    }

    /**
     * Initialize object positions for duplication
     */
    static initializePositions(objects, worldPos, editor = null) {
        if (!objects || objects.length === 0) return objects;

        return objects.map((obj, index) => {
            // Get world position of the object
            let objWorldX, objWorldY;

            if (editor && editor.objectOperations) {
                // _worldX/_worldY are pre-computed in startFromSelection BEFORE reassignIdsDeep,
                // so they always contain true world coords (works for both group and top-level objects).
                // getObjectWorldPosition on the clone itself would fall back to local coords
                // because the clone has a new ID and is not found in the level tree.
                if (obj._worldX !== undefined) {
                    objWorldX = obj._worldX;
                    objWorldY = obj._worldY;
                } else {
                    const objPos = editor.objectOperations.getObjectWorldPosition(obj);
                    objWorldX = objPos.x;
                    objWorldY = objPos.y;
                }
            } else {
                // Fallback to local coordinates if editor not available
                objWorldX = obj.x;
                objWorldY = obj.y;
            }

            // Calculate offset from the cursor position (maintains relative positions)
            // worldPos is the cursor position
            const offsetX = objWorldX - worldPos.x;
            const offsetY = objWorldY - worldPos.y;

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
    updatePositions: (objects, worldPos, editor = null) => {
        return DuplicateUtils.updatePositions(objects, worldPos, editor);
    },

    /**
     * Initialize positions
     */
    initializePositions: (objects, worldPos, editor = null) => {
        return DuplicateUtils.initializePositions(objects, worldPos, editor);
    },

    /**
     * Check position change
     */
    hasPositionChanged: (firstObj, worldPos) => {
        return DuplicateUtils.hasPositionChanged(firstObj, worldPos);
    }
};
