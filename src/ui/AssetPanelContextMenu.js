/**
 * AssetPanelContextMenu - Context menu handler for empty space in asset panel
 * 
 * This module provides a context menu system for empty space in the asset panel
 * that allows users to manage panel settings and view options.
 * 
 * Features:
 * - Right-click context menu on empty panel space
 * - Panel-specific operations (view options, settings, etc.)
 * - Integration with BaseContextMenu architecture
 * 
 * Usage:
 * ```javascript
 * const contextMenu = new AssetPanelContextMenu(assetPanel, {
 *     onResetSize: () => console.log('Resetting asset size'),
 *     onToggleGrid: () => console.log('Toggling grid view')
 * });
 * ```
 * 
 * @author Level Designer
 * @version dynamic
 */

import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';

export class AssetPanelContextMenu extends BaseContextMenu {
    constructor(assetPanel, callbacks = {}) {
        // Ensure previewsContainer exists before initializing
        if (!assetPanel.previewsContainer) {
            Logger.ui.warn('AssetPanelContextMenu: previewsContainer not found, deferring initialization');
            // Store parameters for later initialization
            this._deferredInit = { assetPanel, callbacks };
            return;
        }

        super(assetPanel.previewsContainer, {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            onResetSize: callbacks.onResetSize || (() => {}),
            onToggleGrid: callbacks.onToggleGrid || (() => {}),
            onToggleList: callbacks.onToggleList || (() => {}),
            onToggleDetails: callbacks.onToggleDetails || (() => {}),
            onRefresh: callbacks.onRefresh || (() => {}),
            onSettings: callbacks.onSettings || (() => {}),
            onSelectAll: callbacks.onSelectAll || (() => {}),
            onDeselectAll: callbacks.onDeselectAll || (() => {}),
            stateManager: callbacks.stateManager || null
        });

        this.assetPanel = assetPanel;
        this.setupMenuItems();
        Logger.ui.info('AssetPanelContextMenu initialized successfully');
    }

    /**
     * Complete deferred initialization
     */
    completeDeferredInit() {
        if (this._deferredInit) {
            const { assetPanel, callbacks } = this._deferredInit;

            Logger.ui.info('Completing deferred AssetPanelContextMenu initialization');

            // Call the constructor logic again now that previewsContainer exists
            BaseContextMenu.call(this, assetPanel.previewsContainer, {
                onMenuShow: callbacks.onMenuShow || (() => {}),
                onMenuHide: callbacks.onMenuHide || (() => {}),
                onItemClick: callbacks.onItemClick || (() => {}),
                onResetSize: callbacks.onResetSize || (() => {}),
                onToggleGrid: callbacks.onToggleGrid || (() => {}),
                onToggleList: callbacks.onToggleList || (() => {}),
                onToggleDetails: callbacks.onToggleDetails || (() => {}),
                onRefresh: callbacks.onRefresh || (() => {}),
                onSettings: callbacks.onSettings || (() => {}),
                onSelectAll: callbacks.onSelectAll || (() => {}),
                onDeselectAll: callbacks.onDeselectAll || (() => {}),
                stateManager: callbacks.stateManager || null
            });

            this.assetPanel = assetPanel;
            this.setupMenuItems();

            // Clean up
            delete this._deferredInit;

            Logger.ui.info('AssetPanelContextMenu deferred initialization completed');
        }
    }

    /**
     * Override extractContextData to check if click was on empty space
     * @param {Element} target - The clicked element
     * @returns {Object} - Context data
     */
    extractContextData(target) {
        const contextData = super.extractContextData(target);
        
        // Check if click was on empty space (not on asset thumbnail)
        const assetThumbnail = target.closest('.asset-thumbnail');
        contextData.isEmptySpace = !assetThumbnail;
        contextData.isGridContainer = target.classList.contains('grid') || target.closest('.grid');
        
        return contextData;
    }

    /**
     * Override shouldShowMenuItem to only show menu on empty space
     * @param {Object} item - Menu item
     * @param {Object} contextData - Context data
     * @returns {boolean} - Whether to show the item
     */
    shouldShowMenuItem(item, contextData) {
        // Only show menu on empty space
        if (!contextData.isEmptySpace) return false;
        
        return super.shouldShowMenuItem(item, contextData);
    }

    /**
     * Override showContextMenu to prevent showing if asset menu should be shown
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data from clicked element
     */
    showContextMenu(event, contextData) {
        // Don't show panel menu if click was on an asset
        if (!contextData.isEmptySpace) {
            return;
        }
        
        super.showContextMenu(event, contextData);
    }

    /**
     * Override createContextMenu to add panel-specific CSS class
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
     * Setup menu items for panel operations
     */
    setupMenuItems() {
        // View options
        this.addMenuItem('Reset Asset Size', '🔄', () => {
            this.callbacks.onResetSize();
        });

        this.addSeparator();

        this.addMenuItem('Grid View', '⊞', () => {
            this.callbacks.onToggleGrid();
        });

        this.addMenuItem('List View', '☰', () => {
            this.callbacks.onToggleList();
        });

        this.addMenuItem('Details View', '📋', () => {
            this.callbacks.onToggleDetails();
        });

        this.addSeparator();

        // Swap panels command
        this.addMenuItem('Swap Panels', '⇄', () => {
            this.assetPanel.toggleFoldersPosition();
        });

        this.addSeparator();

        // Selection operations
        this.addMenuItem('Select All Assets', '☑️', () => {
            this.callbacks.onSelectAll();
        });

        this.addSeparator();

        // Panel operations
        this.addMenuItem('Refresh Assets', '🔄', () => {
            this.callbacks.onRefresh();
        });

        this.addMenuItem('Panel Settings', '⚙️', () => {
            this.callbacks.onSettings();
        });
    }
}
