import { StateManager } from '../managers/StateManager.js';
import { HistoryManager } from '../managers/HistoryManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { FileManager } from '../managers/FileManager.js';
import { ConfigManager } from '../managers/ConfigManager.js';
import { CacheManager } from '../managers/CacheManager.js';
import { ResizerManager } from '../managers/ResizerManager.js';
import { SearchSectionUtils } from '../utils/SearchSectionUtils.js';
import { GroupTraversalUtils } from '../utils/GroupTraversalUtils.js';
import { Level } from '../models/Level.js';
import { GameObject } from '../models/GameObject.js';
import { Group } from '../models/Group.js';
import { duplicateRenderUtils } from '../utils/DuplicateUtils.js';

// Import new modules
import { EventHandlers } from '../event-system/EventHandlers.js';
import { MouseHandlers } from '../event-system/MouseHandlers.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { ObjectOperations } from './ObjectOperations.js';
import { GroupOperations } from './GroupOperations.js';
import { RenderOperations } from './RenderOperations.js';
import { DuplicateOperations } from './DuplicateOperations.js';
import { HistoryOperations } from './HistoryOperations.js';
import { LayerOperations } from './LayerOperations.js';
import { ViewportOperations } from './ViewportOperations.js';
import { LevelFileOperations } from './LevelFileOperations.js';
import { EditorConfigController } from './EditorConfigController.js';
import { EditorLifecycleController } from './EditorLifecycleController.js';
import { EditorPreferencesController } from './EditorPreferencesController.js';
import { LevelsManager } from './LevelsManager.js';
import { ProjectFileOperations } from './ProjectFileOperations.js';
import { PlayOperations } from './PlayOperations.js';
import { GameBuildOperations } from './GameBuildOperations.js';
import { ContextMenuManager } from '../managers/ContextMenuManager.js';
import { RecentFilesManager } from '../managers/RecentFilesManager.js';
import { Logger } from '../utils/Logger.js';
import { dialogReplacer } from '../utils/DialogReplacer.js';
import { DockManager } from '../ui/dock/DockManager.js';
import { ensureAssetVisualModel } from '../ui/asset-editor/AssetVisualMigrate.js';

// Import new utilities
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { ComponentLifecycle } from './ComponentLifecycle.js';

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
    static VERSION = '4.12.2';

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
        this.resizerManager = new ResizerManager(this);
        
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
        this.levelsPanel = null;
        this.settingsPanel = null;
        this.toolbar = null;
        /** @type {Map<string, import('../ui/Toolbar.js').Toolbar>} leafId → secondary viewport toolbars (VP-TB) */
        this.viewportToolbars = new Map();
        this.statusBar = null;
        this.canvasContextMenu = null;
        
        // Multi-level session state (LevelSession per open level, keyed by level id).
        // `this.level` below is a computed getter/setter resolving into the current
        // session — see LevelsManager.js and the get/set level() accessors.
        this.levelSessions = new Map();   // levelId -> LevelSession
        this.currentLevelId = null;
        this.levelOrder = [];              // open-tab order
        this.levelMRU = [];                // most-recently-current order (last = current), fallback pick on closeLevel (Edge Case 2)

        // Project (Phase 7): metadata + serialization for the current set of open
        // levels — see src/models/Project.js. null until New/Open/Save Project runs
        // or Project Settings is opened for the first time.
        this.project = null;
        this.projectSettingsDialog = null;

        // Internal clipboard for copy/cut/paste (array of deep-cloned objects, or null)
        this.clipboard = null;

        // Cached level statistics for quick access
        this.cachedLevelStats = null;
        
        // Initialize MenuManager (will be set up in init() after DOM is ready)
        this.menuManager = null;

        // Initialize ContextMenuManager
        this.contextMenuManager = new ContextMenuManager();

        // Split-tree dock (replaces PanelPositionManager as of B5)
        this.dockManager = new DockManager(this);
        this.lifecycle.register('dockManager', this.dockManager, { priority: 2 });

        // Multi-viewport: work camera (stateManager.camera) + game cameras (type=camera objects)
        this.viewportViewManager = null;

        // Initialize CacheManager
        this.cacheManager = new CacheManager(this);
        this.lifecycle.register('cacheManager', this.cacheManager, { priority: 5 });

        // Initialize operation modules
        this.levelsManager = new LevelsManager(this);
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
        this.projectFileOperations = new ProjectFileOperations(this);
        this.recentFilesManager = new RecentFilesManager(this);
        this.playOperations = new PlayOperations(this);
        this.gameBuildOperations = new GameBuildOperations(this);
        this.configController = new EditorConfigController(this);
        this.lifecycleController = new EditorLifecycleController(this);
        this.preferencesController = new EditorPreferencesController(this);

        // Register core handlers in lifecycle (highest priority - destroyed first)
        this.lifecycle.register('eventHandlers', this.eventHandlers, { priority: 10 });
        this.lifecycle.register('historyOperations', this.historyOperations, { priority: 9 });
        this.lifecycle.register('layerOperations', this.layerOperations, { priority: 8 });
        this.lifecycle.register('viewportOperations', this.viewportOperations, { priority: 7 });
        this.lifecycle.register('levelFileOperations', this.levelFileOperations, { priority: 6 });
        this.lifecycle.register('projectFileOperations', this.projectFileOperations, { priority: 6 });
        this.lifecycle.register('recentFilesManager', this.recentFilesManager, { priority: 6 });
        this.lifecycle.register('playOperations', this.playOperations, { priority: 6 });
        this.lifecycle.register('gameBuildOperations', this.gameBuildOperations, { priority: 6 });
        this.lifecycle.register('levelsManager', this.levelsManager, { priority: 6 });
        
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
            const domElements = this.lifecycleController.initializeDOMElements();

            // Load assets before UI to avoid empty FoldersPanel on first render
            try {
                await this.assetManager.scanContentFolder();
            } catch (error) {
                this.log('warn', 'Failed to scan content folder:', error.message);
            }
            try {
                await this.assetManager.preloadImages();
            } catch (error) {
                this.log('warn', 'Failed to preload some assets:', error.message);
            }

            this.lifecycleController.initializeRenderer(domElements.canvas);
            // Sync any preloaded images into CanvasRenderer cache now that renderer exists
            try {
                if (this.assetManager && this.assetManager.imageCache && this.assetManager.imageCache.size > 0) {
                    this.assetManager.imageCache.forEach((img, src) => {
                        this.assetManager.syncImageToCanvasRenderer(src, img);
                    });
                }
            } catch (error) {
                this.log('warn', 'Failed to sync preloaded images to CanvasRenderer:', error.message);
            }
            this.lifecycleController.initializeUIComponents(domElements);
            // B2: dock shell + restore; viewport (toolbar+canvas) mounts into leaf
            if (this.dockManager) {
                this.dockManager.init();
            }
            this.lifecycleController.initializeEventHandlerManager();
            this.lifecycleController.initializeMenuAndEvents();
            // After dock mount + RO attached: measure real leaf size
            this.updateCanvas();
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
        this.configController.applyConfiguration();

        // View states will be initialized later in initializeLevelAndData
        // after all components are ready
    }

    /**
     * Update canvas size and render
     * Helper method to avoid code duplication
     * @private
     */
    updateCanvas() {
        if (this.canvasRenderer) {
            this.canvasRenderer.resizeCanvas();
            this.render();
        }
    }

    /**
     * Initialize level and preload data
     * @private
     */
    async initializeLevelAndData() {
        // Scan content folder only if not already loaded earlier
        if (!this.assetManager || this.assetManager.assets.size === 0) {
            try {
                await this.assetManager.scanContentFolder();
            } catch (error) {
                this.log('warn', 'Failed to scan content folder:', error.message);
            }

            try {
                await this.assetManager.preloadImages();
            } catch (error) {
                this.log('warn', 'Failed to preload some assets:', error.message);
            }
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
        this.eventHandlers.initializeViewStates();

        // Apply saved panel sizes AFTER initializing view states
        this.preferencesController.applySavedPanelSizes();
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
        this.preferencesController.setupAutoSaveOnUnload();
        this.preferencesController.setupAutoSaveOnVisibilityChange();

        // Show editor UI after all initialization is complete
        document.body.classList.add('editor-ready');
        window.notifySplashReady?.();

        // Show welcome splash screen on the user's very first visit only
        this.lifecycleController.maybeShowSplashOnFirstVisit();
    }

    /**
     * Render the canvas - delegate to render operations
     */
    render() {
        // Consume the dirty flag here too (not just in the rAF loop): set() re-arms it
        // unconditionally on every call, even when a subscriber (e.g. 'selectedObjects',
        // 'camera') already renders synchronously in reaction to that same set(). Without
        // this, the rAF loop still sees the flag armed and fires one more, visually
        // redundant render on the very next frame — the actual source of the flicker.
        this.stateManager.consumeNeedsRender();
        this.renderOperations.render();
    }

    /**
     * Update all panels
     */
    updateAllPanels() {
        // Update cached level statistics for quick access
        this.updateCachedLevelStats();

        this.detailsPanel?.render();
        this.outlinerPanel?.render();
        this.levelsPanel?.render();
        this.layersPanel?.render();

        // Dock copies (primary already covered above)
        this.forEachDockPanelCopy('details', (p) => p.render?.());
        this.forEachDockPanelCopy('outliner', (p) => p.render?.());
        this.forEachDockPanelCopy('layers', (p) => p.render?.());
        this.forEachDockPanelCopy('levels', (p) => p.render?.());
        
        // Update level stats panel (includes Player Start restoration logic)
        this.updateLevelStatsPanel();
    }

    /**
     * Primary + dock copy Details panels (live field refresh during drag/pan).
     * @param {(panel: object) => void} fn
     */
    forEachDetailsPanel(fn) {
        if (!fn) return;
        if (this.detailsPanel) fn(this.detailsPanel);
        this.forEachDockPanelCopy('details', fn);
    }

    /**
     * Non-primary dock panel instances of a content type.
     * @param {string} contentType
     * @param {(panel: object, binding: object) => void} fn
     */
    forEachDockPanelCopy(contentType, fn) {
        const reg = this.dockManager?.registry || this.dockManager?.contentRegistry;
        if (!reg?._byLeafId || !fn) return;
        for (const bind of reg._byLeafId.values()) {
            if (bind.contentType !== contentType || bind.isPrimary || !bind.panel) continue;
            fn(bind.panel, bind);
        }
    }

    /**
     * Cheap live refresh of Details transform/camera fields (all instances).
     */
    refreshDetailsLive() {
        this.forEachDetailsPanel((p) => p.refreshTransformFieldsLive?.());
    }


    /**
     * Check and auto-create Player Start if missing
     * This method is called during level updates to ensure at least one Player Start exists
     */
    ensurePlayerStartExists() {
        this.objectOperations.ensurePlayerStartExists();
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

        // Unregister existing handlers if any to prevent duplicates
        try {
            eventHandlerManager.unregisterElement(btn);
        } catch (e) {
            // Element might not be registered yet, ignore
        }

        // Register click handler using unified system
        eventHandlerManager.registerElement(btn, {
            click: () => {
                const currentCamera = this.stateManager.get('camera');
                this.stateManager.set('parallax.startPosition', {
                    x: currentCamera.x,
                    y: currentCamera.y
                });

                Logger.parallax.info(`Set camera start position: (${currentCamera.x}, ${currentCamera.y})`);
            }
        }, 'set-camera-start-position-btn');
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
        
        // Cancel pending marquee state
        if (mouse.marqueePendingStartPos) {
            this.stateManager.update({
                'mouse.marqueePendingStartPos': null,
                'mouse.marqueePendingWorldPos': null,
                'mouse.marqueePendingMode': null,
                'mouse.marqueePendingObjectId': null,
                'mouse.marqueePendingClickInfo': null
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
     * Play-in-editor toggle (delegated to PlayOperations)
     */
    togglePlayMode() {
        return this.playOperations.toggle();
    }

    /**
     * Game menu "Build..." — saves the project and generates build-game.bat
     * (delegated to GameBuildOperations).
     */
    buildGame() {
        return this.gameBuildOperations.buildGame();
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
     * Set up layer objects count change tracking, plus the generalized level-structure-change
     * tracking (object add/remove, layer add/remove/reorder) that replaces per-operation
     * this.updateAllPanels() calls with automatic panel reactivity — see
     * Reactive level updates. Both callbacks live on the Level INSTANCE, so this
     * must be re-called any time this.level is replaced wholesale (openLevel/newLevel in
     * LevelFileOperations.js), or the new level silently loses both callbacks.
     */
    setupLayerObjectsCountTracking() {
        if (!this.level) return;

        this.level.setLayerObjectsCountChangeCallback((layerId, newCount, oldCount) => {

            // Notify StateManager about layer objects count change
            this.stateManager.notifyLayerObjectsCountChanged(layerId, newCount, oldCount);

            // Update cached stats
            this.updateCachedLevelStats();
        });

        // Batch multiple structure changes within the same synchronous operation (e.g. 50
        // addObject() calls from a bulk duplicate) into a single panel-refresh pass, deferred
        // to a microtask so it runs after the whole synchronous call stack that triggered it
        // finishes (and before the next paint/rAF render). Panels subscribe to
        // 'levelStructureChanged' themselves (OutlinerPanel, LayersPanel, DetailsPanel).
        let pendingChanges = [];
        let flushScheduled = false;
        const flushStructureChanges = () => {
            flushScheduled = false;
            const changes = pendingChanges;
            pendingChanges = [];
            // Must run BEFORE notify(): DetailsPanel/LayersPanel.render() read
            // this.cachedLevelStats synchronously, so it has to already be fresh by the
            // time the panels' 'levelStructureChanged' subscribers fire.
            this.updateCachedLevelStats();
            this.stateManager.notify('levelStructureChanged', changes);
        };
        this.level.setStructureChangeCallback((changeType, payload) => {
            pendingChanges.push({ changeType, payload });
            if (!flushScheduled) {
                flushScheduled = true;
                queueMicrotask(flushStructureChanges);
            }
        });
    }


    async saveLevel() {
        return this.levelFileOperations.saveLevel();
    }

    async saveLevelAs() {
        return this.levelFileOperations.saveLevelAs();
    }

    async closeLevel() {
        return this.levelsManager.closeLevel(this.currentLevelId);
    }

    async importAssets() {
        return this.levelFileOperations.importAssets();
    }

    /**
     * Project operations (delegated to ProjectFileOperations) — Phase 7 of multi-level support.
     */
    async newProject() {
        return this.projectFileOperations.newProject();
    }

    async openProject() {
        return this.projectFileOperations.openProject();
    }

    async saveProject() {
        return this.projectFileOperations.saveProject();
    }

    async saveProjectAs() {
        return this.projectFileOperations.saveProjectAs();
    }

    /** U3 — File → Open Recent entry */
    async openRecentFile(id) {
        return this.recentFilesManager.open(id);
    }

    /** U3 — clear MRU list */
    clearRecentFiles() {
        return this.recentFilesManager.clear();
    }

    async openProjectSettings() {
        if (!this.projectSettingsDialog) {
            const { ProjectSettingsDialog } = await import('../ui/ProjectSettingsDialog.js');
            this.projectSettingsDialog = new ProjectSettingsDialog(this);
        }
        this.projectSettingsDialog.show();
    }

    /**
     * Create a placeholder Asset for a catalog type (Add menu -> category -> <Type>).
     * Places it into the currently selected Asset panel folder, so it shows up where the user is looking.
     * @param {string} typeId - id from src/constants/AssetTypes.js
     */
    createAssetOfType(typeId) {
        const folderPath = this.assetPanel?.getActiveTabPath?.() || 'root';
        const asset = this.assetManager?.createPlaceholderAsset(typeId, null, folderPath);
        if (!asset) {
            Logger.ui.warn(`LevelEditor: createAssetOfType() failed for type "${typeId}"`);
            Logger.status.error(`Failed to create asset of type "${typeId}"`);
        } else {
            Logger.status.success(`Created "${asset.name}"`);
        }
        return asset;
    }

    /**
     * @param {string|null} [tab=null] - Optional Settings tab id (e.g. 'assets')
     */
    openSettings(tab = null) {
        this.settingsPanel.show(tab);
    }

    /**
     * Show splash screen dialog
     */
    async showSplashScreen() {
        if (!this.splashScreenDialog) {
            const { SplashScreenDialog } = await import('../ui/SplashScreenDialog.js');
            // Don't pass textContent - let SplashScreenDialog use its default text
            // This allows easy text editing in SplashScreenDialog.getDefaultTextContent()
            this.splashScreenDialog = new SplashScreenDialog();
        }
        this.splashScreenDialog.show();
    }

    /**
     * Open asset-editor floating dock workspace for the given asset.
     * @param {Object} asset - Asset to edit
     */
    showActorPropertiesPanel(asset) {
        if (!asset) {
            Logger.ui.warn('Cannot open Asset Editor: no asset provided');
            return;
        }
        if (!this.dockManager) {
            Logger.ui.warn('Cannot open Asset Editor: dockManager missing');
            return;
        }
        ensureAssetVisualModel(asset, this.assetManager);

        this.stateManager?.set('editingAssetId', asset.id);
        this.stateManager?.set('editingComponentId', null);
        this.dockManager.openAssetEditorWorkspace({
            title: `Asset: ${asset.name || asset.id}`
        });
        this.dockManager.syncAssetEditorTitle();
        // Always re-center Preview (camera pose is never remembered)
        requestAnimationFrame(() => this.fitAssetEditorPreviews());
        Logger.ui.info(`Opened Asset Editor for asset: ${asset.name}`);
    }

    /**
     * Fit every assetPreview panel camera to the editing asset (open / re-open).
     */
    fitAssetEditorPreviews() {
        const reg = this.dockManager?.registry || this.dockManager?.contentRegistry;
        if (!reg?._byLeafId) return;
        for (const bind of reg._byLeafId.values()) {
            if (bind.contentType !== 'assetPreview' || !bind.panel) continue;
            if (typeof bind.panel.requestInitialFit === 'function') {
                bind.panel.requestInitialFit();
            } else if (typeof bind.panel.fitToAsset === 'function') {
                bind.panel.fitToAsset();
            }
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

    /**
     * Documented alias of getLevel()/this.level for new multi-level-aware code
     * (LevelsManager, LevelsPanel, RenderOperations). Existing call sites keep
     * using getLevel()/this.level unchanged.
     */
    getCurrentLevel() {
        return this.level;
    }

    /**
     * Computed getter: resolves to the current LevelSession's Level instance.
     * Kept as `this.level` (not migrated to `getLevel()` everywhere) for
     * backward compatibility with ~300 existing call sites.
     */
    get level() {
        const session = this.levelSessions.get(this.currentLevelId);
        return session ? session.level : null;
    }

    /**
     * Back-compat setter for `editor.level = someLevel` call sites
     * (LevelFileOperations.newLevel()/openLevel(), destroy()). Replaces the
     * entire set of open sessions with a single new one (or none, for `null`) —
     * mirrors pre-multi-level "open one level, replacing whatever was open" semantics.
     */
    set level(newLevel) {
        this.levelSessions.clear();
        this.levelOrder = [];
        this.levelMRU = [];
        this.currentLevelId = null;
        if (newLevel) {
            this.levelsManager.addLevel(newLevel, { makeCurrent: true, visible: true });
        }
    }

    /**
     * Refresh toolbar toggle UI for primary + paired viewport copies (VP-TB).
     * @param {string|null} [leafId] - if set, only that copy (+ always primary)
     */
    refreshViewportToolbars(leafId = null) {
        try {
            this.toolbar?.updateToggleStates?.();
        } catch (_e) { /* ignore */ }
        const map = this.viewportToolbars;
        if (!map?.size) return;
        if (leafId) {
            map.get(leafId)?.updateToggleStates?.();
            return;
        }
        for (const tb of map.values()) {
            try {
                tb.updateToggleStates?.();
            } catch (_e) { /* ignore */ }
        }
    }

    /**
     * U2: re-apply native `title` tooltips (label + live Settings Hotkeys) on all toolbars.
     */
    refreshUiShortcutTitles() {
        try {
            this.toolbar?.refreshTooltips?.();
        } catch (_e) { /* ignore */ }
        const map = this.viewportToolbars;
        if (!map?.size) return;
        for (const tb of map.values()) {
            try {
                tb.refreshTooltips?.();
            } catch (_e) { /* ignore */ }
        }
    }

    // Delegate methods to appropriate modules (optional view = VP-HK target)
    focusOnSelection(view = null) {
        this.viewportOperations.focusOnSelection(view);
    }

    focusOnAll(view = null) {
        this.viewportOperations.focusOnAll(view);
    }

    jumpToCamera(view = null) {
        this.viewportOperations.jumpToCamera(view);
    }

    /** C3: next game camera on focused viewport */
    cycleNextCamera(view = null) {
        this.viewportOperations.cycleNextCamera(view);
    }

    /** C3: previous game camera on focused viewport */
    cyclePrevCamera(view = null) {
        this.viewportOperations.cyclePrevCamera(view);
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
        this.duplicateOperations.startFromSelection();

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

        // Snapshot children ids BEFORE ungrouping — groupOperations.ungroupSelectedObjects()
        // empties group.children in place (extractObjectFromGroup filters it per child), so
        // reading obj.children after that call always sees an empty array.
        const childIdsToInvalidate = [];
        objectsToUngroup.forEach(obj => {
            if (obj.type === 'group' && obj.children) {
                obj.children.forEach(child => childIdsToInvalidate.push(child.id));
            }
        });

        this.groupOperations.ungroupSelectedObjects();

        // Invalidate caches for ungrouped objects and their children
        objectsToUngroup.forEach(obj => this.invalidateObjectCaches(obj.id));
        childIdsToInvalidate.forEach(id => this.invalidateObjectCaches(id));

        // Schedule full cache invalidation since hierarchy changed
        this.scheduleCacheInvalidation();
    }

    /**
     * Copy selected objects to the internal clipboard (deep-cloned, decoupled from the
     * live level tree so later edits/deletes of the originals don't affect a later paste)
     */
    copySelectedObjects() {
        const selectedIds = this.stateManager.get('selectedObjects');
        if (!selectedIds || selectedIds.size === 0) return;

        const selected = Array.from(selectedIds)
            .map(id => this.level.findObjectById(id))
            .filter(Boolean);
        if (selected.length === 0) return;

        this.clipboard = selected.map(obj => this.deepClone(obj));
        Logger.status.info(`Copied ${this.clipboard.length} object${this.clipboard.length > 1 ? 's' : ''}`);
    }

    /**
     * Paste objects from the internal clipboard using the same interactive
     * mouse-follow placement flow as Duplicate (click to place). No-op if the
     * cursor isn't over the canvas — there's no sensible drop point otherwise.
     */
    pasteObjects() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        if (!this.stateManager.get('mouse')?.isOverCanvas) {
            Logger.status.warn('Paste ignored — move the cursor over the canvas first');
            return;
        }
        this.duplicateOperations.startFromObjects(this.clipboard);
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
     * Move selected objects to a specific layer by id (context menu)
     * @param {string} targetLayerId
     */
    moveSelectedObjectsToLayerId(targetLayerId) {
        this.layerOperations.moveSelectedObjectsToLayerId(targetLayerId);
    }

    /**
     * Context-menu flyout items for "Move to Layer"
     * @returns {Array<Object>}
     */
    buildMoveToLayerMenuItems() {
        return this.layerOperations.buildMoveToLayerMenuItems();
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
            if (obj.type === 'group' && GroupTraversalUtils.findInGroup(obj, o => o.id === objId)) {
                if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                    Logger.layer.debug(`Found in group: ${obj.id}`);
                }
                return obj; // Return the top-level group that contains this object
            }
        }

        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug(`Object not found anywhere: ${objId}`);
        }
        return null;
    }

    /**
     * Find object by ID in the level, including objects inside groups
     * @param {string} objId - Object ID to find
     * @returns {GameObject|null} - The found object or null
     */
    findObjectById(objId) {
        return GroupTraversalUtils.findInObjects(this.level.objects, obj => obj.id === objId);
    }

    /**
     * Check if objects can be moved to another layer (delegated to LayerOperations)
     * @returns {boolean} true if all conditions are met
     */
    canMoveObjectsToLayer() {
        return this.layerOperations.canMoveObjectsToLayer();
    }

    /**
     * Update page title with version
     */
    updatePageTitle() {
        document.title = `2D Level Editor v${LevelEditor.VERSION}`;
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

        // Disconnect ResizeObserver for canvas-viewport
        if (this.viewportResizeObserver) {
            this.viewportResizeObserver.disconnect();
            this.viewportResizeObserver = null;
        }

        // Clear all caches
        this.clearCaches();
        this.clearSelectableObjectsCache();

        // Level session cleanup (cache clearing per open session, currentLevelId reset)
        // already happened in LevelsManager.destroy(), run above as part of
        // lifecycle.destroyAll() — by this point `this.level` already resolves to null.

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
        this.levelsPanel = null;
        this.settingsPanel = null;

        // Lazily created (openProjectSettings()), not lifecycle-registered — destroy it
        // directly rather than relying on lifecycle.destroyAll() above.
        if (this.projectSettingsDialog) {
            try {
                this.projectSettingsDialog.destroy();
            } catch (error) {
                Logger.lifecycle.warn('Error destroying projectSettingsDialog:', error);
            }
        }
        this.projectSettingsDialog = null;
        this.project = null;
        this.toolbar = null;
        this.statusBar = null;
        Logger.setStatusCallback(null);
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
        this.levelsManager = null;
        this.projectFileOperations = null;
        this.recentFilesManager = null;
        this.playOperations = null;
        this.gameBuildOperations = null;

        // Clear lifecycle
        this.lifecycle = null;
        
        Logger.lifecycle.info('LevelEditor destroyed successfully');
    }

}
