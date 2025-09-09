import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

/**
 * Render Operations module for LevelEditor
 * Handles all rendering operations
 */
export class RenderOperations extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        
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
        const showGrid = this.editor.stateManager.get('canvas.showGrid') ?? this.editor.level.settings.showGrid;
        if (showGrid) {
            this.editor.canvasRenderer.drawGrid(
                this.editor.level.settings.gridSize, 
                camera, 
                this.editor.level.settings.backgroundColor
            );
        } else {
            // Just draw background without grid
            this.editor.canvasRenderer.clear();
            this.editor.canvasRenderer.ctx.fillStyle = this.editor.level.settings.backgroundColor;
            this.editor.canvasRenderer.ctx.fillRect(0, 0, this.editor.canvasRenderer.canvas.width, this.editor.canvasRenderer.canvas.height);
        }
        
        // Draw objects with frustum culling
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        const visibleObjects = this.getVisibleObjects(camera);
        visibleObjects.forEach(obj => {
            this.editor.canvasRenderer.drawObject(obj);
        });
        
        // Draw object boundaries if enabled
        const showObjectBoundaries = this.editor.stateManager.get('view.objectBoundaries');
        if (showObjectBoundaries) {
            this.drawObjectBoundaries();
        }
        
        // Draw object collisions if enabled
        const showObjectCollisions = this.editor.stateManager.get('view.objectCollisions');
        if (showObjectCollisions) {
            this.drawObjectCollisions();
        }
        
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
        
        // Draw placing objects (duplicates) BEFORE restoreCamera() (world space)
        const duplicate = this.editor.stateManager.get('duplicate');
        if (duplicate && duplicate.isActive && Array.isArray(duplicate.objects) && duplicate.objects.length > 0) {
            // Log only once per duplicate session
            if (!this._lastRenderState || this._lastRenderState !== 'drawing') {
                Logger.render.debug('Drawing duplicate objects:', duplicate.objects.length);
                Logger.render.debug('Camera position:', { x: camera.x, y: camera.y, zoom: camera.zoom });
                this._lastRenderState = 'drawing';
            }
            this.drawDuplicateObjects(duplicate.objects, camera);
        } else if (duplicate) {
            // Log state change only when it changes
            const currentState = `${duplicate.isActive}_${duplicate.objects?.length || 0}`;
            if (!this._lastRenderState || this._lastRenderState !== currentState) {
                Logger.render.debug('Duplicate state changed:', {
                    isActive: duplicate.isActive,
                    objectsLength: duplicate.objects?.length || 0,
                    objectsType: Array.isArray(duplicate.objects) ? 'array' : typeof duplicate.objects
                });
                this._lastRenderState = currentState;
            }
        }
        
        // Draw marquee
        if (mouse.marqueeRect) {
            this.editor.canvasRenderer.drawMarquee(mouse.marqueeRect, camera);
        }
        
        this.editor.canvasRenderer.restoreCamera();
    }

    /**
     * Draw selection outlines
     */
    drawSelection() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const camera = this.editor.stateManager.get('camera');

        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
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
        if (!this.isInGroupEditMode()) return;

        const camera = this.editor.stateManager.get('camera');
        const group = this.getActiveGroup();
        const groupEditMode = this.getGroupEditMode();

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
     * Draw duplicate objects using standard rendering logic
     */
    drawDuplicateObjects(objects, camera) {
        if (!objects || objects.length === 0) return;

        // Draw objects with transparency
        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.globalAlpha = 0.7;

        // Draw each duplicate object using standard object rendering
        objects.forEach(obj => {
            this.drawDuplicateObject(obj);
        });

        this.editor.canvasRenderer.ctx.restore();

        // Draw selection outlines using direct bounds calculation (duplicates aren't in level tree)
        objects.forEach(obj => {
            const bounds = this.getDuplicateObjectBounds(obj);
            if (bounds) {
                this.drawSelectionRect(bounds, obj.type === 'group', camera);
            }

            // Draw hierarchy highlight for groups
            if (obj.type === 'group') {
                this.drawDuplicateHierarchyHighlight(obj, 0, 0, 0);
            }
        });
    }

    /**
     * Draw hierarchy highlight for duplicate groups (uses direct bounds calculation)
     */
    drawDuplicateHierarchyHighlight(group, depth = 0, parentX = 0, parentY = 0) {
        const camera = this.editor.stateManager.get('camera');
        const baseColor = this.editor.settingsManager?.get('selection.hierarchyHighlightColor') || '#3B82F6';
        const maxAlpha = 0.25; // base alpha
        const decay = 0.6; // alpha decay per depth
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));

        if (!group || !group.children) return;

        const groupAbsX = parentX + group.x;
        const groupAbsY = parentY + group.y;

        // Highlight each nested group
        group.children.forEach(child => {
            if (child.type === 'group') {
                const bounds = this.getDuplicateObjectBounds(child, groupAbsX, groupAbsY);
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

                // Recurse deeper with updated parent coordinates
                this.drawDuplicateHierarchyHighlight(child, depth + 1, groupAbsX, groupAbsY);
            }
        });
    }

    /**
     * Get bounds for duplicate object (direct calculation without level tree search)
     */
    getDuplicateObjectBounds(obj, parentX = 0, parentY = 0) {
        const absX = obj.x + parentX;
        const absY = obj.y + parentY;

        if (obj.type !== 'group') {
            // Simple object - return its direct bounds
            return {
                minX: absX,
                minY: absY,
                maxX: absX + (obj.width || 0),
                maxY: absY + (obj.height || 0)
            };
        }

        // Group object - calculate bounds from all children
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        const walkChildren = (current, baseX, baseY) => {
            const currentAbsX = baseX + current.x;
            const currentAbsY = baseY + current.y;

            if (current.type === 'group' && current.children) {
                // Recursively walk group children
                for (const child of current.children) {
                    walkChildren(child, currentAbsX, currentAbsY);
                }
            } else {
                // Regular object - add to bounds
                bounds.minX = Math.min(bounds.minX, currentAbsX);
                bounds.minY = Math.min(bounds.minY, currentAbsY);
                bounds.maxX = Math.max(bounds.maxX, currentAbsX + (current.width || 0));
                bounds.maxY = Math.max(bounds.maxY, currentAbsY + (current.height || 0));
            }
        };

        // Walk all children
        if (obj.children && obj.children.length > 0) {
            for (const child of obj.children) {
                walkChildren(child, absX, absY);
            }
        }

        // If no valid bounds found (empty group), use group's position
        if (bounds.minX === Infinity) {
            bounds.minX = absX;
            bounds.minY = absY;
            bounds.maxX = absX;
            bounds.maxY = absY;
        }

        return bounds;
    }

    /**
     * Draw single duplicate object recursively
     */
    drawDuplicateObject(obj, parentX = 0, parentY = 0) {
        const absX = obj.x + parentX;
        const absY = obj.y + parentY;

        if (obj.type === 'group') {
            // Draw group children
            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => {
                    this.drawDuplicateObject(child, absX, absY);
                });
            }
        } else {
            // Use standard object drawing method
            this.editor.canvasRenderer.drawObject({
                ...obj,
                x: absX,
                y: absY
            });
        }
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

    /**
     * Draw object boundaries for debugging
     */
    drawObjectBoundaries() {
        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        this.editor.canvasRenderer.ctx.lineWidth = 1;
        this.editor.canvasRenderer.ctx.setLineDash([2, 2]);
        
        // Only draw boundaries for top-level objects
        this.editor.level.objects.forEach(obj => {
            if (obj.type === 'group') {
                this.drawGroupBoundaries(obj);
            } else {
                this.drawSingleObjectBoundary(obj);
            }
        });
        
        this.editor.canvasRenderer.ctx.restore();
    }

    /**
     * Draw boundaries for a single object
     */
    drawSingleObjectBoundary(obj) {
        const worldPos = this.editor.objectOperations.getObjectWorldPosition(obj);
        const width = obj.width || 32;
        const height = obj.height || 32;
        
        this.editor.canvasRenderer.ctx.strokeRect(
            worldPos.x, 
            worldPos.y, 
            width, 
            height
        );
    }

    /**
     * Draw boundaries for a group and its children
     */
    drawGroupBoundaries(group) {
        // Get correct bounds for the entire group (same as selection bounds)
        const bounds = this.editor.objectOperations.getObjectWorldBounds(group);
        const camera = this.editor.stateManager.get('camera');

        // Draw group boundary using the same logic as selection
        this.editor.canvasRenderer.ctx.strokeRect(
            bounds.minX - camera.x,
            bounds.minY - camera.y,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );

        // Draw children boundaries
        if (group.children) {
            group.children.forEach(child => {
                if (child.type === 'group') {
                    this.drawGroupBoundaries(child);
                } else {
                    this.drawSingleObjectBoundary(child);
                }
            });
        }
    }

    /**
     * Draw object collision boxes for debugging
     */
    drawObjectCollisions() {
        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        this.editor.canvasRenderer.ctx.lineWidth = 2;
        this.editor.canvasRenderer.ctx.setLineDash([]);
        
        // Only draw collisions for top-level objects
        this.editor.level.objects.forEach(obj => {
            if (obj.type === 'group') {
                this.drawGroupCollisions(obj);
            } else {
                this.drawSingleObjectCollision(obj);
            }
        });
        
        this.editor.canvasRenderer.ctx.restore();
    }

    /**
     * Draw collision box for a single object
     */
    drawSingleObjectCollision(obj) {
        const worldPos = this.editor.objectOperations.getObjectWorldPosition(obj);
        const width = obj.width || 32;
        const height = obj.height || 32;
        
        // Draw collision box (same as boundary for now, but could be different)
        this.editor.canvasRenderer.ctx.strokeRect(
            worldPos.x, 
            worldPos.y, 
            width, 
            height
        );
        
        // Draw collision center point
        this.editor.canvasRenderer.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        this.editor.canvasRenderer.ctx.fillRect(
            worldPos.x + width/2 - 2, 
            worldPos.y + height/2 - 2, 
            4, 
            4
        );
    }

    /**
     * Draw collision boxes for a group and its children
     */
    drawGroupCollisions(group) {
        // Draw group collision
        this.drawSingleObjectCollision(group);
        
        // Draw children collisions
        if (group.children) {
            group.children.forEach(child => {
                if (child.type === 'group') {
                    this.drawGroupCollisions(child);
                } else {
                    this.drawSingleObjectCollision(child);
                }
            });
        }
    }
}
