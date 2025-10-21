import { BasePanel } from './BasePanel.js';
import { Logger } from '../utils/Logger.js';
import { ExtensionErrorUtils } from '../utils/ExtensionErrorUtils.js';
import { AssetContextMenu } from './AssetContextMenu.js';
import { AssetPanelContextMenu } from './AssetPanelContextMenu.js';
import { FoldersPanel } from './FoldersPanel.js';
import { eventHandlerManager } from '../managers/EventHandlerManager.js';
// Note: HoverEffects removed - using CSS hover effects like OutlinerPanel

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
        this.marqueeDiv = null;
        this.marqueeStart = {};
        this.isDraggingTab = false; // Flag to track tab dragging
        this.tabDraggingSetup = false; // Flag to track if tab dragging is already setup

        // Asset size management
        this.assetSize = 96; // Default size, will be loaded in init()
        this.minAssetSize = 48; // w-12 = 48px
        this.maxAssetSize = 192; // w-48 = 192px
        this.sizeStep = 8; // Step size for zoom
        this.gapSize = 8; // Base gap size in pixels, will be scaled by spacing

        // View mode management
        this.viewMode = 'grid'; // 'grid', 'list', 'details'

        // Resize optimization (removed debounce for real-time updates)

        this.init();
        this.setupEventListeners();
        this.setupContextMenus();
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

        // Setup global Ctrl+scroll prevention
        this.setupGlobalCtrlScrollPrevention();

        // Load asset size from user preferences
        this.assetSize = this.loadAssetSize();

        // Load view mode from user preferences
        this.viewMode = this.loadViewMode();

        // Load folders position from user preferences
        this.foldersPosition = this.loadFoldersPosition();

        // Initialize FoldersPanel
        this.initializeFoldersPanel();

        // Initialize activeAssetTabs from config
        this.initializeActiveAssetTabs();
        
        // Event handlers will be set up automatically by AutoEventHandlerManager
        
        // Setup folders and listeners
        this.setupFoldersAndListeners();

        // Update layout based on folders position
        this.updateFoldersLayout();
    }


    /**
     * Handle search input
     * @param {string} value - Search value
     */
    handleSearch(value) {
        Logger.ui.debug('AssetPanel: Search:', value);
        // TODO: Implement search functionality
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
            Logger.ui.debug('Asset size decreased to:', this.assetSize);
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
            Logger.ui.debug('Asset size increased to:', this.assetSize);
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
    }

    /**
     * Initialize active asset tabs from config
     */
    initializeActiveAssetTabs() {
        const savedTabs = this.levelEditor?.configManager?.get('editor.view.activeAssetTabs');
        Logger.ui.debug('Initializing activeAssetTabs:', savedTabs);
        if (savedTabs && Array.isArray(savedTabs) && savedTabs.length > 0) {
            this.stateManager.set('activeAssetTabs', new Set(savedTabs));
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

        if (!folder.name) {
            Logger.ui.warn('AssetPanel: folder has no name property:', folder);
            return;
        }

        if (!this.assetManager || !this.assetManager.assets) {
            Logger.ui.error('AssetPanel: assetManager not available for filterByFolder');
            return;
        }

        Logger.ui.debug('AssetPanel: filterByFolder called with folder:', folder.name);

        // For now, filter by category - later can be more sophisticated
        const categoryName = folder.name;
        const categoryAssets = Array.from(this.assetManager.assets.values())
            .filter(asset => asset.category === categoryName);

        Logger.ui.debug(`AssetPanel: Found ${categoryAssets.length} assets in category ${categoryName}`);

        // Update the active tabs to show only this category
        if (categoryAssets.length > 0) {
            const categorySet = new Set([categoryName]);
            this.stateManager.set('activeAssetTabs', categorySet);
            this.render();
        }

        Logger.ui.debug(`Filtered assets by folder: ${categoryName}, found ${categoryAssets.length} assets`);
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

        // Find the tab for this asset's category
        const categoryName = asset.category;
        if (!categoryName) {
            Logger.ui.warn('AssetPanel: Asset has no category:', assetId);
            return;
        }

        const categorySet = new Set([categoryName]);
        this.stateManager.set('activeAssetTabs', categorySet);

        // Switch to the tab and select the asset
        this.render();

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

        let isResizingFolders = false;
        let initialMouseX = 0;
        let initialFoldersWidth = 0;
        let lastAppliedFoldersWidth = null;
        let previousFoldersWidth = 192; // Default width (w-48)

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

        // Double-click handler for foldersResizer
        this.foldersResizer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const currentWidth = this.foldersContainer.offsetWidth;
            const containerWidth = this.container.clientWidth;
            const resizerWidth = 4;
            const minWidth = 0;
            const maxWidth = containerWidth - resizerWidth;
            
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
                previousFoldersWidth = currentWidth;
                
                // Update StateManager instead of direct styles
                if (this.levelEditor?.stateManager) {
                    this.levelEditor.stateManager.set('panels.foldersWidth', 0);
                }
                this.updateContentVisibility(0);
                
                // Save to preferences
                if (this.levelEditor?.userPrefs) {
                    this.levelEditor.userPrefs.set('foldersWidth', 0);
                }
            }
        });

        // Global mousemove handler
        const handleMouseMove = (e) => {
            if (!isResizingFolders) return;

            e.preventDefault();
            e.stopPropagation();

            const mouseDelta = e.clientX - initialMouseX;
            const containerWidth = this.container.clientWidth;
            const resizerWidth = 4;
            const minWidth = 0; // Allow folders to be completely hidden
            const maxWidth = containerWidth - resizerWidth; // Allow resizer to reach the edge

            let newWidth;
            if (this.foldersPosition === 'left') {
                newWidth = initialFoldersWidth + mouseDelta;
            } else {
                newWidth = initialFoldersWidth - mouseDelta;
            }

            // Apply constraints
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

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

        // Load saved width
        if (this.levelEditor?.userPrefs) {
            const savedWidth = this.levelEditor.userPrefs.get('foldersWidth');
            if (savedWidth && typeof savedWidth === 'number' && savedWidth >= 0) {
                this.foldersContainer.style.width = savedWidth + 'px';
                this.foldersContainer.style.flexShrink = '0';
                this.foldersContainer.style.flexGrow = '0';
                
                // Update visibility based on loaded width
                this.updateContentVisibility(savedWidth);
                
                // Initialize previous width for double-click toggle
                if (savedWidth > 0) {
                    previousFoldersWidth = savedWidth;
                }
                
                Logger.ui.debug('Loaded folders width from preferences:', savedWidth);
            }
        }
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
        this.stateManager.subscribe('activeAssetTabs', () => this.render());
        
        // Asset size zoom with Ctrl+scroll
        this.previewsContainer.addEventListener('wheel', (e) => this.handleAssetWheel(e), { passive: false });
        
        // Prevent content scroll when Ctrl+scroll is used for resizing
        this.container.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });

        // Drag-n-drop for PNG files
        this.setupDragAndDrop();
        
        // Window resize handler for real-time grid recalculation
        this.resizeHandler = () => {
            // Update asset placement in real-time without debounce
            if (this.viewMode === 'grid') {
                // Update grid layout immediately for real-time responsiveness
                this.updateGridViewSizes();
            } else {
                // For list and details view, just update selection visuals
                this.updateSelectionVisuals();
            }
        };
        window.addEventListener('resize', this.resizeHandler, { passive: true });
        
        // Note: Global marquee handling now managed by BasePanel

        this.setupAssetEvents();
        
        // Touch gestures are now handled by TouchInitializationManager
    }

    render() {
        // Note: Hover effects now handled by CSS (like OutlinerPanel)
        this.renderTabs();
        this.renderPreviews();
        
        // Touch gestures are handled by TouchInitializationManager
    }

    renderTabs() {
        this.tabsContainer.innerHTML = '';
        const tabOrder = this.stateManager.get('assetTabOrder') || [];
        const availableCategories = this.assetManager.getCategories();

        // Filter tabOrder to only include available categories, and add any missing categories at the end
        const orderedCategories = tabOrder.filter(cat => availableCategories.includes(cat));
        const missingCategories = availableCategories.filter(cat => !orderedCategories.includes(cat));
        const finalOrder = [...orderedCategories, ...missingCategories];

        finalOrder.forEach(category => {
            const tabButton = document.createElement('button');
            tabButton.className = `tab ${
                this.stateManager.get('activeAssetTabs').has(category) ? 'active' : ''
            }`;
            tabButton.textContent = category;
            tabButton.dataset.category = category;

            tabButton.addEventListener('click', (e) => this.handleTabClick(e, category));
            this.tabsContainer.appendChild(tabButton);
        });

        // Setup tab dragging after rendering (only once)
        if (!this.tabDraggingSetup) {
            this.setupTabDragging();
            this.tabDraggingSetup = true;
        }
    }

    renderPreviews() {
        this.previewsContainer.innerHTML = '';
        const activeTabs = this.stateManager.get('activeAssetTabs');
        const selectedAssets = this.stateManager.get('selectedAssets');

        const assetsToShow = Array.from(activeTabs)
            .flatMap(tabName => this.assetManager.getAssetsByCategory(tabName));

        // Log asset details for debugging
        Logger.ui.debug(`AssetPanel: Rendering ${assetsToShow.length} assets`);
        assetsToShow.forEach(asset => {
            Logger.ui.debug(`Asset: ${asset.name} | imgSrc: ${asset.imgSrc ? 'YES' : 'NO'} | isValid: ${this.isValidImageSrc(asset.imgSrc)}`);
        });

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
        
        // Note: Hover effects now handled by CSS (like OutlinerPanel)
        
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

    handleTabClick(e, category) {
        const activeTabs = new Set(this.stateManager.get('activeAssetTabs'));
        
        if (e.shiftKey) {
            // Toggle tab
            if (activeTabs.has(category)) {
                if (activeTabs.size > 1) {
                    activeTabs.delete(category);
                }
            } else {
                activeTabs.add(category);
            }
        } else {
            // Select single tab
            activeTabs.clear();
            activeTabs.add(category);
        }
        
        this.stateManager.set('activeAssetTabs', activeTabs);
        // Save to config for persistence
        this.levelEditor.configManager.set('editor.view.activeAssetTabs', Array.from(activeTabs));
        this.stateManager.set('selectedAssets', new Set());
        
        // Auto-resize panel height after tab change
        setTimeout(() => this.autoResizePanelHeight(), 100);
    }

    // Note: handleThumbnailClick method removed
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
        // Disable dragging when Ctrl/Cmd is held to allow marquee toggle
        if (e.ctrlKey || e.metaKey) {
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

    // Note: handleAssetMouseDown method removed
    // Now using BasePanel marquee selection with SelectionUtils

    // Note: Old marquee selection methods removed
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
     * Setup tab dragging functionality
     */
    setupTabDragging() {
        let draggedTab = null;
        let draggedIndex = -1;
        
        // Store reference to mouseup handler for cleanup
        this.tabMouseUpHandler = null;

        // Make tabs draggable
        this.tabsContainer.addEventListener('mousedown', (e) => {
            const tab = e.target.closest('.tab');
            if (!tab) return;

            draggedTab = tab;
            draggedIndex = Array.from(this.tabsContainer.children).indexOf(tab);
            this.isDraggingTab = true; // Set flag for tab dragging
            
            // Add dragging class
            tab.classList.add('dragging');
            
            // Prevent default to avoid text selection
            e.preventDefault();
        });

        // Handle mouse move for drag over effects
        this.tabsContainer.addEventListener('mousemove', (e) => {
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
        });

        // Handle mouse up to complete drag
        this.tabMouseUpHandler = (e) => {
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
                const newOrder = Array.from(this.tabsContainer.children)
                    .map(tab => tab.dataset.category);
                this.stateManager.set('assetTabOrder', newOrder);
            }

            // Clean up
            this.tabsContainer.querySelectorAll('.tab').forEach(t => {
                t.classList.remove('dragging', 'tab-drag-over');
            });

            this.isDraggingTab = false; // Reset flag
            draggedTab = null;
            draggedIndex = -1;
        };
        
        document.addEventListener('mouseup', this.tabMouseUpHandler);

        // Prevent text selection during drag
        this.tabsContainer.addEventListener('selectstart', (e) => {
            if (draggedTab) {
                e.preventDefault();
            }
        });
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
        const activeTabs = this.stateManager.get('activeAssetTabs');
        return Array.from(activeTabs)
            .flatMap(tabName => this.assetManager.getAssetsByCategory(tabName));
    }

    /**
     * Get selectable asset elements for marquee selection
     * @returns {Array} Array of selectable elements
     */
    getSelectableAssetElements() {
        return Array.from(this.previewsContainer.querySelectorAll('[data-asset-id]'));
    }

    /**
     * Handle wheel event for asset size zoom
     * @param {WheelEvent} e - The wheel event
     */
    handleAssetWheel(e) {
        // Only handle if Ctrl key is pressed
        if (!e.ctrlKey) return;
        
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
        document.querySelectorAll('.asset-thumbnail').forEach(element => {
            const assetId = element.dataset.assetId;
            if (assetId) {
                if (selectedAssets.has(assetId)) {
                    element.classList.add('selected');
                } else {
                    element.classList.remove('selected');
                }
            }
        });
        
        document.querySelectorAll('.asset-list-item, .asset-details-row').forEach(element => {
            const assetId = element.dataset.assetId;
            if (assetId) {
                if (selectedAssets.has(assetId)) {
                    element.classList.add('selected');
                } else {
                    element.classList.remove('selected');
                }
            }
        });
    }

    /**
     * Highlight elements that intersect with marquee selection
     */
    highlightElementsInMarquee() {
        if (!this.marqueeDiv) return;
        
        const marqueeRect = this.marqueeDiv.getBoundingClientRect();
        const containerRect = this.previewsContainer.getBoundingClientRect();
        
        // Convert marquee position to container coordinates
        const marqueeLeft = marqueeRect.left - containerRect.left + this.previewsContainer.scrollLeft;
        const marqueeTop = marqueeRect.top - containerRect.top + this.previewsContainer.scrollTop;
        const marqueeRight = marqueeLeft + marqueeRect.width;
        const marqueeBottom = marqueeTop + marqueeRect.height;
        
        // Check all asset elements
        const assetSelectors = ['.asset-thumbnail', '.asset-list-item', '.asset-details-row'];
        assetSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                const elementRect = element.getBoundingClientRect();
                const elementLeft = elementRect.left - containerRect.left + this.previewsContainer.scrollLeft;
                const elementTop = elementRect.top - containerRect.top + this.previewsContainer.scrollTop;
                const elementRight = elementLeft + elementRect.width;
                const elementBottom = elementTop + elementRect.height;
                
                // Check if element intersects with marquee
                const intersects = marqueeLeft < elementRight && marqueeRight > elementLeft &&
                                 marqueeTop < elementBottom && marqueeBottom > elementTop;
                
                if (intersects) {
                    this.addMarqueeHighlight(element);
                } else {
                    this.removeMarqueeHighlight(element);
                }
            });
        });
    }

    /**
     * Clear all marquee highlights
     */
    clearAllMarqueeHighlights() {
        const assetSelectors = ['.asset-thumbnail', '.asset-list-item', '.asset-details-row'];
        assetSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                this.removeMarqueeHighlight(element);
            });
        });
    }

    /**
     * Add marquee highlight to element using existing hover styles
     */
    addMarqueeHighlight(element) {
        if (element.classList.contains('marquee-highlighted')) return;
        
        element.classList.add('marquee-highlighted');
        // Note: Hover effects now handled by CSS (like OutlinerPanel)
    }

    /**
     * Remove marquee highlight from element
     */
    removeMarqueeHighlight(element) {
        if (!element.classList.contains('marquee-highlighted')) return;
        
        element.classList.remove('marquee-highlighted');
        // Note: Hover effects now handled by CSS (like OutlinerPanel)
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
            onDelete: (asset) => this.handleAssetDelete(asset)
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
            onDeselectAll: () => this.handleDeselectAll()
        });

        // Complete deferred initialization for context menus
        if (this.assetContextMenu && this.assetContextMenu.completeDeferredInit) {
            this.assetContextMenu.completeDeferredInit();
        }
        if (this.panelContextMenu && this.panelContextMenu.completeDeferredInit) {
            this.panelContextMenu.completeDeferredInit();
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
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        if (activeTabs.size === 0) return null;
        
        // Get the first active tab as the current folder
        const currentTab = Array.from(activeTabs)[0];
        
        // Map tab names to folder names
        const tabToFolderMap = {
            'objects': 'objects',
            'backgrounds': 'backgrounds', 
            'characters': 'characters',
            'collectibles': 'collectibles',
            'enemies': 'enemies',
            'environment': 'environment'
        };
        
        return tabToFolderMap[currentTab] || null;
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
        const dropZone = this.container;
        
        // Create drop overlay element - positioned relative to content container
        this.dropOverlay = document.createElement('div');
        this.dropOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(59, 130, 246, 0.1);
            border: 2px dashed rgba(59, 130, 246, 0.5);
            pointer-events: none;
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
        `;
        
        // Create text container with background
        const textContainer = document.createElement('div');
        textContainer.style.cssText = `
            padding: 20px 40px;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid rgba(59, 130, 246, 0.8);
            border-radius: 8px;
            font-size: 24px;
            color: rgba(59, 130, 246, 1);
            font-weight: bold;
            text-align: center;
        `;
        textContainer.textContent = 'Drop PNG image(s) to Import as Assets';
        this.dropOverlay.appendChild(textContainer);
        
        // Position overlay relative to main container but size it to match previews container
        this.container.style.position = 'relative';

        // Size overlay to match previews container dimensions and position
        if (this.previewsContainer) {
            const updateOverlaySize = () => {
                const rect = this.previewsContainer.getBoundingClientRect();
                const containerRect = this.container.getBoundingClientRect();

                this.dropOverlay.style.position = 'absolute';
                this.dropOverlay.style.top = `${rect.top - containerRect.top}px`;
                this.dropOverlay.style.left = `${rect.left - containerRect.left}px`;
                this.dropOverlay.style.width = `${rect.width}px`;
                this.dropOverlay.style.height = `${rect.height}px`;
                this.dropOverlay.style.zIndex = '9999'; // Very high z-index to be above everything
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
        dropZone.addEventListener('dragenter', this.boundHandleDragEnter, false);
        dropZone.addEventListener('dragover', this.boundHandleDragOver, false);
        dropZone.addEventListener('dragleave', this.boundHandleDragLeave, false);
        dropZone.addEventListener('drop', this.boundHandleDrop, false);
    }

    handleDragEnter(e) {
        // Only handle external file drops, not internal asset dragging or tab dragging
        if (!e.dataTransfer.types.includes('Files') || e.target.closest('.tab') || this.isDraggingTab) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Check if we're entering the previews container area (only assets area, not tabs)
        if (this.previewsContainer) {
            const rect = this.previewsContainer.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                if (this.dropOverlay) {
                    this.dropOverlay.style.display = 'flex';
                }
            }
        }
    }

    handleDragOver(e) {
        // Only handle external file drops, not internal asset dragging or tab dragging
        if (!e.dataTransfer.types.includes('Files') || e.target.closest('.tab') || this.isDraggingTab) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Continuously check if still inside previews container (assets area only)
        if (this.previewsContainer) {
            const rect = this.previewsContainer.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                if (this.dropOverlay) {
                    this.dropOverlay.style.display = 'flex';
                }
            }
        }
    }

    handleDragLeave(e) {
        // Only handle external file drops, not tab dragging
        if (!e.dataTransfer.types.includes('Files') || e.target.closest('.tab') || this.isDraggingTab) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Check if actually leaving the previews container (assets area only)
        if (this.previewsContainer) {
            const rect = this.previewsContainer.getBoundingClientRect();
            const isOutside = e.clientX < rect.left || e.clientX > rect.right ||
                             e.clientY < rect.top || e.clientY > rect.bottom;

            if (isOutside && this.dropOverlay) {
                this.dropOverlay.style.display = 'none';
            }
        }
    }

    /**
     * Handle dropped files
     * @param {DragEvent} e - Drop event
     */
    async handleDrop(e) {
        // Only handle external file drops, not internal asset dragging or tab dragging
        if (!e.dataTransfer.types.includes('Files') || !e.dataTransfer.files.length || e.target.closest('.tab') || this.isDraggingTab) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Hide overlay immediately after drop
        if (this.dropOverlay) {
            this.dropOverlay.style.display = 'none';
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

        // Get active tab (last selected if multiple)
        const activeTabs = this.stateManager.get('activeAssetTabs') || new Set();
        const activeTab = Array.from(activeTabs).pop() || 'objects';

        Logger.ui.info(`📂 Adding assets to tab: ${activeTab}`);

        // Create temporary assets for each PNG file
        for (const pngFile of pngFiles) {
            try {
                await this.createTemporaryAssetFromFile(pngFile, activeTab);
            } catch (error) {
                Logger.ui.error(`❌ Failed to create asset from ${pngFile.name}:`, error);
            }
        }

        // Refresh the panel
        this.render();
    }

    /**
     * Create temporary asset from PNG file
     * @param {File} pngFile - PNG file
     * @param {string} category - Asset category
     */
    async createTemporaryAssetFromFile(pngFile, category) {
        Logger.ui.info(`🎨 Creating temporary asset from: ${pngFile.name}`);

        try {
            // Create data URL for image
            const { FileUtils } = await import('../utils/FileUtils.js');
            const imgSrc = await FileUtils.createDataURL(pngFile);

            // Get image dimensions
            const dimensions = await this.getImageDimensions(imgSrc);

            // Create asset data
            const assetId = `temp_${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const assetData = {
                id: assetId,
                name: pngFile.name.replace(/\.[^/.]+$/, ""), // Remove extension
                type: this.getAssetTypeFromCategory(category),
                category: category,
                path: `${category}/${pngFile.name}`, // Path based on active tab category
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
        const activeTabs = this.stateManager.get('activeAssetTabs');
        const allAssets = Array.from(activeTabs)
            .flatMap(tabName => this.assetManager.getAssetsByCategory(tabName));
        const allAssetIds = new Set(allAssets.map(asset => asset.id));
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
     * Clear all marquee highlights from asset elements
     */
    clearAllMarqueeHighlights() {
        const assetSelectors = ['.asset-thumbnail', '.asset-list-item', '.asset-details-row'];
        assetSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                element.classList.remove('marquee-highlighted');
            });
        });
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        
        if (this.tabMouseUpHandler) {
            document.removeEventListener('mouseup', this.tabMouseUpHandler);
        }
        
        if (this.foldersMouseMoveHandler) {
            document.removeEventListener('mousemove', this.foldersMouseMoveHandler);
        }
        
        if (this.foldersMouseUpHandler) {
            document.removeEventListener('mouseup', this.foldersMouseUpHandler);
        }

        // Clean up ResizeObserver for drop overlay
        if (this.dropOverlayResizeObserver) {
            this.dropOverlayResizeObserver.disconnect();
        }

        // Note: Global marquee handlers now managed by BasePanel

        // Clean up context menus
        if (this.assetContextMenu) {
            this.assetContextMenu.destroy();
        }
        if (this.panelContextMenu) {
            this.panelContextMenu.destroy();
        }
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

    setupAssetEvents() {
        this.container.querySelectorAll('.asset-thumbnail').forEach(el => {
            el.addEventListener('dblclick', (e) => {
                const assetId = el.dataset.assetId;
                const asset = this.assetManager.getAssetById(assetId);
                if (asset && this.levelEditor && this.levelEditor.showActorPropertiesPanel) {
                    this.levelEditor.showActorPropertiesPanel(asset);
                }
            });
        });
    }


    /**
     * Start touch marquee selection in asset panel
     * @param {number} startX - Start X coordinate
     * @param {number} startY - Start Y coordinate
     */
    startAssetTouchMarquee(startX, startY) {
        // Check if touch started on an asset (not empty space)
        const elementAtPoint = document.elementFromPoint(startX, startY);
        
        // If touch started on an asset or its child elements, don't start marquee
        if (elementAtPoint && (
            elementAtPoint.closest('.asset-thumbnail') || 
            elementAtPoint.closest('.asset-item') ||
            elementAtPoint.closest('.asset-row') ||
            elementAtPoint.closest('.asset-details-row') ||
            elementAtPoint.closest('[data-asset-id]') ||
            elementAtPoint.closest('[draggable="true"]')
        )) {
            Logger.ui.debug('Asset panel touch started on draggable asset, skipping marquee');
            return;
        }
        
        // Create synthetic mouse event and pass to SelectionUtils
        const syntheticEvent = {
            button: 0, // Left mouse button
            clientX: startX,
            clientY: startY,
            target: this.previewsContainer, // Set target to container
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        
        // Use SelectionUtils to handle marquee start
        import('../utils/SelectionUtils.js').then(({ SelectionUtils }) => {
            SelectionUtils.handleMarqueeMouseDown(syntheticEvent, {
                container: this.previewsContainer,
                stateManager: this.stateManager,
                ...this.selectionOptions
            });
        }).catch(error => {
            Logger.ui.error('Failed to load SelectionUtils for marquee start:', error);
        });
        
        Logger.ui.debug('Asset panel touch marquee started at:', startX, startY);
    }

    /**
     * Update touch marquee selection in asset panel
     * @param {number} currentX - Current X coordinate
     * @param {number} currentY - Current Y coordinate
     */
    updateAssetTouchMarquee(currentX, currentY) {
        // Create synthetic mouse event and pass to SelectionUtils
        const syntheticEvent = {
            clientX: currentX,
            clientY: currentY,
            target: this.previewsContainer, // Set target to container
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        
        // Use SelectionUtils to handle marquee move
        import('../utils/SelectionUtils.js').then(({ SelectionUtils }) => {
            SelectionUtils.handleMarqueeMouseMove(syntheticEvent, this.stateManager);
        }).catch(error => {
            Logger.ui.error('Failed to load SelectionUtils for marquee move:', error);
        });
    }

    /**
     * End touch marquee selection in asset panel
     * @param {number} endX - End X coordinate
     * @param {number} endY - End Y coordinate
     */
    endAssetTouchMarquee(endX, endY) {
        // Create synthetic mouse event and pass to SelectionUtils
        const syntheticEvent = {
            clientX: endX,
            clientY: endY,
            target: this.previewsContainer, // Set target to container
            preventDefault: () => {},
            stopPropagation: () => {}
        };
        
        // Use SelectionUtils to handle marquee end
        import('../utils/SelectionUtils.js').then(({ SelectionUtils }) => {
            SelectionUtils.handleMarqueeMouseUp(syntheticEvent, this.stateManager, this.selectionOptions);
        }).catch(error => {
            Logger.ui.error('Failed to load SelectionUtils for marquee end:', error);
        });
        
        Logger.ui.debug('Asset panel touch marquee ended at:', endX, endY);
    }

    // ===== TOUCH DRAG AND DROP HANDLERS =====

    /**
     * Start touch drag for asset - emulate dragstart event
     * @param {number} startX - Start X coordinate
     * @param {number} startY - Start Y coordinate
     * @param {Object} asset - Asset being dragged
     */
    startAssetTouchDrag(startX, startY, asset) {
        // Create synthetic dragstart event
        const syntheticDragStartEvent = {
            target: document.querySelector(`[data-asset-id="${asset.id}"]`),
            ctrlKey: false,
            metaKey: false,
            dataTransfer: {
                setData: (type, data) => {
                    this._dragData = data;
                },
                getData: (type) => this._dragData,
                effectAllowed: 'copy'
            },
            preventDefault: () => {},
            stopPropagation: () => {}
        };

        // Call existing dragstart handler
        this.handleThumbnailDragStart(syntheticDragStartEvent, asset);
        
        Logger.ui.debug('Asset touch drag started:', asset.id);
    }

    /**
     * End touch drag for asset - emulate drop event
     * @param {number} endX - End X coordinate
     * @param {number} endY - End Y coordinate
     */
    endAssetTouchDrag(endX, endY) {
        // Check if we're over the canvas
        const canvas = document.getElementById('main-canvas');
        if (!canvas) {
            this.handleThumbnailDragEnd({}, null);
            return;
        }

        const canvasRect = canvas.getBoundingClientRect();
        const isOverCanvas = endX >= canvasRect.left && 
                            endX <= canvasRect.right && 
                            endY >= canvasRect.top && 
                            endY <= canvasRect.bottom;

        if (isOverCanvas) {
            Logger.ui.debug('Touch drag ended over canvas, calling handleDrop with dragData:', this._dragData);
            
            // Create synthetic drop event
            const syntheticDropEvent = {
                target: {
                    ...canvas,
                    closest: (selector) => canvas.closest(selector)
                },
                clientX: endX,
                clientY: endY,
                dataTransfer: {
                    getData: (type) => this._dragData
                },
                preventDefault: () => {},
                stopPropagation: () => {}
            };

            // Call existing drop handler
            this.levelEditor.mouseHandlers.handleDrop(syntheticDropEvent);
        } else {
            Logger.ui.debug('Touch drag ended outside canvas');
        }

        // Always call dragend to reset state
        this.handleThumbnailDragEnd({}, null);
        
        Logger.ui.debug('Asset touch drag ended');
    }
}
