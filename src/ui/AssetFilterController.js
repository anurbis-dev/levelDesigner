import { Logger } from '../utils/Logger.js';
import { createSearchInput } from './panel-structures/BasePanelStructure.js';
import { searchManager } from '../utils/SearchManager.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { MenuPositioningUtils } from '../utils/MenuPositioningUtils.js';

/**
 * Search/filter controls for AssetPanel — search input, type-filter menu, filtering logic.
 * Extracted from AssetPanel.js — Фаза 4.3 рефакторинга (tmp/2D_Editor_REFACTOR_PLAN.md).
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

        // Check if controls are already rendered (avoid unnecessary re-rendering)
        const existingControls = tabsRightContainer.querySelector('#asset-search-controls');
        if (existingControls) {
            // Controls already exist, just update search value
            const searchInput = existingControls.querySelector('#assets-search');
            if (searchInput) {
                const currentTerm = searchManager.getSearchTerm('assets');
                if (searchInput.value !== currentTerm) {
                    searchInput.value = currentTerm;
                }
            }
            return;
        }

        // Create controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'asset-search-controls';
        controlsContainer.className = 'flex items-center justify-end gap-1 p-1 border-t border-gray-700 bg-gray-800';

        // Create search input with ESC support
        const searchInput = createSearchInput(
            'Search assets...',
            'assets-search',
            'w-32 bg-gray-700 px-2 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none',
            searchManager.getSearchTerm('assets') || '',
            (searchTerm) => {
                // Direct callback for immediate filtering
                assetPanel.searchTerm = searchTerm;
                Logger.ui.debug('Asset search term changed directly:', searchTerm);
                assetPanel.viewRenderer.renderPreviews();
            }
        );

        // Create filter button
        const filterButton = document.createElement('button');
        filterButton.id = 'assets-filter-btn';
        filterButton.className = 'px-2 py-1 rounded text-sm flex items-center justify-center bg-gray-600 hover:bg-gray-700';
        filterButton.title = 'Filter by asset types';

        // Set button state based on active filters
        const hasActiveFilters = assetPanel.activeTypeFilters.size > 0 && !assetPanel.activeTypeFilters.has('DISABLE_ALL');
        filterButton.className += hasActiveFilters ? ' bg-blue-600 hover:bg-blue-700' : ' bg-gray-600 hover:bg-gray-700';

        filterButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 3h8l-3 3v3l-2 1V6L2 3z"/>
            </svg>
        `;

        // Setup filter button listener
        filterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAssetFilterMenu(filterButton);
        });

        // Assemble controls
        controlsContainer.appendChild(searchInput);
        controlsContainer.appendChild(filterButton);

        // Insert controls container into right container
        tabsRightContainer.appendChild(controlsContainer);

        Logger.ui.debug('Asset search controls rendered in tabs footer');
    }

    /**
     * Show filter menu with asset types using MenuPositioningUtils
     */
    showAssetFilterMenu(button) {
        const assetPanel = this.assetPanel;

        // Get all available asset types from current assets
        const allAssets = Array.from(assetPanel.assetManager.assets.values());
        let allTypes = [...new Set(allAssets.map(asset => asset.type).filter(type => type))];

        // If no types found, use categories as fallback
        if (allTypes.length === 0) {
            allTypes = Array.from(assetPanel.assetManager.categories);
            Logger.ui.debug('No asset types found, using categories as types:', allTypes);
        }

        if (allTypes.length === 0) {
            Logger.ui.warn('No asset types or categories available for filtering');
            return;
        }

        // Create menu using utility
        const menu = MenuPositioningUtils.createMenuElement({ className: 'p-2' });

        // Position menu using utility
        MenuPositioningUtils.showMenu(menu, button, {
            alignment: 'right',
            direction: 'below',
            menuWidth: 192,
            menuHeight: 200
        });

        // Ctrl+click: hold Ctrl to toggle multiple type checkboxes without applying the filter or
        // closing the menu (each option's handler stops the click from bubbling to the menu's
        // default close-on-click while Ctrl is held); the accumulated filter is applied AND the
        // menu closes together, once, on Ctrl release. A plain click keeps applying immediately
        // and closing right away, as it always did. Mirrors OutlinerPanel.showFilterMenu.
        //
        // If the cursor leaves the menu's hit area before Ctrl is released, MenuPositioningUtils
        // closes the menu on its own (see setupMenuClosing) without going through
        // ctrlReleaseHandler — so the accumulated-but-unapplied edits would otherwise be silently
        // dropped while assetPanel.activeTypeFilters (mutated live by each checkbox click) stays out of
        // sync with what's actually applied. Snapshot the pre-session filters and roll back to
        // them on any close that didn't go through the apply paths below.
        const filtersSnapshot = new Set(assetPanel.activeTypeFilters);
        let filtersApplied = false;
        const ctrlReleaseHandler = (e) => {
            if (e.key === 'Control') {
                assetPanel.stateManager.set('assetTypeFilters', assetPanel.activeTypeFilters);
                assetPanel.viewRenderer.renderPreviews();
                filtersApplied = true;
                if (menu._closeMenuHandler) menu._closeMenuHandler();
            }
        };
        document.addEventListener('keyup', ctrlReleaseHandler);
        menu.addEventListener('menuclose', () => {
            document.removeEventListener('keyup', ctrlReleaseHandler);
            if (!filtersApplied) {
                assetPanel.activeTypeFilters = filtersSnapshot;
            }
        });

        const applyOrDefer = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                this.updateAssetFilterMenu(menu, button);
            } else {
                assetPanel.stateManager.set('assetTypeFilters', assetPanel.activeTypeFilters);
                assetPanel.viewRenderer.renderPreviews();
                filtersApplied = true;
                this.updateAssetFilterMenu(menu, button);
            }
        };

        // Add "Toggle All" option using utility
        const allTypesActive = assetPanel.activeTypeFilters.size === 0;
        const allOption = MenuPositioningUtils.createMenuItem({
            text: 'Toggle All',
            checked: allTypesActive
        });
        allOption.querySelector('input').id = 'filter-all';

        allOption.addEventListener('click', (e) => {
            // Check current state at the time of click
            const currentlyAllActive = assetPanel.activeTypeFilters.size === 0;

            if (currentlyAllActive) {
                // Currently all types are active, deactivate all
                assetPanel.activeTypeFilters = new Set(['DISABLE_ALL']);
            } else {
                // Currently some types are filtered or disabled, activate all
                assetPanel.activeTypeFilters.clear();
            }
            applyOrDefer(e);
        });

        menu.appendChild(allOption);

        // Add separator
        const separator = document.createElement('div');
        separator.className = 'border-t border-gray-600 my-1';
        menu.appendChild(separator);

        // Add individual type options using utility
        allTypes.sort().forEach(type => {
            // Type is active if: no filters (show all) OR specifically selected OR not in DISABLE_ALL mode
            const isActive = assetPanel.activeTypeFilters.size === 0 ||
                           (assetPanel.activeTypeFilters.has(type) && !assetPanel.activeTypeFilters.has('DISABLE_ALL'));

            const option = MenuPositioningUtils.createMenuItem({
                text: type,
                checked: isActive
            });
            option.querySelector('input').id = `filter-${type}`;

            option.addEventListener('click', (e) => {
                if (assetPanel.activeTypeFilters.has('DISABLE_ALL')) {
                    // If in DISABLE_ALL mode, start with this type only
                    assetPanel.activeTypeFilters = new Set([type]);
                } else if (assetPanel.activeTypeFilters.size === 0) {
                    // If all were active, exclude this type (show all except this one)
                    assetPanel.activeTypeFilters = new Set(allTypes.filter(t => t !== type));
                } else if (assetPanel.activeTypeFilters.has(type)) {
                    // Remove this type
                    assetPanel.activeTypeFilters.delete(type);
                    // If no types left, disable all (show nothing)
                    if (assetPanel.activeTypeFilters.size === 0) {
                        assetPanel.activeTypeFilters = new Set(['DISABLE_ALL']);
                    }
                } else {
                    // Add this type
                    assetPanel.activeTypeFilters.add(type);
                }
                applyOrDefer(e);
            });

            menu.appendChild(option);
        });

        // Real item count (and therefore real menu height) is only known now that all options
        // are in — see MenuPositioningUtils.repositionMenu() for why the initial showMenu()
        // position can be off.
        MenuPositioningUtils.repositionMenu(menu, button, {
            alignment: 'right',
            direction: 'below',
            menuWidth: 192,
            menuHeight: 200
        });
    }

    /**
     * Update filter menu to reflect current filter state
     */
    updateAssetFilterMenu(menu, button) {
        const assetPanel = this.assetPanel;

        // Update "Toggle All" option
        const allOption = menu.querySelector('#filter-all');
        if (allOption) {
            allOption.checked = assetPanel.activeTypeFilters.size === 0;
        }

        // Update individual type options
        const allAssets = Array.from(assetPanel.assetManager.assets.values());
        let allTypes = [...new Set(allAssets.map(asset => asset.type).filter(type => type))];

        // If no types found, use categories as fallback
        if (allTypes.length === 0) {
            allTypes = Array.from(assetPanel.assetManager.categories);
        }

        allTypes.forEach(type => {
            const option = menu.querySelector(`#filter-${type}`);
            if (option) {
                const isActive = assetPanel.activeTypeFilters.size === 0 ||
                               (assetPanel.activeTypeFilters.has(type) && !assetPanel.activeTypeFilters.has('DISABLE_ALL'));
                option.checked = isActive;
            }
        });

        // Update filter button appearance
        const filterButton = document.querySelector('#assets-filter-btn');
        if (filterButton) {
            const hasActiveFilters = assetPanel.activeTypeFilters.size > 0 && !assetPanel.activeTypeFilters.has('DISABLE_ALL');
            filterButton.className = filterButton.className.replace(/bg-(blue|gray)-600/, hasActiveFilters ? 'bg-blue-600' : 'bg-gray-600');
            filterButton.className = filterButton.className.replace(/hover:bg-(blue|gray)-700/, hasActiveFilters ? 'hover:bg-blue-700' : 'hover:bg-gray-700');
        }
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
            filtered = filtered.filter(asset => this.shouldShowAsset(asset));
        }

        return filtered;
    }
}
