import { Logger } from '../../utils/Logger.js';
import { PanelSubController } from './PanelSubController.js';

/**
 * Tab reordering/repositioning without a drag gesture: programmatic moves between
 * panels, persisting/restoring intra-panel order and per-tab panel membership.
 * Extracted from PanelPositionManager.js — Фаза 4.5.2 (tmp/2D_Editor_REFACTOR_PLAN.md).
 */
export class TabOrderController extends PanelSubController {
    /**
     * Move a tab to a different panel
     * @param {string} tabName - Name of the tab (details, layers, outliner)
     * @param {string} fromPanel - Current panel ('right' or 'left')
     * @param {string} toPanel - Target panel ('right' or 'left')
     */
    moveTab(tabName, fromPanel, toPanel) {
        if (fromPanel === toPanel) return;

        // Get current tab positions
        const tabPositions = this.stateManager.get('tabPositions') || {
            details: 'right',
            levels: 'right',
            layers: 'right',
            outliner: 'right'
        };

        // Update state
        tabPositions[tabName] = toPanel;
        this.stateManager.set('tabPositions', tabPositions);

        // Save to user preferences
        if (this.userPrefs) {
            this.userPrefs.set(`tabPosition_${tabName}`, toPanel);
        }

        // Create target panel if it doesn't exist
        this.manager.tabLayoutController.ensurePanelExists(toPanel);

        // Move the tab physically
        this.moveTabDOM(tabName, fromPanel, toPanel);

        // Update active tab state if this was the active tab
        this.updateActiveTabAfterMove(tabName, fromPanel, toPanel);

        // Update event listeners for moved tabs
        this.updateTabEventListeners();

        // Remove empty panel if needed
        this.manager.splitPaneController.removeEmptyPanel(fromPanel);

        // Persist the resulting tab order for both panels (membership changed for both)
        this.savePanelTabOrder(fromPanel);
        this.savePanelTabOrder(toPanel);

        Logger.ui.info(`Tab ${tabName} moved from ${fromPanel} to ${toPanel}`);
    }

    /**
     * Sync a single tab's persisted panel membership (stateManager 'tabPositions' +
     * userPrefs 'tabPosition_{tabName}') to match where it actually lives now. moveTab()
     * does this inline for its own cross-panel path; the split merge/replace/detach
     * operations (mergeTabIntoSplit/replacePaneInSplit/_collapseSplitPane/detachFromSplit)
     * can also relocate a tab across panels but never updated this state, so a reload would
     * read the stale pre-split position and reconstruct the wrong panel layout even though
     * `leftPanelSplits`/`rightPanelSplits` themselves were saved correctly.
     * @param {string} tabName
     * @param {string} panelSide - 'left' or 'right' — the panel the tab now lives in
     */
    _syncTabPosition(tabName, panelSide) {
        if (this._initializing) return;
        if (panelSide !== 'left' && panelSide !== 'right') return;

        const tabPositions = this.stateManager.get('tabPositions') || {
            details: 'right',
            levels: 'right',
            layers: 'right',
            outliner: 'right'
        };
        if (tabPositions[tabName] === panelSide) return;

        tabPositions[tabName] = panelSide;
        this.stateManager.set('tabPositions', tabPositions);
        if (this.userPrefs) {
            this.userPrefs.set(`tabPosition_${tabName}`, panelSide);
        }
    }

    /**
     * Persist the current DOM tab order for a panel to stateManager/userPrefs
     * @param {string} panelSide - 'left' or 'right' (anything else, e.g. 'temp', is ignored)
     */
    savePanelTabOrder(panelSide) {
        if (this._initializing) return;
        if (panelSide !== 'left' && panelSide !== 'right') return;

        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        const tabsContainer = panel?.querySelector('.flex.border-b.border-gray-700');
        if (!tabsContainer) return;

        const order = Array.from(tabsContainer.children)
            .map(tab => tab.dataset.tab)
            .filter(Boolean);

        const stateKey = panelSide === 'left' ? 'leftPanelTabOrder' : 'rightPanelTabOrder';
        this.stateManager.set(stateKey, order);
        if (this.userPrefs) {
            this.userPrefs.set(stateKey, order);
        }
    }

    /**
     * Apply a previously saved tab order to a panel's DOM (called during initialization)
     * @param {string} panelSide - 'left' or 'right'
     */
    applyPanelTabOrder(panelSide) {
        const stateKey = panelSide === 'left' ? 'leftPanelTabOrder' : 'rightPanelTabOrder';
        const savedOrder = this.userPrefs?.get(stateKey);
        if (!Array.isArray(savedOrder) || savedOrder.length === 0) return;

        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        const tabsContainer = panel?.querySelector('.flex.border-b.border-gray-700');
        if (!tabsContainer) return;

        savedOrder.forEach(tabName => {
            const tab = tabsContainer.querySelector(`[data-tab="${tabName}"]`);
            if (tab) tabsContainer.appendChild(tab);
        });

        this.stateManager.set(stateKey, savedOrder);
    }

    /**
     * Move tab DOM elements between panels
     * @param {string} tabName - Tab name
     * @param {string} fromPanel - Source panel
     * @param {string} toPanel - Target panel
     */
    moveTabDOM(tabName, fromPanel, toPanel) {
        // Get source and target containers
        const fromContainer = document.getElementById(`${fromPanel}-tabs-panel`);
        const toContainer = document.getElementById(`${toPanel}-tabs-panel`);

        if (!fromContainer) {
            Logger.ui.warn(`Source container ${fromPanel}-tabs-panel not found`);
            return;
        }

        if (!toContainer) {
            Logger.ui.warn(`Target container ${toPanel}-tabs-panel not found, creating it`);
            this.manager.tabLayoutController.ensurePanelExists(toPanel);
            // Try again after creating
            const newToContainer = document.getElementById(`${toPanel}-tabs-panel`);
            if (!newToContainer) {
                Logger.ui.error(`Failed to create target container ${toPanel}-tabs-panel`);
                return;
            }
            // Continue with the newly created container
            const updatedFromContainer = fromContainer;
            const updatedToContainer = newToContainer;
            this.moveTabElements(tabName, updatedFromContainer, updatedToContainer, toPanel);
            return;
        }

        this.moveTabElements(tabName, fromContainer, toContainer, toPanel);
    }

    /**
     * Move tab elements between containers
     * @param {string} tabName - Tab name
     * @param {HTMLElement} fromContainer - Source container
     * @param {HTMLElement} toContainer - Target container
     * @param {string} toPanel - Target panel side
     */
    moveTabElements(tabName, fromContainer, toContainer, toPanel) {
        // Ensure stable tab identity markers for robust visibility routing.
        const fromTabsContainer = fromContainer.querySelector('.flex.border-b.border-gray-700');
        const toTabsContainer = toContainer.querySelector('.flex.border-b.border-gray-700');
        const fromContentContainer = fromContainer.querySelector('.flex-grow.overflow-y-auto');
        const toContentContainer = toContainer.querySelector('.flex-grow.overflow-y-auto');

        // Find tab button in the source panel only to avoid cross-panel mixups.
        const tabButton = fromTabsContainer?.querySelector(`[data-tab="${tabName}"]`) ||
            fromContainer.querySelector(`[data-tab="${tabName}"]`);
        if (!tabButton) {
            Logger.ui.warn(`Tab button not found for ${tabName} in source container`);
            return;
        }

        // Find tab content in the source panel only to avoid cross-panel mixups.
        const tabContent = fromContentContainer?.querySelector(`[data-panel-tab-name="${tabName}"]`) ||
            fromContentContainer?.querySelector(`#${tabName}-content-panel`) ||
            document.getElementById(`${tabName}-content-panel`);
        if (!tabContent) {
            Logger.ui.warn(`Tab content not found for ${tabName} in source container`);
            return;
        }

        tabButton.dataset.panelTab = 'true';
        tabContent.dataset.panelTabContent = 'true';
        tabContent.dataset.panelTabName = tabName;

        // Move tab button

        if (fromTabsContainer && toTabsContainer) {
            if (fromTabsContainer.contains(tabButton)) {
                fromTabsContainer.removeChild(tabButton);
            }
            toTabsContainer.appendChild(tabButton);

            // Remove newly created flag since panel now has tabs
            if (toContainer._newlyCreated) {
                toContainer._newlyCreated = false;
            }

            // Check if this is the first tab in the panel - enable menu toggle if panel was empty
            if (toTabsContainer.children.length === 1) {
                this.manager.splitPaneController.updatePanelStateAfterTabAddition(toPanel);
            }

            // Don't auto-activate tabs during initialization - let EventHandlers handle it
            // Auto-activation only happens during manual tab moves (not during initialization)
            if (toTabsContainer.children.length === 1 && !this._initializing) {
                // Use EventHandlers to properly activate the tab
                if (this.levelEditor && this.levelEditor.eventHandlers) {
                    this.levelEditor.eventHandlers.setActivePanelTab(tabName, toPanel);
                } else {
                    // Fallback: just add active class
                    tabButton.classList.add('active');
                }
            }

            Logger.ui.debug(`Moved tab button ${tabName} to ${toPanel} panel`);
        } else {
            Logger.ui.warn(`Tab containers not found for moving ${tabName}`);
        }

        // Move tab content to target container
        if (fromContentContainer && toContentContainer) {
            // Remove from old container and add to new container
            if (fromContentContainer.contains(tabContent)) {
                fromContentContainer.removeChild(tabContent);
            }
            toContentContainer.appendChild(tabContent);

            // Update CSS class to reflect new panel side
            tabContent.className = tabContent.className
                .replace('tab-content-right', `tab-content-${toPanel}`)
                .replace('tab-content-left', `tab-content-${toPanel}`);

            // Make content visible (remove display: none from HTML)
            tabContent.style.display = '';

            // If this tab is active, show its content
            if (tabButton.classList.contains('active')) {
                tabContent.classList.remove('hidden');
            } else {
                tabContent.classList.add('hidden');
            }

            Logger.ui.debug(`Moved tab content ${tabName} to ${toPanel} panel`);
        } else {
            Logger.ui.warn(`Content containers not found for moving ${tabName}`);
        }

        // Search sections are now part of the panel content and move automatically

        // Update CSS classes
        tabButton.className = tabButton.className
            .replace('tab-right', `tab-${toPanel}`)
            .replace('tab-left', `tab-${toPanel}`);

        Logger.ui.info(`Tab ${tabName} successfully moved to ${toPanel} panel`);
    }

    /**
     * Update active tab state after moving a tab
     * @param {string} tabName - Name of the moved tab
     * @param {string} fromPanel - Source panel side
     * @param {string} toPanel - Target panel side
     */
    updateActiveTabAfterMove(tabName, fromPanel, toPanel) {
        // Skip during initialization to prevent loops
        if (this._initializing) {
            Logger.ui.debug('Skipping active tab update during initialization');
            return;
        }

        // Always activate the moved tab in the target panel
        if (this.levelEditor && this.levelEditor.eventHandlers) {
            this.levelEditor.eventHandlers.setActivePanelTab(tabName, toPanel);
        }

        // Check if there are remaining tabs in the source panel and activate the one closest to separator
        const fromPanelElement = document.getElementById(`${fromPanel}-tabs-panel`);
        if (fromPanelElement) {
            // Exclude asset panel tabs container - asset tabs are managed by AssetTabsManager
            const assetTabsContainer = fromPanelElement.querySelector('#asset-tabs-container');

            // Find all tabs with data-tab attribute, excluding those inside asset tabs container
            const allTabs = fromPanelElement.querySelectorAll('.tab-right[data-tab], .tab-left[data-tab]');

            // Filter out asset tabs (those inside #asset-tabs-container)
            const remainingTabs = Array.from(allTabs).filter(tab => {
                // Skip if tab is inside asset tabs container
                if (assetTabsContainer && assetTabsContainer.contains(tab)) {
                    return false;
                }
                // Ensure tab has valid data-tab attribute
                return tab.dataset.tab && tab.dataset.tab.trim() !== '';
            });

            if (remainingTabs.length > 0) {
                // Find the tab closest to the separator (main panel)
                const tabClosestToSeparator = this.getTabClosestToSeparator(remainingTabs, fromPanel);
                if (tabClosestToSeparator && tabClosestToSeparator.dataset.tab) {
                    const tabName = tabClosestToSeparator.dataset.tab;
                    if (this.levelEditor && this.levelEditor.eventHandlers) {
                        this.levelEditor.eventHandlers.setActivePanelTab(tabName, fromPanel);
                        Logger.ui.debug(`Auto-activated tab closest to separator: ${tabName} in ${fromPanel} panel`);
                    }
                }
            }
        }

        // Update search controls for the moved tab
        if (this.levelEditor && this.levelEditor.initializeSearchControls) {
            this.levelEditor.initializeSearchControls();
        }

        Logger.ui.debug(`Updated active tab ${tabName} after move to ${toPanel} panel`);
    }

    /**
     * Get the tab closest to the separator (main panel) in a given panel
     * @param {NodeList} tabs - List of tab elements
     * @param {string} panelSide - 'left' or 'right'
     * @returns {HTMLElement|null} - The tab closest to separator
     */
    getTabClosestToSeparator(tabs, panelSide) {
        if (tabs.length === 0) return null;
        if (tabs.length === 1) return tabs[0];

        // For left panel: first tab (index 0) is closest to main panel
        // For right panel: last tab (index length-1) is closest to main panel
        if (panelSide === 'left') {
            return tabs[0]; // First tab is closest to main panel
        } else {
            return tabs[tabs.length - 1]; // Last tab is closest to main panel
        }
    }

    /**
     * Update event listeners for tabs after they are moved
     */
    updateTabEventListeners() {
        // Skip during initialization to prevent loops
        if (this._initializing) {
            Logger.ui.debug('Skipping tab event listeners update during initialization');
            return;
        }

        // Notify EventHandlers to update tab event listeners
        if (this.levelEditor && this.levelEditor.eventHandlers) {
            if (this.levelEditor.eventHandlers.updateTabClickHandlers) {
                this.levelEditor.eventHandlers.updateTabClickHandlers();
            }
            if (this.levelEditor.eventHandlers.updateTabContextMenus) {
                this.levelEditor.eventHandlers.updateTabContextMenus();
            }
        }

        // Search sections are now part of panel content and update automatically

        // Update UI when tab structure changes
        this.manager._updateUI();

        Logger.ui.debug('Updated tab event listeners after move');
    }
}
