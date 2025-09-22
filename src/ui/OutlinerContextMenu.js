/**
 * OutlinerContextMenu - Context menu for Outliner panel objects
 *
 * Provides context menu functionality for objects in the Outliner panel,
 * allowing users to perform common operations like rename, delete, show/hide, etc.
 *
 * Features:
 * - Right-click context menu on outliner items
 * - Object-specific operations (rename, delete, show/hide)
 * - Group operations (expand/collapse all)
 * - Smart menu positioning
 *
 * Usage:
 * ```javascript
 * const contextMenu = new OutlinerContextMenu(outlinerContainer, levelEditor, {
 *     onRename: (object) => console.log('Renaming:', object),
 *     onDelete: (object) => console.log('Deleting:', object),
 *     onToggleVisibility: (object) => console.log('Toggling visibility:', object)
 * });
 * ```
 *
 * @author Level Designer
 * @version dynamic
 */

import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';

export class OutlinerContextMenu extends BaseContextMenu {
    constructor(panel, levelEditor, callbacks = {}) {
        super(panel, {
            onRename: callbacks.onRename || (() => {}),
            onDelete: callbacks.onDelete || (() => {}),
            onToggleVisibility: callbacks.onToggleVisibility || (() => {}),
            onSelect: callbacks.onSelect || (() => {}),
            onDuplicate: callbacks.onDuplicate || (() => {}),
            onExpandAllGroups: callbacks.onExpandAllGroups || (() => {}),
            onCollapseAllGroups: callbacks.onCollapseAllGroups || (() => {}),
            ...callbacks
        });

        this.levelEditor = levelEditor;
        this.setupMenuItems();
        Logger.ui.info('OutlinerContextMenu initialized successfully');
    }

    /**
     * Setup context menu items for different object types
     */
    setupMenuItems() {
        // Object operations
        this.addMenuItem('select', 'Select', '🎯', (contextData) => {
            Logger.outliner.debug('Context menu: Select object', contextData.object?.name);
            this.callbacks.onSelect(contextData.object);
        });

        this.addMenuItem('rename', 'Rename', '✏️', (contextData) => {
            Logger.outliner.debug('Context menu: Rename object', contextData.object?.name);
            this.callbacks.onRename(contextData.object);
        });

        this.addMenuItem('duplicate', 'Duplicate', '📋', (contextData) => {
            Logger.outliner.debug('Context menu: Duplicate object', contextData.object?.name);
            this.callbacks.onDuplicate(contextData.object);
        });

        this.addSeparator();

        this.addMenuItem('visibility', 'Toggle Visibility', '👁️', (contextData) => {
            Logger.outliner.debug('Context menu: Toggle visibility', contextData.object?.name);
            this.callbacks.onToggleVisibility(contextData.object);
        });

        this.addSeparator();

        this.addMenuItem('delete', 'Delete', '🗑️', (contextData) => {
            Logger.outliner.debug('Context menu: Delete object', contextData.object?.name);
            this.callbacks.onDelete(contextData.object);
        });

        // Global operations (always shown)
        this.addSeparator('global-separator');

        this.addMenuItem('expand-all', 'Expand All Groups', '📂', (contextData) => {
            Logger.outliner.debug('Context menu: Expand all groups');
            this.callbacks.onExpandAllGroups();
        });

        this.addMenuItem('collapse-all', 'Collapse All Groups', '📁', (contextData) => {
            Logger.outliner.debug('Context menu: Collapse all groups');
            this.callbacks.onCollapseAllGroups();
        });
    }

    /**
     * Extract context data from clicked element
     * @param {Element} target - The clicked element
     * @returns {Object} Context data with object information
     */
    extractContextData(target) {
        const item = target.closest('.outliner-item');
        if (!item) return {};

        const objectId = item.dataset.id;
        const level = this.levelEditor.getLevel();
        const object = level.findObjectById ? level.findObjectById(objectId) : null;

        return {
            object: object,
            objectId: objectId,
            isGroup: object?.type === 'group',
            element: item
        };
    }

    /**
     * Show context menu with filtered items based on context
     * @param {Event} e - The context menu event
     * @param {Object} contextData - Context data from clicked element
     */
    showContextMenu(e, contextData) {
        if (!contextData.object) return;

        Logger.outliner.debug('Showing context menu for object:', contextData.object.name, 'type:', contextData.object.type);

        // Filter menu items based on object type
        const filteredItems = this.menuItems.filter(item => {
            if (!item.id) return true; // Keep separators

            // Show all items for now - no special filtering needed
            return true;
        });

        // Temporarily set filtered items
        const originalItems = this.menuItems;
        this.menuItems = filteredItems;

        try {
            super.showContextMenu(e, contextData);
        } finally {
            // Restore original items
            this.menuItems = originalItems;
        }
    }

    /**
     * Override to add custom positioning for outliner items
     */
    calculateMenuPosition(e, menu) {
        const rect = this.panel.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();

        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // Ensure menu stays within panel bounds
        if (x + menuRect.width > rect.width) {
            x = rect.width - menuRect.width - 10;
        }

        if (y + menuRect.height > rect.height) {
            y = rect.height - menuRect.height - 10;
        }

        x = Math.max(10, x);
        y = Math.max(10, y);

        return { x, y };
    }
}
