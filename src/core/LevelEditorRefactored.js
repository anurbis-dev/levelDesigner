import { StateManager } from '../managers/StateManager.js';
import { HistoryManager } from '../managers/HistoryManager.js';
import { AssetManager } from '../managers/AssetManager.js';
import { FileManager } from '../managers/FileManager.js';
import { SettingsManager } from '../managers/SettingsManager.js';
import { CanvasRenderer } from '../ui/CanvasRenderer.js';
import { AssetPanel } from '../ui/AssetPanel.js';
import { DetailsPanel } from '../ui/DetailsPanel.js';
import { OutlinerPanel } from '../ui/OutlinerPanel.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { Level } from '../models/Level.js';
import { duplicateRenderUtils } from '../../tmp/duplicate_renderer_fixed.js';

// Import new modules
import { EventHandlers } from './EventHandlers.js';
import { MouseHandlers } from './MouseHandlers.js';
import { ObjectOperations } from './ObjectOperations.js';
import { GroupOperations } from './GroupOperations.js';
import { RenderOperations } from './RenderOperations.js';
import { DuplicateOperations } from './DuplicateOperations.js';

/**
 * Main Level Editor class - Refactored version
 */
export class LevelEditor {
    constructor() {
        // Initialize managers
        this.stateManager = new StateManager();
        this.historyManager = new HistoryManager();
        this.assetManager = new AssetManager();
        this.fileManager = new FileManager();
        this.settingsManager = new SettingsManager();
        
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
     * Initialize the editor
     */
    async init() {
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
        this.settingsPanel = new SettingsPanel(document.body, this.settingsManager);
        
        // Initial render of asset panel
        this.assetPanel.render();
        
        // Create new level
        this.level = this.fileManager.createNewLevel();
        
        // Setup event listeners
        this.eventHandlers.setupEventListeners();
        
        // Preload assets
        await this.assetManager.preloadImages();
        
        // Initial render
        this.render();
        this.updateAllPanels();
        
        // Save initial state
        this.historyManager.saveState(this.level.objects, true);
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
           'duplicate.basePosition': { x: 0, y: 0 }
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
            this.updateAllPanels();
            this.render();
            this.stateManager.markDirty();
        }
    }

    redo() {
        const nextState = this.historyManager.redo();
        if (nextState) {
            this.level.objects = nextState;
            this.stateManager.set('selectedObjects', new Set());
            this.updateAllPanels();
            this.render();
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
        this.updateAllPanels();
        this.render();
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
            this.updateAllPanels();
            this.render();
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

    // Group edit helpers - delegate to group operations
    getOpenGroups() {
        return this.groupOperations.getOpenGroups();
    }

    getActiveEditedGroup() {
        return this.groupOperations.getActiveEditedGroup();
    }
}
