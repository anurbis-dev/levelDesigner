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
        if (rightPanel.parentElement) {
            rightPanel.parentElement.removeChild(rightPanel);
        }
        if (resizerX.parentElement) {
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

        // Initialize tab positions (this will create panels only if needed)
        this.initializeTabPositions();
        
        console.log('✅ Panel positions initialization completed');
        window.panelInitializationCompleted = true; // Global flag for debugging
        Logger.ui.info('Panel positions initialization completed');
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
                // This will create panels if they don't exist
                this.moveTab(tabName, 'temp', position);
            });
            
            // Remove temporary container
            this.removeTemporaryTabContainer();
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
        tabsContainer.className = 'flex border-b border-gray-700 flex-shrink-0';
        
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
                contentPanel.parentNode?.removeChild(contentPanel);
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
        this.updateActiveTabAfterMove(tabName, toPanel);
        
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
            
        Logger.ui.info(`Created ${panelSide} tabs panel`);
        } else {
            // Panel exists, check if it has tabs or is hidden
            const tabContainer = panel.querySelector('.flex.border-b.border-gray-700');
            const hasTabs = tabContainer && tabContainer.children.length > 0;
            const isHidden = panel.style.display === 'none' || panel.classList.contains('hidden');
            
            // Don't recreate if panel was just created or if we're initializing
            if ((!hasTabs || isHidden) && !panel._newlyCreated && !this._initializing) {
                // Panel exists but is empty or hidden, recreate its structure
                Logger.ui.info(`Recreating ${isHidden ? 'hidden' : 'empty'} ${panelSide} tabs panel structure`);
                
                // Clear the panel and recreate structure
                // Temporarily disable any observers during DOM manipulation
                const originalInnerHTML = panel.innerHTML;
                panel.innerHTML = '';
                const newStructure = this.createTabsPanel(panelSide);
                
                // Copy the new structure content to existing panel
                while (newStructure.firstChild) {
                    panel.appendChild(newStructure.firstChild);
                }
                
                // Ensure panel is visible
                panel.style.display = 'flex';
                panel.classList.remove('hidden');
            }
            
            // Update canvas after panel is restored
            if (window.updateCanvas) {
                window.updateCanvas();
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
        tabsContainer.className = 'flex border-b border-gray-700 flex-shrink-0';

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
            // Insert before main panel
            mainContainer.insertBefore(panel, mainPanel);
            
            // Create resizer for left panel
            this.createPanelResizer(panel, 'left');
        } else {
            // Insert after main panel
            mainContainer.appendChild(panel);
            
            // Create resizer for right panel (same as left panel)
            this.createPanelResizer(panel, 'right');
        }
        
        // Update canvas after panel is added
        if (window.updateCanvas) {
            window.updateCanvas();
        }
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
            resizer.className = 'resizer';
            
            // Insert resizer into layout
            const mainContainer = document.querySelector('.flex.flex-grow.min-h-0');
            if (panelSide === 'left') {
                mainContainer.insertBefore(resizer, panel.nextSibling);
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
            fromTabsContainer.removeChild(tabButton);
            toTabsContainer.appendChild(tabButton);
            
            // Remove newly created flag since panel now has tabs
            if (toContainer._newlyCreated) {
                toContainer._newlyCreated = false;
            }
            
            // If this is the first tab in the panel, make it active
            if (toTabsContainer.children.length === 1) {
                tabButton.classList.add('active');
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
            fromContentContainer.removeChild(tabContent);
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
     * @param {string} toPanel - Target panel side
     */
    updateActiveTabAfterMove(tabName, toPanel) {
        // Skip during initialization to prevent loops
        if (this._initializing) {
            Logger.ui.debug('Skipping active tab update during initialization');
            return;
        }
        
        // Check if the moved tab was the active tab
        const activeTab = document.querySelector('.tab-right.active, .tab-left.active');
        if (activeTab && activeTab.dataset.tab === tabName) {
            // Update the active tab's CSS classes to match new panel
            activeTab.className = activeTab.className
                .replace('tab-right', `tab-${toPanel}`)
                .replace('tab-left', `tab-${toPanel}`);
            
            // Update StateManager with new active tab position
            if (this.stateManager) {
                this.stateManager.set('rightPanelTab', tabName);
            }
            
            // Update search controls for the moved tab
            if (this.levelEditor && this.levelEditor.initializeSearchControls) {
                this.levelEditor.initializeSearchControls();
            }
            
            Logger.ui.debug(`Updated active tab ${tabName} after move to ${toPanel} panel`);
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
        
        // Update panels when tab structure changes
        if (this.levelEditor && this.levelEditor.updateAllPanels) {
            this.levelEditor.updateAllPanels();
        }
        
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
        
        // Get saved width and previous width from StateManager
        const savedWidth = this.stateManager?.get(`panels.${panelSide}PanelWidth`) ?? null;
        const savedPreviousWidth = this.stateManager?.get(`panels.${panelSide}PanelPreviousWidth`) ?? null;
        
        let previousWidth = 300; // Default previous width
        if (savedPreviousWidth !== null && savedPreviousWidth !== undefined) {
            previousWidth = savedPreviousWidth;
        }
        
        if (savedWidth !== null && savedWidth !== undefined) {
            if (savedWidth > 0) {
                // Panel is expanded, use saved width as current
                panel.style.width = savedWidth + 'px';
            } else {
                // Panel is collapsed
                panel.style.width = '0px';
            }
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
        } else {
            // Set default width if no saved width
            panel.style.width = previousWidth + 'px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
            
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

        // Touch events for better touchpad/touchscreen support
        resizer.addEventListener('touchstart', (e) => {
            console.log(`👆 ${panelSide} panel resizer touchstart detected`);
            if (e.touches.length === 1) {
                isResizing = true;
                e.preventDefault();
                e.stopPropagation();
            }
        });

        resizer.addEventListener('touchmove', (e) => {
            if (!isResizing || e.touches.length !== 1) return;
            e.preventDefault();
            e.stopPropagation();
            
            const touch = e.touches[0];
            const mainContainer = document.querySelector('.flex.flex-grow.min-h-0');
            const containerWidth = mainContainer.clientWidth;
            const resizerWidth = 6;
            const minWidth = 0;
            const maxWidth = containerWidth - resizerWidth;
            
            let newWidth;
            if (panelSide === 'left') {
                newWidth = Math.max(minWidth, Math.min(touch.clientX, maxWidth));
            } else {
                newWidth = Math.max(minWidth, Math.min(containerWidth - touch.clientX, maxWidth));
            }
            
            panel.style.width = newWidth + 'px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
            
            // Update canvas
            if (window.updateCanvas) {
                window.updateCanvas();
            }
        });

        resizer.addEventListener('touchend', (e) => {
            if (isResizing) {
                console.log(`👆 ${panelSide} panel resizer touchend detected`);
                isResizing = false;
                
                // Save width to StateManager
                const currentWidth = panel.offsetWidth;
                if (this.stateManager) {
                    this.stateManager.set(`panels.${panelSide}PanelWidth`, currentWidth);
                    this.stateManager.set(`panels.${panelSide}PanelPreviousWidth`, currentWidth);
                }
                
                Logger.ui.debug(`Saved ${panelSide} panel width from touch: ${currentWidth}px`);
            }
        });

        // Mouse move - resize panel (same logic as left panel)
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
            
            panel.style.width = newWidth + 'px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
            
            // Update canvas
            if (window.updateCanvas) {
                window.updateCanvas();
            }
        };

        // Mouse up - stop resizing
        const handleMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                
                // Save width to StateManager
                const currentWidth = panel.offsetWidth;
                if (this.stateManager) {
                    this.stateManager.set(`panels.${panelSide}PanelWidth`, currentWidth);
                    this.stateManager.set(`panels.${panelSide}PanelPreviousWidth`, currentWidth);
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

            const currentWidth = panel.offsetWidth;
            const mainContainer = document.querySelector('.flex.flex-grow.min-h-0');
            const containerWidth = mainContainer.clientWidth;
            const resizerWidth = 6;
            const minWidth = 0;
            const maxWidth = containerWidth - resizerWidth;

            // Check if panel is collapsed by looking at StateManager
            const savedWidth = this.stateManager?.get(`panels.${panelSide}PanelWidth`) ?? 300;
            const isCollapsed = savedWidth <= 5; // Small threshold for collapsed panels
            
            Logger.ui.info(`${panelSide} panel double-click: currentWidth=${currentWidth}, savedWidth=${savedWidth}, isCollapsed=${isCollapsed}, previousWidth=${previousWidth}`);
            
            if (isCollapsed) {
                // Restore to previous width
                const newWidth = Math.min(previousWidth, maxWidth);
                panel.style.width = newWidth + 'px';
                panel.style.flexShrink = '0';
                panel.style.flexGrow = '0';
                
                // Save to StateManager
                if (this.stateManager) {
                    this.stateManager.set(`panels.${panelSide}PanelWidth`, newWidth);
                }
                
                Logger.ui.info(`Expanded ${panelSide} panel to ${newWidth}px`);
            } else {
                // Save current width and collapse
                previousWidth = currentWidth;
                panel.style.width = '0px';
                panel.style.flexShrink = '0';
                panel.style.flexGrow = '0';
                
                // Save current width as 0 and previous width to StateManager
                if (this.stateManager) {
                    this.stateManager.set(`panels.${panelSide}PanelWidth`, 0);
                    this.stateManager.set(`panels.${panelSide}PanelPreviousWidth`, previousWidth);
                }
                
                Logger.ui.info(`Collapsed ${panelSide} panel (saved width: ${previousWidth}px)`);
            }

            // Update canvas
            if (window.updateCanvas) {
                window.updateCanvas();
            }
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
            if (panelSide === 'left') {
                // Remove left panel and its resizer (it's dynamically created)
                panel.remove();
                
                const resizer = document.getElementById(`resizer-${panelSide}-tabs-panel`);
                if (resizer) {
                    // Cleanup event listeners before removing
                    if (resizer._cleanup) {
                        resizer._cleanup();
                    }
                    resizer.remove();
                }
                
                Logger.ui.info(`Removed empty ${panelSide} panel`);
            } else if (panelSide === 'right') {
                // Hide right panel and its resizer (it's part of HTML structure)
                panel.style.display = 'none';
                panel.classList.add('hidden');
                
                const resizer = document.getElementById(`resizer-${panelSide}-tabs-panel`);
                if (resizer) {
                    resizer.style.display = 'none';
                    resizer.classList.add('hidden');
                }
                
                Logger.ui.info(`Hidden empty ${panelSide} panel`);
            }
            
            // Update canvas after panel is removed/hidden
            if (window.updateCanvas) {
                window.updateCanvas();
            }
        }
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
