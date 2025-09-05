/**
 * Utility class for traversing group hierarchies
 * Centralizes all group traversal operations to eliminate code duplication
 */
export class GroupTraversalUtils {
    /**
     * Get all children from a group recursively (depth-first)
     * @param {Object} group - Group object to traverse
     * @param {boolean} includeGroups - Whether to include group objects in results
     * @returns {Array} Array of all descendant objects
     */
    static getAllChildren(group, includeGroups = true) {
        const result = [];
        
        const walk = (currentGroup) => {
            if (!currentGroup.children || !Array.isArray(currentGroup.children)) {
                return;
            }
            
            for (const child of currentGroup.children) {
                // Add child to results based on filter
                if (child.type !== 'group' || includeGroups) {
                    result.push(child);
                }
                
                // Recursively process child groups
                if (child.type === 'group') {
                    walk(child);
                }
            }
        };
        
        walk(group);
        return result;
    }

    /**
     * Get all objects from top-level array including group children
     * @param {Array} topLevelObjects - Array of top-level objects  
     * @param {boolean} includeGroups - Whether to include group objects in results
     * @returns {Array} Flattened array of all objects
     */
    static getAllObjects(topLevelObjects, includeGroups = true) {
        const result = [];
        
        for (const obj of topLevelObjects) {
            // Add top-level object
            if (obj.type !== 'group' || includeGroups) {
                result.push(obj);
            }
            
            // Add all descendants if it's a group
            if (obj.type === 'group') {
                result.push(...this.getAllChildren(obj, includeGroups));
            }
        }
        
        return result;
    }

    /**
     * Walk through group hierarchy with callback function
     * @param {Object} group - Group to traverse
     * @param {Function} callback - Function called for each object: callback(obj, depth, parent)
     * @param {number} depth - Current depth (for internal use)
     * @param {Object} parent - Parent object (for internal use)
     */
    static walkGroup(group, callback, depth = 0, parent = null) {
        if (!group.children || !Array.isArray(group.children)) {
            return;
        }
        
        for (const child of group.children) {
            // Call callback for current child
            callback(child, depth, group);
            
            // Recursively walk child groups
            if (child.type === 'group') {
                this.walkGroup(child, callback, depth + 1, group);
            }
        }
    }

    /**
     * Walk through top-level objects and all their descendants
     * @param {Array} topLevelObjects - Array of top-level objects
     * @param {Function} callback - Function called for each object: callback(obj, depth, parent)
     */
    static walkAllObjects(topLevelObjects, callback) {
        for (const obj of topLevelObjects) {
            // Call callback for top-level object
            callback(obj, 0, null);
            
            // Walk descendants if it's a group
            if (obj.type === 'group') {
                this.walkGroup(obj, callback, 1, obj);
            }
        }
    }

    /**
     * Find first object matching predicate in group hierarchy
     * @param {Object} group - Group to search in
     * @param {Function} predicate - Function that returns true for matching object
     * @returns {Object|null} First matching object or null
     */
    static findInGroup(group, predicate) {
        if (!group.children || !Array.isArray(group.children)) {
            return null;
        }
        
        for (const child of group.children) {
            if (predicate(child)) {
                return child;
            }
            
            // Search recursively in child groups
            if (child.type === 'group') {
                const found = this.findInGroup(child, predicate);
                if (found) return found;
            }
        }
        
        return null;
    }

    /**
     * Find first object matching predicate in top-level objects and all groups
     * @param {Array} topLevelObjects - Array of top-level objects
     * @param {Function} predicate - Function that returns true for matching object
     * @returns {Object|null} First matching object or null
     */
    static findInObjects(topLevelObjects, predicate) {
        for (const obj of topLevelObjects) {
            if (predicate(obj)) {
                return obj;
            }
            
            if (obj.type === 'group') {
                const found = this.findInGroup(obj, predicate);
                if (found) return found;
            }
        }
        
        return null;
    }

    /**
     * Count objects in group hierarchy
     * @param {Object} group - Group to count in
     * @param {Function} filter - Optional filter function
     * @returns {number} Count of objects
     */
    static countInGroup(group, filter = null) {
        let count = 0;
        
        this.walkGroup(group, (obj) => {
            if (!filter || filter(obj)) {
                count++;
            }
        });
        
        return count;
    }

    /**
     * Get group statistics (children count, depth, etc.)
     * @param {Object} group - Group to analyze
     * @returns {Object} Statistics object
     */
    static getGroupStats(group) {
        let totalChildren = 0;
        let totalGroups = 0;
        let maxDepth = 0;
        
        this.walkGroup(group, (obj, depth) => {
            totalChildren++;
            if (obj.type === 'group') {
                totalGroups++;
            }
            maxDepth = Math.max(maxDepth, depth);
        });
        
        return {
            totalChildren,
            totalGroups,
            totalNonGroups: totalChildren - totalGroups,
            maxDepth
        };
    }

    /**
     * Apply function to all group children (mutating operation)
     * @param {Object} group - Group to process
     * @param {Function} transformer - Function to apply to each child
     */
    static transformGroupChildren(group, transformer) {
        this.walkGroup(group, (obj) => {
            transformer(obj);
        });
    }

    /**
     * Remove objects from group hierarchy based on predicate
     * @param {Object} group - Group to clean
     * @param {Function} shouldRemove - Function that returns true for objects to remove
     * @returns {number} Number of removed objects
     */
    static removeFromGroup(group, shouldRemove) {
        let removedCount = 0;
        
        const cleanChildren = (currentGroup) => {
            if (!currentGroup.children || !Array.isArray(currentGroup.children)) {
                return;
            }
            
            currentGroup.children = currentGroup.children.filter(child => {
                if (shouldRemove(child)) {
                    removedCount++;
                    return false;
                }
                
                // Recursively clean child groups
                if (child.type === 'group') {
                    cleanChildren(child);
                }
                
                return true;
            });
        };
        
        cleanChildren(group);
        return removedCount;
    }
}
