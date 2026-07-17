import { BaseModule } from '../core/BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { SearchSectionUtils } from '../utils/SearchSectionUtils.js';
import { ScrollUtils } from '../utils/ScrollUtils.js';
import { eventHandlerManager } from './EventHandlerManager.js';
import { globalEventRegistry } from './GlobalEventRegistry.js';
import { ResetRegistry } from '../utils/ResetRegistry.js';

/** Dock leaf contentTypes (View → Panels, B3.1). */
const DOCK_CONTENT_PANELS = Object.freeze([
    'viewport', 'outliner', 'details', 'layers', 'assets', 'levels'
]);

/** Legacy L/R/assets menu keys → dock contentType when dock is active. */
const LEGACY_PANEL_TO_DOCK = Object.freeze({
    leftPanel: 'outliner',
    rightPanel: 'details',
    assetsPanel: 'assets'
});

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

    _dockInited() {
        return !!(this.editor.dockManager && this.editor.dockManager._inited);
    }

    /** Map legacy left/right/assetsPanel names to dock contentType when dock owns layout. */
    _resolvePanelName(panel) {
        if (!this._dockInited()) return panel;
        return LEGACY_PANEL_TO_DOCK[panel] || panel;
    }

    _isDockContentPanel(panel) {
        return DOCK_CONTENT_PANELS.includes(panel);
    }

    /**
     * Sync View → dock contentType checkmarks from tree presence (not legacy view.leftPanel flags).
     */
    syncDockPanelMenuCheckboxes() {
        if (!this._dockInited()) return;
        const dm = this.editor.dockManager;
        for (const type of DOCK_CONTENT_PANELS) {
            const present = dm.hasContentType(type);
            this.editor.stateManager.set(`view.${type}`, present);
            this.updateViewCheckbox(type, present);
        }
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

        // Play-in-editor is running (src/core/PlayOperations.js) — editor shortcuts
        // (undo/redo, delete, tools) must not fire underneath it. Escape is the one
        // exception, so the user always has a way out without reaching for the mouse.
        if (this.editor.stateManager.get('playMode')) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.editor.playOperations?.stop();
            }
            return;
        }

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
            // AE-F: over Asset Preview / Asset Editor → frame selected component
            const assetPreview = this._assetPreviewForHotkey();
            if (assetPreview && typeof assetPreview.fitToSelection === 'function') {
                assetPreview.fitToSelection();
            } else {
                // OL-F: over Outliner → scroll list to selection; otherwise VP-HK frame on viewport
                const outlinerPanel = this._outlinerPanelUnderCursor();
                if (outlinerPanel && typeof outlinerPanel.scrollToSelection === 'function') {
                    outlinerPanel.scrollToSelection();
                } else {
                    const targetView = this._hotkeyTargetView();
                    if (typeof this.editor.focusOnSelection === 'function') this.editor.focusOnSelection(targetView);
                }
            }
        } else if (this._matchesShortcut(e, 'editor', 'focusAll')) {
            e.preventDefault();
            // AE-A: over Asset Preview / Asset Editor → frame whole asset
            const assetPreview = this._assetPreviewForHotkey();
            if (assetPreview && typeof assetPreview.fitToAsset === 'function') {
                assetPreview.fitToAsset();
            } else {
                const targetView = this._hotkeyTargetView();
                if (typeof this.editor.focusOnAll === 'function') this.editor.focusOnAll(targetView);
            }
        } else if (this._matchesShortcut(e, 'editor', 'jumpToCamera')) {
            e.preventDefault();
            const targetView = this._hotkeyTargetView();
            if (typeof this.editor.jumpToCamera === 'function') this.editor.jumpToCamera(targetView);
        } else if (this._matchesShortcut(e, 'editor', 'cycleNextCamera')) {
            e.preventDefault();
            const targetView = this._hotkeyTargetView();
            if (typeof this.editor.cycleNextCamera === 'function') this.editor.cycleNextCamera(targetView);
        } else if (this._matchesShortcut(e, 'editor', 'cyclePrevCamera')) {
            e.preventDefault();
            const targetView = this._hotkeyTargetView();
            if (typeof this.editor.cyclePrevCamera === 'function') this.editor.cyclePrevCamera(targetView);
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
            this.toggleViewOptionScoped('parallax');
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
            if (this.editor.objectOperations) {
                let stackAction;
                if (this._matchesShortcut(e, 'editor', 'bringToFront'))      stackAction = 'bringToFront';
                else if (this._matchesShortcut(e, 'editor', 'sendToBack'))   stackAction = 'sendToBack';
                else if (this._matchesShortcut(e, 'editor', 'bringForward')) stackAction = 'moveForward';
                else                                                           stackAction = 'moveBackward';
                this.editor.objectOperations.applyStackOrderActionToSelection(stackAction);
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
            this.toggleViewOptionScoped('objectBoundaries');
        } else if (this._matchesShortcut(e, 'editor', 'toggleObjectCollisions')) {
            e.preventDefault();
            this.toggleViewOptionScoped('objectCollisions');
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
     * F2: panel under cursor decides target.
     * - Over Assets → rename selected library asset (AS-F2 / AS-REN inline)
     * - Otherwise → single selected level object via Outliner.startInlineRename
     */
    renameSelectedObject() {
        const assetsPanel = this._assetsPanelUnderCursor();
        if (assetsPanel) {
            this._renameSelectedAssetInPanel(assetsPanel);
            return;
        }

        const selectedIds = this.editor.stateManager.get('selectedObjects');
        if (!selectedIds || selectedIds.size !== 1) return;

        const obj = this.editor.level.findObjectById(Array.from(selectedIds)[0]);
        if (!obj) return;

        // Ensure Outliner leaf is present (dock); then start inline rename on primary instance
        if (this._dockInited()) {
            this.editor.dockManager.showContentType('outliner');
        }
        if (this.editor.outlinerPanel && typeof this.editor.outlinerPanel.startInlineRename === 'function') {
            this.editor.outlinerPanel.startInlineRename(obj);
        }
    }

    /**
     * AssetPanel instance under cursor (primary or dock copy), or null.
     * Uses CSS :hover so we do not need last-known client coords for F2.
     * @returns {import('../ui/AssetPanel.js').AssetPanel|null}
     */
    _assetsPanelUnderCursor() {
        const reg = this.editor.dockManager?.registry || this.editor.dockManager?.contentRegistry;
        if (reg?._byLeafId) {
            for (const bind of reg._byLeafId.values()) {
                if (bind.contentType !== 'assets' || !bind.panel || !bind.root) continue;
                if (bind.root.matches(':hover')) return bind.panel;
            }
        }
        const primaryRoot = document.getElementById('assets-panel');
        if (primaryRoot?.matches(':hover') && this.editor.assetPanel) {
            return this.editor.assetPanel;
        }
        return null;
    }

    /**
     * OutlinerPanel under cursor (primary or dock copy), or null.
     * Same :hover probe as Assets (OL-F / F2-style panel routing).
     * @returns {import('../ui/OutlinerPanel.js').OutlinerPanel|null}
     */
    _outlinerPanelUnderCursor() {
        const reg = this.editor.dockManager?.registry || this.editor.dockManager?.contentRegistry;
        if (reg?._byLeafId) {
            for (const bind of reg._byLeafId.values()) {
                if (bind.contentType !== 'outliner' || !bind.panel || !bind.root) continue;
                if (bind.root.matches(':hover')) return bind.panel;
            }
        }
        const primaryRoot = document.getElementById('outliner-content-panel');
        if (primaryRoot?.matches(':hover') && this.editor.outlinerPanel) {
            return this.editor.outlinerPanel;
        }
        return null;
    }

    /**
     * AssetPreviewPanel for F/A: under cursor, or any preview if Asset Editor float is hovered.
     * @returns {import('../ui/asset-editor/AssetPreviewPanel.js').AssetPreviewPanel|null}
     */
    _assetPreviewForHotkey() {
        const reg = this.editor.dockManager?.registry || this.editor.dockManager?.contentRegistry;
        if (!reg?._byLeafId) return null;
        let hoveredPreview = null;
        let anyPreview = null;
        let editorHovered = false;
        for (const bind of reg._byLeafId.values()) {
            if (bind.contentType === 'assetPreview' && bind.panel) {
                anyPreview = anyPreview || bind.panel;
                if (bind.root?.matches?.(':hover') || bind.panel.host?.matches?.(':hover')
                    || bind.panel.canvas?.matches?.(':hover')) {
                    hoveredPreview = bind.panel;
                }
            }
            // Any asset-editor leaf under cursor → route F/A to preview
            if (bind.contentType?.startsWith?.('asset') && bind.root?.matches?.(':hover')) {
                editorHovered = true;
            }
        }
        if (hoveredPreview) return hoveredPreview;
        if (editorHovered && anyPreview) return anyPreview;
        // Float chrome (title bar) may not be a content leaf
        const float = document.querySelector('.floating-window[data-role="assetEditor"]:hover');
        if (float && anyPreview) return anyPreview;
        return null;
    }

    /**
     * F2 over Assets: rename the single selected library asset in that panel instance.
     * @param {import('../ui/AssetPanel.js').AssetPanel} assetsPanel
     */
    _renameSelectedAssetInPanel(assetsPanel) {
        const key = typeof assetsPanel.uiStateKey === 'function'
            ? assetsPanel.uiStateKey('selectedAssets')
            : 'selectedAssets';
        const raw = this.editor.stateManager.get(key);
        const selected = raw instanceof Set ? raw : new Set(Array.isArray(raw) ? raw : []);
        if (selected.size !== 1) return;

        const assetId = Array.from(selected)[0];
        const asset = this.editor.assetManager?.getAsset?.(assetId)
            || this.editor.assetManager?.assets?.get?.(assetId);
        if (!asset) return;

        const ctrl = assetsPanel.itemActionsController;
        if (ctrl && typeof ctrl.startInlineRename === 'function') {
            ctrl.startInlineRename(asset);
        }
    }

    /**
     * Handle key up events
     * @param {KeyboardEvent} e - The keyboard event
     */
    handleKeyUp(e) {
        // Play-in-editor running — see matching guard in handleKeyDown.
        if (this.editor.stateManager.get('playMode')) return;

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
        
        // Initialize non-dock panel states from user preferences
        const panelStates = this._dockInited()
            ? ['toolbar', 'console', 'statusBar']
            : ['toolbar', 'assetsPanel', 'console', 'statusBar'];
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

        // Dock contentType presence is tree-driven (B3.1 / B5)
        if (this._dockInited()) {
            this.syncDockPanelMenuCheckboxes();
        }

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

        // Dock owns layout — primary panels already mounted; register search controls
        if (this.editor.initializeSearchControls) {
            this.editor.initializeSearchControls();
        }
    }

    /** Map view option / panel name → menu item id (toggle-*). */
    _viewCheckboxItemId(option) {
        switch (option) {
            case 'toolbar': return 'toggle-toolbar';
            case 'assetsPanel': return 'toggle-assets-panel'; // legacy
            case 'assets': return 'toggle-assets';
            case 'rightPanel': return 'toggle-right-panel'; // legacy
            case 'leftPanel': return 'toggle-left-panel'; // legacy
            case 'console': return 'toggle-console';
            case 'statusBar': return 'toggle-status-bar';
            case 'viewport': return 'toggle-viewport';
            case 'outliner': return 'toggle-outliner';
            case 'details': return 'toggle-details';
            case 'layers': return 'toggle-layers';
            case 'levels': return 'toggle-levels';
            default:
                return `toggle-${option.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        }
    }

    updateViewCheckbox(option, enabled) {
        const itemId = this._viewCheckboxItemId(option);
        if (this.menuManager) {
            this.menuManager.updateToggleState(itemId, enabled);
        } else {
            const checkElement = document.getElementById(`${itemId}-check`);
            if (checkElement) {
                if (enabled) {
                    checkElement.classList.remove('hidden');
                } else {
                    checkElement.classList.add('hidden');
                }
            }
        }
    }

    /**
     * Display flags that are per-viewport (VP-EQ) — menu routes through scoped path.
     * @param {string} option
     * @returns {boolean}
     */
    _isViewportDisplayOption(option) {
        return option === 'grid'
            || option === 'objectBoundaries'
            || option === 'objectCollisions'
            || option === 'parallax';
    }

    toggleViewOption(option) {
        // Main View menu: Grid/Boundaries/Collisions/Parallax → all viewport copies.
        // Hotkeys / eye / toolbar stay per-view (toggleViewOptionScoped).
        if (this._isViewportDisplayOption(option)) {
            this.toggleViewOptionAllViews(option);
            return;
        }

        let currentState, newState, stateKey, configKey;
        
        if (option === 'snapToGrid') {
            // Snap to grid uses canvas.snapToGrid as primary storage (editor-global)
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
     * Target viewport for view-scoped UI (VP-HK / VP-EQ).
     * Under cursor → focused → any peer.
     * @returns {object|null}
     */
    _hotkeyTargetView() {
        const vvm = this.editor.viewportViewManager;
        if (!vvm?.views?.size) return null;
        return vvm.getViewUnderCursor()
            || vvm.getFocusedView()
            || vvm.getAnyView?.()
            || null;
    }

    /**
     * Toggle a view-display option on one viewport only (VP-EQ peers).
     * Falls back to global state only when multi-view is unavailable.
     * @param {'grid'|'objectBoundaries'|'objectCollisions'|'parallax'} option
     */
    toggleViewOptionScoped(option) {
        const vvm = this.editor.viewportViewManager;
        const view = this._hotkeyTargetView();
        if (vvm && view) {
            const next = vvm.toggleDisplayFlag(view, option);
            // Menu checkbox reflects the view that was toggled (not a "main" leaf)
            this.updateViewCheckbox(option, next);
            document.querySelectorAll('#menu-file > div, #menu-view > div, #menu-settings > div')
                .forEach(d => d.classList.add('hidden'));
            return;
        }
        // No multi-view registry yet — legacy single-canvas path
        this._toggleViewOptionGlobal(option);
    }

    /**
     * Main View menu: toggle display flag on every viewport leaf (same next value).
     * @param {'grid'|'objectBoundaries'|'objectCollisions'|'parallax'} option
     */
    toggleViewOptionAllViews(option) {
        const vvm = this.editor.viewportViewManager;
        if (!vvm?.views?.size) {
            this._toggleViewOptionGlobal(option);
            return;
        }
        const first = vvm.getFocusedView?.() || vvm.getAnyView?.() || [...vvm.views.values()][0];
        if (!first) {
            this._toggleViewOptionGlobal(option);
            return;
        }
        const next = !vvm.getDisplayFlag(first, option);
        vvm.setDisplayFlagAll(option, next);
        this.updateViewCheckbox(option, next);
        document.querySelectorAll('#menu-file > div, #menu-view > div, #menu-settings > div')
            .forEach(d => d.classList.add('hidden'));
    }

    /**
     * Legacy global toggle for display flags when VVM has no views.
     * @param {'grid'|'objectBoundaries'|'objectCollisions'|'parallax'} option
     */
    _toggleViewOptionGlobal(option) {
        let currentState, newState, stateKey, configKey;
        if (option === 'grid') {
            currentState = this.editor.stateManager.get('canvas.showGrid') || false;
            newState = !currentState;
            stateKey = 'canvas.showGrid';
            configKey = 'canvas.showGrid';
        } else {
            currentState = this.editor.stateManager.get(`view.${option}`) || false;
            newState = !currentState;
            stateKey = `view.${option}`;
            configKey = `editor.view.${option}`;
        }
        this.editor.stateManager.set(stateKey, newState);
        this.editor.configManager.set(configKey, newState);
        this.updateViewCheckbox(option, newState);
        this.applyViewOption(option, newState);
        document.querySelectorAll('#menu-file > div, #menu-view > div, #menu-settings > div')
            .forEach(d => d.classList.add('hidden'));
    }

    /**
     * Toggle grid visibility (hotkey G) — view under cursor when multi-viewport.
     */
    toggleGrid() {
        this.toggleViewOptionScoped('grid');
    }

    /**
     * Toggle panel visibility
     * @param {string} panel - Panel name (toolbar, dock contentType, or legacy left/right/assetsPanel)
     */
    togglePanel(panel) {
        const resolved = this._resolvePanelName(panel);

        // B3.1: dock contentTypes → showContentType / hideContentType (tree presence)
        if (this._dockInited() && this._isDockContentPanel(resolved)) {
            const newState = this.editor.dockManager.toggleContentType(resolved);
            this.editor.stateManager.set(`view.${resolved}`, newState);
            this.updateViewCheckbox(resolved, newState);
            document.querySelectorAll('#menu-file > div, #menu-view > div, #menu-settings > div').forEach(d => d.classList.add('hidden'));
            return;
        }

        const currentState = this.editor.stateManager.get(`view.${resolved}`) || false;
        const newState = !currentState;

        // Update state
        this.editor.stateManager.set(`view.${resolved}`, newState);

        // Save to user preferences (this will also update the shared ConfigManager)
        // Dock layout owns contentType presence — do not write legacy *Visible prefs for them
        if (!this._isDockContentPanel(resolved)) {
            if (this.editor.userPrefs) {
                const prefKey = resolved + 'Visible'; // toolbarVisible, consoleVisible, …
                this.editor.userPrefs.set(prefKey, newState);
            } else if (this.editor.configManager) {
                this.editor.configManager.set(`editor.view.${resolved}`, newState);
            }
        }

        // Update UI checkbox
        this.updateViewCheckbox(resolved, newState);

        // Apply the panel visibility
        this.applyPanelVisibility(resolved, newState);

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
        const resolved = this._resolvePanelName(panel);

        // B3.1: dock contentTypes — tree show/hide (not DOM display on legacy shells)
        if (this._dockInited() && this._isDockContentPanel(resolved)) {
            if (visible) this.editor.dockManager.showContentType(resolved);
            else this.editor.dockManager.hideContentType(resolved);
            if (this.editor.canvasRenderer) {
                this.editor.canvasRenderer.resizeCanvas();
                this.editor.render();
            }
            return;
        }

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

        const config = panelConfig[resolved];
        if (!config) return;

        switch (config.type) {
            case 'component':
                // Handle component-based panels (like toolbar)
                const component = config.component();
                if (component && typeof component[config.method] === 'function') {
                    component[config.method](visible);
                }
                // VP-TB: hide/show paired viewport toolbars with global toolbar
                if (resolved === 'toolbar' && this.editor.viewportToolbars?.size) {
                    for (const tb of this.editor.viewportToolbars.values()) {
                        try {
                            tb.setVisible?.(visible);
                        } catch (_e) { /* ignore */ }
                    }
                }
                break;

            case 'dom':
                // Handle DOM-based panels (console, legacy assets footer)
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
        const panelOptions = ['toolbar', 'console', 'statusBar', ...DOCK_CONTENT_PANELS];

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
            const panelOptions = ['toolbar', 'console', 'statusBar', ...DOCK_CONTENT_PANELS];
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
        const consolePanel = document.getElementById('console-panel');
        const toolbarContainer = document.getElementById('toolbar-container');
        const resizerConsole = document.getElementById('resizer-console');
        const dockActive = this._dockInited();
        
        if (enabled) {
            // Store current panel states for restoration
            this.savedPanelStates = {
                toolbar: this.editor.stateManager.get('view.toolbar') ?? true,
                console: this.editor.stateManager.get('console.visible')
                    ?? this.editor.stateManager.get('view.console')
                    ?? false,
                statusBar: this.editor.stateManager.get('view.statusBar') ?? true
            };
            
            // Reset panel toggle states in menu to show they're disabled in Game Mode
            this.resetPanelToggleStates();
            
            if (dockActive) {
                // Snapshot tree → viewport-only (canvas stays mounted); restore on exit
                this.editor.dockManager.enterImmersiveLayout();
                // Only viewport remains present in tree
                this.editor.stateManager.set('view.viewport', true);
                this.updateViewCheckbox('viewport', true);
            }

            consolePanel?.classList.add('hidden');
            toolbarContainer?.classList.add('hidden');
            resizerConsole?.classList.add('hidden');
            
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

        // Restore dock tree from immersive snapshot
        if (this._dockInited()) {
            this.editor.dockManager.exitImmersiveLayout();
            this.syncDockPanelMenuCheckboxes();
        }

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

        // Clear saved states
        this.savedPanelStates = null;
    }

    /**
     * Reset panel toggle states in menu when entering Game Mode
     */
    resetPanelToggleStates() {
        // Visual only for dock types — do not remove leaves from tree (immersive does that)
        for (const type of DOCK_CONTENT_PANELS) {
            this.editor.stateManager.set(`view.${type}`, false);
            this.updateViewCheckbox(type, false);
        }
        const extra = ['toolbar', 'console', 'statusBar'];
        extra.forEach((panel) => {
            this.editor.stateManager.set(`view.${panel}`, false);
            this.updateViewCheckbox(panel, false);
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

        // Dock checkboxes restored from tree in restorePanelStates
        this.editor.stateManager.set('console.visible', this.savedPanelStates.console);
        this.editor.stateManager.set('view.console', this.savedPanelStates.console);
        this.updateViewCheckbox('console', this.savedPanelStates.console);
        this.applyPanelVisibility('console', this.savedPanelStates.console);
        if (this.savedPanelStates.statusBar !== undefined) {
            this.editor.stateManager.set('view.statusBar', this.savedPanelStates.statusBar);
            this.updateViewCheckbox('statusBar', this.savedPanelStates.statusBar);
            this.applyPanelVisibility('statusBar', this.savedPanelStates.statusBar);
        }
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
     * Focus a dock contentType (legacy name: "activate tab").
     * @param {string} tabName - contentType / former tab name
     * @param {string} [_panelSide] - ignored (B5: no L/R tab shells)
     */
    setActivePanelTab(tabName, _panelSide = 'right') {
        if (this._dockInited() && this._isDockContentPanel(tabName)) {
            this.editor.dockManager.showContentType(tabName);
        }
        SearchSectionUtils.showSearchSectionForTab(tabName, this.editor);
    }

    /**
     * Ensure stable markers for panel tabs and their content containers.
     * This prevents cross-tab content confusion after tab moves.
     */
    ensurePanelTabMarkers() {
        // Canonical set of core panel tabs.
        const coreTabs = ['details', 'levels', 'layers', 'outliner'];
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

