import { BaseModule } from '../core/BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { SearchSectionUtils } from '../utils/SearchSectionUtils.js';
import { MENU_CONFIG, getShortcutTarget } from '../../config/menu.js';
import { TouchHandlers } from './TouchHandlers.js';
import { eventHandlerManager } from './EventHandlerManager.js';
import { UnifiedTouchManager } from './UnifiedTouchManager.js';
import { globalEventRegistry } from './GlobalEventRegistry.js';

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
        
        // Track MutationObservers for cleanup
        this.mutationObservers = [];
        
        // Initialize touch handlers (legacy support)
        this.touchHandlers = new TouchHandlers(levelEditor);
        levelEditor.touchHandlers = this.touchHandlers;
        
        // Initialize unified touch manager
        this.unifiedTouchManager = new UnifiedTouchManager(levelEditor, eventHandlerManager);
        levelEditor.unifiedTouchManager = this.unifiedTouchManager;
        
        // Set UnifiedTouchManager in EventHandlerManager
        eventHandlerManager.setUnifiedTouchManager(this.unifiedTouchManager);
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Window events - combine all window handlers
        this.setupWindowEvents();
        
        // Canvas events
        this.setupCanvasEvents();
        
        // Touch events
        this.setupTouchEvents();

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
        // Combined window handlers
        const windowHandlers = {
            // Resize events
            resize: () => {
                if (this._destroyed) return;
                this.editor.canvasRenderer.resizeCanvas();
                this.editor.render();
            },
            
            // Global mouse events for proper marquee handling
            mousedown: (e) => this.editor.mouseHandlers.handleGlobalMouseDown(e),
            mousemove: (e) => this.editor.mouseHandlers.handleGlobalMouseMove(e),
            mouseup: (e) => this.editor.mouseHandlers.handleGlobalMouseUp(e),
            
            // Global touch events (only for non-canvas elements)
            touchstart: (e) => {
                if (e.target !== this.editor.canvasRenderer.canvas) {
                    this.touchHandlers.handleTouchStart(e);
                }
            },
            touchmove: (e) => {
                if (e.target !== this.editor.canvasRenderer.canvas) {
                    this.touchHandlers.handleTouchMove(e);
                }
            },
            touchend: (e) => {
                if (e.target !== this.editor.canvasRenderer.canvas) {
                    this.touchHandlers.handleTouchEnd(e);
                }
            },
            touchcancel: (e) => {
                if (e.target !== this.editor.canvasRenderer.canvas) {
                    this.touchHandlers.handleTouchCancel(e);
                }
            },
            
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
        globalEventRegistry.registerComponentHandlers('window-all', windowHandlers, 'window');
        
        // Register global mouse handlers using GlobalEventRegistry
        const globalMouseHandlers = {
            mousedown: (e) => this.editor.mouseHandlers.handleGlobalMouseDown(e),
            mousemove: (e) => this.editor.mouseHandlers.handleGlobalMouseMove(e),
            mouseup: (e) => this.editor.mouseHandlers.handleGlobalMouseUp(e)
        };
        globalEventRegistry.registerComponentHandlers('global-mouse-document', globalMouseHandlers, 'document');
        
        // Also register on window for marquee completion (like BasePanel does)
        const windowMouseHandlers = {
            mouseup: (e) => this.editor.mouseHandlers.handleGlobalMouseUp(e)
        };
        globalEventRegistry.registerComponentHandlers('global-mouse-window', windowMouseHandlers, 'window');
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

                this.editor.render();
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
            onDrop: (e) => this.editor.mouseHandlers.handleDrop(e),
            
            // Touch events
            onTouchStart: (e) => this.handleCanvasTouchStart(e),
            onTouchMove: (e) => this.handleCanvasTouchMove(e),
            onTouchEnd: (e) => this.handleCanvasTouchEnd(e),
            onTouchCancel: (e) => this.handleCanvasTouchCancel(e)
        };
        
        // Register canvas with unified handlers
        eventHandlerManager.registerCanvas(canvas, canvasConfig, 'main-canvas');
        
        // Also register with UnifiedTouchManager for advanced touch gestures
        if (this.unifiedTouchManager) {
            this.unifiedTouchManager.registerElement(canvas, 'canvas', {
                enablePan: true,
                enableZoom: true,
                enableMarquee: true,
                enableContextMenu: true
            }, 'main-canvas');
        }
    }

    setupTouchEvents() {
        // Touch events are now handled in setupWindowEvents
        // This method is kept for compatibility but does nothing
    }

    /**
     * Handle canvas touch events (delegate to TouchHandlers)
     */
    handleCanvasTouchStart(e) {
        this.touchHandlers.handleTouchStart(e);
    }

    handleCanvasTouchMove(e) {
        this.touchHandlers.handleTouchMove(e);
    }

    handleCanvasTouchEnd(e) {
        this.touchHandlers.handleTouchEnd(e);
    }

    handleCanvasTouchCancel(e) {
        this.touchHandlers.handleTouchCancel(e);
    }

    setupKeyboardEvents() {
        // Keyboard events are now handled in setupWindowEvents
        // This method is kept for compatibility but does nothing
    }
    
    handleKeyDown(e) {
        // Allow input fields to work normally
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.contentEditable === 'true')) {
            return;
        }

        // Handle escape key to cancel all current actions
        if (e.key === 'Escape') {
            e.preventDefault();

            // Close group edit mode if active (same as clicking outside group bounds)
            if (this.editor.groupOperations && this.editor.groupOperations.isInGroupEditMode()) {
                this.editor.groupOperations.closeGroupEditMode();
                return;
            }

            // Check if any active processes are running that shouldn't be interrupted
            const mouse = this.editor.stateManager.get('mouse');
            const hasActiveProcess = mouse.isPlacingObjects || mouse.isDragging || mouse.isRightDown;

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
        
        if (e.key === 'Delete' || e.key.toLowerCase() === 'x') {
            e.preventDefault();
            if (this.editor.objectOperations && typeof this.editor.objectOperations.deleteSelectedObjects === 'function') {
                this.editor.objectOperations.deleteSelectedObjects();
            }
        } else if (e.shiftKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if (this.editor.objectOperations && typeof this.editor.objectOperations.duplicateSelectedObjects === 'function') {
                this.editor.objectOperations.duplicateSelectedObjects();
            }
        } else if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            if (typeof this.editor.focusOnSelection === 'function') {
                this.editor.focusOnSelection();
            }
        } else if (e.key.toLowerCase() === 'a') {
            e.preventDefault();
            if (typeof this.editor.focusOnAll === 'function') {
                this.editor.focusOnAll();
            }
        } else if (e.key.toLowerCase() === 'g' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
            e.preventDefault();
            this.toggleGrid();
        } else if (e.shiftKey && e.key.toLowerCase() === 'g') {
            e.preventDefault();
            if (this.editor.groupOperations && typeof this.editor.groupOperations.groupSelectedObjects === 'function') {
                this.editor.groupOperations.groupSelectedObjects();
            }
        } else if (e.altKey && e.key.toLowerCase() === 'g') {
            e.preventDefault();
            if (this.editor.groupOperations && typeof this.editor.groupOperations.ungroupSelectedObjects === 'function') {
                this.editor.groupOperations.ungroupSelectedObjects();
            }
        } else if (e.key.toLowerCase() === 'p') {
            e.preventDefault();
            this.toggleViewOption('parallax');
        } else if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (typeof this.editor.redo === 'function') {
                        this.editor.redo();
                    }
                } else {
                    if (typeof this.editor.undo === 'function') {
                        this.editor.undo();
                    }
                }
            } else if (e.key.toLowerCase() === 'y') {
                e.preventDefault();
                if (typeof this.editor.redo === 'function') {
                    this.editor.redo();
                }
            } else if (e.key.toLowerCase() === 'n') {
                e.preventDefault();
                if (typeof this.editor.newLevel === 'function') {
                    this.editor.newLevel();
                }
            } else if (e.key.toLowerCase() === 'o') {
                e.preventDefault();
                if (typeof this.editor.openLevel === 'function') {
                    this.editor.openLevel();
                }
            } else if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (typeof this.editor.saveLevelAs === 'function') {
                        // Handle async action
                        (async () => {
                            await this.editor.saveLevelAs();
                        })();
                    }
                } else {
                    if (typeof this.editor.saveLevel === 'function') {
                        // Handle async action
                        (async () => {
                            await this.editor.saveLevel();
                        })();
                    }
                }
            }
        } else if (e.key === 'PageUp') {
            e.preventDefault();
            if (typeof this.editor.moveSelectedObjectsToLayer === 'function') {
                const moveToExtreme = e.shiftKey;
                this.editor.moveSelectedObjectsToLayer(true, moveToExtreme);
            }
        } else if (e.key === 'PageDown') {
            e.preventDefault();
            if (typeof this.editor.moveSelectedObjectsToLayer === 'function') {
                const moveToExtreme = e.shiftKey;
                this.editor.moveSelectedObjectsToLayer(false, moveToExtreme);
            }
        } else {
            // Unknown key combination
        }
    }

    setupMenuEvents() {
        // Menu events are now handled by MenuManager
        // This method is kept for backward compatibility
    }

    initializeViewStates() {
        // Ensure configManager is available and loaded
        if (!this.editor.configManager) {
            console.warn('ConfigManager not available during view state initialization');
            return;
        }

        // Ensure configuration is fully loaded before proceeding
        if (!this.editor.configManager.isConfigReady()) {
            console.warn('Configuration not ready during view state initialization - deferring');
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
        const panelStates = ['toolbar', 'assetsPanel', 'console'];
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
            
            // Setup context menus for tabs after panels are created
            this.updateTabHandlers();
            
            // Touch support is now handled by TouchInitializationManager
            // No need to call individual touch setup methods
            
            // Don't re-apply panel visibility here - PanelPositionManager handles it
            // based on actual tab positions and panel existence
        } else {
            console.log('❌ EventHandlers: PanelPositionManager not found!');
        }

        // Activate tabs after panel positions are initialized
        this.activateTabsAfterPanelInitialization();

        // Initialize search controls after panels are created
        if (this.editor.initializeSearchControls) {
            this.editor.initializeSearchControls();
        }

        // Setup tab event listeners after panels are created
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
        document.querySelectorAll('#menu-level > div, #menu-view > div, #menu-settings > div').forEach(d => d.classList.add('hidden'));
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
        document.querySelectorAll('#menu-level > div, #menu-view > div, #menu-settings > div').forEach(d => d.classList.add('hidden'));
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
                }
                
                // Show/hide panel elements
                config.elements.forEach(element => {
                    const el = document.getElementById(element.id);
                    if (el) {
                        if (visible) {
                            el.classList.remove('hidden');
                            el.style.display = element.display;
                        } else {
                            el.classList.add('hidden');
                            el.style.display = 'none';
                        }
                    }
                });
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
                // Enter fullscreen
                const root = document.documentElement;
                if (!document.fullscreenElement && root?.requestFullscreen) {
                    root.requestFullscreen().catch(() => {});
                }
            } else {
                // Exit fullscreen
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
            }
        } catch (_) {
            // Ignore fullscreen errors
        }
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
        
        // Setup tab click handlers and context menus for all tabs
            this.updateTabHandlers();
        
        // Use single MutationObserver to detect tab changes and re-setup all handlers
        const observer = new MutationObserver((mutations) => {
            if (this._destroyed) return; // Prevent processing if destroyed
            
            let tabsChanged = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList && (node.classList.contains('tab-right') || node.classList.contains('tab-left') || node.classList.contains('tab'))) {
                                tabsChanged = true;
                            }
                            // Check child elements too
                            if (node.querySelector && (node.querySelector('.tab-right') || node.querySelector('.tab-left') || node.querySelector('.tab'))) {
                                tabsChanged = true;
                            }
                        }
                    });
                }
            });
            
            if (tabsChanged) {
            this.updateTabHandlers();
                
                // Update panels when tab count changes
                if (this.editor && this.editor.updateAllPanels) {
                    this.editor.updateAllPanels();
                }
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
        if (this._destroyed) return;
        if (this._updatingTabHandlers) return;
        this._updatingTabHandlers = true;

        try {
            // Check if tabs exist before processing
            const tabs = document.querySelectorAll('.tab-right, .tab-left, .tab');
            if (tabs.length === 0) {
                Logger.ui.debug('No tabs found, skipping tab handler update');
                return;
            }
            
            // Temporarily disconnect MutationObservers to prevent infinite loops
            const disconnectedObservers = [];
            this.mutationObservers.forEach(observer => {
                observer.disconnect();
                disconnectedObservers.push(observer);
            });
            
            // Add both click and context menu handlers to all tabs
            tabs.forEach(tab => {
                const tabName = tab.dataset.tab || tab.dataset.category || 'unknown';
                
                // Skip asset tabs for click handlers - they have their own click handlers
                const isAssetTab = tab.classList.contains('tab') && tab.dataset.category;
                
                const tabHandlers = {};
                
                // Add click handler only for panel tabs
                if (!isAssetTab) {
                    tabHandlers.click = () => {
                        const clickedTabName = tab.dataset.tab;
                        
                        // Determine which panel this tab belongs to
                        const panel = tab.closest('[id$="-tabs-panel"]');
                        const panelSide = panel ? (panel.id.includes('left') ? 'left' : 'right') : 'right';
                        
                        // Use the centralized method to handle tab activation
                        this.setActivePanelTab(clickedTabName, panelSide);
                        
                        // Update state manager and config for the appropriate panel
                        if (panelSide === 'right') {
                            this.editor.stateManager.set('rightPanelTab', clickedTabName);
                            this.editor.configManager.set('editor.view.rightPanelTab', clickedTabName);
                        } else if (panelSide === 'left') {
                            this.editor.stateManager.set('leftPanelTab', clickedTabName);
                            this.editor.configManager.set('editor.view.leftPanelTab', clickedTabName);
                        }
                    };
                }
                
                // Add context menu handler for all tabs
                tabHandlers.contextmenu = (e) => this.handleTabContextMenu(e);
                
                eventHandlerManager.registerElement(tab, tabHandlers, `tab-${tabName}`);
            });
            
            // Reconnect MutationObservers
            disconnectedObservers.forEach(observer => {
                const panels = document.querySelectorAll('#right-tabs-panel, #left-tabs-panel, #assets-panel');
                panels.forEach(panel => {
                    observer.observe(panel, { childList: true, subtree: true });
                });
            });
            
        } finally {
            this._updatingTabHandlers = false;
        }
    }



    /**
     * Handle context menu on tab
     * @param {Event} event - Context menu event
     */
    handleTabContextMenu(event) {
        event.preventDefault();
        
        const tab = event.target.closest('.tab-right, .tab-left, .tab');
        if (!tab) return;
        
        const tabName = tab.dataset.tab || tab.dataset.category;
        if (!tabName) return;
        
        // Determine current panel by finding which panel contains this tab
        const leftPanel = document.getElementById('left-tabs-panel');
        const rightPanel = document.getElementById('right-tabs-panel');
        const assetsPanel = document.getElementById('assets-panel');
        
        let currentPanel = 'right'; // default
        if (leftPanel && leftPanel.contains(tab)) {
            currentPanel = 'left';
        } else if (rightPanel && rightPanel.contains(tab)) {
            currentPanel = 'right';
        } else if (assetsPanel && assetsPanel.contains(tab)) {
            // Asset tabs have different context menu with Close option
            this.showAssetTabContextMenu(event, tabName, tab);
            return;
        }
        
        const targetPanel = currentPanel === 'right' ? 'left' : 'right';
        
        // Create simple context menu
        this.showTabContextMenu(event, tabName, currentPanel, targetPanel);
    }

    /**
     * Show context menu for asset tab
     * @param {Event} event - Context menu event
     * @param {string} tabName - Name of the tab
     * @param {HTMLElement} tab - Tab element
     */
    showAssetTabContextMenu(event, tabName, tab) {
        // Remove existing menu
        const existingMenu = document.querySelector('.tab-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create menu with advanced positioning
        const menu = document.createElement('div');
        menu.className = 'tab-context-menu fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 min-w-48';
        menu.style.pointerEvents = 'auto';
        menu.style.userSelect = 'none';

        // Advanced positioning with boundary checking
        const menuWidth = 120;
        const menuHeight = 40;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 10;

        let left = event.clientX;
        let top = event.clientY;

        // Horizontal positioning
        const spaceRight = viewportWidth - event.clientX;
        const spaceLeft = event.clientX;

        if (spaceRight >= menuWidth + margin) {
            left = event.clientX;
        } else if (spaceLeft >= menuWidth + margin) {
            left = event.clientX - menuWidth;
        } else {
            left = margin;
        }

        // Vertical positioning
        const spaceBelow = viewportHeight - event.clientY;
        const spaceAbove = event.clientY;

        if (spaceBelow >= menuHeight + margin) {
            top = event.clientY;
        } else if (spaceAbove >= menuHeight + margin) {
            top = event.clientY - menuHeight;
        } else {
            top = margin;
        }

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';

        // Create Close menu item
        const closeItem = document.createElement('div');
        closeItem.className = 'px-4 py-2 hover:bg-gray-700 cursor-pointer text-sm';
        closeItem.textContent = 'Close';
        closeItem.addEventListener('click', () => {
            this.closeAssetTab(tabName, tab);
            menu.remove();
        });

        menu.appendChild(closeItem);

        // Add to document
        document.body.appendChild(menu);

        // Add click outside to close
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        // Use setTimeout to avoid immediate closure
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    /**
     * Close asset tab
     * @param {string} tabName - Name of the tab to close
     * @param {HTMLElement} tab - Tab element
     */
    closeAssetTab(tabName, tab) {
        if (!this.editor.assetPanel) {
            Logger.ui.warn('AssetPanel not found');
            return;
        }

        // Get current active tabs
        const activeTabs = new Set(this.editor.stateManager.get('activeAssetTabs'));
        
        // Don't close if it's the last tab
        if (activeTabs.size <= 1) {
            Logger.ui.debug('Cannot close last asset tab');
            return;
        }

        // Remove tab from active tabs
        activeTabs.delete(tabName);
        this.editor.stateManager.set('activeAssetTabs', activeTabs);
        
        // Save to config for persistence
        this.editor.configManager.set('editor.view.activeAssetTabs', Array.from(activeTabs));
        
        // Clear selection if this tab was selected
        this.editor.stateManager.set('selectedAssets', new Set());
        
        // Re-render asset panel
        this.editor.assetPanel.render();
        
        Logger.ui.info(`Asset tab ${tabName} closed`);
    }

    /**
     * Show context menu for tab
     * @param {Event} event - Context menu event
     * @param {string} tabName - Name of the tab
     * @param {string} currentPanel - Current panel side
     * @param {string} targetPanel - Target panel side
     */
    showTabContextMenu(event, tabName, currentPanel, targetPanel) {
        // Remove existing menu
        const existingMenu = document.querySelector('.tab-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create menu with advanced positioning (similar to BaseContextMenu)
        const menu = document.createElement('div');
        menu.className = 'tab-context-menu fixed bg-gray-800 border border-gray-600 rounded shadow-lg z-50 min-w-48';
        menu.style.pointerEvents = 'auto'; // Ensure menu captures events
        menu.style.userSelect = 'none'; // Prevent text selection

        // Advanced positioning with boundary checking
        const menuWidth = 160; // Estimated width
        const menuHeight = 40; // Height for single item
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 10;

        let left = event.clientX;
        let top = event.clientY;

        // Horizontal positioning (prefer right side of cursor)
        const spaceRight = viewportWidth - event.clientX;
        const spaceLeft = event.clientX;

        if (spaceRight >= menuWidth + margin) {
            left = event.clientX;
        } else if (spaceLeft >= menuWidth + margin) {
            left = event.clientX - menuWidth;
        } else {
            left = Math.max(margin, Math.min(event.clientX - menuWidth / 2, viewportWidth - menuWidth - margin));
        }

        // Vertical positioning (prefer below cursor)
        const spaceBelow = viewportHeight - event.clientY;
        const spaceAbove = event.clientY;

        if (spaceBelow >= menuHeight + margin) {
            top = event.clientY;
        } else if (spaceAbove >= menuHeight + margin) {
            top = event.clientY - menuHeight;
        } else {
            top = event.clientY;
        }

        // Ensure menu stays within viewport bounds
        left = Math.max(margin, Math.min(left, viewportWidth - menuWidth - margin));
        top = Math.max(margin, Math.min(top, viewportHeight - menuHeight - margin));

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';

        // Create menu item with EventHandlerManager
        const menuItem = document.createElement('div');
        menuItem.className = 'px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer whitespace-nowrap';
        menuItem.innerHTML = `Move to ${targetPanel === 'right' ? 'Right' : 'Left'} Panel`;

        const menuItemHandlers = {
            click: () => {
            if (this.editor && this.editor.panelPositionManager) {
                this.editor.panelPositionManager.moveTab(tabName, currentPanel, targetPanel);
            }
            menu.remove();
            }
        };
        
        eventHandlerManager.registerElement(menuItem, menuItemHandlers, `menu-item-${tabName}`);

        menu.appendChild(menuItem);
        document.body.appendChild(menu);

        // Prevent menu from being resized or minimized
        menu.style.minWidth = menuWidth + 'px';
        menu.style.minHeight = menuHeight + 'px';

        // Close menu when clicking outside using EventHandlerManager
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                eventHandlerManager.unregisterElement(document);
            }
        };

        setTimeout(() => {
            const documentHandlers = {
                click: closeMenu
            };
            eventHandlerManager.registerElement(document, documentHandlers, 'menu-close');
        }, 0);
    }

    /**
     * Activate tabs after panel initialization
     */
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
        
        // Hide all content panels first
        document.querySelectorAll('.tab-content-right, .tab-content-left').forEach(content => {
            content.classList.add('hidden');
        });
        
        // Show content for active tabs in both panels
        // Find content panels in the correct panel containers
        const rightPanel = document.getElementById('right-tabs-panel');
        const leftPanel = document.getElementById('left-tabs-panel');
        
        if (rightPanelActiveTab && rightPanel) {
            const rightContentPanel = rightPanel.querySelector(`#${rightPanelActiveTab}-content-panel`);
            if (rightContentPanel) {
                rightContentPanel.classList.remove('hidden');
            }
        }
        
        if (leftPanelActiveTab && leftPanel) {
            const leftContentPanel = leftPanel.querySelector(`#${leftPanelActiveTab}-content-panel`);
            if (leftContentPanel) {
                leftContentPanel.classList.remove('hidden');
            }
        }

        // Show search section for layers and outliner tabs
        SearchSectionUtils.showSearchSectionForTab(tabName, this.editor);
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
        
        // Clean up UnifiedTouchManager
        if (this.unifiedTouchManager) {
            this.unifiedTouchManager.destroy();
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
        
        // Clean up touch handlers
        if (this.touchHandlers) {
            this.touchHandlers.resetTouchState();
        }
        
        Logger.event.info('EventHandlers destroyed');
    }
}
