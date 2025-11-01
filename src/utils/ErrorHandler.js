/**
 * Centralized Error Handling Utility
 * Provides global error handling, recovery strategies, and error history tracking
 * 
 * @version 1.0.0
 * @class ErrorHandler
 * @static
 */
import { Logger } from './Logger.js';
import { PERFORMANCE } from '../constants/EditorConstants.js';
import { ExtensionErrorUtils } from './ExtensionErrorUtils.js';

export class ErrorHandler {
    /** @type {Object|null} Monitoring service instance */
    static monitoring = null;
    
    /** @type {Map<string, Object>} Recovery strategies for different error types */
    static strategies = new Map();
    
    /** @type {Array<Object>} History of all handled errors */
    static errorHistory = [];
    
    /** @type {number} Maximum number of errors to keep in history */
    static maxHistorySize = PERFORMANCE.MAX_HISTORY_SIZE;
    
    /** @type {boolean} Initialization status */
    static initialized = false;
    
    /**
     * Initialize error handler with optional monitoring service
     * Sets up global error handlers and default recovery strategies
     * 
     * @param {Object|null} [monitoringService=null] - Optional monitoring service for error reporting
     * @param {function(Error, Object): void} [monitoringService.reportError] - Method to report errors
     * @returns {void}
     * 
     * @example
     * // Initialize without monitoring
     * ErrorHandler.init();
     * 
     * @example
     * // Initialize with custom monitoring
     * ErrorHandler.init({
     *     reportError: (error, context) => {
     *         console.log('Reported:', error.message);
     *     }
     * });
     */
    static init(monitoringService = null) {
        if (this.initialized) {
            Logger.errorHandler.warn('ErrorHandler already initialized');
            return;
        }
        
        this.monitoring = monitoringService;
        
        // Setup global error handlers
        this.setupGlobalHandlers();
        
        // Register default strategies
        this.registerDefaultStrategies();
        
        this.initialized = true;
        Logger.errorHandler.info('ErrorHandler initialized');
    }
    
    /**
     * Setup global error handlers for window.onerror and unhandledrejection
     * Automatically called by init()
     * 
     * @private
     * @returns {void}
     */
    static setupGlobalHandlers() {
        // Unhandled errors
        window.addEventListener('error', (event) => {
            try {
                const error = event.error || (event.message ? new Error(event.message) : null);
                
                // Filter extension errors silently - these are not real errors
                if (ExtensionErrorUtils.isExtensionError(error)) {
                    Logger.errorHandler.debug('Extension error filtered:', error?.message || event.message);
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }
                
                this.handle(error, {
                    type: 'uncaught',
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            } catch (err) {
                Logger.errorHandler.error('Error in error handler:', err);
            }
        }, { capture: true });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            try {
                const reason = event.reason;
                
                // Filter extension errors silently - these are not real errors
                if (ExtensionErrorUtils.isExtensionError(reason)) {
                    Logger.errorHandler.debug('Extension promise rejection filtered:', 
                        reason?.message || String(reason));
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }
                
                this.handle(reason instanceof Error ? reason : new Error(String(reason || 'Unhandled Promise Rejection')), {
                    type: 'unhandledPromise',
                    promise: event.promise
                });
            } catch (err) {
                Logger.errorHandler.error('Error in unhandledrejection handler:', err);
            }
        });
        
        Logger.errorHandler.debug('Global error handlers registered');
    }
    
    /**
     * Handle error with context and attempt recovery
     * Core method for centralized error processing
     * 
     * @param {Error} error - Error object to handle
     * @param {Object} [context={}] - Additional error context
     * @param {string} [context.source] - Source/origin of the error
     * @param {Object} [context.metadata] - Additional metadata
     * @param {boolean} [context.showUser=true] - Whether to show error to user
     * @param {string} [context.userMessage] - Custom user-friendly message
     * @param {*} [context.defaultValue] - Default value for recovery
     * @returns {*} Recovery result or null if no recovery possible
     * 
     * @example
     * // Handle error with context
     * const result = ErrorHandler.handle(
     *     new Error('Network failed'),
     *     { source: 'API', showUser: true, userMessage: 'Не удалось загрузить данные' }
     * );
     * 
     * @example
     * // Handle with recovery
     * const data = ErrorHandler.handle(
     *     new TypeError('Invalid data'),
     *     { source: 'Parser', defaultValue: [] }
     * );
     */
    static handle(error, context = {}) {
        // Prevent duplicate error handling
        if (error._handled) return null;
        error._handled = true;
        
        // Create error info
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            name: error.constructor.name,
            context,
            timestamp: new Date().toISOString()
        };
        
        // Log error with proper formatting
        // Pass all parts as separate arguments to avoid [object Object]
        Logger.errorHandler.error('Error occurred -', errorInfo.name, '-', errorInfo.message);
        if (errorInfo.context && Object.keys(errorInfo.context).length > 0) {
            Logger.errorHandler.debug('Context:', errorInfo.context);
        }
        
        // Add to history
        this.addToHistory(errorInfo);
        
        // Report to monitoring
        if (this.monitoring) {
            try {
                this.monitoring.reportError(error, context);
            } catch (e) {
                Logger.errorHandler.warn('Failed to report error to monitoring:', e.message);
            }
        }
        
        // Try to recover
        const strategy = this.strategies.get(error.constructor.name);
        if (strategy) {
            try {
                const result = strategy.recover(error, context);
                if (result !== null && result !== undefined) {
                    Logger.errorHandler.info('Successfully recovered from error');
                    return result;
                }
            } catch (recoveryError) {
                Logger.errorHandler.error('Recovery failed:', recoveryError.message);
            }
        }
        
        // Show user-friendly message (only for non-development environments)
        if (context.showUser !== false) {
            this.showUserError(error, context);
        }
        
        return null;
    }
    
    /**
     * Wrap synchronous function with automatic error handling
     * 
     * @param {Function} fn - Function to execute
     * @param {*} [fallback=null] - Fallback value or function if error occurs
     * @param {Object} [context={}] - Error context (see handle() for options)
     * @returns {*} Function result or fallback value
     * 
     * @example
     * // Safe JSON parse with fallback
     * const data = ErrorHandler.try(
     *     () => JSON.parse(jsonString),
     *     {},
     *     { source: 'JSON.parse', showUser: false }
     * );
     * 
     * @example
     * // With fallback function
     * const result = ErrorHandler.try(
     *     () => riskyOperation(),
     *     () => getDefaultValue(),
     *     { source: 'Operation' }
     * );
     */
    static try(fn, fallback = null, context = {}) {
        try {
            const result = fn();
            // Handle promises
            if (result && typeof result.then === 'function') {
                return result.catch(error => {
                    this.handle(error, context);
                    return typeof fallback === 'function' ? fallback() : fallback;
                });
            }
            return result;
        } catch (error) {
            this.handle(error, context);
            return typeof fallback === 'function' ? fallback() : fallback;
        }
    }
    
    /**
     * Wrap asynchronous function with automatic error handling
     * 
     * @param {Function} fn - Async function to execute
     * @param {*} [fallback=null] - Fallback value or async function if error occurs
     * @param {Object} [context={}] - Error context (see handle() for options)
     * @returns {Promise<*>} Promise resolving to function result or fallback value
     * 
     * @example
     * // Safe async file load
     * const level = await ErrorHandler.tryAsync(
     *     async () => await loadLevelFromFile(file),
     *     null,
     *     { 
     *         source: 'FileManager.loadLevel',
     *         showUser: true,
     *         userMessage: 'Не удалось загрузить уровень'
     *     }
     * );
     * 
     * @example
     * // With async fallback
     * const data = await ErrorHandler.tryAsync(
     *     async () => await fetchFromAPI(),
     *     async () => await fetchFromCache(),
     *     { source: 'API' }
     * );
     */
    static async tryAsync(fn, fallback = null, context = {}) {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context);
            return typeof fallback === 'function' ? await fallback() : fallback;
        }
    }
    
    /**
     * Register recovery strategy for specific error type
     * 
     * @param {string} errorTypeName - Name of error type (e.g. 'NetworkError')
     * @param {Object} strategy - Strategy object
     * @param {function(Error, Object): *} strategy.recover - Recovery function
     * @returns {void}
     * 
     * @example
     * ErrorHandler.registerStrategy('CustomError', {
     *     recover: (error, context) => {
     *         return context.defaultValue || null;
     *     }
     * });
     */
    static registerStrategy(errorTypeName, strategy) {
        if (!strategy.recover || typeof strategy.recover !== 'function') {
            Logger.errorHandler.warn(`Invalid strategy for ${errorTypeName}: missing recover() method`);
            return;
        }
        
        this.strategies.set(errorTypeName, strategy);
        Logger.errorHandler.debug(`Registered recovery strategy for ${errorTypeName}`);
    }
    
    /**
     * Register default recovery strategies for common error types
     * Automatically called by init()
     * 
     * @private
     * @returns {void}
     */
    static registerDefaultStrategies() {
        // Network error - retry
        this.registerStrategy('NetworkError', {
            recover: (error, context) => {
                const retryCount = context.retryCount || 0;
                if (context.retry && retryCount < 3) {
                    Logger.errorHandler.info('Retrying network operation...', {
                        attempt: retryCount + 1
                    });
                    return context.retry();
                }
                return null;
            }
        });
        
        // Validation error - use fallback
        this.registerStrategy('ValidationError', {
            recover: (error, context) => {
                if (context.fallbackValue !== undefined) {
                    Logger.errorHandler.info('Using fallback value for validation error');
                    return context.fallbackValue;
                }
                return null;
            }
        });
        
        // TypeError - try to recover with default values
        this.registerStrategy('TypeError', {
            recover: (error, context) => {
                if (context.defaultValue !== undefined) {
                    Logger.errorHandler.info('Using default value for TypeError');
                    return context.defaultValue;
                }
                return null;
            }
        });
    }
    
    /**
     * Show user-friendly error message via dialog or console
     * 
     * @private
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     * @returns {void}
     */
    static showUserError(error, context) {
        // Don't show errors in development mode by default
        if (context.silent === true) {
            return;
        }
        
        const userMessage = this.getUserMessage(error, context);
        
        // Use custom dialog if available
        if (typeof window !== 'undefined') {
            if (window.customDialog && window.customDialog.alert) {
                window.customDialog.alert(userMessage, 'error');
            } else {
                // Fallback to console in development
                Logger.errorHandler.error('User Error: ' + userMessage);
            }
        }
    }
    
    /**
     * Get user-friendly error message for display
     * 
     * @private
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     * @returns {string} User-friendly message in Russian
     */
    static getUserMessage(error, context) {
        const errorMessages = {
            'FileNotFoundError': 'Файл не найден. Проверьте путь и попробуйте снова.',
            'NetworkError': 'Проблема с сетью. Проверьте подключение к интернету.',
            'ValidationError': 'Данные не прошли проверку. Проверьте введенные значения.',
            'PermissionError': 'Недостаточно прав для выполнения операции.',
            'TypeError': 'Ошибка типа данных. Пожалуйста, сообщите разработчикам.',
            'SyntaxError': 'Ошибка синтаксиса. Пожалуйста, сообщите разработчикам.',
            'RangeError': 'Значение выходит за допустимые пределы.',
            'ReferenceError': 'Ошибка обращения к переменной. Пожалуйста, сообщите разработчикам.'
        };
        
        // Use custom message from context if provided
        if (context.userMessage) {
            return context.userMessage;
        }
        
        // Try to get predefined message
        const predefinedMessage = errorMessages[error.constructor.name];
        if (predefinedMessage) {
            return predefinedMessage;
        }
        
        // Fallback to error message
        return `Произошла ошибка: ${error.message}`;
    }
    
    /**
     * Add error to history with automatic size limit
     * 
     * @private
     * @param {Object} errorInfo - Error information object
     * @returns {void}
     */
    static addToHistory(errorInfo) {
        this.errorHistory.push(errorInfo);
        
        // Keep history size limited
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * Get copy of error history array
     * 
     * @returns {Array<Object>} Array of error info objects (last 100)
     */
    static getHistory() {
        return [...this.errorHistory];
    }
    
    /**
     * Clear all error history
     * 
     * @returns {void}
     */
    static clearHistory() {
        this.errorHistory = [];
        Logger.errorHandler.debug('Error history cleared');
    }
    
    /**
     * Get error statistics from history
     * 
     * @returns {Object} Statistics object
     * @returns {number} return.total - Total error count
     * @returns {Object<string, number>} return.byType - Error counts by type
     * @returns {Array<Object>} return.recentErrors - Last 10 errors
     */
    static getStats() {
        const stats = {
            total: this.errorHistory.length,
            byType: {},
            recentErrors: this.errorHistory.slice(-10)
        };
        
        for (const errorInfo of this.errorHistory) {
            const type = errorInfo.name;
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        }
        
        return stats;
    }
    
    /**
     * Alias methods for backward compatibility and testing
     */
    
    /**
     * Log error with optional source and metadata (alias for handle)
     * Convenience method for testing and backward compatibility
     * 
     * @param {Error} error - Error object to log
     * @param {string} [source='Unknown'] - Source/context of the error
     * @param {Object} [metadata={}] - Additional metadata
     * @returns {*} Recovery result or null
     */
    static logError(error, source = 'Unknown', metadata = {}) {
        const context = {
            source,
            metadata,
            showUser: false // Don't show to user, just log
        };
        return this.handle(error, context);
    }
    
    /**
     * Get error history (alias for getHistory)
     * 
     * @returns {Array<Object>} Array of error info objects
     */
    static getErrorHistory() {
        return this.getHistory();
    }
    
    /**
     * Get statistics (alias for getStats with backward compatibility)
     * 
     * @returns {Object} Statistics object with totalErrors field
     */
    static getStatistics() {
        const stats = this.getStats();
        // Add totalErrors for backward compatibility
        stats.totalErrors = stats.total;
        return stats;
    }
}

/**
 * Custom Error Types
 * Extended Error classes with additional context information
 */

/**
 * Network-related error with URL and status information
 * 
 * @extends Error
 * @example
 * throw new NetworkError('Failed to fetch', 'https://api.example.com', 404);
 */
export class NetworkError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string|null} [url=null] - URL that caused the error
     * @param {number|null} [status=null] - HTTP status code
     */
    constructor(message, url = null, status = null) {
        super(message);
        this.name = 'NetworkError';
        this.url = url;
        this.status = status;
    }
}

/**
 * Validation error with field and value information
 * 
 * @extends Error
 * @example
 * throw new ValidationError('Invalid email', 'email', 'invalid@');
 */
export class ValidationError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string|null} [field=null] - Field that failed validation
     * @param {*} [value=null] - Invalid value
     */
    constructor(message, field = null, value = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
    }
}

/**
 * Permission/authorization error
 * 
 * @extends Error
 * @example
 * throw new PermissionError('Access denied', 'admin');
 */
export class PermissionError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string|null} [requiredPermission=null] - Required permission level
     */
    constructor(message, requiredPermission = null) {
        super(message);
        this.name = 'PermissionError';
        this.requiredPermission = requiredPermission;
    }
}

/**
 * File not found error with path information
 * 
 * @extends Error
 * @example
 * throw new FileNotFoundError('Config not found', '/path/to/config.json');
 */
export class FileNotFoundError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string|null} [path=null] - Path to the missing file
     */
    constructor(message, path = null) {
        super(message);
        this.name = 'FileNotFoundError';
        this.path = path;
    }
}
