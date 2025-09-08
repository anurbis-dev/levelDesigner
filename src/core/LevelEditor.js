import { StateManager } from '../managers/StateManager.js';
import { HistoryManager } from '../managers/HistoryManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { FileManager } from '../managers/FileManager.js';
import { ConfigManager } from '../managers/ConfigManager.js';
import { CanvasRenderer } from '../ui/CanvasRenderer.js';
import { AssetPanel } from '../ui/AssetPanel.js';
import { DetailsPanel } from '../ui/DetailsPanel.js';
import { OutlinerPanel } from '../ui/OutlinerPanel.js';
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
    static VERSION = '2.3.3';

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
        this.settingsPanel = null;
        
        // Current level
        this.level = null;
        
        // Event handlers
        this.eventHandlers = new Map();
        
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
        
        if (!canvas || !assetsPanel || !detailsPanel || !outlinerPanel) {
            throw new Error('Required DOM elements not found');
        }
        
        // Initialize renderer
        this.canvasRenderer = new CanvasRenderer(canvas);
        this.canvasRenderer.resizeCanvas();
        
        // Initialize UI panels
        this.assetPanel = new AssetPanel(assetsPanel, this.assetManager, this.stateManager);
        this.detailsPanel = new DetailsPanel(detailsPanel, this.stateManager, this);
        this.outlinerPanel = new OutlinerPanel(outlinerPanel, this.stateManager, this);
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
        
        // Setup event listeners
        this.eventHandlers.setupEventListeners();
        
        // Preload assets
        await this.assetManager.preloadImages();
        
        // Initial render
        this.render();
        
        // Update version info in UI and page title
        this.updateVersionInfo();
        this.updatePageTitle();
        
        this.updateAllPanels();
        
        // Save initial state
        this.historyManager.saveState(this.level.objects, true);
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
        this.detailsPanel.render();
        this.outlinerPanel.render();
        this.updateLevelStatsPanel();
    }

    updateLevelStatsPanel() {
        const levelStatsContent = document.getElementById('level-stats-content');
        if (!levelStatsContent) return;
        
        const stats = this.level.getStats();
        levelStatsContent.innerHTML = `
            <p class="text-sm">Total Objects: ${stats.totalObjects}</p>
            <p class="text-sm">Groups: ${stats.groups}</p>
            <div class="mt-2">
                <p class="text-sm font-medium">By Type:</p>
                ${Object.entries(stats.byType).map(([type, count]) => 
                    `<p class="text-sm ml-2">${type}: ${count}</p>`
                ).join('')}
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
        
        this.level = this.fileManager.createNewLevel();
        this.stateManager.reset();
        
        // Re-initialize group edit mode state after reset
        this.stateManager.set('groupEditMode', {
            isActive: false,
            groupId: null,
            group: null,
            openGroups: []
        });
        
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
            this.level = await this.fileManager.loadLevelFromFileInput();
            this.stateManager.reset();
            
            // Re-initialize group edit mode state after reset
            this.stateManager.set('groupEditMode', {
                isActive: false,
                groupId: null,
                group: null,
                openGroups: []
            });
            
            this.historyManager.clear();
            this.historyManager.saveState(this.level.objects, true);
            this.render();
            this.updateAllPanels();
        } catch (error) {
            alert("Error loading level: " + error.message);
        }
    }

    saveLevel() {
        this.fileManager.saveLevel(this.level);
        this.stateManager.markClean();
    }

    saveLevelAs() {
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