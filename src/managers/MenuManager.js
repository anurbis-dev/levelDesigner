import { MENU_CONFIG, getMenuItemById, flattenMenuItems } from '../../config/menu.js';
import { Logger } from '../utils/Logger.js';
import { ShortcutFormatter } from '../utils/ShortcutFormatter.js';
import { renderMenuItemLeadingHtml, renderMenuItemBodyHtml, renderMenuItemTrailingHtml } from '../utils/MenuItemTemplateUtils.js';
import { MenuPositioningUtils } from '../utils/MenuPositioningUtils.js';

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
        this.logger = Logger.menu;
        // itemId -> disabled predicate (function(editor) => boolean, or boolean literal), populated
        // by createMenuItem() for any itemConfig with a `disabled` field, evaluated by refreshDisabledStates()
        this.itemDisabledCheckers = new Map();
        this.subscriptions = [];

        this.logger.info('MenuManager initialized');
    }

    /**
     * Initialize and render all menus
     */
    initialize() {
        this.logger.info('Initializing menus...');
        this.renderMenus();
        this.setupMenuEvents();
        // Defensive: resolve shortcutKey labels against the live shortcuts config in case
        // ConfigManager was still loading when the menu DOM was first built.
        this.refreshShortcutLabels();
        // Initial evaluation of any context-sensitive `disabled` predicates (e.g. Add menu
        // vs. selected folder), then keep them fresh as the relevant state changes.
        this.refreshDisabledStates();
        this.setupDisabledStateSubscriptions();
        this.logger.info('Menus initialized successfully');
    }

    /**
     * Subscribe to state changes that can affect any menu item's `disabled` predicate.
     * Item DOM is built once at init (not rebuilt per open), so disabled state must be
     * refreshed explicitly whenever the underlying condition changes.
     */
    setupDisabledStateSubscriptions() {
        const stateManager = this.editor?.stateManager;
        if (!stateManager) return;

        this.subscriptions.push(stateManager.subscribe('selectedFolders', () => this.refreshDisabledStates()));
        this.subscriptions.push(stateManager.subscribe('activeAssetTabs', () => this.refreshDisabledStates()));
    }

    /**
     * Re-evaluate every menu item's `disabled` predicate (if any) and toggle its
     * visual/interactive disabled state. Generic — works for any item in any menu,
     * not just the Assets "Add" menu.
     */
    refreshDisabledStates() {
        this.itemDisabledCheckers.forEach((disabled, itemId) => {
            const element = document.getElementById(itemId);
            if (!element) return;

            const isDisabled = typeof disabled === 'function' ? !!disabled(this.editor) : !!disabled;
            element.classList.toggle('opacity-50', isDisabled);
            element.classList.toggle('pointer-events-none', isDisabled);
            element.classList.toggle('cursor-not-allowed', isDisabled);
            element.dataset.menuDisabled = isDisabled ? 'true' : 'false';
        });
    }

    /**
     * Resolve a `shortcutKey` (dot-path into config/defaults/shortcuts.json, e.g.
     * 'editor.toggleGrid') to a display string via ConfigManager.getShortcuts() — the single
     * source of truth, instead of a hardcoded label duplicated in config/menu.js.
     * @param {string} shortcutKey
     * @returns {string} Formatted shortcut string, or '' if not found
     */
    resolveShortcutLabel(shortcutKey) {
        const configManager = this.editor?.configManager;
        if (!configManager || !shortcutKey) return '';

        const [category, action] = shortcutKey.split('.');
        const shortcuts = configManager.getShortcuts?.() || {};
        const shortcut = shortcuts[category]?.[action];
        return shortcut ? ShortcutFormatter.format(shortcut) : '';
    }

    /**
     * Re-resolve and update every rendered menu item's shortcut label from the current
     * shortcuts config. Menu item DOM is built once at init (not rebuilt per open), so this
     * must be called explicitly whenever the underlying shortcuts config might have changed
     * (e.g. after SettingsPanel.saveHotkey() persists a rebind).
     */
    refreshShortcutLabels() {
        if (!this.container) return;
        this.container.querySelectorAll('[data-shortcut-key]').forEach(span => {
            const label = this.resolveShortcutLabel(span.dataset.shortcutKey);
            if (label) span.textContent = label;
        });
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
        // Gap is controlled via CSS (styles/spacing-mode.css) using --spacing-scale; avoid inline/class gap here.

        // Add editor logo button as first item
        const logoButton = this.createEditorLogoButton();
        if (logoButton) {
            targetContainer.appendChild(logoButton);
        }

        // Render each menu
        MENU_CONFIG.menus.forEach(menuConfig => {
            const menuElement = this.createMenu(menuConfig);
            targetContainer.appendChild(menuElement);
        });

        this.logger.info('Menus rendered successfully');
    }

    /**
     * Create editor logo button
     * @returns {HTMLElement|null} Logo button element
     */
    createEditorLogoButton() {
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'relative';
        buttonDiv.id = 'menu-editor-logo';

        const button = document.createElement('button');
        button.className = 'px-3 py-1 rounded hover:bg-gray-700 transition';
        button.style.cssText = 'display: flex; align-items: center; justify-content: center; padding: 0.5rem;';
        
        const img = document.createElement('img');
        img.src = 'editor_logo_lightGray_128.png';
        img.alt = 'Editor Logo';
        img.style.cssText = 'width: 24px; height: 24px; object-fit: contain;';
        img.onerror = () => {
            this.logger.warn('Failed to load editor logo, using fallback');
            button.textContent = 'G';
            button.style.fontSize = '1.25rem';
            button.style.fontWeight = 'bold';
        };
        
        button.appendChild(img);
        buttonDiv.appendChild(button);

        // Add click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.editor && typeof this.editor.showSplashScreen === 'function') {
                this.editor.showSplashScreen();
            } else {
                this.logger.error('Editor or showSplashScreen method not found');
            }
            this.closeAllDropdowns();
        });

        return buttonDiv;
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
        dropdown.className = 'absolute left-0 mt-0 w-48 rounded-md shadow-lg py-1 z-20 hidden';
        dropdown.style.backgroundColor = 'var(--ui-background-color, #1f2937)';
        dropdown.style.paddingTop = '8px'; // Add invisible padding to cover the gap

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

        if (itemConfig.type === 'submenu') {
            return this.createSubmenuItem(itemConfig);
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
        
        // Apply style from template if available
        if (template.style) {
            element.style.cssText = template.style;
        }

        // Every row (icon-action, toggle-checkbox, or plain label) shares the same
        // [leading block | label | trailing block] layout — see MenuItemTemplateUtils.js —
        // so icon rows and checkbox rows always line up identically across menus/submenus.
        const leadingHtml = renderMenuItemLeadingHtml({
            icon: itemConfig.icon,
            checkboxId: itemConfig.type === 'toggle' ? `${itemConfig.id}-check` : undefined
        });
        const bodyHtml = renderMenuItemBodyHtml({ leadingHtml, label: itemConfig.label });

        // Add keyboard shortcut if available. Prefer shortcutKey (dot-path into
        // config/defaults/shortcuts.json, resolved live via ConfigManager) over a legacy
        // hardcoded `shortcut` string, so the label can never drift from the real binding.
        const resolvedShortcut = itemConfig.shortcutKey
            ? this.resolveShortcutLabel(itemConfig.shortcutKey)
            : itemConfig.shortcut;
        const trailingHtml = renderMenuItemTrailingHtml(resolvedShortcut, { shortcutKey: itemConfig.shortcutKey });

        // Body must be a single flex item — otherwise the leading block and the label text
        // node would count as separate flex children alongside the trailing block, and
        // justify-between would center the label instead of pinning content left / trailing right.
        element.className += ' flex items-center' + (trailingHtml ? ' justify-between' : '');
        element.innerHTML = bodyHtml + trailingHtml;

        // Register a context-sensitive disabled predicate (function or boolean literal),
        // if configured. Evaluated on demand by refreshDisabledStates() since this DOM is
        // built once at init and never rebuilt per menu open.
        if (itemConfig.disabled !== undefined) {
            this.itemDisabledCheckers.set(itemConfig.id, itemConfig.disabled);
        }

        return element;
    }

    /**
     * Create a flyout submenu item: a hoverable row that expands a nested dropdown
     * to the right, containing its own items (built recursively via createMenuItem).
     * @param {Object} itemConfig - Submenu configuration ({ id, label, items })
     * @returns {HTMLElement} Submenu wrapper element
     */
    createSubmenuItem(itemConfig) {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';
        wrapper.id = itemConfig.id;

        const trigger = document.createElement('div');
        trigger.className = 'flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-700 cursor-pointer';
        trigger.style.color = 'var(--ui-text-color, #d1d5db);';
        // Same [leading | label | trailing] row layout as createMenuItem(), with the flyout
        // arrow occupying the trailing slot — so a submenu trigger with an icon aligns
        // identically to a regular command row.
        const leadingHtml = renderMenuItemLeadingHtml({ icon: itemConfig.icon });
        const bodyHtml = renderMenuItemBodyHtml({ leadingHtml, label: itemConfig.label });
        trigger.innerHTML = bodyHtml + renderMenuItemTrailingHtml('▸');
        wrapper.appendChild(trigger);

        const submenu = document.createElement('div');
        submenu.className = 'absolute top-0 left-full w-56 rounded-md shadow-lg py-1 z-30 hidden max-h-96 overflow-y-auto';
        submenu.style.backgroundColor = 'var(--ui-background-color, #1f2937)';

        (itemConfig.items || []).forEach(subItemConfig => {
            const subElement = this.createMenuItem(subItemConfig);
            if (subElement) submenu.appendChild(subElement);
        });

        wrapper.appendChild(submenu);

        wrapper.addEventListener('mouseenter', () => {
            // Close sibling submenus at the same level before opening this one
            Array.from(wrapper.parentElement.children).forEach(sibling => {
                if (sibling !== wrapper) {
                    sibling.querySelector?.(':scope > .absolute.left-full')?.classList.add('hidden');
                }
            });
            submenu.classList.remove('hidden');
        });
        wrapper.addEventListener('mouseleave', (e) => {
            const related = e.relatedTarget;
            if (!related || !wrapper.contains(related)) {
                submenu.classList.add('hidden');
            }
        });

        return wrapper;
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
        section.className = 'px-4 py-2 text-xs text-center border-b border-gray-600';
        section.style.color = 'var(--ui-text-color, #9ca3af)';
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

                // Add hover events for automatic submenu opening (only after first click).
                // Closing is handled by the margin-aware document mousemove watcher started
                // below (checkDropdownCursorMargin()) instead of native mouseleave, which fires
                // the instant the cursor crosses the DOM edge with zero tolerance — that starved
                // ui.cursorMenuMargin of any effect here (same root cause already fixed for
                // BaseContextMenu's context menus).
                menuElement.addEventListener('mouseenter', () => {
                    if (this.hoverModeEnabled) {
                        this.openDropdown(dropdown);
                    }
                });

                // Keep dropdown open when hovering over it (only after first click)
                dropdown.addEventListener('mouseenter', () => {
                    if (this.hoverModeEnabled) {
                        this.openDropdown(dropdown);
                    }
                });
            }
        });

        this.setupDropdownCursorMarginWatcher();

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
     * Persistent, margin-aware close-on-leave for the top-level nav dropdown, mirroring
     * BaseContextMenu.setupMenuClosing()/isCursorInsideMenu(): tracks real cursor coordinates
     * on document 'mousemove' rather than relying on native mouseleave, so the configurable
     * ui.cursorMenuMargin forgiveness zone (see MenuPositioningUtils.getCursorMenuMargin())
     * actually has an effect. Only acts while hoverModeEnabled. A no-op otherwise.
     * Started once in setupMenuEvents() and left running for the menu bar's lifetime.
     *
     * Also absorbs what used to be setupMenuContainerHoverReset()'s native `#menu-container`
     * mouseleave listener (removed): that fired at the container's exact rendered edge with
     * zero tolerance, and since the open dropdown renders BELOW the container's own layout box
     * (position:absolute; mt-0 — the container's box is just the button row), moving the cursor
     * straight down off a button into its dropdown routinely crossed that edge and closed
     * everything before the margin-aware check below ever ran — a second, competing close path
     * at 0px margin regardless of ui.cursorMenuMargin. isCursorNearMenuBar() replaces it with
     * the same margin-aware approach, checked every move alongside the per-dropdown check.
     */
    setupDropdownCursorMarginWatcher() {
        this.lastCursorX = 0;
        this.lastCursorY = 0;

        document.addEventListener('mousemove', (e) => {
            this.lastCursorX = e.clientX;
            this.lastCursorY = e.clientY;

            if (!this.hoverModeEnabled) return;

            const openEntry = this.getOpenDropdownEntry();
            if (openEntry) {
                // Cursor is still within margin of the open dropdown (which routinely renders
                // BELOW #menu-container's own layout box, e.g. a tall dropdown) — nothing to do.
                // Deliberately NOT checking isCursorNearMenuBar() here too: that rect only covers
                // the button row, so a false positive there would wrongly close a dropdown the
                // cursor is still legitimately hovering deep inside of.
                if (this.isCursorInsideDropdown(openEntry.menuElement, openEntry.dropdown)) return;

                // Left the dropdown's margin — close it. hoverModeEnabled stays on so hovering a
                // sibling top-level button still reopens instantly without a fresh click, UNLESS
                // the cursor also left the whole menu bar (checked below), matching the old
                // "hover mode after first click" behavior.
                this.closeAllDropdowns();
            }

            // Fully exit hover mode once the cursor leaves the whole menu bar, with the same margin.
            if (!this.isCursorNearMenuBar()) {
                this.hoverModeEnabled = false;
                this.closeAllDropdowns();
            }
        });
    }

    /**
     * Check if the last known cursor position is within margin of the whole menu bar container
     * (not just the currently open dropdown) — used to decide when to fully exit hover mode.
     * @returns {boolean}
     */
    isCursorNearMenuBar() {
        const menuContainer = this.container.querySelector('#menu-container');
        if (!menuContainer) return false;

        const margin = MenuPositioningUtils.getCursorMenuMargin();
        const rect = menuContainer.getBoundingClientRect();
        return this.lastCursorX >= rect.left - margin && this.lastCursorX <= rect.right + margin &&
               this.lastCursorY >= rect.top - margin && this.lastCursorY <= rect.bottom + margin;
    }

    /**
     * Find the currently open top-level dropdown, if any.
     * @returns {{menuElement: HTMLElement, dropdown: HTMLElement}|null}
     */
    getOpenDropdownEntry() {
        for (const menuConfig of MENU_CONFIG.menus) {
            const dropdown = document.querySelector(`#menu-${menuConfig.id} > div`);
            if (dropdown && !dropdown.classList.contains('hidden')) {
                const menuElement = this.menuElements.get(menuConfig.id);
                if (menuElement) return { menuElement, dropdown };
            }
        }
        return null;
    }

    /**
     * Check if the last known cursor position is inside the button, the dropdown, or any
     * currently open flyout submenu within it (within the configurable margin) — flyouts
     * (.absolute.left-full, see createSubmenuItem()) render outside the dropdown's own box
     * but must still count as "inside" while hovered.
     * @param {HTMLElement} menuElement - Top-level nav menu button wrapper
     * @param {HTMLElement} dropdown - The open dropdown element
     * @returns {boolean}
     */
    isCursorInsideDropdown(menuElement, dropdown) {
        const margin = MenuPositioningUtils.getCursorMenuMargin();
        const isInsideRect = (rect) =>
            this.lastCursorX >= rect.left - margin && this.lastCursorX <= rect.right + margin &&
            this.lastCursorY >= rect.top - margin && this.lastCursorY <= rect.bottom + margin;

        if (isInsideRect(menuElement.getBoundingClientRect())) return true;
        if (isInsideRect(dropdown.getBoundingClientRect())) return true;

        const openFlyouts = dropdown.querySelectorAll('.absolute.left-full:not(.hidden)');
        for (const flyout of openFlyouts) {
            if (isInsideRect(flyout.getBoundingClientRect())) return true;
        }
        return false;
    }

    /**
     * Setup menu item click events
     */
    setupMenuItemEvents() {
        // Action items
        const actionItems = MENU_CONFIG.menus.flatMap(menu =>
            flattenMenuItems(menu.items).filter(item => item.type === 'action')
        );

        actionItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (!element) {
                this.logger.warn(`Menu item element not found: ${item.id}`);
                return;
            }

            element.addEventListener('click', (e) => {
                e.preventDefault();
                if (element.dataset.menuDisabled === 'true') return;
                this.handleMenuAction(item);
            });
        });

        // Toggle items
        const toggleItems = MENU_CONFIG.menus.flatMap(menu =>
            flattenMenuItems(menu.items).filter(item => item.type === 'toggle')
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
                this.editor[item.action](item.actionParam);
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
        const topLevelSelectors = MENU_CONFIG.menus.map(menu => `#menu-${menu.id} > div`).join(', ');
        if (topLevelSelectors) {
            document.querySelectorAll(topLevelSelectors).forEach(dropdown => dropdown.classList.add('hidden'));
        }
        // Also close any open flyout submenus (Assets menu category submenus, etc.)
        document.querySelectorAll('.absolute.left-full').forEach(submenu => submenu.classList.add('hidden'));
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
        this.itemDisabledCheckers.clear();
        this.renderMenus();
        this.setupMenuEvents();
        this.refreshDisabledStates();
    }
    
    /**
     * Cleanup and destroy menu manager
     */
    destroy() {
        Logger.ui.debug('Destroying MenuManager');

        // Close all dropdowns
        this.closeAllDropdowns();

        // Unsubscribe from state changes
        this.subscriptions.forEach(unsub => unsub());
        this.subscriptions = [];

        // Clear menu elements
        this.menuElements.clear();
        this.itemDisabledCheckers.clear();

        // Clear references
        this.container = null;
        this.eventHandlers = null;
        this.editor = null;
        this.hoverModeEnabled = false;
        
        Logger.ui.debug('MenuManager destroyed');
    }
}
