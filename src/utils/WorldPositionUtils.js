/**
 * Utility class for world position calculations
 * Centralizes logic for getting world coordinates of objects and groups
 */
export class WorldPositionUtils {
    /**
     * Get world position of an object (including nested groups)
     * @param {Object} target - Object to find world position for
     * @param {Array} levelObjects - Top-level objects array
     * @returns {Object} World position {x, y}
     */
    static getWorldPosition(target, levelObjects) {
        let result = null;
        
        const dfs = (current, accX, accY) => {
            if (current.id === target.id) {
                result = { x: accX + current.x, y: accY + current.y };
                return true;
            }
            if (current.type === 'group' && current.children) {
                const nextX = accX + current.x;
                const nextY = accY + current.y;
                for (const child of current.children) {
                    if (dfs(child, nextX, nextY)) return true;
                }
            }
            return false;
        };
        
        for (const topObject of levelObjects) {
            if (dfs(topObject, 0, 0)) break;
        }
        
        // If not found in hierarchy, return object's local position
        return result || { x: target.x || 0, y: target.y || 0 };
    }

    /**
     * Get world bounds of an object or group
     * @param {Object} obj - Object to get bounds for
     * @param {Array} levelObjects - Top-level objects array
     * @param {Array} excludeIds - IDs to exclude from bounds calculation
     * @returns {Object} Bounds {minX, minY, maxX, maxY}
     */
    static getWorldBounds(obj, levelObjects, excludeIds = []) {
        // Skip if object is in exclude list
        if (excludeIds.includes(obj.id)) {
            return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        }

        if (obj.type !== 'group') {
            // Simple object - get its world position and add dimensions
            const pos = this.getWorldPosition(obj, levelObjects);
            return {
                minX: pos.x,
                minY: pos.y,
                maxX: pos.x + (obj.width || 0),
                maxY: pos.y + (obj.height || 0)
            };
        }

        // Group object - calculate bounds from all children
        const groupPos = this.getWorldPosition(obj, levelObjects);
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        const walkChildren = (current, baseX, baseY) => {
            // Skip if this object is in exclude list
            if (excludeIds.includes(current.id)) {
                return;
            }

            if (current.type === 'group' && current.children) {
                const nextX = baseX + current.x;
                const nextY = baseY + current.y;

                let hasVisibleChildren = false;
                for (const child of current.children) {
                    if (!excludeIds.includes(child.id)) {
                        hasVisibleChildren = true;
                        walkChildren(child, nextX, nextY);
                    }
                }

                // If group has no visible children, use its own position
                if (!hasVisibleChildren) {
                    bounds.minX = Math.min(bounds.minX, nextX);
                    bounds.minY = Math.min(bounds.minY, nextY);
                    bounds.maxX = Math.max(bounds.maxX, nextX);
                    bounds.maxY = Math.max(bounds.maxY, nextY);
                }
                return;
            }

            // Regular object
            const absX = baseX + current.x;
            const absY = baseY + current.y;
            bounds.minX = Math.min(bounds.minX, absX);
            bounds.minY = Math.min(bounds.minY, absY);
            bounds.maxX = Math.max(bounds.maxX, absX + (current.width || 0));
            bounds.maxY = Math.max(bounds.maxY, absY + (current.height || 0));
        };

        // Start walking from the group's world position
        walkChildren(obj, groupPos.x - obj.x, groupPos.y - obj.y);
        
        // If no valid bounds found, use group's position
        if (bounds.minX === Infinity) {
            bounds.minX = groupPos.x;
            bounds.minY = groupPos.y;
            bounds.maxX = groupPos.x;
            bounds.maxY = groupPos.y;
        }

        return bounds;
    }

    /**
     * Get center point of an object in world coordinates
     * @param {Object} obj - Object to get center for
     * @param {Array} levelObjects - Top-level objects array
     * @returns {Object} Center position {x, y}
     */
    static getWorldCenter(obj, levelObjects) {
        const pos = this.getWorldPosition(obj, levelObjects);
        return {
            x: pos.x + (obj.width || 0) / 2,
            y: pos.y + (obj.height || 0) / 2
        };
    }

    /**
     * Check if a point is inside object bounds in world coordinates
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     * @param {Object} obj - Object to check
     * @param {Array} levelObjects - Top-level objects array
     * @returns {boolean} True if point is inside object
     */
    static isPointInWorldBounds(x, y, obj, levelObjects) {
        const bounds = this.getWorldBounds(obj, levelObjects);
        return x >= bounds.minX && x <= bounds.maxX && 
               y >= bounds.minY && y <= bounds.maxY;
    }

    /**
     * Snap coordinates to grid
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} gridSize - Grid size in pixels
     * @returns {Object} Snapped coordinates {x, y}
     */
    static snapToGrid(x, y, gridSize) {
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }
}
