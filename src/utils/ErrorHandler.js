/**
 * Centralized Error Handling Utility
 * @version 1.0.0
 */
import { Logger } from './Logger.js';

export class ErrorHandler {
    static monitoring = null;
    static strategies = new Map();
    static errorHistory = [];
    static maxHistorySize = 100;
    static initialized = false;
    
    /**
     * Initialize error handler with monitoring service
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
     * Setup global error handlers
     */
    static setupGlobalHandlers() {
        // Unhandled errors
        window.addEventListener('error', (event) => {
            this.handle(event.error || new Error(event.message), {
                type: 'uncaught',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handle(event.reason || new Error('Unhandled Promise Rejection'), {
                type: 'unhandledPromise',
                promise: event.promise
            });
        });
        
        Logger.errorHandler.debug('Global error handlers registered');
    }
    
    /**
     * Handle error with context
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
     * Wrap function with error handling
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
     * Wrap async function with error handling
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
     * Register recovery strategy for error type
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
     * Register default recovery strategies
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
     * Show user-friendly error message
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
     * Get user-friendly error message
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
     * Add error to history
     */
    static addToHistory(errorInfo) {
        this.errorHistory.push(errorInfo);
        
        // Keep history size limited
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }
    
    /**
     * Get error history
     */
    static getHistory() {
        return [...this.errorHistory];
    }
    
    /**
     * Clear error history
     */
    static clearHistory() {
        this.errorHistory = [];
        Logger.errorHandler.debug('Error history cleared');
    }
    
    /**
     * Get error statistics
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
     * Log error with optional source and metadata
     * @param {Error} error - Error object
     * @param {string} source - Source/context of the error
     * @param {object} metadata - Additional metadata
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
     */
    static getErrorHistory() {
        return this.getHistory();
    }
    
    /**
     * Get statistics (alias for getStats)
     */
    static getStatistics() {
        const stats = this.getStats();
        // Add totalErrors for backward compatibility
        stats.totalErrors = stats.total;
        return stats;
    }
}

// Custom Error Types
export class NetworkError extends Error {
    constructor(message, url = null, status = null) {
        super(message);
        this.name = 'NetworkError';
        this.url = url;
        this.status = status;
    }
}

export class ValidationError extends Error {
    constructor(message, field = null, value = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
    }
}

export class PermissionError extends Error {
    constructor(message, requiredPermission = null) {
        super(message);
        this.name = 'PermissionError';
        this.requiredPermission = requiredPermission;
    }
}

export class FileNotFoundError extends Error {
    constructor(message, path = null) {
        super(message);
        this.name = 'FileNotFoundError';
        this.path = path;
    }
}
