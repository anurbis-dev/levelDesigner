/**
 * BasePanel - Base class for editor panels
 * 
 * Provides common functionality for all editor panels including:
 * - Middle mouse button scrolling
 * - Minimal scrollbar styles
 * - Common event handling patterns
 * 
 * @author Level Designer
 * @version 3.13.0
 */

import { Logger } from '../utils/Logger.js';
import { ScrollUtils } from '../utils/ScrollUtils.js';

export class BasePanel {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.scrollContainer = null;
    }

    /**
     * Setup scrolling for the panel
     * @param {Object} options - Scroll options
     * @param {boolean} options.horizontal - Enable horizontal scrolling
     * @param {boolean} options.vertical - Enable vertical scrolling
     * @param {number} options.sensitivity - Scroll sensitivity
     * @param {HTMLElement} options.target - Specific container to scroll (optional)
     */
    setupScrolling(options = {}) {
        const config = {
            horizontal: options.horizontal !== false,
            vertical: options.vertical !== false,
            sensitivity: options.sensitivity || 1.0,
            target: options.target || this.getScrollContainer()
        };

        if (!config.target) {
            Logger.ui.warn('BasePanel: No scroll container found');
            return;
        }

        // Setup middle mouse scrolling
        ScrollUtils.setupMiddleMouseScrolling(config.target, {
            horizontal: config.horizontal,
            vertical: config.vertical,
            sensitivity: config.sensitivity
        });

        // Add minimal scrollbar styles
        ScrollUtils.addMinimalScrollbarStyles(config.target);

        Logger.ui.debug(`BasePanel: Scrolling setup for ${this.constructor.name}`);
    }

    /**
     * Get the scrollable container for this panel
     * Override in subclasses to specify custom container
     * @returns {HTMLElement|null} - The scrollable container
     */
    getScrollContainer() {
        // Default: try to find a container with overflow
        const scrollable = this.container.querySelector('[class*="overflow"]');
        if (scrollable) {
            return scrollable;
        }

        // Fallback: use the panel container itself
        return this.container;
    }

    /**
     * Setup minimal scrollbar styles with thin appearance
     * @param {HTMLElement} container - Container to style
     */
    setupThinScrollbars(container) {
        if (!container) return;

        const style = document.createElement('style');
        style.textContent = `
            .thin-scrollbar::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            
            .thin-scrollbar::-webkit-scrollbar-track {
                background: #374151;
                border-radius: 3px;
            }
            
            .thin-scrollbar::-webkit-scrollbar-thumb {
                background: #6B7280;
                border-radius: 3px;
                border: none;
            }
            
            .thin-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #9CA3AF;
            }
            
            .thin-scrollbar::-webkit-scrollbar-corner {
                background: #374151;
            }
            
            /* Firefox */
            .thin-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: #6B7280 #374151;
            }
        `;
        
        // Only add style once
        if (!document.querySelector('#thin-scrollbar-styles')) {
            style.id = 'thin-scrollbar-styles';
            document.head.appendChild(style);
        }

        container.classList.add('thin-scrollbar');
    }
}
