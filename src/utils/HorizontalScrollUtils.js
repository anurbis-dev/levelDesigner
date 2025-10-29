/**
 * HorizontalScrollUtils - Utility for horizontal scrolling with wheel and drag
 * 
 * Provides consistent horizontal scrolling functionality for horizontal containers
 * like toolbars and tab panels. Supports both wheel scrolling and middle mouse drag.
 * 
 * @author Level Designer
 * @version 3.53.0
 */

import { Logger } from './Logger.js';

export class HorizontalScrollUtils {
    // Static variables to track global state
    static activeContainers = new Map(); // container -> config
    static globalMouseMoveHandler = null;
    static globalMouseUpHandler = null;
    static isGlobalHandlersSetup = false;

    /**
     * Setup global mouse handlers if not already setup
     */
    static setupGlobalHandlers() {
        if (this.isGlobalHandlersSetup) return;

        // Global mouse move handler
        this.globalMouseMoveHandler = (e) => {
            // Find active scrolling container
            for (const [container, config] of this.activeContainers) {
                if (config.isScrolling) {
                    e.preventDefault();
                    this.updateScrolling(container, config, e);
                    break; // Only one container can scroll at a time
                }
            }
        };

        // Global mouse up handler
        this.globalMouseUpHandler = (e) => {
            // Find and stop any active scrolling
            for (const [container, config] of this.activeContainers) {
                if (config.isScrolling && e.button === 1) {
                    e.preventDefault();
                    this.stopScrolling(container, config);
                    break;
                }
            }
        };

        document.addEventListener('mousemove', this.globalMouseMoveHandler, { passive: false });
        document.addEventListener('mouseup', this.globalMouseUpHandler, { passive: false });

        this.isGlobalHandlersSetup = true;
        Logger.ui.debug('HorizontalScrollUtils: Global handlers setup');
    }

    /**
     * Setup horizontal scrolling for a container
     * @param {HTMLElement} container - The container to add scrolling to
     * @param {Object} options - Configuration options
     * @param {number} options.sensitivity - Scroll sensitivity multiplier (default: 0.5)
     * @param {Function} options.onScrollChange - Callback when scroll position changes
     * @param {string} options.scrollKey - Key for saving scroll position in user preferences
     * @param {Object} options.userPrefs - User preferences manager for saving scroll position
     */
    static setupHorizontalScrolling(container, options = {}) {
        if (!container) {
            Logger.ui.warn('HorizontalScrollUtils: Container is null or undefined');
            return;
        }

        // Setup global handlers if needed
        this.setupGlobalHandlers();

        const config = {
            sensitivity: options.sensitivity || 0.5,
            onScrollChange: options.onScrollChange || null,
            scrollKey: options.scrollKey || null,
            userPrefs: options.userPrefs || null,
            isScrolling: false,
            scrollStartX: 0,
            scrollStartScrollLeft: 0
        };

        // Store container config
        this.activeContainers.set(container, config);

        // Middle mouse button down - start scrolling
        // Use capture phase to ensure it's handled before drag events
        const mousedownHandler = (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                e.stopPropagation();
                // Allow scrolling on any element within the container
                // This will work even if element is draggable (like tabs)
                this.startScrolling(container, config, e);
            }
        };
        container.addEventListener('mousedown', mousedownHandler, { passive: false, capture: true });

        // Mouse wheel scrolling
        const wheelHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const scrollAmount = e.deltaY * config.sensitivity;
            container.scrollLeft += scrollAmount;
            
            // Save scroll position after wheel scroll
            this.saveScrollPosition(container, config);
        };
        container.addEventListener('wheel', wheelHandler, { passive: false });

        // Prevent context menu on middle click
        const contextmenuHandler = (e) => {
            if (e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        container.addEventListener('contextmenu', contextmenuHandler, { passive: false });

        // Prevent text selection during scrolling
        const selectstartHandler = (e) => {
            if (config.isScrolling) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        container.addEventListener('selectstart', selectstartHandler);

        Logger.ui.debug(`HorizontalScrollUtils: Horizontal scrolling setup for ${container.tagName}#${container.id || container.className}`);
    }

    /**
     * Start horizontal scrolling
     */
    static startScrolling(container, config, e) {
        // Prevent starting scrolling if already scrolling
        if (config.isScrolling) {
            return;
        }
        
        config.isScrolling = true;
        config.scrollStartX = e.clientX;
        config.scrollStartScrollLeft = container.scrollLeft;
        
        // Add scrolling class for CSS cursor control
        container.classList.add('scrolling');
        document.body.style.userSelect = 'none';
        
        Logger.ui.debug('HorizontalScrollUtils: Scrolling started');
    }

    /**
     * Update scrolling position - pan in opposite direction to cursor movement
     */
    static updateScrolling(container, config, e) {
        if (!config.isScrolling) return;

        const deltaX = e.clientX - config.scrollStartX;
        // Pan in opposite direction to cursor movement (standard panning behavior)
        const newScrollLeft = config.scrollStartScrollLeft - deltaX;

        // Apply scrolling with bounds
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        container.scrollLeft = Math.max(0, Math.min(newScrollLeft, maxScrollLeft));
        
        Logger.ui.debug('HorizontalScrollUtils: Scrolling updated', `deltaX: ${deltaX}, scrollLeft: ${container.scrollLeft}`);
    }

    /**
     * Stop horizontal scrolling
     */
    static stopScrolling(container, config) {
        config.isScrolling = false;
        
        // Remove scrolling class
        container.classList.remove('scrolling');
        document.body.style.userSelect = '';
        
        // Save scroll position when scrolling stops
        this.saveScrollPosition(container, config);
        
        Logger.ui.debug('HorizontalScrollUtils: Scrolling stopped');
    }

    /**
     * Save scroll position to user preferences
     */
    static saveScrollPosition(container, config) {
        if (config.scrollKey && config.userPrefs) {
            config.userPrefs.set(config.scrollKey, container.scrollLeft);
        }
        
        // Call custom callback if provided
        if (config.onScrollChange) {
            config.onScrollChange(container.scrollLeft);
        }
    }

    /**
     * Load scroll position from user preferences
     */
    static loadScrollPosition(container, config) {
        if (config.scrollKey && config.userPrefs) {
            const savedScrollLeft = config.userPrefs.get(config.scrollKey);
            if (savedScrollLeft !== null && savedScrollLeft !== undefined) {
                container.scrollLeft = savedScrollLeft;
                Logger.ui.debug(`HorizontalScrollUtils: Scroll position restored: ${savedScrollLeft}px`);
            }
        }
    }

    /**
     * Remove scrolling from a container
     */
    static removeScrolling(container) {
        this.activeContainers.delete(container);
        Logger.ui.debug(`HorizontalScrollUtils: Scrolling removed from ${container.tagName}#${container.id || container.className}`);
    }

    /**
     * Cleanup all scrolling handlers
     */
    static cleanup() {
        this.activeContainers.clear();
        
        if (this.globalMouseMoveHandler) {
            document.removeEventListener('mousemove', this.globalMouseMoveHandler);
            this.globalMouseMoveHandler = null;
        }
        
        if (this.globalMouseUpHandler) {
            document.removeEventListener('mouseup', this.globalMouseUpHandler);
            this.globalMouseUpHandler = null;
        }
        
        this.isGlobalHandlersSetup = false;
        Logger.ui.debug('HorizontalScrollUtils: Cleanup completed');
    }
}
