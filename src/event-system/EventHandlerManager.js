/**
 * Simple Event Handler Manager
 * Unified event handling system with event delegation and automatic cleanup
 * 
 * Replaces: EventHandlerManager, AutoEventHandlerManager, UniversalWindowHandlers, EventHandlerUtils
 * 
 * Key features:
 * - Event delegation (one handler per container)
 * - Automatic cleanup on element removal
 * - Simple API for registration
 * - No automatic detection (explicit registration only)
 * - Built-in error handling and logging
 */

import { Logger } from '../utils/Logger.js';

export class EventHandlerManager {
    constructor() {
        // Map<container, { handlers, cleanup }>
        this.containers = new Map();
        
        // Map<element, container> for quick lookup
        this.elementToContainer = new Map();
        
        // Global handlers (ESC, etc.)
        this.globalHandlers = new Map();
        
        // UnifiedTouchManager instance for unified touch handling
        this.unifiedTouchManager = null;
        
        this.initialized = false;
        
        Logger.event.info('🎯 EventHandlerManager created');
    }

    /**
     * Initialize the manager
     */
    init() {
        if (this.initialized) return;
        
        this.setupGlobalHandlers();
        this.initialized = true;
        
        Logger.event.info('🎯 EventHandlerManager initialized');
    }

    /**
     * Register event handlers for a container using event delegation
     * @param {HTMLElement} container - Container element
     * @param {Object} config - Handler configuration
     * @param {string} containerId - Unique ID for the container
     */
    registerContainer(container, config, containerId = null) {
        if (!container || !config) {
            Logger.event.warn('EventHandlerManager: Invalid container or config');
            return;
        }
        
        const id = containerId || container.id || `container_${Date.now()}`;
        
        // Check if already registered
        if (this.containers.has(container)) {
            Logger.event.warn(`EventHandlerManager: Container ${id} already registered`);
            return;
        }

        // Create delegated handlers
        const handlers = this.createDelegatedHandlers(container, config);
        
        // Store container info
        this.containers.set(container, {
            id,
            config,
            handlers,
            cleanup: []
        });

        // Register event listeners
        this.setupContainerEventListeners(container, handlers);

        Logger.event.debug('🎯 Container registered', { id, handlers: Object.keys(handlers) });
    }

    /**
     * Register a single element with specific handlers
     * @param {HTMLElement} element - Element to register
     * @param {Object} handlers - Event handlers
     * @param {string} elementId - Element ID for debugging
     */
    registerElement(element, handlers, elementId = null) {
        if (!element || !handlers) {
            Logger.event.warn('EventHandlerManager: Invalid element or handlers');
            return;
        }

        const id = elementId || element.id || `element_${Date.now()}`;
        
        // Check if element is already registered
        if (this.elementToContainer.has(element)) {
            Logger.event.warn(`Element ${id} is already registered. Unregistering previous handlers.`);
            this.unregisterElement(element);
        }
        
        const cleanup = [];

        // Register each event handler
        Object.entries(handlers).forEach(([eventType, handler]) => {
            if (typeof handler === 'function') {
                    const wrappedHandler = (e) => {
                        try {
                        handler.call(element, e);
                        } catch (error) {
                        Logger.event.error(`Event handler error for ${id}:`, error);
                        }
                    };
                    
                    element.addEventListener(eventType, wrappedHandler);
                cleanup.push(() => {
                        element.removeEventListener(eventType, wrappedHandler);
                    });
                }
            });
        
        // Store cleanup functions
        this.elementToContainer.set(element, {
            id,
            cleanup,
            handlers: Object.keys(handlers)
        });

        Logger.event.debug('🎯 Element registered', { id, handlers: Object.keys(handlers) });
    }

    /**
     * Register global handlers (ESC, etc.)
     * @param {Object} handlers - Global event handlers
     * @param {string} handlerId - Unique ID for the handlers
     */
    registerGlobalHandlers(handlers, handlerId) {
        if (!handlers || !handlerId) {
            Logger.event.warn('EventHandlerManager: Invalid global handlers or ID');
            return;
        }

        const cleanup = [];

        Object.entries(handlers).forEach(([eventType, handler]) => {
            if (typeof handler === 'function') {
                const wrappedHandler = (e) => {
                    try {
                        handler(e);
                    } catch (error) {
                        Logger.event.error(`Global handler error for ${handlerId}:`, error);
                    }
                };
                
                document.addEventListener(eventType, wrappedHandler);
                cleanup.push(() => {
                    document.removeEventListener(eventType, wrappedHandler);
                });
            }
        });
        
        this.globalHandlers.set(handlerId, {
            handlers: Object.keys(handlers),
            cleanup
        });

        Logger.event.debug('🎯 Global handlers registered', { handlerId, handlers: Object.keys(handlers) });
    }

    /**
     * Create delegated event handlers for a container
     * @param {HTMLElement} container - Container element
     * @param {Object} config - Handler configuration
     * @returns {Object} Delegated handlers
     */
    createDelegatedHandlers(container, config) {
        const handlers = {};

        // Click delegation
        if (config.click) {
            handlers.click = (e) => {
                const target = e.target;
                const selector = config.click.selector || '*';
                
                // Find matching element
                const element = target.closest(selector);
                if (element) {
                    const handler = config.click.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        // Context menu delegation
        if (config.contextmenu) {
            handlers.contextmenu = (e) => {
                const target = e.target;
                const selector = config.contextmenu.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.contextmenu.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        // Input delegation
        if (config.input) {
            handlers.input = (e) => {
                const target = e.target;
                const selector = config.input.selector || 'input, textarea, select';
                
                if (target.matches(selector)) {
                    const handler = config.input.handler;
                    if (typeof handler === 'function') {
                        handler.call(target, e);
                    }
                }
            };
        }

        // Change delegation
        if (config.change) {
            handlers.change = (e) => {
                const target = e.target;
                const selector = config.change.selector || 'input, textarea, select';
                
                if (target.matches(selector)) {
                    const handler = config.change.handler;
                    if (typeof handler === 'function') {
                        handler.call(target, e);
                    }
                }
            };
        }

        // Focus/blur delegation
        if (config.focus) {
            handlers.focus = (e) => {
                const target = e.target;
                const selector = config.focus.selector || 'input, textarea, select';
                
                if (target.matches(selector)) {
                    const handler = config.focus.handler;
                    if (typeof handler === 'function') {
                        handler.call(target, e);
                    }
                }
            };
        }

        if (config.blur) {
            handlers.blur = (e) => {
                const target = e.target;
                const selector = config.blur.selector || 'input, textarea, select';
                
                if (target.matches(selector)) {
                    const handler = config.blur.handler;
                    if (typeof handler === 'function') {
                        handler.call(target, e);
                    }
                }
            };
        }

        // Keydown delegation
        if (config.keydown) {
            handlers.keydown = (e) => {
                const target = e.target;
                const selector = config.keydown.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.keydown.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        // Touch event delegation
        if (config.touchstart) {
            handlers.touchstart = (e) => {
                const target = e.target;
                const selector = config.touchstart.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.touchstart.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        if (config.touchmove) {
            handlers.touchmove = (e) => {
                const target = e.target;
                const selector = config.touchmove.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.touchmove.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        if (config.touchend) {
            handlers.touchend = (e) => {
                const target = e.target;
                const selector = config.touchend.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.touchend.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        if (config.touchcancel) {
            handlers.touchcancel = (e) => {
                const target = e.target;
                const selector = config.touchcancel.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.touchcancel.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        return handlers;
    }

    /**
     * Setup event listeners for a container
     * @param {HTMLElement} container - Container element
     * @param {Object} handlers - Event handlers
     */
    setupContainerEventListeners(container, handlers) {
        const containerInfo = this.containers.get(container);
        if (!containerInfo) return;

        Object.entries(handlers).forEach(([eventType, handler]) => {
            if (typeof handler === 'function') {
                // Set appropriate options for touch events
                let options = {};
                if (eventType.startsWith('touch')) {
                    // Touch events need special handling
                    if (eventType === 'touchstart' || eventType === 'touchend' || eventType === 'touchcancel') {
                        options = { passive: true };
                    } else if (eventType === 'touchmove') {
                        // Touch move might need preventDefault, so non-passive
                        options = { passive: false };
                    }
                }
                
                container.addEventListener(eventType, handler, options);
                containerInfo.cleanup.push(() => {
                    container.removeEventListener(eventType, handler, options);
                });
            }
        });
    }
    
    /**
     * Setup global event handlers
     */
    setupGlobalHandlers() {
        // Global ESC handler
        const globalEscHandler = (e) => {
            if (e.key === 'Escape') {
                // Find the topmost visible dialog/overlay
                const overlays = document.querySelectorAll('[id$="-overlay"]:not([style*="display: none"])');
                if (overlays.length > 0) {
                    const topOverlay = overlays[overlays.length - 1];
                    const containerInfo = this.containers.get(topOverlay);
                    if (containerInfo && containerInfo.config.escape) {
                        containerInfo.config.escape(e);
                    }
                }
            }
        };

        document.addEventListener('keydown', globalEscHandler);
        
        // Store cleanup function
        this.globalHandlers.set('global', {
            handlers: ['keydown'],
            cleanup: [() => document.removeEventListener('keydown', globalEscHandler)]
        });
    }

    /**
     * Unregister a container and all its handlers
     * @param {HTMLElement} container - Container to unregister
     */
    unregisterContainer(container) {
        const containerInfo = this.containers.get(container);
        if (!containerInfo) return;

        // Cleanup event listeners
        containerInfo.cleanup.forEach(cleanup => cleanup());
        
        // Remove from containers map
        this.containers.delete(container);

        Logger.event.debug('🎯 Container unregistered', { id: containerInfo.id });
    }

    /**
     * Unregister a single element
     * @param {HTMLElement} element - Element to unregister
     */
    unregisterElement(element) {
        const elementInfo = this.elementToContainer.get(element);
        if (!elementInfo) return;

        // Cleanup event listeners
        elementInfo.cleanup.forEach(cleanup => cleanup());
        
        // Remove from element map
        this.elementToContainer.delete(element);

        Logger.event.debug('🎯 Element unregistered', { id: elementInfo.id });
    }

    /**
     * Unregister global handlers
     * @param {string} handlerId - Handler ID to unregister
     */
    unregisterGlobalHandlers(handlerId) {
        const handlerInfo = this.globalHandlers.get(handlerId);
        if (!handlerInfo) return;

        // Cleanup event listeners
        handlerInfo.cleanup.forEach(cleanup => cleanup());
        
        // Remove from global handlers map
        this.globalHandlers.delete(handlerId);

        Logger.event.debug('🎯 Global handlers unregistered', { handlerId });
    }

    /**
     * Check if container is registered
     * @param {HTMLElement} container - Container to check
     * @returns {boolean} Is registered
     */
    isContainerRegistered(container) {
        return this.containers.has(container);
    }
    
    /**
     * Check if element is registered
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} Is registered
     */
    isElementRegistered(element) {
        return this.elementToContainer.has(element);
    }

    /**
     * Get container info
     * @param {HTMLElement} container - Container element
     * @returns {Object|null} Container info
     */
    getContainerInfo(container) {
        return this.containers.get(container) || null;
    }

    /**
     * Get element info
     * @param {HTMLElement} element - Element
     * @returns {Object|null} Element info
     */
    getElementInfo(element) {
        return this.elementToContainer.get(element) || null;
    }

    /**
     * Get all registered containers
     * @returns {Array} List of registered containers
     */
    getAllContainers() {
        return Array.from(this.containers.keys());
    }

    /**
     * Get all registered elements
     * @returns {Array} List of registered elements
     */
    getAllElements() {
        return Array.from(this.elementToContainer.keys());
    }

    /**
     * Set UnifiedTouchManager instance
     * @param {UnifiedTouchManager} unifiedTouchManager - UnifiedTouchManager instance
     */
    setUnifiedTouchManager(unifiedTouchManager) {
        this.unifiedTouchManager = unifiedTouchManager;
        Logger.event.debug('🎯 UnifiedTouchManager set in EventHandlerManager');
    }

    /**
     * Register touch element with TouchSupportManager integration
     * @param {HTMLElement} element - Element to register
     * @param {string} configType - Touch configuration type
     * @param {Object} customConfig - Custom configuration
     * @param {string} elementId - Element ID for debugging
     */
    registerTouchElement(element, configType, customConfig = {}, elementId = null) {
        if (!element) {
            Logger.event.warn('EventHandlerManager: Invalid element for touch registration');
            return;
        }

        const id = elementId || element.id || `touch_${Date.now()}`;
        
        // Use UnifiedTouchManager if available
        if (this.unifiedTouchManager) {
            this.unifiedTouchManager.registerElement(element, configType, customConfig, id);
            Logger.event.debug('🎯 Touch element registered via UnifiedTouchManager', { id, configType });
            return;
        }
        
        Logger.event.warn('EventHandlerManager: UnifiedTouchManager not available for touch registration', { id, configType });
    }

    /**
     * Unregister touch element
     * @param {HTMLElement} element - Element to unregister
     */
    unregisterTouchElement(element) {
        if (this.unifiedTouchManager) {
            this.unifiedTouchManager.unregisterElement(element);
            Logger.event.debug('🎯 Touch element unregistered', element.id || 'unknown');
        }
    }

    /**
     * Register canvas with unified touch and mouse handlers
     * @param {HTMLElement} canvas - Canvas element
     * @param {Object} config - Handler configuration
     * @param {string} canvasId - Canvas ID for debugging
     */
    registerCanvas(canvas, config = {}, canvasId = 'main-canvas') {
        if (!canvas) {
            Logger.event.warn('EventHandlerManager: Invalid canvas element');
            return;
        }

        // Import EventHandlerUtils dynamically
        import('./EventHandlerUtils.js').then(({ EventHandlerUtils }) => {
            // Create unified handlers for canvas
            const canvasHandlers = {
                // Mouse events
                mousedown: config.onMouseDown || (() => {}),
                mousemove: config.onMouseMove || (() => {}),
                mouseup: config.onMouseUp || (() => {}),
                wheel: config.onWheel || (() => {}),
                dragover: config.onDragOver || (() => {}),
                drop: config.onDrop || (() => {}),
                dblclick: config.onDoubleClick || (() => {}),
                
                // Touch events
                touchstart: config.onTouchStart || (() => {}),
                touchmove: config.onTouchMove || (() => {}),
                touchend: config.onTouchEnd || (() => {}),
                touchcancel: config.onTouchCancel || (() => {})
            };

            // Register canvas with EventHandlerManager
            this.registerElement(canvas, canvasHandlers, canvasId);
            
            Logger.event.debug('🎯 Canvas registered with unified handlers', { canvasId });
        }).catch(error => {
            Logger.event.error('EventHandlerManager: Failed to load EventHandlerUtils:', error);
        });
    }

    /**
     * Destroy the manager and cleanup all handlers
     */
    destroy() {
        // Cleanup all containers
        this.containers.forEach((info, container) => {
            info.cleanup.forEach(cleanup => cleanup());
        });

        // Cleanup all elements
        this.elementToContainer.forEach((info, element) => {
            info.cleanup.forEach(cleanup => cleanup());
        });

        // Cleanup global handlers
        this.globalHandlers.forEach((info, handlerId) => {
            info.cleanup.forEach(cleanup => cleanup());
        });
        
        // Clear all maps
        this.containers.clear();
        this.elementToContainer.clear();
        this.globalHandlers.clear();

        this.initialized = false;
        
        Logger.event.info('🎯 EventHandlerManager destroyed');
    }
}

// Create singleton instance
export const eventHandlerManager = new EventHandlerManager();
