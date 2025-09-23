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
        
        // Initialize other view states from user config
        const viewStates = ['gameMode', 'objectBoundaries', 'objectCollisions', 'parallax'];
        viewStates.forEach(state => {
            const enabled = this.editor.configManager.get(`editor.view.${state}`) ?? false;
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
            const itemId = `toggle-${option.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            this.menuManager.updateToggleState(itemId, enabled);
        } else {
            // Fallback to direct DOM manipulation
            const checkId = option.replace(/([A-Z])/g, '-$1').toLowerCase() + '-check';
            const checkElement = document.getElementById(checkId);
            if (checkElement) {
                checkElement.classList.toggle('hidden', !enabled);
            }
        }
    }

    toggleViewOption(option) {
        
        // Debug: Check all related states
        
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
     * Save current View menu states before level operations
     * @returns {Object} Saved view states
     */
    saveViewStates() {

        const savedStates = {};
        const viewOptions = ['grid', 'gameMode', 'snapToGrid', 'objectBoundaries', 'objectCollisions'];

        viewOptions.forEach(option => {
            const stateKey = `view.${option}`;
            const currentValue = this.editor.stateManager.get(stateKey);
            savedStates[option] = currentValue !== undefined ? currentValue : false;
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

            // Apply the view option
            this.applyViewOption(option, enabled);

            // Update menu checkbox state
            this.updateViewCheckbox(option, enabled);
        });

    }

    toggleGameMode(enabled) {
        const rightPanel = document.getElementById('right-panel');
        const assetsPanel = document.getElementById('assets-panel');
        const consolePanel = document.getElementById('console-panel');
        
        if (enabled) {
            // Hide editor panels
            rightPanel?.classList.add('hidden');
            assetsPanel?.classList.add('hidden');
            consolePanel?.classList.add('hidden');
        } else {
            // Show editor panels
            rightPanel?.classList.remove('hidden');
            assetsPanel?.classList.remove('hidden');
            // Console visibility depends on user preference
            const consoleVisible = this.editor.stateManager.get('console.visible');
            if (consoleVisible) {
                consolePanel?.classList.remove('hidden');
            }
        }
        
        // Resize canvas after panel changes
        if (this.editor.canvasRenderer) {
            this.editor.canvasRenderer.resizeCanvas();
            this.editor.render();
        }
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
