import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';

/**
 * RMB on the Assets Content tree: New Folder / Delete Folder.
 */
export class FoldersContextMenu extends BaseContextMenu {
    constructor(container, foldersPanel, callbacks = {}) {
        super(container, {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            onNewFolder: callbacks.onNewFolder || (() => {}),
            onDeleteFolder: callbacks.onDeleteFolder || (() => {}),
            stateManager: callbacks.stateManager || null
        });
        this.foldersPanel = foldersPanel;
        this.setupMenuItems();
        Logger.ui.info('FoldersContextMenu initialized');
    }

    extractContextData(target) {
        const contextData = super.extractContextData(target);
        const item = target.closest('.folder-item');
        if (item?.dataset?.path) {
            contextData.folderPath = item.dataset.path;
            contextData.isFolder = true;
        } else {
            const selected = this.foldersPanel?.selectedFolders;
            const first = selected instanceof Set ? Array.from(selected)[0] : null;
            contextData.folderPath = first || 'root';
            contextData.isFolder = true;
        }
        contextData.isRoot = contextData.folderPath === 'root';
        return contextData;
    }

    createContextMenu(event, contextData) {
        const menu = super.createContextMenu(event, contextData);
        menu.classList.add('assets-panel');
        return menu;
    }

    setupMenuItems() {
        this.addMenuItem('New Folder', '📁', (ctx) => {
            this.callbacks.onNewFolder(ctx.folderPath || 'root');
        });
        this.addMenuItem('Delete Folder', '🗑️', (ctx) => {
            this.callbacks.onDeleteFolder(ctx.folderPath);
        }, (ctx) => !ctx.isRoot);
    }
}
