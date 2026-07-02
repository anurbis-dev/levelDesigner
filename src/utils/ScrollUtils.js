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
    // Optional per-container overrides. If a container is not registered,
    // default config is used and panning still works.
    static activeContainers = new Map(); // container -> config

    // Global auto-panning handlers/state
    static globalMouseDownHandler = null;
    static globalMouseMoveHandler = null;
    static globalMouseUpHandler = null;
    static globalBlurHandler = null;
    static isGlobalHandlersSetup = false;

    static currentSession = null; // { container, config, startX, startY, startScrollLeft, startScrollTop }

    /**
     * Setup global mouse handlers if not already setup
     */
    static setupGlobalHandlers() {
        if (this.isGlobalHandlersSetup) return;

        // Start panning on middle mouse down for ANY scrollable editor container.
        this.globalMouseDownHandler = (e) => {
            if (e.button !== 1) return;

            // Keep canvas middle button behavior (zoom) untouched.
            if (e.target && e.target.closest('canvas')) {
                return;
            }

            const container = this.findScrollableContainer(e.target);
            if (!container) {
                return;
            }

            const config = this.getContainerConfig(container);
            if (!config.horizontal && !config.vertical) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            this.startScrolling(container, config, e);
        };

        // Update active session on mouse move.
        this.globalMouseMoveHandler = (e) => {
            if (!this.currentSession) {
                return;
            }

            e.preventDefault();
            this.updateScrolling(this.currentSession.container, this.currentSession, e);
        };

        // Stop active session.
        this.globalMouseUpHandler = (e) => {
            if (!this.currentSession) {
                return;
            }

            if (e.button === 1) {
                e.preventDefault();
                this.stopScrolling(this.currentSession.container, this.currentSession);
            }
        };

        // Defensive cleanup when window loses focus during panning.
        this.globalBlurHandler = () => {
            if (this.currentSession) {
                this.stopScrolling(this.currentSession.container, this.currentSession);
            }
        };

        document.addEventListener('mousedown', this.globalMouseDownHandler, { passive: false, capture: true });
        document.addEventListener('mousemove', this.globalMouseMoveHandler, { passive: false });
        document.addEventListener('mouseup', this.globalMouseUpHandler, { passive: false });
        window.addEventListener('blur', this.globalBlurHandler);

        this.isGlobalHandlersSetup = true;
        Logger.ui.debug('ScrollUtils: Universal middle-mouse panning enabled');
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

        // Register or update per-container config override.
        const existingConfig = this.activeContainers.get(container);
        if (existingConfig) {
            existingConfig.horizontal = options.horizontal !== false;
            existingConfig.vertical = options.vertical !== false;
            existingConfig.sensitivity = options.sensitivity || 1.0;
            return;
        }

        const config = {
            horizontal: options.horizontal !== false,
            vertical: options.vertical !== false,
            sensitivity: options.sensitivity || 1.0
        };

        // Store container config
        this.activeContainers.set(container, config);

        Logger.ui.debug(`ScrollUtils: Scrolling setup for ${container.tagName}#${container.id || container.className}`);
    }

    /**
     * Get effective config for container (registered override or defaults).
     * @param {HTMLElement} container
     * @returns {{horizontal:boolean, vertical:boolean, sensitivity:number}}
     */
    static getContainerConfig(container) {
        const config = this.activeContainers.get(container);
        if (config) {
            return config;
        }

        return {
            horizontal: true,
            vertical: true,
            sensitivity: 1.0
        };
    }

    /**
     * Find nearest scrollable container. Prefers explicitly registered containers,
     * then falls back to any element with real overflow.
     * @param {EventTarget} target
     * @returns {HTMLElement|null}
     */
    static findScrollableContainer(target) {
        let element = target instanceof HTMLElement ? target : null;

        // Do not start panning from interactive form/text controls.
        // This prevents horizontal scrolling of search inputs and editors.
        if (element && element.closest('input, textarea, select, [contenteditable="true"]')) {
            return null;
        }

        while (element && element !== document.body) {
            if (element.dataset?.noMiddlePan === 'true') {
                return null;
            }

            // Registered containers are preferred, but only when they can actually scroll.
            if (this.activeContainers.has(element) && this.isElementScrollable(element)) {
                return element;
            }

            if (this.isElementScrollable(element)) {
                return element;
            }

            element = element.parentElement;
        }

        return null;
    }

    /**
     * Check if element can actually scroll.
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    static isElementScrollable(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        const overflowYScrollable = /(auto|scroll|overlay)/.test(style.overflowY);
        const overflowXScrollable = /(auto|scroll|overlay)/.test(style.overflowX);

        const canScrollY = overflowYScrollable && element.scrollHeight > element.clientHeight + 1;
        const canScrollX = overflowXScrollable && element.scrollWidth > element.clientWidth + 1;

        return canScrollX || canScrollY;
    }

    static startScrolling(container, config, e) {
        this.currentSession = {
            container,
            horizontal: config.horizontal,
            vertical: config.vertical,
            sensitivity: config.sensitivity || 1.0,
            startX: e.clientX,
            startY: e.clientY,
            startScrollLeft: container.scrollLeft,
            startScrollTop: container.scrollTop
        };

        // Change cursor to panning cursor
        container.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        // Add panning class to body for global panning state
        document.body.classList.add('panning-mode');

        Logger.ui.debug(`ScrollUtils: Scrolling started on ${container.tagName}#${container.id || container.className}`);
    }

    static updateScrolling(container, config, e) {
        if (!config) return;

        const deltaX = (e.clientX - config.startX) * config.sensitivity;
        const deltaY = (e.clientY - config.startY) * config.sensitivity;

        // Apply scrolling with bounds
        if (config.horizontal) {
            const newScrollLeft = config.startScrollLeft - deltaX;
            container.scrollLeft = Math.max(0, Math.min(
                newScrollLeft,
                container.scrollWidth - container.clientWidth
            ));
        }

        if (config.vertical) {
            const newScrollTop = config.startScrollTop - deltaY;
            container.scrollTop = Math.max(0, Math.min(
                newScrollTop,
                container.scrollHeight - container.clientHeight
            ));
        }
    }

    static stopScrolling(container, config) {
        if (!container) return;

        // Restore cursor
        container.style.cursor = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Remove panning class from body
        document.body.classList.remove('panning-mode');

        this.currentSession = null;

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

    /**
     * Remove scrolling handlers from one container
     * @param {HTMLElement} container - Container to cleanup
     */
    static removeScrolling(container) {
        this.activeContainers.delete(container);

        if (this.currentSession && this.currentSession.container === container) {
            this.stopScrolling(container, this.currentSession);
        }
    }

    /**
     * Cleanup all ScrollUtils handlers
     */
    static cleanup() {
        this.activeContainers.clear();
        this.currentSession = null;

        if (this.globalMouseDownHandler) {
            document.removeEventListener('mousedown', this.globalMouseDownHandler, { capture: true });
            this.globalMouseDownHandler = null;
        }

        if (this.globalMouseMoveHandler) {
            document.removeEventListener('mousemove', this.globalMouseMoveHandler);
            this.globalMouseMoveHandler = null;
        }

        if (this.globalMouseUpHandler) {
            document.removeEventListener('mouseup', this.globalMouseUpHandler);
            this.globalMouseUpHandler = null;
        }

        if (this.globalBlurHandler) {
            window.removeEventListener('blur', this.globalBlurHandler);
            this.globalBlurHandler = null;
        }

        this.isGlobalHandlersSetup = false;
    }
}
