import { BaseModule } from '../core/BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { SnapUtils } from '../utils/SnapUtils.js';
import { throttle } from '../utils/PerformanceUtils.js';
import { PERFORMANCE, TRANSFORM } from '../constants/EditorConstants.js';
import { SelectionUtils } from '../utils/SelectionUtils.js';

/**
 * Mouse Handlers module for LevelEditor
 * Handles all mouse interactions and events
 */
export class MouseHandlers extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        
        // Performance optimization for zoom
        this.zoomAnimationFrame = null;

        // Snapshot of selection geometry at rotate/scale gesture start
        this._transformSnapshot = null;

        // Baseline (position + children-bounds center) of every ROTATED ancestor group of
        // the dragged/transformed selection, captured at gesture start. Used to compensate
        // each ancestor's x/y during the gesture so its rotation pivot (children-bounds
        // center, recomputed each frame) doesn't make untouched siblings drift on screen.
        // See _applyPivotCompensation for the math.
        this._pivotCompensationBaseline = null;
        
        // Create throttled versions of frequent event handlers
        this._throttledMouseMove = throttle(
            (e) => this._handleMouseMoveImpl(e), 
            PERFORMANCE.MOUSE_MOVE_THROTTLE_MS
        );
        this._throttledWheel = throttle(
            (e) => this._handleWheelImpl(e),
            PERFORMANCE.WHEEL_THROTTLE_MS
        );
        this._throttledGlobalMouseMove = throttle(
            (e) => this._handleGlobalMouseMoveImpl(e),
            PERFORMANCE.MOUSE_MOVE_THROTTLE_MS
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
            // Handle right click for canvas panning
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

            // During duplicate placement the click confirms placement (handled in mouseup).
            // Skip selection/drag logic so the original object is not re-selected and
            // isDragging is not set (which would cause a spurious history save).
            if (mouse.isPlacingObjects) {
                return;
            }

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

        // Check for pending marquee from object click with modifiers
        const pendingStartPos = mouse.marqueePendingStartPos;
        if (pendingStartPos && mouse.isLeftDown && !mouse.isMarqueeSelecting && !mouse.isDragging) {
            const dx = e.clientX - pendingStartPos.x;
            const dy = e.clientY - pendingStartPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Activate marquee/transform if moved more than threshold
            if (dist >= TRANSFORM.DRAG_THRESHOLD_PX) {
                const pendingWorldPos = mouse.marqueePendingWorldPos;
                const marqueeMode = mouse.marqueePendingMode;
                const transformMode = mouse.transformPendingMode;
                const pendingClickInfo = mouse.marqueePendingClickInfo;

                // Clear pending state
                this.editor.stateManager.update({
                    'mouse.marqueePendingStartPos': null,
                    'mouse.marqueePendingWorldPos': null,
                    'mouse.marqueePendingMode': null,
                    'mouse.marqueePendingObjectId': null,
                    'mouse.marqueePendingClickInfo': null,
                    'mouse.transformPendingMode': null
                });

                if (transformMode) {
                    // Ctrl+drag on object = rotate, Ctrl+Alt+drag = scale
                    Logger.mouse.debug(`Starting object transform from object click (mode: ${transformMode})`);
                    this.startObjectTransform(transformMode, pendingClickInfo, pendingWorldPos);
                } else {
                    Logger.mouse.debug(`Starting marquee from object click (mode: ${marqueeMode})`);

                    // Start marquee selection
                    if (marqueeMode === 'replace') {
                        this.editor.stateManager.set('selectedObjects', new Set());
                    }

                    this.editor.stateManager.update({
                        'mouse.isMarqueeSelecting': true,
                        'mouse.marqueeRect': { x: pendingWorldPos.x, y: pendingWorldPos.y, width: 0, height: 0 },
                        'mouse.marqueeStartX': pendingWorldPos.x,
                        'mouse.marqueeStartY': pendingWorldPos.y,
                        'mouse.marqueeMode': marqueeMode
                    });
                }
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
            this.editor.detailsPanel?.refreshTransformFieldsLive();
        } else if (mouse.isLeftDown && mouse.isTransforming) {
            // Rotate/scale selected objects (Ctrl+drag / Ctrl+Alt+drag)
            this.transformSelectedObjects(worldPos);
            this.editor.detailsPanel?.refreshTransformFieldsLive();
        } else if (mouse.isLeftDown && e.altKey && !(e.ctrlKey || e.metaKey) && !mouse.transformPendingMode && !this.editor.stateManager.get('duplicate.isActive')) {
            // Check if we should start Alt+drag duplication
            const selectedObjects = this.editor.stateManager.get('selectedObjects');
            if (selectedObjects && selectedObjects.size > 0) {
                Logger.mouse.debug('Starting Alt+drag duplication from selected objects');
                this.editor.duplicateOperations.startFromSelection(worldPos);
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

        // Freeze group frame while Alt is pressed (for dragging objects out).
        // Gated on isDragging so the Ctrl+Alt+drag scale gesture (which also sets
        // e.altKey but never isDragging) doesn't freeze the frame while the
        // object's picture keeps live-scaling underneath it.
        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            if (e.altKey && mouse.isDragging) {
                if (!groupEditMode.frameFrozen) {
                    this.editor.stateManager.set('groupEditMode', {
                        ...groupEditMode,
                        frameFrozen: true,
                        frozenBounds: this.editor.objectOperations.getObjectWorldBounds(groupEditMode.group),
                        // Snapshot the frame's rotation too, so a rotated group's frozen
                        // frame still matches its (unchanging, since it's frozen) picture.
                        frozenFrameGeometry: this.editor.renderOperations.getGroupEditFrameGeometry(groupEditMode.group)
                    });
                }
            } else if (groupEditMode.frameFrozen) {
                this.editor.stateManager.set('groupEditMode', {
                    ...groupEditMode,
                    frameFrozen: false,
                    frozenBounds: null,
                    frozenFrameGeometry: null
                });
            }
        }

        // Only render if something actually changed
        // Skip rendering if objects are being moved into groups to prevent flicker
        if (!objectsMovedToGroup && (mouse.isPlacingObjects || mouse.isRightDown || mouse.isMiddleDown || (mouse.isLeftDown && mouse.isDragging) || (mouse.isLeftDown && mouse.isTransforming) || mouse.isMarqueeSelecting || this.editor.stateManager.get('duplicate.isActive'))) {
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

            // Gesture over — next drag/transform captures a fresh pivot baseline.
            // Dropping it here is seamless: compensation keeps the natural pivot
            // consistent with current positions, so nothing shifts on release.
            this._pivotCompensationBaseline = null;

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

            // Finalize rotate/scale transform gesture
            if (mouse.isTransforming) {
                this._transformSnapshot = null;

                const transformedSelection = this.editor.stateManager.get('selectedObjects');
                transformedSelection.forEach(id => this.editor.invalidateObjectCaches(id));
                this.editor.renderOperations.invalidateSpatialIndex();

                this.editor.historyManager.saveState(
                    this.editor.level.objects,
                    transformedSelection,
                    false,
                    this.editor.stateManager.get('groupEditMode')
                );
                this.editor.stateManager.markDirty();
                this.editor.updateAllPanels();
            }
            
            // Handle simple click (without drag) with modifiers using SelectionUtils
            if (mouse.marqueePendingClickInfo && !mouse.isMarqueeSelecting) {
                const clickInfo = mouse.marqueePendingClickInfo;
                const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
                
                if (clickInfo.ctrlKey) {
                    // Ctrl/Cmd+click: toggle selection (using SelectionUtils)
                    SelectionUtils.handleCtrlClick(clickInfo.obj, selectedObjects, {
                        stateManager: this.editor.stateManager,
                        selectionKey: 'selectedObjects',
                        anchorKey: 'canvas.shiftAnchor'
                    });
                    this.editor.updateAllPanels();
                } else if (clickInfo.shiftKey) {
                    // Shift+click: add to selection (not toggle, canvas-specific)
                    // Note: For canvas, Shift+click adds, not range selection like in panels
                    if (!clickInfo.isSelected) {
                        selectedObjects.add(clickInfo.obj.id);
                        this.editor.stateManager.update({
                            'canvas.shiftAnchor': clickInfo.obj.id
                        });
                        this.editor.stateManager.set('selectedObjects', selectedObjects);
                        this.editor.updateAllPanels();
                    }
                }
            }
            
            // Clear pending marquee state if marquee wasn't activated (click without drag)
            if (mouse.marqueePendingStartPos && !mouse.isMarqueeSelecting) {
                this.editor.stateManager.update({
                    'mouse.marqueePendingStartPos': null,
                    'mouse.marqueePendingWorldPos': null,
                    'mouse.marqueePendingMode': null,
                    'mouse.marqueePendingObjectId': null,
                    'mouse.marqueePendingClickInfo': null
                });
            }
            
            this.editor.stateManager.update({
                'mouse.isLeftDown': false,
                'mouse.isDragging': false,
                'mouse.isTransforming': null,
                'mouse.transformPivot': null,
                'mouse.transformStartAngle': null,
                'mouse.transformStartDist': null,
                'mouse.transformPendingMode': null,
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

            // Handle marquee completion for canvas events
            // Global handler will also handle it, but we need this for immediate response
            // Captured before finishMarqueeSelection() runs: `mouse` is a live reference to
            // stateManager's nested state object (see StateManager.set/update), so calling
            // finishMarqueeSelection() (which sets 'mouse.isMarqueeSelecting' back to false)
            // mutates the same object the deferred-close check below reads — without this
            // snapshot, a completed marquee-drag outside an open group (dragging in external
            // objects) would immediately fall through to the close/select-external branch
            // and undo/override the just-finished selection.
            const wasMarqueeSelecting = mouse.isMarqueeSelecting;
            if (wasMarqueeSelecting) {
                this.finishMarqueeSelection();
            }

            // Deferred group close: set on mousedown when click was outside the active group.
            // Execute only if no drag and no object was selected — otherwise the user was
            // interacting with an external object (selecting/dragging it into the group).
            if (mouse.pendingGroupClose && !wasDragging && !wasMarqueeSelecting) {
                this.editor.stateManager.update({ 'mouse.pendingGroupClose': false });
                if (this.isInGroupEditMode()) {
                    const worldPos = this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.editor.stateManager.get('camera'));
                    const clickedExternal = this.editor.objectOperations.findObjectAtPoint(worldPos.x, worldPos.y);
                    if (clickedExternal) {
                        // External object clicked — select it, keep group open
                        const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
                        if (!selectedObjects.has(clickedExternal.id)) {
                            SelectionUtils.selectSingleItem(
                                this.editor.stateManager,
                                clickedExternal.id,
                                'selectedObjects',
                                'canvas.shiftAnchor',
                                () => this.editor.updateAllPanels()
                            );
                        }
                    } else {
                        // Truly empty space — step back one level
                        this.editor.groupOperations.closeGroupEditMode();

                        if (this.isInGroupEditMode()) {
                            const parentGroupEditMode = this.getGroupEditMode();
                            const insideParent = this.editor.objectOperations.isPointInObject(worldPos.x, worldPos.y, parentGroupEditMode.group);
                            if (insideParent) {
                                this.editor.stateManager.set('selectedObjects', new Set());
                                this.editor.stateManager.update({
                                    'mouse.isMarqueeSelecting': true,
                                    'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
                                    'mouse.marqueeStartX': worldPos.x,
                                    'mouse.marqueeStartY': worldPos.y,
                                    'mouse.marqueeMode': 'replace'
                                });
                            }
                        }
                    }
                }
            } else if (mouse.pendingGroupClose) {
                this.editor.stateManager.update({ 'mouse.pendingGroupClose': false });
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

                // Save history once before extracting (extractObjectFromGroup is called
                // with saveState:false so it doesn't create an entry per object).
                if (selected.some(obj => this.editor.objectOperations.isObjectInGroup(obj, groupEditMode.group))) {
                    this.editor.historyManager.saveState(
                        this.editor.level.objects,
                        this.editor.stateManager.get('selectedObjects'),
                        false,
                        this.editor.stateManager.get('groupEditMode')
                    );
                }

                // Process each selected object for potential move out of group
                let movedObjectsCount = 0;
                selected.forEach(obj => {
                    // Only consider direct children of the edited group
                    const isChild = this.editor.objectOperations.isObjectInGroup(obj, groupEditMode.group);
                    if (isChild) {
                        // Use world bounds of the object (rotation-aware) to check intersection
                        const objWorldBounds = this.editor.objectOperations.getObjectWorldBounds(obj);

                        // Check if object bounds intersect with group bounds
                        const hasIntersection = objWorldBounds.minX < bounds.maxX &&
                                              objWorldBounds.maxX > bounds.minX &&
                                              objWorldBounds.minY < bounds.maxY &&
                                              objWorldBounds.maxY > bounds.minY;

                        if (!hasIntersection) {
                            // CRITICAL FIX: Invalidate spatial index BEFORE moving objects
                            this.editor.renderOperations.invalidateSpatialIndex();

                            // Route through extractObjectFromGroup for correct rotation-aware
                            // world position + remaining-children pivot compensation.
                            const extracted = this.editor.groupOperations.extractObjectFromGroup(
                                groupEditMode.group, obj, { saveState: false }
                            );
                            if (extracted) movedObjectsCount++;
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

    /**
     * Global mousemove handler (throttled for performance)
     * Delegates to _handleGlobalMouseMoveImpl
     */
    handleGlobalMouseMove(e) {
        this._throttledGlobalMouseMove(e);
    }

    _handleGlobalMouseMoveImpl(e) {
        const mouse = this.editor.stateManager.get('mouse');
        const canvas = this.editor.canvasRenderer.canvas;
        const rect = canvas.getBoundingClientRect();

        // Check if mouse is inside canvas bounds
        const isInsideCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                              e.clientY >= rect.top && e.clientY <= rect.bottom;

        // Track live cursor-over-canvas state so actions triggered from anywhere (e.g. the
        // paste hotkey) know whether the last known mouse.worldX/worldY is still valid, or
        // stale from before the cursor left the canvas (over a panel, dialog, etc.)
        if (mouse.isOverCanvas !== isInsideCanvas) {
            this.editor.stateManager.set('mouse.isOverCanvas', isInsideCanvas);
        }

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
            this._pivotCompensationBaseline = null;

            // Handle marquee selection completion (both inside and outside canvas)
            // Only finish marquee if it's still active (not already finished by canvas handler)
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
                this.editor.historyOperations.cancelToLastSavedState();
                this.editor.render();
            }

            // Cancel rotate/scale transform if released outside canvas
            if (mouse.isTransforming && shouldCancel) {
                Logger.mouse.info('Mouse released outside canvas - canceling transform');
                this._transformSnapshot = null;
                this.editor.stateManager.update({
                    'mouse.isLeftDown': false,
                    'mouse.isTransforming': null,
                    'mouse.transformPivot': null,
                    'mouse.transformStartAngle': null,
                    'mouse.transformStartDist': null,
                    'mouse.transformPendingMode': null
                });
                this.editor.historyOperations.cancelToLastSavedState();
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
     * Handle loss of window focus (e.g. Alt-Tab) while a mouse action is in
     * progress. The OS will not deliver the eventual mouseup to this page,
     * so any in-progress drag/marquee would otherwise stay "stuck" active
     * until a later unrelated click. Treat it the same as releasing the
     * mouse outside the window: finalize marquee, revert drag, clear flags.
     */
    handleWindowBlur() {
        const mouse = this.editor.stateManager.get('mouse');

        this._pivotCompensationBaseline = null;

        if (mouse.isMarqueeSelecting) {
            this.finishMarqueeSelection();
        }

        if (mouse.isDragging) {
            this.editor.stateManager.update({
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
            this.editor.historyOperations.cancelToLastSavedState();
        }

        if (mouse.isTransforming) {
            this._transformSnapshot = null;
            this.editor.stateManager.update({
                'mouse.isTransforming': null,
                'mouse.transformPivot': null,
                'mouse.transformStartAngle': null,
                'mouse.transformStartDist': null,
                'mouse.transformPendingMode': null
            });
            this.editor.historyOperations.cancelToLastSavedState();
        }

        this.editor.stateManager.update({
            'mouse.isLeftDown': false,
            'mouse.isMiddleDown': false
        });

        this.editor.cancelAllActions();
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

        // Check if current level is locked
        if (this.editor.levelsManager?.getCurrentSession()?.locked) {
            Logger.mouse.warn('Cannot add objects: current level is locked');
            return;
        }

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

                    // Set layerId to match the group's layer
                    newObject.layerId = groupEditMode.group.layerId;

                    // Pushing to the end of children already makes it the topmost sibling
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
        // skipCycle: a dblclick is physically two single clicks, which would already have
        // advanced the click-cycle past the front-most object (see ObjectOperations.findObjectAtPoint)
        const clickedObject = this.editor.objectOperations.findObjectAtPoint(worldPos.x, worldPos.y, true);
        
        if (clickedObject && clickedObject.type === 'group') {
            this.editor.groupOperations.openGroupEditMode(clickedObject);
        }
    }

    /**
     * Determine marquee mode based on keyboard modifiers
     * @param {Event} e - Mouse event
     * @returns {string} Marquee mode: 'replace', 'add', or 'toggle'
     */
    _determineMarqueeMode(e) {
        if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
                return 'add'; // Ctrl+Shift+drag = add to selection
            } else {
                return 'toggle'; // Ctrl+drag = toggle selection
            }
        } else if (e.shiftKey) {
            return 'add'; // Shift+drag = add to selection
        } else {
            return 'replace'; // regular drag = replace selection
        }
    }

    // Helper methods for mouse interactions
    handleObjectClick(e, obj, worldPos) {
        const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
        const isSelected = selectedObjects.has(obj.id);
        
        // Check for Alt+drag duplication - works on any object, selected or not
        // (Ctrl+Alt is reserved for the scale gesture)
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            Logger.mouse.debug('Alt+click on object, starting duplication');
            
            // If object is not selected, select it first (using SelectionUtils)
            if (!isSelected) {
                SelectionUtils.selectSingleItem(
                    this.editor.stateManager,
                    obj.id,
                    'selectedObjects',
                    'canvas.shiftAnchor',
                    () => this.editor.updateAllPanels()
                );
            }
            
            this.editor.duplicateOperations.startFromSelection(worldPos);
            return; // Don't process normal selection logic
        }
        
        // If Ctrl/Cmd or Shift is pressed, prepare for marquee on drag instead of object drag
        // Don't change selection immediately - wait for marquee completion or simple click
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            // Determine marquee mode for potential drag
            const marqueeMode = this._determineMarqueeMode(e);
            
            // Store pending marquee info for potential drag activation
            // Also store click info for handling simple click (without drag)
            this.editor.stateManager.update({
                'mouse.marqueePendingStartPos': { x: e.clientX, y: e.clientY },
                'mouse.marqueePendingWorldPos': worldPos,
                'mouse.marqueePendingMode': marqueeMode,
                'mouse.marqueePendingObjectId': obj.id,
                // Ctrl+drag on object = rotate, Ctrl+Alt+drag = scale (drag starts on move threshold)
                'mouse.transformPendingMode': (e.ctrlKey || e.metaKey) ? (e.altKey ? 'scale' : 'rotate') : null,
                'mouse.marqueePendingClickInfo': {
                    obj: obj,
                    isSelected: isSelected,
                    ctrlKey: e.ctrlKey || e.metaKey,
                    shiftKey: e.shiftKey
                }
            });
            
            // Don't change selection immediately - will be handled in handleMouseUp if no drag occurred
            // Don't start object dragging - marquee will start on mouse move if threshold exceeded
            return;
        }
        
        // Regular click without modifiers: replace selection (using SelectionUtils)
        if (!isSelected) {
            SelectionUtils.selectSingleItem(
                this.editor.stateManager,
                obj.id,
                'selectedObjects',
                'canvas.shiftAnchor',
                () => this.editor.updateAllPanels()
            );
        }
        
        // Only start dragging if the clicked object is selected and no modifiers
        // Get fresh selection state after SelectionUtils call
        const currentSelection = this.editor.stateManager.get('selectedObjects');
        if (currentSelection && currentSelection.has(obj.id)) {
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
                'mouse.pendingGroupClose': false,
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

        // If Alt is pressed, don't start marquee selection - let Alt+drag handle it
        if (e.altKey) {
            // Just clear selection if not Shift+click
            if (!e.shiftKey) {
                this.editor.stateManager.set('selectedObjects', new Set());
            }
            return;
        }

        // Determine marquee selection mode
        const marqueeMode = this._determineMarqueeMode(e);

        // If editing groups, only close when clicking OUTSIDE all open groups
        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            const insideActive = this.editor.objectOperations.isPointInObject(worldPos.x, worldPos.y, groupEditMode.group);
            if (insideActive) {
                // Inside the active (innermost) group — start marquee
                if (marqueeMode === 'replace') {
                    this.editor.stateManager.set('selectedObjects', new Set());
                }
                this.editor.stateManager.update({
                    'mouse.isMarqueeSelecting': true,
                    'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
                    'mouse.marqueeStartX': worldPos.x,
                    'mouse.marqueeStartY': worldPos.y,
                    'mouse.marqueeMode': marqueeMode
                });
                return;
            }

            // Outside active group — defer the close to mouseup so that a plain click
            // (no movement) closes the group / selects a single external object, while a
            // real drag instead promotes to a marquee (same threshold-based promotion as
            // marqueePendingStartPos for object clicks, see _handleMouseMoveImpl) to select
            // external objects and drag them into the group. Once the marquee actually
            // starts, isMarqueeSelecting becomes true, which makes handleMouseUp's deferred
            // close check (`!mouse.isMarqueeSelecting`) skip the close/select branch.
            this.editor.stateManager.update({
                'mouse.pendingGroupClose': true,
                'mouse.isMarqueeSelecting': false,
                'mouse.marqueePendingStartPos': { x: e.clientX, y: e.clientY },
                'mouse.marqueePendingWorldPos': worldPos,
                'mouse.marqueePendingMode': marqueeMode
            });
            return;
        }

        // Normal behavior
        if (marqueeMode === 'replace') {
            this.editor.stateManager.set('selectedObjects', new Set());
        }
        this.editor.stateManager.update({
            'mouse.isMarqueeSelecting': true,
            'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
            'mouse.marqueeStartX': worldPos.x,
            'mouse.marqueeStartY': worldPos.y,
            'mouse.marqueeMode': marqueeMode
        });
    }

    /**
     * Collect the ROTATED ancestor groups of the given object ids, innermost-first.
     * Unrotated ancestors don't need pivot compensation (their frame is pure translation).
     * @param {Set<string>} targetIds
     * @returns {Array<Group>} innermost (deepest) ancestors first
     * @private
     */
    _collectRotatedAncestorsOf(targetIds) {
        const found = new Map(); // groupId -> { group, depth }

        const dfs = (obj, ancestors) => {
            if (targetIds.has(obj.id) && ancestors.length > 0) {
                ancestors.forEach((g, depth) => {
                    if (g.rotation && !found.has(g.id)) {
                        found.set(g.id, { group: g, depth });
                    }
                });
            }
            if (obj.type === 'group' && obj.children) {
                ancestors.push(obj);
                obj.children.forEach(ch => dfs(ch, ancestors));
                ancestors.pop();
            }
        };

        this.editor.level.objects.forEach(o => dfs(o, []));
        return [...found.values()].sort((a, b) => b.depth - a.depth).map(e => e.group);
    }

    /**
     * Capture the pivot-compensation baseline for the current gesture: each rotated
     * ancestor's position and its children-bounds center RELATIVE to that position.
     * @private
     */
    _capturePivotBaseline(selectedIds) {
        const groups = this._collectRotatedAncestorsOf(selectedIds);
        if (groups.length === 0) return null;
        return groups.map(group => {
            const b = group.getBounds();
            return {
                group,
                x: group.x,
                y: group.y,
                cRelX: (b.minX + b.maxX) / 2 - group.x,
                cRelY: (b.minY + b.maxY) / 2 - group.y
            };
        });
    }

    /**
     * Keep every rotated ancestor's on-screen content fixed while a descendant moves.
     *
     * A group's rotation pivot is the center of its children's bounds, recomputed each
     * render. Moving one child shifts that center, which re-pivots the WHOLE group and
     * makes untouched siblings visibly drift. Changing the pivot from P1 to P2 shifts
     * every rendered point by the constant (I − R)(P1 − P2) (R is the group's rotation
     * matrix; the shift is point-independent because R is linear). So translating the
     * group by exactly that constant cancels the drift for all children at once, while
     * the pivot itself stays "natural" — no freeze state, no jump at gesture start/end.
     *
     * Applied innermost-first: compensating a deep group also perturbs its own parent's
     * children-bounds center, which the next (outer) iteration then measures and cancels.
     * Uses SET (baseline + correction), not +=, so repeated per-frame application can't
     * accumulate drift.
     * @private
     */
    _applyPivotCompensation() {
        const baseline = this._pivotCompensationBaseline;
        if (!baseline) return;

        baseline.forEach(s => {
            const g = s.group;
            const b = g.getBounds();
            const cRelX = (b.minX + b.maxX) / 2 - g.x;
            const cRelY = (b.minY + b.maxY) / 2 - g.y;
            const dx = s.cRelX - cRelX;
            const dy = s.cRelY - cRelY;
            if (dx === 0 && dy === 0) {
                g.x = s.x;
                g.y = s.y;
                return;
            }
            const rad = (g.rotation || 0) * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            g.x = s.x + dx - (cos * dx - sin * dy);
            g.y = s.y + dy - (sin * dx + cos * dy);
        });
    }

    dragSelectedObjects(worldPos, e) {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');

        // Pivot-stability baseline: captured lazily on the first move of this drag
        // (cleared on mouseup/blur/cancel and when objects get reparented mid-drag)
        if (!this._pivotCompensationBaseline) {
            this._pivotCompensationBaseline = this._capturePivotBaseline(selectedObjects);
        }

        // Track if any objects are being moved into groups to delay rendering
        let objectsMovedToGroup = false;
        const mouse = this.editor.stateManager.get('mouse');
        const shiftKey = this.editor.stateManager.get('keyboard.shiftKey');

        // Check if snap to grid is enabled
        const snapEnabled = SnapUtils.isSnapToGridEnabled(this.editor.stateManager, this.editor.level);
        let dx, dy;

        if (snapEnabled) {
            // Find nearest grid point for cursor
            const nearestGrid = SnapUtils.findNearestSnapGridPoint(
                worldPos.x, worldPos.y, this.editor.stateManager, this.editor.level, this.editor.userPrefs
            );

            if (nearestGrid) {
                // Calculate the delta that would move the object's bottom-left corner to
                // this grid point — same reference-object-to-grid-point math as
                // DuplicateOperations.confirmPlacement (see SnapUtils.computeBottomLeftSnapDelta),
                // with a fallback to mouse.anchorX/Y when no selected object is found.
                const selectedObjects = this.editor.stateManager.get('selectedObjects');
                const firstObjId = selectedObjects && selectedObjects.size > 0 ? Array.from(selectedObjects)[0] : null;
                const firstObj = firstObjId ? this.editor.level.findObjectById(firstObjId) : null;
                const bottomLeftDelta = firstObj
                    ? SnapUtils.computeBottomLeftSnapDelta(nearestGrid, firstObj, this.editor.objectOperations)
                    : { dx: nearestGrid.x - mouse.anchorX, dy: nearestGrid.y - mouse.anchorY };

                // Snap to grid - move anchor to grid point
                if (!mouse.snappedToGrid) {
                    // First time snapping - record the snap target and calculate movement
                    this.editor.stateManager.update({
                        'mouse.snappedToGrid': true,
                        'mouse.snapTargetX': nearestGrid.x,
                        'mouse.snapTargetY': nearestGrid.y
                    });

                    dx = bottomLeftDelta.dx;
                    dy = bottomLeftDelta.dy;

                } else {
                    // Already snapped - check if we need to move to a new grid point
                    if (nearestGrid.x !== mouse.snapTargetX || nearestGrid.y !== mouse.snapTargetY) {
                        // New grid point found - update target and move
                        this.editor.stateManager.update({
                            'mouse.snapTargetX': nearestGrid.x,
                            'mouse.snapTargetY': nearestGrid.y
                        });

                        dx = bottomLeftDelta.dx;
                        dy = bottomLeftDelta.dy;

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

                        // Prevent self-reference cycles: skip if the dragged object IS the
                        // group being edited, or if the edited group is nested inside the
                        // dragged object (would make the group its own descendant)
                        const wouldCreateCycle = obj.id === groupEditMode.group.id ||
                            (obj.type === 'group' && obj.children &&
                                this.editor.objectOperations.isObjectInGroupRecursive(groupEditMode.group, obj));
                        if (wouldCreateCycle) {
                            return;
                        }

                        // Check if target group's layer is locked
                        if (groupEditMode.group.layerId) {
                            const targetLayer = this.editor.level.getLayerById(groupEditMode.group.layerId);
                            if (targetLayer && targetLayer.locked) {
                                // Skip moving to locked layer
                                return;
                            }
                        }
                        
                        // Route through addObjectToGroup for correct rotation-aware
                        // transform (world center preserved, rotation adjusted, pivot
                        // compensation applied to both source and target groups).
                        // addObjectToGroup handles removal from level.objects internally.
                        // obj.x/y already include this frame's dx/dy (applied above at
                        // main-level-move time) — do NOT add it again here, or the object's
                        // world position used for the in-group coordinate conversion below
                        // overshoots by one extra delta, causing a visible jump/blink.
                        this.editor.groupOperations.addObjectToGroup(obj, groupEditMode.group);

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

                        // CRITICAL FIX: getVisibleObjects() caches {obj, parentX, parentY}
                        // per camera position for up to CACHE_TIMEOUT_MS. obj was cached as a
                        // top-level entry (parentX=0, parentY=0); now that its x/y are
                        // group-local, drawObject() would keep reading that stale parentX/Y
                        // and render it at the wrong spot until the cache naturally expires —
                        // the reported "blink in another place". Must drop it immediately.
                        this.editor.renderOperations.clearVisibleObjectsCacheForCurrentCamera();

                        // Set flag to delay rendering until all operations are complete
                        objectsMovedToGroup = true;
                    }
                } else if (isInAnyOpenGroup) {
                    // Object is inside any of the open groups
                    if (this.isAltKeyPressed()) {
                        // Alt+drag: move in world coordinates
                        const objWorldPosAlt = this.editor.objectOperations.getObjectWorldPosition(obj);
                        const newWorldX = objWorldPosAlt.x + dx;
                        const newWorldY = objWorldPosAlt.y + dy;
                        // Convert back to active-group-relative coordinates, accounting for
                        // the active group's own rotation and any rotated ancestors above it.
                        const localInActive = WorldPositionUtils.worldPointToLocalPointInGroup(
                            newWorldX, newWorldY, this.getActiveGroup(), this.editor.level.objects
                        );
                        obj.x = localInActive.x;
                        obj.y = localInActive.y;
                    } else {
                        // Normal drag: move relative to current parent group. dx/dy are a
                        // WORLD-space delta (from cursor movement); convert to obj's LOCAL
                        // delta via its current ancestor chain — adding the raw world delta
                        // would move it in the wrong direction under a rotated ancestor.
                        const localDelta = WorldPositionUtils.worldDeltaToLocalDelta(dx, dy, obj, this.editor.level.objects);
                        obj.x += localDelta.x;
                        obj.y += localDelta.y;

                        // Check if dragged into the active (innermost) group from a parent group
                        const groupEditMode = this.getGroupEditMode();
                        const activeGroup = groupEditMode.group;
                        const isAlreadyInActiveGroup = this.editor.objectOperations.isObjectInGroupRecursive(obj, activeGroup);

                        if (!isAlreadyInActiveGroup) {
                            const objWorldPos = this.editor.objectOperations.getObjectWorldPosition(obj);

                            if (this.editor.objectOperations.isPointInGroupBounds(objWorldPos.x, objWorldPos.y)) {
                                // Prevent cycles
                                const wouldCreateCycle = obj.id === activeGroup.id ||
                                    (obj.type === 'group' && obj.children &&
                                        this.editor.objectOperations.isObjectInGroupRecursive(activeGroup, obj));
                                if (!wouldCreateCycle) {
                                    // Check target layer lock
                                    if (activeGroup.layerId) {
                                        const targetLayer = this.editor.level.getLayerById(activeGroup.layerId);
                                        if (targetLayer && targetLayer.locked) return;
                                    }

                                    // Route through addObjectToGroup: removes from source group,
                                    // computes rotation-aware local coords, applies pivot
                                    // compensation to both source and target groups.
                                    this.editor.groupOperations.addObjectToGroup(obj, activeGroup);

                                    // Layer inheritance
                                    if (activeGroup.layerId) {
                                        const oldLayerId = obj.layerId;
                                        obj.layerId = activeGroup.layerId;
                                        Logger.layer.info(`Drag inheritance: ${obj.name || obj.id} layerId ${oldLayerId || 'none'} → ${activeGroup.layerId}`);
                                        this.editor.renderOperations.clearEffectiveLayerCacheForObject(obj.id);
                                        if (obj.type === 'group' && obj.children) {
                                            activeGroup.propagateLayerIdToChildren(obj);
                                        }
                                    }

                                    this.editor.renderOperations.invalidateSpatialIndex();
                                    objectsMovedToGroup = true;
                                }
                            }
                        }
                    }
                }

                // If it's a group, all children move with it automatically
                // because they are positioned relative to the group
            }
        });

        // Keep rotated ancestors' pivots from dragging their untouched children around.
        // On reparenting the ancestor chain changed — drop the baseline so it re-captures
        // against the new hierarchy on the next move.
        if (objectsMovedToGroup) {
            this._pivotCompensationBaseline = null;
        } else {
            this._applyPivotCompensation();
        }

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

    /**
     * Start rotate/scale gesture (Ctrl+drag / Ctrl+Alt+drag on an object).
     * Transforms the whole selection; if the clicked object is not selected,
     * it becomes the sole selection first (same as regular drag).
     * Works at any nesting level: parent frames are translation-only,
     * so world-space deltas apply directly to local coordinates.
     */
    startObjectTransform(mode, clickInfo, startWorldPos) {
        const obj = clickInfo?.obj;
        if (!obj) return;

        let selectedIds = this.editor.stateManager.get('selectedObjects');
        if (!selectedIds || !selectedIds.has(obj.id)) {
            SelectionUtils.selectSingleItem(
                this.editor.stateManager,
                obj.id,
                'selectedObjects',
                'canvas.shiftAnchor',
                () => this.editor.updateAllPanels()
            );
            selectedIds = this.editor.stateManager.get('selectedObjects');
        }

        // Pivot = center of the combined world bounds of the selection
        const union = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        const snapshot = [];
        selectedIds.forEach(id => {
            const o = this.editor.level.findObjectById(id);
            if (!o || o.locked) return;

            const b = this.editor.objectOperations.getObjectWorldBounds(o);
            union.minX = Math.min(union.minX, b.minX);
            union.minY = Math.min(union.minY, b.minY);
            union.maxX = Math.max(union.maxX, b.maxX);
            union.maxY = Math.max(union.maxY, b.maxY);

            const wp = this.editor.objectOperations.getObjectWorldPosition(o);
            snapshot.push({
                obj: o,
                x: o.x,
                y: o.y,
                width: o.width,
                height: o.height,
                rotation: o.rotation || 0,
                worldX: wp.x,
                worldY: wp.y,
                // AABB center is invariant to rotation, safe as the object's center
                worldCenterX: (b.minX + b.maxX) / 2,
                worldCenterY: (b.minY + b.maxY) / 2,
                children: o.type === 'group' ? this._snapshotChildrenForScale(o) : null
            });
        });

        if (snapshot.length === 0 || union.minX === Infinity) return;

        this._transformSnapshot = snapshot;
        // Same pivot-stability treatment as regular drag: rotating/scaling children of a
        // rotated ancestor changes that ancestor's children-bounds — without compensation
        // its untouched children would drift (see _applyPivotCompensation).
        this._pivotCompensationBaseline = this._capturePivotBaseline(selectedIds);

        const pivot = { x: (union.minX + union.maxX) / 2, y: (union.minY + union.maxY) / 2 };
        const startDist = Math.hypot(startWorldPos.x - pivot.x, startWorldPos.y - pivot.y);

        Logger.mouse.debug(`Starting object transform: ${mode}, objects: ${snapshot.length}`);

        this.editor.stateManager.update({
            'mouse.isTransforming': mode,
            'mouse.transformPivot': pivot,
            'mouse.transformStartAngle': Math.atan2(startWorldPos.y - pivot.y, startWorldPos.x - pivot.x),
            'mouse.transformStartDist': Math.max(startDist, 0.001)
        });
    }

    /**
     * Apply rotate/scale to the selection from the gesture-start snapshot
     * (recomputing from the snapshot each move avoids incremental drift)
     */
    transformSelectedObjects(worldPos) {
        const mouse = this.editor.stateManager.get('mouse');
        const pivot = mouse.transformPivot;
        const snapshot = this._transformSnapshot;
        if (!pivot || !snapshot) return;

        if (mouse.isTransforming === 'rotate') {
            const currentAngle = Math.atan2(worldPos.y - pivot.y, worldPos.x - pivot.x);
            let deltaDeg = (currentAngle - mouse.transformStartAngle) * 180 / Math.PI;

            // Shift = snap to the nearest absolute angle step: adjust the shared delta
            // so the reference (first) object's resulting rotation lands on a multiple
            // of the step, keeping the selection rigid
            if (this.editor.stateManager.get('keyboard.shiftKey')) {
                const step = this.editor.stateManager.get('selection.rotationSnapDegrees') ?? TRANSFORM.ROTATION_SNAP_DEGREES;
                const refRotation = snapshot[0].rotation;
                deltaDeg = Math.round((refRotation + deltaDeg) / step) * step - refRotation;
            }

            const rad = deltaDeg * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            snapshot.forEach(s => {
                // Normalize to (-180, 180]
                let rot = (s.rotation + deltaDeg) % 360;
                if (rot > 180) rot -= 360;
                if (rot <= -180) rot += 360;
                s.obj.rotation = rot;

                // Orbit object center around the pivot
                const dx = s.worldCenterX - pivot.x;
                const dy = s.worldCenterY - pivot.y;
                const newCenterX = pivot.x + dx * cos - dy * sin;
                const newCenterY = pivot.y + dx * sin + dy * cos;
                s.obj.x = s.x + (newCenterX - s.worldCenterX);
                s.obj.y = s.y + (newCenterY - s.worldCenterY);
            });
        } else {
            let factor = Math.hypot(worldPos.x - pivot.x, worldPos.y - pivot.y) / mouse.transformStartDist;
            factor = Math.max(TRANSFORM.MIN_SCALE_FACTOR, Math.min(TRANSFORM.MAX_SCALE_FACTOR, factor));

            // Shift = snap the scale factor to discrete steps (10%)
            if (this.editor.stateManager.get('keyboard.shiftKey')) {
                const step = this.editor.stateManager.get('selection.scaleSnapFactor') ?? TRANSFORM.SCALE_SNAP_FACTOR;
                factor = Math.max(step, Math.round(factor / step) * step);
            }

            snapshot.forEach(s => {
                // Uniform scale around the pivot: world points map as p' = pivot + (p - pivot) * f
                const newWorldX = pivot.x + (s.worldX - pivot.x) * factor;
                const newWorldY = pivot.y + (s.worldY - pivot.y) * factor;
                s.obj.x = s.x + (newWorldX - s.worldX);
                s.obj.y = s.y + (newWorldY - s.worldY);

                if (s.children) {
                    // Groups: scale children geometry (relative coords scale directly)
                    this._applyChildScale(s.children, factor);
                } else {
                    s.obj.width = s.width * factor;
                    s.obj.height = s.height * factor;
                }
            });
        }

        // Keep rotated ancestors' pivots from dragging their untouched children around
        this._applyPivotCompensation();
    }

    /**
     * Snapshot children geometry recursively for the scale gesture
     * @private
     */
    _snapshotChildrenForScale(group) {
        return group.children.map(child => ({
            obj: child,
            x: child.x,
            y: child.y,
            width: child.width,
            height: child.height,
            children: child.type === 'group' ? this._snapshotChildrenForScale(child) : null
        }));
    }

    /**
     * Scale children geometry (relative coords) from the snapshot
     * @private
     */
    _applyChildScale(children, factor) {
        children.forEach(s => {
            s.obj.x = s.x * factor;
            s.obj.y = s.y * factor;
            if (s.children) {
                this._applyChildScale(s.children, factor);
            } else {
                s.obj.width = s.width * factor;
                s.obj.height = s.height * factor;
            }
        });
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

        const marqueeMode = mouse.marqueeMode || 'replace';

        // Setup options for SelectionUtils with canvas-specific callback
        const marqueeOptions = {
            selectionKey: 'selectedObjects',
            getObjectsInMarquee: (marqueeRect) => {
                // Canvas mode: get objects in marquee using world coordinates
                const objectsInMarquee = [];

                // A plain click (mousedown+mouseup with no movement) still goes through
                // handleEmptyClick → a zero-size "marquee" at the click point, finalized
                // here — it must behave like a real click: precise, rotation-aware
                // point-in-shape testing via isPointInObject (the same test findObjectAtPoint
                // already used to correctly reject/accept this point in handleMouseDown).
                //
                // A genuine drag uses the exact same rotated-rect geometry (getHitTestGeometry)
                // the click test uses, checked against the marquee rect via SAT
                // (rectIntersectsGeometry) — not a plain AABB-vs-rect overlap, which is larger
                // than the true shape for any rotated object/group and would select things the
                // drag rectangle never actually touches (or, for objects merely near a corner
                // of the drag rect, wrongly include them).
                const isPlainClick = marqueeRect.width === 0 && marqueeRect.height === 0;
                const hitTest = isPlainClick
                    ? (obj) => this.editor.objectOperations.isPointInObject(marqueeRect.x, marqueeRect.y, obj)
                    : (obj) => {
                        const effectiveLayerId = this.editor.renderOperations.getEffectiveLayerId(obj);
                        const parallaxOffset = this.editor.renderOperations.parallaxRenderer.isParallaxEnabled()
                            && this.editor.renderOperations.parallaxRenderer.isLayerParallaxEnabled(this.editor.level.getLayerById(effectiveLayerId))
                            ? this.editor.renderOperations.parallaxRenderer.getParallaxOffset(this.editor.level.getLayerById(effectiveLayerId))
                            : { x: 0, y: 0 };

                        const geom = WorldPositionUtils.getHitTestGeometry(obj, this.editor.level.objects);
                        geom.cx -= parallaxOffset.x;
                        geom.cy -= parallaxOffset.y;

                        return WorldPositionUtils.rectIntersectsGeometry(
                            marqueeRect.x, marqueeRect.y,
                            marqueeRect.x + marqueeRect.width, marqueeRect.y + marqueeRect.height,
                            geom
                        );
                    };

                if (this.isInGroupEditMode()) {
                    // In group edit mode: same candidate set as findObjectAtPoint (active
                    // group's children + siblings at every level of the open-group chain).
                    const selectable = this.editor.objectOperations.computeSelectableSet();
                    const candidates = this.editor.objectOperations.getSelectableCandidateObjects()
                        .filter(o => selectable.has(o.id));

                    candidates.forEach(obj => {
                        if (hitTest(obj)) objectsInMarquee.push(obj.id);
                    });
                } else {
                    // Normal mode - use viewport optimization for better performance
                    const selectableInViewport = this.editor.getSelectableObjectsInViewport();
                    selectableInViewport.forEach(objId => {
                        const obj = this.editor.getCachedObject(objId);
                        if (obj && hitTest(obj)) objectsInMarquee.push(objId);
                    });
                }

                return objectsInMarquee;
            },
            onSelectionChange: (selectedItems) => {
                // Update panels after selection change
                this.editor.updateAllPanels();
            }
        };

        // Store options in state for SelectionUtils
        this.editor.stateManager.set('marquee.options', marqueeOptions);
        this.editor.stateManager.set('marquee.mode', marqueeMode);

        // Use SelectionUtils to finalize marquee selection (canvas mode)
        SelectionUtils.finalizeMarqueeSelection(null, null, this.editor.stateManager);

        // Cleanup marquee state
        this.editor.stateManager.update({
            'mouse.marqueeRect': null,
            'mouse.marqueeStartX': null,
            'mouse.marqueeStartY': null,
            'mouse.isMarqueeSelecting': false,
            'mouse.marqueeMode': null,
            'marquee.options': null,
            'marquee.mode': null
        });
        
        // Clear pending marquee state if any
        this.editor.stateManager.update({
            'mouse.marqueePendingStartPos': null,
            'mouse.marqueePendingWorldPos': null,
            'mouse.marqueePendingMode': null,
            'mouse.marqueePendingObjectId': null,
            'mouse.marqueePendingClickInfo': null
        });
        
        // Check if Alt is still pressed after marquee selection to start duplication
        const currentMouse = this.editor.stateManager.get('mouse');
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        if (currentMouse.altKey && selectedObjects && selectedObjects.size > 0) {
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
