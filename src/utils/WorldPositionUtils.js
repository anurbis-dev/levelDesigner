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
     * Get AABB of a rectangle rotated around its center
     * @param {number} x - Top-left X
     * @param {number} y - Top-left Y
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} deg - Rotation in degrees
     * @returns {Object} Bounds {minX, minY, maxX, maxY}
     */
    static getRotatedRectAABB(x, y, w, h, deg) {
        if (!deg) {
            return { minX: x, minY: y, maxX: x + w, maxY: y + h };
        }
        const rad = deg * Math.PI / 180;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const hw = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h) / 2;
        const hh = (Math.abs(Math.sin(rad)) * w + Math.abs(Math.cos(rad)) * h) / 2;
        return { minX: cx - hw, minY: cy - hh, maxX: cx + hw, maxY: cy + hh };
    }

    /**
     * Rotate an AABB around its own center (conservative approximation)
     * @param {Object} bounds - Bounds {minX, minY, maxX, maxY}
     * @param {number} deg - Rotation in degrees
     * @returns {Object} Rotated bounds
     */
    static rotateBoundsAroundCenter(bounds, deg) {
        if (!deg || bounds.minX === Infinity) return bounds;
        return this.getRotatedRectAABB(
            bounds.minX, bounds.minY,
            bounds.maxX - bounds.minX, bounds.maxY - bounds.minY,
            deg
        );
    }

    /**
     * Get world bounds of an object or group (rotation-aware, AABB)
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
            return this.getRotatedRectAABB(pos.x, pos.y, obj.width || 0, obj.height || 0, obj.rotation || 0);
        }

        // Group object - calculate bounds from all children.
        // Bounds relative to the group's parent frame: includes group.x/group.y
        // and the group's own rotation (applied as conservative AABB rotation).
        const localBounds = (current) => {
            if (excludeIds.includes(current.id)) {
                return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            }

            if (current.type !== 'group' || !current.children) {
                return this.getRotatedRectAABB(current.x, current.y, current.width || 0, current.height || 0, current.rotation || 0);
            }

            let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            for (const child of current.children) {
                const cb = localBounds(child);
                if (cb.minX === Infinity) continue;
                bounds.minX = Math.min(bounds.minX, current.x + cb.minX);
                bounds.minY = Math.min(bounds.minY, current.y + cb.minY);
                bounds.maxX = Math.max(bounds.maxX, current.x + cb.maxX);
                bounds.maxY = Math.max(bounds.maxY, current.y + cb.maxY);
            }

            // If group has no visible children, use its own position
            if (bounds.minX === Infinity) {
                bounds = { minX: current.x, minY: current.y, maxX: current.x, maxY: current.y };
            }

            return this.rotateBoundsAroundCenter(bounds, current.rotation || 0);
        };

        const groupPos = this.getWorldPosition(obj, levelObjects);
        const bounds = localBounds(obj);

        // Shift from parent-local frame to world frame
        const offsetX = groupPos.x - obj.x;
        const offsetY = groupPos.y - obj.y;
        return {
            minX: bounds.minX + offsetX,
            minY: bounds.minY + offsetY,
            maxX: bounds.maxX + offsetX,
            maxY: bounds.maxY + offsetY
        };
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
        // Precise test for rotated simple objects: inverse-rotate the point
        // around the object's center and test against the unrotated rect
        if (obj.type !== 'group' && obj.rotation) {
            const pos = this.getWorldPosition(obj, levelObjects);
            const w = obj.width || 0;
            const h = obj.height || 0;
            const cx = pos.x + w / 2;
            const cy = pos.y + h / 2;
            const rad = -obj.rotation * Math.PI / 180;
            const dx = x - cx;
            const dy = y - cy;
            const lx = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
            const ly = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
            return lx >= pos.x && lx <= pos.x + w && ly >= pos.y && ly <= pos.y + h;
        }

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
