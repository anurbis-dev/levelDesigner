import { BasePanel } from './BasePanel.js';
import { Logger } from '../utils/Logger.js';
import { ExtensionErrorUtils } from '../utils/ExtensionErrorUtils.js';
import { AssetContextMenu } from './AssetContextMenu.js';
import { AssetPanelContextMenu } from './AssetPanelContextMenu.js';
import { BaseContextMenu } from './BaseContextMenu.js';
import { FoldersPanel } from './FoldersPanel.js';
import { AssetTabsManager } from './AssetTabsManager.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { createSearchInput, createButton, createControlsRow } from './panel-structures/BasePanelStructure.js';
import { searchManager } from '../utils/SearchManager.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { MenuPositioningUtils } from '../utils/MenuPositioningUtils.js';
import { PanelSizeCalculator } from '../utils/PanelSizeCalculator.js';

/**
 * Asset panel UI component
 */
export class AssetPanel extends BasePanel {
    constructor(container, assetManager, stateManager, levelEditor) {
        super(container, stateManager);
        this.assetManager = assetManager;
        this.levelEditor = levelEditor;
        this.tabsContainer = null;
        this.previewsContainer = null;
        this.foldersContainer = null;
        this.foldersPanel = null;
        this.foldersPosition = 'left'; // 'left' or 'right'
        this.tabsManager = null; // AssetTabsManager instance
        
        this._assetPanelHandlersSetup = false; // Flag to track panel handlers setup

        // Asset size management
        this.assetSize = 96; // Default size, will be loaded in init()
        this.minAssetSize = 48; // w-12 = 48px
        this.maxAssetSize = 192; // w-48 = 192px
        this.sizeStep = 8; // Step size for zoom
        this.gapSize = 8; // Base gap size in pixels, will be scaled by spacing

        // View mode management
        this.viewMode = 'grid'; // 'grid', 'list', 'details'

        // Initialize panel size calculator
        this.panelSizeCalculator = new PanelSizeCalculator();

        // Search and filter management
        this.searchTerm = '';
        this.activeTypeFilters = new Set(); // Set of active asset type filters

        // Initialize asset type filters state if not exists
        if (!this.stateManager.get('assetTypeFilters')) {
            this.stateManager.set('assetTypeFilters', new Set());
        } else {
            // Load existing filters from state
            this.activeTypeFilters = this.stateManager.get('assetTypeFilters') || new Set();
        }


        this.init();
        this.setupEventListeners();
        this.setupContextMenus();
        
        // Initial render to create tabs
        this.render();

        // Register search in universal search manager
        searchManager.registerSearch(
            'assets',
            'assets-search',
            (searchTerm) => {
                this.searchTerm = searchTerm;
                this.renderPreviews(); // Only re-render previews, not entire panel
            },
            () => {
                // Clear callback - could be used for additional cleanup
            }
        );

        // Initialize asset tab context menu - now handled by AssetTabsManager
        // this.assetTabContextMenu removed - handled by tabsManager
    }

    init() {
        // Use existing HTML structure from index.html
        this.tabsContainer = this.container.querySelector('#asset-tabs-container');
        this.previewsContainer = this.container.querySelector('#asset-previews-container');

        // Create folders container
        this.createFoldersContainer();

        // Set relative positioning for marquee selection
        this.previewsContainer.style.position = 'relative';

        // Setup scrolling using BasePanel
        this.setupScrolling({
            horizontal: true,
            vertical: true,
            sensitivity: 1.0,
            target: this.previewsContainer
        });

        // Load asset size from user preferences
        this.assetSize = this.loadAssetSize();

        // Load view mode from user preferences
        this.viewMode = this.loadViewMode();

        // Load folders position from user preferences
        this.foldersPosition = this.loadFoldersPosition();

        // Initialize FoldersPanel
        this.initializeFoldersPanel();

        // Initialize activeAssetTabs from config (now folder paths)
        this.initializeActiveAssetTabs();
        
        // Initialize AssetTabsManager
        this.initializeTabsManager();
        
        // Event handlers will be set up by EventHandlerManager
        
        // Setup folders and listeners
        this.setupFoldersAndListeners();

        // Update layout based on folders position
        this.updateFoldersLayout();
    }

    /**
     * Initialize AssetTabsManager
     * Must be called after foldersPanel is initialized
     */
    initializeTabsManager() {
        if (!this.tabsContainer) {
            Logger.ui.error('AssetPanel: tabsContainer not available for tabs manager');
            return;
        }
        
        // Ensure foldersPanel is initialized first
        if (!this.foldersPanel) {
            Logger.ui.warn('AssetPanel: FoldersPanel not initialized, delaying tabs manager initialization');
            // Retry after a short delay
            setTimeout(() => {
                if (this.foldersPanel) {
                    this.initializeTabsManager();
                }
            }, 100);
            return;
        }
        
        // Create two-part structure: left for tabs, right for controls
        let tabsLeftContainer = this.tabsContainer.querySelector('#asset-tabs-left');
        if (!tabsLeftContainer) {
            const tabsLeft = document.createElement('div');
            tabsLeft.id = 'asset-tabs-left';
            tabsLeft.className = 'flex flex-1';
            
            const tabsRight = document.createElement('div');
            tabsRight.id = 'asset-tabs-right';
            tabsRight.className = 'flex items-center flex-shrink-0';
            
            // Clear container and add new structure
            this.tabsContainer.innerHTML = '';
            this.tabsContainer.appendChild(tabsLeft);
            this.tabsContainer.appendChild(tabsRight);
            
            tabsLeftContainer = tabsLeft;
            
        }
        
        this.tabsManager = new AssetTabsManager(
            tabsLeftContainer,
            this.stateManager,
            this.foldersPanel,
            this.levelEditor,
            this
        );
        
    }



    /**
     * Decrease asset size
     */
    decreaseAssetSize() {
        const newSize = Math.max(this.minAssetSize, this.assetSize - this.sizeStep);
        if (newSize !== this.assetSize) {
            this.assetSize = newSize;
            this.saveAssetSize();
            this.render();
        }
    }

    /**
     * Increase asset size
     */
    increaseAssetSize() {
        const newSize = Math.min(this.maxAssetSize, this.assetSize + this.sizeStep);
        if (newSize !== this.assetSize) {
            this.assetSize = newSize;
            this.saveAssetSize();
            this.render();
        }
    }

    /**
     * Set view mode
     * @param {string} mode - View mode ('grid', 'list', 'details')
     */
    setViewMode(mode) {
        if (['grid', 'list', 'details'].includes(mode)) {
            this.viewMode = mode;
            this.saveViewMode();
            this.render();
            Logger.ui.debug('View mode changed to:', mode);
        }
    }

    /**
     * Setup folders resizer and asset change listeners
     */
    setupFoldersAndListeners() {
        // Setup folders resizer
        this.setupFoldersResizer();

        // Listen for asset changes to refresh panels
        this.stateManager.subscribe('assetsChanged', () => {
            if (this.foldersPanel) {
                this.foldersPanel.refresh();
            }
            // Also refresh the asset panel itself
            this.render();
        });
        
        // Listen for folder selection changes to sync active tab
        // Sync happens BEFORE render to avoid recursion
        this.stateManager.subscribe('selectedFolders', (selectedFolders) => {
            if (this.foldersPanel && selectedFolders && this.tabsManager) {
                // Normalize selectedFolders to Set format
                const foldersSet = Array.isArray(selectedFolders) 
                    ? new Set(selectedFolders) 
                    : (selectedFolders instanceof Set ? selectedFolders : new Set());
                
                // Update foldersPanel's selectedFolders
                if (foldersSet.size > 0) {
                    this.foldersPanel.selectedFolders = foldersSet;
                    // Sync tab - this will activate existing tab or clear active tab if no tab exists
                    this.tabsManager.syncTabToFolder();
                    // render() will be triggered by subscriptions in AssetTabsManager
                }
            }
            
            // Always update previews when folder selection changes (default behavior when no tabs)
            // This ensures content updates even when no tabs exist
            this.renderPreviews();
        });
    }

    /**
     * Initialize active asset tabs from config
     * Now uses folder paths instead of categories
     * No default tab is created - tabs are added only by user dragging folders
     */
    initializeActiveAssetTabs() {
        // Load tabs from config if available
        let activeTabs = new Set();
        let activeTab = null;
        
        if (this.levelEditor?.configManager) {
            const savedTabs = this.levelEditor.configManager.get('editor.view.activeAssetTabs');
            const savedActiveTab = this.levelEditor.configManager.get('editor.view.activeAssetTab');
            
            if (savedTabs && Array.isArray(savedTabs)) {
                activeTabs = new Set(savedTabs);
            }
            if (savedActiveTab) {
                activeTab = savedActiveTab;
            }
        }
        
        this.stateManager.set('activeAssetTabs', activeTabs);
        this.stateManager.set('activeAssetTab', activeTab);
        
        Logger.ui.debug('AssetPanel: Initialized tabs from config', { 
            activeTabs: Array.from(activeTabs), 
            activeTab 
        });
    }
    
    /**
     * Get currently active tab folder paths
     * If no active tab, returns selected folders from FoldersPanel
     * Supports multiple selection
     * @returns {Array<string>} Array of folder paths
     */
    getActiveTabPaths() {
        const activeTab = this.stateManager.get('activeAssetTab');
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        
        // Always prioritize selected folders from FoldersPanel for content display
        if (this.foldersPanel?.selectedFolders && this.foldersPanel.selectedFolders.size > 0) {
            return Array.from(this.foldersPanel.selectedFolders);
        }
        
        // If there's an active tab and it exists in activeTabs, use it
        if (activeTab && activeTabs.has(activeTab)) {
            return [activeTab];
        }
        
        // Fallback to 'root' if no folder selected
        return ['root'];
    }
    
    /**
     * Get currently active tab folder path (for backward compatibility)
     * @returns {string} Active folder path
     */
    getActiveTabPath() {
        const paths = this.getActiveTabPaths();
        return paths[0] || 'root';
    }
    
    /**
     * Get all assets from folder recursively (including all subfolders)
     * @param {string} folderPath - Folder path (e.g., 'root' or 'root/assets/characters')
     * @returns {Array} Array of asset objects
     */
    getAssetsFromFolder(folderPath) {
        if (!this.foldersPanel || !this.foldersPanel.folderStructure) {
            Logger.ui.warn('AssetPanel: FoldersPanel not initialized');
            return [];
        }
        
        const folder = this.foldersPanel.getFolderByPath(folderPath);
        if (!folder) {
            Logger.ui.warn(`AssetPanel: Folder not found: ${folderPath}`);
            return [];
        }
        
        const assets = [];
        
        // Helper function to recursively collect assets
        const collectAssetsRecursive = (f) => {
            // Add assets from current folder
            if (f.assets && Array.isArray(f.assets)) {
                assets.push(...f.assets);
            }
            
            // Recursively collect from child folders
            if (f.children && typeof f.children === 'object') {
                for (const childFolder of Object.values(f.children)) {
                    collectAssetsRecursive(childFolder);
                }
            }
        };
        
        collectAssetsRecursive(folder);
        
        return assets;
    }
    
    /**
     * Get folder name by path
     * @param {string} folderPath - Folder path
     * @returns {string} Folder name
     */
    getFolderName(folderPath) {
        if (this.tabsManager) {
            return this.tabsManager.getFolderName(folderPath);
        }
        return folderPath;
    }
    
    /**
     * Add tab for folder
     * @param {string} folderPath - Folder path
     */
    addFolderTab(folderPath) {
        if (this.tabsManager) {
            this.tabsManager.addFolderTab(folderPath);
        }
    }
    
    /**
     * Remove tab for folder
     * @param {string} folderPath - Folder path
     */
    removeFolderTab(folderPath) {
        if (this.tabsManager) {
            this.tabsManager.removeFolderTab(folderPath);
        }
    }

    /**
     * Load asset size from user preferences
     */
    loadAssetSize() {
        const savedSize = this.levelEditor?.userPrefs?.get('assetSize');
        if (savedSize && typeof savedSize === 'number' && savedSize >= this.minAssetSize && savedSize <= this.maxAssetSize) {
            Logger.ui.debug('Loaded asset size from preferences:', savedSize);
            return savedSize;
        }
        Logger.ui.debug('Using default asset size:', 96);
        return 96; // Default size
    }

    /**
     * Save asset size to user preferences
     */
    saveAssetSize() {
        if (this.levelEditor?.userPrefs) {
            this.levelEditor.userPrefs.set('assetSize', this.assetSize);
            Logger.ui.debug('Saved asset size to preferences:', this.assetSize);
        }
    }

    /**
     * Load view mode from user preferences
     */
    loadViewMode() {
        const savedMode = this.levelEditor?.userPrefs?.get('assetViewMode');
        if (savedMode && ['grid', 'list', 'details'].includes(savedMode)) {
            Logger.ui.debug('Loaded asset view mode from preferences:', savedMode);
            return savedMode;
        }
        Logger.ui.debug('Using default asset view mode: grid');
        return 'grid'; // Default mode
    }

    /**
     * Save view mode to user preferences
     */
    saveViewMode() {
        if (this.levelEditor?.userPrefs) {
            this.levelEditor.userPrefs.set('assetViewMode', this.viewMode);
            Logger.ui.debug('Saved asset view mode to preferences:', this.viewMode);
        }
    }

    /**
     * Load folders position from user preferences
     */
    loadFoldersPosition() {
        const savedPosition = this.levelEditor?.userPrefs?.get('foldersPosition');
        if (savedPosition && ['left', 'right'].includes(savedPosition)) {
            Logger.ui.debug('Loaded folders position from preferences:', savedPosition);
            return savedPosition;
        }
        Logger.ui.debug('Using default folders position:', 'left');
        return 'left'; // Default position
    }

    /**
     * Save folders position to user preferences
     */
    saveFoldersPosition() {
        if (this.levelEditor?.userPrefs) {
            this.levelEditor.userPrefs.set('foldersPosition', this.foldersPosition);
            Logger.ui.debug('Saved folders position to preferences:', this.foldersPosition);
        }
    }

    /**
     * Create folders container
     */
    createFoldersContainer() {
        // Create main container for folders and content
        const mainContainer = document.createElement('div');
        mainContainer.id = 'asset-main-container';
        mainContainer.className = 'flex flex-grow overflow-hidden';

        // Create folders container
        this.foldersContainer = document.createElement('div');
        this.foldersContainer.id = 'asset-folders-container';
        this.foldersContainer.className = 'border-r border-gray-700 flex flex-col flex-shrink-0';
        this.foldersContainer.style.backgroundColor = 'var(--ui-background-color, #1f2937)';

        // Create resizer for folders panel
        this.foldersResizer = document.createElement('div');
        this.foldersResizer.id = 'folders-resizer';
        this.foldersResizer.className = 'resizer-x';
        this.foldersResizer.style.cssText = `
            width: 4px;
            background-color: transparent;
            cursor: ew-resize;
            position: relative;
            z-index: 10;
        `;
        this.foldersResizer.innerHTML = '<div class="resize-indicator"></div>';

        // Create content container (tabs + previews)
        const contentContainer = document.createElement('div');
        contentContainer.id = 'asset-content-container';
        contentContainer.className = 'flex flex-col flex-grow overflow-hidden';

        // Move existing tabs and previews containers into content container
        if (this.tabsContainer && this.tabsContainer.parentNode) {
            this.tabsContainer.parentNode.removeChild(this.tabsContainer);
            contentContainer.appendChild(this.tabsContainer);
        }

        if (this.previewsContainer && this.previewsContainer.parentNode) {
            this.previewsContainer.parentNode.removeChild(this.previewsContainer);
            contentContainer.appendChild(this.previewsContainer);
        }

        // Add folders and content to main container
        mainContainer.appendChild(this.foldersContainer);
        mainContainer.appendChild(contentContainer);

        // Add main container to asset panel
        this.container.appendChild(mainContainer);
    }

    /**
     * Initialize FoldersPanel
     */
    initializeFoldersPanel() {
        if (!this.foldersContainer) {
            Logger.ui.error('AssetPanel: foldersContainer not created yet');
            return;
        }

        if (!this.assetManager) {
            Logger.ui.error('AssetPanel: assetManager not available');
            return;
        }

        if (!this.stateManager) {
            Logger.ui.error('AssetPanel: stateManager not available');
            return;
        }

        if (!this.levelEditor) {
            Logger.ui.error('AssetPanel: levelEditor not available');
            return;
        }

        Logger.ui.debug('AssetPanel: Initializing FoldersPanel');
        this.foldersPanel = new FoldersPanel(this.foldersContainer, this.assetManager, this.stateManager, this.levelEditor, this);
    }

    /**
     * Update folders layout based on position
     */
    updateFoldersLayout() {
        const mainContainer = this.container.querySelector('#asset-main-container');
        const foldersContainer = this.container.querySelector('#asset-folders-container');
        const contentContainer = this.container.querySelector('#asset-content-container');

        if (!mainContainer || !foldersContainer || !contentContainer) return;

        // Clear existing layout
        mainContainer.innerHTML = '';

        if (this.foldersPosition === 'left') {
            // Folders on left, content on right
            mainContainer.appendChild(foldersContainer);
            mainContainer.appendChild(this.foldersResizer);
            mainContainer.appendChild(contentContainer);
            foldersContainer.className = 'bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0';
            contentContainer.className = 'flex flex-col flex-grow overflow-hidden';
        } else {
            // Content on left, folders on right
            mainContainer.appendChild(contentContainer);
            mainContainer.appendChild(this.foldersResizer);
            mainContainer.appendChild(foldersContainer);
            contentContainer.className = 'flex flex-col flex-grow overflow-hidden';
            foldersContainer.className = 'bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0';
        }

        // Re-append tabs and previews to content container
        contentContainer.appendChild(this.tabsContainer);
        contentContainer.appendChild(this.previewsContainer);
    }

    /**
     * Toggle folders position (left/right)
     */
    toggleFoldersPosition() {
        if (this.levelEditor.panelPositionManager) {
            this.levelEditor.panelPositionManager.togglePanelPosition('folders');
        } else {
            // Fallback to old method if PanelPositionManager not available
            this.foldersPosition = this.foldersPosition === 'left' ? 'right' : 'left';
            this.saveFoldersPosition();
            this.updateFoldersLayout();
            Logger.ui.info(`Folders panel moved to ${this.foldersPosition}`);
        }
    }

    /**
     * Filter assets by selected folder
     */
    filterByFolder(folder) {
        if (!folder) {
            Logger.ui.warn('AssetPanel: filterByFolder called with null/undefined folder');
            return;
        }

        if (!folder.path) {
            Logger.ui.warn('AssetPanel: folder has no path property:', folder);
            return;
        }

        Logger.ui.debug('AssetPanel: filterByFolder called with folder:', folder.path);

        // Delegate folder selection to foldersPanel
        // This will trigger tab sync via selectedFolders subscription
        if (this.foldersPanel) {
            this.foldersPanel.selectFolder(folder.path, null);
        }

        Logger.ui.debug(`Filtered assets by folder: ${folder.path}`);
    }

    /**
     * Select specific asset
     */
    selectAsset(assetId) {
        if (!assetId) {
            Logger.ui.warn('AssetPanel: selectAsset called with invalid assetId');
            return;
        }

        if (!this.assetManager || !this.assetManager.assets) {
            Logger.ui.error('AssetPanel: assetManager or assets not available');
            return;
        }

        const asset = this.assetManager.assets.get(assetId);
        if (!asset) {
            Logger.ui.warn('AssetPanel: Asset not found:', assetId);
            return;
        }

        // Find folder path for this asset
        let folderPath = 'root';
        if (asset.path) {
            // Extract folder path from asset path
            const pathParts = asset.path.split('/').slice(0, -1); // Remove filename
            if (pathParts.length > 0) {
                folderPath = 'root/' + pathParts.join('/');
            }
        }

        // Delegate tab activation to tabsManager/foldersPanel
        if (this.foldersPanel) {
            this.foldersPanel.selectFolder(folderPath, null);
        }

        // Select the asset
        const selectedAssets = this.stateManager.get('selectedAssets') || new Set();
        selectedAssets.add(assetId);
        this.stateManager.set('selectedAssets', selectedAssets);

        // Scroll to and highlight the asset
        setTimeout(() => {
            if (this.previewsContainer) {
                const assetElement = this.previewsContainer.querySelector(`[data-asset-id="${assetId}"]`);
                if (assetElement) {
                    assetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    assetElement.classList.add('ring-2', 'ring-blue-500');
                    setTimeout(() => {
                        assetElement.classList.remove('ring-2', 'ring-blue-500');
                    }, 2000);
                }
            }
        }, 100);

        Logger.ui.debug('Selected asset from folders panel:', assetId);
    }

    /**
     * Update content visibility based on folders width
     */
    updateContentVisibility(foldersWidth) {
        // Hide folders container completely when width is very small
        if (foldersWidth < 50) {
            this.foldersContainer.style.display = 'none';
        } else {
            this.foldersContainer.style.display = 'flex';
        }
    }

    /**
     * Setup folders panel resizer
     */
    setupFoldersResizer() {
        if (!this.foldersResizer) return;

        // Register folders resizer with EventHandlerManager
        const resizerHandlers = {
            dblclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const currentWidth = this.foldersContainer.offsetWidth;
                const containerWidth = this.container.clientWidth;
                const resizerWidth = 4;
                const minWidth = 0;
                const maxWidth = containerWidth - resizerWidth;
                const previousFoldersWidth = 192; // Default width (w-48)
                
                // Check if already at minimum (collapsed)
                if (currentWidth <= minWidth) {
                    // Restore to previous width
                    const newWidth = Math.min(previousFoldersWidth, maxWidth);
                    
                    // Update StateManager instead of direct styles
                    if (this.levelEditor?.stateManager) {
                        this.levelEditor.stateManager.set('panels.foldersWidth', newWidth);
                    }
                    this.updateContentVisibility(newWidth);
                    
                    // Save to preferences
                    if (this.levelEditor?.userPrefs) {
                        this.levelEditor.userPrefs.set('foldersWidth', newWidth);
                    }
                } else {
                    // Save current width and collapse
                    const newWidth = minWidth;
                    
                    // Update StateManager instead of direct styles
                    if (this.levelEditor?.stateManager) {
                        this.levelEditor.stateManager.set('panels.foldersWidth', newWidth);
                    }
                    this.updateContentVisibility(newWidth);
                    
                    // Save to preferences
                    if (this.levelEditor?.userPrefs) {
                        this.levelEditor.userPrefs.set('foldersWidth', newWidth);
                    }
                }
            },
            mousedown: (e) => this.handleFoldersResizerMouseDown(e)
        };
        
        // Register with EventHandlerManager
        eventHandlerManager.registerElement(this.foldersResizer, resizerHandlers, 'folders-resizer');

        // Register with unified ResizerManager
        if (this.levelEditor?.resizerManager) {
            this.levelEditor.resizerManager.registerResizer(
                this.foldersResizer, 
                this.foldersContainer, 
                'folders', 
                'horizontal'
            );
        } else {
            Logger.ui.warn('ResizerManager not available, falling back to legacy setup');
            // Fallback to legacy setup if ResizerManager is not available
            this.setupLegacyFoldersResizer();
        }

        // Load saved width
        if (this.levelEditor?.userPrefs) {
            const savedWidth = this.levelEditor.userPrefs.get('foldersWidth');
            if (savedWidth && typeof savedWidth === 'number' && savedWidth >= 0) {
                this.foldersContainer.style.width = savedWidth + 'px';
                this.foldersContainer.style.flexShrink = '0';
                this.foldersContainer.style.flexGrow = '0';

                // Update visibility based on loaded width
                this.updateContentVisibility(savedWidth);

                // Update grid layout if in grid view (deferred to ensure grid is rendered)
                setTimeout(() => {
                    if (this.viewMode === 'grid') {
                        this.updateGridViewSizes();
                    }
                }, 0);

                Logger.ui.debug('Loaded saved folders width:', savedWidth);
            }
        }

        Logger.ui.debug('AssetPanel: Setup folders resizer with unified ResizerManager');
    }

    /**
     * Handle folders resizer mouse down
     */
    handleFoldersResizerMouseDown(e) {
        let isResizingFolders = false;
        let initialMouseX = 0;
        let initialFoldersWidth = 0;
        let lastAppliedFoldersWidth = null;

        isResizingFolders = true;
        initialMouseX = e.clientX;
        initialFoldersWidth = this.foldersContainer.offsetWidth;
        lastAppliedFoldersWidth = null;

        // Visual feedback
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        this.foldersResizer.classList.add('resizing');

        e.preventDefault();
        e.stopPropagation();

        // Global mousemove handler
        const handleMouseMove = (e) => {
            if (!isResizingFolders) return;

            e.preventDefault();
            e.stopPropagation();

            // Use panel size calculator
            const newWidth = this.panelSizeCalculator.calculateHorizontalPanelSize(
                this.foldersResizer, 
                e, 
                { startX: initialMouseX, startWidth: initialFoldersWidth }
            );

            // If width didn't change compared to last applied, skip work
            if (lastAppliedFoldersWidth !== null && newWidth === lastAppliedFoldersWidth) {
                return;
            }

            // Apply new width
            this.foldersContainer.style.width = newWidth + 'px';
            this.foldersContainer.style.flexShrink = '0';
            this.foldersContainer.style.flexGrow = '0';

            // Hide/show content elements based on folders width
            this.updateContentVisibility(newWidth);

            // Save to preferences
            if (this.levelEditor?.userPrefs) {
                this.levelEditor.userPrefs.set('foldersWidth', newWidth);
            }

            lastAppliedFoldersWidth = newWidth;

            Logger.ui.debug(`Folders panel resized to ${newWidth}px`);
        };

        // Global mouseup handler
        const handleMouseUp = (e) => {
            if (isResizingFolders) {
                isResizingFolders = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                this.foldersResizer.classList.remove('resizing');

                Logger.ui.debug('Folders panel resize completed');
            }
        };

        // Store handlers for cleanup
        this.foldersMouseMoveHandler = handleMouseMove;
        this.foldersMouseUpHandler = handleMouseUp;
        
        // Register document mouse handlers with GlobalEventRegistry
        const documentMouseHandlers = {
            mousemove: this.foldersMouseMoveHandler,
            mouseup: this.foldersMouseUpHandler
        };
        
        globalEventRegistry.registerComponentHandlers('asset-panel-folders', documentMouseHandlers, 'document');
    }

    /**
     * Legacy folders resizer setup (fallback)
     */
    setupLegacyFoldersResizer() {
        let isResizingFolders = false;
        let initialMouseX = 0;
        let initialFoldersWidth = 0;
        let lastAppliedFoldersWidth = null;

        this.foldersResizer.addEventListener('mousedown', (e) => {
            isResizingFolders = true;
            initialMouseX = e.clientX;
            initialFoldersWidth = this.foldersContainer.offsetWidth;
            lastAppliedFoldersWidth = null;

            // Visual feedback
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            this.foldersResizer.classList.add('resizing');

            e.preventDefault();
            e.stopPropagation();
        });

        // Global mousemove handler
        const handleMouseMove = (e) => {
            if (!isResizingFolders) return;

            e.preventDefault();
            e.stopPropagation();

            // Use panel size calculator
            const newWidth = this.panelSizeCalculator.calculateHorizontalPanelSize(
                this.foldersResizer, 
                e, 
                { startX: initialMouseX, startWidth: initialFoldersWidth }
            );

            // If width didn't change compared to last applied, skip work
            if (lastAppliedFoldersWidth !== null && newWidth === lastAppliedFoldersWidth) {
                return;
            }

            // Apply new width
            this.foldersContainer.style.width = newWidth + 'px';
            this.foldersContainer.style.flexShrink = '0';
            this.foldersContainer.style.flexGrow = '0';

            // Hide/show content elements based on folders width
            this.updateContentVisibility(newWidth);

            // Save to preferences
            if (this.levelEditor?.userPrefs) {
                this.levelEditor.userPrefs.set('foldersWidth', newWidth);
            }

            lastAppliedFoldersWidth = newWidth;

            Logger.ui.debug('Folders panel resized to:', newWidth);
        };

        // Global mouseup handler
        const handleMouseUp = () => {
            if (isResizingFolders) {
                isResizingFolders = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                this.foldersResizer.classList.remove('resizing');

                Logger.ui.debug('Folders panel resize completed');
            }
        };

        // Store references for cleanup
        this.foldersMouseMoveHandler = handleMouseMove;
        this.foldersMouseUpHandler = handleMouseUp;
        
        // Add global listeners
        document.addEventListener('mousemove', this.foldersMouseMoveHandler);
        document.addEventListener('mouseup', this.foldersMouseUpHandler);

    }

    setupEventListeners() {
        // Setup selection functionality for assets
        this.setupSelection({
            selectionKey: 'selectedAssets',
            anchorKey: 'assets.shiftAnchor',
            getItemList: () => this.getAssetList(),
            getSelectableItems: () => this.getSelectableAssetElements(),
            onSelectionChange: () => this.updateSelectionVisuals(),
            canSelect: (asset) => true, // All assets can be selected
            itemSelector: '.asset-thumbnail, .asset-list-item, .asset-details-row, [data-asset-id]',
            selectedClass: 'selected',
            enableMarquee: true,
            mouseStateKey: 'mouse.isAssetMarqueeSelecting',
            marqueeId: 'asset-marquee-selection'
        });

        // Subscribe to state changes
        this.stateManager.subscribe('activeAssetTabs', () => {
            Logger.ui.debug('AssetPanel: activeAssetTabs changed - render will be called');
            this.render();
        });
        
        // Subscribe to active tab changes to update content
        this.stateManager.subscribe('activeAssetTab', () => {
            Logger.ui.debug('AssetPanel: activeAssetTab changed - updating previews');
            this.renderPreviews();
        });
        
        // Event handlers will be setup in render() after elements are created
        
        // Window resize handler for real-time grid recalculation
        // Register window resize handler with GlobalEventRegistry
        const windowResizeHandlers = {
            resize: () => {
                Logger.ui.debug('AssetPanel: Window resize detected');
                // Update asset placement in real-time without debounce
                if (this.viewMode === 'grid') {
                    // Update grid layout immediately for real-time responsiveness
                    this.updateGridViewSizes();
                } else {
                    // For list and details view, just update selection visuals
                    this.updateSelectionVisuals();
                }
            }
        };

        globalEventRegistry.registerComponentHandlers('asset-panel', windowResizeHandlers, 'window');

        // ResizeObserver for asset panel container to handle all internal resizes (folders, other panels, etc.)
        this.containerResizeObserver = new ResizeObserver(() => {
            Logger.ui.debug('AssetPanel: Container resize detected');
            if (this.viewMode === 'grid') {
                this.updateGridViewSizes();
            }
        });
        this.containerResizeObserver.observe(this.previewsContainer);


        this.setupAssetEvents();
        
        // Setup asset panel handlers (must be called after previewsContainer is available)
        this.setupAssetPanelHandlers();
    }

    render() {
        Logger.ui.debug('AssetPanel: render called');
        this.renderTabs();
        this.renderPreviews();
        
    }

    renderTabs() {
        // DO NOT call syncTabToFolder() here - it modifies state and causes recursion
        // Sync happens only when selectedFolders changes (via subscription)
        if (this.tabsManager) {
            this.tabsManager.render();
        }
        
        // Render search and filter controls in footer
        this.renderAssetSearchControls();
    }

    /**
     * Render asset search and filter controls in the tabs footer
     */
    renderAssetSearchControls() {
        // Get right container for controls
        const tabsRightContainer = this.tabsContainer?.querySelector('#asset-tabs-right');
        if (!tabsRightContainer) {
            // If structure not created yet, create it
            if (this.tabsContainer) {
                const tabsLeft = document.createElement('div');
                tabsLeft.id = 'asset-tabs-left';
                tabsLeft.className = 'flex flex-1';
                
                const tabsRight = document.createElement('div');
                tabsRight.id = 'asset-tabs-right';
                tabsRight.className = 'flex items-center flex-shrink-0';
                
                // Check if container already has content
                if (this.tabsContainer.children.length > 0) {
                    // Preserve existing content
                    const existingContent = Array.from(this.tabsContainer.children);
                    this.tabsContainer.innerHTML = '';
                    this.tabsContainer.appendChild(tabsLeft);
                    
                    // Move existing tabs to left container
                    existingContent.forEach(child => {
                        if (child.classList.contains('tab')) {
                            tabsLeft.appendChild(child);
                        } else {
                            tabsRight.appendChild(child);
                        }
                    });
                } else {
                    this.tabsContainer.innerHTML = '';
                    this.tabsContainer.appendChild(tabsLeft);
                }
                
                this.tabsContainer.appendChild(tabsRight);
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
                this.searchTerm = searchTerm;
                Logger.ui.debug('Asset search term changed directly:', searchTerm);
                this.renderPreviews();
            }
        );

        // Create filter button
        const filterButton = document.createElement('button');
        filterButton.id = 'assets-filter-btn';
        filterButton.className = 'px-2 py-1 rounded text-sm flex items-center justify-center bg-gray-600 hover:bg-gray-700';
        filterButton.title = 'Filter by asset types';
        
        // Set button state based on active filters
        const hasActiveFilters = this.activeTypeFilters.size > 0 && !this.activeTypeFilters.has('DISABLE_ALL');
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
        // Get all available asset types from current assets
        const allAssets = Array.from(this.assetManager.assets.values());
        let allTypes = [...new Set(allAssets.map(asset => asset.type).filter(type => type))];
        
        // If no types found, use categories as fallback
        if (allTypes.length === 0) {
            allTypes = Array.from(this.assetManager.categories);
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

        // Add "Toggle All" option using utility
        const allTypesActive = this.activeTypeFilters.size === 0;
        const allOption = MenuPositioningUtils.createMenuItem({
            text: 'Toggle All',
            checked: allTypesActive
        });
        allOption.querySelector('input').id = 'filter-all';

        allOption.addEventListener('click', () => {
            // Check current state at the time of click
            const currentlyAllActive = this.activeTypeFilters.size === 0;
            
            if (currentlyAllActive) {
                // Currently all types are active, deactivate all
                this.activeTypeFilters = new Set(['DISABLE_ALL']);
            } else {
                // Currently some types are filtered or disabled, activate all
                this.activeTypeFilters.clear();
            }
            // Save state (like OutlinerPanel does)
            this.stateManager.set('assetTypeFilters', this.activeTypeFilters);
            this.renderPreviews();
            // Update menu instead of closing it
            this.updateAssetFilterMenu(menu, button);
        });

        menu.appendChild(allOption);

        // Add separator
        const separator = document.createElement('div');
        separator.className = 'border-t border-gray-600 my-1';
        menu.appendChild(separator);

        // Add individual type options using utility
        allTypes.sort().forEach(type => {
            // Type is active if: no filters (show all) OR specifically selected OR not in DISABLE_ALL mode
            const isActive = this.activeTypeFilters.size === 0 ||
                           (this.activeTypeFilters.has(type) && !this.activeTypeFilters.has('DISABLE_ALL'));

            const option = MenuPositioningUtils.createMenuItem({
                text: type,
                checked: isActive
            });
            option.querySelector('input').id = `filter-${type}`;

            option.addEventListener('click', () => {
                if (this.activeTypeFilters.has('DISABLE_ALL')) {
                    // If in DISABLE_ALL mode, start with this type only
                    this.activeTypeFilters = new Set([type]);
                } else if (this.activeTypeFilters.size === 0) {
                    // If all were active, exclude this type (show all except this one)
                    this.activeTypeFilters = new Set(allTypes.filter(t => t !== type));
                } else if (this.activeTypeFilters.has(type)) {
                    // Remove this type
                    this.activeTypeFilters.delete(type);
                    // If no types left, disable all (show nothing)
                    if (this.activeTypeFilters.size === 0) {
                        this.activeTypeFilters = new Set(['DISABLE_ALL']);
                    }
                } else {
                    // Add this type
                    this.activeTypeFilters.add(type);
                }
                // Save state (like OutlinerPanel does)
                this.stateManager.set('assetTypeFilters', this.activeTypeFilters);
                this.renderPreviews();
                // Update menu instead of closing it
                this.updateAssetFilterMenu(menu, button);
            });

            menu.appendChild(option);
        });
    }

    /**
     * Update filter menu to reflect current filter state
     */
    updateAssetFilterMenu(menu, button) {
        // Update "Toggle All" option
        const allOption = menu.querySelector('#filter-all');
        if (allOption) {
            allOption.checked = this.activeTypeFilters.size === 0;
        }

        // Update individual type options
        const allAssets = Array.from(this.assetManager.assets.values());
        let allTypes = [...new Set(allAssets.map(asset => asset.type).filter(type => type))];
        
        // If no types found, use categories as fallback
        if (allTypes.length === 0) {
            allTypes = Array.from(this.assetManager.categories);
        }
        
        allTypes.forEach(type => {
            const option = menu.querySelector(`#filter-${type}`);
            if (option) {
                const isActive = this.activeTypeFilters.size === 0 ||
                               (this.activeTypeFilters.has(type) && !this.activeTypeFilters.has('DISABLE_ALL'));
                option.checked = isActive;
            }
        });

        // Update filter button appearance
        const filterButton = document.querySelector('#assets-filter-btn');
        if (filterButton) {
            const hasActiveFilters = this.activeTypeFilters.size > 0 && !this.activeTypeFilters.has('DISABLE_ALL');
            filterButton.className = filterButton.className.replace(/bg-(blue|gray)-600/, hasActiveFilters ? 'bg-blue-600' : 'bg-gray-600');
            filterButton.className = filterButton.className.replace(/hover:bg-(blue|gray)-700/, hasActiveFilters ? 'hover:bg-blue-700' : 'hover:bg-gray-700');
        }
    }

    /**
     * Check if asset should be shown based on filters
     */
    shouldShowAsset(asset) {
        // If no filters active (size === 0), show all
        if (this.activeTypeFilters.size === 0) {
            return true;
        }

        // If DISABLE_ALL is active, show nothing
        if (this.activeTypeFilters.has('DISABLE_ALL')) {
            return false;
        }

        // Check if asset type is in active filters
        const assetType = asset.type || asset.category;
        return this.activeTypeFilters.has(assetType);
    }

    /**
     * Clear search filter
     */
    clearSearch() {
        if (this.searchTerm) {
            this.searchTerm = '';
            // Update search manager
            if (typeof searchManager !== 'undefined' && searchManager.setSearchTerm) {
                searchManager.setSearchTerm('assets', '');
            }
            this.renderPreviews();
        }
    }
    filterAssets(assets) {
        let filtered = assets;

        // Apply search filter first
        if (this.searchTerm) {
            filtered = SearchUtils.filterObjects(filtered, this.searchTerm, 'name');
        }

        // Apply type filter only if there are active filters
        if (this.activeTypeFilters.size > 0) {
            filtered = filtered.filter(asset => this.shouldShowAsset(asset));
        }

        return filtered;
    }

    renderPreviews() {
        this.previewsContainer.innerHTML = '';
        // Get folder paths to show:
        // - If there's an active tab, use it (or multiple if multi-select)
        // - If no tabs exist, use selected folders from FoldersPanel (default behavior)
        const folderPathsToShow = this.getActiveTabPaths();
        const selectedAssets = this.stateManager.get('selectedAssets');

        // Collect assets from all selected folders recursively
        const allAssets = [];
        for (const folderPath of folderPathsToShow) {
            const folderAssets = this.getAssetsFromFolder(folderPath);
            allAssets.push(...folderAssets);
        }
        
        // Remove duplicates by asset ID
        const uniqueAssets = Array.from(new Map(allAssets.map(asset => [asset.id, asset])).values());
        let assetsToShow = uniqueAssets;

        // Apply search and type filters
        assetsToShow = this.filterAssets(assetsToShow);

        switch (this.viewMode) {
            case 'grid':
                this.renderGridView(assetsToShow, selectedAssets);
                break;
            case 'list':
                this.renderListView(assetsToShow, selectedAssets);
                break;
            case 'details':
                this.renderDetailsView(assetsToShow, selectedAssets);
                break;
        }
    }

    /**
     * Render assets in grid view
     * @param {Array} assets - Assets to render
     * @param {Set} selectedAssets - Selected asset IDs
     */
    renderGridView(assets, selectedAssets) {
        // Restore padding for grid view
        this.previewsContainer.classList.remove('p-0');
        // No padding for main interface elements
        
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gap = `calc(${this.gapSize}px * max(var(--spacing-scale, 1.0), 0))`;
        
        // Calculate dynamic grid columns based on asset size and container width
        const containerWidth = this.previewsContainer.clientWidth;
        const spacingScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing-scale')) || 1.0;
        const scaledGapSize = this.gapSize * spacingScale;
        const columns = Math.max(1, Math.floor((containerWidth + scaledGapSize) / (this.assetSize + scaledGapSize)));
        
        // Use fixed column width instead of 1fr to prevent jumping
        const columnWidth = this.assetSize;
        grid.style.gridTemplateColumns = `repeat(${columns}, ${columnWidth}px)`;
        
        assets.forEach(asset => {
            const thumb = this.createAssetThumbnail(asset, selectedAssets);
            grid.appendChild(thumb);
        });
        
        this.previewsContainer.appendChild(grid);
    }

    /**
     * Render assets in list view
     * @param {Array} assets - Assets to render
     * @param {Set} selectedAssets - Selected asset IDs
     */
    renderListView(assets, selectedAssets) {
        // Restore padding for list view
        this.previewsContainer.classList.remove('p-0');
        // No padding for main interface elements
        
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexWrap = 'wrap';
        list.style.gap = `calc(${this.gapSize}px * max(var(--spacing-scale, 1.0), 0))`;
        
        assets.forEach(asset => {
            const item = this.createAssetListItem(asset, selectedAssets);
            list.appendChild(item);
        });
        
        this.previewsContainer.appendChild(list);
    }

    /**
     * Render assets in details view
     * @param {Array} assets - Assets to render
     * @param {Set} selectedAssets - Selected asset IDs
     */
    renderDetailsView(assets, selectedAssets) {
        // Remove padding from previews container for details view
        // No padding for main interface elements
        this.previewsContainer.classList.add('p-0');

        // Create sticky header positioned at the assets panel level
        const header = document.createElement('div');
        header.className = 'asset-details-header sticky z-10 grid grid-cols-6 gap-4 p-2 bg-gray-800 text-sm font-medium border-b border-gray-700';
        header.style.top = '0px'; // Stick to top of assets panel
        header.style.minWidth = '600px'; // Minimum width for all columns
        header.innerHTML = `
            <div>Preview</div>
            <div>Name</div>
            <div>Type</div>
            <div>Category</div>
            <div>Size</div>
            <div>Properties</div>
        `;
        this.previewsContainer.appendChild(header);

        // Create scrollable content with both horizontal and vertical scroll
        const content = document.createElement('div');
        content.className = 'space-y-1 px-2 pt-2 overflow-auto'; // Remove bottom padding
        content.style.minWidth = '600px'; // Match header width
        content.style.paddingTop = 'calc(48px * max(var(--spacing-scale, 1.0), 0))'; // Leave space for sticky header (40px + 8px margin)

        // Create rows
        assets.forEach(asset => {
            const row = this.createAssetDetailsRow(asset, selectedAssets);
            content.appendChild(row);
        });

        this.previewsContainer.appendChild(content);
    }

    createAssetThumbnail(asset, selectedAssets) {
        const thumb = document.createElement('div');
        thumb.className = `asset-thumbnail cursor-pointer ${
            selectedAssets.has(asset.id) ? 'selected' : ''
        }`;
        thumb.style.width = `${this.assetSize}px`;
        thumb.style.height = `${this.assetSize}px`;
        thumb.style.borderRadius = '4px';
        thumb.style.overflow = 'hidden';
        // No transition for immediate selection feedback
        thumb.dataset.assetId = asset.id;
        thumb.draggable = true;
        
        
        if (asset.imgSrc && this.isValidImageSrc(asset.imgSrc)) {
            Logger.ui.debug(`🎨 Creating image thumbnail for ${asset.name} with imgSrc: ${asset.imgSrc.substring(0, 50)}...`);
            const img = document.createElement('img');
            img.src = asset.imgSrc;
            img.alt = asset.name;
            img.draggable = false;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onload = () => {
                Logger.ui.debug(`✅ Image loaded successfully for ${asset.name}`);
            };
            img.onerror = (error) => { 
                Logger.ui.warn(`❌ Image failed to load for ${asset.name}:`, error);
                // Fallback to colored rectangle if image fails to load
                img.style.display = 'none';
                const colorDiv = this.createColorFallback(asset);
                thumb.appendChild(colorDiv);
            };
            thumb.appendChild(img);
        } else {
            Logger.ui.debug(`🎨 Creating color fallback for ${asset.name} - imgSrc: ${asset.imgSrc}, isValid: ${this.isValidImageSrc(asset.imgSrc)}`);
            // Create colored rectangle as fallback (same as default assets)
            const colorDiv = this.createColorFallback(asset);
            thumb.appendChild(colorDiv);
        }
        
        // Add tooltip with temporary indicator if needed
        const tooltipText = asset.properties && asset.properties.isTemporary 
            ? `${asset.name} (${asset.type}) - TEMPORARY`
            : `${asset.name} (${asset.type})`;
        thumb.title = tooltipText;
        
        // Add unsaved changes indicator if needed
        if (this.shouldShowUnsavedIndicator(asset)) {
            const indicator = document.createElement('div');
            indicator.className = 'asset-unsaved-indicator';
            indicator.title = 'Unsaved changes';
            thumb.appendChild(indicator);
        }
        
        // Add asset name label for Grid View
        const nameLabel = document.createElement('div');
        nameLabel.className = 'asset-name-label';
        nameLabel.style.position = 'absolute';
        nameLabel.style.bottom = '0';
        nameLabel.style.left = '0';
        nameLabel.style.right = '0';
        nameLabel.style.background = 'rgba(0, 0, 0, 0.7)';
        // Color handled by CSS
        nameLabel.style.fontSize = '10px';
        nameLabel.style.padding = '2px 4px';
        nameLabel.style.textAlign = 'center';
        nameLabel.style.whiteSpace = 'nowrap';
        nameLabel.style.overflow = 'hidden';
        nameLabel.style.textOverflow = 'ellipsis';
        nameLabel.style.borderRadius = '0 0 4px 4px';
        
        const displayName = asset.properties && asset.properties.isTemporary 
            ? `⏳ ${asset.name}`
            : asset.name;
        nameLabel.textContent = this.truncateAssetName(displayName, this.assetSize * 0.8);
        nameLabel.title = asset.properties && asset.properties.isTemporary 
            ? `${asset.name} - TEMPORARY`
            : asset.name;
        
        thumb.appendChild(nameLabel);
        
        // Event listeners
        thumb.addEventListener('click', (e) => this.handleItemClick(e, asset));
        thumb.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e, asset));
        thumb.addEventListener('dragstart', (e) => this.handleThumbnailDragStart(e, asset));
        thumb.addEventListener('dragend', (e) => this.handleThumbnailDragEnd(e, asset));
        
        return thumb;
    }

    /**
     * Create asset list item for list view
     * @param {Object} asset - Asset data
     * @param {Set} selectedAssets - Selected asset IDs
     * @returns {HTMLElement} - List item element
     */
    createAssetListItem(asset, selectedAssets) {
        const item = document.createElement('div');
        item.className = `asset-list-item flex items-center cursor-pointer px-2 py-1 bg-gray-700 rounded ${
            selectedAssets.has(asset.id) ? 'selected' : ''
        }`;
        item.style.width = `${this.assetSize}px`;
        item.style.height = 'auto';
        item.style.minHeight = '24px';
        item.dataset.assetId = asset.id;
        item.draggable = true;
        
        // Create preview icon (small colored square or image)
        const previewDiv = document.createElement('div');
        previewDiv.style.width = '16px';
        previewDiv.style.height = '16px';
        previewDiv.style.marginRight = '8px';
        previewDiv.style.flexShrink = '0';
        previewDiv.style.borderRadius = '2px';
        previewDiv.style.overflow = 'hidden';
        
        if (asset.imgSrc && this.isValidImageSrc(asset.imgSrc)) {
            const img = document.createElement('img');
            img.src = asset.imgSrc;
            img.alt = asset.name;
            img.draggable = false;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onerror = () => { 
                // Fallback to colored rectangle if image fails to load
                img.style.display = 'none';
                previewDiv.style.backgroundColor = asset.color;
            };
            previewDiv.appendChild(img);
        } else {
            // Create colored rectangle as fallback (same as default assets)
            previewDiv.style.backgroundColor = asset.color;
        }
        
        item.appendChild(previewDiv);
        
        // Create name with truncation
        const nameDiv = document.createElement('div');
        nameDiv.className = 'flex-1 text-xs truncate text-center';
        // Color handled by CSS
        const displayName = asset.properties && asset.properties.isTemporary 
            ? `⏳ ${asset.name}`
            : asset.name;
        nameDiv.textContent = this.truncateAssetName(displayName, this.assetSize * 0.8);
        nameDiv.title = asset.properties && asset.properties.isTemporary 
            ? `${asset.name} - TEMPORARY`
            : asset.name; // Full name on hover
        
        item.appendChild(nameDiv);
        
        // Event listeners
        item.addEventListener('click', (e) => this.handleItemClick(e, asset));
        item.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e, asset));
        item.addEventListener('dragstart', (e) => this.handleThumbnailDragStart(e, asset));
        item.addEventListener('dragend', (e) => this.handleThumbnailDragEnd(e, asset));
        
        return item;
    }

    /**
     * Create asset details row for details view
     * @param {Object} asset - Asset data
     * @param {Set} selectedAssets - Selected asset IDs
     * @returns {HTMLElement} - Details row element
     */
    createAssetDetailsRow(asset, selectedAssets) {
        const row = document.createElement('div');
        row.className = `asset-details-row grid grid-cols-6 gap-4 p-2 cursor-pointer ${
            selectedAssets.has(asset.id) ? 'selected' : ''
        }`;
        row.style.minWidth = '600px'; // Match header width
        row.dataset.assetId = asset.id;
        row.draggable = true;
        
        // Preview column
        const preview = document.createElement('div');
        preview.className = 'flex items-center justify-center';
        preview.style.width = `${this.assetSize * 0.5}px`;
        preview.style.height = `${this.assetSize * 0.5}px`;
        
        if (asset.imgSrc && this.isValidImageSrc(asset.imgSrc)) {
            const img = document.createElement('img');
            img.src = asset.imgSrc;
            img.alt = asset.name;
            img.className = 'w-full h-full object-cover rounded';
            img.draggable = false;
            img.onerror = () => { 
                // Fallback to colored rectangle with text if image fails to load
                img.style.display = 'none';
                const colorDiv = this.createColorFallback(asset, {
                    text: asset.name.charAt(0).toUpperCase(),
                    className: 'w-full h-full rounded flex items-center justify-center text-xs font-bold',
                    style: { color: 'var(--ui-active-text-color, #ffffff)' }
                });
                preview.appendChild(colorDiv);
            };
            preview.appendChild(img);
        } else {
            // Create colored rectangle as fallback (same as default assets)
            const colorDiv = this.createColorFallback(asset, {
                text: asset.name.charAt(0).toUpperCase(),
                className: 'w-full h-full rounded flex items-center justify-center text-xs font-bold',
                style: { color: 'var(--ui-active-text-color, #ffffff)' }
            });
            preview.appendChild(colorDiv);
        }
        
        // Name column
        const name = document.createElement('div');
        name.className = 'text-sm truncate';
        // Color handled by CSS
        name.textContent = asset.properties && asset.properties.isTemporary 
            ? `⏳ ${asset.name}`
            : asset.name;
        name.title = asset.properties && asset.properties.isTemporary 
            ? `${asset.name} - TEMPORARY`
            : asset.name;
        
        // Type column
        const type = document.createElement('div');
        type.className = 'text-sm';
        // Color handled by CSS
        type.textContent = asset.type || 'object';
        
        // Category column
        const category = document.createElement('div');
        category.className = 'text-sm';
        // Color handled by CSS
        category.textContent = asset.category || 'Misc';
        
        // Size column
        const size = document.createElement('div');
        size.className = 'text-sm';
        // Color handled by CSS
        size.textContent = `${asset.width || 32}×${asset.height || 32}`;
        
        // Properties column - show PNG paths
        const properties = document.createElement('div');
        properties.className = 'text-sm';
        // Color handled by CSS
        
        // Show PNG paths if available
        if (asset.imageSources && asset.imageSources.length > 0) {
            const paths = asset.imageSources.map(source => source.path || source.filename).join(', ');
            properties.textContent = paths;
            properties.title = `PNG files: ${paths}`;
        } else if (asset.properties && asset.properties.sourceFile) {
            properties.textContent = asset.properties.sourceFile;
            properties.title = `PNG file: ${asset.properties.sourceFile}`;
        } else {
            properties.textContent = '—';
        }
        
        row.appendChild(preview);
        row.appendChild(name);
        row.appendChild(type);
        row.appendChild(category);
        row.appendChild(size);
        row.appendChild(properties);
        
        // Event listeners
        row.addEventListener('click', (e) => this.handleItemClick(e, asset));
        row.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e, asset));
        row.addEventListener('dragstart', (e) => this.handleThumbnailDragStart(e, asset));
        row.addEventListener('dragend', (e) => this.handleThumbnailDragEnd(e, asset));
        
        return row;
    }

    /**
     * Check if an image source is valid (exists and can be loaded)
     * @param {string} imgSrc - Image source path
     * @returns {boolean} - True if image is valid, false otherwise
     */
    isValidImageSrc(imgSrc) {
        if (!imgSrc) return false;
        
        // Check if it's a data URL (starts with data:)
        if (imgSrc.startsWith('data:')) {
            return true; // Data URLs are valid
        }
        
        // In a real implementation, this would check if the file actually exists
        
        return true;
    }

    /**
     * Create a colored fallback element for assets without images
     * @param {Object} asset - Asset data
     * @param {Object} options - Styling options
     * @param {string} options.text - Text to display (default: asset.name)
     * @param {string} options.className - CSS classes (default: '')
     * @param {Object} options.style - Inline styles (default: {})
     * @returns {HTMLElement} - Colored fallback element
     */
    createColorFallback(asset, options = {}) {
        const {
            text = asset.name,
            className = '',
            style = {}
        } = options;

        const colorDiv = document.createElement('div');
        colorDiv.className = className;
        
        // Apply default styles
        Object.assign(colorDiv.style, {
            width: '100%',
            height: '100%',
            backgroundColor: asset.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: 'var(--ui-active-text-color, #ffffff)',
            textAlign: 'center',
            borderRadius: '4px'
        });
        
        // Apply custom styles
        Object.assign(colorDiv.style, style);
        
        colorDiv.textContent = text;
        return colorDiv;
    }

    /**
     * Truncate asset name to fit available space
     * @param {string} name - Asset name
     * @param {number} maxWidth - Maximum width in pixels
     * @returns {string} - Truncated name
     */
    truncateAssetName(name, maxWidth) {
        if (name.length <= 10) return name;
        
        // Rough estimation: 8px per character
        const maxChars = Math.floor(maxWidth / 8);
        if (name.length <= maxChars) return name;
        
        const startChars = Math.floor((maxChars - 3) / 2);
        const endChars = Math.ceil((maxChars - 3) / 2);
        
        return name.substring(0, startChars) + '...' + name.substring(name.length - endChars);
    }



    // Now using BasePanel.handleItemClick with SelectionUtils

    /**
     * Handle item double click
     * @param {Event} e - Double click event
     * @param {Object} asset - Asset that was double clicked
     */
    handleItemDoubleClick(e, asset) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!asset) {
            Logger.ui.warn('Cannot handle double click: no asset provided');
            return;
        }

        // Open Actor Properties Panel
        if (this.levelEditor && this.levelEditor.showActorPropertiesPanel) {
            this.levelEditor.showActorPropertiesPanel(asset);
            Logger.ui.info(`Double-clicked asset: ${asset.name}, opening Actor Properties Panel`);
        } else {
            Logger.ui.warn('LevelEditor or showActorPropertiesPanel method not available');
        }
    }

    handleThumbnailDragStart(e, asset) {
        // Disable dragging when Ctrl/Cmd or Shift is held to allow marquee selection
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const selectedAssets = this.stateManager.get('selectedAssets');
        const draggedAssetIds = selectedAssets.has(asset.id) ? 
            Array.from(selectedAssets) : [asset.id];
        
        Logger.ui.debug('Drag start for asset:', asset.id, 'draggedAssetIds:', draggedAssetIds, 'selectedAssets:', Array.from(selectedAssets));
        
        e.dataTransfer.setData('application/json', JSON.stringify(draggedAssetIds));
        e.dataTransfer.effectAllowed = 'copy';
        
        this.stateManager.update({
            'mouse.isDraggingAsset': true
        });
    }

    handleThumbnailDragEnd(e, asset) {
        // Reset dragging flag when drag ends
        this.stateManager.update({
            'mouse.isDraggingAsset': false
        });
    }

    // Now using BasePanel marquee selection with SelectionUtils

    // Now using BasePanel marquee selection with SelectionUtils

    /**
     * Add drop target styling
     */
    addDropTarget() {
        this.container.classList.add('drop-target');
    }

    /**
     * Remove drop target styling
     */
    removeDropTarget() {
        this.container.classList.remove('drop-target');
    }


    /**
     * Get container for selection operations
     * @returns {HTMLElement|null} - The selection container
     */
    getSelectionContainer() {
        return this.previewsContainer;
    }

    /**
     * Get list of assets for selection operations
     * @returns {Array} Array of asset objects
     */
    getAssetList() {
        // Support multiple folder selection
        const folderPathsToShow = this.getActiveTabPaths();
        
        // Collect assets from all selected folders
        const allAssets = [];
        for (const folderPath of folderPathsToShow) {
            const folderAssets = this.getAssetsFromFolder(folderPath);
            allAssets.push(...folderAssets);
        }
        
        // Remove duplicates by asset ID
        return Array.from(new Map(allAssets.map(asset => [asset.id, asset])).values());
    }

    /**
     * Get selectable asset elements for marquee selection
     * @returns {Array} Array of selectable elements
     */
    getSelectableAssetElements() {
        // Search in all possible containers (grid, list, details)
        const selectors = [
            '.asset-thumbnail[data-asset-id]',  // Grid view
            '.asset-list-item[data-asset-id]',  // List view  
            '.asset-details-row[data-asset-id]' // Details view
        ];
        
        const elements = [];
        selectors.forEach(selector => {
            const found = this.previewsContainer.querySelectorAll(selector);
            elements.push(...Array.from(found));
        });
        
        Logger.ui.debug(`Found ${elements.length} selectable asset elements`);
        return elements;
    }

    /**
     * Handle wheel event for asset size zoom
     * @param {WheelEvent} e - The wheel event
     */
    handleAssetWheel(e) {
        // Check Ctrl key state from both event and state manager
        const ctrlPressed = e.ctrlKey || e.metaKey || 
                           this.levelEditor.stateManager.get('keyboard.ctrlKey') ||
                           this.levelEditor.stateManager.get('keyboard.metaKey');
        
        // Only handle if Ctrl key is pressed
        if (!ctrlPressed) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Calculate new size based on wheel direction
        const delta = e.deltaY > 0 ? -this.sizeStep : this.sizeStep;
        const newSize = Math.max(this.minAssetSize, Math.min(this.maxAssetSize, this.assetSize + delta));
        
        // Only update if size actually changed
        if (newSize !== this.assetSize) {
            this.assetSize = newSize;
            this.saveAssetSize(); // Save to user preferences
            
            // Optimized update based on view mode
            if (this.viewMode === 'grid') {
                this.updateGridViewSizes();
            } else {
                // For list and details view, we need full re-render as they have complex layouts
                this.render();
            }
            
            // Log the change
            Logger.ui.debug(`Asset size changed to ${this.assetSize}px in ${this.viewMode} view`);
        }
    }

    /**
     * Update grid view sizes without full re-render
     * This prevents flickering for imported assets
     */
    updateGridViewSizes() {
        // Update grid container
        const grid = this.previewsContainer.querySelector('div[style*="display: grid"]');
        if (grid) {
            // Recalculate grid columns
            const containerWidth = this.previewsContainer.clientWidth;
            const spacingScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing-scale')) || 1.0;
            const scaledGapSize = this.gapSize * spacingScale;
            const columns = Math.max(1, Math.floor((containerWidth + scaledGapSize) / (this.assetSize + scaledGapSize)));
            
            // Update grid template columns
            const columnWidth = this.assetSize;
            grid.style.gridTemplateColumns = `repeat(${columns}, ${columnWidth}px)`;
            
            // Update gap size
            grid.style.gap = `calc(${this.gapSize}px * max(var(--spacing-scale, 1.0), 0))`;
        }
        
        // Update all asset thumbnails
        const thumbnails = this.previewsContainer.querySelectorAll('.asset-thumbnail');
        thumbnails.forEach(thumb => {
            // Update size immediately without transitions
            thumb.style.width = `${this.assetSize}px`;
            thumb.style.height = `${this.assetSize}px`;
        });
    }

    /**
     * Update selection visuals without re-rendering entire content
     */
    updateSelectionVisuals() {
        const selectedAssets = this.stateManager.get('selectedAssets');
        
        // Update all asset elements - use CSS classes only
        const selectors = ['.asset-thumbnail', '.asset-list-item', '.asset-details-row'];
        
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                const assetId = element.dataset.assetId;
                if (assetId) {
                    if (selectedAssets.has(assetId)) {
                        element.classList.add('selected');
                    } else {
                        element.classList.remove('selected');
                    }
                }
            });
        });
    }





    /**
     * Setup context menus for assets and panel
     */
    setupContextMenus() {
        // Asset context menu
        this.assetContextMenu = new AssetContextMenu(this, {
            stateManager: this.stateManager, // Pass StateManager for marquee check
            onOpenEditor: (asset) => this.handleAssetOpenEditor(asset),
            onRename: (asset) => this.handleAssetRename(asset),
            onDuplicate: (asset) => this.handleAssetDuplicate(asset),
            onSaveAsset: (asset) => this.handleAssetSave(asset),
            onSaveAssetChanges: (asset) => this.handleAssetSaveChanges(asset),
            onShowInExplorer: (asset) => this.handleAssetShowInExplorer(asset),
            onDelete: (asset) => this.handleAssetDelete(asset),
            disableGlobalHandlers: true // Disable global handlers since we use delegated events
        });

        // Panel context menu
        this.panelContextMenu = new AssetPanelContextMenu(this, {
            stateManager: this.stateManager, // Pass StateManager for marquee check
            onResetSize: () => this.handleResetSize(),
            onToggleGrid: () => this.handleToggleGrid(),
            onToggleList: () => this.handleToggleList(),
            onToggleDetails: () => this.handleToggleDetails(),
            onRefresh: () => this.handleRefresh(),
            onSettings: () => this.handleSettings(),
            onSelectAll: () => this.handleSelectAll(),
            onDeselectAll: () => this.handleDeselectAll(),
            disableGlobalHandlers: true // Disable global handlers since we use delegated events
        });

        // Complete deferred initialization for context menus
        if (this.assetContextMenu && this.assetContextMenu.completeDeferredInit) {
            this.assetContextMenu.completeDeferredInit();
        }
        if (this.panelContextMenu && this.panelContextMenu.completeDeferredInit) {
            this.panelContextMenu.completeDeferredInit();
        }

        // Register context menus with ContextMenuManager for global resize handling
        if (this.levelEditor && this.levelEditor.contextMenuManager) {
            if (this.assetContextMenu) {
                this.levelEditor.contextMenuManager.registerMenu('asset', this.assetContextMenu);
            }
            if (this.panelContextMenu) {
                this.levelEditor.contextMenuManager.registerMenu('assetPanel', this.panelContextMenu);
            }
            // AssetTabContextMenu handles events through delegation, no global registration needed
        }
    }

    /**
     * Handle asset open editor
     * @param {Object} asset - The asset to open in editor
     */
    handleAssetOpenEditor(asset) {
        Logger.ui.debug('Opening asset editor for:', asset.name);
        // TODO: Implement asset editor functionality
    }

    /**
     * Handle asset rename
     * @param {Object} asset - The asset to rename
     */
    handleAssetRename(asset) {
        Logger.ui.debug('Renaming asset:', asset.name);
        // TODO: Implement asset rename functionality
    }

    /**
     * Handle asset duplicate
     * @param {Object} asset - The asset to duplicate
     */
    handleAssetDuplicate(asset) {
        Logger.ui.debug('Duplicating asset:', asset.name);
        // TODO: Implement asset duplicate functionality
    }

    /**
     * Get current tab folder for directory picker
     * @returns {string|null} Current tab folder or null
     */
    getCurrentTabFolder() {
        // Use getActiveTabPath() which handles both tabs and folder selection
        const folderPath = this.getActiveTabPath();
        
        // Convert folder path to category if needed (for backward compatibility)
        if (folderPath === 'root') {
            return null; // Root doesn't map to a specific category
        }
        
        // Extract category from path (e.g., 'root/maps' -> 'maps')
        const pathParts = folderPath.split('/');
        if (pathParts.length > 1) {
            return pathParts[pathParts.length - 1]; // Return last part as category
        }
        
        return folderPath;
    }

    /**
     * Check if asset should show unsaved changes indicator
     * @param {Object} asset - The asset to check
     * @returns {boolean} Whether to show the indicator
     */
    shouldShowUnsavedIndicator(asset) {
        // Show for temporary assets
        if (asset.properties && asset.properties.isTemporary) {
            return true;
        }
        
        // Show for assets with unsaved changes
        if (asset.properties && asset.properties.hasUnsavedChanges) {
            return true;
        }
        
        // Show for assets that were modified but not saved
        if (asset.properties && asset.properties.lastModified && asset.properties.lastSaved) {
            return asset.properties.lastModified > asset.properties.lastSaved;
        }
        
        return false;
    }

    /**
     * Handle save asset changes (without dialog)
     * @param {Object} asset - The asset to save changes for
     */
    async handleAssetSaveChanges(asset) {
        Logger.ui.info(`💾 Saving changes for asset: ${asset.name}`);
        
        try {
            // Check if asset has a file path (not temporary)
            if (!asset.path || asset.properties.isTemporary) {
                Logger.ui.warn('Cannot save changes for temporary asset without file path');
                this.showErrorMessage('Cannot save changes for temporary asset');
                return;
            }

            // Create JSON data for the asset
            const jsonData = {
                name: asset.name,
                type: asset.type,
                category: asset.category,
                // Support multiple image sources
                imgSrc: asset.imageSources ? asset.imageSources.map(source => source.path || source.filename) : 
                        (asset.properties.sourceFile ? [asset.properties.sourceFile] : []),
                // Legacy single image support
                image: asset.properties.sourceFile,
                color: asset.color,
                width: asset.width,
                height: asset.height,
                properties: {
                    created: asset.properties.created || new Date().toISOString(),
                    isTemporary: false,
                    wasDragDropped: asset.properties.isDragDropped || false,
                    lastSaved: Date.now()
                }
            };

            // Create filename based on asset name
            const filename = `${asset.name}.json`;
            
            // Use FileUtils to save the JSON file directly to the same location
            const { FileUtils } = await import('../utils/FileUtils.js');
            await FileUtils.saveDataDirectly(jsonData, filename, 'application/json');
            
            Logger.ui.info(`✅ Asset changes saved: ${filename}`);
            
            // Update asset properties to mark as saved
            if (asset.properties) {
                asset.properties.lastSaved = Date.now();
                asset.properties.hasUnsavedChanges = false;
            }
            
            // Update original state after successful save
            // This makes the current state the new "original" state (state 1)
            if (asset.saveOriginalState) {
                asset.saveOriginalState();
                Logger.ui.debug(`Updated original state for asset: ${asset.name}`);
            }
            
            // Refresh the display to update indicators
            this.render();
            
            // Show success message
            this.showSaveSuccessMessage(asset.name, filename);
            
        } catch (error) {
            Logger.ui.error('Failed to save asset changes:', error);
            this.showSaveErrorMessage(asset.name, error);
        }
    }

    /**
     * Handle show asset in explorer
     * @param {Object} asset - The asset to show
     */
    async handleAssetShowInExplorer(asset) {
        Logger.ui.info(`📁 Showing asset in explorer: ${asset.name}`);
        
        try {
            // Check if File System Access API is supported
            if (!('showDirectoryPicker' in window)) {
                Logger.ui.warn('File System Access API not supported for showing in explorer');
                this.showErrorMessage('File System Access API not supported in this browser');
                return;
            }

            // For temporary assets, suggest a default location
            if (asset.properties && asset.properties.isTemporary) {
                Logger.ui.info('Opening directory picker for temporary asset');
                
                // Get current tab folder for starting directory
                const currentTabFolder = this.getCurrentTabFolder();
                
                try {
                    const directoryHandle = await window.showDirectoryPicker({
                        mode: 'readwrite',
                        startIn: currentTabFolder || 'documents'
                    });
                    
                    Logger.ui.info('Directory picker opened for temporary asset');
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        Logger.ui.info('Directory picker cancelled by user');
                        return;
                    }
                    throw error;
                }
            } else {
                // For regular assets with file paths
                const assetPath = asset.path || '';
                const pathParts = assetPath.split('/');
                const directoryPath = pathParts.slice(0, -1).join('/');
                
                if (!directoryPath) {
                    Logger.ui.warn('No directory path found for asset');
                    this.showErrorMessage('No directory path found for this asset');
                    return;
                }

                // Try to open directory picker to navigate to the folder
                try {
                    const directoryHandle = await window.showDirectoryPicker({
                        mode: 'read'
                    });
                    
                    Logger.ui.info('Directory picker opened - user can navigate to asset folder');
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        Logger.ui.info('Directory picker cancelled by user');
                        return;
                    }
                    throw error;
                }
            }
            
        } catch (error) {
            Logger.ui.error('Failed to show asset in explorer:', error);
            this.showErrorMessage(`Failed to show asset in explorer: ${error.message}`);
        }
    }

    /**
     * Handle asset save
     * @param {Object} asset - The asset to save
     */
    async handleAssetSave(asset) {
        Logger.ui.info(`💾 Saving asset: ${asset.name}`);
        
        try {
            // Check if File System Access API is supported
            if (!('showDirectoryPicker' in window)) {
                Logger.ui.warn('File System Access API not supported, falling back to download');
                this.showErrorMessage('File System Access API not supported in this browser');
                return;
            }

            // Create JSON data for the asset
            const jsonData = {
                name: asset.name,
                type: asset.type,
                category: asset.category,
                // Support multiple image sources
                imgSrc: asset.properties.sourceFile ? [asset.properties.sourceFile] : [],
                // Legacy single image support
                image: asset.properties.sourceFile,
                color: asset.color,
                width: asset.width,
                height: asset.height,
                properties: {
                    created: new Date().toISOString(),
                    isTemporary: false,
                    wasDragDropped: asset.properties.isDragDropped || false
                }
            };

            // Create filename based on asset name
            const jsonFilename = `${asset.name}.json`;
            const pngFilename = `${asset.name}.png`;
            
            // Get current tab folder for starting directory
            const currentTabFolder = this.getCurrentTabFolder();
            
            // Open directory picker for saving both files with timeout protection
            const directoryHandle = await ExtensionErrorUtils.withTimeout(
                window.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: currentTabFolder || 'documents'
                }),
                10000,
                'Directory picker'
            );

            // Save JSON file
            const jsonFileHandle = await directoryHandle.getFileHandle(jsonFilename, { create: true });
            const jsonWritable = await jsonFileHandle.createWritable();
            await jsonWritable.write(JSON.stringify(jsonData, null, 2));
            await jsonWritable.close();

            // Save PNG file if asset has image data
            if (asset.imgSrc && asset.imgSrc.startsWith('data:')) {
                try {
                    // Convert data URL to blob
                    const response = await fetch(asset.imgSrc);
                    const blob = await response.blob();
                    
                    // Save PNG file
                    const pngFileHandle = await directoryHandle.getFileHandle(pngFilename, { create: true });
                    const pngWritable = await pngFileHandle.createWritable();
                    await pngWritable.write(blob);
                    await pngWritable.close();
                    
                    Logger.ui.info(`✅ PNG file saved: ${pngFilename}`);
                } catch (pngError) {
                    Logger.ui.warn('Failed to save PNG file:', pngError);
                }
            }
            
            Logger.ui.info(`✅ Asset saved as: ${jsonFilename}`);
            
            // Update asset properties to mark as saved
            if (asset.properties) {
                asset.properties.isTemporary = false;
                asset.properties.lastSaved = Date.now();
                asset.properties.hasUnsavedChanges = false;
            }
            
            // Refresh the display to update indicators
            this.render();
            
            // Show success message
            this.showSaveSuccessMessage(asset.name, jsonFilename);
            
        } catch (error) {
            await ExtensionErrorUtils.handleFileSystemError(
                error,
                () => {
                    this.showSaveErrorMessage(asset.name, new Error(ExtensionErrorUtils.getExtensionConflictMessage('Asset save')));
                    return null;
                },
                { logger: Logger.ui, operation: 'Asset save' }
            );
            
            // If not an extension error, show the original error
            if (!ExtensionErrorUtils.isExtensionError(error)) {
                Logger.ui.error('Failed to save asset:', error);
                this.showSaveErrorMessage(asset.name, error);
            }
        }
    }


    /**
     * Show save success message
     */
    showSaveSuccessMessage(assetName, filename) {
        // Create temporary success message
        const message = document.createElement('div');
        message.className = 'notification-message fixed top-4 right-4 bg-green-600 px-4 py-2 rounded-lg shadow-lg z-50';
        message.textContent = `✅ Asset "${assetName}" saved as ${filename}`;
        
        document.body.appendChild(message);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
    }

    /**
     * Show save error message
     */
    showSaveErrorMessage(assetName, error) {
        // Create temporary error message
        const message = document.createElement('div');
        message.className = 'notification-message fixed top-4 right-4 bg-red-600 px-4 py-2 rounded-lg shadow-lg z-50';
        message.textContent = `❌ Failed to save asset "${assetName}": ${error.message}`;
        
        document.body.appendChild(message);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 5000);
    }

    /**
     * Show general error message
     */
    showErrorMessage(message) {
        // Create temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'notification-message fixed top-4 right-4 bg-red-600 px-4 py-2 rounded-lg shadow-lg z-50';
        errorDiv.textContent = `❌ ${message}`;
        
        document.body.appendChild(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    /**
     * Handle asset delete
     * @param {Object} asset - The asset to delete
     */
    handleAssetDelete(asset) {
        Logger.ui.debug('Deleting asset:', asset.name);
        // TODO: Implement asset delete functionality
    }

    /**
     * Handle reset asset size
     */
    handleResetSize() {
        Logger.ui.debug('Resetting asset size');
        this.assetSize = 96;
        this.render();
    }

    /**
     * Handle toggle grid view
     */
    handleToggleGrid() {
        Logger.ui.debug('Switching to grid view');
        this.viewMode = 'grid';
        this.saveViewMode();
        this.render();
        // Auto-resize panel height after view mode change
        setTimeout(() => this.autoResizePanelHeight(), 100);
    }

    /**
     * Handle toggle list view
     */
    handleToggleList() {
        Logger.ui.debug('Switching to list view');
        this.viewMode = 'list';
        this.saveViewMode();
        this.render();
        // Auto-resize panel height after view mode change
        setTimeout(() => this.autoResizePanelHeight(), 100);
    }

    /**
     * Handle toggle details view
     */
    handleToggleDetails() {
        Logger.ui.debug('Switching to details view');
        this.viewMode = 'details';
        this.saveViewMode();
        this.render();
        // Auto-resize panel height after view mode change
        setTimeout(() => this.autoResizePanelHeight(), 100);
    }

    /**
     * Handle refresh assets
     */
    handleRefresh() {
        Logger.ui.debug('Refreshing assets');
        this.render();
    }

    /**
     * Handle panel settings
     */
    handleSettings() {
        Logger.ui.debug('Opening panel settings');
        // TODO: Implement panel settings
    }

    /**
     * Setup drag-n-drop functionality for PNG files
     */
    setupDragAndDrop() {
        if (!this.container || !this.previewsContainer) {
            Logger.ui.warn('AssetPanel: Container or previewsContainer not available for drag-and-drop setup');
            return;
        }
        
        const dropZone = this.container;
        
        // Create drop overlay element - positioned relative to content container
        this.dropOverlay = document.createElement('div');
        this.dropOverlay.className = 'drop-overlay';
        
        // Create text container with background
        const textContainer = document.createElement('div');
        textContainer.className = 'drop-overlay-text';
        textContainer.textContent = 'Drop PNG image(s) to Import as Assets';
        this.dropOverlay.appendChild(textContainer);
        
        // Position overlay relative to main container but size it to match previews container
        this.container.style.position = 'relative';

        // Size overlay to match previews container dimensions and position
        if (this.previewsContainer) {
            const updateOverlaySize = () => {
                this.updateOverlayPosition();
            };

            // Initial sizing
            updateOverlaySize();

            // Update size on window resize or container changes
            const resizeObserver = new ResizeObserver(updateOverlaySize);
            resizeObserver.observe(this.previewsContainer);
            resizeObserver.observe(this.container);

            // Store reference for cleanup
            this.dropOverlayResizeObserver = resizeObserver;
        }

        this.container.appendChild(this.dropOverlay);
        
        // Bind methods to preserve context
        this.boundHandleDragEnter = this.handleDragEnter.bind(this);
        this.boundHandleDragOver = this.handleDragOver.bind(this);
        this.boundHandleDragLeave = this.handleDragLeave.bind(this);
        this.boundHandleDrop = this.handleDrop.bind(this);
        
        // Setup drag-n-drop handlers on container
        // Use capture phase to ensure we catch events before other handlers
        dropZone.addEventListener('dragenter', this.boundHandleDragEnter, true);
        dropZone.addEventListener('dragover', this.boundHandleDragOver, true);
        dropZone.addEventListener('dragleave', this.boundHandleDragLeave, true);
        dropZone.addEventListener('drop', this.boundHandleDrop, true);
    }

    /**
     * Check if assets can be dropped to the currently active folder
     * @returns {boolean} True if dropping is allowed, false otherwise
     */
    canDropToActiveFolder() {
        const activeTabPath = this.getActiveTabPath();
        
        // Cannot drop to root folder
        return activeTabPath !== 'root';
    }

    /**
     * Check if drag event is for external files
     * @param {DragEvent} e - Drag event
     * @returns {boolean} True if external files
     */
    isExternalFilesDrag(e) {
        return e.dataTransfer.types.includes('Files');
    }

    /**
     * Check if drag coordinates are over tabs container
     * @param {DragEvent} e - Drag event
     * @returns {boolean} True if over tabs container
     */
    isOverTabsContainer(e) {
        if (!this.tabsContainer) return false;
        const tabsRect = this.tabsContainer.getBoundingClientRect();
        return e.clientX >= tabsRect.left && e.clientX <= tabsRect.right &&
               e.clientY >= tabsRect.top && e.clientY <= tabsRect.bottom;
    }

    /**
     * Check if drag coordinates are over previews container
     * @param {DragEvent} e - Drag event
     * @returns {boolean} True if over previews container
     */
    isOverPreviewsContainer(e) {
        if (!this.previewsContainer) return false;
            const rect = this.previewsContainer.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    }

    /**
     * Update overlay position and size to match previewsContainer
     * This is a shared method used by both ResizeObserver and updateDropOverlayStyle
     * Note: Does not change display property - overlay visibility is controlled elsewhere
     */
    updateOverlayPosition() {
        if (!this.dropOverlay || !this.previewsContainer) return;
        
        const rect = this.previewsContainer.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        this.dropOverlay.style.position = 'absolute';
        this.dropOverlay.style.top = `${rect.top - containerRect.top}px`;
        this.dropOverlay.style.left = `${rect.left - containerRect.left}px`;
        this.dropOverlay.style.width = `${rect.width}px`;
        this.dropOverlay.style.height = `${rect.height}px`;
        this.dropOverlay.style.zIndex = '9999';
        this.dropOverlay.style.pointerEvents = 'none';
    }

    /**
     * Update drop overlay style based on whether dropping is allowed
     * @param {boolean} allowed - Whether dropping is allowed
     */
    updateDropOverlayStyle(allowed) {
        if (!this.dropOverlay) return;
        
        const textContainer = this.dropOverlay.querySelector('.drop-overlay-text');
        if (!textContainer) return;
        
        // Update overlay position and size to match previewsContainer
        this.updateOverlayPosition();
        
        // Remove previous state classes
        this.dropOverlay.classList.remove('drop-overlay-allowed', 'drop-overlay-disallowed');
        textContainer.classList.remove('drop-overlay-text-allowed', 'drop-overlay-text-disallowed');
        
        // Show overlay when updating style
        this.dropOverlay.classList.add('drop-overlay-visible');
        
        if (allowed) {
            // Normal style: blue
            this.dropOverlay.classList.add('drop-overlay-allowed');
            textContainer.classList.add('drop-overlay-text-allowed');
            textContainer.textContent = 'Drop PNG image(s) to Import as Assets';
        } else {
            // Error style: red
            this.dropOverlay.classList.add('drop-overlay-disallowed');
            textContainer.classList.add('drop-overlay-text-disallowed');
            textContainer.textContent = 'Can not create assets in this location';
        }
    }

    handleDragEnter(e) {
        // Only handle external file drops
        if (!this.isExternalFilesDrag(e)) {
            return;
        }
        
        // Skip if over tabs container
        if (this.isOverTabsContainer(e)) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Show overlay if over previews container
        if (this.isOverPreviewsContainer(e) && this.dropOverlay) {
            const canDrop = this.canDropToActiveFolder();
            this.updateDropOverlayStyle(canDrop);
        }
    }

    handleDragOver(e) {
        // Only handle external file drops
        if (!this.isExternalFilesDrag(e)) {
            return;
        }
        
        // Skip if over tabs container
        if (this.isOverTabsContainer(e)) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Update overlay if over previews container
        if (this.isOverPreviewsContainer(e)) {
            if (this.dropOverlay) {
                const canDrop = this.canDropToActiveFolder();
                this.updateDropOverlayStyle(canDrop);
            }
        } else if (this.dropOverlay) {
            // Hide overlay if outside previews container
            this.dropOverlay.classList.remove('drop-overlay-visible');
        }
    }

    handleDragLeave(e) {
        // Only handle external file drops
        if (!this.isExternalFilesDrag(e)) {
            return;
        }
        
        // Hide overlay if leaving previews container
        if (!this.isOverPreviewsContainer(e) && this.dropOverlay) {
            this.dropOverlay.classList.remove('drop-overlay-visible');
        }
    }

    /**
     * Handle dropped files
     * @param {DragEvent} e - Drop event
     */
    async handleDrop(e) {
        // Only handle external file drops
        if (!this.isExternalFilesDrag(e) || !e.dataTransfer.files.length) {
            return;
        }
        
        // Skip if over tabs container
        if (this.isOverTabsContainer(e)) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Check if we can drop to the active folder
        if (!this.canDropToActiveFolder()) {
            if (this.dropOverlay) {
                this.dropOverlay.classList.remove('drop-overlay-visible');
            }
            return;
        }
        
        // Hide overlay immediately after drop
        if (this.dropOverlay) {
            this.dropOverlay.classList.remove('drop-overlay-visible');
        }
        
        const dt = e.dataTransfer;
        const files = dt.files;

        Logger.ui.info(`📁 Files dropped: ${files.length}`);

        // Filter for PNG files only
        const pngFiles = Array.from(files).filter(file => 
            file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
        );

        if (pngFiles.length === 0) {
            Logger.ui.warn('⚠️ No PNG files found in dropped files');
            return;
        }

        Logger.ui.info(`🖼️ Processing ${pngFiles.length} PNG files`);

        // Get active tab path and extract category
        const activeTabPath = this.getActiveTabPath();
        
        // Convert folder path to category for asset creation
        // Extract category from folder path (e.g., 'root/assets/characters' -> 'characters')
        let category = 'objects'; // Default category
        if (activeTabPath !== 'root') {
            const pathParts = activeTabPath.split('/').filter(p => p && p !== 'root');
            if (pathParts.length > 0) {
                // Get last part of path as category
                category = pathParts[pathParts.length - 1];
            }
        }

        Logger.ui.info(`📂 Adding assets to folder: ${activeTabPath}, category: ${category}`);

        // Create temporary assets for each PNG file
        for (const pngFile of pngFiles) {
            try {
                await this.createTemporaryAssetFromFile(pngFile, category, activeTabPath);
            } catch (error) {
                Logger.ui.error(`❌ Failed to create asset from ${pngFile.name}:`, error);
            }
        }

        // Ensure folder structure is updated before rendering
        if (this.foldersPanel) {
            this.foldersPanel.refresh();
        }

        // Refresh the panel
        this.render();
    }

    /**
     * Create temporary asset from PNG file
     * @param {File} pngFile - PNG file
     * @param {string} category - Asset category
     * @param {string} folderPath - Folder path where asset should be created
     */
    async createTemporaryAssetFromFile(pngFile, category, folderPath = 'root') {
        Logger.ui.info(`🎨 Creating temporary asset from: ${pngFile.name}, category: ${category}, folder: ${folderPath}`);

        try {
            // Create data URL for image
            const { FileUtils } = await import('../utils/FileUtils.js');
            const imgSrc = await FileUtils.createDataURL(pngFile);

            // Get image dimensions
            const dimensions = await this.getImageDimensions(imgSrc);

            // Create asset data
            const assetId = `temp_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Build asset path based on folder path
            let assetPath = folderPath === 'root' 
                ? `${category}/${pngFile.name}`
                : `${folderPath}/${pngFile.name}`;
            
            const assetData = {
                id: assetId,
                name: pngFile.name.replace(/\.[^/.]+$/, ""), // Remove extension
                type: this.getAssetTypeFromCategory(category),
                category: category,
                path: assetPath,
                width: dimensions.width,
                height: dimensions.height,
                color: this.getDefaultColor(category),
                imgSrc: imgSrc,
                properties: {
                    sourceFile: pngFile.name,
                    fileSize: pngFile.size,
                    lastModified: Date.now(),
                    isTemporary: true,
                    isDragDropped: true
                },
                tags: [category, 'imported', 'temporary', 'drag-dropped']
            };

            // Add to asset manager
            this.assetManager.addExternalAsset(assetData);
            Logger.ui.info(`✅ Temporary asset created: ${assetData.name}`);

        } catch (error) {
            Logger.ui.error(`❌ Failed to create temporary asset:`, error);
            throw error;
        }
    }

    /**
     * Get image dimensions from data URL
     * @param {string} dataUrl - Image data URL
     * @returns {Promise<{width: number, height: number}>} Image dimensions
     */
    getImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = dataUrl;
        });
    }

    /**
     * Get asset type from category
     * @param {string} category - Category name
     * @returns {string} Asset type
     */
    getAssetTypeFromCategory(category) {
        const typeMap = {
            'backgrounds': 'background',
            'characters': 'character',
            'collectibles': 'collectible',
            'enemies': 'enemy',
            'environment': 'environment',
            'objects': 'object'
        };
        return typeMap[category] || 'object';
    }

    /**
     * Get default color for category
     * @param {string} category - Category name
     * @returns {string} Color hex
     */
    getDefaultColor(category) {
        const colorMap = {
            'backgrounds': '#87CEEB',
            'characters': '#FF6B6B',
            'collectibles': '#F1C40F',
            'enemies': '#E74C3C',
            'environment': '#2ECC71',
            'objects': '#95A5A6'
        };
        return colorMap[category] || '#CCCCCC';
    }

    /**
     * Handle select all assets
     */
    handleSelectAll() {
        Logger.ui.debug('Selecting all assets');
        
        // Get assets from currently active folder(s)
        const folderPaths = this.getActiveTabPaths();
        const allAssets = [];
        
        for (const folderPath of folderPaths) {
            const folderAssets = this.getAssetsFromFolder(folderPath);
            allAssets.push(...folderAssets);
        }
        
        // Remove duplicates by asset ID
        const uniqueAssets = Array.from(new Map(allAssets.map(asset => [asset.id, asset])).values());
        const allAssetIds = new Set(uniqueAssets.map(asset => asset.id));
        
        this.stateManager.set('selectedAssets', allAssetIds);
    }

    /**
     * Handle deselect all assets
     */
    handleDeselectAll() {
        Logger.ui.debug('Deselecting all assets');
        this.stateManager.set('selectedAssets', new Set());
        // Force immediate visual update after deselect
        this.updateSelectionVisuals();
    }


    /**
     * Clean up event listeners
     */
    destroy() {
        // Remove event handlers using new system
        eventHandlerManager.unregisterContainer(this.container);
        eventHandlerManager.unregisterContainer(this.previewsContainer);
        
        // Remove wheel handlers from EventHandlerManager
        eventHandlerManager.unregisterElement(this.container);
        
        // Clean up global event handlers using GlobalEventRegistry
        globalEventRegistry.unregisterComponentHandlers('asset-panel');
        globalEventRegistry.unregisterComponentHandlers('asset-panel-folders');
        

        // Clean up ResizeObserver for drop overlay
        if (this.dropOverlayResizeObserver) {
            this.dropOverlayResizeObserver.disconnect();
        }

        // Clean up ResizeObserver for container
        if (this.containerResizeObserver) {
            this.containerResizeObserver.disconnect();
        }


        // Clean up context menus
        if (this.assetContextMenu) {
            this.assetContextMenu.destroy();
        }
        if (this.panelContextMenu) {
            this.panelContextMenu.destroy();
        }
        if (this.tabsManager) {
            this.tabsManager.destroy();
        }

        // Unregister search from SearchManager
        searchManager.unregisterSearch('assets');
    }

    /**
     * Auto-resize panel height based on content
     */
    autoResizePanelHeight() {
        const assetsPanel = document.getElementById('assets-panel');
        if (!assetsPanel) return;

        const activeTab = this.getActiveTab();
        if (!activeTab) return;

        const assets = this.assetManager.getAssetsByCategory(activeTab);
        if (!assets || assets.length === 0) {
            // If no assets, use default height
            assetsPanel.style.height = '256px';
            return;
        }

        // Calculate height based on view mode and number of assets
        let calculatedHeight;
        
        if (this.viewMode === 'grid') {
            // Grid mode: calculate rows needed
            const containerWidth = this.previewsContainer.offsetWidth;
            const thumbSize = this.assetSize + 8; // size + gap
            const colsPerRow = Math.floor(containerWidth / thumbSize);
            const rows = Math.ceil(assets.length / colsPerRow);
            calculatedHeight = Math.max(256, rows * thumbSize + 100); // 100px for tabs and padding
        } else if (this.viewMode === 'list') {
            // List mode: calculate based on item height
            const itemHeight = 40; // Approximate height per item
            calculatedHeight = Math.max(256, assets.length * itemHeight + 100);
        } else if (this.viewMode === 'details') {
            // Details mode: calculate based on table rows
            const rowHeight = 32; // Approximate height per row
            calculatedHeight = Math.max(256, assets.length * rowHeight + 120); // 120px for header and padding
        } else {
            calculatedHeight = 256; // Default fallback
        }

        // Apply calculated height
        const maxHeight = window.innerHeight * 0.6; // Max 60% of window height
        const finalHeight = Math.min(calculatedHeight, maxHeight);
        
        assetsPanel.style.height = `${finalHeight}px`;
        assetsPanel.style.flexShrink = '0';
        
        // Save the new height to user preferences
        if (this.stateManager) {
            this.stateManager.set('panels.assetsPanelHeight', finalHeight);
        }
    }

    /**
     * Get active tab name
     */
    getActiveTab() {
        const activeTab = this.container.querySelector('.asset-tab.active');
        return activeTab ? activeTab.dataset.category : null;
    }

    /**
     * Setup asset panel handlers using new event system
     */
    setupAssetPanelHandlers() {
        // Check if handlers are already registered
        if (this._assetPanelHandlersSetup) {
            return;
        }
        
        // Create asset panel handlers configuration
        // Note: Tab clicks and context menu are handled by AssetTabsManager
        const assetHandlers = EventHandlerUtils.createPanelHandlers(
            (e) => {
                // Handle asset clicks (tabs are handled by AssetTabsManager)
                const assetElement = e.target.closest('.asset-thumbnail, .asset-list-item, .asset-details-row, [data-asset-id]');
                if (assetElement) {
                    const assetId = assetElement.dataset.assetId;
                    if (assetId) {
                        this.handleAssetClick(e, assetId);
                    }
                    return;
                }
            },
            (e) => {
                // Handle button clicks
                if (e.target.classList.contains('view-mode-btn')) {
                    const mode = e.target.dataset.mode;
                    this.setViewMode(mode);
                    return;
                }
                
                if (e.target.classList.contains('size-btn')) {
                    const action = e.target.dataset.action;
                    if (action === 'increase') {
                        this.increaseAssetSize();
                    } else if (action === 'decrease') {
                        this.decreaseAssetSize();
                    }
                    return;
                }
            },
            null, // onInputChange - not used
            null // Context menu handled by AssetTabsManager
        );

        // Register container with new event manager
        // Note: tabsContainer handlers are managed by AssetTabsManager
        // Register on previewsContainer instead for asset-specific handlers
        if (this.previewsContainer) {
            eventHandlerManager.registerContainer(this.previewsContainer, assetHandlers);
        }
        
        // Mark handlers as setup
        this._assetPanelHandlersSetup = true;

        // Register wheel handlers for asset size zoom directly on the container
        const assetWheelHandlers = {
            wheel: (e) => {
                // Check Ctrl key state from both event and state manager
                const ctrlPressed = e.ctrlKey || e.metaKey || 
                                   this.levelEditor.stateManager.get('keyboard.ctrlKey') ||
                                   this.levelEditor.stateManager.get('keyboard.metaKey');
                
                if (ctrlPressed) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleAssetWheel(e);
                }
            }
        };

        // Register wheel handler directly on the asset panel container to prevent bubbling
        eventHandlerManager.registerElement(this.container, assetWheelHandlers, 'asset-panel-wheel');

        // Setup drag and drop
        this.setupDragAndDrop();

        Logger.ui.debug('AssetPanel: New event handlers setup complete');
    }

    /**
     * Handle asset click events
     * @param {Event} e - Click event
     * @param {string} assetId - Asset ID
     */
    handleAssetClick(e, assetId) {
        // Handle double click for asset properties
        if (e.detail === 2) {
                const asset = this.assetManager.getAssetById(assetId);
                if (asset && this.levelEditor && this.levelEditor.showActorPropertiesPanel) {
                    this.levelEditor.showActorPropertiesPanel(asset);
                }
        }
    }

    setupAssetEvents() {
        // Asset events are now handled by setupAssetPanelHandlers
        // This method is kept for compatibility but functionality moved to new system
        Logger.ui.debug('AssetPanel: Asset events handled by new event system');
    }


}
