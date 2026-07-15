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
        // Ensure panning cursor styles exist even without per-panel setupScrolling().
        this.ensurePanningStyles();
        Logger.ui.debug('ScrollUtils: Universal middle-mouse panning enabled');
    }

    /** Default / clamp for ui.scrollbarSize (px). No browser-enforced 6px floor in our CSS. */
    static SCROLLBAR_SIZE_MIN = 1;
    static SCROLLBAR_SIZE_MAX = 24;
    static SCROLLBAR_SIZE_DEFAULT = 2;

    /**
     * Clamp and apply scrollbar thickness globally.
     * Chromium: pure ::-webkit-scrollbar + !important (never set scrollbar-width/color —
     * those switch Chrome to the standard scrollbar path at ~system/8px thickness).
     * Firefox: only scrollbar-width thin|auto (no px API).
     * @param {number|string} sizePx
     * @returns {number} applied size
     */
    static applyScrollbarSize(sizePx) {
        let n = parseFloat(sizePx);
        if (Number.isNaN(n)) n = this.SCROLLBAR_SIZE_DEFAULT;
        n = Math.max(this.SCROLLBAR_SIZE_MIN, Math.min(this.SCROLLBAR_SIZE_MAX, Math.round(n)));

        document.documentElement.style.setProperty('--ui-scrollbar-size', `${n}px`);
        document.documentElement.style.setProperty('--ui-scrollbar-radius', `${Math.max(1, Math.round(n / 2))}px`);
        this.ensureScrollbarStyles(n);
        return n;
    }

    /**
     * Authoritative scrollbar stylesheet (re-written on size change, last in cascade).
     * @param {number} sizePx
     */
    static ensureScrollbarStyles(sizePx = this.SCROLLBAR_SIZE_DEFAULT) {
        let style = document.querySelector('#ui-scrollbar-runtime-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'ui-scrollbar-runtime-styles';
            document.head.appendChild(style);
        }

        // Keep at end of <head> so we beat spacing-mode / panels / injected remnants.
        document.head.appendChild(style);

        const track = 'var(--ui-scrollbar-track, #374151)';
        const thumb = 'var(--ui-scrollbar-thumb, #6B7280)';
        const thumbHover = 'var(--ui-scrollbar-thumb-hover, #9CA3AF)';
        const radius = 'var(--ui-scrollbar-radius, 1px)';

        style.textContent = `
            /* Runtime scrollbar size — no min floor; size from --ui-scrollbar-size / settings */
            html {
                --ui-scrollbar-size: ${sizePx}px;
            }

            html *::-webkit-scrollbar {
                width: ${sizePx}px !important;
                height: ${sizePx}px !important;
            }

            html *::-webkit-scrollbar-track {
                background: ${track} !important;
                border-radius: ${radius} !important;
            }

            html *::-webkit-scrollbar-thumb {
                background: ${thumb} !important;
                border-radius: ${radius} !important;
                border: none !important;
                min-height: 0 !important;
                min-width: 0 !important;
            }

            html *::-webkit-scrollbar-thumb:hover {
                background: ${thumbHover} !important;
            }

            html *::-webkit-scrollbar-corner {
                background: ${track} !important;
            }

            /* Explicit hide (toolbar / tab strips) — must win over the global size rule */
            .horizontal-scroll-container::-webkit-scrollbar,
            .toolbar-scroll::-webkit-scrollbar,
            .scrollbar-hide::-webkit-scrollbar {
                display: none !important;
                width: 0 !important;
                height: 0 !important;
            }

            .horizontal-scroll-container,
            .toolbar-scroll,
            .scrollbar-hide {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
            }

            /* Firefox only: no custom px width — thin if user size ≤6, else auto */
            @supports not selector(::-webkit-scrollbar) {
                html * {
                    scrollbar-width: ${sizePx <= 6 ? 'thin' : 'auto'};
                    scrollbar-color: ${thumb} ${track};
                }
                .horizontal-scroll-container,
                .toolbar-scroll,
                .scrollbar-hide {
                    scrollbar-width: none !important;
                }
            }
        `;
    }

    /**
     * Inject once: panning cursor / hover-lock rules.
     * Scrollbar thickness: applyScrollbarSize / ensureScrollbarStyles (not here).
     */
    static ensurePanningStyles() {
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--ui-scrollbar-size');
        const parsed = parseFloat(raw);
        this.ensureScrollbarStyles(Number.isFinite(parsed) ? parsed : this.SCROLLBAR_SIZE_DEFAULT);

        if (document.querySelector('#minimal-scrollbar-styles')) return;

        const style = document.createElement('style');
        style.id = 'minimal-scrollbar-styles';
        style.textContent = `
            /* Do NOT set scrollbar-color/width on .minimal-scrollbar — Chrome thickens bars. */

            /* During middle-pan / viewport gesture: no hover on any UI (incl. other dock windows).
               pointer-events only on descendants — body stays hit-testable so mouseup works. */
            body.panning-mode {
                user-select: none !important;
                cursor: grabbing !important;
            }

            body.panning-mode * {
                cursor: grabbing !important;
                pointer-events: none !important;
            }

            /* Viewport object drag / marquee / transform / cam pan-zoom outside leaf */
            body.viewport-gesture-mode {
                user-select: none !important;
            }

            body.viewport-gesture-mode * {
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
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

        // Drop hover under cursor before locking pointer-events (needs hit-test still live).
        this.clearActiveHovers(e.clientX, e.clientY);

        // Change cursor to panning cursor
        container.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        // Locks hover on all UI (incl. other dock windows) while middle-pan is active.
        document.body.classList.add('panning-mode');

        Logger.ui.debug(`ScrollUtils: Scrolling started on ${container.tagName}#${container.id || container.className}`);
    }

    /**
     * Clear stuck hover styles on elements under the cursor when pan starts.
     * @param {number} x
     * @param {number} y
     */
    static clearActiveHovers(x, y) {
        let node = null;
        try {
            const stack = document.elementsFromPoint?.(x, y) || [];
            for (const el of stack) {
                if (el instanceof HTMLElement) {
                    node = el;
                    break;
                }
            }
        } catch (_) {
            node = null;
        }

        // Walk ancestors and restore common HoverEffects inline marks.
        while (node && node !== document.body) {
            if (node._originalStyles) {
                node.style.filter = node._originalStyles.filter || '';
                node.style.backgroundColor = node._originalStyles.backgroundColor || '';
                node.style.borderColor = node._originalStyles.borderColor || '';
            } else if (node.style?.filter?.includes('brightness')) {
                node.style.filter = '';
            }
            node = node.parentElement;
        }
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
     * Thin scrollbar styles on a panel overflow container (both axes).
     * Middle-mouse drag remains the primary pan interaction.
     * @param {HTMLElement} container - The container to style
     */
    static addMinimalScrollbarStyles(container) {
        if (!container) return;
        this.ensurePanningStyles();
        container.classList.add('minimal-scrollbar', 'panel-scroll-region');
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
