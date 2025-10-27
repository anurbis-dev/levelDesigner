/**
 * ResizerManager - Unified manager for all panel resizers
 * 
 * Handles both mouse and touch events for panel resizers:
 * - Horizontal resizers (left/right panels, folders)
 * - Vertical resizers (assets panel, console)
 * - Automatic device detection and event routing
 * - Touch support toggle based on settings
 */

import { Logger } from '../utils/Logger.js';

export class ResizerManager {
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.stateManager = levelEditor?.stateManager;
        this.touchSupportManager = levelEditor?.touchSupportManager;
        this.touchInitializationManager = levelEditor?.touchInitializationManager;
        this.userPrefs = levelEditor?.userPrefs;
        
        // Track active resizers
        this.activeResizers = new Map(); // Map<element, resizerData>
        this.isTouchEnabled = true; // Default to enabled
        
        // Subscribe to touch.enabled setting changes
        this.setupTouchEnabledSubscription();
        
        Logger.ui.debug('ResizerManager: Initialized');
    }

    /**
     * Setup subscription to touch.enabled setting changes
     */
    setupTouchEnabledSubscription() {
        if (!this.stateManager) return;
        
        // Get initial value
        this.isTouchEnabled = this.stateManager.get('touch.enabled') ?? true;
        
        // Subscribe to changes
        this.stateManager.subscribe('touch.enabled', (enabled) => {
            this.isTouchEnabled = enabled;
            Logger.ui.debug('ResizerManager: Touch support toggled:', enabled);
            
            // Update all registered resizers
            this.updateAllResizersTouchSupport();
        });
    }

    /**
     * Register a resizer element
     * @param {HTMLElement} resizer - Resizer element
     * @param {HTMLElement} panel - Target panel element
     * @param {string} panelSide - Panel side ('left', 'right', 'assets', 'folders')
     * @param {string} direction - Resize direction ('horizontal', 'vertical')
     * @param {Function} onDoubleClick - Double click handler (optional)
     */
    registerResizer(resizer, panel, panelSide, direction, onDoubleClick = null) {
        if (!resizer || !panel) {
            Logger.ui.warn('ResizerManager: Invalid resizer or panel element');
            return;
        }

        const resizerId = resizer.id || `${panelSide}-resizer`;
        
        // Store resizer data
        const resizerData = {
            element: resizer,
            panel: panel,
            panelSide: panelSide,
            direction: direction,
            isActive: false,
            mouseHandlers: null,
            touchRegistered: false,
            onDoubleClick: onDoubleClick
        };
        
        this.activeResizers.set(resizer, resizerData);
        
        // Setup mouse events (always enabled)
        this.setupMouseEvents(resizer, panel, panelSide, direction);
        
        // Setup touch events (if touch support is enabled)
        if (this.isTouchEnabled) {
            this.setupTouchEvents(resizer, panel, panelSide, direction);
        }
        
        Logger.ui.debug(`ResizerManager: Registered ${direction} resizer for ${panelSide} panel`);
    }

    /**
     * Setup mouse event handlers for resizer
     */
    setupMouseEvents(resizer, panel, panelSide, direction) {
        const resizerData = this.activeResizers.get(resizer);
        if (!resizerData) return;

        let isResizing = false;
        let initialMouseX = 0;
        let initialMouseY = 0;
        let initialPanelSize = 0;

        // Mouse down handler
        const handleMouseDown = (e) => {
            isResizing = true;
            resizerData.isActive = true;
            
            // Store initial values
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            initialPanelSize = direction === 'horizontal' ? panel.offsetWidth : panel.offsetHeight;
            
            // Apply visual feedback
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
            resizer.classList.add('resizing');
            
            // Add global listeners for this resize operation
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
            e.stopPropagation();
        };

        // Mouse move handler
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            let newSize;
            if (direction === 'horizontal') {
                // Calculate new width based on mouse movement
                const deltaX = e.clientX - initialMouseX;
                newSize = Math.max(100, Math.min(800, initialPanelSize + deltaX));
            } else {
                // Calculate new height based on mouse movement
                const deltaY = e.clientY - initialMouseY;
                newSize = Math.max(100, Math.min(800, initialPanelSize + deltaY));
            }
            
            // Apply resize using unified logic
            this.handlePanelResize(panel, panelSide, direction, newSize);
        };

        // Mouse up handler
        const handleMouseUp = () => {
            if (!isResizing) return;
            
            isResizing = false;
            resizerData.isActive = false;
            
            // Remove visual feedback
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizer.classList.remove('resizing');
            
            // Remove global listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Save final size
            const currentSize = direction === 'horizontal' ? panel.offsetWidth : panel.offsetHeight;
            this.savePanelSize(panelSide, direction, currentSize);
            
            Logger.ui.debug(`ResizerManager: ${direction} resize completed for ${panelSide} panel: ${currentSize}px`);
        };

        // Double click handler
        const handleDoubleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (resizerData.onDoubleClick) {
                resizerData.onDoubleClick(e, resizer, panel, panelSide);
            }
        };

        // Store handlers for cleanup
        resizerData.mouseHandlers = {
            mousedown: handleMouseDown,
            mousemove: handleMouseMove,
            mouseup: handleMouseUp,
            dblclick: handleDoubleClick
        };

        // Add event listeners
        resizer.addEventListener('mousedown', handleMouseDown);
        resizer.addEventListener('dblclick', handleDoubleClick);
    }

    /**
     * Setup touch event handlers for resizer
     */
    setupTouchEvents(resizer, panel, panelSide, direction) {
        const resizerData = this.activeResizers.get(resizer);
        if (!resizerData || resizerData.touchRegistered) return;

        // Touch support is no longer needed
        resizerData.touchRegistered = true;
        Logger.ui.debug(`ResizerManager: Touch support disabled for ${panelSide} resizer`);
    }

    /**
     * Update touch support for all resizers
     */
    updateAllResizersTouchSupport() {
        this.activeResizers.forEach((resizerData, resizer) => {
            if (this.isTouchEnabled && !resizerData.touchRegistered) {
                // Enable touch support
                this.setupTouchEvents(resizer, resizerData.panel, resizerData.panelSide, resizerData.direction);
            } else if (!this.isTouchEnabled && resizerData.touchRegistered) {
                // Disable touch support
                this.touchSupportManager?.unregisterElement(resizer);
                resizerData.touchRegistered = false;
                Logger.ui.debug(`ResizerManager: Touch support disabled for ${resizerData.panelSide} resizer`);
            }
        });
    }

    /**
     * Handle panel resize using unified logic
     */
    handlePanelResize(panel, panelSide, direction, newSize) {
        if (direction === 'horizontal') {
            panel.style.width = newSize + 'px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
        } else {
            panel.style.height = newSize + 'px';
            panel.style.flexShrink = '0';
        }
        
        // Update UI
        if (this.levelEditor?.panelPositionManager) {
            this.levelEditor.panelPositionManager._updateUI();
        }
    }

    /**
     * Save panel size to StateManager and user preferences
     */
    savePanelSize(panelSide, direction, size) {
        const sizeKey = direction === 'horizontal' ? 'Width' : 'Height';
        const stateKey = `panels.${panelSide}Panel${sizeKey}`;
        const prefKey = `${panelSide}Panel${sizeKey}`;
        
        // Special handling for folders panel
        if (panelSide === 'folders') {
            if (this.stateManager) {
                this.stateManager.set('panels.foldersWidth', size);
            }
            if (this.userPrefs) {
                this.userPrefs.set('foldersWidth', size);
            }
            // Update content visibility for folders panel
            if (this.levelEditor?.assetPanel) {
                this.levelEditor.assetPanel.updateContentVisibility(size);
            }
        } else {
            if (this.stateManager) {
                this.stateManager.set(stateKey, size);
            }
            if (this.userPrefs) {
                this.userPrefs.set(prefKey, size);
            }
        }
    }

    /**
     * Unregister a resizer element
     */
    unregisterResizer(resizer) {
        const resizerData = this.activeResizers.get(resizer);
        if (!resizerData) return;

        // Remove mouse event listeners
        if (resizerData.mouseHandlers) {
            resizer.removeEventListener('mousedown', resizerData.mouseHandlers.mousedown);
            resizer.removeEventListener('dblclick', resizerData.mouseHandlers.dblclick);
            document.removeEventListener('mousemove', resizerData.mouseHandlers.mousemove);
            document.removeEventListener('mouseup', resizerData.mouseHandlers.mouseup);
        }

        // Remove touch event listeners
        if (resizerData.touchRegistered) {
            this.touchSupportManager?.unregisterElement(resizer);
        }

        // Clean up global listeners flag
        if (resizer._globalListenersAdded) {
            delete resizer._globalListenersAdded;
        }

        this.activeResizers.delete(resizer);
        Logger.ui.debug(`ResizerManager: Unregistered resizer for ${resizerData.panelSide} panel`);
    }

    /**
     * Get resizer data for an element
     */
    getResizerData(resizer) {
        return this.activeResizers.get(resizer);
    }

    /**
     * Check if touch support is enabled
     */
    isTouchSupportEnabled() {
        return this.isTouchEnabled;
    }

    /**
     * Destroy the manager and clean up all resizers
     */
    destroy() {
        Logger.ui.debug('ResizerManager: Destroying...');
        
        // Unregister all resizers
        this.activeResizers.forEach((resizerData, resizer) => {
            this.unregisterResizer(resizer);
        });
        
        this.activeResizers.clear();
        Logger.ui.debug('ResizerManager: Destroyed');
    }
}
