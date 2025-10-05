/**
 * Centralized logging system for Level Editor
 * Eliminates console.log duplication and provides consistent logging
 */
export class Logger {
    /**
     * Logging levels
     */
    static LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };

    /**
     * Current logging level (can be changed for production)
     * INFO level allows error/warn/info messages but blocks debug
     * DEBUG level allows all messages
     * NONE disables all logging (not recommended as breaks console integration)
     */
    static currentLevel = Logger.LEVELS.INFO;

    /**
     * Logging categories with colors
     */
    static CATEGORIES = {
        DUPLICATE: { color: '#4CAF50', prefix: 'DUPLICATE' },
        RENDER: { color: '#2196F3', prefix: 'RENDER' },
        CANVAS: { color: '#FF9800', prefix: 'CanvasRenderer' },
        MOUSE: { color: '#9C27B0', prefix: 'MOUSE' },
        EVENT: { color: '#607D8B', prefix: 'EVENT' },
        GROUP: { color: '#795548', prefix: 'GROUP' },
        STATE: { color: '#E91E63', prefix: 'STATE' },
        FILE: { color: '#009688', prefix: 'FILE' },
        ASSET: { color: '#FF5722', prefix: 'ASSET' },
        UI: { color: '#3F51B5', prefix: 'UI' },
        MENU: { color: '#FF9800', prefix: 'MENU' },
        PERFORMANCE: { color: '#CDDC39', prefix: 'PERF' },
        DEBUG: { color: '#9E9E9E', prefix: 'DEBUG' },
        GIT: { color: '#FF6B35', prefix: 'GIT' },
        CONSOLE: { color: '#00BCD4', prefix: 'CONSOLE' },
        LAYOUT: { color: '#8BC34A', prefix: 'LAYOUT' },
        SETTINGS: { color: '#FFC107', prefix: 'SETTINGS' },
        PREFERENCES: { color: '#673AB7', prefix: 'PREFS' },
        CONFIG: { color: '#00E676', prefix: 'CONFIG' },
        LAYER: { color: '#03A9F4', prefix: 'LAYER' },
        CACHE: { color: '#4CAF50', prefix: 'CACHE' },
        OUTLINER: { color: '#9C27B0', prefix: 'OUTLINER' },
        PARALLAX: { color: '#FF1493', prefix: 'PARALLAX' },
        OBJECT_OPERATIONS: { color: '#9C27B0', prefix: 'OBJECT_OPS' },
        LIFECYCLE: { color: '#00BCD4', prefix: 'LIFECYCLE' },
        ERROR_HANDLER: { color: '#F44336', prefix: 'ERROR_HANDLER' }
    };

    /**
     * Performance timing storage
     */
    static timings = new Map();

    /**
     * Log message with category
     * @param {string} category - Category from CATEGORIES
     * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    static log(category, level, message, ...args) {
        const levelValue = this.LEVELS[level.toUpperCase()];
        if (levelValue < this.currentLevel) return;

        // Validate message parameter
        if (message === null || message === undefined) {
            message = '[no message]';
        } else if (typeof message !== 'string') {
            message = String(message);
        }

        // Ensure message is not empty after trimming
        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            message = '[empty message]';
        } else {
            message = trimmedMessage;
        }

        const categoryConfig = this.CATEGORIES[category] || this.CATEGORIES.DEBUG;
        const prefix = `${categoryConfig.prefix}:`;

        switch (level.toLowerCase()) {
            case 'error':
                console.error(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            default:
                console.log(prefix, message, ...args);
        }
    }

    /**
     * Duplicate operations logging
     */
    static duplicate = {
        start: (message, ...args) => Logger.log('DUPLICATE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('DUPLICATE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('DUPLICATE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('DUPLICATE', 'error', message, ...args)
    };

    /**
     * Render operations logging
     */
    static render = {
        info: (message, ...args) => Logger.log('RENDER', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('RENDER', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('RENDER', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('RENDER', 'error', message, ...args),
        performance: (message, ...args) => Logger.log('PERFORMANCE', 'info', message, ...args)
    };

    /**
     * Canvas rendering logging
     */
    static canvas = {
        info: (message, ...args) => Logger.log('CANVAS', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('CANVAS', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('CANVAS', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('CANVAS', 'error', message, ...args)
    };

    /**
     * Mouse event logging
     */
    static mouse = {
        info: (message, ...args) => Logger.log('MOUSE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('MOUSE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('MOUSE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('MOUSE', 'error', message, ...args)
    };

    /**
     * Event handling logging
     */
    static event = {
        info: (message, ...args) => Logger.log('EVENT', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('EVENT', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('EVENT', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('EVENT', 'error', message, ...args)
    };

    /**
     * Group operations logging
     */
    static group = {
        info: (message, ...args) => Logger.log('GROUP', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('GROUP', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('GROUP', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('GROUP', 'error', message, ...args)
    };

    /**
     * State management logging
     */
    static state = {
        info: (message, ...args) => Logger.log('STATE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('STATE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('STATE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('STATE', 'error', message, ...args)
    };

    /**
     * File operations logging
     */
    static file = {
        info: (message, ...args) => Logger.log('FILE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('FILE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('FILE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('FILE', 'error', message, ...args)
    };

    /**
     * Asset management logging
     */
    static asset = {
        info: (message, ...args) => Logger.log('ASSET', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('ASSET', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('ASSET', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('ASSET', 'error', message, ...args)
    };

    /**
     * UI component logging
     */
    static ui = {
        info: (message, ...args) => Logger.log('UI', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('UI', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('UI', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('UI', 'error', message, ...args)
    };

    /**
     * Performance timing methods
     */
    static time(label) {
        this.timings.set(label, performance.now());
    }

    static timeEnd(label) {
        const startTime = this.timings.get(label);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.log('PERFORMANCE', 'info', `${label} took ${duration.toFixed(2)}ms`);
            this.timings.delete(label);
            return duration;
        }
        return null;
    }

    /**
     * Group multiple logs together
     * @param {string} groupName - Name of the group
     * @param {Function} callback - Function to execute within group
     */
    static group(groupName, callback) {
        console.group(groupName);
        try {
            callback();
        } finally {
            console.groupEnd();
        }
    }

    /**
     * Log object/array in a formatted way
     * @param {string} category - Logging category
     * @param {string} title - Title for the data
     * @param {any} data - Data to log
     */
    static data(category, title, data) {
        const categoryConfig = this.CATEGORIES[category] || this.CATEGORIES.DEBUG;
        console.group(`${categoryConfig.prefix}:`, title);
        console.log(data);
        console.groupEnd();
    }

    /**
     * Set logging level (useful for production)
     * @param {string} level - Level name ('DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE')
     */
    static setLevel(level) {
        this.currentLevel = this.LEVELS[level] || this.LEVELS.DEBUG;
    }

    /**
     * Enable/disable specific category
     * @param {string} category - Category to toggle
     * @param {boolean} enabled - Whether to enable the category
     */
    static setCategoryEnabled(category, enabled) {
        if (this.CATEGORIES[category]) {
            this.CATEGORIES[category].enabled = enabled;
        }
    }

    /**
     * Create a logger function bound to specific category and level
     * @param {string} category - Category name
     * @param {string} level - Log level
     * @returns {Function} Bound logger function
     */
    static createLogger(category, level = 'info') {
        return (message, ...args) => this.log(category, level, message, ...args);
    }

    /**
     * Utility methods for common debugging scenarios
     */
    static utils = {
        /**
         * Log function entry/exit
         */
        trace: (className, methodName, args = []) => {
            Logger.log('DEBUG', 'debug', `${className}.${methodName}(${args.join(', ')}) called`);
        },

        /**
         * Log state changes
         */
        stateChange: (property, oldValue, newValue) => {
            Logger.state.debug(`State change: ${property}`, { from: oldValue, to: newValue });
        },

        /**
         * Log error with stack trace
         */
        error: (error, context = '') => {
            Logger.log('DEBUG', 'error', `Error ${context}:`, error);
            if (error.stack) {
                console.error(error.stack);
            }
        },

        /**
         * Assert condition and log if failed
         */
        assert: (condition, message) => {
            if (!condition) {
                Logger.log('DEBUG', 'error', `Assertion failed: ${message}`);
                console.trace();
            }
        }
    };

    /**
     * Git operations logging
     */
    static git = {
        info: (message, ...args) => Logger.log('GIT', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('GIT', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('GIT', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('GIT', 'error', message, ...args)
    };

    /**
     * Console operations logging
     */
    static console = {
        info: (message, ...args) => Logger.log('CONSOLE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('CONSOLE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('CONSOLE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('CONSOLE', 'error', message, ...args)
    };

    /**
     * Layout and panels logging
     */
    static layout = {
        info: (message, ...args) => Logger.log('LAYOUT', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('LAYOUT', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('LAYOUT', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('LAYOUT', 'error', message, ...args)
    };

    /**
     * Settings management logging
     */
    static settings = {
        info: (message, ...args) => Logger.log('SETTINGS', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('SETTINGS', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('SETTINGS', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('SETTINGS', 'error', message, ...args)
    };

    /**
     * User preferences logging
     */
    static preferences = {
        info: (message, ...args) => Logger.log('PREFERENCES', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('PREFERENCES', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('PREFERENCES', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('PREFERENCES', 'error', message, ...args)
    };

    /**
     * Layer management logging
     */
    /**
     * Cache operations logging
     */
    static cache = {
        info: (message, ...args) => Logger.log('CACHE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('CACHE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('CACHE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('CACHE', 'error', message, ...args)
    };

    static layer = {
        info: (message, ...args) => Logger.log('LAYER', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('LAYER', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('LAYER', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('LAYER', 'error', message, ...args)
    };

    /**
     * Outliner panel logging
     */
    static outliner = {
        info: (message, ...args) => Logger.log('OUTLINER', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('OUTLINER', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('OUTLINER', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('OUTLINER', 'error', message, ...args)
    };

    /**
     * Parallax effects logging
     */
    static parallax = {
        info: (message, ...args) => Logger.log('PARALLAX', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('PARALLAX', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('PARALLAX', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('PARALLAX', 'error', message, ...args)
    };

    /**
     * Object operations logging
     */
    static objectOperations = {
        info: (message, ...args) => Logger.log('OBJECT_OPERATIONS', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('OBJECT_OPERATIONS', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('OBJECT_OPERATIONS', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('OBJECT_OPERATIONS', 'error', message, ...args)
    };

    /**
     * Component lifecycle logging
     */
    static lifecycle = {
        info: (message, ...args) => Logger.log('LIFECYCLE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('LIFECYCLE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('LIFECYCLE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('LIFECYCLE', 'error', message, ...args)
    };

    /**
     * Error handler logging
     */
    static errorHandler = {
        info: (message, ...args) => Logger.log('ERROR_HANDLER', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('ERROR_HANDLER', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('ERROR_HANDLER', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('ERROR_HANDLER', 'error', message, ...args)
    };

    /**
     * Cache logging
     */
    static cache = {
        info: (message, ...args) => Logger.log('CACHE', 'info', message, ...args),
        debug: (message, ...args) => Logger.log('CACHE', 'debug', message, ...args),
        warn: (message, ...args) => Logger.log('CACHE', 'warn', message, ...args),
        error: (message, ...args) => Logger.log('CACHE', 'error', message, ...args)
    };
}
