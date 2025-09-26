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
import { Toolbar } from '../ui/Toolbar.js';
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
    static VERSION = '3.19.4';

    constructor(userPreferencesManager = null) {
        // Initialize managers
        this.stateManager = new StateManager();
        this.historyManager = new HistoryManager();
        this.assetManager = new AssetManager();
        this.fileManager = new FileManager();
        
        // Store user preferences manager
        this.userPrefs = userPreferencesManager;
        
        // Use ConfigManager from UserPreferencesManager if available, otherwise create new one
        this.configManager = userPreferencesManager?.configManager || null;
        
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
     * Update group edit mode references after undo/redo restore
     * @param {Array} previousSelection - Selection from the restored state
     */
    updateGroupEditModeAfterRestore(previousSelection) {
        const groupEditMode = this.stateManager.get('groupEditMode');
        if (!groupEditMode || !groupEditMode.isActive) {
            return; // Not in group edit mode, nothing to update
        }

        // Check if the active group still exists in the restored level
        const activeGroup = this.getCachedObject(groupEditMode.group.id);
        if (!activeGroup || activeGroup.type !== 'group') {
            // Active group no longer exists or is not a group, exit group edit mode
            this.stateManager.set('groupEditMode', {
                isActive: false,
                group: null,
                openGroups: []
            });
            return;
        }

        // Update references to point to restored objects
        const updatedOpenGroups = groupEditMode.openGroups.map(oldGroup => {
            const restoredGroup = this.getCachedObject(oldGroup.id);
            return restoredGroup && restoredGroup.type === 'group' ? restoredGroup : null;
        }).filter(group => group !== null);

        // Update group edit mode state with restored object references
        // Clear frozen frame state since object hierarchy may have changed
        const updatedGroupEditMode = {
            isActive: true,
            group: activeGroup,
            openGroups: updatedOpenGroups,
            frameFrozen: false, // Clear frozen state after restore
            frozenBounds: null   // Clear frozen bounds after restore
        };

        // Set _isEditing flag and originalChildren for all open groups (like in openGroupEditMode)
        updatedOpenGroups.forEach(openGroup => {
            openGroup._isEditing = true;
            // Restore originalChildren if not set, or keep existing
            if (!openGroup.originalChildren) {
                openGroup.originalChildren = [...openGroup.children];
            }
        });

        this.stateManager.set('groupEditMode', updatedGroupEditMode);

        // Force update of group state (similar to opening/closing group)
        // This ensures all internal group state is properly updated
        this.render();
        this.updateAllPanels();
    }

    /**
     * Schedule cache invalidation (debounced for performance)
     */
    /**
     * Умная инвалидация кешей - инвалидирует только необходимые кеши
     * @param {Object} invalidationSpec - спецификация того, что нужно инвалидировать
     */
    smartCacheInvalidation(invalidationSpec = {}) {
        const {
            objectIds = new Set(), // ID объектов, которые изменились
            layerIds = new Set(), // ID слоев, которые изменились
            invalidateAll = false, // Полная инвалидация
            reason = 'unknown' // Причина инвалидации для отладки
        } = invalidationSpec;

        if (invalidateAll) {
            // Полная инвалидация (fallback для сложных случаев)
            this.scheduleCacheInvalidation();
            return;
        }

        // Умная инвалидация только измененных объектов
        objectIds.forEach(objId => {
            this.invalidateObjectCaches(objId);
        });

        // Инвалидация кешей слоев
        layerIds.forEach(layerId => {
            // Вместо полной очистки счетчиков слоев, помечаем их как грязные
            this.markLayerCountCacheDirty(layerId);
        });

        // Инвалидация кеша выбираемых объектов (только если изменились объекты)
        if (objectIds.size > 0) {
            this.invalidateSelectableObjectsCacheForObjects(objectIds);
        }

        // Cache invalidation logged at info level
    }

    /**
     * Помечает кеш счетчика слоя как грязный (нуждается в пересчете)
     * @param {string} layerId - ID слоя
     */
    markLayerCountCacheDirty(layerId) {
        // Добавляем слой в список грязных для отложенного пересчета
        if (!this.dirtyLayerCounts) {
            this.dirtyLayerCounts = new Set();
        }
        this.dirtyLayerCounts.add(layerId);
    }

    /**
     * Инвалидирует кеш выбираемых объектов только для указанных объектов
     * @param {Set} objectIds - ID объектов, которые изменились
     */
    invalidateSelectableObjectsCacheForObjects(objectIds) {
        // Вместо полной очистки, удаляем только записи для измененных объектов
        if (this.selectableObjectsCache) {
            // Находим и удаляем кешированные записи, содержащие измененные объекты
            for (const [cacheKey, cachedSet] of this.selectableObjectsCache) {
                let hasChangedObjects = false;
                for (const objId of objectIds) {
                    if (cachedSet.has(objId)) {
                        hasChangedObjects = true;
                        break;
                    }
                }
                if (hasChangedObjects) {
                    this.selectableObjectsCache.delete(cacheKey);
                }
            }
        }
    }

    /**
     * Пересчитывает грязные счетчики слоев (отложенная операция)
     */
    recalculateDirtyLayerCounts() {
        if (!this.dirtyLayerCounts || this.dirtyLayerCounts.size === 0) {
            return;
        }

        // Пересчитываем только грязные счетчики
        for (const layerId of this.dirtyLayerCounts) {
            // Удаляем старый кеш для этого слоя
            this.level.layerCountsCache.delete(layerId);

            // При следующем обращении будет пересчитан автоматически
            // this.level.getLayerObjectsCount(layerId) - пересчитает и закэширует
        }

        this.dirtyLayerCounts.clear();
    }

    /**
     * Умная инвалидация после изменения слоев объектов
     * @param {Set} changedObjectIds - ID объектов, слои которых изменились
     * @param {Set} affectedLayers - ID слоев, которые были затронуты
     */
    invalidateAfterLayerChanges(changedObjectIds, affectedLayers) {
        this.smartCacheInvalidation({
            objectIds: changedObjectIds,
            layerIds: affectedLayers,
            reason: 'layer_changes'
        });

        // Отложенный пересчет счетчиков слоев
        setTimeout(() => {
            this.recalculateDirtyLayerCounts();
        }, 0);
    }

    /**
     * Умная инвалидация после групповых операций
     * @param {Set} affectedObjectIds - ID объектов, которые были затронуты
     */
    invalidateAfterGroupOperations(affectedObjectIds) {
        this.smartCacheInvalidation({
            objectIds: affectedObjectIds,
            invalidateAll: false, // Не нужна полная инвалидация для групповых операций
            reason: 'group_operations'
        });
    }

    /**
     * Умная инвалидация после операций дублирования
     * @param {Set} newObjectIds - ID новых объектов
     */
    invalidateAfterDuplicateOperations(newObjectIds) {
        this.smartCacheInvalidation({
            objectIds: newObjectIds,
            reason: 'duplicate_operations'
        });

        // Для новых объектов нужно обновить индекс
        setTimeout(() => {
            this.level.buildObjectsIndex();
        }, 0);
    }

    /**
     * Устаревший метод полной инвалидации (сохраняется для совместимости)
     */
    scheduleCacheInvalidation() {
        if (this.cacheInvalidationTimeout) {
            clearTimeout(this.cacheInvalidationTimeout);
        }

        this.cacheInvalidationTimeout = setTimeout(() => {
            this.clearCaches();
            this.clearSelectableObjectsCache();
            this.level.clearLayerCountsCache();
            this.level.clearObjectsIndex();

            // Перестраиваем индекс после очистки
            setTimeout(() => {
                this.level.buildObjectsIndex();
                // Также перестраиваем пространственный индекс для рендеринга
                if (this.renderOperations) {
                    this.renderOperations.buildSpatialIndex();
                }
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
        try {
            // Log version info
            this.log('info', `🚀 Level Editor v${LevelEditor.VERSION} - Utility Architecture`);
            this.log('info', 'Initializing editor components...');
        
        // Initialize configuration manager after Logger is available (only if not already set)
        if (!this.configManager) {
            this.configManager = new ConfigManager();
        }
        
        // Apply configuration settings immediately after ConfigManager is ready
        this.applyConfiguration();
        
        // Get DOM elements
        const canvas = document.getElementById('main-canvas');
        const assetsPanel = document.getElementById('assets-panel');
        const detailsPanel = document.getElementById('details-content-panel');
        const outlinerPanel = document.getElementById('outliner-content-panel');
        const layersPanel = document.getElementById('layers-content-panel');
        const toolbarContainer = document.getElementById('toolbar-container');


        if (!canvas || !assetsPanel || !detailsPanel || !outlinerPanel || !layersPanel || !toolbarContainer) {
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
        this.assetPanel = new AssetPanel(assetsPanel, this.assetManager, this.stateManager, this);
        this.detailsPanel = new DetailsPanel(detailsPanel, this.stateManager, this);
        this.outlinerPanel = new OutlinerPanel(outlinerPanel, this.stateManager, this);
        this.layersPanel = new LayersPanel(layersPanel, this.stateManager, this);
        this.settingsPanel = new SettingsPanel(document.body, this.configManager, this);
        
        // Initial render of asset panel
        this.assetPanel.render();
        
        // Create new level
        this.level = this.fileManager.createNewLevel();
        
        // Initialize toolbar after level is created
        this.toolbar = new Toolbar(toolbarContainer, this.stateManager, this);
        
        // Apply configuration to level settings
        this.applyConfigurationToLevel();
        
        
        // Initialize MenuManager
        const menuContainer = document.getElementById('menu-container');
        const navElement = menuContainer?.closest('nav');
        if (navElement) {
            this.menuManager = new MenuManager(navElement, this.eventHandlers);
            this.menuManager.initialize();

            // Update EventHandlers with MenuManager reference
            this.eventHandlers.menuManager = this.menuManager;
        } else {
            Logger.ui.warn('Navigation element not found, menu functionality will be limited');
        }

        // Setup event listeners
        this.eventHandlers.setupEventListeners();

        // Initialize search controls for current tab
        this.initializeSearchControls();

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
        
        // Построение пространственного индекса ДО первого рендеринга
        if (this.renderOperations) {
            try {
                this.renderOperations.buildSpatialIndex();
            } catch (error) {
                Logger.render.error('Failed to build spatial index:', error);
            }
        }

        // Apply saved panel sizes BEFORE initializing view states to prevent overwriting
        this.applySavedPanelSizes();

        // Initialize view states before render to prevent toolbar flickering
        this.eventHandlers.initializeViewStates();

        // Initial render (теперь индекс уже построен и состояния инициализированы)
        Logger.render.info('🎨 Initial render started');
        this.render();
        Logger.render.info('✅ Level Editor initialized successfully');

        // Update version info in UI and page title
        this.updateVersionInfo();
        this.updatePageTitle();

        this.updateAllPanels();

        } catch (error) {
            this.log('error', 'Failed to initialize editor:', error.message);
            throw error;
        }

        // Auto-set parallax start position to current camera position on startup
        const currentCamera = this.stateManager.get('camera');
        this.stateManager.set('parallax.startPosition', {
            x: currentCamera.x,
            y: currentCamera.y
        });

        // Ensure selection is clear before saving initial state
        this.stateManager.set('selectedObjects', new Set());

        // Save initial state
        this.historyManager.saveState(this.level.objects, this.stateManager.get('selectedObjects'), true);

        // Setup auto-save on page unload
        this.setupAutoSaveOnUnload();

        // Test context menu functionality
        this.testContextMenu();
        this.testContextMenuManager();
        this.testGlobalClickHandler();
        this.testPanningDetection();
        this.testMenuAutoClose();
        this.testCursorPositioning();
    }

    /**
     * Setup auto-save on page unload
     */
    setupAutoSaveOnUnload() {
        window.addEventListener('beforeunload', () => {
            try {
                Logger.ui.info('Auto-saving UI state on page unload...');

                // Save toolbar state
                if (this.toolbar) {
                    this.toolbar.saveState();
                }

                // Save current right panel tab
                const currentRightPanelTab = this.stateManager.get('rightPanelTab');
                if (currentRightPanelTab) {
                    this.configManager.set('editor.view.rightPanelTab', currentRightPanelTab);
                }

                // Save current active asset tabs
                const currentActiveAssetTabs = this.stateManager.get('activeAssetTabs');
                if (currentActiveAssetTabs) {
                    const tabsArray = Array.from(currentActiveAssetTabs);
                    this.configManager.set('editor.view.activeAssetTabs', tabsArray);
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

                // Save settings (this will save all configs including tabs and grid settings)
                if (this.configManager) {
                    this.configManager.saveSettings();
                }

                Logger.ui.info('UI state auto-saved successfully');
            } catch (error) {
                Logger.ui.error('Failed to auto-save UI state:', error);
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
     */
    applyConfiguration() {
        if (!this.configManager) {
            console.warn('[CONFIG] ConfigManager not initialized, skipping configuration');
            return;
        }
        
        
        // Note: Font scale and theme are applied immediately in index.html to prevent UI flicker
        
        // Apply grid settings to StateManager
        const gridSize = this.configManager.get('grid.size');
        const gridColor = this.configManager.get('grid.color');
        const gridThickness = this.configManager.get('grid.thickness');
        const gridOpacity = this.configManager.get('grid.opacity');
        const gridSubdivisions = this.configManager.get('grid.subdivisions');
        const gridSubdivColor = this.configManager.get('grid.subdivColor');
        const gridSubdivThickness = this.configManager.get('grid.subdivThickness');
        const gridType = this.configManager.get('canvas.gridType');


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
        if (gridSubdivisions !== undefined) {
            this.stateManager.set('canvas.gridSubdivisions', gridSubdivisions);
        }
        if (gridSubdivColor !== undefined) {
            // Convert hex color to rgba if needed
            let subdivColorValue = gridSubdivColor;
            if (gridSubdivColor.startsWith('#')) {
                const opacity = gridOpacity !== undefined ? gridOpacity : 0.1;
                const r = parseInt(gridSubdivColor.slice(1, 3), 16);
                const g = parseInt(gridSubdivColor.slice(3, 5), 16);
                const b = parseInt(gridSubdivColor.slice(5, 7), 16);
                subdivColorValue = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }
            this.stateManager.set('canvas.gridSubdivColor', subdivColorValue);
        }
        if (gridSubdivThickness !== undefined) {
            this.stateManager.set('canvas.gridSubdivThickness', gridSubdivThickness);
        }
        if (gridType !== undefined) {
            this.stateManager.set('canvas.gridType', gridType);
        }
        
        // Sync grid settings to ensure proper initialization
        if (this.settingsPanel && this.settingsPanel.gridSettings) {
            this.settingsPanel.gridSettings.syncAllGridSettingsToState();
        }
        

        // Save default settings on first run to ensure they persist
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
            console.warn('[CONFIG] Failed to apply saved panel settings:', error);
        }
    }

    /**
     * Apply panel sizes from user preferences
     */
    applyPanelSizesFromPreferences() {
        if (!this.userPrefs) return;

        try {
            // Right panel width
            const rightPanelWidth = this.userPrefs.get('rightPanelWidth');
            if (rightPanelWidth) {
                const rightPanel = document.getElementById('right-panel');
                if (rightPanel) {
                    rightPanel.style.width = rightPanelWidth + 'px';
                    rightPanel.style.flexShrink = '0';
                    rightPanel.style.flexGrow = '0';
                }
            }

            // Assets panel height
            const assetsPanelHeight = this.userPrefs.get('assetsPanelHeight');
            if (assetsPanelHeight) {
                const assetsPanel = document.getElementById('assets-panel');
                if (assetsPanel) {
                    assetsPanel.style.height = assetsPanelHeight + 'px';
                    assetsPanel.style.flexShrink = '0';
                }
            }

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
        } catch (error) {
            console.warn('[CONFIG] Failed to apply panel sizes from preferences:', error);
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
            
            // Apply right panel tab order
            const rightPanelTabOrder = this.userPrefs.get('rightPanelTabOrder');
            if (rightPanelTabOrder && Array.isArray(rightPanelTabOrder)) {
                this.stateManager.set('rightPanelTabOrder', rightPanelTabOrder);
            }
            
            // Re-render panels to apply tab order
            if (this.assetPanel) {
                this.assetPanel.render();
            }
            
        } catch (error) {
            console.warn('[CONFIG] Failed to apply tab order settings:', error);
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

        // Setup camera start position button handler
        this.setupCameraStartPositionButton();
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

                // Properly restore objects from JSON using fromJSON methods to maintain class instances
                this.level.objects = previousState.objects.map(objData => {
                    if (objData.type === 'group') {
                        return Group.fromJSON(objData);
                    } else {
                        return GameObject.fromJSON(objData);
                    }
                });

                // Rebuild object index and caches after restoring objects
                this.level.buildObjectsIndex();
                this.level.rebuildLayerCountsCache();

                // Rebuild spatial index for correct group bounds calculation
                if (this.renderOperations) {
                    this.renderOperations.buildSpatialIndex();
                }

            // Update group edit mode references to restored objects
            this.updateGroupEditModeAfterRestore(previousState.selection);

            // Force recalculation of group bounds for active group if in group edit mode
        // This ensures the group frame displays correct boundaries immediately
        const updatedGroupEditMode = this.stateManager.get('groupEditMode');
        if (updatedGroupEditMode && updatedGroupEditMode.isActive && updatedGroupEditMode.group) {
            // Force bounds recalculation by calling getObjectWorldBounds
            const freshBounds = this.objectOperations.getObjectWorldBounds(updatedGroupEditMode.group);

            // Update frozenBounds with fresh bounds to ensure immediate correct display
            // (since drawGroupEditFrame uses frozenBounds when available)
            const updatedState = this.stateManager.get('groupEditMode');
            if (updatedState.frameFrozen === false) {
                // If not frozen, we can update with fresh bounds for immediate display
                updatedState.frozenBounds = freshBounds;
                this.stateManager.set('groupEditMode', updatedState);
            }
        }

                // Smart cache invalidation for all restored objects
                const allRestoredObjectIds = new Set(this.level.objects.map(obj => obj.id));
                this.smartCacheInvalidation({
                    objectIds: allRestoredObjectIds,
                    invalidateAll: true, // Since all objects were restored, invalidate everything
                    reason: 'undo_restore'
                });

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

            // In group edit mode, restore selection as-is from history
            const currentGroupEditMode = this.stateManager.get('groupEditMode');
            if (currentGroupEditMode && currentGroupEditMode.isActive && currentGroupEditMode.group) {
                // In group edit mode, restore selection as-is from history
                // The history should contain the correct selection for the group edit context
                previousState.selection.forEach(id => {
                    if (objectIds.has(id)) {
                        validSelection.add(id);
                    }
                });
            } else {
                // Normal mode: include all existing objects from previous selection
                previousState.selection.forEach(id => {
                    if (objectIds.has(id)) {
                        validSelection.add(id);
                    }
                });
            }

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
            // Properly restore objects from JSON using fromJSON methods to maintain class instances
            this.level.objects = nextState.objects.map(objData => {
                if (objData.type === 'group') {
                    return Group.fromJSON(objData);
                } else {
                    return GameObject.fromJSON(objData);
                }
            });

            // Rebuild object index and caches after restoring objects
            this.level.buildObjectsIndex();
            this.level.rebuildLayerCountsCache();

            // Rebuild spatial index for correct group bounds calculation
            if (this.renderOperations) {
                this.renderOperations.buildSpatialIndex();
            }

            // Update group edit mode references to restored objects
            this.updateGroupEditModeAfterRestore(nextState.selection);

            // Force recalculation of group bounds for active group if in group edit mode
            // This ensures the group frame displays correct boundaries immediately
            const updatedGroupEditMode = this.stateManager.get('groupEditMode');
            if (updatedGroupEditMode && updatedGroupEditMode.isActive && updatedGroupEditMode.group) {
                // Force bounds recalculation by calling getObjectWorldBounds
                const freshBounds = this.objectOperations.getObjectWorldBounds(updatedGroupEditMode.group);

                // Update frozenBounds with fresh bounds to ensure immediate correct display
                // (since drawGroupEditFrame uses frozenBounds when available)
                const updatedState = this.stateManager.get('groupEditMode');
                if (updatedState.frameFrozen === false) {
                    // If not frozen, we can update with fresh bounds for immediate display
                    updatedState.frozenBounds = freshBounds;
                    this.stateManager.set('groupEditMode', updatedState);
                }
            }

            // Smart cache invalidation for all restored objects
            const allRestoredObjectIds = new Set(this.level.objects.map(obj => obj.id));
            this.smartCacheInvalidation({
                objectIds: allRestoredObjectIds,
                invalidateAll: true, // Since all objects were restored, invalidate everything
                reason: 'redo_restore'
            });

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

            // In group edit mode, restore selection as-is from history
            const currentGroupEditMode = this.stateManager.get('groupEditMode');
            if (currentGroupEditMode && currentGroupEditMode.isActive && currentGroupEditMode.group) {
                // In group edit mode, restore selection as-is from history
                // The history should contain the correct selection for the group edit context
                nextState.selection.forEach(id => {
                    if (objectIds.has(id)) {
                        validSelection.add(id);
                    }
                });
            } else {
                // Normal mode: include all existing objects from next selection
                nextState.selection.forEach(id => {
                    if (objectIds.has(id)) {
                        validSelection.add(id);
                    }
                });
            }

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

        // Auto-set parallax start position to current camera position after reset
        const currentCamera = this.stateManager.get('camera');
        this.stateManager.set('parallax.startPosition', {
            x: currentCamera.x,
            y: currentCamera.y
        });

        // Update cached level statistics
        this.updateCachedLevelStats();

        // Initialize current layer to Main layer
        this.setCurrentLayer(this.level.getMainLayerId());

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
            Logger.render.info('📂 Opening level...');

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

            // Auto-set parallax start position to current camera position after loading
            const currentCamera = this.stateManager.get('camera');
            this.stateManager.set('parallax.startPosition', {
                x: currentCamera.x,
                y: currentCamera.y
            });

            // Update cached level statistics
            this.updateCachedLevelStats();

            // Initialize current layer to Main layer
            this.setCurrentLayer(this.level.getMainLayerId());

            this.historyManager.clear();

            // Ensure selection is clear before saving initial state
            this.stateManager.set('selectedObjects', new Set());

            this.historyManager.saveState(this.level.objects, this.stateManager.get('selectedObjects'), true);
            this.render();
            this.updateAllPanels();

            Logger.render.info(`✅ Level loaded: ${this.level.objects.length} objects`);
        } catch (error) {
            Logger.render.error(`❌ Failed to load level: ${error.message}`);
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
        Logger.render.info('💾 Level saved successfully');
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
            Logger.render.info(`💾 Level saved as: ${fileName}`);
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

    computeSelectableSet() {
        return this.objectOperations.computeSelectableSet();
    }

    /**
     * Initialize search controls for the current active tab
     */
    initializeSearchControls() {
        const searchSection = document.getElementById('right-panel-search');
        if (!searchSection) return;

        // Get current active tab
        const activeTab = document.querySelector('.tab-right.active');
        if (!activeTab) return;

        const tabName = activeTab.dataset.tab;

        // Show search section for layers and outliner tabs
        const showSearch = tabName === 'layers' || tabName === 'outliner';
        searchSection.style.display = showSearch ? 'block' : 'none';

        // Render appropriate search controls
        if (showSearch) {
            if (tabName === 'layers' && this.layersPanel) {
                this.layersPanel.renderLayersSearchControls();
            } else if (tabName === 'outliner' && this.outlinerPanel) {
                this.outlinerPanel.renderOutlinerSearchControls();
            }
        }
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

        // Система группировки уведомлений для оптимизации производительности
        const batchedNotifications = {
            objectPropertyChanges: new Map(), // property -> [{obj, oldValue, newValue}, ...]
            layerCountChanges: new Map() // layerId -> {oldCount, newCount}
        };

        // Отслеживание измененных объектов и слоев для умной инвалидации кешей
        const changedObjectIds = new Set();
        const affectedLayers = new Set();

        if (moveToExtreme) {
            // Move all selected objects to first/last unlocked layer
            let targetLayerId = null;
            
            if (moveUp) {
                // Find first unlocked layer from the top
                for (let i = 0; i < layersSorted.length; i++) {
                    if (!layersSorted[i].locked) {
                        targetLayerId = layersSorted[i].id;
                        break;
                    }
                }
            } else {
                // Find last unlocked layer from the bottom
                for (let i = layersSorted.length - 1; i >= 0; i--) {
                    if (!layersSorted[i].locked) {
                        targetLayerId = layersSorted[i].id;
                        break;
                    }
                }
            }

            if (!targetLayerId) {
                Logger.layer.warn('No unlocked layer found for extreme move');
                return 0;
            }

            // Batch process objects for better performance
            const batchResults = this.batchProcessLayerAssignment(selectedObjects, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
            movedCount = batchResults.movedCount;

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Batch moved ${movedCount} objects to extreme layer ${targetLayerId}`);
            }
        } else {
            // Move each object/group to adjacent layer based on its current effective layer
            const batchResults = this.batchProcessAdjacentLayerAssignment(selectedObjects, layersSorted, moveUp, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
            movedCount = batchResults.movedCount;

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Batch moved ${movedCount} objects to adjacent layers`);
            }
        }

        // Отправляем сгруппированные уведомления для оптимизации производительности
        this.flushBatchedNotifications(batchedNotifications);

        // Умная инвалидация кешей только для измененных объектов и слоев
        this.invalidateAfterLayerChanges(changedObjectIds, affectedLayers);

        // При массовых изменениях слоев перестраиваем пространственный индекс
        if (changedObjectIds.size > 10) {
            setTimeout(() => {
                if (this.renderOperations) {
                    this.renderOperations.buildSpatialIndex();
                }
            }, 0);
        }

        return movedCount;
    }

    /**
     * Batch process layer assignment for multiple objects
     * @param {Set} selectedObjects - Set of object IDs
     * @param {string} targetLayerId - Target layer ID
     * @param {Set} processedGroups - Set of processed groups
     * @returns {Object} Results with movedCount
     */
    batchProcessLayerAssignment(selectedObjects, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers) {
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
            const result = this.processObjectForLayerAssignmentOptimized(objId, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
            if (result.moved) {
                movedCount++;
            }
        });

        return { movedCount };
    }

    /**
     * Find next unlocked layer in the specified direction
     * @param {Array} layersSorted - Sorted layers array
     * @param {string} currentLayerId - Current layer ID
     * @param {boolean} moveUp - Direction to move
     * @returns {string|null} Next unlocked layer ID or null if not found
     */
    findNextUnlockedLayer(layersSorted, currentLayerId, moveUp) {
        const currentLayerIndex = layersSorted.findIndex(layer => layer.id === currentLayerId);
        if (currentLayerIndex === -1) return null;

        const direction = moveUp ? -1 : 1;
        let targetIndex = currentLayerIndex + direction;

        // Search for next unlocked layer
        while (targetIndex >= 0 && targetIndex < layersSorted.length) {
            const targetLayer = layersSorted[targetIndex];
            if (!targetLayer.locked) {
                return targetLayer.id;
            }
            targetIndex += direction;
        }

        return null;
    }

    /**
     * Batch process adjacent layer assignment
     * @param {Set} selectedObjects - Set of object IDs
     * @param {Array} layersSorted - Sorted layers array
     * @param {boolean} moveUp - Direction to move
     * @param {Set} processedGroups - Set of processed groups
     * @returns {Object} Results with movedCount
     */
    batchProcessAdjacentLayerAssignment(selectedObjects, layersSorted, moveUp, processedGroups, batchedNotifications, changedObjectIds, affectedLayers) {
        let movedCount = 0;
        const objectsByTargetLayer = new Map();

        // Group objects by their target layer for batch processing
        selectedObjects.forEach(objId => {
            const targetObj = this.getCachedObject(objId);
            if (!targetObj) return;

            const currentEffectiveLayerId = this.getCachedEffectiveLayerId(targetObj);
            const currentLayerIndex = layersSorted.findIndex(layer => layer.id === currentEffectiveLayerId);
            if (currentLayerIndex === -1) return;

            // Find next unlocked layer instead of just adjacent layer
            const targetLayerId = this.findNextUnlockedLayer(layersSorted, currentEffectiveLayerId, moveUp);
            if (!targetLayerId) return; // No unlocked layer found in this direction

            if (!objectsByTargetLayer.has(targetLayerId)) {
                objectsByTargetLayer.set(targetLayerId, []);
            }
            objectsByTargetLayer.get(targetLayerId).push(objId);
        });

        // Process each group of objects going to the same layer
        objectsByTargetLayer.forEach((objIds, targetLayerId) => {
            objIds.forEach(objId => {
                const result = this.processObjectForLayerAssignmentOptimized(objId, targetLayerId, processedGroups, batchedNotifications, changedObjectIds, affectedLayers);
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
    processObjectForLayerAssignmentOptimized(objId, targetLayerId, processedGroups, batchedNotifications = null, changedObjectIds = null, affectedLayers = null) {
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

        // FORCED INHERITANCE: Propagate layerId to all children if this is a group
        if (topLevelObj.type === 'group' && topLevelObj.children) {
            topLevelObj.propagateLayerIdToChildren();
            
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.layer.debug(`Propagated layerId ${targetLayerId} to all children of group ${topLevelObj.id}`);
            }
        }

        // Отслеживаем измененные объекты и слои для умной инвалидации кешей
        if (changedObjectIds) {
            changedObjectIds.add(topLevelObj.id);
        }
        if (affectedLayers && oldLayerId) {
            affectedLayers.add(oldLayerId);
        }
        if (affectedLayers && targetLayerId) {
            affectedLayers.add(targetLayerId);
        }

        // Invalidate cache for this object since layerId changed
        this.invalidateObjectCaches(topLevelObj.id);

        // Группируем уведомления или отправляем сразу для обратной совместимости
        if (batchedNotifications) {
            // Группируем уведомления для оптимизации производительности
            this.batchNotifyObjectPropertyChanged(batchedNotifications, topLevelObj, 'layerId', oldLayerId, targetLayerId);

            if (oldEffectiveLayerId && oldEffectiveLayerId !== targetLayerId) {
                this.batchNotifyLayerCountChanged(batchedNotifications, oldEffectiveLayerId, targetLayerId);
            }
        } else {
            // Отправляем уведомления сразу (обратная совместимость)
            this.stateManager.notifyListeners('objectPropertyChanged', topLevelObj, {
                property: 'layerId',
                oldValue: oldLayerId,
                newValue: targetLayerId
            });

            // Notify about layer objects count changes
            if (oldEffectiveLayerId && oldEffectiveLayerId !== targetLayerId) {
                const oldCount = this.level.getLayerObjectsCount(oldEffectiveLayerId);
                this.level.notifyLayerObjectsCountChange(oldEffectiveLayerId, oldCount, oldCount + 1);

                const newCount = this.level.getLayerObjectsCount(targetLayerId);
                this.level.notifyLayerObjectsCountChange(targetLayerId, newCount, newCount - 1);
            }
        }

        return { moved: true, targetObj: topLevelObj };
    }

    /**
     * Группирует уведомления об изменении свойств объектов для оптимизации производительности
     * @param {Object} batchedNotifications - Структура для группировки уведомлений
     * @param {Object} obj - Объект, свойство которого изменилось
     * @param {string} property - Название свойства
     * @param {*} oldValue - Старое значение
     * @param {*} newValue - Новое значение
     */
    batchNotifyObjectPropertyChanged(batchedNotifications, obj, property, oldValue, newValue) {
        if (!batchedNotifications.objectPropertyChanges.has(property)) {
            batchedNotifications.objectPropertyChanges.set(property, []);
        }

        batchedNotifications.objectPropertyChanges.get(property).push({
            obj,
            oldValue,
            newValue
        });
    }

    /**
     * Группирует уведомления об изменении счетчиков слоев
     * @param {Object} batchedNotifications - Структура для группировки уведомлений
     * @param {string} oldLayerId - ID старого слоя
     * @param {string} newLayerId - ID нового слоя
     */
    batchNotifyLayerCountChanged(batchedNotifications, oldLayerId, newLayerId) {
        // Группируем изменения счетчиков слоев
        if (!batchedNotifications.layerCountChanges.has(oldLayerId)) {
            const oldCount = this.level.getLayerObjectsCount(oldLayerId);
            batchedNotifications.layerCountChanges.set(oldLayerId, {
                oldCount,
                newCount: oldCount - 1 // Уменьшаем счетчик для старого слоя
            });
        }

        if (!batchedNotifications.layerCountChanges.has(newLayerId)) {
            const newCount = this.level.getLayerObjectsCount(newLayerId);
            batchedNotifications.layerCountChanges.set(newLayerId, {
                oldCount: newCount + 1, // Старый счетчик был на 1 больше
                newCount
            });
        }
    }

    /**
     * Отправляет все сгруппированные уведомления
     * @param {Object} batchedNotifications - Структура сгруппированных уведомлений
     */
    flushBatchedNotifications(batchedNotifications) {
        // Отправляем уведомления об изменении свойств объектов
        for (const [property, changes] of batchedNotifications.objectPropertyChanges) {
            // Отправляем сводное уведомление для каждого свойства
            this.stateManager.notifyListeners('objectsPropertyChanged', changes, {
                property,
                count: changes.length
            });

            // Для обратной совместимости отправляем отдельные уведомления
            changes.forEach(change => {
                this.stateManager.notifyListeners('objectPropertyChanged', change.obj, {
                    property,
                    oldValue: change.oldValue,
                    newValue: change.newValue
                });
            });
        }

        // Отправляем уведомления об изменении счетчиков слоев
        for (const [layerId, countInfo] of batchedNotifications.layerCountChanges) {
            this.level.notifyLayerObjectsCountChange(layerId, countInfo.newCount, countInfo.oldCount);
        }
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
}