/**
 * EventHandlerManager - Centralized event handling system for UI elements
 * 
 * Provides unified event handling for:
 * - Dialog windows (Settings, ActorProperties, UniversalDialog)
 * - Button interactions
 * - Keyboard shortcuts (ESC, Enter, etc.)
 * - Context menus
 * - Any other UI elements that need event handling
 */

import { Logger } from '../utils/Logger.js';

export class EventHandlerManager {
    constructor() {
        this.registeredElements = new Map(); // Map<element, config>
        this.globalHandlers = new Map(); // Map<eventType, handler>
        this.dialogHandlers = new Map(); // Map<dialogId, handlers>
        this.cleanupFunctions = new Map(); // Map<element, cleanupFunction>
        
        // Default configurations for different element types
        this.defaultConfigs = {
            dialog: {
                type: 'dialog',
                handlers: {
                    click: null,
                    keydown: null,
                    contextmenu: null
                },
                globalHandlers: {
                    escape: null,
                    enter: null
                }
            },
            button: {
                type: 'button',
                handlers: {
                    click: null,
                    mouseenter: null,
                    mouseleave: null
                }
            },
            input: {
                type: 'input',
                handlers: {
                    focus: null,
                    blur: null,
                    keydown: null,
                    change: null
                }
            }
        };
        
        this.init();
    }
    
    init() {
        // Setup global event listeners
        this.setupGlobalEventListeners();
        
        Logger.ui.info('🎯 EventHandlerManager initialized');
    }
    
    /**
     * Register an element with event handlers
     * @param {HTMLElement} element - Element to register
     * @param {string} type - Element type (dialog, button, input, etc.)
     * @param {Object} config - Configuration object
     * @param {string} dialogId - Optional dialog ID for dialog-specific handlers
     */
    registerElement(element, type, config, dialogId = null) {
        if (!element || !type) {
            Logger.ui.warn('EventHandlerManager: Invalid element or type provided');
            return;
        }
        
        const elementId = element.id || `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Merge with default config
        const defaultConfig = this.defaultConfigs[type] || {};
        const mergedConfig = {
            ...defaultConfig,
            ...config,
            elementId,
            dialogId,
            registeredAt: Date.now()
        };
        
        // Store element configuration
        this.registeredElements.set(element, mergedConfig);
        
        // Setup event listeners
        this.setupElementEventListeners(element, mergedConfig);
        
        // If it's a dialog, register dialog-specific handlers
        if (dialogId) {
            this.registerDialogHandlers(dialogId, element, mergedConfig);
        }
        
        Logger.ui.debug('🎯 Element registered', {
            elementId,
            type,
            dialogId,
            handlers: Object.keys(mergedConfig.handlers || {})
        });
    }
    
    /**
     * Register dialog-specific handlers
     * @param {string} dialogId - Dialog ID
     * @param {HTMLElement} element - Dialog element
     * @param {Object} config - Configuration
     */
    registerDialogHandlers(dialogId, element, config) {
        if (!this.dialogHandlers.has(dialogId)) {
            this.dialogHandlers.set(dialogId, new Map());
        }
        
        const dialogHandlers = this.dialogHandlers.get(dialogId);
        dialogHandlers.set(element, config);
        
        // Setup dialog-specific global handlers (like ESC)
        if (config.globalHandlers) {
            this.setupDialogGlobalHandlers(dialogId, config.globalHandlers);
        }
    }
    
    /**
     * Setup element-specific event listeners
     * @param {HTMLElement} element - Element
     * @param {Object} config - Configuration
     */
    setupElementEventListeners(element, config) {
        const cleanupFunctions = [];
        
        if (config.handlers) {
            // Setup individual event listeners
            Object.entries(config.handlers).forEach(([eventType, handler]) => {
                if (handler && typeof handler === 'function') {
                    const wrappedHandler = (e) => {
                        try {
                            handler.call(config.context || this, e);
                        } catch (error) {
                            Logger.ui.error('Event handler error:', error);
                        }
                    };
                    
                    element.addEventListener(eventType, wrappedHandler);
                    cleanupFunctions.push(() => {
                        element.removeEventListener(eventType, wrappedHandler);
                    });
                }
            });
        }
        
        // Store cleanup functions
        this.cleanupFunctions.set(element, cleanupFunctions);
    }

    
    /**
     * Setup dialog-specific global handlers
     * @param {string} dialogId - Dialog ID
     * @param {Object} globalHandlers - Global handlers config
     */
    setupDialogGlobalHandlers(dialogId, globalHandlers) {
        const cleanupFunctions = [];
        
        Object.entries(globalHandlers).forEach(([eventType, handler]) => {
            if (handler && typeof handler === 'function') {
                const wrappedHandler = (e) => {
                    try {
                        // Check if dialog is currently visible
                        const dialogElement = document.getElementById(dialogId);
                        if (dialogElement && dialogElement.style.display !== 'none') {
                            handler.call(this, e);
                        }
                    } catch (error) {
                        Logger.ui.error('Global event handler error:', error);
                    }
                };
                
                document.addEventListener(eventType, wrappedHandler);
                cleanupFunctions.push(() => {
                    document.removeEventListener(eventType, wrappedHandler);
                });
            }
        });
        
        // Store cleanup functions for dialog
        if (!this.cleanupFunctions.has(dialogId)) {
            this.cleanupFunctions.set(dialogId, []);
        }
        this.cleanupFunctions.get(dialogId).push(...cleanupFunctions);
    }
    
    /**
     * Setup global event listeners
     */
    setupGlobalEventListeners() {
        // Global ESC handler for any visible dialog
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleGlobalEscape(e);
            }
        });
        
        // Global click handler for overlay clicks
        document.addEventListener('click', (e) => {
            this.handleGlobalClick(e);
        });
    }
    
    /**
     * Handle global ESC key
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleGlobalEscape(e) {
        // Find the topmost visible dialog
        const visibleDialogs = Array.from(this.dialogHandlers.keys()).filter(dialogId => {
            const dialogElement = document.getElementById(dialogId);
            return dialogElement && dialogElement.style.display !== 'none';
        });
        
        if (visibleDialogs.length > 0) {
            const topDialog = visibleDialogs[visibleDialogs.length - 1];
            const dialogHandlers = this.dialogHandlers.get(topDialog);
            
            if (dialogHandlers) {
                // Find ESC handler for this dialog
                for (const [element, config] of dialogHandlers) {
                    if (config.globalHandlers && config.globalHandlers.escape) {
                        config.globalHandlers.escape.call(config.context || this, e);
                        break;
                    }
                }
            }
        }
    }
    
    /**
     * Handle global click events
     * @param {MouseEvent} e - Mouse event
     */
    handleGlobalClick(e) {
        // Check if click is on dialog overlay
        const overlay = e.target.closest('[id$="-overlay"]');
        if (overlay && e.target === overlay) {
            const dialogId = overlay.id.replace('-overlay', '');
            const dialogHandlers = this.dialogHandlers.get(dialogId);
            
            if (dialogHandlers) {
                // Find overlay click handler
                for (const [element, config] of dialogHandlers) {
                    if (config.handlers && config.handlers.overlayClick) {
                        config.handlers.overlayClick.call(config.context || this, e);
                        break;
                    }
                }
            }
        }
    }
    
    /**
     * Unregister an element
     * @param {HTMLElement} element - Element to unregister
     */
    unregisterElement(element) {
        if (!this.registeredElements.has(element)) {
            return;
        }
        
        const config = this.registeredElements.get(element);
        
        // Cleanup element event listeners
        const cleanupFunctions = this.cleanupFunctions.get(element);
        if (cleanupFunctions) {
            cleanupFunctions.forEach(cleanup => cleanup());
            this.cleanupFunctions.delete(element);
        }
        
        // Cleanup dialog handlers if applicable
        if (config.dialogId) {
            this.unregisterDialogHandlers(config.dialogId, element);
        }
        
        // Remove from registered elements
        this.registeredElements.delete(element);
        
        Logger.ui.debug('🎯 Element unregistered', {
            elementId: config.elementId,
            type: config.type,
            dialogId: config.dialogId
        });
    }
    
    /**
     * Unregister dialog handlers
     * @param {string} dialogId - Dialog ID
     * @param {HTMLElement} element - Dialog element
     */
    unregisterDialogHandlers(dialogId, element) {
        const dialogHandlers = this.dialogHandlers.get(dialogId);
        if (dialogHandlers) {
            dialogHandlers.delete(element);
            
            // If no more handlers for this dialog, cleanup global handlers
            if (dialogHandlers.size === 0) {
                const cleanupFunctions = this.cleanupFunctions.get(dialogId);
                if (cleanupFunctions) {
                    cleanupFunctions.forEach(cleanup => cleanup());
                    this.cleanupFunctions.delete(dialogId);
                }
                this.dialogHandlers.delete(dialogId);
            }
        }
    }
    
    /**
     * Unregister all handlers for a dialog
     * @param {string} dialogId - Dialog ID
     */
    unregisterDialog(dialogId) {
        const dialogHandlers = this.dialogHandlers.get(dialogId);
        if (dialogHandlers) {
            // Unregister all elements for this dialog
            for (const [element, config] of dialogHandlers) {
                this.unregisterElement(element);
            }
            
            // Cleanup dialog-specific handlers
            const cleanupFunctions = this.cleanupFunctions.get(dialogId);
            if (cleanupFunctions) {
                cleanupFunctions.forEach(cleanup => cleanup());
                this.cleanupFunctions.delete(dialogId);
            }
            
            this.dialogHandlers.delete(dialogId);
            
            Logger.ui.debug('🎯 Dialog unregistered', { dialogId });
        }
    }
    
    /**
     * Get registered element configuration
     * @param {HTMLElement} element - Element
     * @returns {Object|null} Configuration
     */
    getElementConfig(element) {
        return this.registeredElements.get(element) || null;
    }
    
    /**
     * Get dialog handlers
     * @param {string} dialogId - Dialog ID
     * @returns {Map|null} Dialog handlers
     */
    getDialogHandlers(dialogId) {
        return this.dialogHandlers.get(dialogId) || null;
    }
    
    /**
     * Check if element is registered
     * @param {HTMLElement} element - Element
     * @returns {boolean} Is registered
     */
    isElementRegistered(element) {
        return this.registeredElements.has(element);
    }
    
    /**
     * Get all registered elements
     * @returns {Map} All registered elements
     */
    getAllRegisteredElements() {
        return new Map(this.registeredElements);
    }
    
    /**
     * Get all registered dialogs
     * @returns {Map} All registered dialogs
     */
    getAllRegisteredDialogs() {
        return new Map(this.dialogHandlers);
    }
    
    /**
     * Cleanup all handlers
     */
    destroy() {
        // Cleanup all element handlers
        for (const [element, cleanupFunctions] of this.cleanupFunctions) {
            cleanupFunctions.forEach(cleanup => cleanup());
        }
        
        // Clear all maps
        this.registeredElements.clear();
        this.globalHandlers.clear();
        this.dialogHandlers.clear();
        this.cleanupFunctions.clear();
        
        Logger.ui.info('🎯 EventHandlerManager destroyed');
    }
}

// Create singleton instance
export const eventHandlerManager = new EventHandlerManager();
