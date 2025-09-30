import { MENU_CONFIG, getMenuItemById } from '../../config/menu.js';
import { Logger } from '../utils/Logger.js';

/**
 * Menu Manager
 * Handles menu creation, rendering, and event management
 */
export class MenuManager {
    constructor(container, eventHandlers) {
        this.container = container;
        this.eventHandlers = eventHandlers;
        this.editor = eventHandlers.editor;
        this.menuElements = new Map();
        this.hoverModeEnabled = false; // Enable hover-open after first click anywhere in the menu bar
        this.logger = Logger.menu || {
            info: console.log,
            error: console.error,
            warn: console.warn,
            debug: console.debug
        };

        this.logger.info('MenuManager initialized');
    }

    /**
     * Initialize and render all menus
     */
    initialize() {
        this.logger.info('Initializing menus...');
        this.renderMenus();
        this.setupMenuEvents();
        this.logger.info('Menus initialized successfully');
    }

    /**
     * Render all menus from configuration
     */
    renderMenus() {
        const nav = this.container; // container is now the nav element itself
        if (!nav) {
            this.logger.error('Navigation container not found');
            return;
        }

        // Clear existing menu structure but keep version info
        const versionInfo = nav.querySelector('.text-sm.text-gray-400');
        const menuContainer = nav.querySelector('#menu-container');

        // Clear only the menu container content
        if (menuContainer) {
            menuContainer.innerHTML = '';
        } else {
            // If menu-container doesn't exist, create it
            const newMenuContainer = document.createElement('div');
            newMenuContainer.id = 'menu-container';
            newMenuContainer.className = 'flex items-center';
            nav.insertBefore(newMenuContainer, versionInfo);
        }

        // Get the menu container (either existing or newly created)
        const targetContainer = nav.querySelector('#menu-container');

        // Render each menu
        MENU_CONFIG.menus.forEach(menuConfig => {
            const menuElement = this.createMenu(menuConfig);
            targetContainer.appendChild(menuElement);
        });

        this.logger.info('Menus rendered successfully');
    }

    /**
     * Create a single menu from configuration
     * @param {Object} menuConfig - Menu configuration
     * @returns {HTMLElement} Menu element
     */
    createMenu(menuConfig) {
        const menuDiv = document.createElement('div');
        menuDiv.className = 'relative group';
        menuDiv.id = `menu-${menuConfig.id}`;

        // Create menu button
        const button = document.createElement('button');
        button.className = 'px-3 py-1 rounded hover:bg-gray-700 transition';
        button.textContent = menuConfig.label;
        menuDiv.appendChild(button);

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'absolute left-0 mt-1 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-20 hidden';

        // Create menu items
        menuConfig.items.forEach(itemConfig => {
            const itemElement = this.createMenuItem(itemConfig);
            if (itemElement) {
                dropdown.appendChild(itemElement);
            }
        });

        menuDiv.appendChild(dropdown);
        this.menuElements.set(menuConfig.id, menuDiv);

        return menuDiv;
    }

    /**
     * Create a menu item from configuration
     * @param {Object} itemConfig - Menu item configuration
     * @returns {HTMLElement|null} Menu item element or null
     */
    createMenuItem(itemConfig) {
        if (itemConfig.type === 'separator') {
            return this.createSeparator();
        }

        if (itemConfig.type === 'section') {
            return this.createSection(itemConfig);
        }

        const template = MENU_CONFIG.templates[itemConfig.type];
        if (!template) {
            this.logger.error(`Unknown menu item type: ${itemConfig.type}`);
            return null;
        }

        const element = document.createElement(template.tagName);
        element.id = itemConfig.id;
        element.className = template.classes;
        element.href = template.href || '#';

        // Set up content based on item type
        let contentHtml = '';
        if (itemConfig.type === 'toggle' && template.checkboxHtml) {
            contentHtml = template.checkboxHtml.replace('{id}', itemConfig.id) + itemConfig.label;
        } else {
            contentHtml = itemConfig.label;
        }

        // Add keyboard shortcut if available
        if (itemConfig.shortcut) {
            // Make the element a flex container for proper alignment
            element.className += ' flex items-center justify-between';
            element.innerHTML = contentHtml;

            const shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'text-xs text-gray-400 ml-4';
            shortcutSpan.textContent = itemConfig.shortcut;
            element.appendChild(shortcutSpan);
        } else {
            // No shortcut, just set content normally
            if (itemConfig.type === 'toggle' && template.checkboxHtml) {
                element.innerHTML = contentHtml;
            } else {
                element.textContent = itemConfig.label;
            }
        }

        return element;
    }

    /**
     * Create separator element
     * @returns {HTMLElement} Separator element
     */
    createSeparator() {
        const separator = document.createElement('div');
        separator.className = 'border-t border-gray-600 my-1';
        return separator;
    }

    /**
     * Create section header element
     * @param {Object} itemConfig - Section configuration
     * @returns {HTMLElement} Section element
     */
    createSection(itemConfig) {
        const section = document.createElement('div');
        section.className = 'px-4 py-2 text-xs text-gray-400 text-center border-b border-gray-600';
        section.textContent = itemConfig.label;
        return section;
    }

    /**
     * Setup menu event handlers
     */
    setupMenuEvents() {
        this.logger.info('Setting up menu events...');

        // Setup dropdown toggle events
        MENU_CONFIG.menus.forEach(menuConfig => {
            const menuElement = this.menuElements.get(menuConfig.id);
            if (!menuElement) return;

            const button = menuElement.querySelector('button');
            const dropdown = menuElement.querySelector('div');

            if (button && dropdown) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleDropdown(dropdown);
                    // Enable hover-after-click globally for the menu bar
                    this.hoverModeEnabled = true;
                });

                // Add hover events for automatic submenu opening (only after first click)
                menuElement.addEventListener('mouseenter', () => {
                    if (this.hoverModeEnabled) {
                        this.openDropdown(dropdown);
                    }
                });

                menuElement.addEventListener('mouseleave', (e) => {
                    if (this.hoverModeEnabled) {
                        // Only close if mouse is not moving to the dropdown
                        const relatedTarget = e.relatedTarget;
                        if (!relatedTarget || !dropdown.contains(relatedTarget)) {
                            this.closeDropdown(dropdown);
                        }
                    }
                });

                // Keep dropdown open when hovering over it (only after first click)
                dropdown.addEventListener('mouseenter', () => {
                    if (this.hoverModeEnabled) {
                        this.openDropdown(dropdown);
                    }
                });

                dropdown.addEventListener('mouseleave', (e) => {
                    if (this.hoverModeEnabled) {
                        // Only close if mouse is not moving back to the button
                        const relatedTarget = e.relatedTarget;
                        if (!relatedTarget || !menuElement.contains(relatedTarget)) {
                            this.closeDropdown(dropdown);
                        }
                    }
                });
            }
        });

        // Setup item click events
        this.setupMenuItemEvents();

        // Setup global click handler to close menus
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.relative.group')) {
                this.closeAllDropdowns();
            }
        });

        // Setup hover mode reset when mouse leaves menu container
        this.setupMenuContainerHoverReset();

        this.logger.info('Menu events setup completed');
    }

    /**
     * Setup menu item click events
     */
    setupMenuItemEvents() {
        // Action items
        const actionItems = MENU_CONFIG.menus.flatMap(menu =>
            menu.items.filter(item => item.type === 'action')
        );

        actionItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (!element) {
                this.logger.warn(`Menu item element not found: ${item.id}`);
                return;
            }

            element.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleMenuAction(item);
            });
        });

        // Toggle items
        const toggleItems = MENU_CONFIG.menus.flatMap(menu =>
            menu.items.filter(item => item.type === 'toggle')
        );

        toggleItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (!element) {
                this.logger.warn(`Menu item element not found: ${item.id}`);
                return;
            }

            element.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleMenuToggle(item);
            });
        });
    }

    /**
     * Handle menu action
     * @param {Object} item - Menu item configuration
     */
    handleMenuAction(item) {
        this.logger.debug(`Handling menu action: ${item.id}`);

        if (!this.editor || !item.action) return;

        try {
            if (typeof this.editor[item.action] === 'function') {
                this.editor[item.action]();
            } else {
                this.logger.error(`Action method not found: ${item.action}`);
            }
        } catch (error) {
            this.logger.error(`Error executing action ${item.action}:`, error);
        }

        this.closeAllDropdowns();
    }

    /**
     * Handle menu toggle
     * @param {Object} item - Menu item configuration
     */
    handleMenuToggle(item) {
        this.logger.debug(`Handling menu toggle: ${item.id}`);

        if (!item.action || !item.actionParam) return;

        try {
            if (typeof this.eventHandlers[item.action] === 'function') {
                this.eventHandlers[item.action](item.actionParam);
            } else {
                this.logger.error(`Toggle method not found: ${item.action}`);
            }
        } catch (error) {
            this.logger.error(`Error executing toggle ${item.action}:`, error);
        }
    }

    /**
     * Toggle dropdown visibility
     * @param {HTMLElement} dropdown - Dropdown element
     */
    toggleDropdown(dropdown) {
        const isHidden = dropdown.classList.contains('hidden');

        // Close all dropdowns first
        this.closeAllDropdowns();

        // Toggle this dropdown
        if (isHidden) {
            dropdown.classList.remove('hidden');
        }
    }

    /**
     * Open dropdown
     * @param {HTMLElement} dropdown - Dropdown element
     */
    openDropdown(dropdown) {
        // Close all other dropdowns first
        this.closeAllDropdowns();
        
        // Open this dropdown
        dropdown.classList.remove('hidden');
    }

    /**
     * Close dropdown
     * @param {HTMLElement} dropdown - Dropdown element
     */
    closeDropdown(dropdown) {
        dropdown.classList.add('hidden');
    }

    /**
     * Close all dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('#menu-level > div, #menu-view > div, #menu-settings > div')
            .forEach(dropdown => dropdown.classList.add('hidden'));
    }

    /**
     * Setup hover mode reset when mouse leaves menu container
     */
    setupMenuContainerHoverReset() {
        const menuContainer = this.container.querySelector('#menu-container');
        if (!menuContainer) return;

        menuContainer.addEventListener('mouseleave', (e) => {
            // Only reset if mouse is not moving to any dropdown
            const relatedTarget = e.relatedTarget;
            if (!relatedTarget || !relatedTarget.closest('.relative.group')) {
                this.hoverModeEnabled = false;
                this.closeAllDropdowns();
            }
        });
    }

    /**
     * Update toggle checkbox state
     * @param {string} itemId - Menu item ID
     * @param {boolean} enabled - Whether item is enabled
     */
    updateToggleState(itemId, enabled) {
        const checkElement = document.getElementById(`${itemId}-check`);
        if (checkElement) {
            if (enabled) {
                checkElement.classList.remove('hidden');
            } else {
                checkElement.classList.add('hidden');
            }
        }
    }

    /**
     * Get menu item by ID
     * @param {string} id - Menu item ID
     * @returns {Object|null} Menu item configuration
     */
    getMenuItem(id) {
        return getMenuItemById(id);
    }

    /**
     * Refresh menu rendering (useful after configuration changes)
     */
    refresh() {
        this.logger.info('Refreshing menu...');
        this.renderMenus();
        this.setupMenuEvents();
    }
}
