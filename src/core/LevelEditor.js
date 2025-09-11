import { StateManager } from '../managers/StateManager.js';
import { HistoryManager } from '../managers/HistoryManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { FileManager } from '../managers/FileManager.js';
import { ConfigManager } from '../managers/ConfigManager.js';
import { CanvasRenderer } from '../ui/CanvasRenderer.js';
import { AssetPanel } from '../ui/AssetPanel.js';
import { DetailsPanel } from '../ui/DetailsPanel.js';
import { OutlinerPanel } from '../ui/OutlinerPanel.js';
import { LayersPanel } from '../ui/LayersPanel.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { Level } from '../models/Level.js';
import { GameObject } from '../models/GameObject.js';
import { Group } from '../models/Group.js';
import { duplicateRenderUtils } from '../utils/DuplicateUtils.js';

// Import new modules
import { EventHandlers } from './EventHandlers.js';
import { MouseHandlers } from './MouseHandlers.js';
import { ObjectOperations } from './ObjectOperations.js';
import { GroupOperations } from './GroupOperations.js';
import { RenderOperations } from './RenderOperations.js';
import { DuplicateOperations } from './DuplicateOperations.js';
import { MenuManager } from '../managers/MenuManager.js';
import { ContextMenuManager } from '../managers/ContextMenuManager.js';
import { CanvasContextMenu } from '../ui/CanvasContextMenu.js';
import { Logger } from '../utils/Logger.js';

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
    static VERSION = '3.6.0';

    constructor(userPreferencesManager = null) {
        // Initialize managers
        this.stateManager = new StateManager();
        this.historyManager = new HistoryManager();
        this.assetManager = new AssetManager();
        this.fileManager = new FileManager();
        
        // Store user preferences manager (for backward compatibility)
        this.userPrefs = userPreferencesManager;
        
        // ConfigManager will be initialized in init() method
        this.configManager = null;
        
        // Initialize UI components
        this.canvasRenderer = null;
        this.assetPanel = null;
        this.detailsPanel = null;
        this.outlinerPanel = null;
        this.layersPanel = null;
        this.settingsPanel = null;
        this.canvasContextMenu = null;
        
        // Current level
        this.level = null;

        // Cached level statistics for quick access
        this.cachedLevelStats = null;
        
        // Initialize MenuManager (will be set up in init() after DOM is ready)
        this.menuManager = null;

        // Initialize ContextMenuManager
        this.contextMenuManager = new ContextMenuManager();

        // Initialize operation modules
        this.eventHandlers = new EventHandlers(this);
        this.mouseHandlers = new MouseHandlers(this);
        this.objectOperations = new ObjectOperations(this);
        this.groupOperations = new GroupOperations(this);
        this.renderOperations = new RenderOperations(this);
        this.duplicateOperations = new DuplicateOperations(this);

        // Performance optimization caches
        this.objectCache = new Map(); // Cache for object lookups: objId -> object
        this.topLevelObjectCache = new Map(); // Cache for top-level object lookups: objId -> topLevelObject
        this.effectiveLayerCache = new Map(); // Cache for effective layer IDs: objId -> effectiveLayerId
        this.selectableObjectsCache = new Map(); // Cache for selectable objects in viewport: cameraKey -> Set<objectIds>
        this.selectableObjectsCacheTimestamp = 0;
        this.cacheInvalidationTimeout = null;
        
        // Store reference to duplicate render utils
        this.duplicateRenderUtils = duplicateRenderUtils;
    }

    /**
     * Cache management methods for performance optimization
     */

    /**
     * Get object from cache or find it in level
     * @param {string} objId - Object ID to find
     * @returns {Object|null} Found object or null
     */
    getCachedObject(objId) {
        if (this.objectCache.has(objId)) {
            return this.objectCache.get(objId);
        }

        // Сначала пытаемся найти через индекс уровня - O(1)
        const obj = this.level.findObjectByIdFast(objId);
        if (obj) {
            this.objectCache.set(objId, obj);
            return obj;
        }

        // Fallback на старый метод поиска - O(N×D)
        const fallbackObj = this.findObjectById(objId);
        if (fallbackObj) {
            this.objectCache.set(objId, fallbackObj);
        }
        return fallbackObj;
    }

    /**
     * Get top-level object from cache or find it
     * @param {string} objId - Object ID to find
     * @returns {Object|null} Top-level object or null
     */
    getCachedTopLevelObject(objId) {
        if (this.topLevelObjectCache.has(objId)) {
            return this.topLevelObjectCache.get(objId);
        }

        const topLevelObj = this.findTopLevelObject(objId);
        if (topLevelObj) {
            this.topLevelObjectCache.set(objId, topLevelObj);
        }
        return topLevelObj;
    }

    /**
     * Get effective layer ID from cache or calculate it
     * @param {Object} obj - Object to get effective layer for
     * @returns {string} Effective layer ID
     */
    getCachedEffectiveLayerId(obj) {
        if (this.effectiveLayerCache.has(obj.id)) {
            return this.effectiveLayerCache.get(obj.id);
        }

        const effectiveLayerId = this.renderOperations ?
            this.renderOperations.getEffectiveLayerId(obj) :
            (obj.layerId || this.level.getMainLayerId());

        this.effectiveLayerCache.set(obj.id, effectiveLayerId);
        return effectiveLayerId;
    }

    /**
     * Clear all caches (call when level changes or objects are modified)
     */
    clearCaches() {
        this.objectCache.clear();
        this.topLevelObjectCache.clear();
        this.effectiveLayerCache.clear();
        this.clearSelectableObjectsCache();
    }

    /**
     * Invalidate specific object caches (call when object is modified)
     * @param {string} objId - Object ID to invalidate
     */
    invalidateObjectCaches(objId) {
        this.objectCache.delete(objId);
        this.topLevelObjectCache.delete(objId);
        this.effectiveLayerCache.delete(objId);
    }

    /**
     * Get selectable objects within viewport (with frustum culling)
     * @returns {Set<string>} Set of selectable object IDs in viewport
     */
    getSelectableObjectsInViewport() {
        const camera = this.stateManager.get('camera');
        const cameraKey = `${camera.x.toFixed(1)},${camera.y.toFixed(1)},${camera.zoom.toFixed(2)}`;

        // Check cache first
        const currentTime = performance.now();
        if (this.selectableObjectsCache.has(cameraKey) &&
            currentTime - this.selectableObjectsCacheTimestamp < 200) { // 200ms cache timeout
            return this.selectableObjectsCache.get(cameraKey);
        }

        // Calculate viewport bounds
        const canvas = this.canvasRenderer.canvas;
        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + canvas.width / camera.zoom;
        const viewportBottom = camera.y + canvas.height / camera.zoom;

        // Debug viewport bounds only during undo operations
        if (this.historyManager && (this.historyManager.isUndoing || this.historyManager.isRedoing)) {
        }

        // Add padding for better UX (objects near edge should still be selectable)
        const padding = 50;
        const extendedLeft = viewportLeft - padding;
        const extendedTop = viewportTop - padding;
        const extendedRight = viewportRight + padding;
        const extendedBottom = viewportBottom + padding;

        // Get visible layer IDs
        const visibleLayerIds = this.renderOperations.getVisibleLayerIds();

        // Get all selectable objects from computeSelectableSet
        const selectableSet = this.objectOperations.computeSelectableSet();

        // Filter by viewport and visibility
        const selectableInViewport = new Set();

        // Debug only during undo operations
        const isDebugMode = this.historyManager && (this.historyManager.isUndoing || this.historyManager.isRedoing);
        if (isDebugMode) {
        }

        selectableSet.forEach(objId => {
            const obj = this.getCachedObject(objId);
            if (!obj) {
                return;
            }

            // In group edit mode, include ALL selectable objects (no viewport filtering)
            // This ensures nested objects in groups can be selected even if outside viewport
            if (this.objectOperations.isInGroupEditMode()) {
                selectableInViewport.add(objId);
            } else {
                // Normal mode - check if object is in viewport
                const isVisible = this.renderOperations.isObjectVisible(obj, extendedLeft, extendedTop, extendedRight, extendedBottom);
                if (isVisible) {
                    selectableInViewport.add(objId);
                }
            }
        });


        // Cache the result
        this.selectableObjectsCache.set(cameraKey, selectableInViewport);
        this.selectableObjectsCacheTimestamp = currentTime;

        // Clean old cache entries
        if (this.selectableObjectsCache.size > 5) {
            const oldestKey = this.selectableObjectsCache.keys().next().value;
            this.selectableObjectsCache.delete(oldestKey);
        }

        return selectableInViewport;
    }

    /**
     * Clear selectable objects cache
     */
    clearSelectableObjectsCache() {
        this.selectableObjectsCache.clear();
        this.selectableObjectsCacheTimestamp = 0;
    }

    /**
     * Schedule cache invalidation (debounced for performance)
     */
    scheduleCacheInvalidation() {
        if (this.cacheInvalidationTimeout) {
            clearTimeout(this.cacheInvalidationTimeout);
        }

        this.cacheInvalidationTimeout = setTimeout(() => {
            this.clearCaches();
            this.clearSelectableObjectsCache();
                // Также очищаем кеши при массовых изменениях
            this.level.clearLayerCountsCache();
            this.level.clearObjectsIndex();

            // Перестраиваем индекс после очистки
            setTimeout(() => {
                this.level.buildObjectsIndex();
            }, 0);
            this.cacheInvalidationTimeout = null;
        }, 100); // Debounce cache invalidation by 100ms
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
        // Log version info
        this.log('info', `🚀 Level Editor v${LevelEditor.VERSION} - Utility Architecture`);
        this.log('info', 'Initializing editor components...');
        
        // Initialize configuration manager after Logger is available
        this.configManager = new ConfigManager();
        
        // Configuration is already loaded synchronously in constructor
        // Apply configuration settings
        this.applyConfiguration();
        
        // Get DOM elements
        const canvas = document.getElementById('main-canvas');
        const assetsPanel = document.getElementById('assets-panel');
        const detailsPanel = document.getElementById('details-content-panel');
        const outlinerPanel = document.getElementById('outliner-content-panel');
        const layersPanel = document.getElementById('layers-content-panel');


        if (!canvas || !assetsPanel || !detailsPanel || !outlinerPanel || !layersPanel) {
            throw new Error('Required DOM elements not found');
        }
        
        // Initialize renderer
        this.canvasRenderer = new CanvasRenderer(canvas);
        this.canvasRenderer.resizeCanvas();

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

        // Initialize UI panels
        this.assetPanel = new AssetPanel(assetsPanel, this.assetManager, this.stateManager);
        this.detailsPanel = new DetailsPanel(detailsPanel, this.stateManager, this);
        this.outlinerPanel = new OutlinerPanel(outlinerPanel, this.stateManager, this);
        this.layersPanel = new LayersPanel(layersPanel, this.stateManager, this);
        this.settingsPanel = new SettingsPanel(document.body, this.configManager);
        
        // Initial render of asset panel
        this.assetPanel.render();
        
        // Create new level
        this.level = this.fileManager.createNewLevel();
        
        // Apply configuration to level settings
        this.applyConfigurationToLevel();
        
        // Apply user preferences to level settings if available (legacy support)
        if (this.userPrefs) {
            this.applyUserPreferencesToLevel();
        }
        
        // Initialize MenuManager
        const menuContainer = document.getElementById('menu-container');
        const navElement = menuContainer?.closest('nav');
        if (navElement) {
            this.menuManager = new MenuManager(navElement, this.eventHandlers);
            this.menuManager.initialize();

            // Update EventHandlers with MenuManager reference
            this.eventHandlers.menuManager = this.menuManager;
        } else {
            Logger.warn('Navigation element not found, menu functionality will be limited');
        }

        // Setup event listeners
        this.eventHandlers.setupEventListeners();
        
        // Preload assets
        await this.assetManager.preloadImages();

        // Initialize cached level statistics
        this.updateCachedLevelStats();
        
        // Set up layer objects count change callback
        this.setupLayerObjectsCountTracking();
        
        // Initial render
        this.render();
        
        // Update version info in UI and page title
        this.updateVersionInfo();
        this.updatePageTitle();
        
        this.updateAllPanels();
        
        // Initialize view states after level is created
        this.eventHandlers.initializeViewStates();
        
        // Ensure selection is clear before saving initial state
        this.stateManager.set('selectedObjects', new Set());

        // Save initial state
        this.historyManager.saveState(this.level.objects, this.stateManager.get('selectedObjects'), true);

        // Test context menu functionality
        this.testContextMenu();
        this.testContextMenuManager();
        this.testGlobalClickHandler();
        this.testPanningDetection();
        this.testMenuAutoClose();
        this.testCursorPositioning();
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
     */
    applyConfiguration() {
        if (!this.configManager) {
            this.log('warn', 'ConfigManager not initialized, skipping configuration');
            return;
        }
        
        this.log('info', 'Applying configuration settings...');
        
        // Apply font scale to document
        const fontScale = this.configManager.get('ui.fontScale');
        if (fontScale) {
            document.documentElement.style.fontSize = `${fontScale * 16}px`;
        }
        
        // Apply grid settings to StateManager
        const gridSize = this.configManager.get('grid.size');
        const gridColor = this.configManager.get('grid.color');
        const gridThickness = this.configManager.get('grid.thickness');
        const gridOpacity = this.configManager.get('grid.opacity');
        
        if (gridSize !== undefined) {
            this.stateManager.set('canvas.gridSize', gridSize);
        }
        if (gridColor !== undefined) {
            // Convert hex color to rgba if needed
            let colorValue = gridColor;
            if (gridColor.startsWith('#')) {
                const opacity = gridOpacity !== undefined ? gridOpacity : 0.1;
                const r = parseInt(gridColor.slice(1, 3), 16);
                const g = parseInt(gridColor.slice(3, 5), 16);
                const b = parseInt(gridColor.slice(5, 7), 16);
                colorValue = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }
            this.stateManager.set('canvas.gridColor', colorValue);
        }
        if (gridThickness !== undefined) {
            this.stateManager.set('canvas.gridThickness', gridThickness);
        }
        if (gridOpacity !== undefined) {
            this.stateManager.set('canvas.gridOpacity', gridOpacity);
        }
        
        this.log('info', 'Configuration applied successfully');
    }

    /**
     * Apply user preferences to editor settings (legacy method)
     */
    applyUserPreferences() {
        if (!this.userPrefs) return;
        
        this.log('info', 'Applying user preferences...');
        
        // Apply canvas settings
        const canvasBackgroundColor = this.userPrefs.get('canvasBackgroundColor');
        const gridSize = this.userPrefs.get('gridSize');
        const showGrid = this.userPrefs.get('showGrid');
        
        if (canvasBackgroundColor) {
            this.settingsManager.set('canvas.backgroundColor', canvasBackgroundColor);
        }
        
        if (gridSize) {
            this.settingsManager.set('canvas.gridSize', gridSize);
        }
        
        if (showGrid !== undefined) {
            this.settingsManager.set('canvas.showGrid', showGrid);
        }
        
        // Apply editor settings
        const autoSave = this.userPrefs.get('autoSave');
        const autoSaveInterval = this.userPrefs.get('autoSaveInterval');
        
        if (autoSave !== undefined) {
            this.settingsManager.set('editor.autoSave', autoSave);
        }
        
        if (autoSaveInterval) {
            this.settingsManager.set('editor.autoSaveInterval', autoSaveInterval);
        }
        
        // Apply UI settings
        const theme = this.userPrefs.get('theme');
        const fontSize = this.userPrefs.get('fontSize');
        const compactMode = this.userPrefs.get('compactMode');
        
        if (theme) {
            this.settingsManager.set('ui.theme', theme);
        }
        
        if (fontSize) {
            this.settingsManager.set('ui.fontSize', fontSize);
        }
        
        if (compactMode !== undefined) {
            this.settingsManager.set('ui.compactMode', compactMode);
        }
        
        this.log('info', 'User preferences applied successfully');
    }

    /**
     * Apply configuration to level settings
     */
    applyConfigurationToLevel() {
        if (!this.level || !this.configManager) return;
        
        this.log('info', 'Applying configuration to level...');
        
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
        
        this.log('info', 'Configuration applied to level successfully');
    }

    /**
     * Apply user preferences to level settings (legacy method)
     */
    applyUserPreferencesToLevel() {
        if (!this.userPrefs || !this.level) return;
        
        this.log('info', 'Applying user preferences to level...');
        
        // Apply canvas settings to level
        const canvasBackgroundColor = this.userPrefs.get('canvasBackgroundColor');
        const gridSize = this.userPrefs.get('gridSize');
        const showGrid = this.userPrefs.get('showGrid');
        
        if (canvasBackgroundColor) {
            this.level.settings.backgroundColor = canvasBackgroundColor;
        }
        
        if (gridSize) {
            this.level.settings.gridSize = gridSize;
        }
        
        if (showGrid !== undefined) {
            this.level.settings.showGrid = showGrid;
        }
        
        this.log('info', 'User preferences applied to level successfully');
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
        this.updateLevelStatsPanel();
    }


    updateLevelStatsPanel() {
        const levelStatsContent = document.getElementById('level-stats-content');
        if (!levelStatsContent) return;

        // Use cached statistics (already updated in updateAllPanels)
        const stats = this.cachedLevelStats;

        // Check Player Start objects from cached stats
        const playerStartCount = stats?.byType?.player_start || 0;

        // Auto-create Player Start if missing (but don't call updateAllPanels recursively)
        // Skip auto-creation during undo/redo operations to avoid history corruption
        const isDuringUndoRedo = this.historyManager.isUndoing || this.historyManager.isRedoing;
        if (playerStartCount === 0 && !isDuringUndoRedo) {
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

            // Update history
            this.historyManager.saveState(this.level.objects, this.stateManager.get('selectedObjects'), false);

            // Update cached stats after creation
            this.updateCachedLevelStats();
            const updatedStats = this.cachedLevelStats;
            const newPlayerStartCount = updatedStats?.byType?.player_start || 1;

            // Generate display with the new count
            this.renderLevelStats(levelStatsContent, updatedStats, newPlayerStartCount);

            // Render the new object (but don't call updateAllPanels)
            this.render();
            return;
        }

        // Use cached stats for normal case
        this.renderLevelStats(levelStatsContent, stats, playerStartCount);
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
        `;
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
        
        // Cancel marquee selection
        if (mouse.isMarqueeSelecting) {
            this.stateManager.update({
                'mouse.isMarqueeSelecting': false,
                'mouse.marqueeStart': null,
                'mouse.marqueeEnd': null
            });
        }
        
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
     * History operations
     */
    undo() {

            const previousState = this.historyManager.undo();
            if (previousState) {

                this.level.objects = previousState.objects;

                // Ensure all restored objects have correct visibility
                // Ensure all restored objects have correct visibility
                this.level.objects.forEach(obj => {
                    // Ensure object visibility is set correctly
                    // By default, all objects should be visible unless there's a specific reason to hide them
                    if (!obj.visible) {
                        obj.visible = true;
                    }

                    // Special handling for groups - they should always be visible
                    if (obj.type === 'group') {
                        if (!obj.visible) {
                            obj.visible = true;
                        }
                    }
                });

                // Force update of selectable set after visibility corrections
                const selectableSetAfterCorrection = this.objectOperations.computeSelectableSet();

                // Clear viewport selectable objects cache to ensure it gets recalculated
                this.clearSelectableObjectsCache();

                // Force recalculation of viewport selectable set
                const viewportSelectableAfter = this.getSelectableObjectsInViewport();

            // Filter selection to only include objects that actually exist
            const validSelection = new Set();
            const objectIds = new Set(this.level.objects.map(obj => obj.id));

            // Debug groups specifically
            const groups = this.level.objects.filter(obj => obj.type === 'group');

            // Check if selection contains group IDs
            const selectionContainsGroups = Array.from(previousState.selection).some(id => {
                const obj = this.level.findObjectById(id);
                return obj && obj.type === 'group';
            });

            // Add all existing objects from previous selection
            previousState.selection.forEach(id => {
                if (objectIds.has(id)) {
                    validSelection.add(id);
                }
            });

            this.stateManager.set('selectedObjects', validSelection);

            // Verify selection was set correctly
            const currentSelection = this.stateManager.get('selectedObjects');

            this.render();
            this.updateAllPanels();
            this.stateManager.markDirty();

            // Check Player Start count after updateAllPanels
            const playerStartCountAfter = this.level.objects.filter(obj => obj.type === 'player_start').length;

            // Check selectable set after updateAllPanels
            const selectableSet = this.objectOperations.computeSelectableSet();

            // Check if our selected objects are in selectable set
            const finalSelection = this.stateManager.get('selectedObjects');
            const missingFromSelectable = Array.from(finalSelection).filter(id => !selectableSet.has(id));
            if (missingFromSelectable.length > 0) {
                // Debug why they're not selectable
                missingFromSelectable.forEach(id => {
                    const obj = this.level.findObjectById(id);
                    if (obj) {
                    }
                });
            }

        } else {
        }
    }

    redo() {
        const nextState = this.historyManager.redo();
        if (nextState) {
            this.level.objects = nextState.objects;

            // Filter selection to only include objects that actually exist
            const validSelection = new Set();
            const objectIds = new Set(this.level.objects.map(obj => obj.id));

            // Add all existing objects from next selection
            nextState.selection.forEach(id => {
                if (objectIds.has(id)) {
                    validSelection.add(id);
                }
            });

            this.stateManager.set('selectedObjects', validSelection);
            this.render();
            this.updateAllPanels();
            this.stateManager.markDirty();
        }
    }

    /**
     * File operations
     */
    async newLevel() {
        if (this.stateManager.get('isDirty') && !confirm("You have unsaved changes. Are you sure you want to create a new level?")) {
            return;
        }

        // Save current View states before resetting
        const savedViewStates = this.eventHandlers.saveViewStates();

        this.level = this.fileManager.createNewLevel();
        this.stateManager.reset();

        // Re-initialize group edit mode state after reset
        this.stateManager.set('groupEditMode', {
            isActive: false,
            groupId: null,
            group: null,
            openGroups: []
        });

        // Apply saved View states after reset
        this.eventHandlers.applySavedViewStates(savedViewStates);

        // Update cached level statistics
        this.updateCachedLevelStats();

        this.historyManager.clear();
        this.historyManager.saveState(this.level.objects, this.stateManager.get('selectedObjects'), true);
        this.render();
        this.updateAllPanels();
    }

    async openLevel() {
        if (this.stateManager.get('isDirty') && !confirm("You have unsaved changes. Are you sure you want to open a new level?")) {
            return;
        }

        try {
            // Save current View states before resetting
            const savedViewStates = this.eventHandlers.saveViewStates();

            this.level = await this.fileManager.loadLevelFromFileInput();
            this.stateManager.reset();

            // Re-initialize group edit mode state after reset
            this.stateManager.set('groupEditMode', {
                isActive: false,
                groupId: null,
                group: null,
                openGroups: []
            });

            // Apply saved View states after reset
            this.eventHandlers.applySavedViewStates(savedViewStates);

            // Update cached level statistics
            this.updateCachedLevelStats();

            this.historyManager.clear();

            // Ensure selection is clear before saving initial state
            this.stateManager.set('selectedObjects', new Set());

            this.historyManager.saveState(this.level.objects, this.stateManager.get('selectedObjects'), true);
            this.render();
            this.updateAllPanels();
        } catch (error) {
            alert("Error loading level: " + error.message);
        }
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

    countPlayerStartObjects() {
        let count = 0;

        // Count in top-level objects
        count += this.level.objects.filter(obj => obj.type === 'player_start').length;

        // Count in nested groups recursively
        const countInGroups = (objects) => {
            let groupCount = 0;
            for (const obj of objects) {
                if (obj.type === 'group' && obj.children) {
                    groupCount += obj.children.filter(child => child.type === 'player_start').length;
                    groupCount += countInGroups(obj.children);
                }
            }
            return groupCount;
        };

        count += countInGroups(this.level.objects);
        return count;
    }

    saveLevel() {
        // Check for Player Start objects using cached stats
        const playerStartCount = this.getPlayerStartCount();

        // Check if Player Start is missing
        if (playerStartCount === 0) {
            alert(`Cannot save level!\n\nNo Player Start object found on the level.\nEvery level must have exactly one Player Start object.\n\nPlease add a Player Start object to your level before saving.\n\nYou can find Player Start objects in the Assets panel under the "Collectibles" category.`);
            return;
        }

        // Check for multiple Player Start objects
        if (playerStartCount > 1) {
            alert(`Cannot save level!\n\nFound ${playerStartCount} Player Start objects on the level.\nThere should be only one Player Start object.\n\nPlease remove extra Player Start objects before saving the level.`);
            return;
        }

        this.fileManager.saveLevel(this.level);
        this.stateManager.markClean();
    }

    saveLevelAs() {
        // Check for Player Start objects BEFORE prompting for filename using cached stats
        const playerStartCount = this.getPlayerStartCount();

        // Check if Player Start is missing
        if (playerStartCount === 0) {
            alert(`Cannot save level!\n\nNo Player Start object found on the level.\nEvery level must have exactly one Player Start object.\n\nPlease add a Player Start object to your level before saving.\n\nYou can find Player Start objects in the Assets panel under the "Collectibles" category.`);
            return;
        }

        // Check for multiple Player Start objects
        if (playerStartCount > 1) {
            alert(`Cannot save level!\n\nFound ${playerStartCount} Player Start objects on the level.\nThere should be only one Player Start object.\n\nPlease remove extra Player Start objects before saving the level.`);
            return;
        }

        const fileName = prompt("Enter file name:", this.fileManager.getCurrentFileName() || "level.json");
        if (fileName) {
            this.fileManager.saveLevel(this.level, fileName);
            this.stateManager.markClean();
        }
    }

    openAssetsPath() {
        // TODO: Implement assets path configuration
        alert("Assets path configuration not implemented yet");
    }

    openSettings() {
        this.settingsPanel.show();
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
        obj.id = this.level.nextObjectId++;
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
        this.objectOperations.focusOnSelection();
    }

    focusOnAll() {
        this.objectOperations.focusOnAll();
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
     * Zoom in canvas view
     */
    zoomIn() {
        const camera = this.stateManager.get('camera');
        const newZoom = Math.min(camera.zoom * 1.2, 5.0); // Max zoom 5x
        this.stateManager.update({
            'camera.zoom': newZoom
        });
        this.render();
    }

    /**
     * Zoom out canvas view
     */
    zoomOut() {
        const camera = this.stateManager.get('camera');
        const newZoom = Math.max(camera.zoom / 1.2, 0.1); // Min zoom 0.1x
        this.stateManager.update({
            'camera.zoom': newZoom
        });
        this.render();
    }

    /**
     * Zoom to fit all objects in view
     */
    zoomToFit() {
        if (!this.level || this.level.objects.length === 0) {
            this.resetView();
            return;
        }

        const bounds = this.getSelectionBounds(this.level.objects);
        if (!bounds) {
            this.resetView();
            return;
        }

        const canvas = document.getElementById('main-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;

        // Calculate zoom to fit all objects with some padding
        const padding = 50;
        const zoomX = (canvasWidth - padding) / bounds.width;
        const zoomY = (canvasHeight - padding) / bounds.height;
        const zoom = Math.min(zoomX, zoomY, 1.0); // Don't zoom in beyond 1:1

        // Center the view on the objects
        const centerX = bounds.centerX;
        const centerY = bounds.centerY;

        this.stateManager.update({
            'camera.x': centerX,
            'camera.y': centerY,
            'camera.zoom': zoom
        });

        this.render();
    }

    /**
     * Reset canvas view to default position and zoom
     */
    resetView() {
        this.stateManager.update({
            'camera.x': 0,
            'camera.y': 0,
            'camera.zoom': 1.0
        });
        this.render();
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
    hexToRgba(hex, alpha = 1) {
        const normalized = hex.replace('#', '');
        const bigint = parseInt(normalized.length === 3
            ? normalized.split('').map(c => c + c).join('')
            : normalized, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    computeSelectableSet() {
        return this.objectOperations.computeSelectableSet();
    }

    /**
     * Update version info in UI
     */
    updateVersionInfo() {
        // Update version in header (main window for users)
        const headerVersionElement = document.getElementById('header-version-info');
        if (headerVersionElement) {
            headerVersionElement.textContent = `2D Level Editor v${LevelEditor.VERSION}`;
        }
    }

    /**
     * Move selected objects to next layer (up/down) with improved nested object handling
     * @param {boolean} moveUp - true to move to upper layer, false to move to lower layer
     * @param {boolean} moveToExtreme - true to move to first/last layer, false to move to adjacent layer
     */
    moveSelectedObjectsToLayer(moveUp, moveToExtreme = false) {

        // Quick check for selected objects
        const selectedObjects = this.stateManager.get('selectedObjects');
        if (!selectedObjects || selectedObjects.size === 0) {
            return;
        }

        // Check for active duplication only
        const duplicate = this.stateManager.get('duplicate');
        if (duplicate && duplicate.isActive) {
            Logger.layer.warn('Cannot move objects while duplication is active');
            return;
        }


        // Save state for undo
        this.historyManager.saveState(this.level.objects, this.stateManager.get('selectedObjects'), false);

        let movedCount = 0;

        // Use improved layer assignment logic
        movedCount = this.assignSelectedObjectsToLayer(selectedObjects, moveUp, moveToExtreme);

        if (movedCount > 0) {
            // Mark level as modified and update UI
            this.stateManager.markDirty();
            this.level.updateModified();

            // Update all panels to reflect changes
            this.updateAllPanels();

            // Notify subscribers about level changes
            // Force level update by creating a deep copy to trigger state manager listeners
            this.stateManager.set('level', JSON.parse(JSON.stringify(this.level)));

            Logger.layer.info(`Moved ${movedCount} objects to ${moveToExtreme ? (moveUp ? 'first' : 'last') : (moveUp ? 'upper' : 'lower')} layer`);
        } else {
            Logger.layer.info('No objects were moved (already in target layer or no valid objects found)');
        }
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

        // If not found as top-level, search in groups recursively
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
     * Assign selected objects to a layer with improved nested object handling
     * @param {Set} selectedObjects - Set of selected object IDs
     * @param {boolean} moveUp - true to move to upper layer, false to move to lower layer
     * @param {boolean} moveToExtreme - true to move to first/last layer, false to move to adjacent layer
     * @returns {number} Number of objects moved
     */
    assignSelectedObjectsToLayer(selectedObjects, moveUp, moveToExtreme) {
        let movedCount = 0;
        const processedGroups = new Set(); // Track groups that have already been processed
        const layersSorted = this.level.getLayersSorted();

        if (moveToExtreme) {
            // Move all selected objects to first/last layer
            const targetLayerId = moveUp ?
                layersSorted[0]?.id :
                layersSorted[layersSorted.length - 1]?.id;

            if (!targetLayerId) {
                Logger.layer.warn('No target layer found for extreme move');
                return 0;
            }

            // Batch process objects for better performance
            const batchResults = this.batchProcessLayerAssignment(selectedObjects, targetLayerId, processedGroups);
            movedCount = batchResults.movedCount;

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Batch moved ${movedCount} objects to extreme layer ${targetLayerId}`);
            }
        } else {
            // Move each object/group to adjacent layer based on its current effective layer
            const batchResults = this.batchProcessAdjacentLayerAssignment(selectedObjects, layersSorted, moveUp, processedGroups);
            movedCount = batchResults.movedCount;

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Batch moved ${movedCount} objects to adjacent layers`);
            }
        }

        // Invalidate caches after bulk operations
        this.scheduleCacheInvalidation();

        return movedCount;
    }

    /**
     * Batch process layer assignment for multiple objects
     * @param {Set} selectedObjects - Set of object IDs
     * @param {string} targetLayerId - Target layer ID
     * @param {Set} processedGroups - Set of processed groups
     * @returns {Object} Results with movedCount
     */
    batchProcessLayerAssignment(selectedObjects, targetLayerId, processedGroups) {
        let movedCount = 0;
        const objectsToProcess = [];

        // Pre-filter objects that need processing
        selectedObjects.forEach(objId => {
            const targetObj = this.getCachedObject(objId);
            if (!targetObj) return;

            // Check if object is already in target layer
            const currentEffectiveLayerId = this.getCachedEffectiveLayerId(targetObj);
            if (currentEffectiveLayerId !== targetLayerId) {
                objectsToProcess.push(objId);
            }
        });

        // Process objects in batch
        objectsToProcess.forEach(objId => {
            const result = this.processObjectForLayerAssignmentOptimized(objId, targetLayerId, processedGroups);
            if (result.moved) {
                movedCount++;
            }
        });

        return { movedCount };
    }

    /**
     * Batch process adjacent layer assignment
     * @param {Set} selectedObjects - Set of object IDs
     * @param {Array} layersSorted - Sorted layers array
     * @param {boolean} moveUp - Direction to move
     * @param {Set} processedGroups - Set of processed groups
     * @returns {Object} Results with movedCount
     */
    batchProcessAdjacentLayerAssignment(selectedObjects, layersSorted, moveUp, processedGroups) {
        let movedCount = 0;
        const objectsByTargetLayer = new Map();

        // Group objects by their target layer for batch processing
        selectedObjects.forEach(objId => {
            const targetObj = this.getCachedObject(objId);
            if (!targetObj) return;

            const currentEffectiveLayerId = this.getCachedEffectiveLayerId(targetObj);
            const currentLayerIndex = layersSorted.findIndex(layer => layer.id === currentEffectiveLayerId);
            if (currentLayerIndex === -1) return;

            const targetIndex = moveUp ? currentLayerIndex - 1 : currentLayerIndex + 1;
            if (targetIndex < 0 || targetIndex >= layersSorted.length) return;

            const targetLayerId = layersSorted[targetIndex].id;

            if (!objectsByTargetLayer.has(targetLayerId)) {
                objectsByTargetLayer.set(targetLayerId, []);
            }
            objectsByTargetLayer.get(targetLayerId).push(objId);
        });

        // Process each group of objects going to the same layer
        objectsByTargetLayer.forEach((objIds, targetLayerId) => {
            objIds.forEach(objId => {
                const result = this.processObjectForLayerAssignmentOptimized(objId, targetLayerId, processedGroups);
                if (result.moved) {
                    movedCount++;
                }
            });
        });

        return { movedCount };
    }

    /**
     * Optimized version of processObjectForLayerAssignment for batch operations
     * @param {string} objId - Object ID to process
     * @param {string} targetLayerId - Target layer ID
     * @param {Set} processedGroups - Set of already processed groups
     * @returns {Object} Result with moved flag and target object info
     */
    processObjectForLayerAssignmentOptimized(objId, targetLayerId, processedGroups) {
        // Use cached object lookup
        const targetObj = this.getCachedObject(objId);
        if (!targetObj) {
            return { moved: false };
        }

        // Use cached effective layer ID
        const currentEffectiveLayerId = this.getCachedEffectiveLayerId(targetObj);
        if (currentEffectiveLayerId === targetLayerId) {
            return { moved: false };
        }

        // Use cached top-level object lookup
        const topLevelObj = this.getCachedTopLevelObject(objId);
        if (!topLevelObj) {
            return { moved: false };
        }

        // If we've already processed this top-level object, skip it
        if (processedGroups.has(topLevelObj.id)) {
            return { moved: false };
        }

        processedGroups.add(topLevelObj.id);

        // Get the old effective layer ID for notifications (use cache)
        const oldEffectiveLayerId = this.getCachedEffectiveLayerId(topLevelObj);

        // Change layerId of the top-level object
        const oldLayerId = topLevelObj.layerId;
        topLevelObj.layerId = targetLayerId;

        // Invalidate cache for this object since layerId changed
        this.invalidateObjectCaches(topLevelObj.id);

        // Notify StateManager about object property change
        this.stateManager.notifyListeners('objectPropertyChanged', topLevelObj, {
            property: 'layerId',
            oldValue: oldLayerId,
            newValue: targetLayerId
        });

        // Notify about layer objects count changes (optimized - batch these updates)
        if (oldEffectiveLayerId && oldEffectiveLayerId !== targetLayerId) {
            const oldCount = this.level.getLayerObjectsCount(oldEffectiveLayerId);
            this.level.notifyLayerObjectsCountChange(oldEffectiveLayerId, oldCount, oldCount + 1);

            const newCount = this.level.getLayerObjectsCount(targetLayerId);
            this.level.notifyLayerObjectsCountChange(targetLayerId, newCount, newCount - 1);
        }

        return { moved: true, targetObj: topLevelObj };
    }

    /**
     * Process individual object for layer assignment (legacy version)
     * @param {string} objId - Object ID to process
     * @param {string} targetLayerId - Target layer ID
     * @param {Set} processedGroups - Set of already processed groups
     * @returns {Object} Result with moved flag and target object info
     */
    processObjectForLayerAssignment(objId, targetLayerId, processedGroups) {
        const targetObj = this.findObjectById(objId);
        if (!targetObj) {
            return { moved: false };
        }

        // Check if this object is already in the target layer
        const currentEffectiveLayerId = this.renderOperations ?
            this.renderOperations.getEffectiveLayerId(targetObj) :
            (targetObj.layerId || this.level.getMainLayerId());
        if (currentEffectiveLayerId === targetLayerId) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Object already in target layer: ${objId}`);
            }
            return { moved: false };
        }

        // Find the top-level object (could be a group containing this object)
        const topLevelObj = this.findTopLevelObject(objId);
        if (!topLevelObj) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Could not find top-level object for: ${objId}`);
            }
            return { moved: false };
        }

        // If we've already processed this top-level object, skip it
        if (processedGroups.has(topLevelObj.id)) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Top-level object already processed: ${topLevelObj.id}`);
            }
            return { moved: false };
        }

        processedGroups.add(topLevelObj.id);

        // Get the old effective layer ID for notifications
        const oldEffectiveLayerId = this.renderOperations ?
            this.renderOperations.getEffectiveLayerId(topLevelObj) :
            (topLevelObj.layerId || this.level.getMainLayerId());

        // Change layerId of the top-level object
        const oldLayerId = topLevelObj.layerId;
        topLevelObj.layerId = targetLayerId;

        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug(`Changed layerId for top-level object ${topLevelObj.id} from ${oldLayerId} to ${targetLayerId}`);
        }

        // Notify StateManager about object property change
        this.stateManager.notifyListeners('objectPropertyChanged', topLevelObj, {
            property: 'layerId',
            oldValue: oldLayerId,
            newValue: targetLayerId
        });

        // Notify about layer objects count changes
        if (oldEffectiveLayerId && oldEffectiveLayerId !== targetLayerId) {
            const oldCount = this.level.getLayerObjectsCount(oldEffectiveLayerId);
            this.level.notifyLayerObjectsCountChange(oldEffectiveLayerId, oldCount, oldCount - 1);

            const newCount = this.level.getLayerObjectsCount(targetLayerId);
            this.level.notifyLayerObjectsCountChange(targetLayerId, newCount, newCount + 1);
        }

        return { moved: true, targetObj: topLevelObj };
    }

    /**
     * Check if objects can be moved to another layer
     * @returns {boolean} true if all conditions are met
     */
    canMoveObjectsToLayer() {
        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug('canMoveObjectsToLayer called');
        }

        // Condition 1: Selected objects list is not empty
        const selectedObjects = this.stateManager.get('selectedObjects');

        if (!selectedObjects || selectedObjects.size === 0) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug('Condition 1 failed: No selected objects');
            }
            return false;
        }

        // Condition 2: No active duplication (the only action we check for)
        const duplicate = this.stateManager.get('duplicate');

        if (duplicate && duplicate.isActive) {
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug('Condition 2 failed: Duplication active');
            }
            Logger.layer.warn('Cannot move objects while duplication is active');
            return false;
        }

        if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
            Logger.layer.debug('All conditions passed');
        }
        return true;
    }

    /**
     * Update page title (simplified without version)
     */
    updatePageTitle() {
        document.title = '2D Level Editor';
    }
}