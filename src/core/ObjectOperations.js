import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { BaseModule } from './BaseModule.js';

/**
 * Object Operations module for LevelEditor
 * Handles all object manipulation operations
 */
export class ObjectOperations extends BaseModule {

    /**
     * Object manipulation methods
     */
    findObjectAtPoint(x, y) {
        // In group edit mode, search through all objects including nested ones
        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
           const openGroups = Array.isArray(groupEditMode.openGroups) ? groupEditMode.openGroups : (groupEditMode.group ? [groupEditMode.group] : []);
           const openIds = new Set(openGroups.map(g => g.id));
           const selectable = this.computeSelectableSet();

           // 1) Groups first (excluding ALL open groups)
           const allGroups = this.editor.level.getAllObjects().filter(o => o.type === 'group' && !openIds.has(o.id) && selectable.has(o.id));
           for (const grp of [...allGroups].reverse()) {
               if (this.isPointInObject(x, y, grp)) return grp;
           }
           
           // 2) External objects (not in any open group)
           const externalObjects = this.editor.level.objects.filter(o => o.type !== 'group' && selectable.has(o.id));
           for (const obj of [...externalObjects].reverse()) {
               if (this.isPointInObject(x, y, obj)) return obj;
           }
           
           // 3) Then descendants of the deepest open group
           const activeGroup = openGroups.length > 0 ? openGroups[openGroups.length - 1] : null;
           if (activeGroup) {
               const collect = (g) => {
                   const res = [];
                   g.children.forEach(ch => {
                       res.push(ch);
                       if (ch.type === 'group') res.push(...collect(ch));
                   });
                   return res;
               };
               const descendants = collect(activeGroup).filter(o => selectable.has(o.id));
               for (const obj of [...descendants].reverse()) {
                   if (this.isPointInObject(x, y, obj)) return obj;
               }
           }
           return null;
       }

       // Normal mode - hit-test groups first (highest priority) among top-level
       const selectable = this.computeSelectableSet();
       const topLevelGroups = this.editor.level.objects.filter(o => o.type === 'group' && selectable.has(o.id));
       for (const grp of [...topLevelGroups].reverse()) {
           if (this.isPointInObject(x, y, grp)) return grp;
       }

       // Then hit-test top-level non-group objects
       const topLevelObjects = this.editor.level.objects.filter(o => o.type !== 'group' && selectable.has(o.id));
       for (const obj of [...topLevelObjects].reverse()) {
           if (this.isPointInObject(x, y, obj)) {
               return obj;
           }
       }

       return null;
    }

    isPointInObject(x, y, obj) {
        return WorldPositionUtils.isPointInWorldBounds(x, y, obj, this.editor.level.objects);
    }

    isPointInGroupBounds(x, y, groupEditMode = null) {
        // Use provided groupEditMode or get current one
        const gem = groupEditMode || this.getGroupEditMode();
        if (!gem) return false;

        const group = gem.group;
        const bounds = WorldPositionUtils.getWorldBounds(group, this.editor.level.objects);

        // Add some padding to make it easier to drop inside (same as visual frame)
        const padding = 10;
        return x >= bounds.minX - padding && x <= bounds.maxX + padding &&
               y >= bounds.minY - padding && y <= bounds.maxY + padding;
    }

    getObjectCenterWorld(obj, parentGroup = null) {
        if (parentGroup) {
            const parentPos = WorldPositionUtils.getWorldPosition(parentGroup, this.editor.level.objects);
            return {
                x: parentPos.x + obj.x + (obj.width || 0) / 2,
                y: parentPos.y + obj.y + (obj.height || 0) / 2
            };
        }
        return WorldPositionUtils.getWorldCenter(obj, this.editor.level.objects);
    }

    getObjectWorldPosition(target) {
        return WorldPositionUtils.getWorldPosition(target, this.editor.level.objects);
    }

    isObjectInGroup(obj, group) {
        return group.children.some(child => child.id === obj.id);
    }

    getObjectWorldBounds(obj, excludeIds = []) {
        return WorldPositionUtils.getWorldBounds(obj, this.editor.level.objects, excludeIds);
    }

    /**
     * Object operations
     */
    deleteSelectedObjects() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        if (selectedObjects.size === 0) return;

        this.editor.historyManager.saveState(this.editor.level.objects);

        // Delete selected objects - they can be on main level or inside groups
        const idsToDelete = new Set(selectedObjects);

        // Filter out Player Start objects - they cannot be deleted
        for (const obj of this.editor.level.objects) {
            if (obj.type === 'player_start' && idsToDelete.has(obj.id)) {
                console.log(`[OBJECT OPERATIONS DEBUG] 🚫 Player Start object cannot be deleted: ${obj.name} (ID: ${obj.id})`);
                idsToDelete.delete(obj.id);
            }
        }

        console.log(`[OBJECT OPERATIONS DEBUG] 🗑️ Starting deletion of ${idsToDelete.size} selected objects (Player Start objects filtered out)`);

        // First, collect all objects that need to be deleted (including children of deleted groups)
        const collectObjectsToDelete = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group') {
                    // If this group is being deleted, add all its children to deletion set
                    if (idsToDelete.has(obj.id)) {
                        console.log(`[OBJECT OPERATIONS DEBUG] 📦 Group ${obj.name} is being deleted, marking all children for deletion`);
                        obj.children.forEach(child => {
                            // Skip Player Start objects
                            if (child.type !== 'player_start') {
                                console.log(`[OBJECT OPERATIONS DEBUG] ➕ Adding child ${child.name} (ID: ${child.id}) to deletion set`);
                                idsToDelete.add(child.id);
                            } else {
                                console.log(`[OBJECT OPERATIONS DEBUG] 🚫 Skipping Player Start child: ${child.name} (ID: ${child.id})`);
                            }
                        });
                    } else {
                        // Process children recursively for groups that are not being deleted
                        collectObjectsToDelete(obj.children);
                    }
                }
            }
        };

        // Collect all objects to delete
        collectObjectsToDelete(this.editor.level.objects);

        // Extract Player Start objects from groups that are being deleted
        this.extractPlayerStartFromGroups(idsToDelete);

        // Now remove all collected objects from everywhere they might be
        const removeFromArrays = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group') {
                    // Remove deleted children from this group's children array
                    const originalCount = obj.children.length;
                    obj.children = obj.children.filter(child => !idsToDelete.has(child.id));
                    const removedCount = originalCount - obj.children.length;
                    if (removedCount > 0) {
                        console.log(`[OBJECT OPERATIONS DEBUG] 🧹 Removed ${removedCount} children from group ${obj.name}`);
                    }

                    // Process nested groups
                    removeFromArrays(obj.children);
                }
            }
        };

        // Remove objects from all nested arrays
        removeFromArrays(this.editor.level.objects);

        // Remove all collected objects from main level
        console.log(`[OBJECT OPERATIONS DEBUG] 🗑️ Final deletion set has ${idsToDelete.size} objects:`, Array.from(idsToDelete));
        const originalCount = this.editor.level.objects.length;
        this.editor.level.objects = this.editor.level.objects.filter(obj => !idsToDelete.has(obj.id));
        const removedCount = originalCount - this.editor.level.objects.length;

        console.log(`[OBJECT OPERATIONS DEBUG] ✅ Removed ${removedCount} objects from main level`);

        // Clean up any empty groups that might remain after deletion
        console.log(`[OBJECT OPERATIONS DEBUG] 🧹 Cleaning up empty groups...`);
        const emptyGroupsRemoved = this.editor.groupOperations.removeEmptyGroups();
        if (emptyGroupsRemoved > 0) {
            console.log(`[OBJECT OPERATIONS DEBUG] ✅ Removed ${emptyGroupsRemoved} empty groups`);
        } else {
            console.log(`[OBJECT OPERATIONS DEBUG] ℹ️ No empty groups to remove`);
        }

        // Clear selection and update UI AFTER all operations are complete
        this.editor.stateManager.set('selectedObjects', new Set());
        this.editor.render();
        this.editor.updateAllPanels();
    }

    duplicateSelectedObjects() {
        this.editor.duplicateOperations.startFromSelection();
    }

    focusOnSelection() {
        const selection = this.getSelectedObjects();
        this.focusOnBounds(this.getSelectionBounds(selection));
    }

    focusOnAll() {
        this.focusOnBounds(this.getSelectionBounds(this.editor.level.objects));
    }

    // These methods are now inherited from BaseModule and automatically trigger render
    focusOnBounds(bounds) {
        super.focusOnBounds(bounds);
        this.editor.render();
    }

    // Compute a set of selectable IDs depending on current edit state
    computeSelectableSet() {
        const selectable = new Set();

        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            // Only descendants of the deepest open group are selectable; all other open groups are transparent
            const openGroups = Array.isArray(groupEditMode.openGroups) ? groupEditMode.openGroups : (groupEditMode.group ? [groupEditMode.group] : []);
            const active = openGroups[openGroups.length - 1];
            if (active) {
                const collect = (g) => {
                    const res = [];
                    g.children.forEach(ch => {
                        res.push(ch);
                        if (ch.type === 'group') res.push(...collect(ch));
                    });
                    return res;
                };
                collect(active).forEach(o => selectable.add(o.id));
            }
            // All non-open groups on any level are still selectable (priority for groups), exclude open ones
            const openIds = new Set(openGroups.map(g => g.id));
            this.editor.level.getAllObjects().forEach(o => {
                if (o.type === 'group' && !openIds.has(o.id)) selectable.add(o.id);
            });
            // Also allow selection of external objects (not in any open group)
            this.editor.level.objects.forEach(o => {
                if (o.type !== 'group') selectable.add(o.id);
            });
        } else {
            // Normal mode: only top-level objects selectable
            this.editor.level.objects.forEach(o => selectable.add(o.id));
        }
        return selectable;
    }

    /**
     * Extract Player Start objects from groups that are being deleted
     * @param {Set} idsToDelete - Set of object IDs to be deleted
     */
    extractPlayerStartFromGroups(idsToDelete) {
        const extractFromGroup = (group, parentObjects, parentIndex = -1) => {
            if (!group.children || group.children.length === 0) return;

            for (let i = group.children.length - 1; i >= 0; i--) {
                const child = group.children[i];

                if (child.type === 'player_start') {
                    console.log(`[OBJECT OPERATIONS DEBUG] 🚀 Extracting Player Start ${child.name} from group ${group.name}`);

                    // Calculate world position before extraction
                    const groupPos = this.editor.objectOperations.getObjectWorldPosition(group);
                    child.x += groupPos.x;
                    child.y += groupPos.y;

                    // Remove from group
                    group.children.splice(i, 1);

                    // Add to parent level
                    if (parentIndex >= 0 && parentObjects) {
                        // Insert at the position where the group was
                        parentObjects.splice(parentIndex + 1, 0, child);
                    } else {
                        // Add to main level
                        this.editor.level.objects.push(child);
                    }

                    console.log(`[OBJECT OPERATIONS DEBUG] ✅ Player Start extracted to ${parentObjects ? 'parent level' : 'main level'}`);
                } else if (child.type === 'group') {
                    // Recursively process nested groups
                    extractFromGroup(child, group.children, i);
                }
            }
        };

        // Process all top-level objects
        for (let i = this.editor.level.objects.length - 1; i >= 0; i--) {
            const obj = this.editor.level.objects[i];

            if (obj.type === 'group' && idsToDelete.has(obj.id)) {
                // This group is being deleted, extract Player Start objects
                extractFromGroup(obj, this.editor.level.objects, i);
            }
        }
    }
}
