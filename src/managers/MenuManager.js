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
        const nav = this.container.querySelector('nav');
        if (!nav) {
            this.logger.error('Navigation container not found');
            return;
        }

        // Clear existing menu structure but keep version info
        const versionInfo = nav.querySelector('.text-sm.text-gray-400');
        nav.innerHTML = '';

        // Create menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'flex items-center space-x-4';

        // Render each menu
        MENU_CONFIG.menus.forEach(menuConfig => {
            const menuElement = this.createMenu(menuConfig);
            menuContainer.appendChild(menuElement);
        });

        nav.appendChild(menuContainer);

        // Restore version info
        if (versionInfo) {
            nav.appendChild(versionInfo);
        }

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

        // Add checkbox for toggle items
        if (itemConfig.type === 'toggle' && template.checkboxHtml) {
            const checkboxHtml = template.checkboxHtml.replace('{id}', itemConfig.id);
            element.innerHTML = checkboxHtml + itemConfig.label;
        } else {
            element.textContent = itemConfig.label;
        }

        // Add keyboard shortcut if available
        if (itemConfig.shortcut) {
            const shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'ml-auto text-xs text-gray-400';
            shortcutSpan.textContent = itemConfig.shortcut;
            element.appendChild(shortcutSpan);
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
     * Close all dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('#menu-level > div, #menu-view > div, #menu-settings > div')
            .forEach(dropdown => dropdown.classList.add('hidden'));
    }

    /**
     * Update toggle checkbox state
     * @param {string} itemId - Menu item ID
     * @param {boolean} enabled - Whether item is enabled
     */
    updateToggleState(itemId, enabled) {
        const checkElement = document.getElementById(`${itemId}-check`);
        if (checkElement) {
            checkElement.classList.toggle('hidden', !enabled);
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
