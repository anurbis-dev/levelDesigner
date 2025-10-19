/**
 * TouchSupportManager - Centralized touch screen support for UI elements
 * 
 * Provides unified touch handling for:
 * - Panel resizers (horizontal and vertical)
 * - Tab dragging
 * - Button interactions
 * - Context menus
 * - Any other touch-enabled UI elements
 */

import { Logger } from '../utils/Logger.js';

export class TouchSupportManager {
    constructor() {
        this.touchConfigs = new Map();
        this.activeTouches = new Map();
        this.doubleTapTimers = new Map();
        
        // Default configuration for different element types
        this.defaultConfigs = {
            panelResizer: {
                type: 'resize',
                direction: 'horizontal', // 'horizontal' or 'vertical'
                minSize: 100,
                maxSize: 600,
                doubleTapThreshold: 300,
                singleTapDelay: 50,
                onResize: null,
                onDoubleTap: null,
                onResizeStart: null,
                onResizeEnd: null
            },
            tabDragger: {
                type: 'drag',
                direction: 'horizontal',
                doubleTapThreshold: 300,
                singleTapDelay: 50,
                onDrag: null,
                onDragStart: null,
                onDragEnd: null,
                onDoubleTap: null
            },
            button: {
                type: 'click',
                doubleTapThreshold: 300,
                singleTapDelay: 50,
                onTap: null,
                onDoubleTap: null,
                onLongPress: null,
                longPressDelay: 500
            }
        };
        
        Logger.ui.info('TouchSupportManager initialized');
    }

    /**
     * Register an element for touch support
     * @param {HTMLElement} element - Element to add touch support to
     * @param {string} configType - Type of configuration to use
     * @param {Object} customConfig - Custom configuration overrides
     */
    registerElement(element, configType, customConfig = {}) {
        if (!element || !configType) {
            Logger.ui.warn('TouchSupportManager: Invalid element or config type');
            return;
        }

        const config = { ...this.defaultConfigs[configType], ...customConfig };
        this.touchConfigs.set(element, config);
        
        this.setupTouchEvents(element, config);
        
        Logger.ui.debug(`TouchSupportManager: Registered ${configType} for element`, element);
    }

    /**
     * Setup touch events for an element
     * @param {HTMLElement} element - Element to setup
     * @param {Object} config - Configuration object
     */
    setupTouchEvents(element, config) {
        // Add CSS properties for better touch handling
        element.style.touchAction = 'none';
        element.style.userSelect = 'none';
        
        // Touch start - passive to avoid intervention warnings
        element.addEventListener('touchstart', (e) => this.handleTouchStart(e, element, config), { passive: true });
        
        // Touch move - passive to avoid intervention warnings
        element.addEventListener('touchmove', (e) => this.handleTouchMove(e, element, config), { passive: true });
        
        // Touch end - passive for better performance
        element.addEventListener('touchend', (e) => this.handleTouchEnd(e, element, config), { passive: true });
        
        // Touch cancel - passive
        element.addEventListener('touchcancel', (e) => this.handleTouchCancel(e, element, config), { passive: true });
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchStart(e, element, config) {
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const touchId = touch.identifier;
        const currentTime = Date.now();
        
        // Store touch data
        this.activeTouches.set(touchId, {
            element,
            config,
            startTime: currentTime,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            isActive: true
        });
        
        // Handle double tap detection
        if (config.doubleTapThreshold > 0) {
            const lastTapTime = this.doubleTapTimers.get(element) || 0;
            const timeDiff = currentTime - lastTapTime;
            
            if (timeDiff < config.doubleTapThreshold && timeDiff > 0) {
                // Double tap detected
                this.doubleTapTimers.delete(element);
                this.handleDoubleTap(element, config, touch);
                // Note: Cannot preventDefault in passive event
                return;
            }
            
            // Store tap time for next potential double tap
            this.doubleTapTimers.set(element, currentTime);
        }
        
        // Handle different interaction types
        switch (config.type) {
            case 'resize':
                this.handleResizeStart(element, config, touch);
                break;
            case 'drag':
                this.handleDragStart(element, config, touch);
                break;
            case 'click':
                this.handleClickStart(element, config, touch);
                break;
        }
        
        // Note: Cannot preventDefault in passive event
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchMove(e, element, config) {
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const touchId = touch.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (!touchData || !touchData.isActive) return;
        
        // Update touch data
        touchData.lastX = touch.clientX;
        touchData.lastY = touch.clientY;
        
        // Handle different interaction types
        switch (config.type) {
            case 'resize':
                this.handleResizeMove(element, config, touch, touchData);
                break;
            case 'drag':
                this.handleDragMove(element, config, touch, touchData);
                break;
        }
        
        // Note: Cannot preventDefault in passive event
        // Touch events are now handled through CSS touch-action: none
    }

    /**
     * Handle touch end event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchEnd(e, element, config) {
        const touchId = e.changedTouches[0]?.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (!touchData) return;
        
        // Mark touch as inactive
        touchData.isActive = false;
        
        // Handle different interaction types
        switch (config.type) {
            case 'resize':
                this.handleResizeEnd(element, config, touchData);
                break;
            case 'drag':
                this.handleDragEnd(element, config, touchData);
                break;
            case 'click':
                this.handleClickEnd(element, config, touchData);
                break;
        }
        
        // Clean up touch data
        this.activeTouches.delete(touchId);
        
        // Note: Cannot preventDefault in passive event
    }

    /**
     * Handle touch cancel event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchCancel(e, element, config) {
        const touchId = e.changedTouches[0]?.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (touchData) {
            touchData.isActive = false;
            this.activeTouches.delete(touchId);
        }
        
        // Clear any pending timers
        this.clearElementTimers(element);
    }

    /**
     * Handle resize start
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     */
    handleResizeStart(element, config, touch) {
        const targetPanel = this.getTargetPanel(element);
        if (!targetPanel) return;
        
        // Store initial values
        const touchData = this.activeTouches.get(touch.identifier);
        touchData.initialSize = config.direction === 'horizontal' ? 
            targetPanel.offsetWidth : targetPanel.offsetHeight;
        
        // Apply visual feedback
        element.classList.add('resizing');
        document.body.style.cursor = config.direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
        
        // Call custom handler
        if (config.onResizeStart) {
            config.onResizeStart(element, targetPanel, touch);
        }
        
        Logger.ui.debug(`TouchSupportManager: Resize started for ${config.direction} panel`);
    }

    /**
     * Handle resize move
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     * @param {Object} touchData - Touch data
     */
    handleResizeMove(element, config, touch, touchData) {
        const targetPanel = this.getTargetPanel(element);
        if (!targetPanel) return;
        
        let delta;
        if (config.direction === 'horizontal') {
            // For horizontal resizers, check if it's right panel
            const isRightPanel = element.id && element.id.includes('right');
            delta = touch.clientX - touchData.startX;
            // Right panel: finger right = panel smaller (negative delta)
            // Left panel: finger right = panel bigger (positive delta)
            if (isRightPanel) {
                delta = -delta;
            }
        } else {
            // For vertical resizers (assets panel) - match mouse logic
            // Mouse uses: initialPanelHeight - deltaY
            // So we need to invert the delta for touch to match
            delta = -(touch.clientY - touchData.startY);
        }
        
        const newSize = Math.max(
            config.minSize, 
            Math.min(config.maxSize, touchData.initialSize + delta)
        );
        
        // Call custom handler (which will handle the resize logic)
        if (config.onResize) {
            config.onResize(element, targetPanel, newSize, touch);
        }
    }

    /**
     * Handle resize end
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Object} touchData - Touch data
     */
    handleResizeEnd(element, config, touchData) {
        const targetPanel = this.getTargetPanel(element);
        if (!targetPanel) return;
        
        // Remove visual feedback
        element.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Call custom handler
        if (config.onResizeEnd) {
            const currentSize = config.direction === 'horizontal' ? 
                targetPanel.offsetWidth : targetPanel.offsetHeight;
            config.onResizeEnd(element, targetPanel, currentSize);
        }
        
        Logger.ui.debug(`TouchSupportManager: Resize ended for ${config.direction} panel`);
    }

    /**
     * Handle drag start
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     */
    handleDragStart(element, config, touch) {
        // Apply visual feedback
        element.classList.add('dragging');
        
        // Call custom handler
        if (config.onDragStart) {
            config.onDragStart(element, touch);
        }
        
        Logger.ui.debug('TouchSupportManager: Drag started');
    }

    /**
     * Handle drag move
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     * @param {Object} touchData - Touch data
     */
    handleDragMove(element, config, touch, touchData) {
        // Call custom handler
        if (config.onDrag) {
            config.onDrag(element, touch, touchData);
        }
    }

    /**
     * Handle drag end
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Object} touchData - Touch data
     */
    handleDragEnd(element, config, touchData) {
        // Remove visual feedback
        element.classList.remove('dragging');
        
        // Call custom handler
        if (config.onDragEnd) {
            config.onDragEnd(element, touchData);
        }
        
        Logger.ui.debug('TouchSupportManager: Drag ended');
    }

    /**
     * Handle click start
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     */
    handleClickStart(element, config, touch) {
        // Start long press timer if configured
        if (config.longPressDelay > 0) {
            const touchData = this.activeTouches.get(touch.identifier);
            touchData.longPressTimer = setTimeout(() => {
                if (config.onLongPress) {
                    config.onLongPress(element, touch);
                }
            }, config.longPressDelay);
        }
    }

    /**
     * Handle click end
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Object} touchData - Touch data
     */
    handleClickEnd(element, config, touchData) {
        // Clear long press timer
        if (touchData.longPressTimer) {
            clearTimeout(touchData.longPressTimer);
        }
        
        // Check if this was a single tap (not part of double tap)
        const timeDiff = Date.now() - touchData.startTime;
        if (timeDiff < config.singleTapDelay) {
            // This might be part of a double tap, wait
            setTimeout(() => {
                if (!this.doubleTapTimers.has(element)) {
                    // Single tap confirmed
                    if (config.onTap) {
                        config.onTap(element);
                    }
                }
            }, config.singleTapDelay);
        } else {
            // Single tap
            if (config.onTap) {
                config.onTap(element);
            }
        }
    }

    /**
     * Handle double tap
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     */
    handleDoubleTap(element, config, touch) {
        // Call custom handler
        if (config.onDoubleTap) {
            config.onDoubleTap(element, touch);
        }
        
        Logger.ui.debug('TouchSupportManager: Double tap detected');
    }

    /**
     * Universal double-click/double-tap handler for panel resizers
     * @param {HTMLElement} element - Resizer element
     * @param {Object} config - Configuration with panel info
     */
    handlePanelDoubleClick(element, config) {
        const { panel, panelSide, stateManager, userPrefs, direction } = config;
        
        if (!panel || !stateManager) {
            Logger.ui.warn('TouchSupportManager: Missing panel or stateManager for double-click');
            return;
        }

        const currentSize = direction === 'horizontal' ? panel.offsetWidth : panel.offsetHeight;
        
        // Use config-provided keys or generate them
        const stateKey = config.stateKey || (direction === 'horizontal' ? 
            `panels.${panelSide}PanelWidth` : 'panels.assetsPanelHeight');
        const prefKey = config.prefKey || (direction === 'horizontal' ? 
            `${panelSide}PanelWidth` : 'assetsPanelHeight');
        const previousStateKey = direction === 'horizontal' ? 
            `panels.${panelSide}PanelPreviousWidth` : 'panels.assetsPanelPreviousHeight';
        
        const savedSize = stateManager.get(stateKey) ?? (direction === 'horizontal' ? 300 : 256);
        const isCollapsed = savedSize <= 5; // Small threshold for collapsed panels
        
        Logger.ui.info(`${panelSide || 'assets'} panel double-click: currentSize=${currentSize}, savedSize=${savedSize}, isCollapsed=${isCollapsed}`);
        
        if (isCollapsed) {
            // Expand to last known size from StateManager
            const maxSize = direction === 'horizontal' ? 800 : 600;
            const lastKnownSize = stateManager.get(previousStateKey) ?? (direction === 'horizontal' ? 300 : 256);
            const newSize = Math.min(lastKnownSize, maxSize);
            
            if (direction === 'horizontal') {
                panel.style.width = newSize + 'px';
                panel.style.flexShrink = '0';
                panel.style.flexGrow = '0';
            } else {
                panel.style.display = 'flex';
                panel.style.height = newSize + 'px';
                panel.style.flexShrink = '0';
            }
            
            // Save expanded state
            stateManager.set(stateKey, newSize);
            if (userPrefs) {
                userPrefs.set(prefKey, newSize);
            }
            
            Logger.ui.info(`Expanded ${panelSide || 'assets'} panel to ${newSize}px`);
        } else {
            // Collapse - save current size as last known size
            stateManager.set(previousStateKey, currentSize);
            
            if (direction === 'horizontal') {
                panel.style.width = '0px';
                panel.style.flexShrink = '1';
                panel.style.flexGrow = '0';
            } else {
                panel.style.height = '0px';
                panel.style.display = 'none';
            }
            
            // Save collapsed state
            stateManager.set(stateKey, 0);
            if (userPrefs) {
                userPrefs.set(prefKey, 0);
            }
            
            Logger.ui.info(`Collapsed ${panelSide || 'assets'} panel to 0px`);
        }
        
        // Update canvas
        if (window.updateCanvas) {
            window.updateCanvas();
        }
        
    }

    /**
     * Get target panel for a resizer element
     * @param {HTMLElement} element - Resizer element
     * @returns {HTMLElement|null} - Target panel element
     */
    getTargetPanel(element) {
        // Try to find panel by ID pattern
        const resizerId = element.id;
        if (resizerId) {
            const panelId = resizerId.replace('resizer-', '').replace('-tabs-panel', '-tabs-panel');
            const panel = document.getElementById(panelId);
            if (panel) return panel;
            
            // Try assets panel
            if (resizerId === 'resizer-assets') {
                return document.getElementById('assets-panel');
            }
        }
        
        // Try to find panel by position
        const nextSibling = element.nextElementSibling;
        const prevSibling = element.previousElementSibling;
        
        if (nextSibling && nextSibling.classList.contains('panel')) {
            return nextSibling;
        }
        if (prevSibling && prevSibling.classList.contains('panel')) {
            return prevSibling;
        }
        
        return null;
    }

    /**
     * Clear timers for an element
     * @param {HTMLElement} element - Element
     */
    clearElementTimers(element) {
        this.doubleTapTimers.delete(element);
    }


    /**
     * Unregister an element from touch support
     * @param {HTMLElement} element - Element to unregister
     */
    unregisterElement(element) {
        this.touchConfigs.delete(element);
        this.clearElementTimers(element);
        
        // Remove touch event listeners
        element.removeEventListener('touchstart', this.handleTouchStart);
        element.removeEventListener('touchmove', this.handleTouchMove);
        element.removeEventListener('touchend', this.handleTouchEnd);
        element.removeEventListener('touchcancel', this.handleTouchCancel);
        
        Logger.ui.debug('TouchSupportManager: Unregistered element', element);
    }

    /**
     * Update configuration for an element
     * @param {HTMLElement} element - Element
     * @param {Object} newConfig - New configuration
     */
    updateConfig(element, newConfig) {
        const currentConfig = this.touchConfigs.get(element);
        if (currentConfig) {
            const updatedConfig = { ...currentConfig, ...newConfig };
            this.touchConfigs.set(element, updatedConfig);
            Logger.ui.debug('TouchSupportManager: Updated config for element', element);
        }
    }

    /**
     * Get configuration for an element
     * @param {HTMLElement} element - Element
     * @returns {Object|null} - Configuration object
     */
    getConfig(element) {
        return this.touchConfigs.get(element) || null;
    }

    /**
     * Check if element is registered
     * @param {HTMLElement} element - Element
     * @returns {boolean} - True if registered
     */
    isRegistered(element) {
        return this.touchConfigs.has(element);
    }

    /**
     * Get all registered elements
     * @returns {Array} - Array of registered elements
     */
    getRegisteredElements() {
        return Array.from(this.touchConfigs.keys());
    }

    /**
     * Clear all registrations and timers
     */
    clear() {
        this.touchConfigs.clear();
        this.activeTouches.clear();
        this.doubleTapTimers.clear();
        
        Logger.ui.info('TouchSupportManager: Cleared all registrations');
    }

    /**
     * Destroy the manager and clean up
     */
    destroy() {
        // Unregister all elements
        for (const element of this.touchConfigs.keys()) {
            this.unregisterElement(element);
        }
        
        this.clear();
        
        Logger.ui.info('TouchSupportManager: Destroyed');
    }
}
