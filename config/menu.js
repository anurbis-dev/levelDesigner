/**
 * Menu Configuration
 * Centralized menu structure for easy editing and maintenance
 * Each menu item has a unique ID that allows changing name and position without losing functionality
 */

import { getAssetCategoriesWithTypes } from '../src/constants/AssetTypes.js';
import { buildTypeIconSvg } from '../src/constants/AssetTypeIcons.js';

/**
 * An asset can only be created into a specific, non-root folder — the Content root
 * itself is not a valid creation target (mirrors the same check used by the
 * Assets-panel "Add" context menu entry).
 * @param {Object} editor - LevelEditor instance
 * @returns {boolean}
 */
function isRootFolderSelected(editor) {
    const folderPath = editor?.assetPanel?.getActiveTabPath?.() || 'root';
    return folderPath === 'root';
}

/**
 * Build the "Add" top-level menu from the AssetTypes.js catalog: one submenu per
 * category, each containing a "<Type>" action that calls editor.createAssetOfType(typeId).
 * Type actions are greyed out (disabled) when the Content root folder is selected,
 * since assets can't be created at that level.
 */
function buildAssetsMenu() {
    const items = getAssetCategoriesWithTypes().map(({ categoryId, category, types }) => ({
        id: `assets-cat-${categoryId}`,
        label: category.label,
        type: 'submenu',
        items: types.map(typeDef => ({
            id: `create-asset-${typeDef.id}`,
            label: typeDef.label,
            type: 'action',
            action: 'createAssetOfType',
            actionParam: typeDef.id,
            icon: buildTypeIconSvg(typeDef.id, category.color, 16),
            disabled: isRootFolderSelected
        }))
    }));

    return { id: 'assets', label: 'Add', items };
}

export const MENU_CONFIG = {
    // Main menu structure
    menus: [
        {
            id: 'file',
            label: 'File',
            items: [
                {
                    id: 'new-level',
                    label: 'New Level',
                    type: 'action',
                    shortcutKey: 'editor.newLevel',
                    action: 'newLevel'
                },
                {
                    id: 'open-level',
                    label: 'Open Level...',
                    type: 'action',
                    shortcutKey: 'editor.openLevel',
                    action: 'openLevel'
                },
                { type: 'separator' },
                {
                    id: 'save-level',
                    label: 'Save Level',
                    type: 'action',
                    shortcutKey: 'editor.saveLevel',
                    action: 'saveLevel'
                },
                {
                    id: 'save-level-as',
                    label: 'Save Level As...',
                    type: 'action',
                    shortcutKey: 'editor.saveLevelAs',
                    action: 'saveLevelAs'
                },
                {
                    id: 'close-level',
                    label: 'Close Level',
                    type: 'action',
                    action: 'closeLevel'
                },
                { type: 'separator' },
                {
                    id: 'new-project',
                    label: 'New Project',
                    type: 'action',
                    action: 'newProject'
                },
                {
                    id: 'open-project',
                    label: 'Open Project...',
                    type: 'action',
                    action: 'openProject'
                },
                {
                    id: 'save-project',
                    label: 'Save Project',
                    type: 'action',
                    action: 'saveProject'
                },
                {
                    id: 'save-project-as',
                    label: 'Save Project As...',
                    type: 'action',
                    action: 'saveProjectAs'
                },
                { type: 'separator' },
                {
                    id: 'import-assets',
                    label: 'Import Assets...',
                    type: 'action',
                    action: 'importAssets'
                }
            ]
        },
        {
            id: 'view',
            label: 'View',
            items: [
                {
                    id: 'toggle-fullscreen',
                    label: 'Full Screen',
                    type: 'toggle',
                    stateKey: 'view.fullscreen',
                    action: 'toggleViewOption',
                    actionParam: 'fullscreen',
                    shortcutKey: 'editor.toggleFullscreen'
                },
                {
                    id: 'toggle-game-mode',
                    label: 'Immersive Mode',
                    type: 'toggle',
                    stateKey: 'view.gameMode',
                    action: 'toggleViewOption',
                    actionParam: 'gameMode',
                    shortcutKey: 'editor.toggleGameMode'
                },
                {
                    id: 'toggle-parallax',
                    label: 'Parallax Mode',
                    type: 'toggle',
                    stateKey: 'view.parallax',
                    action: 'toggleViewOption',
                    actionParam: 'parallax',
                    shortcutKey: 'editor.toggleParallax'
                },
                { type: 'separator' },
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
                    actionParam: 'toolbar',
                    shortcutKey: 'ui.toggleToolbar'
                },
                {
                    id: 'toggle-assets-panel',
                    label: 'Assets Panel',
                    type: 'toggle',
                    stateKey: 'view.assetsPanel',
                    action: 'togglePanel',
                    actionParam: 'assetsPanel',
                    shortcutKey: 'ui.toggleAssetsPanel'
                },
                {
                    id: 'toggle-right-panel',
                    label: 'Right Panel',
                    type: 'toggle',
                    stateKey: 'view.rightPanel',
                    action: 'togglePanel',
                    actionParam: 'rightPanel',
                    shortcutKey: 'ui.toggleRightPanel'
                },
                {
                    id: 'toggle-left-panel',
                    label: 'Left Panel',
                    type: 'toggle',
                    stateKey: 'view.leftPanel',
                    action: 'togglePanel',
                    actionParam: 'leftPanel',
                    shortcutKey: 'ui.toggleLeftPanel'
                },
                {
                    id: 'toggle-console',
                    label: 'Console',
                    type: 'toggle',
                    stateKey: 'console.visible',
                    action: 'togglePanel',
                    actionParam: 'console',
                    shortcutKey: 'ui.toggleConsole'
                },
                {
                    id: 'toggle-status-bar',
                    label: 'Status Bar',
                    type: 'toggle',
                    stateKey: 'view.statusBar',
                    action: 'togglePanel',
                    actionParam: 'statusBar',
                    shortcutKey: 'ui.toggleStatusBar'
                },
                { type: 'separator' },
                {
                    id: 'canvas-section',
                    label: 'Canvas',
                    type: 'section'
                },
                {
                    id: 'toggle-grid',
                    label: 'Grid',
                    type: 'toggle',
                    stateKey: 'canvas.showGrid',
                    action: 'toggleViewOption',
                    actionParam: 'grid',
                    shortcutKey: 'editor.toggleGrid'
                },
                {
                    id: 'toggle-snap-to-grid',
                    label: 'Snap To Grid',
                    type: 'toggle',
                    stateKey: 'canvas.snapToGrid',
                    action: 'toggleViewOption',
                    actionParam: 'snapToGrid',
                    shortcutKey: 'editor.toggleSnapToGrid'
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
                    actionParam: 'objectBoundaries',
                    shortcutKey: 'editor.toggleObjectBoundaries'
                },
                {
                    id: 'toggle-object-collisions',
                    label: 'Collisions',
                    type: 'toggle',
                    stateKey: 'view.objectCollisions',
                    action: 'toggleViewOption',
                    actionParam: 'objectCollisions',
                    shortcutKey: 'editor.toggleObjectCollisions'
                },
                { type: 'separator' }
            ]
        },
        buildAssetsMenu(),
        {
            id: 'settings',
            label: 'Settings',
            items: [
                {
                    id: 'project-settings',
                    label: 'Project Settings...',
                    type: 'action',
                    action: 'openProjectSettings',
                    shortcutKey: 'editor.openProjectSettings'
                },
                {
                    id: 'editor-settings',
                    label: 'Editor Settings...',
                    type: 'action',
                    action: 'openSettings',
                    shortcutKey: 'editor.openSettings'
                }
            ]
        }
    ],

    // Menu item templates
    templates: {
        action: {
            tagName: 'a',
            classes: 'block px-4 py-2 text-sm hover:bg-gray-700',
            href: '#',
            style: 'color: var(--ui-text-color, #d1d5db);'
        },
        toggle: {
            tagName: 'a',
            classes: 'block px-4 py-2 text-sm hover:bg-gray-700 flex items-center',
            href: '#',
            style: 'color: var(--ui-text-color, #d1d5db);'
        },
        separator: {
            tagName: 'div',
            classes: 'border-t border-gray-600 my-1'
        },
        section: {
            tagName: 'div',
            classes: 'px-4 py-2 text-xs text-center border-b border-gray-600',
            style: 'color: var(--ui-text-color, #9ca3af);'
        }
    }
};

/**
 * Recursively flatten menu items, expanding 'submenu' items into their children.
 * @param {Array} items
 * @returns {Array}
 */
export function flattenMenuItems(items) {
    let result = [];
    for (const item of items) {
        if (item.type === 'submenu' && Array.isArray(item.items)) {
            result = result.concat(flattenMenuItems(item.items));
        } else {
            result.push(item);
        }
    }
    return result;
}

/**
 * Get menu item by ID (searches inside submenus too)
 * @param {string} id - Menu item ID
 * @returns {Object|null} Menu item configuration or null if not found
 */
export function getMenuItemById(id) {
    for (const menu of MENU_CONFIG.menus) {
        const item = flattenMenuItems(menu.items).find(item => item.id === id);
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
 * Get all menu items of specific type
 * @param {string} type - Item type ('action', 'toggle', 'section', 'separator')
 * @returns {Array} Array of menu items
 */
export function getMenuItemsByType(type) {
    const items = [];
    for (const menu of MENU_CONFIG.menus) {
        items.push(...flattenMenuItems(menu.items).filter(item => item.type === type));
    }
    return items;
}
