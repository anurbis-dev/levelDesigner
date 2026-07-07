import { BaseModule } from './BaseModule.js';
import { GameObject } from '../models/GameObject.js';
import { Group } from '../models/Group.js';
import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { SnapUtils } from '../utils/SnapUtils.js';
import { DEFAULT_OBJECT } from '../constants/EditorConstants.js';
import { Logger } from '../utils/Logger.js';

/**
 * Duplicate Operations module
 * Encapsulates start/update/confirm/cancel flow for duplicating objects
 */
export class DuplicateOperations extends BaseModule {

    /**
     * Normalize object properties to defaults
     * Extracted to eliminate code duplication
     * @private
     */
    _normalizeObjectProperties(obj) {
        if (!obj) return obj;
        
        obj.visible = obj.visible !== undefined ? obj.visible : DEFAULT_OBJECT.VISIBLE;
        obj.locked = obj.locked !== undefined ? obj.locked : DEFAULT_OBJECT.LOCKED;
        obj.width = obj.width || DEFAULT_OBJECT.WIDTH;
        obj.height = obj.height || DEFAULT_OBJECT.HEIGHT;
        obj.color = obj.color || DEFAULT_OBJECT.COLOR;
        
        return obj;
    }

    /**
     * Remove helper fields recursively and ensure visibility defaults
     * @private
     */
    _sanitizeForPlacement(obj) {
        if (!obj) return obj;

        // Create new instance to avoid modifying original
        const cleaned = obj.type === 'group' ?
            new Group(obj) :
            new GameObject(obj);

        // Clean up temporary properties
        delete cleaned._offsetX;
        delete cleaned._offsetY;
        delete cleaned._inGroup;
        delete cleaned._worldX;
        delete cleaned._worldY;

        // Normalize properties using extracted method
        this._normalizeObjectProperties(cleaned);

        // CRITICAL: Preserve layerId to maintain layer assignment
        // If layerId is missing, it will be assigned to Main layer by Level.addObject()
        // We preserve it here to maintain original layer assignment during duplication

        if (cleaned.type === 'group' && Array.isArray(cleaned.children)) {
            cleaned.children = cleaned.children.map(ch => this._sanitizeForPlacement(ch));
        }
        return cleaned;
    }

    /**
     * Start duplication from current selection
     */
    startFromSelection(worldPosOverride) {
        this.startFromObjects(this.getSelectedObjects(), worldPosOverride);
    }

    /**
     * Start the interactive placement flow (mouse-follow ghost, click to place) for an
     * arbitrary set of objects. Shared by startFromSelection() (duplicate hotkey) and
     * LevelEditor.pasteObjects() (paste hotkey), so both place objects the exact same way.
     * @param {Array} selected - Objects to place; NOT required to still be selected/in the tree
     * @param {{x:number,y:number}} [worldPosOverride] - Exact world position of the triggering
     *   mouse event (e.g. Alt+click), when the caller already computed it fresh. Bypasses
     *   mouse.worldX/worldY, which is only updated by the throttled mousemove handler and can
     *   lag a tick behind the actual click — otherwise the preview anchors to that stale spot
     *   while confirmPlacement's mouseup position is always fresh, making the placed copy jump
     *   away from where the preview was shown.
     */
    startFromObjects(selected, worldPosOverride) {
        if (!selected || selected.length === 0) {
            return;
        }

        // Use mouse position as the anchor point for duplication
        const mouse = this.editor.stateManager.get('mouse');
        const camera = this.editor.stateManager.get('camera');

        // Use mouse world coordinates only while the cursor is actually over the canvas —
        // mouse.worldX/worldY otherwise hold a stale position from before the cursor left
        // the canvas (over a panel, dialog, etc.), which would place objects somewhere the
        // user isn't pointing at. Fallback to canvas center in that case.
        let worldPos;
        if (worldPosOverride) {
            worldPos = { x: worldPosOverride.x, y: worldPosOverride.y };
        } else if (mouse?.isOverCanvas && mouse?.worldX !== undefined && mouse?.worldY !== undefined) {
            worldPos = { x: mouse.worldX, y: mouse.worldY };
        } else {
            // Fallback: convert canvas center to world coordinates
            const centerX = this.editor.canvasRenderer.canvas.width / 2;
            const centerY = this.editor.canvasRenderer.canvas.height / 2;
            worldPos = this.editor.canvasRenderer.screenToWorld(centerX, centerY, camera);
        }

        // Union of all selected objects' true world bounds — its center is the point that
        // gets placed under the cursor, so a multi-object paste/duplicate is centered as a
        // whole group instead of each object keeping its own offset from the cursor.
        const boundsUnion = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        // Clone and normalize properties
        const clones = selected.map(obj => {
            const cloned = this.editor.deepClone(obj);

            // Compute world placement and group membership BEFORE reassigning IDs.
            // At this point the clone still has the original ID and can be found in the
            // level tree, so world-bounds/rotation lookups return the correct values.
            // After reassignIdsDeep the clone gets a new ID and tree lookups fail —
            // so we must cache these values now.
            //
            // The preview clone is DETACHED (rendered without its ancestor groups), so:
            // 1) the rotation those ancestors would apply is baked into the clone itself,
            //    making the preview look exactly like the original on screen;
            // 2) the clone is anchored by its visual CENTER (the AABB center is invariant
            //    to rotation): _worldX/_worldY = the detached position at which the
            //    clone's center lands exactly on the original's rendered center.
            const worldBounds = this.editor.objectOperations.getObjectWorldBounds(cloned);
            boundsUnion.minX = Math.min(boundsUnion.minX, worldBounds.minX);
            boundsUnion.minY = Math.min(boundsUnion.minY, worldBounds.minY);
            boundsUnion.maxX = Math.max(boundsUnion.maxX, worldBounds.maxX);
            boundsUnion.maxY = Math.max(boundsUnion.maxY, worldBounds.maxY);

            const ancestorRotation = WorldPositionUtils.getAncestorRotation(cloned, this.editor.level.objects);
            if (ancestorRotation) {
                cloned.rotation = (cloned.rotation || 0) + ancestorRotation;
            }

            const detachedBounds = this.editor.renderOperations.getDuplicateObjectBounds(cloned, 0, 0);
            cloned._worldX = cloned.x + ((worldBounds.minX + worldBounds.maxX) / 2 - (detachedBounds.minX + detachedBounds.maxX) / 2);
            cloned._worldY = cloned.y + ((worldBounds.minY + worldBounds.maxY) / 2 - (detachedBounds.minY + detachedBounds.maxY) / 2);

            if (this.editor.objectOperations.isInGroupEditMode()) {
                const gem = this.editor.objectOperations.getGroupEditMode();
                cloned._inGroup = this.editor.objectOperations.isObjectInGroupRecursive(cloned, gem.group);
            }

            // Assign unique ids to the entire subtree
            this.editor.reassignIdsDeep(cloned);

            // Normalize properties using extracted method
            this._normalizeObjectProperties(cloned);

            // Normalize children if group
            if (cloned.type === 'group' && Array.isArray(cloned.children)) {
                cloned.children.forEach(child => this._normalizeObjectProperties(child));
            }
            return cloned;
        });

        // If parallax is enabled, adjust worldPos to account for parallax offset of the first object
        // This ensures we work with visual coordinates for cursor position
        if (this.editor.renderOperations?.parallaxRenderer?.isParallaxEnabled() && clones.length > 0) {
            const firstObj = clones[0];
            const effectiveLayerId = this.editor.renderOperations.getEffectiveLayerId(firstObj);
            if (this.editor.renderOperations.parallaxRenderer.isLayerParallaxEnabled(
                this.editor.level.getLayerById(effectiveLayerId)
            )) {
                const parallaxOffset = this.editor.renderOperations.parallaxRenderer.getParallaxOffset(
                    this.editor.level.getLayerById(effectiveLayerId)
                );
                // Adjust cursor position to visual coordinates
                worldPos.x += parallaxOffset.x;
                worldPos.y += parallaxOffset.y;
            }
        }

        // Check if this is Alt+drag mode
        const isAltDragMode = mouse?.altKey || false;

        // Alt+drag continues an existing grab: the cursor is already sitting at whatever
        // point the user grabbed, so anchoring offsets to the cursor position itself keeps
        // objects exactly where they were grabbed (like a normal drag, no jump). Paste/Ctrl+D
        // have no such grab point, so they anchor to the selection's bounding-box center
        // instead, centering the whole group under the cursor.
        const anchorCenter = isAltDragMode ? worldPos : {
            x: (boundsUnion.minX + boundsUnion.maxX) / 2,
            y: (boundsUnion.minY + boundsUnion.maxY) / 2
        };
        const initialized = this.editor.duplicateRenderUtils.initializePositions(clones, anchorCenter, this.editor);

        // Apply initial positions so preview is visible immediately (even without mouse move)
        const positioned = this.editor.duplicateRenderUtils.updatePositions(initialized, worldPos, this.editor);

        // Set duplicate state and start placing mode
        this.editor.stateManager.update({
            'mouse.isPlacingObjects': true,
            'mouse.placingObjects': positioned,
            'duplicate.isActive': true,
            'duplicate.objects': positioned,
            'duplicate.basePosition': { x: worldPos.x, y: worldPos.y },
            'duplicate.isAltDragMode': isAltDragMode,
            'duplicate.originalObjects': selected // Save original objects for group membership check
        });

        // Deselect original so it doesn't show a selection outline during preview
        this.editor.stateManager.set('selectedObjects', new Set());

        // Selective cache invalidation for duplicate preview
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

        // Immediate render to show preview
        this.editor.render();
        Logger.status.info(`Duplicating ${selected.length} object${selected.length > 1 ? 's' : ''} — click to place`);

    }

    /**
     * Update preview to follow the cursor
     */
    updatePreview(worldPos) {
        const duplicate = this.editor.stateManager.get('duplicate');
        if (!duplicate || !duplicate.isActive || !Array.isArray(duplicate.objects) || duplicate.objects.length === 0) return;

        // Snap logic is now handled inside DuplicateUtils.updatePositions
        // This ensures consistent behavior with group edit mode

        // Apply movement using DuplicateUtils for proper group edit mode handling
        const updatedObjects = this.editor.duplicateRenderUtils.updatePositions(duplicate.objects, worldPos, this.editor);

        // Update state with new positions
        this.editor.stateManager.update({
            'duplicate.objects': updatedObjects,
            'duplicate.basePosition': { x: worldPos.x, y: worldPos.y },
            'mouse.placingObjects': updatedObjects
        });

        // Selective cache invalidation for duplicate preview update
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

        this.editor.render();
    }

    /**
     * Confirm placement at the given world position
     */
    confirmPlacement(worldPos) {
        const duplicate = this.editor.stateManager.get('duplicate');
        if (!duplicate || !duplicate.isActive || !Array.isArray(duplicate.objects) || duplicate.objects.length === 0) return;

        // Use the same snap logic as updatePreview and dragSelectedObjects
        const snapEnabled = SnapUtils.isSnapToGridEnabled(this.editor.stateManager, this.editor.level);
        let dx, dy;

        if (snapEnabled) {
            // Use cursor position as anchor for snap mode
            const currentAnchorX = worldPos.x;
            const currentAnchorY = worldPos.y;
            
            const gridSize = SnapUtils.getGridSize(this.editor.stateManager, this.editor.level);
            const snapTolerancePercent = this.editor.userPrefs?.get('snapTolerance') || 80;
            const tolerance = gridSize * (snapTolerancePercent / 100);
            
            // Find nearest grid point for cursor
            const nearestGrid = SnapUtils.findNearestGridPoint(currentAnchorX, currentAnchorY, gridSize, tolerance);
            
            if (nearestGrid) {
                // Calculate current position of first duplicate object's bottom-left corner
                const firstObj = duplicate.objects[0];
                const firstObjWorldPos = this.editor.objectOperations.getObjectWorldPosition(firstObj);
                const firstObjHeight = firstObj.height || 32;
                const currentBottomLeftX = firstObjWorldPos.x;
                const currentBottomLeftY = firstObjWorldPos.y + firstObjHeight;
                
                // Move object so its bottom-left corner goes to grid point
                dx = nearestGrid.x - currentBottomLeftX;
                dy = nearestGrid.y - currentBottomLeftY;
            } else {
                // No grid point within tolerance - follow cursor normally
                dx = worldPos.x - duplicate.basePosition.x;
                dy = worldPos.y - duplicate.basePosition.y;
            }
        } else {
            // Snap disabled - normal relative movement
            dx = worldPos.x - duplicate.basePosition.x;
            dy = worldPos.y - duplicate.basePosition.y;
        }

        // Apply movement to all duplicate objects
        const updatedObjects = duplicate.objects.map(obj => {
            const newX = obj.x + dx;
            const newY = obj.y + dy;
            return { ...obj, x: newX, y: newY };
        });

        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        const newIds = new Set();

        // Use the updated objects with applied snap for final placement
        updatedObjects.forEach((obj) => {
            // Sanitize and place
            const base = this._sanitizeForPlacement(this.editor.deepClone(obj));
            this.editor.reassignIdsDeep(base);
            
            // Use the object's current position (already has snap applied)
            const worldX = base.x;
            const worldY = base.y;

            if (groupEditMode && groupEditMode.isActive && groupEditMode.group) {
                // _inGroup is set in startFromSelection BEFORE reassignIdsDeep, so it
                // correctly reflects whether the original selected object was inside the group.
                // ID-based comparison (orig.id === obj.id) fails because IDs are reassigned.
                const wasInGroup = obj._inGroup === true;
                
                if (wasInGroup) {
                    // Check if target group's layer is locked
                    if (groupEditMode.group.layerId) {
                        const targetLayer = this.editor.level.getLayerById(groupEditMode.group.layerId);
                        if (targetLayer && targetLayer.locked) {
                            // Skip placing in locked layer - place on main level instead
                            base.x = worldX;
                            base.y = worldY;
                            this.editor.level.addObject(base);
                            newIds.add(base.id);
                            this.editor.invalidateObjectCaches(base.id);
                            return;
                        }
                    }

                    // Convert the DETACHED preview position into group-local coordinates so
                    // the placed child renders exactly where the preview was. Matched by the
                    // clone's visual CENTER (the AABB center is invariant to rotation), and
                    // the rotation the group chain will re-apply to its new child is undone
                    // here — the preview carried it baked-in (see startFromSelection).
                    const detachedBounds = this.editor.renderOperations.getDuplicateObjectBounds(base, 0, 0);
                    const centerOffsetX = (detachedBounds.minX + detachedBounds.maxX) / 2 - base.x;
                    const centerOffsetY = (detachedBounds.minY + detachedBounds.maxY) / 2 - base.y;

                    const chainRotation = WorldPositionUtils.getAncestorRotation(groupEditMode.group, this.editor.level.objects)
                        + (groupEditMode.group.rotation || 0);
                    if (chainRotation) {
                        let rot = ((base.rotation || 0) - chainRotation) % 360;
                        if (rot > 180) rot -= 360;
                        if (rot <= -180) rot += 360;
                        base.rotation = rot;
                    }

                    const localCenter = WorldPositionUtils.worldPointToLocalPointInGroup(
                        worldX + centerOffsetX, worldY + centerOffsetY,
                        groupEditMode.group, this.editor.level.objects
                    );
                    base.x = localCenter.x - centerOffsetX;
                    base.y = localCenter.y - centerOffsetY;
                } else {
                    // External object - place on main level, do not attach to the open group
                    base.x = worldX;
                    base.y = worldY;
                    this.editor.level.addObject(base);
                    newIds.add(base.id);
                    this.editor.invalidateObjectCaches(base.id);
                    return;
                }

                // FORCED INHERITANCE: Always inherit layerId from parent group
                if (groupEditMode.group.layerId) {
                    const oldLayerId = base.layerId;
                    base.layerId = groupEditMode.group.layerId;

                    // Log forced inheritance
                    this.editor.logger?.layer?.info(`Duplicate inheritance: ${base.name || base.id} layerId ${oldLayerId || 'none'} → ${groupEditMode.group.layerId}`);

                    // Clear effective layer cache for this object
                    this.editor.renderOperations.clearEffectiveLayerCacheForObject(base.id);

                    // If object is a group, propagate layerId to all its children recursively
                    if (base.type === 'group' && base.children) {
                        groupEditMode.group.propagateLayerIdToChildren(base);
                    }
                }

                groupEditMode.group.children.push(base);
                
                // Add object to index even when adding to group
                this.editor.level.addObjectToIndex(base, groupEditMode.group);
            } else {
                // Place on main level with world coordinates
                base.x = worldX;
                base.y = worldY;
                this.editor.level.addObject(base);
            }

            newIds.add(base.id);

            // Invalidate caches for the new object
            this.editor.invalidateObjectCaches(base.id);
        });

        // Schedule full cache invalidation since multiple objects were added
        this.editor.scheduleCacheInvalidation();

        // scheduleCacheInvalidation is debounced (~100ms) — without a synchronous
        // invalidation the render() below hits the still-valid visibleObjectsCache entry
        // and a spatial index that doesn't contain the just-placed objects, so they are
        // not drawn for several frames right after the preview ghost disappears (visible
        // blink at the drop position).
        this.editor.renderOperations.clearVisibleObjectsCache();
        this.editor.renderOperations.markSpatialIndexDirty();

        // Save state AFTER placing objects but BEFORE changing selection
        this.editor.historyManager.saveState(
            this.editor.level.objects, 
            newIds, 
            false, 
            this.editor.stateManager.get('groupEditMode')
        );

        // Use the same reset method as cancel for consistency
        this.cancel();

        // Set selection after state is saved. Caches were already invalidated above (line
        // 379-380), so the synchronous render this triggers (EventHandlers 'selectedObjects'
        // subscriber, which also calls updateAllPanels()) already sees fresh state — no
        // separate render()/updateAllPanels() call needed here.
        this.editor.stateManager.set('selectedObjects', newIds);

        Logger.status.success(`Placed ${newIds.size} duplicate${newIds.size > 1 ? 's' : ''}`);

    }

    /**
     * Cancel duplication
     */
    cancel() {
        // Full reset to avoid stale references
        this.editor.stateManager.update({
            'mouse.isPlacingObjects': false,
            'mouse.placingObjects': [],
            'duplicate.isActive': false,
            'duplicate.objects': [],
            'duplicate.basePosition': { x: 0, y: 0 },
            'duplicate.isAltDragMode': false
        });

        // Force clear references
        const dup = this.editor.stateManager.get('duplicate');
        if (dup && dup.objects) {
            dup.objects = [];
        }

        this.editor.render();
    }
}


