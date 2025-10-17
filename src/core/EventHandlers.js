import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { MENU_CONFIG, getShortcutTarget } from '../../config/menu.js';

/**
 * Event Handlers module for LevelEditor
 * Handles all event listener setup and management
 */
export class EventHandlers extends BaseModule {
    constructor(levelEditor, menuManager = null) {
        super(levelEditor);
        this._rafId = null; // render loop id
        this.menuManager = menuManager;
        
        // Track event listeners for cleanup
        this.eventListeners = [];
        this._destroyed = false;
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {

        // Window resize with cleanup tracking
        const resizeHandler = () => {
            if (this._destroyed) return;
            this.editor.canvasRenderer.resizeCanvas();
            this.editor.render();
        };
        
        window.addEventListener('resize', resizeHandler);
        this.eventListeners.push({
            target: window,
            event: 'resize',
            handler: resizeHandler
        });

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
        
        // Right panel tabs
        this.setupRightPanelTabs();
        
        // State change listeners
        this.setupStateListeners();

        // Start render loop with proper cleanup support
        this.startRenderLoop();
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

        // Mouse events on canvas with cleanup tracking
        const handlers = {
            mousedown: (e) => this.editor.mouseHandlers.handleMouseDown(e),
            mousemove: (e) => this.editor.mouseHandlers.handleMouseMove(e),
            mouseup: (e) => this.editor.mouseHandlers.handleMouseUp(e),
            wheel: (e) => this.editor.mouseHandlers.handleWheel(e),
            dblclick: (e) => this.editor.mouseHandlers.handleDoubleClick(e),
            dragover: (e) => this.editor.mouseHandlers.handleDragOver(e),
            drop: (e) => this.editor.mouseHandlers.handleDrop(e)
        };
        
        for (const [event, handler] of Object.entries(handlers)) {
            const options = (event === 'wheel' || event === 'dragover' || event === 'drop') ? { passive: false } : { passive: true };
            canvas.addEventListener(event, handler, options);
            this.eventListeners.push({
                target: canvas,
                event,
                handler,
                options
            });
        }
        
        // Global mouse events for proper marquee handling
        const globalMouseDown = (e) => this.editor.mouseHandlers.handleGlobalMouseDown(e);
        const globalMouseMove = (e) => this.editor.mouseHandlers.handleGlobalMouseMove(e);
        const globalMouseUp = (e) => this.editor.mouseHandlers.handleGlobalMouseUp(e);

        // Try multiple targets for maximum event capture coverage
        // Window for events outside document bounds
        window.addEventListener('mousedown', globalMouseDown, { passive: true, capture: true });
        window.addEventListener('mousemove', globalMouseMove, { passive: true, capture: true });
        window.addEventListener('mouseup', globalMouseUp, { passive: true, capture: true });

        // Document body as fallback
        document.body.addEventListener('mousedown', globalMouseDown, { passive: true, capture: true });
        document.body.addEventListener('mousemove', globalMouseMove, { passive: true, capture: true });
        document.body.addEventListener('mouseup', globalMouseUp, { passive: true, capture: true });

        this.eventListeners.push(
            { target: window, event: 'mousedown', handler: globalMouseDown, options: { capture: true } },
            { target: window, event: 'mousemove', handler: globalMouseMove, options: { capture: true } },
            { target: window, event: 'mouseup', handler: globalMouseUp, options: { capture: true } },
            { target: document.body, event: 'mousedown', handler: globalMouseDown, options: { capture: true } },
            { target: document.body, event: 'mousemove', handler: globalMouseMove, options: { capture: true } },
            { target: document.body, event: 'mouseup', handler: globalMouseUp, options: { capture: true } }
        );
    }

    setupKeyboardEvents() {
        // Handle Ctrl key for snap to grid with cleanup tracking
        const keydownHandler = (e) => {
            if (this._destroyed) return;
            if (e.key === 'Control' || e.key === 'Meta') {
                this.editor.stateManager.update({
                    'keyboard.ctrlSnapToGrid': true
                });
            } else if (e.key === 'Shift') {
                this.editor.stateManager.update({
                    'keyboard.shiftKey': true
                });
            }
            
            this.handleKeyDown(e);
        };
        
        const keyupHandler = (e) => {
            if (this._destroyed) return;
            if (e.key === 'Control' || e.key === 'Meta') {
                this.editor.stateManager.update({
                    'keyboard.ctrlSnapToGrid': false
                });
            } else if (e.key === 'Shift') {
                this.editor.stateManager.update({
                    'keyboard.shiftKey': false
                });
            }
        };
        
        window.addEventListener('keydown', keydownHandler);
        window.addEventListener('keyup', keyupHandler);
        
        this.eventListeners.push(
            { target: window, event: 'keydown', handler: keydownHandler },
            { target: window, event: 'keyup', handler: keyupHandler }
        );
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
        
        // Initialize panel states from user preferences (already applied in applyUserSettingsImmediately)
        const panelStates = ['toolbar', 'assetsPanel', 'rightPanel'];
        panelStates.forEach(panel => {
            // Get visibility from user preferences, fallback to configManager, then to true
            const prefKey = panel + 'Visible'; // toolbarVisible, assetsPanelVisible, rightPanelVisible
            const visible = this.editor.userPrefs?.get(prefKey) ??
                           this.editor.configManager.get(`editor.view.${panel}`) ?? true;
            
            this.editor.stateManager.set(`view.${panel}`, visible);
            this.updateViewCheckbox(panel, visible);
            // Apply visibility immediately to ensure panels are shown/hidden correctly
            this.applyPanelVisibility(panel, visible);
            
        });

        // Initialize other view states from user config
        const viewStates = ['gameMode', 'objectBoundaries', 'objectCollisions', 'parallax'];
        viewStates.forEach(state => {
            // Game Mode should be false by default
            const defaultValue = state === 'gameMode' ? false : false;
            const configValue = this.editor.configManager.get(`editor.view.${state}`);
            const enabled = configValue ?? defaultValue;
            this.editor.stateManager.set(`view.${state}`, enabled);
            this.updateViewCheckbox(state, enabled);

            // Apply the view option for states that need UI changes
            if (state === 'gameMode') {
                this.toggleGameMode(enabled);
            }
        });

        // Initialize right panel tab state
        const rightPanelTab = this.editor.configManager.get('editor.view.rightPanelTab') ?? 'details';
        this.editor.stateManager.set('rightPanelTab', rightPanelTab);
        this.setActiveRightPanelTab(rightPanelTab);

        // Initialize panel positions using PanelPositionManager
        if (this.editor.panelPositionManager) {
            this.editor.panelPositionManager.initializePanelPositions();
        }
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
            const prefKey = panel + 'Visible'; // toolbarVisible, assetsPanelVisible, rightPanelVisible
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
     * Apply panel visibility changes
     * @param {string} panel - Panel name
     * @param {boolean} visible - Whether panel should be visible
     */
    applyPanelVisibility(panel, visible) {
        switch (panel) {
            case 'toolbar':
                if (this.editor.toolbar) {
                    this.editor.toolbar.setVisible(visible);
                }
                break;
            case 'assetsPanel':
                const assetsPanel = document.getElementById('assets-panel');
                const resizerAssets = document.getElementById('resizer-assets');
                if (assetsPanel) {
                    assetsPanel.classList.toggle('hidden', !visible);
                    assetsPanel.style.display = visible ? 'flex' : 'none';
                    if (resizerAssets) {
                        resizerAssets.classList.toggle('hidden', !visible);
                        resizerAssets.style.display = visible ? 'block' : 'none';
                    }
                }
                break;
            case 'rightPanel':
                const rightPanel = document.getElementById('right-panel');
                const resizerX = document.getElementById('resizer-x');
                if (rightPanel) {
                    rightPanel.classList.toggle('hidden', !visible);
                    rightPanel.style.display = visible ? 'flex' : 'none';
                    if (resizerX) {
                        resizerX.classList.toggle('hidden', !visible);
                        resizerX.style.display = visible ? 'block' : 'none';
                    }
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
        const viewOptions = ['grid', 'gameMode', 'snapToGrid', 'objectBoundaries', 'objectCollisions'];
        const panelOptions = ['toolbar', 'assetsPanel', 'rightPanel'];

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
            const panelOptions = ['toolbar', 'assetsPanel', 'rightPanel'];
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
        const rightPanel = document.getElementById('right-panel');
        const assetsPanel = document.getElementById('assets-panel');
        const consolePanel = document.getElementById('console-panel');
        const toolbarContainer = document.getElementById('toolbar-container');
        const resizerX = document.getElementById('resizer-x');
        const resizerAssets = document.getElementById('resizer-assets');
        const resizerConsole = document.getElementById('resizer-console');
        
        if (enabled) {
            // Store current panel states for restoration
            this.savedPanelStates = {
                toolbar: this.editor.stateManager.get('view.toolbar') ?? true,
                assetsPanel: this.editor.stateManager.get('view.assetsPanel') ?? true,
                rightPanel: this.editor.stateManager.get('view.rightPanel') ?? true,
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
            
            // Also hide toolbar content
            if (this.editor.toolbar) {
                this.editor.toolbar.setVisible(false);
            }
            
        } else {
            // Exit Game Mode: Restore panel toggle states in menu first
            this.restorePanelToggleStates();
            
            // Then restore panels based on saved states
            this.restorePanelStates();
            
            // Close View menu after exiting Game Mode
            if (this.menuManager) {
                this.menuManager.closeAllDropdowns();
            }
        }
        
        // Update Game Mode checkbox in menu
        this.updateViewCheckbox('gameMode', enabled);
        
        // Resize canvas after panel changes
        if (this.editor.canvasRenderer) {
            this.editor.canvasRenderer.resizeCanvas();
            this.editor.render();
        }
    }


    /**
     * Restore panel states when exiting Game Mode
     */
    restorePanelStates() {
        if (!this.savedPanelStates) return;

        const rightPanel = document.getElementById('right-panel');
        const assetsPanel = document.getElementById('assets-panel');
        const consolePanel = document.getElementById('console-panel');
        const toolbarContainer = document.getElementById('toolbar-container');
        const resizerX = document.getElementById('resizer-x');
        const resizerAssets = document.getElementById('resizer-assets');
        const resizerConsole = document.getElementById('resizer-console');

        // Restore toolbar
        if (this.savedPanelStates.toolbar) {
            toolbarContainer?.classList.remove('hidden');
            if (toolbarContainer) toolbarContainer.style.display = 'flex'; // Reset display style
            if (this.editor.toolbar) {
                this.editor.toolbar.setVisible(true);
            }
        } else {
            // Keep toolbar hidden if it was hidden before Game Mode
            toolbarContainer?.classList.add('hidden');
            if (toolbarContainer) toolbarContainer.style.display = 'none';
        }

        // Restore right panel
        if (this.savedPanelStates.rightPanel) {
            rightPanel?.classList.remove('hidden');
            if (rightPanel) rightPanel.style.display = 'flex'; // Reset display style
            resizerX?.classList.remove('hidden');
            if (resizerX) resizerX.style.display = 'block';
        } else {
            rightPanel?.classList.add('hidden');
            if (rightPanel) rightPanel.style.display = 'none';
            resizerX?.classList.add('hidden');
            if (resizerX) resizerX.style.display = 'none';
        }

        // Restore assets panel
        if (this.savedPanelStates.assetsPanel) {
            assetsPanel?.classList.remove('hidden');
            if (assetsPanel) assetsPanel.style.display = 'flex'; // Reset display style
            resizerAssets?.classList.remove('hidden');
            if (resizerAssets) resizerAssets.style.display = 'block';
        } else {
            assetsPanel?.classList.add('hidden');
            if (assetsPanel) assetsPanel.style.display = 'none';
            resizerAssets?.classList.add('hidden');
            if (resizerAssets) resizerAssets.style.display = 'none';
        }

        // Restore console panel
        if (this.savedPanelStates.console) {
            consolePanel?.classList.remove('hidden');
            if (consolePanel) consolePanel.style.display = 'flex'; // Reset display style
            resizerConsole?.classList.remove('hidden');
            if (resizerConsole) resizerConsole.style.display = 'block';
        } else {
            consolePanel?.classList.add('hidden');
            if (consolePanel) consolePanel.style.display = 'none';
            resizerConsole?.classList.add('hidden');
            if (resizerConsole) resizerConsole.style.display = 'none';
        }

        // Clear saved states
        this.savedPanelStates = null;
    }

    /**
     * Reset panel toggle states in menu when entering Game Mode
     */
    resetPanelToggleStates() {
        const panelToggles = ['toolbar', 'assetsPanel', 'rightPanel'];
        
        panelToggles.forEach(panel => {
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

    }

    setupRightPanelTabs() {
        const tabs = document.querySelectorAll('.tab-right');
        const contents = document.querySelectorAll('.tab-content-right');
        const searchSection = document.getElementById('right-panel-search');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabName = tab.dataset.tab;
                this.editor.stateManager.set('rightPanelTab', tabName);
                // Save to config for persistence
                this.editor.configManager.set('editor.view.rightPanelTab', tabName);

                contents.forEach(content => {
                    content.classList.toggle('hidden', content.id !== `${tabName}-content-panel`);
                });

                // Show search section for layers and outliner tabs
                if (searchSection) {
                    const showSearch = tabName === 'layers' || tabName === 'outliner';
                    searchSection.style.display = showSearch ? 'block' : 'none';

                    // Render appropriate search controls
                    if (showSearch) {
                        if (tabName === 'layers' && this.editor.layersPanel) {
                            this.editor.layersPanel.renderLayersSearchControls();
                        } else if (tabName === 'outliner' && this.editor.outlinerPanel) {
                            this.editor.outlinerPanel.renderOutlinerSearchControls();
                        }
                    }
                }
            });
        });

    }

    /**
     * Set active tab in right panel programmatically
     * @param {string} tabName - Name of the tab to activate
     */
    setActiveRightPanelTab(tabName) {
        const tabs = document.querySelectorAll('.tab-right');
        const contents = document.querySelectorAll('.tab-content-right');
        const searchSection = document.getElementById('right-panel-search');

        // Activate the specified tab
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Show corresponding content
        contents.forEach(content => {
            content.classList.toggle('hidden', content.id !== `${tabName}-content-panel`);
        });

        // Show search section for layers and outliner tabs
        if (searchSection) {
            const showSearch = tabName === 'layers' || tabName === 'outliner';
            searchSection.style.display = showSearch ? 'block' : 'none';

            // Render appropriate search controls
            if (showSearch) {
                if (tabName === 'layers' && this.editor.layersPanel) {
                    this.editor.layersPanel.renderLayersSearchControls();
                } else if (tabName === 'outliner' && this.editor.outlinerPanel) {
                    this.editor.outlinerPanel.renderOutlinerSearchControls();
                }
            }
        }
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
        
        // Remove all event listeners
        for (const { target, event, handler, options } of this.eventListeners) {
            try {
                target.removeEventListener(event, handler, options);
            } catch (error) {
                Logger.event.warn('Failed to remove event listener:', { event, error });
            }
        }
        
        this.eventListeners = [];
        
        Logger.event.info('EventHandlers destroyed');
    }
}
