import { UIFactory } from '../utils/UIFactory.js';
import { ColorChooser } from '../widgets/ColorChooser.js';

/**
 * Layers panel UI component
 */
export class LayersPanel {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;


        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to level changes
        this.stateManager.subscribe('level', () => {
            this.render();
        });
    }

    render() {
        this.container.innerHTML = '';

        // Render layers management section
        this.renderLayersSection();

        // Update objects count for all layers
        this.updateAllLayersObjectsCount();
    }

    /**
     * Render layers management section
     */
    renderLayersSection() {
        const level = this.levelEditor.getLevel();
        const layers = level.getLayersSorted();
        
        const section = document.createElement('div');
        section.className = 'layers-section';
        
        // Header with add button
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-3';
        header.innerHTML = `
            <h3 class="text-lg font-bold text-gray-200">Layers</h3>
            <button id="add-layer-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                + Add Layer
            </button>
        `;
        
        // Layers list container
        const layersList = document.createElement('div');
        layersList.className = 'layers-list space-y-1';
        layersList.id = 'layers-list';
        
        // Render each layer
        layers.forEach(layer => {
            const layerElement = this.createLayerElement(layer);
            layersList.appendChild(layerElement);
        });
        
        section.appendChild(header);
        section.appendChild(layersList);
        
        this.container.appendChild(section);
        
        // Add event listeners
        this.setupLayersEventListeners();
    }

    /**
     * Create layer element
     */
    createLayerElement(layer) {
        const level = this.levelEditor.getLevel();
        const objectsCount = level.getLayerObjectsCount(layer.id);
        const countText = objectsCount > 0 ? ` (${objectsCount})` : '';
        
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-item flex items-center justify-between p-2 bg-gray-700 rounded border border-gray-600';
        layerDiv.draggable = true;
        layerDiv.dataset.layerId = layer.id;
        
        layerDiv.innerHTML = `
            <div class="flex items-center space-x-2 flex-1 min-w-0">
                <div class="layer-color w-4 h-4 rounded-full cursor-pointer border-2 border-gray-500 hover:border-gray-300 transition-colors"
                     style="background-color: ${layer.color}"
                     data-layer-id="${layer.id}"
                     title="Click to change color"></div>
                <div class="flex items-center space-x-1 flex-1 min-w-0">
                    <input type="text"
                           value="${layer.name}"
                           class="layer-name-input bg-transparent border-none text-white flex-1 focus:outline-none focus:bg-gray-600 px-1 rounded min-w-0"
                           data-layer-id="${layer.id}">
                    <span class="text-gray-400 text-sm whitespace-nowrap">${countText}</span>
                </div>
            </div>
            <div class="flex items-center space-x-1 flex-shrink-0">
                <button class="layer-visibility-btn p-1 rounded hover:bg-gray-600" 
                        data-layer-id="${layer.id}" 
                        title="${layer.visible ? 'Hide layer' : 'Show layer'}">
                    <svg class="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        ${layer.visible ? 
                            '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>' :
                            '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>'
                        }
                    </svg>
                </button>
                <button class="layer-lock-btn p-1 rounded hover:bg-gray-600" 
                        data-layer-id="${layer.id}" 
                        title="${layer.locked ? 'Unlock layer' : 'Lock layer'}">
                    <svg class="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        ${layer.locked ? 
                            '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>' :
                            '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>'
                        }
                    </svg>
                </button>
                <button class="layer-delete-btn p-1 rounded hover:bg-red-600 ${layer.id === level.getMainLayerId() ? 'hidden' : ''}" 
                        data-layer-id="${layer.id}" 
                        title="Delete layer">
                    <svg class="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
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

        // Update objects count
        const level = this.levelEditor.getLevel();
        const objectsCount = level.getLayerObjectsCount(layerId);
        const countSpan = layerElement.querySelector('.text-gray-400.text-sm');
        if (countSpan) {
            countSpan.textContent = objectsCount > 0 ? ` (${objectsCount})` : '';
        }

        // Update visibility button icon and title
        const visibilityBtn = layerElement.querySelector('.layer-visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.title = layer.visible ? 'Hide layer' : 'Show layer';
            const svg = visibilityBtn.querySelector('svg');
            if (svg) {
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
        
        layers.forEach(layer => {
            const objectsCount = level.getLayerObjectsCount(layer.id);
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
            });
        }
        
        // Layer name editing
        const nameInputs = this.container.querySelectorAll('.layer-name-input');
        nameInputs.forEach(input => {
            input.addEventListener('blur', (e) => {
                const layerId = e.target.dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer) {
                    layer.setName(e.target.value);
                    this.stateManager.markDirty();
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
                    layer.toggleVisibility();
                    this.updateLayerElement(layerId, layer);
                    this.stateManager.markDirty();
                }
            });
        });
        
        // Lock toggle
        const lockBtns = this.container.querySelectorAll('.layer-lock-btn');
        lockBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layerId = e.target.closest('button').dataset.layerId;
                const layer = level.getLayerById(layerId);
                if (layer) {
                    layer.toggleLock();
                    this.updateLayerElement(layerId, layer);
                    this.stateManager.markDirty();
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
                        level.removeLayer(layerId);
                        this.render();
                        this.stateManager.markDirty();
                    }
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
}
