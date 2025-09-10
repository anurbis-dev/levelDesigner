/**
 * Central state management for the level editor
 */

import { Logger } from '../utils/Logger.js';

export class StateManager {
    constructor() {
        this.state = {
            // Editor state
            isDirty: false,
            currentLevel: null,
            currentLevelFileName: null,
            
            // UI state
            selectedObjects: new Set(),
            activeAssetTabs: new Set(['Tiles']),
            assetTabOrder: ['Tiles', 'Characters', 'Collectibles', 'Enemies', 'Environment', 'Objects'],
            selectedAssets: new Set(),
            rightPanelTab: 'details',
            
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
                grid: true,
                gameMode: false,
                snapToGrid: false,
                objectBoundaries: false,
                objectCollisions: false
            },
            
            // Canvas state
            canvas: {
                showGrid: true,
                snapToGrid: false,
                gridSize: 32,
                gridColor: 'rgba(255, 255, 255, 0.1)',
                gridThickness: 1,
                gridOpacity: 0.1
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
     * Reset state to initial values
     */
    reset() {
        this.state = {
            isDirty: false,
            currentLevel: null,
            currentLevelFileName: null,
            selectedObjects: new Set(),
            activeAssetTabs: new Set(['Tiles']),
            assetTabOrder: ['Tiles', 'Characters', 'Collectibles', 'Enemies', 'Environment', 'Objects'],
            selectedAssets: new Set(),
            rightPanelTab: 'details',
            camera: { x: 0, y: 0, zoom: 1 },
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
                altKey: false
            },
            duplicate: {
                isActive: false,
                objects: [],
                basePosition: { x: 0, y: 0 },
                isAltDragMode: false
            },
            outliner: {
                collapsedTypes: new Set()
            },
            canvas: {
                showGrid: true,
                snapToGrid: false,
                gridSize: 32,
                gridColor: 'rgba(255, 255, 255, 0.1)',
                gridThickness: 1,
                gridOpacity: 0.1
            }
        };
        
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
}
