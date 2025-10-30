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
                <span class="text-sm font-medium flex-1" style="color: var(--ui-text-color, #d1d5db);">Content</span>
            </div>
            <div id="folders-tree" class="flex-grow overflow-y-auto p-2 text-sm" style="overflow-x: hidden; word-wrap: nowrap; line-height: 1.2; word-break: keep-all; hyphens: none;">
                <!-- Folder tree will be rendered here -->
            </div>
        `;

        this.folderTree = this.container.querySelector('#folders-tree');


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
            this.folderTree.innerHTML = '<div class="text-center py-4" style="color: var(--ui-text-color, #9ca3af);">No folders available</div>';
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
     * Build folder structure from manifest structure
     * @param {Object} parentFolder - Parent folder object
     * @param {Object} structure - Manifest structure object
     * @param {string} parentPath - Parent path
     */
    buildFromManifestStructure(parentFolder, structure, parentPath) {
        for (const [folderName, subStructure] of Object.entries(structure)) {
            // Remove 'root/' prefix from parentPath if present
            const normalizedParentPath = parentPath.replace(/^root\//, '');
            const folderPath = normalizedParentPath ? `${normalizedParentPath}/${folderName}` : folderName;
            
            // Create folder node
            const folder = {
                name: folderName,
                path: folderPath,
                children: {},
                assets: [],
                isExpanded: false
            };

            // Add to parent
            parentFolder.children[folderName] = folder;


            // Recursively process subfolders
            if (subStructure && typeof subStructure === 'object' && Object.keys(subStructure).length > 0) {
                this.buildFromManifestStructure(folder, subStructure, folderPath);
            }

            // Get assets for this folder from assetManager
            // Check if asset path matches this folder path (with or without 'root/' prefix)
            if (this.assetManager.assets) {
                for (const asset of this.assetManager.assets.values()) {
                    if (!asset.path) continue;
                    
                    // Normalize paths: remove 'root/' prefix if present
                    const normalizedAssetPath = asset.path.replace(/^root\//, '');
                    const normalizedFolderPath = folderPath.replace(/^root\//, '');
                    
                    // Check if asset belongs to this folder (exact match) or its immediate subfolders
                    // Don't add assets that belong to subfolders - they'll be added by their parent folders
                    if (normalizedAssetPath.startsWith(normalizedFolderPath + '/')) {
                        // Check if it's directly in this folder (not in a subfolder)
                        const remainingPath = normalizedAssetPath.substring(normalizedFolderPath.length + 1);
                        if (remainingPath && !remainingPath.includes('/')) {
                            // It's directly in this folder, add it
                            folder.assets.push(asset);
                        }
                    } else if (normalizedAssetPath === normalizedFolderPath) {
                        // Asset is directly in this folder (no subfolder)
                        folder.assets.push(asset);
                    }
                }
            }
        }
    }

    /**
     * Add assets to folder structure that don't fit manifest structure
     * Creates folders as needed for assets not in manifest
     * @param {Object} parentFolder - Parent folder object
     * @param {Iterator} assets - Iterator of asset objects
     */
    addAssetsToStructure(parentFolder, assets) {
        const processedAssets = new Set(); // Track which assets we've already added
        
        // First pass: collect all assets that are already in manifest folders
        for (const asset of assets) {
            if (!asset.path) continue;
            
            const normalizedAssetPath = asset.path.replace(/^root\//, '');
            const pathParts = normalizedAssetPath.split('/').filter(p => p.trim() !== '');
            
            if (pathParts.length === 0) continue; // Skip assets without path
            
            // Try to find folder in structure
            let currentFolder = parentFolder;
            let foundInManifest = false;
            
            for (let i = 0; i < pathParts.length - 1; i++) {
                const folderName = pathParts[i];
                if (currentFolder.children && currentFolder.children[folderName]) {
                    currentFolder = currentFolder.children[folderName];
                    foundInManifest = true;
                } else {
                    foundInManifest = false;
                    break;
                }
            }
            
            if (foundInManifest) {
                // Asset belongs to an existing manifest folder
                // It should already be added by buildFromManifestStructure
                // But check if it's directly in this folder
                const remainingPath = normalizedAssetPath.substring(currentFolder.path.replace(/^root\//, '').length + 1);
                if (remainingPath && !remainingPath.includes('/')) {
                    // It's directly in the folder, mark as processed
                    processedAssets.add(asset.id);
                }
            }
        }
        
        // Second pass: add assets that don't fit manifest structure
        for (const asset of assets) {
            if (!asset.path || processedAssets.has(asset.id)) continue;
            
            const normalizedAssetPath = asset.path.replace(/^root\//, '');
            const pathParts = normalizedAssetPath.split('/').filter(p => p.trim() !== '');
            
            if (pathParts.length === 0) {
                // Asset without path goes to root
                parentFolder.assets.push(asset);
                continue;
            }
            
            // Navigate/create folder hierarchy for this asset
            let currentFolder = parentFolder;
            
            for (let i = 0; i < pathParts.length - 1; i++) {
                const folderName = pathParts[i];
                const folderPath = pathParts.slice(0, i + 1).join('/');
                
                if (!currentFolder.children[folderName]) {
                    // Create folder if it doesn't exist
                    currentFolder.children[folderName] = {
                        name: folderName,
                        path: folderPath,
                        children: {},
                        assets: [],
                        isExpanded: false
                    };
                }
                
                currentFolder = currentFolder.children[folderName];
            }
            
            // Add asset to final folder
            if (!currentFolder.assets.find(a => a.id === asset.id)) {
                currentFolder.assets.push(asset);
            }
        }
    }

    /**
     * Build folder structure from asset manager
     */
    buildFolderStructure() {
        if (!this.assetManager) {
            Logger.ui.error('FoldersPanel: assetManager not available in buildFolderStructure');
            return;
        }

        // Always initialize base folder structure
        const folderStructure = {
            root: {
                name: 'Content',
                path: 'root',
                children: {},
                assets: [],
                isExpanded: true
            }
        };

        // First, create folder structure from manifest
        // This ensures empty folders are included and structure is always up-to-date
        if (this.assetManager.contentStructure) {
            Logger.ui.debug('FoldersPanel: Building folder structure from manifest');
            this.buildFromManifestStructure(folderStructure.root, this.assetManager.contentStructure, 'root');
        }
        
        // Then add any remaining assets that don't fit manifest structure
        if (this.assetManager.assets && this.assetManager.assets.size > 0) {
            Logger.ui.info(`FoldersPanel: Adding assets to structure (${this.assetManager.assets.size} total assets)`);
            this.addAssetsToStructure(folderStructure.root, this.assetManager.assets.values());
        } else {
            // No assets loaded yet; this is normal during initial startup before AssetManager scan completes
            Logger.ui.info('FoldersPanel: No assets loaded yet — waiting for AssetManager scan');
        }
        
        this.folderStructure = folderStructure;
        this.renderFolderContent();
        return;
    }

    /**
     * Render the folder tree
     */
    renderFolderTree() {
        if (!this.folderTree) {
            Logger.ui.error('FoldersPanel: folderTree is null in renderFolderTree');
            return;
        }


        // Helper function to count assets recursively
        const countAssetsRecursive = (folder) => {
            let count = folder.assets ? folder.assets.length : 0;
            // Sort children alphabetically for consistent counting
            const sortedChildren = Object.values(folder.children || {}).sort((a, b) => a.name.localeCompare(b.name));
            for (const child of sortedChildren) {
                count += countAssetsRecursive(child);
            }
            return count;
        };

        const renderFolder = (folder, depth = 0) => {
            const isExpanded = this.expandedFolders.has(folder.path);
            const hasChildren = Object.keys(folder.children).length > 0; // Only check for child folders
            const isSelected = this.selectedFolders.has(folder.path);


            let html = '';

            // Folder header
            // Always show folder icon for folders, even if empty
            const toggleIcon = isExpanded ? '📂' : '📁';
            const expandIcon = Object.keys(folder.children).length > 0 || folder.path === 'root' ?
                (isExpanded ? '▼' : '▶') : '';
            
            // Count assets recursively (including all subfolders)
            const totalAssetsInFolder = countAssetsRecursive(folder);
            const hasAssets = totalAssetsInFolder > 0;
            const textColor = hasAssets ? 'var(--ui-text-color, #d1d5db)' : 'var(--ui-text-color, #6b7280)';

            html += `
                <div class="folder-item ${isSelected ? 'selected' : ''} cursor-pointer p-1 rounded mb-1"
                     data-path="${folder.path}"
                     draggable="true"
                     style="padding-left: ${depth * 16 + 4}px; pointer-events: auto; z-index: 1; display: block; width: 100%; overflow: hidden; line-height: 1.2; height: 24px; word-break: keep-all; hyphens: none;"
                    <div class="flex items-center" style="min-width: 0; width: 100%; position: relative; line-height: 1.2; align-items: center; flex-wrap: nowrap;">
                        ${expandIcon ? `<span class="expand-icon text-xs ${textColor}" style="min-width: 16px; flex-shrink: 0; margin-right: 4px; cursor: pointer;">${expandIcon}</span>` : '<span style="min-width: 16px; flex-shrink: 0; margin-right: 4px;"></span>'}
                        <span class="folder-icon" style="min-width: 20px; flex-shrink: 0; margin-right: 8px;">${toggleIcon}</span>
                        <span class="folder-name truncate" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(100% - 82px); position: relative; z-index: 1; line-height: 1.2; color: ${textColor};">${this.truncateName(folder.name)}</span>
                        <span class="folder-count text-xs" style="white-space: nowrap; min-width: 40px; flex-shrink: 0; text-align: right; margin-left: 4px; color: var(--ui-text-color, #9ca3af);">
                            ${totalAssetsInFolder > 0 ? `(${totalAssetsInFolder})` : ''}
                        </span>
                    </div>
                </div>
            `;

            // Children folders only (only if expanded)
            if (isExpanded) {
                // Render child folders only (assets are not shown in folder tree)
                // Sort children alphabetically by name
                const sortedChildren = Object.values(folder.children).sort((a, b) => a.name.localeCompare(b.name));
                for (const childFolder of sortedChildren) {
                    html += renderFolder(childFolder, depth + 1);
                }
            }

            return html;
        };

        // Render tree starting from root folder (show "Content" in UI)
        let html = '';
        
        // Always render root folder first to ensure it's selectable
        // This ensures assets in root folder are accessible
        const rootFolder = this.folderStructure.root;
        if (rootFolder) {
            // Render root folder with normal styling
            const isRootExpanded = this.expandedFolders.has('root');
            const isRootSelected = this.selectedFolders.has('root');
            const totalAssetsInRoot = countAssetsRecursive(rootFolder);
            
            html += `
                <div class="folder-item ${isRootSelected ? 'selected' : ''} cursor-pointer p-1 rounded mb-1"
                     data-path="root"
                     draggable="true"
                     style="padding-left: 4px; pointer-events: auto; z-index: 1; width: 100%; overflow: hidden; line-height: 1.2; height: 24px; word-break: keep-all; hyphens: none;">
                    <div class="flex items-center" style="min-width: 0; width: 100%; position: relative; line-height: 1.2; align-items: center; flex-wrap: nowrap;">
                        <span class="expand-icon text-xs" style="min-width: 16px; flex-shrink: 0; margin-right: 4px; cursor: pointer;">${Object.keys(rootFolder.children).length > 0 ? (isRootExpanded ? '▼' : '▶') : ''}</span>
                        <span class="folder-icon" style="min-width: 20px; flex-shrink: 0; margin-right: 8px;">${isRootExpanded ? '📂' : '📁'}</span>
                        <span class="folder-name truncate" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(100% - 82px); position: relative; z-index: 1; line-height: 1.2; color: var(--ui-text-color, #d1d5db);">Content</span>
                        <span class="folder-count text-xs" style="white-space: nowrap; min-width: 40px; flex-shrink: 0; text-align: right; margin-left: 4px; color: var(--ui-text-color, #9ca3af);">
                            ${totalAssetsInRoot > 0 ? `(${totalAssetsInRoot})` : ''}
                        </span>
                    </div>
                </div>
            `;
            
            // Render root children if expanded
            if (isRootExpanded) {
                // Sort root children alphabetically by name
                const rootChildren = Object.values(this.folderStructure.root.children || {}).sort((a, b) => a.name.localeCompare(b.name));
                for (const childFolder of rootChildren) {
                    html += renderFolder(childFolder, 1);
                }
            }
        }
        // Count elements in generated HTML
        const folderMatches = (html.match(/class="folder-item"/g) || []).length;
        const assetMatches = (html.match(/class="asset-item"/g) || []).length;
        Logger.ui.info(`FoldersPanel: Generated HTML contains ${folderMatches} folders and ${assetMatches} assets`);

        this.folderTree.innerHTML = html;
        
        // Verify DOM after insertion
        const insertedFolders = this.folderTree.querySelectorAll('.folder-item').length;
        const insertedAssets = this.folderTree.querySelectorAll('.asset-item').length;
        Logger.ui.info(`FoldersPanel: DOM contains ${insertedFolders} folder elements and ${insertedAssets} asset elements`);

        // Verify elements exist after setting HTML
        const folderItems = this.folderTree.querySelectorAll('.folder-item');

        // Add event listeners to folder items
        folderItems.forEach((item) => {
            // Click on folder name - only select
            item.addEventListener('click', (e) => {
                // Check if click was on expand icon
                if (e.target.classList.contains('expand-icon')) {
                    return; // Let expand icon handler deal with it
                }
                
                e.stopPropagation();
                const path = item.dataset.path;
                if (path) {
                    this.selectFolder(path, e);
                }
            });
            
            // Click on expand icon - toggle expansion
            const expandIcon = item.querySelector('.expand-icon');
            if (expandIcon) {
                expandIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const path = item.dataset.path;
                    if (path) {
                        if (e.shiftKey) {
                            // Shift+click: recursive expand/collapse
                            this.toggleFolderExpansionRecursive(path);
                        } else {
                            // Normal click: single level toggle
                            this.toggleFolderExpansion(path);
                        }
                    }
                });
            }
            
            // Setup drag and drop for folder items
            item.addEventListener('dragstart', (e) => {
                const path = item.dataset.path;
                if (path) {
                    e.dataTransfer.setData('application/x-folder-path', path);
                    e.dataTransfer.effectAllowed = 'copy';
                    item.classList.add('dragging');
                }
            });
            
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
            });
        });

    }


    /**
     * Select a folder
     */
    selectFolder(path, event = null) {

        const isShift = event && event.shiftKey;
        const isCtrl = event && (event.ctrlKey || event.metaKey);

        if (isShift && this.shiftAnchor) {
            // Range selection from shiftAnchor to current path
            this.selectFolderRange(this.shiftAnchor, path);
        } else if (isShift) {
            // Shift+click - toggle selection
            if (this.selectedFolders.has(path)) {
                // Already selected - remove if multiple selected
                if (this.selectedFolders.size > 1) {
                    this.selectedFolders.delete(path);
                    // Update shift anchor if needed
                    if (this.shiftAnchor === path) {
                        this.shiftAnchor = Array.from(this.selectedFolders)[0] || null;
                    }
                }
            } else {
                // Not selected - add to selection
                this.selectedFolders.add(path);
                // Set as shift anchor if not already set
                if (!this.shiftAnchor) {
                    this.shiftAnchor = path;
                }
            }
        } else if (isCtrl) {
            // Toggle selection
            if (this.selectedFolders.has(path)) {
                if (this.selectedFolders.size > 1) {
                    this.selectedFolders.delete(path);
                    // Update shift anchor if needed
                    if (this.shiftAnchor === path) {
                        this.shiftAnchor = Array.from(this.selectedFolders)[0] || null;
                    }
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
        
        // Notify state manager about folder selection change
        // This will trigger subscription in AssetPanel which will sync tabs
        // DO NOT call syncFoldersToTabs() here - it causes double sync
        if (this.stateManager) {
            this.stateManager.set('selectedFolders', Array.from(this.selectedFolders));
        }

    }

    selectFolderRange(startPath, endPath) {
        // Range selection: select all folders between startPath and endPath
        // For now, just add both endpoints - full range implementation would require flattening tree
        // Don't clear selection - add to existing selection
        this.selectedFolders.add(startPath);
        this.selectedFolders.add(endPath);
    }

    syncFoldersToTabs() {
        if (!this.assetPanel) return;

        // Sync selected folder to active tab in AssetPanel
        // DO NOT call render() here - subscription to activeAssetTabs will handle it
        if (this.assetPanel.tabsManager) {
            this.assetPanel.tabsManager.syncTabToFolder();
        }
        
    }

    /**
     * Get all categories that have assets in this folder or its subfolders
     * @param {Object} folder - Folder object
     * @returns {Array<string>} Array of category names
     */
    getCategoriesInFolder(folder) {
        const categories = new Set();
        
        // Get categories from assets in this folder
        if (folder.assets) {
            for (const asset of folder.assets) {
                if (asset.category) {
                    categories.add(asset.category);
                }
            }
        }
        
        // Recursively get categories from child folders
        if (folder.children) {
            for (const child of Object.values(folder.children)) {
                const childCategories = this.getCategoriesInFolder(child);
                childCategories.forEach(cat => categories.add(cat));
            }
        }
        
        return Array.from(categories);
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
    }

    /**
     * Toggle folder expansion recursively (all children)
     */
    toggleFolderExpansionRecursive(path) {
        const folder = this.getFolderByPath(path);
        if (!folder) {
            Logger.ui.warn('FoldersPanel: Folder not found for recursive toggle:', path);
            return;
        }

        const isExpanded = this.expandedFolders.has(path);
        Logger.ui.debug('FoldersPanel: Recursive toggle - path:', path, 'isExpanded:', isExpanded, 'folder.children:', Object.keys(folder.children || {}));
        
        if (isExpanded) {
            // Collapse: remove this folder and all its children from expanded
            this.collapseFolderRecursively(path, folder);
        } else {
            // Expand: add this folder and all its children to expanded
            this.expandFolderRecursively(path, folder);
        }
        
        this.renderFolderContent();
    }

    /**
     * Collapse folder and all its children recursively
     */
    collapseFolderRecursively(path, folder) {
        this.expandedFolders.delete(path);
        
        if (folder.children) {
            for (const [childName, childFolder] of Object.entries(folder.children)) {
                const childPath = path === 'root' ? childName : `${path}/${childName}`;
                this.collapseFolderRecursively(childPath, childFolder);
            }
        }
    }

    /**
     * Expand folder and all its children recursively
     */
    expandFolderRecursively(path, folder) {
        this.expandedFolders.add(path);
        
        if (folder.children) {
            for (const [childName, childFolder] of Object.entries(folder.children)) {
                const childPath = path === 'root' ? childName : `${path}/${childName}`;
                this.expandFolderRecursively(childPath, childFolder);
            }
        }
    }

    /**
     * Get folder by path
     */
    getFolderByPath(path) {
        if (!this.folderStructure) {
            Logger.ui.error('FoldersPanel: folderStructure not initialized');
            return null;
        }


        if (!this.folderStructure || !this.folderStructure.root) {
            Logger.ui.error('FoldersPanel: folderStructure or folderStructure.root not initialized');
            return null;
        }

        const parts = path.split('/');
        let current = this.folderStructure.root; // Start from root, not folderStructure

        for (const part of parts) {
            if (part === 'root') {
                continue;
            }
            if (current && current.children) {
                if (current.children[part]) {
                    current = current.children[part];
                } else {
                    return null;
                }
            } else {
                Logger.ui.warn('FoldersPanel: current is null or has no children property. Current:', current);
                return null;
            }
        }
        return current;
    }

    /**
     * Refresh folder structure when assets change
     */
    refresh() {
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
        // Note: Do not call set('selectedFolders') here to avoid recursion
        // syncTabsToFolders only updates visual selection, not state
        this.stateManager.subscribe('activeAssetTabs', (activeTabs) => {
            if (activeTabs && activeTabs.size > 0) {
                // Only update visual selection, don't modify state
                this.syncTabsToFolders(activeTabs);
            }
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
            this.resizeHandler = () => {
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
            };
            window.addEventListener('resize', this.resizeHandler);
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
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
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
                }
            }

            // If no folders found, select root to show all assets
            if (selectedPaths.size === 0 && activeTabs.size > 0) {
                selectedPaths.add('root');
            }

            this.selectedFolders = selectedPaths;
        }

        this.renderFolderContent();
    }
}

