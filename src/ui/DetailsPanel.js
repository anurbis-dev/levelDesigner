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
        this.container.innerHTML = '<p class="text-gray-400">Select an object to see its properties.</p>';
        // Update tab title for no selection case
        this.updateTabTitle();
    }

    renderSingleObject(obj) {

        if (obj.type === 'group') {
            this.renderGroupDetails(obj);
        } else {
            this.renderObjectDetails(obj);
        }
    }

    renderGroupDetails(group) {
        const level = this.levelEditor.getLevel();
        const childAssets = this.getAllChildren(group).filter(o => o.type !== 'group').length;
        const childGroups = this.getAllChildren(group).filter(o => o.type === 'group').length;
        
        const nameInput = UIFactory.createLabeledInput({
            label: 'Group Name',
            value: group.name,
            id: 'group-name-input',
            onChange: (e) => {
                const oldValue = group.name;
                const newValue = e.target.value;
                group.name = newValue;
                this.stateManager.markDirty();

                // Notify about group name change
                this.stateManager.notifyListeners('objectPropertyChanged', group, {
                    property: 'name',
                    oldValue: oldValue,
                    newValue: newValue
                });

                // Trigger outliner update
                this.stateManager.notifyListeners('selectedObjects', this.stateManager.get('selectedObjects'), this.stateManager.get('selectedObjects'));

                // Update tab title immediately
                this.updateTabTitle();
            }
        });
        
        const statsDiv = document.createElement('div');
        statsDiv.className = 'text-sm text-gray-400';
        statsDiv.innerHTML = `
            <p>Assets: ${childAssets}</p>
            <p>Groups: ${childGroups}</p>
        `;
        
        this.container.innerHTML = '';
        this.container.appendChild(nameInput);
        this.container.appendChild(statsDiv);
        
        // Add layer information section for groups
        this.renderLayerInfo(group);
    }

    renderObjectDetails(obj) {

        const properties = ['name', 'type', 'x', 'y', 'width', 'height', 'color', 'zIndex'];

        // Use UIFactory to create property editor
        const propertyEditor = UIFactory.createPropertyEditor(obj, properties, (prop, newValue, object) => {
            const oldValue = object[prop];
            this.stateManager.markDirty();

            // Notify about object property change
            this.stateManager.notifyListeners('objectPropertyChanged', object, {
                property: prop,
                oldValue: oldValue,
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
        });

        this.container.innerHTML = '';
        this.container.appendChild(propertyEditor);

        // Add layer information section
        this.renderLayerInfo(obj);

        // Add custom properties section
        this.renderCustomProperties(obj);
    }

    renderMultipleObjects(objects) {
        this.container.innerHTML = '<h3 class="text-lg font-bold mb-3">Multiple Selection</h3>';
        
        const commonProps = ['x', 'y', 'width', 'height', 'name', 'zIndex'];
        
        commonProps.forEach(prop => {
            // Handle undefined values (e.g., zIndex for old objects)
            let firstValue = objects[0][prop];
            if (firstValue === undefined && prop === 'zIndex') {
                firstValue = 0;
                // Don't set objects[0][prop] = 0 here - let the system handle zIndex properly
            }

            const allSame = objects.every(obj => {
                let val = obj[prop];
                if (val === undefined && prop === 'zIndex') {
                    val = 0;
                    // Don't set obj[prop] = 0 here - let the system handle zIndex properly
                }
                return val === firstValue;
            });

            // For zIndex, display only the object index (thousandths part)
            let displayValue;
            if (prop === 'zIndex' && typeof firstValue === 'number' && firstValue > 0) {
                const objectIndex = Math.floor((firstValue % 1) * 1000);
                displayValue = allSame ? objectIndex.toString() : '';
            } else {
                displayValue = allSame ? (typeof firstValue === 'number' ? firstValue.toFixed(1) : firstValue) : '';
            }
            
            // Format property label
            const formatLabel = (propName) => {
                if (propName === 'zIndex') return 'Z-Index';
                return propName.charAt(0).toUpperCase() + propName.slice(1);
            };
            
            const propContainer = document.createElement('div');
            propContainer.className = 'mb-3';
            
            const inputType = typeof firstValue === 'number' ? 'number' : 'text';
            
            propContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300">${formatLabel(prop)}</label>
                <input type="${inputType}" 
                       id="property-${prop}-${Date.now()}"
                       name="property-${prop}-${Date.now()}"
                       value="${displayValue}" 
                       placeholder="${allSame ? '' : 'multiple values'}"
                       class="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            `;
            
            const input = propContainer.querySelector('input');
            input.addEventListener('change', (e) => {
                let newValue = e.target.value;

                if (prop === 'zIndex') {
                    // For zIndex, update each object's zIndex with the same object index but current layer
                    objects.forEach(obj => {
                        const currentLayerIndex = Math.floor(obj.zIndex || 0);
                        const objectIndex = parseInt(newValue) || 0;
                        const newZIndex = currentLayerIndex + (objectIndex / 1000);

                        const oldValue = obj[prop];
                        obj[prop] = newZIndex;

                        // Notify about each object property change
                        this.stateManager.notifyListeners('objectPropertyChanged', obj, {
                            property: prop,
                            oldValue: oldValue,
                            newValue: newZIndex
                        });
                    });
                } else if (typeof firstValue === 'number') {
                    newValue = parseFloat(newValue);
                    if (isNaN(newValue)) {
                        newValue = 0;
                    }

                    objects.forEach(obj => {
                        const oldValue = obj[prop];
                        obj[prop] = newValue;

                        // Notify about each object property change
                        this.stateManager.notifyListeners('objectPropertyChanged', obj, {
                            property: prop,
                            oldValue: oldValue,
                            newValue: newValue
                        });
                    });
                }

                this.stateManager.markDirty();

                // Trigger redraw (important for zIndex changes to re-sort objects)
                this.stateManager.notifyListeners('selectedObjects', this.stateManager.get('selectedObjects'), this.stateManager.get('selectedObjects'));

                // Force canvas redraw (important for zIndex changes to re-sort and redraw objects)
                if (this.levelEditor && this.levelEditor.render) {
                    this.levelEditor.render();
                }

                // Update tab title immediately
                this.updateTabTitle();
            });
            
            this.container.appendChild(propContainer);
        });
        
        // Add layer information for multiple selection
        this.renderMultipleLayerInfo(objects);
    }

    renderLayerInfo(obj) {

        const level = this.levelEditor.getLevel();
        const layerInfo = this.getObjectLayerInfo(obj, level);

        const section = document.createElement('div');
        section.className = 'mt-4';
        section.innerHTML = '<h4 class="text-md font-bold mb-2">Layer Information</h4>';

        const layerContainer = document.createElement('div');
        layerContainer.className = 'mb-2';

        layerContainer.innerHTML = `
            <label class="block text-sm font-medium text-gray-300">Current Layer</label>
            <div class="mt-1 flex items-center space-x-2">
                <div class="w-4 h-4 rounded border details-layer-color" data-color="${layerInfo.color}"></div>
                <span class="text-sm text-gray-200">${layerInfo.name}</span>
                <span class="text-xs text-gray-400">(${layerInfo.objectCount} objects)</span>
            </div>
        `;
        
        // Set layer color using CSS variable
        const colorElement = layerContainer.querySelector('.details-layer-color');
        if (colorElement) {
            colorElement.style.setProperty('--layer-color', layerInfo.color);
        }

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
        
        const section = document.createElement('div');
        section.className = 'mt-4';
        section.innerHTML = '<h4 class="text-md font-bold mb-2">Layer Information</h4>';
        
        if (layerAnalysis.allSameLayer) {
            // All objects are on the same layer
            const layerInfo = layerAnalysis.layers[0];
            const layerContainer = document.createElement('div');
            layerContainer.className = 'mb-2';
            
            layerContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300">Current Layer</label>
                <div class="mt-1 flex items-center space-x-2">
                    <div class="w-4 h-4 rounded border details-layer-color" data-color="${layerInfo.color}"></div>
                    <span class="text-sm text-gray-200">${layerInfo.name}</span>
                    <span class="text-xs text-gray-400">(${layerInfo.objectCount} objects, ${objects.length} selected)</span>
                </div>
            `;
            
            // Set layer color using CSS variable
            const colorElement = layerContainer.querySelector('.details-layer-color');
            if (colorElement) {
                colorElement.style.setProperty('--layer-color', layerInfo.color);
            }
            
            section.appendChild(layerContainer);
        } else {
            // Objects are on different layers
            const layerContainer = document.createElement('div');
            layerContainer.className = 'mb-2';
            
            layerContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300">Layers (${layerAnalysis.layers.length} different)</label>
                <div class="mt-1 space-y-1">
            `;
            
            layerAnalysis.layers.forEach(layerInfo => {
                const layerItem = document.createElement('div');
                layerItem.className = 'flex items-center space-x-2 text-sm';
                layerItem.innerHTML = `
                    <div class="w-3 h-3 rounded border" style="background-color: ${layerInfo.color}"></div>
                    <span class="text-gray-200">${layerInfo.name}</span>
                    <span class="text-xs text-gray-400">(${layerInfo.selectedCount} selected, ${layerInfo.objectCount} total)</span>
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
        if (!obj.properties || Object.keys(obj.properties).length === 0) {
            return;
        }
        
        const section = document.createElement('div');
        section.className = 'mt-4';
        section.innerHTML = '<h4 class="text-md font-bold mb-2">Custom Properties</h4>';
        
        Object.entries(obj.properties).forEach(([key, value]) => {
            const propContainer = document.createElement('div');
            propContainer.className = 'mb-2';
            
            propContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300">${key}</label>
                <input type="text" 
                       id="custom-property-${key}-${Date.now()}"
                       name="custom-property-${key}-${Date.now()}"
                       value="${value}" 
                       class="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
            `;
            
            const input = propContainer.querySelector('input');
            input.addEventListener('change', (e) => {
                const oldValue = obj.properties[key];
                const newValue = e.target.value;
                obj.properties[key] = newValue;
                this.stateManager.markDirty();

                // Notify about custom property change
                this.stateManager.notifyListeners('objectPropertyChanged', obj, {
                    property: `properties.${key}`,
                    oldValue: oldValue,
                    newValue: newValue
                });

                // Update tab title immediately
                this.updateTabTitle();
            });
            
            section.appendChild(propContainer);
        });
        
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

    updateTabTitle() {
        const detailsTab = document.getElementById('details-tab');
        if (!detailsTab) return;
        
        const selectedObjects = this.getSelectedObjects();
        const count = selectedObjects.length;
        
        if (count === 0) {
            detailsTab.textContent = 'Details';
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
