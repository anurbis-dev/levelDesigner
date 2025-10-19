import { Logger } from './Logger.js';

/**
 * Utility class for managing search sections across panels
 */
export class SearchSectionUtils {
    
    /**
     * Find search section for a given tab (deprecated - search controls are now part of panels)
     * @param {string} tabName - Name of the tab (layers, outliner, etc.)
     * @returns {HTMLElement|null} - Always returns null as search is now part of panels
     */
    static findSearchSectionForTab(tabName) {
        Logger.ui.debug(`SearchSectionUtils.findSearchSectionForTab is deprecated for ${tabName} - search controls are now part of the panel structure`);
        return null;
    }
    
    /**
     * Show search section for a specific tab
     * @param {string} tabName - Name of the tab
     * @param {Object} editor - Editor instance with panels
     * @returns {boolean} - True if search controls were rendered, false otherwise
     */
    static showSearchSectionForTab(tabName, editor) {
        Logger.ui.debug('SearchSectionUtils: showSearchSectionForTab called for', tabName);
        const showSearch = tabName === 'layers' || tabName === 'outliner';
        if (!showSearch) {
            Logger.ui.debug(`No search controls needed for ${tabName} tab`);
            return false;
        }

        // Render appropriate search controls (now part of panel structure)
        if (tabName === 'layers' && editor.layersPanel) {
            Logger.ui.debug('SearchSectionUtils: Calling renderLayersSearchControls');
            editor.layersPanel.renderLayersSearchControls();
            Logger.ui.debug(`Layers search controls rendered for ${tabName} tab`);
            return true;
        } else if (tabName === 'outliner' && editor.outlinerPanel) {
            Logger.ui.debug('SearchSectionUtils: Calling renderOutlinerSearchControls');
            editor.outlinerPanel.renderOutlinerSearchControls();
            Logger.ui.debug(`Outliner search controls rendered for ${tabName} tab`);
            return true;
        }

        Logger.ui.warn(`Could not render search controls for ${tabName} tab - panel not found`);
        return false;
    }
    
    /**
     * Hide all search sections in both panels (deprecated - search controls are now part of panels)
     */
    static hideAllSearchSections() {
        Logger.ui.debug('SearchSectionUtils.hideAllSearchSections is deprecated - search controls are now part of panel structures');
        // No-op since search controls are managed by individual panels
    }
    
    /**
     * Get current active tab name
     * @returns {string|null} - Active tab name or null if not found
     */
    static getCurrentActiveTab() {
        const activeTab = document.querySelector('.tab-right.active, .tab-left.active');
        return activeTab ? activeTab.dataset.tab : null;
    }
    
    /**
     * Initialize search controls for the current active tab
     * @param {Object} editor - Editor instance with panels
     */
    static initializeSearchControls(editor) {
        const tabName = this.getCurrentActiveTab();
        Logger.ui.debug('SearchSectionUtils: initializeSearchControls called, active tab:', tabName);
        if (!tabName) {
            Logger.ui.warn('No active tab found for search controls initialization');
            return;
        }

        this.showSearchSectionForTab(tabName, editor);
    }
}
