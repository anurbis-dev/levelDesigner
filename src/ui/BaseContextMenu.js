/**
 * BaseContextMenu - Base class for context menus
 * 
 * Provides universal functionality for creating context menus
 * in various editor panels. Inherited by specialized classes
 * for specific panels.
 * 
 * Features:
 * - Smart menu positioning
 * - Smooth show/hide animations
 * - Browser context menu blocking
 * - Support for different menu item types
 * - Responsiveness and mobile optimization
 * 
 * Usage:
 * ```javascript
 * class MyPanelContextMenu extends BaseContextMenu {
 *     constructor(panel, callbacks) {
 *         super(panel, callbacks);
 *         this.setupMenuItems();
 *     }
 *     
 *     setupMenuItems() {
 *         this.addMenuItem('Copy', '📋', () => this.copy());
 *         this.addMenuItem('Delete', '🗑️', () => this.delete());
 *     }
 * }
 * ```
 * 
 * @author Level Designer
 * @version dynamic
 */

import { Logger } from '../utils/Logger.js';

export class BaseContextMenu {
    constructor(panel, callbacks = {}) {
        this.panel = panel;
        this.callbacks = {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            ...callbacks
        };
        
        this.currentMenu = null;
        this.menuItems = [];
        this.isVisible = false;
        
        this.setupContextMenu();
        this.setupWindowResizeHandler();
        
        Logger.ui.info(`${this.constructor.name} initialized successfully`);
    }

    /**
     * Initialize context menu functionality
     * Sets up event listeners and menu creation
     */
    setupContextMenu() {
        // Add context menu to panel
        this.panel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Extract context data from clicked element
            const contextData = this.extractContextData(e.target);
            this.showContextMenu(e, contextData);
        });
    }

    /**
     * Setup window resize handler to reposition menu if needed
     */
    setupWindowResizeHandler() {
        this.resizeHandler = () => {
            if (this.currentMenu) {
                this.hideMenu();
            }
        };
        
        window.addEventListener('resize', this.resizeHandler, { passive: true });
    }

    /**
     * Extract context data from clicked element
     * Override in subclasses for specific data extraction
     * @param {Element} target - The clicked element
     * @returns {Object} - Context data
     */
    extractContextData(target) {
        return {
            element: target,
            text: target.textContent || '',
            id: target.id || '',
            className: target.className || ''
        };
    }

    /**
     * Show context menu at specified position
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data from clicked element
     */
    showContextMenu(event, contextData) {
        // Hide existing menu
        this.hideMenu();

        // Create new context menu
        const contextMenu = this.createContextMenu(event, contextData);
        
        // Add to document first (hidden)
        document.body.appendChild(contextMenu);
        this.currentMenu = contextMenu;
        this.isVisible = true;
        
        // Calculate optimal position after menu is in DOM
        const optimalPosition = this.calculateOptimalPosition(event, contextMenu);
        contextMenu.style.left = optimalPosition.x + 'px';
        contextMenu.style.top = optimalPosition.y + 'px';
        
        // Add positioning classes for better animation
        this.addPositioningClasses(contextMenu, event, optimalPosition);
        
        // Trigger animation
        requestAnimationFrame(() => {
            contextMenu.classList.add('show');
        });

        // Setup menu closing
        this.setupMenuClosing(contextMenu);
        
        // Notify callback
        this.callbacks.onMenuShow(contextData);
    }

    /**
     * Create context menu element with appropriate items
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - The context menu element
     */
    createContextMenu(event, contextData) {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'base-context-menu';
        
        // Add menu items
        this.menuItems.forEach(item => {
            if (this.shouldShowMenuItem(item, contextData)) {
                const menuItem = this.createMenuItem(item, contextData);
                contextMenu.appendChild(menuItem);
            }
        });

        return contextMenu;
    }

    /**
     * Determine if menu item should be shown
     * Override in subclasses for custom logic
     * @param {Object} item - Menu item
     * @param {Object} contextData - Context data
     * @returns {boolean} - Whether to show the item
     */
    shouldShowMenuItem(item, contextData) {
        if (typeof item.visible === 'function') {
            return item.visible(contextData);
        }
        return item.visible !== false;
    }

    /**
     * Create a menu item element
     * @param {Object} item - Menu item configuration
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - The menu item element
     */
    createMenuItem(item, contextData) {
        const menuItem = document.createElement('div');
        menuItem.className = 'base-context-menu-item';
        menuItem.innerHTML = `${item.icon ? item.icon + ' ' : ''}${item.text}`;
        
        if (item.disabled) {
            menuItem.classList.add('disabled');
        }
        
        menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!item.disabled) {
                this.handleMenuItemClick(item, contextData);
                this.hideMenu();
            }
        });
        
        return menuItem;
    }

    /**
     * Handle menu item click
     * @param {Object} item - Menu item
     * @param {Object} contextData - Context data
     */
    handleMenuItemClick(item, contextData) {
        if (item.action) {
            item.action(contextData);
        }
        this.callbacks.onItemClick(item, contextData);
    }

    /**
     * Add menu item
     * @param {string} text - Item text
     * @param {string} icon - Item icon (optional)
     * @param {Function} action - Click action
     * @param {Object} options - Additional options
     */
    addMenuItem(text, icon, action, options = {}) {
        this.menuItems.push({
            text,
            icon,
            action,
            visible: options.visible,
            disabled: options.disabled,
            id: options.id || text.toLowerCase().replace(/\s+/g, '-')
        });
    }

    /**
     * Add separator
     */
    addSeparator() {
        this.menuItems.push({
            type: 'separator',
            visible: true
        });
    }

    /**
     * Calculate optimal position for context menu
     * @param {Event} event - The context menu event
     * @param {HTMLElement} menu - The context menu element
     * @returns {Object} - Object with x and y coordinates
     */
    calculateOptimalPosition(event, menu) {
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Get actual menu dimensions
        const menuSize = this.getMenuDimensions(menu);
        
        const margins = {
            horizontal: 20,
            vertical: 20
        };
        
        let x = event.pageX;
        let y = event.pageY;
        
        // Determine optimal horizontal position
        const spaceRight = viewport.width - event.pageX;
        const spaceLeft = event.pageX;
        
        if (spaceRight >= menuSize.width + margins.horizontal) {
            x = event.pageX;
        } else if (spaceLeft >= menuSize.width + margins.horizontal) {
            x = event.pageX - menuSize.width;
        } else {
            x = Math.max(margins.horizontal, 
                       Math.min(event.pageX - menuSize.width / 2, 
                               viewport.width - menuSize.width - margins.horizontal));
        }
        
        // Determine optimal vertical position
        const spaceBelow = viewport.height - event.pageY;
        const spaceAbove = event.pageY;
        
        if (spaceBelow >= menuSize.height + margins.vertical) {
            y = event.pageY;
        } else if (spaceAbove >= menuSize.height + margins.vertical) {
            y = event.pageY - menuSize.height;
        } else {
            y = Math.max(margins.vertical,
                        Math.min(event.pageY - menuSize.height / 2,
                                viewport.height - menuSize.height - margins.vertical));
        }
        
        // Ensure menu stays within panel bounds when possible
        const panelRect = this.panel.getBoundingClientRect();
        const panelBounds = {
            left: panelRect.left,
            right: panelRect.right,
            top: panelRect.top,
            bottom: panelRect.bottom
        };
        
        // Adjust position to stay within panel when possible
        if (x < panelBounds.left) {
            x = panelBounds.left + 5;
        }
        if (x + menuSize.width > panelBounds.right) {
            x = panelBounds.right - menuSize.width - 5;
        }
        if (y < panelBounds.top) {
            y = panelBounds.top + 5;
        }
        if (y + menuSize.height > panelBounds.bottom) {
            y = panelBounds.bottom - menuSize.height - 5;
        }
        
        return { x, y };
    }

    /**
     * Get actual menu dimensions
     * @param {HTMLElement} menu - The context menu element
     * @returns {Object} - Object with width and height
     */
    getMenuDimensions(menu) {
        const rect = menu.getBoundingClientRect();
        return {
            width: rect.width || 200,
            height: rect.height || 150
        };
    }

    /**
     * Add positioning classes for better animation
     * @param {HTMLElement} menu - The context menu element
     * @param {Event} event - The context menu event
     * @param {Object} position - The calculated position
     */
    addPositioningClasses(menu, event, position) {
        // Determine horizontal positioning
        if (position.x < event.pageX) {
            menu.classList.add('positioned-left');
        } else {
            menu.classList.add('positioned-right');
        }
        
        // Determine vertical positioning
        if (position.y < event.pageY) {
            menu.classList.add('positioned-above');
        } else {
            menu.classList.add('positioned-below');
        }
    }

    /**
     * Setup menu closing behavior
     * @param {HTMLElement} menu - The context menu element
     */
    setupMenuClosing(menu) {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                this.hideMenu();
                document.removeEventListener('click', closeMenu);
            }
        };

        // Close menu after a short delay to allow click events to register
        setTimeout(() => {
            document.addEventListener('click', closeMenu, { passive: true });
        }, 100);
    }

    /**
     * Hide context menu
     */
    hideMenu() {
        if (this.currentMenu) {
            this.currentMenu.classList.remove('show');
            // Wait for animation to complete before removing
            setTimeout(() => {
                if (this.currentMenu && this.currentMenu.parentNode) {
                    this.currentMenu.parentNode.removeChild(this.currentMenu);
                }
                this.currentMenu = null;
                this.isVisible = false;
                this.callbacks.onMenuHide();
            }, 150);
        }
    }

    /**
     * Check if menu is currently visible
     * @returns {boolean} - Whether menu is visible
     */
    isMenuVisible() {
        return this.isVisible;
    }

    /**
     * Update menu items
     * @param {Array} items - New menu items
     */
    updateMenuItems(items) {
        this.menuItems = items;
    }

    /**
     * Clear all menu items
     */
    clearMenuItems() {
        this.menuItems = [];
    }

    /**
     * Destroy context menu and clean up event listeners
     */
    destroy() {
        this.hideMenu();
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
    }
}

