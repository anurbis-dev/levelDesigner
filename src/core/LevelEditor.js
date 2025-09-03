import { StateManager } from '../managers/StateManager.js';
import { HistoryManager } from '../managers/HistoryManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { FileManager } from '../managers/FileManager.js';
import { SettingsManager } from '../managers/SettingsManager.js';
import { CanvasRenderer } from '../ui/CanvasRenderer.js';
import { AssetPanel } from '../ui/AssetPanel.js';
import { DetailsPanel } from '../ui/DetailsPanel.js';
import { OutlinerPanel } from '../ui/OutlinerPanel.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { Level } from '../models/Level.js';

/**
 * Main Level Editor class
 */
export class LevelEditor {
    constructor() {
        // Initialize managers
        this.stateManager = new StateManager();
        this.historyManager = new HistoryManager();
        this.assetManager = new AssetManager();
        this.fileManager = new FileManager();
        this.settingsManager = new SettingsManager();
        
        // Initialize UI components
        this.canvasRenderer = null;
        this.assetPanel = null;
        this.detailsPanel = null;
        this.outlinerPanel = null;
        this.settingsPanel = null;
        
        // Current level
        this.level = null;
        
        // Event handlers
        this.eventHandlers = new Map();
    }

    /**
     * Initialize the editor
     */
    async init() {
        // Get DOM elements
        const canvas = document.getElementById('main-canvas');
        const assetsPanel = document.getElementById('assets-panel');
        const detailsPanel = document.getElementById('details-content-panel');
        const outlinerPanel = document.getElementById('outliner-content-panel');
        
        if (!canvas || !assetsPanel || !detailsPanel || !outlinerPanel) {
            throw new Error('Required DOM elements not found');
        }
        
        // Initialize renderer
        this.canvasRenderer = new CanvasRenderer(canvas);
        this.canvasRenderer.resizeCanvas();
        
        // Initialize UI panels
        this.assetPanel = new AssetPanel(assetsPanel, this.assetManager, this.stateManager);
        this.detailsPanel = new DetailsPanel(detailsPanel, this.stateManager, this);
        this.outlinerPanel = new OutlinerPanel(outlinerPanel, this.stateManager, this);
        this.settingsPanel = new SettingsPanel(document.body, this.settingsManager);
        
        // Initial render of asset panel
        this.assetPanel.render();
        
        // Create new level
        this.level = this.fileManager.createNewLevel();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Preload assets
        await this.assetManager.preloadImages();
        
        // Initial render
        this.render();
        this.updateAllPanels();
        
        // Save initial state
        this.historyManager.saveState(this.level.objects, true);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.canvasRenderer.resizeCanvas();
            this.render();
        });
        
        // Canvas events
        this.setupCanvasEvents();
        
        // Keyboard events
        this.setupKeyboardEvents();
        
        // Initialize group edit mode state
        this.stateManager.set('groupEditMode', {
            isActive: false,
            groupId: null,
            group: null,
            openGroups: [] // Initialize openGroups
        });
        
        // Menu events
        this.setupMenuEvents();
        
        // Right panel tabs
        this.setupRightPanelTabs();
        
        // State change listeners
        this.setupStateListeners();
    }

    setupCanvasEvents() {
        const canvas = this.canvasRenderer.canvas;
        
        // Prevent context menu
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Mouse events on canvas
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        
        // Global mouse events for proper marquee handling
        window.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleGlobalMouseUp(e));
        
        // Drag and drop
        canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
        canvas.addEventListener('drop', (e) => this.handleDrop(e));
    }

         setupKeyboardEvents() {
         window.addEventListener('keydown', (e) => {
             if (document.activeElement.tagName === 'INPUT') return;
             
             // Handle escape key to cancel placing objects
             if (e.key === 'Escape') {
                 this.cancelPlacingObjects();
                 return;
             }
             
             if (e.key === 'Delete' || e.key.toLowerCase() === 'x') {
                 this.deleteSelectedObjects();
             } else if (e.shiftKey && e.key.toLowerCase() === 'd') {
                 e.preventDefault();
                 this.duplicateSelectedObjects();
             } else if (e.key.toLowerCase() === 'f') {
                 this.focusOnSelection();
             } else if (e.key.toLowerCase() === 'a') {
                 this.focusOnAll();
             } else if (e.shiftKey && e.key.toLowerCase() === 'g') {
                 e.preventDefault();
                 this.groupSelectedObjects();
             } else if (e.altKey && e.key.toLowerCase() === 'g') {
                 e.preventDefault();
                 this.ungroupSelectedObjects();
             } else if (e.ctrlKey || e.metaKey) {
                 if (e.key.toLowerCase() === 'z') {
                     e.preventDefault();
                     e.shiftKey ? this.redo() : this.undo();
                 } else if (e.key.toLowerCase() === 'y') {
                     e.preventDefault();
                     this.redo();
                 }
             }
         });
     }

    setupMenuEvents() {
        // Level menu
        document.getElementById('new-level')?.addEventListener('click', () => this.newLevel());
        document.getElementById('open-level')?.addEventListener('click', () => this.openLevel());
        document.getElementById('save-level')?.addEventListener('click', () => this.saveLevel());
        document.getElementById('save-level-as')?.addEventListener('click', () => this.saveLevelAs());
        
        // Settings menu
        document.getElementById('assets-path')?.addEventListener('click', () => this.openAssetsPath());
        document.getElementById('editor-settings')?.addEventListener('click', () => this.openSettings());
    }

    setupRightPanelTabs() {
        const tabs = document.querySelectorAll('.tab-right');
        const contents = document.querySelectorAll('.tab-content-right');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabName = tab.dataset.tab;
                this.stateManager.set('rightPanelTab', tabName);
                
                contents.forEach(content => {
                    content.classList.toggle('hidden', content.id !== `${tabName}-content-panel`);
                });
            });
        });
    }

    setupStateListeners() {
        // Subscribe to selection changes
        this.stateManager.subscribe('selectedObjects', () => {
            this.updateAllPanels();
            this.render();
        });
        
        // Subscribe to camera changes
        this.stateManager.subscribe('camera', () => {
            this.render();
        });
    }

    /**
     * Render the canvas
     */
    render() {
        if (!this.level) return;
        
        const camera = this.stateManager.get('camera');
        const mouse = this.stateManager.get('mouse');
        
        this.canvasRenderer.clear();
        this.canvasRenderer.setCamera(camera);
        
        // Draw background and grid
        this.canvasRenderer.drawGrid(
            this.level.settings.gridSize, 
            camera, 
            this.level.settings.backgroundColor
        );
        
        // Draw objects
        const groupEditMode = this.stateManager.get('groupEditMode');
        this.level.objects.forEach(obj => {
            this.canvasRenderer.drawObject(obj);
        });
        
        // Draw selection
        this.drawSelection();

        // If a single group is selected, highlight its nested groups with fading
        const selected = this.stateManager.get('selectedObjects');
        if (selected && selected.size === 1) {
            const selId = Array.from(selected)[0];
            const selObj = this.level.findObjectById(selId);
            if (selObj && selObj.type === 'group') {
                this.drawHierarchyHighlightForGroup(selObj, 0);
            }
        }

        // Draw group edit mode frame
        this.drawGroupEditFrame();
        
        // Draw placing objects
        if (mouse.isPlacingObjects && mouse.placingObjects.length > 0) {
            this.canvasRenderer.drawPlacingObjects(mouse.placingObjects, camera);
            // Draw outline for groups in placing preview
            mouse.placingObjects.forEach(obj => {
                if (obj.type === 'group') {
                    const bounds = this.getObjectWorldBounds(obj);
                    this.drawSelectionRect(bounds, true, camera);
                }
            });
        }
        
        // Draw marquee
        if (mouse.marqueeRect) {
            this.canvasRenderer.drawMarquee(mouse.marqueeRect, camera);
        }
        
        this.canvasRenderer.restoreCamera();
    }

    /**
     * Draw selection outlines
     */
         drawSelection() {
         const selectedObjects = this.stateManager.get('selectedObjects');
         const camera = this.stateManager.get('camera');
         const groupEditMode = this.stateManager.get('groupEditMode');

         if (groupEditMode.isActive) {
             // In group edit mode, draw selection for all objects including nested ones
             this.level.getAllObjects().forEach(obj => {
                 if (selectedObjects.has(obj.id)) {
                     const bounds = this.getObjectWorldBounds(obj);
                     const mouse = this.stateManager.get('mouse');
                     
                     // Special visual feedback for Alt+drag in group edit mode
                     if (mouse.altKey && mouse.isDragging && this.isObjectInGroup(obj, groupEditMode.group)) {
                         this.drawAltDragSelectionRect(bounds, camera);
                     } else {
                         this.drawSelectionRect(bounds, obj.type === 'group', camera);
                     }
                 }
             });
         } else {
             // Normal mode - draw selection for top-level objects only
             this.level.objects.forEach(obj => {
                 if (selectedObjects.has(obj.id)) {
                     const bounds = this.getObjectWorldBounds(obj);
                     this.drawSelectionRect(bounds, obj.type === 'group', camera);
                 }
             });
         }
     }

    drawSelectionRect(bounds, isGroup, camera) {
        const selectionColor = this.settingsManager?.get('selection.outlineColor') || '#3B82F6';
        const outlineWidth = (isGroup
            ? (this.settingsManager?.get('selection.groupOutlineWidth') || 4)
            : (this.settingsManager?.get('selection.outlineWidth') || 2)) / camera.zoom;

        this.canvasRenderer.ctx.save();
        this.canvasRenderer.ctx.strokeStyle = selectionColor;
        this.canvasRenderer.ctx.lineWidth = outlineWidth;
        this.canvasRenderer.ctx.setLineDash(isGroup ? [5, 5] : []);

        this.canvasRenderer.ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        this.canvasRenderer.ctx.restore();
    }

    drawAltDragSelectionRect(bounds, camera) {
        const altDragColor = '#FF6B6B'; // Red color to indicate Alt+drag
        const outlineWidth = 3 / camera.zoom;

        this.canvasRenderer.ctx.save();
        this.canvasRenderer.ctx.strokeStyle = altDragColor;
        this.canvasRenderer.ctx.lineWidth = outlineWidth;
        this.canvasRenderer.ctx.setLineDash([8, 4]); // Dashed line to indicate special mode

        this.canvasRenderer.ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        this.canvasRenderer.ctx.restore();
    }

         /**
      * Draw group edit mode frame
      */
     drawGroupEditFrame() {
         const groupEditMode = this.stateManager.get('groupEditMode');
         if (!groupEditMode.isActive || !groupEditMode.group) return;

         const camera = this.stateManager.get('camera');
         const group = groupEditMode.group;

         // Draw frame around the group being edited; allow freezing during Alt-drag
         const bounds = (groupEditMode.frameFrozen && groupEditMode.frozenBounds)
             ? groupEditMode.frozenBounds
             : this.getObjectWorldBounds(group);

         // Add padding to show the group boundary clearly
         const padding = 10;
         const minX = bounds.minX - padding;
         const minY = bounds.minY - padding;
         const maxX = bounds.maxX + padding;
         const maxY = bounds.maxY + padding;

         this.canvasRenderer.ctx.save();
         this.canvasRenderer.ctx.strokeStyle = '#FF6B6B';
         this.canvasRenderer.ctx.lineWidth = 3 / camera.zoom;
         this.canvasRenderer.ctx.setLineDash([10, 5]);
         this.canvasRenderer.ctx.strokeRect(
             minX,
             minY,
             maxX - minX,
             maxY - minY
         );
         this.canvasRenderer.ctx.restore();
     }

    /**
     * Update all panels
     */
    updateAllPanels() {
        this.detailsPanel.render();
        this.outlinerPanel.render();
        this.updateLevelStatsPanel();
    }

    updateLevelStatsPanel() {
        const levelStatsContent = document.getElementById('level-stats-content');
        if (!levelStatsContent) return;
        
        const stats = this.level.getStats();
        levelStatsContent.innerHTML = `
            <p class="text-sm">Total Objects: ${stats.totalObjects}</p>
            <p class="text-sm">Groups: ${stats.groups}</p>
            <div class="mt-2">
                <p class="text-sm font-medium">By Type:</p>
                ${Object.entries(stats.byType).map(([type, count]) => 
                    `<p class="text-sm ml-2">${type}: ${count}</p>`
                ).join('')}
            </div>
        `;
    }

    /**
     * Mouse event handlers
     */
    handleMouseDown(e) {
        const worldPos = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.stateManager.get('camera'));
        const mouse = this.stateManager.get('mouse');
        
        if (e.button === 2) { // Right mouse button
            this.stateManager.update({
                'mouse.isRightDown': true,
                'mouse.lastX': e.clientX,
                'mouse.lastY': e.clientY,
                'mouse.altKey': e.altKey
            });
            this.canvasRenderer.canvas.style.cursor = 'grabbing';
            return;
        }
        
        if (e.button === 0) { // Left mouse button
            this.stateManager.update({
                'mouse.isLeftDown': true,
                'mouse.altKey': e.altKey
            });
            
            // Check if clicking on object
            const clickedObject = this.findObjectAtPoint(worldPos.x, worldPos.y);
            
            if (clickedObject) {
                this.handleObjectClick(e, clickedObject, worldPos);
            } else {
                this.handleEmptyClick(e, worldPos);
            }
        }
    }

    handleMouseMove(e) {
        const worldPos = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.stateManager.get('camera'));
        const mouse = this.stateManager.get('mouse');
        
        this.stateManager.update({
            'mouse.x': e.clientX,
            'mouse.y': e.clientY,
            'mouse.worldX': worldPos.x,
            'mouse.worldY': worldPos.y,
            'mouse.altKey': e.altKey
        });
        
        if (mouse.isRightDown) {
            // Pan camera
            const dx = e.clientX - mouse.lastX;
            const dy = e.clientY - mouse.lastY;
            const camera = this.stateManager.get('camera');
            
            this.stateManager.update({
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
        }

        // Freeze group frame while Alt is pressed (for dragging objects out)
        const groupEditMode = this.stateManager.get('groupEditMode');
        if (groupEditMode.isActive) {
            if (e.altKey) {
                if (!groupEditMode.frameFrozen) {
                    this.stateManager.set('groupEditMode', {
                        ...groupEditMode,
                        frameFrozen: true,
                        frozenBounds: this.getObjectWorldBounds(groupEditMode.group)
                    });
                }
            } else if (groupEditMode.frameFrozen) {
                this.stateManager.set('groupEditMode', {
                    ...groupEditMode,
                    frameFrozen: false,
                    frozenBounds: null
                });
            }
        }

        // Only render if something actually changed
        if (mouse.isPlacingObjects || mouse.isRightDown || (mouse.isLeftDown && mouse.isDragging) || mouse.isMarqueeSelecting) {
            this.render();
        }
    }

    handleMouseUp(e) {
        const mouse = this.stateManager.get('mouse');
        
        if (e.button === 2) {
            this.stateManager.update({
                'mouse.isRightDown': false,
                'mouse.altKey': e.altKey
            });
            this.canvasRenderer.canvas.style.cursor = 'default';
            
            // Right click cancels placing objects
            if (mouse.isPlacingObjects) {
                this.cancelPlacingObjects();
            }
        }
        
        if (e.button === 0) {
            const currentAlt = e.altKey || mouse.altKey;
            const wasDragging = mouse.isDragging; // Save dragging state before resetting
            
            if (mouse.isDragging) {
                this.historyManager.saveState(this.level.objects);
                this.stateManager.markDirty();
            }
            
            this.stateManager.update({
                'mouse.isLeftDown': false,
                'mouse.isDragging': false,
                'mouse.altKey': e.altKey
            });
            
            if (mouse.isMarqueeSelecting) {
                this.finishMarqueeSelection();
            }

            // If we are in group edit mode and released after dragging with Alt
            const groupEditMode = this.stateManager.get('groupEditMode');
            if (groupEditMode.isActive && groupEditMode.group && currentAlt && wasDragging) {
                console.log('Alt+drag detected in group edit mode');
                const selectedIds = this.stateManager.get('selectedObjects');
                
                // ИЗМЕНЕНИЕ: Вычисляем границы группы, ИСКЛЮЧАЯ перетаскиваемые объекты.
                const bounds = this.getObjectWorldBounds(groupEditMode.group, Array.from(selectedIds));
                console.log('Group bounds (excluding dragged objects):', bounds);
                
                const selected = Array.from(selectedIds)
                    .map(id => this.level.findObjectById(id))
                    .filter(Boolean);
                console.log('Selected objects:', selected.length);
                selected.forEach(obj => {
                    // Only consider direct children of the edited group
                    const isChild = this.isObjectInGroup(obj, groupEditMode.group);
                    console.log(`Object ${obj.id} is child:`, isChild);
                    if (isChild) {
                        // Get current world position and bounds of the object
                        const groupPos = this.getObjectWorldPosition(groupEditMode.group);
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
                        
                        console.log(`Object bounds:`, objBounds);
                        console.log(`Group bounds:`, bounds);
                        
                        // Check if object bounds intersect with group bounds
                        const hasIntersection = objBounds.minX < bounds.maxX && 
                                              objBounds.maxX > bounds.minX && 
                                              objBounds.minY < bounds.maxY && 
                                              objBounds.maxY > bounds.minY;
                        
                        const outside = !hasIntersection;
                        console.log(`Object intersects with group:`, hasIntersection);
                        console.log(`Object should be moved out:`, outside);
                        if (outside) {
                            console.log(`Moving object ${obj.id} out of group`);
                            // Remove from group's children
                            groupEditMode.group.children = groupEditMode.group.children.filter(c => c.id !== obj.id);
                            // Add to main level at world coordinates
                            obj.x = worldX;
                            obj.y = worldY;
                            this.level.objects.push(obj);
                        }
                    }
                });
            }
            
            if (mouse.isPlacingObjects) {
                const worldPos = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.stateManager.get('camera'));
                this.finishPlacingObjects(worldPos);
            }
        }
    }

    handleGlobalMouseMove(e) {
        const mouse = this.stateManager.get('mouse');
        const canvas = this.canvasRenderer.canvas;
        const rect = canvas.getBoundingClientRect();
        
        // Check if mouse is inside canvas bounds
        const isInsideCanvas = e.clientX >= rect.left && e.clientX <= rect.right && 
                              e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (mouse.isMarqueeSelecting && !isInsideCanvas) {
            // Constrain marquee to canvas bounds
            const constrainedX = Math.max(rect.left, Math.min(rect.right, e.clientX));
            const constrainedY = Math.max(rect.top, Math.min(rect.bottom, e.clientY));
            
            const worldPos = this.canvasRenderer.screenToWorld(constrainedX, constrainedY, this.stateManager.get('camera'));
            this.updateMarquee(worldPos);
            this.render();
        }
    }

         /**
      * Finish placing objects (duplication)
      */
     finishPlacingObjects(worldPos) {
         const mouse = this.stateManager.get('mouse');

         if (!mouse.placingObjects || mouse.placingObjects.length === 0) return;

         this.historyManager.saveState(this.level.objects);

         const groupEditMode = this.stateManager.get('groupEditMode');
         const newIds = new Set();

         mouse.placingObjects.forEach((obj, index) => {
             const offsetX = (index % 5) * 20; // Arrange in a grid
             const offsetY = Math.floor(index / 5) * 20;
             const newObj = this.deepClone(obj);
             this.reassignIdsDeep(newObj);
             newObj.x = worldPos.x + offsetX;
             newObj.y = worldPos.y + offsetY;

             // Check if we're in group edit mode and the placement point is inside the group bounds
             if (groupEditMode.isActive && groupEditMode.group && this.isPointInGroupBounds(newObj.x, newObj.y, groupEditMode)) {
                 // Convert to relative coordinates using group's WORLD position
                 const groupPos = this.getObjectWorldPosition(groupEditMode.group);
                 newObj.x -= groupPos.x;
                 newObj.y -= groupPos.y;
                 groupEditMode.group.children.push(newObj);
             } else {
                 // Add to main level with world coordinates
                 this.level.addObject(newObj);
             }

             newIds.add(newObj.id);
         });

         this.stateManager.set('selectedObjects', newIds);
         this.stateManager.update({
             'mouse.isPlacingObjects': false,
             'mouse.placingObjects': []
         });

                  this.updateAllPanels();
         this.render();
     }

     /**
      * Cancel placing objects (duplication)
      */
     cancelPlacingObjects() {
         const mouse = this.stateManager.get('mouse');
         
         if (mouse.isPlacingObjects) {
             this.stateManager.update({
                 'mouse.isPlacingObjects': false,
                 'mouse.placingObjects': []
             });
             this.render();
         }
     }

     handleGlobalMouseUp(e) {
        const mouse = this.stateManager.get('mouse');
        
        if (e.button === 0 && mouse.isMarqueeSelecting) {
            this.finishMarqueeSelection();
        }
        
        if (e.button === 2) {
            this.stateManager.update({
                'mouse.isRightDown': false
            });
            this.canvasRenderer.canvas.style.cursor = 'default';
        }
    }

    handleWheel(e) {
        e.preventDefault();
        
        const zoomIntensity = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        const camera = this.stateManager.get('camera');
        
        const oldZoom = camera.zoom;
        const newZoom = Math.max(0.1, Math.min(10, oldZoom * (1 + direction * zoomIntensity)));
        
        const mouseWorldPosBeforeZoom = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, camera);
        
        this.stateManager.update({
            'camera.zoom': newZoom
        });
        
        const mouseWorldPosAfterZoom = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.stateManager.get('camera'));
        
        this.stateManager.update({
            'camera.x': camera.x + mouseWorldPosBeforeZoom.x - mouseWorldPosAfterZoom.x,
            'camera.y': camera.y + mouseWorldPosBeforeZoom.y - mouseWorldPosAfterZoom.y
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

         handleDrop(e) {
         e.preventDefault();
         
         const mouse = this.stateManager.get('mouse');
         if (!mouse.isDraggingAsset) return;
         
         this.historyManager.saveState(this.level.objects);
         
         const droppedAssetIds = JSON.parse(e.dataTransfer.getData('application/json'));
         const worldPos = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.stateManager.get('camera'));
         
         const groupEditMode = this.stateManager.get('groupEditMode');
         const newIds = new Set();

         droppedAssetIds.forEach((assetId, index) => {
             const asset = this.assetManager.getAsset(assetId);
             if (asset) {
                 const newObject = asset.createInstance(worldPos.x + index * 10, worldPos.y + index * 10);

                 // Check if we're in group edit mode and the drop point is inside the group bounds
                 if (groupEditMode.isActive && groupEditMode.group && this.isPointInGroupBounds(worldPos.x, worldPos.y, groupEditMode)) {
                     // Convert to relative coordinates using group's WORLD position
                     const groupPos = this.getObjectWorldPosition(groupEditMode.group);
                     newObject.x -= groupPos.x;
                     newObject.y -= groupPos.y;
                     groupEditMode.group.children.push(newObject);
                 } else {
                     // Add to main level
                     this.level.addObject(newObject);
                 }

                 newIds.add(newObject.id);
             }
         });
         
         this.stateManager.set('selectedObjects', newIds);
         this.stateManager.update({
             'mouse.isDraggingAsset': false
         });
         
         this.updateAllPanels();
         this.render();
     }

    /**
     * Object manipulation methods
     */
                findObjectAtPoint(x, y) {
         const groupEditMode = this.stateManager.get('groupEditMode');

         // In group edit mode, search through all objects including nested ones
         if (groupEditMode.isActive) {
            const openGroups = Array.isArray(groupEditMode.openGroups) ? groupEditMode.openGroups : [groupEditMode.group].filter(Boolean);
            const openIds = new Set(openGroups.map(g => g.id));
            const selectable = this.computeSelectableSet();

            // 1) Groups first (excluding ALL open groups)
            const allGroups = this.level.getAllObjects().filter(o => o.type === 'group' && !openIds.has(o.id) && selectable.has(o.id));
            for (const grp of [...allGroups].reverse()) {
                if (this.isPointInObject(x, y, grp)) return grp;
            }
            
            // 2) External objects (not in any open group)
            const externalObjects = this.level.objects.filter(o => o.type !== 'group' && selectable.has(o.id));
            for (const obj of [...externalObjects].reverse()) {
                if (this.isPointInObject(x, y, obj)) return obj;
            }
            
            // 3) Then descendants of the deepest open group
            const activeGroup = openGroups.length > 0 ? openGroups[openGroups.length - 1] : null;
            if (activeGroup) {
                const collect = (g) => {
                    const res = [];
                    g.children.forEach(ch => {
                        res.push(ch);
                        if (ch.type === 'group') res.push(...collect(ch));
                    });
                    return res;
                };
                const descendants = collect(activeGroup).filter(o => selectable.has(o.id));
                for (const obj of [...descendants].reverse()) {
                    if (this.isPointInObject(x, y, obj)) return obj;
                }
            }
            return null;
        }

        // Normal mode - hit-test groups first (highest priority) among top-level
        const selectable = this.computeSelectableSet();
        const topLevelGroups = this.level.objects.filter(o => o.type === 'group' && selectable.has(o.id));
        for (const grp of [...topLevelGroups].reverse()) {
            if (this.isPointInObject(x, y, grp)) return grp;
        }

        // Then hit-test top-level non-group objects
        const topLevelObjects = this.level.objects.filter(o => o.type !== 'group' && selectable.has(o.id));
        for (const obj of [...topLevelObjects].reverse()) {
            if (this.isPointInObject(x, y, obj)) {
                return obj;
            }
        }

        return null;
     }

         isPointInObject(x, y, obj) {
         const bounds = this.getObjectWorldBounds(obj);
         return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
     }

         isPointInGroupBounds(x, y, groupEditMode) {
        if (!groupEditMode.isActive || !groupEditMode.group) return false;

        const group = groupEditMode.group;
        const bounds = this.getObjectWorldBounds(group);

        // Add some padding to make it easier to drop inside (same as visual frame)
        const padding = 10;
        return x >= bounds.minX - padding && x <= bounds.maxX + padding &&
               y >= bounds.minY - padding && y <= bounds.maxY + padding;
    }

    getObjectCenterWorld(obj, parentGroup = null) {
        // If parentGroup provided, obj.x/obj.y are relative to that group
        if (parentGroup) {
            const parentPos = this.getObjectWorldPosition(parentGroup);
            return {
                x: parentPos.x + obj.x + (obj.width || 0) / 2,
                y: parentPos.y + obj.y + (obj.height || 0) / 2
            };
        }
        // Otherwise, walk from top-level
        const pos = this.getObjectWorldPosition(obj);
        return {
            x: pos.x + (obj.width || 0) / 2,
            y: pos.y + (obj.height || 0) / 2
        };
    }

    getObjectWorldPosition(target) {
        let result = null;
        const dfs = (current, accX, accY) => {
            if (current.id === target.id) {
                result = { x: accX + current.x, y: accY + current.y };
                return true;
            }
            if (current.type === 'group') {
                const nextX = accX + current.x;
                const nextY = accY + current.y;
                for (const child of current.children) {
                    if (dfs(child, nextX, nextY)) return true;
                }
            }
            return false;
        };
        for (const top of this.level.objects) {
            if (dfs(top, 0, 0)) break;
        }
        return result || { x: target.x, y: target.y };
    }

    isObjectInGroup(obj, group) {
        return group.children.some(child => child.id === obj.id);
    }

    handleObjectClick(e, obj, worldPos) {
        const selectedObjects = new Set(this.stateManager.get('selectedObjects'));
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
            this.stateManager.set('selectedObjects', selectedObjects);
            this.updateAllPanels();
        }
        
        // Only start dragging if the clicked object is selected
        if (selectedObjects.has(obj.id)) {
            this.stateManager.update({
                'mouse.isDragging': true,
                'mouse.dragStartX': worldPos.x,
                'mouse.dragStartY': worldPos.y
            });
        }
    }

    handleEmptyClick(e, worldPos) {
        const selectedObjects = this.stateManager.get('selectedObjects');
        const groupEditMode = this.stateManager.get('groupEditMode');

        // If editing groups, only close when clicking OUTSIDE the active group's frame
        if (groupEditMode.isActive && groupEditMode.group) {
            const bounds = this.getObjectWorldBounds(groupEditMode.group);
            const inside = worldPos.x >= bounds.minX && worldPos.x <= bounds.maxX && worldPos.y >= bounds.minY && worldPos.y <= bounds.maxY;
            if (inside) {
                // Start marquee selection instead of closing
                if (!e.shiftKey) {
                    this.stateManager.set('selectedObjects', new Set());
                }
                this.stateManager.update({
                    'mouse.isMarqueeSelecting': true,
                    'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
                    'mouse.marqueeStartX': worldPos.x,
                    'mouse.marqueeStartY': worldPos.y
                });
                return;
            }
            // Outside: close group edit mode
            this.closeGroupEditMode();
            return;
        }

        // Normal behavior
        if (!e.shiftKey) {
            this.stateManager.set('selectedObjects', new Set());
        }
        this.stateManager.update({
            'mouse.isMarqueeSelecting': true,
            'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
            'mouse.marqueeStartX': worldPos.x,
            'mouse.marqueeStartY': worldPos.y
        });
    }

                 dragSelectedObjects(worldPos) {
        const selectedObjects = this.stateManager.get('selectedObjects');
        const mouse = this.stateManager.get('mouse');
        const groupEditMode = this.stateManager.get('groupEditMode');

        const dx = worldPos.x - mouse.dragStartX;
        const dy = worldPos.y - mouse.dragStartY;

        selectedObjects.forEach(id => {
            const obj = this.level.findObjectById(id);
            if (obj) {
                // Check if object is on main level or inside the currently edited group
                const isOnMainLevel = this.level.objects.some(topObj => topObj.id === obj.id);
                const isInEditedGroup = groupEditMode.isActive && groupEditMode.group &&
                    this.isObjectInGroup(obj, groupEditMode.group);

                if (isOnMainLevel) {
                    // Object is on main level - move it normally
                    obj.x += dx;
                    obj.y += dy;

                    // If dragged into edited group bounds, move under the group with relative coordinates
                    if (!this.stateManager.get('mouse').altKey && groupEditMode.isActive && groupEditMode.group && this.isPointInGroupBounds(obj.x, obj.y, groupEditMode)) {
                        // Convert world -> relative to group's world position
                        const groupPos = this.getObjectWorldPosition(groupEditMode.group);
                        obj.x -= groupPos.x;
                        obj.y -= groupPos.y;

                        // Remove from main level and append into group
                        this.level.objects = this.level.objects.filter(top => top.id !== obj.id);
                        groupEditMode.group.children.push(obj);
                    }
                } else if (isInEditedGroup) {
                    // Object is inside the currently edited group
                    if (this.stateManager.get('mouse').altKey) {
                        // Alt+drag: move in world coordinates by converting to world position first
                        const groupPos = this.getObjectWorldPosition(groupEditMode.group);
                        const worldX = groupPos.x + obj.x;
                        const worldY = groupPos.y + obj.y;
                        
                        // Move in world coordinates
                        const newWorldX = worldX + dx;
                        const newWorldY = worldY + dy;
                        
                        // Convert back to relative coordinates
                        obj.x = newWorldX - groupPos.x;
                        obj.y = newWorldY - groupPos.y;
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

        this.stateManager.update({
            'mouse.dragStartX': worldPos.x,
            'mouse.dragStartY': worldPos.y
        });

        this.updateAllPanels();
    }

    updateMarquee(worldPos) {
        const mouse = this.stateManager.get('mouse');
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
        const mouse = this.stateManager.get('mouse');
        if (!mouse.marqueeRect) return;

        const marquee = mouse.marqueeRect;
        const selectedObjects = new Set(this.stateManager.get('selectedObjects'));
        const groupEditMode = this.stateManager.get('groupEditMode');

        if (groupEditMode.isActive) {
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
                const bounds = this.getObjectWorldBounds(obj);
                if (marquee.x < bounds.maxX && marquee.x + marquee.width > bounds.minX &&
                    marquee.y < bounds.maxY && marquee.y + marquee.height > bounds.minY) {
                    selectedObjects.add(obj.id);
                }
            });
        } else {
            // Normal mode - select objects on main level only
            this.level.objects.forEach(obj => {
                const bounds = this.getObjectWorldBounds(obj);
                if (marquee.x < bounds.maxX && marquee.x + marquee.width > bounds.minX &&
                    marquee.y < bounds.maxY && marquee.y + marquee.height > bounds.minY) {
                    selectedObjects.add(obj.id);
                }
            });
        }

        this.stateManager.set('selectedObjects', selectedObjects);
        this.stateManager.update({
            'mouse.marqueeRect': null,
            'mouse.marqueeStartX': null,
            'mouse.marqueeStartY': null
        });
    }

    /**
     * Object operations
     */
    deleteSelectedObjects() {
        const selectedObjects = this.stateManager.get('selectedObjects');
        if (selectedObjects.size === 0) return;

        this.historyManager.saveState(this.level.objects);

        // Delete selected objects - they can be on main level or inside groups
        const idsToDelete = new Set(selectedObjects);

        // Remove from main level
        this.level.objects = this.level.objects.filter(obj => !idsToDelete.has(obj.id));

        // Remove from all groups recursively
        const removeFromGroups = (objects) => {
            for (const obj of objects) {
                if (obj.type === 'group') {
                    obj.children = obj.children.filter(child => !idsToDelete.has(child.id));
                    removeFromGroups(obj.children);
                }
            }
        };
        removeFromGroups(this.level.objects);

        this.stateManager.set('selectedObjects', new Set());
        this.updateAllPanels();
        this.render();
    }

    duplicateSelectedObjects() {
        const selectedObjects = this.stateManager.get('selectedObjects');
        if (selectedObjects.size === 0) return;

        // Get selected objects (they're all on main level now)
        const selected = Array.from(selectedObjects)
            .map(id => this.level.findObjectById(id))
            .filter(Boolean);

        if (selected.length > 0) {
            // Ensure all objects have proper properties for display
            const clonedObjects = selected.map(obj => {
                const cloned = this.deepClone(obj);
                // Ensure essential properties are set
                cloned.visible = cloned.visible !== undefined ? cloned.visible : true;
                cloned.locked = cloned.locked !== undefined ? cloned.locked : false;
                cloned.width = cloned.width || 32;
                cloned.height = cloned.height || 32;
                cloned.color = cloned.color || '#cccccc';
                return cloned;
            });
            
            this.stateManager.update({
                'mouse.isPlacingObjects': true,
                'mouse.placingObjects': clonedObjects
            });
        }
    }

    groupSelectedObjects() {
        const selectedObjects = this.stateManager.get('selectedObjects');
        
        // Find all selected objects that are at the top level of the scene hierarchy
        const selectedTopLevelObjects = this.level.objects.filter(obj => selectedObjects.has(obj.id));

        // Grouping makes sense only if there are 2 or more objects selected at the same level
        if (selectedTopLevelObjects.length > 1) {
            this.historyManager.saveState(this.level.objects); // Save the state before making changes

            // Calculate the bounding box of all selected objects to determine the new group's position
            const bounds = this.getSelectionBounds(selectedTopLevelObjects);
            const newGroup = {
                id: this.level.nextObjectId++,
                name: "New Group",
                type: 'group',
                x: bounds.minX,
                y: bounds.minY,
                visible: true,
                locked: false,
                children: []
            };
            
            const idsToRemove = new Set();
            selectedTopLevelObjects.forEach(obj => {
                idsToRemove.add(obj.id);
                // Create a deep copy of the object to place inside the group
                const newChild = this.deepClone(obj);
                // Recalculate the child's coordinates to be relative to the new group's origin
                newChild.x -= newGroup.x;
                newChild.y -= newGroup.y;
                newGroup.children.push(newChild);
            });

            // Remove the original objects from the main level scene
            this.level.objects = this.level.objects.filter(obj => !idsToRemove.has(obj.id));
            
            // Add the newly created group to the scene
            this.level.objects.push(newGroup);
            
            // Clear the old selection and select only the new group
            this.stateManager.set('selectedObjects', new Set([newGroup.id]));
            
            // Refresh all UI panels and redraw the canvas
            this.updateAllPanels();
            this.render();
        }
    }

    focusOnSelection() {
        const selectedObjects = this.stateManager.get('selectedObjects');
        const selection = Array.from(selectedObjects).map(id => this.level.findObjectById(id)).filter(Boolean);
        this.focusOnBounds(this.getSelectionBounds(selection));
    }

    focusOnAll() {
        this.focusOnBounds(this.getSelectionBounds(this.level.objects));
    }

    focusOnBounds(bounds) {
        if (!bounds || bounds.minX === Infinity) return;
        
        const canvas = this.canvasRenderer.canvas;
        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;
        const padding = 50;
        const zoomX = canvas.width / (boundsWidth + padding * 2);
        const zoomY = canvas.height / (boundsHeight + padding * 2);
        
        const newZoom = Math.max(0.1, Math.min(10, Math.min(zoomX, zoomY)));
        const centerX = bounds.minX + boundsWidth / 2;
        const centerY = bounds.minY + boundsHeight / 2;
        
        this.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': centerX - (canvas.width / 2) / newZoom,
            'camera.y': centerY - (canvas.height / 2) / newZoom
        });
        
        this.render();
    }

    getSelectionBounds(collection) {
        if (collection.length === 0) return null;
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        collection.forEach(obj => {
            const objBounds = this.getObjectWorldBounds(obj);
            bounds.minX = Math.min(bounds.minX, objBounds.minX);
            bounds.minY = Math.min(bounds.minY, objBounds.minY);
            bounds.maxX = Math.max(bounds.maxX, objBounds.maxX);
            bounds.maxY = Math.max(bounds.maxY, objBounds.maxY);
        });
        return bounds;
    }

    getObjectWorldBounds(obj, excludeIds = []) {
        const getWorldPosition = (target) => {
            let result = null;
            const dfs = (current, accX, accY) => {
                if (current.id === target.id) {
                    result = { x: accX + current.x, y: accY + current.y };
                    return true;
                }
                if (current.type === 'group') {
                    const nextX = accX + current.x;
                    const nextY = accY + current.y;
                    for (const child of current.children) {
                        if (dfs(child, nextX, nextY)) return true;
                    }
                }
                return false;
            };
            for (const top of this.level.objects) {
                if (dfs(top, 0, 0)) break;
            }
            return result || { x: target.x, y: target.y };
        };

        if (obj.type !== 'group') {
            const pos = getWorldPosition(obj);
            return {
                minX: pos.x,
                minY: pos.y,
                maxX: pos.x + (obj.width || 0),
                maxY: pos.y + (obj.height || 0)
            };
        }

        const groupPos = getWorldPosition(obj);
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        const walk = (current, baseX, baseY) => {
            // ИЗМЕНЕНИЕ: Не обрабатываем сам объект, если он в списке исключений
            if (excludeIds.includes(current.id)) {
                return;
            }

            if (current.type === 'group') {
                const nextX = baseX + current.x;
                const nextY = baseY + current.y;

                // Если у группы нет дочерних элементов (или все они исключены), 
                // ее собственные координаты должны учитываться в границах.
                let hasVisibleChildren = false;
                if (current.children && current.children.length > 0) {
                    for (const child of current.children) {
                        if (!excludeIds.includes(child.id)) {
                            hasVisibleChildren = true;
                            walk(child, nextX, nextY);
                        }
                    }
                }

                if (!hasVisibleChildren) {
                    bounds.minX = Math.min(bounds.minX, nextX);
                    bounds.minY = Math.min(bounds.minY, nextY);
                    bounds.maxX = Math.max(bounds.maxX, nextX);
                    bounds.maxY = Math.max(bounds.maxY, nextY);
                }
                return;
            }

            const absX = baseX + current.x;
            const absY = baseY + current.y;
            bounds.minX = Math.min(bounds.minX, absX);
            bounds.minY = Math.min(bounds.minY, absY);
            bounds.maxX = Math.max(bounds.maxX, absX + (current.width || 0));
            bounds.maxY = Math.max(bounds.maxY, absY + (current.height || 0));
        };

        walk(obj, groupPos.x - obj.x, groupPos.y - obj.y);
        
        // Если после всех исключений границы остались бесконечными (т.е. группа пуста),
        // ее границами будет ее собственная точка привязки.
        if (bounds.minX === Infinity) {
            bounds.minX = groupPos.x;
            bounds.minY = groupPos.y;
            bounds.maxX = groupPos.x;
            bounds.maxY = groupPos.y;
        }

        return bounds;
    }

    getObjectWorldPosition(obj) {
        let result = null;
        const dfs = (current, accX, accY) => {
            if (current.id === obj.id) {
                result = { x: accX + current.x, y: accY + current.y };
                return true;
            }
            if (current.type === 'group') {
                const nextX = accX + current.x;
                const nextY = accY + current.y;
                for (const child of current.children) {
                    if (dfs(child, nextX, nextY)) return true;
                }
            }
            return false;
        };
        for (const top of this.level.objects) {
            if (dfs(top, 0, 0)) break;
        }
        return result || { x: obj.x, y: obj.y };
    }

    /**
     * History operations
     */
    undo() {
        const previousState = this.historyManager.undo();
        if (previousState) {
            this.level.objects = previousState;
            this.stateManager.set('selectedObjects', new Set());
            this.updateAllPanels();
            this.render();
            this.stateManager.markDirty();
        }
    }

    redo() {
        const nextState = this.historyManager.redo();
        if (nextState) {
            this.level.objects = nextState;
            this.stateManager.set('selectedObjects', new Set());
            this.updateAllPanels();
            this.render();
            this.stateManager.markDirty();
        }
    }

    /**
     * File operations
     */
    async newLevel() {
        if (this.stateManager.get('isDirty') && !confirm("You have unsaved changes. Are you sure you want to create a new level?")) {
            return;
        }
        
        this.level = this.fileManager.createNewLevel();
        this.stateManager.reset();
        
        // Re-initialize group edit mode state after reset
        this.stateManager.set('groupEditMode', {
            isActive: false,
            groupId: null,
            group: null,
            openGroups: []
        });
        
        this.historyManager.clear();
        this.historyManager.saveState(this.level.objects, true);
        this.updateAllPanels();
        this.render();
    }

    async openLevel() {
        if (this.stateManager.get('isDirty') && !confirm("You have unsaved changes. Are you sure you want to open a new level?")) {
            return;
        }
        
        try {
            this.level = await this.fileManager.loadLevelFromFileInput();
            this.stateManager.reset();
            this.historyManager.clear();
            this.historyManager.saveState(this.level.objects, true);
            this.updateAllPanels();
            this.render();
        } catch (error) {
            alert("Error loading level: " + error.message);
        }
    }

    saveLevel() {
        this.fileManager.saveLevel(this.level);
        this.stateManager.markClean();
    }

    saveLevelAs() {
        const fileName = prompt("Enter file name:", this.fileManager.getCurrentFileName() || "level.json");
        if (fileName) {
            this.fileManager.saveLevel(this.level, fileName);
            this.stateManager.markClean();
        }
    }

    /**
     * Handle double click on canvas
     */
    handleDoubleClick(e) {
        const worldPos = this.canvasRenderer.screenToWorld(e.clientX, e.clientY, this.stateManager.get('camera'));
        const clickedObject = this.findObjectAtPoint(worldPos.x, worldPos.y);
        
        if (clickedObject && clickedObject.type === 'group') {
            this.openGroupEditMode(clickedObject);
        }
    }

         /**
      * Open group edit mode
      */
     openGroupEditMode(group) {
         // Simply mark group as "editing" - don't move children
         group._isEditing = true;

         const current = this.stateManager.get('groupEditMode') || { isActive: false, openGroups: [] };
         const openGroups = Array.isArray(current.openGroups) ? [...current.openGroups, group] : [group];

         this.stateManager.set('groupEditMode', {
             isActive: true,
             groupId: group.id,
             group: group,
             originalChildren: [...group.children], // Keep reference to original children
             openGroups
         });

         // Clear selection
         this.stateManager.set('selectedObjects', new Set());
         this.updateAllPanels();
         this.render();
     }



    /**
     * Close group edit mode
     */
    closeGroupEditMode() {
        const groupEditMode = this.stateManager.get('groupEditMode');
        if (groupEditMode.isActive && groupEditMode.group) {
            const group = groupEditMode.group;

            // Simply remove editing flag - children stay where they are
            delete group._isEditing;
        }

        // Pop the last opened group
        const openGroups = Array.isArray(groupEditMode.openGroups) ? [...groupEditMode.openGroups] : [];
        openGroups.pop();
        const nextGroup = openGroups.length > 0 ? openGroups[openGroups.length - 1] : null;

        this.stateManager.set('groupEditMode', {
            isActive: openGroups.length > 0,
            groupId: nextGroup ? nextGroup.id : null,
            group: nextGroup,
            originalChildren: nextGroup ? [...nextGroup.children] : [],
            openGroups
        });

        this.stateManager.set('selectedObjects', new Set());
        this.updateAllPanels();
        this.render();
    }

    

    /**
     * Ungroup selected objects
     */
    ungroupSelectedObjects() {
        const selectedObjects = this.stateManager.get('selectedObjects');
        const groupsToUngroup = [];

        // Find selected groups
        selectedObjects.forEach(id => {
            const obj = this.level.findObjectById(id);
            if (obj && obj.type === 'group' && this.level.objects.some(topObj => topObj.id === obj.id)) {
                groupsToUngroup.push(obj);
            }
        });

        if (groupsToUngroup.length === 0) return;

        this.historyManager.saveState(this.level.objects);

        groupsToUngroup.forEach(group => {
            // Convert children back to world coordinates
            group.children.forEach(child => {
                child.x += group.x;
                child.y += group.y;
            });

            // Add children back to main level
            this.level.objects.push(...group.children);

            // Remove the group
            this.level.objects = this.level.objects.filter(obj => obj.id !== group.id);
        });

        this.stateManager.set('selectedObjects', new Set());
        this.updateAllPanels();
        this.render();
    }

    openAssetsPath() {
        // TODO: Implement assets path configuration
        alert("Assets path configuration not implemented yet");
    }

    openSettings() {
        this.settingsPanel.show();
    }

    /**
     * Utility methods
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Assign new unique ids recursively to object and its subtree
    reassignIdsDeep(obj) {
        obj.id = this.level.nextObjectId++;
        if (obj.type === 'group' && Array.isArray(obj.children)) {
            obj.children.forEach(child => this.reassignIdsDeep(child));
        }
        return obj;
    }

    /**
     * Get level for panels
     */
    getLevel() {
        return this.level;
    }

    drawHierarchyHighlightForGroup(group, depth = 0) {
        const camera = this.stateManager.get('camera');
        const baseColor = this.settingsManager?.get('selection.hierarchyHighlightColor') || '#3B82F6';
        const maxAlpha = 0.25; // base alpha
        const decay = 0.6; // alpha decay per depth
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));

        if (!group || !group.children) return;

        // Highlight each nested group
        group.children.forEach(child => {
            if (child.type === 'group') {
                const bounds = this.getObjectWorldBounds(child);
                const rgba = this.hexToRgba(baseColor, alpha);
                this.canvasRenderer.ctx.save();
                this.canvasRenderer.ctx.fillStyle = rgba;
                this.canvasRenderer.ctx.fillRect(
                    bounds.minX,
                    bounds.minY,
                    bounds.maxX - bounds.minX,
                    bounds.maxY - bounds.minY
                );
                this.canvasRenderer.ctx.restore();

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

    // Group edit helpers
    getOpenGroups() {
        const gem = this.stateManager.get('groupEditMode');
        return gem?.openGroups || [];
    }

    getActiveEditedGroup() {
        const open = this.getOpenGroups();
        return open.length > 0 ? open[open.length - 1] : null;
    }

    // Compute a set of selectable IDs depending on current edit state
    computeSelectableSet() {
        const selectable = new Set();
        const groupEditMode = this.stateManager.get('groupEditMode');

        if (groupEditMode.isActive) {
            // Only descendants of the deepest open group are selectable; all other open groups are transparent
            const openGroups = Array.isArray(groupEditMode.openGroups) ? groupEditMode.openGroups : [groupEditMode.group].filter(Boolean);
            const active = openGroups[openGroups.length - 1];
            if (active) {
                const collect = (g) => {
                    const res = [];
                    g.children.forEach(ch => {
                        res.push(ch);
                        if (ch.type === 'group') res.push(...collect(ch));
                    });
                    return res;
                };
                collect(active).forEach(o => selectable.add(o.id));
            }
            // All non-open groups on any level are still selectable (priority for groups), exclude open ones
            const openIds = new Set(openGroups.map(g => g.id));
            this.level.getAllObjects().forEach(o => {
                if (o.type === 'group' && !openIds.has(o.id)) selectable.add(o.id);
            });
            // Also allow selection of external objects (not in any open group)
            this.level.objects.forEach(o => {
                if (o.type !== 'group') selectable.add(o.id);
            });
        } else {
            // Normal mode: only top-level objects selectable
            this.level.objects.forEach(o => selectable.add(o.id));
        }
        return selectable;
    }
}
