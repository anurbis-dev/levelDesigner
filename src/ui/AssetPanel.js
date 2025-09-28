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
        this.assetSize = 96; // Default size in pixels (w-24 = 96px)
        this.minAssetSize = 48; // w-12 = 48px
        this.maxAssetSize = 192; // w-48 = 192px
        this.sizeStep = 8; // Step size for zoom
        this.gapSize = 8; // Fixed gap size in pixels
        
        // View mode management
        this.viewMode = 'grid'; // 'grid', 'list', 'details'
        
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
        
        // Window resize handler for grid recalculation
        this.resizeHandler = () => this.render();
        window.addEventListener('resize', this.resizeHandler);
        
        // Global events for proper marquee handling
        window.addEventListener('mousemove', (e) => this.handleGlobalAssetMouseMove(e));
        window.addEventListener('mouseup', (e) => this.handleGlobalAssetMouseUp(e));
    }

    render() {
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
            tabButton.className = `tab px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:bg-gray-700 ${
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
        this.previewsContainer.classList.add('p-4');
        
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gap = `${this.gapSize}px`;
        
        // Calculate dynamic grid columns based on asset size and container width
        const containerWidth = this.previewsContainer.clientWidth;
        const columns = Math.max(1, Math.floor((containerWidth + this.gapSize) / (this.assetSize + this.gapSize)));
        
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
        this.previewsContainer.classList.add('p-4');
        
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexWrap = 'wrap';
        list.style.gap = `${this.gapSize}px`;
        
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
        this.previewsContainer.classList.remove('p-4');
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
        content.style.paddingTop = '48px'; // Leave space for sticky header (40px + 8px margin)

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
        
        if (asset.imgSrc) {
            const img = document.createElement('img');
            img.src = asset.imgSrc;
            img.alt = asset.name;
            img.draggable = false;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onerror = () => { img.style.display = 'none'; };
            thumb.appendChild(img);
        } else {
            // Create colored rectangle as fallback
            const colorDiv = document.createElement('div');
            colorDiv.style.width = '100%';
            colorDiv.style.height = '100%';
            colorDiv.style.backgroundColor = asset.color;
            colorDiv.style.display = 'flex';
            colorDiv.style.alignItems = 'center';
            colorDiv.style.justifyContent = 'center';
            colorDiv.style.fontSize = '10px';
            colorDiv.style.color = '#ffffff';
            colorDiv.style.textAlign = 'center';
            colorDiv.textContent = asset.name;
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
            selectedAssets.has(asset.id) ? 'selected bg-blue-600' : 'hover:bg-gray-600'
        }`;
        item.style.width = `${this.assetSize}px`;
        item.style.height = 'auto';
        item.style.minHeight = '24px';
        item.dataset.assetId = asset.id;
        item.draggable = true;
        
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
        row.className = `asset-details-row grid grid-cols-6 gap-4 p-2 hover:bg-gray-700 cursor-pointer ${
            selectedAssets.has(asset.id) ? 'bg-blue-900' : ''
        }`;
        row.style.minWidth = '600px'; // Match header width
        row.dataset.assetId = asset.id;
        row.draggable = true;
        
        // Preview column
        const preview = document.createElement('div');
        preview.className = 'flex items-center justify-center';
        preview.style.width = `${this.assetSize * 0.5}px`;
        preview.style.height = `${this.assetSize * 0.5}px`;
        
        if (asset.imgSrc) {
            const img = document.createElement('img');
            img.src = asset.imgSrc;
            img.alt = asset.name;
            img.className = 'w-full h-full object-cover rounded';
            img.draggable = false;
            img.onerror = () => { img.style.display = 'none'; };
            preview.appendChild(img);
        } else {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'w-full h-full rounded';
            colorDiv.style.backgroundColor = asset.color;
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
            this.render();
            
            // Log the change
            Logger.ui.debug(`Asset size changed to ${this.assetSize}px in ${this.viewMode} view`);
        }
    }

    /**
     * Update selection visuals without re-rendering entire content
     */
    updateSelectionVisuals() {
        const selectedAssets = this.stateManager.get('selectedAssets');
        
        // Update all asset elements
        document.querySelectorAll('.asset-thumbnail').forEach(element => {
            const assetId = element.dataset.assetId;
            if (assetId) {
                if (selectedAssets.has(assetId)) {
                    element.classList.add('selected');
                    element.style.border = '2px solid #3B82F6';
                    element.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.3)';
                } else {
                    element.classList.remove('selected');
                    element.style.border = 'none';
                    element.style.boxShadow = 'none';
                }
            }
        });
        
        document.querySelectorAll('.asset-list-item, .asset-details-row').forEach(element => {
            const assetId = element.dataset.assetId;
            if (assetId) {
                if (selectedAssets.has(assetId)) {
                    element.classList.add('selected');
                    element.classList.add('bg-blue-600');
                    element.classList.remove('hover:bg-gray-600');
                } else {
                    element.classList.remove('selected');
                    element.classList.remove('bg-blue-600');
                    element.classList.add('hover:bg-gray-600');
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
        this.render();
    }

    /**
     * Handle toggle list view
     */
    handleToggleList() {
        Logger.ui.debug('Switching to list view');
        this.viewMode = 'list';
        this.render();
    }

    /**
     * Handle toggle details view
     */
    handleToggleDetails() {
        Logger.ui.debug('Switching to details view');
        this.viewMode = 'details';
        this.render();
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
}
