import { Logger } from '../utils/Logger.js';
import { AssetContextMenu } from './AssetContextMenu.js';
import { AssetPanelContextMenu } from './AssetPanelContextMenu.js';

/**
 * Context-menu/click actions for AssetPanel — context menu wiring, item click/double-click,
 * asset open/rename/duplicate/delete stubs.
 * Extracted from AssetPanel.js — context menus / open / explorer.
 * Note: onSaveAsset/onSaveAssetChanges/onShowInExplorer and the panel-context-menu callbacks
 * (reset size, toggle view, refresh, settings, select/deselect all) call back into AssetPanel
 * directly — that logic isn't part of this phase's method list and stays where it is.
 */
export class AssetItemActionsController {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    /**
     * Setup context menus for assets and panel
     */
    setupContextMenus() {
        const assetPanel = this.assetPanel;

        // Asset context menu
        assetPanel.assetContextMenu = new AssetContextMenu(assetPanel, {
            stateManager: assetPanel.stateManager, // Pass StateManager for marquee check
            onOpenEditor: (asset) => this.handleAssetOpenEditor(asset),
            onRename: (asset) => this.handleAssetRename(asset),
            onDuplicate: (asset) => this.handleAssetDuplicate(asset),
            onSaveAsset: (asset) => assetPanel.handleAssetSave(asset),
            onSaveAssetChanges: (asset) => assetPanel.handleAssetSaveChanges(asset),
            onShowInExplorer: (asset) => assetPanel.handleAssetShowInExplorer(asset),
            onDelete: (asset) => this.handleAssetDelete(asset),
            disableGlobalHandlers: true // Disable global handlers since we use delegated events
        });

        // Panel context menu
        assetPanel.panelContextMenu = new AssetPanelContextMenu(assetPanel, {
            stateManager: assetPanel.stateManager, // Pass StateManager for marquee check
            onResetSize: () => assetPanel.handleResetSize(),
            onToggleGrid: () => assetPanel.handleToggleGrid(),
            onToggleList: () => assetPanel.handleToggleList(),
            onToggleDetails: () => assetPanel.handleToggleDetails(),
            onRefresh: () => assetPanel.handleRefresh(),
            onSettings: () => assetPanel.handleSettings(),
            onSelectAll: () => assetPanel.selectionController.handleSelectAll(),
            onDeselectAll: () => assetPanel.selectionController.handleDeselectAll(),
            disableGlobalHandlers: true // Disable global handlers since we use delegated events
        });

        // Complete deferred initialization for context menus
        if (assetPanel.assetContextMenu && assetPanel.assetContextMenu.completeDeferredInit) {
            assetPanel.assetContextMenu.completeDeferredInit();
        }
        if (assetPanel.panelContextMenu && assetPanel.panelContextMenu.completeDeferredInit) {
            assetPanel.panelContextMenu.completeDeferredInit();
        }

        // Register context menus with ContextMenuManager for global resize handling
        if (assetPanel.levelEditor && assetPanel.levelEditor.contextMenuManager) {
            if (assetPanel.assetContextMenu) {
                assetPanel.levelEditor.contextMenuManager.registerMenu('asset', assetPanel.assetContextMenu);
            }
            if (assetPanel.panelContextMenu) {
                assetPanel.levelEditor.contextMenuManager.registerMenu('assetPanel', assetPanel.panelContextMenu);
            }
            // AssetTabContextMenu handles events through delegation, no global registration needed
        }
    }

    /**
     * Handle asset open editor
     * @param {Object} asset - The asset to open in editor
     */
    handleAssetOpenEditor(asset) {
        Logger.ui.debug('Opening asset editor for:', asset.name);
        // TODO: Implement asset editor functionality
    }

    /**
     * Handle asset rename
     * @param {Object} asset - The asset to rename
     */
    handleAssetRename(asset) {
        Logger.ui.debug('Renaming asset:', asset.name);
        // TODO: Implement asset rename functionality
    }

    /**
     * Handle asset duplicate
     * @param {Object} asset - The asset to duplicate
     */
    handleAssetDuplicate(asset) {
        Logger.ui.debug('Duplicating asset:', asset.name);
        // TODO: Implement asset duplicate functionality
    }

    /**
     * Handle asset delete
     * @param {Object} asset - The asset to delete
     */
    handleAssetDelete(asset) {
        Logger.ui.debug('Deleting asset:', asset.name);
        // TODO: Implement asset delete functionality
    }

    /**
     * Handle item double click
     * @param {Event} e - Double click event
     * @param {Object} asset - Asset that was double clicked
     */
    handleItemDoubleClick(e, asset) {
        const assetPanel = this.assetPanel;
        e.preventDefault();
        e.stopPropagation();

        if (!asset) {
            Logger.ui.warn('Cannot handle double click: no asset provided');
            return;
        }

        // Open Asset Properties Panel
        if (assetPanel.levelEditor && assetPanel.levelEditor.showActorPropertiesPanel) {
            assetPanel.levelEditor.showActorPropertiesPanel(asset);
            Logger.ui.info(`Double-clicked asset: ${asset.name}, opening Asset Properties Panel`);
        } else {
            Logger.ui.warn('LevelEditor or showActorPropertiesPanel method not available');
        }
    }

    // Selection / dblclick live on AssetViewRenderer (mousedown + dblclick).
    // Dead panel-click detail===2 path removed after dock multi-instance.
}
