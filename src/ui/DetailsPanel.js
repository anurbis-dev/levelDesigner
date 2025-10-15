import { GroupTraversalUtils } from '../utils/GroupTraversalUtils.js';
import { UIFactory } from '../utils/UIFactory.js';

/**
 * Details panel UI component
 */
export class DetailsPanel {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        
        // Track subscriptions for cleanup
        this.subscriptions = [];
        // Track event listeners
        this.eventListeners = [];
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe to selection changes
        const unsubscribeSelected = this.stateManager.subscribe('selectedObjects', () => {
            this.render();
            this.updateTabTitle();
        });
        this.subscriptions.push(unsubscribeSelected);

        // Subscribe to level changes (for object property updates like layer changes)
        const unsubscribeLevel = this.stateManager.subscribe('level', (newLevel, oldLevel) => {

            // Check if selected objects properties changed (excluding position changes)
            const selectedIds = this.stateManager.get('selectedObjects');
            if (selectedIds && selectedIds.size > 0) {
                const firstId = Array.from(selectedIds)[0];
                const newObj = newLevel.objects?.find(obj => obj.id === firstId);
                const oldObj = oldLevel?.objects?.find(obj => obj.id === firstId);
                
                
                // Only re-render if non-position properties changed
                if (oldObj && newObj) {
                    const positionChanged = (oldObj.x !== newObj.x || oldObj.y !== newObj.y);
                    if (positionChanged) {
                        return;
                    }
                }
            }

            this.render();
            this.updateTabTitle();
        });
        this.subscriptions.push(unsubscribeLevel);

        // Subscribe to object property changes (for immediate updates like layer changes)
        const unsubscribeProperty = this.stateManager.subscribe('objectPropertyChanged', (changedObject, changeData) => {

            // Skip real-time updates for position properties to avoid performance issues
            // Position updates will happen on: selection change, drag end, duplicate end
            if (changeData?.property === 'x' || changeData?.property === 'y') {
                return;
            }

            // Check if the changed object is currently selected
            const selectedIds = this.stateManager.get('selectedObjects');
            if (selectedIds && selectedIds.has(changedObject?.id)) {
                this.render();
                this.updateTabTitle();
            }
        });
        this.subscriptions.push(unsubscribeProperty);
    }

    render() {
        this.container.innerHTML = '';

        const selectedObjects = this.getSelectedObjects();

        if (selectedObjects.length === 0) {
            this.renderNoSelection();
            return;
        }

        if (selectedObjects.length === 1) {
            this.renderSingleObject(selectedObjects[0]);
        } else {
            this.renderMultipleObjects(selectedObjects);
        }

        // Update tab title after rendering content
        this.updateTabTitle();
    }

    renderNoSelection() {
        // Show level content when no object is selected
        if (this.levelEditor && this.levelEditor.cachedLevelStats) {
            this.renderLevelContent();

            // Update tab title to show we're showing level content
            const detailsTab = document.getElementById('details-tab');
            if (detailsTab) {
                detailsTab.textContent = 'Level';
            }
        } else {
            this.container.innerHTML = '<p class="text-gray-400">Select an object to see its properties.</p>';
            // Update tab title for no selection case
            this.updateTabTitle();
        }
    }

    renderSingleObject(obj) {

        if (obj.type === 'group') {
            this.renderGroupDetails(obj);
        } else {
            this.renderObjectDetails(obj);
        }
    }

    renderGroupDetails(group) {
        this.container.innerHTML = '';

        // Create compact layout with sections (same as for objects)
        this.renderCompactObjectDetails(group);

        // Add statistics section for groups
        this.renderGroupStatistics(group);

        // Add layer information section for groups
        this.renderLayerInfo(group);
    }

    /**
     * Render group statistics section
     * @param {Object} group - Group object
     */
    renderGroupStatistics(group) {
        const section = this.createSection('Group Contents');
        
        const childAssets = this.getAllChildren(group).filter(o => o.type !== 'group').length;
        const childGroups = this.getAllChildren(group).filter(o => o.type === 'group').length;
        
        section.innerHTML += `
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="text-center">
                    <div class="text-lg font-bold text-blue-400">${childAssets}</div>
                    <div class="text-gray-400">Assets</div>
                </div>
                <div class="text-center">
                    <div class="text-lg font-bold text-green-400">${childGroups}</div>
                    <div class="text-gray-400">Groups</div>
                </div>
            </div>
        `;
        
        this.container.appendChild(section);
    }

    /**
     * Render compact object details with sections
     * @param {Object} obj - Object to render details for
     */
    renderCompactObjectDetails(obj) {
        // Basic Properties Section
        this.renderBasicProperties(obj);
        
        // Transforms Section (Position & Size)
        this.renderTransformsSection(obj);
        
        // Visual Properties Section
        this.renderVisualProperties(obj);
        
        // Advanced Properties Section
        this.renderAdvancedProperties(obj);
        
        // Custom Properties Section
        this.renderCustomProperties(obj);
    }

    /**
     * Render basic properties (name, type)
     */
    renderBasicProperties(obj) {
        const section = this.createSection('Basic Properties');
        
        // Name
        const nameContainer = UIFactory.createLabeledInput({
            label: 'Name',
            type: 'text',
            value: obj.name || '',
            onChange: (e) => obj.name = e.target.value,
            onBlur: () => this.notifyPropertyChange(obj, 'name', obj.name)
        });
        section.appendChild(nameContainer);

        // Type (read-only)
        const typeContainer = UIFactory.createLabeledInput({
            label: 'Type',
            type: 'text',
            value: obj.type || 'unknown',
            disabled: true
        });
        section.appendChild(typeContainer);

        this.container.appendChild(section);
    }

    /**
     * Render transforms section with compact position and size inputs
     */
    renderTransformsSection(obj) {
        const section = this.createTransformsSectionHTML(obj);
        
        // Set initial values
        const inputs = section.querySelectorAll('input[data-property]');
        inputs.forEach(input => {
            const property = input.dataset.property;
            input.value = (obj[property] || 0).toFixed(1);
        });
        
        // Add event listeners for transforms
        this.setupTransformsListeners(section, obj);
        
        this.container.appendChild(section);
    }

    /**
     * Render visual properties (color)
     */
    renderVisualProperties(obj) {
        const section = this.createSection('Visual');
        
        // Color
        const colorContainer = UIFactory.createLabeledInput({
            label: 'Color',
            type: 'color',
            value: obj.color || '#3B82F6',
            onChange: (e) => {
                obj.color = e.target.value;
                this.notifyPropertyChange(obj, 'color', obj.color);
            }
        });
        section.appendChild(colorContainer);
        
        this.container.appendChild(section);
    }

    /**
     * Render advanced properties (zIndex)
     */
    renderAdvancedProperties(obj) {
        const section = this.createSection('Advanced');
        
        // Z-Index
        let displayValue;
        if (obj.zIndex !== undefined && typeof obj.zIndex === 'number') {
            const objectIndex = Math.floor((obj.zIndex % 1) * 1000);
            displayValue = objectIndex.toString();
        } else {
            displayValue = '0';
        }
        
        const zIndexContainer = UIFactory.createLabeledInput({
            label: 'Z-Index',
            type: 'number',
            value: displayValue,
            onChange: (e) => {
                const layerIndex = Math.floor(obj.zIndex || 0);
                const objectIndex = parseInt(e.target.value) || 0;
                obj.zIndex = layerIndex + (objectIndex / 1000);
            },
            onBlur: (e) => {
                const layerIndex = Math.floor(obj.zIndex || 0);
                const objectIndex = parseInt(e.target.value) || 0;
                const newValue = layerIndex + (objectIndex / 1000);
                obj.zIndex = newValue;
                this.notifyPropertyChange(obj, 'zIndex', newValue);
            }
        });
        section.appendChild(zIndexContainer);
        
        this.container.appendChild(section);
    }

    /**
     * Create a section container with title
     * @param {string} title - Section title
     * @returns {HTMLElement} Section container
     */
    createSection(title) {
        const section = document.createElement('div');
        section.className = 'mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700';
        
        const titleElement = document.createElement('h3');
        titleElement.className = 'text-sm font-semibold text-gray-300 mb-3';
        titleElement.textContent = title;
        
        section.appendChild(titleElement);
        return section;
    }

    /**
     * Create transforms section HTML
     * @param {Object|Array} objOrObjects - Single object or array of objects
     * @returns {HTMLElement} Section container
     */
    createTransformsSectionHTML(objOrObjects) {
        const section = this.createSection('Transforms');
        
        // Create compact grid for position and size
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid grid-cols-2 gap-3';
        
        // Position row
        const positionRow = document.createElement('div');
        positionRow.className = 'col-span-2';
        positionRow.innerHTML = `
            <label class="block text-sm font-medium text-gray-300 mb-1">Position</label>
            <div class="flex gap-2">
                <div class="flex-1 relative">
                    <span class="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 pointer-events-none">X</span>
                    <input type="number" 
                           class="w-full bg-gray-700 border border-gray-600 rounded px-6 py-1 text-sm" 
                           placeholder="0" 
                           data-property="x">
                </div>
                <div class="flex-1 relative">
                    <span class="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Y</span>
                    <input type="number" 
                           class="w-full bg-gray-700 border border-gray-600 rounded px-6 py-1 text-sm" 
                           placeholder="0" 
                           data-property="y">
                </div>
            </div>
        `;
        
        // Size row
        const sizeRow = document.createElement('div');
        sizeRow.className = 'col-span-2';
        sizeRow.innerHTML = `
            <label class="block text-sm font-medium text-gray-300 mb-1">Size</label>
            <div class="flex gap-2">
                <div class="flex-1 relative">
                    <span class="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 pointer-events-none">W</span>
                    <input type="number" 
                           class="w-full bg-gray-700 border border-gray-600 rounded px-6 py-1 text-sm" 
                           placeholder="0" 
                           data-property="width">
                </div>
                <div class="flex-1 relative">
                    <span class="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 pointer-events-none">H</span>
                    <input type="number" 
                           class="w-full bg-gray-700 border border-gray-600 rounded px-6 py-1 text-sm" 
                           placeholder="0" 
                           data-property="height">
                </div>
            </div>
        `;
        
        gridContainer.appendChild(positionRow);
        gridContainer.appendChild(sizeRow);
        section.appendChild(gridContainer);
        
        return section;
    }

    /**
     * Setup event listeners for transforms section
     * @param {HTMLElement} section - Section container
     * @param {Object} obj - Object being edited
     */
    setupTransformsListeners(section, obj) {
        const inputs = section.querySelectorAll('input[data-property]');
        
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;
                
                obj[property] = value;
            });
            
            input.addEventListener('blur', (e) => {
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;
                
                obj[property] = value;
                this.notifyPropertyChange(obj, property, value);
            });
        });
    }

    /**
     * Notify about property change
     * @param {Object} obj - Object that changed
     * @param {string} property - Property name
     * @param {any} newValue - New value
     */
    notifyPropertyChange(obj, property, newValue) {
            this.stateManager.markDirty();

            // Notify about object property change
        this.stateManager.notifyListeners('objectPropertyChanged', obj, {
            property: property,
            oldValue: obj[property],
                newValue: newValue
            });

            // Trigger redraw of selected objects
            this.stateManager.notifyListeners('selectedObjects', this.stateManager.get('selectedObjects'), this.stateManager.get('selectedObjects'));

            // Force canvas redraw (important for zIndex changes to re-sort and redraw objects)
            if (this.levelEditor && this.levelEditor.render) {
                this.levelEditor.render();
            }

            // Update tab title immediately
            this.updateTabTitle();
    }

    renderObjectDetails(obj) {
        this.container.innerHTML = '';

        // Create compact layout with sections
        this.renderCompactObjectDetails(obj);

        // Add layer information section
        this.renderLayerInfo(obj);
    }

    renderMultipleObjects(objects) {
        this.container.innerHTML = '';

        // Create compact layout with sections (same as single object)
        this.renderCompactMultipleObjects(objects);
    }

    /**
     * Render compact multiple objects details with sections
     * @param {Array} objects - Array of objects to render details for
     */
    renderCompactMultipleObjects(objects) {
        // Basic Properties Section
        this.renderMultipleBasicProperties(objects);
        
        // Transforms Section (Position & Size)
        this.renderMultipleTransformsSection(objects);
        
        // Visual Properties Section
        this.renderMultipleVisualProperties(objects);
        
        // Advanced Properties Section
        this.renderMultipleAdvancedProperties(objects);
        
        // Custom Properties Section
        this.renderMultipleCustomProperties(objects);
        
        // Layer Information Section
        this.renderMultipleLayerInfo(objects);
    }

    /**
     * Render basic properties for multiple objects (name)
     */
    renderMultipleBasicProperties(objects) {
        const section = this.createSection('Basic Properties');
        
        // Name - check if all objects have the same name
        const firstName = objects[0].name || '';
        const allSameName = objects.every(obj => (obj.name || '') === firstName);
        
        const nameContainer = UIFactory.createLabeledInput({
            label: 'Name',
            type: 'text',
            value: allSameName ? firstName : '',
            placeholder: allSameName ? '' : 'multiple values',
            onChange: (e) => {
                objects.forEach(obj => obj.name = e.target.value);
            },
            onBlur: () => {
                objects.forEach(obj => this.notifyPropertyChange(obj, 'name', obj.name));
            }
        });
        section.appendChild(nameContainer);

        // Type - show if all objects have the same type
        const firstType = objects[0].type || 'unknown';
        const allSameType = objects.every(obj => (obj.type || 'unknown') === firstType);
        
        if (allSameType) {
            const typeContainer = UIFactory.createLabeledInput({
                label: 'Type',
                type: 'text',
                value: firstType,
                disabled: true
            });
            section.appendChild(typeContainer);
        }

        this.container.appendChild(section);
    }

    /**
     * Render transforms section for multiple objects with compact position and size inputs
     */
    renderMultipleTransformsSection(objects) {
        const section = this.createTransformsSectionHTML(objects);
        
        // Add event listeners for transforms
        this.setupMultipleTransformsListeners(section, objects);
        
        this.container.appendChild(section);
    }

    /**
     * Render visual properties for multiple objects (color)
     */
    renderMultipleVisualProperties(objects) {
        const section = this.createSection('Visual');
        
        // Color - check if all objects have the same color
        const firstColor = objects[0].color || '#3B82F6';
        const allSameColor = objects.every(obj => (obj.color || '#3B82F6') === firstColor);
        
        const colorContainer = UIFactory.createLabeledInput({
            label: 'Color',
            type: 'color',
            value: allSameColor ? firstColor : '#3B82F6',
            onChange: (e) => {
                objects.forEach(obj => obj.color = e.target.value);
                this.notifyPropertyChange(objects[0], 'color', e.target.value);
            }
        });
        section.appendChild(colorContainer);
        
        this.container.appendChild(section);
    }

    /**
     * Render custom properties for multiple objects
     */
    renderMultipleCustomProperties(objects) {
        const section = this.createSection('Custom Properties');
        
        // Get all unique custom property keys from all objects
        const allCustomKeys = new Set();
                    objects.forEach(obj => {
            // Support both customProperties and properties (legacy)
            const customProps = obj.customProperties || obj.properties || {};
            Object.keys(customProps).forEach(key => allCustomKeys.add(key));
        });
        
        // Show existing custom properties
        if (allCustomKeys.size > 0) {
            allCustomKeys.forEach(key => {
                // Check if all objects have the same value for this custom property
                const firstCustomProps = objects[0].customProperties || objects[0].properties || {};
                const firstValue = firstCustomProps[key] || '';
                const allSameValue = objects.every(obj => {
                    const objCustomProps = obj.customProperties || obj.properties || {};
                    const objValue = objCustomProps[key] || '';
                    return objValue === firstValue;
                });
                
                const propContainer = UIFactory.createLabeledInput({
                    label: key,
                    type: 'text',
                    value: allSameValue ? firstValue : '',
                    placeholder: allSameValue ? '' : 'multiple values',
                    onChange: (e) => {
                        objects.forEach(obj => {
                            if (!obj.customProperties) {
                                obj.customProperties = {};
                            }
                            obj.customProperties[key] = e.target.value;
                        });
                    },
                    onBlur: (e) => {
                        objects.forEach(obj => {
                            if (!obj.customProperties) {
                                obj.customProperties = {};
                            }
                            obj.customProperties[key] = e.target.value;
                            this.notifyPropertyChange(obj, 'customProperties', obj.customProperties);
                        });
                    }
                });
                section.appendChild(propContainer);
            });
        } else {
            // Show message when no custom properties exist
            const noPropsMsg = document.createElement('div');
            noPropsMsg.className = 'text-sm text-gray-400 italic';
            noPropsMsg.textContent = 'No custom properties';
            section.appendChild(noPropsMsg);
        }
        
        // Add "Add Property" button
        const addButton = document.createElement('button');
        addButton.className = 'mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700';
        addButton.textContent = 'Add Property';
        addButton.addEventListener('click', () => {
            const key = prompt('Enter property name:');
            if (key && key.trim()) {
                // Add the property to all objects
                    objects.forEach(obj => {
                    if (!obj.customProperties) {
                        obj.customProperties = {};
                    }
                    obj.customProperties[key.trim()] = '';
                });
                
                // Re-render the panel to show the new property
                this.render();
            }
        });
        section.appendChild(addButton);
        
        this.container.appendChild(section);
    }

    /**
     * Render advanced properties for multiple objects (zIndex)
     */
    renderMultipleAdvancedProperties(objects) {
        const section = this.createSection('Advanced');
        
        // Z-Index - check if all objects have the same zIndex
        const firstZIndex = objects[0].zIndex || 0;
        const allSameZIndex = objects.every(obj => {
            const objZIndex = obj.zIndex || 0;
            const firstObjectIndex = Math.floor((firstZIndex % 1) * 1000);
            const objObjectIndex = Math.floor((objZIndex % 1) * 1000);
            return firstObjectIndex === objObjectIndex;
        });
        
        let displayValue = '';
        if (allSameZIndex && firstZIndex !== undefined && typeof firstZIndex === 'number') {
            const objectIndex = Math.floor((firstZIndex % 1) * 1000);
            displayValue = objectIndex.toString();
        }
        
        const zIndexContainer = UIFactory.createLabeledInput({
            label: 'Z-Index',
            type: 'number',
            value: displayValue,
            placeholder: allSameZIndex ? '' : 'multiple values',
            onChange: (e) => {
                const objectIndex = parseInt(e.target.value) || 0;
                    objects.forEach(obj => {
                    const layerIndex = Math.floor(obj.zIndex || 0);
                    obj.zIndex = layerIndex + (objectIndex / 1000);
                });
            },
            onBlur: (e) => {
                const objectIndex = parseInt(e.target.value) || 0;
                objects.forEach(obj => {
                    const layerIndex = Math.floor(obj.zIndex || 0);
                    const newValue = layerIndex + (objectIndex / 1000);
                    obj.zIndex = newValue;
                    this.notifyPropertyChange(obj, 'zIndex', newValue);
                });
            }
        });
        section.appendChild(zIndexContainer);
        
        this.container.appendChild(section);
    }

    /**
     * Setup event listeners for multiple objects transforms section
     * @param {HTMLElement} section - Section container
     * @param {Array} objects - Array of objects being edited
     */
    setupMultipleTransformsListeners(section, objects) {
        const inputs = section.querySelectorAll('input[data-property]');
        
        // Set initial values based on common values
        inputs.forEach(input => {
            const property = input.dataset.property;
            const firstValue = objects[0][property] || 0;
            const allSame = objects.every(obj => (obj[property] || 0) === firstValue);
            
            if (allSame) {
                input.value = firstValue.toFixed(1);
            } else {
                input.placeholder = 'multiple values';
            }
        });
        
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;
                
                objects.forEach(obj => obj[property] = value);
            });
            
            input.addEventListener('blur', (e) => {
                const property = e.target.dataset.property;
                let value = parseFloat(e.target.value);
                if (isNaN(value)) value = 0;
                
                objects.forEach(obj => {
                    obj[property] = value;
                    this.notifyPropertyChange(obj, property, value);
                });
            });
        });
    }

    renderLayerInfo(obj) {
        const level = this.levelEditor.getLevel();
        const layerInfo = this.getObjectLayerInfo(obj, level);

        const section = this.createSection('Layer Information');

        const layerContainer = document.createElement('div');
        layerContainer.className = 'flex items-center space-x-2';

        layerContainer.innerHTML = `
            <div class="w-4 h-4 rounded border details-layer-color" data-color="${layerInfo.color}" style="background-color: ${layerInfo.color}"></div>
            <div class="flex-1">
                <div class="text-sm font-medium text-gray-200">${layerInfo.name}</div>
                <div class="text-xs text-gray-400">${layerInfo.objectCount} objects</div>
            </div>
        `;

        section.appendChild(layerContainer);
        this.container.appendChild(section);
    }

    getObjectLayerInfo(obj, level) {

        // Get effective layer ID (considering inheritance from parent groups)
        const effectiveLayerId = this.getEffectiveLayerId(obj, level);

        const layer = level.getLayerById(effectiveLayerId);

        if (layer) {
            const objectCount = level.getLayerObjectsCount(effectiveLayerId);
            const result = {
                id: layer.id,
                name: layer.name,
                color: layer.color,
                visible: layer.visible,
                locked: layer.locked,
                objectCount: objectCount
            };
            return result;
        }
        
        // Fallback if layer not found
        return {
            id: 'unknown',
            name: 'Unknown Layer',
            color: '#6B7280',
            visible: true,
            locked: false,
            objectCount: 0
        };
    }

    renderMultipleLayerInfo(objects) {
        const level = this.levelEditor.getLevel();
        const layerAnalysis = this.analyzeMultipleLayers(objects, level);
        
        const section = this.createSection('Layer Information');
        
        if (layerAnalysis.allSameLayer) {
            // All objects are on the same layer
            const layerInfo = layerAnalysis.layers[0];
            const layerContainer = document.createElement('div');
            layerContainer.className = 'flex items-center space-x-2';
            
            layerContainer.innerHTML = `
                <div class="w-4 h-4 rounded border" style="background-color: ${layerInfo.color}"></div>
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-200">${layerInfo.name}</div>
                    <div class="text-xs text-gray-400">${layerInfo.objectCount} objects, ${objects.length} selected</div>
                </div>
            `;
            
            section.appendChild(layerContainer);
        } else {
            // Objects are on different layers
            const layerContainer = document.createElement('div');
            layerContainer.innerHTML = `
                <div class="text-sm font-medium text-gray-300 mb-2">Layers (${layerAnalysis.layers.length} different)</div>
                <div class="space-y-2">
            `;
            
            layerAnalysis.layers.forEach(layerInfo => {
                const layerItem = document.createElement('div');
                layerItem.className = 'flex items-center space-x-2';
                layerItem.innerHTML = `
                    <div class="w-3 h-3 rounded border" style="background-color: ${layerInfo.color}"></div>
                    <div class="flex-1">
                        <div class="text-sm text-gray-200">${layerInfo.name}</div>
                        <div class="text-xs text-gray-400">${layerInfo.selectedCount} selected, ${layerInfo.objectCount} total</div>
                    </div>
                `;
                layerContainer.appendChild(layerItem);
            });
            
            layerContainer.innerHTML += '</div>';
            section.appendChild(layerContainer);
        }
        
        this.container.appendChild(section);
    }

    analyzeMultipleLayers(objects, level) {
        const layerMap = new Map();
        
        objects.forEach(obj => {
            const layerId = obj.layerId || level.getMainLayerId();
            const layer = level.getLayerById(layerId);
            
            if (layer) {
                if (!layerMap.has(layerId)) {
                    const objectCount = level.getLayerObjectsCount(layerId);
                    layerMap.set(layerId, {
                        id: layer.id,
                        name: layer.name,
                        color: layer.color,
                        visible: layer.visible,
                        locked: layer.locked,
                        objectCount: objectCount,
                        selectedCount: 0
                    });
                }
                layerMap.get(layerId).selectedCount++;
            }
        });
        
        const layers = Array.from(layerMap.values());
        const allSameLayer = layers.length === 1;
        
        return {
            layers: layers,
            allSameLayer: allSameLayer,
            totalLayers: layers.length
        };
    }

    renderCustomProperties(obj) {
        const section = this.createSection('Custom Properties');
        
        // Use customProperties instead of properties for consistency
        const customProps = obj.customProperties || obj.properties || {};
        
        if (Object.keys(customProps).length > 0) {
            Object.entries(customProps).forEach(([key, value]) => {
                const propContainer = UIFactory.createLabeledInput({
                    label: key,
                    type: 'text',
                    value: value || '',
                    onChange: (e) => {
                        if (!obj.customProperties) {
                            obj.customProperties = {};
                        }
                        obj.customProperties[key] = e.target.value;
                    },
                    onBlur: (e) => {
                        if (!obj.customProperties) {
                            obj.customProperties = {};
                        }
                        const oldValue = customProps[key];
                const newValue = e.target.value;
                        obj.customProperties[key] = newValue;
                        this.notifyPropertyChange(obj, 'customProperties', obj.customProperties);
                    }
                });
                section.appendChild(propContainer);
            });
        } else {
            // Show message when no custom properties exist
            const noPropsMsg = document.createElement('div');
            noPropsMsg.className = 'text-sm text-gray-400 italic';
            noPropsMsg.textContent = 'No custom properties';
            section.appendChild(noPropsMsg);
        }
        
        // Add "Add Property" button
        const addButton = document.createElement('button');
        addButton.className = 'mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700';
        addButton.textContent = 'Add Property';
        addButton.addEventListener('click', () => {
            const key = prompt('Enter property name:');
            if (key && key.trim()) {
                if (!obj.customProperties) {
                    obj.customProperties = {};
                }
                obj.customProperties[key.trim()] = '';
                
                // Re-render the panel to show the new property
                this.render();
            }
        });
        section.appendChild(addButton);
        
        this.container.appendChild(section);
    }

    getSelectedObjects() {
        const selectedIds = this.stateManager.get('selectedObjects');
        const level = this.levelEditor.getLevel();


        const objects = Array.from(selectedIds)
            .map(id => level.findObjectById(id))
            .filter(Boolean);


        return objects;
    }

    getAllChildren(group) {
        return GroupTraversalUtils.getAllChildren(group);
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

        for (const child of group.children) {
            if (child.id === targetObj.id) {
                // Found the object - return group's layerId or main layer if group has no layerId
                return group.layerId || level.getMainLayerId();
            }

            // Search recursively in child groups
            if (child.type === 'group') {
                const result = this.searchInGroupForLayerId(child, targetObj, level);
                if (result) return result;
            }
        }

        return null;
    }

    renderLevelContent() {
        this.container.innerHTML = '';

        // Create compact layout with sections
        this.renderCompactLevelDetails();
    }

    /**
     * Render compact level details with sections
     */
    renderCompactLevelDetails() {
        const stats = this.levelEditor.cachedLevelStats;
        
        // Statistics Section
        this.renderLevelStatistics(stats);
        
        // Actions Section
        this.renderLevelActions();
    }

    /**
     * Render level statistics section
     */
    renderLevelStatistics(stats) {
        const section = this.createSection('Level Statistics');
        
        const playerStartCount = stats?.byType?.player_start || 0;

        // Generate Player Start display with color coding
        const playerStartText = playerStartCount === 1 ? 'Player Start: 1' :
                               playerStartCount === 0 ? 'Player Start: 0' :
                               `Player Start: ${playerStartCount}`;
        const playerStartClass = playerStartCount === 1 ? 'text-green-400' :
                                playerStartCount === 0 ? 'text-yellow-400' :
                                'text-red-400 font-bold';

        // Overview stats
        const overviewDiv = document.createElement('div');
        overviewDiv.className = 'grid grid-cols-2 gap-4 mb-4';
        overviewDiv.innerHTML = `
            <div class="text-center">
                <div class="text-lg font-bold text-blue-400">${stats.totalObjects}</div>
                <div class="text-gray-400 text-sm">Total Objects</div>
            </div>
            <div class="text-center">
                <div class="text-lg font-bold text-green-400">${stats.groups}</div>
                <div class="text-gray-400 text-sm">Groups</div>
            </div>
        `;
        section.appendChild(overviewDiv);
        
        // By Type breakdown
        const typeDiv = document.createElement('div');
        typeDiv.innerHTML = `
            <div class="text-sm font-medium text-gray-300 mb-2">By Type:</div>
            <div class="space-y-1">
                ${Object.entries(stats.byType || {}).map(([type, count]) => {
                    if (type === 'player_start') {
                        return `<div class="flex justify-between items-center">
                            <span class="text-sm ${playerStartClass}">${playerStartText}</span>
                        </div>`;
                    }
                    return `<div class="flex justify-between items-center">
                        <span class="text-sm text-gray-200">${type}</span>
                        <span class="text-sm text-gray-400">${count}</span>
                    </div>`;
                }).join('')}
            </div>
        `;
        section.appendChild(typeDiv);
        
        this.container.appendChild(section);
    }

    /**
     * Render level actions section
     */
    renderLevelActions() {
        const section = this.createSection('Actions');
        
        const buttonContainer = document.createElement('div');
        buttonContainer.innerHTML = `
                <button id="set-camera-start-position-btn"
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                    Set Camera Start Position
                </button>
            <div class="text-xs text-gray-400 mt-2 text-center">
                    Sets current camera position as parallax reference point
            </div>
        `;
        
        section.appendChild(buttonContainer);
        this.container.appendChild(section);

        // Setup button event listener
        this.setupCameraStartPositionButton();
    }

    setupCameraStartPositionButton() {
        const btn = this.container.querySelector('#set-camera-start-position-btn');
        if (!btn) return;

        // Remove existing listener to avoid duplicates
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            const currentCamera = this.levelEditor.stateManager.get('camera');
            this.levelEditor.stateManager.set('parallax.startPosition', {
                x: currentCamera.x,
                y: currentCamera.y
            });

            // Show feedback (optional)
            console.log(`Set camera start position: (${currentCamera.x}, ${currentCamera.y})`);
        });
    }

    updateTabTitle() {
        const detailsTab = document.getElementById('details-tab');
        if (!detailsTab) return;

        const selectedObjects = this.getSelectedObjects();
        const count = selectedObjects.length;

        if (count === 0) {
            // Check if we're showing level content
            if (this.levelEditor && this.levelEditor.cachedLevelStats) {
                detailsTab.textContent = 'Level';
            } else {
                detailsTab.textContent = 'Details';
            }
        } else if (count === 1) {
            detailsTab.textContent = 'Asset';
        } else {
            detailsTab.textContent = 'Assets';
        }
    }
    
    /**
     * Cleanup and destroy panel
     */
    destroy() {
        // Unsubscribe from all state changes
        this.subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                Logger.ui.warn('Failed to unsubscribe:', error);
            }
        });
        this.subscriptions = [];
        
        // Remove all event listeners
        this.eventListeners.forEach(({ target, event, handler }) => {
            try {
                target.removeEventListener(event, handler);
            } catch (error) {
                Logger.ui.warn('Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];
        
        // Clear DOM
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Clear references
        this.levelEditor = null;
        this.stateManager = null;
        this.container = null;
    }

}
