import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { Logger } from '../utils/Logger.js';
import { renderMenuItemIconHtml } from '../utils/MenuItemTemplateUtils.js';

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
 * - Responsiveness optimization
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

export class BaseContextMenu {
    // Constants for menu positioning and animation
    static CURSOR_MENU_MARGIN = 2;        // pixels from cursor to menu edge
    static MENU_VIEWPORT_MARGIN = 20;     // pixels from viewport edge
    static ANIMATION_DURATION = 150;      // ms for hide animation

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
        
        // Store context data for menu item handlers
        this.lastContextData = null;

        // Persistent close-on-leave watcher (document mousemove), set up per-menu by
        // setupMenuClosing() and torn down by removeMenuCloseWatcher()
        this._menuCloseWatcher = null;

        Logger.ui.debug('BaseContextMenu: Constructor called for panel', panel);
        this.setupContextMenu();
        
        // Only setup global handlers if not disabled
        if (!callbacks.disableGlobalHandlers) {
            this.setupGlobalRightClickHandler();
        }
        
        this.setupWindowResizeHandler();
        this.setupCursorTracking();

        Logger.ui.info(`${this.constructor.name} initialized successfully for panel:`, this.panel);
    }

    /**
     * Check if any marquee selection is currently active
     * @returns {boolean} - True if marquee is active
     */
    isMarqueeActive() {
        const stateManager = window.editor?.stateManager;
        if (!stateManager) return false;

        // Check all possible marquee systems
        const marqueeKeys = [
            'mouse.isMarqueeSelecting',
            'mouse.isAssetMarqueeSelecting',
            'mouse.isOutlinerMarqueeSelecting',
            'mouse.isLayerMarqueeSelecting'
        ];

        // Check boolean flags for all marquee systems
        for (const key of marqueeKeys) {
            if (stateManager.get(key) === true) {
                return true;
            }
        }

        // Check for marquee element existence
        if (stateManager.get('marquee.element')) {
            return true;
        }

        // Check for canvas marquee rect
        if (stateManager.get('mouse.marqueeRect')) {
            return true;
        }

        return false;
    }

    /**
     * Current cursor-to-menu forgiveness margin (px), read live from StateManager (user setting
     * 'ui.cursorMenuMargin') so it can change while a menu is open. Falls back to the static
     * default when StateManager/the setting is unavailable (e.g. early boot). Number() rather
     * than a strict typeof check since range-input-synced values can arrive as strings.
     * @returns {number}
     */
    getCursorMenuMargin() {
        const stateManager = window.editor?.stateManager;
        const num = Number(stateManager?.get('ui.cursorMenuMargin'));
        return Number.isFinite(num) ? num : BaseContextMenu.CURSOR_MENU_MARGIN;
    }

    /**
     * Clear all active marquee selections
     */
    clearMarqueeSelections() {
        const stateManager = window.editor?.stateManager;
        if (!stateManager) return;

        // Aggressively clear ALL marquee-related state
        const marqueeKeys = [
            'mouse.isAssetMarqueeSelecting',
            'mouse.isOutlinerMarqueeSelecting',
            'mouse.isLayerMarqueeSelecting',
            'marquee.startPos',
            'marquee.element',
            'marquee.container',
            'marquee.options',
            'marquee.mode',
            'marquee.pendingStartPos',
            'marquee.pendingMode',
            'marquee.pendingOptions',
            'marquee.pendingContainer',
            'marquee.pendingSelector',
            'marquee.pendingMouseKey',
            'mouse.isMarqueeSelecting',
            'mouse.marqueeRect',
            'mouse.marqueeStartX',
            'mouse.marqueeStartY'
        ];

        for (const key of marqueeKeys) {
            stateManager.set(key, null);
        }

        // Remove marquee element if it exists
        const marqueeElement = stateManager.get('marquee.element');
        if (marqueeElement && marqueeElement.parentNode) {
            marqueeElement.parentNode.removeChild(marqueeElement);
        }

        // Clear selections in panels
        const panels = ['assetPanel', 'outlinerPanel', 'layersPanel'];
        for (const panelName of panels) {
            const panel = window.editor?.[panelName];
            if (panel && typeof panel.clearSelection === 'function') {
                panel.clearSelection();
            }
        }

        // Fallback: clear canvas selection. The set() below already synchronously triggers
        // a render via the 'selectedObjects' subscriber — no separate render() call needed.
        stateManager.set('selectedObjects', new Set());
        window.editor?.updateAllPanels?.();
    }

    /**
     * Setup global handler to cancel marquee selection on any mouse button except left
     */
    setupGlobalRightClickHandler() {
        // Use a static property to ensure only one global handler exists
        if (!BaseContextMenu.globalRightClickHandler) {
            BaseContextMenu.globalRightClickHandler = (e) => {
                // Cancel marquee on any button except left mouse button (which creates marquee)
                if (e.button === 0) return;

                // Check if marquee is active
                if (this.isMarqueeActive()) {
                    // Cancel marquee selection
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();

                    // Clear all marquee selections
                    this.clearMarqueeSelections();

                    Logger.ui.info('Marquee selection cancelled by global right-click');
                }
            };

            // Add multiple global handlers for maximum coverage

            // 1. Context menu handler (capture phase, highest priority)
            document.addEventListener('contextmenu', BaseContextMenu.globalRightClickHandler, { capture: true, passive: false });

            // 2. Mouse down handler as backup (catches any button except left)
            document.addEventListener('mousedown', (e) => {
                if (e.button !== 0) { // Any button except left
                    BaseContextMenu.globalRightClickHandler(e);
                }
            }, { capture: true, passive: false });

            // 3. Window-level handler as last resort
            window.addEventListener('contextmenu', (e) => {
                if (e.type === 'contextmenu' && e.button !== undefined && e.button !== 0) {
                    BaseContextMenu.globalRightClickHandler(e);
                }
            }, { capture: true, passive: false });
        }
    }

    /**
     * Initialize context menu functionality
     * Sets up event listeners and menu creation
     */
    setupContextMenu() {
        // Remove existing context menu handler if it exists
        if (this.contextMenuHandler) {
            Logger.ui.debug('BaseContextMenu: Removing existing context menu handler from', this.panel);
            this.panel.removeEventListener('contextmenu', this.contextMenuHandler);
        }
        
        // Add context menu to panel
        this.contextMenuHandler = (e) => {
            // Note: Marquee cancellation is now handled globally by setupGlobalRightClickHandler
            // This local handler only shows context menu when marquee is not active

            // Extract context data from clicked element
            const contextData = this.extractContextData(e.target);
            this.showContextMenu(e, contextData);
        };

        Logger.ui.debug('BaseContextMenu: Adding context menu handler to', this.panel);
        this.panel.addEventListener('contextmenu', this.contextMenuHandler);
    }

    /**
     * Setup window resize handler to reposition menu if needed
     */
    setupWindowResizeHandler() {
        this.resizeHandler = () => {
            if (this.currentMenu) {
                this.repositionMenuWithinViewport(this.currentMenu);
            }
            // No need to re-initialize context menu handlers - DOM elements are not recreated on resize
        };

        window.addEventListener('resize', this.resizeHandler, { passive: true });
    }

    /**
     * Clamp an already-open menu back into the viewport after a window resize,
     * instead of closing it (menu uses position: fixed, so rect is viewport-relative)
     * @param {HTMLElement} menu - The context menu element
     */
    repositionMenuWithinViewport(menu) {
        const margin = BaseContextMenu.MENU_VIEWPORT_MARGIN;
        const rect = menu.getBoundingClientRect();

        let left = rect.left;
        let top = rect.top;

        if (left + rect.width > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - rect.width - margin);
        }
        if (top + rect.height > window.innerHeight - margin) {
            top = Math.max(margin, window.innerHeight - rect.height - margin);
        }

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    /**
     * Setup global mousemove handler to track cursor position in real-time
     */
    setupCursorTracking() {
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
        // Hide existing menu with proper cleanup (without animation for responsiveness)
        if (this.currentMenu) {
            // Stop the previous menu's close watcher
            this.removeMenuCloseWatcher();

            // Remove event handlers using new system
            eventHandlerManager.unregisterContainer(this.currentMenu);

            // Remove from DOM immediately for responsiveness
            if (this.currentMenu.parentNode) {
                this.currentMenu.parentNode.removeChild(this.currentMenu);
            }
            this.currentMenu = null;
            this.isVisible = false;
            this.callbacks.onMenuHide();
        }

        // Store cursor position for animation end checks
        this.lastCursorX = event.clientX;
        this.lastCursorY = event.clientY;

        // Store context data for menu item handlers
        this.lastContextData = contextData;

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

        // Ensure cursor is inside menu bounds by adjusting menu position if needed
        const cursorOffset = this.ensureCursorInsideMenu(event, optimalPosition, contextMenu);
        if (cursorOffset.x !== 0 || cursorOffset.y !== 0) {
            contextMenu.style.left = (optimalPosition.x + cursorOffset.x) + 'px';
            contextMenu.style.top = (optimalPosition.y + cursorOffset.y) + 'px';
        }

        // Setup new event handlers
        this.setupNewEventHandlers();

        // Trigger show animation
        requestAnimationFrame(() => {
            contextMenu.classList.add('show');
        });

        // Setup persistent, margin-aware close-on-leave for the whole lifetime of the menu
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
     * Find a menu item config by id, searching recursively inside submenu items too
     * @param {string} id - Menu item id
     * @param {Array} items - Items to search (defaults to top-level this.menuItems)
     * @returns {Object|null}
     */
    findMenuItemById(id, items = this.menuItems) {
        for (const item of items) {
            if (item.id === id) return item;
            if (item.type === 'submenu' && Array.isArray(item.items)) {
                const found = this.findMenuItemById(id, item.items);
                if (found) return found;
            }
        }
        return null;
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
        // Handle separator — same markup as MenuManager.createSeparator() (nav dropdowns),
        // so a separator looks identical whichever menu system renders it.
        if (item.type === 'separator') {
            const separator = document.createElement('div');
            separator.className = 'border-t border-gray-600 my-1';
            if (item.className) {
                separator.classList.add(item.className);
            }
            return separator;
        }

        // Handle flyout submenu
        if (item.type === 'submenu') {
            return this.createSubmenuItem(item, contextData);
        }

        const menuItem = document.createElement('div');
        // px-4 py-2 text-sm hover:bg-gray-700 mirror MenuManager's 'action' item template
        // (config/menu.js) exactly, so padding/font-size/hover feedback can't drift between
        // the nav dropdowns and context menus again — see styles/base-context-menu.css for
        // what `.base-context-menu-item` still owns on top (color var, cursor, transitions).
        menuItem.className = 'base-context-menu-item px-4 py-2 text-sm hover:bg-gray-700';

        // Add data attribute for menu item identification
        menuItem.dataset.menuItemId = item.id;

        // Handle dynamic text (function) or static text (string)
        const displayText = typeof item.text === 'function' ? item.text(contextData) : item.text;
        // Shared with MenuManager.js via MenuItemTemplateUtils so icon markup/spacing is
        // identical in both menu systems.
        const iconHtml = renderMenuItemIconHtml(item.icon);
        menuItem.innerHTML = `${iconHtml}${displayText}`;

        // Check if item should be disabled
        let isDisabled = false;
        if (typeof item.disabled === 'function') {
            isDisabled = item.disabled(contextData);
        } else if (item.disabled === true) {
            isDisabled = true;
        }

        // Matches MenuManager's disabled-state scheme (src/managers/MenuManager.js
        // createMenuItem()/refreshDisabledStates()); `.disabled` is kept too for its muted
        // text color, which the bare Tailwind utility classes don't provide on their own.
        if (isDisabled) {
            menuItem.classList.add('disabled', 'opacity-50', 'pointer-events-none', 'cursor-not-allowed');
        }
        menuItem.dataset.menuDisabled = isDisabled ? 'true' : 'false';

        // Event handlers are now managed by EventHandlerManager

        return menuItem;
    }

    /**
     * Create a flyout submenu entry: a hoverable row that expands a nested menu
     * to the side, containing its own items (built recursively via createMenuItem).
     * Reusable by any BaseContextMenu subclass via addSubmenuItem().
     * @param {Object} item - Submenu item config ({ id, text, icon, items, disabled })
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - Submenu wrapper element
     */
    createSubmenuItem(item, contextData) {
        const wrapper = document.createElement('div');
        wrapper.className = 'base-context-menu-submenu-wrapper';

        let isDisabled = false;
        if (typeof item.disabled === 'function') {
            isDisabled = item.disabled(contextData);
        } else if (item.disabled === true) {
            isDisabled = true;
        }

        const trigger = document.createElement('div');
        // Same utility classes as createMenuItem() plus MenuManager.createSubmenuItem()'s
        // own trigger template ('flex items-center justify-between ... cursor-pointer') so
        // the row and its arrow indicator match the nav menu's flyout trigger exactly.
        trigger.className = 'base-context-menu-item has-submenu px-4 py-2 text-sm hover:bg-gray-700 flex items-center justify-between';
        trigger.dataset.menuItemId = item.id;
        const displayText = typeof item.text === 'function' ? item.text(contextData) : item.text;
        // Icon shares MenuItemTemplateUtils with createMenuItem() above. Icon is intentionally
        // kept here even though MenuManager's own createSubmenuItem() has no icon slot at all
        // on its trigger — that's an absent capability there, not one that was stripped for
        // convergence, so existing submenu icons (e.g. Add's ➕) must stay. The label+icon are
        // wrapped in their own span so `justify-between` can push the arrow to the right, same
        // structure as MenuManager.createSubmenuItem()'s trigger.
        const iconHtml = renderMenuItemIconHtml(item.icon);
        trigger.innerHTML = `<span style="display:inline-flex;align-items:center;">${iconHtml}${displayText}</span><span class="text-xs ml-4">▸</span>`;
        if (isDisabled) {
            trigger.classList.add('disabled', 'opacity-50', 'pointer-events-none', 'cursor-not-allowed');
        }
        trigger.dataset.menuDisabled = isDisabled ? 'true' : 'false';
        wrapper.appendChild(trigger);

        const submenu = document.createElement('div');
        // Only the deepest flyout in a chain (no nested submenu inside it) gets the scrollable
        // max-height treatment (CSS: styles/base-context-menu.css). A flyout that itself
        // contains a nested submenu must stay overflow:visible, otherwise its child flyout
        // gets clipped to this box regardless of which element is its own positioning
        // ancestor — this is what previously broke the Assets-panel Add -> category -> type
        // third level. Works at any nesting depth since it's recomputed per invocation.
        const hasNestedSubmenu = (item.items || []).some(subItem => subItem.type === 'submenu');
        submenu.className = 'base-context-menu submenu-flyout' + (hasNestedSubmenu ? '' : ' submenu-flyout--scrollable');
        (item.items || []).forEach(subItem => {
            if (this.shouldShowMenuItem(subItem, contextData)) {
                submenu.appendChild(this.createMenuItem(subItem, contextData));
            }
        });
        wrapper.appendChild(submenu);

        if (!isDisabled) {
            wrapper.addEventListener('mouseenter', () => submenu.classList.add('show'));
            wrapper.addEventListener('mouseleave', (e) => {
                if (!wrapper.contains(e.relatedTarget)) submenu.classList.remove('show');
            });
        }

        return wrapper;
    }

    /**
     * Add a flyout submenu entry (category header expanding into nested items)
     * @param {string} text - Trigger text
     * @param {string} icon - Trigger icon (optional)
     * @param {Array<Object>} items - Nested item configs (same shape as addMenuItem entries)
     * @param {Object} options - { id, visible, disabled }
     */
    addSubmenuItem(text, icon, items, options = {}) {
        this.menuItems.push({
            type: 'submenu',
            text,
            icon,
            items,
            visible: options.visible,
            disabled: options.disabled,
            id: options.id || (typeof text === 'string' ? text.toLowerCase().replace(/\s+/g, '-') : 'dynamic-submenu')
        });
    }

    /**
     * Handle menu item click
     * @param {Object|HTMLElement} item - Menu item (object with action or DOM element)
     * @param {Object} contextData - Context data
     * @returns {*} - Result of the action (if any)
     */
    handleMenuItemClick(item, contextData) {
        let result;
        let menuItem = item;

        Logger.ui.debug('BaseContextMenu: handleMenuItemClick called', { item, contextData });

        // Handle DOM element case - find corresponding menu item object (searches nested submenus too)
        if (item && item.nodeType === Node.ELEMENT_NODE) {
            const menuItemId = item.dataset.menuItemId;
            menuItem = this.findMenuItemById(menuItemId);
            Logger.ui.debug('BaseContextMenu: Found menu item', { menuItemId, menuItem });
        }

        // Submenu triggers only open on hover; a direct click has no action and must not close the menu
        if (menuItem && menuItem.type === 'submenu') {
            this.callbacks.onItemClick(menuItem, contextData);
            return false;
        }

        // Execute action if available
        if (menuItem && menuItem.action) {
            Logger.ui.debug('BaseContextMenu: Executing action', menuItem.action);
            result = menuItem.action(contextData);
        }

        // Call callback with menu item object
        this.callbacks.onItemClick(menuItem || item, contextData);

        Logger.ui.debug('BaseContextMenu: handleMenuItemClick result', result);
        return result;
    }

    /**
     * Check if cursor is inside menu bounds (within the configurable forgiveness margin,
     * see getCursorMenuMargin()) — including any currently-open flyout submenu at any
     * nesting depth, since those render outside the parent menu's own visual box
     * (CSS: .submenu-flyout, position:absolute; left:100%) but must still count as "inside"
     * while the user is hovering them.
     * @param {HTMLElement} menu - The context menu element
     * @returns {boolean} - True if cursor is inside menu (or an open submenu) bounds
     */
    isCursorInsideMenu(menu) {
        const cursorX = this.lastCursorX || 0;
        const cursorY = this.lastCursorY || 0;
        const margin = this.getCursorMenuMargin();

        const isInsideRect = (rect) =>
            cursorX >= rect.left - margin &&
            cursorX <= rect.right + margin &&
            cursorY >= rect.top - margin &&
            cursorY <= rect.bottom + margin;

        if (isInsideRect(menu.getBoundingClientRect())) return true;

        const openFlyouts = menu.querySelectorAll('.submenu-flyout.show');
        for (const flyout of openFlyouts) {
            if (isInsideRect(flyout.getBoundingClientRect())) return true;
        }
        return false;
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
            id: options.id || (typeof text === 'string' ? text.toLowerCase().replace(/\s+/g, '-') : 'dynamic-item')
        });
    }

    /**
     * Add separator
     * @param {string} className - Optional CSS class name for the separator
     */
    addSeparator(className) {
        this.menuItems.push({
            type: 'separator',
            visible: true,
            className: className
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
        
        const margin = BaseContextMenu.MENU_VIEWPORT_MARGIN;
        
        let x = event.pageX;
        let y = event.pageY;
        
        // Determine optimal horizontal position
        const spaceRight = viewport.width - event.pageX;
        const spaceLeft = event.pageX;
        
        if (spaceRight >= menuSize.width + margin) {
            x = event.pageX;
        } else if (spaceLeft >= menuSize.width + margin) {
            x = event.pageX - menuSize.width;
        } else {
            x = Math.max(margin,
                       Math.min(event.pageX - menuSize.width / 2,
                               viewport.width - menuSize.width - margin));
        }
        
        // Determine optimal vertical position
        const spaceBelow = viewport.height - event.pageY;
        const spaceAbove = event.pageY;
        
        if (spaceBelow >= menuSize.height + margin) {
            y = event.pageY;
        } else if (spaceAbove >= menuSize.height + margin) {
            y = event.pageY - menuSize.height;
        } else {
            y = Math.max(margin,
                        Math.min(event.pageY - menuSize.height / 2,
                                viewport.height - menuSize.height - margin));
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
        const panelMargin = 5; // Margin from panel edges
        if (x < panelBounds.left) {
            x = panelBounds.left + panelMargin;
        }
        if (x + menuSize.width > panelBounds.right) {
            x = panelBounds.right - menuSize.width - panelMargin;
        }
        if (y < panelBounds.top) {
            y = panelBounds.top + panelMargin;
        }
        if (y + menuSize.height > panelBounds.bottom) {
            y = panelBounds.bottom - menuSize.height - panelMargin;
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
     * Setup persistent, margin-aware close-on-leave for the whole lifetime of the menu.
     *
     * Previously this attached a native `mouseleave` listener (gated behind a
     * `window.eventHandlerManager.initialized` check that was always false, since the
     * real singleton is only exported as a module import, never attached to `window` —
     * so the fallback always ran anyway). Native mouseleave fires the instant the cursor
     * crosses the element's exact DOM edge with zero tolerance, so getCursorMenuMargin()/
     * ui.cursorMenuMargin had no real effect once the opening animation finished. This
     * mirrors MenuPositioningUtils.setupMenuClosing()'s approach (tracks real cursor
     * coordinates, not DOM enter/leave events) but adds the configurable margin via
     * isCursorInsideMenu(), which also accounts for open flyout submenus.
     * @param {HTMLElement} menu - The context menu element
     */
    setupMenuClosing(menu) {
        this.removeMenuCloseWatcher();

        const onMouseMove = () => {
            if (!this.isCursorInsideMenu(menu)) {
                this.hideMenu();
            }
        };
        document.addEventListener('mousemove', onMouseMove);
        this._menuCloseWatcher = onMouseMove;

        const closeOnClick = (e) => {
            // Close menu when clicking outside or on menu items
            if (e.target === menu || e.target.closest('.base-context-menu-item')) {
                this.hideMenu();
            }
        };
        menu.addEventListener('click', closeOnClick);
    }

    /**
     * Tear down the persistent close watcher started by setupMenuClosing(). Must run
     * before the menu element is discarded/replaced — it's a `document`-level listener,
     * so it isn't garbage-collected along with the menu element the way element-scoped
     * listeners are.
     */
    removeMenuCloseWatcher() {
        if (this._menuCloseWatcher) {
            document.removeEventListener('mousemove', this._menuCloseWatcher);
            this._menuCloseWatcher = null;
        }
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

        const margin = this.getCursorMenuMargin();

        // Adjust horizontal position if cursor is outside menu bounds
        if (cursorX < rect.left) {
            offsetX = cursorX - rect.left - margin;
        } else if (cursorX > rect.right) {
            offsetX = cursorX - rect.right + margin;
        }

        // Adjust vertical position if cursor is outside menu bounds
        if (cursorY < rect.top) {
            offsetY = cursorY - rect.top - margin;
        } else if (cursorY > rect.bottom) {
            offsetY = cursorY - rect.bottom + margin;
        }

        return { x: offsetX, y: offsetY };
    }


    /**
     * Setup new event handlers using EventHandlerManager
     */
    setupNewEventHandlers() {
        if (!this.currentMenu) {
            Logger.ui.warn('BaseContextMenu: Current menu not found');
            return;
        }

        // Generate unique ID for the menu
        const menuId = `context-menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.currentMenu.id = menuId;

        // Create context menu handlers configuration using new system
        const contextMenuHandlers = EventHandlerUtils.createContextMenuHandlers(
            (e) => {
                Logger.ui.debug('BaseContextMenu: Click event received', e.target);
                
                // Handle menu item clicks
                const menuItem = e.target.closest('.base-context-menu-item');
                Logger.ui.debug('BaseContextMenu: Found menu item element', menuItem);
                
                if (menuItem && !menuItem.classList.contains('disabled')) {
                    Logger.ui.debug('BaseContextMenu: Processing menu item click', { menuItem, contextData: this.lastContextData });
                    const result = this.handleMenuItemClick(menuItem, this.lastContextData);
                    if (result !== false) {
                        this.hideMenu();
                    }
                } else {
                    Logger.ui.debug('BaseContextMenu: Menu item not found or disabled', { menuItem, disabled: menuItem?.classList.contains('disabled') });
                }
            },
            () => {
                // Close menu handler
                this.hideMenu();
            }
        );

        // Register context menu with new event manager
        eventHandlerManager.registerContainer(this.currentMenu, contextMenuHandlers);

        Logger.ui.debug('BaseContextMenu: New event handlers setup complete');
    }

    /**
     * Hide context menu
     */
    hideMenu() {
        // Stop the persistent close watcher first so further mousemove events (e.g. during
        // the fade-out below) can't re-trigger hideMenu() on the same menu
        this.removeMenuCloseWatcher();

        if (this.currentMenu) {
            // Remove event handlers using new system
            eventHandlerManager.unregisterContainer(this.currentMenu);

            // Check if menu is still in DOM
            if (this.currentMenu.parentNode) {
                this.currentMenu.classList.remove('show');

                // Wait for animation to complete before removing
                setTimeout(() => {
                    if (this.currentMenu && this.currentMenu.parentNode) {
                        this.currentMenu.parentNode.removeChild(this.currentMenu);
                    }
                    this.currentMenu = null;
                    this.isVisible = false;
                    this.callbacks.onMenuHide();
                }, BaseContextMenu.ANIMATION_DURATION);
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
        Logger.ui.debug('BaseContextMenu: Destroying context menu for', this.panel);
        this.hideMenu();
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.contextMenuHandler) {
            Logger.ui.debug('BaseContextMenu: Removing context menu handler from', this.panel);
            this.panel.removeEventListener('contextmenu', this.contextMenuHandler);
        }
        this.removeCursorTracking();
    }
}

