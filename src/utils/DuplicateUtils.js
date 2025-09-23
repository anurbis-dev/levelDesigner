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
            const newX = worldPos.x + offsetX;
            const newY = worldPos.y + offsetY;

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
                // Special handling for group edit mode
                if (editor.objectOperations.isInGroupEditMode()) {
                    const groupEditMode = editor.objectOperations.getGroupEditMode();
                    const activeGroup = groupEditMode.group;

                    // Calculate world position relative to the active group
                    const groupWorldPos = editor.objectOperations.getObjectWorldPosition(activeGroup);
                    objWorldX = groupWorldPos.x + obj.x;
                    objWorldY = groupWorldPos.y + obj.y;
                } else {
                    // Use standard method for normal mode
                    const objPos = editor.objectOperations.getObjectWorldPosition(obj);
                    objWorldX = objPos.x;
                    objWorldY = objPos.y;
                }

                // For parallax-enabled objects, we need to account for the fact that users see objects
                // at their visual positions (internal + parallax offset). Since cursor coordinates
                // are already in world space, we work with internal coordinates but adjust the logic.
            } else {
                // Fallback to local coordinates if editor not available
                objWorldX = obj.x;
                objWorldY = obj.y;
            }

            // Save relative offset from cursor position (maintains relative positions)
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
    updatePositions: (objects, worldPos) => {
        return DuplicateUtils.updatePositions(objects, worldPos);
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
