import { Logger } from '../utils/Logger.js';

/**
 * Toolbar controls for AssetPanel — asset size zoom, view mode switching, size/view-mode
 * persistence, panel toolbar action handlers (reset size, toggle view, refresh, settings).
 * Extracted from AssetPanel.js — Фаза 4.7 рефакторинга (tmp/2D_Editor_REFACTOR_PLAN.md).
 */
export class AssetToolbarController {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    /**
     * Decrease asset size
     */
    decreaseAssetSize() {
        const assetPanel = this.assetPanel;
        const newSize = Math.max(assetPanel.minAssetSize, assetPanel.assetSize - assetPanel.sizeStep);
        if (newSize !== assetPanel.assetSize) {
            assetPanel.assetSize = newSize;
            this.saveAssetSize();
            assetPanel.render();
        }
    }

    /**
     * Increase asset size
     */
    increaseAssetSize() {
        const assetPanel = this.assetPanel;
        const newSize = Math.min(assetPanel.maxAssetSize, assetPanel.assetSize + assetPanel.sizeStep);
        if (newSize !== assetPanel.assetSize) {
            assetPanel.assetSize = newSize;
            this.saveAssetSize();
            assetPanel.render();
        }
    }

    /**
     * Set view mode
     * @param {string} mode - View mode ('grid', 'list', 'details')
     */
    setViewMode(mode) {
        const assetPanel = this.assetPanel;
        if (['grid', 'list', 'details'].includes(mode)) {
            assetPanel.viewMode = mode;
            this.saveViewMode();
            assetPanel.render();
            Logger.ui.debug('View mode changed to:', mode);
        }
    }

    /**
     * Load asset size from user preferences
     */
    loadAssetSize() {
        const assetPanel = this.assetPanel;
        const savedSize = assetPanel.levelEditor?.userPrefs?.get('assetSize');
        if (savedSize && typeof savedSize === 'number' && savedSize >= assetPanel.minAssetSize && savedSize <= assetPanel.maxAssetSize) {
            Logger.ui.debug('Loaded asset size from preferences:', savedSize);
            return savedSize;
        }
        Logger.ui.debug('Using default asset size:', 96);
        return 96; // Default size
    }

    /**
     * Save asset size to user preferences
     */
    saveAssetSize() {
        const assetPanel = this.assetPanel;
        if (assetPanel.levelEditor?.userPrefs) {
            assetPanel.levelEditor.userPrefs.set('assetSize', assetPanel.assetSize);
            Logger.ui.debug('Saved asset size to preferences:', assetPanel.assetSize);
        }
    }

    /**
     * Load view mode from user preferences
     */
    loadViewMode() {
        const assetPanel = this.assetPanel;
        const savedMode = assetPanel.levelEditor?.userPrefs?.get('assetViewMode');
        if (savedMode && ['grid', 'list', 'details'].includes(savedMode)) {
            Logger.ui.debug('Loaded asset view mode from preferences:', savedMode);
            return savedMode;
        }
        Logger.ui.debug('Using default asset view mode: grid');
        return 'grid'; // Default mode
    }

    /**
     * Save view mode to user preferences
     */
    saveViewMode() {
        const assetPanel = this.assetPanel;
        if (assetPanel.levelEditor?.userPrefs) {
            assetPanel.levelEditor.userPrefs.set('assetViewMode', assetPanel.viewMode);
            Logger.ui.debug('Saved asset view mode to preferences:', assetPanel.viewMode);
        }
    }

    /**
     * Handle reset asset size
     */
    handleResetSize() {
        Logger.ui.debug('Resetting asset size');
        this.assetPanel.assetSize = 96;
        this.assetPanel.render();
    }

    /**
     * Handle toggle grid view
     */
    handleToggleGrid() {
        const assetPanel = this.assetPanel;
        Logger.ui.debug('Switching to grid view');
        assetPanel.viewMode = 'grid';
        this.saveViewMode();
        assetPanel.render();
        // Auto-resize panel height after view mode change
        setTimeout(() => assetPanel.autoResizePanelHeight(), 100);
    }

    /**
     * Handle toggle list view
     */
    handleToggleList() {
        const assetPanel = this.assetPanel;
        Logger.ui.debug('Switching to list view');
        assetPanel.viewMode = 'list';
        this.saveViewMode();
        assetPanel.render();
        // Auto-resize panel height after view mode change
        setTimeout(() => assetPanel.autoResizePanelHeight(), 100);
    }

    /**
     * Handle toggle details view
     */
    handleToggleDetails() {
        const assetPanel = this.assetPanel;
        Logger.ui.debug('Switching to details view');
        assetPanel.viewMode = 'details';
        this.saveViewMode();
        assetPanel.render();
        // Auto-resize panel height after view mode change
        setTimeout(() => assetPanel.autoResizePanelHeight(), 100);
    }

    /**
     * Handle refresh assets
     */
    handleRefresh() {
        Logger.ui.debug('Refreshing assets');
        this.assetPanel.render();
    }

    /**
     * Handle panel settings
     */
    handleSettings() {
        Logger.ui.debug('Opening panel settings');
        // TODO: Implement panel settings
    }
}
