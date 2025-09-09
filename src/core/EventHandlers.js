import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { MENU_CONFIG, getShortcutTarget } from '../../config/menu.js';

/**
 * Event Handlers module for LevelEditor
 * Handles all event listener setup and management
 */
export class EventHandlers extends BaseModule {
    constructor(levelEditor, menuManager = null) {
        console.log('[EVENTS] EventHandlers constructor called');
        console.log('[EVENTS] LevelEditor instance:', levelEditor ? 'provided' : 'null');
        console.log('[EVENTS] MenuManager instance:', menuManager ? 'provided' : 'null');

        super(levelEditor);
        this._rafId = null; // render loop id
        this.menuManager = menuManager;

        console.log('[EVENTS] EventHandlers initialized successfully');
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        console.log('[EVENTS] Setting up event listeners...');
        console.log('[EVENTS] Editor instance:', this.editor ? 'exists' : 'null');

        // Window resize
        window.addEventListener('resize', () => {
            console.log('[EVENTS] Window resize event');
            this.editor.canvasRenderer.resizeCanvas();
            this.editor.render();
        });

        // Canvas events
        console.log('[EVENTS] Setting up canvas events...');
        this.setupCanvasEvents();

        // Keyboard events
        console.log('[EVENTS] Setting up keyboard events...');
        this.setupKeyboardEvents();

        console.log('[EVENTS] Event listeners setup completed');

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

                // Log only when duplicate state changes
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
        
        // Prevent context menu
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        
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
        console.log('[HOTKEYS] Setting up keyboard events...');
        window.addEventListener('keydown', (e) => {
            // Allow input fields to work normally
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.contentEditable === 'true')) {
                console.log('[HOTKEYS] Ignoring - focus on input field:', document.activeElement.tagName);
                return;
            }

            console.log(`[HOTKEYS] Key event: "${e.key}" (code: ${e.code}), Ctrl: ${e.ctrlKey}, Shift: ${e.shiftKey}, Alt: ${e.altKey}, Meta: ${e.metaKey}`);

            // Handle escape key to cancel all current actions
            if (e.key === 'Escape') {
                console.log('[HOTKEYS] Escape pressed - preventing default and canceling actions');
                e.preventDefault();
                console.log('[HOTKEYS] Default prevented:', !e.defaultPrevented);
                this.editor.cancelAllActions();
                return;
            }
            
            if (e.key === 'Delete' || e.key.toLowerCase() === 'x') {
                console.log('[HOTKEYS] Delete pressed - deleting selected objects');
                e.preventDefault();
                console.log('[HOTKEYS] Delete - default prevented:', e.defaultPrevented);
                if (this.editor.objectOperations && typeof this.editor.objectOperations.deleteSelectedObjects === 'function') {
                    console.log('[HOTKEYS] Calling deleteSelectedObjects()');
                    this.editor.objectOperations.deleteSelectedObjects();
                } else {
                    console.error('[HOTKEYS] deleteSelectedObjects method not found!');
                }
            } else if (e.shiftKey && e.key.toLowerCase() === 'd') {
                console.log('[HOTKEYS] Shift+D pressed - duplicating objects');
                e.preventDefault();
                console.log('[HOTKEYS] Shift+D - default prevented:', e.defaultPrevented);
                if (this.editor.objectOperations && typeof this.editor.objectOperations.duplicateSelectedObjects === 'function') {
                    console.log('[HOTKEYS] Calling duplicateSelectedObjects()');
                    this.editor.objectOperations.duplicateSelectedObjects();
                } else {
                    console.error('[HOTKEYS] duplicateSelectedObjects method not found!');
                }
            } else if (e.key.toLowerCase() === 'f') {
                console.log('[HOTKEYS] F pressed - focus on selection');
                e.preventDefault();
                console.log('[HOTKEYS] F - default prevented:', e.defaultPrevented);
                if (typeof this.editor.focusOnSelection === 'function') {
                    console.log('[HOTKEYS] Calling focusOnSelection()');
                    this.editor.focusOnSelection();
                } else {
                    console.error('[HOTKEYS] focusOnSelection method not found!');
                }
            } else if (e.key.toLowerCase() === 'a') {
                console.log('[HOTKEYS] A pressed - focus on all');
                e.preventDefault();
                console.log('[HOTKEYS] A - default prevented:', e.defaultPrevented);
                if (typeof this.editor.focusOnAll === 'function') {
                    console.log('[HOTKEYS] Calling focusOnAll()');
                    this.editor.focusOnAll();
                } else {
                    console.error('[HOTKEYS] focusOnAll method not found!');
                }
            } else if (e.shiftKey && e.key.toLowerCase() === 'g') {
                console.log('[HOTKEYS] Shift+G pressed - grouping objects');
                e.preventDefault();
                console.log('[HOTKEYS] Shift+G - default prevented:', e.defaultPrevented);
                if (this.editor.groupOperations && typeof this.editor.groupOperations.groupSelectedObjects === 'function') {
                    console.log('[HOTKEYS] Calling groupSelectedObjects()');
                    this.editor.groupOperations.groupSelectedObjects();
                } else {
                    console.error('[HOTKEYS] groupSelectedObjects method not found!');
                }
            } else if (e.altKey && e.key.toLowerCase() === 'g') {
                console.log('[HOTKEYS] Alt+G pressed - ungrouping objects');
                e.preventDefault();
                console.log('[HOTKEYS] Alt+G - default prevented:', e.defaultPrevented);
                if (this.editor.groupOperations && typeof this.editor.groupOperations.ungroupSelectedObjects === 'function') {
                    console.log('[HOTKEYS] Calling ungroupSelectedObjects()');
                    this.editor.groupOperations.ungroupSelectedObjects();
                } else {
                    console.error('[HOTKEYS] ungroupSelectedObjects method not found!');
                }
            } else if (e.ctrlKey || e.metaKey) {
                console.log('[HOTKEYS] Ctrl combination detected');
                if (e.key.toLowerCase() === 'z') {
                    console.log('[HOTKEYS] Ctrl+Z pressed - undo');
                    e.preventDefault();
                    console.log('[HOTKEYS] Ctrl+Z - default prevented:', e.defaultPrevented);
                    if (e.shiftKey) {
                        if (typeof this.editor.redo === 'function') {
                            console.log('[HOTKEYS] Calling redo()');
                            this.editor.redo();
                        } else {
                            console.error('[HOTKEYS] redo method not found!');
                        }
                    } else {
                        if (typeof this.editor.undo === 'function') {
                            console.log('[HOTKEYS] Calling undo()');
                            this.editor.undo();
                        } else {
                            console.error('[HOTKEYS] undo method not found!');
                        }
                    }
                } else if (e.key.toLowerCase() === 'y') {
                    console.log('[HOTKEYS] Ctrl+Y pressed - redo');
                    e.preventDefault();
                    console.log('[HOTKEYS] Ctrl+Y - default prevented:', e.defaultPrevented);
                    if (typeof this.editor.redo === 'function') {
                        console.log('[HOTKEYS] Calling redo()');
                        this.editor.redo();
                    } else {
                        console.error('[HOTKEYS] redo method not found!');
                    }
                } else if (e.key.toLowerCase() === 'n') {
                    console.log('[HOTKEYS] Ctrl+N pressed - new level');
                    e.preventDefault();
                    console.log('[HOTKEYS] Ctrl+N - default prevented:', e.defaultPrevented);
                    if (typeof this.editor.newLevel === 'function') {
                        console.log('[HOTKEYS] Calling newLevel()');
                        this.editor.newLevel();
                    } else {
                        console.error('[HOTKEYS] newLevel method not found!');
                    }
                } else if (e.key.toLowerCase() === 'o') {
                    console.log('[HOTKEYS] Ctrl+O pressed - open level');
                    e.preventDefault();
                    console.log('[HOTKEYS] Ctrl+O - default prevented:', e.defaultPrevented);
                    if (typeof this.editor.openLevel === 'function') {
                        console.log('[HOTKEYS] Calling openLevel()');
                        this.editor.openLevel();
                    } else {
                        console.error('[HOTKEYS] openLevel method not found!');
                    }
                } else if (e.key.toLowerCase() === 's') {
                    console.log('[HOTKEYS] Ctrl+S pressed - save level');
                    e.preventDefault();
                    console.log('[HOTKEYS] Ctrl+S - default prevented:', e.defaultPrevented);
                    if (e.shiftKey) {
                        if (typeof this.editor.saveLevelAs === 'function') {
                            console.log('[HOTKEYS] Calling saveLevelAs()');
                            this.editor.saveLevelAs();
                        } else {
                            console.error('[HOTKEYS] saveLevelAs method not found!');
                        }
                    } else {
                        if (typeof this.editor.saveLevel === 'function') {
                            console.log('[HOTKEYS] Calling saveLevel()');
                            this.editor.saveLevel();
                        } else {
                            console.error('[HOTKEYS] saveLevel method not found!');
                        }
                    }
                } else {
                    console.log('[HOTKEYS] Unhandled Ctrl combination:', e.key.toLowerCase());
                }
            } else {
                console.log('[HOTKEYS] Unhandled key:', e.key.toLowerCase());
            }
        });
    }

    setupMenuEvents() {
        // Menu events are now handled by MenuManager
        // This method is kept for backward compatibility
        console.log('[VIEW MENU] Menu events handled by MenuManager');
    }

    initializeViewStates() {
        console.log('[VIEW MENU] Initializing view states...');
        
        // Initialize grid state from level settings
        const gridEnabled = this.editor.level?.settings?.showGrid ?? true;
        console.log('[VIEW MENU] Grid enabled from level settings:', gridEnabled);
        
        this.editor.stateManager.set('view.grid', gridEnabled);
        this.editor.stateManager.set('canvas.showGrid', gridEnabled);
        
        console.log('[VIEW MENU] After setting - view.grid:', this.editor.stateManager.get('view.grid'));
        console.log('[VIEW MENU] After setting - canvas.showGrid:', this.editor.stateManager.get('canvas.showGrid'));
        
        this.updateViewCheckbox('grid', gridEnabled);
        
        // Initialize snap to grid state from level settings
        const snapToGridEnabled = this.editor.level?.settings?.snapToGrid ?? false;
        this.editor.stateManager.set('view.snapToGrid', snapToGridEnabled);
        this.editor.stateManager.set('canvas.snapToGrid', snapToGridEnabled);
        this.updateViewCheckbox('snapToGrid', snapToGridEnabled);
        
        // Initialize other view states (default to false)
        const viewStates = ['gameMode', 'objectBoundaries', 'objectCollisions'];
        viewStates.forEach(state => {
            const enabled = this.editor.stateManager.get(`view.${state}`) || false;
            this.editor.stateManager.set(`view.${state}`, enabled);
            this.updateViewCheckbox(state, enabled);
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
            console.log(`[VIEW MENU] Updating checkbox ${checkId}, enabled: ${enabled}, element found: ${!!checkElement}`);
            if (checkElement) {
                checkElement.classList.toggle('hidden', !enabled);
            }
        }
    }

    toggleViewOption(option) {
        console.log(`[VIEW MENU] Toggling ${option}`);
        
        // Debug: Check all related states
        console.log(`[VIEW MENU] All view states:`, {
            'view.grid': this.editor.stateManager.get('view.grid'),
            'canvas.showGrid': this.editor.stateManager.get('canvas.showGrid'),
            'view.snapToGrid': this.editor.stateManager.get('view.snapToGrid'),
            'canvas.snapToGrid': this.editor.stateManager.get('canvas.snapToGrid')
        });
        
        // Get current state from editor's state manager
        const currentState = this.editor.stateManager.get(`view.${option}`) || false;
        const newState = !currentState;
        
        console.log(`[VIEW MENU] Current state: ${currentState}, New state: ${newState}`);
        console.log(`[VIEW MENU] State manager state for view.${option}:`, this.editor.stateManager.get(`view.${option}`));
        
        // Update state
        this.editor.stateManager.set(`view.${option}`, newState);
        
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
        }
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
            Logger.event.debug('Camera changed, calling render');
            this.editor.render();
        });
    }
}
