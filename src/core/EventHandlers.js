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
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {

        // Window resize
        window.addEventListener('resize', () => {
            this.editor.canvasRenderer.resizeCanvas();
            this.editor.render();
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

        // Start render loop to ensure the main view renders every frame (decoupled from mouse actions)
        let lastDuplicateState = null;
        const renderLoop = () => {
            try {
                const duplicate = this.editor.stateManager.get('duplicate');
                const currentState = duplicate ? `${duplicate.isActive}_${duplicate.objects?.length || 0}` : 'null';

                // Log only when duplicate state changes (optimized to reduce console spam)
                if (currentState !== lastDuplicateState) {
                    if (duplicate && duplicate.isActive) {
                        Logger.event.debug(`Render loop: Duplicate active, objects: ${duplicate.objects?.length || 0}`);
                    } else if (lastDuplicateState !== null) {
                        Logger.event.debug('Render loop: Duplicate deactivated');
                    }
                    lastDuplicateState = currentState;
                }

                this.editor.render();
            } catch (e) {
                Logger.event.error('Render loop error:', e);
            }
            this._rafId = requestAnimationFrame(renderLoop);
        };
        if (!this._rafId) {
            Logger.event.info('Starting render loop');
            this._rafId = requestAnimationFrame(renderLoop);
        }
    }

    setupCanvasEvents() {
        const canvas = this.editor.canvasRenderer.canvas;

        // Mouse events on canvas
        canvas.addEventListener('mousedown', (e) => this.editor.mouseHandlers.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.editor.mouseHandlers.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.editor.mouseHandlers.handleMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.editor.mouseHandlers.handleWheel(e), { passive: false });
        canvas.addEventListener('dblclick', (e) => this.editor.mouseHandlers.handleDoubleClick(e));
        
        // Global mouse events for proper marquee handling
        window.addEventListener('mousemove', (e) => this.editor.mouseHandlers.handleGlobalMouseMove(e));
        window.addEventListener('mouseup', (e) => this.editor.mouseHandlers.handleGlobalMouseUp(e));
        
        // Drag and drop
        canvas.addEventListener('dragover', (e) => this.editor.mouseHandlers.handleDragOver(e));
        canvas.addEventListener('drop', (e) => this.editor.mouseHandlers.handleDrop(e));
    }

    setupKeyboardEvents() {
        // Handle Ctrl key for snap to grid
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                this.editor.stateManager.update({
                    'keyboard.ctrlSnapToGrid': true
                });
            } else if (e.key === 'Shift') {
                this.editor.stateManager.update({
                    'keyboard.shiftKey': true
                });
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                this.editor.stateManager.update({
                    'keyboard.ctrlSnapToGrid': false
                });
            } else if (e.key === 'Shift') {
                this.editor.stateManager.update({
                    'keyboard.shiftKey': false
                });
            }
        });

        window.addEventListener('keydown', (e) => {
            // Allow input fields to work normally
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.contentEditable === 'true')) {
                return;
            }


            // Handle escape key to cancel all current actions
            if (e.key === 'Escape') {
                e.preventDefault();
                this.editor.cancelAllActions();
                return;
            }
            
            if (e.key === 'Delete' || e.key.toLowerCase() === 'x') {
                e.preventDefault();
                if (this.editor.objectOperations && typeof this.editor.objectOperations.deleteSelectedObjects === 'function') {
                    this.editor.objectOperations.deleteSelectedObjects();
                } else {
                }
            } else if (e.shiftKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                if (this.editor.objectOperations && typeof this.editor.objectOperations.duplicateSelectedObjects === 'function') {
                    this.editor.objectOperations.duplicateSelectedObjects();
                } else {
                }
            } else if (e.key.toLowerCase() === 'f') {
                e.preventDefault();
                if (typeof this.editor.focusOnSelection === 'function') {
                    this.editor.focusOnSelection();
                } else {
                }
            } else if (e.key.toLowerCase() === 'a') {
                e.preventDefault();
                if (typeof this.editor.focusOnAll === 'function') {
                    this.editor.focusOnAll();
                } else {
                }
            } else if (e.shiftKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (this.editor.groupOperations && typeof this.editor.groupOperations.groupSelectedObjects === 'function') {
                    this.editor.groupOperations.groupSelectedObjects();
                } else {
                }
            } else if (e.altKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (this.editor.groupOperations && typeof this.editor.groupOperations.ungroupSelectedObjects === 'function') {
                    this.editor.groupOperations.ungroupSelectedObjects();
                } else {
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
                        } else {
                        }
                    } else {
                        if (typeof this.editor.undo === 'function') {
                            this.editor.undo();
                        } else {
                        }
                    }
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    if (typeof this.editor.redo === 'function') {
                        this.editor.redo();
                    } else {
                    }
                } else if (e.key.toLowerCase() === 'n') {
                    e.preventDefault();
                    if (typeof this.editor.newLevel === 'function') {
                        this.editor.newLevel();
                    } else {
                    }
                } else if (e.key.toLowerCase() === 'o') {
                    e.preventDefault();
                    if (typeof this.editor.openLevel === 'function') {
                        this.editor.openLevel();
                    } else {
                    }
                } else if (e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        if (typeof this.editor.saveLevelAs === 'function') {
                            this.editor.saveLevelAs();
                        } else {
                        }
                    } else {
                        if (typeof this.editor.saveLevel === 'function') {
                            this.editor.saveLevel();
                        } else {
                        }
                    }
                } else {
                }
            } else if (e.key === 'PageUp') {
                e.preventDefault();
                if (typeof this.editor.moveSelectedObjectsToLayer === 'function') {
                    const moveToExtreme = e.shiftKey;
                    this.editor.moveSelectedObjectsToLayer(true, moveToExtreme);
                } else {
                }
            } else if (e.key === 'PageDown') {
                e.preventDefault();
                if (typeof this.editor.moveSelectedObjectsToLayer === 'function') {
                    const moveToExtreme = e.shiftKey;
                    this.editor.moveSelectedObjectsToLayer(false, moveToExtreme);
                } else {
                }
            } else {
            }
        });
    }

    setupMenuEvents() {
        // Menu events are now handled by MenuManager
        // This method is kept for backward compatibility
    }

    initializeViewStates() {
        
        // Initialize grid state from user config or level settings
        const gridEnabled = this.editor.configManager.get('editor.view.grid') ?? this.editor.level?.settings?.showGrid ?? true;
        
        this.editor.stateManager.set('view.grid', gridEnabled);
        this.editor.stateManager.set('canvas.showGrid', gridEnabled);
        this.updateViewCheckbox('grid', gridEnabled);
        
        // Initialize snap to grid state from user config or level settings
        const snapToGridEnabled = this.editor.configManager.get('editor.view.snapToGrid') ?? this.editor.level?.settings?.snapToGrid ?? false;
        this.editor.stateManager.set('view.snapToGrid', snapToGridEnabled);
        this.editor.stateManager.set('canvas.snapToGrid', snapToGridEnabled);
        this.updateViewCheckbox('snapToGrid', snapToGridEnabled);
        
        // Initialize panel states first (always initialize panels)
        const panelStates = ['toolbar', 'assetsPanel', 'rightPanel'];
        panelStates.forEach(panel => {
            const visible = this.editor.configManager.get(`editor.view.${panel}`) ?? true;
            this.editor.stateManager.set(`view.${panel}`, visible);
            this.updateViewCheckbox(panel, visible);
            this.applyPanelVisibility(panel, visible);
        });

        // Initialize other view states from user config
        const viewStates = ['gameMode', 'objectBoundaries', 'objectCollisions', 'parallax'];
        viewStates.forEach(state => {
            // Game Mode should be false by default
            const defaultValue = state === 'gameMode' ? false : false;
            const enabled = this.editor.configManager.get(`editor.view.${state}`) ?? defaultValue;
            this.editor.stateManager.set(`view.${state}`, enabled);
            this.updateViewCheckbox(state, enabled);
            
            // Apply the view option for states that need UI changes
            if (state === 'gameMode') {
                this.toggleGameMode(enabled);
            }
        });
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
                checkElement.classList.toggle('hidden', !enabled);
            }
        }
    }

    toggleViewOption(option) {
        // Get current state from editor's state manager
        const currentState = this.editor.stateManager.get(`view.${option}`) || false;
        const newState = !currentState;
        
        
        // Update state
        this.editor.stateManager.set(`view.${option}`, newState);
        
        // Save to user configuration
        this.editor.configManager.set(`editor.view.${option}`, newState);
        
        // Update UI checkbox
        this.updateViewCheckbox(option, newState);
        
        // Apply the view option
        this.applyViewOption(option, newState);
        
        // Close the menu
        document.querySelectorAll('#menu-level > div, #menu-view > div, #menu-settings > div').forEach(d => d.classList.add('hidden'));
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
        
        // Save to user configuration
        this.editor.configManager.set(`editor.view.${panel}`, newState);
        
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
                // Update both view state and canvas state for grid
                this.editor.stateManager.set('view.grid', enabled);
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
                const toolbarContainer = document.getElementById('toolbar-container');
                if (toolbarContainer) {
                    toolbarContainer.classList.toggle('hidden', !visible);
                    toolbarContainer.style.display = visible ? 'flex' : 'none';
                }
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
            // Exit Game Mode: Restore panels based on saved states
            this.restorePanelStates();
            
            // Restore panel toggle states in menu
            this.restorePanelToggleStates();
        }
        
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
            toolbarContainer.style.display = 'flex'; // Reset display style
            if (this.editor.toolbar) {
                this.editor.toolbar.setVisible(true);
            }
        } else {
            // Keep toolbar hidden if it was hidden before Game Mode
            toolbarContainer?.classList.add('hidden');
            toolbarContainer.style.display = 'none';
        }

        // Restore right panel
        if (this.savedPanelStates.rightPanel) {
            rightPanel?.classList.remove('hidden');
            rightPanel.style.display = 'flex'; // Reset display style
            resizerX?.classList.remove('hidden');
            resizerX.style.display = 'block';
        } else {
            rightPanel?.classList.add('hidden');
            rightPanel.style.display = 'none';
            resizerX?.classList.add('hidden');
            resizerX.style.display = 'none';
        }

        // Restore assets panel
        if (this.savedPanelStates.assetsPanel) {
            assetsPanel?.classList.remove('hidden');
            assetsPanel.style.display = 'flex'; // Reset display style
            resizerAssets?.classList.remove('hidden');
            resizerAssets.style.display = 'block';
        } else {
            assetsPanel?.classList.add('hidden');
            assetsPanel.style.display = 'none';
            resizerAssets?.classList.add('hidden');
            resizerAssets.style.display = 'none';
        }

        // Restore console panel
        if (this.savedPanelStates.console) {
            consolePanel?.classList.remove('hidden');
            consolePanel.style.display = 'flex'; // Reset display style
            resizerConsole?.classList.remove('hidden');
            resizerConsole.style.display = 'block';
        } else {
            consolePanel?.classList.add('hidden');
            consolePanel.style.display = 'none';
            resizerConsole?.classList.add('hidden');
            resizerConsole.style.display = 'none';
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

        // Restore assets panel toggle
        this.editor.stateManager.set('view.assetsPanel', this.savedPanelStates.assetsPanel);
        this.updateViewCheckbox('assetsPanel', this.savedPanelStates.assetsPanel);

        // Restore right panel toggle
        this.editor.stateManager.set('view.rightPanel', this.savedPanelStates.rightPanel);
        this.updateViewCheckbox('rightPanel', this.savedPanelStates.rightPanel);

    }

    setupRightPanelTabs() {
        const tabs = document.querySelectorAll('.tab-right');
        const contents = document.querySelectorAll('.tab-content-right');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabName = tab.dataset.tab;
                this.editor.stateManager.set('rightPanelTab', tabName);
                
                contents.forEach(content => {
                    content.classList.toggle('hidden', content.id !== `${tabName}-content-panel`);
                });
            });
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
            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.event.debug('Camera changed, calling render');
            }
            // Invalidate selectable objects cache since camera changed
            this.editor.clearSelectableObjectsCache();
            this.editor.render();
        });
    }
}
