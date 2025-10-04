/**
 * Component Lifecycle Manager
 * Manages initialization and cleanup of UI components
 * @version 1.0.0
 */
import { Logger } from '../utils/Logger.js';

export class ComponentLifecycle {
    constructor() {
        this.components = new Map();
        this.initOrder = [];
    }
    
    /**
     * Register component for lifecycle management
     * @param {string} name - Component name
     * @param {Object} component - Component instance
     * @param {Object} options - Registration options
     * @param {boolean} options.requireDestroy - Whether component must have destroy() method
     * @param {number} options.priority - Destruction priority (higher = destroyed first)
     */
    register(name, component, options = {}) {
        if (this.components.has(name)) {
            Logger.ui.warn(`Component ${name} already registered, replacing...`);
            this.destroy(name);
        }
        
        // Validate component
        if (!component) {
            throw new Error(`Cannot register null component: ${name}`);
        }
        
        if (options.requireDestroy !== false && !component.destroy) {
            Logger.ui.warn(
                `Component ${name} does not have destroy() method but is marked as requiring it`
            );
        }
        
        // Store component info
        this.components.set(name, {
            instance: component,
            options: {
                requireDestroy: options.requireDestroy !== false, // Default true
                priority: options.priority || 0 // Higher priority = destroyed first
            },
            registeredAt: Date.now()
        });
        
        this.initOrder.push(name);
        
        Logger.ui.debug(`Registered component: ${name}`, {
            hasDestroy: !!component.destroy,
            priority: options.priority || 0
        });
        
        return component;
    }
    
    /**
     * Get component by name
     * @param {string} name - Component name
     * @returns {Object|null} Component instance or null
     */
    get(name) {
        const entry = this.components.get(name);
        return entry?.instance || null;
    }
    
    /**
     * Check if component is registered
     * @param {string} name - Component name
     * @returns {boolean} True if component is registered
     */
    has(name) {
        return this.components.has(name);
    }
    
    /**
     * Destroy specific component
     * @param {string} name - Component name
     * @returns {boolean} True if successfully destroyed
     */
    destroy(name) {
        const entry = this.components.get(name);
        if (!entry) {
            Logger.ui.debug(`Component ${name} not found for destruction`);
            return false;
        }
        
        const { instance, options } = entry;
        
        try {
            if (instance.destroy) {
                Logger.ui.debug(`Destroying component: ${name}`);
                instance.destroy();
            } else if (options.requireDestroy) {
                Logger.ui.warn(
                    `Component ${name} requires destroy() but method not found`
                );
            }
            
            this.components.delete(name);
            
            // Remove from init order
            const index = this.initOrder.indexOf(name);
            if (index > -1) {
                this.initOrder.splice(index, 1);
            }
            
            Logger.ui.debug(`Destroyed component: ${name}`);
            return true;
            
        } catch (error) {
            Logger.ui.error(`Failed to destroy component ${name}:`, error);
            // Still remove from registry to prevent memory leak
            this.components.delete(name);
            return false;
        }
    }
    
    /**
     * Destroy all components in reverse order of registration
     * (or by priority if specified)
     */
    destroyAll() {
        Logger.ui.info(`Destroying ${this.components.size} components...`);
        
        // Sort by priority (higher priority first) then by registration order (reverse)
        const sortedEntries = Array.from(this.components.entries())
            .sort((a, b) => {
                const [, entryA] = a;
                const [, entryB] = b;
                
                // First sort by priority (descending)
                if (entryA.options.priority !== entryB.options.priority) {
                    return entryB.options.priority - entryA.options.priority;
                }
                
                // Then by registration time (newer first)
                return entryB.registeredAt - entryA.registeredAt;
            });
        
        let successCount = 0;
        let failCount = 0;
        
        for (const [name] of sortedEntries) {
            const success = this.destroy(name);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }
        
        this.components.clear();
        this.initOrder = [];
        
        Logger.ui.info(`Component destruction complete`, {
            success: successCount,
            failed: failCount
        });
    }
    
    /**
     * Get lifecycle statistics
     * @returns {Object} Statistics about registered components
     */
    getStats() {
        const stats = {
            totalComponents: this.components.size,
            withDestroy: 0,
            withoutDestroy: 0,
            byPriority: {}
        };
        
        for (const [name, entry] of this.components.entries()) {
            if (entry.instance.destroy) {
                stats.withDestroy++;
            } else {
                stats.withoutDestroy++;
            }
            
            const priority = entry.options.priority;
            if (!stats.byPriority[priority]) {
                stats.byPriority[priority] = [];
            }
            stats.byPriority[priority].push(name);
        }
        
        return stats;
    }
    
    /**
     * List all registered components
     * @returns {Array<string>} Array of component names
     */
    list() {
        return Array.from(this.components.keys());
    }
}
