/**
 * Render Operations module for LevelEditor
 * Handles all rendering operations
 */
export class RenderOperations {
    constructor(levelEditor) {
        this.editor = levelEditor;
        
        // Performance optimization caches
        this.visibleObjectsCache = new Map();
        this.lastCameraState = null;
        this.cacheTimeout = 100; // Cache timeout in ms
    }

    /**
     * Render the canvas
     */
    render() {
        if (!this.editor.level) return;
        
        const camera = this.editor.stateManager.get('camera');
        const mouse = this.editor.stateManager.get('mouse');
        
        this.editor.canvasRenderer.clear();
        this.editor.canvasRenderer.setCamera(camera);
        
        // Draw background and grid
        this.editor.canvasRenderer.drawGrid(
            this.editor.level.settings.gridSize, 
            camera, 
            this.editor.level.settings.backgroundColor
        );
        
        // Draw objects with frustum culling
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        const visibleObjects = this.getVisibleObjects(camera);
        visibleObjects.forEach(obj => {
            this.editor.canvasRenderer.drawObject(obj);
        });
        
        // Draw selection
        this.drawSelection();

        // If a single group is selected, highlight its nested groups with fading
        const selected = this.editor.stateManager.get('selectedObjects');
        if (selected && selected.size === 1) {
            const selId = Array.from(selected)[0];
            const selObj = this.editor.level.findObjectById(selId);
            if (selObj && selObj.type === 'group') {
                this.drawHierarchyHighlightForGroup(selObj, 0);
            }
        }

        // Draw group edit mode frame
        this.drawGroupEditFrame();
        
        // (moved) duplicate preview drawing happens after restoreCamera()
        
        // Draw marquee
        if (mouse.marqueeRect) {
            this.editor.canvasRenderer.drawMarquee(mouse.marqueeRect, camera);
        }
        
        this.editor.canvasRenderer.restoreCamera();

        // Draw placing objects (duplicates) after camera is restored (screen space)
        const duplicate = this.editor.stateManager.get('duplicate');
        if (duplicate && duplicate.isActive && Array.isArray(duplicate.objects) && duplicate.objects.length > 0) {
            // Log only once per duplicate session
            if (!this._lastRenderState || this._lastRenderState !== 'drawing') {
                console.log('RENDER: Drawing duplicate objects:', duplicate.objects.length);
                console.log('RENDER: Camera position:', { x: camera.x, y: camera.y, zoom: camera.zoom });
                this._lastRenderState = 'drawing';
            }
            this.editor.duplicateRenderUtils.drawPlacingObjects(this.editor.canvasRenderer, duplicate.objects, camera);
            // Note: selection outlines for groups are skipped here to avoid mixing spaces
        } else if (duplicate) {
            // Log state change only when it changes
            const currentState = `${duplicate.isActive}_${duplicate.objects?.length || 0}`;
            if (!this._lastRenderState || this._lastRenderState !== currentState) {
                console.log('RENDER: Duplicate state changed:', {
                    isActive: duplicate.isActive,
                    objectsLength: duplicate.objects?.length || 0,
                    objectsType: Array.isArray(duplicate.objects) ? 'array' : typeof duplicate.objects
                });
                this._lastRenderState = currentState;
            }
        }
    }

    /**
     * Draw selection outlines
     */
    drawSelection() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const camera = this.editor.stateManager.get('camera');
        const groupEditMode = this.editor.stateManager.get('groupEditMode');

        if (groupEditMode && groupEditMode.isActive) {
            // In group edit mode, draw selection for all objects including nested ones
            this.editor.level.getAllObjects().forEach(obj => {
                if (selectedObjects.has(obj.id)) {
                    const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
                    const mouse = this.editor.stateManager.get('mouse');
                    
                    // Special visual feedback for Alt+drag in group edit mode
                    if (mouse.altKey && mouse.isDragging && this.editor.objectOperations.isObjectInGroup(obj, groupEditMode.group)) {
                        this.drawAltDragSelectionRect(bounds, camera);
                    } else {
                        this.drawSelectionRect(bounds, obj.type === 'group', camera);
                    }
                }
            });
        } else {
            // Normal mode - draw selection for top-level objects only
            this.editor.level.objects.forEach(obj => {
                if (selectedObjects.has(obj.id)) {
                    const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
                    this.drawSelectionRect(bounds, obj.type === 'group', camera);
                }
            });
        }
    }

    drawSelectionRect(bounds, isGroup, camera) {
        const selectionColor = this.editor.settingsManager?.get('selection.outlineColor') || '#3B82F6';
        const outlineWidth = (isGroup
            ? (this.editor.settingsManager?.get('selection.groupOutlineWidth') || 4)
            : (this.editor.settingsManager?.get('selection.outlineWidth') || 2)) / camera.zoom;

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = selectionColor;
        this.editor.canvasRenderer.ctx.lineWidth = outlineWidth;
        this.editor.canvasRenderer.ctx.setLineDash(isGroup ? [5, 5] : []);

        this.editor.canvasRenderer.ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        this.editor.canvasRenderer.ctx.restore();
    }

    drawAltDragSelectionRect(bounds, camera) {
        const altDragColor = '#FF6B6B'; // Red color to indicate Alt+drag
        const outlineWidth = 3 / camera.zoom;

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = altDragColor;
        this.editor.canvasRenderer.ctx.lineWidth = outlineWidth;
        this.editor.canvasRenderer.ctx.setLineDash([8, 4]); // Dashed line to indicate special mode

        this.editor.canvasRenderer.ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        this.editor.canvasRenderer.ctx.restore();
    }

    /**
     * Draw group edit mode frame
     */
    drawGroupEditFrame() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        if (!groupEditMode || !groupEditMode.isActive || !groupEditMode.group) return;

        const camera = this.editor.stateManager.get('camera');
        const group = groupEditMode.group;

        // Draw frame around the group being edited; allow freezing during Alt-drag
        const bounds = (groupEditMode.frameFrozen && groupEditMode.frozenBounds)
            ? groupEditMode.frozenBounds
            : this.editor.objectOperations.getObjectWorldBounds(group);

        // Add padding to show the group boundary clearly
        const padding = 10;
        const minX = bounds.minX - padding;
        const minY = bounds.minY - padding;
        const maxX = bounds.maxX + padding;
        const maxY = bounds.maxY + padding;

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = '#FF6B6B';
        this.editor.canvasRenderer.ctx.lineWidth = 3 / camera.zoom;
        this.editor.canvasRenderer.ctx.setLineDash([10, 5]);
        this.editor.canvasRenderer.ctx.strokeRect(
            minX,
            minY,
            maxX - minX,
            maxY - minY
        );
        this.editor.canvasRenderer.ctx.restore();
    }

    drawHierarchyHighlightForGroup(group, depth = 0) {
        const camera = this.editor.stateManager.get('camera');
        const baseColor = this.editor.settingsManager?.get('selection.hierarchyHighlightColor') || '#3B82F6';
        const maxAlpha = 0.25; // base alpha
        const decay = 0.6; // alpha decay per depth
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));

        if (!group || !group.children) return;

        // Highlight each nested group
        group.children.forEach(child => {
            if (child.type === 'group') {
                const bounds = this.editor.objectOperations.getObjectWorldBounds(child);
                const rgba = this.hexToRgba(baseColor, alpha);
                this.editor.canvasRenderer.ctx.save();
                this.editor.canvasRenderer.ctx.fillStyle = rgba;
                this.editor.canvasRenderer.ctx.fillRect(
                    bounds.minX,
                    bounds.minY,
                    bounds.maxX - bounds.minX,
                    bounds.maxY - bounds.minY
                );
                this.editor.canvasRenderer.ctx.restore();

                // Recurse deeper
                this.drawHierarchyHighlightForGroup(child, depth + 1);
            }
        });
    }

    hexToRgba(hex, alpha = 1) {
        const normalized = hex.replace('#', '');
        const bigint = parseInt(normalized.length === 3
            ? normalized.split('').map(c => c + c).join('')
            : normalized, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Get objects visible in the current viewport (frustum culling) with caching
     */
    getVisibleObjects(camera) {
        const currentTime = performance.now();
        const cameraKey = `${camera.x.toFixed(1)},${camera.y.toFixed(1)},${camera.zoom.toFixed(2)}`;
        
        // Check cache first
        if (this.visibleObjectsCache.has(cameraKey)) {
            const cached = this.visibleObjectsCache.get(cameraKey);
            if (currentTime - cached.timestamp < this.cacheTimeout) {
                return cached.objects;
            }
        }
        
        const canvas = this.editor.canvasRenderer.canvas;
        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + canvas.width / camera.zoom;
        const viewportBottom = camera.y + canvas.height / camera.zoom;
        
        // Add some padding to avoid objects appearing/disappearing at edges
        const padding = 100;
        const extendedLeft = viewportLeft - padding;
        const extendedTop = viewportTop - padding;
        const extendedRight = viewportRight + padding;
        const extendedBottom = viewportBottom + padding;
        
        const visibleObjects = this.editor.level.objects.filter(obj => {
            return this.isObjectVisible(obj, extendedLeft, extendedTop, extendedRight, extendedBottom);
        });
        
        // Cache the result
        this.visibleObjectsCache.set(cameraKey, {
            objects: visibleObjects,
            timestamp: currentTime
        });
        
        // Clean old cache entries
        if (this.visibleObjectsCache.size > 10) {
            const oldestKey = this.visibleObjectsCache.keys().next().value;
            this.visibleObjectsCache.delete(oldestKey);
        }
        
        return visibleObjects;
    }

    /**
     * Check if object is visible in the given viewport bounds
     */
    isObjectVisible(obj, left, top, right, bottom) {
        if (!obj.visible) return false;
        
        if (obj.type === 'group') {
            // For groups, check if any child is visible
            return obj.children && obj.children.some(child => 
                this.isObjectVisible(child, left - obj.x, top - obj.y, right - obj.x, bottom - obj.y)
            );
        }
        
        // Check if object bounds intersect with viewport
        const objLeft = obj.x;
        const objTop = obj.y;
        const objRight = obj.x + (obj.width || 0);
        const objBottom = obj.y + (obj.height || 0);
        
        return !(objRight < left || objLeft > right || objBottom < top || objTop > bottom);
    }
}
