import { Logger } from '../utils/Logger.js';

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
    }

    /**
     * Update UI after panel changes
     * @private
     */
    _updateUI() {
        // Update canvas
        if (window.updateCanvas) {
            window.updateCanvas();
        }
        // Update panels
        if (this.levelEditor && this.levelEditor.updateAllPanels) {
            this.levelEditor.updateAllPanels();
        }
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
            { name: 'layers', text: 'Layers', active: false },
            { name: 'outliner', text: 'Outliner', active: false }
        ];

        defaultTabs.forEach(tab => {
            const tabButton = document.createElement('button');
            tabButton.setAttribute('data-tab', tab.name);
            tabButton.className = `tab-right ${tab.active ? 'active' : ''}`;
            tabButton.id = `${tab.name}-tab`;
            tabButton.textContent = tab.text;
            tabsContainer.appendChild(tabButton);
        });

        // Move existing content panels to temporary container
        const contentPanels = [
            'details-content-panel',
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

        Logger.ui.info(`Tab ${tabName} moved from ${fromPanel} to ${toPanel}`);
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
        panel.className = `bg-gray-900 flex flex-col ${panelSide === 'left' ? 'border-r border-gray-700' : 'border-l border-gray-700'}`;
        
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
        const mainContainer = document.querySelector('.flex.flex-grow.min-h-0');
        const mainPanel = document.getElementById('main-panel');

        if (panelSide === 'left') {
            // Insert as absolute positioned overlay on main container
            mainContainer.style.position = 'relative';
            panel.style.position = 'absolute';
            panel.style.left = '0';
            panel.style.top = '0';
            panel.style.height = '100%';
            panel.style.zIndex = '10';
            mainContainer.appendChild(panel);
            
            // Create resizer for left panel
            this.createPanelResizer(panel, 'left');
        } else {
            // Insert after main panel
            mainContainer.appendChild(panel);
            
            // Create resizer for right panel (same as left panel)
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
            resizer.className = `resizer resizer-${panelSide}-tabs-panel`;
            
            // Insert resizer into layout
            const mainContainer = document.querySelector('.flex.flex-grow.min-h-0');
            if (panelSide === 'left') {
                // For left panel, insert as absolute positioned element after the panel
                resizer.style.position = 'absolute';
                resizer.style.left = '0';
                resizer.style.top = '0';
                resizer.style.height = '100%';
                resizer.style.zIndex = '15'; // Higher than panel
                mainContainer.appendChild(resizer);
            } else {
                // For right panel, insert before the panel (between main and right panel)
                mainContainer.insertBefore(resizer, panel);
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
        // Find tab button
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (!tabButton) {
            Logger.ui.warn(`Tab button not found for ${tabName}`);
            return;
        }

        // Find the original tab content
        const tabContent = document.getElementById(`${tabName}-content-panel`);
        if (!tabContent) {
            Logger.ui.warn(`Tab content not found for ${tabName}`);
            return;
        }

        // Move tab button
        const fromTabsContainer = fromContainer.querySelector('.flex.border-b.border-gray-700');
        const toTabsContainer = toContainer.querySelector('.flex.border-b.border-gray-700');
        
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
        const fromContentContainer = fromContainer.querySelector('.flex-grow.overflow-y-auto');
        const toContentContainer = toContainer.querySelector('.flex-grow.overflow-y-auto');
        
        // Content containers found successfully
        
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
            const remainingTabs = fromPanelElement.querySelectorAll('.tab-right, .tab-left');
            if (remainingTabs.length > 0) {
                // Find the tab closest to the separator (main panel)
                const tabClosestToSeparator = this.getTabClosestToSeparator(remainingTabs, fromPanel);
                if (tabClosestToSeparator) {
                    const tabName = tabClosestToSeparator.dataset.tab;
                    if (this.levelEditor && this.levelEditor.eventHandlers) {
                        this.levelEditor.eventHandlers.setActivePanelTab(tabName, fromPanel);
                    }
                    Logger.ui.debug(`Auto-activated tab closest to separator: ${tabName} in ${fromPanel} panel`);
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
        console.log(`⚙️ Setting up panel resizer for ${panelSide} panel...`);
        Logger.ui.info(`Setting up panel resizer for ${panelSide} panel...`);
        let isResizing = false;
        
        // Get saved width from StateManager
        const savedWidth = this.stateManager?.get(`panels.${panelSide}PanelWidth`) ?? null;
        

        
        if (savedWidth !== null && savedWidth !== undefined) {
            
            if (savedWidth > 0) {
                // Panel is expanded, use saved width as current
                panel.style.width = savedWidth + 'px';
                // Update resizer position for left panel
                if (panelSide === 'left') {
                    resizer.style.left = savedWidth + 'px';
                }
            } else {
                // Panel is collapsed
                panel.style.width = '0px';
                // Update resizer position for left panel
                if (panelSide === 'left') {
                    resizer.style.left = '0px';
                }
            }
            if (panelSide === 'left') {
                // Left panel is absolutely positioned, don't set flex properties
                panel.style.flexShrink = '';
                panel.style.flexGrow = '';
            } else {
                panel.style.flexShrink = '0';
                panel.style.flexGrow = '0';
            }
        } else {
            // Set default width if no saved width
            panel.style.width = previousWidth + 'px';
            // Update resizer position for left panel
            if (panelSide === 'left') {
                resizer.style.left = previousWidth + 'px';
                panel.style.flexShrink = '';
                panel.style.flexGrow = '';
            } else {
                panel.style.flexShrink = '0';
                panel.style.flexGrow = '0';
            }
            
            // Save initial state to StateManager
            if (this.stateManager) {
                this.stateManager.set(`panels.${panelSide}PanelWidth`, previousWidth);
                this.stateManager.set(`panels.${panelSide}PanelPreviousWidth`, previousWidth);
                
            }
        }

        // Mouse down - start resizing (same as left panel)
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            e.preventDefault();
            e.stopPropagation();
        });

        // Register with TouchSupportManager using TouchSupportUtils
        // Register touch support immediately after resizer is created
        this.registerTouchSupportForResizer(resizer, panel, panelSide, 'horizontal');

        // Mouse move - resize panel using unified logic
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const mainContainer = document.querySelector('.flex.flex-grow.min-h-0');
            const containerWidth = mainContainer.clientWidth;
            const resizerWidth = 6;
            const minWidth = 0;
            const maxWidth = containerWidth - resizerWidth;
            
            let newWidth;
            if (panelSide === 'left') {
                newWidth = Math.max(minWidth, Math.min(e.clientX, maxWidth));
            } else {
                newWidth = Math.max(minWidth, Math.min(containerWidth - e.clientX, maxWidth));
            }
            
            // Use unified resize logic
            this.handlePanelResize(panel, panelSide, 'horizontal', newWidth);
        };

        // Mouse up - stop resizing
        const handleMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                
                // Save width to StateManager and user preferences
                const currentWidth = panel.offsetWidth;
                if (this.stateManager) {
                    this.stateManager.set(`panels.${panelSide}PanelWidth`, currentWidth);
                }
                if (this.userPrefs) {
                    this.userPrefs.set(`${panelSide}PanelWidth`, currentWidth);
                }
                
                
                Logger.ui.debug(`Saved ${panelSide} panel width: ${currentWidth}px`);
            }
        };

        // Add global mouse events (only if not already added)
        if (!resizer._globalListenersAdded) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            resizer._globalListenersAdded = true;
        }


        // Double-click to toggle collapse/expand
        resizer.addEventListener('dblclick', (e) => {
            Logger.ui.info(`${panelSide} panel resizer double-click triggered`);
            e.preventDefault();
            e.stopPropagation();
            
            // Use universal double-click handler
            this.levelEditor.touchSupportManager.handlePanelDoubleClick(resizer, {
                panel,
                panelSide,
                stateManager: this.stateManager,
                userPrefs: this.userPrefs,
                direction: 'horizontal',
                stateKey: `panels.${panelSide}PanelWidth`,
                prefKey: `${panelSide}PanelWidth`,
            });
        });

        // Store cleanup function on the resizer element
        resizer._cleanup = () => {
            if (resizer._globalListenersAdded) {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                resizer._globalListenersAdded = false;
            }
        };

        Logger.ui.debug(`Setup resizer for ${panelSide} panel with full functionality`);
    }

    /**
     * Register touch support for a resizer element
     * @param {HTMLElement} resizer - Resizer element
     * @param {HTMLElement} panel - Panel element
     * @param {string} panelSide - Panel side ('left', 'right', 'assets')
     * @param {string} direction - Resize direction ('horizontal', 'vertical')
     */
    registerTouchSupportForResizer(resizer, panel, panelSide, direction) {
        if (!this.levelEditor.touchInitializationManager) {
            Logger.ui.warn('TouchInitializationManager not available for resizer touch support');
            return;
        }

        // Use centralized touch initialization manager
        this.levelEditor.touchInitializationManager.registerPanelResizerTouchSupport(resizer, panel, panelSide, direction);
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
            if (panelSide === 'left') {
                // Left panel is absolutely positioned, don't set flex properties
                panel.style.flexShrink = '';
                panel.style.flexGrow = '';
                
                // Update resizer position for left panel
                const resizer = document.getElementById(`resizer-${panelSide}-tabs-panel`);
                if (resizer) {
                    resizer.style.left = newSize + 'px';
                }
            } else {
                panel.style.flexShrink = '0';
                panel.style.flexGrow = '0';
            }
        } else {
            panel.style.height = newSize + 'px';
            panel.style.flexShrink = '0';
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
        if (!tabContainer) return;

        // Check if dragging is already setup for this container
        if (tabContainer._draggingSetup) return;

        // Get global dragging state from window
        if (!window.tabDraggingState) {
            window.tabDraggingState = {
                draggedTab: null,
                draggedIndex: -1,
                draggedPanel: null
            };
        }

        const draggingState = window.tabDraggingState;

        // Make tabs draggable
        tabContainer.addEventListener('mousedown', (e) => {
            const tab = e.target.closest('.tab-right, .tab-left');
            if (!tab) return;

            draggingState.draggedTab = tab;
            draggingState.draggedIndex = Array.from(tabContainer.children).indexOf(tab);
            draggingState.draggedPanel = panel;
            
            // Add dragging class
            tab.classList.add('dragging');
            
            // Prevent default to avoid text selection
            e.preventDefault();
        });

        // Handle mouse move for drag over effects
        tabContainer.addEventListener('mousemove', (e) => {
            if (!draggingState.draggedTab || draggingState.draggedPanel !== panel) return;

            const tab = e.target.closest('.tab-right, .tab-left');
            if (!tab || tab === draggingState.draggedTab) {
                // Remove drag-over from all tabs in this container
                tabContainer.querySelectorAll('.tab-right, .tab-left').forEach(t => t.classList.remove('tab-drag-over'));
                return;
            }

            const targetIndex = Array.from(tabContainer.children).indexOf(tab);
            
            // Remove drag-over from all tabs in this container
            tabContainer.querySelectorAll('.tab-right, .tab-left').forEach(t => t.classList.remove('tab-drag-over'));
            
            // Add drag-over to target tab
            tab.classList.add('tab-drag-over');
        });

        // Handle mouse up to complete drag
        tabContainer.addEventListener('mouseup', (e) => {
            if (!draggingState.draggedTab || draggingState.draggedPanel !== panel) return;

            const targetTab = e.target.closest('.tab-right, .tab-left');
            if (targetTab && targetTab !== draggingState.draggedTab) {
                const targetIndex = Array.from(tabContainer.children).indexOf(targetTab);
                const draggedIndex = draggingState.draggedIndex;
                
                // Move the tab to new position
                if (targetIndex > draggedIndex) {
                    tabContainer.insertBefore(draggingState.draggedTab, targetTab.nextSibling);
                } else {
                    tabContainer.insertBefore(draggingState.draggedTab, targetTab);
                }
                
                Logger.ui.debug(`Moved tab ${draggingState.draggedTab.dataset.tab} to position ${targetIndex}`);
            }

            // Clean up dragging state
            draggingState.draggedTab.classList.remove('dragging');
            tabContainer.querySelectorAll('.tab-right, .tab-left').forEach(t => t.classList.remove('tab-drag-over'));
            
            draggingState.draggedTab = null;
            draggingState.draggedIndex = -1;
            draggingState.draggedPanel = null;
        });

        // Prevent text selection during drag
        tabContainer.addEventListener('selectstart', (e) => {
            if (draggingState.draggedTab) {
                e.preventDefault();
            }
        });

        // Add global mouseup handler to clean up if mouse is released outside container
        if (!window.tabDraggingGlobalMouseUp) {
            window.tabDraggingGlobalMouseUp = (e) => {
                if (draggingState.draggedTab) {
                    // Clean up dragging state
                    draggingState.draggedTab.classList.remove('dragging');
                    document.querySelectorAll('.tab-right, .tab-left').forEach(t => t.classList.remove('tab-drag-over'));
                    
                    draggingState.draggedTab = null;
                    draggingState.draggedIndex = -1;
                    draggingState.draggedPanel = null;
                }
            };
            document.addEventListener('mouseup', window.tabDraggingGlobalMouseUp);
        }

        // Mark as setup
        tabContainer._draggingSetup = true;

        Logger.ui.debug(`Setup tab dragging for panel ${panel.id}`);
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
            if (resizer && resizer._cleanup) {
                resizer._cleanup();
            }
            
            // Clean up absolute positioning for left panel
            if (panelSide === 'left') {
                const mainContainer = document.querySelector('.flex.flex-grow.min-h-0');
                if (mainContainer) {
                    mainContainer.style.position = '';
                }
                // Remove absolute positioned resizer
                const resizer = document.getElementById(`resizer-${panelSide}-tabs-panel`);
                if (resizer) {
                    resizer.style.position = '';
                    resizer.style.left = '';
                    resizer.style.top = '';
                    resizer.style.height = '';
                    resizer.style.zIndex = '';
                }
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

        let isResizing = false;


        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const deltaY = e.clientY - initialMouseY;
            const newHeight = Math.max(0, Math.min(600, initialPanelHeight - deltaY));
            
            // Use unified resize logic
            this.handlePanelResize(panel, 'assets', 'vertical', newHeight);
        };

        const handleMouseUp = (e) => {
            if (!isResizing) return;
            
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizer.classList.remove('resizing');
            
            // Save new height
            const currentHeight = panel.offsetHeight;
            this.stateManager.set('panels.assetsPanelHeight', currentHeight);
            this.userPrefs?.set('assetsPanelHeight', currentHeight);
            
            
            // Update UI
            this._updateUI();
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        let initialMouseY = 0;
        let initialPanelHeight = 0;

        // Mouse down - start resizing (with delay to allow dblclick)
        resizer.addEventListener('mousedown', (e) => {
            // Add small delay to allow dblclick to register
            setTimeout(() => {
                if (isResizing) return; // Already handled by dblclick
                
                isResizing = true;
                initialMouseY = e.clientY;
                initialPanelHeight = panel.offsetHeight;
                
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
                resizer.classList.add('resizing');
                
                e.preventDefault();
                e.stopPropagation();
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }, 50);
        });

        // Register with TouchSupportManager using TouchSupportUtils
        // Register touch support immediately after resizer is created
        this.registerTouchSupportForResizer(resizer, panel, 'assets', 'vertical');

        // Double-click to toggle collapse/expand
        resizer.addEventListener('dblclick', (e) => {
            Logger.ui.info('Assets panel resizer double-click triggered');
            e.preventDefault();
            e.stopPropagation();
            
            // Prevent mousedown timeout from starting resize
            isResizing = false;
            
            // Use universal double-click handler
            this.levelEditor.touchSupportManager.handlePanelDoubleClick(resizer, {
                panel,
                panelSide: 'assets',
                stateManager: this.stateManager,
                userPrefs: this.userPrefs,
                direction: 'vertical',
                stateKey: 'panels.assetsPanelHeight',
                prefKey: 'assetsPanelHeight',
                previousSizeRef: previousHeightRef
            }); 
        });

        Logger.ui.debug('Setup assets panel resizer with full functionality');
    }

    /**
     * Destroy and cleanup resources
     */
    destroy() {
        // Cleanup resizer event listeners
        const leftResizer = document.getElementById('resizer-left-tabs-panel');
        const rightResizer = document.getElementById('resizer-right-tabs-panel');
        
        if (leftResizer && leftResizer._cleanup) {
            leftResizer._cleanup();
        }
        
        if (rightResizer && rightResizer._cleanup) {
            rightResizer._cleanup();
        }
        
        // Clear references
        this.levelEditor = null;
        this.stateManager = null;
        this.userPrefs = null;
        
        Logger.ui.info('PanelPositionManager destroyed');
    }
}
