import { Logger } from '../utils/Logger.js';
import { AssetTabsManager } from './AssetTabsManager.js';
import { FoldersPanel } from './FoldersPanel.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';

/**
 * Folder/tab navigation for AssetPanel — tabsManager/foldersPanel lifecycle,
 * active-folder resolution, folder-position persistence.
 * Extracted from AssetPanel.js — folder/tab navigation.
 */
export class AssetFoldersController {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    /**
     * Initialize AssetTabsManager
     * Must be called after foldersPanel is initialized
     */
    initializeTabsManager() {
        const assetPanel = this.assetPanel;

        if (!assetPanel.tabsContainer) {
            Logger.ui.error('AssetPanel: tabsContainer not available for tabs manager');
            return;
        }

        // Ensure foldersPanel is initialized first
        if (!assetPanel.foldersPanel) {
            Logger.ui.warn('AssetPanel: FoldersPanel not initialized, delaying tabs manager initialization');
            // Retry after a short delay
            setTimeout(() => {
                if (assetPanel.foldersPanel) {
                    this.initializeTabsManager();
                }
            }, 100);
            return;
        }

        // Create two-part structure: left for tabs, right for controls
        let tabsLeftContainer = assetPanel.tabsContainer.querySelector('#asset-tabs-left');
        if (!tabsLeftContainer) {
            const tabsLeft = document.createElement('div');
            tabsLeft.id = 'asset-tabs-left';
            tabsLeft.className = 'flex flex-1';

            const tabsRight = document.createElement('div');
            tabsRight.id = 'asset-tabs-right';
            tabsRight.className = 'flex items-center flex-shrink-0';

            // Clear container and add new structure
            assetPanel.tabsContainer.innerHTML = '';
            assetPanel.tabsContainer.appendChild(tabsLeft);
            assetPanel.tabsContainer.appendChild(tabsRight);

            tabsLeftContainer = tabsLeft;

        }

        assetPanel.tabsManager = new AssetTabsManager(
            tabsLeftContainer,
            assetPanel.stateManager,
            assetPanel.foldersPanel,
            assetPanel.levelEditor,
            assetPanel
        );

    }

    /**
     * Get currently active tab folder paths
     * If no active tab, returns selected folders from FoldersPanel
     * Supports multiple selection
     * @returns {Array<string>} Array of folder paths
     */
    getActiveTabPaths() {
        const assetPanel = this.assetPanel;
        const activeTab = assetPanel.stateManager.get(assetPanel.uiStateKey('activeAssetTab'));
        const activeTabs = assetPanel.stateManager.get(assetPanel.uiStateKey('activeAssetTabs')) || new Set();

        // Always prioritize selected folders from FoldersPanel for content display
        if (assetPanel.foldersPanel?.selectedFolders && assetPanel.foldersPanel.selectedFolders.size > 0) {
            return Array.from(assetPanel.foldersPanel.selectedFolders);
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
        const assetPanel = this.assetPanel;
        if (!assetPanel.foldersPanel || !assetPanel.foldersPanel.folderStructure) {
            Logger.ui.warn('AssetPanel: FoldersPanel not initialized');
            return [];
        }

        const folder = assetPanel.foldersPanel.getFolderByPath(folderPath);
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
        if (this.assetPanel.tabsManager) {
            return this.assetPanel.tabsManager.getFolderName(folderPath);
        }
        return folderPath;
    }

    /**
     * Add tab for folder
     * @param {string} folderPath - Folder path
     */
    addFolderTab(folderPath) {
        if (this.assetPanel.tabsManager) {
            this.assetPanel.tabsManager.addFolderTab(folderPath);
        }
    }

    /**
     * Remove tab for folder
     * @param {string} folderPath - Folder path
     */
    removeFolderTab(folderPath) {
        if (this.assetPanel.tabsManager) {
            this.assetPanel.tabsManager.removeFolderTab(folderPath);
        }
    }

    /**
     * Load folders position from user preferences
     */
    loadFoldersPosition() {
        const savedPosition = this.assetPanel.levelEditor?.userPrefs?.get('foldersPosition');
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
        const assetPanel = this.assetPanel;
        if (!assetPanel.isPrimary) return;
        if (assetPanel.levelEditor?.userPrefs) {
            assetPanel.levelEditor.userPrefs.set('foldersPosition', assetPanel.foldersPosition);
            Logger.ui.debug('Saved folders position to preferences:', assetPanel.foldersPosition);
        }
    }

    /**
     * Create folders container
     */
    createFoldersContainer() {
        const assetPanel = this.assetPanel;

        // Create main container for folders and content (scoped ids for multi-instance)
        const idSuffix = assetPanel.instanceKey || 'primary';
        const mainContainer = document.createElement('div');
        mainContainer.id = `asset-main-container-${idSuffix}`;
        mainContainer.dataset.assetRole = 'main';
        mainContainer.className = 'flex flex-grow overflow-hidden';

        // Create folders container
        assetPanel.foldersContainer = document.createElement('div');
        assetPanel.foldersContainer.id = `asset-folders-container-${idSuffix}`;
        assetPanel.foldersContainer.dataset.assetRole = 'folders';
        assetPanel.foldersContainer.className = 'border-r border-gray-700 flex flex-col flex-shrink-0';
        assetPanel.foldersContainer.style.backgroundColor = 'var(--ui-background-color, #1f2937)';

        // Create resizer for folders panel (unique id per AssetPanel copy)
        assetPanel.foldersResizer = document.createElement('div');
        assetPanel.foldersResizer.id = `folders-resizer-${idSuffix}`;
        assetPanel.foldersResizer.className = 'resizer-x folders-resizer';
        assetPanel.foldersResizer.dataset.assetRole = 'folders-resizer';
        assetPanel.foldersResizer.style.cssText = `
            width: 4px;
            background-color: transparent;
            cursor: ew-resize;
            position: relative;
            z-index: 10;
            flex-shrink: 0;
            align-self: stretch;
        `;

        // Create content container (tabs + previews)
        const contentContainer = document.createElement('div');
        contentContainer.id = `asset-content-container-${idSuffix}`;
        contentContainer.dataset.assetRole = 'content';
        contentContainer.className = 'flex flex-col flex-grow overflow-hidden';

        // Move existing tabs and previews containers into content container
        if (assetPanel.tabsContainer && assetPanel.tabsContainer.parentNode) {
            assetPanel.tabsContainer.parentNode.removeChild(assetPanel.tabsContainer);
            contentContainer.appendChild(assetPanel.tabsContainer);
        }

        if (assetPanel.previewsContainer && assetPanel.previewsContainer.parentNode) {
            assetPanel.previewsContainer.parentNode.removeChild(assetPanel.previewsContainer);
            contentContainer.appendChild(assetPanel.previewsContainer);
        }

        // Add folders and content to main container
        mainContainer.appendChild(assetPanel.foldersContainer);
        mainContainer.appendChild(contentContainer);

        // Add main container to asset panel
        assetPanel.container.appendChild(mainContainer);
    }

    /**
     * Initialize FoldersPanel
     */
    initializeFoldersPanel() {
        const assetPanel = this.assetPanel;

        if (!assetPanel.foldersContainer) {
            Logger.ui.error('AssetPanel: foldersContainer not created yet');
            return;
        }

        if (!assetPanel.assetManager) {
            Logger.ui.error('AssetPanel: assetManager not available');
            return;
        }

        if (!assetPanel.stateManager) {
            Logger.ui.error('AssetPanel: stateManager not available');
            return;
        }

        if (!assetPanel.levelEditor) {
            Logger.ui.error('AssetPanel: levelEditor not available');
            return;
        }

        Logger.ui.debug('AssetPanel: Initializing FoldersPanel');
        assetPanel.foldersPanel = new FoldersPanel(assetPanel.foldersContainer, assetPanel.assetManager, assetPanel.stateManager, assetPanel.levelEditor, assetPanel);
    }

    /**
     * Update folders layout based on position
     */
    updateFoldersLayout() {
        const assetPanel = this.assetPanel;
        const mainContainer = assetPanel.container.querySelector('[data-asset-role="main"]')
            || assetPanel.container.querySelector('#asset-main-container')
            || assetPanel.container.querySelector('[id^="asset-main-container"]');
        const foldersContainer = assetPanel.foldersContainer
            || assetPanel.container.querySelector('[data-asset-role="folders"]');
        const contentContainer = assetPanel.container.querySelector('[data-asset-role="content"]')
            || assetPanel.container.querySelector('#asset-content-container')
            || assetPanel.container.querySelector('[id^="asset-content-container"]');

        if (!mainContainer || !foldersContainer || !contentContainer) return;

        // Reorder without wiping (keeps resizer node + collapse-tab handlers)
        while (mainContainer.firstChild) {
            mainContainer.removeChild(mainContainer.firstChild);
        }

        if (assetPanel.foldersPosition === 'left') {
            // Folders on left, content on right
            mainContainer.appendChild(foldersContainer);
            mainContainer.appendChild(assetPanel.foldersResizer);
            mainContainer.appendChild(contentContainer);
            foldersContainer.className = 'bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0';
            contentContainer.className = 'flex flex-col flex-grow overflow-hidden';
        } else {
            // Content on left, folders on right
            mainContainer.appendChild(contentContainer);
            mainContainer.appendChild(assetPanel.foldersResizer);
            mainContainer.appendChild(foldersContainer);
            contentContainer.className = 'flex flex-col flex-grow overflow-hidden';
            foldersContainer.className = 'bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0';
        }

        // Re-append tabs and previews to content container
        contentContainer.appendChild(assetPanel.tabsContainer);
        contentContainer.appendChild(assetPanel.previewsContainer);

        // Re-register resizer to update position-aware handlers with current position
        this.setupFoldersResizer();
    }

    /**
     * Toggle folders position (left/right)
     */
    toggleFoldersPosition() {
        const assetPanel = this.assetPanel;
        assetPanel.foldersPosition = assetPanel.foldersPosition === 'left' ? 'right' : 'left';
        this.saveFoldersPosition();
        this.updateFoldersLayout();
        Logger.ui.info(`Folders panel moved to ${assetPanel.foldersPosition}`);
    }

    /**
     * Filter assets by selected folder
     */
    filterByFolder(folder) {
        const assetPanel = this.assetPanel;
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
        if (assetPanel.foldersPanel) {
            assetPanel.foldersPanel.selectFolder(folder.path, null);
        }

        Logger.ui.debug(`Filtered assets by folder: ${folder.path}`);
    }

    /**
     * Setup folders panel resizer
     */
    setupFoldersResizer() {
        const assetPanel = this.assetPanel;
        if (!assetPanel.foldersResizer || !assetPanel.levelEditor?.resizerManager) return;

        // Unregister old handlers if they exist to prevent duplicates
        assetPanel.levelEditor.resizerManager.unregisterResizer(assetPanel.foldersResizer);
        eventHandlerManager.unregisterElement(assetPanel.foldersResizer);

        // Double click / collapse-tab: toggle folders strip; show expand tab when collapsed
        const onDoubleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const foldersEl = assetPanel.foldersContainer;
            if (!foldersEl) return;

            const isCollapsed = foldersEl.style.display === 'none'
                || foldersEl.offsetWidth <= 0
                || assetPanel.foldersResizer.classList.contains('collapsed');
            const containerWidth = assetPanel.container.clientWidth;
            const maxWidth = Math.max(48, containerWidth - 4);

            if (isCollapsed) {
                const restore = assetPanel._foldersWidthBeforeCollapse
                    || (assetPanel.isPrimary
                        ? assetPanel.levelEditor?.userPrefs?.get('foldersWidth')
                        : assetPanel.getCopyUiState()?.foldersWidth)
                    || 192;
                const newWidth = Math.min(Math.max(restore, 48), maxWidth);
                foldersEl.style.width = newWidth + 'px';
                foldersEl.style.flexShrink = '0';
                foldersEl.style.flexGrow = '0';
                assetPanel.updateContentVisibility(newWidth);
                this._persistFoldersWidth(newWidth);
            } else {
                const currentWidth = foldersEl.offsetWidth || 192;
                assetPanel._foldersWidthBeforeCollapse = currentWidth;
                foldersEl.style.width = '0px';
                assetPanel.updateContentVisibility(0);
                this._persistFoldersWidth(0);
            }
        };

        // Register with unified ResizerManager (owner = this AssetPanel instance)
        assetPanel.levelEditor.resizerManager.registerResizer(
            assetPanel.foldersResizer,
            assetPanel.foldersContainer,
            'folders',
            'horizontal',
            onDoubleClick,
            { assetPanel }
        );

        // Load width once (primary: prefs; copies: D1 per-leaf or seed from primary)
        if (!assetPanel._foldersResizerWidthApplied) {
            assetPanel._foldersResizerWidthApplied = true;
            let width = null;
            if (assetPanel.isPrimary && assetPanel.levelEditor?.userPrefs) {
                const saved = assetPanel.levelEditor.userPrefs.get('foldersWidth');
                if (typeof saved === 'number' && saved >= 0) width = saved;
            } else if (!assetPanel.isPrimary) {
                const copyW = assetPanel.getCopyUiState()?.foldersWidth;
                if (typeof copyW === 'number' && copyW >= 0) {
                    width = copyW;
                } else {
                    const primaryW = assetPanel.levelEditor?.assetPanel?.foldersContainer?.offsetWidth;
                    if (typeof primaryW === 'number' && primaryW > 0) {
                        width = primaryW;
                    } else {
                        const saved = assetPanel.levelEditor?.userPrefs?.get('foldersWidth');
                        if (typeof saved === 'number' && saved >= 0) width = saved;
                    }
                }
            }
            if (width !== null) {
                assetPanel.foldersContainer.style.width = width + 'px';
                assetPanel.foldersContainer.style.flexShrink = '0';
                assetPanel.foldersContainer.style.flexGrow = '0';
                assetPanel.updateContentVisibility(width);
                setTimeout(() => {
                    if (assetPanel.viewMode === 'grid') {
                        assetPanel.viewRenderer.updateGridViewSizes();
                    }
                }, 0);
                Logger.ui.debug('Loaded folders width:', width, assetPanel.instanceKey || 'primary');
            }
        }

        Logger.ui.debug('AssetPanel: Setup folders resizer with unified ResizerManager');
    }

    /**
     * Persist folders width — primary → global prefs; copy → D1 per-leaf map.
     * @param {number} width
     */
    _persistFoldersWidth(width) {
        const assetPanel = this.assetPanel;
        if (!assetPanel.isPrimary) {
            assetPanel.patchCopyUiState({ foldersWidth: width });
            return;
        }
        if (assetPanel.levelEditor?.stateManager) {
            assetPanel.levelEditor.stateManager.set('panels.foldersWidth', width);
        }
        if (assetPanel.levelEditor?.userPrefs) {
            assetPanel.levelEditor.userPrefs.set('foldersWidth', width);
        }
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
     * Get active tab name
     */
    getActiveTab() {
        const activeTab = this.assetPanel.container.querySelector('.asset-tab.active');
        return activeTab ? activeTab.dataset.category : null;
    }
}
