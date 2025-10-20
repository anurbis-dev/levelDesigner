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
     * Setup menu closing behavior using BaseContextMenu logic
     * @param {HTMLElement} menu - Menu element
     * @param {HTMLElement} triggerElement - Element that triggered the menu
     * @returns {Function} - Cleanup function to remove event listeners
     */
    static setupMenuClosing(menu, triggerElement) {
        const closeMenu = () => {
            if (menu.parentNode) {
                menu.parentNode.removeChild(menu);
            }
        };

        // Close menu when mouse leaves the menu area (BaseContextMenu logic)
        menu.addEventListener('mouseleave', closeMenu);

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
            if (menu._closeMenuHandler) {
                menu.removeEventListener('mouseleave', menu._closeMenuHandler);
            }
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
}
