import { Logger } from '../../utils/Logger.js';
import { eventHandlerManager } from '../../event-system/EventHandlerManager.js';
import { PanelSubController } from './PanelSubController.js';

/**
 * Base panel layout: left/right position, panel widths, tab-position/state
 * initialization, resizers, collapse/expand. No drag or split-pane concerns —
 * see TabDragController / SplitPaneController.
 * Extracted from PanelPositionManager.js — Фаза 4.5.1 (tmp/2D_Editor_REFACTOR_PLAN.md).
 */
export class TabLayoutController extends PanelSubController {
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
            this.manager.tabDragController.createTemporaryTabContainer();

            // Move tabs to their saved positions using existing moveTab method
            Object.entries(tabPositions).forEach(([tabName, position]) => {
                // Only move tab if it's not already in the correct position
                // This will create panels if they don't exist
                this.manager.tabOrderController.moveTab(tabName, 'temp', position);
            });

            // Restore intra-panel tab order (which was lost above, since moveTab always
            // appends in tabPositions' fixed key order regardless of any previous drag reorder)
            this.manager.tabOrderController.applyPanelTabOrder('left');
            this.manager.tabOrderController.applyPanelTabOrder('right');

            // Restore nested split-tab composites — must run after tab order/position so
            // both members of each saved pair already exist as standalone tabs to merge.
            this.manager.splitPaneController.applyPanelSplits('left');
            this.manager.splitPaneController.applyPanelSplits('right');

            // Remove temporary container
            this.manager.tabDragController.removeTemporaryTabContainer();

            // Tab activation will be handled by EventHandlers after initialization

            // Remove empty panels after initialization
            this.manager.splitPaneController.removeEmptyPanel('left');
            this.manager.splitPaneController.removeEmptyPanel('right');
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
     * Get panel position
     * @param {string} panelType - 'folders' or 'rightPanel'
     * @returns {string} - 'left' or 'right'
     */
    getPanelPosition(panelType) {
        return this.stateManager.get(`${panelType}Position`) || (panelType === 'folders' ? 'left' : 'right');
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
            this.manager._updateUI();

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
                this.manager._updateUI();
            }

            // If panel exists with tabs, ensure menu state is correct
            if (hasTabs) {
                this.manager.splitPaneController.updatePanelStateAfterTabAddition(panelSide);
            }
        }

        // Ensure tab dragging is setup for this panel
        this.manager.tabDragController.setupTabDraggingForPanel(panel);

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
        this.manager.splitPaneController.updatePanelStateAfterCreation(panelSide);

        // Update UI after panel is added
        this.manager._updateUI();
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
        this.manager._updateUI();
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
}
