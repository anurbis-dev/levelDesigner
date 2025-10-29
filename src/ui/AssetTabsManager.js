import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';

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
        
        // Setup folder drag and drop to tabs container
        this.setupFolderDragToTabs();
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
     * Sync default tab with selected folder in FoldersPanel
     * Returns true if state was actually changed, false otherwise
     */
    syncDefaultTab() {
        if (!this.foldersPanel) {
            return false;
        }
        
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        const selectedFolders = this.foldersPanel.selectedFolders || new Set();
        
        // Get first selected folder or root
        const selectedFolderPath = selectedFolders.size > 0 
            ? Array.from(selectedFolders)[0] 
            : 'root';
        
        // Update default tab (first tab should always be default)
        const tabsArray = Array.from(activeTabs);
        
        // Only update if actually needed
        if (tabsArray.length === 0 || tabsArray[0] !== selectedFolderPath) {
            // Update or create default tab
            const newTabs = new Set(activeTabs);
            if (tabsArray.length > 0) {
                // Replace first tab
                newTabs.delete(tabsArray[0]);
            }
            newTabs.add(selectedFolderPath);
            
            // Reorder: put default tab first
            const reorderedTabs = [selectedFolderPath, ...Array.from(newTabs).filter(p => p !== selectedFolderPath)];
            this.stateManager.set('activeAssetTabs', new Set(reorderedTabs));
            
            Logger.ui.debug(`AssetTabsManager: Synced default tab with folder ${selectedFolderPath}`);
            return true; // State was changed
        }
        
        return false; // No changes needed
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
            return;
        }
        
        activeTabs.add(folderPath);
        this.stateManager.set('activeAssetTabs', activeTabs);
        
        // Save to config
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.set('editor.view.activeAssetTabs', Array.from(activeTabs));
        }
        
        // Notify parent panel to re-render only if tabs actually changed
        // Use setTimeout to avoid recursion if render triggers syncDefaultTab
        setTimeout(() => {
            if (this.assetPanel && typeof this.assetPanel.render === 'function') {
                this.assetPanel.render();
            }
        }, 0);
        
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
        
        // Ensure at least one tab remains (default tab)
        if (activeTabs.size <= 1) {
            Logger.ui.debug('AssetTabsManager: Cannot remove last tab');
            return;
        }
        
        activeTabs.delete(folderPath);
        this.stateManager.set('activeAssetTabs', activeTabs);
        
        // Save to config
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.set('editor.view.activeAssetTabs', Array.from(activeTabs));
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

        // DO NOT call syncDefaultTab() here - it modifies state and causes recursion
        // Sync should happen BEFORE render, not during render
        
        // Add tabs to left container
        finalOrder.forEach(folderPath => {
            if (!currentActiveTabs.has(folderPath)) {
                return; // Skip if not in active tabs
            }
            
            const tabButton = document.createElement('button');
            tabButton.className = `tab ${
                currentActiveTabs.has(folderPath) ? 'active' : ''
            }`;
            tabButton.textContent = this.getFolderName(folderPath);
            tabButton.dataset.folderPath = folderPath;
            tabButton.draggable = true;
            
            this.tabsContainer.appendChild(tabButton);
        });

        // Setup tab dragging after rendering (only once)
        // Use tabsWrapper for dragging setup
        if (!this.tabDraggingSetup) {
            this.setupTabDragging();
            this.tabDraggingSetup = true;
        }

        // Setup context menu for tabs after rendering
        this.setupContextMenu();

        // Setup event handlers after elements are created
        // Re-register handlers to ensure they work on new DOM elements
        this.setupEventHandlers();
        
        // Also re-register tab dragging handlers on new tabs
        // Note: tabDraggingSetup will prevent duplicate registration, but we need to ensure
        // handlers are attached to new elements
        if (this.tabDraggingSetup) {
            // Unregister old handlers and re-register
            eventHandlerManager.unregisterElement(this.tabsContainer);
            this.tabDraggingSetup = false; // Reset to allow re-registration
            this.setupTabDragging();
            this.tabDraggingSetup = true;
        }
    }
    
    /**
     * Handle tab click
     * @param {Event} e - Click event
     * @param {string} folderPath - Folder path
     */
    handleTabClick(e, folderPath) {
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        
        if (e.shiftKey) {
            // Toggle tab
            if (activeTabs.has(folderPath)) {
                if (activeTabs.size > 1) {
                    activeTabs.delete(folderPath);
                }
            } else {
                activeTabs.add(folderPath);
            }
        } else {
            // Select single tab
            activeTabs.clear();
            activeTabs.add(folderPath);
        }
        
        this.stateManager.set('activeAssetTabs', activeTabs);
        // Save to config for persistence
        this.levelEditor.configManager.set('editor.view.activeAssetTabs', Array.from(activeTabs));
        this.stateManager.set('selectedAssets', new Set());
        
        // DO NOT call render() here - subscription to activeAssetTabs will handle it
        Logger.ui.debug(`AssetTabsManager: Tab clicked ${folderPath}`);
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
        
        // Handle mouse move for drag over effects
        const handleMouseMove = (e) => {
            if (!draggedTab) return;

            const tab = e.target.closest('.tab');
            if (!tab || tab === draggedTab) {
                // Remove drag-over from all tabs
                this.tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-drag-over'));
                return;
            }

            const targetIndex = Array.from(this.tabsContainer.children).indexOf(tab);
            
            // Remove drag-over from all tabs
            this.tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('tab-drag-over'));
            
            // Add drag-over to target tab
            tab.classList.add('tab-drag-over');
        };

        // Handle mouse up to complete drag
        const handleMouseUp = (e) => {
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
            
            // Remove global handlers
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        // Register container handlers through EventHandlerManager
        const tabDraggingHandlers = {
            mousedown: (e) => {
                const tab = e.target.closest('.tab');
                if (!tab) return;

                draggedTab = tab;
                draggedIndex = Array.from(this.tabsContainer.children).indexOf(tab);
                this.isDraggingTab = true; // Set flag for tab dragging
                
                // Add dragging class
                tab.classList.add('dragging');
                
                // Prevent default to avoid text selection
                e.preventDefault();
                
                // Add global handlers for drag completion
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            },
            selectstart: (e) => {
                if (draggedTab) {
                    e.preventDefault();
                }
            }
        };
        
        eventHandlerManager.registerElement(this.tabsContainer, tabDraggingHandlers, 'asset-tab-dragging-container');
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
     * Destroy and cleanup
     */
    destroy() {
        if (this.contextMenu) {
            this.contextMenu.destroy();
        }
        
        // Unregister event handlers
        eventHandlerManager.unregisterContainer(this.tabsContainer);
        eventHandlerManager.unregisterElement(this.tabsContainer);
        
        // Remove drag and drop listeners
        // Note: These are direct listeners, not managed by EventHandlerManager
        // So we need to remove them manually if they were added
        
        Logger.ui.debug('AssetTabsManager: Destroyed');
    }
}

