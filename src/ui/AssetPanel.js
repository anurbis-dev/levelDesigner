import { BasePanel } from './BasePanel.js';
import { Logger } from '../utils/Logger.js';
import { ExtensionErrorUtils } from '../utils/ExtensionErrorUtils.js';
import { AssetViewRenderer } from './AssetViewRenderer.js';
import { AssetFoldersController } from './AssetFoldersController.js';
import { AssetFilterController } from './AssetFilterController.js';
import { AssetSelectionController } from './AssetSelectionController.js';
import { AssetDragDropController } from './AssetDragDropController.js';
import { AssetItemActionsController } from './AssetItemActionsController.js';
import { AssetToolbarController } from './AssetToolbarController.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { globalEventRegistry } from '../event-system/GlobalEventRegistry.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { searchManager } from '../utils/SearchManager.js';
import { PanelSizeCalculator } from '../utils/PanelSizeCalculator.js';

/**
 * Asset panel UI component
 */
export class AssetPanel extends BasePanel {
    /**
     * @param {HTMLElement} container
     * @param {object} assetManager
     * @param {object} stateManager
     * @param {object} levelEditor
     * @param {{ instanceKey?: string, isPrimary?: boolean }} [options]
     */
    constructor(container, assetManager, stateManager, levelEditor, options = {}) {
        super(container, stateManager);
        this.instanceKey = options.instanceKey || null;
        this.isPrimary = options.isPrimary !== false && !this.instanceKey;
        this.searchPanelId = this.instanceKey ? `assets-${this.instanceKey}` : 'assets';
        this.searchInputId = this.instanceKey ? `assets-search-${this.instanceKey}` : 'assets-search';
        this.eventComponentId = this.instanceKey ? `asset-panel-${this.instanceKey}` : 'asset-panel';
        this.assetManager = assetManager;
        this.levelEditor = levelEditor;
        this.tabsContainer = null;
        this.previewsContainer = null;
        this.foldersContainer = null;
        this.foldersPanel = null;
        this.foldersPosition = 'left'; // 'left' or 'right'
        this.tabsManager = null; // AssetTabsManager instance
        this.viewRenderer = new AssetViewRenderer(this);
        this.foldersController = new AssetFoldersController(this);
        this.filterController = new AssetFilterController(this);
        this.selectionController = new AssetSelectionController(this);
        this.dragDropController = new AssetDragDropController(this);
        this.itemActionsController = new AssetItemActionsController(this);
        this.toolbarController = new AssetToolbarController(this);
        
        this._assetPanelHandlersSetup = false; // Flag to track panel handlers setup
        this.subscriptions = []; // StateManager unsubscribe functions — called in destroy()

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
        this.itemActionsController.setupContextMenus();
        
        // Initial render to create tabs
        this.render();

        // Register search in universal search manager
        searchManager.registerSearch(
            this.searchPanelId,
            this.searchInputId,
            (searchTerm) => {
                this.searchTerm = searchTerm;
                this.viewRenderer.renderPreviews(); // Only re-render previews, not entire panel
            },
            () => {
                // Clear callback - could be used for additional cleanup
            }
        );

        // Initialize asset tab context menu - now handled by AssetTabsManager
        // this.assetTabContextMenu removed - handled by tabsManager
    }

    init() {
        // Primary: fixed ids from index.html; copies: data-asset-role from DockPanelFactory
        this.tabsContainer = this.container.querySelector('[data-asset-role="tabs"]')
            || this.container.querySelector('#asset-tabs-container');
        this.previewsContainer = this.container.querySelector('[data-asset-role="previews"]')
            || this.container.querySelector('#asset-previews-container');
        if (!this.tabsContainer || !this.previewsContainer) {
            Logger.ui.error('AssetPanel: missing tabs/previews containers');
            return;
        }

        // Create folders container
        this.foldersController.createFoldersContainer();

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
        this.assetSize = this.toolbarController.loadAssetSize();

        // Load view mode from user preferences
        this.viewMode = this.toolbarController.loadViewMode();

        // Load folders position from user preferences
        this.foldersPosition = this.foldersController.loadFoldersPosition();

        // Initialize FoldersPanel
        this.foldersController.initializeFoldersPanel();

        // Initialize activeAssetTabs from config (now folder paths)
        this.initializeActiveAssetTabs();

        // Initialize AssetTabsManager
        this.foldersController.initializeTabsManager();

        // Event handlers will be set up by EventHandlerManager

        // Setup folders and listeners
        this.setupFoldersAndListeners();

        // Update layout based on folders position
        this.foldersController.updateFoldersLayout();
    }


    /**
     * Setup folders resizer and asset change listeners
     */
    setupFoldersAndListeners() {
        // Setup folders resizer
        this.foldersController.setupFoldersResizer();

        // Listen for asset changes to refresh panels
        this.subscriptions.push(this.stateManager.subscribe('assetsChanged', () => {
            if (this.foldersPanel) {
                this.foldersPanel.refresh();
            }
            // Also refresh the asset panel itself
            this.render();
        }));

        // Listen for folder selection changes to sync active tab
        // Sync happens BEFORE render to avoid recursion
        this.subscriptions.push(this.stateManager.subscribe('selectedFolders', (selectedFolders) => {
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
            this.viewRenderer.renderPreviews();
        }));
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
     * Get currently active tab folder paths (delegate — used by AssetViewRenderer)
     * @returns {Array<string>} Array of folder paths
     */
    getActiveTabPaths() {
        return this.foldersController.getActiveTabPaths();
    }

    /**
     * Active folder path for Add menu / createAssetOfType (not root Content).
     * @returns {string}
     */
    getActiveTabPath() {
        return this.foldersController.getActiveTabPath();
    }

    /**
     * Get all assets from folder recursively (delegate — used by AssetViewRenderer)
     * @param {string} folderPath - Folder path (e.g., 'root' or 'root/assets/characters')
     * @returns {Array} Array of asset objects
     */
    getAssetsFromFolder(folderPath) {
        return this.foldersController.getAssetsFromFolder(folderPath);
    }

    /**
     * Save folders position to user preferences
     */
    saveFoldersPosition() {
        this.foldersController.saveFoldersPosition();
    }

    /**
     * Update folders layout based on position
     */
    updateFoldersLayout() {
        this.foldersController.updateFoldersLayout();
    }

    /**
     * Select specific asset (delegate — used by FoldersPanel)
     */
    selectAsset(assetId) {
        this.selectionController.selectAsset(assetId);
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

        if (this.foldersResizer) {
            this.levelEditor.resizerManager.setCollapsed(this.foldersResizer, foldersWidth <= 0);
        }
    }

    setupEventListeners() {
        // Setup selection functionality for assets
        this.setupSelection({
            selectionKey: 'selectedAssets',
            anchorKey: 'assets.shiftAnchor',
            getItemList: () => this.selectionController.getAssetList(),
            getSelectableItems: () => this.selectionController.getSelectableAssetElements(),
            onSelectionChange: () => this.selectionController.updateSelectionVisuals(),
            canSelect: (asset) => true, // All assets can be selected
            itemSelector: '.asset-thumbnail, .asset-list-item, .asset-details-row, [data-asset-id]',
            selectedClass: 'selected',
            enableMarquee: true,
            mouseStateKey: 'mouse.isAssetMarqueeSelecting',
            marqueeId: 'asset-marquee-selection'
        });

        // Subscribe to state changes
        this.subscriptions.push(this.stateManager.subscribe('activeAssetTabs', () => {
            Logger.ui.debug('AssetPanel: activeAssetTabs changed - render will be called');
            this.render();
        }));

        // Subscribe to active tab changes to update content
        this.subscriptions.push(this.stateManager.subscribe('activeAssetTab', () => {
            Logger.ui.debug('AssetPanel: activeAssetTab changed - updating previews');
            this.viewRenderer.renderPreviews();
        }));
        
        // Event handlers will be setup in render() after elements are created
        
        // Window resize handler for real-time grid recalculation
        // Register window resize handler with GlobalEventRegistry
        const windowResizeHandlers = {
            resize: () => {
                Logger.ui.debug('AssetPanel: Window resize detected');
                // Update asset placement in real-time without debounce
                if (this.viewMode === 'grid') {
                    // Update grid layout immediately for real-time responsiveness
                    this.viewRenderer.updateGridViewSizes();
                } else {
                    // For list and details view, just update selection visuals
                    this.selectionController.updateSelectionVisuals();
                }
            }
        };

        globalEventRegistry.registerComponentHandlers(
            this.eventComponentId || 'asset-panel',
            windowResizeHandlers,
            'window'
        );

        // ResizeObserver for asset panel container to handle all internal resizes (folders, other panels, etc.)
        // Track previous size to avoid unnecessary updates and prevent loops
        this.lastContainerWidth = 0;
        this.containerResizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            
            const { width } = entry.contentRect;
            // Only update if width actually changed significantly (avoid loops from content changes)
            if (Math.abs(width - this.lastContainerWidth) > 1) {
                this.lastContainerWidth = width;
                // Use requestAnimationFrame to defer DOM changes and prevent ResizeObserver loop
                requestAnimationFrame(() => {
                    if (this.viewMode === 'grid') {
                        this.viewRenderer.updateGridViewSizes();
                    }
                });
            }
        });
        this.containerResizeObserver.observe(this.previewsContainer);


        this.setupAssetEvents();
        
        // Setup asset panel handlers (must be called after previewsContainer is available)
        this.setupAssetPanelHandlers();
    }

    render() {
        this.viewRenderer.render();
    }

    /**
     * Render asset search and filter controls in the tabs footer (delegate — used by AssetViewRenderer)
     */
    renderAssetSearchControls() {
        this.filterController.renderAssetSearchControls();
    }

    /**
     * Filter assets by search term and active type filters (delegate — used by AssetViewRenderer)
     */
    filterAssets(assets) {
        return this.filterController.filterAssets(assets);
    }

    // Now using BasePanel.handleItemClick with SelectionUtils

    /**
     * Handle item double click (delegate — used by AssetViewRenderer)
     * @param {Event} e - Double click event
     * @param {Object} asset - Asset that was double clicked
     */
    handleItemDoubleClick(e, asset) {
        this.itemActionsController.handleItemDoubleClick(e, asset);
    }

    /**
     * Handle thumbnail drag start (delegate — used by AssetViewRenderer)
     */
    handleThumbnailDragStart(e, asset) {
        this.dragDropController.handleThumbnailDragStart(e, asset);
    }

    /**
     * Handle thumbnail drag end (delegate — used by AssetViewRenderer)
     */
    handleThumbnailDragEnd(e, asset) {
        this.dragDropController.handleThumbnailDragEnd(e, asset);
    }

    // Now using BasePanel marquee selection with SelectionUtils

    // Now using BasePanel marquee selection with SelectionUtils


    /**
     * Get container for selection operations (delegate — BasePanel polymorphic override)
     * @returns {HTMLElement|null} - The selection container
     */
    getSelectionContainer() {
        return this.selectionController.getSelectionContainer();
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
            this.toolbarController.saveAssetSize(); // Save to user preferences
            
            // Optimized update based on view mode
            if (this.viewMode === 'grid') {
                this.viewRenderer.updateGridViewSizes();
            } else {
                // For list and details view, we need full re-render as they have complex layouts
                this.render();
            }
            
            // Log the change
            Logger.ui.debug(`Asset size changed to ${this.assetSize}px in ${this.viewMode} view`);
        }
    }

    /**
     * Update selection visuals without re-rendering entire content (delegate — BasePanel polymorphic override)
     */
    updateSelectionVisuals() {
        this.selectionController.updateSelectionVisuals();
    }






    /**
     * Check if asset should show unsaved changes indicator
     * @param {Object} asset - The asset to check
     * @returns {boolean} Whether to show the indicator
     */
    shouldShowUnsavedIndicator(asset) {
        if (!asset) return false;
        
        // Show for temporary assets
        if (asset.properties && asset.properties.isTemporary) {
            return true;
        }
        
        // Show for assets with unsaved changes
        if (asset.properties && asset.properties.hasUnsavedChanges === true) {
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
                const currentTabFolder = this.foldersController.getCurrentTabFolder();
                
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
            const currentTabFolder = this.foldersController.getCurrentTabFolder();
            
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
     * Handle reset asset size (delegate — used by AssetItemActionsController)
     */
    handleResetSize() {
        this.toolbarController.handleResetSize();
    }

    /**
     * Handle toggle grid view (delegate — used by AssetItemActionsController)
     */
    handleToggleGrid() {
        this.toolbarController.handleToggleGrid();
    }

    /**
     * Handle toggle list view (delegate — used by AssetItemActionsController)
     */
    handleToggleList() {
        this.toolbarController.handleToggleList();
    }

    /**
     * Handle toggle details view (delegate — used by AssetItemActionsController)
     */
    handleToggleDetails() {
        this.toolbarController.handleToggleDetails();
    }

    /**
     * Handle refresh assets (delegate — used by AssetItemActionsController)
     */
    handleRefresh() {
        this.toolbarController.handleRefresh();
    }

    /**
     * Handle panel settings (delegate — used by AssetItemActionsController)
     */
    handleSettings() {
        this.toolbarController.handleSettings();
    }

    /**
     * Setup drag-n-drop functionality for PNG files (delegate — internal setupEventListeners caller)
     */
    setupDragAndDrop() {
        this.dragDropController.setupDragAndDrop();
    }

    /**
     * Handle dropped files
     * @param {DragEvent} e - Drop event
     */
    async handleDrop(e) {
        // Only handle external file drops
        if (!this.dragDropController.isExternalFilesDrag(e) || !e.dataTransfer.files.length) {
            return;
        }

        // Skip if over tabs container
        if (this.dragDropController.isOverTabsContainer(e)) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Check if we can drop to the active folder
        if (!this.dragDropController.canDropToActiveFolder()) {
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
            Logger.status.warn('No PNG files found in dropped files');
            return;
        }

        Logger.ui.info(`🖼️ Processing ${pngFiles.length} PNG files`);

        // Get active tab path and extract category
        const activeTabPath = this.foldersController.getActiveTabPath();
        
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
                Logger.status.error(`Failed to create asset from ${pngFile.name}: ${error.message}`);
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
            const dimensions = await this.viewRenderer.getImageDimensions(imgSrc);

            // Create asset data
            const assetId = `temp_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Build asset path based on folder path
            let assetPath = folderPath === 'root' 
                ? `${category}/${pngFile.name}`
                : `${folderPath}/${pngFile.name}`;
            
            const assetData = {
                id: assetId,
                name: pngFile.name.replace(/\.[^/.]+$/, ""), // Remove extension
                type: this.viewRenderer.getAssetTypeFromCategory(category),
                category: category,
                path: assetPath,
                width: dimensions.width,
                height: dimensions.height,
                color: this.viewRenderer.getDefaultColor(category),
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
     * Clean up event listeners
     */
    destroy() {
        // Unsubscribe from StateManager
        if (this.subscriptions) {
            this.subscriptions.forEach(unsub => unsub());
            this.subscriptions = [];
        }

        // Remove event handlers using new system
        eventHandlerManager.unregisterContainer(this.container);
        eventHandlerManager.unregisterContainer(this.previewsContainer);
        
        // Remove wheel handlers from EventHandlerManager
        eventHandlerManager.unregisterElement(this.container);
        
        // Clean up global event handlers using GlobalEventRegistry
        globalEventRegistry.unregisterComponentHandlers(this.eventComponentId || 'asset-panel');
        

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
        searchManager.unregisterSearch(this.searchPanelId || 'assets');
    }

    /**
     * Auto-resize panel height based on content
     * No-op when assets is hosted in a dock leaf (B3+) — leaf size is tree-driven.
     */
    autoResizePanelHeight() {
        const assetsPanel = this.container || document.getElementById('assets-panel');
        if (!assetsPanel) return;
        if (assetsPanel.closest('#dock-workspace, #dock-content-pool, #dock-legacy-offtree')
            || !this.isPrimary) {
            return;
        }

        const activeTab = this.foldersController.getActiveTab();
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
                        this.itemActionsController.handleAssetClick(e, assetId);
                    }
                    return;
                }
            },
            (e) => {
                // Handle button clicks
                if (e.target.classList.contains('view-mode-btn')) {
                    const mode = e.target.dataset.mode;
                    this.toolbarController.setViewMode(mode);
                    return;
                }

                if (e.target.classList.contains('size-btn')) {
                    const action = e.target.dataset.action;
                    if (action === 'increase') {
                        this.toolbarController.increaseAssetSize();
                    } else if (action === 'decrease') {
                        this.toolbarController.decreaseAssetSize();
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
        // Requires preventDefault on Ctrl+wheel to zoom previews
        eventHandlerManager.registerElement(
            this.container,
            assetWheelHandlers,
            this.instanceKey ? `asset-panel-wheel-${this.instanceKey}` : 'asset-panel-wheel',
            { passive: false }
        );

        // Setup drag and drop
        this.setupDragAndDrop();

        Logger.ui.debug('AssetPanel: New event handlers setup complete');
    }

    setupAssetEvents() {
        // Asset events are now handled by setupAssetPanelHandlers
        // This method is kept for compatibility but functionality moved to new system
        Logger.ui.debug('AssetPanel: Asset events handled by new event system');
    }


}
