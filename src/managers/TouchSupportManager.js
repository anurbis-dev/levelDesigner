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
    constructor(stateManager = null, browserGesturePreventionManager = null) {
        this.stateManager = stateManager;
        this.browserGesturePreventionManager = browserGesturePreventionManager;
        this.touchConfigs = new Map(); // Map<element, config>
        this.elementConfigs = new Map(); // Map<element, Set<configType>> - track multiple configs per element
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
            },
            marqueeSelection: {
                type: 'marquee',
                minMovement: 5,
                onMarqueeStart: null,
                onMarqueeMove: null,
                onMarqueeEnd: null
            },
            longPressMarquee: {
                type: 'longPressMarquee',
                minMovement: 5,
                longPressDelay: 500,
                onMarqueeStart: null,
                onMarqueeMove: null,
                onMarqueeEnd: null
            },
            twoFingerPan: {
                type: 'twoFingerPan',
                minMovement: 5,
                onPanStart: null,
                onPanMove: null,
                onPanEnd: null
            },
            twoFingerContext: {
                type: 'twoFingerContext',
                tapThreshold: 200,
                onTwoFingerTap: null
            },
            twoFingerZoom: {
                type: 'twoFingerZoom',
                minScale: 0.1,
                maxScale: 10,
                onZoomStart: null,
                onZoomMove: null,
                onZoomEnd: null
            },
            twoFingerPanZoom: {
                type: 'twoFingerPanZoom',
                minScale: 0.1,
                maxScale: 10,
                minMovement: 5,
                onPanStart: null,
                onPanMove: null,
                onPanEnd: null,
                onZoomStart: null,
                onZoomMove: null,
                onZoomEnd: null
            },
            assetDragDrop: {
                type: 'assetDragDrop',
                minMovement: 10,
                onDragStart: null,
                onDragEnd: null
            }
        };
        
        Logger.ui.debug('TouchSupportManager initialized');
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

        Logger.ui.debug('TouchSupportManager: Registering element', element.tagName, element.id, 'with config type', configType);

        // Initialize element configs tracking if not exists
        if (!this.elementConfigs.has(element)) {
            this.elementConfigs.set(element, new Set());
        }

        // Check if this specific config type is already registered for this element
        if (this.elementConfigs.get(element).has(configType)) {
            Logger.ui.debug(`TouchSupportManager: ${configType} already registered for element, skipping`);
            return;
        }

        // Add config type to tracking
        this.elementConfigs.get(element).add(configType);

        // If this is the first config for this element, setup touch events
        if (!this.touchConfigs.has(element)) {
            const config = { ...this.defaultConfigs[configType], ...customConfig };
            this.touchConfigs.set(element, config);
            this.setupTouchEvents(element, config);
            Logger.ui.debug(`TouchSupportManager: First registration for element with ${configType}`);
        } else {
            // Element already has touch events, merge the additional config type
            const existingConfig = this.touchConfigs.get(element);
            const newConfig = { ...this.defaultConfigs[configType], ...customConfig };
            
            Logger.ui.debug(`TouchSupportManager: Merging config type ${configType}`);
            
            // Merge configurations - preserve all handlers
            const mergedConfig = {
                ...existingConfig,
                // Only add new properties that don't exist in existing config
                ...Object.fromEntries(
                    Object.entries(newConfig).filter(([key, value]) => 
                        !existingConfig.hasOwnProperty(key) || !existingConfig[key]
                    )
                ),
                // Explicitly preserve all handlers - prioritize existing handlers
                onPanStart: existingConfig.onPanStart || newConfig.onPanStart,
                onPanMove: existingConfig.onPanMove || newConfig.onPanMove,
                onPanEnd: existingConfig.onPanEnd || newConfig.onPanEnd,
                onZoomStart: existingConfig.onZoomStart || newConfig.onZoomStart,
                onZoomMove: existingConfig.onZoomMove || newConfig.onZoomMove,
                onZoomEnd: existingConfig.onZoomEnd || newConfig.onZoomEnd,
                onMarqueeStart: existingConfig.onMarqueeStart || newConfig.onMarqueeStart,
                onMarqueeMove: existingConfig.onMarqueeMove || newConfig.onMarqueeMove,
                onMarqueeEnd: existingConfig.onMarqueeEnd || newConfig.onMarqueeEnd,
                onTwoFingerTap: existingConfig.onTwoFingerTap || newConfig.onTwoFingerTap
            };
            
            this.touchConfigs.set(element, mergedConfig);
            Logger.ui.debug('TouchSupportManager: Configuration merged successfully');
        }
    }


    /**
     * Setup touch events for an element
     * @param {HTMLElement} element - Element to setup
     * @param {Object} config - Configuration object
     */
    setupTouchEvents(element, config) {
        Logger.ui.debug('TouchSupportManager: setupTouchEvents called for', config.type, element.tagName, element.id);
        
        // Register element with browser gesture prevention manager
        if (this.browserGesturePreventionManager) {
            const preventionOptions = this.getPreventionOptions(config);
            this.browserGesturePreventionManager.registerElement(element, preventionOptions);
        }
        
        // Create bound event handlers that always get the latest config
        const touchStartHandler = (e) => {
            const currentConfig = this.touchConfigs.get(element);
            if (currentConfig) {
                this.handleTouchStart(e, element, currentConfig);
            }
        };
        const touchMoveHandler = (e) => {
            const currentConfig = this.touchConfigs.get(element);
            if (currentConfig) {
                this.handleTouchMove(e, element, currentConfig);
            }
        };
        const touchEndHandler = (e) => {
            const currentConfig = this.touchConfigs.get(element);
            if (currentConfig) {
                this.handleTouchEnd(e, element, currentConfig);
            }
        };
        const touchCancelHandler = (e) => {
            const currentConfig = this.touchConfigs.get(element);
            if (currentConfig) {
                this.handleTouchCancel(e, element, currentConfig);
            }
        };
        
        // Store handlers on element for cleanup
        element._touchHandlers = {
            touchstart: touchStartHandler,
            touchmove: touchMoveHandler,
            touchend: touchEndHandler,
            touchcancel: touchCancelHandler
        };
        
        // Touch start - passive to avoid intervention warnings
        element.addEventListener('touchstart', touchStartHandler, { passive: true });
        
        // Touch move - non-passive for pan/zoom gestures that need preventDefault
        const isPanZoomGesture = config.type === 'twoFingerPan' || config.type === 'twoFingerZoom' || config.type === 'twoFingerPanZoom';
        element.addEventListener('touchmove', touchMoveHandler, { passive: !isPanZoomGesture });
        
        // Touch end - passive for better performance
        element.addEventListener('touchend', touchEndHandler, { passive: true });
        
        // Touch cancel - passive
        element.addEventListener('touchcancel', touchCancelHandler, { passive: true });
    }

    /**
     * Get prevention options for a configuration type
     * @private
     */
    getPreventionOptions(config) {
        const options = {
            touchAction: 'none',
            preventContextMenu: true
        };

        switch (config.type) {
            case 'marqueeSelection':
                options.preventHorizontalSwipe = true;
                options.preventVerticalSwipe = true;
                break;
            case 'twoFingerPan':
            case 'twoFingerZoom':
            case 'twoFingerPanZoom':
                // Don't prevent gestures for pan/zoom - they need to work
                options.preventHorizontalSwipe = false;
                options.preventVerticalSwipe = false;
                options.touchAction = 'auto';
                break;
            case 'resize':
                options.preventHorizontalSwipe = true;
                break;
            case 'drag':
                options.preventHorizontalSwipe = true;
                options.preventVerticalSwipe = true;
                break;
            case 'button':
                options.preventHorizontalSwipe = false;
                options.preventVerticalSwipe = false;
                break;
        }

        return options;
    }


    /**
     * Set appropriate touch-action CSS property based on gesture type
     */
    setTouchAction(element, config) {
        switch (config.type) {
            case 'marqueeSelection':
                // Prevent browser navigation completely
                element.style.touchAction = 'none';
                break;
            case 'longPressMarquee':
                // Allow normal scrolling, global prevention handles swipes
                element.style.touchAction = 'auto';
                break;
            case 'twoFingerPan':
                // Allow panning but prevent zoom
                element.style.touchAction = 'pan-x pan-y';
                break;
            case 'twoFingerZoom':
                // Allow zoom but prevent panning
                element.style.touchAction = 'manipulation';
                break;
            case 'twoFingerPanZoom':
                // Allow both pan and zoom
                element.style.touchAction = 'auto';
                break;
            case 'twoFingerContext':
                // Allow all gestures for context menu
                element.style.touchAction = 'auto';
                break;
            case 'resize':
            case 'drag':
            case 'tabDragger':
            case 'assetDragDrop':
                // Prevent all gestures for precise control
                element.style.touchAction = 'none';
                break;
            case 'button':
                // Allow tap but prevent other gestures
                element.style.touchAction = 'manipulation';
                break;
            default:
                // Default: allow standard gestures
                element.style.touchAction = 'auto';
                break;
        }
    }


    /**
     * Handle touch start event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchStart(e, element, config) {
        const currentTime = Date.now();
        
        Logger.ui.debug('TouchSupportManager: handleTouchStart called', config.type, element.tagName, element.id, 'touches:', e.touches.length);
        
        // Prevent default browser behavior for pan/zoom gestures
        if (config.type === 'twoFingerPan' || config.type === 'twoFingerZoom' || config.type === 'twoFingerPanZoom') {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Handle different touch counts
        if (e.touches.length === 1) {
            this.handleSingleTouchStart(e, element, config, currentTime);
        } else if (e.touches.length === 2) {
            this.handleTwoTouchStart(e, element, config, currentTime);
        }
        
        // Note: Cannot preventDefault in passive event
    }

    /**
     * Handle single touch start
     */
    handleSingleTouchStart(e, element, config, currentTime) {
        const touch = e.touches[0];
        const touchId = touch.identifier;
        
        // Check if touch started on a draggable element
        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elementAtPoint && (
            elementAtPoint.draggable === true ||
            elementAtPoint.closest('[draggable="true"]') ||
            elementAtPoint.closest('.asset-thumbnail') ||
            elementAtPoint.closest('.asset-list-item') ||
            elementAtPoint.closest('.asset-details-row') ||
            elementAtPoint.closest('[data-asset-id]')
        )) {
            // For assetDragDrop and longPressMarquee, we want to handle draggable elements
            if (config.type !== 'assetDragDrop' && config.type !== 'longPressMarquee') {
                // Don't handle touch events for draggable elements in other gesture types
                Logger.ui.debug('Touch started on draggable element, skipping touch gesture');
                return;
            }
            // For assetDragDrop and longPressMarquee, continue processing
        }
        
        // Store touch data
        this.activeTouches.set(touchId, {
            element,
            config,
            startTime: currentTime,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            isActive: true,
            touchCount: 1
        });
        
        // Handle double tap detection
        if (config.doubleTapThreshold > 0) {
            const lastTapTime = this.doubleTapTimers.get(element) || 0;
            const timeDiff = currentTime - lastTapTime;
            
            if (timeDiff < config.doubleTapThreshold && timeDiff > 0) {
                // Double tap detected
                this.doubleTapTimers.delete(element);
                this.handleDoubleTap(element, config, touch);
                return;
            }
            
            // Store tap time for next potential double tap
            this.doubleTapTimers.set(element, currentTime);
        }
        
        // Handle different interaction types
        switch (config.type) {
            case 'resize':
                // For resize type, check if this is a panel resizer with double-tap support
                if (config.onDoubleTap) {
                    // This is a panel resizer - don't start resize immediately
                    // Wait for potential double-tap or movement
                    Logger.ui.debug('TouchSupportManager: Panel resizer touch start - waiting for double-tap or movement');
                } else {
                    // Regular resize element - start resize immediately
                    this.handleResizeStart(element, config, touch);
                }
                break;
            case 'drag':
                this.handleDragStart(element, config, touch);
                break;
            case 'click':
                this.handleClickStart(element, config, touch);
                break;
            case 'marquee':
            case 'marqueeSelection':
                this.handleMarqueeStart(element, config, touch);
                break;
            case 'longPressMarquee':
                this.handleLongPressMarqueeStart(element, config, touch);
                break;
            case 'assetDragDrop':
                this.handleAssetDragStart(element, config, touch);
                break;
        }
    }

    /**
     * Handle two touch start
     */
    handleTwoTouchStart(e, element, config, currentTime) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        Logger.ui.debug('TouchSupportManager: Two touch start', 'type:', config.type, 'element:', element.tagName, 'elementId:', element.id);
        
        // Store both touches
        this.activeTouches.set(touch1.identifier, {
            element,
            config,
            startTime: currentTime,
            startX: touch1.clientX,
            startY: touch1.clientY,
            lastX: touch1.clientX,
            lastY: touch1.clientY,
            isActive: true,
            touchCount: 2,
            partnerId: touch2.identifier
        });
        
        this.activeTouches.set(touch2.identifier, {
            element,
            config,
            startTime: currentTime,
            startX: touch2.clientX,
            startY: touch2.clientY,
            lastX: touch2.clientX,
            lastY: touch2.clientY,
            isActive: true,
            touchCount: 2,
            partnerId: touch1.identifier
        });
        
        // Handle different two-finger interaction types based on available handlers
        Logger.ui.debug('TouchSupportManager: Checking handlers for two-finger gesture');
        
        if (config.onPanStart || config.onZoomStart) {
            // Combined pan/zoom support
            Logger.ui.debug('TouchSupportManager: Using pan/zoom handlers');
            this.handleTwoFingerPanZoomStart(element, config, touch1, touch2);
        } else if (config.onTwoFingerTap) {
            // Two finger context menu
            Logger.ui.debug('TouchSupportManager: Using context menu handlers');
            this.handleTwoFingerContextStart(element, config, touch1, touch2);
        } else {
            // Fallback to type-based handling
            Logger.ui.debug('TouchSupportManager: Using type-based handling for', config.type);
            switch (config.type) {
                case 'twoFingerPan':
                    this.handleTwoFingerPanStart(element, config, touch1, touch2);
                    break;
                case 'twoFingerContext':
                    this.handleTwoFingerContextStart(element, config, touch1, touch2);
                    break;
                case 'twoFingerZoom':
                    this.handleTwoFingerZoomStart(element, config, touch1, touch2);
                    break;
                case 'twoFingerPanZoom':
                    this.handleTwoFingerPanZoomStart(element, config, touch1, touch2);
                    break;
            }
        }
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchMove(e, element, config) {
        // Prevent default browser behavior for pan/zoom gestures
        if (config.type === 'twoFingerPan' || config.type === 'twoFingerZoom' || config.type === 'twoFingerPanZoom') {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Handle different touch counts
        if (e.touches.length === 1) {
            this.handleSingleTouchMove(e, element, config);
        } else if (e.touches.length === 2) {
            this.handleTwoTouchMove(e, element, config);
        }
        
        // Note: Cannot preventDefault in passive event
        // Touch events are now handled through CSS touch-action: none
    }

    /**
     * Handle single touch move
     */
    handleSingleTouchMove(e, element, config) {
        const touch = e.touches[0];
        const touchId = touch.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (!touchData || !touchData.isActive || touchData.touchCount !== 1) return;
        
        // Update touch data
        touchData.lastX = touch.clientX;
        touchData.lastY = touch.clientY;
        
        // Handle different interaction types
        switch (config.type) {
            case 'resize':
                // For panel resizers, start resize on first movement
                if (config.onDoubleTap && !touchData.resizeStarted) {
                    // This is a panel resizer - start resize on first movement
                    touchData.resizeStarted = true;
                    this.handleResizeStart(element, config, touch);
                    Logger.ui.debug('TouchSupportManager: Panel resizer resize started on movement');
                }
                this.handleResizeMove(element, config, touch, touchData);
                break;
            case 'drag':
                this.handleDragMove(element, config, touch, touchData);
                break;
            case 'marquee':
                this.handleMarqueeMove(element, config, touch, touchData);
                break;
            case 'longPressMarquee':
                this.handleLongPressMarqueeMove(element, config, touch, touchData);
                break;
        }
    }

    /**
     * Handle two touch move
     */
    handleTwoTouchMove(e, element, config) {
        if (e.touches.length !== 2) return;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const touchData1 = this.activeTouches.get(touch1.identifier);
        const touchData2 = this.activeTouches.get(touch2.identifier);
        
        if (!touchData1 || !touchData2 || !touchData1.isActive || !touchData2.isActive) return;
        
        // Update touch data
        touchData1.lastX = touch1.clientX;
        touchData1.lastY = touch1.clientY;
        touchData2.lastX = touch2.clientX;
        touchData2.lastY = touch2.clientY;
        
        // Handle different two-finger interaction types based on available handlers
        if (config.onPanMove || config.onZoomMove) {
            // Combined pan/zoom support
            this.handleTwoFingerPanZoomMove(element, config, touch1, touch2, touchData1, touchData2);
        } else {
            // Fallback to type-based handling
            switch (config.type) {
                case 'twoFingerPan':
                    this.handleTwoFingerPanMove(element, config, touch1, touch2, touchData1, touchData2);
                    break;
                case 'twoFingerZoom':
                    this.handleTwoFingerZoomMove(element, config, touch1, touch2, touchData1, touchData2);
                    break;
                case 'twoFingerPanZoom':
                    this.handleTwoFingerPanZoomMove(element, config, touch1, touch2, touchData1, touchData2);
                    break;
            }
        }
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
        // Check for two-finger gestures first
        if (touchData.touchCount === 2 && touchData.partnerId) {
            const partnerData = this.activeTouches.get(touchData.partnerId);
            if (partnerData) {
                // Handle two-finger gestures based on available handlers
                if (config.onPanEnd || config.onZoomEnd) {
                    // Combined pan/zoom support
                    this.handleTwoFingerPanZoomEnd(element, config, touchData, partnerData);
                } else if (config.onTwoFingerTap) {
                    // Two finger context menu
                    this.handleTwoFingerContextEnd(element, config, touchData, partnerData);
                } else {
                    // Fallback to type-based handling
                    switch (config.type) {
                        case 'twoFingerPan':
                            this.handleTwoFingerPanEnd(element, config, touchData, partnerData);
                            break;
                        case 'twoFingerContext':
                            this.handleTwoFingerContextEnd(element, config, touchData, partnerData);
                            break;
                        case 'twoFingerZoom':
                            this.handleTwoFingerZoomEnd(element, config, touchData, partnerData);
                            break;
                        case 'twoFingerPanZoom':
                            this.handleTwoFingerPanZoomEnd(element, config, touchData, partnerData);
                            break;
                    }
                }
                // Clean up partner data
                this.activeTouches.delete(touchData.partnerId);
            }
        } else {
            // Handle single-finger gestures
            switch (config.type) {
            case 'resize':
                // For panel resizers, check if resize was started
                if (config.onDoubleTap && !touchData.resizeStarted) {
                    // This was a tap without movement - don't call resize end
                    Logger.ui.debug('TouchSupportManager: Panel resizer tap ended without movement');
                } else {
                    this.handleResizeEnd(element, config, touchData);
                }
                break;
            case 'drag':
                this.handleDragEnd(element, config, touchData);
                break;
            case 'click':
                this.handleClickEnd(element, config, touchData);
                break;
            case 'marquee':
                this.handleMarqueeEnd(element, config, touchData);
                break;
            case 'longPressMarquee':
                this.handleLongPressMarqueeEnd(element, config, touchData);
                break;
            case 'assetDragDrop':
                this.handleAssetDragEnd(element, config, touchData);
                break;
            }
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
            // For vertical resizers - check if it's console or assets panel
            const isConsole = element.classList.contains('console-resize-handle');
            if (isConsole) {
                // Console logic: movement down increases height (like mouse)
                delta = touch.clientY - touchData.startY;
            } else {
                // Assets panel logic: movement down decreases height
                delta = -(touch.clientY - touchData.startY);
            }
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
     * Handle asset drag start
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     */
    handleAssetDragStart(element, config, touch) {
        // Get asset data from element
        const assetId = element.dataset.assetId;
        const assetData = assetId ? { id: assetId, element: element } : null;
        
        // Store asset data in touch data
        const touchData = this.activeTouches.get(touch.identifier);
        if (touchData) {
            touchData.assetData = assetData;
        }
        
        // Call custom handler
        if (config.onDragStart) {
            config.onDragStart(touch.clientX, touch.clientY, assetData);
        }
        
        Logger.ui.debug('TouchSupportManager: Asset drag started', assetId);
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
     * Handle asset drag end
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Object} touchData - Touch data
     */
    handleAssetDragEnd(element, config, touchData) {
        // Call custom handler
        if (config.onDragEnd) {
            config.onDragEnd(touchData.lastX, touchData.lastY, touchData.assetData);
        }
    }

    /**
     * Handle click start
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @param {Touch} touch - Touch object
     */
    handleClickStart(element, config, touch) {
        // Start long press timer if configured
        const longPressDelay = this.stateManager?.get('touch.longPressDelay') || config.longPressDelay || 500;
        if (longPressDelay > 0) {
            const touchData = this.activeTouches.get(touch.identifier);
            touchData.longPressTimer = setTimeout(() => {
                if (config.onLongPress) {
                    config.onLongPress(element, touch);
                }
            }, longPressDelay);
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
        // Check if it's console resizer
        if (element.classList.contains('console-resize-handle')) {
            return document.getElementById('console-panel');
        }
        
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
        this.elementConfigs.delete(element);
        this.clearElementTimers(element);
        
        // Remove touch event listeners using stored handlers
        if (element._touchHandlers) {
            element.removeEventListener('touchstart', element._touchHandlers.touchstart);
            element.removeEventListener('touchmove', element._touchHandlers.touchmove);
            element.removeEventListener('touchend', element._touchHandlers.touchend);
            element.removeEventListener('touchcancel', element._touchHandlers.touchcancel);
            
            // Clean up stored handlers
            delete element._touchHandlers;
        }
        
        
        // Unregister from browser gesture prevention manager
        if (this.browserGesturePreventionManager) {
            this.browserGesturePreventionManager.unregisterElement(element);
        }
        
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
        
        Logger.ui.debug('TouchSupportManager: Cleared all registrations');
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
        
        Logger.ui.debug('TouchSupportManager: Destroyed');
    }

    // ===== NEW GESTURE HANDLERS =====

    /**
     * Handle marquee selection start
     */
    handleMarqueeStart(element, config, touch) {
        // Store initial touch position for object detection
        const touchId = touch.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (touchData) {
            touchData.marqueeStartX = touch.clientX;
            touchData.marqueeStartY = touch.clientY;
        }
        
        // Call the marquee start handler
        if (config.onMarqueeStart) {
            config.onMarqueeStart(element, touch, {
                startX: touch.clientX,
                startY: touch.clientY
            });
        }
        
        Logger.ui.debug('TouchSupportManager: Marquee start handled');
    }

    /**
     * Handle marquee selection move
     */
    handleMarqueeMove(element, config, touch, touchData) {
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance >= config.minMovement && config.onMarqueeMove) {
            config.onMarqueeMove(element, touch, {
                startX: touchData.startX,
                startY: touchData.startY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                deltaX,
                deltaY,
                distance
            });
        }
    }

    /**
     * Handle marquee selection end
     */
    handleMarqueeEnd(element, config, touchData) {
        if (config.onMarqueeEnd) {
            config.onMarqueeEnd(element, {
                startX: touchData.startX,
                startY: touchData.startY,
                endX: touchData.lastX,
                endY: touchData.lastY,
                deltaX: touchData.lastX - touchData.startX,
                deltaY: touchData.lastY - touchData.startY
            });
        }
    }

    /**
     * Handle two finger pan start
     */
    handleTwoFingerPanStart(element, config, touch1, touch2) {
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        if (config.onPanStart) {
            config.onPanStart(element, {
                centerX,
                centerY,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
    }

    /**
     * Handle two finger pan move
     */
    handleTwoFingerPanMove(element, config, touch1, touch2, touchData1, touchData2) {
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const startCenterX = (touchData1.startX + touchData2.startX) / 2;
        const startCenterY = (touchData1.startY + touchData2.startY) / 2;
        
        const deltaX = centerX - startCenterX;
        const deltaY = centerY - startCenterY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance >= config.minMovement && config.onPanMove) {
            config.onPanMove(element, {
                centerX,
                centerY,
                deltaX,
                deltaY,
                distance,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
    }

    /**
     * Handle two finger pan end
     */
    handleTwoFingerPanEnd(element, config, touchData1, touchData2) {
        if (config.onPanEnd) {
            const startCenterX = (touchData1.startX + touchData2.startX) / 2;
            const startCenterY = (touchData1.startY + touchData2.startY) / 2;
            const endCenterX = (touchData1.lastX + touchData2.lastX) / 2;
            const endCenterY = (touchData1.lastY + touchData2.lastY) / 2;
            
            config.onPanEnd(element, {
                startCenterX,
                startCenterY,
                endCenterX,
                endCenterY,
                deltaX: endCenterX - startCenterX,
                deltaY: endCenterY - startCenterY
            });
        }
    }

    /**
     * Handle two finger context start
     */
    handleTwoFingerContextStart(element, config, touch1, touch2) {
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        // Store context data for potential tap detection
        this.twoFingerContextData = {
            element,
            config,
            startTime: Date.now(),
            centerX,
            centerY,
            touch1: { x: touch1.clientX, y: touch1.clientY },
            touch2: { x: touch2.clientX, y: touch2.clientY }
        };
    }

    /**
     * Handle two finger context end
     */
    handleTwoFingerContextEnd(element, config, touchData1, touchData2) {
        if (!this.twoFingerContextData) return;
        
        const currentTime = Date.now();
        const timeDiff = currentTime - this.twoFingerContextData.startTime;
        
        // Check if it was a quick tap (not a drag)
        if (timeDiff <= config.tapThreshold && config.onTwoFingerTap) {
            const centerX = (touchData1.lastX + touchData2.lastX) / 2;
            const centerY = (touchData1.lastY + touchData2.lastY) / 2;
            
            config.onTwoFingerTap(element, {
                centerX,
                centerY,
                duration: timeDiff
            });
        }
        
        this.twoFingerContextData = null;
    }

    /**
     * Handle two finger zoom start
     */
    handleTwoFingerZoomStart(element, config, touch1, touch2) {
        const distance = this.getDistance(touch1.clientX, touch1.clientY, touch2.clientX, touch2.clientY);
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        // Initialize lastScale for both touches
        const touchData1 = this.activeTouches.get(touch1.identifier);
        const touchData2 = this.activeTouches.get(touch2.identifier);
        if (touchData1) touchData1.lastScale = 1.0;
        if (touchData2) touchData2.lastScale = 1.0;
        
        if (config.onZoomStart) {
            config.onZoomStart(element, {
                distance,
                centerX,
                centerY,
                scale: 1.0,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
    }

    /**
     * Handle two finger zoom move
     */
    handleTwoFingerZoomMove(element, config, touch1, touch2, touchData1, touchData2) {
        const currentDistance = this.getDistance(touch1.clientX, touch1.clientY, touch2.clientX, touch2.clientY);
        const startDistance = this.getDistance(touchData1.startX, touchData1.startY, touchData2.startX, touchData2.startY);
        const scale = currentDistance / startDistance;
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        // Calculate scale delta from previous frame
        const lastScale = touchData1.lastScale || 1.0;
        const scaleDelta = scale / lastScale;
        
        // Store current scale for next frame
        touchData1.lastScale = scale;
        touchData2.lastScale = scale;
        
        // Apply sensitivity factor to reduce zoom speed
        const sensitivity = 0.5; // Reduce zoom sensitivity
        const adjustedScaleDelta = 1.0 + (scaleDelta - 1.0) * sensitivity;
        
        if (config.onZoomMove) {
            config.onZoomMove(element, {
                distance: currentDistance,
                centerX,
                centerY,
                scale: adjustedScaleDelta, // Use delta instead of absolute scale
                scaleDelta: adjustedScaleDelta - 1.0,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
    }

    /**
     * Handle two finger zoom end
     */
    handleTwoFingerZoomEnd(element, config, touchData1, touchData2) {
        if (config.onZoomEnd) {
            const finalDistance = this.getDistance(touchData1.lastX, touchData1.lastY, touchData2.lastX, touchData2.lastY);
            const startDistance = this.getDistance(touchData1.startX, touchData1.startY, touchData2.startX, touchData2.startY);
            const finalScale = finalDistance / startDistance;
            const centerX = (touchData1.lastX + touchData2.lastX) / 2;
            const centerY = (touchData1.lastY + touchData2.lastY) / 2;
            
            config.onZoomEnd(element, {
                distance: finalDistance,
                centerX,
                centerY,
                scale: Math.max(config.minScale, Math.min(config.maxScale, finalScale)),
                scaleDelta: finalScale - 1.0
            });
        }
    }

    /**
     * Handle two finger pan/zoom start
     */
    handleTwoFingerPanZoomStart(element, config, touch1, touch2) {
        const distance = this.getDistance(touch1.clientX, touch1.clientY, touch2.clientX, touch2.clientY);
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        Logger.ui.debug('TouchSupportManager: Two finger pan/zoom start', { centerX, centerY, distance });
        
        // Initialize lastScale and lastCenter for both touches
        const touchData1 = this.activeTouches.get(touch1.identifier);
        const touchData2 = this.activeTouches.get(touch2.identifier);
        if (touchData1) {
            touchData1.lastScale = 1.0;
            touchData1.lastCenterX = centerX;
            touchData1.lastCenterY = centerY;
        }
        if (touchData2) {
            touchData2.lastScale = 1.0;
            touchData2.lastCenterX = centerX;
            touchData2.lastCenterY = centerY;
        }
        
        // Call both pan and zoom start handlers
        if (config.onPanStart) {
            Logger.ui.debug('TouchSupportManager: Calling onPanStart');
            config.onPanStart(element, {
                centerX,
                centerY,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
        
        if (config.onZoomStart) {
            Logger.ui.debug('TouchSupportManager: Calling onZoomStart');
            config.onZoomStart(element, {
                distance,
                centerX,
                centerY,
                scale: 1.0,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
    }

    /**
     * Handle two finger pan/zoom move
     */
    handleTwoFingerPanZoomMove(element, config, touch1, touch2, touchData1, touchData2) {
        const currentDistance = this.getDistance(touch1.clientX, touch1.clientY, touch2.clientX, touch2.clientY);
        const startDistance = this.getDistance(touchData1.startX, touchData1.startY, touchData2.startX, touchData2.startY);
        const scale = currentDistance / startDistance;
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        // Calculate pan delta (movement from previous position, like mouse)
        const lastCenterX = touchData1.lastCenterX || (touchData1.startX + touchData2.startX) / 2;
        const lastCenterY = touchData1.lastCenterY || (touchData1.startY + touchData2.startY) / 2;
        const deltaX = centerX - lastCenterX;
        const deltaY = centerY - lastCenterY;
        
        // Store current center for next frame
        touchData1.lastCenterX = centerX;
        touchData2.lastCenterX = centerX;
        touchData1.lastCenterY = centerY;
        touchData2.lastCenterY = centerY;
        
        // Calculate scale delta from previous frame
        const lastScale = touchData1.lastScale || 1.0;
        const scaleDelta = scale / lastScale;
        
        // Store current scale for next frame
        touchData1.lastScale = scale;
        touchData2.lastScale = scale;
        
        // Determine gesture type based on movement patterns
        const panDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const scaleChange = Math.abs(scaleDelta - 1.0);
        
        // Get thresholds from StateManager
        const panThreshold = this.stateManager?.get('touch.panThreshold') || 5;
        const zoomThreshold = this.stateManager?.get('touch.zoomThreshold') || 0.03;
        
        // Determine primary gesture type
        const isPanning = panDistance > panThreshold && scaleChange < zoomThreshold;
        const isZooming = scaleChange > zoomThreshold && panDistance < panThreshold;
        const isBoth = panDistance > panThreshold && scaleChange > zoomThreshold;
        
        // Call pan move handler if panning or both
        if (config.onPanMove && (isPanning || isBoth)) {
            // Apply sensitivity factor from StateManager
            const panSensitivity = this.stateManager?.get('touch.panSensitivity') || 2.0;
            config.onPanMove(element, {
                centerX,
                centerY,
                deltaX: deltaX * panSensitivity,
                deltaY: deltaY * panSensitivity,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
        
        // Call zoom move handler if zooming or both
        if (config.onZoomMove && (isZooming || isBoth)) {
            // Pass direction instead of scale delta (like mouse wheel)
            const zoomDirection = scaleDelta > 1 ? 1 : -1;
            config.onZoomMove(element, {
                distance: currentDistance,
                centerX,
                centerY,
                scale: zoomDirection, // Pass direction: 1 for zoom in, -1 for zoom out
                scaleDelta: scaleDelta - 1.0,
                touch1: { x: touch1.clientX, y: touch1.clientY },
                touch2: { x: touch2.clientX, y: touch2.clientY }
            });
        }
    }

    /**
     * Handle two finger pan/zoom end
     */
    handleTwoFingerPanZoomEnd(element, config, touchData1, touchData2) {
        const finalDistance = this.getDistance(touchData1.lastX, touchData1.lastY, touchData2.lastX, touchData2.lastY);
        const startDistance = this.getDistance(touchData1.startX, touchData1.startY, touchData2.startX, touchData2.startY);
        const finalScale = finalDistance / startDistance;
        const centerX = (touchData1.lastX + touchData2.lastX) / 2;
        const centerY = (touchData1.lastY + touchData2.lastY) / 2;
        
        // Call pan end handler
        if (config.onPanEnd) {
            config.onPanEnd(element, {
                centerX,
                centerY,
                touch1: { x: touchData1.lastX, y: touchData1.lastY },
                touch2: { x: touchData2.lastX, y: touchData2.lastY }
            });
        }
        
        // Call zoom end handler
        if (config.onZoomEnd) {
            config.onZoomEnd(element, {
                distance: finalDistance,
                centerX,
                centerY,
                scale: Math.max(config.minScale, Math.min(config.maxScale, finalScale)),
                scaleDelta: finalScale - 1.0
            });
        }
    }

    /**
     * Calculate distance between two points
     */
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ===== LONG PRESS MARQUEE HANDLERS =====

    /**
     * Handle long press marquee start
     */
    handleLongPressMarqueeStart(element, config, touch) {
        Logger.ui.debug('TouchSupportManager: handleLongPressMarqueeStart called');
        
        // Set up long press timer
        const touchId = touch.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (touchData) {
            touchData.longPressTimer = setTimeout(() => {
                // Long press detected, start marquee
                Logger.ui.debug('TouchSupportManager: Long press detected, calling onMarqueeStart');
                if (config.onMarqueeStart) {
                    config.onMarqueeStart(element, touch, {
                        startX: touch.clientX,
                        startY: touch.clientY,
                        isLongPress: true
                    });
                }
                touchData.isLongPressMarquee = true;
            }, this.stateManager?.get('touch.longPressDelay') || config.longPressDelay || 500);
        }
    }

    /**
     * Handle long press marquee move
     */
    handleLongPressMarqueeMove(element, config, touch, touchData) {
        // Only handle if long press marquee is active
        if (!touchData.isLongPressMarquee) return;
        
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance >= config.minMovement && config.onMarqueeMove) {
            config.onMarqueeMove(element, touch, {
                startX: touchData.startX,
                startY: touchData.startY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                deltaX,
                deltaY,
                distance,
                isLongPress: true
            });
        }
    }

    /**
     * Handle long press marquee end
     */
    handleLongPressMarqueeEnd(element, config, touchData) {
        // Clear long press timer if it exists
        if (touchData.longPressTimer) {
            clearTimeout(touchData.longPressTimer);
            touchData.longPressTimer = null;
        }
        
        // Only call end handler if long press marquee was active
        if (touchData.isLongPressMarquee && config.onMarqueeEnd) {
            config.onMarqueeEnd(element, {
                startX: touchData.startX,
                startY: touchData.startY,
                endX: touchData.lastX,
                endY: touchData.lastY,
                deltaX: touchData.lastX - touchData.startX,
                deltaY: touchData.lastY - touchData.startY,
                isLongPress: true
            });
        }
        
        // Reset long press marquee state
        touchData.isLongPressMarquee = false;
    }
}
