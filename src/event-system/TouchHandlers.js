/**
 * Touch Handlers module for LevelEditor
 * Handles all touch interactions and events
 * Integrates with existing TouchSupportManager and EventHandlerManager
 */

import { BaseModule } from '../core/BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { SnapUtils } from '../utils/SnapUtils.js';
import { throttle } from '../utils/PerformanceUtils.js';
import { PERFORMANCE } from '../constants/EditorConstants.js';

export class TouchHandlers extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        
        // Performance optimization for touch events
        this.touchAnimationFrame = null;
        
        // Create throttled versions of frequent touch event handlers
        this._throttledTouchMove = throttle(
            (e) => this._handleTouchMoveImpl(e), 
            PERFORMANCE.MOUSE_MOVE_THROTTLE_MS
        );
        
        // Track active touches
        this.activeTouches = new Map();
        
        // Touch gesture state
        this.touchState = {
            isMarqueeSelecting: false,
            marqueeRect: null,
            marqueeStartX: null,
            marqueeStartY: null,
            isDragging: false,
            dragStartX: null,
            dragStartY: null,
            isPanning: false,
            panStartX: null,
            panStartY: null,
            isZooming: false,
            zoomStartDistance: null,
            zoomStartScale: null,
            // New gesture states
            isTouchDragging: false,
            touchDragStartX: null,
            touchDragStartY: null,
            lastTapTime: 0,
            lastTapX: null,
            lastTapY: null,
            tapCount: 0,
            doubleTapTimeout: null,
            longPressTimeout: null,
            isLongPress: false,
            longPressThreshold: 500, // ms
            doubleTapThreshold: 300, // ms
            tapThreshold: 10 // pixels
        };
    }

    /**
     * Touch event handlers
     */
    handleTouchStart(e) {
        // Prevent default browser behavior for touch events
        e.preventDefault();
        
        const touches = Array.from(e.touches);
        const currentTime = Date.now();
        
        Logger.touch.debug('Touch start:', touches.length, 'touches');
        
        // Handle different touch counts
        if (touches.length === 1) {
            this.handleSingleTouchStart(e, touches[0], currentTime);
        } else if (touches.length === 2) {
            this.handleTwoTouchStart(e, touches, currentTime);
        } else if (touches.length === 3) {
            this.handleThreeTouchStart(e, touches, currentTime);
        }
        
        // Store touch data for move/end events
        touches.forEach(touch => {
            this.activeTouches.set(touch.identifier, {
                startTime: currentTime,
                startX: touch.clientX,
                startY: touch.clientY,
                lastX: touch.clientX,
                lastY: touch.clientY,
                isActive: true
            });
        });
    }

    /**
     * Handle single touch start
     */
    handleSingleTouchStart(e, touch, currentTime) {
        const worldPos = this.screenToWorld(touch);
        
        // Check for double tap
        if (this.isDoubleTap(touch, currentTime)) {
            this.handleDoubleTap(e, worldPos, touch);
            return;
        }
        
        // Start long press detection
        this.startLongPressDetection(e, worldPos, touch);
        
        // Check if touching on object
        const clickedObject = this.editor.objectOperations.findObjectAtPoint(worldPos.x, worldPos.y);
        
        if (clickedObject) {
            this.handleObjectTouch(e, clickedObject, worldPos, touch);
        } else {
            this.handleEmptyTouch(e, worldPos, touch);
        }
    }

    /**
     * Handle two touch start (pan/zoom gestures or two-finger tap)
     */
    handleTwoTouchStart(e, touches, currentTime) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        // Calculate center point and distance
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const distance = this.getDistance(touch1.clientX, touch1.clientY, touch2.clientX, touch2.clientY);
        
        Logger.touch.debug('Two touch start:', { centerX, centerY, distance });
        
        // Store touch data for potential tap detection
        this.touchState.twoTouchStartTime = currentTime;
        this.touchState.twoTouchStartX = centerX;
        this.touchState.twoTouchStartY = centerY;
        
        // Initialize pan/zoom state
        this.touchState.isPanning = true;
        this.touchState.isZooming = true;
        this.touchState.panStartX = centerX;
        this.touchState.panStartY = centerY;
        this.touchState.zoomStartDistance = distance;
        this.touchState.zoomStartScale = this.editor.stateManager.get('camera').zoom;
        
        // Cancel any active single-touch operations
        this.cancelSingleTouchOperations();
    }

    /**
     * Touch move handler (throttled for performance)
     */
    handleTouchMove(e) {
        e.preventDefault();
        this._throttledTouchMove(e);
    }

    /**
     * Internal implementation of touch move (called by throttled handler)
     */
    _handleTouchMoveImpl(e) {
        const touches = Array.from(e.touches);
        
        if (touches.length === 1) {
            this.handleSingleTouchMove(e, touches[0]);
        } else if (touches.length === 2) {
            this.handleTwoTouchMove(e, touches);
        } else if (touches.length === 3) {
            this.handleThreeTouchMove(e, touches);
        }
    }

    /**
     * Handle single touch move
     */
    handleSingleTouchMove(e, touch) {
        const touchData = this.activeTouches.get(touch.identifier);
        if (!touchData || !touchData.isActive) return;
        
        // Update touch data
        touchData.lastX = touch.clientX;
        touchData.lastY = touch.clientY;
        
        const worldPos = this.screenToWorld(touch);
        
        // Check for touch drag threshold
        const deltaX = Math.abs(touch.clientX - touchData.startX);
        const deltaY = Math.abs(touch.clientY - touchData.startY);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Start touch drag if movement exceeds threshold
        if (!this.touchState.isTouchDragging && distance > this.touchState.tapThreshold) {
            this.startTouchDrag(worldPos, touch);
        }
        
        if (this.touchState.isMarqueeSelecting) {
            this.updateMarquee(worldPos);
        } else if (this.touchState.isDragging) {
            this.dragSelectedObjects(worldPos, touch);
        } else if (this.touchState.isTouchDragging) {
            this.handleTouchDrag(worldPos, touch);
        }
        
        // Cancel long press if moving
        if (distance > this.touchState.tapThreshold) {
            this.cancelLongPress();
        }
        
        // Render if needed
        if (this.touchState.isMarqueeSelecting || this.touchState.isDragging || this.touchState.isTouchDragging) {
            this.editor.render();
        }
    }

    /**
     * Handle two touch move (pan/zoom)
     */
    handleTwoTouchMove(e, touches) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        // Calculate current center and distance
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const currentDistance = this.getDistance(touch1.clientX, touch1.clientY, touch2.clientX, touch2.clientY);
        
        // Handle panning
        if (this.touchState.isPanning) {
            const deltaX = centerX - this.touchState.panStartX;
            const deltaY = centerY - this.touchState.panStartY;
            
            // Only pan if movement is significant
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                this.handlePanGesture(deltaX, deltaY);
                
                // Update pan start position for next frame
                this.touchState.panStartX = centerX;
                this.touchState.panStartY = centerY;
            }
        }
        
        // Handle zooming
        if (this.touchState.isZooming) {
            const scaleChange = currentDistance / this.touchState.zoomStartDistance;
            const newZoom = Math.max(0.1, Math.min(10, this.touchState.zoomStartScale * scaleChange));
            
            // Only zoom if scale change is significant
            if (Math.abs(scaleChange - 1) > 0.01) {
                this.handleZoomGesture(newZoom, centerX, centerY);
            }
        }
    }

    /**
     * Touch end handler
     */
    handleTouchEnd(e) {
        const changedTouches = Array.from(e.changedTouches);
        
        Logger.touch.debug('Touch end:', changedTouches.length, 'touches ended');
        
        // Clean up ended touches
        changedTouches.forEach(touch => {
            const touchData = this.activeTouches.get(touch.identifier);
            if (touchData) {
                touchData.isActive = false;
                this.activeTouches.delete(touch.identifier);
            }
        });
        
        // Handle remaining touches
        const remainingTouches = Array.from(e.touches);
        
        if (remainingTouches.length === 0) {
            // All touches ended
            this.finishTouchOperations();
        } else if (remainingTouches.length === 1) {
            // Transition from multiple touches to one touch
            this.transitionToSingleTouch(remainingTouches[0]);
        } else if (remainingTouches.length === 2) {
            // Transition from three touches to two touches
            this.transitionToTwoTouch(remainingTouches);
        }
    }

    /**
     * Touch cancel handler
     */
    handleTouchCancel(e) {
        Logger.touch.debug('Touch cancel');
        
        // Clean up all touches
        this.activeTouches.clear();
        this.cancelAllTouchOperations();
    }

    /**
     * Handle object touch
     */
    handleObjectTouch(e, obj, worldPos, touch) {
        const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
        const isSelected = selectedObjects.has(obj.id);
        let selectionChanged = false;
        
        if (!isSelected) {
            selectedObjects.clear();
            selectedObjects.add(obj.id);
            selectionChanged = true;
        }
        
        if (selectionChanged) {
            this.editor.stateManager.set('selectedObjects', selectedObjects);
            this.editor.updateAllPanels();
        }
        
        // Start dragging if object is selected
        if (selectedObjects.has(obj.id)) {
            this.startObjectDrag(worldPos, touch);
        }
    }

    /**
     * Handle empty touch (marquee selection)
     */
    handleEmptyTouch(e, worldPos, touch) {
        // Clear selection
        this.editor.stateManager.set('selectedObjects', new Set());
        
        // Start marquee selection
        this.touchState.isMarqueeSelecting = true;
        this.touchState.marqueeRect = { x: worldPos.x, y: worldPos.y, width: 0, height: 0 };
        this.touchState.marqueeStartX = worldPos.x;
        this.touchState.marqueeStartY = worldPos.y;
        
        Logger.touch.debug('Started marquee selection at:', worldPos);
    }

    /**
     * Start object drag
     */
    startObjectDrag(worldPos, touch) {
        this.touchState.isDragging = true;
        this.touchState.dragStartX = worldPos.x;
        this.touchState.dragStartY = worldPos.y;
        
        Logger.touch.debug('Started object drag at:', worldPos);
    }

    /**
     * Drag selected objects
     */
    dragSelectedObjects(worldPos, touch) {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        if (!selectedObjects || selectedObjects.size === 0) return;
        
        const dx = worldPos.x - this.touchState.dragStartX;
        const dy = worldPos.y - this.touchState.dragStartY;
        
        // Apply snap to grid if enabled
        const snapEnabled = SnapUtils.isSnapToGridEnabled(this.editor.stateManager, this.editor.level);
        let finalDx = dx;
        let finalDy = dy;
        
        if (snapEnabled) {
            const gridSize = SnapUtils.getGridSize(this.editor.stateManager, this.editor.level);
            const snapTolerancePercent = this.editor.userPrefs?.get('snapTolerance') || 80;
            const tolerance = gridSize * (snapTolerancePercent / 100);
            
            // Find nearest grid point for current position
            const nearestGrid = SnapUtils.findNearestGridPoint(worldPos.x, worldPos.y, gridSize, tolerance);
            
            if (nearestGrid) {
                // Calculate movement to snap to grid
                const snapDx = nearestGrid.x - (this.touchState.dragStartX + dx);
                const snapDy = nearestGrid.y - (this.touchState.dragStartY + dy);
                finalDx = dx + snapDx;
                finalDy = dy + snapDy;
            }
        }
        
        // Move selected objects
        selectedObjects.forEach(id => {
            const obj = this.editor.level.findObjectById(id);
            if (obj) {
                obj.x += finalDx;
                obj.y += finalDy;
            }
        });
        
        // Update drag start position
        this.touchState.dragStartX = worldPos.x;
        this.touchState.dragStartY = worldPos.y;
    }

    /**
     * Update marquee selection
     */
    updateMarquee(worldPos) {
        if (this.touchState.marqueeRect) {
            const startX = this.touchState.marqueeStartX || this.touchState.marqueeRect.x;
            const startY = this.touchState.marqueeStartY || this.touchState.marqueeRect.y;
            
            this.touchState.marqueeRect.x = Math.min(startX, worldPos.x);
            this.touchState.marqueeRect.y = Math.min(startY, worldPos.y);
            this.touchState.marqueeRect.width = Math.abs(worldPos.x - startX);
            this.touchState.marqueeRect.height = Math.abs(worldPos.y - startY);
        }
    }

    /**
     * Handle pan gesture
     */
    handlePanGesture(deltaX, deltaY) {
        const camera = this.editor.stateManager.get('camera');
        
        // Apply pan sensitivity
        const panSensitivity = this.editor.stateManager.get('touch.panSensitivity') || 1.0;
        
        this.editor.stateManager.update({
            'camera.x': camera.x - deltaX / camera.zoom * panSensitivity,
            'camera.y': camera.y - deltaY / camera.zoom * panSensitivity
        });
        
        this.editor.render();
    }

    /**
     * Handle zoom gesture
     */
    handleZoomGesture(newZoom, centerX, centerY) {
        const camera = this.editor.stateManager.get('camera');
        
        // Calculate new camera position to keep center point fixed
        const mouseWorldPosBeforeZoom = this.editor.canvasRenderer.screenToWorld(centerX, centerY, camera);
        
        // Create temporary camera for calculations
        const tempCamera = { ...camera, zoom: newZoom };
        const mouseWorldPosAfterZoom = this.editor.canvasRenderer.screenToWorld(centerX, centerY, tempCamera);
        
        const newCameraX = camera.x + mouseWorldPosBeforeZoom.x - mouseWorldPosAfterZoom.x;
        const newCameraY = camera.y + mouseWorldPosBeforeZoom.y - mouseWorldPosAfterZoom.y;
        
        // Update camera
        this.editor.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': newCameraX,
            'camera.y': newCameraY
        });
        
        this.editor.render();
    }

    /**
     * Finish touch operations
     */
    finishTouchOperations() {
        if (this.touchState.isMarqueeSelecting) {
            this.finishMarqueeSelection();
        }
        
        if (this.touchState.isDragging) {
            this.finishObjectDrag();
        }
        
        if (this.touchState.isTouchDragging) {
            this.finishTouchDrag();
        }
        
        // Check for tap gestures
        this.checkForTapGestures();
        
        // Reset touch state
        this.resetTouchState();
    }

    /**
     * Finish marquee selection
     */
    finishMarqueeSelection() {
        if (!this.touchState.marqueeRect) return;
        
        const marquee = this.touchState.marqueeRect;
        const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
        
        // Find objects in marquee
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
        
        this.editor.stateManager.set('selectedObjects', selectedObjects);
        this.editor.updateAllPanels();
        
        Logger.touch.debug('Finished marquee selection, selected:', selectedObjects.size, 'objects');
    }

    /**
     * Finish object drag
     */
    finishObjectDrag() {
        // Save state after drag
        this.editor.historyManager.saveState(
            this.editor.level.objects, 
            this.editor.stateManager.get('selectedObjects'), 
            false, 
            this.editor.stateManager.get('groupEditMode')
        );
        
        this.editor.stateManager.markDirty();
        this.editor.updateAllPanels();
        
        Logger.touch.debug('Finished object drag');
    }

    /**
     * Transition from two touches to one touch
     */
    transitionToSingleTouch(touch) {
        // Cancel pan/zoom operations
        this.touchState.isPanning = false;
        this.touchState.isZooming = false;
        
        // Start single touch operation if needed
        const worldPos = this.screenToWorld(touch);
        const clickedObject = this.editor.objectOperations.findObjectAtPoint(worldPos.x, worldPos.y);
        
        if (clickedObject) {
            this.handleObjectTouch(null, clickedObject, worldPos, touch);
        }
    }

    /**
     * Cancel single touch operations
     */
    cancelSingleTouchOperations() {
        this.touchState.isMarqueeSelecting = false;
        this.touchState.isDragging = false;
        this.touchState.marqueeRect = null;
        this.touchState.marqueeStartX = null;
        this.touchState.marqueeStartY = null;
    }

    /**
     * Cancel all touch operations
     */
    cancelAllTouchOperations() {
        this.cancelSingleTouchOperations();
        this.touchState.isPanning = false;
        this.touchState.isZooming = false;
        this.touchState.panStartX = null;
        this.touchState.panStartY = null;
        this.touchState.zoomStartDistance = null;
        this.touchState.zoomStartScale = null;
    }

    /**
     * Reset touch state
     */
    resetTouchState() {
        this.touchState = {
            isMarqueeSelecting: false,
            marqueeRect: null,
            marqueeStartX: null,
            marqueeStartY: null,
            isDragging: false,
            dragStartX: null,
            dragStartY: null,
            isPanning: false,
            panStartX: null,
            panStartY: null,
            isZooming: false,
            zoomStartDistance: null,
            zoomStartScale: null,
            // New gesture states
            isTouchDragging: false,
            touchDragStartX: null,
            touchDragStartY: null,
            lastTapTime: 0,
            lastTapX: null,
            lastTapY: null,
            tapCount: 0,
            doubleTapTimeout: null,
            longPressTimeout: null,
            isLongPress: false,
            longPressThreshold: 500, // ms
            doubleTapThreshold: 300, // ms
            tapThreshold: 10 // pixels
        };
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(touch) {
        return this.editor.canvasRenderer.screenToWorld(touch.clientX, touch.clientY, this.editor.stateManager.get('camera'));
    }

    /**
     * Calculate distance between two points
     */
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get current touch state for rendering
     */
    getTouchState() {
        return this.touchState;
    }

    /**
     * Check if touch operations are active
     */
    isTouchActive() {
        return this.touchState.isMarqueeSelecting || 
               this.touchState.isDragging || 
               this.touchState.isPanning || 
               this.touchState.isZooming ||
               this.touchState.isTouchDragging;
    }

    // ===== NEW GESTURE METHODS =====

    /**
     * Handle three touch start (three-finger tap or special gestures)
     */
    handleThreeTouchStart(e, touches, currentTime) {
        const centerX = (touches[0].clientX + touches[1].clientX + touches[2].clientX) / 3;
        const centerY = (touches[0].clientY + touches[1].clientY + touches[2].clientY) / 3;
        
        Logger.touch.debug('Three touch start:', { centerX, centerY });
        
        // Store touch data for potential tap detection
        this.touchState.threeTouchStartTime = currentTime;
        this.touchState.threeTouchStartX = centerX;
        this.touchState.threeTouchStartY = centerY;
        
        // Cancel any active operations
        this.cancelAllTouchOperations();
        
        // Handle three-finger tap immediately
        this.handleThreeFingerTap(e, centerX, centerY);
    }

    /**
     * Handle three touch move
     */
    handleThreeTouchMove(e, touches) {
        // For now, three-finger gestures are mainly taps
        // Could be extended for special gestures like rotation
        Logger.touch.debug('Three touch move');
    }

    /**
     * Handle double tap
     */
    handleDoubleTap(e, worldPos, touch) {
        Logger.touch.debug('Double tap detected at:', worldPos);
        
        // Clear any existing timeout
        if (this.touchState.doubleTapTimeout) {
            clearTimeout(this.touchState.doubleTapTimeout);
            this.touchState.doubleTapTimeout = null;
        }
        
        // Dispatch double tap event
        this.dispatchTouchEvent('doubletap', {
            x: worldPos.x,
            y: worldPos.y,
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: e.target
        });
    }

    /**
     * Handle three-finger tap
     */
    handleThreeFingerTap(e, centerX, centerY) {
        const worldPos = this.editor.canvasRenderer.screenToWorld(centerX, centerY, this.editor.stateManager.get('camera'));
        
        Logger.touch.debug('Three-finger tap detected at:', worldPos);
        
        // Dispatch three-finger tap event
        this.dispatchTouchEvent('threefingertap', {
            x: worldPos.x,
            y: worldPos.y,
            clientX: centerX,
            clientY: centerY,
            target: e.target
        });
    }

    /**
     * Check if current touch is a double tap
     */
    isDoubleTap(touch, currentTime) {
        const timeDiff = currentTime - this.touchState.lastTapTime;
        const distance = this.getDistance(touch.clientX, touch.clientY, this.touchState.lastTapX || 0, this.touchState.lastTapY || 0);
        
        return timeDiff < this.touchState.doubleTapThreshold && 
               distance < this.touchState.tapThreshold &&
               this.touchState.tapCount === 1;
    }

    /**
     * Start long press detection
     */
    startLongPressDetection(e, worldPos, touch) {
        this.touchState.longPressTimeout = setTimeout(() => {
            this.handleLongPress(e, worldPos, touch);
        }, this.touchState.longPressThreshold);
    }

    /**
     * Handle long press
     */
    handleLongPress(e, worldPos, touch) {
        this.touchState.isLongPress = true;
        
        Logger.touch.debug('Long press detected at:', worldPos);
        
        // Dispatch long press event
        this.dispatchTouchEvent('longpress', {
            x: worldPos.x,
            y: worldPos.y,
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: e.target
        });
    }

    /**
     * Cancel long press detection
     */
    cancelLongPress() {
        if (this.touchState.longPressTimeout) {
            clearTimeout(this.touchState.longPressTimeout);
            this.touchState.longPressTimeout = null;
        }
    }

    /**
     * Start touch drag
     */
    startTouchDrag(worldPos, touch) {
        this.touchState.isTouchDragging = true;
        this.touchState.touchDragStartX = worldPos.x;
        this.touchState.touchDragStartY = worldPos.y;
        
        Logger.touch.debug('Started touch drag at:', worldPos);
        
        // Dispatch touch drag start event
        this.dispatchTouchEvent('touchdragstart', {
            x: worldPos.x,
            y: worldPos.y,
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    }

    /**
     * Handle touch drag
     */
    handleTouchDrag(worldPos, touch) {
        const dx = worldPos.x - this.touchState.touchDragStartX;
        const dy = worldPos.y - this.touchState.touchDragStartY;
        
        // Dispatch touch drag event
        this.dispatchTouchEvent('touchdrag', {
            x: worldPos.x,
            y: worldPos.y,
            deltaX: dx,
            deltaY: dy,
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        
        // Update drag start position
        this.touchState.touchDragStartX = worldPos.x;
        this.touchState.touchDragStartY = worldPos.y;
    }

    /**
     * Finish touch drag
     */
    finishTouchDrag() {
        Logger.touch.debug('Finished touch drag');
        
        // Dispatch touch drag end event
        this.dispatchTouchEvent('touchdragend', {
            x: this.touchState.touchDragStartX,
            y: this.touchState.touchDragStartY
        });
    }

    /**
     * Check for tap gestures
     */
    checkForTapGestures() {
        const currentTime = Date.now();
        
        // Check for single tap
        if (!this.touchState.isLongPress && !this.touchState.isTouchDragging && !this.touchState.isDragging) {
            const timeDiff = currentTime - this.touchState.lastTapTime;
            
            if (timeDiff < this.touchState.doubleTapThreshold) {
                this.touchState.tapCount++;
            } else {
                this.touchState.tapCount = 1;
            }
            
            // Store tap data
            this.touchState.lastTapTime = currentTime;
            this.touchState.lastTapX = this.touchState.touchDragStartX;
            this.touchState.lastTapY = this.touchState.touchDragStartY;
            
            // Handle single tap
            if (this.touchState.tapCount === 1) {
                this.handleSingleTap();
            }
        }
        
        // Check for two-finger tap
        if (this.touchState.twoTouchStartTime) {
            const timeDiff = currentTime - this.touchState.twoTouchStartTime;
            const distance = this.getDistance(
                this.touchState.twoTouchStartX, 
                this.touchState.twoTouchStartY,
                this.touchState.panStartX || 0,
                this.touchState.panStartY || 0
            );
            
            if (timeDiff < this.touchState.doubleTapThreshold && distance < this.touchState.tapThreshold) {
                this.handleTwoFingerTap();
            }
        }
    }

    /**
     * Handle single tap
     */
    handleSingleTap() {
        Logger.touch.debug('Single tap detected');
        
        // Dispatch single tap event
        this.dispatchTouchEvent('singletap', {
            x: this.touchState.lastTapX,
            y: this.touchState.lastTapY
        });
    }

    /**
     * Handle two-finger tap
     */
    handleTwoFingerTap() {
        const worldPos = this.editor.canvasRenderer.screenToWorld(
            this.touchState.twoTouchStartX, 
            this.touchState.twoTouchStartY, 
            this.editor.stateManager.get('camera')
        );
        
        Logger.touch.debug('Two-finger tap detected at:', worldPos);
        
        // Dispatch two-finger tap event
        this.dispatchTouchEvent('twofingertap', {
            x: worldPos.x,
            y: worldPos.y,
            clientX: this.touchState.twoTouchStartX,
            clientY: this.touchState.twoTouchStartY
        });
    }

    /**
     * Transition from three touches to two touches
     */
    transitionToTwoTouch(touches) {
        Logger.touch.debug('Transition from three to two touches');
        
        // Cancel three-touch operations
        this.touchState.threeTouchStartTime = null;
        this.touchState.threeTouchStartX = null;
        this.touchState.threeTouchStartY = null;
        
        // Start two-touch operations
        this.handleTwoTouchStart(null, touches, Date.now());
    }

    /**
     * Dispatch touch event to editor
     */
    dispatchTouchEvent(eventType, data) {
        // Create custom event
        const event = new CustomEvent(`touch${eventType}`, {
            detail: {
                type: eventType,
                ...data,
                timestamp: Date.now()
            }
        });
        
        // Dispatch to canvas
        this.editor.canvasRenderer.canvas.dispatchEvent(event);
        
        // Also dispatch to window for global handlers
        window.dispatchEvent(event);
        
        Logger.touch.debug(`Dispatched touch event: ${eventType}`, data);
    }
}
