import { Logger } from '../utils/Logger.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { BasePanel } from './BasePanel.js';
import { LayersContextMenu } from './LayersContextMenu.js';
import { HoverEffects } from '../utils/HoverEffects.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { createLayersPanelStructure, renderLayersControls } from './panel-structures/LayersPanelStructure.js';
import { createListItemRow, updateListItemVisuals } from './panel-structures/ListItemRowStructure.js';
import {
    clearListReorderPlaceholder,
    syncListReorderPlaceholder,
    getListOrderAfterReorder
} from './panel-structures/ListReorderPlaceholder.js';
import { searchManager } from '../utils/SearchManager.js';

/**
 * Layers panel UI component
 */
export class LayersPanel extends BasePanel {
    /**
     * @param {HTMLElement} container
     * @param {object} stateManager
     * @param {object} levelEditor
     * @param {{ instanceKey?: string, isPrimary?: boolean }} [options]
     */
    constructor(container, stateManager, levelEditor, options = {}) {
        super(container, stateManager, levelEditor);
        this.instanceKey = options.instanceKey || null;
        this.isPrimary = options.isPrimary !== false && !this.instanceKey;
        this.searchPanelId = this.instanceKey ? `layers-${this.instanceKey}` : 'layers';
        this.searchInputId = this.instanceKey ? `layers-search-${this.instanceKey}` : 'layers-search';
        this.contextMenuId = this.instanceKey ? `layers-${this.instanceKey}` : 'layers';
        this.currentLayerId = null; // Track current layer (for new objects, blue highlight)
        this.searchFilter = ''; // Search filter for layers
        this.contextMenu = null; // Context menu instance
        this._draggedElement = null; // Track dragged element for drag and drop
        this._draggedRowHeight = 0; // Pre-collapse height for reorder placeholder

        // Icon "paint drag": mousedown on an eye/lock icon + drag over others applies the
        // same state to every icon of that type under the cursor before mouseup. See
        // handleLayerIconMouseDown/handleLayerIconMouseOver/_endIconPaintDrag.
        this._iconPaintDrag = null; // { type: 'visibility'|'lock', value: boolean }
        this._draggableSuspendedRow = null; // .layer-item temporarily set draggable=false during a paint drag

        // Track subscriptions for cleanup
        this.subscriptions = [];

        // Initialize panel structure
        this.panelElements = createLayersPanelStructure(this.container);

        // Register search in universal search manager
        searchManager.registerSearch(
            this.searchPanelId,
            this.searchInputId,
            (searchFilter) => {
                this.searchFilter = searchFilter;
                this.renderLayersSection();
            },
            null
        );
        this.layerContextMenu = null; // Layer context menu reference

        this.setupContextMenus();
        this.setupEventListeners();
    }

    /**
     * Setup context menus for layers
     */
    setupContextMenus() {
        // Bind to container (works for primary + dock copies before/after reparent)
        this.layerContextMenu = new LayersContextMenu(this.container, this, {
            stateManager: this.stateManager, // Pass StateManager for marquee check
            onMakeCurrent: (layer) => this.setCurrentLayerAndNotify(layer.id),
            onRename: (layer) => this.renameLayer(layer.id),
            onDuplicate: (layer) => this.duplicateLayer(layer.id),
            onToggleVisibility: (layer) => this.toggleLayerVisibility(layer.id),
            onToggleLock: (layer) => this.toggleLayerLock(layer.id),
            onSelectAllObjects: (layer) => this.selectAllObjectsInLayer(layer.id),
            onDelete: (layer) => this.deleteLayer(layer.id)
        });

        // Register context menu with ContextMenuManager for global resize handling
        if (this.levelEditor && this.levelEditor.contextMenuManager && this.layerContextMenu) {
            this.levelEditor.contextMenuManager.registerMenu(this.contextMenuId, this.layerContextMenu);
        }
    }

    /**
     * Get list of layers for selection operations
     * @returns {Array} Array of layer objects
     */
    getLayerList() {
        const level = this.levelEditor.getLevel();
        if (!level) return [];
        
        return level.layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            locked: layer.locked,
            visible: layer.visible
        }));
    }

    /**
     * Initialize current layer
     */
    initializeCurrentLayer() {
        const level = this.levelEditor.getLevel();
        if (level) {
            this.currentLayerId = level.getMainLayerId();
            // Also set it in LevelEditor
            this.levelEditor.setCurrentLayer(this.currentLayerId);
        }
    }

    setupEventListeners() {
        // Context menu setup is done in render() when containers are available

        // Selection functionality is now handled by EventHandlerManager
        // No need to setup BasePanel selection for layers

        // Subscribe to level changes
        const unsubscribeLevel = this.stateManager.subscribe('level', () => {
            // Only initialize current layer if not already set
            if (!this.currentLayerId) {
                const level = this.levelEditor.getLevel();
                if (level) {
                    this.currentLayerId = level.getMainLayerId();
                    // Also set it in LevelEditor
                    this.levelEditor.setCurrentLayer(this.currentLayerId);
                }
            }
            this.render();
        });
        this.subscriptions.push(unsubscribeLevel);

        // Subscribe to level structure changes (object/layer add/remove/reorder) — see
        // Level.setStructureChangeCallback / tmp/REACTIVE_LEVEL_UPDATES_PLAN.md. Replaces
        // the need for every mutating operation to remember calling editor.updateAllPanels().
        const unsubscribeStructure = this.stateManager.subscribe('levelStructureChanged', () => {
            this.render();
        });
        this.subscriptions.push(unsubscribeStructure);

        // Subscribe to selection changes - optimize by only updating styles instead of full render
        const unsubscribeSelected = this.stateManager.subscribe('selectedObjects', () => {
            // Only update layer styles for active layer highlighting, not full render
            this.updateLayerStyles();
        });
        this.subscriptions.push(unsubscribeSelected);

        // Subscribe to layer objects count changes for efficient updates
        const unsubscribeLayerCount = this.stateManager.subscribe('layerObjectsCountChanged', (layerId, changeData) => {

            // Update only the specific layer's object count
            this.updateLayerObjectsCount(layerId);

            // Update global stats
            this.updateLayersStats();
        });
        this.subscriptions.push(unsubscribeLayerCount);

        // Subscribe to layer property changes for real-time updates
        const unsubscribeLayerChanged = this.stateManager.subscribe('layerChanged', (layerId, changeData) => {
            // Update the specific layer element
            const level = this.levelEditor.getLevel();
            const layer = level.getLayerById(layerId);
            if (layer) {
                this.updateLayerElement(layerId, layer);
            }
        });
        this.subscriptions.push(unsubscribeLayerChanged);

        // Subscribe to StateManager changes for active layer border color (real-time updates)
        if (this.stateManager) {
            const unsubscribeColorChange = this.stateManager.subscribe('selection.activeLayerBorderColor', () => {
                this.updateLayerStyles();
            });
            this.subscriptions.push(unsubscribeColorChange);
        }

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // EventHandlerManager will be setup in render() after elements are created
    }


    render() {
        // Save search input state before clearing
        const searchInput = this.container.querySelector(`#${this.searchInputId}`)
            || this.container.querySelector('input[type="text"]');
        const wasSearchFocused = searchInput && document.activeElement === searchInput;

        // Remove only non-custom children to preserve custom sections
        const children = Array.from(this.container.children);
        children.forEach(child => {
            if (!child.classList.contains('panel-top-custom') && 
                !child.classList.contains('panel-bottom-custom')) {
                this.container.removeChild(child);
            }
        });

        // Initialize current layer if not set
        if (!this.currentLayerId) {
            this.initializeCurrentLayer();
        }

        // Render layers management section
        this.renderLayersSection();

        // Update objects count for all layers
        this.updateAllLayersObjectsCount();

        // Update layer styles based on active state
        this.updateLayerStyles();

        // Update global statistics
        this.updateLayersStats();

        // Restore search input state after render
        if (wasSearchFocused) {
            const newSearchInput = this.container.querySelector(`#${this.searchInputId}`)
                || this.container.querySelector('input[type="text"]');
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
            }
        }
    }

    /**
     * Render layers controls in the top custom section
     */
    renderLayersSearchControls() {

        // Get the top custom section from panel structure
        const topSection = this.panelElements?.topCustom;
        if (!topSection) {
            return;
        }

        if (!this.container || this.container.classList.contains('hidden')) {
            return;
        }


        // Check if controls are already rendered (avoid unnecessary re-rendering)
        const searchInput = topSection.querySelector(`#${this.searchInputId}`)
            || topSection.querySelector('input[type="text"]');
        const addButton = topSection.querySelector('#add-layer-btn')
            || topSection.querySelector('button');


        if (searchInput && addButton) {
            // Controls already exist, just update search value
            const currentTerm = searchManager.getSearchTerm(this.searchPanelId);
            if (searchInput.value !== currentTerm) {
                searchInput.value = currentTerm;
            }

            // Always check and ensure search listeners are properly set up
            if (!searchInput.hasAttribute('data-search-managed')) {
                searchManager.setupSearchListeners(this.searchPanelId);
            }

            return;
        }



        // Use the structure's render function with callbacks
        renderLayersControls(topSection, {
            searchInputId: this.searchInputId,
            getSearchFilter: () => searchManager.getSearchTerm(this.searchPanelId),
            onSearch: (searchFilter) => {
                this.searchFilter = searchFilter;
                this.renderLayersSection();
            },
            onAddLayer: null
        });

        // Setup button event listeners (search is handled by SearchManager, add button by createButton)

        // Immediately ensure search listeners are set up after creating new controls
        const newSearchInput = topSection.querySelector(`#${this.searchInputId}`)
            || topSection.querySelector('input[type="text"]');
        if (newSearchInput && !newSearchInput.hasAttribute('data-search-managed')) {
            searchManager.setupSearchListeners(this.searchPanelId);
        }
        
        // Register EventHandlerManager for top section if not already registered
        if (!this._topSectionHandlersRegistered) {
            const topSectionHandlers = {
                click: {
                    selector: '#add-layer-btn',
                    handler: (e) => {
                        this.onAddLayer(e);
                    }
                }
            };
            eventHandlerManager.registerContainer(topSection, topSectionHandlers);
            this._topSectionHandlersRegistered = true;
        }

    }

    /**
     * Render layers management section
     */
    renderLayersSection() {
        const level = this.levelEditor.getLevel();
        const layers = level.getLayersSorted();

        // Ensure custom sections exist (recreate if needed)
        if (!this.panelElements?.topCustom || !this.container.contains(this.panelElements.topCustom)) {
            Array.from(this.container.children).forEach(child => this.container.removeChild(child));
            this.panelElements = createLayersPanelStructure(this.container);
            this._layersList = null;
        }

        // Render layers controls in top custom section
        this.renderLayersSearchControls();

        // Reuse list node so middle-pan registration stays stable across re-renders.
        if (!this._layersList || !this.container.contains(this._layersList)) {
            this._layersList = document.createElement('div');
            this._layersList.className = 'layers-list space-y-1';
            this._layersList.id = 'layers-list';
            this.setupScrolling({
                horizontal: true,
                vertical: true,
                sensitivity: 1.0,
                target: this._layersList
            });
        }

        const layersList = this._layersList;
        layersList.innerHTML = '';

        // Filter layers based on search
        const filteredLayers = this.filterLayers(layers);

        // Render each layer
        filteredLayers.forEach(layer => {
            const layerElement = this.createLayerElement(layer);
            layersList.appendChild(layerElement);
        });

        this.container.appendChild(layersList);

        // Update layer styles to show current layer highlight
        this.updateLayerStyles();
        
        // Setup EventHandlerManager after elements are created
        // Unregister old handlers before re-registering to avoid duplicates
        if (this._eventHandlersRegistered) {
            eventHandlerManager.unregisterContainer(this.container);
        }
        this._eventHandlersRegistered = false;
        this.setupLayersPanelHandlers();
    }

    /**
     * Create layer element
     */
    createLayerElement(layer) {
        const level = this.levelEditor.getLevel();
        
        // Force update cached stats if not available
        if (!this.levelEditor.cachedLevelStats) {
            this.levelEditor.updateCachedLevelStats();
        }
        
        const cachedStats = this.levelEditor.cachedLevelStats;
        const objectsCount = level.getCachedLayerObjectsCount(layer.id, cachedStats);
        const isMainLayer = layer.id === level.getMainLayerId();
        const isCurrent = this.currentLayerId === layer.id;
        // Effective visibility (not raw layer.visible): another layer being soloed makes
        // THIS layer stop rendering without ever touching its own `visible` flag — see
        // RenderOperations.getVisibleLayerIds(), the single source of truth for this.
        const effectivelyVisible = this.levelEditor.renderOperations.getVisibleLayerIds().has(layer.id);

        const layerDiv = createListItemRow('layer', {
            id: layer.id,
            isCurrent,
            effectivelyVisible,
            draggable: true,
            name: { display: layer.name, value: layer.name },
            objectsCount,
            visibility: {
                soloed: layer.soloed,
                title: layer.soloed ? 'Soloed — Ctrl+click to un-solo' : (layer.visible ? 'Hide layer (Ctrl+click to solo)' : 'Show layer (Ctrl+click to solo)')
            },
            color: { value: layer.color, title: 'Click to change color', shape: 'circle' },
            lock: { locked: layer.locked, title: layer.locked ? 'Unlock layer' : 'Lock layer' },
            parallax: { value: layer.parallaxOffset, title: 'Parallax offset (0 = no parallax, negative = slower, positive = faster)' }
        });

        // Setup hover effects and set color using CSS variable
        const colorElement = layerDiv.querySelector('.layer-color');
        if (colorElement) {
            colorElement.style.setProperty('--layer-color', layer.color);
            HoverEffects.setupColorHover(colorElement);
        }
        
        // Setup hover effect for the main layer container
        // CSS will handle blocking hover on selected layers (bg-blue-600)
        HoverEffects.setupListItemHover(layerDiv);
        
        // Setup hover effects for buttons using CSS classes
        const visibilityBtn = layerDiv.querySelector('.layer-visibility-btn');
        const lockBtn = layerDiv.querySelector('.layer-lock-btn');
        
        if (visibilityBtn) {
            visibilityBtn.classList.add('hover:bg-gray-600');
        }
        if (lockBtn) {
            lockBtn.classList.add('hover:bg-gray-600');
        }
        
        return layerDiv;
    }

    /**
     * Show color picker for layer
     */
    showColorPicker(layer, event) {
        // Create a visible color input element positioned near the button
        const button = event.target.closest('.layer-color');
        const buttonRect = button.getBoundingClientRect();
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = `layer-color-input-${layer.id}`;
        colorInput.name = `layer-color-input-${layer.id}`;
        colorInput.value = layer.color;
        colorInput.style.position = 'fixed';
        colorInput.style.left = `${buttonRect.left}px`;
        colorInput.style.top = `${buttonRect.bottom + 5}px`;
        colorInput.style.width = '40px';
        colorInput.style.height = '40px';
        colorInput.style.border = '2px solid var(--ui-active-color, #3B82F6)';
        colorInput.style.borderRadius = '4px';
        colorInput.style.zIndex = '10000';
        colorInput.style.cursor = 'pointer';
        colorInput.style.opacity = '1';
        
        // Add to body
        document.body.appendChild(colorInput);
        
        // Focus and click to open native color picker
        colorInput.focus();
        colorInput.click();
        
        // cleanup() and escapeHandler are declared below and captured by reference —
        // JS closures evaluate variable lookups at call time, not at definition time,
        // so the 'change' handler can safely call cleanup() defined afterward.

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
            }
        };
        const cleanup = () => {
            document.removeEventListener('keydown', escapeHandler);
            if (document.body.contains(colorInput)) {
                document.body.removeChild(colorInput);
            }
        };

        // Handle color change — use shared cleanup() to also deregister escapeHandler
        colorInput.addEventListener('change', (e) => {
            const oldColor = layer.color;
            const newColor = e.target.value;
            layer.color = newColor;
            this.updateLayerElement(layer.id, layer);
            this.stateManager.markDirty();
            this.stateManager.notifyLayerChanged(layer.id, 'color', newColor, oldColor);
            cleanup();
        });

        colorInput.addEventListener('blur', cleanup);
        document.addEventListener('keydown', escapeHandler);
    }


    /**
     * Update layer element visual state without recreating it
     */
    updateLayerElement(layerId, layer) {
        const layerElement = this.container.querySelector(`[data-layer-id="${layerId}"]`);
        if (!layerElement) return;

        // Effective visibility (not raw layer.visible) — see createLayerElement's comment
        // and RenderOperations.getVisibleLayerIds(), the single source of truth for this.
        const effectivelyVisible = this.levelEditor.renderOperations.getVisibleLayerIds().has(layerId);

        // Update color indicator
        const colorIndicator = layerElement.querySelector('.layer-color');
        if (colorIndicator) {
            colorIndicator.style.backgroundColor = layer.color;
        }

        // Update objects count in display text
        const level = this.levelEditor.getLevel();
        
        // Force update cached stats if not available
        if (!this.levelEditor.cachedLevelStats) {
            this.levelEditor.updateCachedLevelStats();
        }
        
        const cachedStats = this.levelEditor.cachedLevelStats;
        const objectsCount = level.getCachedLayerObjectsCount(layerId, cachedStats);
        
        // Update layer name display (without count)
        const display = layerElement.querySelector('.layer-name-display');
        if (display) {
            display.textContent = layer.name;
        }
        
        // Update objects count in separate element
        const countElement = layerElement.querySelector('.layer-objects-count');
        if (countElement) {
            countElement.textContent = objectsCount > 0 ? objectsCount : '';
        }

        const isCurrent = this.currentLayerId === layerId;

        updateListItemVisuals(layerElement, 'layer', {
            effectivelyVisible,
            isCurrent,
            visibility: {
                soloed: layer.soloed,
                title: layer.soloed ? 'Soloed — Ctrl+click to un-solo' : (layer.visible ? 'Hide layer (Ctrl+click to solo)' : 'Show layer (Ctrl+click to solo)')
            },
            lock: { locked: layer.locked, title: layer.locked ? 'Unlock layer' : 'Lock layer' }
        });
    }


    /**
     * Update objects count for all layers
     */
    updateAllLayersObjectsCount() {
        const level = this.levelEditor.getLevel();
        const layers = level.getLayersSorted();
        
        // Force update cached stats if not available
        if (!this.levelEditor.cachedLevelStats) {
            this.levelEditor.updateCachedLevelStats();
        }
        
        // Use cached statistics for better performance
        const cachedStats = this.levelEditor.cachedLevelStats;

        layers.forEach(layer => {
            const objectsCount = level.getCachedLayerObjectsCount(layer.id, cachedStats);
            const layerElement = this.container.querySelector(`[data-layer-id="${layer.id}"]`);
            if (layerElement) {
                const countElement = layerElement.querySelector('.layer-objects-count');
                if (countElement) {
                    countElement.textContent = objectsCount > 0 ? objectsCount : '';
                }
            }
        });
    }

    /**
     * Update objects count for specific layer
     */
    updateLayerObjectsCount(layerId) {
        const level = this.levelEditor.getLevel();
        
        // Force update cached stats if not available
        if (!this.levelEditor.cachedLevelStats) {
            this.levelEditor.updateCachedLevelStats();
        }
        
        const cachedStats = this.levelEditor.cachedLevelStats;
        const objectsCount = level.getCachedLayerObjectsCount(layerId, cachedStats);
        
        const layerElement = this.container.querySelector(`[data-layer-id="${layerId}"]`);
        if (layerElement) {
            const countElement = layerElement.querySelector('.layer-objects-count');
            if (countElement) {
                countElement.textContent = objectsCount > 0 ? objectsCount : '';
            }
        }
    }

    /**
     * Get all layer IDs that contain selected objects (considering layerId inheritance)
     * @returns {Set<string>} Set of layer IDs
     */
    getActiveLayerIds() {

        const selectedObjects = this.stateManager.get('selectedObjects');

        if (!selectedObjects || selectedObjects.size === 0) {
            return new Set();
        }

        const level = this.levelEditor.getLevel();
        const layerIds = new Set();

        // Collect all effective layer IDs from selected objects
        selectedObjects.forEach(objId => {
            const obj = level.findObjectById(objId);
            
            if (obj) {
                // Use effective layer ID considering inheritance from parent groups
                const effectiveLayerId = this.getEffectiveLayerId(obj, level);
                layerIds.add(effectiveLayerId);
            } else {
            }
        });

        return layerIds;
    }

    /**
     * Get effective layer ID for an object, considering inheritance from parent groups
     * @param {GameObject} obj - Object to get layer ID for
     * @param {Level} level - Level containing the object
     * @returns {string} Effective layer ID
     */
    getEffectiveLayerId(obj, level) {
        // If object has its own layerId, use it
        if (obj.layerId) {
            return obj.layerId;
        }

        // Try to find the object in the hierarchy and get parent's layerId
        const findParentLayerId = (currentObj, parentGroup = null) => {
            // If we have a parent group, check if currentObj is its child
            if (parentGroup && parentGroup.children) {
                const childIndex = parentGroup.children.findIndex(child => child.id === currentObj.id);
                if (childIndex !== -1) {
                    // Found the object as child of parentGroup
                    return parentGroup.layerId || level.getMainLayerId();
                }
            }

            // Search recursively in all groups
            for (const topLevelObj of level.objects) {
                if (topLevelObj.type === 'group') {
                    const result = this.searchInGroupForLayerId(topLevelObj, currentObj, level);
                    if (result) {
                        return result;
                    }
                }
            }

            // If not found in any group, use main layer
            return level.getMainLayerId();
        };

        return findParentLayerId(obj);
    }

    /**
     * Recursively search for object in group hierarchy and return parent's layerId
     * @param {Group} group - Group to search in
     * @param {GameObject} targetObj - Object to find
     * @param {Level} level - Level for fallback
     * @returns {string|null} Parent's layerId or null if not found
     */
    searchInGroupForLayerId(group, targetObj, level) {
        if (!group.children) return null;

        // Check if targetObj is direct child of this group
        const directChild = group.children.find(child => child.id === targetObj.id);
        if (directChild) {
            return group.layerId || level.getMainLayerId();
        }

        // Search recursively in child groups
        for (const child of group.children) {
            if (child.type === 'group') {
                const result = this.searchInGroupForLayerId(child, targetObj, level);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Update layer styles based on active and current states
     */
    updateLayerStyles() {
        const activeLayerIds = this.getActiveLayerIds();
        const layerElements = this.container.querySelectorAll('.layer-item');

        // Get active layer border color from StateManager (for real-time updates)
        const activeLayerBorderColor = this.stateManager?.get('selection.activeLayerBorderColor') ||
                                      this.levelEditor.configManager?.get('selection.activeLayerBorderColor') || '#3B82F6';

        layerElements.forEach(element => {
            const layerId = element.dataset.layerId;
            const isActive = activeLayerIds.has(layerId);
            const isCurrent = this.currentLayerId === layerId;

            // Update background color based on state: current > default
            // CSS will handle blocking hover on selected layers (bg-blue-600)
            if (isCurrent) {
                element.classList.remove('bg-gray-700');
                element.classList.add('bg-blue-600');
            } else {
                element.classList.remove('bg-blue-600');
                element.classList.add('bg-gray-700');
            }

            // Update border color for active layers (only border, not background)
            if (isActive) {
                element.style.borderColor = activeLayerBorderColor;
            } else {
                element.style.borderColor = '';
            }
        });
    }



    /**
     * Handle layer visibility change - remove selection and close groups when hidden
     */
    handleLayerVisibilityChanged(layerId, isVisible) {
        const level = this.levelEditor.getLevel();
        const selectedObjects = this.stateManager.get('selectedObjects') || new Set();

        // Update visible property for all objects in the layer
        this.updateObjectsVisibilityForLayer(layerId, isVisible);

        if (!isVisible) {
            // Layer became invisible

            // Find objects in the hidden layer
            const objectsToDeselect = new Set();

            selectedObjects.forEach(objId => {
                const obj = level.findObjectById(objId);
                if (obj) {
                    // Check if object is in the hidden layer (considering inheritance)
                    const effectiveLayerId = this.levelEditor.renderOperations ?
                        this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
                        (obj.layerId || level.getMainLayerId());
                    
                    if (effectiveLayerId === layerId) {
                        objectsToDeselect.add(objId);
                    }
                }
            });

            // Remove selection from objects in hidden layer
            if (objectsToDeselect.size > 0) {
                const newSelection = new Set();
                selectedObjects.forEach(objId => {
                    if (!objectsToDeselect.has(objId)) {
                        newSelection.add(objId);
                    }
                });
                this.stateManager.set('selectedObjects', newSelection);
            }

            // Close any open groups from the hidden layer
            const groupEditMode = this.stateManager.get('groupEditMode');
            if (groupEditMode && groupEditMode.isActive) {
                const openGroups = groupEditMode.openGroups || [];
                const groupsToClose = openGroups.filter(group => group.layerId === layerId);

                if (groupsToClose.length > 0) {
                    // Exit group edit mode if active group is from hidden layer
                    if (groupEditMode.group && groupEditMode.group.layerId === layerId) {
                        this.levelEditor.groupOperations.closeGroupEditMode();
                    } else {
                        // Filter out groups from hidden layer
                        const remainingGroups = openGroups.filter(group => group.layerId !== layerId);
                        if (remainingGroups.length !== openGroups.length) {
                            // Update group edit mode with filtered groups
                            this.stateManager.update({
                                'groupEditMode.openGroups': remainingGroups
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * Update visible property for all objects in a layer
     */
    updateObjectsVisibilityForLayer(layerId, layerVisible) {
        const level = this.levelEditor.getLevel();
        const allObjects = level.getAllObjects();

        allObjects.forEach(obj => {
            if (obj.layerId === layerId) {
                obj.visible = layerVisible;
            }
        });

        // Mark level as modified
        level.updateModified();
    }

    /**
     * Handle layer lock state change - remove selection from objects in locked layer
     */
    handleLayerLockChanged(layerId, isLocked) {
        const level = this.levelEditor.getLevel();
        const selectedObjects = this.stateManager.get('selectedObjects') || new Set();

        if (isLocked) {
            // Layer became locked - remove selection from objects in this layer
            const objectsToDeselect = new Set();

            selectedObjects.forEach(objId => {
                const obj = level.findObjectById(objId);
                if (obj) {
                    // Check if object is in the locked layer (considering inheritance)
                    const effectiveLayerId = this.levelEditor.renderOperations ?
                        this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
                        (obj.layerId || level.getMainLayerId());
                    
                    if (effectiveLayerId === layerId) {
                        objectsToDeselect.add(objId);
                    }
                }
            });

            // Remove selection from objects in locked layer
            if (objectsToDeselect.size > 0) {
                const newSelection = new Set();
                selectedObjects.forEach(objId => {
                    if (!objectsToDeselect.has(objId)) {
                        newSelection.add(objId);
                    }
                });
                this.stateManager.set('selectedObjects', newSelection);
            }
        }
        // If layer became unlocked, no need to do anything special - outliner will update automatically
    }

    /**
     * Filter layers based on search query
     */
    filterLayers(layers) {
        return SearchUtils.filterObjects(layers, this.searchFilter, 'name');
    }

    /**
     * Update layers statistics
     */
    updateLayersStats() {
        const level = this.levelEditor.getLevel();
        if (!level) {
            return;
        }
        
        const layers = level.getLayersSorted();
        
        // Force update cached stats if not available
        if (!this.levelEditor.cachedLevelStats) {
            this.levelEditor.updateCachedLevelStats();
        }
        
        // Ensure we have valid cached stats
        if (!this.levelEditor.cachedLevelStats || !this.levelEditor.cachedLevelStats.byLayer) {
            this.levelEditor.updateCachedLevelStats();
        }
        
        const totalObjects = layers.reduce((sum, layer) => {
            const cachedStats = this.levelEditor.cachedLevelStats;
            return sum + level.getCachedLayerObjectsCount(layer.id, cachedStats);
        }, 0);
        
        const statsElement = this.container.querySelector('#layers-stats')
            || document.getElementById('layers-stats');
        if (statsElement) {
            statsElement.textContent = `${layers.length} layers, ${totalObjects} objects`;
        }
    }

    /**
     * Show context menu for layer
     */
    showLayerContextMenu(layer, event) {
        // Use the new context menu system
        // Let LayersContextMenu extract context data from the event target
        this.layerContextMenu.showContextMenu(event, {});
    }

    /**
     * Set current layer (called by LevelEditor)
     */
    setCurrentLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        this.currentLayerId = layerId;
        this.updateLayerStyles();
        
        Logger.layer.info(`Set current layer: ${layer.name}`);
    }

    /**
     * Get current layer ID
     */
    getCurrentLayerId() {
        return this.currentLayerId;
    }

    // Panels don't need universal cancel/apply methods,
    // specific logic is handled through event handlers

    /**
     * Clear search filter
     */
    clearSearch() {
        if (this.searchFilter) {
            this.searchFilter = '';
            // Update search manager
            if (typeof searchManager !== 'undefined' && searchManager.setSearchTerm) {
                searchManager.setSearchTerm('layers', '');
            }
            this.render();
        }
    }

    /**
     * Handle search input changes
     * @param {string} searchTerm - Search term
     */
    handleSearch(searchTerm) {
        this.searchFilter = searchTerm;
        // Update search manager
        if (typeof searchManager !== 'undefined' && searchManager.setSearchTerm) {
            searchManager.setSearchTerm('layers', searchTerm);
        }
        this.render();
    }

    /**
     * Handle add layer button
     * @param {Event} e - Click event (optional, for checking modifier keys)
     */
    onAddLayer(e = null) {
        const level = this.levelEditor.getLevel();
        if (level) {
            const layersBefore = level.layers.length;
            const shiftPressed = e && (e.shiftKey || e.ctrlKey);

            // If Shift is pressed, add 3 layers instead of 1
            const layersToAdd = shiftPressed ? 3 : 1;

            for (let i = 0; i < layersToAdd; i++) {
                level.addLayer();
            }

            // New layers default to visible: true, but the cached visibleLayerIds
            // set (RenderOperations.getVisibleLayerIds) doesn't know about them yet,
            // so they'd render as hidden until something else invalidates the cache.
            if (this.levelEditor.renderOperations) {
                this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
            }

            const layersAfter = level.layers.length;
            this.render();
            this.stateManager.markDirty();
            Logger.layer.info(`Added ${layersToAdd} layer(s) (${layersBefore} → ${layersAfter} layers)`);
        }
    }

    /**
     * Toggle layer visibility (for auto-registration system)
     * @param {string} layerId - Layer ID
     */
    toggleLayerVisibility(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (layer) {
            const wasVisible = layer.visible;
            layer.toggleVisibility();

            // Invalidate BEFORE updateLayerElement: it reads the cache-backed
            // getVisibleLayerIds(), which must reflect the flag just flipped above.
            if (this.levelEditor.renderOperations) {
                this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
            }

            // Force update the layer element immediately
            this.updateLayerElement(layerId, layer);
            this.stateManager.markDirty();

            // Notify about layer visibility change
            this.stateManager.notifyLayerChanged(layerId, 'visible', layer.visible, wasVisible);

            // Handle visibility changes
            if (wasVisible && !layer.visible) {
                // Layer became invisible
                this.handleLayerVisibilityChanged(layerId, false);
            } else if (!wasVisible && layer.visible) {
                // Layer became visible - update selection to include objects from this layer
                this.handleLayerVisibilityChanged(layerId, true);
            }

            if (this.levelEditor.renderOperations) {
                this.levelEditor.render();
            }

            // Update layer styles after visibility change
            this.updateLayerStyles();

            // Outliner icons/row color depend on effective layer visibility
            // (ObjectOperations.isObjectEffectivelyVisible) — without this it only
            // refreshes on the next unrelated action that happens to re-render it
            // (e.g. a canvas click changing selection).
            if (this.levelEditor.outlinerPanel) {
                this.levelEditor.outlinerPanel.render();
            }
        }
    }

    /**
     * Ctrl+click a layer's eye icon: exclusive "solo" — only this layer renders,
     * regardless of any layer's own `visible` flag (see RenderOperations.getVisibleLayerIds).
     * Ctrl+click an already-soloed layer to un-solo (back to normal per-layer visibility).
     * Non-destructive: never touches `layer.visible`, `layer.soloed` is a transient UI flag.
     * @param {string} layerId - Layer ID
     */
    toggleLayerSolo(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        const wasSoloed = layer.soloed;
        level.layers.forEach(l => { l.soloed = false; });
        layer.soloed = !wasSoloed;

        // Invalidate BEFORE re-rendering the rows below: updateLayerElement reads
        // getVisibleLayerIds(), which is cache-backed — a stale cache would make the
        // icons/dimming lag behind the solo state that was just flipped.
        if (this.levelEditor.renderOperations) {
            this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
        }

        level.layers.forEach(l => this.updateLayerElement(l.id, l));
        this.stateManager.markDirty();

        if (this.levelEditor.renderOperations) {
            this.levelEditor.render();
        }

        this.updateLayerStyles();

        // Outliner icons/row color depend on effective layer visibility
        // (ObjectOperations.isObjectEffectivelyVisible) — without this it only
        // refreshes on the next unrelated action that happens to re-render it
        // (e.g. a canvas click changing selection).
        if (this.levelEditor.outlinerPanel) {
            this.levelEditor.outlinerPanel.render();
        }
    }

    /**
     * Toggle layer lock (for auto-registration system)
     * @param {string} layerId - Layer ID
     */
    toggleLayerLock(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (layer) {
            const wasLocked = layer.locked;
            layer.toggleLock();

            // Force update the layer element immediately
            this.updateLayerElement(layerId, layer);
            this.stateManager.markDirty();

            // Notify about layer lock change
            this.stateManager.notifyLayerChanged(layerId, 'locked', layer.locked, wasLocked);

            // Handle lock state changes
            if (!wasLocked && layer.locked) {
                // Layer became locked - remove selection from objects in this layer
                this.handleLayerLockChanged(layerId, true);
            } else if (wasLocked && !layer.locked) {
                // Layer became unlocked - update outliner to show objects as selectable
                this.handleLayerLockChanged(layerId, false);
            }

            // Update only outliner panel to reflect changes, not all panels
            if (this.levelEditor.outlinerPanel) {
                this.levelEditor.outlinerPanel.render();
            }
        }
    }

    /**
     * Rename layer
     */
    renameLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        const input = this.container.querySelector(`#layer-name-${layerId}`);
        const display = this.container.querySelector(`[data-layer-id="${layerId}"].layer-name-display`);
        const layerElement = this.container.querySelector(`[data-layer-id="${layerId}"]`);
        
        if (input && display && layerElement) {
            // Disable dragging for this layer during rename
            layerElement.draggable = false;
            
            display.classList.add('hidden');
            input.classList.remove('hidden');
            input.focus();
            input.select();
        }
    }

    /**
     * Duplicate layer
     */
    duplicateLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        const duplicatedLayer = layer.clone();
        duplicatedLayer.name = `${layer.name} Copy`;
        duplicatedLayer.order = Math.max(...level.layers.map(l => l.order), -1) + 1;
        
        level.layers.push(duplicatedLayer);
        this.render();
        this.stateManager.markDirty();
        
        // Update global stats
        this.updateLayersStats();
        
        Logger.layer.info(`Duplicated layer: ${layer.name} → ${duplicatedLayer.name}`);
    }

    /**
     * Toggle layer visibility
     */

    /**
     * Toggle layer lock
     */

    /**
     * Get all objects in layer by effective layer ID
     * @param {string} layerId - Layer ID
     * @returns {Array} Array of objects in the layer
     * @private
     */
    _getObjectsInLayer(layerId) {
        const level = this.levelEditor.getLevel();
        return level.objects.filter(obj => {
            const effectiveLayerId = this.levelEditor.renderOperations ?
                this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
                (obj.layerId || level.getMainLayerId());
            return effectiveLayerId === layerId;
        });
    }

    /**
     * Select all objects in layer (replace current selection)
     */
    selectAllObjectsInLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const objectsInLayer = this._getObjectsInLayer(layerId);
        const objectIds = objectsInLayer.map(obj => obj.id);
        
        this.stateManager.set('selectedObjects', new Set(objectIds));
        
        Logger.layer.info(`Selected ${objectIds.length} objects in layer: ${level.getLayerById(layerId)?.name}`);
    }

    /**
     * Add all objects in layer to current selection
     */
    addAllObjectsInLayerToSelection(layerId) {
        const level = this.levelEditor.getLevel();
        const objectsInLayer = this._getObjectsInLayer(layerId);
        const objectIds = objectsInLayer.map(obj => obj.id);
        const currentSelection = new Set(this.stateManager.get('selectedObjects') || []);
        
        // Add objects from layer to current selection
        objectIds.forEach(id => currentSelection.add(id));
        
        this.stateManager.set('selectedObjects', currentSelection);
        
        Logger.layer.info(`Added ${objectIds.length} objects from layer "${level.getLayerById(layerId)?.name}" to selection (total: ${currentSelection.size})`);
    }


    /**
     * Move all objects from specified layer to main layer
     */
    moveObjectsToMainLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const mainLayerId = level.getMainLayerId();
        const objectsInLayer = level.getLayerObjects(layerId);
        
        objectsInLayer.forEach(obj => {
            level.assignObjectToLayer(obj.id, mainLayerId);
        });
        
        Logger.layer.info(`Moved ${objectsInLayer.length} objects to main layer before deleting layer`);
    }

    /**
     * Delete layer
     */
    async deleteLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        
        if (!layer || layerId === level.getMainLayerId()) return;

        if (await confirm(`Delete layer "${layer.name}"? All objects in this layer will be moved to the main layer.`)) {
            // Move objects to main layer before deleting
            this.moveObjectsToMainLayer(layerId);
            
            // Remove selection from objects in this layer
            this.handleLayerVisibilityChanged(layerId, false);
            
            level.removeLayer(layerId);
            this.render();
            this.stateManager.markDirty();

            if (this.levelEditor.renderOperations) {
                this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
            }
            
            // Update global stats
            this.updateLayersStats();
            
            Logger.layer.info(`Deleted layer: ${layer.name}`);
        }
    }


    /**
     * Setup search functionality
     */
    setupSearch() {
        const searchInput = this.container.querySelector(`#${this.searchInputId}`)
            || this.container.querySelector('input[type="text"]');
        if (!searchInput) return;

        SearchUtils.setupSearchListeners(searchInput, (searchTerm) => {
            this.searchFilter = searchTerm;
            this.render();
        });
    }


    /**
     * Show layers menu
     */
    showLayersMenu(event) {
        // Remove existing context menu
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }

        const contextMenu = document.createElement('div');
        contextMenu.className = 'fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 py-1 min-w-48';

        // Use BaseContextMenu positioning logic
        // Create a temporary menu element to measure dimensions
        const tempMenu = document.createElement('div');
        tempMenu.className = 'fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 py-1 min-w-48';
        tempMenu.style.visibility = 'hidden';
        tempMenu.style.position = 'absolute';
        document.body.appendChild(tempMenu);

        // Add temporary menu items to measure height
        const tempMenuItems = [
            { text: 'Show All Layers', icon: '👁️' },
            { text: 'Hide All Layers', icon: '👁️‍🗨️' },
            { text: '---' },
            { text: 'Lock All Layers', icon: '🔒' },
            { text: 'Unlock All Layers', icon: '🔓' }
        ];

        tempMenuItems.forEach(item => {
            if (item.text === '---') {
                const separator = document.createElement('div');
                separator.className = 'h-px bg-gray-600 my-1';
                tempMenu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'px-3 py-2 text-sm flex items-center space-x-2';
                menuItem.innerHTML = `<span>${item.icon}</span><span>${item.text}</span>`;
                tempMenu.appendChild(menuItem);
            }
        });

        // Calculate optimal position using BaseContextMenu logic
        const menuSize = {
            width: tempMenu.offsetWidth || 192,
            height: tempMenu.offsetHeight || 120
        };
        document.body.removeChild(tempMenu);

        // Simple positioning logic (can be improved to use full BaseContextMenu.calculateOptimalPosition)
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        const margins = { horizontal: 10, vertical: 10 };

        let x = event.clientX;
        let y = event.clientY;

        // Horizontal positioning
        if (event.clientX + menuSize.width + margins.horizontal > viewport.width) {
            x = event.clientX - menuSize.width;
        }
        if (x < margins.horizontal) {
            x = margins.horizontal;
        }

        // Vertical positioning
        if (event.clientY + menuSize.height + margins.vertical > viewport.height) {
            y = event.clientY - menuSize.height;
        }
        if (y < margins.vertical) {
            y = margins.vertical;
        }

        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';

        const menuItems = [
            {
                text: 'Show All Layers',
                icon: '👁️',
                action: () => this.showAllLayers()
            },
            {
                text: 'Hide All Layers',
                icon: '👁️‍🗨️',
                action: () => this.hideAllLayers()
            },
            { text: '---', enabled: false },
            {
                text: 'Lock All Layers',
                icon: '🔒',
                action: () => this.lockAllLayers()
            },
            {
                text: 'Unlock All Layers',
                icon: '🔓',
                action: () => this.unlockAllLayers()
            }
        ];

        menuItems.forEach(item => {
            if (item.text === '---') {
                const separator = document.createElement('div');
                separator.className = 'base-context-menu-item separator';
                contextMenu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 flex items-center space-x-2';
                menuItem.style.color = 'var(--ui-text-color, #e5e7eb)';
                menuItem.innerHTML = `<span>${item.icon}</span><span>${item.text}</span>`;
                menuItem.addEventListener('click', () => {
                    item.action();
                    contextMenu.remove();
                    this.contextMenu = null;
                });
                contextMenu.appendChild(menuItem);
            }
        });

        document.body.appendChild(contextMenu);
        this.contextMenu = contextMenu;

        // Close context menu when clicking outside
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                this.contextMenu = null;
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }


    /**
     * Show all layers
     */
    showAllLayers() {
        const level = this.levelEditor.getLevel();
        level.layers.forEach(layer => {
            if (!layer.visible) {
                layer.toggleVisibility();
                this.updateLayerElement(layer.id, layer);
                // Call handler to update object visibility
                this.handleLayerVisibilityChanged(layer.id, true);
            }
        });
        
        // Invalidate layer visibility cache to ensure objects are re-rendered
        this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
        
        this.stateManager.markDirty();
        this.render();
        
        // Force re-render to show objects from newly visible layers
        this.levelEditor.render();
    }

    /**
     * Hide all layers
     */
    hideAllLayers() {
        const level = this.levelEditor.getLevel();
        level.layers.forEach(layer => {
            if (layer.visible) {
                layer.toggleVisibility();
                this.updateLayerElement(layer.id, layer);
                // Call handler to update object visibility
                this.handleLayerVisibilityChanged(layer.id, false);
            }
        });
        
        // Invalidate layer visibility cache to ensure objects are re-rendered
        this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
        
        this.stateManager.markDirty();
        this.render();
        
        // Force re-render to hide objects from newly hidden layers
        this.levelEditor.render();
    }

    /**
     * Lock all layers
     */
    lockAllLayers() {
        const level = this.levelEditor.getLevel();
        level.layers.forEach(layer => {
            if (!layer.locked) {
                layer.toggleLock();
                this.updateLayerElement(layer.id, layer);
                this.handleLayerLockChanged(layer.id, true);
            }
        });
        this.stateManager.markDirty();
        this.render();
    }

    /**
     * Unlock all layers
     */
    unlockAllLayers() {
        const level = this.levelEditor.getLevel();
        level.layers.forEach(layer => {
            if (layer.locked) {
                layer.toggleLock();
                this.updateLayerElement(layer.id, layer);
                this.handleLayerLockChanged(layer.id, false);
            }
        });
        this.stateManager.markDirty();
        this.render();
    }

    /**
     * Setup keyboard shortcuts for layers panel
     */
    /**
     * Setup layers panel handlers using new event system
     */
    setupLayersPanelHandlers() {
        // Check if already registered to avoid duplicate registration
        if (this._eventHandlersRegistered) {
            return;
        }
        
        // Create layers panel handlers configuration
        const layersHandlers = {
            click: {
                // Use wide selector to catch all clicks - EventHandlerManager will call handler
                // for any click where target or its parent matches selector
                selector: '.layer-item, .layer-color, button, [data-layer-id], .layers-list',
                handler: (e) => {
                    const target = e.target;
                    
                    // Handle color picker clicks first (before other handlers)
                    const colorIndicator = target.closest('.layer-color');
                    if (colorIndicator) {
                        e.stopPropagation(); // Prevent triggering layer click
                        const layerId = colorIndicator.dataset.layerId;
                        if (layerId) {
                            const level = this.levelEditor.getLevel();
                            const layer = level.getLayerById(layerId);
                            if (layer) {
                                this.showColorPicker(layer, e);
                            }
                        }
                        return;
                    }

                    // Handle button clicks
                    const button = target.closest('button');
                    if (button) {
                        // layer-visibility-btn / layer-lock-btn are handled on mousedown
                        // (see handleLayerIconMouseDown) so a plain click and a paint-drag
                        // both go through one code path — nothing to do here.
                        if (button.classList.contains('layer-visibility-btn') || button.classList.contains('layer-lock-btn')) {
                            return;
                        }

                        if (button.classList.contains('add-layer-btn')) {
                            this.onAddLayer(e);
                            return;
                        }
                        // Other buttons - let them handle their own clicks
                        return;
                    }

                    // Handle layer clicks (check for any element with data-layer-id)
                    // This must be last to catch clicks on layer items that weren't handled above
                    // Informative elements (.layer-name-display, .layer-objects-count) are transparent - clicks pass through
                    const layerElement = target.closest('.layer-item');
                    if (layerElement) {
                        const layerId = layerElement.dataset.layerId;
                        if (layerId) {
                            // Only handle if not clicking on interactive elements
                            const interactiveElement = target.closest('button, input, .layer-color');
                            if (!interactiveElement) {
                                this.handleLayerClick(e, layerId);
                            }
                        }
                        return;
                    }
                }
            },
            input: {
                selector: '.layer-parallax-input',
                handler: (e) => {
                    e.stopPropagation(); // Prevent triggering layer click
                    const layerId = e.target.closest('[data-layer-id]')?.dataset.layerId;
                    if (layerId) {
                        const level = this.levelEditor.getLevel();
                        const layer = level.getLayerById(layerId);
                        if (layer) {
                            const oldOffset = layer.parallaxOffset;
                            const newOffset = parseFloat(e.target.value) || 0;
                            layer.parallaxOffset = newOffset;
                            this.stateManager.markDirty();
                            // Notify about layer parallax change
                            this.stateManager.notifyLayerChanged(layerId, 'parallaxOffset', newOffset, oldOffset);
                        }
                    }
                }
            },
            blur: {
                selector: '.layer-parallax-input, .layer-name-input',
                handler: (e) => {
                    if (e.target.classList.contains('layer-parallax-input')) {
                        // Ensure value is valid for parallax
                        const value = parseFloat(e.target.value);
                        if (isNaN(value)) {
                            e.target.value = 0;
                            const layerId = e.target.closest('[data-layer-id]')?.dataset.layerId;
                            if (layerId) {
                                const level = this.levelEditor.getLevel();
                                const layer = level.getLayerById(layerId);
                                if (layer) {
                                    layer.parallaxOffset = 0;
                                }
                            }
                        }
                    } else if (e.target.classList.contains('layer-name-input')) {
                        // Handle layer name editing
                        const layerId = e.target.dataset.layerId;
                        const level = this.levelEditor.getLevel();
                        const layer = level.getLayerById(layerId);
                        if (layer) {
                            const oldName = layer.name;
                            layer.setName(e.target.value);
                            this.stateManager.markDirty();

                            // Notify about layer name change
                            this.stateManager.notifyLayerChanged(layerId, 'name', layer.name, oldName);
                            
                            // Update display text (name only)
                            const display = this.container.querySelector(`[data-layer-id="${layerId}"].layer-name-display`);
                            if (display) {
                                display.textContent = layer.name;
                            }
                            
                            // Update objects count in separate element
                            const countElement = this.container.querySelector(`[data-layer-id="${layerId}"].layer-objects-count`);
                            if (countElement) {
                                if (!this.levelEditor.cachedLevelStats) {
                                    this.levelEditor.updateCachedLevelStats();
                                }
                                const cachedStats = this.levelEditor.cachedLevelStats;
                                const objectsCount = level.getCachedLayerObjectsCount(layerId, cachedStats);
                                countElement.textContent = objectsCount > 0 ? objectsCount : '';
                            }
                            
                            // Hide input, show display
                            e.target.classList.add('hidden');
                            if (display) {
                                display.classList.remove('hidden');
                            }
                            
                            // Re-enable dragging for this layer
                            const layerElement = this.container.querySelector(`[data-layer-id="${layerId}"]`);
                            if (layerElement) {
                                layerElement.draggable = true;
                            }
                        }
                    }
                }
            },
            dblclick: {
                selector: '.layer-name-display',
                handler: (e) => {
                    e.stopPropagation();
                    this.renameLayer(e.target.dataset.layerId);
                }
            },
            keypress: {
                selector: '.layer-name-input',
                handler: (e) => {
                    if (e.key === 'Enter') {
                        e.target.blur();
                    }
                }
            },
            keydown: {
                selector: '.layer-name-input',
                handler: (e) => {
                    if (e.key === 'Escape') {
                        const layerId = e.target.dataset.layerId;
                        const level = this.levelEditor.getLevel();
                        const layer = level.getLayerById(layerId);
                        if (layer) {
                            // Restore original name
                            e.target.value = layer.name;
                            e.target.blur();
                        }
                    }
                }
            },
            contextmenu: {
                selector: '.layer-item, .layers-list',
                handler: (e) => {
                    // Handle context menu on layer items
                    const layerElement = e.target.closest('[data-layer-id]');
                    if (layerElement && layerElement.classList.contains('layer-item')) {
                        const layerId = layerElement.dataset.layerId;
                        const level = this.levelEditor.getLevel();
                        const layer = level.getLayerById(layerId);
                        if (layer) {
                            this.showLayerContextMenu(layer, e);
                        }
                        return;
                    }
                    
                    // Handle context menu on empty space in layers list
                    const layersList = e.target.closest('.layers-list');
                    if (layersList && !e.target.closest('[data-layer-id]')) {
                        e.preventDefault();
                        this.showLayersMenu(e);
                    }
                }
            },
            dragstart: {
                selector: '.layer-item',
                handler: (e) => {
                    const layersList = this._layersList || this.container.querySelector('.layers-list');
                    if (!layersList) return;

                    // Event target may be a child; row is the draggable source.
                    const row = e.target.closest('.layer-item');
                    if (!row || !layersList.contains(row)) return;

                    // Check if any layer name input is currently visible (renaming in progress)
                    const visibleInput = layersList.querySelector('.layer-name-input:not(.hidden)');
                    if (visibleInput) {
                        e.preventDefault();
                        return;
                    }

                    // Required for reliable HTML5 DnD (esp. Firefox); collapse must wait —
                    // applying .list-row-dragging here aborts the gesture in Chromium.
                    if (e.dataTransfer) {
                        e.dataTransfer.setData('text/plain', row.dataset.layerId || 'layer');
                        e.dataTransfer.effectAllowed = 'move';
                    }
                    this._draggedElement = row;
                    this._draggedRowHeight = row.offsetHeight;
                    row.style.opacity = '0.5';
                }
            },
            dragend: {
                selector: '.layer-item',
                handler: (e) => {
                    const row = e.target.closest('.layer-item') || this._draggedElement;
                    if (row) {
                        row.classList.remove('list-row-dragging');
                        row.style.opacity = '';
                    }
                    const layersList = this._layersList || this.container.querySelector('.layers-list');
                    clearListReorderPlaceholder(layersList);
                    this._draggedElement = null;
                    this._draggedRowHeight = 0;
                }
            },
            dragover: {
                selector: '.layers-list',
                handler: (e) => {
                    e.preventDefault();
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                    if (!this._draggedElement) return;
                    const layersList = this._layersList || this.container.querySelector('.layers-list');
                    if (!layersList) return;
                    // Collapse only after drag is live (safe on dragover, not dragstart)
                    if (!this._draggedElement.classList.contains('list-row-dragging')) {
                        this._draggedElement.classList.add('list-row-dragging');
                        this._draggedElement.style.opacity = '';
                    }
                    syncListReorderPlaceholder({
                        listEl: layersList,
                        draggedEl: this._draggedElement,
                        clientY: e.clientY,
                        isItem: (el) => el.classList.contains('layer-item'),
                        slotHeight: this._draggedRowHeight
                    });
                }
            },
            drop: {
                selector: '.layers-list',
                handler: (e) => {
                    e.preventDefault();
                    
                    if (!this._draggedElement) return;
                    
                    const layersList = this._layersList || this.container.querySelector('.layers-list');
                    if (!layersList) return;

                    const isItem = (el) => el.classList.contains('layer-item');
                    // Final slot sync so drop without a recent dragover still matches cursor Y
                    syncListReorderPlaceholder({
                        listEl: layersList,
                        draggedEl: this._draggedElement,
                        clientY: e.clientY,
                        isItem,
                        slotHeight: this._draggedRowHeight
                    });

                    const draggedId = this._draggedElement.dataset.layerId;
                    const newOrder = getListOrderAfterReorder(layersList, 'layerId', draggedId, isItem);

                    clearListReorderPlaceholder(layersList);
                    this._draggedElement.classList.remove('list-row-dragging');
                    this._draggedElement.style.opacity = '';
                    this._draggedElement = null;
                    this._draggedRowHeight = 0;

                    if (!newOrder) return;

                    const level = this.levelEditor.getLevel();
                    const currentOrder = level.layers.map((l) => l.id);
                    if (newOrder.length !== currentOrder.length) return;
                    if (newOrder.every((id, i) => id === currentOrder[i])) return;

                    level.reorderLayers(newOrder);
                    this.render();
                    this.stateManager.markDirty();
                }
            },
            mousedown: {
                selector: '.layer-visibility-btn, .layer-lock-btn',
                handler: (e) => this.handleLayerIconMouseDown(e)
            },
            mouseover: {
                selector: '.layer-visibility-btn, .layer-lock-btn',
                handler: (e) => this.handleLayerIconMouseOver(e)
            }
        };

        // Register container with new event manager
        eventHandlerManager.registerContainer(this.container, layersHandlers);

        // mouseup can land anywhere on the page once dragging off the panel, so end the
        // paint drag globally rather than only within this container.
        this._iconPaintDragHandlerId = this.instanceKey
            ? `layersPanel-iconPaintDrag-${this.instanceKey}`
            : 'layersPanel-iconPaintDrag';
        eventHandlerManager.registerGlobalHandlers({
            mouseup: () => this._endIconPaintDrag()
        }, this._iconPaintDragHandlerId);

        Logger.ui.debug('LayersPanel: New event handlers setup complete');

        // Mark as registered to avoid duplicate registration
        this._eventHandlersRegistered = true;
    }

    /**
     * mousedown on a layer's eye/lock icon: apply the toggled state immediately (so a plain
     * click still works) and, unless Ctrl/Cmd was held (solo — a single-shot action, not a
     * paintable state), arm paint-drag mode so dragging over more icons of the same type
     * paints them to the same value before mouseup.
     * @param {MouseEvent} e
     */
    handleLayerIconMouseDown(e) {
        const button = e.target.closest('.layer-visibility-btn, .layer-lock-btn');
        if (!button) return;
        const layerId = button.dataset.layerId;
        if (!layerId) return;
        // NOT button.closest('[data-layer-id]') — every child in the row (name, count,
        // both buttons, parallax input) carries its own data-layer-id, so closest() on the
        // button matches the button itself, not the row. That silently no-oped the
        // draggable-suspend below (row draggable stayed true), which real mouse drags then
        // hijacked into native row-reorder instead of paint-drag — .layer-item is unambiguous.
        const layerElement = button.closest('.layer-item');
        if (!layerElement) return;
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        if (button.classList.contains('layer-visibility-btn')) {
            if (e.ctrlKey || e.metaKey) {
                this.toggleLayerSolo(layerId);
                return;
            }
            e.preventDefault();
            this._startIconPaintDrag('visibility', !layer.visible, layerElement);
            this._paintLayerVisibility(layerId, this._iconPaintDrag.value);
        } else if (button.classList.contains('layer-lock-btn')) {
            e.preventDefault();
            this._startIconPaintDrag('lock', !layer.locked, layerElement);
            this._paintLayerLock(layerId, this._iconPaintDrag.value);
        }
    }

    /**
     * mouseover during an active paint drag: apply the armed target value to the icon of the
     * same type under the cursor (icons already at that value are left alone — a paint, not
     * a re-toggle, so passing back over an already-painted icon doesn't flip it again).
     * @param {MouseEvent} e
     */
    handleLayerIconMouseOver(e) {
        if (!this._iconPaintDrag) return;
        const button = e.target.closest('.layer-visibility-btn, .layer-lock-btn');
        if (!button) return;
        const layerId = button.dataset.layerId;
        if (!layerId) return;

        if (this._iconPaintDrag.type === 'visibility' && button.classList.contains('layer-visibility-btn')) {
            this._paintLayerVisibility(layerId, this._iconPaintDrag.value);
        } else if (this._iconPaintDrag.type === 'lock' && button.classList.contains('layer-lock-btn')) {
            this._paintLayerLock(layerId, this._iconPaintDrag.value);
        }
    }

    /**
     * @param {'visibility'|'lock'} type
     * @param {boolean} value - state to paint onto every icon of this type until mouseup
     * @param {HTMLElement} layerElement - the .layer-item the drag started on
     */
    _startIconPaintDrag(type, value, layerElement) {
        this._iconPaintDrag = { type, value };
        // A nested mousedown+move inside a draggable="true" .layer-item would otherwise be
        // hijacked into an HTML5 row-reorder drag (see dragstart above) instead of painting —
        // suspend it for just this row, mirroring the rename-input precedent further down.
        if (layerElement && layerElement.draggable) {
            this._draggableSuspendedRow = layerElement;
            layerElement.draggable = false;
        }
    }

    /**
     * mouseup (global): close out the paint drag, restore suspended dragging, and run the
     * cache-invalidate/render/outliner-refresh tail exactly once for the whole gesture —
     * mirrors showAllLayers/hideAllLayers, which batch the same tail after their loop
     * instead of paying it per layer.
     */
    _endIconPaintDrag() {
        if (!this._iconPaintDrag) return;
        const { type } = this._iconPaintDrag;
        this._iconPaintDrag = null;
        if (this._draggableSuspendedRow) {
            this._draggableSuspendedRow.draggable = true;
            this._draggableSuspendedRow = null;
        }

        if (type === 'visibility') {
            if (this.levelEditor.renderOperations) {
                this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
            }
            this.stateManager.markDirty();
            this.render();
            if (this.levelEditor.renderOperations) {
                this.levelEditor.render();
            }
            this.updateLayerStyles();
            if (this.levelEditor.outlinerPanel) {
                this.levelEditor.outlinerPanel.render();
            }
        } else if (type === 'lock') {
            this.stateManager.markDirty();
            this.render();
        }
    }

    /**
     * Apply visibility=targetValue to one layer during a paint drag: mutate the model + this
     * row's DOM. The expensive canvas/outliner-refresh tail is batched once in
     * _endIconPaintDrag rather than paid per icon crossed while dragging — but the layer-
     * visibility-IDs cache IS invalidated here (cheap: a couple of Set/Map ops, see
     * RenderOperations.invalidateLayerVisibilityCache), because updateLayerElement's icon
     * shape/row-opacity read straight from that cache. Leaving it stale until mouseup made
     * every icon crossed during the drag show the PRE-drag state until release.
     * @param {string} layerId
     * @param {boolean} targetValue
     */
    _paintLayerVisibility(layerId, targetValue) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer || layer.visible === targetValue) return;

        layer.toggleVisibility();
        if (this.levelEditor.renderOperations) {
            this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
        }
        this.updateLayerElement(layerId, layer);
        this.handleLayerVisibilityChanged(layerId, layer.visible);
    }

    /**
     * Apply locked=targetValue to one layer during a paint drag. See _paintLayerVisibility.
     * @param {string} layerId
     * @param {boolean} targetValue
     */
    _paintLayerLock(layerId, targetValue) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer || layer.locked === targetValue) return;

        layer.toggleLock();
        this.updateLayerElement(layerId, layer);
        this.handleLayerLockChanged(layerId, layer.locked);
    }

    /**
     * Handle layer click events
     * @param {Event} e - Click event
     * @param {string} layerId - Layer ID
     */
    handleLayerClick(e, layerId) {
        // Handle Shift+Ctrl/Cmd+click to add all objects in layer to current selection
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            this.addAllObjectsInLayerToSelection(layerId);
            this.levelEditor.updateAllPanels();
            return;
        }
        
        // Handle Ctrl/Cmd+click to select all objects in layer (replace selection)
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            this.selectAllObjectsInLayer(layerId);
            this.levelEditor.updateAllPanels();
            return;
        }
        
        // Handle single click to set current layer
        if (e.detail === 1) {
            this.setCurrentLayerAndNotify(layerId);
        }
        
        // Handle double click to rename layer
        if (e.detail === 2) {
            this.renameLayer(layerId);
        }
    }

    /**
     * Update layer parallax offset
     * @param {string} layerId - Layer ID
     * @param {number} value - Parallax value
     */
    updateLayerParallax(layerId, value) {
        const level = this.levelEditor.getLevel();
        if (level) {
            const layer = level.getLayerById(layerId);
            if (layer) {
                layer.parallaxOffset = value;
                this.stateManager.set('layerChanged', { layerId, property: 'parallaxOffset', value });
            }
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when no input is focused
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' || 
                activeElement.contentEditable === 'true'
            );

            if (isInputFocused) return;

            const shortcuts = this.levelEditor.configManager?.getShortcuts()?.ui || {};

            const matches = (actionName) => {
                const def = shortcuts[actionName];
                if (!def?.key) return false;
                const eCtrl = !!(e.ctrlKey || e.metaKey);
                const defCtrl = !!(def.ctrlKey || def.metaKey);
                return e.key.toLowerCase() === def.key.toLowerCase()
                    && eCtrl        === defCtrl
                    && !!e.shiftKey === !!def.shiftKey
                    && !!e.altKey   === !!def.altKey;
            };

            if (matches('focusLayersSearch')) {
                e.preventDefault();
                SearchUtils.focusSearch('layers-search');
            } else if (matches('addNewLayer')) {
                e.preventDefault();
                const level = this.levelEditor.getLevel();
                const newLayer = level.addLayer();
                if (this.levelEditor.renderOperations) {
                    this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
                }
                this.render();
                this.stateManager.markDirty();
                Logger.layer.info(`Added new layer: ${newLayer.name}`);
            }
        });
    }



    /**
     * Set current layer and notify other components
     */
    setCurrentLayerAndNotify(layerId) {
        this.setCurrentLayer(layerId);
        
        // Use LevelEditor's method to set current layer
        this.levelEditor.setCurrentLayer(layerId);
        
        // Update all panels to reflect the change
        this.levelEditor.updateAllPanels();
    }
    
    /**
     * Cleanup and destroy panel
     */
    destroy() {
        // Remove event handlers using new system
        eventHandlerManager.unregisterContainer(this.container);
        eventHandlerManager.unregisterGlobalHandlers(
            this._iconPaintDragHandlerId || 'layersPanel-iconPaintDrag'
        );

        // Also unregister top section
        const topSection = this.panelElements?.topCustom;
        if (topSection) {
            eventHandlerManager.unregisterContainer(topSection);
        }

        this._eventHandlersRegistered = false;
        this._iconPaintDrag = null;
        this._draggableSuspendedRow = null;
        this._topSectionHandlersRegistered = false;
        
        // Unsubscribe from all state changes
        this.subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                Logger.ui.warn('Failed to unsubscribe:', error);
            }
        });
        this.subscriptions = [];
        
        // Unregister search from SearchManager
        searchManager.unregisterSearch(this.searchPanelId || 'layers');

        // Destroy context menu
        if (this.layerContextMenu) {
            try {
                this.layerContextMenu.destroy();
            } catch (error) {
                Logger.ui.warn('Failed to destroy layer context menu:', error);
            }
            this.layerContextMenu = null;
        }

        // Call parent destroy
        super.destroy();
        
        // Clear references
        this.currentLayerId = null;
        this.searchFilter = '';
        this.contextMenu = null;
        
    }
}
