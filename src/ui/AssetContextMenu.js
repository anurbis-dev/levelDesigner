/**
 * AssetContextMenu - Context menu handler for asset thumbnails
 * 
 * This module provides a context menu system for asset thumbnails
 * that allows users to interact with individual assets.
 * 
 * Features:
 * - Right-click context menu on asset thumbnails
 * - Asset-specific operations (copy, duplicate, delete, etc.)
 * - Integration with BaseContextMenu architecture
 * 
 * Usage:
 * ```javascript
 * const contextMenu = new AssetContextMenu(assetPanel, {
 *     onCopy: (asset) => console.log('Copying asset:', asset),
 *     onDelete: (asset) => console.log('Deleting asset:', asset)
 * });
 * ```
 * 
 * @author Level Designer
 * @version dynamic
 */

import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';

export class AssetContextMenu extends BaseContextMenu {
    constructor(assetPanel, callbacks = {}) {
        super(assetPanel.previewsContainer, {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            onOpenEditor: callbacks.onOpenEditor || (() => {}),
            onRename: callbacks.onRename || (() => {}),
            onDuplicate: callbacks.onDuplicate || (() => {}),
            onDelete: callbacks.onDelete || (() => {})
        });

        this.assetPanel = assetPanel;
        this.setupMenuItems();
        Logger.ui.info('AssetContextMenu initialized successfully');
    }

    /**
     * Override extractContextData to extract asset information
     * @param {Element} target - The clicked element
     * @returns {Object} - Context data including asset info
     */
    extractContextData(target) {
        const contextData = super.extractContextData(target);
        
        // Find the asset thumbnail element
        const assetThumbnail = target.closest('.asset-thumbnail');
        if (assetThumbnail) {
            const assetId = assetThumbnail.dataset.assetId;
            const asset = this.assetPanel.assetManager.getAsset(assetId);
            
            contextData.asset = asset;
            contextData.assetId = assetId;
            contextData.assetThumbnail = assetThumbnail;
            contextData.isAsset = true;
        } else {
            contextData.isAsset = false;
        }
        
        return contextData;
    }

    /**
     * Override shouldShowMenuItem to only show menu on assets
     * @param {Object} item - Menu item
     * @param {Object} contextData - Context data
     * @returns {boolean} - Whether to show the item
     */
    shouldShowMenuItem(item, contextData) {
        // Only show menu if click was on an asset
        if (!contextData.isAsset) return false;
        
        return super.shouldShowMenuItem(item, contextData);
    }

    /**
     * Override showContextMenu to prevent showing if click was not on asset
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data from clicked element
     */
    showContextMenu(event, contextData) {
        // Don't show asset menu if click was not on an asset
        if (!contextData.isAsset) {
            return;
        }
        
        super.showContextMenu(event, contextData);
    }

    /**
     * Override createContextMenu to add asset-specific CSS class
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - The context menu element
     */
    createContextMenu(event, contextData) {
        const contextMenu = super.createContextMenu(event, contextData);
        contextMenu.classList.add('assets-panel');
        return contextMenu;
    }

    /**
     * Setup menu items for asset operations
     */
    setupMenuItems() {
        // Open Asset Editor
        this.addMenuItem('Open Asset Editor', '🎨', (contextData) => {
            this.callbacks.onOpenEditor(contextData.asset);
        });

        this.addSeparator();

        // Rename asset
        this.addMenuItem('Rename', '✏️', (contextData) => {
            this.callbacks.onRename(contextData.asset);
        });

        // Duplicate asset
        this.addMenuItem('Duplicate', '🔄', (contextData) => {
            this.callbacks.onDuplicate(contextData.asset);
        });

        this.addSeparator();

        // Delete asset
        this.addMenuItem('Delete', '🗑️', (contextData) => {
            this.callbacks.onDelete(contextData.asset);
        });
    }
}
