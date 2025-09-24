import { WorldPositionUtils } from './WorldPositionUtils.js';
import { Logger } from './Logger.js';

/**
 * Snap Utils - Centralized snap to grid logic
 * Handles snapping for single and multiple objects based on bottom-left corner
 */
export class SnapUtils {
    
    /**
     * Snap single object to grid based on bottom-left corner
     * @param {Object} obj - Object to snap
     * @param {number} worldX - World X position
     * @param {number} worldY - World Y position
     * @param {number} gridSize - Grid size in pixels
     * @returns {Object} Snapped coordinates {x, y}
     */
    static snapSingleObject(obj, worldX, worldY, gridSize) {
        // Get actual object dimensions (use real size, not default)
        const objWidth = obj.width || 32;
        const objHeight = obj.height || 32;
        
        // For single object, snap the bottom-left corner
        const bottomLeftX = worldX;
        const bottomLeftY = worldY + objHeight;
        
        const snapped = WorldPositionUtils.snapToGrid(bottomLeftX, bottomLeftY, gridSize);
        
        // Return position adjusted for bottom-left corner snapping
        return {
            x: snapped.x,
            y: snapped.y - objHeight
        };
    }
    
    /**
     * Snap multiple objects to grid based on bottom-left corner of the leftmost object
     * @param {Array} objects - Array of objects to snap
     * @param {number} worldX - World X position (mouse position)
     * @param {number} worldY - World Y position (mouse position)
     * @param {number} gridSize - Grid size in pixels
     * @param {Function} getObjectWorldPosition - Function to get world position of object
     * @returns {Object} Snapped coordinates and offsets {x, y, offsets: [{obj, offsetX, offsetY}]}
     */
    static snapMultipleObjects(objects, worldX, worldY, gridSize, getObjectWorldPosition) {
        if (!objects || objects.length === 0) {
            return { x: worldX, y: worldY, offsets: [] };
        }
        
        // Cache world positions to avoid repeated calculations
        const worldPosCache = new Map();
        const getCachedWorldPosition = (obj) => {
            if (!worldPosCache.has(obj.id)) {
                worldPosCache.set(obj.id, getObjectWorldPosition(obj));
            }
            return worldPosCache.get(obj.id);
        };
        
        // Find the leftmost object's bottom-left corner
        let leftmostBottomLeftX = Infinity;
        let leftmostBottomLeftY = Infinity;
        let leftmostObj = null;
        
        objects.forEach(obj => {
            const objWorldPos = getCachedWorldPosition(obj);
            const objHeight = obj.height || 32;
            const bottomLeftX = objWorldPos.x;
            const bottomLeftY = objWorldPos.y + objHeight;
            
            if (bottomLeftX < leftmostBottomLeftX || 
                (bottomLeftX === leftmostBottomLeftX && bottomLeftY < leftmostBottomLeftY)) {
                leftmostBottomLeftX = bottomLeftX;
                leftmostBottomLeftY = bottomLeftY;
                leftmostObj = obj;
            }
        });
        
        if (!leftmostObj) {
            return { x: worldX, y: worldY, offsets: [] };
        }
        
        // Snap the leftmost bottom-left corner to grid
        const snappedCorner = WorldPositionUtils.snapToGrid(leftmostBottomLeftX, leftmostBottomLeftY, gridSize);
        
        // Calculate offset from original position to snapped corner
        const offsetX = snappedCorner.x - leftmostBottomLeftX;
        const offsetY = snappedCorner.y - leftmostBottomLeftY;
        
        // Calculate relative offsets for all objects using cached positions
        const offsets = objects.map(obj => {
            const objWorldPos = getCachedWorldPosition(obj);
            const objHeight = obj.height || 32;
            const objBottomLeftX = objWorldPos.x;
            const objBottomLeftY = objWorldPos.y + objHeight;
            
            return {
                obj,
                offsetX: (objBottomLeftX - leftmostBottomLeftX) + offsetX,
                offsetY: (objBottomLeftY - leftmostBottomLeftY) + offsetY
            };
        });
        
        // Return snapped mouse position and offsets for all objects
        return {
            x: worldX + offsetX,
            y: worldY + offsetY,
            offsets
        };
    }
    
    /**
     * Snap objects during drag operation
     * @param {Set} selectedObjects - Set of selected object IDs
     * @param {number} worldX - World X position (mouse position)
     * @param {number} worldY - World Y position (mouse position)
     * @param {number} gridSize - Grid size in pixels
     * @param {Function} findObjectById - Function to find object by ID
     * @param {Function} getObjectWorldPosition - Function to get world position of object
     * @returns {Object} Snapped coordinates {x, y}
     */
    static snapDragObjects(selectedObjects, worldX, worldY, gridSize, findObjectById, getObjectWorldPosition) {
        if (!selectedObjects || selectedObjects.size === 0) {
            return { x: worldX, y: worldY };
        }
        
        if (selectedObjects.size === 1) {
            // Single object - get the object and snap its bottom-left corner
            const objId = Array.from(selectedObjects)[0];
            const obj = findObjectById(objId);
            if (!obj) {
                return { x: worldX, y: worldY };
            }
            
            return this.snapSingleObject(obj, worldX, worldY, gridSize);
        } else {
            // Multiple objects - find leftmost bottom-left corner
            // Use cached world position function to avoid repeated calculations
            const objects = Array.from(selectedObjects)
                .map(id => findObjectById(id))
                .filter(Boolean);
            
            return this.snapMultipleObjects(objects, worldX, worldY, gridSize, getObjectWorldPosition);
        }
    }
    
    /**
     * Find nearest grid point within tolerance
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} gridSize - Grid size
     * @param {number} tolerance - Snap tolerance in pixels
     * @returns {Object|null} Nearest grid point {x, y} or null if none within tolerance
     */
    static findNearestGridPoint(x, y, gridSize, tolerance) {
        // Calculate grid-aligned positions
        const gridX = Math.round(x / gridSize) * gridSize;
        const gridY = Math.round(y / gridSize) * gridSize;
        
        // Check if within tolerance
        const distance = Math.sqrt(Math.pow(x - gridX, 2) + Math.pow(y - gridY, 2));
        
        if (distance <= tolerance) {
            return { x: gridX, y: gridY };
        }
        
        return null;
    }

    /**
     * Snap objects during duplication
     * @param {Array} duplicateObjects - Array of duplicate objects
     * @param {number} worldX - World X position (mouse position)
     * @param {number} worldY - World Y position (mouse position)
     * @param {number} gridSize - Grid size in pixels
     * @param {Function} getObjectWorldPosition - Function to get world position of object
     * @returns {Object} Snapped coordinates and offsets {x, y, offsets: [{obj, offsetX, offsetY}]}
     */
    static snapDuplicateObjects(duplicateObjects, worldX, worldY, gridSize, getObjectWorldPosition) {
        if (!duplicateObjects || duplicateObjects.length === 0) {
            return { x: worldX, y: worldY, offsets: [] };
        }
        
        if (duplicateObjects.length === 1) {
            // Single object - snap its bottom-left corner
            const obj = duplicateObjects[0];
            const snapped = this.snapSingleObject(obj, worldX, worldY, gridSize);
            return {
                x: snapped.x,
                y: snapped.y,
                offsets: [{ obj, offsetX: 0, offsetY: 0 }]
            };
        } else {
            // Multiple objects - find leftmost bottom-left corner
            return this.snapMultipleObjects(duplicateObjects, worldX, worldY, gridSize, getObjectWorldPosition);
        }
    }
    
    /**
     * Snap objects during drop operation
     * @param {Array} objects - Array of objects to snap
     * @param {number} worldX - World X position (mouse position)
     * @param {number} worldY - World Y position (mouse position)
     * @param {number} gridSize - Grid size in pixels
     * @returns {Object} Snapped coordinates {x, y}
     */
    static snapDropObjects(objects, worldX, worldY, gridSize) {
        if (!objects || objects.length === 0) {
            return { x: worldX, y: worldY };
        }
        
        if (objects.length === 1) {
            // Single object - snap its bottom-left corner
            const obj = objects[0];
            return this.snapSingleObject(obj, worldX, worldY, gridSize);
        } else {
            // Multiple objects - snap based on first object's bottom-left corner
            // For drop, we use the mouse position as reference
            const firstObj = objects[0];
            const snapped = this.snapSingleObject(firstObj, worldX, worldY, gridSize);
            
            // Calculate offsets for other objects relative to first object
            const offsets = objects.map((obj, index) => {
                const offsetX = index * 10; // Default spacing
                const offsetY = index * 10;
                return {
                    obj,
                    offsetX: offsetX,
                    offsetY: offsetY
                };
            });
            
            return {
                x: snapped.x,
                y: snapped.y,
                offsets
            };
        }
    }
    
    /**
     * Check if snap to grid is enabled
     * @param {Object} stateManager - State manager instance
     * @param {Object} level - Level instance
     * @returns {boolean} True if snap to grid is enabled
     */
    static isSnapToGridEnabled(stateManager, level) {
        const snapToGrid = stateManager.get('canvas.snapToGrid') ?? level.settings.snapToGrid;
        const ctrlSnapToGrid = stateManager.get('keyboard.ctrlSnapToGrid');
        return snapToGrid || ctrlSnapToGrid;
    }
    
    /**
     * Get grid size from state or level settings
     * @param {Object} stateManager - State manager instance
     * @param {Object} level - Level instance
     * @returns {number} Grid size in pixels
     */
    static getGridSize(stateManager, level) {
        // Always use current grid size from StateManager first (dynamic changes)
        const currentGridSize = stateManager.get('canvas.gridSize');
        if (currentGridSize !== undefined && currentGridSize !== null) {
            return currentGridSize;
        }
        
        // Fallback to level settings if StateManager doesn't have it
        return level?.settings?.gridSize || 32;
    }
}
