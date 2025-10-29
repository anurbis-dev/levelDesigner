import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { HorizontalScrollUtils } from '../utils/HorizontalScrollUtils.js';

/**
 * Context menu for asset tabs
 */
class AssetTabContextMenu {
    constructor(tabsManager) {
        this.tabsManager = tabsManager;
        this.currentMenu = null;
        this.isVisible = false;
        this.lastContextData = null;
    }

    /**
     * Handle context menu on asset tab
     */
    handleTabContextMenu(event, folderPath, tab) {
        event.preventDefault();
        
        Logger.ui.debug('AssetTabContextMenu: Tab context menu triggered', { folderPath, tab });

        // Show context menu with context data
        this.showMenu(event, { folderPath, tab });
    }

    /**
     * Show context menu for asset tab
     */
    showMenu(event, contextData) {
        // Remove existing menu
        if (this.currentMenu) {
            this.currentMenu.remove();
            this.currentMenu = null;
        }

        // Store context data
        this.lastContextData = contextData;
        
        // Create context menu element
        const contextMenu = document.createElement('div');
        contextMenu.className = 'asset-tab-context-menu base-context-menu';
        contextMenu.style.pointerEvents = 'auto';
        contextMenu.style.userSelect = 'none';

        // Add Close menu item
        const closeItem = document.createElement('div');
        closeItem.className = 'base-context-menu-item';
        closeItem.innerHTML = '<span>❌</span><span>Close</span>';
        closeItem.addEventListener('click', () => {
            const { folderPath } = contextData;
            this.tabsManager.removeFolderTab(folderPath);
            
            contextMenu.remove();
            this.currentMenu = null;
        });
        contextMenu.appendChild(closeItem);

        // Add to document
        document.body.appendChild(contextMenu);

        // Position menu using BaseContextMenu logic
        this.positionContextMenu(event, contextMenu);

        // Store current menu reference
        this.currentMenu = contextMenu;
        this.isVisible = true;

        // Show menu with animation
        requestAnimationFrame(() => {
            contextMenu.classList.add('show');
        });

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                this.currentMenu = null;
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    /**
     * Position context menu using BaseContextMenu logic
     * @param {Event} event - The context menu event
     * @param {HTMLElement} menu - The context menu element
     */
    positionContextMenu(event, menu) {
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Get actual menu dimensions
        const menuSize = this.getMenuDimensions(menu);
        
        const margin = 20; // BaseContextMenu.MENU_VIEWPORT_MARGIN
        
        let x = event.pageX;
        let y = event.pageY;
        
        // Determine optimal horizontal position
        const spaceRight = viewport.width - event.pageX;
        const spaceLeft = event.pageX;
        
        if (spaceRight >= menuSize.width + margin) {
            x = event.pageX;
        } else if (spaceLeft >= menuSize.width + margin) {
            x = event.pageX - menuSize.width;
        } else {
            x = Math.max(margin,
                       Math.min(event.pageX - menuSize.width / 2,
                               viewport.width - menuSize.width - margin));
        }
        
        // Determine optimal vertical position
        const spaceBelow = viewport.height - event.pageY;
        const spaceAbove = event.pageY;
        
        if (spaceBelow >= menuSize.height + margin) {
            y = event.pageY;
        } else if (spaceAbove >= menuSize.height + margin) {
            y = event.pageY - menuSize.height;
        } else {
            y = Math.max(margin,
                        Math.min(event.pageY - menuSize.height / 2,
                                viewport.height - menuSize.height - margin));
        }
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }

    /**
     * Get menu dimensions
     * @param {HTMLElement} menu - The context menu element
     * @returns {Object} - Object with width and height
     */
    getMenuDimensions(menu) {
        // Force layout calculation
        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        
        const rect = menu.getBoundingClientRect();
        const dimensions = {
            width: rect.width || 150, // fallback width
            height: rect.height || 50 // fallback height
        };
        
        // Reset styles
        menu.style.visibility = '';
        menu.style.display = '';
        
        return dimensions;
    }

    /**
     * Clean up event handlers
     */
    destroy() {
        // Remove current menu if exists
        if (this.currentMenu) {
            this.currentMenu.remove();
            this.currentMenu = null;
        }
    }
}

/**
 * Asset Tabs Manager
 * Manages folder-based tabs for AssetPanel
 */
export class AssetTabsManager {
    constructor(tabsContainer, stateManager, foldersPanel, levelEditor, assetPanel) {
        this.tabsContainer = tabsContainer;
        this.stateManager = stateManager;
        this.foldersPanel = foldersPanel;
        this.levelEditor = levelEditor;
        this.assetPanel = assetPanel; // Reference to parent panel for callbacks
        
        this.tabDraggingSetup = false;
        this.isDraggingTab = false;
        this._contextMenuSetup = false;
        
        // Initialize context menu
        this.contextMenu = new AssetTabContextMenu(this);
        
        // Setup horizontal scrolling for tabs container
        this.setupHorizontalScrolling();
        
        // Setup folder drag and drop to tabs container
        this.setupFolderDragToTabs();
        
        // Subscribe to activeAssetTab changes to update visual selection
        this.stateManager.subscribe('activeAssetTab', () => {
            // Re-render tabs to update visual selection (active class)
            this.render();
        });
        
        // Subscribe to selectedFolders changes to update visual selection
        // syncTabToFolder is called from AssetPanel subscription, this only handles visual updates
        this.stateManager.subscribe('selectedFolders', () => {
            this.render();
        });
    }
    
    /**
     * Helper: Convert selectedFolders to Set format
     * @param {Array|Set} selectedFolders - Selected folders from state
     * @returns {Set} Selected folders as Set
     */
    _normalizeSelectedFolders(selectedFolders) {
        if (!selectedFolders) {
            return new Set();
        }
        return Array.isArray(selectedFolders) 
            ? new Set(selectedFolders) 
            : (selectedFolders instanceof Set ? selectedFolders : new Set());
    }
    
    /**
     * Sync active tab to match selected folder in FoldersPanel
     * Returns true if state was actually changed, false otherwise
     * 
     * Logic:
     * - Only syncs visual selection (activeAssetTab) - does NOT create tabs
     * - Tabs are created only by user dragging folders
     * - If multiple folders selected - updates visual selection only
     * - If single folder selected and tab exists - activate it
     * - If no tab exists - asset panel will show folder content directly (no tab needed)
     */
    syncTabToFolder() {
        if (!this.foldersPanel) {
            return false;
        }
        
        // This method is called from folder selection changes
        // It should NOT be called when we're syncing from tab clicks
        // Tab clicks should directly activate the tab without going through this sync
        
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        const selectedFoldersSet = this._normalizeSelectedFolders(
            this.stateManager.get('selectedFolders') || []
        );
        
        // Sync foldersPanel's selectedFolders if needed
        if (this.foldersPanel.selectedFolders !== selectedFoldersSet) {
            this.foldersPanel.selectedFolders = selectedFoldersSet;
        }
        
        // Handle multiple folders selection
        if (selectedFoldersSet.size > 1) {
            // Multiple folders selected - update visual selection only
            // DO NOT filter tabs - keep all tabs in activeTabs
            // Visual highlighting will be handled in render() based on selectedFolders
            
            // Find first selected folder that has a tab for visual selection
            const firstSelectedWithTab = Array.from(selectedFoldersSet).find(path => activeTabs.has(path));
            if (firstSelectedWithTab) {
                const currentActiveTab = this.stateManager.get('activeAssetTab');
                if (currentActiveTab !== firstSelectedWithTab) {
                    this.stateManager.set('activeAssetTab', firstSelectedWithTab);
                    // Save to config
                    if (this.levelEditor?.configManager) {
                        this.levelEditor.configManager.set('editor.view.activeAssetTab', firstSelectedWithTab);
                    }
                    Logger.ui.debug(`AssetTabsManager: Multi-select - set active tab to ${firstSelectedWithTab}`);
                    return true;
                }
            }
            
            return false;
        }
        
        // Single folder selection
        const selectedFolderPath = selectedFoldersSet.size > 0 
            ? Array.from(selectedFoldersSet)[0] 
            : 'root';
        
        // If tab with selected folder name exists - activate it
        if (activeTabs.has(selectedFolderPath)) {
            const currentActiveTab = this.stateManager.get('activeAssetTab');
            if (currentActiveTab !== selectedFolderPath) {
                this.stateManager.set('activeAssetTab', selectedFolderPath);
                // Save to config
                if (this.levelEditor?.configManager) {
                    this.levelEditor.configManager.set('editor.view.activeAssetTab', selectedFolderPath);
                }
                Logger.ui.debug(`AssetTabsManager: Activated tab for folder ${selectedFolderPath}`);
                return true;
            }
            // Tab already active - no changes needed
            return false;
        }
        
        // No tab exists for selected folder - clear active tab
        // Asset panel will show folder content directly via getActiveTabPath()
        const currentActiveTab = this.stateManager.get('activeAssetTab');
        if (currentActiveTab !== null) {
            this.stateManager.set('activeAssetTab', null);
            // Save to config
            if (this.levelEditor?.configManager) {
                this.levelEditor.configManager.set('editor.view.activeAssetTab', null);
            }
            Logger.ui.debug(`AssetTabsManager: Cleared active tab, showing folder ${selectedFolderPath} directly`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Get folder name by path
     * @param {string} folderPath - Folder path
     * @returns {string} Folder name
     */
    getFolderName(folderPath) {
        if (!this.foldersPanel || !this.foldersPanel.folderStructure) {
            return folderPath;
        }
        
        if (folderPath === 'root') {
            return 'Content';
        }
        
        const folder = this.foldersPanel.getFolderByPath(folderPath);
        return folder ? folder.name : folderPath.split('/').pop();
    }
    
    /**
     * Add tab for folder
     * @param {string} folderPath - Folder path
     */
    addFolderTab(folderPath) {
        if (!folderPath) {
            Logger.ui.warn('AssetTabsManager: Cannot add tab without folder path');
            return;
        }
        
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        if (activeTabs.has(folderPath)) {
            Logger.ui.debug(`AssetTabsManager: Tab for folder ${folderPath} already exists`);
            // Just activate it
            this.stateManager.set('activeAssetTab', folderPath);
            return;
        }
        
        activeTabs.add(folderPath);
        this.stateManager.set('activeAssetTabs', activeTabs);
        
        // Set as active tab
        this.stateManager.set('activeAssetTab', folderPath);
        
        // Save to config
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.set('editor.view.activeAssetTabs', Array.from(activeTabs));
            this.levelEditor.configManager.set('editor.view.activeAssetTab', folderPath);
        }
        
        // No need to call render() here - subscriptions to activeAssetTabs and activeAssetTab will handle it
        Logger.ui.debug(`AssetTabsManager: Added tab for folder ${folderPath}`);
    }
    
    /**
     * Remove tab for folder
     * @param {string} folderPath - Folder path
     */
    removeFolderTab(folderPath) {
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        if (!activeTabs.has(folderPath)) {
            Logger.ui.debug(`AssetTabsManager: Tab for folder ${folderPath} does not exist`);
            return;
        }
        
        activeTabs.delete(folderPath);
        this.stateManager.set('activeAssetTabs', activeTabs);
        
        // Clear active tab if it was the removed tab
        const currentActiveTab = this.stateManager.get('activeAssetTab');
        if (currentActiveTab === folderPath) {
            this.stateManager.set('activeAssetTab', null);
        }
        
        // Save to config
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.set('editor.view.activeAssetTabs', Array.from(activeTabs));
            this.levelEditor.configManager.set('editor.view.activeAssetTab', this.stateManager.get('activeAssetTab'));
        }
        
        // DO NOT call render() here - subscription to activeAssetTabs will handle it
        Logger.ui.debug(`AssetTabsManager: Removed tab for folder ${folderPath}`);
    }
    
    /**
     * Render tabs
     */
    render() {
        Logger.ui.debug('AssetTabsManager: render called - tabs will be recreated');
        
        // Reset context menu setup flag since DOM is being recreated
        this._contextMenuSetup = false;
        
        // Clear tabs container (search controls are now in separate container)
        this.tabsContainer.innerHTML = '';
        
        // Get current active tabs (after potential sync)
        const currentActiveTabs = this.stateManager.get('activeAssetTabs') || new Set();
        const tabOrder = this.stateManager.get('assetTabOrder') || [];

        // Filter tabOrder to only include available folder paths, and add any missing tabs at the end
        const orderedTabs = tabOrder.filter(path => currentActiveTabs.has(path));
        const missingTabs = Array.from(currentActiveTabs).filter(path => !orderedTabs.includes(path));
        const finalOrder = [...orderedTabs, ...missingTabs];

        // DO NOT call syncTabToFolder() here - it modifies state and causes recursion
        // Sync should happen BEFORE render, not during render
        
        // Add tabs to left container
        // Active tab is stored separately in activeAssetTab state
        const activeTab = this.stateManager.get('activeAssetTab');
        const selectedFolders = this.foldersPanel?.selectedFolders;
        const isMultiSelect = selectedFolders && selectedFolders.size > 1;
        
        finalOrder.forEach((folderPath) => {
            if (!currentActiveTabs.has(folderPath)) {
                return; // Skip if not in active tabs
            }
            
            const tabButton = document.createElement('button');
            // Mark as active if:
            // - Single selection: matches activeTab
            // - Multi-select: is in selectedFolders
            const isActive = isMultiSelect 
                ? (selectedFolders && selectedFolders.has(folderPath))
                : (folderPath === activeTab);
            tabButton.className = `tab ${isActive ? 'active' : ''}`;
            tabButton.textContent = this.getFolderName(folderPath);
            tabButton.dataset.folderPath = folderPath;
            tabButton.draggable = true; // Enable tab dragging
            
            this.tabsContainer.appendChild(tabButton);
        });

        // Setup tab dragging after rendering (only once)
        if (!this.tabDraggingSetup) {
            this.setupTabDragging();
            this.tabDraggingSetup = true;
        }

        // Setup context menu for tabs after rendering
        this.setupContextMenu();

        // Setup event handlers after elements are created
        // Re-register handlers to ensure they work on new DOM elements
        this.setupEventHandlers();
        
        // Load scroll position after rendering
        this.loadScrollPosition();
    }
    
    /**
     * Handle tab click
     * @param {Event} e - Click event
     * @param {string} folderPath - Folder path
     */
    handleTabClick(e, folderPath) {
        if (e.shiftKey) {
            // Multi-select: toggle folder selection
            // Ensure shiftAnchor is set from current selection if not already set
            if (this.foldersPanel && folderPath) {
                // Get current selected folders to preserve shiftAnchor
                const currentSelected = this.foldersPanel.selectedFolders || new Set();
                if (currentSelected.size > 0 && !this.foldersPanel.shiftAnchor) {
                    // Set shift anchor from first selected folder
                    this.foldersPanel.shiftAnchor = Array.from(currentSelected)[0];
                }
                
                // Create a synthetic event object with shiftKey for proper handling
                const syntheticEvent = { shiftKey: true };
                this.foldersPanel.selectFolder(folderPath, syntheticEvent);
            }
            
            this.stateManager.set('selectedAssets', new Set());
            Logger.ui.debug(`AssetTabsManager: Tab Shift+clicked ${folderPath}`);
            return;
        }
        
        // Simple click - activate tab directly and select folder
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        if (activeTabs.has(folderPath)) {
            // Tab exists - activate it directly
            this.stateManager.set('activeAssetTab', folderPath);
            // Save to config
            if (this.levelEditor?.configManager) {
                this.levelEditor.configManager.set('editor.view.activeAssetTab', folderPath);
            }
        }
        
        // Also select the folder to keep them in sync
        if (this.foldersPanel && folderPath) {
            this.foldersPanel.selectFolder(folderPath, null);
        }
        
        this.stateManager.set('selectedAssets', new Set());
        Logger.ui.debug(`AssetTabsManager: Tab clicked ${folderPath} - folder selected`);
    }
    
    /**
     * Setup context menu for tabs
     */
    setupContextMenu() {
        if (!this.contextMenu || this._contextMenuSetup) {
            return;
        }

        // Context menu is handled through delegated handlers in setupEventHandlers
        this._contextMenuSetup = true;
        
        Logger.ui.debug('AssetTabsManager: Context menu setup completed (delegated)');
    }
    
    /**
     * Setup event handlers for tabs
     * Re-registers handlers to ensure they work on current DOM elements
     */
    setupEventHandlers() {
        // Unregister old handlers if they exist
        eventHandlerManager.unregisterContainer(this.tabsContainer);
        
        // Create handlers configuration
        const tabHandlers = EventHandlerUtils.createPanelHandlers(
            (e) => {
                // Handle tab clicks
                const tabButton = e.target.closest('.tab');
                if (tabButton) {
                    const folderPath = tabButton.dataset.folderPath;
                    if (folderPath) {
                        this.handleTabClick(e, folderPath);
                    }
                    return;
                }
            },
            null, // onButtonClick
            null, // onInputChange
            (e) => {
                // Handle context menu on tabs
                const tabButton = e.target.closest('.tab');
                if (tabButton) {
                    const folderPath = tabButton.dataset.folderPath;
                    if (folderPath) {
                        this.contextMenu.handleTabContextMenu(e, folderPath, tabButton);
                    }
                    return;
                }
            }
        );

        // Register container with event manager
        // Re-register after DOM updates to ensure handlers work on new elements
        eventHandlerManager.registerContainer(this.tabsContainer, tabHandlers);
        
        Logger.ui.debug('AssetTabsManager: Event handlers registered on tabs container');
    }
    
    /**
     * Setup tab dragging functionality
     */
    setupTabDragging() {
        let draggedTab = null;
        let draggedIndex = -1;

        // Track last mouse button pressed to distinguish drag from scroll
        let lastMouseButton = 0;
        
        // Track mousedown to detect button (capture phase to run before drag events)
        this.tabDraggingMousedownHandler = (e) => {
            lastMouseButton = e.button;
        };
        this.tabsContainer.addEventListener('mousedown', this.tabDraggingMousedownHandler, { capture: true });
        
        // Register container handlers through EventHandlerManager
        const tabDraggingHandlers = {
            dragstart: (e) => {
                // Skip if middle mouse button was pressed (used for scrolling)
                if (lastMouseButton === 1) {
                    e.preventDefault();
                    lastMouseButton = 0; // Reset
                    return;
                }
                
                const tab = e.target.closest('.tab');
                if (!tab) return;

                draggedTab = tab;
                draggedIndex = Array.from(this.tabsContainer.children).indexOf(tab);
                this.isDraggingTab = true; // Set flag for tab dragging
                
                // Add dragging class
                tab.classList.add('dragging');
                
                // Add dragging class to body for CSS cursor control
                document.body.classList.add('tab-dragging');
                
                // Set drag data
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', tab.innerHTML);
            },
            dragover: (e) => {
                if (!draggedTab) return;
                
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const tab = e.target.closest('.tab');
                if (tab && tab !== draggedTab) {
                    // Remove drag-over from all tabs
                    this.tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-drag-over'));
                    // Add drag-over to target tab
                    tab.classList.add('tab-drag-over');
                }
            },
            drop: (e) => {
                e.preventDefault();
                
                if (!draggedTab) return;

                const tabContainer = draggedTab.parentElement;
                const targetTab = e.target.closest('.tab');
                
                if (targetTab && targetTab !== draggedTab) {
                    const targetIndex = Array.from(tabContainer.children).indexOf(targetTab);
                    const draggedIndex = Array.from(tabContainer.children).indexOf(draggedTab);
                    
                    // Move the tab
                    if (draggedIndex < targetIndex) {
                        tabContainer.insertBefore(draggedTab, targetTab.nextSibling);
                    } else {
                        tabContainer.insertBefore(draggedTab, targetTab);
                    }

                    // Save new tab order to state
                    this.saveTabOrder();
                }

                // Clean up
                this.tabsContainer.querySelectorAll('.tab').forEach(t => {
                    t.classList.remove('dragging', 'tab-drag-over');
                });

                this.isDraggingTab = false; // Reset flag
                draggedTab = null;
                draggedIndex = -1;
            },
            dragend: (e) => {
                // Clean up
                this.tabsContainer.querySelectorAll('.tab').forEach(t => {
                    t.classList.remove('dragging', 'tab-drag-over');
                });
                
                // Remove dragging class
                document.body.classList.remove('tab-dragging');
                
                this.isDraggingTab = false;
                draggedTab = null;
                draggedIndex = -1;
            }
        };
        
        eventHandlerManager.registerElement(this.tabsContainer, tabDraggingHandlers, 'asset-tab-dragging-container');
        
        Logger.ui.debug('AssetTabsManager: Tab dragging setup completed');
    }
    
    /**
     * Update tab order after dragging
     */
    saveTabOrder() {
        const newOrder = Array.from(this.tabsContainer.children)
            .filter(child => child.classList.contains('tab')) // Only tabs, exclude search controls
            .map(tab => tab.dataset.folderPath)
            .filter(path => path); // Remove any undefined paths
        
        this.stateManager.set('assetTabOrder', newOrder);
        
        // Save to config
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.set('editor.view.assetTabOrder', newOrder);
        }
        
        Logger.ui.debug('AssetTabsManager: Saved tab order:', newOrder);
    }
    
    /**
     * Setup folder drag and drop to tabs container
     */
    setupFolderDragToTabs() {
        if (!this.foldersPanel) {
            Logger.ui.warn('AssetTabsManager: FoldersPanel not available for drag setup');
            return;
        }
        
        // Use tabs container itself as drop target (only left section)
        this.tabsContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('application/x-folder-path')) {
                this.tabsContainer.classList.add('drop-target');
            }
        });
        
        this.tabsContainer.addEventListener('dragleave', (e) => {
            if (!this.tabsContainer.contains(e.relatedTarget)) {
                this.tabsContainer.classList.remove('drop-target');
            }
        });
        
        this.tabsContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            this.tabsContainer.classList.remove('drop-target');
            
            const folderPath = e.dataTransfer.getData('application/x-folder-path');
            if (folderPath) {
                this.addFolderTab(folderPath);
                Logger.ui.debug(`AssetTabsManager: Dropped folder ${folderPath} on tabs container`);
            }
        });
    }
    
    /**
     * Setup horizontal scrolling for tabs container
     */
    setupHorizontalScrolling() {
        if (!this.tabsContainer) return;
        
        // Add horizontal scroll styles to tabs container
        this.tabsContainer.classList.add('horizontal-scroll-container');
        
        // Setup horizontal scrolling with wheel and drag
        HorizontalScrollUtils.setupHorizontalScrolling(this.tabsContainer, {
            sensitivity: 0.5,
            scrollKey: 'assetTabsScrollLeft',
            userPrefs: this.levelEditor?.userPrefs,
            onScrollChange: (scrollLeft) => {
                Logger.ui.debug(`AssetTabsManager: Scroll position changed to ${scrollLeft}px`);
            }
        });
        
        Logger.ui.debug('AssetTabsManager: Horizontal scrolling setup completed');
    }

    /**
     * Load scroll position from user preferences
     */
    loadScrollPosition() {
        if (this.tabsContainer && this.levelEditor?.userPrefs) {
            const savedScrollLeft = this.levelEditor.userPrefs.get('assetTabsScrollLeft');
            if (savedScrollLeft !== null && savedScrollLeft !== undefined) {
                this.tabsContainer.scrollLeft = savedScrollLeft;
                Logger.ui.debug(`AssetTabsManager: Scroll position restored: ${savedScrollLeft}px`);
            }
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        // Remove horizontal scrolling
        HorizontalScrollUtils.removeScrolling(this.tabsContainer);
        
        if (this.contextMenu) {
            this.contextMenu.destroy();
        }
        
        // Unregister event handlers
        eventHandlerManager.unregisterContainer(this.tabsContainer);
        eventHandlerManager.unregisterElement(this.tabsContainer);
        
        // Cleanup tab dragging handlers
        if (this.tabDraggingMousedownHandler) {
            this.tabsContainer.removeEventListener('mousedown', this.tabDraggingMousedownHandler, { capture: true });
            this.tabDraggingMousedownHandler = null;
        }
        
        Logger.ui.debug('AssetTabsManager: Destroyed');
    }
}

