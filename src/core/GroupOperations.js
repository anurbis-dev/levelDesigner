import { BaseModule } from './BaseModule.js';
import { Group } from '../models/Group.js';

/**
 * Group Operations module for LevelEditor
 * Handles all group-related operations
 */
export class GroupOperations extends BaseModule {

    groupSelectedObjects() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        
        // Find all selected objects that are at the top level of the scene hierarchy
        const selectedTopLevelObjects = this.editor.level.objects.filter(obj => selectedObjects.has(obj.id));

        // Grouping makes sense only if there are 2 or more objects selected at the same level
        if (selectedTopLevelObjects.length > 1) {
            // Calculate the bounding box of all selected objects to determine the new group's position
            const bounds = this.editor.objectOperations.getSelectionBounds(selectedTopLevelObjects);
            const mainLayerId = this.editor.level.getMainLayerId();

            // Determine target layer for the new group - use current layer if available
            const currentLayer = this.editor.getCurrentLayer();
            let targetLayerId = currentLayer ? currentLayer.id : (selectedTopLevelObjects[0]?.layerId || mainLayerId);
            
            // Check if target layer is locked, if so find next unlocked layer
            const targetLayer = this.editor.level.getLayerById(targetLayerId);
            if (targetLayer && targetLayer.locked) {
                const layersSorted = this.editor.level.getLayersSorted();
                const currentLayerIndex = layersSorted.findIndex(layer => layer.id === targetLayerId);
                if (currentLayerIndex !== -1) {
                    // Find next unlocked layer
                    for (let i = 0; i < layersSorted.length; i++) {
                        if (!layersSorted[i].locked) {
                            targetLayerId = layersSorted[i].id;
                            break;
                        }
                    }
                }
            }

            const newGroup = new Group({
                name: "New Group",
                x: bounds.minX,
                y: bounds.minY,
                visible: true,
                locked: false,
                layerId: targetLayerId,
                children: []
            });

            const idsToRemove = new Set();
            selectedTopLevelObjects.forEach(obj => {
                idsToRemove.add(obj.id);
                // Create a deep copy of the object to place inside the group
                const newChild = this.editor.deepClone(obj);
                // Recalculate the child's coordinates to be relative to the new group's origin
                newChild.x -= newGroup.x;
                newChild.y -= newGroup.y;

                // FORCED INHERITANCE: Always inherit layerId from parent group
                if (newGroup.layerId) {
                    const oldLayerId = newChild.layerId;
                    newChild.layerId = newGroup.layerId;

                    // Log forced inheritance
                    this.editor.logger?.layer?.info(`Grouping inheritance: ${newChild.name || newChild.id} layerId ${oldLayerId || 'none'} → ${newGroup.layerId}`);

                    // Clear effective layer cache for this child
                    this.editor.renderOperations.clearEffectiveLayerCacheForObject(newChild.id);

                    // If child is a group, propagate layerId to all its children recursively
                    if (newChild.type === 'group' && newChild.children) {
                        newGroup.propagateLayerIdToChildren(newChild);
                    }
                }

                newGroup.children.push(newChild);
            });

            // Remove the original objects from the main level scene
            idsToRemove.forEach(id => {
                this.editor.level.removeObject(id);
            });

            // Add the newly created group to the scene using addObject method
            this.editor.level.addObject(newGroup);

            // Save state AFTER all changes are complete
            this.editor.historyManager.saveState(this.editor.level.objects, new Set([newGroup.id]));

            // Clear the old selection and select only the new group
            this.editor.stateManager.set('selectedObjects', new Set([newGroup.id]));

            // Selective cache invalidation to prevent coordinate glitches
            // Clear effective layer cache for all affected objects
            selectedTopLevelObjects.forEach(obj => {
                this.editor.renderOperations.clearEffectiveLayerCacheForObject(obj.id);
            });
            // Clear cache for new group as well
            this.editor.renderOperations.clearEffectiveLayerCacheForObject(newGroup.id);

            // Clear visible objects cache only for current camera position
            this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

            // Invalidate spatial index since structure changed
            this.editor.renderOperations.invalidateSpatialIndex();

            // Refresh all UI panels and redraw the canvas
            this.editor.render();
            this.editor.updateAllPanels();
        }
    }

    /**
     * Open group edit mode
     */
    openGroupEditMode(group) {
        // Simply mark group as "editing" - don't move children
        group._isEditing = true;

        const current = this.editor.stateManager.get('groupEditMode') || { isActive: false, openGroups: [] };
        const openGroups = Array.isArray(current.openGroups) ? [...current.openGroups, group] : [group];

        this.editor.stateManager.set('groupEditMode', {
            isActive: true,
            groupId: group.id,
            group: group,
            originalChildren: [...group.children], // Keep reference to original children
            openGroups
        });

        // Clear selection
        // Selective cache invalidation for group edit mode
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        this.editor.renderOperations.invalidateSpatialIndex();

        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.render();
        this.editor.updateAllPanels();
    }

    /**
     * Close group edit mode
     */
    closeGroupEditMode() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        if (groupEditMode && groupEditMode.isActive && groupEditMode.group) {
            const group = groupEditMode.group;

            // Simply remove editing flag - children stay where they are
            delete group._isEditing;
            
        }

        // Pop the last opened group
        const openGroups = Array.isArray(groupEditMode.openGroups) ? [...groupEditMode.openGroups] : [];
        const currentGroup = openGroups.length > 0 ? openGroups[openGroups.length - 1] : null;
        openGroups.pop();
        const nextGroup = openGroups.length > 0 ? openGroups[openGroups.length - 1] : null;

        // Update group edit mode state FIRST
        this.editor.stateManager.set('groupEditMode', {
            isActive: openGroups.length > 0,
            groupId: nextGroup ? nextGroup.id : null,
            group: nextGroup,
            originalChildren: nextGroup ? [...nextGroup.children] : [],
            openGroups
        });

        // NOW check if the group that was just closed became empty and remove it
        // (after it's no longer in the protected openGroups list)
        if (currentGroup) {
            const groupWasRemoved = this.removeEmptyGroup(currentGroup);
            if (groupWasRemoved) {
                this.editor.updateAllPanels();
            } else {
            }
        }

        // Selective cache invalidation for closing group edit mode
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        this.editor.renderOperations.invalidateSpatialIndex();

        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.render();
        this.editor.updateAllPanels();
    }

    /**
     * Ungroup selected objects
     */
    ungroupSelectedObjects() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const groupsToUngroup = [];

        // Find selected groups
        selectedObjects.forEach(id => {
            const obj = this.editor.level.findObjectById(id);
            if (obj && obj.type === 'group' && this.editor.level.objects.some(topObj => topObj.id === obj.id)) {
                groupsToUngroup.push(obj);
            }
        });

        if (groupsToUngroup.length === 0) return;

        this.editor.historyManager.saveState(this.editor.level.objects, selectedObjects);

        const newTopLevelObjects = [];

        groupsToUngroup.forEach(group => {
            // Convert children back to world coordinates and prepare them for "move"
            group.children.forEach(child => {
                child.x += group.x;
                child.y += group.y;
                newTopLevelObjects.push(child); // Collect children in separate array
            });

            // ✨ KEY STEP: Empty the group. 
            // Now render, even if triggered, won't draw these children as child objects.
            group.children = []; 
        });

        // Remove old (now empty) groups from main list
        this.editor.level.objects = this.editor.level.objects.filter(obj => {
            // Check if object is not one of our groups
            return !groupsToUngroup.some(group => group.id === obj.id);
        });

        // Add "freed" child objects to top level using addObject method
        newTopLevelObjects.forEach(obj => {
            this.editor.level.addObject(obj);
        });

        // Selective cache invalidation for ungrouping
        // Clear effective layer cache for freed objects
        newTopLevelObjects.forEach(obj => {
            this.editor.renderOperations.clearEffectiveLayerCacheForObject(obj.id);
        });

        // Clear visible objects cache only for current camera position
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

        // Invalidate spatial index since structure changed
        this.editor.renderOperations.invalidateSpatialIndex();

        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.render();
        this.editor.updateAllPanels();
    }

    // Group edit helpers
    getOpenGroups() {
        const gem = this.editor.stateManager.get('groupEditMode');
        return gem?.openGroups || [];
    }

    getActiveEditedGroup() {
        const open = this.getOpenGroups();
        return open.length > 0 ? open[open.length - 1] : null;
    }

    /**
     * Remove a specific group if it's empty
     * @param {Object} targetGroup - The specific group to check and potentially remove
     * @returns {boolean} - True if the group was removed
     */
    removeEmptyGroup(targetGroup) {

        if (!targetGroup || targetGroup.type !== 'group') {
            return false;
        }

        // Fix: Handle case where children is undefined or null
        const childrenArray = targetGroup.children || [];

        // Don't remove if it's not empty
        if (childrenArray.length > 0) {
            return false;
        }

        // Don't remove if it's currently being edited
        const groupEditMode = this.editor.stateManager.get('groupEditMode');

        if (groupEditMode && groupEditMode.openGroups) {
            const isProtected = groupEditMode.openGroups.some(g => g && g.id === targetGroup.id);
            if (isProtected) {
                return false;
            }
        }


        // Check if group actually exists in the level first
        const existsInMainLevel = this.editor.level.objects.some(obj => obj.id === targetGroup.id);

        // Remove from main level
        const initialCount = this.editor.level.objects.length;
        
        this.editor.level.objects = this.editor.level.objects.filter(obj => obj.id !== targetGroup.id);
        const finalCount = this.editor.level.objects.length;
        
        if (finalCount < initialCount) {
            return true; // Group was removed from main level
        }

        // If not found on main level, search in nested groups
        const removeFromNestedGroups = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group' && obj.children) {
                    const beforeCount = obj.children.length;
                    obj.children = obj.children.filter(child => child.id !== targetGroup.id);
                    
                    if (obj.children.length < beforeCount) {
                        return true; // Found and removed
                    }
                    
                    // Recursively search in nested children
                    if (removeFromNestedGroups(obj.children)) {
                        return true;
                    }
                }
            }
            return false;
        };

        const removedFromNested = removeFromNestedGroups(this.editor.level.objects);
        if (!removedFromNested) {
        }
        return removedFromNested;
    }

    /**
     * Remove empty groups from the level automatically
     * Groups that are currently being edited are protected from deletion
     */
    removeEmptyGroups() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        const protectedGroupIds = new Set();
        
        // Protect groups that are currently open for editing
        if (groupEditMode && groupEditMode.openGroups) {
            groupEditMode.openGroups.forEach(group => {
                if (group && group.id) {
                    protectedGroupIds.add(group.id);
                }
            });
        }

        // Track if any groups were removed
        let groupsRemoved = false;

        // Remove empty groups from main level
        const beforeCount = this.editor.level.objects.length;
        this.editor.level.objects = this.editor.level.objects.filter(obj => {
            if (obj.type === 'group' && 
                obj.children && 
                obj.children.length === 0 && 
                !protectedGroupIds.has(obj.id)) {
                return false; // Remove empty group
            }
            return true; // Keep non-empty groups and other objects
        });
        
        if (this.editor.level.objects.length < beforeCount) {
            groupsRemoved = true;
        }

        // Recursively remove empty groups from nested groups
        const removeEmptyNestedGroups = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group' && obj.children) {
                    const beforeNestedCount = obj.children.length;
                    obj.children = obj.children.filter(child => {
                        if (child.type === 'group' && 
                            child.children && 
                            child.children.length === 0 && 
                            !protectedGroupIds.has(child.id)) {
                            return false; // Remove empty nested group
                        }
                        return true; // Keep non-empty groups and other objects
                    });
                    
                    if (obj.children.length < beforeNestedCount) {
                        groupsRemoved = true;
                    }
                    
                    // Recursively check nested groups
                    removeEmptyNestedGroups(obj.children);
                }
            }
        };
        
        removeEmptyNestedGroups(this.editor.level.objects);

        return groupsRemoved;
    }
}
