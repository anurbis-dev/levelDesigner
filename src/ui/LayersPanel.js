import { UIFactory } from '../utils/UIFactory.js';
import { ColorChooser } from '../widgets/ColorChooser.js';
import { Logger } from '../utils/Logger.js';

/**
 * Layers panel UI component
 */
export class LayersPanel {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.activeLayerId = null; // Track active layer (for border highlight)
        this.currentLayerId = null; // Track current layer (for new objects, blue highlight)
        this.selectedLayers = new Set(); // Track selected layers for multi-selection
        this.searchFilter = ''; // Search filter for layers
        this.contextMenu = null; // Context menu instance

        this.setupEventListeners();
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
        // Subscribe to level changes
        this.stateManager.subscribe('level', () => {
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

        // Subscribe to selection changes
        this.stateManager.subscribe('selectedObjects', () => {
            this.updateLayerStyles();
        });

        // Subscribe to layer objects count changes for efficient updates
        this.stateManager.subscribe('layerObjectsCountChanged', (layerId, changeData) => {
            
            // Update only the specific layer's object count
            this.updateLayerObjectsCount(layerId);
        });

        // Subscribe to config changes (for active layer border color)
        if (this.levelEditor.configManager) {
            // Since ConfigManager doesn't have built-in events, we'll update on render
            // This could be enhanced by adding event system to ConfigManager if needed
        }

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    render() {
        this.container.innerHTML = '';

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
    }

    /**
     * Render layers management section
     */
    renderLayersSection() {
        const level = this.levelEditor.getLevel();
        const layers = level.getLayersSorted();
        
        const section = document.createElement('div');
        section.className = 'layers-section';
        
        // Header with search, stats and add button
        const header = document.createElement('div');
        header.className = 'layers-header mb-3';
        
        // Title and stats row
        const titleRow = document.createElement('div');
        titleRow.className = 'flex justify-between items-center mb-2';
        titleRow.innerHTML = `
            <h3 class="text-lg font-bold text-gray-200">Layers</h3>
            <div class="text-sm text-gray-400" id="layers-stats">0 layers</div>
        `;
        
        // Search and controls row
        const controlsRow = document.createElement('div');
        controlsRow.className = 'flex items-center space-x-2';
        controlsRow.innerHTML = `
            <input type="text" 
                   id="layers-search" 
                   placeholder="Search layers..." 
                   class="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                   value="${this.searchFilter}">
            <button id="add-layer-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                + Add
            </button>
            <button id="layers-menu-btn" class="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-sm" title="Layer options">
                ⋮
            </button>
        `;
        
        header.appendChild(titleRow);
        header.appendChild(controlsRow);
        
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
        
        // Update statistics
        this.updateLayersStats();
        
        section.appendChild(header);
        section.appendChild(layersList);
        
        this.container.appendChild(section);
        
        // Add event listeners
        this.setupLayersEventListeners();
        this.setupSearch();
        this.setupLayersMenu();
        
        // Update layer styles to show current layer highlight
        this.updateLayerStyles();
    }

    /**
     * Create layer element
     */
    createLayerElement(layer) {
        const level = this.levelEditor.getLevel();
        const cachedStats = this.levelEditor.cachedLevelStats;
        const objectsCount = level.getCachedLayerObjectsCount(layer.id, cachedStats);
        const countText = objectsCount > 0 ? ` (${objectsCount})` : '';
        const isMainLayer = layer.id === level.getMainLayerId();
        const isActive = this.activeLayerId === layer.id;
        const isCurrent = this.currentLayerId === layer.id;
        const isSelected = this.selectedLayers.has(layer.id);
        
        const layerDiv = document.createElement('div');
        layerDiv.className = `layer-item flex items-center justify-between p-2 rounded border border-gray-600 cursor-pointer transition-colors ${
            isSelected ? 'bg-blue-500' : 
            isCurrent ? 'bg-blue-600' : 
            'bg-gray-700 hover:bg-gray-600'
        }`;
        layerDiv.draggable = true;
        layerDiv.dataset.layerId = layer.id;
        
        layerDiv.innerHTML = `
            <div class="flex items-center space-x-2 flex-1 min-w-0">
                <div class="layer-color w-4 h-4 rounded-full cursor-pointer border-2 border-gray-500 hover:border-gray-300 transition-colors"
                     style="background-color: ${layer.color}"
                     data-layer-id="${layer.id}"
                     title="Click to change color"></div>
                <div class="flex items-center space-x-1 flex-1 min-w-0">
                    <span class="layer-name-display text-white flex-1 px-1 py-1 rounded min-w-0"
                          data-layer-id="${layer.id}">${layer.name}${countText}</span>
                    <input type="text"
                           id="layer-name-${layer.id}"
                           name="layer-name-${layer.id}"
                           value="${layer.name}"
                           class="layer-name-input bg-transparent border-none text-white flex-1 focus:outline-none focus:bg-gray-600 px-1 rounded min-w-0 hidden"
                           data-layer-id="${layer.id}">
                </div>
            </div>
            <div class="flex items-center space-x-1 flex-shrink-0">
                <button class="layer-visibility-btn p-1 rounded hover:bg-gray-600 w-8 h-8 flex items-center justify-center" 
                        data-layer-id="${layer.id}" 
                        title="${layer.visible ? 'Hide layer' : 'Show layer'}">
                    <svg class="w-4 h-4 ${layer.visible ? 'text-gray-300' : 'text-gray-500'}" fill="currentColor" viewBox="0 0 20 20">
                        ${layer.visible ? 
                            '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>' :
                            '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>'
                        }
                    </svg>
                </button>
                <button class="layer-lock-btn p-1 rounded hover:bg-gray-600 w-8 h-8 flex items-center justify-center" 
                        data-layer-id="${layer.id}" 
                        title="${layer.locked ? 'Unlock layer' : 'Lock layer'}">
                    <svg class="w-4 h-4 ${layer.locked ? 'text-gray-300' : 'text-gray-500'}" fill="currentColor" viewBox="0 0 20 20">
                        ${layer.locked ? 
                            '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>' :
                            '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>'
                        }
                    </svg>
                </button>
                <button class="layer-delete-btn p-1 rounded hover:bg-red-600 w-8 h-8 flex items-center justify-center ${isMainLayer ? 'opacity-50 cursor-not-allowed' : ''}" 
                        data-layer-id="${layer.id}" 
                        title="${isMainLayer ? 'Cannot delete main layer' : 'Delete layer'}"
                        ${isMainLayer ? 'disabled' : ''}>
                    <svg class="w-4 h-4 ${isMainLayer ? 'text-gray-500' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clip-rule="evenodd"/>
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        `;
        
        return layerDiv;
    }

    /**
     * Show color picker for layer
     */
    showColorPicker(layer, event) {
        // Create a hidden color input and trigger it
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = `color-picker-${layer.id}`;
        colorInput.name = `color-picker-${layer.id}`;
        colorInput.value = layer.color;
        colorInput.style.position = 'absolute';
        colorInput.style.left = '-9999px';
        colorInput.style.opacity = '0';
        colorInput.style.pointerEvents = 'none';
        
        // Add to body temporarily
        document.body.appendChild(colorInput);
        
        // Handle color change
        colorInput.addEventListener('change', (e) => {
            layer.color = e.target.value;
            this.updateLayerElement(layer.id, layer);
            this.stateManager.markDirty();
            
            // Clean up
            document.body.removeChild(colorInput);
        });
        
        // Handle cancel (click outside or escape)
        const cleanup = () => {
            if (document.body.contains(colorInput)) {
                document.body.removeChild(colorInput);
            }
        };
        
        // Clean up on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        
        document.addEventListener('keydown', escapeHandler);
        
        // Clean up after a delay (in case user doesn't interact)
        setTimeout(cleanup, 10000);
        
        // Trigger the color picker
        colorInput.click();
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
        const cachedStats = this.levelEditor.cachedLevelStats;
        const objectsCount = level.getCachedLayerObjectsCount(layerId, cachedStats);
        const countText = objectsCount > 0 ? ` (${objectsCount})` : '';
        const display = layerElement.querySelector('.layer-name-display');
        if (display) {
            display.textContent = layer.name + countText;
        }

        // Update background color based on current state
        const isCurrent = this.currentLayerId === layerId;
        const isSelected = this.selectedLayers.has(layerId);
        
        if (isSelected) {
            layerElement.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'bg-blue-600');
            layerElement.classList.add('bg-blue-500');
        } else if (isCurrent) {
            layerElement.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'bg-blue-500');
            layerElement.classList.add('bg-blue-600');
        } else {
            layerElement.classList.remove('bg-blue-500', 'bg-blue-600');
            layerElement.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }

        // Update visibility button icon and title
        const visibilityBtn = layerElement.querySelector('.layer-visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
            const svg = visibilityBtn.querySelector('svg');
            if (svg) {
                svg.className = `w-4 h-4 ${layer.visible ? 'text-gray-300' : 'text-gray-500'}`;
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
                svg.className = `w-4 h-4 ${layer.locked ? 'text-gray-300' : 'text-gray-500'}`;
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
        
        // Use cached statistics for better performance
        const cachedStats = this.levelEditor.cachedLevelStats;

        layers.forEach(layer => {
            const objectsCount = level.getCachedLayerObjectsCount(layer.id, cachedStats);
            const layerElement = this.container.querySelector(`[data-layer-id="${layer.id}"]`);
            if (layerElement) {
                const countSpan = layerElement.querySelector('.text-gray-400.text-sm');
                if (countSpan) {
                    countSpan.textContent = objectsCount > 0 ? ` (${objectsCount})` : '';
                }
            }
        });
    }

    /**
     * Update objects count for specific layer
     */
    updateLayerObjectsCount(layerId) {
        const level = this.levelEditor.getLevel();
        const cachedStats = this.levelEditor.cachedLevelStats;
        const objectsCount = level.getCachedLayerObjectsCount(layerId, cachedStats);
        
        const layerElement = this.container.querySelector(`[data-layer-id="${layerId}"]`);
        if (layerElement) {
            const countSpan = layerElement.querySelector('.text-gray-400.text-sm');
            if (countSpan) {
                countSpan.textContent = objectsCount > 0 ? ` (${objectsCount})` : '';
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

        // Get active layer border color from settings
        const activeLayerBorderColor = this.levelEditor.configManager?.get('selection.activeLayerBorderColor') || '#3B82F6';

        layerElements.forEach(element => {
            const layerId = element.dataset.layerId;
            const isActive = activeLayerIds.has(layerId);
            const isCurrent = this.currentLayerId === layerId;
            const isSelected = this.selectedLayers.has(layerId);

            // Update background color based on state priority: selected > current > default
            if (isSelected) {
                element.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'bg-blue-600');
                element.classList.add('bg-blue-500');
            } else if (isCurrent) {
                element.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'bg-blue-500');
                element.classList.add('bg-blue-600');
            } else {
                element.classList.remove('bg-blue-500', 'bg-blue-600');
                element.classList.add('bg-gray-700', 'hover:bg-gray-600');
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
     */
    setupLayersEventListeners() {
        const level = this.levelEditor.getLevel();
        
        // Add layer button - remove existing listeners first
        const addLayerBtn = document.getElementById('add-layer-btn');
        if (addLayerBtn) {
            // Clone the button to remove all event listeners
            const newAddLayerBtn = addLayerBtn.cloneNode(true);
            addLayerBtn.parentNode.replaceChild(newAddLayerBtn, addLayerBtn);
            
            newAddLayerBtn.addEventListener('click', () => {
                const newLayer = level.addLayer();
                this.render();
                this.stateManager.markDirty();

                // Invalidate cache when new layer is added
                if (this.levelEditor.renderOperations) {
                    this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
                }
            });
        }
        
        // Layer name editing - double click to edit
        const nameDisplays = this.container.querySelectorAll('.layer-name-display');
        nameDisplays.forEach(display => {
            display.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const layerId = e.target.dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer) {
                    const input = this.container.querySelector(`#layer-name-${layerId}`);
                    const display = this.container.querySelector(`[data-layer-id="${layerId}"].layer-name-display`);
                    
                    if (input && display) {
                        display.classList.add('hidden');
                        input.classList.remove('hidden');
                        input.focus();
                        input.select();
                    }
                }
            });
        });

        const nameInputs = this.container.querySelectorAll('.layer-name-input');
        nameInputs.forEach(input => {
            input.addEventListener('blur', (e) => {
                const layerId = e.target.dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer) {
                    layer.setName(e.target.value);
                    this.stateManager.markDirty();
                    
                    // Update display text
                    const display = this.container.querySelector(`[data-layer-id="${layerId}"].layer-name-display`);
                    if (display) {
                        const cachedStats = this.levelEditor.cachedLevelStats;
                        const objectsCount = level.getCachedLayerObjectsCount(layerId, cachedStats);
                        const countText = objectsCount > 0 ? ` (${objectsCount})` : '';
                        display.textContent = layer.name + countText;
                    }
                    
                    // Hide input, show display
                    e.target.classList.add('hidden');
                    display.classList.remove('hidden');
                }
            });
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        });
        
        // Visibility toggle
        const visibilityBtns = this.container.querySelectorAll('.layer-visibility-btn');
        visibilityBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layerId = e.target.closest('button').dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer) {
                    const wasVisible = layer.visible;
                    layer.toggleVisibility();
                    this.updateLayerElement(layerId, layer);
                    this.stateManager.markDirty();

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
                }

                // Update layer styles after visibility change
                this.updateLayerStyles();
            });
        });
        
        // Lock toggle
        const lockBtns = this.container.querySelectorAll('.layer-lock-btn');
        lockBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layerId = e.target.closest('button').dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer) {
                    const wasLocked = layer.locked;
                    layer.toggleLock();
                    this.updateLayerElement(layerId, layer);
                    this.stateManager.markDirty();

                    // Handle lock state changes
                    if (!wasLocked && layer.locked) {
                        // Layer became locked - remove selection from objects in this layer
                        this.handleLayerLockChanged(layerId, true);
                    } else if (wasLocked && !layer.locked) {
                        // Layer became unlocked - update outliner to show objects as selectable
                        this.handleLayerLockChanged(layerId, false);
                    }

                    // Update all panels to reflect changes (especially outliner)
                    this.levelEditor.updateAllPanels();
                }
            });
        });
        
        // Delete layer
        const deleteBtns = this.container.querySelectorAll('.layer-delete-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layerId = e.target.closest('button').dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer && layerId !== level.getMainLayerId()) {
                    if (confirm(`Delete layer "${layer.name}"?`)) {
                        // Handle layer deletion - remove selection and close groups before deleting
                        this.handleLayerVisibilityChanged(layerId, false);

                        level.removeLayer(layerId);
                        this.render();
                        this.stateManager.markDirty();

                        // Invalidate cache when layer is deleted
                        if (this.levelEditor.renderOperations) {
                            this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
                        }
                    }
                }
            });
        });
        
        // Layer click handler for current layer selection
        const layerItems = this.container.querySelectorAll('.layer-item');
        layerItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking on buttons or inputs
                if (e.target.closest('button') || e.target.closest('input')) {
                    return;
                }
                
                const layerId = e.currentTarget.dataset.layerId;
                
                if (e.ctrlKey || e.metaKey) {
                    // Multi-select mode
                    this.handleLayerSelection(layerId, e);
                } else {
                    // Set as current layer
                    this.setCurrentLayerAndNotify(layerId);
                }
            });

            // Context menu for layers
            item.addEventListener('contextmenu', (e) => {
                const layerId = e.currentTarget.dataset.layerId;
                const level = this.levelEditor.getLevel();
                const layer = level.getLayerById(layerId);
                if (layer) {
                    this.showLayerContextMenu(layer, e);
                }
            });
        });

        // Color picker for layers
        const colorIndicators = this.container.querySelectorAll('.layer-color');
        colorIndicators.forEach(indicator => {
            indicator.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering outside click handler
                const layerId = e.target.dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer) {
                    this.showColorPicker(layer, e);
                }
            });
        });
        
        // Drag and drop for reordering
        this.setupLayersDragAndDrop();
    }

    /**
     * Setup drag and drop for layer reordering
     */
    setupLayersDragAndDrop() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;
        
        let draggedElement = null;
        
        layersList.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('layer-item')) {
                draggedElement = e.target;
                e.target.style.opacity = '0.5';
            }
        });
        
        layersList.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('layer-item')) {
                e.target.style.opacity = '1';
                draggedElement = null;
            }
        });
        
        layersList.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        layersList.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (!draggedElement) return;
            
            const dropTarget = e.target.closest('.layer-item');
            if (!dropTarget || dropTarget === draggedElement) return;
            
            const level = this.levelEditor.getLevel();
            const layers = level.getLayersSorted();
            
            // Get current order
            const currentOrder = Array.from(layersList.children).map(el => el.dataset.layerId);
            
            // Find positions
            const draggedIndex = currentOrder.indexOf(draggedElement.dataset.layerId);
            const dropIndex = currentOrder.indexOf(dropTarget.dataset.layerId);
            
            if (draggedIndex === -1 || dropIndex === -1) return;
            
            // Reorder array
            const newOrder = [...currentOrder];
            newOrder.splice(draggedIndex, 1);
            newOrder.splice(dropIndex, 0, draggedElement.dataset.layerId);
            
            // Update layer order
            level.reorderLayers(newOrder);
            this.render();
            this.stateManager.markDirty();
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
        if (!this.searchFilter.trim()) {
            return layers;
        }
        
        const query = this.searchFilter.toLowerCase();
        return layers.filter(layer => 
            layer.name.toLowerCase().includes(query)
        );
    }

    /**
     * Update layers statistics
     */
    updateLayersStats() {
        const level = this.levelEditor.getLevel();
        const layers = level.getLayersSorted();
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
        event.preventDefault();
        event.stopPropagation();

        // Remove existing context menu
        if (this.contextMenu) {
            this.contextMenu.remove();
        }

        const level = this.levelEditor.getLevel();
        const isMainLayer = layer.id === level.getMainLayerId();
        const isSelected = this.selectedLayers.has(layer.id);
        const isCurrent = layer.id === this.currentLayerId;

        const contextMenu = document.createElement('div');
        contextMenu.className = 'fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 py-1 min-w-48';
        
        // Position menu with boundary checking
        const menuWidth = 192; // min-w-48 = 12rem = 192px
        const menuHeight = 200; // Estimated height
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = event.clientX;
        let top = event.clientY;
        
        // Adjust horizontal position if menu would go off screen
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 10; // 10px margin
        }
        
        // Adjust vertical position if menu would go off screen
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 10; // 10px margin
        }
        
        // Ensure menu doesn't go off the left or top edge
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;

        const menuItems = [
            {
                text: 'Make Current',
                icon: '🎯',
                action: () => this.setCurrentLayerAndNotify(layer.id),
                enabled: true,
                className: isCurrent ? 'text-blue-400' : 'text-gray-200'
            },
            { text: '---', enabled: false },
            {
                text: 'Rename',
                icon: '✏️',
                action: () => this.renameLayer(layer.id),
                enabled: true
            },
            {
                text: 'Duplicate',
                icon: '📋',
                action: () => this.duplicateLayer(layer.id),
                enabled: true
            },
            { text: '---', enabled: false },
            {
                text: layer.visible ? 'Hide' : 'Show',
                icon: layer.visible ? '👁️‍🗨️' : '👁️',
                action: () => this.toggleLayerVisibility(layer.id),
                enabled: true
            },
            {
                text: layer.locked ? 'Unlock' : 'Lock',
                icon: layer.locked ? '🔓' : '🔒',
                action: () => this.toggleLayerLock(layer.id),
                enabled: true
            },
            { text: '---', enabled: false },
            {
                text: 'Select All Objects',
                icon: '🎯',
                action: () => this.selectAllObjectsInLayer(layer.id),
                enabled: true
            },
            {
                text: 'Move Objects to Main Layer',
                icon: '📦',
                action: () => this.moveObjectsToMainLayer(layer.id),
                enabled: !isMainLayer
            },
            { text: '---', enabled: false },
            {
                text: 'Delete Layer',
                icon: '🗑️',
                action: () => this.deleteLayer(layer.id),
                enabled: !isMainLayer,
                className: 'text-red-400 hover:bg-red-600'
            }
        ];

        menuItems.forEach(item => {
            if (item.text === '---') {
                const separator = document.createElement('div');
                separator.className = 'border-t border-gray-600 my-1';
                contextMenu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = `px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 flex items-center space-x-2 ${
                    item.className || 'text-gray-200'
                } ${!item.enabled ? 'opacity-50 cursor-not-allowed' : ''}`;
                menuItem.innerHTML = `<span>${item.icon}</span><span>${item.text}</span>`;
                
                if (item.enabled) {
                    menuItem.addEventListener('click', () => {
                        item.action();
                        contextMenu.remove();
                        this.contextMenu = null;
                    });
                }
                
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

    /**
     * Rename layer
     */
    renameLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        const input = this.container.querySelector(`#layer-name-${layerId}`);
        const display = this.container.querySelector(`[data-layer-id="${layerId}"].layer-name-display`);
        
        if (input && display) {
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
        
        Logger.layer.info(`Duplicated layer: ${layer.name} → ${duplicatedLayer.name}`);
    }

    /**
     * Toggle layer visibility
     */
    toggleLayerVisibility(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        const wasVisible = layer.visible;
        layer.toggleVisibility();
        this.updateLayerElement(layerId, layer);
        this.stateManager.markDirty();

        if (wasVisible && !layer.visible) {
            this.handleLayerVisibilityChanged(layerId, false);
        } else if (!wasVisible && layer.visible) {
            this.handleLayerVisibilityChanged(layerId, true);
        }

        if (this.levelEditor.renderOperations) {
            this.levelEditor.renderOperations.invalidateLayerVisibilityCache();
            this.levelEditor.render();
        }

        this.updateLayerStyles();
    }

    /**
     * Toggle layer lock
     */
    toggleLayerLock(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        if (!layer) return;

        const wasLocked = layer.locked;
        layer.toggleLock();
        this.updateLayerElement(layerId, layer);
        this.stateManager.markDirty();

        if (!wasLocked && layer.locked) {
            this.handleLayerLockChanged(layerId, true);
        } else if (wasLocked && !layer.locked) {
            this.handleLayerLockChanged(layerId, false);
        }

        this.levelEditor.updateAllPanels();
    }

    /**
     * Select all objects in layer
     */
    selectAllObjectsInLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const objectsInLayer = level.objects.filter(obj => {
            const effectiveLayerId = this.levelEditor.renderOperations ?
                this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
                (obj.layerId || level.getMainLayerId());
            return effectiveLayerId === layerId;
        });

        const objectIds = objectsInLayer.map(obj => obj.id);
        this.stateManager.set('selectedObjects', new Set(objectIds));
        
        Logger.layer.info(`Selected ${objectIds.length} objects in layer: ${level.getLayerById(layerId)?.name}`);
    }

    /**
     * Move all objects from layer to main layer
     * Note: This does NOT change the current layer - it only moves objects
     */
    moveObjectsToMainLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const mainLayerId = level.getMainLayerId();
        
        if (layerId === mainLayerId) return;

        const objectsToMove = level.objects.filter(obj => obj.layerId === layerId);
        
        if (objectsToMove.length === 0) {
            Logger.layer.info(`No objects to move from layer: ${level.getLayerById(layerId)?.name}`);
            return;
        }

        objectsToMove.forEach(obj => {
            obj.layerId = mainLayerId;
        });

        this.stateManager.markDirty();
        this.render();
        
        Logger.layer.info(`Moved ${objectsToMove.length} objects to main layer`);
    }

    /**
     * Delete layer
     */
    deleteLayer(layerId) {
        const level = this.levelEditor.getLevel();
        const layer = level.getLayerById(layerId);
        
        if (!layer || layerId === level.getMainLayerId()) return;

        if (confirm(`Delete layer "${layer.name}"? All objects in this layer will be moved to the main layer.`)) {
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
            
            Logger.layer.info(`Deleted layer: ${layer.name}`);
        }
    }

    /**
     * Handle layer selection (single or multi-select)
     */
    handleLayerSelection(layerId, event) {
        if (event.ctrlKey || event.metaKey) {
            // Multi-select
            if (this.selectedLayers.has(layerId)) {
                this.selectedLayers.delete(layerId);
            } else {
                this.selectedLayers.add(layerId);
            }
        } else {
            // Single select
            this.selectedLayers.clear();
            this.selectedLayers.add(layerId);
        }
        
        this.updateLayerStyles();
    }

    /**
     * Setup search functionality
     */
    setupSearch() {
        const searchInput = document.getElementById('layers-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            this.searchFilter = e.target.value;
            this.render();
        });

        // Clear search on Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.searchFilter = '';
                e.target.value = '';
                this.render();
            }
        });
    }

    /**
     * Setup layers menu button
     */
    setupLayersMenu() {
        const menuBtn = document.getElementById('layers-menu-btn');
        if (!menuBtn) return;

        menuBtn.addEventListener('click', (e) => {
            this.showLayersMenu(e);
        });
    }

    /**
     * Show layers menu
     */
    showLayersMenu(event) {
        // Remove existing context menu
        if (this.contextMenu) {
            this.contextMenu.remove();
        }

        const contextMenu = document.createElement('div');
        contextMenu.className = 'fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 py-1 min-w-48';
        
        // Position menu with boundary checking
        const menuWidth = 192; // min-w-48 = 12rem = 192px
        const menuHeight = 200; // Estimated height
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = event.clientX;
        let top = event.clientY;
        
        // Adjust horizontal position if menu would go off screen
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 10; // 10px margin
        }
        
        // Adjust vertical position if menu would go off screen
        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 10; // 10px margin
        }
        
        // Ensure menu doesn't go off the left or top edge
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;

        const menuItems = [
            {
                text: 'Select All Layers',
                icon: '🎯',
                action: () => this.selectAllLayers()
            },
            {
                text: 'Deselect All',
                icon: '❌',
                action: () => this.deselectAllLayers()
            },
            { text: '---', enabled: false },
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
                separator.className = 'border-t border-gray-600 my-1';
                contextMenu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 flex items-center space-x-2 text-gray-200';
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
     * Select all layers
     */
    selectAllLayers() {
        const level = this.levelEditor.getLevel();
        const layers = level.getLayersSorted();
        this.selectedLayers.clear();
        layers.forEach(layer => this.selectedLayers.add(layer.id));
        this.updateLayerStyles();
    }

    /**
     * Deselect all layers
     */
    deselectAllLayers() {
        this.selectedLayers.clear();
        this.updateLayerStyles();
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
            }
        });
        this.stateManager.markDirty();
        this.render();
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
                this.handleLayerVisibilityChanged(layer.id, false);
            }
        });
        this.stateManager.markDirty();
        this.render();
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
                const searchInput = document.getElementById('layers-search');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
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

            // Delete: Delete selected layers
            if (e.key === 'Delete' && this.selectedLayers.size > 0) {
                e.preventDefault();
                this.deleteSelectedLayers();
            }

            // Ctrl/Cmd + D: Duplicate selected layers
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && this.selectedLayers.size > 0) {
                e.preventDefault();
                this.duplicateSelectedLayers();
            }

            // Ctrl/Cmd + A: Select all layers
            if ((e.ctrlKey || e.metaKey) && e.key === 'a' && this.container.contains(activeElement)) {
                e.preventDefault();
                this.selectAllLayers();
            }

            // Escape: Deselect all layers
            if (e.key === 'Escape' && this.selectedLayers.size > 0) {
                e.preventDefault();
                this.deselectAllLayers();
            }

            // Ctrl/Cmd + H: Toggle visibility of selected layers
            if ((e.ctrlKey || e.metaKey) && e.key === 'h' && this.selectedLayers.size > 0) {
                e.preventDefault();
                this.toggleSelectedLayersVisibility();
            }

            // Ctrl/Cmd + Shift + H: Toggle lock of selected layers
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H' && this.selectedLayers.size > 0) {
                e.preventDefault();
                this.toggleSelectedLayersLock();
            }
        });
    }

    /**
     * Delete selected layers
     */
    deleteSelectedLayers() {
        const level = this.levelEditor.getLevel();
        const layersToDelete = Array.from(this.selectedLayers).filter(layerId => 
            layerId !== level.getMainLayerId()
        );

        if (layersToDelete.length === 0) {
            Logger.layer.warn('Cannot delete main layer');
            return;
        }

        const layerNames = layersToDelete.map(id => level.getLayerById(id)?.name).join(', ');
        
        if (confirm(`Delete ${layersToDelete.length} layer(s): ${layerNames}?`)) {
            layersToDelete.forEach(layerId => {
                this.moveObjectsToMainLayer(layerId);
                this.handleLayerVisibilityChanged(layerId, false);
                level.removeLayer(layerId);
            });
            
            this.selectedLayers.clear();
            this.render();
            this.stateManager.markDirty();
            
            Logger.layer.info(`Deleted ${layersToDelete.length} layers: ${layerNames}`);
        }
    }

    /**
     * Duplicate selected layers
     */
    duplicateSelectedLayers() {
        const level = this.levelEditor.getLevel();
        const duplicatedLayers = [];

        this.selectedLayers.forEach(layerId => {
            const layer = level.getLayerById(layerId);
            if (layer) {
                const duplicatedLayer = layer.clone();
                duplicatedLayer.name = `${layer.name} Copy`;
                duplicatedLayer.order = Math.max(...level.layers.map(l => l.order), -1) + 1;
                
                level.layers.push(duplicatedLayer);
                duplicatedLayers.push(duplicatedLayer);
            }
        });

        this.render();
        this.stateManager.markDirty();
        
        Logger.layer.info(`Duplicated ${duplicatedLayers.length} layers`);
    }

    /**
     * Toggle visibility of selected layers
     */
    toggleSelectedLayersVisibility() {
        const level = this.levelEditor.getLevel();
        
        this.selectedLayers.forEach(layerId => {
            const layer = level.getLayerById(layerId);
            if (layer) {
                const wasVisible = layer.visible;
                layer.toggleVisibility();
                this.updateLayerElement(layerId, layer);

                if (wasVisible && !layer.visible) {
                    this.handleLayerVisibilityChanged(layerId, false);
                } else if (!wasVisible && layer.visible) {
                    this.handleLayerVisibilityChanged(layerId, true);
                }
            }
        });

        this.stateManager.markDirty();
        this.render();
        
        Logger.layer.info(`Toggled visibility of ${this.selectedLayers.size} layers`);
    }

    /**
     * Toggle lock of selected layers
     */
    toggleSelectedLayersLock() {
        const level = this.levelEditor.getLevel();
        
        this.selectedLayers.forEach(layerId => {
            const layer = level.getLayerById(layerId);
            if (layer) {
                const wasLocked = layer.locked;
                layer.toggleLock();
                this.updateLayerElement(layerId, layer);

                if (!wasLocked && layer.locked) {
                    this.handleLayerLockChanged(layerId, true);
                } else if (wasLocked && !layer.locked) {
                    this.handleLayerLockChanged(layerId, false);
                }
            }
        });

        this.stateManager.markDirty();
        this.render();
        
        Logger.layer.info(`Toggled lock of ${this.selectedLayers.size} layers`);
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
}
