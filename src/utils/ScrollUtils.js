/**
 * ScrollUtils - Utility for middle mouse button scrolling
 * 
 * Provides consistent middle mouse button scrolling functionality
 * for panels and containers across the editor.
 * 
 * @author Level Designer
 * @version 3.13.0
 */

import { Logger } from './Logger.js';

export class ScrollUtils {
    // Static variables to track global state
    static globalMouseMoveHandler = null;
    static globalMouseUpHandler = null;
    static activeContainers = new Map(); // container -> config
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

        document.addEventListener('mousemove', this.globalMouseMoveHandler);
        document.addEventListener('mouseup', this.globalMouseUpHandler);

        this.isGlobalHandlersSetup = true;
        Logger.ui.debug('ScrollUtils: Global handlers setup');
    }

    /**
     * Setup middle mouse button scrolling for a container
     * @param {HTMLElement} container - The container to add scrolling to
     * @param {Object} options - Configuration options
     * @param {boolean} options.horizontal - Enable horizontal scrolling (default: true)
     * @param {boolean} options.vertical - Enable vertical scrolling (default: true)
     * @param {number} options.sensitivity - Scroll sensitivity multiplier (default: 1.0)
     */
    static setupMiddleMouseScrolling(container, options = {}) {
        if (!container) {
            Logger.ui.warn('ScrollUtils: Container is null or undefined');
            return;
        }

        // Setup global handlers if needed
        this.setupGlobalHandlers();

        const config = {
            horizontal: options.horizontal !== false,
            vertical: options.vertical !== false,
            sensitivity: options.sensitivity || 1.0,
            isScrolling: false,
            scrollStartX: 0,
            scrollStartY: 0,
            scrollStartScrollLeft: 0,
            scrollStartScrollTop: 0
        };

        // Store container config
        this.activeContainers.set(container, config);

        // Middle mouse button down - start scrolling
        container.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                e.stopPropagation();
                this.startScrolling(container, config, e);
            }
        }, { passive: false });

        // Mouse wheel scrolling - only handle if not using standard scroll
        container.addEventListener('wheel', (e) => {
            // Allow standard wheel scrolling to work normally
            // Only prevent default if we need custom behavior
            const scrollAmount = e.deltaY * config.sensitivity * 0.5;

            if (config.horizontal) {
                container.scrollLeft += scrollAmount;
            }
            if (config.vertical) {
                container.scrollTop += scrollAmount;
            }
            
            // Don't prevent default - let browser handle normal scrolling
        }, { passive: true });

        // Prevent context menu on middle click
        container.addEventListener('contextmenu', (e) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        }, { passive: false });

        Logger.ui.debug(`ScrollUtils: Scrolling setup for ${container.tagName}#${container.id || container.className}`);
    }

    static startScrolling(container, config, e) {
        config.isScrolling = true;
        config.scrollStartX = e.clientX;
        config.scrollStartY = e.clientY;
        config.scrollStartScrollLeft = container.scrollLeft;
        config.scrollStartScrollTop = container.scrollTop;

        // Change cursor to panning cursor
        container.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        // Add panning class to body for global panning state
        document.body.classList.add('panning-mode');

        Logger.ui.debug(`ScrollUtils: Scrolling started on ${container.tagName}#${container.id || container.className}`);
    }

    static updateScrolling(container, config, e) {
        if (!config.isScrolling) return;

        const deltaX = e.clientX - config.scrollStartX;
        const deltaY = e.clientY - config.scrollStartY;

        // Apply scrolling with bounds
        if (config.horizontal) {
            const newScrollLeft = config.scrollStartScrollLeft - deltaX;
            container.scrollLeft = Math.max(0, Math.min(
                newScrollLeft,
                container.scrollWidth - container.clientWidth
            ));
        }

        if (config.vertical) {
            const newScrollTop = config.scrollStartScrollTop - deltaY;
            container.scrollTop = Math.max(0, Math.min(
                newScrollTop,
                container.scrollHeight - container.clientHeight
            ));
        }
    }

    static stopScrolling(container, config) {
        config.isScrolling = false;

        // Restore cursor
        container.style.cursor = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Remove panning class from body
        document.body.classList.remove('panning-mode');

        Logger.ui.debug('ScrollUtils: Scrolling stopped');
    }

    /**
     * Add minimal scrollbar styles to a container
     * @param {HTMLElement} container - The container to style
     * @param {Object} options - Style options
     * @param {string} options.trackColor - Track color (default: #374151)
     * @param {string} options.thumbColor - Thumb color (default: #6B7280)
     * @param {string} options.hoverColor - Hover color (default: #9CA3AF)
     * @param {number} options.width - Scrollbar width (default: 6px for thin)
     */
    static addMinimalScrollbarStyles(container, options = {}) {
        if (!container) return;

        const config = {
            trackColor: options.trackColor || '#374151',
            thumbColor: options.thumbColor || '#6B7280',
            hoverColor: options.hoverColor || '#9CA3AF',
            width: options.width || '6px'
        };

        // Add scrollbar styles
        const style = document.createElement('style');
        style.textContent = `
            .minimal-scrollbar::-webkit-scrollbar {
                width: ${config.width};
                height: ${config.width};
            }
            
            .minimal-scrollbar::-webkit-scrollbar-track {
                background: ${config.trackColor};
                border-radius: 3px;
            }
            
            .minimal-scrollbar::-webkit-scrollbar-thumb {
                background: ${config.thumbColor};
                border-radius: 3px;
                border: none;
            }
            
            .minimal-scrollbar::-webkit-scrollbar-thumb:hover {
                background: ${config.hoverColor};
            }
            
            .minimal-scrollbar::-webkit-scrollbar-corner {
                background: ${config.trackColor};
            }
            
            /* Firefox */
            .minimal-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: ${config.thumbColor} ${config.trackColor};
            }
            
            /* Panning mode styles */
            .panning-mode * {
                cursor: grabbing !important;
            }
            
            .panning-mode {
                user-select: none !important;
            }
        `;
        
        // Only add style once
        if (!document.querySelector('#minimal-scrollbar-styles')) {
            style.id = 'minimal-scrollbar-styles';
            document.head.appendChild(style);
        }

        container.classList.add('minimal-scrollbar');
    }
}
