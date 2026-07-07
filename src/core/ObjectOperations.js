import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { GroupTraversalUtils } from '../utils/GroupTraversalUtils.js';
import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

/**
 * Object Operations module for LevelEditor
 * Handles all object manipulation operations
 */
export class ObjectOperations extends BaseModule {

    /**
     * Sort objects by stacking order, descending (front-most first). Uses the same
     * Level.compareStackOrder() comparator as rendering, so hit-test order always
     * matches what is actually drawn regardless of nesting depth.
     * @param {Array} objects - Array of objects to sort
     * @returns {Array} Sorted array
     * @private
     */
    _sortObjectsByZIndexDescending(objects) {
        const index = this.editor.level.buildStackOrderIndex();
        return objects.sort((a, b) => this.editor.level.compareStackOrderIndexed(b, a, index));
    }

    /**
     * Get the array that determines an object's stacking order: its parent group's
     * `children`, or the level's top-level `objects` array if it has no parent group.
     */
    getSiblingArray(obj) {
        const parentGroup = this.editor.groupOperations._findParentGroup(obj);
        return parentGroup ? parentGroup.children : this.editor.level.objects;
    }

    /**
     * Move object to the end of its sibling array (topmost / front-most)
     */
    bringToFront(obj) {
        const arr = this.getSiblingArray(obj);
        const i = arr.indexOf(obj);
        if (i === -1 || i === arr.length - 1) return;
        arr.splice(i, 1);
        arr.push(obj);
    }

    /**
     * Move object to the start of its sibling array (bottommost / back-most)
     */
    sendToBack(obj) {
        const arr = this.getSiblingArray(obj);
        const i = arr.indexOf(obj);
        if (i <= 0) return;
        arr.splice(i, 1);
        arr.unshift(obj);
    }

    /**
     * Swap object with its next sibling (move one step toward front)
     */
    moveForward(obj) {
        const arr = this.getSiblingArray(obj);
        const i = arr.indexOf(obj);
        if (i === -1 || i === arr.length - 1) return;
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    }

    /**
     * Swap object with its previous sibling (move one step toward back)
     */
    moveBackward(obj) {
        const arr = this.getSiblingArray(obj);
        const i = arr.indexOf(obj);
        if (i <= 0) return;
        [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    }

    /**
     * Apply a stacking-order action (bringToFront/sendToBack/moveForward/moveBackward) to a
     * set of objects, then save history and redraw. Shared by DetailsPanel's order buttons
     * and their keyboard shortcuts, so both stay in sync by construction.
     * @param {Iterable<Object>} objects
     * @param {'bringToFront'|'sendToBack'|'moveForward'|'moveBackward'} action
     */
    applyStackOrderAction(objects, action) {
        const objectsArray = Array.from(objects);
        if (objectsArray.length === 0) return;

        objectsArray.forEach(obj => this[action](obj));

        this.editor.historyManager.saveState(
            this.editor.level.objects,
            this.editor.stateManager.get('selectedObjects'),
            false,
            this.editor.stateManager.get('groupEditMode')
        );

        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        this.editor.render();
    }

    /**
     * Return the set of group IDs that must be excluded from selection while in
     * group edit mode: all openGroups + ALL their ancestors (handles groups opened
     * directly via the outliner, bypassing parent-first navigation).
     * @returns {Set<string>}
     */
    _buildGroupEditExclusionSet() {
        const groupEditMode = this.getGroupEditMode();
        if (!groupEditMode) return new Set();
        const openGroups = Array.isArray(groupEditMode.openGroups)
            ? groupEditMode.openGroups
            : (groupEditMode.group ? [groupEditMode.group] : []);
        const excluded = new Set(openGroups.map(g => g.id));
        // Walk up from every open group to also exclude all their ancestors.
        openGroups.forEach(g => {
            let cur = g;
            while (true) {
                const parent = this.editor.groupOperations._findParentGroup(cur);
                if (!parent) break;
                excluded.add(parent.id);
                cur = parent;
            }
        });
        return excluded;
    }

    /**
     * Collect the actual selectable candidate OBJECTS for the current mode. Shared by
     * computeSelectableSet, findObjectAtPoint, and marquee selection so all three agree
     * on exactly the same set (previously each duplicated this logic separately and only
     * covered the active group's direct children + the LEVEL ROOT's top-level objects —
     * missing siblings at INTERMEDIATE levels of a multi-level-nested group edit mode,
     * e.g. group A open with child-group B open inside it: A's other children, besides
     * B, were never selectable even though they're visible and draggable-into B).
     *
     * Rule while in group edit mode:
     *   1) Direct children of the ACTIVE (innermost open) group.
     *   2) At EVERY level of the open-group chain (root → innermost), the siblings of
     *      that level's open child — i.e. walk root.objects, then each open group's own
     *      children — so an object can be selected/dragged in from anywhere along the
     *      ancestor chain, not just the absolute root.
     *   3) Objects inside a CLOSED child-group are never included (only reachable once
     *      that child-group itself is opened) — the child-group is selectable as a whole.
     * Outside group edit mode: all top-level level.objects.
     */
    getSelectableCandidateObjects() {
        const excluded = this._buildGroupEditExclusionSet();

        if (!this.isInGroupEditMode()) {
            let topLevel = this.editor.level.objects;
            // Isolate mode (see toggleIsolateSelection) is top-level-only: while active,
            // only the isolated top-level branch(es) are selectable, matching the dimming
            // applied in RenderOperations.render().
            const isolatedIds = this.editor.stateManager.get('view.isolatedTopLevelIds');
            if (isolatedIds) topLevel = topLevel.filter(o => isolatedIds.has(o.id));
            // Object Solo (Ctrl+click an eye icon, see toggleObjectSolo) is also top-level-only.
            const soloedId = this.editor.stateManager.get('view.soloedTopLevelObjectId');
            if (soloedId) topLevel = topLevel.filter(o => o.id === soloedId);
            return topLevel;
        }

        const groupEditMode = this.getGroupEditMode();
        const activeGroup = groupEditMode.group;
        const openGroups = Array.isArray(groupEditMode.openGroups)
            ? groupEditMode.openGroups
            : (activeGroup ? [activeGroup] : []);

        const candidates = [];
        const seen = new Set();
        const addAll = (arr) => {
            (arr || []).forEach(o => {
                if (!excluded.has(o.id) && !seen.has(o.id)) {
                    seen.add(o.id);
                    candidates.push(o);
                }
            });
        };

        addAll(activeGroup?.children);

        let containerChildren = this.editor.level.objects;
        openGroups.forEach(g => {
            addAll(containerChildren);
            containerChildren = g.children || [];
        });

        return candidates;
    }

    /**
     * Object manipulation methods
     */
    /**
     * @param {number} x - World X
     * @param {number} y - World Y
     * @param {boolean} skipCycle - If true, always return the front-most match instead of
     *   cycling (see _pickWithClickCycle). Used by double-click: a dblclick gesture is
     *   physically two single clicks, which would otherwise already have advanced the cycle
     *   past the front-most object (e.g. a group) by the time the dblclick handler runs.
     */
    findObjectAtPoint(x, y, skipCycle = false) {
        // In group edit mode:
        //   - direct children of the active group are selectable
        //   - siblings at any level of the open-group chain are selectable (so they can
        //     be dragged in)
        //   - objects INSIDE nested (closed) child-groups are NOT selectable (child-group
        //     as a whole is)
        if (this.isInGroupEditMode()) {
            const selectable = this.computeSelectableSet();
            const candidates = this.getSelectableCandidateObjects().filter(o => selectable.has(o.id));

            const sorted = this._sortObjectsByZIndexDescending(candidates);
            return skipCycle ? this._pickFrontMost(x, y, sorted) : this._pickWithClickCycle(x, y, sorted);
        }

        // Normal mode - use viewport optimization
        const selectableInViewport = this.editor.getSelectableObjectsInViewport();

        // Hit-test ALL top-level objects together - only those in viewport
        // Sort by stacking order, descending, to select the front-most one
        // Groups and non-groups are treated equally based on their stacking order
        const topLevelObjects = this.editor.level.objects.filter(o => selectableInViewport.has(o.id));
        const sortedObjects = this._sortObjectsByZIndexDescending(topLevelObjects);
        return skipCycle ? this._pickFrontMost(x, y, sortedObjects) : this._pickWithClickCycle(x, y, sortedObjects);
    }

    /**
     * Plain front-to-back hit test, no cycling — the pre-click-cycling behavior.
     */
    _pickFrontMost(x, y, sortedCandidates) {
        for (const obj of sortedCandidates) {
            if (this.isPointInObject(x, y, obj)) return obj;
        }
        return null;
    }

    /**
     * Pick a hit-test result from a front-to-back sorted candidate list, cycling through
     * ALL matches at the same point on repeated clicks (Blender-style): clicking once
     * selects the front-most match; clicking again at (roughly) the same point with the
     * same candidate set advances to the next match underneath, wrapping around. Clicking
     * somewhere else, or a change in what's actually there, resets the cycle.
     * @returns {Object|null}
     */
    _pickWithClickCycle(x, y, sortedCandidates) {
        const matches = sortedCandidates.filter(obj => this.isPointInObject(x, y, obj));
        if (matches.length === 0) {
            this._clickCycle = null;
            return null;
        }

        const candidateKey = matches.map(o => o.id).join(',');
        const zoom = this.editor.stateManager.get('camera')?.zoom || 1;
        const tolerance = 4 / zoom; // ~4 screen px, independent of zoom level
        const prev = this._clickCycle;
        const samePoint = prev &&
            Math.abs(prev.x - x) < tolerance &&
            Math.abs(prev.y - y) < tolerance &&
            prev.candidateKey === candidateKey;

        const index = samePoint ? (prev.index + 1) % matches.length : 0;
        this._clickCycle = { x, y, candidateKey, index };
        return matches[index];
    }

    /**
     * Hit-test tolerance in WORLD units: expands the clickable area by a fixed
     * screen-pixel margin (selection.hitTestTolerance, default 4px) around the
     * object's boundary, independent of zoom — same convention as the click-cycle
     * tolerance in _pickWithClickCycle.
     */
    getHitTestTolerance() {
        const px = this.editor.stateManager.get('selection.hitTestTolerance') ?? 4;
        const zoom = this.editor.stateManager.get('camera')?.zoom || 1;
        return px / zoom;
    }

    isPointInObject(worldX, worldY, obj) {
        const tolerance = this.getHitTestTolerance();

        // Check if parallax is enabled and object participates in it
        if (this.editor.renderOperations.parallaxRenderer.isParallaxEnabled()) {
            const effectiveLayerId = this.editor.renderOperations.getEffectiveLayerId(obj);
            if (this.editor.renderOperations.parallaxRenderer.isLayerParallaxEnabled(
                this.editor.level.getLayerById(effectiveLayerId)
            )) {
                // Object is rendered with parallax offset, so we need to check against
                // the transformed world bounds
                const parallaxOffset = this.editor.renderOperations.parallaxRenderer.getParallaxOffset(
                    this.editor.level.getLayerById(effectiveLayerId)
                );

                // Get the original world bounds
                const originalBounds = WorldPositionUtils.getWorldBounds(obj, this.editor.level.objects);

                // Apply parallax transformation to bounds
                const transformedBounds = {
                    minX: originalBounds.minX - parallaxOffset.x,
                    minY: originalBounds.minY - parallaxOffset.y,
                    maxX: originalBounds.maxX - parallaxOffset.x,
                    maxY: originalBounds.maxY - parallaxOffset.y
                };

                // Check if point is within transformed bounds
                return worldX >= transformedBounds.minX - tolerance && worldX <= transformedBounds.maxX + tolerance &&
                       worldY >= transformedBounds.minY - tolerance && worldY <= transformedBounds.maxY + tolerance;
            }
        }

        // Normal case without parallax
        return WorldPositionUtils.isPointInWorldBounds(worldX, worldY, obj, this.editor.level.objects, tolerance);
    }

    isPointInGroupBounds(worldX, worldY, groupEditMode = null) {
        // Use provided groupEditMode or get current one
        const gem = groupEditMode || this.getGroupEditMode();
        if (!gem) return false;

        const group = gem.group;

        // Check if parallax is enabled and group participates in it
        if (this.editor.renderOperations.parallaxRenderer.isParallaxEnabled()) {
            const effectiveLayerId = this.editor.renderOperations.getEffectiveLayerId(group);
            if (this.editor.renderOperations.parallaxRenderer.isLayerParallaxEnabled(
                this.editor.level.getLayerById(effectiveLayerId)
            )) {
                // Group is rendered with parallax offset, so we need to check against
                // the transformed bounds
                const parallaxOffset = this.editor.renderOperations.parallaxRenderer.getParallaxOffset(
                    this.editor.level.getLayerById(effectiveLayerId)
                );

                // Get the original world bounds
                const originalBounds = WorldPositionUtils.getWorldBounds(group, this.editor.level.objects);

                // Apply parallax transformation to bounds
                const transformedBounds = {
                    minX: originalBounds.minX - parallaxOffset.x,
                    minY: originalBounds.minY - parallaxOffset.y,
                    maxX: originalBounds.maxX - parallaxOffset.x,
                    maxY: originalBounds.maxY - parallaxOffset.y
                };

                // Add some padding to make it easier to drop inside (same as visual frame)
                const padding = 10;
                return worldX >= transformedBounds.minX - padding && worldX <= transformedBounds.maxX + padding &&
                       worldY >= transformedBounds.minY - padding && worldY <= transformedBounds.maxY + padding;
            }
        }

        // Normal case without parallax
        const bounds = WorldPositionUtils.getWorldBounds(group, this.editor.level.objects);

        // Add some padding to make it easier to drop inside (same as visual frame)
        const padding = 10;
        return worldX >= bounds.minX - padding && worldX <= bounds.maxX + padding &&
               worldY >= bounds.minY - padding && worldY <= bounds.maxY + padding;
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

    /**
     * Check if object is in group recursively (including nested groups)
     * @param {Object} obj - Object to check
     * @param {Object} group - Group to check in
     * @returns {boolean} True if object is in group or any of its subgroups
     */
    isObjectInGroupRecursive(obj, group) {
        // Check if object is direct child of this group
        if (group.children.some(child => child.id === obj.id)) {
            return true;
        }

        // Check recursively in child groups
        for (const child of group.children) {
            if (child.type === 'group' && child.children) {
                if (this.isObjectInGroupRecursive(obj, child)) {
                    return true;
                }
            }
        }

        return false;
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

        // Delete selected objects - they can be on main level or inside groups
        const idsToDelete = new Set(selectedObjects);


        // First, collect all objects that need to be deleted (including children of deleted groups)
        const collectObjectsToDelete = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group') {
                    // If this group is being deleted, add all its children to deletion set
                    if (idsToDelete.has(obj.id)) {
                        obj.children.forEach(child => {
                            idsToDelete.add(child.id);
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

        // Now remove all collected objects from everywhere they might be
        const removeFromArrays = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group') {
                    // Remove deleted children from this group's children array
                    const originalCount = obj.children.length;
                    obj.children = obj.children.filter(child => !idsToDelete.has(child.id));
                    const removedCount = originalCount - obj.children.length;
                    if (removedCount > 0) {
                    }

                    // Process nested groups
                    removeFromArrays(obj.children);
                }
            }
        };

        // Remove objects from all nested arrays
        removeFromArrays(this.editor.level.objects);

        // Remove all collected objects from main level
        const originalCount = this.editor.level.objects.length;
        this.editor.level.removeObjects(idsToDelete);
        const removedCount = originalCount - this.editor.level.objects.length;


        // Clean up any empty groups that might remain after deletion
        const emptyGroupsRemoved = this.editor.groupOperations.removeEmptyGroups();
        if (emptyGroupsRemoved > 0) {
        } else {
        }

        // Save state AFTER all deletions and cleanup are complete
        this.editor.historyManager.saveState(
            this.editor.level.objects, 
            selectedObjects, 
            false, 
            this.editor.stateManager.get('groupEditMode')
        );

        // Invalidate caches BEFORE changing selection: set('selectedObjects', ...) below
        // synchronously triggers a render (EventHandlers 'selectedObjects' subscriber). If
        // that happens before these are cleared, it reads the still-warm visibleObjectsCache
        // entry for the current camera (100ms TTL) and paints the just-deleted objects for
        // one more frame — an intermittent flash depending on whether that cache entry was
        // still alive at delete time.
        if (this.editor.renderOperations) {
            this.editor.renderOperations.invalidateSpatialIndex();
            this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        }

        // Clear selection and update UI AFTER all operations are complete. The set() below
        // already synchronously triggers a full panel refresh via the 'selectedObjects'
        // subscriber, and level.removeObjects() above notifies panels reactively too — no
        // separate updateAllPanels() call needed here.
        const deletedCount = selectedObjects.size;
        this.editor.stateManager.set('selectedObjects', new Set());
        Logger.status.info(`Deleted ${deletedCount} object${deletedCount > 1 ? 's' : ''}`);
    }

    duplicateSelectedObjects() {
        this.editor.duplicateOperations.startFromSelection();
    }

    /**
     * Toggle obj.visible. If obj is a group, cascades the SAME new value onto every
     * descendant (GroupTraversalUtils.getAllChildren). This isn't just cosmetic: rendering
     * already skips a hidden group's children via CanvasRenderer.drawGroup's own
     * `if (!group.visible) return`, but computeSelectableSet()/isObjectSelectable() only
     * checks an object's OWN .visible flag with no ancestor-chain walk — so without this
     * cascade, a hidden group's descendants would remain individually selectable (e.g. via
     * Outliner) even though they're not drawn. Shared by the H hotkey and the Outliner eye
     * icon so both stay in sync by construction.
     * @param {Object} obj
     */
    toggleObjectVisibility(obj) {
        const newValue = !obj.visible;
        obj.visible = newValue;
        if (obj.type === 'group') {
            GroupTraversalUtils.getAllChildren(obj, true).forEach(child => {
                child.visible = newValue;
            });
        }
    }

    /**
     * H: toggle visibility for every currently selected object.
     * Objects that end up hidden are dropped from the selection afterwards - a hidden
     * object can't be manipulated on canvas (no gizmo/handles to show), and this also
     * covers descendants hidden only via a toggled-off ancestor group's cascade
     * (toggleObjectVisibility), not just objects toggled directly by this loop.
     */
    toggleVisibilityForSelection() {
        const selectedIds = this.editor.stateManager.get('selectedObjects');
        if (!selectedIds || selectedIds.size === 0) return;

        Array.from(selectedIds)
            .map(id => this.editor.level.findObjectById(id))
            .filter(Boolean)
            .forEach(obj => this.toggleObjectVisibility(obj));

        const remainingSelection = new Set(
            Array.from(selectedIds).filter(id => {
                const obj = this.editor.level.findObjectById(id);
                return obj && obj.visible;
            })
        );

        // Invalidate caches BEFORE the set() below: it synchronously triggers a render via
        // the 'selectedObjects' subscriber, and afterVisibilityChange() (which does the
        // invalidation) only runs after — without this, that first render paints from the
        // stale visibleObjectsCache/spatial index, briefly showing the pre-toggle visibility.
        this.editor.renderOperations.invalidateSpatialIndex();
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

        this.editor.stateManager.set('selectedObjects', remainingSelection);

        this.afterVisibilityChange();
    }

    /**
     * Alt+H: show every hidden object/group at every level of the whole level, REGARDLESS
     * of which command/hotkey/flag made it invisible — H/eye-icon (`obj.visible`), a hidden
     * or soloed layer (`layer.visible`/`layer.soloed`), Object Solo
     * (`view.soloedTopLevelObjectId`), and Isolate (`view.isolatedTopLevelIds`) are four
     * independent mechanisms that all feed into isObjectEffectivelyVisible() — Alt+H has to
     * reset every one of them so the resulting effective-visibility flag ends up identical
     * (true) for every object no matter which mechanism previously hid it. Resetting only
     * `obj.visible` would leave objects hidden by layer/solo/isolate stuck invisible after
     * "Show All", contradicting what Alt+H promises.
     */
    unhideAllObjects() {
        GroupTraversalUtils.getAllObjects(this.editor.level.objects, true).forEach(obj => {
            if (!obj.visible) obj.visible = true;
        });

        this.editor.level.layers.forEach(layer => {
            layer.visible = true;
            layer.soloed = false;
        });
        this.editor.stateManager.set('view.soloedTopLevelObjectId', null);
        this.editor.stateManager.set('view.isolatedTopLevelIds', null);
        this.editor.renderOperations.invalidateLayerVisibilityCache();

        this.afterVisibilityChange();
    }

    /**
     * Shared history/redraw/panel-refresh tail for visibility-changing operations.
     * @private
     */
    afterVisibilityChange() {
        this.editor.historyManager.saveState(
            this.editor.level.objects,
            this.editor.stateManager.get('selectedObjects'),
            false,
            this.editor.stateManager.get('groupEditMode')
        );

        this.editor.renderOperations.invalidateSpatialIndex();
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        this.editor.render();
        this.editor.updateAllPanels();
    }

    /**
     * `/`: toggle Isolate (Blender Local View equivalent) for the current selection.
     * Non-destructive — never touches obj.visible. Top-level granularity only: isolating a
     * deeply nested object shows its whole top-level ancestor branch, not just that one
     * object (avoids needing per-level filtering inside CanvasRenderer.drawGroup). Reuses
     * the app's existing "dim what's outside the active context" visual language (see the
     * group-edit-mode dimming in RenderOperations.render()) instead of a separate hide
     * mechanism — RenderOperations.render() and getSelectableCandidateObjects() both read
     * `view.isolatedTopLevelIds` from stateManager.
     */
    toggleIsolateSelection() {
        const current = this.editor.stateManager.get('view.isolatedTopLevelIds');
        if (current) {
            this.editor.stateManager.set('view.isolatedTopLevelIds', null);
        } else {
            const selectedIds = this.editor.stateManager.get('selectedObjects');
            if (!selectedIds || selectedIds.size === 0) return;

            const topLevelIds = new Set();
            Array.from(selectedIds).forEach(id => {
                const obj = this.editor.level.findObjectById(id);
                if (obj) topLevelIds.add(this.findTopLevelAncestor(obj).id);
            });

            if (topLevelIds.size === 0) return;
            this.editor.stateManager.set('view.isolatedTopLevelIds', topLevelIds);
        }

        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        this.editor.render();
        this.editor.updateAllPanels();
    }

    /**
     * Walk up via GroupOperations._findParentGroup to find obj's top-level ancestor (or obj
     * itself if it's already top-level). Shared by toggleIsolateSelection and toggleObjectSolo.
     */
    findTopLevelAncestor(obj) {
        let topLevel = obj;
        let parent = this.editor.groupOperations._findParentGroup(topLevel);
        while (parent) {
            topLevel = parent;
            parent = this.editor.groupOperations._findParentGroup(topLevel);
        }
        return topLevel;
    }

    /**
     * Whether obj is ACTUALLY rendered right now, considering every independent thing that
     * can hide it: its own and every ancestor group's `visible` flag, its effective layer's
     * visibility, Object Solo, and Isolate. This is the single source of truth the Outliner
     * eye icon must be driven from — display state has to be computed from the object's
     * current state, never from "which button/command was last used", or a completely
     * unrelated action (soloing a DIFFERENT object) leaves every other object's icon showing
     * stale info even though they're no longer actually visible.
     * @param {Object} obj
     * @returns {boolean}
     */
    isObjectEffectivelyVisible(obj) {
        // Walk up: obj and every ancestor group must be visible — don't rely solely on
        // toggleObjectVisibility's cascade always having already propagated this to obj.
        let current = obj;
        while (current) {
            if (!current.visible) return false;
            current = this.editor.groupOperations._findParentGroup(current);
        }

        const effectiveLayerId = this.editor.renderOperations.getEffectiveLayerId(obj);
        if (!this.editor.renderOperations.getVisibleLayerIds().has(effectiveLayerId)) return false;

        const topLevel = this.findTopLevelAncestor(obj);

        const soloedId = this.editor.stateManager.get('view.soloedTopLevelObjectId');
        if (soloedId && topLevel.id !== soloedId) return false;

        const isolatedIds = this.editor.stateManager.get('view.isolatedTopLevelIds');
        if (isolatedIds && !isolatedIds.has(topLevel.id)) return false;

        return true;
    }

    /**
     * Ctrl+click an object's eye icon in the Outliner (analogous to Layer Solo, see
     * LayersPanel.toggleLayerSolo): exclusively shows only this object's top-level branch,
     * fully hiding every other top-level object — a real hide (matching the eye icon
     * affordance), not a dim like Isolate (`/`). Exclusive: soloing a different object
     * replaces the previous solo; Ctrl+clicking the already-soloed object's eye un-solos.
     * Non-destructive — never touches obj.visible. Only ever filters at the TOP level, so a
     * soloed group's own children render exactly as normal — no special-casing needed for
     * "the group's children stay visible", it falls out of not touching anything below the
     * top level (see RenderOperations.render() / getSelectableCandidateObjects()).
     */
    toggleObjectSolo(obj) {
        const topLevel = this.findTopLevelAncestor(obj);
        const current = this.editor.stateManager.get('view.soloedTopLevelObjectId');
        this.editor.stateManager.set('view.soloedTopLevelObjectId', current === topLevel.id ? null : topLevel.id);

        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();
        this.editor.render();
        this.editor.updateAllPanels();
    }

    // Compute a set of selectable IDs depending on current edit state
    computeSelectableSet() {
        const selectable = new Set();

        // Helper function to check if object is selectable (visible and in visible unlocked layer)
        const isObjectSelectable = (obj) => {
            // Check object visibility
            if (!obj.visible) {
                return false;
            }

            // Check layer visibility (considering inheritance from parent groups)
            const effectiveLayerId = this.editor.renderOperations ?
                this.editor.renderOperations.getEffectiveLayerId(obj) :
                (obj.layerId || this.editor.level.getMainLayerId());
            const visibleLayerIds = this.editor.renderOperations ?
                this.editor.renderOperations.getVisibleLayerIds() :
                new Set(this.editor.level.layers.map(l => l.id));

            if (!visibleLayerIds.has(effectiveLayerId)) {
                return false;
            }

            // Check if layer is locked
            const layer = this.editor.level.getLayerById(effectiveLayerId);
            if (layer && layer.locked) {
                return false;
            }

            return true;
        };

        this.getSelectableCandidateObjects().forEach(o => {
            if (isObjectSelectable(o)) selectable.add(o.id);
        });
        return selectable;
    }

    /**
     * Get center point of selected objects
     * @param {Set} selectedObjects - Set of selected object IDs
     * @returns {Object|null} Center position {x, y} or null if no objects
     */
    getSelectedObjectsCenter(selectedObjects) {
        if (!selectedObjects || selectedObjects.size === 0) {
            return null;
        }

        const objects = Array.from(selectedObjects)
            .map(id => this.editor.level.findObjectById(id))
            .filter(Boolean);

        if (objects.length === 0) {
            return null;
        }

        if (objects.length === 1) {
            // Single object - get its center
            const obj = objects[0];
            if (obj.type === 'group') {
                // For groups, calculate center based on children positions
                return this.getGroupCenter(obj);
            } else {
                return this.getObjectCenterWorld(obj);
            }
        }

        // Multiple objects - calculate bounding box center
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            const bounds = this.getObjectWorldBounds(obj);
            minX = Math.min(minX, bounds.minX);
            minY = Math.min(minY, bounds.minY);
            maxX = Math.max(maxX, bounds.maxX);
            maxY = Math.max(maxY, bounds.maxY);
        });

        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };
    }

    /**
     * Get geometric center of a group based on its children
     * @param {Object} group - Group object
     * @returns {Object} Center position {x, y}
     */
    getGroupCenter(group) {
        if (!group.children || group.children.length === 0) {
            // Empty group - return its own center
            return this.getObjectCenterWorld(group);
        }

        // Calculate center based on children positions
        let totalX = 0, totalY = 0, count = 0;

        const addObjectCenter = (obj) => {
            if (obj.type === 'group') {
                // Recursively process child groups
                addObjectCenter(this.getGroupCenter(obj));
            } else {
                // Regular object - add its center
                const center = this.getObjectCenterWorld(obj);
                totalX += center.x;
                totalY += center.y;
                count++;
            }
        };

        group.children.forEach(child => addObjectCenter(child));

        if (count === 0) {
            // No valid children - return group's own center
            return this.getObjectCenterWorld(group);
        }

        return {
            x: totalX / count,
            y: totalY / count
        };
    }
}
