/**
 * LevelsContextMenu - Context menu handler for levels (mirrors LayersContextMenu.js)
 *
 * Make Current / Rename / Close are backed by LevelsManager. Save/Duplicate per
 * individual (possibly non-current) level are deferred (Phase 6) — Save currently
 * only makes sense for the current level (File menu).
 */

import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';

export class LevelsContextMenu extends BaseContextMenu {
    constructor(container, levelsPanel, callbacks = {}) {
        super(container, {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            onMakeCurrent: callbacks.onMakeCurrent || (() => {}),
            onRename: callbacks.onRename || (() => {}),
            onClose: callbacks.onClose || (() => {})
        });

        this.levelsPanel = levelsPanel;
        this.setupMenuItems();
        Logger.ui.info('LevelsContextMenu initialized successfully');
    }

    /**
     * Override extractContextData to extract level information
     * @param {Element} target - The clicked element
     * @returns {Object} - Context data including level info
     */
    extractContextData(target) {
        const contextData = super.extractContextData(target);

        const levelElement = target.closest('.level-item') || target.closest('[data-level-id]');
        if (levelElement) {
            const levelId = levelElement.dataset.levelId;
            const session = this.levelsPanel.levelEditor.levelSessions.get(levelId);

            contextData.session = session;
            contextData.levelId = levelId;
            contextData.levelElement = levelElement;
            contextData.isLevel = true;
            contextData.isCurrent = levelId === this.levelsPanel.levelEditor.currentLevelId;
        } else {
            contextData.isLevel = false;
        }

        return contextData;
    }

    /**
     * Override shouldShowMenuItem to only show menu on levels
     * @param {Object} item - Menu item
     * @param {Object} contextData - Context data
     * @returns {boolean} - Whether to show the item
     */
    shouldShowMenuItem(item, contextData) {
        if (!contextData.isLevel) return false;
        return super.shouldShowMenuItem(item, contextData);
    }

    /**
     * Override showContextMenu to prevent showing if click was not on a level
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data from clicked element
     */
    showContextMenu(event, contextData) {
        if (!contextData.isLevel) {
            return;
        }
        super.showContextMenu(event, contextData);
    }

    /**
     * Override createContextMenu to add levels-specific CSS class
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - The context menu element
     */
    createContextMenu(event, contextData) {
        const contextMenu = super.createContextMenu(event, contextData);
        contextMenu.classList.add('levels-panel');
        return contextMenu;
    }

    /**
     * Setup menu items for level operations
     */
    setupMenuItems() {
        // Make Current Level
        this.addMenuItem('Make Current', '🎯', (contextData) => {
            this.callbacks.onMakeCurrent(contextData.session);
        }, {
            disabled: (context) => context.isCurrent
        });

        this.addSeparator();

        // Rename Level
        this.addMenuItem('Rename', '✏️', (contextData) => {
            this.callbacks.onRename(contextData.session);
        });

        this.addSeparator();

        // Close Level
        this.addMenuItem('Close', '✕', (contextData) => {
            this.callbacks.onClose(contextData.session);
        }, {
            disabled: () => this.levelsPanel.levelEditor.levelSessions.size === 1,
            className: 'text-red-400 hover:bg-red-600'
        });
    }
}
