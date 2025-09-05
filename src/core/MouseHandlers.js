import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

/**
 * Mouse Handlers module for LevelEditor
 * Handles all mouse interactions and events
 */
export class MouseHandlers extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        
        // Performance optimization for zoom
        this.zoomAnimationFrame = null;
    }

    /**
     * Mouse event handlers
     */
    handleMouseDown(e) {
        const worldPos = this.screenToWorld(e);
        const mouse = this.getMouseState();
        
        if (e.button === 2) { // Right mouse button
            this.editor.stateManager.update({
                'mouse.isRightDown': true,
                'mouse.lastX': e.clientX,
                'mouse.lastY': e.clientY,
                'mouse.altKey': e.altKey
            });
            this.editor.canvasRenderer.canvas.style.cursor = 'grabbing';
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

    handleMouseMove(e) {
        const worldPos = this.screenToWorld(e);
        const mouse = this.getMouseState();
        
        this.updateMouseState(e, worldPos);
        
        if (mouse.isRightDown) {
            // Pan camera
            const dx = e.clientX - mouse.lastX;
            const dy = e.clientY - mouse.lastY;
            const camera = this.editor.stateManager.get('camera');
            
            this.editor.stateManager.update({
                'camera.x': camera.x - dx / camera.zoom,
                'camera.y': camera.y - dy / camera.zoom,
                'mouse.lastX': e.clientX,
                'mouse.lastY': e.clientY
            });
        } else if (mouse.isLeftDown && mouse.isDragging) {
            // Drag objects
            this.dragSelectedObjects(worldPos);
        } else if (mouse.isMarqueeSelecting) {
            // Update marquee
            this.updateMarquee(worldPos);
        } else if (this.editor.stateManager.get('duplicate.isActive')) {
            // Update duplicate objects position via DuplicateOperations
            this.editor.duplicateOperations.updatePreview(worldPos);
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
        if (mouse.isPlacingObjects || mouse.isRightDown || (mouse.isLeftDown && mouse.isDragging) || mouse.isMarqueeSelecting) {
            this.editor.render();
        }
    }

    handleMouseUp(e) {
        const mouse = this.editor.stateManager.get('mouse');
        
        if (e.button === 2) {
            this.editor.stateManager.update({
                'mouse.isRightDown': false,
                'mouse.altKey': e.altKey
            });
            this.editor.canvasRenderer.canvas.style.cursor = 'default';
            
            // Right click cancels all current actions
            this.editor.cancelAllActions();
        }
        
        if (e.button === 0) {
            const currentAlt = e.altKey || mouse.altKey;
            const wasDragging = mouse.isDragging; // Save dragging state before resetting
            
            if (mouse.isDragging) {
                this.editor.historyManager.saveState(this.editor.level.objects);
                this.editor.stateManager.markDirty();
            }
            
            this.editor.stateManager.update({
                'mouse.isLeftDown': false,
                'mouse.isDragging': false,
                'mouse.altKey': e.altKey
            });
            
            if (mouse.isMarqueeSelecting) {
                this.finishMarqueeSelection();
            }

            // If we are in group edit mode and released after dragging with Alt
            if (this.isInGroupEditMode() && currentAlt && wasDragging) {
                const groupEditMode = this.getGroupEditMode();
                Logger.mouse.debug('Alt+drag detected in group edit mode');
                const selectedIds = this.editor.stateManager.get('selectedObjects');
                
                // ИЗМЕНЕНИЕ: Вычисляем границы группы, ИСКЛЮЧАЯ перетаскиваемые объекты.
                const bounds = this.editor.objectOperations.getObjectWorldBounds(groupEditMode.group, Array.from(selectedIds));
                Logger.mouse.debug('Group bounds (excluding dragged objects):', bounds);
                
                const selected = Array.from(selectedIds)
                    .map(id => this.editor.level.findObjectById(id))
                    .filter(Boolean);
                Logger.mouse.debug('Selected objects:', selected.length);
                selected.forEach(obj => {
                    // Only consider direct children of the edited group
                    const isChild = this.editor.objectOperations.isObjectInGroup(obj, groupEditMode.group);
                    Logger.mouse.debug(`Object ${obj.id} is child:`, isChild);
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
                        
                        Logger.mouse.debug(`Object bounds:`, objBounds);
                        Logger.mouse.debug(`Group bounds:`, bounds);
                        
                        // Check if object bounds intersect with group bounds
                        const hasIntersection = objBounds.minX < bounds.maxX && 
                                              objBounds.maxX > bounds.minX && 
                                              objBounds.minY < bounds.maxY && 
                                              objBounds.maxY > bounds.minY;
                        
                        const outside = !hasIntersection;
                        Logger.mouse.debug(`Object intersects with group:`, hasIntersection);
                        Logger.mouse.debug(`Object should be moved out:`, outside);
                        if (outside) {
                            Logger.mouse.debug(`Moving object ${obj.id} out of group`);
                            // Remove from group's children
                            groupEditMode.group.children = groupEditMode.group.children.filter(c => c.id !== obj.id);
                            // Add to main level at world coordinates
                            obj.x = worldX;
                            obj.y = worldY;
                            this.editor.level.objects.push(obj);
                            
                            // Check if the specific group became empty and remove it
                            console.log(`[MOUSE HANDLERS DEBUG] 🖱️ Object dragged out of group: ${groupEditMode.group.name} (ID: ${groupEditMode.group.id})`);
                            const groupWasRemoved = this.editor.groupOperations.removeEmptyGroup(groupEditMode.group);
                            if (groupWasRemoved) {
                                console.log(`[MOUSE HANDLERS DEBUG] ✅ Group was removed after drag & drop`);
                                this.editor.updateAllPanels();
                            } else {
                                console.log(`[MOUSE HANDLERS DEBUG] ❌ Group was NOT removed after drag & drop`);
                            }
                        }
                    }
                });
            }
            
            if (mouse.isPlacingObjects) {
                const worldPos = this.editor.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.editor.stateManager.get('camera'));
                this.finishPlacingObjects(worldPos);
            }
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
        const mouse = this.editor.stateManager.get('mouse');
        
        if (e.button === 0 && mouse.isMarqueeSelecting) {
            this.finishMarqueeSelection();
        }
        
        if (e.button === 2) {
            this.editor.stateManager.update({
                'mouse.isRightDown': false
            });
            this.editor.canvasRenderer.canvas.style.cursor = 'default';
        }
    }

    handleWheel(e) {
        e.preventDefault();
        
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
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handleDrop(e) {
        e.preventDefault();
        
        const mouse = this.editor.stateManager.get('mouse');
        if (!mouse.isDraggingAsset) return;
        
        this.editor.historyManager.saveState(this.editor.level.objects);
        
        const droppedAssetIds = JSON.parse(e.dataTransfer.getData('application/json'));
        const worldPos = this.screenToWorld(e);
        
        const newIds = new Set();

        droppedAssetIds.forEach((assetId, index) => {
            const asset = this.editor.assetManager.getAsset(assetId);
            if (asset) {
                const newObject = asset.createInstance(worldPos.x + index * 10, worldPos.y + index * 10);

                // Check if we're in group edit mode and the drop point is inside the group bounds
                if (this.isInGroupEditMode() && this.editor.objectOperations.isPointInGroupBounds(worldPos.x, worldPos.y)) {
                    const groupEditMode = this.getGroupEditMode();
                    // Convert to relative coordinates using group's WORLD position
                    const groupPos = this.editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
                    newObject.x -= groupPos.x;
                    newObject.y -= groupPos.y;
                    groupEditMode.group.children.push(newObject);
                } else {
                    // Add to main level
                    this.editor.level.addObject(newObject);
                }

                newIds.add(newObject.id);
            }
        });
        
        this.editor.stateManager.set('selectedObjects', newIds);
        this.editor.stateManager.update({
            'mouse.isDraggingAsset': false
        });
        
        this.editor.updateAllPanels();
        this.editor.render();
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
            this.editor.stateManager.update({
                'mouse.isDragging': true,
                'mouse.dragStartX': worldPos.x,
                'mouse.dragStartY': worldPos.y
            });
        }
    }

    handleEmptyClick(e, worldPos) {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');

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

    dragSelectedObjects(worldPos) {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const mouse = this.editor.stateManager.get('mouse');

        const dx = worldPos.x - mouse.dragStartX;
        const dy = worldPos.y - mouse.dragStartY;

        selectedObjects.forEach(id => {
            const obj = this.editor.level.findObjectById(id);
            if (obj) {
                // Check if object is on main level or inside the currently edited group
                const isOnMainLevel = this.editor.level.objects.some(topObj => topObj.id === obj.id);
                const isInEditedGroup = this.isInGroupEditMode() && 
                    this.editor.objectOperations.isObjectInGroup(obj, this.getActiveGroup());

                if (isOnMainLevel) {
                    // Object is on main level - move it normally
                    obj.x += dx;
                    obj.y += dy;

                    // If dragged into edited group bounds, move under the group with relative coordinates
                    if (!this.isAltKeyPressed() && this.isInGroupEditMode() && this.editor.objectOperations.isPointInGroupBounds(obj.x, obj.y)) {
                        const groupEditMode = this.getGroupEditMode();
                        // Convert world -> relative to group's world position
                        const groupPos = this.editor.objectOperations.getObjectWorldPosition(groupEditMode.group);
                        obj.x -= groupPos.x;
                        obj.y -= groupPos.y;

                        // Remove from main level and append into group
                        this.editor.level.objects = this.editor.level.objects.filter(top => top.id !== obj.id);
                        groupEditMode.group.children.push(obj);
                    }
                } else if (isInEditedGroup) {
                    // Object is inside the currently edited group
                    if (this.isAltKeyPressed()) {
                        // Alt+drag: move in world coordinates by converting to world position first
                        const groupPos = this.editor.objectOperations.getObjectWorldPosition(this.getActiveGroup());
                        const worldX = groupPos.x + obj.x;
                        const worldY = groupPos.y + obj.y;
                        
                        // Move in world coordinates
                        const newWorldX = worldX + dx;
                        const newWorldY = worldY + dy;
                        
                        // Convert back to relative coordinates
                        const activeGroupPos = this.editor.objectOperations.getObjectWorldPosition(this.getActiveGroup());
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

        this.editor.stateManager.update({
            'mouse.dragStartX': worldPos.x,
            'mouse.dragStartY': worldPos.y
        });

        this.editor.updateAllPanels();
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

    updatePlacingObjectsPosition(worldPos) {
        const duplicate = this.editor.stateManager.get('duplicate');
        if (!duplicate.isActive || !duplicate.objects || duplicate.objects.length === 0) return;

        // Update positions of duplicate objects to follow mouse
        // All objects should move together as a group
        const updatedObjects = this.editor.duplicateRenderUtils.updatePositions(duplicate.objects, worldPos);

        // Update state with new positions
        this.editor.stateManager.update({
            'duplicate.objects': updatedObjects,
            'duplicate.basePosition': { x: worldPos.x, y: worldPos.y },
            'mouse.placingObjects': updatedObjects
        });

        // Force render to show updated positions
        this.editor.render();
    }

    finishMarqueeSelection() {
        const mouse = this.editor.stateManager.get('mouse');
        if (!mouse.marqueeRect) return;

        const marquee = mouse.marqueeRect;
        const selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));

        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            // In group edit mode, limit selection to descendants of the edited group
            const collect = (g) => {
                const res = [];
                g.children.forEach(ch => {
                    res.push(ch);
                    if (ch.type === 'group') res.push(...collect(ch));
                });
                return res;
            };
            const candidates = collect(groupEditMode.group);
            candidates.forEach(obj => {
                const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
                if (marquee.x < bounds.maxX && marquee.x + marquee.width > bounds.minX &&
                    marquee.y < bounds.maxY && marquee.y + marquee.height > bounds.minY) {
                    selectedObjects.add(obj.id);
                }
            });
        } else {
            // Normal mode - select objects on main level only
            this.editor.level.objects.forEach(obj => {
                const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
                if (marquee.x < bounds.maxX && marquee.x + marquee.width > bounds.minX &&
                    marquee.y < bounds.maxY && marquee.y + marquee.height > bounds.minY) {
                    selectedObjects.add(obj.id);
                }
            });
        }

        this.editor.stateManager.set('selectedObjects', selectedObjects);
        this.editor.stateManager.update({
            'mouse.marqueeRect': null,
            'mouse.marqueeStartX': null,
            'mouse.marqueeStartY': null
        });
    }

    /**
     * Finish placing objects (duplication)
     */
    finishPlacingObjects(worldPos) {
        const mouse = this.editor.stateManager.get('mouse');
        this.editor.duplicateOperations.confirmPlacement(worldPos);
    }
}
