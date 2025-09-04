/**
 * Asset panel UI component
 */
export class AssetPanel {
    constructor(container, assetManager, stateManager) {
        this.container = container;
        this.assetManager = assetManager;
        this.stateManager = stateManager;
        this.tabsContainer = null;
        this.previewsContainer = null;
        this.marqueeDiv = null;
        this.marqueeStart = {};
        
        this.init();
        this.setupEventListeners();
    }

    init() {
        this.container.innerHTML = `
            <div id="asset-tabs-container" class="flex border-b border-gray-700"></div>
            <div id="asset-previews-container" class="flex-grow p-4 overflow-auto"></div>
        `;
        
        this.tabsContainer = this.container.querySelector('#asset-tabs-container');
        this.previewsContainer = this.container.querySelector('#asset-previews-container');
    }

    setupEventListeners() {
        // Subscribe to state changes
        this.stateManager.subscribe('activeAssetTabs', () => this.render());
        this.stateManager.subscribe('selectedAssets', () => this.render());
        
        // Asset marquee selection
        this.previewsContainer.addEventListener('mousedown', (e) => this.handleAssetMouseDown(e));
        this.previewsContainer.addEventListener('mousemove', (e) => this.handleAssetMouseMove(e));
        this.previewsContainer.addEventListener('mouseup', (e) => this.handleAssetMouseUp(e));
        
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
        const categories = this.assetManager.getCategories();
        
        categories.forEach(category => {
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
        
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-4';
        
        assetsToShow.forEach(asset => {
            const thumb = this.createAssetThumbnail(asset, selectedAssets);
            grid.appendChild(thumb);
        });
        
        this.previewsContainer.appendChild(grid);
    }

    createAssetThumbnail(asset, selectedAssets) {
        const thumb = document.createElement('div');
        thumb.className = `asset-thumbnail w-24 h-24 bg-gray-700 rounded-md flex items-center justify-center cursor-pointer p-1 ${
            selectedAssets.has(asset.id) ? 'selected' : ''
        }`;
        thumb.dataset.assetId = asset.id;
        thumb.draggable = true;
        
        if (asset.imgSrc) {
            const img = document.createElement('img');
            img.src = asset.imgSrc;
            img.alt = asset.name;
            img.draggable = false;
            img.onerror = () => { img.style.display = 'none'; };
            thumb.appendChild(img);
        } else {
            // Create colored rectangle as fallback
            const colorDiv = document.createElement('div');
            colorDiv.style.width = '100%';
            colorDiv.style.height = '100%';
            colorDiv.style.backgroundColor = asset.color;
            colorDiv.style.borderRadius = '4px';
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
        // Check if click was on background, not a thumbnail
        if (e.target.closest('.asset-thumbnail')) return;
        
        const mouse = this.stateManager.get('mouse');
        this.stateManager.update({
            'mouse.isAssetMarqueeSelecting': true
        });
        
        if (!e.shiftKey) {
            this.stateManager.set('selectedAssets', new Set());
        }
        
        this.render();
        
        // Create marquee div
        this.marqueeDiv = document.createElement('div');
        this.marqueeDiv.id = 'asset-marquee';
        this.container.appendChild(this.marqueeDiv);
        
        const rect = this.previewsContainer.getBoundingClientRect();
        this.marqueeStart = { x: e.clientX, y: e.clientY };
        this.marqueeDiv.style.left = `${e.clientX - rect.left + this.previewsContainer.scrollLeft}px`;
        this.marqueeDiv.style.top = `${e.clientY - rect.top + this.previewsContainer.scrollTop}px`;
        this.marqueeDiv.style.width = '0px';
        this.marqueeDiv.style.height = '0px';
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
            // Select assets that intersect with marquee
            document.querySelectorAll('.asset-thumbnail').forEach(thumb => {
                const thumbRect = thumb.getBoundingClientRect();
                
                if (marqueeRect.left < thumbRect.right && marqueeRect.right > thumbRect.left &&
                    marqueeRect.top < thumbRect.bottom && marqueeRect.bottom > thumbRect.top) {
                    selectedAssets.add(thumb.dataset.assetId);
                }
            });
            
            this.stateManager.set('selectedAssets', selectedAssets);
        }
        
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
}
