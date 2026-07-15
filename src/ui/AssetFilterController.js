import { Logger } from '../utils/Logger.js';
import { createSearchInput } from './panel-structures/BasePanelStructure.js';
import { searchManager } from '../utils/SearchManager.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { openTypeFilterMenu, hasActiveTypeFilters } from '../utils/TypeFilterMenu.js';

/**
 * Search/filter controls for AssetPanel — search input, type-filter menu, filtering logic.
 * Extracted from AssetPanel.js — search/type filters.
 */
export class AssetFilterController {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    /**
     * Render asset search and filter controls in the tabs footer
     */
    renderAssetSearchControls() {
        const assetPanel = this.assetPanel;

        // Get right container for controls
        const tabsRightContainer = assetPanel.tabsContainer?.querySelector('#asset-tabs-right');
        if (!tabsRightContainer) {
            // If structure not created yet, create it
            if (assetPanel.tabsContainer) {
                const tabsLeft = document.createElement('div');
                tabsLeft.id = 'asset-tabs-left';
                tabsLeft.className = 'flex flex-1';

                const tabsRight = document.createElement('div');
                tabsRight.id = 'asset-tabs-right';
                tabsRight.className = 'flex items-center flex-shrink-0';

                // Check if container already has content
                if (assetPanel.tabsContainer.children.length > 0) {
                    // Preserve existing content
                    const existingContent = Array.from(assetPanel.tabsContainer.children);
                    assetPanel.tabsContainer.innerHTML = '';
                    assetPanel.tabsContainer.appendChild(tabsLeft);

                    // Move existing tabs to left container
                    existingContent.forEach(child => {
                        if (child.classList.contains('tab')) {
                            tabsLeft.appendChild(child);
                        } else {
                            tabsRight.appendChild(child);
                        }
                    });
                } else {
                    assetPanel.tabsContainer.innerHTML = '';
                    assetPanel.tabsContainer.appendChild(tabsLeft);
                }

                assetPanel.tabsContainer.appendChild(tabsRight);
                Logger.ui.debug('AssetPanel: Created tabs structure in renderAssetSearchControls');

                // Retry with new container
                return this.renderAssetSearchControls();
            }

            Logger.ui.warn('AssetPanel: tabsRightContainer not found and cannot create structure');
            return;
        }

        const searchPanelId = assetPanel.searchPanelId || 'assets';
        const searchInputId = assetPanel.searchInputId || 'assets-search';

        // Check if controls are already rendered (avoid unnecessary re-rendering)
        const existingControls = tabsRightContainer.querySelector('#asset-search-controls')
            || tabsRightContainer.querySelector('[data-asset-search-controls]');
        if (existingControls) {
            // Controls already exist, just update search value
            const searchInput = existingControls.querySelector(`#${searchInputId}`)
                || existingControls.querySelector('input[type="text"]');
            if (searchInput) {
                const currentTerm = searchManager.getSearchTerm(searchPanelId);
                if (searchInput.value !== currentTerm) {
                    searchInput.value = currentTerm;
                }
            }
            return;
        }

        // Create controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.id = assetPanel.instanceKey
            ? `asset-search-controls-${assetPanel.instanceKey}`
            : 'asset-search-controls';
        controlsContainer.dataset.assetSearchControls = '1';
        controlsContainer.className = 'flex items-center justify-end gap-1 p-1 border-t border-gray-700 bg-gray-800';

        // Create search input with ESC support
        const searchInput = createSearchInput(
            'Search assets...',
            searchInputId,
            'w-32 bg-gray-700 px-2 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none',
            searchManager.getSearchTerm(searchPanelId) || '',
            (searchTerm) => {
                // Direct callback for immediate filtering
                assetPanel.searchTerm = searchTerm;
                Logger.ui.debug('Asset search term changed directly:', searchTerm);
                assetPanel.viewRenderer.renderPreviews();
            }
        );

        // Create filter button
        const filterButton = document.createElement('button');
        filterButton.id = assetPanel.instanceKey
            ? `assets-filter-btn-${assetPanel.instanceKey}`
            : 'assets-filter-btn';
        filterButton.className = 'px-2 py-1 rounded text-sm flex items-center justify-center bg-gray-600 hover:bg-gray-700';
        filterButton.title = 'Filter by asset types';
        this._syncFilterButton(filterButton);

        filterButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 3h8l-3 3v3l-2 1V6L2 3z"/>
            </svg>
        `;

        filterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAssetFilterMenu(filterButton);
        });

        controlsContainer.appendChild(searchInput);
        controlsContainer.appendChild(filterButton);
        tabsRightContainer.appendChild(controlsContainer);

        Logger.ui.debug('Asset search controls rendered in tabs footer');
    }

    /**
     * Collect type labels available for filtering.
     * @returns {string[]}
     */
    _collectAssetTypes() {
        const assetPanel = this.assetPanel;
        const allAssets = Array.from(assetPanel.assetManager.assets.values());
        let allTypes = [...new Set(allAssets.map((asset) => asset.type).filter(Boolean))];
        if (allTypes.length === 0) {
            allTypes = Array.from(assetPanel.assetManager.categories || []);
        }
        return allTypes;
    }

    /**
     * Type filter menu — shared TypeFilterMenu (apply each click, menu stays open, no Ctrl).
     * @param {HTMLElement} button
     */
    showAssetFilterMenu(button) {
        const assetPanel = this.assetPanel;
        const allTypes = this._collectAssetTypes();
        if (allTypes.length === 0) {
            Logger.ui.warn('No asset types or categories available for filtering');
            return;
        }

        openTypeFilterMenu({
            anchor: button,
            types: allTypes,
            filters: assetPanel.activeTypeFilters,
            onChange: (filters) => {
                assetPanel.activeTypeFilters = filters;
                assetPanel.viewRenderer.renderPreviews();
                this._syncFilterButton(button);
            },
            position: { menuWidth: 192, menuHeight: 200 }
        });
    }

    /** @param {HTMLElement} button */
    _syncFilterButton(button) {
        if (!button) return;
        const assetPanel = this.assetPanel;
        const active = hasActiveTypeFilters(assetPanel.activeTypeFilters);
        button.className = `px-2 py-1 rounded text-sm flex items-center justify-center ${
            active ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
        }`;
        button.title = active ? 'Filter active - click to change' : 'Filter by asset types';
    }

    /**
     * Check if asset should be shown based on filters
     */
    shouldShowAsset(asset) {
        const assetPanel = this.assetPanel;

        // If no filters active (size === 0), show all
        if (assetPanel.activeTypeFilters.size === 0) {
            return true;
        }

        // If DISABLE_ALL is active, show nothing
        if (assetPanel.activeTypeFilters.has('DISABLE_ALL')) {
            return false;
        }

        // Check if asset type is in active filters
        const assetType = asset.type || asset.category;
        return assetPanel.activeTypeFilters.has(assetType);
    }

    /**
     * Clear search filter
     */
    clearSearch() {
        const assetPanel = this.assetPanel;
        if (assetPanel.searchTerm) {
            assetPanel.searchTerm = '';
            // Update search manager
            if (typeof searchManager !== 'undefined' && searchManager.setSearchTerm) {
                searchManager.setSearchTerm('assets', '');
            }
            assetPanel.viewRenderer.renderPreviews();
        }
    }

    filterAssets(assets) {
        const assetPanel = this.assetPanel;
        let filtered = assets;

        // Apply search filter first
        if (assetPanel.searchTerm) {
            filtered = SearchUtils.filterObjects(filtered, assetPanel.searchTerm, 'name');
        }

        // Apply type filter only if there are active filters
        if (assetPanel.activeTypeFilters.size > 0) {
            filtered = filtered.filter((asset) => this.shouldShowAsset(asset));
        }

        return filtered;
    }
}
