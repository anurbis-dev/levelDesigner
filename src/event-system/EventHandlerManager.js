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
import { EventHandlerUtils } from './EventHandlerUtils.js';

export class EventHandlerManager {
    constructor() {
        // Map<container, { handlers, cleanup }>
        this.containers = new Map();
        
        // Map<element, container> for quick lookup
        this.elementToContainer = new Map();
        
        // Global handlers (ESC, etc.)
        this.globalHandlers = new Map();
        
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
     * @param {Object} options - addEventListener options (capture, passive, etc.)
     */
    registerElement(element, handlers, elementId = null, options = {}) {
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

                    // Default to passive for wheel unless explicitly overridden
                    let effectiveOptions = options;
                    if (eventType === 'wheel') {
                        const hasExplicitPassive = Object.prototype.hasOwnProperty.call(options, 'passive');
                        effectiveOptions = hasExplicitPassive ? options : { passive: true };
                    }

                    element.addEventListener(eventType, wrappedHandler, effectiveOptions);
                cleanup.push(() => {
                        element.removeEventListener(eventType, wrappedHandler, effectiveOptions);
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

        // Overlay click handler (special case for dialogs)
        if (config.overlayClick) {
            handlers.click = (e) => {
                // Check if click is on overlay itself (not on child elements)
                // Container is the overlay, so check if target is exactly the overlay
                if (e.target === container) {
                    const handler = config.overlayClick;
                    if (typeof handler === 'function') {
                        handler(e);
                        return; // Don't process click delegation for overlay clicks
                    }
                }
                // Also handle click delegation if configured (for clicks on children)
                if (config.click) {
                    const target = e.target;
                    const selector = config.click.selector || '*';
                    
                    // Find matching element
                    const element = target.closest(selector);
                    if (element) {
                        const clickHandler = config.click.handler;
                        if (typeof clickHandler === 'function') {
                            clickHandler.call(element, e, target);
                        }
                    }
                }
            };
        } else if (config.click) {
            // Click delegation
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

        // Mouse enter/leave delegation
        if (config.mouseenter) {
            handlers.mouseenter = (e) => {
                const target = e.target;
                const selector = config.mouseenter.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.mouseenter.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        if (config.mouseleave) {
            handlers.mouseleave = (e) => {
                const target = e.target;
                const selector = config.mouseleave.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.mouseleave.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        // Double click delegation
        if (config.dblclick) {
            handlers.dblclick = (e) => {
                const target = e.target;
                const selector = config.dblclick.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.dblclick.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        // Keypress delegation
        if (config.keypress) {
            handlers.keypress = (e) => {
                const target = e.target;
                const selector = config.keypress.selector || '*';
                
                if (target.matches(selector)) {
                    const handler = config.keypress.handler;
                    if (typeof handler === 'function') {
                        handler.call(target, e);
                    }
                }
            };
        }

        // Drag events delegation
        if (config.dragstart) {
            handlers.dragstart = (e) => {
                const target = e.target;
                const selector = config.dragstart.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.dragstart.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        if (config.dragend) {
            handlers.dragend = (e) => {
                const target = e.target;
                const selector = config.dragend.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.dragend.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        if (config.dragover) {
            handlers.dragover = (e) => {
                const target = e.target;
                const selector = config.dragover.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.dragover.handler;
                    if (typeof handler === 'function') {
                        handler.call(element, e, target);
                    }
                }
            };
        }

        if (config.drop) {
            handlers.drop = (e) => {
                const target = e.target;
                const selector = config.drop.selector || '*';
                
                const element = target.closest(selector);
                if (element) {
                    const handler = config.drop.handler;
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
                // Set appropriate options for different event types
                let options = {};
                if (eventType === 'wheel') {
                    // Wheel events need preventDefault capability for Ctrl+scroll handling
                    options = { passive: false };
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
     * Register touch element (deprecated - touch support removed)
     * @param {HTMLElement} element - Element to register
     * @param {string} configType - Configuration type
     * @param {Object} customConfig - Custom configuration
     * @param {string} elementId - Element ID for debugging
     */
    registerTouchElement(element, configType, customConfig = {}, elementId = null) {
        Logger.ui.warn('Touch support has been removed. Use registerElement instead.');
    }

    /**
     * Unregister touch element (deprecated - touch support removed)
     * @param {HTMLElement} element - Element to unregister
     */
    unregisterTouchElement(element) {
        Logger.ui.warn('Touch support has been removed. Use unregisterElement instead.');
    }

    /**
     * Register canvas with mouse handlers (touch support removed)
     * @param {HTMLElement} canvas - Canvas element
     * @param {Object} config - Handler configuration
     * @param {string} canvasId - Canvas ID for debugging
     */
    registerCanvas(canvas, config = {}, canvasId = 'main-canvas') {
        if (!canvas) {
            Logger.event.warn('EventHandlerManager: Invalid canvas element');
            return;
        }

        // Create mouse handlers for canvas
        const canvasHandlers = {
            // Mouse events
            mousedown: config.onMouseDown || (() => {}),
            mousemove: config.onMouseMove || (() => {}),
            mouseup: config.onMouseUp || (() => {}),
            wheel: config.onWheel || (() => {}),
            dragover: config.onDragOver || (() => {}),
            drop: config.onDrop || (() => {}),
            dblclick: config.onDoubleClick || (() => {}),
            contextmenu: config.onContextMenu || (() => {})
        };

        // Register canvas with EventHandlerManager
        // Wheel needs preventDefault for zoom; force non-passive for canvas
        this.registerElement(canvas, canvasHandlers, canvasId, { passive: false });

        Logger.event.debug('🎯 Canvas registered with mouse handlers', { canvasId, canvasElement: canvas });
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
