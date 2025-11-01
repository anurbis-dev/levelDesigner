/**
 * Utility class for handling browser extension-related errors
 * 
 * This class provides centralized error detection and handling for common
 * browser extension conflicts that can interfere with File System Access API
 * and other browser APIs.
 */
export class ExtensionErrorUtils {
    /**
     * Common extension error patterns that indicate conflicts with browser extensions
     */
    static get EXTENSION_ERROR_PATTERNS() {
        return [
            'message channel closed',
            'asynchronous response',
            'listener indicated an asynchronous response',
            'message channel closed before a response was received',
            'extension context invalidated',
            'receiving end does not exist',
            'could not establish connection',
            'runtime.lasterror',
            'chrome-extension://',
            'moz-extension://',
            'edge-extension://',
            'timeout - possible extension conflict',
            'file picker timeout',
            'file writing timeout',
            'file write operation timeout',
            'directory picker timeout'
        ];
    }

    /**
     * Check if error is related to browser extensions
     * @param {Error|string|any} error - Error to check (can be Error object, string, or any value)
     * @returns {boolean} True if extension-related error
     */
    static isExtensionError(error) {
        if (!error) return false;
        
        // Handle string errors
        if (typeof error === 'string') {
            const message = error.toLowerCase();
            return this.EXTENSION_ERROR_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()));
        }
        
        // Handle Error objects
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return this.EXTENSION_ERROR_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()));
        }
        
        // Handle objects with message property
        if (error && typeof error === 'object' && error.message) {
            const message = String(error.message).toLowerCase();
            return this.EXTENSION_ERROR_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()));
        }
        
        // Handle toString for other types
        try {
            const message = String(error).toLowerCase();
            return this.EXTENSION_ERROR_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()));
        } catch (_) {
            return false;
        }
    }

    /**
     * Create a timeout promise for File System Access API operations
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} operation - Operation name for error message
     * @returns {Promise} Promise that rejects after timeout
     */
    static createTimeoutPromise(timeoutMs, operation = 'operation') {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${operation} timeout - possible extension conflict`));
            }, timeoutMs);
        });
    }

    /**
     * Race a File System Access API operation against a timeout
     * @param {Promise} operationPromise - The File System Access API promise
     * @param {number} timeoutMs - Timeout in milliseconds
     * @param {string} operation - Operation name for error message
     * @returns {Promise} Promise that resolves with operation result or rejects with timeout
     */
    static withTimeout(operationPromise, timeoutMs, operation = 'operation') {
        const timeoutPromise = this.createTimeoutPromise(timeoutMs, operation);
        return Promise.race([operationPromise, timeoutPromise]);
    }

    /**
     * Handle File System Access API errors with automatic fallback detection
     * @param {Error} error - The error that occurred
     * @param {Function} fallbackFunction - Function to call as fallback
     * @param {Object} context - Context object with logger and operation info
     * @returns {Promise} Promise resolving to fallback result or throwing original error
     */
    static async handleFileSystemError(error, fallbackFunction, context = {}) {
        const { logger, operation = 'File System Access API operation' } = context;
        
        if (error.name === 'AbortError') {
            if (logger) logger.info(`${operation} cancelled by user`);
            return null;
        }
        
        if (this.isExtensionError(error)) {
            if (logger) logger.warn(`${operation} failed due to extension conflict, using fallback`);
            if (typeof fallbackFunction === 'function') {
                return await fallbackFunction();
            }
            throw new Error(`${operation} failed due to browser extension conflict. Please try disabling extensions or use a different browser.`);
        }
        
        // Re-throw non-extension errors
        throw error;
    }

    /**
     * Get user-friendly error message for extension conflicts
     * @param {string} operation - The operation that failed
     * @returns {string} User-friendly error message
     */
    static getExtensionConflictMessage(operation = 'This operation') {
        return `${operation} failed due to browser extension conflict. Please try disabling extensions or use a different browser.`;
    }
}
