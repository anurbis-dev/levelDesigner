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
        if (this.registeredComponents.has(componentId)) {
            Logger.event.warn(`Component ${componentId} already registered, updating handlers`);
            this.unregisterComponentHandlers(componentId);
        }

        const targetElement = target === 'window' ? window : document;
        const targetId = `${target}-${componentId}`;

        // Use capture for mouseup events to ensure they work outside canvas
        const options = {};
        const hasMouseUp = Object.keys(handlers).some(eventType => eventType.toLowerCase().includes('mouseup'));
        if (hasMouseUp) {
            options.capture = true;
        }

        // Register with EventHandlerManager
        eventHandlerManager.registerElement(targetElement, handlers, targetId, options);

        // Store for cleanup
        this.registeredComponents.set(componentId, {
            target,
            targetId,
            handlers,
            options
        });

        Logger.event.debug(`Component ${componentId} registered global handlers on ${target}`);
    }

    /**
     * Unregister a component's global event handlers
     * @param {string} componentId - Component identifier
     */
    unregisterComponentHandlers(componentId) {
        const component = this.registeredComponents.get(componentId);
        if (!component) {
            Logger.event.warn(`Component ${componentId} not found for unregistration`);
            return;
        }

        const targetElement = component.target === 'window' ? window : document;
        eventHandlerManager.unregisterElement(targetElement);

        this.registeredComponents.delete(componentId);
        Logger.event.debug(`Component ${componentId} unregistered global handlers`);
    }

    /**
     * Check if component is registered
     * @param {string} componentId - Component identifier
     * @returns {boolean}
     */
    isComponentRegistered(componentId) {
        return this.registeredComponents.has(componentId);
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
        for (const componentId of this.registeredComponents.keys()) {
            this.unregisterComponentHandlers(componentId);
        }
        Logger.event.debug('GlobalEventRegistry cleaned up all components');
    }
}

// Export singleton instance
export const globalEventRegistry = new GlobalEventRegistry();
