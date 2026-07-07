import { BaseModule } from './BaseModule.js';
import { Group } from '../models/Group.js';
import { Logger } from '../utils/Logger.js';
import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';

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
                // CRITICAL FIX: Assign new unique ID to prevent phantom objects
                this.editor.reassignIdsDeep(newChild);
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

            // CRITICAL FIX: Invalidate spatial index BEFORE removing objects
            this.editor.renderOperations.invalidateSpatialIndex();

            // Remove the original objects from the main level scene
            // This will also remove them from the index automatically
            idsToRemove.forEach(id => {
                // CRITICAL FIX: Clear cache for removed objects to prevent phantom references
                this.editor.invalidateObjectCaches(id);
                this.editor.level.removeObject(id);
            });

            // Add the newly created group to the scene using addObject method
            this.editor.level.addObject(newGroup);

            // CRITICAL FIX: Don't add group children to index - they are already in the group
            // Adding them to index causes getAllObjects() to find them twice
            // this.editor.level.addGroupObjectsToIndex(newGroup); // REMOVED: causes duplicate objects

            // CRITICAL FIX: Clear cache for new group and its children to ensure fresh references
            this.editor.invalidateObjectCaches(newGroup.id);
            newGroup.children.forEach(child => {
                this.editor.invalidateObjectCaches(child.id);
            });

            // Save state AFTER all changes are complete
            this.editor.historyManager.saveState(
                this.editor.level.objects, 
                new Set([newGroup.id]), 
                false, 
                this.editor.stateManager.get('groupEditMode')
            );

            // Selective cache invalidation to prevent coordinate glitches
            // Clear effective layer cache for all affected objects
            selectedTopLevelObjects.forEach(obj => {
                this.editor.renderOperations.clearEffectiveLayerCacheForObject(obj.id);
            });
            // Clear cache for new group as well
            this.editor.renderOperations.clearEffectiveLayerCacheForObject(newGroup.id);

            // CRITICAL FIX: Clear all caches to prevent phantom object references
            this.editor.clearCaches();

            // Clear visible objects cache only for current camera position
            this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

            // Invalidate spatial index since structure changed; lazy rebuild on next render
            this.editor.renderOperations.invalidateSpatialIndex();
            this.editor.renderOperations.markSpatialIndexDirty();

            // Clear the old selection and select only the new group. set() synchronously
            // fires the 'selectedObjects' subscriber (EventHandlers.setupStateListeners),
            // which already calls render()+updateAllPanels() — calling them again here
            // was a duplicate full render/panel pass on every group.
            this.editor.stateManager.set('selectedObjects', new Set([newGroup.id]));
            Logger.status.success(`Grouped ${selectedTopLevelObjects.length} objects`);
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

        // set() synchronously triggers the 'selectedObjects' subscriber, which already
        // calls render()+updateAllPanels() — no separate call needed here.
        this.editor.stateManager.set('selectedObjects', new Set());
        Logger.status.info(`Editing group "${group.name || 'Group'}"`);
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
        // (after it's no longer in the protected openGroups list). removeEmptyGroup() now
        // goes through level.removeObjects(), which notifies panels reactively — plus the
        // set('selectedObjects', ...) a few lines below already triggers a full panel
        // refresh regardless — so no separate updateAllPanels() call is needed here.
        if (currentGroup) {
            this.removeEmptyGroup(currentGroup);
        }

        // Selective cache invalidation for closing group edit mode
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        this.editor.renderOperations.invalidateSpatialIndex();

        // set() synchronously triggers the 'selectedObjects' subscriber, which already
        // calls render()+updateAllPanels() — no separate call needed here.
        this.editor.stateManager.set('selectedObjects', new Set());
        Logger.status.info('Exited group edit mode');
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

        const newTopLevelObjects = [];

        groupsToUngroup.forEach(group => {
            // CRITICAL FIX: Remove group from index BEFORE processing children
            this.editor.level.removeObjectFromIndex(group.id);

            // Extract each child via extractObjectFromGroup so its exact visual transform
            // (world position + rotation) is preserved even when the group itself is rotated.
            // This also adds each child to the level as a top-level object.
            const children = [...group.children];
            children.forEach(child => {
                // isTopLevelGroup: groupsToUngroup is already filtered to level-root groups
                // above, so this skips the redundant O(level size) ancestor searches per child.
                this.extractObjectFromGroup(group, child, { saveState: false, isTopLevelGroup: true });
                newTopLevelObjects.push(child);
            });
        });

        // Remove old (now empty) groups from main list
        this.editor.level.removeObjects(groupsToUngroup.map(group => group.id));

        // Save state AFTER all changes are complete (mirrors groupSelectedObjects) so the
        // undo stack top reflects the actual post-ungroup objects array. Saving before the
        // mutation (as this used to) pushed a snapshot equal to the already-current top of
        // stack, got deduped by the "state hasn't changed" check below, and silently ate the
        // checkpoint — a subsequent Group→Ungroup→Undo then skipped straight past the ungroup.
        this.editor.historyManager.saveState(
            this.editor.level.objects,
            new Set(),
            false,
            this.editor.stateManager.get('groupEditMode')
        );

        // Selective cache invalidation for ungrouping
        // Clear effective layer cache for freed objects
        newTopLevelObjects.forEach(obj => {
            this.editor.renderOperations.clearEffectiveLayerCacheForObject(obj.id);
        });

        // Clear visible objects cache only for current camera position
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

        // Invalidate spatial index since structure changed
        this.editor.renderOperations.invalidateSpatialIndex();

        // set() synchronously triggers the 'selectedObjects' subscriber, which already
        // calls render()+updateAllPanels() — no separate call needed here.
        this.editor.stateManager.set('selectedObjects', new Set());
        Logger.status.success(`Ungrouped ${groupsToUngroup.length} group${groupsToUngroup.length > 1 ? 's' : ''}`);
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
     * Capture the G-local pivot of `group` and every ROTATED ancestor above it, up to
     * the root. MUST be called before any structural change (child add/remove) anywhere
     * in that ancestor chain.
     *
     * Why the whole chain and not just `group`: applyGroupPivotCompensation(group, pOld)
     * cancels drift for GROUP's OWN children by adjusting group.x/y — but that x/y
     * adjustment is itself a "child moved" event from GROUP's PARENT's point of view
     * (parent's own pivot = center of ITS children's bounds, one of which is `group`).
     * Left uncompensated, a rotated grandparent (or higher) would visibly nudge its
     * OTHER children whenever a nested group's structure changes below it.
     *
     * @param {Object} group - Starting group (included in the result if it has rotation)
     * @param {Object} [options]
     * @param {boolean} [options.isTopLevelGroup=false] - Skip the ancestor climb (each step
     *   is an O(level size) tree search via _findParentGroup) when the caller already knows
     *   `group` sits at the level root and therefore has no ancestors to capture.
     * @returns {Array<{group, pOld, depth}>} innermost (group itself) → outermost
     */
    _captureAncestorPivots(group, { isTopLevelGroup = false } = {}) {
        const result = [];
        if (group.rotation) {
            result.push({ group, pOld: WorldPositionUtils.getGroupLocalPivot(group), depth: 0 });
        }
        if (isTopLevelGroup) return result;

        let cur = this._findParentGroup(group);
        let depth = 1;
        while (cur) {
            if (cur.rotation) {
                result.push({ group: cur, pOld: WorldPositionUtils.getGroupLocalPivot(cur), depth });
            }
            cur = this._findParentGroup(cur);
            depth++;
        }
        return result;
    }

    /**
     * Merge multiple _captureAncestorPivots() results (e.g. a source group's chain and a
     * target group's chain that share an ancestor), deduplicating by group id and
     * ordering deepest-first — so a shared ancestor is compensated exactly once, after
     * BOTH branches below it have already settled.
     * @param {...Array<{group, pOld, depth}>} lists
     */
    _mergeAncestorPivots(...lists) {
        const byId = new Map();
        lists.flat().forEach(entry => {
            if (!byId.has(entry.group.id)) byId.set(entry.group.id, entry);
        });
        return [...byId.values()].sort((a, b) => b.depth - a.depth);
    }

    /**
     * Apply pivot compensation to each captured entry, in the given order (must be
     * innermost/deepest → outermost — see _captureAncestorPivots).
     */
    _applyAncestorPivotCompensations(captured) {
        captured.forEach(({ group, pOld }) => WorldPositionUtils.applyGroupPivotCompensation(group, pOld));
    }

    /**
     * Extract single object from group, preserving its exact visual transform.
     *
     * Algorithm (worldPositionStays):
     *  1. Capture child's world center + accumulated rotation BEFORE any tree change.
     *  2. Capture G's and all its rotated ancestors' G-local pivots (for step 5).
     *  3. Compute child's new local coords in destination (BEFORE removing — hierarchy intact).
     *  4. Remove child from G.children.
     *  5. Cascade pivot compensation up through G and its rotated ancestors, innermost
     *     first, so nothing above G visibly drifts either.
     *  6. Place child at computed destination coords.
     *
     * Pivot compensation formula (cancel (I−R)·Δ drift), applied per rotated ancestor:
     *   G.x −= (1−cosθ)·Δx + sinθ·Δy
     *   G.y −= −sinθ·Δx  + (1−cosθ)·Δy
     * where Δ = P_new − P_old in G-local space.
     *
     * @param {Object}  group       - Direct parent group of childObject
     * @param {Object}  childObject - Child to extract
     * @param {Object}  [options]   - { saveState: boolean = true, isTopLevelGroup: boolean = false }
     * @param {boolean} [options.isTopLevelGroup] - Set when the caller already knows `group`
     *   sits at the level root (e.g. ungroupSelectedObjects, which only ever targets top-level
     *   groups). Skips the ancestor-chain searches (_findParentGroup, full-tree position scan),
     *   each an O(level size) walk, since a top-level group provably has no ancestors — avoids
     *   O(children × level size) blowup when ungrouping a large group in a large level.
     */
    extractObjectFromGroup(group, childObject, { saveState = true, isTopLevelGroup = false } = {}) {
        if (!group?.children?.some(c => c.id === childObject.id)) return false;

        if (saveState) {
            this.editor.historyManager.saveState(
                this.editor.level.objects,
                this.editor.stateManager.get('selectedObjects'),
                false,
                this.editor.stateManager.get('groupEditMode')
            );
        }

        // ── PHASE 1: read-only, tree intact ──────────────────────────────────────

        // 1a. World center (rotation-invariant anchor) + total accumulated rotation.
        // Scoping the search to `group`'s own subtree when it's known top-level is exactly
        // equivalent to searching the whole level (group has no ancestors either way) but
        // skips scanning unrelated sibling subtrees.
        const positionSearchScope = isTopLevelGroup ? [group] : this.editor.level.objects;
        const wt = WorldPositionUtils.getWorldCenterAndRotation(childObject, positionSearchScope);
        const worldCX = wt.x;
        const worldCY = wt.y;
        const accRot  = wt.accumulatedRotation;

        // 1b. Offset from child.x/y to its center (stable, doesn't depend on ancestry).
        const lc = WorldPositionUtils.getLocalCenter(childObject);

        // 1c. G's and all its rotated ancestors' pivots, before removal (for step 5).
        const ancestorPivots = this._captureAncestorPivots(group, { isTopLevelGroup });

        // 1d. Destination: parentGroup (if G is nested) or level root.
        const parentGroup = isTopLevelGroup ? null : this._findParentGroup(group);
        let newX, newY, newRotation;
        if (parentGroup) {
            // Convert world center → local center in parentGroup using its CURRENT pivot.
            const lcp = WorldPositionUtils.worldPointToLocalPointInGroup(
                worldCX, worldCY, parentGroup, this.editor.level.objects
            );
            newX = lcp.x - lc.offX;
            newY = lcp.y - lc.offY;
            const parentAccRot = WorldPositionUtils.getAncestorRotation(parentGroup, this.editor.level.objects)
                                + (parentGroup.rotation || 0);
            newRotation = accRot - parentAccRot;
        } else {
            newX        = worldCX - lc.offX;
            newY        = worldCY - lc.offY;
            newRotation = accRot;
        }

        // ── PHASE 2: mutate ───────────────────────────────────────────────────────

        group.children = group.children.filter(c => c.id !== childObject.id);

        // ── PHASE 3: compensate G itself for its own internal drift (child removed).
        // G's own bounds are already final at this point (childObject won't return
        // to it), so this can be applied immediately.
        if (ancestorPivots.length > 0 && ancestorPivots[0].group === group) {
            WorldPositionUtils.applyGroupPivotCompensation(group, ancestorPivots[0].pOld);
        }

        // ── PHASE 4: place child at destination ──────────────────────────────────

        childObject.x        = newX;
        childObject.y        = newY;
        childObject.rotation = newRotation;

        if (parentGroup) {
            parentGroup.children.push(childObject);
        } else {
            this.editor.level.addObject(childObject);
        }

        // ── PHASE 5: cascade pivot compensation through G's remaining rotated
        // ancestors (parentGroup and above). Their bounds only become final after
        // BOTH G's own compensation (which shifts G.x/G.y, a perturbation visible
        // to parentGroup) AND the insertion above have happened, so this must run
        // last — a single compensation per ancestor then cancels their combined
        // effect exactly.
        this._applyAncestorPivotCompensations(ancestorPivots.slice(1));

        this.editor.invalidateObjectCaches(childObject.id);
        return true;
    }

    /**
     * Add `obj` to `targetGroup`, preserving obj's current visual transform
     * (worldPositionStays = true).
     *
     * Algorithm:
     *  1. Capture obj's world center + accumulated rotation (tree intact, before removal).
     *  2. Capture targetGroup's (and its rotated ancestors') G-local pivots.
     *  3. Compute obj's new local coords + rotation in targetGroup (using current pivot).
     *  4. Remove obj from its current parent (level root or source group), capturing that
     *     source group's (and its rotated ancestors') pivots first too.
     *  5. Set obj.x/y/rotation to computed values, add to targetGroup.children.
     *  6. Cascade pivot compensation through the MERGED target+source ancestor chains
     *     (deduplicated, deepest-first) so nothing above either group visibly drifts.
     */
    addObjectToGroup(obj, targetGroup) {
        if (!obj || !targetGroup || targetGroup.type !== 'group') return false;

        // ── PHASE 1: read-only, tree intact ──────────────────────────────────────

        const wt   = WorldPositionUtils.getWorldCenterAndRotation(obj, this.editor.level.objects);
        const lc   = WorldPositionUtils.getLocalCenter(obj);
        const targetPivots = this._captureAncestorPivots(targetGroup);

        // Destination local coords — use current (pre-mutation) pivot for the conversion.
        const lcp = WorldPositionUtils.worldPointToLocalPointInGroup(
            wt.x, wt.y, targetGroup, this.editor.level.objects
        );
        const newX        = lcp.x - lc.offX;
        const newY        = lcp.y - lc.offY;
        const targetAccRot = WorldPositionUtils.getAncestorRotation(targetGroup, this.editor.level.objects)
                           + (targetGroup.rotation || 0);
        const newRotation = wt.accumulatedRotation - targetAccRot;

        // ── PHASE 2: remove obj from source ──────────────────────────────────────

        const sourceGroup = this._findParentGroup(obj);
        const sourcePivots = sourceGroup ? this._captureAncestorPivots(sourceGroup) : [];
        if (sourceGroup) {
            sourceGroup.children = sourceGroup.children.filter(c => c.id !== obj.id);
        } else {
            this.editor.level.removeObject(obj.id);
        }

        // ── PHASE 3: apply, add, compensate ──────────────────────────────────────

        obj.x        = newX;
        obj.y        = newY;
        obj.rotation = newRotation;

        targetGroup.children.push(obj);

        // Cascade compensation through target's and source's rotated ancestor chains,
        // merged/deduplicated so a shared ancestor is only compensated once.
        const merged = this._mergeAncestorPivots(targetPivots, sourcePivots);
        this._applyAncestorPivotCompensations(merged);

        this.editor.invalidateObjectCaches(obj.id);
        return true;
    }

    /**
     * Find the direct parent group of a given object within the level hierarchy.
     * Returns null if the object is at the top level (level.objects).
     * @param {Object} target - Object whose parent group to find
     * @returns {Object|null} Parent group, or null if top-level
     */
    _findParentGroup(target) {
        const search = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group' && obj.children) {
                    if (obj.children.some(c => c.id === target.id)) {
                        return obj;
                    }
                    const found = search(obj.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return search(this.editor.level.objects);
    }

    /**
     * Remove a specific group if it's empty or has only one child
     * @param {Object} targetGroup - The specific group to check and potentially remove
     * @returns {boolean} - True if the group was removed
     */
    removeEmptyGroup(targetGroup) {

        if (!targetGroup || targetGroup.type !== 'group') {
            return false;
        }

        // Fix: Handle case where children is undefined or null
        const childrenArray = targetGroup.children || [];

        // Don't remove if it has more than one child
        if (childrenArray.length > 1) {
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

        // If group has exactly one child, extract it before removing the group
        if (childrenArray.length === 1) {
            const childObject = childrenArray[0];
            const extracted = this.extractObjectFromGroup(targetGroup, childObject);
            if (!extracted) {
                return false; // Failed to extract, don't remove group
            }
        }

        // Remove from main level
        const initialCount = this.editor.level.objects.length;
        this.editor.level.removeObjects([targetGroup.id]);

        if (this.editor.level.objects.length < initialCount) {
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
     * Remove empty groups or groups with only one child from the level automatically
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

        // Remove empty groups or groups with one child from main level. Iterate a snapshot
        // (not the live array) so a child extracted below — which re-adds it to
        // this.editor.level.objects via addObject() — is never itself visited by this pass,
        // matching the fixed-length semantics the old .filter() had here.
        const beforeCount = this.editor.level.objects.length;
        const idsToRemove = [];
        [...this.editor.level.objects].forEach(obj => {
            if (obj.type === 'group' &&
                obj.children &&
                obj.children.length <= 1 &&
                !protectedGroupIds.has(obj.id)) {

                // If group has exactly one child, extract it first
                if (obj.children.length === 1) {
                    const childObject = obj.children[0];
                    this.extractObjectFromGroup(obj, childObject);
                }

                idsToRemove.push(obj.id); // Remove group (now empty after extraction)
            }
        });

        if (idsToRemove.length > 0) {
            this.editor.level.removeObjects(idsToRemove);
        }

        if (this.editor.level.objects.length < beforeCount) {
            groupsRemoved = true;
        }

        // Recursively remove empty groups or groups with one child from nested groups
        const removeEmptyNestedGroups = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group' && obj.children) {
                    const beforeNestedCount = obj.children.length;
                    
                    obj.children = obj.children.filter(child => {
                        if (child.type === 'group' && 
                            child.children && 
                            child.children.length <= 1 && 
                            !protectedGroupIds.has(child.id)) {
                            
                            // If nested group has exactly one child, extract it first
                            if (child.children.length === 1) {
                                const childObject = child.children[0];
                                this.extractObjectFromGroup(child, childObject);
                            }
                            
                            return false; // Remove group (now empty after extraction)
                        }
                        return true; // Keep groups with more than one child and other objects
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
