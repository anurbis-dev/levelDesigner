/**
 * Menu Configuration
 * Centralized menu structure for easy editing and maintenance
 * Each menu item has a unique ID that allows changing name and position without losing functionality
 */

export const MENU_CONFIG = {
    // Main menu structure
    menus: [
        {
            id: 'level',
            label: 'Level',
            items: [
                {
                    id: 'new-level',
                    label: 'New Level',
                    type: 'action',
                    shortcut: 'Ctrl+N',
                    action: 'newLevel'
                },
                {
                    id: 'open-level',
                    label: 'Open Level...',
                    type: 'action',
                    shortcut: 'Ctrl+O',
                    action: 'openLevel'
                },
                { type: 'separator' },
                {
                    id: 'save-level',
                    label: 'Save Level',
                    type: 'action',
                    shortcut: 'Ctrl+S',
                    action: 'saveLevel'
                },
                {
                    id: 'save-level-as',
                    label: 'Save Level As...',
                    type: 'action',
                    shortcut: 'Ctrl+Shift+S',
                    action: 'saveLevelAs'
                }
            ]
        },
        {
            id: 'view',
            label: 'View',
            items: [
                {
                    id: 'panels-section',
                    label: 'Panels',
                    type: 'section'
                },
                {
                    id: 'toggle-toolbar',
                    label: 'Toolbar',
                    type: 'toggle',
                    stateKey: 'view.toolbar',
                    action: 'togglePanel',
                    actionParam: 'toolbar'
                },
                {
                    id: 'toggle-assets-panel',
                    label: 'Assets Panel',
                    type: 'toggle',
                    stateKey: 'view.assetsPanel',
                    action: 'togglePanel',
                    actionParam: 'assetsPanel'
                },
                {
                    id: 'toggle-right-panel',
                    label: 'Right Panel',
                    type: 'toggle',
                    stateKey: 'view.rightPanel',
                    action: 'togglePanel',
                    actionParam: 'rightPanel'
                },
                { type: 'separator' },
                {
                    id: 'canvas-section',
                    label: 'Canvas',
                    type: 'section'
                },
                {
                    id: 'toggle-grid',
                    label: 'Grid (G)',
                    type: 'toggle',
                    stateKey: 'canvas.showGrid',
                    action: 'toggleViewOption',
                    actionParam: 'grid'
                },
                {
                    id: 'toggle-game-mode',
                    label: 'Game Mode',
                    type: 'toggle',
                    stateKey: 'view.gameMode',
                    action: 'toggleViewOption',
                    actionParam: 'gameMode'
                },
                {
                    id: 'toggle-snap-to-grid',
                    label: 'Snap To Grid',
                    type: 'toggle',
                    stateKey: 'canvas.snapToGrid',
                    action: 'toggleViewOption',
                    actionParam: 'snapToGrid'
                },
                { type: 'separator' },
                {
                    id: 'object-section',
                    label: 'Object',
                    type: 'section'
                },
                {
                    id: 'toggle-object-boundaries',
                    label: 'Boundaries',
                    type: 'toggle',
                    stateKey: 'view.objectBoundaries',
                    action: 'toggleViewOption',
                    actionParam: 'objectBoundaries'
                },
                {
                    id: 'toggle-object-collisions',
                    label: 'Collisions',
                    type: 'toggle',
                    stateKey: 'view.objectCollisions',
                    action: 'toggleViewOption',
                    actionParam: 'objectCollisions'
                },
                { type: 'separator' },
                {
                    id: 'toggle-parallax',
                    label: 'Parallax',
                    type: 'toggle',
                    stateKey: 'view.parallax',
                    action: 'toggleViewOption',
                    actionParam: 'parallax'
                }
            ]
        },
        {
            id: 'settings',
            label: 'Settings',
            items: [
                {
                    id: 'import-assets',
                    label: 'Import Assets...',
                    type: 'action',
                    action: 'importAssets'
                },
                {
                    id: 'editor-settings',
                    label: 'Editor Settings...',
                    type: 'action',
                    action: 'openSettings'
                }
            ]
        }
    ],

    // Keyboard shortcuts mapping
    shortcuts: {
        'Ctrl+N': 'new-level',
        'Ctrl+O': 'open-level',
        'Ctrl+S': 'save-level',
        'Ctrl+Shift+S': 'save-level-as',
        'Ctrl+Z': 'undo',
        'Ctrl+Y': 'redo',
        'Ctrl+D': 'duplicate',
        'Delete': 'delete-selected',
        'Backspace': 'delete-selected',
        'Ctrl+G': 'group-selected',
        'Ctrl+Shift+G': 'ungroup-selected',
        'F': 'focus-selection',
        'A': 'focus-all',
        'P': 'toggle-parallax',
        'Escape': 'cancel-action'
    },

    // Menu item templates
    templates: {
        action: {
            tagName: 'a',
            classes: 'block px-4 py-2 text-sm hover:bg-gray-700',
            href: '#'
        },
        toggle: {
            tagName: 'a',
            classes: 'block px-4 py-2 text-sm hover:bg-gray-700 flex items-center',
            href: '#',
            checkboxHtml: `
                <span class="w-4 h-4 border border-gray-500 mr-2 flex items-center justify-center">
                    <span class="w-2 h-2 bg-gray-500 hidden" id="{id}-check"></span>
                </span>
            `
        },
        separator: {
            tagName: 'div',
            classes: 'border-t border-gray-600 my-1'
        },
        section: {
            tagName: 'div',
            classes: 'px-4 py-2 text-xs text-gray-400 text-center border-b border-gray-600'
        }
    }
};

/**
 * Get menu item by ID
 * @param {string} id - Menu item ID
 * @returns {Object|null} Menu item configuration or null if not found
 */
export function getMenuItemById(id) {
    for (const menu of MENU_CONFIG.menus) {
        const item = menu.items.find(item => item.id === id);
        if (item) return item;
    }
    return null;
}

/**
 * Get menu by ID
 * @param {string} id - Menu ID
 * @returns {Object|null} Menu configuration or null if not found
 */
export function getMenuById(id) {
    return MENU_CONFIG.menus.find(menu => menu.id === id) || null;
}

/**
 * Get shortcut by key combination
 * @param {string} key - Key combination (e.g., 'Ctrl+N')
 * @returns {string|null} Menu item ID or null if not found
 */
export function getShortcutTarget(key) {
    return MENU_CONFIG.shortcuts[key] || null;
}

/**
 * Get all menu items of specific type
 * @param {string} type - Item type ('action', 'toggle', 'section', 'separator')
 * @returns {Array} Array of menu items
 */
export function getMenuItemsByType(type) {
    const items = [];
    for (const menu of MENU_CONFIG.menus) {
        items.push(...menu.items.filter(item => item.type === type));
    }
    return items;
}
