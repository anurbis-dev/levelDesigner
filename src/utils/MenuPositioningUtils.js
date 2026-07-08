/**
 * MenuPositioningUtils - Utility for consistent menu positioning across UI components
 * 
 * Provides standardized methods for positioning dropdown menus, context menus,
 * and other popup elements with proper viewport boundary checking.
 * 
 * @author Level Designer
 * @version dynamic
 */

import { Logger } from './Logger.js';

export class MenuPositioningUtils {

    // Fallback cursor-to-menu forgiveness margin (px), mirrors BaseContextMenu.CURSOR_MENU_MARGIN.
    // Kept as a separate copy rather than a cross-import since BaseContextMenu's getter is an
    // instance method tied to its own class hierarchy — see getCursorMenuMargin() below.
    static CURSOR_MENU_MARGIN = 2;

    /**
     * Current cursor-to-menu forgiveness margin (px), read live from StateManager (user setting
     * 'ui.cursorMenuMargin') so it can change while a menu is open. Number() rather than a strict
     * typeof check since range-input-synced values can arrive as strings.
     * @returns {number}
     */
    static getCursorMenuMargin() {
        const stateManager = window.editor?.stateManager;
        const num = Number(stateManager?.get('ui.cursorMenuMargin'));
        return Number.isFinite(num) ? num : this.CURSOR_MENU_MARGIN;
    }

    /**
     * Standard CSS classes for popup menus
     */
    static get MENU_CLASSES() {
        return 'fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg';
    }
    
    /**
     * Standard CSS classes for menu items
     */
    static get MENU_ITEM_CLASSES() {
        return 'flex items-center p-2 hover:bg-gray-700 cursor-pointer text-sm';
    }
    
    /**
     * Calculate optimal position for a menu relative to a trigger element
     * @param {HTMLElement} triggerElement - Element that triggered the menu
     * @param {Object} options - Positioning options
     * @param {number} options.menuWidth - Expected menu width (default: 192)
     * @param {number} options.menuHeight - Expected menu height (default: 200)
     * @param {string} options.alignment - 'left', 'right', 'center' (default: 'right')
     * @param {string} options.direction - 'below', 'above' (default: 'below')
     * @param {number} options.offset - Distance from trigger element (default: 4)
     * @returns {Object} - Object with x, y coordinates
     */
    static calculateMenuPosition(triggerElement, options = {}) {
        const {
            menuWidth = 192,
            menuHeight = 200,
            alignment = 'right',
            direction = 'below',
            offset = 4
        } = options;
        
        const triggerRect = triggerElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 10;
        
        let x, y;
        
        // Calculate horizontal position based on alignment
        switch (alignment) {
            case 'left':
                x = triggerRect.left;
                break;
            case 'right':
                x = triggerRect.right - menuWidth;
                break;
            case 'center':
                x = triggerRect.left + (triggerRect.width - menuWidth) / 2;
                break;
            default:
                x = triggerRect.right - menuWidth;
        }
        
        // Calculate vertical position based on direction
        if (direction === 'below') {
            y = triggerRect.bottom + offset;
        } else {
            y = triggerRect.top - menuHeight - offset;
        }
        
        // Ensure menu stays within viewport bounds
        x = Math.max(margin, Math.min(x, viewportWidth - menuWidth - margin));
        y = Math.max(margin, Math.min(y, viewportHeight - menuHeight - margin));
        
        // If menu would go off-screen vertically, flip direction
        if (direction === 'below' && y + menuHeight > viewportHeight - margin) {
            y = triggerRect.top - menuHeight - offset;
        } else if (direction === 'above' && y < margin) {
            y = triggerRect.bottom + offset;
        }
        
        return { x, y };
    }
    
    /**
     * Create a standard popup menu element
     * @param {Object} options - Menu options
     * @param {string} options.className - Additional CSS classes
     * @param {string} options.minWidth - Minimum width (default: 'min-w-48')
     * @returns {HTMLElement} - Menu element
     */
    static createMenuElement(options = {}) {
        const {
            className = '',
            minWidth = 'min-w-48'
        } = options;
        
        const menu = document.createElement('div');
        menu.className = `${this.MENU_CLASSES} ${minWidth} ${className}`.trim();
        
        return menu;
    }
    
    /**
     * Create a standard menu item element
     * @param {Object} options - Menu item options
     * @param {string} options.text - Item text
     * @param {string} options.icon - Optional icon HTML
     * @param {boolean} options.checked - Whether item is checked (for checkboxes)
     * @param {string} options.className - Additional CSS classes
     * @returns {HTMLElement} - Menu item element
     */
    static createMenuItem(options = {}) {
        const {
            text,
            icon = '',
            checked = false,
            className = ''
        } = options;
        
        const item = document.createElement('div');
        item.className = `${this.MENU_ITEM_CLASSES} ${className}`.trim();
        item.style.color = 'var(--ui-text-color, #d1d5db)';
        
        if (checked !== undefined) {
            // Checkbox item
            item.innerHTML = `
                <input type="checkbox" id="menu-checkbox-${text.replace(/\s+/g, '-').toLowerCase()}" class="mr-2" ${checked ? 'checked' : ''}>
                <label>${icon}${text}</label>
            `;
        } else {
            // Regular item
            item.innerHTML = `${icon}${text}`;
        }
        
        return item;
    }
    
    /**
     * Setup menu closing behavior.
     *
     * The menu is positioned right below the trigger button (see calculateMenuPosition),
     * so the cursor is on the BUTTON — not the menu — at the moment the menu opens. Native
     * mouseleave can't detect that: it only fires once the browser has first seen the cursor
     * enter the element, so a menu the cursor never actually hovers into never gets a leave
     * event either, and stays open forever until an unrelated click. Tracking real cursor
     * coordinates on document 'mousemove' against the button+menu rects sidesteps that: it
     * doesn't care where the cursor started, only whether it's currently over either rect.
     * @param {HTMLElement} menu - Menu element
     * @param {HTMLElement} triggerElement - Element that triggered the menu
     * @returns {Function} - Cleanup function to remove event listeners
     */
    static setupMenuClosing(menu, triggerElement) {
        const buttonRect = triggerElement.getBoundingClientRect();
        const isInside = (x, y, rect, margin) =>
            x >= rect.left - margin && x <= rect.right + margin &&
            y >= rect.top - margin && y <= rect.bottom + margin;

        const closeMenu = () => {
            document.removeEventListener('mousemove', onMouseMove);
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
            // Lets callers (e.g. OutlinerPanel's Ctrl-hold filter gesture) hook cleanup to the
            // menu actually closing, regardless of which path (leave vs. click) triggered it.
            menu.dispatchEvent(new CustomEvent('menuclose'));
        };

        const onMouseMove = (e) => {
            const margin = this.getCursorMenuMargin();
            const menuRect = menu.getBoundingClientRect();
            if (!isInside(e.clientX, e.clientY, buttonRect, margin) && !isInside(e.clientX, e.clientY, menuRect, margin)) {
                closeMenu();
            }
        };
        document.addEventListener('mousemove', onMouseMove);

        // Also close on click for better UX (BaseContextMenu logic)
        const closeOnClick = () => {
            closeMenu();
        };
        menu.addEventListener('click', closeOnClick);

        // Store references for cleanup (BaseContextMenu pattern)
        menu._closeMenuHandler = closeMenu;
        menu._closeOnClickHandler = closeOnClick;

        // Return cleanup function
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            if (menu._closeOnClickHandler) {
                menu.removeEventListener('click', menu._closeOnClickHandler);
            }
        };
    }
    
    /**
     * Get object types from level objects (standardized logic)
     * @param {Array} objects - Array of game objects
     * @returns {Set} - Set of unique object types
     */
    static getObjectTypes(objects) {
        const types = new Set();
        objects.forEach(obj => {
            const type = obj.type === 'group' ? 'Groups' : obj.type || 'Untyped';
            types.add(type);
        });
        return types;
    }
    
    /**
     * Position and show a menu
     * @param {HTMLElement} menu - Menu element
     * @param {HTMLElement} triggerElement - Element that triggered the menu
     * @param {Object} options - Positioning options
     */
    static showMenu(menu, triggerElement, options = {}) {
        const position = this.calculateMenuPosition(triggerElement, options);
        menu.style.left = `${position.x}px`;
        menu.style.top = `${position.y}px`;
        
        document.body.appendChild(menu);

        // Setup menu closing using BaseContextMenu logic
        this.setupMenuClosing(menu, triggerElement);

        Logger.ui.debug('Menu positioned and shown:', position);
    }

    /**
     * Re-run positioning after the menu's real content has been appended.
     *
     * showMenu() must position and append the menu BEFORE callers fill it with items (so
     * setupMenuClosing() can start tracking the cursor right away), which means
     * calculateMenuPosition() only had GUESSED width/height (options.menuWidth/menuHeight) to
     * work with — the menu was still empty. Actual size can differ once items are in,
     * especially height (item count varies per filter/menu instance). A wrong guess throws off
     * both the horizontal anchor (alignment: 'right' subtracts the guessed width) and the
     * below/above flip decision, landing the menu somewhere other than flush under the trigger
     * — since the cursor stays near the trigger, the very next mousemove then sees it outside
     * both rects and setupMenuClosing() closes the menu instantly.
     *
     * Call once after all items have been appended, with the same options passed to showMenu().
     * Runs synchronously before the browser paints, so there's no visible jump.
     * @param {HTMLElement} menu - Menu element (already appended to the DOM by showMenu())
     * @param {HTMLElement} triggerElement - Element that triggered the menu
     * @param {Object} options - Same positioning options passed to showMenu()
     */
    static repositionMenu(menu, triggerElement, options = {}) {
        const rect = menu.getBoundingClientRect();
        const position = this.calculateMenuPosition(triggerElement, {
            ...options,
            menuWidth: rect.width || options.menuWidth,
            menuHeight: rect.height || options.menuHeight
        });
        menu.style.left = `${position.x}px`;
        menu.style.top = `${position.y}px`;
    }
}
