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
        this.contextMenuHandler = null;

        // Store cursor position for animation end checks
        this.lastCursorX = 0;
        this.lastCursorY = 0;

        // Animation monitoring
        this.monitoringAnimationFrame = null;
        this.isMonitoringCursor = false;
        this.animationStartTime = 0;

        this.setupContextMenu();
        this.setupWindowResizeHandler();
        this.setupCursorTracking();

        Logger.ui.info(`${this.constructor.name} initialized successfully`);
    }

    /**
     * Initialize context menu functionality
     * Sets up event listeners and menu creation
     */
    setupContextMenu() {
        // Remove existing context menu handler if it exists
        if (this.contextMenuHandler) {
            this.panel.removeEventListener('contextmenu', this.contextMenuHandler);
        }
        
        // Add context menu to panel
        this.contextMenuHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Extract context data from clicked element
            const contextData = this.extractContextData(e.target);
            this.showContextMenu(e, contextData);
        };
        
        this.panel.addEventListener('contextmenu', this.contextMenuHandler);
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
     * Setup global mousemove handler to track cursor position in real-time
     */
    setupCursorTracking() {
        if (this.cursorTrackingHandler) {
            document.removeEventListener('mousemove', this.cursorTrackingHandler);
        }

        this.cursorTrackingHandler = (e) => {
            this.lastCursorX = e.clientX;
            this.lastCursorY = e.clientY;
        };

        document.addEventListener('mousemove', this.cursorTrackingHandler, { passive: true });
    }

    /**
     * Remove cursor tracking handler
     */
    removeCursorTracking() {
        if (this.cursorTrackingHandler) {
            document.removeEventListener('mousemove', this.cursorTrackingHandler);
            this.cursorTrackingHandler = null;
        }
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
        // Hide existing menu immediately (without animation for responsiveness)
        if (this.currentMenu) {
            if (this.currentMenu.parentNode) {
                this.currentMenu.parentNode.removeChild(this.currentMenu);
            }
            this.currentMenu = null;
            this.isVisible = false;
        }

        // Store cursor position for animation end checks
        this.lastCursorX = event.clientX;
        this.lastCursorY = event.clientY;

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

        // Adjust cursor position to be inside menu bounds (3px offset)
        this.adjustCursorPosition(event, optimalPosition, contextMenu);

        // Add positioning classes for better animation
        this.addPositioningClasses(contextMenu, event, optimalPosition);

        // Ensure cursor is inside menu bounds by adjusting menu position if needed
        const cursorOffset = this.ensureCursorInsideMenu(event, optimalPosition, contextMenu);
        if (cursorOffset.x !== 0 || cursorOffset.y !== 0) {
            contextMenu.style.left = (optimalPosition.x + cursorOffset.x) + 'px';
            contextMenu.style.top = (optimalPosition.y + cursorOffset.y) + 'px';
        }

        // Trigger animation and start cursor monitoring
        requestAnimationFrame(() => {
            contextMenu.classList.add('show');
            // Start continuous cursor monitoring during animation
            this.startCursorMonitoring(contextMenu);
        });

        // Setup menu closing on mouse leave
        this.setupMenuClosing(contextMenu);

        // Setup animation end handler to check cursor position
        this.setupAnimationEndHandler(contextMenu);

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
                const result = this.handleMenuItemClick(item, contextData);
                // Only hide menu if action doesn't return false
                if (result !== false) {
                    this.hideMenu();
                }
            }
        });
        
        return menuItem;
    }

    /**
     * Handle menu item click
     * @param {Object} item - Menu item
     * @param {Object} contextData - Context data
     * @returns {*} - Result of the action (if any)
     */
    handleMenuItemClick(item, contextData) {
        let result;
        if (item.action) {
            result = item.action(contextData);
        }
        this.callbacks.onItemClick(item, contextData);
        return result;
    }

    /**
     * Check if cursor is inside menu bounds
     * @param {HTMLElement} menu - The context menu element
     * @returns {boolean} - True if cursor is inside menu bounds
     */
    isCursorInsideMenu(menu) {
        if (!menu) return false;

        const rect = menu.getBoundingClientRect();
        const cursorX = this.lastCursorX || 0;
        const cursorY = this.lastCursorY || 0;

        return cursorX >= rect.left - 2 &&
               cursorX <= rect.right + 2 &&
               cursorY >= rect.top - 2 &&
               cursorY <= rect.bottom + 2;
    }

    /**
     * Handle animation end event - check cursor position and close menu if needed
     * @param {Event} event - The transitionend event
     */
    handleAnimationEnd(event) {
        // Only handle transitionend for our menu element
        if (event.target !== this.currentMenu) return;

        // Stop cursor monitoring since animation is complete
        this.stopCursorMonitoring();


        // Update cursor position from event if available, otherwise use stored position
        if (event.clientX !== undefined && event.clientY !== undefined) {
            this.lastCursorX = event.clientX;
            this.lastCursorY = event.clientY;
        }

        // Check if cursor is still inside menu after animation
        if (!this.isCursorInsideMenu(this.currentMenu)) {
            this.hideMenu();
            return;
        }

    }

    /**
     * Start continuous cursor position monitoring during animation
     * @param {HTMLElement} menu - The context menu element
     */
    startCursorMonitoring(menu) {
        if (this.isMonitoringCursor) {
            this.stopCursorMonitoring();
        }

        this.isMonitoringCursor = true;
        this.animationStartTime = Date.now();

        // Start monitoring loop
        this.monitorCursorPosition(menu);
    }

    /**
     * Stop cursor position monitoring
     */
    stopCursorMonitoring() {
        if (this.monitoringAnimationFrame) {
            cancelAnimationFrame(this.monitoringAnimationFrame);
            this.monitoringAnimationFrame = null;
        }
        this.isMonitoringCursor = false;
    }

    /**
     * Monitor cursor position during animation and close menu if cursor leaves bounds
     * @param {HTMLElement} menu - The context menu element
     */
    monitorCursorPosition(menu) {
        if (!this.isMonitoringCursor || !menu || !menu.parentNode) {
            return;
        }

        // Check if animation duration exceeded (fallback timeout)
        const elapsed = Date.now() - this.animationStartTime;
        if (elapsed > 200) { // 200ms timeout (slightly longer than animation)
            this.stopCursorMonitoring();
            return;
        }

        // Get current cursor position
        const cursorX = this.lastCursorX;
        const cursorY = this.lastCursorY;

        // Check if cursor is inside menu bounds
        const rect = menu.getBoundingClientRect();
        const isInside = cursorX >= rect.left - 2 &&
                        cursorX <= rect.right + 2 &&
                        cursorY >= rect.top - 2 &&
                        cursorY <= rect.bottom + 2;

        if (!isInside) {
            this.stopCursorMonitoring();
            this.hideMenu();
            return;
        }

        // Continue monitoring
        this.monitoringAnimationFrame = requestAnimationFrame(() => {
            this.monitorCursorPosition(menu);
        });
    }

    /**
     * Setup animation end handler to check cursor position after animation completes
     * @param {HTMLElement} menu - The context menu element
     */
    setupAnimationEndHandler(menu) {
        // Remove existing handler if any
        if (this.animationEndHandler) {
            menu.removeEventListener('transitionend', this.animationEndHandler);
        }

        // Create new handler
        this.animationEndHandler = this.handleAnimationEnd.bind(this);

        // Add handler for animation completion
        menu.addEventListener('transitionend', this.animationEndHandler, { once: true });
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
     * Setup menu closing behavior on mouse leave
     * @param {HTMLElement} menu - The context menu element
     */
    setupMenuClosing(menu) {
        const closeMenu = () => {
            // Close menu when mouse leaves its area
            this.hideMenu();
        };

        // Close menu when mouse leaves the menu area
        menu.addEventListener('mouseleave', closeMenu);

        // Also close on click for better UX
        const closeOnClick = () => {
            this.hideMenu();
        };
        menu.addEventListener('click', closeOnClick);

        // Store references for cleanup
        menu._closeMenuHandler = closeMenu;
        menu._closeOnClickHandler = closeOnClick;
    }

    /**
     * Ensure cursor is inside menu bounds by adjusting menu position if needed
     * @param {Event} event - The context menu event
     * @param {Object} menuPosition - Current menu position
     * @param {HTMLElement} menu - The context menu element
     * @returns {Object} - Offset to apply to menu position
     */
    ensureCursorInsideMenu(event, menuPosition, menu) {
        const rect = menu.getBoundingClientRect();

        // Use stored cursor position for consistency, fallback to event
        const cursorX = this.lastCursorX || event.clientX;
        const cursorY = this.lastCursorY || event.clientY;

        let offsetX = 0;
        let offsetY = 0;

        // Check if cursor is to the left of menu (cursor left of menu's left edge)
        if (cursorX < rect.left) {
            // Move menu left so cursor ends up 2px inside from the left edge
            // New menu left = current menu left + offsetX
            // We want: cursorX = newMenuLeft + 2
            // So: newMenuLeft = cursorX - 2
            // Therefore: offsetX = (cursorX - 2) - rect.left = cursorX - rect.left - 2
            offsetX = cursorX - rect.left - 2;
        }
        // Check if cursor is to the right of menu (cursor right of menu's right edge)
        else if (cursorX > rect.right) {
            // Move menu right so cursor ends up 2px inside from the right edge
            // New menu right = current menu right + offsetX
            // We want: cursorX = newMenuRight - 2
            // So: newMenuRight = cursorX + 2
            // Since newMenuRight = rect.right + offsetX, then:
            // offsetX = (cursorX + 2) - rect.right = cursorX - rect.right + 2
            offsetX = cursorX - rect.right + 2;
        }

        // Check if cursor is above menu (cursor above menu's top edge)
        if (cursorY < rect.top) {
            // Move menu up so cursor ends up 2px inside from the top edge
            // New menu top = current menu top + offsetY
            // We want: cursorY = newMenuTop + 2
            // So: newMenuTop = cursorY - 2
            // Therefore: offsetY = (cursorY - 2) - rect.top = cursorY - rect.top - 2
            offsetY = cursorY - rect.top - 2;
        }
        // Check if cursor is below menu (cursor below menu's bottom edge)
        else if (cursorY > rect.bottom) {
            // Move menu down so cursor ends up 2px inside from the bottom edge
            // New menu bottom = current menu bottom + offsetY
            // We want: cursorY = newMenuBottom - 2
            // So: newMenuBottom = cursorY + 2
            // Since newMenuBottom = rect.bottom + offsetY, then:
            // offsetY = (cursorY + 2) - rect.bottom = cursorY - rect.bottom + 2
            offsetY = cursorY - rect.bottom + 2;
        }


        return { x: offsetX, y: offsetY };
    }

    /**
     * Adjust cursor position to be inside menu bounds (legacy method)
     * @param {Event} event - The context menu event
     * @param {Object} menuPosition - Menu position
     * @param {HTMLElement} menu - The context menu element
     */
    adjustCursorPosition(event, menuPosition, menu) {
        // This method is now handled by ensureCursorInsideMenu
        // Kept for backward compatibility
    }

    /**
     * Hide context menu
     */
    hideMenu() {
        // Stop cursor monitoring if active
        this.stopCursorMonitoring();

        if (this.currentMenu) {
            // Remove cursor tracking if this is the last menu
            // Note: We keep cursor tracking active as it might be needed by other components
            // Check if menu is still in DOM
            if (this.currentMenu.parentNode) {
                this.currentMenu.classList.remove('show');

                // Clean up event listeners
                if (this.currentMenu._closeMenuHandler) {
                    this.currentMenu.removeEventListener('mouseleave', this.currentMenu._closeMenuHandler);
                }
                if (this.currentMenu._closeOnClickHandler) {
                    this.currentMenu.removeEventListener('click', this.currentMenu._closeOnClickHandler);
                }
                if (this.animationEndHandler) {
                    this.currentMenu.removeEventListener('transitionend', this.animationEndHandler);
                    this.animationEndHandler = null;
                }

                // Wait for animation to complete before removing
                setTimeout(() => {
                    if (this.currentMenu && this.currentMenu.parentNode) {
                        this.currentMenu.parentNode.removeChild(this.currentMenu);
                    }
                    this.currentMenu = null;
                    this.isVisible = false;
                    this.callbacks.onMenuHide();
                }, 150);
            } else {
                // Menu already removed, just clean up state
                this.currentMenu = null;
                this.isVisible = false;
                this.callbacks.onMenuHide();
            }
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
        if (this.contextMenuHandler) {
            this.panel.removeEventListener('contextmenu', this.contextMenuHandler);
        }
        this.removeCursorTracking();
    }
}

