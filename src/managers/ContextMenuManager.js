/**
 * ContextMenuManager - Centralized manager for all context menus
 *
 * Provides centralized control over all context menus in the application.
 * Ensures that only one context menu is active at a time by automatically
 * closing all other menus when a new one is opened.
 *
 * Features:
 * - Centralized menu management
 * - Automatic cleanup of conflicting menus
 * - Registration system for new menus
 * - Global context menu blocking
 *
 * Usage:
 * ```javascript
 * const contextMenuManager = new ContextMenuManager();
 *
 * // Register a menu
 * contextMenuManager.registerMenu('canvas', canvasContextMenu);
 *
 * // When showing a menu, it will automatically close others
 * contextMenuManager.showMenu('canvas');
 * ```
 *
 * @author Level Designer
 * @version dynamic
 */

export class ContextMenuManager {
    constructor() {
        this.activeMenus = new Map(); // name -> menu instance
        this.currentActiveMenu = null;

        // Global context menu blocker and closer
        this.setupGlobalContextMenuBlocker();

        // Debug logging removed - use Logger.js instead
    }

    /**
     * Setup global context menu blocker and closer for the entire document
     */
    setupGlobalContextMenuBlocker() {
        document.addEventListener('contextmenu', (e) => {
            // Check if any custom menu handled this event
            if (!e.defaultPrevented) {
                // No custom menu handled this event - close all active menus
                if (this.hasActiveMenu()) {
                    // Debug logging removed - use Logger.js instead
                    this.closeAllMenus();
                }

                // Block the default browser context menu
                e.preventDefault();
                // Debug logging removed - use Logger.js instead
            }
        }, { passive: false });
    }

    /**
     * Register a context menu instance
     * @param {string} name - Unique name for the menu
     * @param {Object} menuInstance - Context menu instance
     */
    registerMenu(name, menuInstance) {
        if (this.activeMenus.has(name)) {
            // Debug logging removed - use Logger.js instead
        }

        this.activeMenus.set(name, menuInstance);
        // Debug logging removed - use Logger.js instead
    }

    /**
     * Unregister a context menu
     * @param {string} name - Name of the menu to unregister
     */
    unregisterMenu(name) {
        if (this.activeMenus.has(name)) {
            // Close the menu if it's currently active
            if (this.currentActiveMenu === name) {
                this.closeCurrentMenu();
            }

            this.activeMenus.delete(name);
            // Debug logging removed - use Logger.js instead
        }
    }

    /**
     * Show a specific menu, closing all others except menus of the same type
     * @param {string} menuName - Name of the menu to show
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Additional context data
     */
    showMenu(menuName, event, contextData = {}) {
        // Debug logging removed - use Logger.js instead

        // Check if the requested menu is already active
        const isSameMenuType = this.currentActiveMenu === menuName;

        if (!isSameMenuType) {
            // Close all menus except the same type (which would be none in this case)
            this.closeAllMenus(null);
        } else {
            // Same menu type is already active - we can either:
            // 1. Do nothing (leave menu as is)
            // 2. Move menu to new cursor position
            // For now, let's move it to new position for better UX
            // Debug logging removed - use Logger.js instead
        }

        // Find and show the requested menu
        const menuInstance = this.activeMenus.get(menuName);
        if (menuInstance) {
            // Check if this is a ConsoleContextMenu (has different showContextMenu signature)
            if (menuName === 'console' && typeof menuInstance.showContextMenu === 'function') {
                // ConsoleContextMenu signature: showContextMenu(event, message, timestamp)
                const { message, timestamp } = contextData;
                menuInstance.showContextMenu(event, message || '', timestamp || '');
            }
            // For BaseContextMenu instances and other menus
            else if (typeof menuInstance.showContextMenu === 'function') {
                menuInstance.showContextMenu(event, contextData);
            }

            this.currentActiveMenu = menuName;
            // Debug logging removed - use Logger.js instead
        } else {
            // Debug logging removed - use Logger.js instead
        }
    }

    /**
     * Close a specific menu
     * @param {string} menuName - Name of the menu to close
     */
    closeMenu(menuName) {
        const menuInstance = this.activeMenus.get(menuName);
        if (menuInstance) {
            // Try different close methods depending on menu type
            if (typeof menuInstance.hideMenu === 'function') {
                // BaseContextMenu style
                menuInstance.hideMenu();
            } else if (typeof menuInstance.removeMenu === 'function') {
                // ConsoleContextMenu style
                if (menuInstance.currentMenu) {
                    menuInstance.removeMenu(menuInstance.currentMenu);
                }
            } else if (typeof menuInstance.removeExistingMenu === 'function') {
                // Alternative ConsoleContextMenu style
                menuInstance.removeExistingMenu();
            }

            if (this.currentActiveMenu === menuName) {
                this.currentActiveMenu = null;
            }

            // Debug logging removed - use Logger.js instead
        }
    }

    /**
     * Close the currently active menu
     */
    closeCurrentMenu() {
        if (this.currentActiveMenu) {
            this.closeMenu(this.currentActiveMenu);
        }
    }

    /**
     * Close all registered menus except optionally specified type
     * @param {string} exceptMenuName - Name of menu type to keep open (optional)
     */
    closeAllMenus(exceptMenuName = null) {
        // Debug logging removed - use Logger.js instead

        // Close the current active menu first (unless it's the excepted one)
        if (this.currentActiveMenu && this.currentActiveMenu !== exceptMenuName) {
            this.closeMenu(this.currentActiveMenu);
        }

        // Also try to close any other menus that might be open
        for (const [menuName, menuInstance] of this.activeMenus) {
            if (menuName !== exceptMenuName) {
                this.closeMenu(menuName);
            }
        }

        // If we have an excepted menu, keep it as current, otherwise clear
        if (exceptMenuName && this.activeMenus.has(exceptMenuName)) {
            this.currentActiveMenu = exceptMenuName;
        } else {
            this.currentActiveMenu = null;
        }
    }

    /**
     * Get the currently active menu name
     * @returns {string|null} - Name of active menu or null
     */
    getCurrentActiveMenu() {
        return this.currentActiveMenu;
    }

    /**
     * Check if any menu is currently active
     * @returns {boolean} - Whether any menu is active
     */
    hasActiveMenu() {
        return this.currentActiveMenu !== null;
    }

    /**
     * Get all registered menu names
     * @returns {Array<string>} - Array of registered menu names
     */
    getRegisteredMenus() {
        return Array.from(this.activeMenus.keys());
    }

    /**
     * Destroy the manager and clean up
     */
    destroy() {
        this.closeAllMenus();
        this.activeMenus.clear();
        this.currentActiveMenu = null;
        // Debug logging removed - use Logger.js instead
    }
}
