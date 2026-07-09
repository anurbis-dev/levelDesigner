import { BaseModule } from '../core/BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { SearchSectionUtils } from '../utils/SearchSectionUtils.js';
import { ScrollUtils } from '../utils/ScrollUtils.js';
import { eventHandlerManager } from './EventHandlerManager.js';
import { globalEventRegistry } from './GlobalEventRegistry.js';
import { ResetRegistry } from '../utils/ResetRegistry.js';

/**
 * Event Handlers module for LevelEditor
 * Handles all event listener setup and management
 */
export class EventHandlers extends BaseModule {
    constructor(levelEditor, menuManager = null) {
        super(levelEditor);
        this._rafId = null; // render loop id
        this.menuManager = menuManager;
        
        this._destroyed = false;
        this._updatingTabHandlers = false;
        
        // Track MutationObservers for cleanup
        this.mutationObservers = [];
        
        Logger.event.info('EventHandlers initialized');
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Enable universal middle-mouse panning for any scrollable editor container.
        ScrollUtils.setupGlobalHandlers();

        // Window events - combine all window handlers
        this.setupWindowEvents();
        
        // Canvas events
        this.setupCanvasEvents();
        
        // Keyboard events
        this.setupKeyboardEvents();

        // Initialize group edit mode state
        this.editor.stateManager.set('groupEditMode', {
            isActive: false,
            groupId: null,
            group: null,
            openGroups: [] // Initialize openGroups
        });
        
        // Menu events
        this.setupMenuEvents();
        
        // Tab event listeners will be setup after panels are created in initializeViewStates
        
        // State change listeners
        this.setupStateListeners();

        // Start render loop with proper cleanup support
        this.startRenderLoop();
    }

    /**
     * Setup all window events in one call
     */
    setupWindowEvents() {
        // Check if already registered to prevent duplicates
        if (this._windowEventsRegistered) {
            Logger.event.debug('Window events already registered, skipping');
            return;
        }
        
        // Combined window handlers
        const windowHandlers = {
            // Resize events
            resize: () => {
                if (this._destroyed) return;
                this.editor.canvasRenderer.resizeCanvas();
                // Canvas element is not recreated, so no need to re-register events
                this.editor.render();
            },
            
            // Global mouse events for proper marquee handling
            mousedown: (e) => this.editor.mouseHandlers.handleGlobalMouseDown(e),
            mousemove: (e) => this.editor.mouseHandlers.handleGlobalMouseMove(e),
            mouseup: (e) => this.editor.mouseHandlers.handleGlobalMouseUp(e),
            
            // Keyboard events
            keydown: (e) => {
                if (this._destroyed) return;
                if (e.key === 'Control' || e.key === 'Meta') {
                    this.editor.stateManager.update({
                        'keyboard.ctrlSnapToGrid': true
                    });
                } else if (e.key === 'Shift') {
                    this.editor.stateManager.update({
                        'keyboard.shiftKey': true
                    });
                } else if (e.key === 'Alt') {
                    this.editor.stateManager.update({
                        'keyboard.altKey': true
                    });
                }
                
                this.handleKeyDown(e);
            },
            keyup: (e) => {
                if (this._destroyed) return;
                if (e.key === 'Control' || e.key === 'Meta') {
                    this.editor.stateManager.update({
                        'keyboard.ctrlSnapToGrid': false
                    });
                } else if (e.key === 'Shift') {
                    this.editor.stateManager.update({
                        'keyboard.shiftKey': false
                    });
                } else if (e.key === 'Alt') {
                    this.editor.stateManager.update({
                        'keyboard.altKey': false
                    });
                }
                
                this.handleKeyUp(e);
            }
        };
        
        // Register window events using GlobalEventRegistry (handles duplicates automatically)
        // Note: mousedown/mousemove/mouseup are registered once here on 'window' only
        // (matching the pattern used by BasePanel's own marquee handling) - do not add
        // duplicate document-level registrations for the same handlers, since window
        // already receives every mouse event the document would, and each duplicate
        // registration causes the handler to fire multiple times per physical event.
        globalEventRegistry.registerComponentHandlers('window-all', windowHandlers, 'window');

        // Release keyboard lock whenever fullscreen exits — covers the case where the user
        // presses Escape to exit fullscreen directly (bypassing toggleFullscreen()).
        globalEventRegistry.registerComponentHandlers('fullscreen-change', {
            fullscreenchange: () => {
                if (!document.fullscreenElement) {
                    this._releaseKeyboardLock();
                    this.editor.stateManager.set('view.fullscreen', false);
                    this.updateViewCheckbox('fullscreen', false);
                }
            }
        }, 'document');

        // Mark as registered
        this._windowEventsRegistered = true;
    }
    
    /**
     * Start render loop with cleanup support
     */
    startRenderLoop() {
        let lastDuplicateState = null;
        
        const renderLoop = () => {
            if (this._destroyed) {
                // Stop loop if destroyed
                return;
            }
            
            try {
                const duplicate = this.editor.stateManager.get('duplicate');
                const currentState = duplicate ? 
                    `${duplicate.isActive}_${duplicate.objects?.length || 0}` : 
                    'null';

                // Log only when duplicate state changes (optimized to reduce console spam)
                if (currentState !== lastDuplicateState) {
                    // Duplicate state change handled
                    lastDuplicateState = currentState;
                }

                // Skip the redraw when nothing observable changed since the last frame.
                // Every interactive path (mousemove, camera pan/zoom/drag, selection,
                // object edits) already funnels through stateManager.set/update, which
                // flips this flag — so an idle canvas stops costing a render per frame.
                if (this.editor.stateManager.consumeNeedsRender()) {
                    this.editor.render();
                }
            } catch (e) {
                if (!this._destroyed) {
                    Logger.event.error('Render loop error:', e);
                }
            }
            
            if (!this._destroyed) {
                this._rafId = requestAnimationFrame(renderLoop);
            }
        };
        
        if (!this._rafId) {
            Logger.event.info('Starting render loop');
            this._rafId = requestAnimationFrame(renderLoop);
        }
    }

    setupCanvasEvents() {
        const canvas = this.editor.canvasRenderer.canvas;

        // Use unified canvas registration with EventHandlerManager
        const canvasConfig = {
            // Mouse events
            onMouseDown: (e) => this.editor.mouseHandlers.handleMouseDown(e),
            onMouseMove: (e) => this.editor.mouseHandlers.handleMouseMove(e),
            onMouseUp: (e) => this.editor.mouseHandlers.handleMouseUp(e),
            onWheel: (e) => this.editor.mouseHandlers.handleWheel(e),
            onDoubleClick: (e) => this.editor.mouseHandlers.handleDoubleClick(e),
            onDragOver: (e) => this.editor.mouseHandlers.handleDragOver(e),
            onDrop: (e) => this.editor.mouseHandlers.handleDrop(e)
        };
        
        // Register canvas with unified handlers
        eventHandlerManager.registerCanvas(canvas, canvasConfig, 'main-canvas');
    }

    /**
     * Setup keyboard event handlers
     */

    setupKeyboardEvents() {
        // Keyboard events are now handled in setupWindowEvents
        // This method is kept for compatibility but does nothing
    }
    
    /**
     * Returns true when the keyboard event matches the shortcut defined at
     * shortcuts.<category>.<action> in ConfigManager.
     * ctrlKey and metaKey are treated as the same modifier (platform-agnostic Ctrl/Cmd).
     * shiftKey and altKey must match exactly; undefined config flags are treated as false.
     */
    _matchesShortcut(e, category, action) {
        const def = this.editor.configManager?.getShortcuts()?.[category]?.[action];
        if (!def?.key) return false;
        const eCtrl = !!(e.ctrlKey || e.metaKey);
        const defCtrl = !!(def.ctrlKey || def.metaKey);
        return e.key.toLowerCase() === def.key.toLowerCase()
            && eCtrl            === defCtrl
            && !!e.shiftKey     === !!def.shiftKey
            && !!e.altKey       === !!def.altKey;
    }

    handleKeyDown(e) {
        // Ignore OS auto-repeat keydowns — none of the actions below are designed to
        // re-fire while a key is held (no arrow-key nudge/pan lives in this handler),
        // so repeats caused duplicate structural ops (e.g. ungroup firing 2-3x on one
        // Alt+G press, causing visible flicker that single-shot toolbar/context-menu
        // clicks never triggered).
        if (e.repeat) return;

        // Backspace-to-reset (hover-based, see ResetRegistry) must run even while some
        // unrelated input has focus — checked before the focused-input early-return below.
        if (this._matchesShortcut(e, 'ui', 'resetToDefault') && ResetRegistry.handleBackspace()) {
            e.preventDefault();
            return;
        }

        // Allow input fields to work normally
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.contentEditable === 'true')) {
            return;
        }

        // Escape: complex multi-branch logic, matched via config
        if (this._matchesShortcut(e, 'editor', 'escape')) {
            e.preventDefault();

            // Close group edit mode if active (same as clicking outside group bounds)
            if (this.editor.groupOperations && this.editor.groupOperations.isInGroupEditMode()) {
                this.editor.groupOperations.closeGroupEditMode();
                return;
            }

            // Check if any active processes are running that shouldn't be interrupted
            const mouse = this.editor.stateManager.get('mouse');
            const hasActiveProcess = mouse.isPlacingObjects || mouse.isDragging || mouse.isRightDown ||
                Boolean(mouse.marqueePendingStartPos);

            if (hasActiveProcess) {
                // Don't clear selection during active processes
                this.editor.cancelAllActions();
                return;
            }

            // Clear selection if objects are selected and no active processes
            const selectedObjects = this.editor.stateManager.get('selectedObjects');
            if (selectedObjects && selectedObjects.size > 0) {
                this.editor.stateManager.set('selectedObjects', new Set());
                return;
            }

            this.editor.cancelAllActions();
            return;
        }

        if (this._matchesShortcut(e, 'editor', 'delete') || this._matchesShortcut(e, 'editor', 'deleteAlt')) {
            e.preventDefault();
            this.editor.objectOperations?.deleteSelectedObjects();
        } else if (this._matchesShortcut(e, 'editor', 'duplicate')) {
            e.preventDefault();
            this.editor.objectOperations?.duplicateSelectedObjects();
        } else if (this._matchesShortcut(e, 'editor', 'copy')) {
            e.preventDefault();
            this.editor.copySelectedObjects();
        } else if (this._matchesShortcut(e, 'editor', 'cut')) {
            e.preventDefault();
            this.editor.cutSelectedObjects();
        } else if (this._matchesShortcut(e, 'editor', 'paste')) {
            e.preventDefault();
            this.editor.pasteObjects();
        } else if (this._matchesShortcut(e, 'editor', 'focusSelection')) {
            e.preventDefault();
            if (typeof this.editor.focusOnSelection === 'function') this.editor.focusOnSelection();
        } else if (this._matchesShortcut(e, 'editor', 'focusAll')) {
            e.preventDefault();
            if (typeof this.editor.focusOnAll === 'function') this.editor.focusOnAll();
        } else if (this._matchesShortcut(e, 'editor', 'toggleGrid')) {
            e.preventDefault();
            this.toggleGrid();
        } else if (this._matchesShortcut(e, 'editor', 'groupObjects')) {
            e.preventDefault();
            this.editor.groupSelectedObjects?.();
        } else if (this._matchesShortcut(e, 'editor', 'ungroupObjects')) {
            e.preventDefault();
            this.editor.ungroupSelectedObjects?.();
        } else if (this._matchesShortcut(e, 'editor', 'toggleParallax')) {
            e.preventDefault();
            this.toggleViewOption('parallax');
        } else if (this._matchesShortcut(e, 'editor', 'undo')) {
            e.preventDefault();
            if (typeof this.editor.undo === 'function') this.editor.undo();
        } else if (this._matchesShortcut(e, 'editor', 'redo') || this._matchesShortcut(e, 'editor', 'redoAlt')) {
            e.preventDefault();
            if (typeof this.editor.redo === 'function') this.editor.redo();
        } else if (this._matchesShortcut(e, 'editor', 'newLevel') ||
                   // Plain Ctrl+N also works when KeyN is locked via Keyboard Lock API in fullscreen;
                   // outside fullscreen browsers steal it, so the default binding is Ctrl+Alt+N.
                   ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'n')) {
            e.preventDefault();
            if (typeof this.editor.newLevel === 'function') this.editor.newLevel();
        } else if (this._matchesShortcut(e, 'editor', 'openLevel')) {
            e.preventDefault();
            if (typeof this.editor.openLevel === 'function') this.editor.openLevel();
        } else if (this._matchesShortcut(e, 'editor', 'saveLevelAs')) {
            e.preventDefault();
            if (typeof this.editor.saveLevelAs === 'function') (async () => { await this.editor.saveLevelAs(); })();
        } else if (this._matchesShortcut(e, 'editor', 'saveLevel')) {
            e.preventDefault();
            if (typeof this.editor.saveLevel === 'function') (async () => { await this.editor.saveLevel(); })();
        } else if (this._matchesShortcut(e, 'editor', 'nextLevel')) {
            e.preventDefault();
            this.editor.levelsManager?.cycleLevel(1);
        } else if (this._matchesShortcut(e, 'editor', 'previousLevel')) {
            e.preventDefault();
            this.editor.levelsManager?.cycleLevel(-1);
        } else if (this._matchesShortcut(e, 'editor', 'bringToFront') || this._matchesShortcut(e, 'editor', 'sendToBack') ||
                   this._matchesShortcut(e, 'editor', 'bringForward') || this._matchesShortcut(e, 'editor', 'sendBackward')) {
            e.preventDefault();
            const selectedIds = this.editor.stateManager.get('selectedObjects');
            if (selectedIds && selectedIds.size > 0 && this.editor.objectOperations) {
                const objects = Array.from(selectedIds)
                    .map(id => this.editor.level.findObjectById(id))
                    .filter(Boolean);
                let stackAction;
                if (this._matchesShortcut(e, 'editor', 'bringToFront'))      stackAction = 'bringToFront';
                else if (this._matchesShortcut(e, 'editor', 'sendToBack'))   stackAction = 'sendToBack';
                else if (this._matchesShortcut(e, 'editor', 'bringForward')) stackAction = 'moveForward';
                else                                                           stackAction = 'moveBackward';
                this.editor.objectOperations.applyStackOrderAction(objects, stackAction);
            }
        } else if (this._matchesShortcut(e, 'editor', 'moveLayerUp') || this._matchesShortcut(e, 'editor', 'moveLayerUpExtreme')) {
            e.preventDefault();
            if (typeof this.editor.moveSelectedObjectsToLayer === 'function') {
                this.editor.moveSelectedObjectsToLayer(true, this._matchesShortcut(e, 'editor', 'moveLayerUpExtreme'));
            }
        } else if (this._matchesShortcut(e, 'editor', 'moveLayerDown') || this._matchesShortcut(e, 'editor', 'moveLayerDownExtreme')) {
            e.preventDefault();
            if (typeof this.editor.moveSelectedObjectsToLayer === 'function') {
                this.editor.moveSelectedObjectsToLayer(false, this._matchesShortcut(e, 'editor', 'moveLayerDownExtreme'));
            }
        } else if (this._matchesShortcut(e, 'ui', 'toggleLeftPanel')) {
            e.preventDefault();
            this.togglePanel('leftPanel');
        } else if (this._matchesShortcut(e, 'ui', 'toggleRightPanel')) {
            e.preventDefault();
            this.togglePanel('rightPanel');
        } else if (this._matchesShortcut(e, 'ui', 'toggleToolbar')) {
            e.preventDefault();
            this.togglePanel('toolbar');
        } else if (this._matchesShortcut(e, 'ui', 'toggleAssetsPanel')) {
            e.preventDefault();
            this.togglePanel('assetsPanel');
        } else if (this._matchesShortcut(e, 'ui', 'toggleConsole')) {
            e.preventDefault();
            this.togglePanel('console');
        } else if (this._matchesShortcut(e, 'ui', 'toggleStatusBar')) {
            e.preventDefault();
            this.togglePanel('statusBar');
        } else if (this._matchesShortcut(e, 'editor', 'toggleFullscreen')) {
            e.preventDefault();
            this.toggleViewOption('fullscreen');
        } else if (this._matchesShortcut(e, 'editor', 'toggleGameMode')) {
            e.preventDefault();
            this.toggleViewOption('gameMode');
        } else if (this._matchesShortcut(e, 'editor', 'toggleSnapToGrid')) {
            e.preventDefault();
            this.toggleViewOption('snapToGrid');
        } else if (this._matchesShortcut(e, 'editor', 'toggleObjectBoundaries')) {
            e.preventDefault();
            this.toggleViewOption('objectBoundaries');
        } else if (this._matchesShortcut(e, 'editor', 'toggleObjectCollisions')) {
            e.preventDefault();
            this.toggleViewOption('objectCollisions');
        } else if (this._matchesShortcut(e, 'editor', 'openProjectSettings')) {
            e.preventDefault();
            if (typeof this.editor.openProjectSettings === 'function') this.editor.openProjectSettings();
        } else if (this._matchesShortcut(e, 'editor', 'openSettings')) {
            e.preventDefault();
            if (typeof this.editor.openSettings === 'function') this.editor.openSettings();
        } else if (this._matchesShortcut(e, 'editor', 'renameObject')) {
            e.preventDefault();
            this.renameSelectedObject();
        } else if (this._matchesShortcut(e, 'editor', 'isolateSelection')) {
            e.preventDefault();
            this.editor.objectOperations?.toggleIsolateSelection();
        } else if (this._matchesShortcut(e, 'editor', 'unhideAll')) {
            e.preventDefault();
            this.editor.objectOperations?.unhideAllObjects();
        } else if (this._matchesShortcut(e, 'editor', 'hideSelected')) {
            e.preventDefault();
            this.editor.objectOperations?.toggleVisibilityForSelection();
        }
    }

    /**
     * F2: rename the single selected object inline via the Outliner (see
     * OutlinerPanel.startInlineRename). Switches to whichever panel side currently hosts the
     * Outliner tab first, since that method needs the object's row to already be in the DOM
     * and visible for the user to actually see/use the rename input.
     */
    renameSelectedObject() {
        const selectedIds = this.editor.stateManager.get('selectedObjects');
        if (!selectedIds || selectedIds.size !== 1) return;

        const obj = this.editor.level.findObjectById(Array.from(selectedIds)[0]);
        if (!obj) return;

        const leftHasOutliner = document.getElementById('left-tabs-panel')?.querySelector('[data-tab="outliner"]');
        this.setActivePanelTab('outliner', leftHasOutliner ? 'left' : 'right');

        if (this.editor.outlinerPanel && typeof this.editor.outlinerPanel.startInlineRename === 'function') {
            this.editor.outlinerPanel.startInlineRename(obj);
        }
    }

    /**
     * Handle key up events
     * @param {KeyboardEvent} e - The keyboard event
     */
    handleKeyUp(e) {
        // Allow input fields to work normally
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.contentEditable === 'true')) {
            return;
        }

        // Handle modifier key releases
        if (e.key === 'Control' || e.key === 'Meta') {
            // Reset ctrl/meta key state
            this.editor.stateManager.set('keyboard.ctrlKey', false);
            this.editor.stateManager.set('keyboard.metaKey', false);
        } else if (e.key === 'Shift') {
            // Reset shift key state
            this.editor.stateManager.set('keyboard.shiftKey', false);
        } else if (e.key === 'Alt') {
            // Reset alt key state
            this.editor.stateManager.set('keyboard.altKey', false);
        }
    }

    setupMenuEvents() {
        // Menu events are now handled by MenuManager
        // This method is kept for backward compatibility
    }

    initializeViewStates() {
        // Ensure configManager is available and loaded
        if (!this.editor.configManager) {
            return;
        }

        // Ensure configuration is fully loaded before proceeding
        if (!this.editor.configManager.isConfigReady()) {
            return;
        }
        
        // Initialize grid state from user config or level settings
        const gridConfig = this.editor.configManager.get('canvas.showGrid');
        const gridLevel = this.editor.level?.settings?.showGrid;
        const gridEnabled = gridConfig ?? gridLevel ?? true;
        this.editor.stateManager.set('canvas.showGrid', gridEnabled);
        this.updateViewCheckbox('grid', gridEnabled);

        // Initialize snap to grid state - prefer canvas.snapToGrid as primary source
        const snapCanvas = this.editor.configManager.get('canvas.snapToGrid');
        const snapView = this.editor.configManager.get('editor.view.snapToGrid');
        const snapLevel = this.editor.level?.settings?.snapToGrid;
        // Use canvas.snapToGrid as primary, fallback to view, then level settings
        const snapToGridEnabled = snapCanvas ?? snapView ?? snapLevel ?? false;
        this.editor.stateManager.set('view.snapToGrid', snapToGridEnabled);
        this.editor.stateManager.set('canvas.snapToGrid', snapToGridEnabled);
        this.updateViewCheckbox('snapToGrid', snapToGridEnabled);
        
        // Initialize panel states from user preferences
        const panelStates = ['toolbar', 'assetsPanel', 'console', 'statusBar'];
        panelStates.forEach(panel => {
            // Get visibility from user preferences, fallback to configManager, then to true
            const prefKey = panel + 'Visible'; // toolbarVisible, assetsPanelVisible, consoleVisible
            const visible = this.editor.userPrefs?.get(prefKey) ??
                           this.editor.configManager.get(`editor.view.${panel}`) ?? true;
            
            this.editor.stateManager.set(`view.${panel}`, visible);
            this.updateViewCheckbox(panel, visible);
            // Apply visibility immediately to ensure panels are shown/hidden correctly
            this.applyPanelVisibility(panel, visible);
        });

        // Initialize left/right panel states but don't apply visibility yet
        // PanelPositionManager will handle visibility based on actual tab positions
        const tabPanelStates = ['rightPanel', 'leftPanel'];
        tabPanelStates.forEach(panel => {
            const prefKey = panel + 'Visible';
            const visible = this.editor.userPrefs?.get(prefKey) ??
                           this.editor.configManager.get(`editor.view.${panel}`) ?? true;
            
            this.editor.stateManager.set(`view.${panel}`, visible);
            this.updateViewCheckbox(panel, visible);
            // Don't apply visibility here - let PanelPositionManager handle it
        });

        // Initialize other view states from user config
        const viewStates = ['fullscreen', 'gameMode', 'objectBoundaries', 'objectCollisions', 'parallax'];
        viewStates.forEach(state => {
            // Game Mode and Fullscreen should be false by default
            const defaultValue = (state === 'gameMode' || state === 'fullscreen') ? false : false;
            const configValue = this.editor.configManager.get(`editor.view.${state}`);
            const enabled = configValue ?? defaultValue;
            this.editor.stateManager.set(`view.${state}`, enabled);
            this.updateViewCheckbox(state, enabled);

            // Apply the view option for states that need UI changes
            if (state === 'gameMode') {
                this.toggleGameMode(enabled);
            } else if (state === 'fullscreen') {
                this.toggleFullscreen(enabled);
            }
        });

        // Initialize panel positions using PanelPositionManager FIRST
        if (this.editor.panelPositionManager) {
            this.editor.panelPositionManager.initializePanelPositions();
            
            // Update panels after tab positions are initialized
            if (this.editor.updateAllPanels) {
                this.editor.updateAllPanels();
            }
            
            // Don't re-apply panel visibility here - PanelPositionManager handles it
            // based on actual tab positions and panel existence
        } else {
            // PanelPositionManager not found - this is expected during early initialization
        }

        // Activate tabs after panel positions are initialized
        this.activateTabsAfterPanelInitialization();

        // Initialize search controls after panels are created
        if (this.editor.initializeSearchControls) {
            this.editor.initializeSearchControls();
        }

        // Setup tab event listeners after panels are created (this will call updateTabHandlers)
        this.setupTabEventListeners();
    }

    updateViewCheckbox(option, enabled) {
        if (this.menuManager) {
            // Use MenuManager if available
            let itemId;
            // Map panel names to menu item IDs
            switch(option) {
                case 'toolbar':
                    itemId = 'toggle-toolbar';
                    break;
                case 'assetsPanel':
                    itemId = 'toggle-assets-panel';
                    break;
                case 'rightPanel':
                    itemId = 'toggle-right-panel';
                    break;
                case 'leftPanel':
                    itemId = 'toggle-left-panel';
                    break;
                case 'console':
                    itemId = 'toggle-console';
                    break;
                case 'statusBar':
                    itemId = 'toggle-status-bar';
                    break;
                default:
                    itemId = `toggle-${option.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            }
            this.menuManager.updateToggleState(itemId, enabled);
        } else {
            // Fallback to direct DOM manipulation - use the same ID mapping as when menuManager is available
            let checkId;
            switch(option) {
                case 'toolbar':
                    checkId = 'toggle-toolbar-check';
                    break;
                case 'assetsPanel':
                    checkId = 'toggle-assets-panel-check';
                    break;
                case 'rightPanel':
                    checkId = 'toggle-right-panel-check';
                    break;
                case 'leftPanel':
                    checkId = 'toggle-left-panel-check';
                    break;
                case 'console':
                    checkId = 'toggle-console-check';
                    break;
                case 'statusBar':
                    checkId = 'toggle-status-bar-check';
                    break;
                default:
                    checkId = `toggle-${option.replace(/([A-Z])/g, '-$1').toLowerCase()}-check`;
            }
            const checkElement = document.getElementById(checkId);
            if (checkElement) {
                if (enabled) {
                    checkElement.classList.remove('hidden');
                } else {
                    checkElement.classList.add('hidden');
                }
            }
        }
    }

    toggleViewOption(option) {
        let currentState, newState, stateKey, configKey;
        
        if (option === 'grid') {
            // Grid uses canvas.showGrid as single source of truth
            currentState = this.editor.stateManager.get('canvas.showGrid') || false;
            newState = !currentState;
            stateKey = 'canvas.showGrid';
            configKey = 'canvas.showGrid';
        } else if (option === 'snapToGrid') {
            // Snap to grid uses canvas.snapToGrid as primary storage
            currentState = this.editor.stateManager.get('canvas.snapToGrid') || false;
            newState = !currentState;
            stateKey = 'canvas.snapToGrid';
            configKey = 'canvas.snapToGrid';
        } else {
            // Other view options use view.* path
            currentState = this.editor.stateManager.get(`view.${option}`) || false;
            newState = !currentState;
            stateKey = `view.${option}`;
            configKey = `editor.view.${option}`;
        }
        
        // Update state
        this.editor.stateManager.set(stateKey, newState);
        
        // Save to user configuration
        this.editor.configManager.set(configKey, newState);
        
        // Update UI checkbox
        this.updateViewCheckbox(option, newState);
        
        // Apply the view option
        this.applyViewOption(option, newState);
        
        // Close the menu
        document.querySelectorAll('#menu-file > div, #menu-view > div, #menu-settings > div').forEach(d => d.classList.add('hidden'));
    }

    /**
     * Toggle grid visibility (hotkey G)
     */
    toggleGrid() {
        this.toggleViewOption('grid');
    }

    /**
     * Toggle panel visibility
     * @param {string} panel - Panel name (toolbar, assetsPanel, rightPanel)
     */
    togglePanel(panel) {
        const currentState = this.editor.stateManager.get(`view.${panel}`) || false;
        const newState = !currentState;

        // Update state
        this.editor.stateManager.set(`view.${panel}`, newState);

        // Save to user preferences (this will also update the shared ConfigManager)
        if (this.editor.userPrefs) {
            const prefKey = panel + 'Visible'; // toolbarVisible, assetsPanelVisible, rightPanelVisible, leftPanelVisible
            this.editor.userPrefs.set(prefKey, newState);
        } else {
            // Fallback to direct ConfigManager if userPrefs is not available
            this.editor.configManager.set(`editor.view.${panel}`, newState);
        }

        // Update UI checkbox
        this.updateViewCheckbox(panel, newState);

        // Apply the panel visibility
        this.applyPanelVisibility(panel, newState);

        // Close the menu
        document.querySelectorAll('#menu-file > div, #menu-view > div, #menu-settings > div').forEach(d => d.classList.add('hidden'));
    }

    applyViewOption(option, enabled) {
        switch (option) {
            case 'grid':
                // Update canvas state for grid (single source of truth)
                this.editor.stateManager.set('canvas.showGrid', enabled);
                this.editor.render();
                break;
            case 'fullscreen':
                // Fullscreen mode
                this.editor.stateManager.set('view.fullscreen', enabled);
                this.toggleFullscreen(enabled);
                break;
            case 'gameMode':
                // Game mode - hide editor UI elements
                this.editor.stateManager.set('view.gameMode', enabled);
                this.toggleGameMode(enabled);
                break;
            case 'snapToGrid':
                // Update both view state and canvas state for snap to grid
                this.editor.stateManager.set('view.snapToGrid', enabled);
                this.editor.stateManager.set('canvas.snapToGrid', enabled);
                break;
            case 'objectBoundaries':
                this.editor.stateManager.set('view.objectBoundaries', enabled);
                this.editor.render();
                break;
            case 'objectCollisions':
                this.editor.stateManager.set('view.objectCollisions', enabled);
                this.editor.render();
                break;
            case 'parallax':
                this.editor.stateManager.set('view.parallax', enabled);
                this.editor.render();
                break;
        }
    }

    /**
     * Apply panel visibility changes using universal panel management
     * @param {string} panel - Panel name
     * @param {boolean} visible - Whether panel should be visible
     */
    applyPanelVisibility(panel, visible) {
        // Panel configuration mapping
        const panelConfig = {
            'toolbar': {
                type: 'component',
                component: () => this.editor.toolbar,
                method: 'setVisible'
            },
            'assetsPanel': {
                type: 'dom',
                elements: [
                    { id: 'assets-panel', display: 'flex' },
                    { id: 'resizer-assets', display: 'block' }
                ]
            },
            'rightPanel': {
                type: 'tabs',
                side: 'right',
                elements: [
                    { id: 'right-tabs-panel', display: 'flex' },
                    { id: 'resizer-right-tabs-panel', display: 'block' }
                ]
            },
            'leftPanel': {
                type: 'tabs',
                side: 'left',
                elements: [
                    { id: 'left-tabs-panel', display: 'flex' },
                    { id: 'resizer-left-tabs-panel', display: 'block' }
                ]
            },
            'console': {
                type: 'dom',
                elements: [
                    { id: 'console-panel', display: 'flex' },
                    { id: 'resizer-console', display: 'block' }
                ]
            },
            'statusBar': {
                type: 'component',
                component: () => this.editor.statusBar,
                method: 'setVisible'
            }
        };

        const config = panelConfig[panel];
        if (!config) return;

        switch (config.type) {
            case 'component':
                // Handle component-based panels (like toolbar)
                const component = config.component();
                if (component && typeof component[config.method] === 'function') {
                    component[config.method](visible);
                }
                break;

            case 'dom':
                // Handle DOM-based panels (like assets panel)
                config.elements.forEach(element => {
                    const el = document.getElementById(element.id);
                    if (el) {
                        if (visible) {
                            el.classList.remove('hidden');
                            el.style.display = element.display;
                        } else {
                            el.classList.add('hidden');
                            el.style.display = 'none';
                            
                            // Special handling for console panel - hide context menu when console is hidden
                            if (element.id === 'console-panel' && window.consoleContextMenu) {
                                if (typeof window.consoleContextMenu.forceHideMenu === 'function') {
                                    window.consoleContextMenu.forceHideMenu();
                                }
                            }
                        }
                    }
                });
                break;

            case 'tabs':
                // Handle tabs-based panels (left/right panels)
                if (visible) {
                    // Create panel if it doesn't exist
                    this.editor.panelPositionManager.ensurePanelExists(config.side);

                    // Show/hide panel elements
                    config.elements.forEach(element => {
                        const el = document.getElementById(element.id);
                        if (el) {
                            el.classList.remove('hidden');
                            el.style.display = element.display;
                        }
                    });
                } else {
                    // Hiding: if the panel is EMPTY, remove it from the DOM entirely instead of
                    // just display:none-ing it. Tab-drag's "does the other panel exist yet?"
                    // check (PanelPositionManager._installGlobalTabDragHandlers) only looks for
                    // DOM presence — a hidden-but-still-present empty panel would satisfy that
                    // check and be treated as "already exists", so the drag would never
                    // auto-show it again (and it can't be a drop target while display:none).
                    // removeEmptyPanel() is a no-op if the panel still has tabs, so this is
                    // safe to call unconditionally.
                    this.editor.panelPositionManager.removeEmptyPanel(config.side);

                    config.elements.forEach(element => {
                        const el = document.getElementById(element.id);
                        if (el) {
                            el.classList.add('hidden');
                            el.style.display = 'none';
                        }
                    });
                }
                break;
        }
        
        // Resize canvas after panel changes
        if (this.editor.canvasRenderer) {
            this.editor.canvasRenderer.resizeCanvas();
            this.editor.render();
        }
    }

    /**
     * Save current View menu states before level operations
     * @returns {Object} Saved view states
     */
    saveViewStates() {

        const savedStates = {};
        const viewOptions = ['grid', 'fullscreen', 'gameMode', 'snapToGrid', 'objectBoundaries', 'objectCollisions', 'parallax'];
        const panelOptions = ['toolbar', 'assetsPanel', 'rightPanel', 'leftPanel', 'console'];

        viewOptions.forEach(option => {
            const stateKey = `view.${option}`;
            const currentValue = this.editor.stateManager.get(stateKey);
            savedStates[option] = currentValue !== undefined ? currentValue : false;
        });

        // Save panel states
        panelOptions.forEach(panel => {
            const stateKey = `view.${panel}`;
            const currentValue = this.editor.stateManager.get(stateKey);
            savedStates[panel] = currentValue !== undefined ? currentValue : true; // Default to true for panels
        });

        return savedStates;
    }

    /**
     * Apply saved View states after level operations
     * @param {Object} savedStates - Previously saved view states
     */
    applySavedViewStates(savedStates) {

        Object.keys(savedStates).forEach(option => {
            const enabled = savedStates[option];

            // Check if it's a panel option
            const panelOptions = ['toolbar', 'assetsPanel', 'rightPanel', 'leftPanel', 'console'];
            if (panelOptions.includes(option)) {
                // Sync state so subsequent saveViewStates() reads correct value
                this.editor.stateManager.set(`view.${option}`, enabled);
                // Apply panel visibility
                this.applyPanelVisibility(option, enabled);
                // Update menu checkbox state
                this.updateViewCheckbox(option, enabled);
            } else {
                // Apply the view option
                this.applyViewOption(option, enabled);
                // Update menu checkbox state
                this.updateViewCheckbox(option, enabled);
            }
        });

    }

    toggleGameMode(enabled) {
        // Get all panel elements
        const rightPanel = document.getElementById('right-tabs-panel');
        const assetsPanel = document.getElementById('assets-panel');
        const consolePanel = document.getElementById('console-panel');
        const toolbarContainer = document.getElementById('toolbar-container');
        const resizerX = document.getElementById('resizer-right-tabs-panel');
        const resizerAssets = document.getElementById('resizer-assets');
        const resizerConsole = document.getElementById('resizer-console');
        
        if (enabled) {
            // Store current panel states for restoration
            this.savedPanelStates = {
                toolbar: this.editor.stateManager.get('view.toolbar') ?? true,
                assetsPanel: this.editor.stateManager.get('view.assetsPanel') ?? true,
                rightPanel: this.editor.stateManager.get('view.rightPanel') ?? true,
                leftPanel: this.editor.stateManager.get('view.leftPanel') ?? true,
                console: this.editor.stateManager.get('console.visible') ?? false
            };
            
            // Reset panel toggle states in menu to show they're disabled in Game Mode
            this.resetPanelToggleStates();
            
            // Game Mode: Hide ALL panels except header and main canvas
            rightPanel?.classList.add('hidden');
            assetsPanel?.classList.add('hidden');
            consolePanel?.classList.add('hidden');
            toolbarContainer?.classList.add('hidden');
            resizerX?.classList.add('hidden');
            resizerAssets?.classList.add('hidden');
            resizerConsole?.classList.add('hidden');
            const leftTabs = document.getElementById('left-tabs-panel');
            const resizerLeft = document.getElementById('resizer-left-tabs-panel');
            leftTabs?.classList.add('hidden');
            resizerLeft?.classList.add('hidden');
            
            // Also hide toolbar content
            if (this.editor.toolbar) {
                this.editor.toolbar.setVisible(false);
            }

            // Enter browser fullscreen for immersive experience
            this.toggleFullscreen(true);
            // Update fullscreen state in StateManager and checkbox
            this.editor.stateManager.set('view.fullscreen', true);
            this.updateViewCheckbox('fullscreen', true);
            
        } else {
            // Exit Game Mode: Restore panel toggle states in menu first
            this.restorePanelToggleStates();
            
            // Then restore panels based on saved states
            this.restorePanelStates();
            
            // Close View menu after exiting Game Mode
            if (this.menuManager) {
                this.menuManager.closeAllDropdowns();
            }

            // Exit browser fullscreen if active
            this.toggleFullscreen(false);
            // Update fullscreen state in StateManager and checkbox
            this.editor.stateManager.set('view.fullscreen', false);
            this.updateViewCheckbox('fullscreen', false);
        }
        
        // Update Immersive Mode checkbox in menu
        this.updateViewCheckbox('gameMode', enabled);
        
        // Resize canvas after panel changes
        if (this.editor.canvasRenderer) {
            this.editor.canvasRenderer.resizeCanvas();
            this.editor.render();
        }
    }

    /**
     * Toggle fullscreen mode
     * @param {boolean} enabled - Whether fullscreen should be enabled
     */
    toggleFullscreen(enabled) {
        try {
            if (enabled) {
                const root = document.documentElement;
                if (!document.fullscreenElement && root?.requestFullscreen) {
                    root.requestFullscreen()
                        .then(() => this._acquireKeyboardLock())
                        .catch(() => {});
                }
            } else {
                this._releaseKeyboardLock();
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
            }
        } catch (_) {
            // Ignore fullscreen errors
        }
    }

    /**
     * Lock browser-reserved keyboard shortcuts (e.g. Ctrl+N) so they reach the
     * editor instead of triggering browser actions. Only effective in fullscreen.
     * Falls back gracefully on browsers that don't support the Keyboard Lock API.
     */
    _acquireKeyboardLock() {
        if (!navigator.keyboard?.lock) return;
        // Lock keys that the editor uses but browsers intercept:
        //   KeyN  → Ctrl+N  (New Level — browsers open a new window)
        // Ctrl+O, Ctrl+S, Ctrl+Z etc. are already interceptable in canvas context
        // without the lock API, so we don't need to include them here.
        navigator.keyboard.lock(['KeyN']).catch(() => {});
        Logger.ui.debug('Keyboard Lock API acquired (KeyN)');
    }

    _releaseKeyboardLock() {
        if (!navigator.keyboard?.unlock) return;
        navigator.keyboard.unlock();
        Logger.ui.debug('Keyboard Lock API released');
    }


    /**
     * Restore panel states when exiting Game Mode
     */
    restorePanelStates() {
        if (!this.savedPanelStates) return;

        // Restore toolbar
        if (this.savedPanelStates.toolbar) {
            const toolbarContainer = document.getElementById('toolbar-container');
            toolbarContainer?.classList.remove('hidden');
            if (toolbarContainer) toolbarContainer.style.display = 'flex';
            if (this.editor.toolbar) {
                this.editor.toolbar.setVisible(true);
            }
        }

        // Restore console panel
        if (this.savedPanelStates.console) {
            const consolePanel = document.getElementById('console-panel');
            const resizerConsole = document.getElementById('resizer-console');
            consolePanel?.classList.remove('hidden');
            if (consolePanel) consolePanel.style.display = 'flex';
            resizerConsole?.classList.remove('hidden');
            if (resizerConsole) resizerConsole.style.display = 'block';
        }

        // Use applyPanelVisibility for panels that have proper handlers
        this.applyPanelVisibility('assetsPanel', this.savedPanelStates.assetsPanel);
        this.applyPanelVisibility('rightPanel', this.savedPanelStates.rightPanel);
        this.applyPanelVisibility('leftPanel', this.savedPanelStates.leftPanel);

        // Clear saved states
        this.savedPanelStates = null;
    }

    /**
     * Reset panel toggle states in menu when entering Game Mode
     */
    resetPanelToggleStates() {
        const panelToggles = ['toolbar', 'assetsPanel', 'rightPanel', 'leftPanel', 'console'];
        
        panelToggles.forEach(panel => {
            // Sync hidden state to StateManager during Immersive Mode
            this.editor.stateManager.set(`view.${panel}`, false);
            // Update checkbox in menu
            this.updateViewCheckbox(panel, false);
            // Apply panel visibility (force hide)
            this.applyPanelVisibility(panel, false);
        });
        
    }

    /**
     * Restore panel toggle states in menu when exiting Game Mode
     */
    restorePanelToggleStates() {
        if (!this.savedPanelStates) return;

        // Restore toolbar toggle
        this.editor.stateManager.set('view.toolbar', this.savedPanelStates.toolbar);
        this.updateViewCheckbox('toolbar', this.savedPanelStates.toolbar);
        this.applyPanelVisibility('toolbar', this.savedPanelStates.toolbar);

        // Restore assets panel toggle
        this.editor.stateManager.set('view.assetsPanel', this.savedPanelStates.assetsPanel);
        this.updateViewCheckbox('assetsPanel', this.savedPanelStates.assetsPanel);
        this.applyPanelVisibility('assetsPanel', this.savedPanelStates.assetsPanel);

        // Restore right panel toggle
        this.editor.stateManager.set('view.rightPanel', this.savedPanelStates.rightPanel);
        this.updateViewCheckbox('rightPanel', this.savedPanelStates.rightPanel);
        this.applyPanelVisibility('rightPanel', this.savedPanelStates.rightPanel);

        // Restore left panel toggle
        this.editor.stateManager.set('view.leftPanel', this.savedPanelStates.leftPanel);
        this.updateViewCheckbox('leftPanel', this.savedPanelStates.leftPanel);
        this.applyPanelVisibility('leftPanel', this.savedPanelStates.leftPanel);

        // Restore console toggle
        this.editor.stateManager.set('console.visible', this.savedPanelStates.console);
        this.updateViewCheckbox('console', this.savedPanelStates.console);
        this.applyPanelVisibility('console', this.savedPanelStates.console);

    }

    /**
     * Setup all tab event listeners (click handlers and context menus)
     */
    setupTabEventListeners() {
        if (this._destroyed) return;
        
        // Setup tab handlers immediately - DOM should be ready by this point
        this.updateTabHandlers();
        
        // Use MutationObserver to detect tab changes and re-setup handlers
        const observer = new MutationObserver((mutations) => {
            if (this._destroyed || this._updatingTabHandlers) return;
            
            // Check if any new tabs were added
            const hasNewTab = mutations.some(mutation => 
                mutation.type === 'childList' && 
                Array.from(mutation.addedNodes).some(node => 
                    node.nodeType === Node.ELEMENT_NODE && 
                    (node.classList?.contains('tab-right') || 
                     node.classList?.contains('tab-left') || 
                     node.classList?.contains('tab'))
                )
            );
            
            if (hasNewTab) {
                this.updateTabHandlers();
            }
        });
        
        // Store observer for cleanup
        this.mutationObservers.push(observer);
        
        // Observe all panels for tab changes
        const panels = document.querySelectorAll('#right-tabs-panel, #left-tabs-panel, #assets-panel');
        panels.forEach(panel => {
            observer.observe(panel, { childList: true, subtree: true });
        });
    }

    /**
     * Update both click and context menu handlers for all tabs
     */
    updateTabHandlers() {
        if (this._destroyed || this._updatingTabHandlers) return;
        this._updatingTabHandlers = true;

        try {
            // Find only panel tabs (with data-tab), exclude asset tabs (with data-folder-path)
            const leftPanel = document.getElementById('left-tabs-panel');
            const rightPanel = document.getElementById('right-tabs-panel');
            const assetTabsContainer = document.querySelector('#asset-tabs-container, #asset-tabs-left');
            
            let tabs = [];
            if (leftPanel) {
                const leftTabs = leftPanel.querySelectorAll('.tab-right[data-tab], .tab-left[data-tab]');
                tabs.push(...Array.from(leftTabs).filter(tab => {
                    // Exclude asset tabs
                    return !tab.dataset.folderPath && (!assetTabsContainer || !assetTabsContainer.contains(tab));
                }));
            }
            if (rightPanel) {
                const rightTabs = rightPanel.querySelectorAll('.tab-right[data-tab], .tab-left[data-tab]');
                tabs.push(...Array.from(rightTabs).filter(tab => {
                    // Exclude asset tabs
                    return !tab.dataset.folderPath && (!assetTabsContainer || !assetTabsContainer.contains(tab));
                }));
            }
            
            if (tabs.length === 0) {
                Logger.ui.debug('No tabs found, skipping handler registration');
                return;
            }
            
            Logger.ui.debug(`Registering handlers for ${tabs.length} tabs`);
            
            // Register handlers for each tab
            tabs.forEach(tab => {
                const tabName = tab.dataset.tab || tab.dataset.category || 'unknown';
                const tabId = `tab-${tabName}`;
                
                // Skip asset tabs - they have their own registration in AssetPanel
                // Asset tabs use data-folder-path, not data-tab
                if (tab.classList.contains('tab') && (tab.dataset.folderPath || tab.closest('#asset-tabs-container') || tab.closest('#asset-tabs-left'))) {
                    return;
                }
                
                // Skip if tab doesn't have data-tab attribute (might be asset tab)
                if (!tab.dataset.tab) {
                    return;
                }
                
                // Unregister existing handlers first
                eventHandlerManager.unregisterElement(tab);
                
                const tabHandlers = {
                    click: () => {
                        const clickedTabName = tab.dataset.tab;
                        // Double-check that we have valid tab name
                        if (!clickedTabName) {
                            return;
                        }
                        
                        const panel = tab.closest('[id$="-tabs-panel"]');
                        const panelSide = panel ? (panel.id.includes('left') ? 'left' : 'right') : 'right';
                        
                        this.setActivePanelTab(clickedTabName, panelSide);
                        
                        if (panelSide === 'right') {
                            this.editor.stateManager.set('rightPanelTab', clickedTabName);
                            this.editor.configManager.set('editor.view.rightPanelTab', clickedTabName);
                        } else if (panelSide === 'left') {
                            this.editor.stateManager.set('leftPanelTab', clickedTabName);
                            this.editor.configManager.set('editor.view.leftPanelTab', clickedTabName);
                        }
                    },
                    contextmenu: (e) => e.preventDefault()
                };
                
                eventHandlerManager.registerElement(tab, tabHandlers, tabId);
            });
            
        } finally {
            this._updatingTabHandlers = false;
        }
    }






    activateTabsAfterPanelInitialization() {
        // Get saved active tabs from ConfigManager
        const rightPanelTab = this.editor.configManager.get('editor.view.rightPanelTab') ?? 'details';
        const leftPanelTab = this.editor.configManager.get('editor.view.leftPanelTab') ?? 'details';
        
        // Get current tab positions
        const tabPositions = this.editor.stateManager.get('tabPositions') || {};
        
        // Activate tabs for both panels
        this._activatePanelTab('right', rightPanelTab, tabPositions);
        this._activatePanelTab('left', leftPanelTab, tabPositions);
        
        Logger.ui.debug('Activated tabs after panel initialization:', { rightPanelTab, leftPanelTab });
    }

    /**
     * Activate tab for a panel with validation
     * @private
     * @param {string} panelSide - 'left' or 'right' panel
     * @param {string} preferredTab - Preferred tab name
     * @param {Object} tabPositions - Current tab positions
     */
    _activatePanelTab(panelSide, preferredTab, tabPositions) {
        // Use setActivePanelTab which will update both StateManager and ConfigManager
        if (tabPositions[preferredTab] === panelSide) {
            // Preferred tab is in the correct panel
            this.setActivePanelTab(preferredTab, panelSide);
        } else {
            // Find a valid tab for this panel - use the one closest to separator
            const panelTabs = Object.entries(tabPositions)
                .filter(([_, position]) => position === panelSide)
                .map(([tabName, _]) => tabName);
            
            if (panelTabs.length > 0) {
                // Use the tab closest to separator (same logic as PanelPositionManager)
                let validTab;
                if (panelSide === 'left') {
                    validTab = panelTabs[0]; // First tab is closest to main panel
                } else {
                    validTab = panelTabs[panelTabs.length - 1]; // Last tab is closest to main panel
                }
                
                this.setActivePanelTab(validTab, panelSide);
            }
        }
    }

    /**
     * Set active tab in panel programmatically
     * @param {string} tabName - Name of the tab to activate
     * @param {string} panelSide - 'left' or 'right' panel
     */
    setActivePanelTab(tabName, panelSide = 'right') {
        this.ensurePanelTabMarkers();

        // Find the tab in the specified panel
        const panelId = `${panelSide}-tabs-panel`;
        const panel = document.getElementById(panelId);
        if (!panel) {
            Logger.ui.warn(`Panel ${panelId} not found - skipping tab activation`);
            return;
        }

        const tab = panel.querySelector(`[data-tab="${tabName}"]`);
        if (!tab) {
            Logger.ui.warn(`Tab ${tabName} not found in ${panelSide} panel - skipping activation`);
            return;
        }

        // Remove active class from all tabs in the same panel
        panel.querySelectorAll('.tab-right, .tab-left').forEach(t => t.classList.remove('active'));
        
        // Activate the specified tab
        tab.classList.add('active');

        // Update state manager with the active tab for this panel
        // ConfigManager will be updated automatically via subscription in LevelEditor
        if (panelSide === 'right') {
            this.editor.stateManager.set('rightPanelTab', tabName);
        } else if (panelSide === 'left') {
            this.editor.stateManager.set('leftPanelTab', tabName);
        }

        // Show corresponding content only for the active tab in this panel
        // Get current active tabs for both panels
        const rightPanelActiveTab = this.editor.stateManager.get('rightPanelTab');
        const leftPanelActiveTab = this.editor.stateManager.get('leftPanelTab');
        
        // Hide all tab content panels first (markers + legacy classes as safety net).
        // Force inline display:none so component-level inline display styles cannot leak visibility.
        document.querySelectorAll('[data-panel-tab-content="true"], .tab-content-right, .tab-content-left').forEach(content => {
            content.classList.add('hidden');
            content.style.display = 'none';
        });
        
        // Show content for active tabs in both panels
        // Find content panels in the correct panel containers
        const rightPanel = document.getElementById('right-tabs-panel');
        const leftPanel = document.getElementById('left-tabs-panel');
        
        if (rightPanelActiveTab && rightPanel) {
            const rightContentPanel = rightPanel.querySelector(`[data-panel-tab-name="${rightPanelActiveTab}"]`) ||
                rightPanel.querySelector(`#${rightPanelActiveTab}-content-panel`);
            if (rightContentPanel) {
                rightContentPanel.style.display = '';
                rightContentPanel.classList.remove('hidden');
            }
        }
        
        if (leftPanelActiveTab && leftPanel) {
            const leftContentPanel = leftPanel.querySelector(`[data-panel-tab-name="${leftPanelActiveTab}"]`) ||
                leftPanel.querySelector(`#${leftPanelActiveTab}-content-panel`);
            if (leftContentPanel) {
                leftContentPanel.style.display = '';
                leftContentPanel.classList.remove('hidden');
            }
        }

        // Show search section for layers and outliner tabs
        SearchSectionUtils.showSearchSectionForTab(tabName, this.editor);
    }

    /**
     * Ensure stable markers for panel tabs and their content containers.
     * This prevents cross-tab content confusion after tab moves.
     */
    ensurePanelTabMarkers() {
        // Canonical set of core panel tabs.
        const coreTabs = ['details', 'layers', 'outliner'];
        coreTabs.forEach((tabName) => {
            const content = document.getElementById(`${tabName}-content-panel`);
            if (content) {
                content.dataset.panelTabContent = 'true';
                content.dataset.panelTabName = tabName;
            }
        });

        document.querySelectorAll('[data-tab]').forEach((tab) => {
            const tabName = tab.dataset.tab;
            if (!tabName) return;

            tab.dataset.panelTab = 'true';

            const content = document.getElementById(`${tabName}-content-panel`);
            if (content) {
                content.dataset.panelTabContent = 'true';
                content.dataset.panelTabName = tabName;
            }
        });
    }


    setupStateListeners() {
        // Subscribe to selection changes
        this.editor.stateManager.subscribe('selectedObjects', () => {
            this.editor.render();
            this.editor.updateAllPanels();
        });

        // Subscribe to camera changes - immediate render for responsive zoom
        this.editor.stateManager.subscribe('camera', () => {
            // Only log camera changes in debug mode to avoid console spam
            // Camera changed, render called
            // Invalidate selectable objects cache since camera changed
            this.editor.clearSelectableObjectsCache();
            this.editor.render();
        });
    }
    
    /**
     * Destroy and cleanup all event listeners
     */
    destroy() {
        Logger.event.info('Destroying EventHandlers...');
        
        // Mark as destroyed to stop render loop
        this._destroyed = true;
        
        // Cancel render loop
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
            Logger.event.debug('Cancelled render loop');
        }
        
        // Disconnect all MutationObservers
        for (const observer of this.mutationObservers) {
            try {
                observer.disconnect();
            } catch (error) {
                Logger.event.warn('Failed to disconnect MutationObserver:', error);
            }
        }
        
        this.mutationObservers = [];
        
        Logger.event.info('EventHandlers destroyed');
    }
}

