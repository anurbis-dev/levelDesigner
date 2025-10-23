/**
 * Central state management for the level editor
 */

import { Logger } from '../utils/Logger.js';

export class StateManager {
    constructor() {
        this.state = this.createInitialState();
        this.listeners = new Map();
    }

    /**
     * Create initial state structure
     * @returns {Object} Initial state object
     */
    createInitialState() {
        return {
            // Editor state
            isDirty: false,
            currentLevel: null,
            currentLevelFileName: null,
            
            // UI state
            selectedObjects: new Set(),
            activeAssetTabs: new Set(), // No default tabs - loaded from content
            assetTabOrder: [], // No default tabs - loaded from content
            selectedAssets: new Set(),
            rightPanelTab: 'details',
            leftPanelTab: 'details', // Separate tab state for left panel
            
            // Validation state
            validation: {
                levelEditorReady: false,
                componentsReady: {
                    toolbar: false,
                    menuManager: false,
                    configManager: false,
                    stateManager: true, // Always true since we're in StateManager
                    eventHandlers: false,
                    renderOperations: false
                },
                cache: new Map() // For caching validation results
            },
            
            // Camera state
            camera: { x: 0, y: 0, zoom: 1 },
            
            // Mouse state
            mouse: {
                x: 0, y: 0, worldX: 0, worldY: 0,
                isLeftDown: false, isRightDown: false, isMiddleDown: false, isDragging: false,
                dragStartX: 0, dragStartY: 0, lastX: 0, lastY: 0,
                zoomStartX: 0, zoomStartY: 0,
                isDraggingAsset: false, isMarqueeSelecting: false, marqueeRect: null,
                marqueeStartX: null, marqueeStartY: null,
                isAssetMarqueeSelecting: false, isPlacingObjects: false,
                placingObjects: [], placingOffsets: [],
                draggingGroupId: null,
                altKey: false,
                constrainedAxis: null, // 'x' or 'y' when Shift is pressed
                axisCenter: null // {x, y} center of selected objects for axis constraint
            },
            
            // Keyboard state
            keyboard: {
                ctrlSnapToGrid: false,
                shiftKey: false,
                altKey: false
            },
            
            // Duplicate state
            duplicate: {
                isActive: false,
                objects: [],
                basePosition: { x: 0, y: 0 },
                isAltDragMode: false
            },
            
            // Outliner state
            outliner: {
                collapsedTypes: new Set()
            },
            
            // View state
            view: {
                fullscreen: false,
                gameMode: false,
                snapToGrid: false,
                objectBoundaries: false,
                objectCollisions: false,
                parallax: false,
                leftPanel: true,
                rightPanel: true,
                assetsPanel: true,
                console: true,
                toolbar: true
            },
            
            // Canvas state
            canvas: {
                showGrid: true,
                snapToGrid: false,
                gridSize: 32,
                gridColor: '#ffffff',
                gridThickness: 1,
                gridOpacity: 0.1,
                gridSubdivisions: 0,
                gridSubdivColor: '#666666',
                gridSubdivThickness: 0.5,
                snapTolerance: 80,
                gridType: 'rectangular',
                hexOrientation: 'pointy',
                backgroundColor: '#4b5563'
            },
            
                // UI state
                ui: {
                    fontScale: 1.0,
                    spacing: 1.0,
                    showTooltips: true,
                    backgroundColor: '#1f2937',
                    textColor: '#d1d5db',
                    activeColor: '#3b82f6',
                    activeTextColor: '#ffffff',
                    activeTabColor: '#374151'
                },
            
            // Editor state
            editor: {
                autoSave: false,
                autoSaveInterval: 5,
                undoHistoryLimit: 50,
                multiSelectMode: 'additive',
                axisConstraint: {
                    axisColor: '#cccccc',
                    axisWidth: 1,
                    showAxis: true
                }
            },
            
            // Panel state
            panels: {
                rightPanelWidth: 300,
                rightPanelPreviousWidth: 300,
                leftPanelWidth: 300,
                leftPanelPreviousWidth: 300,
                assetsPanelHeight: 256,
                assetsPanelPreviousHeight: 256,
                consoleHeight: 200,
                foldersWidth: 192
            },
            
            // Selection state
            selection: {
                outlineColor: '#3B82F6',
                outlineWidth: 2,
                groupOutlineColor: '#3B82F6',
                groupOutlineWidth: 4,
                marqueeColor: '#3B82F6',
                marqueeOpacity: 0.2,
                hierarchyHighlightColor: '#3B82F6'
            },
            
            // Touch state
            touch: {
                isPanning: false,
                isZooming: false,
                panThreshold: 2,
                zoomThreshold: 0.03,
                panSensitivity: 1.0,
                zoomIntensity: 0.05,
                longPressDelay: 500
            }
        };
        
        this.listeners = new Map();
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Get specific state property
     */
    get(key) {
        if (key.includes('.')) {
            // Handle nested properties like 'mouse.isLeftDown'
            const parts = key.split('.');
            let current = this.state;
            for (const part of parts) {
                if (current === null || current === undefined) return undefined;
                current = current[part];
            }
            return current;
        }
        return this.state[key];
    }

    /**
     * Set state property and notify listeners
     */
    set(key, value) {
        if (key === 'selectedObjects') {
        }

        if (key.includes('.')) {
            // Handle nested properties like 'view.grid'
            const parts = key.split('.');
            const lastPart = parts.pop();
            let current = this.state;

            // Navigate to the parent object
            for (const part of parts) {
                if (!current[part] || typeof current[part] !== 'object') {
                    current[part] = {};
                }
                current = current[part];
            }

            const oldValue = current[lastPart];
            current[lastPart] = value;
            this.notifyListeners(key, value, oldValue);
        } else {
            const oldValue = this.state[key];
            this.state[key] = value;
            this.notifyListeners(key, value, oldValue);
        }
    }

    /**
     * Update multiple state properties at once
     */
    update(updates) {
        const oldState = { ...this.state };
        
        Object.entries(updates).forEach(([key, value]) => {
            if (key.includes('.')) {
                // Handle nested properties like 'mouse.isLeftDown'
                const parts = key.split('.');
                let current = this.state;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            } else {
                this.state[key] = value;
            }
        });
        
        Object.keys(updates).forEach(key => {
            this.notifyListeners(key, this.get(key), oldState[key]);
        });
    }

    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.get(key)?.delete(callback);
        };
    }

    /**
     * Notify listeners of state changes
     */
    notifyListeners(key, newValue, oldValue) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    Logger.state.error('State listener error:', error);
                }
            });
        }
    }

    /**
     * Notify listeners with a specific event name
     * @param {string} eventName - Event name to notify
     * @param {*} data - Data to pass to listeners
     */
    notify(eventName, data = null) {
        this.notifyListeners(eventName, data, null);
    }

    /**
     * Mark level as dirty (has unsaved changes)
     */
    markDirty() {
        this.set('isDirty', true);
    }

    /**
     * Mark level as clean (saved)
     */
    markClean() {
        this.set('isDirty', false);
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.set('selectedObjects', new Set());
    }

    /**
     * Add object to selection
     */
    selectObject(objId) {
        const selected = new Set(this.get('selectedObjects'));
        selected.add(objId);
        this.set('selectedObjects', selected);
    }

    /**
     * Remove object from selection
     */
    deselectObject(objId) {
        const selected = new Set(this.get('selectedObjects'));
        selected.delete(objId);
        this.set('selectedObjects', selected);
    }

    /**
     * Set selection to specific objects
     */
    setSelection(objIds) {
        this.set('selectedObjects', new Set(objIds));
    }

    /**
     * Toggle object selection
     */
    toggleSelection(objId) {
        const selected = this.get('selectedObjects');
        if (selected.has(objId)) {
            this.deselectObject(objId);
        } else {
            this.selectObject(objId);
        }
    }

    /**
     * Notify about object property change
     */
    notifyObjectPropertyChanged(obj, property, newValue, oldValue) {
        this.notifyListeners('objectPropertyChanged', obj, {
            property,
            newValue,
            oldValue
        });
    }

    /**
     * Notify about layer objects count change
     */
    notifyLayerObjectsCountChanged(layerId, newCount, oldCount) {
        this.notifyListeners('layerObjectsCountChanged', layerId, {
            newCount,
            oldCount
        });
    }

    /**
     * Notify about layer property change
     */
    notifyLayerChanged(layerId, property, newValue, oldValue) {
        this.notifyListeners('layerChanged', layerId, {
            property,
            newValue,
            oldValue
        });
    }

    /**
     * Reset state to initial values
     */
    reset() {
        // Use the same structure as constructor
        this.state = this.createInitialState();
        
        // Notify all listeners
        this.listeners.forEach((callbacks, key) => {
            callbacks.forEach(callback => {
                try {
                    callback(this.state[key], undefined);
                } catch (error) {
                    Logger.state.error('State reset listener error:', error);
                }
            });
        });
    }

    /**
     * Update component readiness status
     * @param {string} component - Component name
     * @param {boolean} ready - Whether component is ready
     */
    updateComponentStatus(component, ready) {
        const validation = this.get('validation');
        if (validation.componentsReady.hasOwnProperty(component)) {
            validation.componentsReady[component] = ready;
            this.set('validation', validation);
        }
    }

    /**
     * Check if required components are ready
     * @param {string[]} components - Array of component names
     * @returns {boolean} - Whether all components are ready
     */
    areComponentsReady(components) {
        const validation = this.get('validation');
        return components.every(comp => validation.componentsReady[comp] === true);
    }

    /**
     * Set levelEditor readiness status
     * @param {boolean} ready - Whether levelEditor is ready
     */
    setLevelEditorReady(ready) {
        const validation = this.get('validation');
        validation.levelEditorReady = ready;
        this.set('validation', validation);
    }

    /**
     * Get cached validation result
     * @param {string} key - Cache key
     * @returns {any} - Cached value or null
     */
    getValidationCache(key) {
        const validation = this.get('validation');
        return validation.cache.get(key) || null;
    }

    /**
     * Set cached validation result
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (default: 1000)
     */
    setValidationCache(key, value, ttl = 1000) {
        const validation = this.get('validation');
        validation.cache.set(key, {
            value: value,
            timestamp: Date.now(),
            ttl: ttl
        });
        this.set('validation', validation);
    }

    /**
     * Clear expired validation cache entries
     */
    clearExpiredValidationCache() {
        const validation = this.get('validation');
        const now = Date.now();
        for (const [key, entry] of validation.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                validation.cache.delete(key);
            }
        }
        this.set('validation', validation);
    }
}
