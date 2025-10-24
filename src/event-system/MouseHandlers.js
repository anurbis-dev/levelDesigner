import { BaseModule } from '../core/BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { SnapUtils } from '../utils/SnapUtils.js';
import { throttle } from '../utils/PerformanceUtils.js';
import { PERFORMANCE } from '../constants/EditorConstants.js';

/**
 * Mouse Handlers module for LevelEditor
 * Handles all mouse interactions and events
 */
export class MouseHandlers extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        
        // Performance optimization for zoom
        this.zoomAnimationFrame = null;
        
        // Create throttled versions of frequent event handlers
        this._throttledMouseMove = throttle(
            (e) => this._handleMouseMoveImpl(e), 
            PERFORMANCE.MOUSE_MOVE_THROTTLE_MS
        );
        this._throttledWheel = throttle(
            (e) => this._handleWheelImpl(e), 
            PERFORMANCE.WHEEL_THROTTLE_MS
        );
    }

    /**
     * Mouse event handlers
     */
    handleMouseDown(e) {
        const worldPos = this.screenToWorld(e);
        const mouse = this.getMouseState();

        // Ignore middle mouse button if clicked on panels (handled by ScrollUtils)
        if (e.button === 1) { // Middle mouse button
            const target = e.target;
            // Check if click is on right panel or toolbar (let respective handlers handle this)
            if (target.closest('#right-panel') || target.closest('#toolbar-container')) {
                return; // Let ScrollUtils or Toolbar handle this
            }
        }

        if (e.button === 2) { // Right mouse button
            // Right click handling is now done globally in handleGlobalMouseDown
            // This ensures it works even when clicking outside canvas
            return;
        }
        
        if (e.button === 1) { // Middle mouse button - zoom
            const camera = this.editor.stateManager.get('camera');
            this.editor.stateManager.update({
                'mouse.isMiddleDown': true,
                'mouse.lastX': e.clientX,
                'mouse.lastY': e.clientY,
                'mouse.zoomStartX': e.clientX,
                'mouse.zoomStartY': e.clientY,
                'mouse.initialZoom': camera.zoom
            });
            this.editor.canvasRenderer.canvas.style.cursor = 'zoom-in';
            return;
        }
        
        if (e.button === 0) { // Left mouse button
            this.editor.stateManager.update({
                'mouse.isLeftDown': true,
                'mouse.altKey': e.altKey
            });
            
            // Check if clicking on object
            const clickedObject = this.editor.objectOperations.findObjectAtPoint(worldPos.x, worldPos.y);
            
            if (clickedObject) {
                this.handleObjectClick(e, clickedObject, worldPos);
            } else {
                this.handleEmptyClick(e, worldPos);
            }
        }
    }

    /**
     * Mouse move handler (throttled for performance)
     * Delegates to _handleMouseMoveImpl
     */
    handleMouseMove(e) {
        this._throttledMouseMove(e);
    }

    /**
     * Internal implementation of mouse move (called by throttled handler)
     * @private
     */
    _handleMouseMoveImpl(e) {
        const worldPos = this.screenToWorld(e);
        const mouse = this.getMouseState();
        
        // Track if any objects are being moved into groups to delay rendering
        let objectsMovedToGroup = false;

        this.updateMouseState(e, worldPos);

        // Skip processing if middle mouse button and event is from panels
        if (mouse.isMiddleDown) {
            const target = e.target;
            if (target.closest('#right-panel')) {
                return; // Let ScrollUtils handle this
            }
        }

        if (mouse.isRightDown) {
            // Pan camera
            const dx = e.clientX - mouse.lastX;
            const dy = e.clientY - mouse.lastY;
            const camera = this.editor.stateManager.get('camera');

            // Check if this is significant movement (panning vs clicking)
            let shouldUpdatePanningFlag = false;
            if (mouse.rightClickStartX !== undefined && mouse.rightClickStartY !== undefined) {
                const distanceFromStart = Math.sqrt(
                    Math.pow(e.clientX - mouse.rightClickStartX, 2) +
                    Math.pow(e.clientY - mouse.rightClickStartY, 2)
                );

                // If moved more than 3 pixels, consider this panning (reduced threshold)
                if (distanceFromStart > 3 && !mouse.wasPanning) {
                    shouldUpdatePanningFlag = true;
                }
            }

            // Update state
            const stateUpdate = {
                'camera.x': camera.x - dx / camera.zoom,
                'camera.y': camera.y - dy / camera.zoom,
                'mouse.lastX': e.clientX,
                'mouse.lastY': e.clientY
            };

            if (shouldUpdatePanningFlag) {
                stateUpdate['mouse.wasPanning'] = true;
            }

            this.editor.stateManager.update(stateUpdate);

        } else if (mouse.isMiddleDown) {
            // Interactive zoom with middle mouse button
            this.handleMiddleMouseZoom(e);
        } else if (mouse.isLeftDown && mouse.isDragging) {
            // Drag objects
            objectsMovedToGroup = this.dragSelectedObjects(worldPos, e);
        } else if (mouse.isLeftDown && e.altKey && !this.editor.stateManager.get('duplicate.isActive')) {
            // Check if we should start Alt+drag duplication
            const selectedObjects = this.editor.stateManager.get('selectedObjects');
            if (selectedObjects && selectedObjects.size > 0) {
                Logger.mouse.debug('Starting Alt+drag duplication from selected objects');
                this.editor.duplicateOperations.startFromSelection();
            }
        } else if (this.editor.stateManager.get('duplicate.isActive')) {
            // Update duplicate objects position via DuplicateOperations
            this.editor.duplicateOperations.updatePreview(worldPos);
        } else if (mouse.isLeftDown && e.altKey && this.editor.stateManager.get('duplicate.isAltDragMode')) {
            // Alt+drag duplication mode - update preview
            this.editor.duplicateOperations.updatePreview(worldPos);
        } else if (mouse.isMarqueeSelecting) {
            // Update marquee (only if not Alt+drag)
            this.updateMarquee(worldPos);
        }

        // Freeze group frame while Alt is pressed (for dragging objects out)
        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            if (e.altKey) {
                if (!groupEditMode.frameFrozen) {
                    this.editor.stateManager.set('groupEditMode', {
                        ...groupEditMode,
                        frameFrozen: true,
                        frozenBounds: this.editor.objectOperations.getObjectWorldBounds(groupEditMode.group)
                    });
                }
            } else if (groupEditMode.frameFrozen) {
                this.editor.stateManager.set('groupEditMode', {
                    ...groupEditMode,
                    frameFrozen: false,
                    frozenBounds: null
                });
            }
        }

        // Only render if something actually changed
        // Skip rendering if objects are being moved into groups to prevent flicker
        if (!objectsMovedToGroup && (mouse.isPlacingObjects || mouse.isRightDown || mouse.isMiddleDown || (mouse.isLeftDown && mouse.isDragging) || mouse.isMarqueeSelecting || this.editor.stateManager.get('duplicate.isActive'))) {
            this.editor.render();
        }
        
        // If objects were moved into groups, render after all operations are complete
        if (objectsMovedToGroup) {
            this.editor.render();
        }
    }

    handleMouseUp(e) {
        const mouse = this.editor.stateManager.get('mouse');

        // Skip processing middle mouse button if event is from panels
        if (e.button === 1) { // Middle mouse button
            const target = e.target;
            if (target.closest('#right-panel') || target.closest('#toolbar-container')) {
                return; // Let ScrollUtils or Toolbar handle this
            }
        }

        if (e.button === 2) {
            Logger.mouse.debug('Right mouse up, was panning:', mouse.wasPanning);

            // Don't reset wasPanning immediately - let contextmenu handler do it
            // This prevents race condition between mouseup and contextmenu events

            this.editor.stateManager.update({
                'mouse.isRightDown': false,
                'mouse.altKey': e.altKey
            });

            // Schedule cleanup after contextmenu event
            setTimeout(() => {
                this.editor.stateManager.update({
                    'mouse.rightClickStartX': undefined,
                    'mouse.rightClickStartY': undefined,
                    'mouse.wasPanning': false
                });
            }, 100);

            this.editor.canvasRenderer.canvas.style.cursor = 'default';

            // Right click cancels all current actions (except marquee - handled globally)
            this.editor.cancelAllActions();
        }
        
        if (e.button === 1) { // Middle mouse button
            this.editor.stateManager.update({
                'mouse.isMiddleDown': false,
                'mouse.initialZoom': null
            });
            this.editor.canvasRenderer.canvas.style.cursor = 'default';
        }
        
        if (e.button === 0) {
            const currentAlt = e.altKey || mouse.altKey;
            const wasDragging = mouse.isDragging; // Save dragging state before resetting
            
            if (mouse.isDragging) {
                this.editor.historyManager.saveState(
                    this.editor.level.objects, 
                    this.editor.stateManager.get('selectedObjects'), 
                    false, 
                    this.editor.stateManager.get('groupEditMode')
                );
                this.editor.stateManager.markDirty();
                
                // Update panels after drag ends to show final position
                this.editor.updateAllPanels();
            }
            
            this.editor.stateManager.update({
                'mouse.isLeftDown': false,
                'mouse.isDragging': false,
                'mouse.altKey': e.altKey,
                'mouse.constrainedAxis': null,
                'mouse.axisCenter': null,
                'mouse.snappedToGrid': false,
                'mouse.snapTargetX': null,
                'mouse.snapTargetY': null,
                'mouse.anchorX': null,
                'mouse.anchorY': null,
                'mouse.offsetX': null,
                'mouse.offsetY': null
            });
            
            if (mouse.isMarqueeSelecting) {
                this.finishMarqueeSelection();
                // Note: finishMarqueeSelection now handles Alt+drag duplication internally
            }

            // If we are in group edit mode and released after dragging with Alt
            if (this.isInGroupEditMode() && currentAlt && wasDragging) {
                const groupEditMode = this.getGroupEditMode();
                Logger.mouse.debug('Alt+drag detected in group edit mode');
                const selectedIds = this.editor.stateManager.get('selectedObjects');
                
                // MODIFICATION: Calculate group bounds EXCLUDING dragged objects.
                const bounds = this.editor.objectOperations.getObjectWorldBounds(groupEditMode.group, Array.from(selectedIds));

                const selected = Array.from(selectedIds)
                    .map(id => this.editor.level.findObjectById(id))
                    .filter(Boolean);

                // Process each selected object for potential move out of group
                let movedObjectsCount = 0;
                selected.forEach(obj => {
                    // Only consider direct children of the edited group
                    const isChild = this.editor.objectOperations.isObjectInGroup(obj, groupEditMode.group);
                    if (isChild) {
                        // Get current world position and bounds of the object
                        const groupPos = this.editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
                        const worldX = groupPos.x + obj.x;
                        const worldY = groupPos.y + obj.y;
                        const objWidth = obj.width || 32;
                        const objHeight = obj.height || 32;

                        // Object bounds in world coordinates
                        const objBounds = {
                            minX: worldX,
                            minY: worldY,
                            maxX: worldX + objWidth,
                            maxY: worldY + objHeight
                        };

                        // Check if object bounds intersect with group bounds
                        const hasIntersection = objBounds.minX < bounds.maxX &&
                                              objBounds.maxX > bounds.minX &&
                                              objBounds.minY < bounds.maxY &&
                                              objBounds.maxY > bounds.minY;

                        if (!hasIntersection) {
                            // CRITICAL FIX: Invalidate spatial index BEFORE moving objects
                            this.editor.renderOperations.invalidateSpatialIndex();

                            // Move object out of group
                            groupEditMode.group.children = groupEditMode.group.children.filter(c => c.id !== obj.id);
                            obj.x = worldX;
                            obj.y = worldY;
                            
                            // CRITICAL FIX: Clear cache for moved objects to prevent phantom references
                            this.editor.invalidateObjectCaches(obj.id);
                            this.editor.level.addObject(obj);
                            movedObjectsCount++;
                        }
                    }
                });

                // Log summary and check if group became empty
                if (movedObjectsCount > 0) {
                    Logger.mouse.debug(`Moved ${movedObjectsCount} objects out of group: ${groupEditMode.group.name}`);
                    const groupWasRemoved = this.editor.groupOperations.removeEmptyGroup(groupEditMode.group);
                    if (groupWasRemoved) {
                        Logger.mouse.debug('Group was removed after drag & drop');
                        this.editor.updateAllPanels();
                    }
                }
            }
            
            if (mouse.isPlacingObjects) {
                const worldPos = this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.editor.stateManager.get('camera'));
                this.finishPlacingObjects(worldPos);
            }
            
            // Handle Alt+drag duplication completion
            if (this.editor.stateManager.get('duplicate.isAltDragMode')) {
                const worldPos = this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.editor.stateManager.get('camera'));
                Logger.mouse.debug('Alt+drag duplication completed');
                this.editor.duplicateOperations.confirmPlacement(worldPos);
            }
        }
    }

    handleGlobalMouseDown(e) {
        Logger.mouse.debug(`Global mousedown: button=${e.button}, target=${e.target.tagName}, (${e.clientX}, ${e.clientY})`);

        // Right mouse button marquee cancellation is now handled in BaseContextMenu
        // This ensures consistent behavior across all panels and prevents conflicts
        if (e.button === 2) { // Right mouse button
            // Update right mouse state
            this.editor.stateManager.update({
                'mouse.isRightDown': true,
                'mouse.lastX': e.clientX,
                'mouse.lastY': e.clientY,
                'mouse.rightClickStartX': e.clientX,
                'mouse.rightClickStartY': e.clientY,
                'mouse.wasPanning': false,
                'mouse.altKey': e.altKey
            });

            this.editor.canvasRenderer.canvas.style.cursor = 'grabbing';
        }
    }

    handleGlobalMouseMove(e) {
        const mouse = this.editor.stateManager.get('mouse');
        const canvas = this.editor.canvasRenderer.canvas;
        const rect = canvas.getBoundingClientRect();

        // Check if mouse is inside canvas bounds
        const isInsideCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                              e.clientY >= rect.top && e.clientY <= rect.bottom;

        if (mouse.isMarqueeSelecting && !isInsideCanvas) {
            // Constrain marquee to canvas bounds
            const constrainedX = Math.max(rect.left, Math.min(rect.right, e.clientX));
            const constrainedY = Math.max(rect.top, Math.min(rect.bottom, e.clientY));

            const worldPos = this.editor.canvasRenderer.screenToWorld(constrainedX, constrainedY, this.editor.stateManager.get('camera'));
            this.updateMarquee(worldPos);
            this.editor.render();
        }
    }

    handleGlobalMouseUp(e) {
        Logger.mouse.debug(`Global mouseup: button=${e.button}, target=${e.target.tagName}, (${e.clientX}, ${e.clientY})`);

        const mouse = this.editor.stateManager.get('mouse');
        const canvas = this.editor.canvasRenderer.canvas;
        const rect = canvas.getBoundingClientRect();

        // Check if mouse is outside canvas (with some tolerance for edge cases)
        const tolerance = 10; // pixels
        const isOutsideCanvas = e.clientX < (rect.left - tolerance) || e.clientX > (rect.right + tolerance) ||
                               e.clientY < (rect.top - tolerance) || e.clientY > (rect.bottom + tolerance);

        // Also check for very large coordinates that indicate mouse is outside window bounds
        const isOutsideWindow = e.clientX < -1000 || e.clientX > 10000 || e.clientY < -1000 || e.clientY > 10000;
        const shouldCancel = isOutsideCanvas || isOutsideWindow;

        Logger.mouse.debug(`Global mouseup at (${e.clientX}, ${e.clientY}), canvas rect:`, rect, 'isOutside:', isOutsideCanvas);
        
        if (e.button === 0) {
            // Handle marquee selection completion (both inside and outside canvas)
            if (mouse.isMarqueeSelecting) {
                Logger.mouse.info(`Left mouse released - finishing marquee selection (${isOutsideCanvas ? 'outside' : 'inside'} canvas)`);
                this.finishMarqueeSelection();
            }

            // Cancel object dragging if outside canvas
            if (mouse.isDragging && shouldCancel) {
                Logger.mouse.info('Mouse released outside canvas - canceling drag');
                this.editor.stateManager.update({
                    'mouse.isLeftDown': false,
                    'mouse.isDragging': false,
                    'mouse.constrainedAxis': null,
                    'mouse.axisCenter': null,
                    'mouse.snappedToGrid': false,
                    'mouse.snapTargetX': null,
                    'mouse.snapTargetY': null,
                    'mouse.anchorX': null,
                    'mouse.anchorY': null,
                    'mouse.offsetX': null,
                    'mouse.offsetY': null
                });
                this.editor.historyManager.undo();
                this.editor.render();
            }
        }
        
        if (e.button === 2) {
            // Right mouse button marquee cancellation is now handled in BaseContextMenu
            // This ensures consistent behavior and prevents conflicts

            this.editor.stateManager.update({
                'mouse.isRightDown': false
            });
            this.editor.canvasRenderer.canvas.style.cursor = 'default';
        }
    }

    /**
     * Mouse wheel handler (throttled for performance)
     * Delegates to _handleWheelImpl
     */
    handleWheel(e) {
        e.preventDefault();
        this._throttledWheel(e);
    }

    /**
     * Internal implementation of mouse wheel (called by throttled handler)
     * @private
     */
    _handleWheelImpl(e) {
        
        // Cancel previous animation frame if still pending
        if (this.zoomAnimationFrame) {
            cancelAnimationFrame(this.zoomAnimationFrame);
        }
        
        // Use requestAnimationFrame for smooth zoom but allow immediate updates
        this.zoomAnimationFrame = requestAnimationFrame(() => {
            this.performZoom(e);
            this.zoomAnimationFrame = null;
        });
    }
    
    performZoom(e) {
        const zoomIntensity = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        const camera = this.editor.stateManager.get('camera');

        const oldZoom = camera.zoom;
        const newZoom = Math.max(0.1, Math.min(10, oldZoom * (1 + direction * zoomIntensity)));

        // Calculate new camera position to keep mouse position fixed
        const mouseWorldPosBeforeZoom = this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, camera);

        // Create a temporary camera object for calculations
        const tempCamera = { ...camera, zoom: newZoom };
        const mouseWorldPosAfterZoom = this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, tempCamera);

        const newCameraX = camera.x + mouseWorldPosBeforeZoom.x - mouseWorldPosAfterZoom.x;
        const newCameraY = camera.y + mouseWorldPosBeforeZoom.y - mouseWorldPosAfterZoom.y;

        // Update camera in one operation
        this.editor.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': newCameraX,
            'camera.y': newCameraY
        });

        // Immediate render for responsive zoom
        this.editor.render();
    }

    handleDragOver(e) {
        // Skip if tab dragging is active
        if (e.target.closest('.tab') || this.editor.assetPanel?.isDraggingTab) {
            return;
        }
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handleDrop(e) {
        // Skip if tab dragging is active
        if (e.target.closest('.tab') || this.editor.assetPanel?.isDraggingTab) {
            return;
        }
        
        e.preventDefault();

        const mouse = this.editor.stateManager.get('mouse');
        if (!mouse.isDraggingAsset) return;

        // Check if current layer is locked
        const currentLayer = this.editor.getCurrentLayer();
        if (currentLayer && currentLayer.locked) {
            Logger.mouse.warn(`Cannot add objects: current layer '${currentLayer.name}' is locked`);
            return;
        }
        
        // If no current layer, try to get Main layer
        if (!currentLayer) {
            Logger.mouse.warn('No current layer available, objects may not be visible');
        }

        const droppedAssetIds = JSON.parse(e.dataTransfer.getData('application/json'));
        const worldPos = this.screenToWorld(e);

        const newIds = new Set();

        droppedAssetIds.forEach((assetId, index) => {
            const asset = this.editor.assetManager.getAsset(assetId);
            if (asset) {
                let x = worldPos.x + index * 10;
                let y = worldPos.y + index * 10;

                // Apply snap to grid if enabled
                if (SnapUtils.isSnapToGridEnabled(this.editor.stateManager, this.editor.level)) {
                    const gridSize = SnapUtils.getGridSize(this.editor.stateManager, this.editor.level);
                    const snapTolerancePercent = this.editor.stateManager.get('canvas.snapTolerance') || 40;
                    const tolerance = gridSize * (snapTolerancePercent / 100);
                    
                    // Find nearest grid point for drop position
                    const nearestGrid = SnapUtils.findNearestGridPoint(x, y, gridSize, tolerance);
                    
                    if (nearestGrid) {
                        x = nearestGrid.x;
                        y = nearestGrid.y;
                    }
                }

                // Get current layer for new objects (already checked above)
                const newObject = asset.createInstance(x, y, currentLayer ? currentLayer.id : null);

                // Check if we're in group edit mode and the drop point is inside the group bounds
                if (this.isInGroupEditMode() && this.editor.objectOperations.isPointInGroupBounds(worldPos.x, worldPos.y)) {
                    const groupEditMode = this.getGroupEditMode();
                    // Convert to relative coordinates using group's WORLD position
                    const groupPos = this.editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
                    newObject.x -= groupPos.x;
                    newObject.y -= groupPos.y;

                    // Set layerId to match the group's layer for proper zIndex assignment
                    newObject.layerId = groupEditMode.group.layerId;

                    // Assign zIndex for objects dropped into groups
                    this.editor.level.assignInitialZIndex(newObject, newObject.layerId);

                    // Log zIndex assignment for dropped objects
                    if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                        const layerIndex = Math.floor(newObject.zIndex);
                        const objectIndex = Math.floor((newObject.zIndex % 1) * 1000);
                        Logger.mouse.debug(`Object ${newObject.name || newObject.id} dropped into group ${groupEditMode.group.name}, assigned zIndex: ${newObject.zIndex} (layer ${layerIndex}, object index: ${objectIndex})`);
                    }

                    groupEditMode.group.children.push(newObject);
                } else {
                    // Add to main level with current layer (or null if no current layer)
                    this.editor.level.addObject(newObject, currentLayer ? currentLayer.id : null);
                }

                newIds.add(newObject.id);
            }
        });

        // Invalidate caches for all new objects
        newIds.forEach(objId => {
            this.editor.invalidateObjectCaches(objId);
        });

        // Schedule full cache invalidation since multiple objects were added
        this.editor.scheduleCacheInvalidation();
        
        // Also invalidate spatial index for immediate visibility
        if (this.editor.renderOperations) {
            this.editor.renderOperations.invalidateSpatialIndex();
        }

        // Save state AFTER all objects are added
        this.editor.historyManager.saveState(
            this.editor.level.objects, 
            newIds, 
            false, 
            this.editor.stateManager.get('groupEditMode')
        );

        this.editor.stateManager.set('selectedObjects', newIds);
        this.editor.stateManager.update({
            'mouse.isDraggingAsset': false
        });

        this.editor.render();
        this.editor.updateAllPanels();
    }

    handleDoubleClick(e) {
        const worldPos = this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.editor.stateManager.get('camera'));
        const clickedObject = this.editor.objectOperations.findObjectAtPoint(worldPos.x, worldPos.y);
        
        if (clickedObject && clickedObject.type === 'group') {
            this.editor.groupOperations.openGroupEditMode(clickedObject);
        }
    }


    // Helper methods for mouse interactions
    handleObjectClick(e, obj, worldPos) {
        const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
        const isSelected = selectedObjects.has(obj.id);
        let selectionChanged = false;
        
        // Check for Alt+drag duplication - works on any object, selected or not
        if (e.altKey) {
            Logger.mouse.debug('Alt+click on object, starting duplication');
            
            // If object is not selected, select it first
            if (!isSelected) {
                selectedObjects.clear();
                selectedObjects.add(obj.id);
                this.editor.stateManager.set('selectedObjects', selectedObjects);
                this.editor.updateAllPanels();
            }
            
            this.editor.duplicateOperations.startFromSelection();
            return; // Don't process normal selection logic
        }
        
        if (!e.shiftKey) {
            if (!isSelected) {
                selectedObjects.clear();
                selectedObjects.add(obj.id);
                selectionChanged = true;
            }
        } else {
            if (isSelected) {
                selectedObjects.delete(obj.id);
                selectionChanged = true;
            } else {
                selectedObjects.add(obj.id);
                selectionChanged = true;
            }
        }
        
        if (selectionChanged) {
            this.editor.stateManager.set('selectedObjects', selectedObjects);
            this.editor.updateAllPanels();
        }
        
        // Only start dragging if the clicked object is selected
        if (selectedObjects.has(obj.id)) {
            // Calculate anchor point (bottom-left corner of object) for snap-to-grid
            const objWorldPos = this.editor.objectOperations.getObjectWorldPosition(obj);
            const objHeight = obj.height || 32;
            const anchorX = objWorldPos.x;
            const anchorY = objWorldPos.y + objHeight;
            
            // Calculate offset from click point to anchor point
            const offsetX = anchorX - worldPos.x;
            const offsetY = anchorY - worldPos.y;
            
            this.editor.stateManager.update({
                'mouse.isDragging': true,
                'mouse.dragStartX': worldPos.x,
                'mouse.dragStartY': worldPos.y,
                'mouse.anchorX': anchorX,
                'mouse.anchorY': anchorY,
                'mouse.offsetX': offsetX,
                'mouse.offsetY': offsetY,
                'mouse.snappedToGrid': false,
                'mouse.snapTargetX': null,
                'mouse.snapTargetY': null
            });
        }
    }

    handleEmptyClick(e, worldPos) {
        // Don't clear selection if we just did an undo/redo operation
        if (this.editor.historyManager && (this.editor.historyManager.isUndoing || this.editor.historyManager.isRedoing)) {
            return;
        }

        const selectedObjects = this.editor.stateManager.get('selectedObjects');

        // If Alt is pressed, don't start marquee selection - let Alt+drag handle it
        if (e.altKey) {
            // Just clear selection if not Shift+click
            if (!e.shiftKey) {
                this.editor.stateManager.set('selectedObjects', new Set());
            }
            return;
        }

        // If editing groups, only close when clicking OUTSIDE the active group's frame
        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            const bounds = this.editor.objectOperations.getObjectWorldBounds(groupEditMode.group);
            const inside = worldPos.x >= bounds.minX && worldPos.x <= bounds.maxX && worldPos.y >= bounds.minY && worldPos.y <= bounds.maxY;
            if (inside) {
                // Start marquee selection instead of closing
                if (!e.shiftKey) {
                    this.editor.stateManager.set('selectedObjects', new Set());
                }
                this.editor.stateManager.update({
                    'mouse.isMarqueeSelecting': true,
                    'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
                    'mouse.marqueeStartX': worldPos.x,
                    'mouse.marqueeStartY': worldPos.y
                });
                return;
            }
            // Outside: close group edit mode
            this.editor.groupOperations.closeGroupEditMode();
            return;
        }

        // Normal behavior
        if (!e.shiftKey) {
            this.editor.stateManager.set('selectedObjects', new Set());
        }
        this.editor.stateManager.update({
            'mouse.isMarqueeSelecting': true,
            'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
            'mouse.marqueeStartX': worldPos.x,
            'mouse.marqueeStartY': worldPos.y
        });
    }

    dragSelectedObjects(worldPos, e) {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        
        // Track if any objects are being moved into groups to delay rendering
        let objectsMovedToGroup = false;
        const mouse = this.editor.stateManager.get('mouse');
        const shiftKey = this.editor.stateManager.get('keyboard.shiftKey');

        // Check if snap to grid is enabled
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
                // Calculate current position of object's bottom-left corner
                const selectedObjects = this.editor.stateManager.get('selectedObjects');
                let currentBottomLeftX = mouse.anchorX;
                let currentBottomLeftY = mouse.anchorY;
                
                // If we have selected objects, get the current position of the first one
                if (selectedObjects && selectedObjects.size > 0) {
                    const firstObjId = Array.from(selectedObjects)[0];
                    const firstObj = this.editor.level.findObjectById(firstObjId);
                    if (firstObj) {
                        const objWorldPos = this.editor.objectOperations.getObjectWorldPosition(firstObj);
                        const objHeight = firstObj.height || 32;
                        currentBottomLeftX = objWorldPos.x;
                        currentBottomLeftY = objWorldPos.y + objHeight;
                    }
                }
                
                // Snap to grid - move anchor to grid point
                if (!mouse.snappedToGrid) {
                    // First time snapping - record the snap target and calculate movement
                    this.editor.stateManager.update({
                        'mouse.snappedToGrid': true,
                        'mouse.snapTargetX': nearestGrid.x,
                        'mouse.snapTargetY': nearestGrid.y
                    });
                    
                    // Move object so its bottom-left corner goes to grid point
                    dx = nearestGrid.x - currentBottomLeftX;
                    dy = nearestGrid.y - currentBottomLeftY;
                    
                } else {
                    // Already snapped - check if we need to move to a new grid point
                    if (nearestGrid.x !== mouse.snapTargetX || nearestGrid.y !== mouse.snapTargetY) {
                        // New grid point found - update target and move
                        this.editor.stateManager.update({
                            'mouse.snapTargetX': nearestGrid.x,
                            'mouse.snapTargetY': nearestGrid.y
                        });
                        
                        // Move object to new grid point
                        dx = nearestGrid.x - currentBottomLeftX;
                        dy = nearestGrid.y - currentBottomLeftY;
                        
                    } else {
                        // Same grid point - no movement
                        dx = 0;
                        dy = 0;
                    }
                }
            } else {
                // No grid point within tolerance
                if (mouse.snappedToGrid) {
                    // Was snapped, stay on previous grid point until new one is found
                    // Don't reset snappedToGrid - keep object on current grid point
                    dx = 0;
                    dy = 0;
                    
                } else {
                    // Not snapped and no grid nearby - follow cursor normally
                    dx = worldPos.x - mouse.dragStartX;
                    dy = worldPos.y - mouse.dragStartY;
                }
            }
        } else {
            // Snap disabled - normal relative movement (no offset)
            if (mouse.snappedToGrid) {
                // Was snapped, now unsnap - return to cursor position
                this.editor.stateManager.update({
                    'mouse.snappedToGrid': false,
                    'mouse.snapTargetX': null,
                    'mouse.snapTargetY': null,
                    'mouse.dragStartX': worldPos.x,
                    'mouse.dragStartY': worldPos.y
                });
                
            }
            
            // Normal relative movement with original offset
            dx = worldPos.x - mouse.dragStartX;
            dy = worldPos.y - mouse.dragStartY;
        }

        // Apply Shift constraint for axis locking
        if (shiftKey && mouse.isDragging) {
            // Determine constrained axis based on initial movement direction
            if (mouse.constrainedAxis === null) {
                // Set axis based on which direction has more movement
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                
                if (absDx > absDy) {
                    mouse.constrainedAxis = 'x';
                } else if (absDy > absDx) {
                    mouse.constrainedAxis = 'y';
                } else {
                    // Equal movement - default to X axis
                    mouse.constrainedAxis = 'x';
                }
                
                // Update state with constrained axis
                this.editor.stateManager.update({
                    'mouse.constrainedAxis': mouse.constrainedAxis
                });
            }
            
            // Calculate center of selected objects in their current positions
            const axisCenter = this.editor.objectOperations.getSelectedObjectsCenter(selectedObjects);
            
            // Update axis center to current position
            this.editor.stateManager.update({
                'mouse.axisCenter': axisCenter
            });
            
            // Apply constraint
            if (mouse.constrainedAxis === 'x') {
                dy = 0; // Lock Y movement
            } else if (mouse.constrainedAxis === 'y') {
                dx = 0; // Lock X movement
            }
        } else if (!shiftKey && mouse.constrainedAxis !== null) {
            // Reset constraint when Shift is released
            this.editor.stateManager.update({
                'mouse.constrainedAxis': null,
                'mouse.axisCenter': null
            });
        }

        // Cache group positions to avoid repeated calculations
        let groupPos = null;
        let activeGroupPos = null;
        
        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            groupPos = this.editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
            activeGroupPos = this.editor.objectOperations.getObjectWorldPosition(this.getActiveGroup());
        }

        selectedObjects.forEach(id => {
            const obj = this.editor.level.findObjectById(id);
            if (obj) {
                // Check if object is on main level or inside any of the open groups (including nested subgroups)
                const isOnMainLevel = this.editor.level.objects.some(topObj => topObj.id === obj.id);
                const isInAnyOpenGroup = this.isInGroupEditMode() &&
                    this.editor.groupOperations.getOpenGroups().some(group =>
                        this.editor.objectOperations.isObjectInGroupRecursive(obj, group)
                    );

                if (isOnMainLevel) {
                    // Object is on main level - move it normally
                    obj.x += dx;
                    obj.y += dy;

                    // If dragged into edited group bounds, move under the group with relative coordinates
                    if (!this.isAltKeyPressed() && this.isInGroupEditMode() && this.editor.objectOperations.isPointInGroupBounds(obj.x, obj.y)) {
                        const groupEditMode = this.getGroupEditMode();
                        
                        // Check if target group's layer is locked
                        if (groupEditMode.group.layerId) {
                            const targetLayer = this.editor.level.getLayerById(groupEditMode.group.layerId);
                            if (targetLayer && targetLayer.locked) {
                                // Skip moving to locked layer
                                return;
                            }
                        }
                        
                        // Convert world -> relative to group's world position (use cached position)
                        obj.x -= groupPos.x;
                        obj.y -= groupPos.y;

                        // FORCED INHERITANCE: Always inherit layerId from parent group
                        if (groupEditMode.group.layerId) {
                            const oldLayerId = obj.layerId;
                            obj.layerId = groupEditMode.group.layerId;

                            // Log forced inheritance
                            Logger.layer.info(`Drag inheritance: ${obj.name || obj.id} layerId ${oldLayerId || 'none'} → ${groupEditMode.group.layerId}`);

                            // Clear effective layer cache for this object
                            this.editor.renderOperations.clearEffectiveLayerCacheForObject(obj.id);

                            // If object is a group, propagate layerId to all its children recursively
                            if (obj.type === 'group' && obj.children) {
                                groupEditMode.group.propagateLayerIdToChildren(obj);
                            }
                        }

                        // CRITICAL FIX: Invalidate spatial index BEFORE moving objects
                        this.editor.renderOperations.invalidateSpatialIndex();
                        
                        // Set flag to delay rendering until all operations are complete
                        objectsMovedToGroup = true;
                        
                        // Move object into group FIRST, then remove from main level
                        // This prevents the object from appearing in both places simultaneously
                        groupEditMode.group.children.push(obj);
                        this.editor.level.removeObject(obj.id);
                    }
                } else if (isInAnyOpenGroup) {
                    // Object is inside any of the open groups
                    if (this.isAltKeyPressed()) {
                        // Alt+drag: move in world coordinates by converting to world position first
                        const worldX = groupPos.x + obj.x;
                        const worldY = groupPos.y + obj.y;
                        
                        // Move in world coordinates
                        const newWorldX = worldX + dx;
                        const newWorldY = worldY + dy;
                        
                        // Convert back to relative coordinates (use cached position)
                        obj.x = newWorldX - activeGroupPos.x;
                        obj.y = newWorldY - activeGroupPos.y;
                    } else {
                        // Normal drag: move relative to group
                        obj.x += dx;
                        obj.y += dy;
                    }
                }

                // If it's a group, all children move with it automatically
                // because they are positioned relative to the group
            }
        });

        // Update drag start position only when not snapped to grid
        if (!mouse.snappedToGrid) {
            this.editor.stateManager.update({
                'mouse.dragStartX': worldPos.x,
                'mouse.dragStartY': worldPos.y
            });
        }

        // Don't update panels during drag to avoid real-time position updates
        // Panels will be updated when drag ends in handleMouseUp
        
        return objectsMovedToGroup;
    }

    updateMarquee(worldPos) {
        const mouse = this.editor.stateManager.get('mouse');
        if (mouse.marqueeRect) {
            const startX = mouse.marqueeStartX || mouse.marqueeRect.x;
            const startY = mouse.marqueeStartY || mouse.marqueeRect.y;
            
            mouse.marqueeRect.x = Math.min(startX, worldPos.x);
            mouse.marqueeRect.y = Math.min(startY, worldPos.y);
            mouse.marqueeRect.width = Math.abs(worldPos.x - startX);
            mouse.marqueeRect.height = Math.abs(worldPos.y - startY);
        }
    }


    finishMarqueeSelection() {
        const mouse = this.editor.stateManager.get('mouse');
        if (!mouse.marqueeRect) return;

        const marquee = mouse.marqueeRect;
        const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));

        if (this.isInGroupEditMode()) {
            // In group edit mode, check ALL descendants without viewport filtering
            const groupEditMode = this.getGroupEditMode();
            const selectable = this.editor.objectOperations.computeSelectableSet();

            // Collect all descendants of the edited group
            const collect = (g) => {
                const res = [];
                g.children.forEach(ch => {
                    if (selectable.has(ch.id)) {
                        res.push(ch);
                    }
                    if (ch.type === 'group') res.push(...collect(ch));
                });
                return res;
            };
            const candidates = collect(groupEditMode.group);

            candidates.forEach(obj => {
                const bounds = this.editor.renderOperations.parallaxRenderer.getObjectWorldBoundsWithParallax(obj, this.editor.renderOperations.getEffectiveLayerId(obj));
                if (marquee.x < bounds.maxX && marquee.x + marquee.width > bounds.minX &&
                    marquee.y < bounds.maxY && marquee.y + marquee.height > bounds.minY) {
                    selectedObjects.add(obj.id);
                }
            });
        } else {
            // Normal mode - use viewport optimization for better performance
            const selectableInViewport = this.editor.getSelectableObjectsInViewport();
            selectableInViewport.forEach(objId => {
                const obj = this.editor.getCachedObject(objId);
                if (obj) {
                    const bounds = this.editor.renderOperations.parallaxRenderer.getObjectWorldBoundsWithParallax(obj, this.editor.renderOperations.getEffectiveLayerId(obj));
                    if (marquee.x < bounds.maxX && marquee.x + marquee.width > bounds.minX &&
                        marquee.y < bounds.maxY && marquee.y + marquee.height > bounds.minY) {
                        selectedObjects.add(obj.id);
                    }
                }
            });
        }

        this.editor.stateManager.set('selectedObjects', selectedObjects);
        this.editor.stateManager.update({
            'mouse.marqueeRect': null,
            'mouse.marqueeStartX': null,
            'mouse.marqueeStartY': null
        });
        
        // Check if Alt is still pressed after marquee selection to start duplication
        const currentMouse = this.editor.stateManager.get('mouse');
        if (currentMouse.altKey && selectedObjects.size > 0) {
            Logger.mouse.debug('Alt+drag duplication after marquee selection');
            this.editor.duplicateOperations.startFromSelection();
        }
    }

    /**
     * Finish placing objects (duplication)
     */
    finishPlacingObjects(worldPos) {
        const mouse = this.editor.stateManager.get('mouse');
        this.editor.duplicateOperations.confirmPlacement(worldPos);
    }

    /**
     * Handle interactive zoom with middle mouse button drag
     */
    handleMiddleMouseZoom(e) {
        const mouse = this.editor.stateManager.get('mouse');
        const camera = this.editor.stateManager.get('camera');
        
        // Get the initial zoom level when middle mouse was first pressed
        const initialZoom = mouse.initialZoom || camera.zoom;
        
        // Calculate zoom factor based on drag distance from start point
        // Positive Y movement (down) = zoom in, negative Y movement (up) = zoom out
        const deltaY = e.clientY - mouse.zoomStartY;
        const zoomIntensity = 0.01; // Increased sensitivity for better responsiveness
        const zoomFactor = 1 + (deltaY * zoomIntensity);
        
        // Calculate new zoom based on initial zoom, not current zoom
        const newZoom = Math.max(0.1, Math.min(10, initialZoom * zoomFactor));
        
        // Only update if zoom actually changed
        if (Math.abs(newZoom - camera.zoom) > 0.001) {
            // Use the original mouse position (zoomStartX, zoomStartY) for zoom center
            const mouseWorldPosBeforeZoom = this.editor.canvasRenderer.screenToWorld(mouse.zoomStartX, mouse.zoomStartY, camera);
            
            // Create temporary camera for calculations
            const tempCamera = { ...camera, zoom: newZoom };
            const mouseWorldPosAfterZoom = this.editor.canvasRenderer.screenToWorld(mouse.zoomStartX, mouse.zoomStartY, tempCamera);
            
            // Adjust camera position to keep original mouse point fixed
            const newCameraX = camera.x + mouseWorldPosBeforeZoom.x - mouseWorldPosAfterZoom.x;
            const newCameraY = camera.y + mouseWorldPosBeforeZoom.y - mouseWorldPosAfterZoom.y;
            
            // Update camera
            this.editor.stateManager.update({
                'camera.zoom': newZoom,
                'camera.x': newCameraX,
                'camera.y': newCameraY,
                'mouse.lastX': e.clientX,
                'mouse.lastY': e.clientY
            });
            
            // Don't update cursor during zoom - it stays as set in handleMouseDown
        }
    }
}
