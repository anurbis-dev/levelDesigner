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
import { ShortcutFormatter } from '../utils/ShortcutFormatter.js';

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
     * Resolve shortcuts.json binding to display label (same as CanvasContextMenu).
     * @param {string} category
     * @param {string} action
     * @returns {string}
     */
    resolveShortcut(category, action) {
        const shortcut = this.levelEditor?.configManager?.getShortcuts?.()?.[category]?.[action];
        return ShortcutFormatter.format(shortcut);
    }

    /**
     * If the right-clicked object is not already selected, select only it so
     * selection-based commands (Move to Layer) target the expected object(s).
     * Multi-select is kept when the target is already part of the selection.
     * @param {Object} contextData
     */
    ensureObjectInSelection(contextData) {
        const objectId = contextData?.objectId || contextData?.object?.id;
        if (!objectId || !this.levelEditor?.stateManager) return;

        const selected = this.levelEditor.stateManager.get('selectedObjects');
        if (selected instanceof Set && selected.has(objectId)) {
            return;
        }
        this.levelEditor.stateManager.set('selectedObjects', new Set([objectId]));
    }

    /**
     * Setup context menu items for different object types
     */
    setupMenuItems() {
        // Object operations
        this.addMenuItem('Select', '🎯', (contextData) => {
            Logger.outliner.debug('Context menu: Select object', contextData.object?.name);
            this.callbacks.onSelect(contextData.object);
        }, { id: 'select' });

        this.addMenuItem('Rename', '✏️', (contextData) => {
            Logger.outliner.debug('Context menu: Rename object', contextData.object?.name);
            this.callbacks.onRename(contextData.object);
        }, { id: 'rename' });

        this.addMenuItem('Duplicate', '📋', (contextData) => {
            Logger.outliner.debug('Context menu: Duplicate object', contextData.object?.name);
            this.callbacks.onDuplicate(contextData.object);
        }, { id: 'duplicate' });

        this.addSeparator();

        this.addMenuItem('Toggle Visibility', '👁️', (contextData) => {
            Logger.outliner.debug('Context menu: Toggle visibility', contextData.object?.name);
            this.callbacks.onToggleVisibility(contextData.object);
        }, { id: 'visibility' });

        this.addSeparator();

        // Stacking order within sibling list / layer (same as Details order buttons)
        this.addMenuItem('Bring to Front', '⏫', () => {
            this.levelEditor?.objectOperations?.applyStackOrderActionToSelection?.('bringToFront');
        }, {
            id: 'bring-to-front',
            disabled: () => {
                const sel = this.levelEditor?.stateManager?.get('selectedObjects');
                return !(sel && sel.size > 0);
            },
            shortcut: () => this.resolveShortcut('editor', 'bringToFront')
        });
        this.addMenuItem('Send to Back', '⏬', () => {
            this.levelEditor?.objectOperations?.applyStackOrderActionToSelection?.('sendToBack');
        }, {
            id: 'send-to-back',
            disabled: () => {
                const sel = this.levelEditor?.stateManager?.get('selectedObjects');
                return !(sel && sel.size > 0);
            },
            shortcut: () => this.resolveShortcut('editor', 'sendToBack')
        });
        this.addMenuItem('Bring Forward', '🔼', () => {
            this.levelEditor?.objectOperations?.applyStackOrderActionToSelection?.('moveForward');
        }, {
            id: 'bring-forward',
            disabled: () => {
                const sel = this.levelEditor?.stateManager?.get('selectedObjects');
                return !(sel && sel.size > 0);
            },
            shortcut: () => this.resolveShortcut('editor', 'bringForward')
        });
        this.addMenuItem('Send Backward', '🔽', () => {
            this.levelEditor?.objectOperations?.applyStackOrderActionToSelection?.('moveBackward');
        }, {
            id: 'send-backward',
            disabled: () => {
                const sel = this.levelEditor?.stateManager?.get('selectedObjects');
                return !(sel && sel.size > 0);
            },
            shortcut: () => this.resolveShortcut('editor', 'sendBackward')
        });

        this.addSeparator();

        this.addMenuItem('Move Layer Up', '⬆', () => {
            this.levelEditor?.moveSelectedObjectsToLayer?.(true, false);
        }, {
            id: 'move-layer-up',
            disabled: () => !(this.levelEditor?.canMoveObjectsToLayer?.()),
            shortcut: () => this.resolveShortcut('editor', 'moveLayerUp')
        });

        this.addMenuItem('Move Layer Down', '⬇', () => {
            this.levelEditor?.moveSelectedObjectsToLayer?.(false, false);
        }, {
            id: 'move-layer-down',
            disabled: () => !(this.levelEditor?.canMoveObjectsToLayer?.()),
            shortcut: () => this.resolveShortcut('editor', 'moveLayerDown')
        });

        this.addSubmenuItem(
            'Move to Layer',
            '📑',
            () => this.levelEditor?.buildMoveToLayerMenuItems?.() || [],
            {
                id: 'move-to-layer',
                disabled: () => !(this.levelEditor?.canMoveObjectsToLayer?.())
            }
        );

        this.addSeparator();

        this.addMenuItem('Delete', '🗑️', (contextData) => {
            Logger.outliner.debug('Context menu: Delete object', contextData.object?.name);
            this.callbacks.onDelete(contextData.object);
        }, { id: 'delete' });

        // Global operations (always shown)
        this.addSeparator('global-separator');

        this.addMenuItem('Expand All Groups', '📂', (contextData) => {
            Logger.outliner.debug('Context menu: Expand all groups');
            this.callbacks.onExpandAllGroups();
        }, { id: 'expand-all' });

        this.addMenuItem('Collapse All Groups', '📁', (contextData) => {
            Logger.outliner.debug('Context menu: Collapse all groups');
            this.callbacks.onCollapseAllGroups();
        }, { id: 'collapse-all' });
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

        // Selection-based layer commands operate on selectedObjects
        this.ensureObjectInSelection(contextData);

        super.showContextMenu(e, contextData);
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
