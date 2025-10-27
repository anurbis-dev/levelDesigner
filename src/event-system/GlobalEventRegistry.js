/**
 * Global Event Registry - Centralized system for document/window events
 * Prevents duplication of global event handlers across components
 */

import { eventHandlerManager } from './EventHandlerManager.js';
import { Logger } from '../utils/Logger.js';

class GlobalEventRegistry {
    constructor() {
        this.registeredComponents = new Map();
        this.globalHandlers = new Map();
    }

    /**
     * Register a component's global event handlers
     * @param {string} componentId - Unique component identifier
     * @param {Object} handlers - Event handlers object
     * @param {string} target - 'document' or 'window'
     */
    registerComponentHandlers(componentId, handlers, target = 'document') {
        const targetElement = target === 'window' ? window : document;
        const targetId = `${target}-${componentId}`;
        const registrationKey = `${target}-${componentId}`;

        // Check if already registered and skip if so
        if (this.registeredComponents.has(registrationKey)) {
            Logger.event.debug(`Component ${registrationKey} already registered, skipping duplicate registration`);
            return;
        }

        // Check if element already has handlers registered
        const existingHandlers = this.globalHandlers.get(targetElement);
        if (existingHandlers) {
            // Merge handlers instead of replacing
            const mergedHandlers = { ...existingHandlers.handlers, ...handlers };
            const mergedOptions = { ...existingHandlers.options };
            
            // Update capture option if needed
            const hasMouseUp = Object.keys(handlers).some(eventType => eventType.toLowerCase().includes('mouseup'));
            if (hasMouseUp) {
                mergedOptions.capture = true;
            }

            // Re-register with merged handlers
            eventHandlerManager.unregisterElement(targetElement);
            eventHandlerManager.registerElement(targetElement, mergedHandlers, `${target}-merged`, mergedOptions);

            // Update stored handlers
            existingHandlers.handlers = mergedHandlers;
            existingHandlers.options = mergedOptions;
            existingHandlers.components.add(componentId);

            Logger.event.debug(`Merged handlers for ${target}, now has components: ${Array.from(existingHandlers.components).join(', ')}`);
        } else {
            // First registration for this element
            const options = {};
            const hasMouseUp = Object.keys(handlers).some(eventType => eventType.toLowerCase().includes('mouseup'));
            if (hasMouseUp) {
                options.capture = true;
            }

            // Register with EventHandlerManager
            eventHandlerManager.registerElement(targetElement, handlers, targetId, options);

            // Store for cleanup and merging
            this.globalHandlers.set(targetElement, {
                handlers,
                options,
                components: new Set([componentId])
            });

            Logger.event.debug(`Component ${registrationKey} registered global handlers on ${target}`);
        }

        // Store component info for cleanup
        this.registeredComponents.set(registrationKey, {
            target,
            targetId,
            handlers,
            targetElement
        });
    }

    /**
     * Unregister a component's global event handlers
     * @param {string} componentId - Component identifier
     * @param {string} target - 'document' or 'window'
     */
    unregisterComponentHandlers(componentId, target = 'document') {
        const registrationKey = `${target}-${componentId}`;
        const component = this.registeredComponents.get(registrationKey);
        if (!component) {
            Logger.event.warn(`Component ${registrationKey} not found for unregistration`);
            return;
        }

        const targetElement = component.targetElement;
        const existingHandlers = this.globalHandlers.get(targetElement);
        
        if (existingHandlers) {
            // Remove component from the set
            existingHandlers.components.delete(componentId);
            
            if (existingHandlers.components.size === 0) {
                // No more components, unregister completely
                eventHandlerManager.unregisterElement(targetElement);
                this.globalHandlers.delete(targetElement);
                Logger.event.debug(`Unregistered all handlers for ${target}`);
            } else {
                // Remove this component's handlers and re-register
                const remainingHandlers = { ...existingHandlers.handlers };
                Object.keys(component.handlers).forEach(eventType => {
                    delete remainingHandlers[eventType];
                });
                
                if (Object.keys(remainingHandlers).length > 0) {
                    eventHandlerManager.unregisterElement(targetElement);
                    eventHandlerManager.registerElement(targetElement, remainingHandlers, `${target}-merged`, existingHandlers.options);
                    existingHandlers.handlers = remainingHandlers;
                } else {
                    eventHandlerManager.unregisterElement(targetElement);
                    this.globalHandlers.delete(targetElement);
                }
                
                Logger.event.debug(`Removed ${componentId} from ${target}, remaining components: ${Array.from(existingHandlers.components).join(', ')}`);
            }
        }

        this.registeredComponents.delete(registrationKey);
    }

    /**
     * Check if component is registered
     * @param {string} componentId - Component identifier
     * @param {string} target - 'document' or 'window'
     * @returns {boolean}
     */
    isComponentRegistered(componentId, target = 'document') {
        const registrationKey = `${target}-${componentId}`;
        return this.registeredComponents.has(registrationKey);
    }

    /**
     * Get all registered components
     * @returns {Array} List of component IDs
     */
    getRegisteredComponents() {
        return Array.from(this.registeredComponents.keys());
    }

    /**
     * Cleanup all registered components
     */
    cleanup() {
        // Unregister all elements
        for (const targetElement of this.globalHandlers.keys()) {
            eventHandlerManager.unregisterElement(targetElement);
        }
        
        // Clear all data
        this.globalHandlers.clear();
        this.registeredComponents.clear();
        
        Logger.event.debug('GlobalEventRegistry cleaned up all components');
    }
}

// Export singleton instance
export const globalEventRegistry = new GlobalEventRegistry();
