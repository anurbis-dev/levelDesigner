import { GameObject } from './GameObject.js';
import { Logger } from '../utils/Logger.js';
import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';

/**
 * Group object that can contain other objects
 */
export class Group extends GameObject {
    constructor(data = {}) {
        super(data);
        this.type = 'group';
        this.children = data.children || [];
    }

    /**
     * Add child object to group
     */
    addChild(child) {
        // Ensure child is a proper GameObject or Group instance
        let properChild = child;
        if (!(child instanceof GameObject)) {
            if (child.type === 'group') {
                // Create Group instance without circular dependency
                properChild = Object.assign(Object.create(Group.prototype), child);
                properChild.children = child.children || [];
            } else {
                properChild = new GameObject(child);
            }
        }

        // FORCED INHERITANCE: Always inherit layerId from parent group
        if (this.layerId) {
            const oldLayerId = properChild.layerId;
            properChild.layerId = this.layerId;

            // Log forced inheritance
            if (Logger && Logger.currentLevel <= Logger.LEVELS.INFO) {
                Logger.layer.info(`Forced inheritance: ${properChild.name || properChild.id} layerId ${oldLayerId || 'none'} → ${this.layerId}`);
            }

            // If child is a group, propagate layerId to all its children recursively
            if (properChild.type === 'group' && properChild.children) {
                this.propagateLayerIdToChildren(properChild);
            }

            // Clear effective layer cache for this object since its layerId changed
            if (typeof window !== 'undefined' && window.LevelEditor) {
                const editor = window.LevelEditor.getInstance();
                if (editor && editor.renderOperations) {
                    editor.renderOperations.clearEffectiveLayerCacheForObject(properChild.id);
                }
            }
        }

        this.children.push(properChild);
    }

    /**
     * Remove child object from group
     */
    removeChild(childId) {
        this.children = this.children.filter(child => child.id !== childId);
    }

    /**
     * Propagate layerId to all children recursively
     */
    propagateLayerIdToChildren(group = this) {
        if (!group.layerId || !group.children) return;

        group.children.forEach(child => {
            // FORCED INHERITANCE: Always inherit layerId from parent group
            const oldLayerId = child.layerId;
            child.layerId = group.layerId;

            // Log forced inheritance
            if (Logger && Logger.currentLevel <= Logger.LEVELS.INFO) {
                Logger.layer.info(`Propagated inheritance: ${child.name || child.id} layerId ${oldLayerId || 'none'} → ${group.layerId}`);
            }

            // Clear effective layer cache for this child
            if (typeof window !== 'undefined' && window.LevelEditor) {
                const editor = window.LevelEditor.getInstance();
                if (editor && editor.renderOperations) {
                    editor.renderOperations.clearEffectiveLayerCacheForObject(child.id);
                }
            }

            // If child is a group, propagate recursively
            if (child.type === 'group' && child.children) {
                this.propagateLayerIdToChildren(child);
            }
        });
    }

    /**
     * Get all children recursively (flattened)
     */
    getAllChildren() {
        const result = [];
        for (const child of this.children) {
            result.push(child);
            if (child.type === 'group') {
                result.push(...child.getAllChildren());
            }
        }
        return result;
    }

    /**
     * Get world bounds of the group including all children
     * @param {boolean} skipOwnRotation - Return the bounds BEFORE the group's own rotation is
     *        applied (still parent-relative, includes this.x/this.y). Used by frame-drawing
     *        code that needs to rotate an exact (not conservative-AABB) rect as a rigid body.
     */
    getBounds(skipOwnRotation = false) {
        if (this.children.length === 0) {
            return skipOwnRotation
                ? { minX: this.x, minY: this.y, maxX: this.x + this.width, maxY: this.y + this.height }
                : super.getBounds();
        }

        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        for (const child of this.children) {
            // Child bounds are rotation-aware (AABB in the group's local frame)
            const childBounds = child.getBounds();

            bounds.minX = Math.min(bounds.minX, this.x + childBounds.minX);
            bounds.minY = Math.min(bounds.minY, this.y + childBounds.minY);
            bounds.maxX = Math.max(bounds.maxX, this.x + childBounds.maxX);
            bounds.maxY = Math.max(bounds.maxY, this.y + childBounds.maxY);
        }

        if (skipOwnRotation) return bounds;

        // Apply the group's own rotation as conservative AABB rotation
        return WorldPositionUtils.rotateBoundsAroundCenter(bounds, this.rotation || 0);
    }

    /**
     * Check if point is inside any child object
     */
    containsPoint(x, y) {
        for (const child of this.children) {
            const worldX = this.x + child.x;
            const worldY = this.y + child.y;
            if (child.containsPoint(x - worldX, y - worldY)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Clone group with all children
     */
    clone() {
        const cloned = new Group(this);
        cloned.children = this.children.map(child => child.clone());
        return cloned;
    }

    /**
     * Serialize group to JSON
     */
    toJSON() {
        const base = super.toJSON();
        return {
            ...base,
            children: this.children.map(child => child.toJSON())
        };
    }

    /**
     * Create group from JSON data
     */
    static fromJSON(data) {
        const group = new Group(data);
        group.children = data.children ? data.children.map(childData => {
            if (childData.type === 'group') {
                return Group.fromJSON(childData);
            } else {
                return GameObject.fromJSON(childData);
            }
        }) : [];

        // Ensure layerId inheritance is applied after restoring from JSON
        group.propagateLayerIdToChildren();

        return group;
    }
}
