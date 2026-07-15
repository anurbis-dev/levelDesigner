import { Logger } from '../utils/Logger.js';

/**
 * Asset selection for AssetPanel — selection container/list for BasePanel's selection
 * mixin, select-all/deselect-all, external asset-selection entry point (FoldersPanel).
 * Extracted from AssetPanel.js — asset multi-select helpers.
 */
export class AssetSelectionController {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    /**
     * Select specific asset
     */
    selectAsset(assetId) {
        const assetPanel = this.assetPanel;

        if (!assetId) {
            Logger.ui.warn('AssetPanel: selectAsset called with invalid assetId');
            return;
        }

        if (!assetPanel.assetManager || !assetPanel.assetManager.assets) {
            Logger.ui.error('AssetPanel: assetManager or assets not available');
            return;
        }

        const asset = assetPanel.assetManager.assets.get(assetId);
        if (!asset) {
            Logger.ui.warn('AssetPanel: Asset not found:', assetId);
            return;
        }

        // Find folder path for this asset
        let folderPath = 'root';
        if (asset.path) {
            // Extract folder path from asset path
            const pathParts = asset.path.split('/').slice(0, -1); // Remove filename
            if (pathParts.length > 0) {
                folderPath = 'root/' + pathParts.join('/');
            }
        }

        // Delegate tab activation to tabsManager/foldersPanel
        if (assetPanel.foldersPanel) {
            assetPanel.foldersPanel.selectFolder(folderPath, null);
        }

        // Select the asset (per-instance selection key)
        const selKey = assetPanel.uiStateKey('selectedAssets');
        const selectedAssets = assetPanel.stateManager.get(selKey) || new Set();
        selectedAssets.add(assetId);
        assetPanel.stateManager.set(selKey, selectedAssets);

        // Scroll to and highlight the asset
        setTimeout(() => {
            if (assetPanel.previewsContainer) {
                const assetElement = assetPanel.previewsContainer.querySelector(`[data-asset-id="${assetId}"]`);
                if (assetElement) {
                    assetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    assetElement.classList.add('ring-2', 'ring-blue-500');
                    setTimeout(() => {
                        assetElement.classList.remove('ring-2', 'ring-blue-500');
                    }, 2000);
                }
            }
        }, 100);

        Logger.ui.debug('Selected asset from folders panel:', assetId);
    }

    /**
     * Get container for selection operations
     * @returns {HTMLElement|null} - The selection container
     */
    getSelectionContainer() {
        return this.assetPanel.previewsContainer;
    }

    /**
     * Get list of assets for selection operations
     * @returns {Array} Array of asset objects
     */
    getAssetList() {
        const assetPanel = this.assetPanel;

        // Support multiple folder selection
        const folderPathsToShow = assetPanel.foldersController.getActiveTabPaths();

        // Collect assets from all selected folders
        const allAssets = [];
        for (const folderPath of folderPathsToShow) {
            const folderAssets = assetPanel.foldersController.getAssetsFromFolder(folderPath);
            allAssets.push(...folderAssets);
        }

        // Remove duplicates by asset ID
        return Array.from(new Map(allAssets.map(asset => [asset.id, asset])).values());
    }

    /**
     * Get selectable asset elements for marquee selection
     * @returns {Array} Array of selectable elements
     */
    getSelectableAssetElements() {
        // Search in all possible containers (grid, list, details)
        const selectors = [
            '.asset-thumbnail[data-asset-id]',  // Grid view
            '.asset-list-item[data-asset-id]',  // List view
            '.asset-details-row[data-asset-id]' // Details view
        ];

        const elements = [];
        selectors.forEach(selector => {
            const found = this.assetPanel.previewsContainer.querySelectorAll(selector);
            elements.push(...Array.from(found));
        });

        Logger.ui.debug(`Found ${elements.length} selectable asset elements`);
        return elements;
    }

    /**
     * Update selection visuals without re-rendering entire content
     */
    updateSelectionVisuals() {
        const assetPanel = this.assetPanel;
        const selectedAssets = assetPanel.stateManager.get(assetPanel.uiStateKey('selectedAssets')) || new Set();
        const root = assetPanel.previewsContainer || assetPanel.container;
        if (!root) return;

        // Scope to this panel only (multi-instance copies)
        const selectors = ['.asset-thumbnail', '.asset-list-item', '.asset-details-row'];

        selectors.forEach(selector => {
            root.querySelectorAll(selector).forEach(element => {
                const assetId = element.dataset.assetId;
                if (assetId) {
                    if (selectedAssets.has(assetId)) {
                        element.classList.add('selected');
                    } else {
                        element.classList.remove('selected');
                    }
                }
            });
        });
    }

    /**
     * Handle select all assets
     */
    handleSelectAll() {
        const assetPanel = this.assetPanel;
        Logger.ui.debug('Selecting all assets');

        // Get assets from currently active folder(s)
        const folderPaths = assetPanel.foldersController.getActiveTabPaths();
        const allAssets = [];

        for (const folderPath of folderPaths) {
            const folderAssets = assetPanel.foldersController.getAssetsFromFolder(folderPath);
            allAssets.push(...folderAssets);
        }

        // Remove duplicates by asset ID
        const uniqueAssets = Array.from(new Map(allAssets.map(asset => [asset.id, asset])).values());
        const allAssetIds = new Set(uniqueAssets.map(asset => asset.id));

        assetPanel.stateManager.set(assetPanel.uiStateKey('selectedAssets'), allAssetIds);
    }

    /**
     * Handle deselect all assets
     */
    handleDeselectAll() {
        Logger.ui.debug('Deselecting all assets');
        const assetPanel = this.assetPanel;
        assetPanel.stateManager.set(assetPanel.uiStateKey('selectedAssets'), new Set());
        // Force immediate visual update after deselect
        this.updateSelectionVisuals();
    }
}
