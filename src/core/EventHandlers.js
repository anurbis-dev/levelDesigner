import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

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
        window.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
            
            // Handle escape key to cancel all current actions
            if (e.key === 'Escape') {
                this.editor.cancelAllActions();
                return;
            }
            
            if (e.key === 'Delete' || e.key.toLowerCase() === 'x') {
                this.editor.objectOperations.deleteSelectedObjects();
            } else if (e.shiftKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                this.editor.objectOperations.duplicateSelectedObjects();
            } else if (e.key.toLowerCase() === 'f') {
                this.editor.focusOnSelection();
            } else if (e.key.toLowerCase() === 'a') {
                this.editor.focusOnAll();
            } else if (e.shiftKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                this.editor.groupOperations.groupSelectedObjects();
            } else if (e.altKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                this.editor.groupOperations.ungroupSelectedObjects();
            } else if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    e.shiftKey ? this.editor.redo() : this.editor.undo();
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    this.editor.redo();
                }
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
