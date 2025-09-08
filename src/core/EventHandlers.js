import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

/**
 * Event Handlers module for LevelEditor
 * Handles all event listener setup and management
 */
export class EventHandlers extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        this._rafId = null; // render loop id
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
        // Level menu
        document.getElementById('new-level')?.addEventListener('click', () => this.editor.newLevel());
        document.getElementById('open-level')?.addEventListener('click', () => this.editor.openLevel());
        document.getElementById('save-level')?.addEventListener('click', () => this.editor.saveLevel());
        document.getElementById('save-level-as')?.addEventListener('click', () => this.editor.saveLevelAs());
        
        // Settings menu
        document.getElementById('assets-path')?.addEventListener('click', () => this.editor.openAssetsPath());
        document.getElementById('editor-settings')?.addEventListener('click', () => this.editor.openSettings());
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
