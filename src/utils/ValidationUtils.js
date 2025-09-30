/**
 * Validation Utilities v2.0
 * Centralized validation and fallback logic for Level Editor
 * 
 * Features:
 * - StateManager-based validation system
 * - Component readiness tracking
 * - Validation result caching
 * - Simplified fallback logic
 * - Consistent error logging
 * - Type checking and conversion utilities
 */

import { Logger } from './Logger.js';

export class ValidationUtils {
    /**
     * Get StateManager instance with fallback logic
     * @param {Object} levelEditor - Primary levelEditor instance
     * @param {string} context - Context for logging
     * @returns {Object|null} - Available StateManager instance or null
     */
    static getStateManager(levelEditor, context = 'unknown') {
        // Try primary levelEditor first
        if (levelEditor?.stateManager) {
            return levelEditor.stateManager;
        }
        
        // Try fallback to window.editor
        if (window.editor?.stateManager) {
            Logger.log('DEBUG', 'debug', `ValidationUtils: Using window.editor.stateManager as fallback in ${context}`);
            return window.editor.stateManager;
        }
        
        Logger.log('DEBUG', 'warn', `ValidationUtils: No StateManager available in ${context}`);
        return null;
    }

    /**
     * Get LevelEditor instance with fallback to window.editor
     * @param {Object} levelEditor - Primary levelEditor instance
     * @param {string} context - Context for logging (method name)
     * @returns {Object|null} - Available levelEditor instance or null
     */
    static getLevelEditor(levelEditor, context = 'unknown') {
        // If primary levelEditor is available and has stateManager
        if (levelEditor?.stateManager) {
            return levelEditor;
        }
        
        // Try fallback to window.editor
        if (window.editor?.stateManager) {
            Logger.log('DEBUG', 'debug', `ValidationUtils: Using window.editor as fallback in ${context}`);
            return window.editor;
        }
        
        Logger.log('DEBUG', 'warn', `ValidationUtils: No levelEditor available in ${context}`);
        return null;
    }

    /**
     * Validate and convert numeric value
     * @param {any} value - Value to validate
     * @param {string} name - Name for logging
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {number|null} - Valid number or null
     */
    static validateNumeric(value, name = 'value', min = -Infinity, max = Infinity) {
        const numValue = Number(value);
        
        if (Number.isNaN(numValue)) {
            Logger.log('DEBUG', 'warn', `ValidationUtils: Invalid ${name} value:`, value);
            return null;
        }
        
        if (numValue < min || numValue > max) {
            Logger.log('DEBUG', 'warn', `ValidationUtils: ${name} out of range [${min}, ${max}]:`, numValue);
            return null;
        }
        
        return numValue;
    }

    /**
     * Validate font scale value
     * @param {any} value - Font scale value
     * @returns {number|null} - Valid font scale or null
     */
    static validateFontScale(value) {
        return this.validateNumeric(value, 'font scale', 0.1, 5.0);
    }

    /**
     * Validate spacing scale value
     * @param {any} value - Spacing scale value
     * @returns {number|null} - Valid spacing scale or null
     */
    static validateSpacingScale(value) {
        return this.validateNumeric(value, 'spacing scale', 0, 5.0);
    }

    /**
     * Validate boolean value
     * @param {any} value - Value to validate
     * @param {string} name - Name for logging
     * @returns {boolean} - Valid boolean
     */
    static validateBoolean(value, name = 'boolean') {
        if (typeof value === 'boolean') {
            return value;
        }
        
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        
        if (typeof value === 'number') {
            return value !== 0;
        }
        
        Logger.log('DEBUG', 'warn', `ValidationUtils: Invalid ${name} value:`, value);
        return false;
    }

    /**
     * Validate string value
     * @param {any} value - Value to validate
     * @param {string} name - Name for logging
     * @param {number} maxLength - Maximum allowed length
     * @returns {string|null} - Valid string or null
     */
    static validateString(value, name = 'string', maxLength = Infinity) {
        if (typeof value !== 'string') {
            Logger.log('DEBUG', 'warn', `ValidationUtils: Invalid ${name} type:`, typeof value);
            return null;
        }
        
        if (value.length > maxLength) {
            Logger.log('DEBUG', 'warn', `ValidationUtils: ${name} too long (${value.length} > ${maxLength}):`, value);
            return null;
        }
        
        return value;
    }

    /**
     * Check if levelEditor has required components
     * @param {Object} levelEditor - LevelEditor instance
     * @param {string[]} components - Required component names
     * @param {string} context - Context for logging
     * @returns {boolean} - True if all components are available
     */
    static hasRequiredComponents(levelEditor, components = ['stateManager'], context = 'unknown') {
        const stateManager = this.getStateManager(levelEditor, context);
        if (!stateManager) {
            return false;
        }
        
        // Check if components are ready using StateManager
        if (stateManager.areComponentsReady(components)) {
            return true;
        }
        
        // Fallback to direct checking if StateManager doesn't have the info
        for (const component of components) {
            if (!levelEditor?.[component]) {
                Logger.log('DEBUG', 'warn', `ValidationUtils: Missing ${component} in levelEditor for ${context}`);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Update component readiness status in StateManager
     * @param {Object} levelEditor - LevelEditor instance
     * @param {string} component - Component name
     * @param {boolean} ready - Whether component is ready
     */
    static updateComponentStatus(levelEditor, component, ready) {
        const stateManager = this.getStateManager(levelEditor);
        if (stateManager) {
            stateManager.updateComponentStatus(component, ready);
        }
    }

    /**
     * Safe property access with fallback
     * @param {Object} obj - Object to access
     * @param {string} path - Dot-separated property path
     * @param {any} fallback - Fallback value
     * @returns {any} - Property value or fallback
     */
    static safeGet(obj, path, fallback = null) {
        if (!obj || typeof obj !== 'object') {
            return fallback;
        }
        
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined || !(key in current)) {
                return fallback;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Log validation result
     * @param {string} context - Context for logging
     * @param {string} action - Action being performed
     * @param {any} value - Value being processed
     * @param {boolean} success - Whether validation succeeded
     */
    static logValidation(context, action, value, success = true) {
        if (success) {
            Logger.log('DEBUG', 'debug', `ValidationUtils: ${context} - ${action}:`, value);
        } else {
            Logger.log('DEBUG', 'warn', `ValidationUtils: ${context} - ${action} failed:`, value);
        }
    }

    /**
     * Get cached validation result from StateManager
     * @param {Object} levelEditor - LevelEditor instance
     * @param {string} key - Cache key
     * @returns {any} - Cached value or null
     */
    static getCachedValidation(levelEditor, key) {
        const stateManager = this.getStateManager(levelEditor);
        if (!stateManager) return null;
        
        const cached = stateManager.getValidationCache(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.value;
        }
        return null;
    }

    /**
     * Set cached validation result in StateManager
     * @param {Object} levelEditor - LevelEditor instance
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    static setCachedValidation(levelEditor, key, value, ttl = 1000) {
        const stateManager = this.getStateManager(levelEditor);
        if (stateManager) {
            stateManager.setValidationCache(key, value, ttl);
        }
    }

    /**
     * Validate value with caching
     * @param {Object} levelEditor - LevelEditor instance
     * @param {string} key - Cache key
     * @param {any} value - Value to validate
     * @param {Function} validator - Validation function
     * @param {number} ttl - Cache TTL in milliseconds
     * @returns {any} - Validated value or null
     */
    static validateWithCache(levelEditor, key, value, validator, ttl = 1000) {
        // Try to get from cache first
        const cached = this.getCachedValidation(levelEditor, key);
        if (cached !== null) {
            return cached;
        }
        
        // Validate and cache result
        const validated = validator(value);
        this.setCachedValidation(levelEditor, key, validated, ttl);
        return validated;
    }

    /**
     * Clear expired validation cache
     * @param {Object} levelEditor - LevelEditor instance
     */
    static clearExpiredCache(levelEditor) {
        const stateManager = this.getStateManager(levelEditor);
        if (stateManager) {
            stateManager.clearExpiredValidationCache();
        }
    }
}
