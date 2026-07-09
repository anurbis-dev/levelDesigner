import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';
import { PanelSizeCalculator } from '../utils/PanelSizeCalculator.js';

/**
 * Universal panel position manager
 * Handles position toggling for both folders panel and right panel
 */
export class PanelPositionManager {
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.stateManager = levelEditor.stateManager;
        this.userPrefs = levelEditor.userPrefs;
        this._initializing = false; // Flag to prevent loops during initialization
        
        // Initialize panel size calculator
        this.panelSizeCalculator = new PanelSizeCalculator();
        
        // Initialize global tab dragging handler once
        this._initGlobalTabDraggingHandler();
    }
    
    /**
     * Initialize global tab dragging handler (called once in constructor)
     * @private
     */
    _initGlobalTabDraggingHandler() {
        // Check if already initialized to prevent duplicates
        if (this._tabDraggingInitialized) {
            return;
        }
        
        // Initialize global dragging state
        if (!window.tabDraggingState) {
            window.tabDraggingState = {
                draggedTab: null,
                draggedIndex: -1,
                draggedPanel: null
            };
        }
        
        // Create global mouseup handler once
        if (!window.tabDraggingGlobalMouseUp) {
            window.tabDraggingGlobalMouseUp = (e) => {
                if (window.tabDraggingState && window.tabDraggingState.draggedTab) {
                    // Let panel-level mouseup handler finalize reorder when release happens
                    // inside a panel tab strip. Global cleanup is only for outside releases.
                    const releaseInTabStrip = !!e.target?.closest('.flex.border-b.border-gray-700');
                    if (releaseInTabStrip) {
                        return;
                    }

                    // Clean up dragging state
                    window.tabDraggingState.draggedTab.classList.remove('dragging');
                    document.querySelectorAll('.tab-right, .tab-left').forEach(t => t.classList.remove('tab-drag-over'));
                    
                    window.tabDraggingState.draggedTab = null;
                    window.tabDraggingState.draggedIndex = -1;
                    window.tabDraggingState.draggedPanel = null;
                }
            };
        }
        
        // Register global handler once
        if (!window._tabDraggingRegistered) {
            const tabDragHandlers = {
                mouseup: window.tabDraggingGlobalMouseUp
            };
            
            globalEventRegistry.registerComponentHandlers('panel-tab-dragging', tabDragHandlers, 'document');
            window._tabDraggingRegistered = true;
        }
        
        // Mark as initialized
        this._tabDraggingInitialized = true;
    }

    /**
     * Update UI after panel changes
     * @private
     */
    _updateUI() {
        // No need to update panels content when only sizes change
        // Canvas is now in separate container, no need to update it when panels change
    }


    /**
     * Toggle panel position (left/right)
     * @param {string} panelType - 'folders' or 'rightPanel'
     */
    togglePanelPosition(panelType) {
        const currentPosition = this.stateManager.get(`${panelType}Position`) || 'right';
        const newPosition = currentPosition === 'right' ? 'left' : 'right';
        
        // Update state
        this.stateManager.set(`${panelType}Position`, newPosition);
        
        // Save to user preferences
        if (this.userPrefs) {
            this.userPrefs.set(`${panelType}Position`, newPosition);
        }
        
        // Update layout based on panel type
        if (panelType === 'folders') {
            this.updateFoldersLayout(newPosition);
        } else if (panelType === 'rightPanel') {
            this.updateRightPanelLayout(newPosition);
        }
        
        Logger.ui.info(`${panelType} panel moved to ${newPosition} side`);
    }

    /**
     * Update folders panel layout based on position
     * @param {string} position - 'left' or 'right'
     */
    updateFoldersLayout(position) {
        if (!this.levelEditor.assetPanel) return;
        
        // Use existing AssetPanel method
        this.levelEditor.assetPanel.foldersPosition = position;
        this.levelEditor.assetPanel.saveFoldersPosition();
        this.levelEditor.assetPanel.updateFoldersLayout();
    }

    /**
     * Update right panel layout based on position
     * @param {string} position - 'left' or 'right'
     */
    updateRightPanelLayout(position) {
        const rightPanel = document.getElementById('right-panel');
        const resizerX = document.getElementById('resizer-x');
        const mainPanel = document.getElementById('main-panel');
        
        if (!rightPanel || !resizerX || !mainPanel) return;
        
        const parent = rightPanel.parentElement;
        if (!parent) return;
        
        // Remove panel and resizer from current position
        if (rightPanel.parentElement && rightPanel.parentElement.contains(rightPanel)) {
            rightPanel.parentElement.removeChild(rightPanel);
        }
        if (resizerX.parentElement && resizerX.parentElement.contains(resizerX)) {
            resizerX.parentElement.removeChild(resizerX);
        }
        
        if (position === 'left') {
            // Move panel to left side
            parent.insertBefore(rightPanel, mainPanel);
            parent.insertBefore(resizerX, mainPanel);
            
            // Update border styles
            rightPanel.className = 'bg-gray-900 flex flex-col border-r border-gray-700';
        } else {
            // Move panel to right side (default)
            parent.appendChild(resizerX);
            parent.appendChild(rightPanel);
            
            // Update border styles
            rightPanel.className = 'bg-gray-900 flex flex-col border-l border-gray-700';
        }
        
        // Update canvas and render
        if (this.levelEditor.canvasRenderer) {
            this.levelEditor.canvasRenderer.resizeCanvas();
            this.levelEditor.render();
        }
    }

    /**
     * Initialize panel positions from saved preferences
     */
    initializePanelPositions() {
        Logger.ui.info('Initializing panel positions...');
        
        // Initialize folders panel position
        const foldersPosition = this.userPrefs?.get('foldersPosition') ?? 'left';
        this.stateManager.set('foldersPosition', foldersPosition);
        if (this.levelEditor.assetPanel) {
            this.levelEditor.assetPanel.foldersPosition = foldersPosition;
            this.levelEditor.assetPanel.updateFoldersLayout();
        }

        // Initialize right panel position (but don't update layout - it's managed by index.html)
        const rightPanelPosition = this.userPrefs?.get('rightPanelPosition') ?? 'right';
        this.stateManager.set('rightPanelPosition', rightPanelPosition);

        // Initialize panel widths from user preferences
        this.initializePanelWidths();

        // Initialize tab positions (this will create panels only if needed)
        this.initializeTabPositions();
        
        // Initialize panel states in StateManager even if panels don't exist
        this.initializePanelStates();
        
        // Initialize assets panel
        this.initializeAssetsPanel();
        
        window.panelInitializationCompleted = true; // Global flag for debugging
        Logger.ui.info('Panel positions initialization completed');
    }

    /**
     * Initialize panel widths from user preferences
     */
    initializePanelWidths() {
        Logger.ui.info('Initializing panel widths...');
        
        // Initialize right panel width
        const rightPanelWidth = this.userPrefs?.get('rightPanelWidth') ?? 300;
        this.stateManager.set('panels.rightPanelWidth', rightPanelWidth);
        
        // Initialize left panel width
        const leftPanelWidth = this.userPrefs?.get('leftPanelWidth') ?? 300;
        this.stateManager.set('panels.leftPanelWidth', leftPanelWidth);
        
        Logger.ui.info(`Panel widths initialized: right=${rightPanelWidth}px, left=${leftPanelWidth}px`);
    }

    /**
     * Initialize tab positions from saved preferences
     */
    initializeTabPositions() {
        this._initializing = true;
        
        try {
            const tabPositions = {
                details: this.userPrefs?.get('tabPosition_details') ?? 'right',
                levels: this.userPrefs?.get('tabPosition_levels') ?? 'right',
                layers: this.userPrefs?.get('tabPosition_layers') ?? 'right',
                outliner: this.userPrefs?.get('tabPosition_outliner') ?? 'right'
            };
            
            this.stateManager.set('tabPositions', tabPositions);
            
            // Create a temporary source container with all tabs and content
            this.createTemporaryTabContainer();
            
            // Move tabs to their saved positions using existing moveTab method
            Object.entries(tabPositions).forEach(([tabName, position]) => {
                // Only move tab if it's not already in the correct position
                // This will create panels if they don't exist
                this.moveTab(tabName, 'temp', position);
            });

            // Restore intra-panel tab order (which was lost above, since moveTab always
            // appends in tabPositions' fixed key order regardless of any previous drag reorder)
            this.applyPanelTabOrder('left');
            this.applyPanelTabOrder('right');

            // Remove temporary container
            this.removeTemporaryTabContainer();
            
            // Tab activation will be handled by EventHandlers after initialization
            
            // Remove empty panels after initialization
            this.removeEmptyPanel('left');
            this.removeEmptyPanel('right');
        } finally {
            this._initializing = false;
        }
    }


    /**
     * Initialize panel states in StateManager even if panels don't exist
     */
    initializePanelStates() {
        // Check if left panel exists
        const leftPanel = document.getElementById('left-tabs-panel');
        const leftPanelExists = leftPanel && leftPanel.querySelector('.flex.border-b.border-gray-700')?.children.length > 0;
        
        // Check if right panel exists
        const rightPanel = document.getElementById('right-tabs-panel');
        const rightPanelExists = rightPanel && rightPanel.querySelector('.flex.border-b.border-gray-700')?.children.length > 0;
        
        // Set panel states in StateManager
        if (this.stateManager) {
            this.stateManager.set('view.leftPanel', leftPanelExists);
            this.stateManager.set('view.rightPanel', rightPanelExists);
        }
        
        // Save to user preferences
        if (this.levelEditor.userPrefs) {
            this.levelEditor.userPrefs.set('leftPanelVisible', leftPanelExists);
            this.levelEditor.userPrefs.set('rightPanelVisible', rightPanelExists);
        }
        
        // Update menu item states
        if (this.levelEditor.eventHandlers && this.levelEditor.eventHandlers.menuManager) {
            this.levelEditor.eventHandlers.menuManager.updateToggleState('toggle-left-panel', leftPanelExists);
            this.levelEditor.eventHandlers.menuManager.updateToggleState('toggle-right-panel', rightPanelExists);
        }
        
        Logger.ui.info(`Initialized panel states: left=${leftPanelExists}, right=${rightPanelExists}`);
    }

    /**
     * Create temporary container with all tabs and content
     */
    createTemporaryTabContainer() {
        const tempContainer = document.createElement('div');
        tempContainer.id = 'temp-tabs-panel';
        tempContainer.style.display = 'none';
        
        // Create tabs container
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'flex border-b border-gray-700 flex-shrink-0 overflow-hidden';
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'flex-grow overflow-y-auto';
        
        // Create default tabs
        const defaultTabs = [
            { name: 'details', text: 'Asset', active: true },
            { name: 'levels', text: 'Levels', active: false },
            { name: 'layers', text: 'Layers', active: false },
            { name: 'outliner', text: 'Outliner', active: false }
        ];

        defaultTabs.forEach(tab => {
            const tabButton = document.createElement('button');
            tabButton.setAttribute('data-tab', tab.name);
            tabButton.className = `tab-right ${tab.active ? 'active' : ''}`;
            tabButton.textContent = tab.text;
            tabsContainer.appendChild(tabButton);
        });

        // Move existing content panels to temporary container
        const contentPanels = [
            'details-content-panel',
            'levels-content-panel',
            'layers-content-panel',
            'outliner-content-panel'
        ];
        
        contentPanels.forEach(panelId => {
            const contentPanel = document.getElementById(panelId);
            if (contentPanel) {
                // Remove from current parent and add to content container
                if (contentPanel.parentNode && contentPanel.parentNode.contains(contentPanel)) {
                    contentPanel.parentNode.removeChild(contentPanel);
                }
                contentContainer.appendChild(contentPanel);
            }
        });

        tempContainer.appendChild(tabsContainer);
        tempContainer.appendChild(contentContainer);
        
        // Add to DOM (hidden)
        document.body.appendChild(tempContainer);
        
        Logger.ui.debug('Created temporary tab container with content panels');
    }

    /**
     * Remove temporary container
     */
    removeTemporaryTabContainer() {
        const tempContainer = document.getElementById('temp-tabs-panel');
        if (tempContainer) {
            tempContainer.remove();
            Logger.ui.debug('Removed temporary tab container');
        }
    }

    /**
     * Get panel position
     * @param {string} panelType - 'folders' or 'rightPanel'
     * @returns {string} - 'left' or 'right'
     */
    getPanelPosition(panelType) {
        return this.stateManager.get(`${panelType}Position`) || (panelType === 'folders' ? 'left' : 'right');
    }

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
        this.ensurePanelExists(toPanel);

        // Move the tab physically
        this.moveTabDOM(tabName, fromPanel, toPanel);
        
        // Update active tab state if this was the active tab
        this.updateActiveTabAfterMove(tabName, fromPanel, toPanel);
        
        // Update event listeners for moved tabs
        this.updateTabEventListeners();

        // Remove empty panel if needed
        this.removeEmptyPanel(fromPanel);

        // Persist the resulting tab order for both panels (membership changed for both)
        this.savePanelTabOrder(fromPanel);
        this.savePanelTabOrder(toPanel);

        Logger.ui.info(`Tab ${tabName} moved from ${fromPanel} to ${toPanel}`);
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
     * Ensure a panel exists (create if needed)
     * @param {string} panelSide - 'left' or 'right'
     */
    ensurePanelExists(panelSide) {
        const panelId = `${panelSide}-tabs-panel`;
        let panel = document.getElementById(panelId);

        if (!panel) {
            // Create the panel
            panel = this.createTabsPanel(panelSide);
            
            // Insert into layout
            this.insertPanelIntoLayout(panel, panelSide);
            
            // Mark as newly created to prevent recreation
            panel._newlyCreated = true;
            
            // Update UI after creating new panel
            this._updateUI();
            
        Logger.ui.info(`Created ${panelSide} tabs panel`);
        } else {
            // Panel exists, check if it has tabs
            const tabContainer = panel.querySelector('.flex.border-b.border-gray-700');
            const hasTabs = tabContainer && tabContainer.children.length > 0;
            
            Logger.ui.debug(`Panel ${panelSide} exists: hasTabs=${hasTabs}, _newlyCreated=${panel._newlyCreated}, _initializing=${this._initializing}`);
            
            // Only recreate structure if panel is empty and not newly created
            if (!hasTabs && !panel._newlyCreated && !this._initializing) {
                // Panel exists but is empty, recreate its structure
                Logger.ui.info(`Recreating empty ${panelSide} tabs panel structure`);
                
                // Clear the panel and recreate structure
                panel.innerHTML = '';
                const newStructure = this.createTabsPanel(panelSide);
                
                // Copy the new structure content to existing panel
                while (newStructure.firstChild) {
                    panel.appendChild(newStructure.firstChild);
                }
                
                // Update UI after recreating structure
                this._updateUI();
            }
            
            // If panel exists with tabs, ensure menu state is correct
            if (hasTabs) {
                this.updatePanelStateAfterTabAddition(panelSide);
            }
        }

        // Ensure tab dragging is setup for this panel
        this.setupTabDraggingForPanel(panel);

        return panel;
    }

    /**
     * Create a tabs panel structure
     * @param {string} panelSide - 'left' or 'right'
     * @returns {HTMLElement} - Created panel element
     */
    createTabsPanel(panelSide) {
        const panel = document.createElement('aside');
        panel.id = `${panelSide}-tabs-panel`;
        panel.className = `tab-panel`;
        
        // Create tabs container
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'flex border-b border-gray-700 flex-shrink-0 overflow-hidden';

        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'flex-grow overflow-y-auto';

        // Content panels will be moved here by moveTabElements method

        panel.appendChild(tabsContainer);
        panel.appendChild(contentContainer);

        return panel;
    }

    /**
     * Insert panel into layout at correct position
     * @param {HTMLElement} panel - Panel element
     * @param {string} panelSide - 'left' or 'right'
     */
    insertPanelIntoLayout(panel, panelSide) {
        const mainContainer = document.querySelector('.flex.flex-grow.min-h-0.relative.z-10');
        const mainPanel = document.getElementById('main-panel');

        if (panelSide === 'left') {
            // Insert left panel at the beginning of flex container
            mainContainer.insertBefore(panel, mainContainer.firstChild);
            
            // Create resizer for left panel
            this.createPanelResizer(panel, 'left');
        } else {
            // Insert right panel at the end of flex container
            mainContainer.appendChild(panel);
            
            // Create resizer for right panel
            this.createPanelResizer(panel, 'right');
        }
        
        // Update panel state to true and enable menu item since panel is created
        this.updatePanelStateAfterCreation(panelSide);
        
        // Update UI after panel is added
        this._updateUI();
    }

    /**
     * Create resizer for a panel
     * @param {HTMLElement} panel - Panel element
     * @param {string} panelSide - 'left' or 'right'
     */
    createPanelResizer(panel, panelSide) {
        const resizerId = `resizer-${panelSide}-tabs-panel`;
        let resizer = document.getElementById(resizerId);
        
        if (!resizer) {
            resizer = document.createElement('div');
            resizer.id = resizerId;
            resizer.className = `resizer panel-resizer resizer-${panelSide}-tabs-panel`;
            
            // Insert resizer into layout
            const mainContainer = document.querySelector('.flex.flex-grow.min-h-0.relative.z-10');
            if (panelSide === 'left') {
                // Insert after left panel
                const leftPanel = document.getElementById('left-tabs-panel');
                if (leftPanel && leftPanel.nextSibling) {
                    mainContainer.insertBefore(resizer, leftPanel.nextSibling);
                } else {
                    mainContainer.insertBefore(resizer, mainContainer.children[1]);
                }
            } else {
                // Insert before right panel
                const rightPanel = document.getElementById('right-tabs-panel');
                if (rightPanel) {
                    mainContainer.insertBefore(resizer, rightPanel);
                } else {
                    mainContainer.appendChild(resizer);
                }
            }
            
            // Setup resizer functionality
            this.setupPanelResizer(resizer, panel, panelSide);
        }
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
            this.ensurePanelExists(toPanel);
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
                this.updatePanelStateAfterTabAddition(toPanel);
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
        this._updateUI();
        
        Logger.ui.debug('Updated tab event listeners after move');
    }


    /**
     * Setup resizer functionality for a panel
     * @param {HTMLElement} resizer - Resizer element
     * @param {HTMLElement} panel - Panel element
     * @param {string} panelSide - 'left' or 'right'
     */
    setupPanelResizer(resizer, panel, panelSide) {
        Logger.ui.info(`Setting up panel resizer for ${panelSide} panel...`);
        
        // Use saved width only if it is a real positive value — treat 0 as "no width"
        // so a newly-created panel always appears at a usable size even if the previous
        // instance was collapsed (which leaves panels.${side}PanelWidth = 0 in state).
        const defaultWidth = 300;
        const savedWidth = this.stateManager?.get(`panels.${panelSide}PanelWidth`) ?? null;
        const useWidth = (savedWidth !== null && savedWidth !== undefined && savedWidth > 0)
            ? savedWidth
            : defaultWidth;

        panel.style.width = useWidth + 'px';
        panel.style.flexShrink = '0';
        panel.style.flexGrow = '0';
        this.updateResizerPosition(panelSide, useWidth);

        if (this.stateManager) {
            this.stateManager.set(`panels.${panelSide}PanelWidth`, useWidth);
            this.stateManager.set(`panels.${panelSide}PanelPreviousWidth`, useWidth);
        }
        if (this.userPrefs) {
            this.userPrefs.set(`${panelSide}PanelWidth`, useWidth);
        }

        // Unregister old handlers if they exist to prevent duplicates
        this.levelEditor.resizerManager.unregisterResizer(resizer);
        eventHandlerManager.unregisterElement(resizer);

        // Create double-click handler for panel collapse/expand
        const onDoubleClick = (e, resizerElement, panelElement, panelSide) => {
            Logger.ui.info(`${panelSide} panel resizer double-click triggered`);
            
            // Use universal panel collapse/expand method directly
            const savedSize = this.stateManager?.get(`panels.${panelSide}PanelWidth`) ?? 300;
            const isCollapsed = savedSize <= 5;
            const shouldCollapse = !isCollapsed;
            
            this.togglePanelCollapse(panelSide, shouldCollapse);
        };
        
        // Register with unified ResizerManager
        this.levelEditor.resizerManager.registerResizer(resizer, panel, panelSide, 'horizontal', onDoubleClick);
        this.levelEditor.resizerManager.setCollapsed(resizer, useWidth <= 5);

        Logger.ui.debug(`Setup ${panelSide} panel resizer with unified ResizerManager`);
    }

    /**
     * Universal method to update resizer position for any resizer type
     * @param {string} resizerType - Type of resizer ('left', 'right', 'assets', 'folders')
     * @param {number} newSize - New panel size
     */
    updateResizerPosition(resizerType, newSize) {
        // For flex-based layout, resizer position is handled automatically
        // by the flex container, no manual positioning needed
        Logger.ui.debug(`Resizer position updated for ${resizerType}: ${newSize}px`);
    }

    /**
     * Universal method to collapse/expand panels
     * @param {string} panelType - Type of panel ('left', 'right', 'assets', 'folders')
     * @param {boolean} collapse - true to collapse, false to expand
     */
    togglePanelCollapse(panelType, collapse) {
        switch (panelType) {
            case 'left':
            case 'right':
                this.toggleTabPanelCollapse(panelType, collapse);
                break;
                
            case 'assets':
                this.toggleAssetsPanelCollapse(collapse);
                break;
                
            case 'folders':
                this.toggleFoldersPanelCollapse(collapse);
                break;
                
            default:
                Logger.ui.warn(`Unknown panel type: ${panelType}`);
        }
    }

    /**
     * Toggle collapse/expand for left/right tab panels
     * @param {string} panelSide - 'left' or 'right'
     * @param {boolean} collapse - true to collapse, false to expand
     */
    toggleTabPanelCollapse(panelSide, collapse) {
        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        if (!panel) return;

        const resizer = document.getElementById(`resizer-${panelSide}-tabs-panel`);
        this.levelEditor.resizerManager.setCollapsed(resizer, collapse);

        const stateKey = `panels.${panelSide}PanelWidth`;
        const prefKey = `${panelSide}PanelWidth`;
        const previousStateKey = `panels.${panelSide}PanelPreviousWidth`;

        if (collapse) {
            // Save current size and collapse
            const currentSize = panel.offsetWidth;
            this.stateManager.set(previousStateKey, currentSize);
            
            panel.style.width = '0px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
            
            // Update resizer position and save state
            this.updateResizerPosition(panelSide, 0);
            this.stateManager.set(stateKey, 0);
            if (this.userPrefs) {
                this.userPrefs.set(prefKey, 0);
            }
        } else {
            // Expand to last known size
            const maxSize = 800;
            const lastKnownSize = this.stateManager.get(previousStateKey) ?? 300;
            const newSize = Math.min(lastKnownSize, maxSize);
            
            panel.style.width = newSize + 'px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
            
            // Update resizer position and save state
            this.updateResizerPosition(panelSide, newSize);
            this.stateManager.set(stateKey, newSize);
            if (this.userPrefs) {
                this.userPrefs.set(prefKey, newSize);
            }
        }
    }

    /**
     * Toggle collapse/expand for assets panel
     * @param {boolean} collapse - true to collapse, false to expand
     */
    toggleAssetsPanelCollapse(collapse) {
        const panel = document.getElementById('assets-panel');
        if (!panel) return;

        const resizer = document.getElementById('resizer-assets');
        this.levelEditor.resizerManager.setCollapsed(resizer, collapse);

        const stateKey = 'panels.assetsPanelHeight';
        const prefKey = 'assetsPanelHeight';
        const previousStateKey = 'panels.assetsPanelPreviousHeight';

        if (collapse) {
            // Save current size and collapse
            const currentSize = panel.offsetHeight;
            this.stateManager.set(previousStateKey, currentSize);
            
            panel.style.height = '0px';
            panel.style.display = 'none';
            
            // Save state
            this.stateManager.set(stateKey, 0);
            if (this.userPrefs) {
                this.userPrefs.set(prefKey, 0);
            }
        } else {
            // Expand to last known size
            const maxSize = 600;
            const lastKnownSize = this.stateManager.get(previousStateKey) ?? 256;
            const newSize = Math.min(lastKnownSize, maxSize);
            
            panel.style.height = newSize + 'px';
            panel.style.display = 'flex';
            
            // Save state
            this.stateManager.set(stateKey, newSize);
            if (this.userPrefs) {
                this.userPrefs.set(prefKey, newSize);
            }
        }
    }

    /**
     * Toggle collapse/expand for folders panel
     * @param {boolean} collapse - true to collapse, false to expand
     */
    toggleFoldersPanelCollapse(collapse) {
        // This method would be implemented in AssetPanel
        // For now, just delegate to AssetPanel if available
        if (this.levelEditor.assetPanel && this.levelEditor.assetPanel.toggleFoldersCollapse) {
            this.levelEditor.assetPanel.toggleFoldersCollapse(collapse);
        }
    }

    /**
     * Unified panel resize logic for both mouse and touch
     * @param {HTMLElement} panel - Panel element
     * @param {string} panelSide - Panel side ('left', 'right', 'assets')
     * @param {string} direction - Resize direction ('horizontal', 'vertical')
     * @param {number} newSize - New size in pixels
     */
    handlePanelResize(panel, panelSide, direction, newSize) {
        if (direction === 'horizontal') {
            panel.style.width = newSize + 'px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
            // Update resizer position
            this.updateResizerPosition(panelSide, newSize);
            
            // Save width to StateManager and user preferences
            if (panelSide === 'folders') {
                // Special handling for folders panel
                if (this.stateManager) {
                    this.stateManager.set('panels.foldersWidth', newSize);
                }
                if (this.userPrefs) {
                    this.userPrefs.set('foldersWidth', newSize);
                }
                // Update content visibility for folders panel
                if (this.levelEditor?.assetPanel) {
                    this.levelEditor.assetPanel.updateContentVisibility(newSize);
                }
            } else {
                if (this.stateManager) {
                    this.stateManager.set(`panels.${panelSide}PanelWidth`, newSize);
                }
                if (this.userPrefs) {
                    this.userPrefs.set(`${panelSide}PanelWidth`, newSize);
                }
            }
        } else {
            panel.style.height = newSize + 'px';
            panel.style.flexShrink = '0';
            
            // Save height to StateManager and user preferences (for assets panel)
            if (panelSide === 'assets') {
                if (this.stateManager) {
                    this.stateManager.set('panels.assetsPanelHeight', newSize);
                }
                if (this.userPrefs) {
                    this.userPrefs.set('assetsPanelHeight', newSize);
                }
            }
        }
        
        // Update UI
        this._updateUI();
    }

    /**
     * Setup tab dragging functionality for a panel
     * @param {HTMLElement} panel - Panel element
     */
    setupTabDraggingForPanel(panel) {
        const tabContainer = panel.querySelector('.flex.border-b.border-gray-700');
        if (!tabContainer || tabContainer._draggingSetup) return;

        const draggingState = window.tabDraggingState;
        const tabSelector = '.tab-right[data-tab], .tab-left[data-tab], .tab[data-tab]';

        tabContainer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const tab = e.target.closest(tabSelector);
            if (!tab) return;

            const idx = Array.from(tabContainer.children).indexOf(tab);

            // Mirror into global state (for legacy global handler compatibility)
            draggingState.draggedTab = tab;
            draggingState.draggedIndex = idx;
            draggingState.draggedPanel = panel;
            draggingState.sourceContainer = tabContainer;

            // Also keep our own copy — the legacy global mouseup handler fires first
            // and clears draggingState before ours runs, so we need a local reference.
            this._pendingDrag = { tab, index: idx, sourceContainer: tabContainer };

            tab.classList.add('dragging');
            e.preventDefault();

            this._installGlobalTabDragHandlers(e.clientX, e.clientY);
        });

        tabContainer.addEventListener('selectstart', (e) => {
            if (this._pendingDrag) e.preventDefault();
        });

        tabContainer._draggingSetup = true;
        Logger.ui.debug(`Setup tab dragging for panel ${panel.id}`);
    }

    _installGlobalTabDragHandlers(startClientX, startClientY) {
        if (this._globalTabDragInstalled) return;
        this._globalTabDragInstalled = true;

        const tabSelector = '.tab-right[data-tab], .tab-left[data-tab], .tab[data-tab]';

        // ── Ghost element — clone of the real tab so it looks identical ──
        const ghost = this._pendingDrag.tab.cloneNode(true);
        ghost.classList.remove('active', 'dragging', 'tab-drag-over');
        ghost.classList.add('tab-drag-ghost');
        ghost.style.cssText = ''; // strip any inline overrides from the original
        document.body.appendChild(ghost);
        this._dragGhost = ghost;

        // Position it under the cursor immediately (same offset the mousemove handler below
        // uses) — otherwise, since .style.left/top are only ever set from a mousemove event,
        // the ghost would sit at its unpositioned default (effectively the viewport's
        // top-left corner) for as long as the user holds the mouse down without moving it.
        ghost.style.left = (startClientX + 14) + 'px';
        ghost.style.top  = (startClientY - 12) + 'px';

        // ── Opposite panel is shown lazily, only once the cursor actually leaves ──
        // the source panel's bounds (see _globalTabMouseMove below). A drag that
        // never leaves the source panel is just a same-panel tab reorder, so it
        // shouldn't auto-create/activate the other panel.
        const srcPanel = this._pendingDrag.sourceContainer.closest('#left-tabs-panel, #right-tabs-panel');
        const srcSide  = srcPanel?.id.includes('left') ? 'left' : 'right';
        this._dragOtherSide = srcSide === 'left' ? 'right' : 'left';
        this._dragCreatedPanel = null;

        // Panel ids are unique, so matching via closest('#left-tabs-panel, #right-tabs-panel')
        // is unambiguous on its own — no need to pre-scope by tab-bar CSS classes.
        // Importantly, this treats the WHOLE panel (not just its header strip) as the drop
        // target: a freshly-created empty panel has a zero-height tab bar (no children yet),
        // so requiring the cursor to be exactly over that sliver made cross-panel drops
        // to a new panel practically unhittable.
        const clearAllDragVisuals = () => {
            document.querySelectorAll(tabSelector).forEach(t => t.classList.remove('tab-drag-over'));
            document.querySelectorAll('#left-tabs-panel, #right-tabs-panel').forEach(p =>
                p.classList.remove('tab-panel--drag-over')
            );
        };

        this._clearAllDragVisuals = clearAllDragVisuals;

        this._globalTabMouseMove = (e) => {
            if (!this._pendingDrag) return;

            ghost.style.left = (e.clientX + 14) + 'px';
            ghost.style.top  = (e.clientY - 12) + 'px';

            clearAllDragVisuals();

            const sourceContainer = this._pendingDrag.sourceContainer;
            const sourcePanel = sourceContainer.closest('#left-tabs-panel, #right-tabs-panel');

            // Lazily show the opposite panel only once the cursor actually leaves the
            // source panel's bounds — a same-panel reorder shouldn't activate it. If the
            // ghost tab comes back home, undo the auto-created panel right away instead
            // of waiting for mouseup.
            if (sourcePanel) {
                const rect = sourcePanel.getBoundingClientRect();
                const insideSource = e.clientX >= rect.left && e.clientX <= rect.right &&
                                      e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (!insideSource && !this._dragCreatedPanel &&
                    !document.getElementById(`${this._dragOtherSide}-tabs-panel`)) {
                    this.levelEditor.eventHandlers?.togglePanel(`${this._dragOtherSide}Panel`);
                    this._dragCreatedPanel = this._dragOtherSide;
                } else if (insideSource && this._dragCreatedPanel) {
                    this.removeEmptyPanel(this._dragCreatedPanel);
                    this._dragCreatedPanel = null;
                }
            }

            this._pendingDrag.tab.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            this._pendingDrag.tab.style.pointerEvents = '';

            if (!elUnder) return;

            const targetPanel = elUnder.closest('#left-tabs-panel, #right-tabs-panel');
            if (!targetPanel) return;

            if (targetPanel !== sourcePanel) {
                // Cursor is anywhere over the OTHER panel — highlight it as the drop target
                targetPanel.classList.add('tab-panel--drag-over');
            } else {
                // Same panel — show insertion hint on the sibling tab
                const targetTab = elUnder.closest(tabSelector);
                if (targetTab && targetTab !== this._pendingDrag.tab &&
                    sourceContainer.contains(targetTab)) {
                    targetTab.classList.add('tab-drag-over');
                }
            }
        };

        this._globalTabMouseUp = (e) => {
            // NOTE: window.tabDraggingGlobalMouseUp (registered in constructor) fires BEFORE
            // this handler and clears draggingState — so we use this._pendingDrag exclusively.
            const pending = this._pendingDrag;
            if (!pending) { this._cleanupTabDrag(); return; }

            const { tab: draggedTab, sourceContainer, index: draggedIndex } = pending;

            draggedTab.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            draggedTab.style.pointerEvents = '';

            if (elUnder) {
                const srcPanel = sourceContainer.closest('#left-tabs-panel, #right-tabs-panel');
                const tgtPanel = elUnder.closest('#left-tabs-panel, #right-tabs-panel');

                if (tgtPanel && tgtPanel !== srcPanel) {
                    // ── Cross-panel move — dropped anywhere over the other panel ──
                    const tabName = draggedTab.dataset.tab;
                    if (tabName && srcPanel) {
                        const fromPanel = srcPanel.id.includes('left') ? 'left' : 'right';
                        const toPanel   = tgtPanel.id.includes('left') ? 'left' : 'right';
                        this.moveTab(tabName, fromPanel, toPanel);
                    }
                } else if (tgtPanel && tgtPanel === srcPanel) {
                    // ── Same-panel reorder ──
                    const targetTab = elUnder.closest(tabSelector);
                    if (targetTab && targetTab !== draggedTab && sourceContainer.contains(targetTab)) {
                        const targetIndex = Array.from(sourceContainer.children).indexOf(targetTab);
                        if (targetIndex > draggedIndex) {
                            sourceContainer.insertBefore(draggedTab, targetTab.nextSibling);
                        } else {
                            sourceContainer.insertBefore(draggedTab, targetTab);
                        }
                        Logger.ui.debug(`Reordered tab ${draggedTab.dataset.tab} to position ${targetIndex}`);

                        const srcSide = srcPanel.id.includes('left') ? 'left' : 'right';
                        this.savePanelTabOrder(srcSide);
                    }
                }
            }

            this._cleanupTabDrag();
        };

        document.addEventListener('mousemove', this._globalTabMouseMove);
        document.addEventListener('mouseup',   this._globalTabMouseUp);
    }

    _cleanupTabDrag() {
        const pending = this._pendingDrag;
        if (pending?.tab) {
            pending.tab.classList.remove('dragging');
            pending.tab.style.pointerEvents = '';
        }
        if (this._clearAllDragVisuals) {
            this._clearAllDragVisuals();
            this._clearAllDragVisuals = null;
        }
        if (this._dragGhost) {
            this._dragGhost.remove();
            this._dragGhost = null;
        }
        // If we auto-showed the opposite panel for this drag and the tab never landed there,
        // remove it again so we don't leave an empty panel behind.
        if (this._dragCreatedPanel) {
            this.removeEmptyPanel(this._dragCreatedPanel);
            this._dragCreatedPanel = null;
        }
        this._pendingDrag = null;
        this._removeGlobalTabDragHandlers();
    }

    _removeGlobalTabDragHandlers() {
        if (this._globalTabMouseMove) {
            document.removeEventListener('mousemove', this._globalTabMouseMove);
            this._globalTabMouseMove = null;
        }
        if (this._globalTabMouseUp) {
            document.removeEventListener('mouseup', this._globalTabMouseUp);
            this._globalTabMouseUp = null;
        }
        this._globalTabDragInstalled = false;
    }

    /**
     * Remove panel if it has no tabs
     * @param {string} panelSide - 'left' or 'right'
     */
    removeEmptyPanel(panelSide) {
        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        if (!panel) return;

        const tabsContainer = panel.querySelector('.flex.border-b.border-gray-700');
        if (tabsContainer && tabsContainer.children.length === 0) {
            // Always remove empty panels completely for consistency
            // This prevents accumulation of hidden panels in DOM
            
            // Cleanup event listeners before removing
            const resizer = document.getElementById(`resizer-${panelSide}-tabs-panel`);
            if (resizer) {
                if (this.levelEditor?.resizerManager) {
                    this.levelEditor.resizerManager.unregisterResizer(resizer);
                }
                eventHandlerManager.unregisterElement(resizer);
            }
            
            
            // Remove panel and resizer completely
            panel.remove();
            if (resizer) {
                resizer.remove();
            }
            
            Logger.ui.info(`Removed empty ${panelSide} panel completely`);
            
            // Update panel state to false and disable menu item since panel is empty
            this.updatePanelStateAfterRemoval(panelSide);
            
            // Update UI after panel is removed
            this._updateUI();
        }
    }

    /**
     * Update panel state after removal - disable menu toggle when panel becomes empty
     * @param {string} panelSide - 'left' or 'right'
     */
    updatePanelStateAfterRemoval(panelSide) {
        // Map panel side to state key
        const panelKey = panelSide === 'left' ? 'leftPanel' : 'rightPanel';
        const menuItemId = `toggle-${panelKey}`;

        // Set panel state to false
        this.stateManager.set(`view.${panelKey}`, false);

        // Save to user preferences
        if (this.levelEditor.userPrefs) {
            this.levelEditor.userPrefs.set(`${panelKey}Visible`, false);
        }

        // Update menu item state - disable and uncheck
        if (this.levelEditor.eventHandlers && this.levelEditor.eventHandlers.menuManager) {
            this.levelEditor.eventHandlers.menuManager.updateToggleState(menuItemId, false);
        }

        Logger.ui.debug(`Disabled menu toggle for empty ${panelSide} panel`);
    }

    /**
     * Update panel state after creation - enable menu toggle when panel is created
     * @param {string} panelSide - 'left' or 'right'
     */
    updatePanelStateAfterCreation(panelSide) {
        // Map panel side to state key
        const panelKey = panelSide === 'left' ? 'leftPanel' : 'rightPanel';
        const menuItemId = `toggle-${panelKey}`;

        // Set panel state to true
        this.stateManager.set(`view.${panelKey}`, true);

        // Save to user preferences
        if (this.levelEditor.userPrefs) {
            this.levelEditor.userPrefs.set(`${panelKey}Visible`, true);
        }

        // Update menu item state - enable and check
        if (this.levelEditor.eventHandlers && this.levelEditor.eventHandlers.menuManager) {
            this.levelEditor.eventHandlers.menuManager.updateToggleState(menuItemId, true);
        }

        Logger.ui.debug(`Enabled menu toggle for ${panelSide} panel after creation`);
    }

    /**
     * Update panel state after tab addition - enable menu toggle when panel gets first tab
     * @param {string} panelSide - 'left' or 'right'
     */
    updatePanelStateAfterTabAddition(panelSide) {
        // Map panel side to state key
        const panelKey = panelSide === 'left' ? 'leftPanel' : 'rightPanel';
        const menuItemId = `toggle-${panelKey}`;

        // Set panel state to true if it was disabled due to being empty
        const currentState = this.stateManager.get(`view.${panelKey}`);
        if (currentState === false) {
            // Only enable if panel was disabled due to being empty
            this.stateManager.set(`view.${panelKey}`, true);

            // Save to user preferences
            if (this.levelEditor.userPrefs) {
                this.levelEditor.userPrefs.set(`${panelKey}Visible`, true);
            }

            // Update menu item state - enable and check
            if (this.levelEditor.eventHandlers && this.levelEditor.eventHandlers.menuManager) {
                this.levelEditor.eventHandlers.menuManager.updateToggleState(menuItemId, true);
            }

            Logger.ui.debug(`Enabled menu toggle for ${panelSide} panel after tab addition`);
        }
    }

    /**
     * Initialize assets panel position and resizer
     */
    initializeAssetsPanel() {
        Logger.ui.info('Initializing assets panel...');
        
        // Get saved height or use default
        const savedHeight = this.userPrefs?.get('assetsPanelHeight') ?? 256;
        this.stateManager.set('panels.assetsPanelHeight', savedHeight);
        
        
        // Apply saved height
        const assetsPanel = document.getElementById('assets-panel');
        if (assetsPanel) {
            if (savedHeight <= 5) {
                // Panel is collapsed
                assetsPanel.style.height = '0px';
                assetsPanel.style.display = 'none';
            } else {
                // Panel is expanded
                assetsPanel.style.height = savedHeight + 'px';
                assetsPanel.style.flexShrink = '0';
                assetsPanel.style.display = 'flex';
            }
        }
        
        // Setup assets panel resizer
        this.setupAssetsPanelResizer();
        
        Logger.ui.info(`Assets panel initialized with height: ${savedHeight}px`);
    }

    /**
     * Setup resizer for assets panel
     */
    setupAssetsPanelResizer() {
        const resizer = document.getElementById('resizer-assets');
        const panel = document.getElementById('assets-panel');
        
        if (!resizer || !panel) {
            Logger.ui.warn('Assets panel resizer or panel not found');
            return;
        }

        Logger.ui.info('Setting up assets panel resizer...');

        // Unregister old handlers if they exist to prevent duplicates
        this.levelEditor.resizerManager.unregisterResizer(resizer);
        eventHandlerManager.unregisterElement(resizer);

        // Double click handler for collapse/expand
        const onDoubleClick = (e, resizerElement, panelElement, panelSide) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Use universal panel collapse/expand method
            const savedSize = this.stateManager?.get('panels.assetsPanelHeight') ?? 256;
            const isCollapsed = savedSize <= 5;
            const shouldCollapse = !isCollapsed;
            
            this.togglePanelCollapse('assets', shouldCollapse);
        };
        
        // Register with unified ResizerManager
        this.levelEditor.resizerManager.registerResizer(
            resizer,
            panel,
            'assets',
            'vertical',
            onDoubleClick
        );
        const savedSize = this.stateManager?.get('panels.assetsPanelHeight') ?? 256;
        this.levelEditor.resizerManager.setCollapsed(resizer, savedSize <= 5);

        Logger.ui.debug('Setup assets panel resizer with unified ResizerManager');
    }

    /**
     * Destroy and cleanup resources
     */
    destroy() {
        // Cleanup resizer event listeners
        const leftResizer = document.getElementById('resizer-left-tabs-panel');
        const rightResizer = document.getElementById('resizer-right-tabs-panel');
        
        if (leftResizer) {
            this.levelEditor.resizerManager.unregisterResizer(leftResizer);
            eventHandlerManager.unregisterElement(leftResizer);
        }
        
        if (rightResizer) {
            this.levelEditor.resizerManager.unregisterResizer(rightResizer);
            eventHandlerManager.unregisterElement(rightResizer);
        }
        
        // Clear references
        this.levelEditor = null;
        this.stateManager = null;
        this.userPrefs = null;
        
        Logger.ui.info('PanelPositionManager destroyed');
    }
}
