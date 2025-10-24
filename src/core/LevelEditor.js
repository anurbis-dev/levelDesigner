import { StateManager } from '../managers/StateManager.js';
import { HistoryManager } from '../managers/HistoryManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { FileManager } from '../managers/FileManager.js';
import { ConfigManager } from '../managers/ConfigManager.js';
import { CacheManager } from '../managers/CacheManager.js';
import { TouchSupportManager } from '../managers/TouchSupportManager.js';
import { SearchSectionUtils } from '../utils/SearchSectionUtils.js';
import { CanvasRenderer } from '../ui/CanvasRenderer.js';
import { AssetPanel } from '../ui/AssetPanel.js';
import { DetailsPanel } from '../ui/DetailsPanel.js';
import { OutlinerPanel } from '../ui/OutlinerPanel.js';
import { LayersPanel } from '../ui/LayersPanel.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { Toolbar } from '../ui/Toolbar.js';
import { Level } from '../models/Level.js';
import { GameObject } from '../models/GameObject.js';
import { Group } from '../models/Group.js';
import { duplicateRenderUtils } from '../utils/DuplicateUtils.js';

// Import new modules
import { EventHandlers } from '../event-system/EventHandlers.js';
import { MouseHandlers } from '../event-system/MouseHandlers.js';
import { ObjectOperations } from './ObjectOperations.js';
import { GroupOperations } from './GroupOperations.js';
import { RenderOperations } from './RenderOperations.js';
import { DuplicateOperations } from './DuplicateOperations.js';
import { HistoryOperations } from './HistoryOperations.js';
import { LayerOperations } from './LayerOperations.js';
import { ViewportOperations } from './ViewportOperations.js';
import { LevelFileOperations } from './LevelFileOperations.js';
import { MenuManager } from '../managers/MenuManager.js';
import { ContextMenuManager } from '../managers/ContextMenuManager.js';
import { CanvasContextMenu } from '../ui/CanvasContextMenu.js';
import { Logger } from '../utils/Logger.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { dialogReplacer } from '../utils/DialogReplacer.js';
import { ActorPropertiesWindow } from '../ui/ActorPropertiesWindow.js';
import { PanelPositionManager } from '../ui/PanelPositionManager.js';
import { TouchInitializationManager } from '../managers/TouchInitializationManager.js';
import { BrowserGesturePreventionManager } from '../managers/BrowserGesturePreventionManager.js';
import { autoEventHandlerManager } from '../event-system/AutoEventHandlerManager.js';

// Import new utilities
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { ComponentLifecycle } from './ComponentLifecycle.js';
import { searchManager } from '../utils/SearchManager.js';

/**
 * Main Level Editor class - Unified version with modular architecture
 * @version dynamic - Utility Architecture
 */
export class LevelEditor {
    /**
     * Current version of the Level Editor
     * @static
     * @type {string}
     */
    static VERSION = '3.52.5';

    constructor(userPreferencesManager = null) {
                // Initialize ErrorHandler first
                ErrorHandler.init();
                Logger.lifecycle.info('ErrorHandler initialized');
        
        // Create lifecycle manager
        this.lifecycle = new ComponentLifecycle();
        
        // Initialize managers
        this.stateManager = new StateManager();
        this.historyManager = new HistoryManager();
        this.assetManager = new AssetManager(this.stateManager);
        this.fileManager = new FileManager();
        this.browserGesturePreventionManager = new BrowserGesturePreventionManager();
        this.touchSupportManager = new TouchSupportManager(this.stateManager, this.browserGesturePreventionManager);
        this.touchInitializationManager = new TouchInitializationManager(this);
        
        // Store user preferences manager
        this.userPrefs = userPreferencesManager;

        // Use ConfigManager from UserPreferencesManager if available, otherwise create new one
        this.configManager = userPreferencesManager?.configManager || null;

        // Initialize subscriptions array for StateManager listeners
        this.subscriptions = [];
        
        // Replace browser dialogs with custom ones
        dialogReplacer.replace();
        
        // Initialize UI components
        this.canvasRenderer = null;
        this.assetPanel = null;
        this.detailsPanel = null;
        this.outlinerPanel = null;
        this.layersPanel = null;
        this.settingsPanel = null;
        this.toolbar = null;
        this.canvasContextMenu = null;
        
        // Current level
        this.level = null;

        // Cached level statistics for quick access
        this.cachedLevelStats = null;
        
        // Initialize MenuManager (will be set up in init() after DOM is ready)
        this.menuManager = null;

        // Initialize ContextMenuManager
        this.contextMenuManager = new ContextMenuManager();

        // Initialize Panel Position Manager
        this.panelPositionManager = new PanelPositionManager(this);
        this.lifecycle.register('panelPositionManager', this.panelPositionManager, { priority: 2 });

        // Initialize CacheManager
        this.cacheManager = new CacheManager(this);
        this.lifecycle.register('cacheManager', this.cacheManager, { priority: 5 });

        // Initialize operation modules
        this.eventHandlers = new EventHandlers(this);
        this.mouseHandlers = new MouseHandlers(this);
        this.objectOperations = new ObjectOperations(this);
        this.groupOperations = new GroupOperations(this);
        this.renderOperations = new RenderOperations(this);
        this.duplicateOperations = new DuplicateOperations(this);
        this.historyOperations = new HistoryOperations(this);
        this.layerOperations = new LayerOperations(this);
        this.viewportOperations = new ViewportOperations(this);
        this.levelFileOperations = new LevelFileOperations(this);
        
        // Register core handlers in lifecycle (highest priority - destroyed first)
        this.lifecycle.register('eventHandlers', this.eventHandlers, { priority: 10 });
        this.lifecycle.register('historyOperations', this.historyOperations, { priority: 9 });
        this.lifecycle.register('layerOperations', this.layerOperations, { priority: 8 });
        this.lifecycle.register('viewportOperations', this.viewportOperations, { priority: 7 });
        this.lifecycle.register('levelFileOperations', this.levelFileOperations, { priority: 6 });
        
        // Store reference to duplicate render utils
        this.duplicateRenderUtils = duplicateRenderUtils;
    }

    /**
     * Cache management methods (delegated to CacheManager)
     */
    getCachedObject(objId) {
        return this.cacheManager.getCachedObject(objId);
    }

    getCachedTopLevelObject(objId) {
        return this.cacheManager.getCachedTopLevelObject(objId);
    }

    getCachedEffectiveLayerId(obj) {
        return this.cacheManager.getCachedEffectiveLayerId(obj);
    }

    clearCaches() {
        this.cacheManager.clearCaches();
    }

    invalidateObjectCaches(objId) {
        this.cacheManager.invalidateObjectCaches(objId);
    }

    clearSelectableObjectsCache() {
        this.cacheManager.clearSelectableObjectsCache();
    }

    /**
     * Get selectable objects within viewport (delegated to CacheManager)
     * @returns {Set<string>} Set of selectable object IDs in viewport
     */
    getSelectableObjectsInViewport() {
        return this.cacheManager.getSelectableObjectsInViewport();
    }

    /**
     * Update group edit mode references after undo/redo restore
     * @param {Object|null} savedGroupEditMode - Saved group edit mode state from history
     */
    updateGroupEditModeAfterRestore(savedGroupEditMode) {
        // If no saved state or not active, exit group edit mode
        if (!savedGroupEditMode || !savedGroupEditMode.isActive) {
            this.stateManager.set('groupEditMode', {
                isActive: false,
                group: null,
                openGroups: []
            });
            // Clear _isEditing flag from all groups since we're exiting group edit mode
            this.level.objects.forEach(obj => {
                if (obj.type === 'group') {
                    delete obj._isEditing;
                    delete obj.originalChildren;
                    this.clearGroupEditingFlagsRecursive(obj);
                }
            });
            return;
        }

        // Restore group edit mode from saved state
        const activeGroupId = savedGroupEditMode.groupId;
        const openGroupIds = savedGroupEditMode.openGroupIds || [];

        // Validate consistency: activeGroupId should be the last element in openGroupIds
        // This ensures proper nesting hierarchy (parent -> child -> grandchild)
        if (openGroupIds.length > 0 && openGroupIds[openGroupIds.length - 1] !== activeGroupId) {
            Logger.lifecycle.warn('Inconsistent group state: activeGroupId does not match last openGroupId. Exiting group edit mode.');
            this.stateManager.set('groupEditMode', {
                isActive: false,
                group: null,
                openGroups: []
            });
            return;
        }

        // Check if the active group still exists in the restored level
        const activeGroup = this.getCachedObject(activeGroupId);
        if (!activeGroup || activeGroup.type !== 'group') {
            // Active group no longer exists, exit group edit mode
            this.stateManager.set('groupEditMode', {
                isActive: false,
                group: null,
                openGroups: []
            });
            return;
        }

        // Restore references to open groups
        const updatedOpenGroups = openGroupIds
            .map(groupId => this.getCachedObject(groupId))
            .filter(group => group && group.type === 'group');

        // Validate that activeGroup is in the restored openGroups
        // If not, it means the group hierarchy was broken - exit group edit mode
        if (updatedOpenGroups.length === 0 || !updatedOpenGroups.some(g => g.id === activeGroupId)) {
            Logger.lifecycle.warn('Active group not found in restored openGroups. Exiting group edit mode.');
            this.stateManager.set('groupEditMode', {
                isActive: false,
                group: null,
                openGroups: []
            });
            return;
        }

        // Validate nesting hierarchy: each group (except first) should be a child of the previous group
        // This ensures the restored state maintains proper parent->child relationships
        for (let i = 1; i < updatedOpenGroups.length; i++) {
            const parentGroup = updatedOpenGroups[i - 1];
            const childGroup = updatedOpenGroups[i];
            
            // Check if childGroup is a direct child of parentGroup
            const isDirectChild = parentGroup.children && parentGroup.children.some(c => c.id === childGroup.id);
            
            if (!isDirectChild) {
                Logger.lifecycle.warn(`Broken nesting hierarchy: ${childGroup.id} is not a child of ${parentGroup.id}. Exiting group edit mode.`);
                this.stateManager.set('groupEditMode', {
                    isActive: false,
                    group: null,
                    openGroups: []
                });
                return;
            }
        }

        // Clear ALL _isEditing flags first
        this.level.objects.forEach(obj => {
            if (obj.type === 'group') {
                delete obj._isEditing;
                delete obj.originalChildren;
                this.clearGroupEditingFlagsRecursive(obj);
            }
        });

        // Set _isEditing flag ONLY for groups that should be open
        updatedOpenGroups.forEach(openGroup => {
            openGroup._isEditing = true;
            // Don't set originalChildren here - it will be managed by group operations
        });

        // Restore group edit mode state with all required properties
        // Note: activeGroup should be the LAST group in openGroups (deepest nested)
        const updatedGroupEditMode = {
            isActive: true,
            groupId: activeGroupId,  // ID of the active (deepest) group
            group: activeGroup,      // Reference to the active group
            openGroups: updatedOpenGroups,
            originalChildren: activeGroup.children ? [...activeGroup.children] : [], // Snapshot of children
            frameFrozen: savedGroupEditMode.frameFrozen || false,
            frozenBounds: null // Clear frozen bounds, will be recalculated
        };

        this.stateManager.set('groupEditMode', updatedGroupEditMode);

        // Note: render() and updateAllPanels() will be called by undo/redo methods
        // No need to call them here to avoid double rendering
    }

    /**
     * Recursively clear _isEditing and originalChildren flags from group children
     * @param {Object} group - Group to clear flags from
     */
    clearGroupEditingFlagsRecursive(group) {
        if (!group.children) return;
        
        group.children.forEach(child => {
            if (child.type === 'group') {
                delete child._isEditing;
                delete child.originalChildren;
                this.clearGroupEditingFlagsRecursive(child);
            }
        });
    }

    /**
     * Schedule cache invalidation (debounced for performance)
     */
    /**
     * Cache invalidation methods (delegated to CacheManager)
     */
    smartCacheInvalidation(invalidationSpec = {}) {
        this.cacheManager.smartCacheInvalidation(invalidationSpec);
    }

    invalidateAfterLayerChanges(changedObjectIds, affectedLayers) {
        this.cacheManager.invalidateAfterLayerChanges(changedObjectIds, affectedLayers);
    }

    invalidateAfterGroupOperations(affectedObjectIds) {
        this.cacheManager.invalidateAfterGroupOperations(affectedObjectIds);
    }

    invalidateAfterDuplicateOperations(newObjectIds) {
        this.cacheManager.invalidateAfterDuplicateOperations(newObjectIds);
    }

    scheduleCacheInvalidation() {
        this.cacheManager.scheduleCacheInvalidation();
    }

    /**
     * Safe logging method that works even if Logger is not available
     */
    log(level, message, ...args) {
        try {
            if (typeof Logger !== 'undefined' && Logger.event && Logger.event[level]) {
                Logger.event[level](message, ...args);
            } else {
                console[level === 'error' ? 'error' : 'log'](`[EVENT] ${message}`, ...args);
            }
        } catch (error) {
        }
    }

    /**
     * Initialize the editor
     */
    async init() {
        try {
            this.log('info', `🚀 Level Editor v${LevelEditor.VERSION} - Utility Architecture`);
            this.log('info', 'Initializing editor components...');
        
            await this.initializeConfiguration();
            const domElements = this.initializeDOMElements();
            this.initializeRenderer(domElements.canvas);
            this.initializeUIComponents(domElements);
            this.initializeMenuAndEvents();
            await this.initializeLevelAndData();
            await this.finalizeInitialization();
            
        } catch (error) {
            this.log('error', 'Failed to initialize editor:', error.message);
            throw error;
        }
    }

    /**
     * Initialize configuration manager and apply settings
     * @private
     */
    async initializeConfiguration() {
        // Initialize configuration manager if not already set
        if (!this.configManager) {
            this.configManager = new ConfigManager();
        }
        
        // Wait for configuration to be fully loaded
        await this.configManager.loadAllConfigsAsync();
        
        // Verify configuration is ready
        if (!this.configManager.isConfigReady()) {
            this.log('warn', 'Configuration not ready after loading, using fallback');
        }
        
        // Apply configuration settings after loading
        this.applyConfiguration();

        // Initialize view states if all required components are ready
        // This handles the case where configurations were loaded asynchronously
        if (this.eventHandlers && this.stateManager && this.userPrefs) {
            // Defer view state initialization to ensure UI components are ready
            setTimeout(() => {
                if (this.eventHandlers && this.configManager?.isConfigReady()) {
                    this.log('info', 'Initializing deferred view states after config load');
                    this.eventHandlers.initializeViewStates();
                }
            }, 0);
        }
    }

    /**
     * Get and validate required DOM elements
     * @private
     * @returns {Object} DOM elements
     */
    initializeDOMElements() {
        const canvas = document.getElementById('main-canvas');
        const assetsPanel = document.getElementById('assets-panel');
        const detailsPanel = document.getElementById('details-content-panel');
        const outlinerPanel = document.getElementById('outliner-content-panel');
        const layersPanel = document.getElementById('layers-content-panel');
        const toolbarContainer = document.getElementById('toolbar-container');
        const actorPropsPanelContainer = document.getElementById('actor-properties-panel');

        if (!canvas || !assetsPanel || !detailsPanel || !outlinerPanel || !layersPanel || !toolbarContainer) {
            throw new Error('Required DOM elements not found');
        }
        
        return {
            canvas,
            assetsPanel,
            detailsPanel,
            outlinerPanel,
            layersPanel,
            toolbarContainer,
            actorPropsPanelContainer
        };
    }

    /**
     * Initialize canvas renderer and context menu
     * @private
     * @param {HTMLCanvasElement} canvas - Canvas element
     */
    initializeRenderer(canvas) {
        // Initialize renderer
        this.canvasRenderer = new CanvasRenderer(canvas);
        this.canvasRenderer.resizeCanvas();
        this.lifecycle.register('canvasRenderer', this.canvasRenderer, { priority: 1 });
        
        // Register CanvasRenderer in StateManager for AssetManager sync
        this.stateManager.set('canvasRenderer', this.canvasRenderer);

        // Initialize canvas context menu
        this.canvasContextMenu = new CanvasContextMenu(canvas, this, {
            onDuplicate: (objects) => this.duplicateSelectedObjects(),
            onDelete: (objects) => this.deleteSelectedObjects(),
            onCopy: () => this.copySelectedObjects(),
            onPaste: () => this.pasteObjects(),
            onCut: () => this.cutSelectedObjects(),
            onGroup: () => this.groupSelectedObjects(),
            onUngroup: () => this.ungroupSelectedObjects(),
            onZoomIn: () => this.zoomIn(),
            onZoomOut: () => this.zoomOut(),
            onZoomFit: () => this.zoomToFit(),
            onResetView: () => this.resetView()
        });

        // Register canvas context menu with the manager
        this.contextMenuManager.registerMenu('canvas', this.canvasContextMenu);

        // Touch gestures for canvas will be initialized by TouchInitializationManager
        
        // Initialize browser gesture prevention system
        this.browserGesturePreventionManager.initialize();
    }





    /**
     * Initialize UI components (panels, toolbar, etc.)
     * @private
     * @param {Object} domElements - DOM elements
     */
    initializeUIComponents(domElements) {
        const { assetsPanel, detailsPanel, outlinerPanel, layersPanel, toolbarContainer } = domElements;

        // Initialize UI panels
        this.assetPanel = new AssetPanel(assetsPanel, this.assetManager, this.stateManager, this);
        this.detailsPanel = new DetailsPanel(detailsPanel, this.stateManager, this);
        this.outlinerPanel = new OutlinerPanel(outlinerPanel, this.stateManager, this);
        this.layersPanel = new LayersPanel(layersPanel, this.stateManager, this);
        this.settingsPanel = new SettingsPanel(document.body, this.configManager, this);
        
        // Initialize Actor Properties Window
        this.actorPropertiesWindow = new ActorPropertiesWindow(document.body, this.stateManager, this);
        
        // Register all UI components in lifecycle manager
        this.lifecycle.register('assetPanel', this.assetPanel, { priority: 3 });
        this.lifecycle.register('detailsPanel', this.detailsPanel, { priority: 3 });
        this.lifecycle.register('outlinerPanel', this.outlinerPanel, { priority: 3 });
        this.lifecycle.register('layersPanel', this.layersPanel, { priority: 3 });
        this.lifecycle.register('settingsPanel', this.settingsPanel, { priority: 2 });
        this.lifecycle.register('actorPropertiesWindow', this.actorPropertiesWindow, { priority: 2 });
        
        // Initial render of asset panel
        this.assetPanel.render();
        
        // Create new level
        this.level = this.fileManager.createNewLevel();
        
        // Initialize toolbar after level is created
        this.toolbar = new Toolbar(toolbarContainer, this.stateManager, this);
        this.lifecycle.register('toolbar', this.toolbar, { priority: 4 });
        
        // Apply configuration to level settings
        this.applyConfigurationToLevel();
    }

    /**
     * Initialize menu manager and event listeners
     * @private
     */
    initializeMenuAndEvents() {
        // Initialize MenuManager
        const menuContainer = document.getElementById('menu-container');
        const navElement = menuContainer?.closest('nav');
        if (navElement) {
            this.menuManager = new MenuManager(navElement, this.eventHandlers);
            this.menuManager.initialize();
            this.lifecycle.register('menuManager', this.menuManager, { priority: 5 });

            // Update EventHandlers with MenuManager reference
            this.eventHandlers.menuManager = this.menuManager;
        } else {
            Logger.ui.warn('Navigation element not found, menu functionality will be limited');
        }

        // Setup event listeners
        this.eventHandlers.setupEventListeners();

        // Setup panel size listeners for StateManager changes
        this.setupPanelSizeListeners();
    }

    /**
     * Setup listeners for panel size changes from StateManager
     * @private
     */
    setupPanelSizeListeners() {
        // Listen for right panel width changes
        const rightPanelUnsubscribe = this.stateManager.subscribe('panels.rightPanelWidth', (width) => {
            const rightPanel = document.getElementById('right-panel');
            if (rightPanel && width !== undefined) {
                if (width === 0) {
                    // Hide panel completely when collapsed
                    rightPanel.style.display = 'none';
                } else {
                    // Apply width and show panel
                    rightPanel.style.width = width + 'px';
                    rightPanel.style.flex = '0 0 auto';
                    rightPanel.style.display = 'flex';
                }

                // Update canvas and render
                if (this.canvasRenderer) {
                    this.canvasRenderer.resizeCanvas();
                    this.render();
                }
            }
        });
        this.subscriptions.push(rightPanelUnsubscribe);

        // Listen for assets panel height changes
        const assetsPanelUnsubscribe = this.stateManager.subscribe('panels.assetsPanelHeight', (height) => {
            const assetsPanel = document.getElementById('assets-panel');
            if (assetsPanel && height !== undefined) {
                if (height === 0) {
                    // Hide panel completely when collapsed
                    assetsPanel.style.display = 'none';
                } else {
                    // Apply height and show panel
                    assetsPanel.style.height = height + 'px';
                    assetsPanel.style.flexShrink = '0';
                    assetsPanel.style.display = 'flex';
                }

                // Update canvas and render
                if (this.canvasRenderer) {
                    this.canvasRenderer.resizeCanvas();
                    this.render();
                }
            }
        });
        this.subscriptions.push(assetsPanelUnsubscribe);

        // Listen for tab position changes
        const tabPositionsUnsubscribe = this.stateManager.subscribe('tabPositions', (tabPositions) => {
            if (tabPositions && this.panelPositionManager && !this.panelPositionManager._initializing) {
                Logger.ui.debug('Tab positions changed:', tabPositions);

                // Refresh search listeners when tabs move between panels
                searchManager.refreshAllSearches();

                // Update search controls for active tabs
                this.initializeSearchControls();

                // Force search listener refresh after a short delay to ensure DOM is updated
                setTimeout(() => {
                    Logger.ui.debug('LevelEditor: Delayed search refresh after tab move');
                    searchManager.refreshAllSearches();
                }, 50);

                // Update canvas layout
                if (this.canvasRenderer) {
                    this.canvasRenderer.resizeCanvas();
                    this.render();
                }
            }
        });
        this.subscriptions.push(tabPositionsUnsubscribe);

        // Listen for active tab changes and save to ConfigManager
        const rightPanelTabUnsubscribe = this.stateManager.subscribe('rightPanelTab', (tabName) => {
            if (tabName && this.configManager) {
                this.configManager.set('editor.view.rightPanelTab', tabName);
            }
        });
        this.subscriptions.push(rightPanelTabUnsubscribe);

        const leftPanelTabUnsubscribe = this.stateManager.subscribe('leftPanelTab', (tabName) => {
            if (tabName && this.configManager) {
                this.configManager.set('editor.view.leftPanelTab', tabName);
            }
        });
        this.subscriptions.push(leftPanelTabUnsubscribe);

        // Listen for panel visibility changes to update menu checkboxes
        const rightPanelVisibilityUnsubscribe = this.stateManager.subscribe('view.rightPanel', (visible) => {
            if (this.eventHandlers && this.eventHandlers.updateViewCheckbox) {
                this.eventHandlers.updateViewCheckbox('rightPanel', visible);
            }
        });
        this.subscriptions.push(rightPanelVisibilityUnsubscribe);

        const leftPanelVisibilityUnsubscribe = this.stateManager.subscribe('view.leftPanel', (visible) => {
            if (this.eventHandlers && this.eventHandlers.updateViewCheckbox) {
                this.eventHandlers.updateViewCheckbox('leftPanel', visible);
            }
        });
        this.subscriptions.push(leftPanelVisibilityUnsubscribe);
    }

    /**
     * Toggle right panel position (left/right)
     */
    toggleRightPanelPosition() {
        this.panelPositionManager.togglePanelPosition('rightPanel');
    }

    /**
     * Initialize level and preload data
     * @private
     */
    async initializeLevelAndData() {
        // Scan content folder for assets
        try {
            await this.assetManager.scanContentFolder();
        } catch (error) {
            this.log('warn', 'Failed to scan content folder:', error.message);
        }

        // Preload assets
        try {
            await this.assetManager.preloadImages();
        } catch (error) {
            this.log('warn', 'Failed to preload some assets:', error.message);
        }

        // Initialize cached level statistics
        this.updateCachedLevelStats();
        
        // Set up layer objects count change callback
        this.setupLayerObjectsCountTracking();
        
        // Build spatial index BEFORE first render
        if (this.renderOperations) {
            try {
                this.renderOperations.buildSpatialIndex();
            } catch (error) {
                Logger.render.error('Failed to build spatial index:', error);
            }
        }

        // Initialize view states before applying panel sizes to prevent UI flicker
        console.log('🚀 LevelEditor: About to call initializeViewStates...');
        this.eventHandlers.initializeViewStates();
        console.log('✅ LevelEditor: initializeViewStates completed');

        // Apply saved panel sizes AFTER initializing view states
        this.applySavedPanelSizes();
    }

    /**
     * Finalize initialization (render, save state, setup tests)
     * @private
     */
    async finalizeInitialization() {
        // Initial render
        Logger.render.info('🎨 Initial render started');
        this.render();
        Logger.render.info('✅ Level Editor initialized successfully');

        // Update version info in UI and page title
        this.updateVersionInfo();
        this.updatePageTitle();

        // Update all panels
        this.updateAllPanels();

        // Initialize touch support after all UI elements are ready
        await this.initializeTouchSupport();
        
        // Initialize touch gesture thresholds from user configuration
        const touchConfig = this.configManager?.get('touchSupport.elements.twoFingerPan') || {};
        const zoomConfig = this.configManager?.get('touchSupport.elements.twoFingerZoom') || {};
        
        this.stateManager.set('touch.panThreshold', touchConfig.minMovement || 5);
        this.stateManager.set('touch.zoomThreshold', 0.03); // Fixed threshold for zoom detection
        this.stateManager.set('touch.panSensitivity', touchConfig.sensitivity || 1.0);
        this.stateManager.set('touch.zoomIntensity', zoomConfig.sensitivity || 0.1);

        // Auto-set parallax start position to current camera position
        const currentCamera = this.stateManager.get('camera');
        this.stateManager.set('parallax.startPosition', {
            x: currentCamera.x,
            y: currentCamera.y
        });

        // Ensure selection is clear before saving initial state
        this.stateManager.set('selectedObjects', new Set());

        // Save initial state with current group edit mode
        this.historyManager.saveState(
            this.level.objects, 
            this.stateManager.get('selectedObjects'), 
            true, 
            this.stateManager.get('groupEditMode')
        );

        // Setup auto-save handlers
        this.setupAutoSaveOnUnload();
        this.setupAutoSaveOnVisibilityChange();

        // Test context menu functionality
        this.testContextMenu();
        this.testContextMenuManager();
        this.testGlobalClickHandler();
        this.testPanningDetection();
        this.testMenuAutoClose();
        this.testCursorPositioning();
    }

    /**
     * Initialize touch support for all UI elements
     * @private
     */
    async initializeTouchSupport() {
        Logger.ui.debug('LevelEditor: initializeTouchSupport called');
        Logger.ui.debug('LevelEditor: touchInitializationManager available:', !!this.touchInitializationManager);
        try {
            await this.touchInitializationManager.initializeAllTouchSupport();
            Logger.ui.debug('Touch support initialized successfully');
        } catch (error) {
            Logger.ui.error('Failed to initialize touch support:', error);
        }
    }

    /**
     * Setup auto-save on page unload
     * Now saves only when page is closed/reloaded, not on every change
     */
    setupAutoSaveOnUnload() {
        window.addEventListener('beforeunload', () => {
            try {
                Logger.ui.info('Saving user settings on page unload...');

                // Save toolbar state
                if (this.toolbar) {
                    this.toolbar.saveState();
                }

                // Save current panel tabs
                const currentRightPanelTab = this.stateManager.get('rightPanelTab');
                if (currentRightPanelTab) {
                    this.configManager.set('editor.view.rightPanelTab', currentRightPanelTab);
                }
                
                const currentLeftPanelTab = this.stateManager.get('leftPanelTab');
                if (currentLeftPanelTab) {
                    this.configManager.set('editor.view.leftPanelTab', currentLeftPanelTab);
                }

                // Save current active asset tabs
                const currentActiveAssetTabs = this.stateManager.get('activeAssetTabs');
                if (currentActiveAssetTabs) {
                    const tabsArray = Array.from(currentActiveAssetTabs);
                    this.configManager.set('editor.view.activeAssetTabs', tabsArray);
                }

                // Save current asset panel size if it exists
                if (this.assetPanel?.assetSize) {
                    this.configManager.set('ui.assetSize', this.assetPanel.assetSize);
                }

                // Save current asset panel view mode if it exists
                if (this.assetPanel?.viewMode) {
                    this.configManager.set('ui.assetViewMode', this.assetPanel.viewMode);
                }

                // Save current snap to grid state
                const snapToGrid = this.stateManager.get('canvas.snapToGrid');
                if (snapToGrid !== undefined) {
                    this.configManager.set('canvas.snapToGrid', snapToGrid);
                }

                // Save current panel sizes
                const rightPanelWidth = this.stateManager.get('panels.rightPanelWidth');
                if (rightPanelWidth && rightPanelWidth > 0) {
                    this.userPrefs.set('rightPanelWidth', rightPanelWidth);
                }

                const leftPanelWidth = this.stateManager.get('panels.leftPanelWidth');
                if (leftPanelWidth && leftPanelWidth > 0) {
                    this.userPrefs.set('leftPanelWidth', leftPanelWidth);
                }

                const assetsPanelHeight = this.stateManager.get('panels.assetsPanelHeight');
                if (assetsPanelHeight && assetsPanelHeight > 0) {
                    this.userPrefs.set('assetsPanelHeight', assetsPanelHeight);
                }

                // Save panel tab orders
                const rightPanelTabOrder = this.stateManager.get('rightPanelTabOrder');
                if (rightPanelTabOrder && Array.isArray(rightPanelTabOrder)) {
                    this.userPrefs.set('rightPanelTabOrder', rightPanelTabOrder);
                }

                const leftPanelTabOrder = this.stateManager.get('leftPanelTabOrder');
                if (leftPanelTabOrder && Array.isArray(leftPanelTabOrder)) {
                    this.userPrefs.set('leftPanelTabOrder', leftPanelTabOrder);
                }

                const assetTabOrder = this.stateManager.get('assetTabOrder');
                if (assetTabOrder && Array.isArray(assetTabOrder)) {
                    this.userPrefs.set('assetTabOrder', assetTabOrder);
                }

                // Save tab positions (which panel each tab is in)
                const tabPositions = this.stateManager.get('tabPositions');
                if (tabPositions) {
                    Object.entries(tabPositions).forEach(([tabName, position]) => {
                        this.userPrefs.set(`tabPosition_${tabName}`, position);
                    });
                }

                // Save panel visibility states
                const rightPanel = document.getElementById('right-panel');
                if (rightPanel) {
                    const isRightPanelVisible = rightPanel.style.display !== 'none';
                    this.userPrefs.set('rightPanelVisible', isRightPanelVisible);
                }

                const leftPanel = document.getElementById('left-panel');
                if (leftPanel) {
                    const isLeftPanelVisible = leftPanel.style.display !== 'none';
                    this.userPrefs.set('leftPanelVisible', isLeftPanelVisible);
                }

                const assetsPanel = document.getElementById('assets-panel');
                if (assetsPanel) {
                    const isAssetsPanelVisible = assetsPanel.style.display !== 'none';
                    this.userPrefs.set('assetsPanelVisible', isAssetsPanelVisible);
                }

                // Save current grid settings from StateManager
                const gridSize = this.stateManager.get('canvas.gridSize');
                const gridColor = this.stateManager.get('canvas.gridColor');
                const gridThickness = this.stateManager.get('canvas.gridThickness');
                const gridOpacity = this.stateManager.get('canvas.gridOpacity');
                const gridSubdivisions = this.stateManager.get('canvas.gridSubdivisions');
                const gridSubdivColor = this.stateManager.get('canvas.gridSubdivColor');
                const gridSubdivThickness = this.stateManager.get('canvas.gridSubdivThickness');

                if (gridSize !== undefined) {
                    this.configManager.set('grid.size', gridSize);
                }
                if (gridColor !== undefined) {
                    this.configManager.set('grid.color', gridColor);
                }
                if (gridThickness !== undefined) {
                    this.configManager.set('grid.thickness', gridThickness);
                }
                if (gridOpacity !== undefined) {
                    this.configManager.set('grid.opacity', gridOpacity);
                }
                if (gridSubdivisions !== undefined) {
                    this.configManager.set('grid.subdivisions', gridSubdivisions);
                }
                if (gridSubdivColor !== undefined) {
                    this.configManager.set('grid.subdivColor', gridSubdivColor);
                }
                if (gridSubdivThickness !== undefined) {
                    this.configManager.set('grid.subdivThickness', gridSubdivThickness);
                }

                // Force save all modified settings immediately
                if (this.configManager) {
                    this.configManager.forceSaveAllSettings();
                }

                Logger.ui.info('User settings saved successfully');
            } catch (error) {
                Logger.ui.error('Failed to save user settings:', error);
            }
        });
    }

    /**
     * Setup auto-save on page visibility change (tab switch)
     * Saves settings when user switches to another tab or minimizes browser
     */
    setupAutoSaveOnVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                try {
                    Logger.ui.info('Saving user settings on tab switch...');
                    
                    // Force save all modified settings immediately
                    if (this.configManager) {
                        this.configManager.forceSaveAllSettings();
                    }
                    
                    Logger.ui.info('User settings saved on tab switch');
                } catch (error) {
                    Logger.ui.error('Failed to save user settings on tab switch:', error);
                }
            }
        });
    }

    /**
     * Test context menu functionality
     */
    testContextMenu() {
        // Test that context menu is initialized
        if (!this.canvasContextMenu) {
            return;
        }

        // Test menu methods
        const testData = {
            hasSelection: false,
            isGroup: false,
            clickPosition: { x: 100, y: 100 }
        };

        // Test extractContextData method
        if (typeof this.canvasContextMenu.extractContextData !== 'function') {
            return;
        }

        // Test hasSelectedObjects method
        if (typeof this.canvasContextMenu.hasSelectedObjects !== 'function') {
            return;
        }

        const hasSelection = this.canvasContextMenu.hasSelectedObjects();
    }

    /**
     * Test ContextMenuManager functionality
     */
    testContextMenuManager() {
        if (!this.contextMenuManager) {
            return;
        }

        const registeredMenus = this.contextMenuManager.getRegisteredMenus();
        const hasActive = this.contextMenuManager.hasActiveMenu();
    }

    /**
     * Test global click handler functionality
     */
    testGlobalClickHandler() {
        if (!this.contextMenuManager) {
            return;
        }

        // Test that we can access the manager
        const registeredMenus = this.contextMenuManager.getRegisteredMenus();
    }

    /**
     * Test panning detection functionality
     */
    testPanningDetection() {
        // Test mouse state initialization
        const mouseState = this.stateManager.get('mouse');
        if (!mouseState) {
            return;
        }

        // Check if panning-related properties exist
        const hasPanningProps = mouseState.hasOwnProperty('wasPanning') ||
                              mouseState.hasOwnProperty('rightClickStartX') ||
                              mouseState.hasOwnProperty('rightClickStartY');
    }

    /**
     * Test menu auto-close functionality
     */
    testMenuAutoClose() {
        if (!this.canvasContextMenu) {
            return;
        }

        // Test that the menu has the necessary methods
        if (typeof this.canvasContextMenu.setupMenuClosing !== 'function') {
            return;
        }

        // Check if we can access the base functionality
        const hasBaseMenu = this.canvasContextMenu.constructor.name === 'CanvasContextMenu';
    }

    /**
     * Test cursor positioning functionality
     */
    testCursorPositioning() {
        let canvasMenuOk = false;
        let consoleMenuOk = false;

        if (!this.canvasContextMenu) {
            return;
        }

        // Test that the menu has the necessary methods
        if (typeof this.canvasContextMenu.ensureCursorInsideMenu === 'function') {
            canvasMenuOk = true;
        }

        if (typeof this.canvasContextMenu.adjustCursorPosition !== 'function') {
            return;
        }

        // Test ConsoleContextMenu if available
        if (window.consoleContextMenu) {
            if (typeof window.consoleContextMenu.ensureCursorInsideMenu === 'function') {
                consoleMenuOk = true;
            }
        }

        const bothOk = canvasMenuOk && consoleMenuOk;
        const canvasOnlyOk = canvasMenuOk && !consoleMenuOk;
    }

    /**
     * Apply configuration settings to editor
     * @description Main entry point for applying configuration. Note: Font scale 
     * and theme are applied immediately in index.html to prevent UI flicker.
     */
    applyConfiguration() {
        if (!this.configManager) {
            Logger.settings.warn('ConfigManager not initialized, skipping configuration');
            return;
        }
        
        // Apply different configuration sections
        this._applyGridConfiguration();
        this._applyColorConfiguration();
        this._syncGridSettingsToUI();
        this._saveDefaultConfiguration();
    }

    /**
     * Apply color configuration settings to StateManager
     * @private
     */
    _applyColorConfiguration() {
        // Apply UI colors
        const uiColors = this.configManager.get('ui');
        if (uiColors) {
            this.stateManager.set('ui.backgroundColor', uiColors.backgroundColor);
            this.stateManager.set('ui.textColor', uiColors.textColor);
            this.stateManager.set('ui.activeColor', uiColors.activeColor);
            this.stateManager.set('ui.activeTextColor', uiColors.activeTextColor);
            this.stateManager.set('ui.activeTabColor', uiColors.activeTabColor);
            this.stateManager.set('ui.accentColor', uiColors.accentColor);
            this.stateManager.set('ui.resizerColor', uiColors.resizerColor);
        }

        // Apply canvas colors
        const canvasColors = this.configManager.get('canvas');
        if (canvasColors) {
            this.stateManager.set('canvas.backgroundColor', canvasColors.backgroundColor);
        }

        // Apply selection colors
        const selectionColors = this.configManager.get('selection');
        if (selectionColors) {
            this.stateManager.set('selection.outlineColor', selectionColors.outlineColor);
            this.stateManager.set('selection.outlineWidth', selectionColors.outlineWidth);
            this.stateManager.set('selection.groupOutlineColor', selectionColors.groupOutlineColor);
            this.stateManager.set('selection.groupOutlineWidth', selectionColors.groupOutlineWidth);
            this.stateManager.set('selection.marqueeColor', selectionColors.marqueeColor);
            this.stateManager.set('selection.marqueeOpacity', selectionColors.marqueeOpacity);
            this.stateManager.set('selection.hierarchyHighlightColor', selectionColors.hierarchyHighlightColor);
            this.stateManager.set('selection.activeLayerBorderColor', selectionColors.activeLayerBorderColor);
        }

        // Apply logger colors
        const loggerColors = this.configManager.get('logger.colors');
        if (loggerColors) {
            this.stateManager.set('logger.colors', loggerColors);
        }
    }

    /**
     * Apply grid configuration settings to StateManager
     * @private
     */
    _applyGridConfiguration() {
        // Get all grid settings from config
        const gridSettings = this._getGridSettingsFromConfig();
        
        // Apply basic grid settings
        this._applyBasicGridSettings(gridSettings);
        
        // Apply grid subdivision settings
        this._applyGridSubdivisionSettings(gridSettings);
        
        // Apply grid type settings
        this._applyGridTypeSettings(gridSettings);
    }

    /**
     * Get grid settings from configuration manager
     * @private
     * @returns {Object} Grid settings object
     */
    _getGridSettingsFromConfig() {
        return {
            size: this.configManager.get('grid.size'),
            color: this.configManager.get('grid.color'),
            thickness: this.configManager.get('grid.thickness'),
            opacity: this.configManager.get('grid.opacity'),
            subdivisions: this.configManager.get('grid.subdivisions'),
            subdivColor: this.configManager.get('grid.subdivColor'),
            subdivThickness: this.configManager.get('grid.subdivThickness'),
            type: this.configManager.get('canvas.gridType'),
            hexOrientation: this.configManager.get('canvas.hexOrientation')
        };
    }

    /**
     * Apply basic grid settings (size, color, thickness, opacity)
     * @private
     * @param {Object} settings - Grid settings object
     */
    _applyBasicGridSettings(settings) {
        if (settings.size !== undefined) {
            this.stateManager.set('canvas.gridSize', settings.size);
        }
        
        if (settings.color !== undefined) {
            const opacity = settings.opacity !== undefined ? settings.opacity : 0.1;
            const colorValue = ColorUtils.toRgba(settings.color, opacity);
            this.stateManager.set('canvas.gridColor', colorValue);
        }
        
        if (settings.thickness !== undefined) {
            this.stateManager.set('canvas.gridThickness', settings.thickness);
        }
        
        if (settings.opacity !== undefined) {
            this.stateManager.set('canvas.gridOpacity', settings.opacity);
        }
    }

    /**
     * Apply grid subdivision settings
     * @private
     * @param {Object} settings - Grid settings object
     */
    _applyGridSubdivisionSettings(settings) {
        if (settings.subdivisions !== undefined) {
            this.stateManager.set('canvas.gridSubdivisions', settings.subdivisions);
        }
        
        if (settings.subdivColor !== undefined) {
            const opacity = settings.opacity !== undefined ? settings.opacity : 0.1;
            const subdivColorValue = ColorUtils.toRgba(settings.subdivColor, opacity);
            this.stateManager.set('canvas.gridSubdivColor', subdivColorValue);
        }
        
        if (settings.subdivThickness !== undefined) {
            this.stateManager.set('canvas.gridSubdivThickness', settings.subdivThickness);
        }
    }

    /**
     * Apply grid type settings (rectangular, hexagonal, etc.)
     * @private
     * @param {Object} settings - Grid settings object
     */
    _applyGridTypeSettings(settings) {
        if (settings.type !== undefined) {
            this.stateManager.set('canvas.gridType', settings.type);
        }
        
        if (settings.hexOrientation !== undefined) {
            this.stateManager.set('canvas.hexOrientation', settings.hexOrientation);
        }
    }

    /**
     * Sync grid settings to UI components
     * @private
     */
    _syncGridSettingsToUI() {
        if (this.settingsPanel && this.settingsPanel.gridSettings) {
            this.settingsPanel.gridSettings.syncAllGridSettingsToState();
        }
    }

    /**
     * Save default configuration settings
     * @private
     */
    _saveDefaultConfiguration() {
        if (this.configManager) {
            this.configManager.saveSettings();
        }
    }


    /**
     * Apply saved panel sizes to prevent UI flicker
     */
    applySavedPanelSizes() {
        if (!this.userPrefs) return;

        try {
            // Apply panel sizes from user preferences
            this.applyPanelSizesFromPreferences();

            // Apply tab order settings to prevent UI flicker
            this.applyTabOrderSettings();

            // Update canvas after applying saved sizes
            if (this.canvasRenderer) {
                this.canvasRenderer.resizeCanvas();
                this.render();
            }

        } catch (error) {
            Logger.layout.warn('Failed to apply saved panel settings:', error);
        }
    }

    /**
     * Apply panel sizes from user preferences
     */
    applyPanelSizesFromPreferences() {
        if (!this.userPrefs) return;

        try {
            // Right/Left panel widths - handled by PanelPositionManager resizers
            // Skip to avoid double application of styles

            // Assets panel height - handled by PanelPositionManager.initializeAssetsPanel()
            // Skip to avoid double application of styles

            // Console height
            const consoleHeight = this.userPrefs.get('consoleHeight');
            if (consoleHeight) {
                const consolePanel = document.getElementById('console-panel');
                if (consolePanel) {
                    const height = Math.max(200, Math.min(window.innerHeight * 0.9, consoleHeight));
                    consolePanel.style.setProperty('height', height + 'px', 'important');
                    consolePanel.style.setProperty('bottom', 'auto', 'important');
                }
            }

            // Apply panel visibility states
            const rightPanelVisible = this.userPrefs.get('rightPanelVisible');
            if (rightPanelVisible !== undefined) {
                const rightPanel = document.getElementById('right-panel');
                if (rightPanel) {
                    rightPanel.style.display = rightPanelVisible ? 'flex' : 'none';
                }
            }

            const leftPanelVisible = this.userPrefs.get('leftPanelVisible');
            if (leftPanelVisible !== undefined) {
                const leftPanel = document.getElementById('left-panel');
                if (leftPanel) {
                    leftPanel.style.display = leftPanelVisible ? 'flex' : 'none';
                }
            }

            const assetsPanelVisible = this.userPrefs.get('assetsPanelVisible');
            if (assetsPanelVisible !== undefined) {
                const assetsPanel = document.getElementById('assets-panel');
                if (assetsPanel) {
                    assetsPanel.style.display = assetsPanelVisible ? 'flex' : 'none';
                }
            }
        } catch (error) {
            Logger.layout.warn('Failed to apply panel sizes from preferences:', error);
        }
    }

    /**
     * Apply tab order settings to prevent UI flicker
     */
    applyTabOrderSettings() {
        if (!this.userPrefs) return;
        
        try {
            // Apply asset tab order
            const assetTabOrder = this.userPrefs.get('assetTabOrder');
            if (assetTabOrder && Array.isArray(assetTabOrder)) {
                this.stateManager.set('assetTabOrder', assetTabOrder);
            }
            
            // Apply panel tab orders
            const rightPanelTabOrder = this.userPrefs.get('rightPanelTabOrder');
            if (rightPanelTabOrder && Array.isArray(rightPanelTabOrder)) {
                this.stateManager.set('rightPanelTabOrder', rightPanelTabOrder);
            }
            
            const leftPanelTabOrder = this.userPrefs.get('leftPanelTabOrder');
            if (leftPanelTabOrder && Array.isArray(leftPanelTabOrder)) {
                this.stateManager.set('leftPanelTabOrder', leftPanelTabOrder);
            }
            
            // Re-render panels to apply tab order
            if (this.assetPanel) {
                this.assetPanel.render();
            }
            
        } catch (error) {
            Logger.ui.warn('Failed to apply tab order settings:', error);
        }
    }

    /**
     * Apply configuration to level settings
     */
    applyConfigurationToLevel() {
        if (!this.level || !this.configManager) return;
        
        
        // Apply canvas settings to level
        const canvasConfig = this.configManager.getCanvas();
        
        if (canvasConfig.backgroundColor) {
            this.level.settings.backgroundColor = canvasConfig.backgroundColor;
        }
        
        if (canvasConfig.gridSize) {
            this.level.settings.gridSize = canvasConfig.gridSize;
        }
        
        if (canvasConfig.showGrid !== undefined) {
            this.level.settings.showGrid = canvasConfig.showGrid;
        }
        
    }


    /**
     * Render the canvas - delegate to render operations
     */
    render() {
        this.renderOperations.render();
    }

    /**
     * Update all panels
     */
    updateAllPanels() {
        // Update cached level statistics for quick access
        this.updateCachedLevelStats();

        this.detailsPanel.render();
        this.outlinerPanel.render();
        this.layersPanel.render();
        
        // Update level stats panel (includes Player Start restoration logic)
        this.updateLevelStatsPanel();
    }


    /**
     * Check and auto-create Player Start if missing
     * This method is called during level updates to ensure at least one Player Start exists
     */
    ensurePlayerStartExists() {
        if (!this.level) return;

        // Use cached statistics (already updated in updateAllPanels)
        const stats = this.cachedLevelStats;
        if (!stats) return;

        // Check Player Start objects from cached stats
        const playerStartCount = stats?.byType?.player_start || 0;

        // Auto-create Player Start if missing
        // Skip auto-creation during undo/redo operations to avoid history corruption
        const isDuringUndoRedo = this.historyManager.isUndoing || this.historyManager.isRedoing;
        if (playerStartCount === 0 && !isDuringUndoRedo) {
            Logger.lifecycle.info('No Player Start found, creating one automatically');
            
            const playerStartObject = new GameObject({
                name: 'Player Start',
                type: 'player_start',
                x: 0,
                y: 0,
                width: 32,
                height: 32,
                color: 'lightblue',
                visible: true,
                locked: false,
                properties: {}
            });

            this.level.addObject(playerStartObject);

            // Invalidate caches since new object was added
            this.invalidateObjectCaches(playerStartObject.id);

            // Update history with current group edit mode
            this.historyManager.saveState(
                this.level.objects, 
                this.stateManager.get('selectedObjects'), 
                false, 
                this.stateManager.get('groupEditMode')
            );

            // Update cached stats after creation (without recursive call to ensurePlayerStartExists)
            if (this.level) {
                this.cachedLevelStats = this.level.getStats();
            }
            
            // Re-render to show the new object
            this.render();
            
            Logger.lifecycle.info('Player Start object created successfully');
        }
    }

    updateLevelStatsPanel() {
        // This method is kept for backward compatibility but now just calls the main logic
        this.ensurePlayerStartExists();
    }

    renderLevelStats(container, stats, playerStartCount) {
        // Generate Player Start display with color coding
        const playerStartText = playerStartCount === 1 ? 'Player Start: 1' :
                               playerStartCount === 0 ? 'Player Start: 0' :
                               `Player Start: ${playerStartCount}`;
        const playerStartClass = playerStartCount === 1 ? 'text-green-400' :
                                playerStartCount === 0 ? 'text-yellow-400' :
                                'text-red-400 font-bold';

        container.innerHTML = `
            <p class="text-sm">Total Objects: ${stats.totalObjects}</p>
            <p class="text-sm">Groups: ${stats.groups}</p>
            <div class="mt-2">
                <p class="text-sm font-medium">By Type:</p>
                ${Object.entries(stats.byType).map(([type, count]) => {
                    if (type === 'player_start') {
                        return `<p class="text-sm ml-2 ${playerStartClass}">${playerStartText}</p>`;
                    }
                    return `<p class="text-sm ml-2">${type}: ${count}</p>`;
                }).join('')}
            </div>
            <div class="mt-4">
                <button id="set-camera-start-position-btn"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                    Set Camera Start Position
                </button>
                <p class="text-xs text-gray-400 mt-1">
                    Sets current camera position as parallax reference point
                </p>
            </div>
        `;
    }

    setupCameraStartPositionButton() {
        const btn = document.getElementById('set-camera-start-position-btn');
        if (!btn) return;

        // Remove existing listener to avoid duplicates
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            const currentCamera = this.stateManager.get('camera');
            this.stateManager.set('parallax.startPosition', {
                x: currentCamera.x,
                y: currentCamera.y
            });

            Logger.parallax.info(`Set camera start position: (${currentCamera.x}, ${currentCamera.y})`);
        });
    }

    /**
     * Cancel all current actions (placing objects, marquee selection, etc.)
     */
    cancelAllActions() {
        const mouse = this.stateManager.get('mouse');
        
        // Cancel placing objects
        if (mouse.isPlacingObjects) {
            this.stateManager.update({
                'mouse.isPlacingObjects': false,
                'mouse.placingObjects': []
            });
        }

        // Note: Marquee selection is now cancelled globally by BaseContextMenu
        
        // Cancel dragging
        if (mouse.isDragging) {
            this.stateManager.update({
                'mouse.isDragging': false,
                'mouse.dragStart': null
            });
        }
        
        // Cancel right mouse dragging
        if (mouse.isRightDown) {
            this.stateManager.update({
                'mouse.isRightDown': false
            });
            this.canvasRenderer.canvas.style.cursor = 'default';
        }
        
        // Cancel duplicate mode
        this.stateManager.update({
            'duplicate.isActive': false,
            'duplicate.objects': [],
            'duplicate.basePosition': { x: 0, y: 0 },
            'duplicate.isAltDragMode': false
        });
        
        this.render();
    }

    /**
     * Check if object is a descendant of group (recursive)
     * @param {string} objectId - ID of object to check
     * @param {Object} group - Group to check in
     * @returns {boolean} True if object is descendant of group
     */
    isObjectDescendantOfGroup(objectId, group) {
        if (!group.children || !Array.isArray(group.children)) {
            return false;
        }

        for (const child of group.children) {
            if (child.id === objectId) {
                return true;
            }

            // Check recursively in child groups
            if (child.type === 'group' && this.isObjectDescendantOfGroup(objectId, child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * History operations (delegated to HistoryOperations module)
     */
    undo() {
        this.historyOperations.undo();
    }

    redo() {
        this.historyOperations.redo();
    }

    /**
     * File operations (delegated to LevelFileOperations)
     */
    async newLevel() {
        return this.levelFileOperations.newLevel();
    }

    async openLevel() {
        return this.levelFileOperations.openLevel();
    }

    /**
     * Count Player Start objects on the current level
     * @returns {number} Number of Player Start objects
     */
    /**
     * Get Player Start count from cached level statistics
     * @returns {number} Number of Player Start objects
     */
    getPlayerStartCount() {
        if (!this.cachedLevelStats) {
            this.updateCachedLevelStats();
        }
        return this.cachedLevelStats?.byType?.player_start || 0;
    }

    /**
     * Update cached level statistics
     */
    updateCachedLevelStats() {
        if (this.level) {
            this.cachedLevelStats = this.level.getStats();
            
            // Ensure Player Start exists after updating stats
            this.ensurePlayerStartExists();
        }
    }

    /**
     * Set up layer objects count change tracking
     */
    setupLayerObjectsCountTracking() {
        if (this.level) {
            this.level.setLayerObjectsCountChangeCallback((layerId, newCount, oldCount) => {
                
                // Notify StateManager about layer objects count change
                this.stateManager.notifyLayerObjectsCountChanged(layerId, newCount, oldCount);
                
                // Update cached stats
                this.updateCachedLevelStats();
            });
        }
    }


    async saveLevel() {
        return this.levelFileOperations.saveLevel();
    }

    async saveLevelAs() {
        return this.levelFileOperations.saveLevelAs();
    }

    async importAssets() {
        return this.levelFileOperations.importAssets();
    }

    openSettings() {
        this.settingsPanel.show();
    }

    /**
     * Show Actor Properties Window for the given asset
     * @param {Object} asset - Asset to show properties for
     */
    showActorPropertiesPanel(asset) {
        if (!asset) {
            Logger.ui.warn('Cannot show Actor Properties Window: no asset provided');
            return;
        }

        if (this.actorPropertiesWindow) {
            this.actorPropertiesWindow.show(asset);
            Logger.ui.info(`Opened Actor Properties Window for asset: ${asset.name}`);
        } else {
            Logger.ui.warn('Actor Properties Window not initialized');
        }
    }

    /**
     * Utility methods
     */
    deepClone(obj) {
        if (!obj) return null;

        // For GameObject and Group instances, preserve the class structure
        if (obj.type === 'group') {
            const cloned = new Group({
                ...obj,
                children: obj.children ? obj.children.map(child => this.deepClone(child)) : []
            });
            return cloned;
        } else {
            // For regular GameObjects
            const cloned = new GameObject(obj);
            return cloned;
        }
    }

    // Assign new unique ids recursively to object and its subtree
    reassignIdsDeep(obj) {
        obj.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (obj.type === 'group' && Array.isArray(obj.children)) {
            obj.children.forEach(child => this.reassignIdsDeep(child));
        }
        return obj;
    }

    /**
     * Get level for panels
     */
    getLevel() {
        return this.level;
    }

    // Delegate methods to appropriate modules
    focusOnSelection() {
        this.viewportOperations.focusOnSelection();
    }

    focusOnAll() {
        this.viewportOperations.focusOnAll();
    }

    deleteSelectedObjects() {
        // Get selected objects before deletion for cache invalidation
        const selectedObjects = this.stateManager.get('selectedObjects');
        const objectsToDelete = Array.from(selectedObjects).map(id => this.findObjectById(id)).filter(Boolean);

        this.objectOperations.deleteSelectedObjects();

        // Invalidate caches for deleted objects
        objectsToDelete.forEach(obj => {
            this.invalidateObjectCaches(obj.id);
        });

        // Schedule full cache invalidation since multiple objects were affected
        this.scheduleCacheInvalidation();
        
        // Ensure Player Start exists after deletion
        this.updateCachedLevelStats();
    }

    duplicateSelectedObjects() {
        this.duplicateOperations.duplicateSelectedObjects();

        // Note: Cache invalidation for duplicated objects is handled in DuplicateOperations.confirmPlacement()
        // which calls invalidateObjectCaches for each new object
    }

    groupSelectedObjects() {
        // Get selected objects before grouping for cache invalidation
        const selectedObjects = this.stateManager.get('selectedObjects');
        const objectsToGroup = Array.from(selectedObjects).map(id => this.findObjectById(id)).filter(Boolean);

        this.groupOperations.groupSelectedObjects();

        // Invalidate caches for grouped objects
        objectsToGroup.forEach(obj => {
            this.invalidateObjectCaches(obj.id);
        });

        // Schedule full cache invalidation since hierarchy changed
        this.scheduleCacheInvalidation();
    }

    ungroupSelectedObjects() {
        // Get selected objects before ungrouping for cache invalidation
        const selectedObjects = this.stateManager.get('selectedObjects');
        const objectsToUngroup = Array.from(selectedObjects).map(id => this.findObjectById(id)).filter(Boolean);

        this.groupOperations.ungroupSelectedObjects();

        // Invalidate caches for ungrouped objects and their children
        objectsToUngroup.forEach(obj => {
            this.invalidateObjectCaches(obj.id);
            // Also invalidate caches for children if it's a group
            if (obj.type === 'group' && obj.children) {
                obj.children.forEach(child => {
                    this.invalidateObjectCaches(child.id);
                });
            }
        });

        // Schedule full cache invalidation since hierarchy changed
        this.scheduleCacheInvalidation();
    }

    /**
     * Copy selected objects to clipboard
     */
    copySelectedObjects() {
        // TODO: Implement copy functionality
    }

    /**
     * Paste objects from clipboard
     */
    pasteObjects() {
        // TODO: Implement paste functionality
    }

    /**
     * Cut selected objects (copy + delete)
     */
    cutSelectedObjects() {
        this.copySelectedObjects();
        this.deleteSelectedObjects();
    }

    /**
     * Zoom in canvas view (delegated to ViewportOperations)
     */
    zoomIn() {
        this.viewportOperations.zoomIn();
    }

    /**
     * Zoom out canvas view (delegated to ViewportOperations)
     */
    zoomOut() {
        this.viewportOperations.zoomOut();
    }

    /**
     * Zoom to fit all objects in view (delegated to ViewportOperations)
     */
    zoomToFit() {
        this.viewportOperations.zoomToFit();
    }

    /**
     * Reset canvas view to default position and zoom (delegated to ViewportOperations)
     */
    resetView() {
        this.viewportOperations.resetView();
    }

    // Group edit helpers - delegate to group operations
    getOpenGroups() {
        return this.groupOperations.getOpenGroups();
    }

    getActiveEditedGroup() {
        return this.groupOperations.getActiveEditedGroup();
    }

    openGroupEditMode(group) {
        this.groupOperations.openGroupEditMode(group);
    }

    closeGroupEditMode() {
        this.groupOperations.closeGroupEditMode();
    }

    // Mouse event delegation
    handleMouseDown(e) {
        this.mouseHandlers.handleMouseDown(e);
    }

    handleMouseMove(e) {
        this.mouseHandlers.handleMouseMove(e);
    }

    handleMouseUp(e) {
        this.mouseHandlers.handleMouseUp(e);
    }

    handleGlobalMouseMove(e) {
        this.mouseHandlers.handleGlobalMouseMove(e);
    }

    handleGlobalMouseUp(e) {
        this.mouseHandlers.handleGlobalMouseUp(e);
    }

    handleWheel(e) {
        this.mouseHandlers.handleWheel(e);
    }

    handleDragOver(e) {
        this.mouseHandlers.handleDragOver(e);
    }

    handleDrop(e) {
        this.mouseHandlers.handleDrop(e);
    }

    handleDoubleClick(e) {
        this.mouseHandlers.handleDoubleClick(e);
    }

    // Object manipulation delegation
    findObjectAtPoint(x, y) {
        return this.objectOperations.findObjectAtPoint(x, y);
    }

    isPointInObject(x, y, obj) {
        return this.objectOperations.isPointInObject(x, y, obj);
    }

    getObjectWorldBounds(obj, excludeIds = []) {
        return this.objectOperations.getObjectWorldBounds(obj, excludeIds);
    }

    getObjectWorldPosition(obj) {
        return this.objectOperations.getObjectWorldPosition(obj);
    }

    getSelectionBounds(collection) {
        return this.objectOperations.getSelectionBounds(collection);
    }

    // Additional utility methods that may be needed by components

    computeSelectableSet() {
        return this.objectOperations.computeSelectableSet();
    }

    /**
     * Initialize search controls for the current active tab
     */
    initializeSearchControls() {
        SearchSectionUtils.initializeSearchControls(this);
    }


    /**
     * Update version info in UI
     */
    updateVersionInfo() {
        // Update version in header (main window for users)
        const headerVersionElement = document.getElementById('header-version-info');
        if (headerVersionElement) {
            headerVersionElement.textContent = `v${LevelEditor.VERSION}`;
            headerVersionElement.style.marginRight = '4px';
        }
    }

    /**
     * Move selected objects to next layer (delegated to LayerOperations)
     * @param {boolean} moveUp - true to move to upper layer, false to move to lower layer
     * @param {boolean} moveToExtreme - true to move to first/last layer, false to move to adjacent layer
     */
    moveSelectedObjectsToLayer(moveUp, moveToExtreme = false) {
        this.layerOperations.moveSelectedObjectsToLayer(moveUp, moveToExtreme);
    }

    /**
     * Find top-level object (group or single object) that contains the given object ID
     * @param {string} objId - Object ID to find
     * @returns {Object|null} Top-level object or null if not found
     */
    findTopLevelObject(objId) {
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug(`findTopLevelObject called for: ${objId}`);
        }

        // Сначала пытаемся найти через индекс - O(1)
        const fastResult = this.level.findTopLevelObjectFast(objId);
        if (fastResult) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Found via index: ${fastResult.id}`);
            }
            return fastResult;
        }

        // Fallback на старый метод - O(N×D)
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug('Index miss, falling back to recursive search');
        }

        // First try to find as top-level object
        const topLevelObj = this.level.objects.find(obj => obj.id === objId);
        if (topLevelObj) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Found as top-level object: ${topLevelObj.id}`);
            }
            return topLevelObj;
        }

        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug('Not found as top-level, searching in groups...');
        }

        // If not found as top-level, search in groups recursively
        for (const obj of this.level.objects) {
            if (obj.type === 'group') {
                const found = this.findObjectInGroup(obj, objId);
                if (found) {
                    if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                        Logger.layer.debug(`Found in group: ${obj.id}`);
                    }
                    return obj; // Return the top-level group that contains this object
                }
            }
        }

        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug(`Object not found anywhere: ${objId}`);
        }
        return null;
    }

    /**
     * Recursively search for object in group
     * @param {Object} group - Group to search in
     * @param {string} objId - Object ID to find
     * @returns {boolean} true if found
     */
    findObjectInGroup(group, objId) {
        if (group.id === objId) {
            return true;
        }

        if (group.children) {
            for (const child of group.children) {
                if (child.id === objId) {
                    return true;
                }
                if (child.type === 'group') {
                    if (this.findObjectInGroup(child, objId)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Find object by ID in the level, including objects inside groups
     * @param {string} objId - Object ID to find
     * @returns {GameObject|null} - The found object or null
     */
    findObjectById(objId) {

        // First try to find as top-level object
        const topLevelObj = this.level.objects.find(obj => obj.id === objId);
        if (topLevelObj) {
            return topLevelObj;
        }

        // If not found, search in groups recursively
        for (const obj of this.level.objects) {
            if (obj.type === 'group') {
                const found = this.findObjectInGroupRecursive(obj, objId);
                if (found) {
                    return found;
                }
            }
        }

        return null;
    }

    /**
     * Recursively find object in group and return the object itself
     * @param {Group} group - Group to search in
     * @param {string} objId - Object ID to find
     * @returns {GameObject|null} - The found object or null
     */
    findObjectInGroupRecursive(group, objId) {
        if (group.id === objId) {
            return group;
        }

        if (group.children) {
            for (const child of group.children) {
                if (child.id === objId) {
                    return child; // Return the actual object
                }
                if (child.type === 'group') {
                    const found = this.findObjectInGroupRecursive(child, objId);
                    if (found) {
                        return found;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Check if objects can be moved to another layer (delegated to LayerOperations)
     * @returns {boolean} true if all conditions are met
     */
    canMoveObjectsToLayer() {
        return this.layerOperations.canMoveObjectsToLayer();
    }

    /**
     * Update page title (simplified without version)
     */
    updatePageTitle() {
        document.title = '2D Level Editor';
    }

    /**
     * Get current layer for new objects
     * @returns {Layer} Current layer or Main layer as fallback
     */
    getCurrentLayer() {
        if (!this.level) {
            Logger.editor.warn('Cannot get current layer: level not initialized');
            return null;
        }
        
        const currentLayerId = this.stateManager.get('currentLayerId');
        if (currentLayerId) {
            const layer = this.level.getLayerById(currentLayerId);
            if (layer) return layer;
        }
        
        // Fallback to Main layer
        const mainLayerId = this.level.getMainLayerId();
        if (mainLayerId) {
            return this.level.getLayerById(mainLayerId);
        }
        
        Logger.editor.warn('Cannot get current layer: no Main layer found');
        return null;
    }

    /**
     * Set current layer for new objects
     * @param {string} layerId - Layer ID to set as current
     */
    setCurrentLayer(layerId) {
        this.stateManager.set('currentLayerId', layerId);
        
        // Notify layers panel if it exists
        if (this.layersPanel) {
            this.layersPanel.setCurrentLayer(layerId);
        }
    }
    
    /**
     * Cleanup and destroy editor
     * Properly destroys all components and cleans up resources
     */
    destroy() {
        Logger.lifecycle.info('Destroying LevelEditor...');
        
        // Cancel any pending timers
        if (this.cacheInvalidationTimeout) {
            clearTimeout(this.cacheInvalidationTimeout);
            this.cacheInvalidationTimeout = null;
        }
        
        // Destroy all registered components via lifecycle manager
        // This will destroy them in proper order based on dependencies and priorities
        try {
            this.lifecycle.destroyAll();
        } catch (error) {
            ErrorHandler.logError(error, 'LevelEditor Lifecycle Destruction');
            Logger.lifecycle.error('Error during lifecycle destruction:', error);
        }
        
        // Cancel all StateManager subscriptions
        if (this.subscriptions) {
            this.subscriptions.forEach(unsubscribe => {
                try {
                    unsubscribe();
                } catch (error) {
                    Logger.lifecycle.warn('Error unsubscribing from StateManager:', error);
                }
            });
            this.subscriptions = [];
        }

        // Clear all caches
        this.clearCaches();
        this.clearSelectableObjectsCache();

        // Clear managers
        if (this.level) {
            this.level.clearLayerCountsCache();
            this.level.clearObjectsIndex();
            this.level = null;
        }

        this.stateManager = null;
        this.fileManager = null;
        this.assetManager = null;
        this.historyManager = null;
        this.configManager = null;
        this.contextMenuManager = null;
        
        // Clear references to UI components
        this.assetPanel = null;
        this.detailsPanel = null;
        this.outlinerPanel = null;
        this.layersPanel = null;
        this.settingsPanel = null;
        this.actorPropertiesWindow = null;
        this.toolbar = null;
        this.canvasRenderer = null;
        this.canvasContextMenu = null;
        this.menuManager = null;
        
        // Clear operation modules
        this.eventHandlers = null;
        this.mouseHandlers = null;
        this.objectOperations = null;
        this.groupOperations = null;
        this.renderOperations = null;
        this.duplicateOperations = null;
        
        // Clear lifecycle
        this.lifecycle = null;
        
        Logger.lifecycle.info('LevelEditor destroyed successfully');
    }

    // ===== TOUCH GESTURE HANDLERS =====

    /**
     * Start touch marquee selection
     * @param {number} startX - Start X coordinate
     * @param {number} startY - Start Y coordinate
     */
    startTouchMarquee(startX, startY) {
        // Convert screen coordinates to world coordinates
        const camera = this.stateManager.get('camera');
        const worldPos = this.canvasRenderer.screenToWorld(startX, startY, camera);
        
        // Check if touching an object
        const clickedObject = this.objectOperations.findObjectAtPoint(worldPos.x, worldPos.y);
        
        if (clickedObject) {
            // If touching an object, cancel marquee and start object move instead
            this.stateManager.set('mouse.isMarqueeSelecting', false);
            this.stateManager.set('mouse.marqueeStartX', null);
            this.stateManager.set('mouse.marqueeStartY', null);
            this.stateManager.set('mouse.marqueeRect', null);
            
            this.startTouchObjectMove(clickedObject, worldPos);
        } else {
            // If touching empty space, start marquee selection
            this.stateManager.set('mouse.isMarqueeSelecting', true);
            this.stateManager.set('mouse.marqueeStartX', worldPos.x);
            this.stateManager.set('mouse.marqueeStartY', worldPos.y);
            this.stateManager.set('mouse.marqueeRect', {
                x: worldPos.x,
                y: worldPos.y,
                width: 0,
                height: 0
            });
            
            Logger.ui.debug('Touch marquee started at:', worldPos);
        }
    }

    /**
     * Update touch marquee selection
     * @param {number} currentX - Current X coordinate
     * @param {number} currentY - Current Y coordinate
     */
    updateTouchMarquee(currentX, currentY) {
        // Check if we're in marquee mode or object move mode
        if (this.stateManager.get('mouse.isMarqueeSelecting')) {
            // Update marquee selection
            const camera = this.stateManager.get('camera');
            const worldPos = this.canvasRenderer.screenToWorld(currentX, currentY, camera);
            
            const startX = this.stateManager.get('mouse.marqueeStartX');
            const startY = this.stateManager.get('mouse.marqueeStartY');
            
            // Only update marquee if we have valid start coordinates
            if (startX !== null && startY !== null) {
                // Update marquee rectangle
                const marqueeRect = {
                    x: Math.min(startX, worldPos.x),
                    y: Math.min(startY, worldPos.y),
                    width: Math.abs(worldPos.x - startX),
                    height: Math.abs(worldPos.y - startY)
                };
                
                this.stateManager.set('mouse.marqueeRect', marqueeRect);
                this.render(); // Trigger re-render to show marquee
            }
        } else if (this.stateManager.get('touch.isObjectMoving')) {
            // Update object move
            this.updateTouchObjectMove(currentX, currentY);
        }
    }

    /**
     * End touch marquee selection
     * @param {number} endX - End X coordinate
     * @param {number} endY - End Y coordinate
     */
    endTouchMarquee(endX, endY) {
        // Check if we're in marquee mode or object move mode
        if (this.stateManager.get('mouse.isMarqueeSelecting')) {
            // End marquee selection
            const camera = this.stateManager.get('camera');
            const worldPos = this.canvasRenderer.screenToWorld(endX, endY, camera);
            
            // Use existing marquee selection logic
            this.mouseHandlers.finishMarqueeSelection();
            
            Logger.ui.debug('Touch marquee ended at:', worldPos);
        } else if (this.stateManager.get('touch.isObjectMoving')) {
            // End object move
            this.endTouchObjectMove(endX, endY);
        } else {
            // If neither marquee nor object move is active, just clean up
            Logger.ui.debug('Touch gesture ended without active mode');
        }
    }

    /**
     * Start touch object move
     * @param {Object} clickedObject - The object that was clicked
     * @param {Object} worldPos - World position of the touch
     */
    startTouchObjectMove(clickedObject, worldPos) {
        // Check if object is selected
        const selectedObjects = new Set(this.stateManager.get('selectedObjects'));
        const isSelected = selectedObjects.has(clickedObject.id);
        
        if (!isSelected) {
            // If object is not selected, select it first (replace current selection)
            selectedObjects.clear();
            selectedObjects.add(clickedObject.id);
            this.stateManager.set('selectedObjects', selectedObjects);
            this.updateAllPanels();
        }
        
        // Start object move using existing mouse handler logic
        this.stateManager.set('touch.isObjectMoving', true);
        this.stateManager.set('touch.moveStartX', worldPos.x);
        this.stateManager.set('touch.moveStartY', worldPos.y);
        this.stateManager.set('touch.moveObject', clickedObject);
        
        // Set mouse state for compatibility with existing move logic
        this.stateManager.set('mouse.isDragging', true);
        this.stateManager.set('mouse.dragStartX', worldPos.x);
        this.stateManager.set('mouse.dragStartY', worldPos.y);
        
        Logger.ui.debug('Touch object move started for object:', clickedObject.id);
    }

    /**
     * Update touch object move
     * @param {number} currentX - Current X coordinate
     * @param {number} currentY - Current Y coordinate
     */
    updateTouchObjectMove(currentX, currentY) {
        if (!this.stateManager.get('touch.isObjectMoving')) return;
        
        // Convert screen coordinates to world coordinates
        const camera = this.stateManager.get('camera');
        const worldPos = this.canvasRenderer.screenToWorld(currentX, currentY, camera);
        
        const startX = this.stateManager.get('touch.moveStartX');
        const startY = this.stateManager.get('touch.moveStartY');
        
        // Calculate delta movement
        const deltaX = worldPos.x - startX;
        const deltaY = worldPos.y - startY;
        
        // Move selected objects directly
        const selectedObjects = this.stateManager.get('selectedObjects');
        if (selectedObjects && selectedObjects.size > 0) {
            selectedObjects.forEach(id => {
                const obj = this.level.findObjectById(id);
                if (obj) {
                    obj.x += deltaX;
                    obj.y += deltaY;
                }
            });
        }
        
        // Update start position for next frame
        this.stateManager.set('touch.moveStartX', worldPos.x);
        this.stateManager.set('touch.moveStartY', worldPos.y);
        
        this.render(); // Trigger re-render
    }

    /**
     * End touch object move
     * @param {number} endX - End X coordinate
     * @param {number} endY - End Y coordinate
     */
    endTouchObjectMove(endX, endY) {
        if (!this.stateManager.get('touch.isObjectMoving')) return;
        
        // Convert screen coordinates to world coordinates
        const camera = this.stateManager.get('camera');
        const worldPos = this.canvasRenderer.screenToWorld(endX, endY, camera);
        
        // Clean up touch move state
        this.stateManager.set('touch.isObjectMoving', false);
        this.stateManager.set('touch.moveStartX', null);
        this.stateManager.set('touch.moveStartY', null);
        this.stateManager.set('touch.moveObject', null);
        
        // Clean up mouse state
        this.stateManager.set('mouse.isDragging', false);
        this.stateManager.set('mouse.dragStartX', null);
        this.stateManager.set('mouse.dragStartY', null);
        
        Logger.ui.debug('Touch object move ended at:', worldPos);
    }

    /**
     * Start touch panning
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     */
    startTouchPan(centerX, centerY) {
        // Store initial pan position
        this.stateManager.set('touch.panStartX', centerX);
        this.stateManager.set('touch.panStartY', centerY);
        this.stateManager.set('touch.isPanning', true);
        
        Logger.ui.debug('Touch pan started at:', centerX, centerY);
    }

    /**
     * Update touch panning
     * @param {number} deltaX - Delta X movement
     * @param {number} deltaY - Delta Y movement
     */
    updateTouchPan(deltaX, deltaY) {
        if (!this.stateManager.get('touch.isPanning')) return;
        
        Logger.ui.debug('Touch pan update:', deltaX, deltaY);
        
        // Apply pan to camera (same logic as mouse panning)
        const camera = this.stateManager.get('camera');
        const newCameraX = camera.x - deltaX / camera.zoom;
        const newCameraY = camera.y - deltaY / camera.zoom;
        
        // Update camera in one operation (same as mouse panning)
        this.stateManager.update({
            'camera.x': newCameraX,
            'camera.y': newCameraY
        });
        
        this.render();
    }

    /**
     * End touch panning
     */
    endTouchPan() {
        this.stateManager.set('touch.isPanning', false);
        Logger.ui.debug('Touch pan ended');
    }

    /**
     * Show touch context menu
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     */
    showTouchContextMenu(centerX, centerY) {
        // Show canvas context menu at touch position
        if (this.canvasContextMenu) {
            this.canvasContextMenu.show(centerX, centerY);
        }
    }

    /**
     * Start touch zoom
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     */
    startTouchZoom(centerX, centerY) {
        // Store initial zoom center
        this.stateManager.set('touch.zoomCenterX', centerX);
        this.stateManager.set('touch.zoomCenterY', centerY);
        this.stateManager.set('touch.isZooming', true);
        
        Logger.ui.debug('Touch zoom started at:', centerX, centerY);
    }

    /**
     * Update touch zoom
     * @param {number} scale - Zoom scale factor
     * @param {number} centerX - Center X coordinate
     * @param {number} centerY - Center Y coordinate
     */
    updateTouchZoom(scale, centerX, centerY) {
        if (!this.stateManager.get('touch.isZooming')) return;
        
        Logger.ui.debug('Touch zoom update:', scale, centerX, centerY);
        
        // Use same logic as mouse wheel zoom
        const zoomIntensity = this.stateManager.get('touch.zoomIntensity') || 0.1;
        const direction = scale; // scale is now direction: 1 for zoom in, -1 for zoom out
        const camera = this.stateManager.get('camera');
        
        const oldZoom = camera.zoom;
        const newZoom = Math.max(0.1, Math.min(10, oldZoom * (1 + direction * zoomIntensity)));
        
        // Calculate new camera position to keep center point fixed (same as mouse wheel)
        const centerWorldPosBeforeZoom = this.canvasRenderer.screenToWorld(centerX, centerY, camera);
        
        // Create a temporary camera object for calculations
        const tempCamera = { ...camera, zoom: newZoom };
        const centerWorldPosAfterZoom = this.canvasRenderer.screenToWorld(centerX, centerY, tempCamera);
        
        const newCameraX = camera.x + centerWorldPosBeforeZoom.x - centerWorldPosAfterZoom.x;
        const newCameraY = camera.y + centerWorldPosBeforeZoom.y - centerWorldPosAfterZoom.y;
        
        // Update camera in one operation (same as mouse wheel)
        this.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': newCameraX,
            'camera.y': newCameraY
        });
        
        this.render();
    }

    /**
     * End touch zoom
     */
    endTouchZoom() {
        this.stateManager.set('touch.isZooming', false);
        Logger.ui.debug('Touch zoom ended');
    }

}