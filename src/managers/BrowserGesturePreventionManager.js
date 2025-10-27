/**
 * BrowserGesturePreventionManager - Unified system for preventing browser gestures
 * 
 * Centralizes all browser gesture prevention logic to avoid conflicts between
 * different touch systems and ensure consistent behavior across the editor.
 */

import { Logger } from '../utils/Logger.js';

export class BrowserGesturePreventionManager {
    constructor() {
        this.isInitialized = false;
        this.touchEnabledElements = new Set();
        this.globalHandlers = new Map();
        this.elementHandlers = new Map();
        
        // Touch tracking for gesture detection
        this.touchStartData = {
            x: 0,
            y: 0,
            time: 0,
            element: null
        };
        
        Logger.ui.info('BrowserGesturePreventionManager created');
    }

    /**
     * Initialize the global browser gesture prevention system
     */
    initialize() {
        if (this.isInitialized) {
            Logger.ui.warn('BrowserGesturePreventionManager: Already initialized');
            return;
        }

        Logger.ui.info('BrowserGesturePreventionManager: Initializing global gesture prevention...');

        // Setup global touch event handlers
        this.setupGlobalTouchHandlers();
        
        // Setup global context menu prevention
        this.setupGlobalContextMenuPrevention();
        
        // Apply global CSS prevention
        this.applyGlobalCSSPrevention();
        
        this.isInitialized = true;
        Logger.ui.info('BrowserGesturePreventionManager: Global gesture prevention initialized');
    }

    /**
     * Register an element for touch gesture prevention
     * @param {HTMLElement} element - Element to register
     * @param {Object} options - Prevention options
     */
    registerElement(element, options = {}) {
        if (!element) {
            Logger.ui.warn('BrowserGesturePreventionManager: Invalid element provided');
            return;
        }

        // Check if element is already registered
        if (this.touchEnabledElements.has(element)) {
            Logger.ui.debug('BrowserGesturePreventionManager: Element already registered');
            return;
        }

        Logger.ui.debug('BrowserGesturePreventionManager: Registering element for gesture prevention');

        // Add to tracking set
        this.touchEnabledElements.add(element);

        // Apply element-specific CSS
        this.applyElementCSS(element, options);

        // Setup element-specific handlers if needed
        if (options.preventHorizontalSwipe || options.preventVerticalSwipe || options.preventContextMenu) {
            this.setupElementHandlers(element, options);
        }

        Logger.ui.debug('BrowserGesturePreventionManager: Element registered successfully');
    }

    /**
     * Unregister an element from touch gesture prevention
     * @param {HTMLElement} element - Element to unregister
     */
    unregisterElement(element) {
        if (!element || !this.touchEnabledElements.has(element)) {
            return;
        }

        Logger.ui.debug('BrowserGesturePreventionManager: Unregistering element');

        // Remove from tracking set
        this.touchEnabledElements.delete(element);

        // Remove element-specific handlers
        if (this.elementHandlers.has(element)) {
            const handlers = this.elementHandlers.get(element);
            handlers.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            this.elementHandlers.delete(element);
        }

        // Remove element-specific CSS
        this.removeElementCSS(element);

        Logger.ui.debug('BrowserGesturePreventionManager: Element unregistered successfully');
    }

    /**
     * Setup global touch event handlers
     * @private
     */
    setupGlobalTouchHandlers() {
        // Global touch start handler
        const globalTouchStartHandler = (e) => {
            // Only track single touch for navigation prevention
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.touchStartData.x = touch.clientX;
                this.touchStartData.y = touch.clientY;
                this.touchStartData.time = Date.now();
                this.touchStartData.element = e.target;
            } else if (e.touches.length > 1) {
                // Clear single touch data when multi-touch starts
                this.touchStartData.x = 0;
                this.touchStartData.y = 0;
                this.touchStartData.time = 0;
                this.touchStartData.element = null;
            }
        };

        // Global touch move handler - prevent browser navigation
        const globalTouchMoveHandler = (e) => {
            // Only handle single touch gestures
            if (e.touches.length === 1 && this.touchStartData.x !== 0) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - this.touchStartData.x;
                const deltaY = touch.clientY - this.touchStartData.y;
                const deltaTime = Date.now() - this.touchStartData.time;
                
                // Check if this is a potential browser navigation gesture
                if (this.isBrowserNavigationGesture(deltaX, deltaY, deltaTime, e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    Logger.ui.debug('BrowserGesturePreventionManager: Blocked browser navigation gesture');
                }
            }
        };

        // Global touch end handler
        const globalTouchEndHandler = (e) => {
            // Only clear data if this was the last touch
            if (e.touches.length === 0) {
                this.touchStartData.x = 0;
                this.touchStartData.y = 0;
                this.touchStartData.time = 0;
                this.touchStartData.element = null;
            }
        };

        // Add global event listeners
        document.addEventListener('touchstart', globalTouchStartHandler, { passive: true });
        document.addEventListener('touchmove', globalTouchMoveHandler, { passive: false });
        document.addEventListener('touchend', globalTouchEndHandler, { passive: true });

        // Store handlers for cleanup
        this.globalHandlers.set('touchstart', globalTouchStartHandler);
        this.globalHandlers.set('touchmove', globalTouchMoveHandler);
        this.globalHandlers.set('touchend', globalTouchEndHandler);

        Logger.ui.debug('BrowserGesturePreventionManager: Global touch handlers setup');
    }

    /**
     * Setup global context menu prevention
     * @private
     */
    setupGlobalContextMenuPrevention() {
        const globalContextMenuHandler = (e) => {
            // Only prevent on touch devices
            if ('ontouchstart' in window) {
                e.preventDefault();
                e.stopPropagation();
                Logger.ui.debug('BrowserGesturePreventionManager: Blocked context menu on touch device');
            }
        };

        document.addEventListener('contextmenu', globalContextMenuHandler, { passive: false });
        this.globalHandlers.set('contextmenu', globalContextMenuHandler);

        Logger.ui.debug('BrowserGesturePreventionManager: Global context menu prevention setup');
    }

    /**
     * Setup element-specific handlers
     * @private
     */
    setupElementHandlers(element, options) {
        const handlers = [];

        // Horizontal swipe prevention
        if (options.preventHorizontalSwipe) {
            const horizontalSwipeHandler = (e) => {
                if (e.touches.length === 1) {
                    const touch = e.touches[0];
                    const deltaX = touch.clientX - this.touchStartData.x;
                    const deltaY = touch.clientY - this.touchStartData.y;
                    
                    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                        e.preventDefault();
                        e.stopPropagation();
                        Logger.ui.debug('BrowserGesturePreventionManager: Blocked horizontal swipe on element');
                    }
                }
            };

            element.addEventListener('touchmove', horizontalSwipeHandler, { passive: false });
            handlers.push({ event: 'touchmove', handler: horizontalSwipeHandler, options: { passive: false } });
        }

        // Vertical swipe prevention
        if (options.preventVerticalSwipe) {
            const verticalSwipeHandler = (e) => {
                if (e.touches.length === 1) {
                    const touch = e.touches[0];
                    const deltaX = touch.clientX - this.touchStartData.x;
                    const deltaY = touch.clientY - this.touchStartData.y;
                    
                    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
                        e.preventDefault();
                        e.stopPropagation();
                        Logger.ui.debug('BrowserGesturePreventionManager: Blocked vertical swipe on element');
                    }
                }
            };

            element.addEventListener('touchmove', verticalSwipeHandler, { passive: false });
            handlers.push({ event: 'touchmove', handler: verticalSwipeHandler, options: { passive: false } });
        }

        // Context menu prevention
        if (options.preventContextMenu) {
            const contextMenuHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                Logger.ui.debug('BrowserGesturePreventionManager: Blocked context menu on element');
            };

            element.addEventListener('contextmenu', contextMenuHandler, { passive: false });
            handlers.push({ event: 'contextmenu', handler: contextMenuHandler, options: { passive: false } });
        }

        // Store handlers for cleanup
        this.elementHandlers.set(element, handlers);

        Logger.ui.debug('BrowserGesturePreventionManager: Element-specific handlers setup');
    }

    /**
     * Check if a gesture is a browser navigation gesture
     * @private
     */
    isBrowserNavigationGesture(deltaX, deltaY, deltaTime, target) {
        // Check if target is a touch-enabled element
        const isTouchEnabled = this.touchEnabledElements.has(target) || 
                              target.closest('[data-touch-enabled]') ||
                              target.closest('canvas') ||
                              target.closest('.asset-previews-container');

        if (isTouchEnabled) {
            // Don't block gestures on touch-enabled elements
            return false;
        }

        // Block horizontal swipes that could trigger browser navigation
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
            return true;
        }

        // Block pull-to-refresh gestures
        if (deltaY > 50 && deltaTime < 500) {
            return true;
        }

        return false;
    }

    /**
     * Apply global CSS prevention
     * @private
     */
    applyGlobalCSSPrevention() {
        // Add global CSS to prevent browser gestures
        const style = document.createElement('style');
        style.id = 'browser-gesture-prevention';
        style.textContent = `
            /* Global browser gesture prevention */
            body {
                overscroll-behavior: none !important;
                -webkit-overflow-scrolling: touch !important;
            }
            
            /* Prevent context menu on touch devices */
            @media (pointer: coarse) {
                * {
                    -webkit-touch-callout: none !important;
                }
            }
        `;
        
        document.head.appendChild(style);
        Logger.ui.debug('BrowserGesturePreventionManager: Global CSS prevention applied');
    }

    /**
     * Apply element-specific CSS
     * @private
     */
    applyElementCSS(element, options) {
        // Mark element as touch-enabled
        element.setAttribute('data-touch-enabled', 'true');
        
        // Apply touch-action based on options
        if (options.touchAction) {
            element.style.touchAction = options.touchAction;
        } else {
            element.style.touchAction = 'none';
        }
        
        // Apply user-select prevention
        element.style.userSelect = 'none';
        element.style.webkitUserSelect = 'none';
        element.style.mozUserSelect = 'none';
        element.style.msUserSelect = 'none';
        
        // Apply overscroll behavior
        element.style.overscrollBehavior = 'none';
        
        Logger.ui.debug('BrowserGesturePreventionManager: Element CSS applied');
    }

    /**
     * Remove element-specific CSS
     * @private
     */
    removeElementCSS(element) {
        element.removeAttribute('data-touch-enabled');
        element.style.touchAction = '';
        element.style.userSelect = '';
        element.style.webkitUserSelect = '';
        element.style.mozUserSelect = '';
        element.style.msUserSelect = '';
        element.style.overscrollBehavior = '';
        
        Logger.ui.debug('BrowserGesturePreventionManager: Element CSS removed');
    }

    /**
     * Update prevention options for an element
     * @param {HTMLElement} element - Element to update
     * @param {Object} options - New options
     */
    updateElementOptions(element, options) {
        if (!this.touchEnabledElements.has(element)) {
            Logger.ui.warn('BrowserGesturePreventionManager: Element not registered');
            return;
        }

        // Remove existing handlers
        if (this.elementHandlers.has(element)) {
            const handlers = this.elementHandlers.get(element);
            handlers.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            this.elementHandlers.delete(element);
        }

        // Apply new options
        this.applyElementCSS(element, options);
        if (options.preventHorizontalSwipe || options.preventVerticalSwipe || options.preventContextMenu) {
            this.setupElementHandlers(element, options);
        }

        Logger.ui.debug('BrowserGesturePreventionManager: Element options updated');
    }

    /**
     * Check if an element is registered
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} True if registered
     */
    isElementRegistered(element) {
        return this.touchEnabledElements.has(element);
    }

    /**
     * Get all registered elements
     * @returns {Set} Set of registered elements
     */
    getRegisteredElements() {
        return new Set(this.touchEnabledElements);
    }

    /**
     * Destroy the manager and clean up
     */
    destroy() {
        Logger.ui.info('BrowserGesturePreventionManager: Destroying...');

        // Remove global handlers
        this.globalHandlers.forEach((handler, event) => {
            document.removeEventListener(event, handler);
        });
        this.globalHandlers.clear();

        // Unregister all elements
        this.touchEnabledElements.forEach(element => {
            this.unregisterElement(element);
        });
        this.touchEnabledElements.clear();

        // Remove global CSS
        const style = document.getElementById('browser-gesture-prevention');
        if (style) {
            style.remove();
        }

        this.isInitialized = false;
        Logger.ui.info('BrowserGesturePreventionManager: Destroyed');
    }
}
