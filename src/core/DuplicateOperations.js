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

        // Reset zIndex to undefined so Level.addObject() will assign new zIndex
        // This ensures duplicated objects get a higher zIndex than the original
        cleaned.zIndex = undefined;

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
    startFromSelection() {

        const selectedIds = this.editor.stateManager.get('selectedObjects');

        if (!selectedIds || selectedIds.size === 0) {
            return;
        }

        // Collect selected objects
        const selected = this.getSelectedObjects();

        if (selected.length === 0) {
            return;
        }

        // Use mouse position as the anchor point for duplication
        const mouse = this.editor.stateManager.get('mouse');
        const camera = this.editor.stateManager.get('camera');

        // Use mouse world coordinates if available, otherwise fallback to canvas center
        let worldPos;
        if (mouse?.worldX !== undefined && mouse?.worldY !== undefined) {
            worldPos = { x: mouse.worldX, y: mouse.worldY };
        } else {
            // Fallback: convert canvas center to world coordinates
            const centerX = this.editor.canvasRenderer.canvas.width / 2;
            const centerY = this.editor.canvasRenderer.canvas.height / 2;
            worldPos = this.editor.canvasRenderer.screenToWorld(centerX, centerY, camera);
        }

        // Clone and normalize properties
        const clones = selected.map(obj => {
            const cloned = this.editor.deepClone(obj);
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

        // Initialize offsets relative to the cursor BEFORE setting positions
        // This ensures we calculate offsets based on original object positions
        const initialized = this.editor.duplicateRenderUtils.initializePositions(clones, worldPos, this.editor);

        // Apply initial positions so preview is visible immediately (even without mouse move)
        const positioned = this.editor.duplicateRenderUtils.updatePositions(initialized, worldPos, this.editor);

        // Check if this is Alt+drag mode
        const isAltDragMode = mouse?.altKey || false;

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

        // Selective cache invalidation for duplicate preview
        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

        // Immediate render to show preview
        this.editor.render();

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
                // Check if this object was originally inside the group
                const wasInGroup = duplicate.originalObjects && 
                    duplicate.originalObjects.some(orig => orig.id === obj.id && 
                        this.editor.objectOperations.isObjectInGroupRecursive(orig, groupEditMode.group));
                
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
                    
                    // Convert world coordinates to relative coordinates within the group
                    // This matches the Alt+drag logic in MouseHandlers.dragSelectedObjects
                    const groupPos = this.editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
                    base.x = worldX - groupPos.x;
                    base.y = worldY - groupPos.y;
                } else {
                    // External object - keep world coordinates for main level placement
                    base.x = worldX;
                    base.y = worldY;
                }

                // Assign zIndex if not set (for duplicated objects in groups)
                if (base.zIndex === undefined) {
                    // For duplicated objects, assign next zIndex in the current layer
                    const layerIndex = groupEditMode.group.layerId ? this.editor.level.getLayerById(groupEditMode.group.layerId)?.getIndex() || 0 : 0;

                    // Build full hierarchical index for proper sorting in groups
                    const fullIndex = this.editor.level.buildFullObjectIndex(groupEditMode.group);
                    const indexParts = fullIndex.split('.').map(Number);

                    // Find the next object index in the current hierarchy level
                    const hierarchyLevel = indexParts.length;
                    const maxObjectIndex = this.editor.level.getNextZIndex() % 1;
                    const nextObjectIndex = maxObjectIndex;

                    base.zIndex = layerIndex + nextObjectIndex;

                    // Log zIndex assignment for duplicated objects
                    if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                        Logger.duplicate.debug(`Duplicated object ${base.name || base.id} placed in group ${groupEditMode.group.name}, assigned zIndex: ${base.zIndex} (layer ${layerIndex}, full hierarchy: ${fullIndex}, object index: ${Math.floor(nextObjectIndex * 1000)})`);
                    }
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

        // Save state AFTER placing objects but BEFORE changing selection
        this.editor.historyManager.saveState(
            this.editor.level.objects, 
            newIds, 
            false, 
            this.editor.stateManager.get('groupEditMode')
        );

        // Use the same reset method as cancel for consistency
        this.cancel();

        // Set selection after state is saved
        this.editor.stateManager.set('selectedObjects', newIds);

        this.editor.render();
        this.editor.updateAllPanels();

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


