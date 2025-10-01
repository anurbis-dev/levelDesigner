import { BasePanel } from './BasePanel.js';
import { Logger } from '../utils/Logger.js';
import { AssetContextMenu } from './AssetContextMenu.js';
import { AssetPanelContextMenu } from './AssetPanelContextMenu.js';
import { HoverEffects } from '../utils/HoverEffects.js';

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
        this.marqueeDiv = null;
        this.marqueeStart = {};
        
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
        
        // Initialize activeAssetTabs from config
        this.initializeActiveAssetTabs();
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

    setupEventListeners() {
        // Subscribe to state changes
        this.stateManager.subscribe('activeAssetTabs', () => this.render());
        this.stateManager.subscribe('selectedAssets', () => this.updateSelectionVisuals());
        
        // Asset marquee selection
        this.previewsContainer.addEventListener('mousedown', (e) => this.handleAssetMouseDown(e));
        this.previewsContainer.addEventListener('mousemove', (e) => this.handleAssetMouseMove(e));
        this.previewsContainer.addEventListener('mouseup', (e) => this.handleAssetMouseUp(e));
        
        // Asset size zoom with Ctrl+scroll
        this.previewsContainer.addEventListener('wheel', (e) => this.handleAssetWheel(e));
        
        // Prevent content scroll when Ctrl+scroll is used for resizing
        this.container.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
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
        window.addEventListener('resize', this.resizeHandler);
        
        // Global events for proper marquee handling
        window.addEventListener('mousemove', (e) => this.handleGlobalAssetMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleGlobalAssetMouseUp(e));
    }

    render() {
        // Clear any lingering hover effects before re-rendering
        this.clearAllHoverEffects();
        
        this.renderTabs();
        this.renderPreviews();
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

        // Setup tab dragging after rendering
        this.setupTabDragging();
    }

    renderPreviews() {
        this.previewsContainer.innerHTML = '';
        const activeTabs = this.stateManager.get('activeAssetTabs');
        const selectedAssets = this.stateManager.get('selectedAssets');

        const assetsToShow = Array.from(activeTabs)
            .flatMap(tabName => this.assetManager.getAssetsByCategory(tabName));

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
        header.className = 'sticky z-10 grid grid-cols-6 gap-4 p-2 bg-gray-800 text-sm font-medium text-gray-300 border-b border-gray-700';
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
        thumb.style.transition = 'filter 0.2s ease';
        thumb.dataset.assetId = asset.id;
        thumb.draggable = true;
        
        // Add hover effect using utility
        HoverEffects.setupGridItemHover(thumb);
        
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
                const colorDiv = this.createColorFallback(asset);
                thumb.appendChild(colorDiv);
            };
            thumb.appendChild(img);
        } else {
            // Create colored rectangle as fallback (same as default assets)
            const colorDiv = this.createColorFallback(asset);
            thumb.appendChild(colorDiv);
        }
        
        // Add tooltip
        thumb.title = `${asset.name} (${asset.type})`;
        
        // Event listeners
        thumb.addEventListener('click', (e) => this.handleThumbnailClick(e, asset));
        thumb.addEventListener('dragstart', (e) => this.handleThumbnailDragStart(e, asset));
        
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
        nameDiv.className = 'flex-1 text-xs text-gray-200 truncate text-center';
        nameDiv.textContent = this.truncateAssetName(asset.name, this.assetSize * 0.8);
        nameDiv.title = asset.name; // Full name on hover
        
        item.appendChild(nameDiv);
        
        // Event listeners
        item.addEventListener('click', (e) => this.handleThumbnailClick(e, asset));
        item.addEventListener('dragstart', (e) => this.handleThumbnailDragStart(e, asset));
        
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
                    className: 'w-full h-full rounded flex items-center justify-center text-white text-xs font-bold'
                });
                preview.appendChild(colorDiv);
            };
            preview.appendChild(img);
        } else {
            // Create colored rectangle as fallback (same as default assets)
            const colorDiv = this.createColorFallback(asset, {
                text: asset.name.charAt(0).toUpperCase(),
                className: 'w-full h-full rounded flex items-center justify-center text-white text-xs font-bold'
            });
            preview.appendChild(colorDiv);
        }
        
        // Name column
        const name = document.createElement('div');
        name.className = 'text-sm text-gray-200 truncate';
        name.textContent = asset.name;
        name.title = asset.name;
        
        // Type column
        const type = document.createElement('div');
        type.className = 'text-sm text-gray-400';
        type.textContent = asset.type || 'object';
        
        // Category column
        const category = document.createElement('div');
        category.className = 'text-sm text-gray-400';
        category.textContent = asset.category || 'Misc';
        
        // Size column
        const size = document.createElement('div');
        size.className = 'text-sm text-gray-400';
        size.textContent = `${asset.width || 32}×${asset.height || 32}`;
        
        // Properties column (placeholder)
        const properties = document.createElement('div');
        properties.className = 'text-sm text-gray-400';
        properties.textContent = '—'; // Placeholder
        
        row.appendChild(preview);
        row.appendChild(name);
        row.appendChild(type);
        row.appendChild(category);
        row.appendChild(size);
        row.appendChild(properties);
        
        // Event listeners
        row.addEventListener('click', (e) => this.handleThumbnailClick(e, asset));
        row.addEventListener('dragstart', (e) => this.handleThumbnailDragStart(e, asset));
        
        return row;
    }

    /**
     * Check if an image source is valid (exists and can be loaded)
     * @param {string} imgSrc - Image source path
     * @returns {boolean} - True if image is valid, false otherwise
     */
    isValidImageSrc(imgSrc) {
        if (!imgSrc) return false;
        
        // For mock assets with non-existent files, treat as invalid
        // In a real implementation, this would check if the file actually exists
        const mockFiles = ['sky.png', 'mountains.png', 'player.png', 'enemy.png', 'grass.png', 'stone.png', 'coin.png', 'mushroom.png', 'explosion.png', 'particle.png', 'button.png', 'icon.png'];
        if (mockFiles.includes(imgSrc)) {
            return false; // Mock files don't exist, so treat as invalid
        }
        
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
            color: '#ffffff',
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

    handleThumbnailClick(e, asset) {
        const selectedAssets = new Set(this.stateManager.get('selectedAssets'));
        
        if (e.shiftKey) {
            // Toggle selection
            if (selectedAssets.has(asset.id)) {
                selectedAssets.delete(asset.id);
            } else {
                selectedAssets.add(asset.id);
            }
        } else {
            // Select single asset
            selectedAssets.clear();
            selectedAssets.add(asset.id);
        }
        
        this.stateManager.set('selectedAssets', selectedAssets);
    }

    handleThumbnailDragStart(e, asset) {
        const selectedAssets = this.stateManager.get('selectedAssets');
        const draggedAssetIds = selectedAssets.has(asset.id) ? 
            Array.from(selectedAssets) : [asset.id];
        
        e.dataTransfer.setData('application/json', JSON.stringify(draggedAssetIds));
        e.dataTransfer.effectAllowed = 'copy';
        
        this.stateManager.update({
            'mouse.isDraggingAsset': true
        });
    }

    handleAssetMouseDown(e) {
        // Only allow marquee selection with left mouse button (button 0)
        if (e.button !== 0) return;

        // Check if click was on background, not an asset element
        if (e.target.closest('.asset-thumbnail, .asset-list-item, .asset-details-row')) return;
        
        const mouse = this.stateManager.get('mouse');
        this.stateManager.update({
            'mouse.isAssetMarqueeSelecting': true
        });
        
        if (!e.shiftKey) {
            // Just clear selection without re-rendering everything
            this.stateManager.set('selectedAssets', new Set());
            this.updateSelectionVisuals();
        }
        
        // Create marquee div
        this.marqueeDiv = document.createElement('div');
        this.marqueeDiv.id = 'asset-marquee';
        this.previewsContainer.appendChild(this.marqueeDiv);
        
        const rect = this.previewsContainer.getBoundingClientRect();
        this.marqueeStart = { x: e.clientX, y: e.clientY };
        this.marqueeDiv.style.position = 'absolute';
        this.marqueeDiv.style.left = `${e.clientX - rect.left + this.previewsContainer.scrollLeft}px`;
        this.marqueeDiv.style.top = `${e.clientY - rect.top + this.previewsContainer.scrollTop}px`;
        this.marqueeDiv.style.width = '0px';
        this.marqueeDiv.style.height = '0px';
        this.marqueeDiv.style.border = '2px dashed #3B82F6';
        this.marqueeDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        this.marqueeDiv.style.pointerEvents = 'none';
        this.marqueeDiv.style.zIndex = '1000';
    }

    handleAssetMouseMove(e) {
        if (!this.stateManager.get('mouse.isAssetMarqueeSelecting')) return;
        
        const rect = this.previewsContainer.getBoundingClientRect();
        const dx = e.clientX - this.marqueeStart.x;
        const dy = e.clientY - this.marqueeStart.y;
        
        this.marqueeDiv.style.width = `${Math.abs(dx)}px`;
        this.marqueeDiv.style.height = `${Math.abs(dy)}px`;
        this.marqueeDiv.style.left = `${(dx < 0 ? e.clientX - rect.left : this.marqueeStart.x - rect.left) + this.previewsContainer.scrollLeft}px`;
        this.marqueeDiv.style.top = `${(dy < 0 ? e.clientY - rect.top : this.marqueeStart.y - rect.top) + this.previewsContainer.scrollTop}px`;
        
        // Highlight elements that intersect with marquee
        this.highlightElementsInMarquee();
    }

    handleAssetMouseUp(e) {
        if (!this.stateManager.get('mouse.isAssetMarqueeSelecting')) return;
        this.finishAssetMarqueeSelection();
    }

    handleGlobalAssetMouseMove(e) {
        if (!this.stateManager.get('mouse.isAssetMarqueeSelecting')) return;
        
        const rect = this.previewsContainer.getBoundingClientRect();
        
        // Check if mouse is inside asset panel bounds
        const isInsidePanel = e.clientX >= rect.left && e.clientX <= rect.right && 
                             e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (!isInsidePanel) {
            // Constrain marquee to panel bounds
            const constrainedX = Math.max(rect.left, Math.min(rect.right, e.clientX));
            const constrainedY = Math.max(rect.top, Math.min(rect.bottom, e.clientY));
            
            const dx = constrainedX - this.marqueeStart.x;
            const dy = constrainedY - this.marqueeStart.y;
            
            if (this.marqueeDiv) {
                this.marqueeDiv.style.width = `${Math.abs(dx)}px`;
                this.marqueeDiv.style.height = `${Math.abs(dy)}px`;
                this.marqueeDiv.style.left = `${(dx < 0 ? constrainedX - rect.left : this.marqueeStart.x - rect.left) + this.previewsContainer.scrollLeft}px`;
                this.marqueeDiv.style.top = `${(dy < 0 ? constrainedY - rect.top : this.marqueeStart.y - rect.top) + this.previewsContainer.scrollTop}px`;
            }
        }
    }

    handleGlobalAssetMouseUp(e) {
        if (this.stateManager.get('mouse.isAssetMarqueeSelecting')) {
            this.finishAssetMarqueeSelection();
        }
    }

    finishAssetMarqueeSelection() {
        this.stateManager.update({
            'mouse.isAssetMarqueeSelecting': false
        });
        
        const marqueeRect = this.marqueeDiv ? this.marqueeDiv.getBoundingClientRect() : null;
        const selectedAssets = new Set(this.stateManager.get('selectedAssets'));
        
        if (marqueeRect && marqueeRect.width > 2 && marqueeRect.height > 2) {
            // Select assets that intersect with marquee - check all asset elements
            const assetSelectors = ['.asset-thumbnail', '.asset-list-item', '.asset-details-row'];
            assetSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(element => {
                    const elementRect = element.getBoundingClientRect();
                    
                    if (marqueeRect.left < elementRect.right && marqueeRect.right > elementRect.left &&
                        marqueeRect.top < elementRect.bottom && marqueeRect.bottom > elementRect.top) {
                        selectedAssets.add(element.dataset.assetId);
                    }
                });
            });
            
            this.stateManager.set('selectedAssets', selectedAssets);
        }
        
        // Clear all marquee highlights
        this.clearAllMarqueeHighlights();
        
        // Clean up marquee
        if (this.marqueeDiv && this.marqueeDiv.parentNode) {
            this.marqueeDiv.parentNode.removeChild(this.marqueeDiv);
        }
        this.marqueeDiv = null;
        
        // Force immediate visual update after selection
        this.updateSelectionVisuals();
    }

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

        // Make tabs draggable
        this.tabsContainer.addEventListener('mousedown', (e) => {
            const tab = e.target.closest('.tab');
            if (!tab) return;

            draggedTab = tab;
            draggedIndex = Array.from(this.tabsContainer.children).indexOf(tab);
            
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
                this.tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
                return;
            }

            const targetIndex = Array.from(this.tabsContainer.children).indexOf(tab);
            
            // Remove drag-over from all tabs
            this.tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
            
            // Add drag-over to target tab
            tab.classList.add('drag-over');
        });

        // Handle mouse up to complete drag
        document.addEventListener('mouseup', (e) => {
            if (!draggedTab) return;

            const targetTab = e.target.closest('.tab');

            if (targetTab && targetTab !== draggedTab) {
                const targetIndex = Array.from(this.tabsContainer.children).indexOf(targetTab);
                const draggedIndex = Array.from(this.tabsContainer.children).indexOf(draggedTab);

                // Move the tab
                if (draggedIndex < targetIndex) {
                    this.tabsContainer.insertBefore(draggedTab, targetTab.nextSibling);
                } else {
                    this.tabsContainer.insertBefore(draggedTab, targetTab);
                }

                // Save new tab order to state
                const newOrder = Array.from(this.tabsContainer.children)
                    .map(tab => tab.dataset.category);
                this.stateManager.set('assetTabOrder', newOrder);
            }

            // Clean up
            this.tabsContainer.querySelectorAll('.tab').forEach(t => {
                t.classList.remove('dragging', 'drag-over');
            });

            draggedTab = null;
            draggedIndex = -1;
        });

        // Prevent text selection during drag
        this.tabsContainer.addEventListener('selectstart', (e) => {
            if (draggedTab) {
                e.preventDefault();
            }
        });
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
            // Temporarily disable transitions for smooth resize
            const originalTransition = thumb.style.transition;
            thumb.style.transition = 'none';
            
            // Update size
            thumb.style.width = `${this.assetSize}px`;
            thumb.style.height = `${this.assetSize}px`;
            
            // Force reflow to apply changes immediately
            thumb.offsetHeight;
            
            // Restore transitions after resize
            requestAnimationFrame(() => {
                thumb.style.transition = originalTransition;
            });
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
        
        // Use hover effect utility
        if (element.classList.contains('asset-thumbnail')) {
            HoverEffects.applyHoverEffect(element, 'brightness');
        } else if (element.classList.contains('asset-list-item') || element.classList.contains('asset-details-row')) {
            HoverEffects.applyHoverEffect(element, 'background');
        }
    }

    /**
     * Remove marquee highlight from element
     */
    removeMarqueeHighlight(element) {
        if (!element.classList.contains('marquee-highlighted')) return;
        
        element.classList.remove('marquee-highlighted');
        
        // Remove hover effects using utility
        HoverEffects.removeHoverEffect(element);
    }

    /**
     * Setup context menus for assets and panel
     */
    setupContextMenus() {
        // Asset context menu
        this.assetContextMenu = new AssetContextMenu(this, {
            onOpenEditor: (asset) => this.handleAssetOpenEditor(asset),
            onRename: (asset) => this.handleAssetRename(asset),
            onDuplicate: (asset) => this.handleAssetDuplicate(asset),
            onDelete: (asset) => this.handleAssetDelete(asset)
        });

        // Panel context menu
        this.panelContextMenu = new AssetPanelContextMenu(this, {
            onResetSize: () => this.handleResetSize(),
            onToggleGrid: () => this.handleToggleGrid(),
            onToggleList: () => this.handleToggleList(),
            onToggleDetails: () => this.handleToggleDetails(),
            onRefresh: () => this.handleRefresh(),
            onSettings: () => this.handleSettings(),
            onSelectAll: () => this.handleSelectAll(),
            onDeselectAll: () => this.handleDeselectAll()
        });
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
     * Clear all hover effects from asset elements
     */
    clearAllHoverEffects() {
        const assetSelectors = ['.asset-thumbnail', '.asset-list-item', '.asset-details-row'];
        assetSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                HoverEffects.removeHoverEffect(element);
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
        window.removeEventListener('mousemove', this.handleGlobalAssetMouseMove);
        window.removeEventListener('mouseup', this.handleGlobalAssetMouseUp);

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
            this.stateManager.set('ui.assetsPanelHeight', finalHeight);
        }
    }

    /**
     * Get active tab name
     */
    getActiveTab() {
        const activeTab = this.container.querySelector('.asset-tab.active');
        return activeTab ? activeTab.dataset.category : null;
    }
}
