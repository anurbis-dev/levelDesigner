import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { Logger } from '../utils/Logger.js';

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
    static MONITORING_TIMEOUT = 200;      // ms max for cursor monitoring

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

        // Animation monitoring
        this.monitoringAnimationFrame = null;
        this.isMonitoringCursor = false;
        this.animationStartTime = 0;

        console.log('BaseContextMenu: Constructor called for panel', panel);
        this.setupContextMenu();
        this.setupGlobalRightClickHandler();
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

        // Fallback: clear canvas selection
        stateManager.set('selectedObjects', new Set());
        window.editor?.updateAllPanels?.();

        // Force re-render
        if (window.editor?.render) {
            window.editor.render();
        }
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
            console.log('BaseContextMenu: Removing existing context menu handler from', this.panel);
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

        console.log('BaseContextMenu: Adding context menu handler to', this.panel);
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
            // No need to re-initialize context menu handlers - DOM elements are not recreated on resize
        };

        window.addEventListener('resize', this.resizeHandler, { passive: true });
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
            // Stop cursor monitoring if active
            this.stopCursorMonitoring();

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

        // Trigger animation and start cursor monitoring
        requestAnimationFrame(() => {
            contextMenu.classList.add('show');

            // For canvas context menu, skip cursor monitoring as it's not needed
            if (this.constructor.name !== 'CanvasContextMenu') {
                // Start continuous cursor monitoring during animation
                this.startCursorMonitoring(contextMenu);
            }
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
        // Handle separator
        if (item.type === 'separator') {
            const separator = document.createElement('div');
            separator.className = 'base-context-menu-item separator';
            if (item.className) {
                separator.classList.add(item.className);
            }
            return separator;
        }
        
        const menuItem = document.createElement('div');
        menuItem.className = 'base-context-menu-item';
        
        // Add data attribute for menu item identification
        menuItem.dataset.menuItemId = item.id;
        
        // Handle dynamic text (function) or static text (string)
        const displayText = typeof item.text === 'function' ? item.text(contextData) : item.text;
        menuItem.innerHTML = `${item.icon ? item.icon + ' ' : ''}${displayText}`;
        
        // Check if item should be disabled
        let isDisabled = false;
        if (typeof item.disabled === 'function') {
            isDisabled = item.disabled(contextData);
        } else if (item.disabled === true) {
            isDisabled = true;
        }
        
        if (isDisabled) {
            menuItem.classList.add('disabled');
        }
        
        // Event handlers are now managed by EventHandlerManager
        
        return menuItem;
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

        // Handle DOM element case - find corresponding menu item object
        if (item && item.nodeType === Node.ELEMENT_NODE) {
            const menuItemId = item.dataset.menuItemId;
            menuItem = this.menuItems.find(mi => mi.id === menuItemId);
            Logger.ui.debug('BaseContextMenu: Found menu item', { menuItemId, menuItem });
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
     * Check if cursor is inside menu bounds
     * @param {HTMLElement} menu - The context menu element
     * @returns {boolean} - True if cursor is inside menu bounds
     */
    isCursorInsideMenu(menu) {
        const rect = menu.getBoundingClientRect();
        const cursorX = this.lastCursorX || 0;
        const cursorY = this.lastCursorY || 0;

        const margin = BaseContextMenu.CURSOR_MENU_MARGIN;
        return cursorX >= rect.left - margin &&
               cursorX <= rect.right + margin &&
               cursorY >= rect.top - margin &&
               cursorY <= rect.bottom + margin;
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
        if (elapsed > BaseContextMenu.MONITORING_TIMEOUT) { // Timeout for cursor monitoring
            this.stopCursorMonitoring();
            return;
        }

        // Get current cursor position
        const cursorX = this.lastCursorX;
        const cursorY = this.lastCursorY;

        // Check if cursor is inside menu bounds
        const isInside = this.isCursorInsideMenu(menu);

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
     * Setup menu closing behavior on mouse leave
     * @param {HTMLElement} menu - The context menu element
     */
    setupMenuClosing(menu) {
        const closeMenu = () => {
            // Close menu when mouse leaves its area
            this.hideMenu();
        };

            const closeOnClick = (e) => {
                // Close menu when clicking outside or on menu items
                if (e.target === menu || e.target.closest('.base-context-menu-item')) {
                    this.hideMenu();
                }
            };

        // Store handler references for cleanup
        menu._closeMenuHandler = closeMenu;
        menu._closeOnClickHandler = closeOnClick;

        // Check if using new event system
        if (window.eventHandlerManager && window.eventHandlerManager.initialized) {
            // New system handles mouse events
            Logger.ui.debug('BaseContextMenu: Using new event system mouse leave handling');
        } else {
            // Manual registration for fallback mode
            menu.addEventListener('mouseleave', closeMenu);
            menu.addEventListener('click', closeOnClick);
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

        const margin = BaseContextMenu.CURSOR_MENU_MARGIN;

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
        // Stop cursor monitoring if active
        this.stopCursorMonitoring();

        if (this.currentMenu) {
            // Remove event handlers using new system
            eventHandlerManager.unregisterContainer(this.currentMenu);

            // Check if menu is still in DOM
            if (this.currentMenu.parentNode) {
                this.currentMenu.classList.remove('show');

                // Legacy event listeners are cleaned up above in the main cleanup section
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
        console.log('BaseContextMenu: Destroying context menu for', this.panel);
        this.hideMenu();
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.contextMenuHandler) {
            console.log('BaseContextMenu: Removing context menu handler from', this.panel);
            this.panel.removeEventListener('contextmenu', this.contextMenuHandler);
        }
        this.removeCursorTracking();
    }
}

