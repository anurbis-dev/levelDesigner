import { UIFactory } from '../utils/UIFactory.js';
import { Logger } from '../utils/Logger.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { BasePanel } from './BasePanel.js';
import { LayersContextMenu } from './LayersContextMenu.js';
import { HoverEffects } from '../utils/HoverEffects.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { createLayersPanelStructure, renderLayersControls } from './panel-structures/LayersPanelStructure.js';
import { searchManager } from '../utils/SearchManager.js';

/**
 * Layers panel UI component
 */
export class LayersPanel extends BasePanel {
    constructor(container, stateManager, levelEditor) {
        super(container, stateManager, levelEditor);
        this.activeLayerId = null; // Track active layer (for border highlight)
        this.currentLayerId = null; // Track current layer (for new objects, blue highlight)
        this.searchFilter = ''; // Search filter for layers
        this.contextMenu = null; // Context menu instance
        this._draggedElement = null; // Track dragged element for drag and drop

        // Track subscriptions for cleanup
        this.subscriptions = [];

        // Initialize panel structure
        this.panelElements = createLayersPanelStructure(this.container);

        // Register search in universal search manager
        searchManager.registerSearch(
            'layers',
            'layers-search',
            (searchFilter) => {
                this.searchFilter = searchFilter;
                this.renderLayersSection();
            },
            () => {
                // Clear callback - could be used for additional cleanup
            }
        );
        this.layerContextMenu = null; // Layer context menu reference

        this.setupContextMenus();
        this.setupEventListeners();
    }

    /**
     * Setup context menus for layers
     */
    setupContextMenus() {
        // Layer context menu - use the panel element, not the inner container
        this.layerContextMenu = new LayersContextMenu(this.container.parentElement, this, {
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
            this.levelEditor.contextMenuManager.registerMenu('layers', this.layerContextMenu);
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

    /**
     * Setup context menu for the layers list area (empty space)
     * @param {HTMLElement} targetContainer - Container to attach context menu to
     */
    setupLayersListContextMenu(targetContainer) {
        // Context menu is now handled by EventHandlerManager in setupLayersPanelHandlers
        // This method is kept for compatibility
    }

    render() {
        // Save search input state before clearing
        const searchInput = document.getElementById('layers-search');
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
            const newSearchInput = document.getElementById('layers-search');
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

        // Check if layers panel is currently active
        const layersPanel = document.getElementById('layers-content-panel');
        if (!layersPanel || layersPanel.classList.contains('hidden')) {
            return; // Don't render if layers is not active
        }


        // Check if controls are already rendered (avoid unnecessary re-rendering)
        const searchInput = topSection.querySelector('#layers-search');
        const addButton = topSection.querySelector('#add-layer-btn');


        if (searchInput && addButton) {
            // Controls already exist, just update search value
            const currentTerm = searchManager.getSearchTerm('layers');
            if (searchInput.value !== currentTerm) {
                searchInput.value = currentTerm;
            }

            // Always check and ensure search listeners are properly set up
            if (!searchInput.hasAttribute('data-search-managed')) {
                searchManager.setupSearchListeners('layers');
            } else {
            }

            return;
        }



        // Use the structure's render function with callbacks
        renderLayersControls(topSection, {
            getSearchFilter: () => searchManager.getSearchTerm('layers'),
            onSearch: (searchFilter) => {
                this.searchFilter = searchFilter;
                this.renderLayersSection();
            },
            onAddLayer: null
        });

        // Setup button event listeners (search is handled by SearchManager, add button by createButton)

        // Immediately ensure search listeners are set up after creating new controls
        const newSearchInput = topSection.querySelector('#layers-search');
        if (newSearchInput && !newSearchInput.hasAttribute('data-search-managed')) {
            searchManager.setupSearchListeners('layers');
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

        // Clear container but preserve custom sections
        // Remove all children except custom sections
        const children = Array.from(this.container.children);
        children.forEach(child => {
            if (!child.classList.contains('panel-top-custom') &&
                !child.classList.contains('panel-bottom-custom')) {
                this.container.removeChild(child);
            }
        });

        // Ensure custom sections exist (recreate if needed)
        if (!this.panelElements?.topCustom || !this.container.contains(this.panelElements.topCustom)) {
            this.panelElements = createLayersPanelStructure(this.container);
        }

        // Render layers controls in top custom section
        this.renderLayersSearchControls();

        // Layers list container
        const layersList = document.createElement('div');
        layersList.className = 'layers-list space-y-1';
        layersList.id = 'layers-list';

        // Filter layers based on search
        const filteredLayers = this.filterLayers(layers);

        // Render each layer
        filteredLayers.forEach(layer => {
            const layerElement = this.createLayerElement(layer);
            layersList.appendChild(layerElement);
        });

        this.container.appendChild(layersList);

        // Setup scrolling using BasePanel - target the actual scrollable container
        const rightPanel = this.container.closest('#right-panel');
        const scrollableContainer = rightPanel?.querySelector('.flex-grow.overflow-y-auto');

        this.setupScrolling({
            horizontal: false,
            vertical: true,
            sensitivity: 1.0,
            target: scrollableContainer || rightPanel
        });

        // Setup context menu for the layers list area
        this.setupLayersListContextMenu(layersList);

        // Update layer styles to show current layer highlight
        this.updateLayerStyles();

        // Setup event listeners for layer elements
        this.setupLayersEventListeners();
        
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
        const isActive = this.activeLayerId === layer.id;
        const isCurrent = this.currentLayerId === layer.id;
        
        const layerDiv = document.createElement('div');
        layerDiv.className = `layer-item flex items-center justify-between p-2 rounded border border-gray-600 cursor-pointer transition-colors ${
            isCurrent ? 'bg-blue-600' : 'bg-gray-700'
        }`;
        layerDiv.draggable = true;
        layerDiv.dataset.layerId = layer.id;
        
        layerDiv.innerHTML = `
            <div class="flex items-center space-x-2 flex-1 min-w-0">
                <div class="layer-color w-4 h-4 rounded-full cursor-pointer border-2 border-gray-500"
                     data-layer-id="${layer.id}"
                     data-color="${layer.color}"
                     title="Click to change color"></div>
                <div class="flex items-center space-x-1 flex-1 min-w-0">
                    <span class="layer-name-display flex-1 px-1 py-1 rounded min-w-0" style="color: var(--ui-text-color, #d1d5db);"
                          data-layer-id="${layer.id}">${layer.name}</span>
                    <input type="text"
                           id="layer-name-${layer.id}"
                           name="layer-name-${layer.id}"
                           value="${layer.name}"
                           class="layer-name-input bg-transparent border-none flex-1 focus:outline-none focus:bg-gray-600 px-1 rounded min-w-0 hidden" style="color: var(--ui-text-color, #d1d5db);"
                           data-layer-id="${layer.id}">
                </div>
            </div>
            <div class="flex items-center space-x-1 flex-shrink-0">
                <span class="layer-objects-count text-sm px-2 py-1 rounded bg-gray-600 min-w-0" style="color: var(--ui-text-color, #9ca3af);"
                      data-layer-id="${layer.id}">${objectsCount > 0 ? objectsCount : ''}</span>
                <button class="layer-visibility-btn p-1 rounded w-8 h-8 flex items-center justify-center" 
                        data-layer-id="${layer.id}" 
                        title="${layer.visible ? 'Hide layer' : 'Show layer'}">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style="color: ${layer.visible ? 'var(--ui-text-color, #d1d5db)' : 'var(--ui-text-color, #6b7280)'};">
                        ${layer.visible ? 
                            '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>' :
                            '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>'
                        }
                    </svg>
                </button>
                <button class="layer-lock-btn p-1 rounded w-8 h-8 flex items-center justify-center" 
                        data-layer-id="${layer.id}" 
                        title="${layer.locked ? 'Unlock layer' : 'Lock layer'}">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style="color: ${layer.locked ? 'var(--ui-text-color, #d1d5db)' : 'var(--ui-text-color, #6b7280)'};">
                        ${layer.locked ? 
                            '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>' :
                            '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>'
                        }
                    </svg>
                </button>
                <input type="number"
                       id="layer-parallax-${layer.id}"
                       class="layer-parallax-input bg-gray-600 border border-gray-500 text-xs rounded px-1 py-1 w-12 h-8 text-center focus:outline-none focus:border-blue-500" style="color: var(--ui-text-color, #d1d5db);"
                       data-layer-id="${layer.id}"
                       value="${layer.parallaxOffset}"
                       step="0.1"
                       min="-10"
                       max="10"
                       title="Parallax offset (0 = no parallax, negative = slower, positive = faster)">
            </div>
        `;
        
        // Setup hover effects and set color using CSS variable
        const colorElement = layerDiv.querySelector('.layer-color');
        if (colorElement) {
            colorElement.style.setProperty('--layer-color', layer.color);
            HoverEffects.setupColorHover(colorElement);
        }
        
        // Setup hover effect for the main layer container
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
        
        // Handle color change
        colorInput.addEventListener('change', (e) => {
            const oldColor = layer.color;
            const newColor = e.target.value;
            layer.color = newColor;
            this.updateLayerElement(layer.id, layer);
            this.stateManager.markDirty();

            // Notify about layer color change
            this.stateManager.notifyLayerChanged(layer.id, 'color', newColor, oldColor);
            
            // Clean up
            if (document.body.contains(colorInput)) {
                document.body.removeChild(colorInput);
            }
        });
        
        // Handle escape key or focus loss
        const cleanup = () => {
            if (document.body.contains(colorInput)) {
                document.body.removeChild(colorInput);
            }
        };
        
        colorInput.addEventListener('blur', cleanup);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cleanup();
            }
        }, { once: true });
    }

    /**
     * Set active layer (for border highlight only)
     */
    setActiveLayer(layerId) {
        this.activeLayerId = layerId;
        this.updateLayerStyles();
    }

    /**
     * Update layer element visual state without recreating it
     */
    updateLayerElement(layerId, layer) {
        const layerElement = this.container.querySelector(`[data-layer-id="${layerId}"]`);
        if (!layerElement) return;

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

        // Update background color based on current state
        const isCurrent = this.currentLayerId === layerId;
        
        if (isCurrent) {
            layerElement.classList.remove('bg-gray-700');
            layerElement.classList.add('bg-blue-600');
        } else {
            layerElement.classList.remove('bg-blue-600');
            layerElement.classList.add('bg-gray-700');
        }

        // Update visibility button icon and title
        const visibilityBtn = layerElement.querySelector('.layer-visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
            const svg = visibilityBtn.querySelector('svg');
            if (svg) {
                svg.setAttribute('class', 'w-4 h-4');
                svg.style.color = layer.visible ? 'var(--ui-text-color, #d1d5db)' : 'var(--ui-text-color, #6b7280)';
                svg.innerHTML = layer.visible ? 
                    '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>' :
                    '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>';
            }
        }

        // Update lock button icon and title
        const lockBtn = layerElement.querySelector('.layer-lock-btn');
        if (lockBtn) {
            lockBtn.title = layer.locked ? 'Unlock layer' : 'Lock layer';
            const svg = lockBtn.querySelector('svg');
            if (svg) {
                svg.setAttribute('class', 'w-4 h-4');
                svg.style.color = layer.locked ? 'var(--ui-text-color, #d1d5db)' : 'var(--ui-text-color, #6b7280)';
                svg.innerHTML = layer.locked ? 
                    '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>' :
                    '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>';
            }
        }
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
     * Setup layers event listeners
     * All handlers are now managed by EventHandlerManager in setupLayersPanelHandlers()
     */
    setupLayersEventListeners() {
        // All event handlers are registered via EventHandlerManager in setupLayersPanelHandlers()
        // This method is kept for compatibility
    }

    /**
     * Setup drag and drop for layer reordering
     * Handlers are registered via EventHandlerManager in setupLayersPanelHandlers()
     */
    setupLayersDragAndDrop() {
        // Drag and drop handlers are registered via EventHandlerManager in setupLayersPanelHandlers()
        // This method is kept for compatibility
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
        
        const statsElement = document.getElementById('layers-stats');
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

            // Invalidate layer visibility cache for performance
            if (this.levelEditor.renderOperations) {
                this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
                this.levelEditor.render();
            }

            // Update layer styles after visibility change
            this.updateLayerStyles();
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
        const searchInput = document.getElementById('layers-search');
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
                        if (button.classList.contains('layer-visibility-btn')) {
                            const layerId = button.closest('[data-layer-id]')?.dataset.layerId;
                            if (layerId) {
                                this.toggleLayerVisibility(layerId);
                            }
                            return;
                        }
                        
                        if (button.classList.contains('layer-lock-btn')) {
                            const layerId = button.closest('[data-layer-id]')?.dataset.layerId;
                            if (layerId) {
                                this.toggleLayerLock(layerId);
                            }
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
                    const layerId = e.target.dataset.layerId;
                    const level = this.levelEditor.getLevel();
                    const layer = level.getLayerById(layerId);
                    if (layer) {
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
                    const layersList = document.getElementById('layers-list');
                    if (!layersList) return;
                    
                    if (e.target.classList.contains('layer-item')) {
                        // Check if any layer name input is currently visible (renaming in progress)
                        const visibleInput = layersList.querySelector('.layer-name-input:not(.hidden)');
                        if (visibleInput) {
                            e.preventDefault();
                            return;
                        }
                        
                        this._draggedElement = e.target;
                        e.target.style.opacity = '0.5';
                    }
                }
            },
            dragend: {
                selector: '.layer-item',
                handler: (e) => {
                    if (e.target.classList.contains('layer-item')) {
                        e.target.style.opacity = '1';
                        this._draggedElement = null;
                    }
                }
            },
            dragover: {
                selector: '.layers-list',
                handler: (e) => {
                    e.preventDefault();
                }
            },
            drop: {
                selector: '.layers-list',
                handler: (e) => {
                    e.preventDefault();
                    
                    if (!this._draggedElement) return;
                    
                    const dropTarget = e.target.closest('.layer-item');
                    if (!dropTarget || dropTarget === this._draggedElement) return;
                    
                    const layersList = document.getElementById('layers-list');
                    if (!layersList) return;
                    
                    const level = this.levelEditor.getLevel();
                    
                    // Get current order
                    const currentOrder = Array.from(layersList.children).map(el => el.dataset.layerId);
                    
                    // Find positions
                    const draggedIndex = currentOrder.indexOf(this._draggedElement.dataset.layerId);
                    const dropIndex = currentOrder.indexOf(dropTarget.dataset.layerId);
                    
                    if (draggedIndex === -1 || dropIndex === -1) return;
                    
                    // Reorder array
                    const newOrder = [...currentOrder];
                    newOrder.splice(draggedIndex, 1);
                    newOrder.splice(dropIndex, 0, this._draggedElement.dataset.layerId);
                    
                    // Update layer order
                    level.reorderLayers(newOrder);
                    this.render();
                    this.stateManager.markDirty();
                }
            }
        };

        // Register container with new event manager
        eventHandlerManager.registerContainer(this.container, layersHandlers);

        Logger.ui.debug('LayersPanel: New event handlers setup complete');
        
        // Mark as registered to avoid duplicate registration
        this._eventHandlersRegistered = true;
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
            // Only handle shortcuts when layers panel is focused or no other input is focused
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' || 
                activeElement.contentEditable === 'true'
            );

            if (isInputFocused) return;

            // Ctrl/Cmd + L: Focus layers search
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                SearchUtils.focusSearch('layers-search');
            }

            // Ctrl/Cmd + Shift + L: Add new layer
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                const level = this.levelEditor.getLevel();
                const newLayer = level.addLayer();
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
        
        // Also unregister top section
        const topSection = this.panelElements?.topCustom;
        if (topSection) {
            eventHandlerManager.unregisterContainer(topSection);
        }
        
        this._eventHandlersRegistered = false;
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
        searchManager.unregisterSearch('layers');

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
        this.activeLayerId = null;
        this.currentLayerId = null;
        this.searchFilter = '';
        this.contextMenu = null;
        
    }
}
