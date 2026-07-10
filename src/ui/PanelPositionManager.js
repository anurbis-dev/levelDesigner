import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';
import { PanelSizeCalculator } from '../utils/PanelSizeCalculator.js';
import { SearchSectionUtils } from '../utils/SearchSectionUtils.js';

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

            // Restore nested split-tab composites — must run after tab order/position so
            // both members of each saved pair already exist as standalone tabs to merge.
            this.applyPanelSplits('left');
            this.applyPanelSplits('right');

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
            { name: 'details', text: 'Details', active: true },
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
     * Persist the current nested split-tab composites (see mergeTabIntoSplit) for a panel to
     * stateManager/userPrefs. Reads live DOM state rather than tracking it incrementally, so it
     * stays correct no matter which of merge/replace/detach mutated the composite last.
     * @param {string} panelSide - 'left' or 'right' (anything else, e.g. 'temp', is ignored)
     */
    savePanelSplits(panelSide) {
        if (this._initializing) return;
        if (panelSide !== 'left' && panelSide !== 'right') return;

        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        const contentContainer = panel?.querySelector('.flex-grow.overflow-y-auto');
        if (!contentContainer) return;

        const splits = Array.from(contentContainer.children)
            .filter(child => child.classList.contains('tab-split-container'))
            .map(wrapper => {
                const target = wrapper.dataset.panelTabName;
                const paneEls = Array.from(wrapper.querySelectorAll(':scope > .tab-split-pane'));
                const paneTabNames = paneEls.map(pane => pane.querySelector('[data-panel-tab-content="true"]')?.dataset.panelTabName);
                const dragged = paneTabNames.find(name => name && name !== target);
                if (!target || !dragged) return null;
                // Mirrors mergeTabIntoSplit's own convention: position is where the NON-anchor
                // ("dragged") pane sits, so applyPanelSplits can hand this straight back to it.
                const position = paneTabNames[0] === dragged ? 'top' : 'bottom';
                // Top pane's size, set by _setupSplitResizer as the user drags — absent until
                // the user has actually resized this split at least once (default 50/50).
                const rawRatio = paneEls[0]?.dataset.splitRatio;
                const ratio = rawRatio !== undefined ? parseFloat(rawRatio) : null;
                return { target, dragged, position, ratio };
            })
            .filter(Boolean);

        const stateKey = panelSide === 'left' ? 'leftPanelSplits' : 'rightPanelSplits';
        this.stateManager.set(stateKey, splits);
        if (this.userPrefs) {
            this.userPrefs.set(stateKey, splits);
        }
    }

    /**
     * Recreate previously saved split-tab composites for a panel (called during
     * initializeTabPositions, after tab order/position are restored so both members of each
     * saved pair already exist as standalone tabs somewhere to merge). Reuses mergeTabIntoSplit
     * itself rather than rebuilding the DOM structure separately, so restore and live
     * drag-to-merge can never drift apart.
     * @param {string} panelSide - 'left' or 'right'
     */
    applyPanelSplits(panelSide) {
        const stateKey = panelSide === 'left' ? 'leftPanelSplits' : 'rightPanelSplits';
        const savedSplits = this.userPrefs?.get(stateKey);
        if (!Array.isArray(savedSplits) || savedSplits.length === 0) return;

        savedSplits.forEach(({ target, dragged, position, ratio }) => {
            if (target && dragged && position) {
                this.mergeTabIntoSplit(dragged, target, panelSide, position, ratio);
            }
        });

        this.stateManager.set(stateKey, savedSplits);
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
            // A split-pane detach drag (separate protocol, see _startSplitPaneDetachDrag)
            // may already be in flight — don't start a second, overlapping drag.
            if (this._splitDetachDragActive) return;
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
        this._pendingSplitTarget = null;

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
            this._pendingSplitTarget = null;
            this._hideSplitHint();

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

            // Dropping onto another tab's CONTENT area (not its tab strip) nests the
            // dragged tab as a split section instead of moving/reordering the tab bar entry.
            // v1: a composite (already-split) tab can't itself be dragged into a new split —
            // it keeps moving as a whole via the normal cross-panel/reorder path.
            const splitTarget = this._pendingDrag.tab.dataset.tabGroup
                ? null
                : this._findSplitDropTarget(elUnder, e.clientY, this._pendingDrag.tab.dataset.tab);
            if (splitTarget) {
                this._pendingSplitTarget = splitTarget;
                this._showSplitHint(splitTarget.rect, splitTarget.position);
                return;
            }

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

            try {
                if (this._pendingSplitTarget) {
                    // ── Dropped onto another tab's content area ──
                    const target = this._pendingSplitTarget;
                    const tabName = draggedTab.dataset.tab;
                    if (tabName) {
                        if (target.mode === 'replace') {
                            // Onto a pane of an EXISTING composite — replace that pane's occupant
                            if (tabName !== target.evictedTabName) {
                                this.replacePaneInSplit(tabName, target.evictedTabName, target.panelSide);
                            }
                        } else if (tabName !== target.targetTabName) {
                            // Onto a plain tab's content — nest both as a new split section
                            this.mergeTabIntoSplit(tabName, target.targetTabName, target.panelSide, target.position);
                        }
                    }
                } else if (elUnder) {
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
            } finally {
                // However the commit branch above resolves (including if it throws), the drag
                // must always be torn down — otherwise the ghost keeps following the cursor
                // forever and _globalTabDragInstalled stays stuck true, silently no-opping every
                // subsequent drag's handler installation (see _installGlobalTabDragHandlers guard).
                this._cleanupTabDrag();
            }
        };

        // Safety net: if the window loses focus mid-drag (Alt-Tab, a native dialog stealing
        // the mouseup, etc.) no 'mouseup' may ever reach document — cancel the drag instead of
        // leaving _pendingDrag stuck truthy forever, which would also permanently block the
        // split-pane detach drag (mutually exclusive via the _pendingDrag/_splitDetachDragActive
        // guards in setupTabDraggingForPanel / _setupSplitPaneHeaderDragging).
        this._globalTabWindowBlur = () => this._cleanupTabDrag();

        document.addEventListener('mousemove', this._globalTabMouseMove);
        document.addEventListener('mouseup',   this._globalTabMouseUp);
        window.addEventListener('blur', this._globalTabWindowBlur);
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
        this._removeSplitHint();
        this._pendingSplitTarget = null;
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
        if (this._globalTabWindowBlur) {
            window.removeEventListener('blur', this._globalTabWindowBlur);
            this._globalTabWindowBlur = null;
        }
        this._globalTabDragInstalled = false;
    }

    // ────────────────────────────────────────────────────────────────
    // Nested split sections — dropping a dragged tab onto another tab's
    // CONTENT area (not its tab strip) nests it as a split section instead
    // of moving/reordering the tab bar entry. Dropping onto one pane of an
    // EXISTING composite instead REPLACES that pane's occupant (replacePaneInSplit).
    // What happens to the evicted occupant depends on where the dragged tab came from:
    //   - dragged tab was a plain standalone tab → evicted tab is re-homed as a new
    //     standalone tab in the DRAGGED tab's own source panel (same panel if the drag was
    //     same-panel, the other panel if cross-panel), filling the exact slot it vacated.
    //   - dragged tab was ITSELF nested in a different composite → true pane-for-pane swap
    //     (_swapNestedPanes): the evicted tab takes the dragged tab's old slot in THAT
    //     composite instead, so both composites stay composites and just trade one member.
    // Detaching a pane's header pulls it back out into a standalone tab (detachFromSplit).
    // Two independent drag protocols feed into this same merge/replace/detach
    // logic: the ordinary tab-bar drag (source: a real standalone button) and
    // the split-pane-header drag (source: a tab already nested in another
    // composite). _extractDraggedTab()/_collapseSplitPane() abstract over where
    // the dragged tab currently lives for the merge and standalone-source-replace
    // paths; replacePaneInSplit checks nesting itself up front so it can route a
    // nested dragged tab to the true-swap path instead.
    // Single level of nesting only. Composite membership (which tab is merged into which,
    // top/bottom position, and the resizer's pane-size ratio) IS persisted per panel side via
    // savePanelSplits/applyPanelSplits (stateManager keys leftPanelSplits/rightPanelSplits,
    // mirrored to userPrefs) — a page reload rebuilds the same composites by replaying
    // mergeTabIntoSplit with the saved ratio. A split that was never manually resized has no
    // saved ratio and restores at the CSS default even 50/50 split (see _setupSplitResizer).
    // ────────────────────────────────────────────────────────────────

    /**
     * Detect whether the cursor is over another tab's CONTENT area, meaning the drop
     * should nest the dragged tab as a split section (or replace a pane of an existing
     * split) rather than move/reorder the tab. Shared by both drag protocols — the
     * ordinary tab-bar drag and the split-pane-header detach drag — so the dragged tab's
     * identity is passed in explicitly rather than read from `this._pendingDrag`, which
     * only the tab-bar protocol ever populates.
     * @param {HTMLElement} elUnder - Element under the cursor
     * @param {number} clientY - Cursor Y position (used to pick top/bottom half)
     * @param {string} draggedTabName - Tab being dragged (never a composite — callers
     *   guard that separately, since only the tab-bar drag can even pick one up)
     * @returns {{mode:'merge', targetTabName:string, panelSide:string, position:string, rect:DOMRect}|
     *           {mode:'replace', evictedTabName:string, panelSide:string, position:'replace', rect:DOMRect}|null}
     */
    _findSplitDropTarget(elUnder, clientY, draggedTabName) {
        const contentContainer = elUnder.closest('.flex-grow.overflow-y-auto');
        if (!contentContainer) return null;

        // Only the panel's currently-visible DIRECT child counts — a plain descendant query
        // would also match a *hidden* sibling split container elsewhere in the same panel
        // and wrongly block merging into the actually-active plain tab.
        const activeContent = Array.from(contentContainer.children).find(
            child => child.dataset?.panelTabContent === 'true' && !child.classList.contains('hidden')
        );
        if (!activeContent) return null;

        const targetPanel = contentContainer.closest('#left-tabs-panel, #right-tabs-panel');
        if (!targetPanel) return null;
        const panelSide = targetPanel.id.includes('left') ? 'left' : 'right';

        if (activeContent.classList.contains('tab-split-container')) {
            // Already a composite — the drop zone is whichever pane the cursor is over,
            // and the drop REPLACES that pane's occupant instead of adding a third nesting
            // level (v1 stays single-level).
            // If the dragged tab is itself currently nested (split-pane-header drag), its
            // OWN host composite can't be its own replace target — collapsing it as part of
            // committing the drop while also reading its pane as the target is ill-defined.
            const draggedContentEl = document.getElementById(`${draggedTabName}-content-panel`);
            if (draggedContentEl?.closest('.tab-split-container') === activeContent) return null;

            const pane = elUnder.closest('.tab-split-pane');
            if (!pane || !activeContent.contains(pane)) return null;
            const paneContent = pane.querySelector('[data-panel-tab-content="true"]');
            const evictedTabName = paneContent?.dataset.panelTabName;
            if (!evictedTabName || evictedTabName === draggedTabName) return null;
            return { mode: 'replace', evictedTabName, panelSide, position: 'replace', rect: pane.getBoundingClientRect() };
        }

        const targetTabName = activeContent.dataset.panelTabName;
        if (!targetTabName || targetTabName === draggedTabName) return null;

        // Use the panel's scrollable wrapper rect, not activeContent's own — plain (non-outliner)
        // tab content panels size to their intrinsic content height (no height:100%), so their
        // own rect can be far shorter than the panel body and the hint would highlight only
        // that partial area instead of the whole panel.
        const rect = contentContainer.getBoundingClientRect();
        const position = (clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom';
        return { mode: 'merge', targetTabName, panelSide, position, rect };
    }

    _showSplitHint(rect, position) {
        if (!this._splitHintEl) {
            this._splitHintEl = document.createElement('div');
            this._splitHintEl.className = 'tab-split-drop-hint';
            document.body.appendChild(this._splitHintEl);
        }
        this._splitHintEl.style.left = rect.left + 'px';
        this._splitHintEl.style.width = rect.width + 'px';
        if (position === 'replace') {
            // Replacing an existing pane in place — the whole pane IS the drop zone.
            this._splitHintEl.style.top = rect.top + 'px';
            this._splitHintEl.style.height = rect.height + 'px';
        } else {
            const half = rect.height / 2;
            this._splitHintEl.style.top = (position === 'top' ? rect.top : rect.top + half) + 'px';
            this._splitHintEl.style.height = half + 'px';
        }
        this._splitHintEl.style.display = 'block';
    }

    _hideSplitHint() {
        if (this._splitHintEl) {
            this._splitHintEl.style.display = 'none';
        }
    }

    _removeSplitHint() {
        if (this._splitHintEl) {
            this._splitHintEl.remove();
            this._splitHintEl = null;
        }
    }

    /**
     * Resolve a tab's current location and detach it from there, regardless of whether it's
     * currently a standalone tab-bar button or nested inside an existing composite (dragged via
     * its pane header). Shared by mergeTabIntoSplit/replacePaneInSplit so both commit paths work
     * the same whether the drag originated from the ordinary tab-bar protocol or the split-pane-
     * header detach protocol.
     * @param {string} draggedTabName
     * @returns {{content:HTMLElement, title:string, sourcePanel:HTMLElement, sourceSide:string}|null}
     */
    _extractDraggedTab(draggedTabName) {
        // Check nesting FIRST via the content element's actual DOM position, not via a
        // data-tab button lookup: a composite's tab-bar button keeps using one of its two
        // nested tab names as its own `data-tab` (whichever was the original merge target/
        // anchor, or whichever pane survived a later replacePaneInSplit reassignment). When
        // draggedTabName is currently nested but happens to equal that anchor name, the
        // button lookup below would match the COMPOSITE's own button instead of finding no
        // standalone button at all — its `tabGroup` guard would then bail out entirely
        // instead of falling through to the nested-pane path below, silently no-oping the
        // drag for exactly that one pane (reproducible: build two composites, one on each
        // panel, then pane-header-drag the pane whose name equals its own composite's
        // current anchor onto the other composite — nothing happens, no error either).
        const nestedContent = document.getElementById(`${draggedTabName}-content-panel`);
        if (nestedContent?.closest('.tab-split-pane')) {
            // Nested inside an existing composite. Collapse its host composite first; the
            // sibling pane becomes a plain standalone tab in its place.
            const collapsed = this._collapseSplitPane(draggedTabName);
            if (!collapsed) return null;
            return { content: collapsed.content, title: collapsed.title, sourcePanel: collapsed.hostPanel, sourceSide: collapsed.hostSide };
        }

        const draggedTabButton = document.querySelector(`.tab-right[data-tab="${draggedTabName}"], .tab-left[data-tab="${draggedTabName}"]`);
        if (!draggedTabButton) return null;
        // v1: composites can't be a merge/replace source (guarded earlier in
        // _findSplitDropTarget too, but DOM state could in principle change by mouseup)
        if (draggedTabButton.dataset.tabGroup) return null;
        const content = document.getElementById(`${draggedTabName}-content-panel`);
        if (!content) return null;
        const sourcePanel = draggedTabButton.closest('#left-tabs-panel, #right-tabs-panel');
        const sourceSide = sourcePanel?.id.includes('left') ? 'left' : 'right';
        const title = draggedTabButton.textContent;
        // The dragged tab's own tab-bar button is gone — it's nested now, not standalone
        draggedTabButton.remove();
        return { content, title, sourcePanel, sourceSide };
    }

    /**
     * Pull ONE nested tab's content out of its host composite, leaving the OTHER pane as a
     * plain standalone tab in the composite's panel. Does NOT re-home the pulled-out content
     * anywhere — that's the caller's job (detachFromSplit re-homes it as a new standalone tab;
     * mergeTabIntoSplit/replacePaneInSplit, via _extractDraggedTab, feed it into a split
     * elsewhere instead).
     * @param {string} tabName - tab currently nested in a split, to pull out
     * @returns {{content:HTMLElement, title:string, hostPanel:HTMLElement, hostSide:string}|null}
     */
    _collapseSplitPane(tabName) {
        const content = document.getElementById(`${tabName}-content-panel`);
        const pane = content?.closest('.tab-split-pane');
        const wrapper = pane?.closest('.tab-split-container');
        if (!content || !pane || !wrapper) return null;

        const wrapperTabName = wrapper.dataset.panelTabName;
        const hostPanel = wrapper.closest('#left-tabs-panel, #right-tabs-panel');
        const hostSide = hostPanel?.id.includes('left') ? 'left' : 'right';
        const compositeTabButton = hostPanel?.querySelector(
            `.flex.border-b.border-gray-700 [data-tab="${wrapperTabName}"]`
        );

        const otherPane = Array.from(wrapper.querySelectorAll(':scope > .tab-split-pane')).find(p => p !== pane);
        const otherContent = otherPane?.querySelector('[data-panel-tab-content="true"]');
        const otherTabName = otherContent?.dataset.panelTabName;
        // By construction (mergeTabIntoSplit always creates exactly 2 panes) this should
        // always resolve — but if it doesn't, abort before mutating anything rather than
        // proceeding into wrapper.remove() and silently discarding the other pane's content.
        if (!otherContent || !otherTabName) {
            Logger.ui.warn(`_collapseSplitPane: could not resolve the other pane for ${tabName} — aborting`);
            return null;
        }
        const otherTitle = otherPane?.querySelector('.tab-split-pane-header')?.textContent || otherTabName;
        const title = pane.querySelector('.tab-split-pane-header')?.textContent || tabName;

        const wrapperParent = wrapper.parentElement;

        // Unwrap: restore the remaining pane to a plain content panel, drop the wrapper
        wrapperParent.insertBefore(otherContent, wrapper);
        otherContent.classList.remove('hidden');
        otherContent.style.display = '';

        if (compositeTabButton) {
            // The remaining tab may be the ORIGINAL target (identity unchanged) or the
            // tab that was merged in (identity must switch to it) — always resync.
            compositeTabButton.dataset.tab = otherTabName;
            compositeTabButton.textContent = otherTitle;
            delete compositeTabButton.dataset.originalLabel;
            delete compositeTabButton.dataset.tabGroup;
        }

        wrapper.remove();

        // Skip during init-time restore (applyPanelSplits): activation is left for EventHandlers
        // to resolve after initialization finishes, same as updateActiveTabAfterMove does.
        if (!this._initializing && this.levelEditor?.eventHandlers && hostPanel) {
            this.levelEditor.eventHandlers.setActivePanelTab(otherTabName, hostSide);
        }

        this.savePanelSplits(hostSide);

        return { content, title, hostPanel, hostSide };
    }

    /**
     * Merge a dragged tab into another tab's content area as a nested split section.
     * The target tab's button becomes a composite ("Outliner/Layers"); both content
     * panels stay visible together, stacked top/bottom, independently resizable.
     * @param {string} draggedTabName
     * @param {string} targetTabName
     * @param {string} panelSide - Panel the target tab lives in ('left' or 'right')
     * @param {string} position - 'top' or 'bottom' — where the dragged tab's pane goes
     * @param {number|null} [ratio] - Top pane's size as a 0-100 percentage, from a previously
     *   saved split (see savePanelSplits/applyPanelSplits). Omitted/null for a live drag-merge,
     *   which always starts at an even 50/50 split.
     */
    mergeTabIntoSplit(draggedTabName, targetTabName, panelSide, position, ratio = null) {
        const targetContent = document.getElementById(`${targetTabName}-content-panel`);
        const targetPanel = document.getElementById(`${panelSide}-tabs-panel`);
        if (!targetContent || !targetPanel) return;

        const targetTabButton = targetPanel.querySelector(`.flex.border-b.border-gray-700 [data-tab="${targetTabName}"]`);
        if (!targetTabButton) return;
        // Re-verify the target isn't already split — _findSplitDropTarget checked this at the
        // last mousemove, but DOM state could in principle have changed by mouseup; committing
        // a merge into an already-split target would corrupt the single-nesting invariant.
        if (targetContent.closest('.tab-split-container')) return;

        // Capture the target's title BEFORE any mutation
        const targetTitle = targetTabButton.dataset.originalLabel || targetTabButton.textContent;

        // Resolves + detaches the dragged tab from wherever it currently lives — a standalone
        // tab-bar button, or (split-pane-header drag) nested inside another composite.
        const dragged = this._extractDraggedTab(draggedTabName);
        if (!dragged) return;
        const { content: draggedContent, title: draggedTitle, sourcePanel, sourceSide } = dragged;

        const contentContainer = targetContent.parentElement;
        // Anchor the insertion point with a placeholder rather than targetContent.nextSibling:
        // if draggedContent is target's immediate DOM sibling (same-panel merge), nextSibling
        // WOULD be draggedContent itself, which _createSplitPane below reparents away before
        // insertBefore runs — inserting relative to a now-detached node throws NotFoundError.
        const placeholder = document.createComment('split-target-anchor');
        contentContainer.insertBefore(placeholder, targetContent);

        const wrapper = document.createElement('div');
        wrapper.className = 'tab-split-container';
        wrapper.dataset.panelTabContent = 'true';
        wrapper.dataset.panelTabName = targetTabName;

        const targetPane = this._createSplitPane(targetTitle, targetContent);
        const draggedPane = this._createSplitPane(draggedTitle, draggedContent);
        const resizer = document.createElement('div');
        resizer.className = 'tab-split-resizer';

        const [firstPane, secondPane] = position === 'top' ? [draggedPane, targetPane] : [targetPane, draggedPane];
        wrapper.appendChild(firstPane);
        wrapper.appendChild(resizer);
        wrapper.appendChild(secondPane);

        contentContainer.insertBefore(wrapper, placeholder);
        placeholder.remove();
        this._setupSplitResizer(resizer, firstPane);
        if (typeof ratio === 'number' && !Number.isNaN(ratio)) {
            firstPane.style.flex = `0 0 ${ratio}%`;
            firstPane.dataset.splitRatio = String(ratio);
        }

        // Both panes are visible together now
        [targetContent, draggedContent].forEach(el => {
            el.classList.remove('hidden');
            el.style.display = '';
        });

        targetTabButton.dataset.originalLabel = targetTitle;
        targetTabButton.dataset.tabGroup = `${targetTabName},${draggedTabName}`;
        targetTabButton.textContent = `${targetTitle}/${draggedTitle}`;

        // Both nested tabs' search controls need an explicit refresh: setActivePanelTab only
        // ever passes a single tabName through to SearchSectionUtils, so the pane that wasn't
        // "the" active tab this session may never have had its search controls rendered yet.
        SearchSectionUtils.showSearchSectionForTab(targetTabName, this.levelEditor);
        SearchSectionUtils.showSearchSectionForTab(draggedTabName, this.levelEditor);

        // Clean up the source panel: remove it if now empty, or re-activate a remaining tab
        // if the dragged tab was the active one there.
        this.removeEmptyPanel(sourceSide);
        this._reactivateAfterTabRemoval(sourceSide);

        // The dragged tab now lives inside panelSide's composite — keep tabPositions in sync
        // so a reload's stale-position reconstruction (initializeTabPositions) doesn't fight
        // the leftPanelSplits/rightPanelSplits restore that runs right after it.
        this._syncTabPosition(draggedTabName, panelSide);

        this.savePanelSplits(panelSide);

        Logger.ui.info(`Merged tab ${draggedTabName} into ${targetTabName} split (${position}, ${panelSide} panel)`);
    }

    /**
     * Replace one pane's occupant inside an EXISTING split composite with a dragged tab.
     * The composite stays a composite (still exactly 2 panes) — only the dragged-onto pane's
     * content changes.
     *
     * If the dragged tab is a plain standalone tab, the pane's previous occupant is evicted
     * back out as a standalone tab in the panel the DRAGGED tab came from — not the panel
     * hosting the split. When the drag is same-panel this is the same panel either way; when
     * it's cross-panel (left ↔ right) this fills the exact slot the dragged tab vacated, making
     * it read as a two-way swap between the two panels rather than the split's panel
     * accumulating an extra tab.
     *
     * If the dragged tab is ITSELF nested inside a different composite, this instead performs
     * a true pane-for-pane swap (delegated to _swapNestedPanes): the evicted tab takes the
     * dragged tab's old slot in ITS composite (paired with its original sibling), rather than
     * being evicted as a new standalone tab and tearing that composite down.
     * @param {string} draggedTabName
     * @param {string} evictedTabName - tab currently occupying the target pane
     * @param {string} panelSide - panel hosting the split
     */
    replacePaneInSplit(draggedTabName, evictedTabName, panelSide) {
        const evictedContent = document.getElementById(`${evictedTabName}-content-panel`);
        const pane = evictedContent?.closest('.tab-split-pane');
        const wrapper = pane?.closest('.tab-split-container');
        if (!evictedContent || !pane || !wrapper) return;

        const wrapperTabName = wrapper.dataset.panelTabName;
        const compositePanel = wrapper.closest('#left-tabs-panel, #right-tabs-panel');
        const compositeSide = compositePanel?.id.includes('left') ? 'left' : 'right';
        const compositeTabButton = compositePanel?.querySelector(
            `.flex.border-b.border-gray-700 [data-tab="${wrapperTabName}"]`
        );
        if (!compositeTabButton) return;

        // Re-verify the dragged tab isn't nested in THIS SAME composite — _findSplitDropTarget
        // already guards this at the last mousemove, but DOM state could in principle have
        // changed by mouseup; collapsing a composite while also replacing a pane inside it is
        // ill-defined and would corrupt the structure.
        const draggedContentEl = document.getElementById(`${draggedTabName}-content-panel`);
        if (draggedContentEl?.closest('.tab-split-container') === wrapper) return;

        const otherPane = Array.from(wrapper.querySelectorAll(':scope > .tab-split-pane')).find(p => p !== pane);
        const otherContent = otherPane?.querySelector('[data-panel-tab-content="true"]');
        const otherTabName = otherContent?.dataset.panelTabName;
        // By construction (mergeTabIntoSplit always creates exactly 2 panes) this should
        // always resolve — but abort before mutating anything rather than risk corrupting
        // the composite if it doesn't.
        if (!otherContent || !otherTabName) {
            Logger.ui.warn(`replacePaneInSplit: could not resolve the other pane for ${evictedTabName} — aborting`);
            return;
        }

        const evictedTitle = pane.querySelector('.tab-split-pane-header')?.textContent || evictedTabName;
        const otherTitle = otherPane.querySelector('.tab-split-pane-header')?.textContent || otherTabName;

        // If the dragged tab is ITSELF nested inside a different composite, hand off to the
        // dedicated true-swap path — must NOT go through _extractDraggedTab/_collapseSplitPane,
        // which would tear the source composite down into a standalone tab instead of leaving
        // it intact with the evicted tab filling the vacated slot.
        const draggedPane = draggedContentEl?.closest('.tab-split-pane');
        const draggedWrapper = draggedPane?.closest('.tab-split-container');
        if (draggedWrapper) {
            this._swapNestedPanes(
                draggedTabName, draggedContentEl, draggedPane, draggedWrapper,
                evictedTabName, evictedContent, evictedTitle,
                pane, wrapper, wrapperTabName, compositeTabButton,
                otherTabName, otherTitle, compositeSide
            );
            return;
        }

        // Resolves + detaches the dragged tab from its standalone tab-bar button (the nested
        // case is handled above). Must run AFTER resolving the target pane/wrapper above —
        // _findSplitDropTarget already guards against the dragged tab's own host composite
        // being its own replace target, so this can't collapse the very composite we just
        // resolved as the target.
        const dragged = this._extractDraggedTab(draggedTabName);
        if (!dragged) return;
        const { content: draggedContent, title: draggedTitle, sourcePanel: draggedSourcePanel, sourceSide: draggedSourceSide } = dragged;

        // 1) Swap the pane's content: the dragged tab's content takes the evicted tab's slot
        pane.replaceChild(draggedContent, evictedContent);
        const paneHeader = pane.querySelector('.tab-split-pane-header');
        if (paneHeader) paneHeader.textContent = draggedTitle;
        draggedContent.classList.remove('hidden');
        draggedContent.style.display = '';

        // 2) If the evicted pane WAS the composite's identity anchor, the anchor must move to
        // the untouched pane's tab — otherwise the composite button and the evicted tab's new
        // standalone button would both claim the same data-tab identity.
        if (wrapperTabName === evictedTabName) {
            wrapper.dataset.panelTabName = otherTabName;
            compositeTabButton.dataset.tab = otherTabName;
        }
        compositeTabButton.dataset.originalLabel = otherTitle;
        compositeTabButton.dataset.tabGroup = `${otherTabName},${draggedTabName}`;
        compositeTabButton.textContent = `${otherTitle}/${draggedTitle}`;

        // 3) Re-home the evicted tab as a standalone tab in the DRAGGED TAB'S source panel —
        // it fills the slot the dragged tab just vacated there, rather than piling up in the
        // split's own panel. Stays backgrounded (inactive); _reactivateAfterTabRemoval below
        // will promote it to active if the dragged tab was the active tab of that panel.
        const destTabsContainer = draggedSourcePanel.querySelector('.flex.border-b.border-gray-700');
        const destContentContainer = draggedSourcePanel.querySelector('.flex-grow.overflow-y-auto');

        const newTabButton = document.createElement('button');
        newTabButton.dataset.tab = evictedTabName;
        newTabButton.className = `tab-${draggedSourceSide}`;
        newTabButton.textContent = evictedTitle;
        destTabsContainer.appendChild(newTabButton);

        evictedContent.className = evictedContent.className
            .replace('tab-content-right', `tab-content-${draggedSourceSide}`)
            .replace('tab-content-left', `tab-content-${draggedSourceSide}`);
        evictedContent.classList.add('hidden');
        evictedContent.style.display = 'none';
        destContentContainer.appendChild(evictedContent);

        this.setupTabDraggingForPanel(draggedSourcePanel);

        // The dragged tab is now nested and visible as part of the (already active) composite —
        // setActivePanelTab never runs for it, so its search controls need an explicit refresh
        // (same reasoning as mergeTabIntoSplit above).
        SearchSectionUtils.showSearchSectionForTab(draggedTabName, this.levelEditor);

        // The evicted tab's button already replaced the dragged tab's slot in the same panel
        // (added above), so this never actually finds the panel empty — but re-activate if the
        // dragged tab was the active one there, so the evicted tab takes over its spot visually.
        this.removeEmptyPanel(draggedSourceSide);
        this._reactivateAfterTabRemoval(draggedSourceSide);

        // Both tabs crossed panels (in a cross-panel swap) or stayed put (same-panel replace) —
        // sync tabPositions either way so a reload doesn't reconstruct the pre-swap layout out
        // from under the just-saved leftPanelSplits/rightPanelSplits (same reasoning as
        // mergeTabIntoSplit above).
        this._syncTabPosition(draggedTabName, compositeSide);
        this._syncTabPosition(evictedTabName, draggedSourceSide);
        this.savePanelTabOrder(draggedSourceSide);

        this.savePanelSplits(compositeSide);

        Logger.ui.info(`Replaced ${evictedTabName} with ${draggedTabName} in split (${compositeSide} panel); evicted ${evictedTabName} to standalone tab in ${draggedSourceSide} panel`);
    }

    /**
     * True pane-for-pane swap for replacePaneInSplit when the dragged tab is itself nested in a
     * different composite: the dragged tab and the evicted tab trade slots directly — each
     * composite keeps its own untouched sibling and stays a composite (still 2 panes), only the
     * two traded panes' content/labels change. Neither composite is collapsed/torn down.
     * @param {string} draggedTabName
     * @param {HTMLElement} draggedContentEl - dragged tab's `#{tab}-content-panel` element
     * @param {HTMLElement} draggedPane - the `.tab-split-pane` currently hosting draggedContentEl
     * @param {HTMLElement} draggedWrapper - draggedPane's `.tab-split-container`
     * @param {string} evictedTabName
     * @param {HTMLElement} evictedContent - evicted tab's `#{tab}-content-panel` element
     * @param {string} evictedTitle
     * @param {HTMLElement} pane - target `.tab-split-pane` (currently hosting evictedContent)
     * @param {HTMLElement} wrapper - pane's `.tab-split-container`
     * @param {string} wrapperTabName - wrapper's current identity-anchor tab name
     * @param {HTMLElement} compositeTabButton - wrapper's tab-bar button
     * @param {string} otherTabName - the target composite's untouched sibling tab
     * @param {string} otherTitle
     * @param {string} compositeSide - panel hosting `wrapper` ('left' or 'right')
     */
    _swapNestedPanes(
        draggedTabName, draggedContentEl, draggedPane, draggedWrapper,
        evictedTabName, evictedContent, evictedTitle,
        pane, wrapper, wrapperTabName, compositeTabButton,
        otherTabName, otherTitle, compositeSide
    ) {
        const draggedWrapperTabName = draggedWrapper.dataset.panelTabName;
        const draggedHostPanel = draggedWrapper.closest('#left-tabs-panel, #right-tabs-panel');
        const draggedHostSide = draggedHostPanel?.id.includes('left') ? 'left' : 'right';
        const draggedCompositeTabButton = draggedHostPanel?.querySelector(
            `.flex.border-b.border-gray-700 [data-tab="${draggedWrapperTabName}"]`
        );
        if (!draggedCompositeTabButton) return;

        const draggedSiblingPane = Array.from(draggedWrapper.querySelectorAll(':scope > .tab-split-pane')).find(p => p !== draggedPane);
        const draggedSiblingContent = draggedSiblingPane?.querySelector('[data-panel-tab-content="true"]');
        const draggedSiblingTabName = draggedSiblingContent?.dataset.panelTabName;
        // Mirrors the "could not resolve the other pane" guards elsewhere — abort before
        // mutating anything rather than risk corrupting either composite.
        if (!draggedSiblingContent || !draggedSiblingTabName) {
            Logger.ui.warn(`_swapNestedPanes: could not resolve the other pane for ${draggedTabName} — aborting`);
            return;
        }
        const draggedSiblingTitle = draggedSiblingPane.querySelector('.tab-split-pane-header')?.textContent || draggedSiblingTabName;
        const draggedTitle = draggedPane.querySelector('.tab-split-pane-header')?.textContent || draggedTabName;

        // 1) Target composite: dragged content takes the evicted content's slot. replaceChild
        // auto-detaches draggedContentEl from draggedPane (a node can only have one parent),
        // leaving draggedPane empty and ready to receive evictedContent below.
        pane.replaceChild(draggedContentEl, evictedContent);
        const targetPaneHeader = pane.querySelector('.tab-split-pane-header');
        if (targetPaneHeader) targetPaneHeader.textContent = draggedTitle;
        draggedContentEl.classList.remove('hidden');
        draggedContentEl.style.display = '';

        if (wrapperTabName === evictedTabName) {
            wrapper.dataset.panelTabName = otherTabName;
            compositeTabButton.dataset.tab = otherTabName;
        }
        compositeTabButton.dataset.originalLabel = otherTitle;
        compositeTabButton.dataset.tabGroup = `${otherTabName},${draggedTabName}`;
        compositeTabButton.textContent = `${otherTitle}/${draggedTitle}`;

        // 2) Source composite: evicted content fills the pane the dragged tab just vacated.
        draggedPane.appendChild(evictedContent);
        const sourcePaneHeader = draggedPane.querySelector('.tab-split-pane-header');
        if (sourcePaneHeader) sourcePaneHeader.textContent = evictedTitle;
        evictedContent.classList.remove('hidden');
        evictedContent.style.display = '';

        if (draggedWrapperTabName === draggedTabName) {
            draggedWrapper.dataset.panelTabName = draggedSiblingTabName;
            draggedCompositeTabButton.dataset.tab = draggedSiblingTabName;
        }
        draggedCompositeTabButton.dataset.originalLabel = draggedSiblingTitle;
        draggedCompositeTabButton.dataset.tabGroup = `${draggedSiblingTabName},${evictedTabName}`;
        draggedCompositeTabButton.textContent = `${draggedSiblingTitle}/${evictedTitle}`;

        // Both nested tabs need an explicit search-controls refresh — setActivePanelTab never
        // runs for either (same reasoning as mergeTabIntoSplit/replacePaneInSplit above).
        SearchSectionUtils.showSearchSectionForTab(draggedTabName, this.levelEditor);
        SearchSectionUtils.showSearchSectionForTab(evictedTabName, this.levelEditor);

        // Neither panel's tab-bar membership changed (no button added/removed — both
        // composites' own buttons stay put, only their nested content/labels changed), so
        // tabPositions/splits are all that need persisting; no savePanelTabOrder call needed.
        this._syncTabPosition(draggedTabName, compositeSide);
        this._syncTabPosition(evictedTabName, draggedHostSide);
        this.savePanelSplits(compositeSide);
        this.savePanelSplits(draggedHostSide);

        Logger.ui.info(`Swapped nested tabs ${draggedTabName} <-> ${evictedTabName} (composites in ${compositeSide} and ${draggedHostSide} panels)`);
    }

    /**
     * Build a `.tab-split-pane` wrapping an existing content-panel element with a small
     * draggable header (used to detach it back out later).
     * @param {string} title - Display title for the pane header
     * @param {HTMLElement} contentEl - Existing #{tab}-content-panel element (reparented, not cloned)
     */
    _createSplitPane(title, contentEl) {
        const pane = document.createElement('div');
        pane.className = 'tab-split-pane';

        const header = document.createElement('div');
        header.className = 'tab-split-pane-header';
        header.textContent = title;
        pane.appendChild(header);

        pane.appendChild(contentEl); // reparents — removes it from its previous parent

        this._setupSplitPaneHeaderDragging(header, pane);
        return pane;
    }

    /**
     * Vertical resizer between the two panes of a split container (flex-basis %). The ratio is
     * stashed on firstPane's `dataset.splitRatio` as it's dragged (read back by savePanelSplits/
     * applyPanelSplits — see mergeTabIntoSplit's `ratio` param) and persisted on release.
     */
    _setupSplitResizer(resizer, firstPane) {
        let dragging = false;
        let startY = 0;
        let startHeight = 0;
        let wrapperHeight = 0;

        const onMouseMove = (e) => {
            if (!dragging) return;
            // If the split was torn down mid-drag (e.g. its pane got detached elsewhere),
            // the resizer/pane are detached DOM nodes — stop instead of writing into the void.
            if (!resizer.isConnected || !firstPane.isConnected) { onMouseUp(); return; }
            const delta = e.clientY - startY;
            const minPane = 32;
            const newHeight = Math.max(minPane, Math.min(wrapperHeight - minPane, startHeight + delta));
            const pct = (newHeight / wrapperHeight) * 100;
            firstPane.style.flex = `0 0 ${pct}%`;
            firstPane.dataset.splitRatio = String(pct);
        };

        const onMouseUp = () => {
            dragging = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            // Resizer can outlive its original panelSide (pane content gets swapped in place
            // by replacePaneInSplit) — always resolve it fresh from the live DOM rather than
            // capturing it once at setup time.
            if (resizer.isConnected) {
                const panelSide = resizer.closest('#left-tabs-panel, #right-tabs-panel')?.id.includes('left') ? 'left' : 'right';
                this.savePanelSplits(panelSide);
            }
        };

        resizer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            dragging = true;
            startY = e.clientY;
            const wrapper = resizer.parentElement;
            wrapperHeight = wrapper.getBoundingClientRect().height;
            startHeight = firstPane.getBoundingClientRect().height;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });
    }

    /**
     * If the removed/merged-away tab was the active tab of its (former) panel, activate the
     * next-best remaining tab there — mirrors updateActiveTabAfterMove's fallback logic.
     * @param {string} panelSide - 'left' or 'right'
     */
    _reactivateAfterTabRemoval(panelSide) {
        // Skip during init-time restore (applyPanelSplits): activation is left for EventHandlers
        // to resolve after initialization finishes, same as updateActiveTabAfterMove does.
        if (this._initializing) return;

        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        if (!panel) return; // panel was empty and got removed entirely

        const activeKey = panelSide === 'left' ? 'leftPanelTab' : 'rightPanelTab';
        const currentActive = this.stateManager.get(activeKey);
        if (currentActive && panel.querySelector(`.flex.border-b.border-gray-700 [data-tab="${currentActive}"]`)) {
            return; // active tab still exists, nothing to do
        }

        const tabsContainer = panel.querySelector('.flex.border-b.border-gray-700');
        const remaining = tabsContainer ? Array.from(tabsContainer.children).filter(t => t.dataset.tab) : [];
        if (remaining.length === 0) return;

        const next = this.getTabClosestToSeparator(remaining, panelSide);
        if (next?.dataset.tab && this.levelEditor?.eventHandlers) {
            this.levelEditor.eventHandlers.setActivePanelTab(next.dataset.tab, panelSide);
        }
    }

    // ── Detach: drag a split pane's header back out into a standalone tab ──

    _setupSplitPaneHeaderDragging(header, pane) {
        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            // The ordinary tab-bar drag (separate protocol) may already be in flight —
            // don't start a second, overlapping drag.
            if (this._pendingDrag) return;
            e.preventDefault();
            this._startSplitPaneDetachDrag(header, pane, e.clientX, e.clientY);
        });
    }

    _startSplitPaneDetachDrag(header, pane, startClientX, startClientY) {
        if (this._splitDetachDragActive) return;
        this._splitDetachDragActive = true;

        // The nested tab being dragged out — resolved once at drag-start, since single-level
        // nesting guarantees it can never itself be a composite (no dataset.tabGroup guard
        // needed here the way the tab-bar protocol needs one for its own dragged tab).
        const draggedTabName = pane.querySelector('[data-panel-tab-content="true"]')?.dataset.panelTabName;

        const ghost = header.cloneNode(true);
        ghost.classList.add('tab-drag-ghost');
        ghost.style.cssText = '';
        document.body.appendChild(ghost);
        ghost.style.left = (startClientX + 14) + 'px';
        ghost.style.top = (startClientY - 12) + 'px';

        let pendingSplitTarget = null;

        const cleanup = () => {
            ghost.remove();
            document.querySelectorAll('#left-tabs-panel, #right-tabs-panel').forEach(p =>
                p.classList.remove('tab-panel--drag-over')
            );
            this._removeSplitHint();
            pendingSplitTarget = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onWindowBlur);
            this._splitDetachDragActive = false;
        };

        // Safety net: if the window loses focus mid-drag (e.g. Alt-Tab, a native dialog
        // stealing the mouseup), no 'mouseup' may ever reach document — cancel the drag
        // instead of leaving _splitDetachDragActive stuck true forever (which would
        // silently disable pane detach for the rest of the session).
        const onWindowBlur = () => cleanup();

        const onMouseMove = (e) => {
            ghost.style.left = (e.clientX + 14) + 'px';
            ghost.style.top = (e.clientY - 12) + 'px';

            document.querySelectorAll('#left-tabs-panel, #right-tabs-panel').forEach(p =>
                p.classList.remove('tab-panel--drag-over')
            );
            pendingSplitTarget = null;
            this._hideSplitHint();

            header.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            header.style.pointerEvents = '';
            if (!elUnder) return;

            // Dropping onto another tab's content area (plain tab, or a pane of a DIFFERENT
            // composite) merges/replaces just like the ordinary tab-bar drag — same fine-grained
            // zone highlighting instead of the coarse whole-panel highlight used below.
            if (draggedTabName) {
                const splitTarget = this._findSplitDropTarget(elUnder, e.clientY, draggedTabName);
                if (splitTarget) {
                    pendingSplitTarget = splitTarget;
                    this._showSplitHint(splitTarget.rect, splitTarget.position);
                    return;
                }
            }

            // v1: only existing panels are valid detach targets — this drag doesn't
            // auto-create a brand-new panel side the way the main tab-bar drag does.
            const targetPanel = elUnder?.closest('#left-tabs-panel, #right-tabs-panel');
            if (targetPanel) targetPanel.classList.add('tab-panel--drag-over');
        };

        const onMouseUp = (e) => {
            header.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            header.style.pointerEvents = '';

            if (draggedTabName && pendingSplitTarget) {
                if (pendingSplitTarget.mode === 'replace') {
                    if (draggedTabName !== pendingSplitTarget.evictedTabName) {
                        this.replacePaneInSplit(draggedTabName, pendingSplitTarget.evictedTabName, pendingSplitTarget.panelSide);
                    }
                } else if (draggedTabName !== pendingSplitTarget.targetTabName) {
                    this.mergeTabIntoSplit(draggedTabName, pendingSplitTarget.targetTabName, pendingSplitTarget.panelSide, pendingSplitTarget.position);
                }
            } else {
                const targetPanel = elUnder?.closest('#left-tabs-panel, #right-tabs-panel');
                if (targetPanel && draggedTabName) {
                    const targetSide = targetPanel.id.includes('left') ? 'left' : 'right';
                    this.detachFromSplit(draggedTabName, targetSide);
                }
            }

            cleanup();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onWindowBlur);
    }

    /**
     * Pull a tab back out of a split container into a standalone tab in targetPanelSide.
     * The composite unwraps back into a plain tab once only one pane remains.
     * @param {string} tabName - Tab to detach (the one whose pane header was dragged)
     * @param {string} targetPanelSide - Destination panel ('left' or 'right') — may be the
     *   same panel the split currently lives in, which just un-merges it in place.
     */
    detachFromSplit(tabName, targetPanelSide) {
        const collapsed = this._collapseSplitPane(tabName);
        if (!collapsed) return;
        const { content: contentEl, title } = collapsed;

        // Re-home the detached tab as a plain standalone tab in the destination panel
        const destPanel = this.ensurePanelExists(targetPanelSide);
        const destTabsContainer = destPanel.querySelector('.flex.border-b.border-gray-700');
        const destContentContainer = destPanel.querySelector('.flex-grow.overflow-y-auto');

        const newTabButton = document.createElement('button');
        newTabButton.dataset.tab = tabName;
        newTabButton.className = `tab-${targetPanelSide}`;
        newTabButton.textContent = title;
        destTabsContainer.appendChild(newTabButton);

        contentEl.className = contentEl.className
            .replace('tab-content-right', `tab-content-${targetPanelSide}`)
            .replace('tab-content-left', `tab-content-${targetPanelSide}`);
        contentEl.classList.remove('hidden');
        contentEl.style.display = '';
        destContentContainer.appendChild(contentEl);

        this.setupTabDraggingForPanel(destPanel);

        if (this.levelEditor?.eventHandlers) {
            this.levelEditor.eventHandlers.setActivePanelTab(tabName, targetPanelSide);
        }

        // Keep tabPositions in sync with the tab's actual new panel (see mergeTabIntoSplit's
        // matching call for why this matters — otherwise a reload undoes the detach).
        this._syncTabPosition(tabName, targetPanelSide);
        this.savePanelTabOrder(targetPanelSide);

        Logger.ui.info(`Detached tab ${tabName} from split, now standalone in ${targetPanelSide} panel`);
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
