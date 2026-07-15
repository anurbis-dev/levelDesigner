import { Logger } from '../utils/Logger.js';
import { getAssetTypeById } from '../constants/AssetTypes.js';
import { buildTypeIconSvg } from '../constants/AssetTypeIcons.js';
import { ImageUtils } from '../utils/ImageUtils.js';

/**
 * Renders the asset grid/list/details views for AssetPanel.
 * Extracted from AssetPanel.js — Фаза 4.2 рефакторинга (tmp/2D_Editor_REFACTOR_PLAN.md).
 */
export class AssetViewRenderer {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
        this._lastRenderKey = null;
    }

    render() {
        Logger.ui.debug('AssetPanel: render called');
        this.renderTabs();
        this.renderPreviews();

    }

    renderTabs() {
        // DO NOT call syncTabToFolder() here - it modifies state and causes recursion
        // Sync happens only when selectedFolders changes (via subscription)
        if (this.assetPanel.tabsManager) {
            this.assetPanel.tabsManager.render();
        }

        // Render search and filter controls in footer
        this.assetPanel.renderAssetSearchControls();
    }

    renderPreviews() {
        // Get folder paths to show:
        // - If there's an active tab, use it (or multiple if multi-select)
        // - If no tabs exist, use selected folders from FoldersPanel (default behavior)
        const folderPathsToShow = this.assetPanel.getActiveTabPaths();
        const selectedAssets = this.assetPanel.stateManager.get(
            this.assetPanel.uiStateKey('selectedAssets')
        );

        // Collect assets from all selected folders recursively
        const allAssets = [];
        for (const folderPath of folderPathsToShow) {
            const folderAssets = this.assetPanel.getAssetsFromFolder(folderPath);
            allAssets.push(...folderAssets);
        }

        // Remove duplicates by asset ID
        const uniqueAssets = Array.from(new Map(allAssets.map(asset => [asset.id, asset])).values());
        let assetsToShow = uniqueAssets;

        // Apply search and type filters
        assetsToShow = this.assetPanel.filterAssets(assetsToShow);

        // Skip the full DOM teardown/rebuild if nothing that affects the rendered
        // output actually changed since the last call (renderPreviews() is invoked
        // on every keystroke in search, tab switch, filter toggle, etc.). Safe as
        // long as asset identity/order, selection, and view settings are the only
        // inputs to rendering - true today since in-place asset edits (rename, etc.)
        // aren't implemented yet and always go through an ID/list change when they land.
        const renderKey = `${this.assetPanel.viewMode}|${this.assetPanel.assetSize}|${this.assetPanel.gapSize}|` +
            assetsToShow.map(a => a.id).join(',') + '|' +
            Array.from(selectedAssets || []).sort().join(',');
        if (this._lastRenderKey === renderKey) {
            return;
        }
        this._lastRenderKey = renderKey;

        this.assetPanel.previewsContainer.innerHTML = '';

        switch (this.assetPanel.viewMode) {
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
        this.assetPanel.previewsContainer.classList.remove('p-0');
        // No padding for main interface elements

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gap = `calc(${this.assetPanel.gapSize}px * max(var(--spacing-scale, 1.0), 0))`;

        // Calculate dynamic grid columns based on asset size and container width
        const containerWidth = this.assetPanel.previewsContainer.clientWidth;
        const spacingScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing-scale')) || 1.0;
        const scaledGapSize = this.assetPanel.gapSize * spacingScale;
        const columns = Math.max(1, Math.floor((containerWidth + scaledGapSize) / (this.assetPanel.assetSize + scaledGapSize)));

        // Use fixed column width instead of 1fr to prevent jumping
        const columnWidth = this.assetPanel.assetSize;
        grid.style.gridTemplateColumns = `repeat(${columns}, ${columnWidth}px)`;

        assets.forEach(asset => {
            const thumb = this.createAssetThumbnail(asset, selectedAssets);
            grid.appendChild(thumb);
        });

        this.assetPanel.previewsContainer.appendChild(grid);
    }

    /**
     * Render assets in list view
     * @param {Array} assets - Assets to render
     * @param {Set} selectedAssets - Selected asset IDs
     */
    renderListView(assets, selectedAssets) {
        // Restore padding for list view
        this.assetPanel.previewsContainer.classList.remove('p-0');
        // No padding for main interface elements

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexWrap = 'wrap';
        list.style.gap = `calc(${this.assetPanel.gapSize}px * max(var(--spacing-scale, 1.0), 0))`;

        assets.forEach(asset => {
            const item = this.createAssetListItem(asset, selectedAssets);
            list.appendChild(item);
        });

        this.assetPanel.previewsContainer.appendChild(list);
    }

    /**
     * Render assets in details view
     * @param {Array} assets - Assets to render
     * @param {Set} selectedAssets - Selected asset IDs
     */
    renderDetailsView(assets, selectedAssets) {
        // Remove padding from previews container for details view
        // No padding for main interface elements
        this.assetPanel.previewsContainer.classList.add('p-0');

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
        this.assetPanel.previewsContainer.appendChild(header);

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

        this.assetPanel.previewsContainer.appendChild(content);
    }

    createAssetThumbnail(asset, selectedAssets) {
        const thumb = document.createElement('div');
        thumb.className = `asset-thumbnail cursor-pointer ${
            selectedAssets.has(asset.id) ? 'selected' : ''
        }`;
        thumb.style.width = `${this.assetPanel.assetSize}px`;
        thumb.style.height = `${this.assetPanel.assetSize}px`;
        thumb.style.borderRadius = '4px';
        thumb.style.overflow = 'hidden';
        thumb.style.position = 'relative'; // Required for absolute positioning of unsaved indicator
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
        if (this.assetPanel.shouldShowUnsavedIndicator(asset)) {
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
        nameLabel.textContent = displayName;
        nameLabel.title = asset.properties && asset.properties.isTemporary
            ? `${asset.name} - TEMPORARY`
            : asset.name;

        thumb.appendChild(nameLabel);

        // Select on mousedown (not only click): HTML5 draggable often swallows click
        // after micro-movement, so first press only "armed" drag and selection needed a 2nd try.
        this._bindAssetSelectEvents(thumb, asset);
        thumb.addEventListener('dragstart', (e) => this.assetPanel.handleThumbnailDragStart(e, asset));
        thumb.addEventListener('dragend', (e) => this.assetPanel.handleThumbnailDragEnd(e, asset));

        return thumb;
    }

    /**
     * Item select vs click-drag drop onto canvas:
     * - Unselected: select on mousedown (HTML5 drag often swallows click).
     * - Already selected: leave multi intact so dragstart can ship all selectedAssets.
     * - Plain click (no drag) on multi-selected item: sole-select.
     * - After real HTML5 drag: ignore the synthetic click so multi is not collapsed.
     * - Ctrl/Shift: click path only (marquee pending on mousedown).
     * @param {HTMLElement} el
     * @param {object} asset
     */
    _bindAssetSelectEvents(el, asset) {
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.ctrlKey || e.metaKey || e.shiftKey) return;
            this.assetPanel._assetHtmlDragActive = false;
            const selected = this._selectedAssetIdSet();
            // Click-drag to canvas: do not replace multi when pressing an already-selected item.
            if (selected.has(asset.id)) return;
            this.assetPanel.handleItemClick(e, asset);
        });
        el.addEventListener('click', (e) => {
            // dragstart → drop/end often still synthesizes click; skip sole-select then.
            if (this.assetPanel._assetHtmlDragActive) {
                this.assetPanel._assetHtmlDragActive = false;
                return;
            }
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                this.assetPanel.handleItemClick(e, asset);
                return;
            }
            const selected = this._selectedAssetIdSet();
            if (selected.has(asset.id) && selected.size > 1) {
                this.assetPanel.handleItemClick(e, asset);
            }
        });
        el.addEventListener('dblclick', (e) => this.assetPanel.handleItemDoubleClick(e, asset));
    }

    /** @returns {Set<string>} */
    _selectedAssetIdSet() {
        const raw = this.assetPanel.stateManager.get(
            this.assetPanel.uiStateKey('selectedAssets')
        );
        if (raw instanceof Set) return raw;
        if (Array.isArray(raw)) return new Set(raw);
        return new Set();
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
        item.style.width = `${this.assetPanel.assetSize}px`;
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
            const typeIconMarkup = this.getTypeIconMarkup(asset);
            if (typeIconMarkup) {
                previewDiv.style.display = 'flex';
                previewDiv.style.alignItems = 'center';
                previewDiv.style.justifyContent = 'center';
                previewDiv.innerHTML = typeIconMarkup.replace(/width="\d+" height="\d+"/, 'width="12" height="12"');
            }
        }

        item.appendChild(previewDiv);

        // Create name with truncation
        const nameDiv = document.createElement('div');
        nameDiv.className = 'flex-1 text-xs truncate text-center';
        // Color handled by CSS
        const displayName = asset.properties && asset.properties.isTemporary
            ? `⏳ ${asset.name}`
            : asset.name;
        nameDiv.textContent = displayName;
        nameDiv.title = asset.properties && asset.properties.isTemporary
            ? `${asset.name} - TEMPORARY`
            : asset.name; // Full name on hover

        item.appendChild(nameDiv);

        // Event listeners
        this._bindAssetSelectEvents(item, asset);
        item.addEventListener('dragstart', (e) => this.assetPanel.handleThumbnailDragStart(e, asset));
        item.addEventListener('dragend', (e) => this.assetPanel.handleThumbnailDragEnd(e, asset));

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
        preview.style.width = `${this.assetPanel.assetSize * 0.5}px`;
        preview.style.height = `${this.assetPanel.assetSize * 0.5}px`;

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
        this._bindAssetSelectEvents(row, asset);
        row.addEventListener('dragstart', (e) => this.assetPanel.handleThumbnailDragStart(e, asset));
        row.addEventListener('dragend', (e) => this.assetPanel.handleThumbnailDragEnd(e, asset));

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

        // For catalog placeholder types (see constants/AssetTypes.js) show a minimalist
        // type icon instead of the initial-letter text — makes the type recognizable at a glance.
        const typeIconMarkup = this.getTypeIconMarkup(asset);
        if (typeIconMarkup) {
            colorDiv.innerHTML = typeIconMarkup;
        } else {
            colorDiv.textContent = text;
        }
        return colorDiv;
    }

    /**
     * Get inline SVG markup for an asset's catalog type icon, tinted to contrast
     * against the asset's background color. Returns null for non-catalog asset types
     * (regular imported content), which keep the existing initial-letter fallback.
     * @param {Object} asset
     * @returns {string|null}
     */
    getTypeIconMarkup(asset) {
        const typeDef = getAssetTypeById(asset.type);
        if (!typeDef) return null;
        return buildTypeIconSvg(typeDef.id, 'var(--ui-active-text-color, #ffffff)', Math.round(this.assetPanel.assetSize * 0.4) || 20);
    }

    updateGridViewSizes() {
        // Update grid container
        const grid = this.assetPanel.previewsContainer.querySelector('div[style*="display: grid"]');
        if (grid) {
            // Recalculate grid columns
            const containerWidth = this.assetPanel.previewsContainer.clientWidth;
            const spacingScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing-scale')) || 1.0;
            const scaledGapSize = this.assetPanel.gapSize * spacingScale;
            const columns = Math.max(1, Math.floor((containerWidth + scaledGapSize) / (this.assetPanel.assetSize + scaledGapSize)));

            // Update grid template columns
            const columnWidth = this.assetPanel.assetSize;
            grid.style.gridTemplateColumns = `repeat(${columns}, ${columnWidth}px)`;

            // Update gap size
            grid.style.gap = `calc(${this.assetPanel.gapSize}px * max(var(--spacing-scale, 1.0), 0))`;
        }

        // Update all asset thumbnails
        const thumbnails = this.assetPanel.previewsContainer.querySelectorAll('.asset-thumbnail');
        thumbnails.forEach(thumb => {
            // Update size immediately without transitions
            thumb.style.width = `${this.assetPanel.assetSize}px`;
            thumb.style.height = `${this.assetPanel.assetSize}px`;
        });
    }

    /**
     * Get image dimensions from data URL
     * @param {string} dataUrl - Image data URL
     * @returns {Promise<{width: number, height: number}>} Image dimensions
     */
    getImageDimensions(dataUrl) {
        return ImageUtils.getImageDimensions(dataUrl);
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
            'objects': 'image'
        };
        return typeMap[category] || 'image';
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
}
