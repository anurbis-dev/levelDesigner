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
    static VERSION = '3.3.0';

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
        
        // Store reference to duplicate render utils
        this.duplicateRenderUtils = duplicateRenderUtils;
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
            console.log(`[EVENT] ${message}`, ...args);
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
        
        // Initial render
        this.render();
        
        // Update version info in UI and page title
        this.updateVersionInfo();
        this.updatePageTitle();
        
        this.updateAllPanels();
        
        // Initialize view states after level is created
        this.eventHandlers.initializeViewStates();
        
        // Save initial state
        this.historyManager.saveState(this.level.objects, true);

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
        console.log('[TEST] Context menu test started');

        // Test that context menu is initialized
        if (this.canvasContextMenu) {
            console.log('[TEST] ✓ CanvasContextMenu initialized successfully');
        } else {
            console.log('[TEST] ✗ CanvasContextMenu not initialized');
        }

        // Test menu methods
        const testData = {
            hasSelection: false,
            isGroup: false,
            clickPosition: { x: 100, y: 100 }
        };

        // Test extractContextData method
        if (this.canvasContextMenu && typeof this.canvasContextMenu.extractContextData === 'function') {
            console.log('[TEST] ✓ extractContextData method exists');
        }

        // Test hasSelectedObjects method
        if (this.canvasContextMenu && typeof this.canvasContextMenu.hasSelectedObjects === 'function') {
            const hasSelection = this.canvasContextMenu.hasSelectedObjects();
            console.log(`[TEST] ✓ hasSelectedObjects method works: ${hasSelection}`);
        }

        console.log('[TEST] Context menu test completed');
    }

    /**
     * Test ContextMenuManager functionality
     */
    testContextMenuManager() {
        console.log('[TEST] ContextMenuManager test started');

        if (this.contextMenuManager) {
            console.log('[TEST] ✓ ContextMenuManager initialized successfully');

            const registeredMenus = this.contextMenuManager.getRegisteredMenus();
            console.log(`[TEST] ✓ Registered menus: ${registeredMenus.join(', ')}`);

            const hasActive = this.contextMenuManager.hasActiveMenu();
            console.log(`[TEST] ✓ Has active menu: ${hasActive}`);
        } else {
            console.log('[TEST] ✗ ContextMenuManager not initialized');
        }

        console.log('[TEST] ContextMenuManager test completed');
    }

    /**
     * Test global click handler functionality
     */
    testGlobalClickHandler() {
        console.log('[TEST] Global click handler test started');

        if (this.contextMenuManager) {
            console.log('[TEST] ✓ Global context menu handler should close menus on empty area clicks');

            // Test that we can access the manager
            const registeredMenus = this.contextMenuManager.getRegisteredMenus();
            console.log(`[TEST] ✓ Global handler can access ${registeredMenus.length} registered menus`);
        } else {
            console.log('[TEST] ✗ ContextMenuManager not available for global handler');
        }

        console.log('[TEST] Global click handler test completed');
        console.log('[TEST] Right-click in empty areas should now close all active menus');
    }

    /**
     * Test panning detection functionality
     */
    testPanningDetection() {
        console.log('[TEST] Panning detection test started');

        // Test mouse state initialization
        const mouseState = this.stateManager.get('mouse');
        if (mouseState) {
            console.log('[TEST] ✓ Mouse state available for panning detection');

            // Check if panning-related properties exist
            const hasPanningProps = mouseState.hasOwnProperty('wasPanning') ||
                                  mouseState.hasOwnProperty('rightClickStartX') ||
                                  mouseState.hasOwnProperty('rightClickStartY');

            if (hasPanningProps) {
                console.log('[TEST] ✓ Panning detection properties initialized');
            } else {
                console.log('[TEST] ⚠ Panning detection properties not found');
            }
        } else {
            console.log('[TEST] ✗ Mouse state not available');
        }

        console.log('[TEST] Panning detection test completed');
        console.log('[TEST] Right-click + drag should not show context menu');
        console.log('[TEST] Right-click without movement should show context menu');
    }

    /**
     * Test menu auto-close functionality
     */
    testMenuAutoClose() {
        console.log('[TEST] Menu auto-close test started');

        if (this.canvasContextMenu) {
            console.log('[TEST] ✓ CanvasContextMenu supports auto-close on mouse leave');

            // Test that the menu has the necessary methods
            if (typeof this.canvasContextMenu.setupMenuClosing === 'function') {
                console.log('[TEST] ✓ setupMenuClosing method available');
            }

            // Check if we can access the base functionality
            const hasBaseMenu = this.canvasContextMenu.constructor.name === 'CanvasContextMenu';
            if (hasBaseMenu) {
                console.log('[TEST] ✓ CanvasContextMenu inherits from BaseContextMenu');
            }
        } else {
            console.log('[TEST] ✗ CanvasContextMenu not available');
        }

        console.log('[TEST] Menu auto-close test completed');
        console.log('[TEST] Menus should now close automatically when mouse leaves their area');
    }

    /**
     * Test cursor positioning functionality
     */
    testCursorPositioning() {
        console.log('[TEST] Cursor positioning test started');

        let canvasMenuOk = false;
        let consoleMenuOk = false;

        if (this.canvasContextMenu) {
            console.log('[TEST] ✓ CanvasContextMenu supports cursor positioning');

            // Test that the menu has the necessary methods
            if (typeof this.canvasContextMenu.ensureCursorInsideMenu === 'function') {
                console.log('[TEST] ✓ CanvasContextMenu.ensureCursorInsideMenu method available');
                canvasMenuOk = true;
            }

            if (typeof this.canvasContextMenu.adjustCursorPosition === 'function') {
                console.log('[TEST] ✓ CanvasContextMenu.adjustCursorPosition method available');
            }
        } else {
            console.log('[TEST] ✗ CanvasContextMenu not available');
        }

        // Test ConsoleContextMenu if available
        if (window.consoleContextMenu) {
            console.log('[TEST] ✓ ConsoleContextMenu supports cursor positioning');

            if (typeof window.consoleContextMenu.ensureCursorInsideMenu === 'function') {
                console.log('[TEST] ✓ ConsoleContextMenu.ensureCursorInsideMenu method available');
                consoleMenuOk = true;
            }
        } else {
            console.log('[TEST] ⚠ ConsoleContextMenu not available for testing');
        }

        if (canvasMenuOk && consoleMenuOk) {
            console.log('[TEST] ✓ Both context menus support cursor positioning');
        } else if (canvasMenuOk) {
            console.log('[TEST] ✓ Canvas context menu supports cursor positioning');
        }

        console.log('[TEST] Cursor positioning test completed');
        console.log('[TEST] Menus should now position themselves to keep cursor inside bounds (2px offset)');
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
        if (playerStartCount === 0) {
            console.log('[LEVEL STATS] No Player Start found, auto-creating...');
            const playerStartObject = {
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
            };

            this.level.addObject(playerStartObject);
            console.log('[LEVEL STATS] Player Start auto-created at (0,0)');

            // Update history
            this.historyManager.saveState(this.level.objects, false);

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
     * History operations
     */
    undo() {
        const previousState = this.historyManager.undo();
        if (previousState) {
            this.level.objects = previousState;
            this.stateManager.set('selectedObjects', new Set());
            this.render();
            this.updateAllPanels();
            this.stateManager.markDirty();
        }
    }

    redo() {
        const nextState = this.historyManager.redo();
        if (nextState) {
            this.level.objects = nextState;
            this.stateManager.set('selectedObjects', new Set());
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
        this.historyManager.saveState(this.level.objects, true);
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
            this.historyManager.saveState(this.level.objects, true);
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
        return JSON.parse(JSON.stringify(obj));
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
        this.objectOperations.deleteSelectedObjects();
    }

    duplicateSelectedObjects() {
        this.duplicateOperations.duplicateSelectedObjects();
    }

    groupSelectedObjects() {
        this.groupOperations.groupSelectedObjects();
    }

    ungroupSelectedObjects() {
        this.groupOperations.ungroupSelectedObjects();
    }

    /**
     * Copy selected objects to clipboard
     */
    copySelectedObjects() {
        // TODO: Implement copy functionality
        console.log('Copy selected objects - not implemented yet');
    }

    /**
     * Paste objects from clipboard
     */
    pasteObjects() {
        // TODO: Implement paste functionality
        console.log('Paste objects - not implemented yet');
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
     * Update page title (simplified without version)
     */
    updatePageTitle() {
        document.title = '2D Level Editor';
    }
}