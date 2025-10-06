import { BasePanel } from './BasePanel.js';
import { Logger } from '../utils/Logger.js';

/**
 * Folders panel UI component
 * Shows hierarchical folder structure of assets
 */
export class FoldersPanel extends BasePanel {
    constructor(container, assetManager, stateManager, levelEditor, assetPanel) {
        super(container, stateManager);
        this.assetManager = assetManager;
        this.levelEditor = levelEditor;
        this.assetPanel = assetPanel; // Direct reference to avoid circular dependency
        this.folderTree = null;
        this.expandedFolders = new Set(['root']); // Root is always expanded
        this.selectedFolders = new Set(['root']); // Support multiple selection
        this.shiftAnchor = null; // For shift+click selection
        this.isRendering = false; // Flag to prevent rapid re-rendering

        this.init();
        this.setupEventListeners();
    }

    init() {
        this.renderStructure();
        this.buildFolderStructure();
    }

    /**
     * Render the folders panel structure (only on initialization)
     */
    renderStructure() {
        this.container.innerHTML = `
            <div class="flex border-b border-gray-700 flex-shrink-0 px-3 py-2">
                <span class="text-sm font-medium text-gray-300 flex-1">Folders</span>
                <button id="folders-position-toggle" class="text-gray-400 hover:text-white hover:bg-gray-700 px-1 py-0.5 rounded text-xs" title="Toggle position">
                    ⇄
                </button>
            </div>
            <div id="folders-tree" class="flex-grow overflow-y-auto p-2 text-sm" style="overflow-x: hidden; word-wrap: nowrap; line-height: 1.2; word-break: keep-all; hyphens: none;">
                <!-- Folder tree will be rendered here -->
            </div>
        `;

        this.folderTree = this.container.querySelector('#folders-tree');
        Logger.ui.debug('FoldersPanel: Rendered structure, folderTree element:', this.folderTree);

        if (this.folderTree) {
            Logger.ui.debug('FoldersPanel: folderTree computed style:', window.getComputedStyle(this.folderTree));
            Logger.ui.debug('FoldersPanel: folderTree is visible:', this.folderTree.offsetWidth > 0 && this.folderTree.offsetHeight > 0);
        }

        this.setupPositionToggle();
    }

    /**
     * Render the folders panel UI (updates content only)
     */
    render() {
        // Only re-render if structure is already created
        if (!this.folderTree) {
            this.renderStructure();
        }
        
        // Update folder content without clearing structure
        this.renderFolderContent();
    }

    /**
     * Render folder content (updates only the folder tree content)
     */
    renderFolderContent() {
        if (!this.folderTree) {
            Logger.ui.error('FoldersPanel: folderTree is null in renderFolderContent');
            return;
        }

        if (!this.folderStructure) {
            Logger.ui.debug('FoldersPanel: No folder structure to render');
            this.folderTree.innerHTML = '<div class="text-gray-400 text-center py-4">No folders available</div>';
            return;
        }

        // Prevent rapid re-rendering during resize
        if (this.isRendering) {
            return;
        }
        
        this.isRendering = true;
        requestAnimationFrame(() => {
            this.renderFolderTree();
            this.isRendering = false;
        });
    }

    /**
     * Setup position toggle button
     */
    setupPositionToggle() {
        const toggleBtn = this.container.querySelector('#folders-position-toggle');
        if (toggleBtn && this.assetPanel) {
            toggleBtn.addEventListener('click', () => {
                Logger.ui.debug('FoldersPanel: Position toggle clicked');
                this.assetPanel.toggleFoldersPosition();
            });
        } else {
            Logger.ui.warn('FoldersPanel: Position toggle button or assetPanel not available');
        }
    }

    /**
     * Truncate name to fit available space
     * @param {string} name - Name to truncate
     * @param {number} maxWidth - Maximum width in pixels
     * @returns {string} - Truncated name
     */
    truncateName(name, maxWidth) {
        if (name.length <= 8) return name;
        
        // Get actual container width
        const containerWidth = this.container ? this.container.offsetWidth : 200;
        
        // Calculate available width more precisely
        // Account for: expand icon (16px) + folder icon (20px) + count (40px) + padding (6px) = 82px
        const reservedSpace = 82;
        const availableWidth = Math.max(containerWidth - reservedSpace, 50);
        
        // Use canvas for accurate text measurement
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        
        const fullTextWidth = ctx.measureText(name).width;
        if (fullTextWidth <= availableWidth) return name;
        
        // Truncation with ellipsis in the middle
        const ellipsis = '...';
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        const availableForText = availableWidth - ellipsisWidth;
        
        // Binary search for optimal character count
        let left = 1;
        let right = name.length;
        let bestLength = 0;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const startChars = Math.floor(mid / 2);
            const endChars = Math.ceil(mid / 2);
            
            if (startChars <= 0 || endChars <= 0) break;
            
            const testText = name.substring(0, startChars) + ellipsis + name.substring(name.length - endChars);
            const testWidth = ctx.measureText(testText).width;
            
            if (testWidth <= availableWidth) {
                bestLength = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        if (bestLength <= 0) return name.substring(0, 3) + ellipsis;
        
        const startChars = Math.floor(bestLength / 2);
        const endChars = Math.ceil(bestLength / 2);
        
        return name.substring(0, startChars) + ellipsis + name.substring(name.length - endChars);
    }

    /**
     * Build folder structure from asset manager
     */
    buildFolderStructure() {
        if (!this.assetManager) {
            Logger.ui.error('FoldersPanel: assetManager not available in buildFolderStructure');
            return;
        }

        if (!this.assetManager.assets || this.assetManager.assets.size === 0) {
            Logger.ui.debug('FoldersPanel: No assets available yet, skipping folder structure build');
            return;
        }

        Logger.ui.debug('FoldersPanel: Building folder structure from asset paths, assets count:', this.assetManager.assets.size);
        
        // Debug: Log all asset paths with detailed analysis
        Logger.ui.info('FoldersPanel: === ASSET PATH ANALYSIS ===');
        let assetsWithPaths = 0;
        let deepestLevel = 0;
        for (const [assetId, asset] of this.assetManager.assets) {
            if (asset.path && asset.path.includes('/')) {
                assetsWithPaths++;
                const depth = asset.path.split('/').length - 1;
                deepestLevel = Math.max(deepestLevel, depth);
                Logger.ui.debug(`Asset: ${asset.name} | Path: "${asset.path}" | Depth: ${depth} | Category: ${asset.category}`);
            } else {
                Logger.ui.debug(`Asset: ${asset.name} | Path: "${asset.path || 'EMPTY'}" | NO FOLDER STRUCTURE`);
            }
        }
        Logger.ui.info(`FoldersPanel: Found ${assetsWithPaths} assets with paths, deepest level: ${deepestLevel}`);


        const folderStructure = {
            root: {
                name: 'Assets',
                path: 'root',
                children: {},
                assets: [],
                isExpanded: true
            }
        };

        let totalAssets = 0;

        // Build hierarchical structure from asset paths
        for (const [assetId, asset] of this.assetManager.assets) {
            let assetPath = asset.path || '';

            // Fallback: if no path but has category, create path from category
            if (!assetPath && asset.category && asset.category !== 'Uncategorized') {
                assetPath = `${asset.category}/${asset.name}.png`; // Assume png for simplicity
            }

            if (!assetPath) {
                // Asset without path goes to root
                folderStructure.root.assets.push(asset);
                totalAssets++;
                continue;
            }

            // Split path into parts
            const pathParts = assetPath.split('/').filter(part => part.trim() !== '');

            Logger.ui.debug(`FoldersPanel: Processing asset "${asset.name}" with path "${assetPath}" -> ${pathParts.length} parts: [${pathParts.join(', ')}]`);

            if (pathParts.length === 0) {
                folderStructure.root.assets.push(asset);
                totalAssets++;
                Logger.ui.debug(`FoldersPanel: Added asset "${asset.name}" to root (no path parts)`);
                continue;
            }

            // Navigate/create the folder hierarchy
            let currentFolder = folderStructure.root;

            // Process creating full folder path for each file
            for (let i = 0; i < pathParts.length - 1; i++) { // -1 because last part is filename
                const folderName = pathParts[i];
                const folderPath = 'root/' + pathParts.slice(0, i + 1).join('/');

                if (!currentFolder.children[folderName]) {
                    currentFolder.children[folderName] = {
                        name: folderName,
                        path: folderPath,
                        children: {},
                        assets: [],
                        isExpanded: false
                    };
                    
                    
                    Logger.ui.debug(`FoldersPanel: Created folder ${folderName} at path ${folderPath}`);
                }

                currentFolder = currentFolder.children[folderName];
            }

            // Add asset to the final folder
            currentFolder.assets.push(asset);
            totalAssets++;
            Logger.ui.debug(`FoldersPanel: Added asset "${asset.name}" to folder "${currentFolder.name}" (path: ${currentFolder.path})`);
        }

        Logger.ui.debug('FoldersPanel: Final folder structure:', folderStructure);
        
        // Debug: Log created folder hierarchy
        const logFolderHierarchy = (folder, depth = 0) => {
            const indent = '  '.repeat(depth);
            Logger.ui.debug(`${indent}📁 ${folder.name} (${folder.assets.length} assets, ${Object.keys(folder.children).length} children)`);
            Object.values(folder.children).forEach(child => logFolderHierarchy(child, depth + 1));
        };
        logFolderHierarchy(folderStructure.root);

        // Store total count for root display
        folderStructure.root.totalAssets = totalAssets;

        this.folderStructure = folderStructure;
        Logger.ui.debug('FoldersPanel: Folder structure built from paths');
        this.renderFolderTree();
    }

    /**
     * Render the folder tree
     */
    renderFolderTree() {
        if (!this.folderTree) {
            Logger.ui.error('FoldersPanel: folderTree is null in renderFolderTree');
            return;
        }


        const renderFolder = (folder, depth = 0) => {
            const isExpanded = this.expandedFolders.has(folder.path);
            const hasChildren = Object.keys(folder.children).length > 0 || folder.assets.length > 0;
            const isSelected = this.selectedFolders.has(folder.path);

            Logger.ui.debug(`FoldersPanel: Rendering folder "${folder.name}" (path: ${folder.path}), depth: ${depth}, children: ${Object.keys(folder.children).length}, assets: ${folder.assets.length}, expanded: ${isExpanded}, selected: ${isSelected}`);

            let html = '';

            // Folder header
            const toggleIcon = hasChildren ? (isExpanded ? '📂' : '📁') : '📄';
            const expandIcon = hasChildren && Object.keys(folder.children).length > 0 ?
                (isExpanded ? '▼' : '▶') : '';

            html += `
                <div class="folder-item ${isSelected ? 'selected' : ''} cursor-pointer hover:bg-gray-700 p-1 rounded mb-1"
                     data-path="${folder.path}"
                     style="padding-left: ${depth * 16 + 4}px; pointer-events: auto; z-index: 1; display: block; width: 100%; overflow: hidden; line-height: 1.2; height: 24px; word-break: keep-all; hyphens: none;"
                    <div class="flex items-center" style="min-width: 0; width: 100%; position: relative; line-height: 1.2; align-items: center; flex-wrap: nowrap;">
                        ${expandIcon ? `<span class="expand-icon text-xs" style="min-width: 16px; flex-shrink: 0; margin-right: 4px;">${expandIcon}</span>` : '<span style="min-width: 16px; flex-shrink: 0; margin-right: 4px;"></span>'}
                        <span class="folder-icon" style="min-width: 20px; flex-shrink: 0; margin-right: 8px;">${toggleIcon}</span>
                        <span class="folder-name truncate" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(100% - 82px); position: relative; z-index: 1; line-height: 1.2;">${this.truncateName(folder.name)}</span>
                        <span class="folder-count text-xs text-gray-400" style="white-space: nowrap; min-width: 40px; flex-shrink: 0; text-align: right; margin-left: 4px;">
                            ${folder.path === 'root' ? `(${folder.totalAssets || 0})` : hasChildren ? `(${folder.assets.length})` : ''}
                        </span>
                    </div>
                </div>
            `;

            // Children folders and assets (only if expanded)
            if (isExpanded) {
                Logger.ui.debug(`FoldersPanel: Rendering ${Object.keys(folder.children).length} child folders and ${folder.assets.length} assets for "${folder.name}"`);
                
                // Render child folders first
                for (const childFolder of Object.values(folder.children)) {
                    Logger.ui.debug(`FoldersPanel: Rendering child folder "${childFolder.name}" of "${folder.name}"`);
                    html += renderFolder(childFolder, depth + 1);
                }

                // Then render assets in this folder
                for (const asset of folder.assets) {
                    Logger.ui.debug(`FoldersPanel: Rendering asset "${asset.name}" in folder "${folder.name}"`);
                    html += `
                        <div class="asset-item cursor-pointer hover:bg-gray-700 p-1 rounded mb-1 text-gray-400"
                             data-path="${folder.path}/asset-${asset.id}"
                             data-asset-id="${asset.id}"
                             style="padding-left: ${(depth + 1) * 16 + 4}px; pointer-events: auto; z-index: 1; display: block; width: 100%; overflow: hidden; line-height: 1.2; height: 24px; word-break: keep-all; hyphens: none;"
                            <div class="flex items-center" style="min-width: 0; width: 100%; position: relative; line-height: 1.2; align-items: center; flex-wrap: nowrap;">
                                <span class="asset-icon" style="min-width: 20px; flex-shrink: 0; margin-right: 8px;">📄</span>
                                <span class="asset-name truncate" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(100% - 28px); position: relative; z-index: 1; line-height: 1.2;">${this.truncateName(asset.name)}</span>
                            </div>
                        </div>
                    `;
                }
            } else {
                Logger.ui.debug(`FoldersPanel: Folder "${folder.name}" is collapsed, skipping ${Object.keys(folder.children).length} children and ${folder.assets.length} assets`);
            }

            return html;
        };

        const html = renderFolder(this.folderStructure.root);
        Logger.ui.debug('FoldersPanel: Generated HTML length:', html.length);
        Logger.ui.debug('FoldersPanel: Generated HTML preview:', html.substring(0, 500) + '...');
        
        // Count elements in generated HTML
        const folderMatches = (html.match(/class="folder-item"/g) || []).length;
        const assetMatches = (html.match(/class="asset-item"/g) || []).length;
        Logger.ui.info(`FoldersPanel: Generated HTML contains ${folderMatches} folders and ${assetMatches} assets`);

        this.folderTree.innerHTML = html;
        
        // Verify DOM after insertion
        const insertedFolders = this.folderTree.querySelectorAll('.folder-item').length;
        const insertedAssets = this.folderTree.querySelectorAll('.asset-item').length;
        Logger.ui.info(`FoldersPanel: DOM contains ${insertedFolders} folder elements and ${insertedAssets} asset elements`);
        Logger.ui.debug('FoldersPanel: Folder tree HTML set, calling setupFolderEventListeners');

        // Verify elements exist after setting HTML
        const folderItems = this.folderTree.querySelectorAll('.folder-item');
        const assetItems = this.folderTree.querySelectorAll('.asset-item');
        Logger.ui.debug('FoldersPanel: Found folder items:', folderItems.length, 'asset items:', assetItems.length);

        // Debug: Log data-path attributes
        folderItems.forEach((item, index) => {
            Logger.ui.debug(`FoldersPanel: Folder item ${index}: data-path="${item.dataset.path}" text="${item.textContent.trim()}"`);
        });

        // Try direct event listeners as fallback
        Logger.ui.debug('FoldersPanel: Adding direct event listeners to elements');
        folderItems.forEach((item, index) => {
            Logger.ui.debug('FoldersPanel: Adding listener to folder item', index, item.dataset.path);
            item.addEventListener('click', (e) => {
                Logger.ui.debug('FoldersPanel: Direct folder click handler called');
                e.stopPropagation();
                const path = item.dataset.path;
                if (path) {
                    this.selectFolder(path);
                    const folder = this.getFolderByPath(path);
                    if (folder && folder.children && folder.assets &&
                        (Object.keys(folder.children).length > 0 || folder.assets.length > 0)) {
                        this.toggleFolderExpansion(path);
                    }
                }
            });
        });

        assetItems.forEach((item, index) => {
            Logger.ui.debug('FoldersPanel: Adding listener to asset item', index, item.dataset.assetId);
            item.addEventListener('click', (e) => {
                Logger.ui.debug('FoldersPanel: Direct asset click handler called');
                e.stopPropagation();
                const assetId = item.dataset.assetId;
                if (assetId) {
                    this.selectAsset(assetId);
                }
            });
        });

        this.setupFolderEventListeners();
    }

    /**
     * Setup event listeners for folder items
     */
    setupFolderEventListeners() {
        // Only setup listener once
        if (this.eventListenerAttached) {
            Logger.ui.debug('FoldersPanel: Event listener already attached');
            return;
        }

        const folderTree = this.container.querySelector('#folders-tree');
        if (!folderTree) {
            Logger.ui.error('FoldersPanel: folderTree element not found!');
            return;
        }

        Logger.ui.debug('FoldersPanel: Setting up event listener on folderTree');

        // Add a general click listener to the container to debug
        folderTree.addEventListener('click', (e) => {
            Logger.ui.debug('FoldersPanel: General click on folderTree container', e.target);
        });

        // Use event delegation instead of individual listeners
        folderTree.addEventListener('click', (e) => {
            Logger.ui.debug('FoldersPanel: Click event received', e.target);

            const target = e.target.closest('.folder-item, .asset-item');
            Logger.ui.debug('FoldersPanel: Closest target found:', target);

            if (!target) {
                Logger.ui.debug('FoldersPanel: Click target not found, clicked on:', e.target);
                return;
            }

            e.stopPropagation();

            Logger.ui.debug('FoldersPanel: Target classes:', target.classList);
            Logger.ui.debug('FoldersPanel: Target dataset:', target.dataset);

                if (target.classList.contains('folder-item')) {
                    const path = target.dataset.path;
                    if (!path) {
                        Logger.ui.warn('FoldersPanel: Folder item missing data-path attribute');
                        return;
                    }
                    Logger.ui.debug('FoldersPanel: Clicking folder:', path);
                    this.selectFolder(path, e);

                    // Toggle expansion for folders with children
                    const folder = this.getFolderByPath(path);
                    if (folder && folder.children && folder.assets &&
                        (Object.keys(folder.children).length > 0 || folder.assets.length > 0)) {
                        this.toggleFolderExpansion(path);
                    }
            } else if (target.classList.contains('asset-item')) {
                const assetId = target.dataset.assetId;
                if (!assetId) {
                    Logger.ui.warn('FoldersPanel: Asset item missing data-asset-id attribute');
                    return;
                }
                Logger.ui.debug('FoldersPanel: Clicking asset:', assetId);
                this.selectAsset(assetId);
            } else {
                Logger.ui.debug('FoldersPanel: Target has neither folder-item nor asset-item class');
            }
        });

        this.eventListenerAttached = true;
        Logger.ui.debug('FoldersPanel: Event listener attached successfully');

        // Debug: Add global click listener to check if clicks reach the component
        document.addEventListener('click', (e) => {
            if (this.container.contains(e.target)) {
                Logger.ui.debug('FoldersPanel: Click detected within container', e.target);
            }
        });
    }

    /**
     * Select a folder
     */
    selectFolder(path, event = null) {
        Logger.ui.debug('FoldersPanel: selectFolder called with path:', path, 'event:', event);

        const isShift = event && event.shiftKey;
        const isCtrl = event && (event.ctrlKey || event.metaKey);

        if (isShift && this.shiftAnchor) {
            // Range selection from shiftAnchor to current path
            this.selectFolderRange(this.shiftAnchor, path);
        } else if (isCtrl) {
            // Toggle selection
            if (this.selectedFolders.has(path)) {
                if (this.selectedFolders.size > 1) {
                    this.selectedFolders.delete(path);
                }
            } else {
                this.selectedFolders.add(path);
                this.shiftAnchor = path;
            }
        } else {
            // Single selection
            this.selectedFolders.clear();
            this.selectedFolders.add(path);
            this.shiftAnchor = path;
        }

        this.renderFolderContent();
        this.syncFoldersToTabs();

        Logger.ui.debug('FoldersPanel: Selected folders updated:', Array.from(this.selectedFolders));
    }

    selectFolderRange(startPath, endPath) {
        // For simplicity, implement basic range selection
        // In a full implementation, you'd need to flatten the tree and find range
        this.selectedFolders.clear();
        this.selectedFolders.add(startPath);
        this.selectedFolders.add(endPath);
        Logger.ui.debug('FoldersPanel: Range selection from', startPath, 'to', endPath);
    }

    syncFoldersToTabs() {
        if (!this.assetPanel) return;

        // Convert selected folder paths to categories for tab synchronization
        const selectedCategories = new Set();

        for (const folderPath of this.selectedFolders) {
            if (folderPath === 'root') {
                // Root means show all categories
                this.assetPanel.stateManager.set('activeAssetTabs', new Set(this.assetManager.getCategories()));
                return;
            }

            const folder = this.getFolderByPath(folderPath);
            if (folder) {
                // For now, map folder name to category
                // This could be enhanced to map folder paths to categories more intelligently
                const category = folder.name;
                if (this.assetManager.getCategories().includes(category)) {
                    selectedCategories.add(category);
                }
            }
        }

        if (selectedCategories.size > 0) {
            this.assetPanel.stateManager.set('activeAssetTabs', selectedCategories);
            this.assetPanel.render();
        }
    }

    /**
     * Select an asset
     */
    selectAsset(assetId) {
        // Notify asset panel to select the asset
        if (this.assetPanel) {
            this.assetPanel.selectAsset(assetId);
        } else {
            Logger.ui.warn('FoldersPanel: assetPanel not available for selectAsset');
        }

        Logger.ui.debug('Selected asset:', assetId);
    }

    /**
     * Toggle folder expansion
     */
    toggleFolderExpansion(path) {
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
        } else {
            this.expandedFolders.add(path);
        }
        this.renderFolderContent();
        Logger.ui.debug('Toggled folder expansion:', path);
    }

    /**
     * Get folder by path
     */
    getFolderByPath(path) {
        if (!this.folderStructure) {
            Logger.ui.error('FoldersPanel: folderStructure not initialized');
            return null;
        }

        Logger.ui.debug('FoldersPanel: getFolderByPath called with path:', path);
        Logger.ui.debug('FoldersPanel: folderStructure keys:', Object.keys(this.folderStructure));
        Logger.ui.debug('FoldersPanel: available categories in folderStructure:', Object.keys(this.folderStructure.root.children));

        // Debug: Check what assets exist
        if (this.assetManager) {
            const assetCategories = new Set();
            for (const [assetId, asset] of this.assetManager.assets) {
                assetCategories.add(asset.category || 'Uncategorized');
            }
            Logger.ui.debug('FoldersPanel: asset categories in assetManager:', Array.from(assetCategories));
        }

        if (!this.folderStructure || !this.folderStructure.root) {
            Logger.ui.error('FoldersPanel: folderStructure or folderStructure.root not initialized');
            return null;
        }

        const parts = path.split('/');
        let current = this.folderStructure.root; // Start from root, not folderStructure

        Logger.ui.debug('FoldersPanel: Starting path resolution for:', path, 'parts:', parts, 'starting from root:', current.name);

        for (const part of parts) {
            if (part === 'root') {
                Logger.ui.debug('FoldersPanel: Skipping root part, already at root');
                continue;
            }
            Logger.ui.debug('FoldersPanel: checking part:', part, 'current:', current, 'current.children exists:', !!current.children);
            if (current && current.children) {
                Logger.ui.debug('FoldersPanel: current.children keys:', Object.keys(current.children));
                if (current.children[part]) {
                    current = current.children[part];
                    Logger.ui.debug('FoldersPanel: moved to child:', part, 'new current:', current);
                } else {
                    Logger.ui.debug('FoldersPanel: part not found:', part, 'available children:', Object.keys(current.children));
                    Logger.ui.debug('FoldersPanel: Full folderStructure:', this.folderStructure);
                    return null;
                }
            } else {
                Logger.ui.warn('FoldersPanel: current is null or has no children property. Current:', current);
                return null;
            }
        }

        Logger.ui.debug('FoldersPanel: found folder:', current);
        return current;
    }

    /**
     * Refresh folder structure when assets change
     */
    refresh() {
        Logger.ui.debug('FoldersPanel: Refresh called');
        this.buildFolderStructure();
        // Always re-render, even if buildFolderStructure did nothing
        this.renderFolderContent();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for asset changes
        this.stateManager.subscribe('assetsChanged', () => {
            this.refresh();
        });

        // Listen for tab changes to sync with folder selection
        this.stateManager.subscribe('activeAssetTabs', (activeTabs) => {
            this.syncTabsToFolders(activeTabs);
        });

        // Setup resize observer for dynamic truncation
        this.setupResizeObserver();
    }

    /**
     * Setup resize observer to update truncation when panel size changes
     */
    setupResizeObserver() {
        if (!this.container) return;

        // Track previous size to avoid unnecessary updates
        this.lastContainerWidth = this.container.offsetWidth;
        this.lastContainerHeight = this.container.offsetHeight;

        // Use ResizeObserver if available
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver((entries) => {
                // Check if size actually changed significantly
                const entry = entries[0];
                if (entry) {
                    const { width, height } = entry.contentRect;
                    const widthChanged = Math.abs(width - this.lastContainerWidth) > 5;
                    const heightChanged = Math.abs(height - this.lastContainerHeight) > 5;
                    
                    if (widthChanged || heightChanged) {
                        this.lastContainerWidth = width;
                        this.lastContainerHeight = height;
                        
                        // Debounce the resize event with longer delay
                        clearTimeout(this.resizeTimeout);
                        this.resizeTimeout = setTimeout(() => {
                            this.renderFolderContent();
                        }, 150);
                    }
                }
            });
            this.resizeObserver.observe(this.container);
        } else {
            // Fallback to window resize event
            window.addEventListener('resize', () => {
                const currentWidth = this.container.offsetWidth;
                const currentHeight = this.container.offsetHeight;
                const widthChanged = Math.abs(currentWidth - this.lastContainerWidth) > 5;
                const heightChanged = Math.abs(currentHeight - this.lastContainerHeight) > 5;
                
                if (widthChanged || heightChanged) {
                    this.lastContainerWidth = currentWidth;
                    this.lastContainerHeight = currentHeight;
                    
                    clearTimeout(this.resizeTimeout);
                    this.resizeTimeout = setTimeout(() => {
                        this.renderFolderContent();
                    }, 150);
                }
            });
        }
    }

    /**
     * Cleanup resources when panel is destroyed
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
    }

    syncTabsToFolders(activeTabs) {
        if (!activeTabs) return;

        const selectedPaths = new Set();

        if (activeTabs.size === 0) {
            // No tabs selected, select nothing
            this.selectedFolders.clear();
        } else if (activeTabs.size === this.assetManager.getCategories().length) {
            // All categories selected, select root
            this.selectedFolders.clear();
            this.selectedFolders.add('root');
        } else {
            // Select folders corresponding to active tabs
            // Only select folders that actually exist in the structure
            for (const category of activeTabs) {
                const folderPath = `root/${category}`;
                const folder = this.getFolderByPath(folderPath);
                if (folder) {
                    selectedPaths.add(folderPath);
                    Logger.ui.debug(`FoldersPanel: Found existing folder for tab ${category}: ${folderPath}`);
                } else {
                    Logger.ui.debug(`FoldersPanel: Tab ${category} has no corresponding folder, skipping sync`);
                }
            }

            // If no folders found, select root to show all assets
            if (selectedPaths.size === 0 && activeTabs.size > 0) {
                selectedPaths.add('root');
                Logger.ui.debug('FoldersPanel: No matching folders found, selecting root');
            }

            this.selectedFolders = selectedPaths;
        }

        this.renderFolderContent();
        Logger.ui.debug('FoldersPanel: Synced tabs to folders:', Array.from(this.selectedFolders));
    }
}

