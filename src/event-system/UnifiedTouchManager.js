/**
 * UnifiedTouchManager - Combined TouchHandlers and TouchSupportManager functionality
 * 
 * Provides a single interface for all touch interactions in the editor
 * Integrates with EventHandlerManager for unified event handling
 */

import { Logger } from '../utils/Logger.js';

export class UnifiedTouchManager {
    constructor(levelEditor, eventHandlerManager) {
        this.levelEditor = levelEditor;
        this.eventHandlerManager = eventHandlerManager;
        
        // Touch state management
        this.activeTouches = new Map();
        this.touchConfigs = new Map();
        this.doubleTapTimers = new Map();
        
        // Gesture detection
        this.gestureState = {
            isPanning: false,
            isZooming: false,
            isMarqueeSelecting: false,
            lastTouchCount: 0,
            lastTouchTime: 0
        };
        
        Logger.event.debug('🎯 UnifiedTouchManager created');
    }

    /**
     * Register element with touch support
     * @param {HTMLElement} element - Element to register
     * @param {string} configType - Configuration type
     * @param {Object} customConfig - Custom configuration
     * @param {string} elementId - Element ID for debugging
     */
    async registerElement(element, configType, customConfig = {}, elementId = null) {
        if (!element) {
            Logger.event.warn('UnifiedTouchManager: Invalid element');
            return;
        }

        const id = elementId || element.id || `touch_${Date.now()}`;
        
        // Store configuration
        const config = this.createConfig(configType, customConfig);
        this.touchConfigs.set(element, config);
        
        // Create event handlers
        const eventHandlers = this.createEventHandlers(element, config);
        
        // Register with EventHandlerManager
        this.eventHandlerManager.registerElement(element, eventHandlers, id);
        
        Logger.event.debug('🎯 Element registered with UnifiedTouchManager', { id, configType });
    }

    /**
     * Create configuration based on type
     * @param {string} configType - Configuration type
     * @param {Object} customConfig - Custom configuration
     * @returns {Object} Complete configuration
     */
    createConfig(configType, customConfig) {
        const baseConfig = {
            type: configType,
            doubleTapThreshold: 300,
            longPressDelay: 500,
            minMovement: 5,
            ...customConfig
        };

        // Add type-specific defaults
        switch (configType) {
            case 'panelResizer':
                return {
                    ...baseConfig,
                    direction: 'horizontal',
                    minSize: 100,
                    maxSize: 800,
                    ...customConfig
                };
                
            case 'button':
                return {
                    ...baseConfig,
                    visualFeedback: true,
                    ...customConfig
                };
                
            case 'canvas':
                return {
                    ...baseConfig,
                    enablePan: true,
                    enableZoom: true,
                    enableMarquee: true,
                    enableContextMenu: true,
                    ...customConfig
                };
                
            default:
                return baseConfig;
        }
    }

    /**
     * Create event handlers for element
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     * @returns {Object} Event handlers
     */
    createEventHandlers(element, config) {
        return {
            touchstart: (e) => this.handleTouchStart(e, element, config),
            touchmove: (e) => this.handleTouchMove(e, element, config),
            touchend: (e) => this.handleTouchEnd(e, element, config),
            touchcancel: (e) => this.handleTouchCancel(e, element, config)
        };
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchStart(e, element, config) {
        const touch = e.touches[0];
        const touchId = touch.identifier;
        
        // Store touch data
        this.activeTouches.set(touchId, {
            element,
            config,
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
            lastX: touch.clientX,
            lastY: touch.clientY
        });
        
        // Update gesture state
        this.gestureState.lastTouchCount = e.touches.length;
        this.gestureState.lastTouchTime = Date.now();
        
        // Handle different touch types
        switch (config.type) {
            case 'canvas':
                this.handleCanvasTouchStart(e, element, config);
                break;
            case 'panelResizer':
                this.handleResizerTouchStart(e, element, config);
                break;
            case 'button':
                this.handleButtonTouchStart(e, element, config);
                break;
            case 'scrollable':
                this.handleScrollableTouchStart(e, element, config);
                break;
            default:
                this.handleGenericTouchStart(e, element, config);
        }
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchMove(e, element, config) {
        const touch = e.touches[0];
        const touchId = touch.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (!touchData) return;
        
        // Update touch data
        touchData.lastX = touch.clientX;
        touchData.lastY = touch.clientY;
        
        // Calculate movement
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Only process if movement exceeds threshold
        if (distance < config.minMovement) return;
        
        // Handle different touch types
        switch (config.type) {
            case 'canvas':
                this.handleCanvasTouchMove(e, element, config, touchData);
                break;
            case 'panelResizer':
                this.handleResizerTouchMove(e, element, config, touchData);
                break;
            case 'scrollable':
                this.handleScrollableTouchMove(e, element, config, touchData);
                break;
            default:
                this.handleGenericTouchMove(e, element, config, touchData);
        }
    }

    /**
     * Handle touch end event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchEnd(e, element, config) {
        const touch = e.changedTouches[0];
        const touchId = touch.identifier;
        const touchData = this.activeTouches.get(touchId);
        
        if (!touchData) return;
        
        // Calculate final movement and duration
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const duration = Date.now() - touchData.startTime;
        
        // Handle different touch types
        switch (config.type) {
            case 'canvas':
                this.handleCanvasTouchEnd(e, element, config, touchData, distance, duration);
                break;
            case 'panelResizer':
                this.handleResizerTouchEnd(e, element, config, touchData, distance, duration);
                break;
            case 'button':
                this.handleButtonTouchEnd(e, element, config, touchData, distance, duration);
                break;
            default:
                this.handleGenericTouchEnd(e, element, config, touchData, distance, duration);
        }
        
        // Clean up touch data
        this.activeTouches.delete(touchId);
    }

    /**
     * Handle touch cancel event
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleTouchCancel(e, element, config) {
        const touch = e.changedTouches[0];
        const touchId = touch.identifier;
        
        // Clean up touch data
        this.activeTouches.delete(touchId);
        
        // Reset gesture state
        this.gestureState.isPanning = false;
        this.gestureState.isZooming = false;
        this.gestureState.isMarqueeSelecting = false;
        
        // Call TouchHandlers for canvas events (legacy integration)
        if (config.type === 'canvas' && this.levelEditor.touchHandlers) {
            this.levelEditor.touchHandlers.handleTouchCancel(e);
        }
        
        Logger.event.debug('🎯 Touch cancelled', { touchId, element: element.id });
    }

    /**
     * Handle canvas touch start
     */
    handleCanvasTouchStart(e, element, config) {
        const touch = e.touches[0];
        
        // Call TouchHandlers for canvas events (legacy integration)
        if (this.levelEditor.touchHandlers) {
            this.levelEditor.touchHandlers.handleTouchStart(e);
        }
        
        if (e.touches.length === 1) {
            // Single touch - start marquee selection or object interaction
            if (config.enableMarquee) {
                this.gestureState.isMarqueeSelecting = true;
                this.startMarqueeSelection(touch);
            }
        } else if (e.touches.length === 2) {
            // Two touches - start pan/zoom
            this.gestureState.isPanning = true;
            this.gestureState.isZooming = true;
            this.startTwoFingerGesture(e.touches);
        }
    }

    /**
     * Handle canvas touch move
     */
    handleCanvasTouchMove(e, element, config, touchData) {
        // Call TouchHandlers for canvas events (legacy integration)
        if (this.levelEditor.touchHandlers) {
            this.levelEditor.touchHandlers.handleTouchMove(e);
        }
        
        if (e.touches.length === 1 && this.gestureState.isMarqueeSelecting) {
            // Update marquee selection
            this.updateMarqueeSelection(e.touches[0]);
        } else if (e.touches.length === 2 && this.gestureState.isPanning) {
            // Update pan/zoom
            this.updateTwoFingerGesture(e.touches);
        }
    }

    /**
     * Handle canvas touch end
     */
    handleCanvasTouchEnd(e, element, config, touchData, distance, duration) {
        // Call TouchHandlers for canvas events (legacy integration)
        if (this.levelEditor.touchHandlers) {
            this.levelEditor.touchHandlers.handleTouchEnd(e);
        }
        
        if (this.gestureState.isMarqueeSelecting) {
            this.finishMarqueeSelection();
        }
        
        if (this.gestureState.isPanning || this.gestureState.isZooming) {
            this.finishTwoFingerGesture();
        }
    }

    /**
     * Handle resizer touch start
     */
    handleResizerTouchStart(e, element, config) {
        // Prevent default browser behavior for resizer touch events
        e.preventDefault();
        
        if (config.onResizeStart) {
            const touch = e.touches[0];
            config.onResizeStart(element, element.parentElement, touch);
        }
    }

    /**
     * Handle resizer touch move
     */
    handleResizerTouchMove(e, element, config, touchData) {
        // Prevent default browser behavior for resizer touch events
        e.preventDefault();
        
        if (config.onResize) {
            const touch = e.touches[0];
            const newSize = this.calculateResizeSize(element, config, touch, touchData);
            config.onResize(element, element.parentElement, newSize, touch);
        }
    }

    /**
     * Handle resizer touch end
     */
    handleResizerTouchEnd(e, element, config, touchData, distance, duration) {
        if (config.onResizeEnd) {
            const currentSize = this.calculateResizeSize(element, config, e.changedTouches[0], touchData);
            config.onResizeEnd(element, element.parentElement, currentSize);
        }
    }

    /**
     * Handle button touch start
     */
    handleButtonTouchStart(e, element, config) {
        // Start long press timer
        if (config.longPressDelay > 0) {
            element._longPressTimer = setTimeout(() => {
                if (config.onLongPress) {
                    config.onLongPress(element, e.touches[0]);
                }
            }, config.longPressDelay);
        }
    }

    /**
     * Handle button touch end
     */
    handleButtonTouchEnd(e, element, config, touchData, distance, duration) {
        // Clear long press timer
        if (element._longPressTimer) {
            clearTimeout(element._longPressTimer);
            element._longPressTimer = null;
        }
        
        // Handle tap based on distance and duration
        if (distance < config.minMovement && duration < config.doubleTapThreshold) {
            // Check for double tap
            const lastTap = this.doubleTapTimers.get(element);
            const now = Date.now();
            
            if (lastTap && (now - lastTap) < config.doubleTapThreshold) {
                // Double tap
                if (config.onDoubleTap) {
                    config.onDoubleTap(element, e.changedTouches[0]);
                }
                this.doubleTapTimers.delete(element);
            } else {
                // Single tap
                if (config.onTap) {
                    config.onTap(element, e.changedTouches[0]);
                }
                this.doubleTapTimers.set(element, now);
            }
        }
    }

    /**
     * Calculate resize size for panel resizers
     */
    calculateResizeSize(element, config, touch, touchData) {
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        
        if (config.direction === 'horizontal') {
            const currentWidth = element.parentElement.offsetWidth;
            const newWidth = currentWidth + deltaX;
            return Math.max(config.minSize, Math.min(config.maxSize, newWidth));
        } else {
            const currentHeight = element.parentElement.offsetHeight;
            const newHeight = currentHeight + deltaY;
            return Math.max(config.minSize, Math.min(config.maxSize, newHeight));
        }
    }

    /**
     * Start marquee selection
     */
    startMarqueeSelection(touch) {
        const worldPos = this.levelEditor.canvasRenderer.screenToWorld(
            touch.clientX, 
            touch.clientY, 
            this.levelEditor.stateManager.get('camera')
        );
        
        this.levelEditor.stateManager.update({
            'mouse.isMarqueeSelecting': true,
            'mouse.marqueeRect': { x: worldPos.x, y: worldPos.y, width: 0, height: 0 },
            'mouse.marqueeStartX': worldPos.x,
            'mouse.marqueeStartY': worldPos.y
        });
    }

    /**
     * Update marquee selection
     */
    updateMarqueeSelection(touch) {
        const worldPos = this.levelEditor.canvasRenderer.screenToWorld(
            touch.clientX, 
            touch.clientY, 
            this.levelEditor.stateManager.get('camera')
        );
        
        const mouse = this.levelEditor.stateManager.get('mouse');
        if (mouse.marqueeRect) {
            const startX = mouse.marqueeStartX || mouse.marqueeRect.x;
            const startY = mouse.marqueeStartY || mouse.marqueeRect.y;
            
            mouse.marqueeRect.x = Math.min(startX, worldPos.x);
            mouse.marqueeRect.y = Math.min(startY, worldPos.y);
            mouse.marqueeRect.width = Math.abs(worldPos.x - startX);
            mouse.marqueeRect.height = Math.abs(worldPos.y - startY);
        }
        
        this.levelEditor.render();
    }

    /**
     * Finish marquee selection
     */
    finishMarqueeSelection() {
        this.levelEditor.mouseHandlers.finishMarqueeSelection();
        this.gestureState.isMarqueeSelecting = false;
    }

    /**
     * Start two-finger gesture
     */
    startTwoFingerGesture(touches) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        const distance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Store initial gesture data
        this.gestureState.initialDistance = distance;
        this.gestureState.initialCenterX = centerX;
        this.gestureState.initialCenterY = centerY;
    }

    /**
     * Update two-finger gesture
     */
    updateTwoFingerGesture(touches) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        const distance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        // Calculate pan delta
        const deltaX = centerX - this.gestureState.initialCenterX;
        const deltaY = centerY - this.gestureState.initialCenterY;
        
        // Calculate zoom scale
        const scale = distance / this.gestureState.initialDistance;
        
        // Apply pan
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            const camera = this.levelEditor.stateManager.get('camera');
            this.levelEditor.stateManager.update({
                'camera.x': camera.x - deltaX / camera.zoom,
                'camera.y': camera.y - deltaY / camera.zoom
            });
        }
        
        // Apply zoom
        if (Math.abs(scale - 1) > 0.1) {
            const camera = this.levelEditor.stateManager.get('camera');
            const newZoom = Math.max(0.1, Math.min(10, camera.zoom * scale));
            
            this.levelEditor.stateManager.update({
                'camera.zoom': newZoom
            });
        }
        
        this.levelEditor.render();
    }

    /**
     * Finish two-finger gesture
     */
    finishTwoFingerGesture() {
        this.gestureState.isPanning = false;
        this.gestureState.isZooming = false;
        this.gestureState.initialDistance = null;
        this.gestureState.initialCenterX = null;
        this.gestureState.initialCenterY = null;
    }

    /**
     * Generic touch handlers
     */
    handleGenericTouchStart(e, element, config) {
        if (config.onTouchStart) {
            config.onTouchStart(element, e.touches[0]);
        }
    }

    handleGenericTouchMove(e, element, config, touchData) {
        if (config.onTouchMove) {
            config.onTouchMove(element, e.touches[0], touchData);
        }
    }

    handleGenericTouchEnd(e, element, config, touchData, distance, duration) {
        if (config.onTouchEnd) {
            config.onTouchEnd(element, e.changedTouches[0], touchData);
        }
    }

    /**
     * Unregister element
     * @param {HTMLElement} element - Element to unregister
     */
    unregisterElement(element) {
        this.touchConfigs.delete(element);
        this.eventHandlerManager.unregisterElement(element);
        
        // Clean up any active touches on this element
        for (const [touchId, touchData] of this.activeTouches) {
            if (touchData.element === element) {
                this.activeTouches.delete(touchId);
            }
        }
        
        Logger.event.debug('🎯 Element unregistered from UnifiedTouchManager', element.id || 'unknown');
    }

    /**
     * Reset touch state
     */
    resetTouchState() {
        this.activeTouches.clear();
        this.doubleTapTimers.clear();
        
        this.gestureState.isPanning = false;
        this.gestureState.isZooming = false;
        this.gestureState.isMarqueeSelecting = false;
        this.gestureState.lastTouchCount = 0;
        this.gestureState.lastTouchTime = 0;
        
        Logger.event.debug('🎯 Touch state reset');
    }

    /**
     * Calculate horizontal panel size (moved from TouchSupportManager)
     * @param {HTMLElement} element - Resizer element
     * @param {Object} input - Input data (mouse event or touch object)
     * @param {Object} initialData - Initial data
     * @returns {number} - Calculated width
     */
    calculateHorizontalPanelSize(element, input, initialData) {
        const isRightPanel = element.id && element.id.includes('right');
        const isFoldersResizer = element.id === 'folders-resizer';
        
        // Get container width for constraints
        const container = isFoldersResizer ? 
            document.querySelector('.folders-container') : 
            document.querySelector('.panel-container');
        
        const containerWidth = container ? container.offsetWidth : window.innerWidth;
        const delta = input.clientX - initialData.startX;
        
        // Calculate new width based on panel type
        let newWidth;
        if (isRightPanel) {
            // Right panel grows leftward
            newWidth = initialData.startWidth - delta;
        } else {
            // Left panel or folders grows rightward
            newWidth = initialData.startWidth + delta;
        }
        
        // Apply constraints
        const minWidth = 100;
        const maxWidth = Math.min(800, containerWidth * 0.8);
        
        return Math.max(minWidth, Math.min(maxWidth, newWidth));
    }

    /**
     * Calculate vertical panel size (moved from TouchSupportManager)
     * @param {HTMLElement} element - Resizer element
     * @param {Object} input - Input data (mouse event or touch object)
     * @param {Object} initialData - Initial data
     * @returns {number} - Calculated height
     */
    calculateVerticalPanelSize(element, input, initialData) {
        const isConsole = element.classList.contains('console-resize-handle');
        const isAssets = element.id === 'resizer-assets';
        
        const delta = input.clientY - initialData.startY;
        
        // Calculate new height based on panel type
        let newHeight;
        if (isConsole) {
            // Console grows upward
            newHeight = initialData.startHeight - delta;
        } else {
            // Assets panel grows downward
            newHeight = initialData.startHeight + delta;
        }
        
        // Apply constraints
        const minHeight = 100;
        const maxHeight = window.innerHeight * 0.8;
        
        return Math.max(minHeight, Math.min(maxHeight, newHeight));
    }

    /**
     * Handle scrollable touch start
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     */
    handleScrollableTouchStart(e, element, config) {
        const touch = e.touches[0];
        const touchId = touch.identifier;
        
        // Store touch data
        this.activeTouches.set(touchId, {
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            startTime: Date.now(),
            element: element,
            config: config,
            isActive: true,
            startScrollLeft: config.scrollElement ? config.scrollElement.scrollLeft : 0
        });
        
        Logger.event.debug('🎯 Scrollable touch start', { touchId, element: element.id });
    }

    /**
     * Handle scrollable touch move
     * @param {TouchEvent} e - Touch event
     * @param {HTMLElement} element - Target element
     * @param {Object} config - Configuration
     * @param {Object} touchData - Touch data
     */
    handleScrollableTouchMove(e, element, config, touchData) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchData.startX;
        
        // Apply smooth scrolling
        if (config.scrollElement) {
            const scrollElement = config.scrollElement;
            const newScrollLeft = touchData.startScrollLeft - deltaX;
            const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
            
            scrollElement.scrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft));
        }
        
        Logger.event.debug('🎯 Scrollable touch move', { deltaX, scrollLeft: config.scrollElement?.scrollLeft });
    }

    /**
     * Destroy manager and cleanup
     */
    destroy() {
        this.resetTouchState();
        this.touchConfigs.clear();
        
        Logger.event.debug('🎯 UnifiedTouchManager destroyed');
    }
}
