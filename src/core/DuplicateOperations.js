import { BaseModule } from './BaseModule.js';
import { GameObject } from '../models/GameObject.js';
import { Group } from '../models/Group.js';

/**
 * Duplicate Operations module
 * Encapsulates start/update/confirm/cancel flow for duplicating objects
 */
export class DuplicateOperations extends BaseModule {

    // Remove helper fields recursively and ensure visibility defaults
    _sanitizeForPlacement(obj) {
        if (!obj) return obj;

        // Create new instance to avoid modifying original
        const cleaned = obj.type === 'group' ?
            new Group(obj) :
            new GameObject(obj);

        // Clean up temporary properties
        delete cleaned._offsetX;
        delete cleaned._offsetY;

        // Ensure essential properties have defaults
        cleaned.visible = cleaned.visible !== undefined ? cleaned.visible : true;
        cleaned.locked = cleaned.locked !== undefined ? cleaned.locked : false;
        cleaned.width = cleaned.width || 32;
        cleaned.height = cleaned.height || 32;
        cleaned.color = cleaned.color || '#cccccc';

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
        const selected = Array.from(selectedIds)
            .map(id => this.editor.level.findObjectById(id))
            .filter(Boolean);

        if (selected.length === 0) {
            return;
        }

        // Clone and normalize properties
        const clones = selected.map(obj => {
            const cloned = this.editor.deepClone(obj);
            // Assign unique ids to the entire subtree
            this.editor.reassignIdsDeep(cloned);

            // Ensure essential properties
            cloned.visible = cloned.visible !== undefined ? cloned.visible : true;
            cloned.locked = cloned.locked !== undefined ? cloned.locked : false;
            cloned.width = cloned.width || 32;
            cloned.height = cloned.height || 32;
            cloned.color = cloned.color || '#cccccc';

            // Normalize children if group
            if (cloned.type === 'group' && Array.isArray(cloned.children)) {
                cloned.children.forEach(child => {
                    child.visible = child.visible !== undefined ? child.visible : true;
                    child.locked = child.locked !== undefined ? child.locked : false;
                    child.width = child.width || 32;
                    child.height = child.height || 32;
                    child.color = child.color || '#cccccc';
                });
            }
            return cloned;
        });

        // Determine current world position under mouse (fallback to canvas center)
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

        // Initialize offsets relative to the cursor
        const initialized = this.editor.duplicateRenderUtils.initializePositions(clones, worldPos);

        // Apply initial positions so preview is visible immediately (even without mouse move)
        const positioned = this.editor.duplicateRenderUtils.updatePositions(initialized, worldPos);

        // Check if this is Alt+drag mode
        const isAltDragMode = mouse?.altKey || false;

        // Set duplicate state and start placing mode
        this.editor.stateManager.update({
            'mouse.isPlacingObjects': true,
            'mouse.placingObjects': positioned,
            'duplicate.isActive': true,
            'duplicate.objects': positioned,
            'duplicate.basePosition': { x: worldPos.x, y: worldPos.y },
            'duplicate.isAltDragMode': isAltDragMode
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

        const updatedObjects = this.editor.duplicateRenderUtils.updatePositions(duplicate.objects, worldPos);
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

        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        const newIds = new Set();

        duplicate.objects.forEach((obj) => {
            const offsetX = obj._offsetX ?? 0;
            const offsetY = obj._offsetY ?? 0;

            // Sanitize and place
            const base = this._sanitizeForPlacement(this.editor.deepClone(obj));
            this.editor.reassignIdsDeep(base);
            base.x = worldPos.x + offsetX;
            base.y = worldPos.y + offsetY;

            if (groupEditMode && groupEditMode.isActive && groupEditMode.group && this.editor.objectOperations.isPointInGroupBounds(base.x, base.y, groupEditMode)) {
                // Check if target group's layer is locked
                if (groupEditMode.group.layerId) {
                    const targetLayer = this.editor.level.getLayerById(groupEditMode.group.layerId);
                    if (targetLayer && targetLayer.locked) {
                        // Skip placing in locked layer - place on main level instead
                        this.editor.level.addObject(base);
                        newIds.add(base.id);
                        this.editor.invalidateObjectCaches(base.id);
                        return;
                    }
                }
                
                const groupPos = this.editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
                base.x -= groupPos.x;
                base.y -= groupPos.y;

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
            } else {
                this.editor.level.addObject(base);
            }

            newIds.add(base.id);

            // Invalidate caches for the new object
            this.editor.invalidateObjectCaches(base.id);
        });

        // Schedule full cache invalidation since multiple objects were added
        this.editor.scheduleCacheInvalidation();

        // Save state AFTER placing objects but BEFORE changing selection
        this.editor.historyManager.saveState(this.editor.level.objects, newIds);

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


