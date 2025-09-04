/**
 * Render Operations module for LevelEditor
 * Handles all rendering operations
 */
export class RenderOperations {
    constructor(levelEditor) {
        this.editor = levelEditor;
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
        
        // Draw objects
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        this.editor.level.objects.forEach(obj => {
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
        
        // Draw placing objects (duplicates)
        const duplicate = this.editor.stateManager.get('duplicate');
        if (duplicate.isActive && duplicate.objects.length > 0) {
            console.log('RENDER: Drawing duplicate objects, count:', duplicate.objects.length);
            this.editor.duplicateRenderUtils.drawPlacingObjects(this.editor.canvasRenderer, duplicate.objects, camera);
            // Draw outline for groups in placing preview
            duplicate.objects.forEach(obj => {
                if (obj.type === 'group') {
                    const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
                    this.drawSelectionRect(bounds, true, camera);
                }
            });
        } else {
            console.log('RENDER: Not drawing duplicate objects, isActive:', duplicate.isActive, 'count:', duplicate.objects?.length || 0);
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
}
