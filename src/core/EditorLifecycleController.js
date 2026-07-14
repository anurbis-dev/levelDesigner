import { BaseModule } from './BaseModule.js';
import { CanvasRenderer } from '../ui/CanvasRenderer.js';
import { CanvasContextMenu } from '../ui/CanvasContextMenu.js';
import { AssetPanel } from '../ui/AssetPanel.js';
import { DetailsPanel } from '../ui/DetailsPanel.js';
import { OutlinerPanel } from '../ui/OutlinerPanel.js';
import { LayersPanel } from '../ui/LayersPanel.js';
import { LevelsPanel } from '../ui/LevelsPanel.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { Toolbar } from '../ui/Toolbar.js';
import { StatusBar } from '../ui/StatusBar.js';
import { ActorPropertiesWindow } from '../ui/ActorPropertiesWindow.js';
import { MenuManager } from '../managers/MenuManager.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { searchManager } from '../utils/SearchManager.js';
import { Logger } from '../utils/Logger.js';

/**
 * Editor startup/shutdown-lifecycle: DOM/renderer/UI-component bootstrap, panel-size
 * and auto-save listeners, first-visit splash. Extracted from LevelEditor.js —
 * Фаза 3.3 рефакторинга (tmp/2D_Editor_REFACTOR_PLAN.md).
 */
export class EditorLifecycleController extends BaseModule {
    /**
     * Get and validate required DOM elements
     * @returns {Object} DOM elements
     */
    initializeDOMElements() {
        const canvas = document.getElementById('main-canvas');
        const assetsPanel = document.getElementById('assets-panel');
        const detailsPanel = document.getElementById('details-content-panel');
        const outlinerPanel = document.getElementById('outliner-content-panel');
        const layersPanel = document.getElementById('layers-content-panel');
        const levelsPanel = document.getElementById('levels-content-panel');
        const toolbarContainer = document.getElementById('toolbar-container');
        const actorPropsPanelContainer = document.getElementById('actor-properties-panel');

        if (!canvas || !assetsPanel || !detailsPanel || !outlinerPanel || !layersPanel || !levelsPanel || !toolbarContainer) {
            throw new Error('Required DOM elements not found');
        }

        return {
            canvas,
            assetsPanel,
            detailsPanel,
            outlinerPanel,
            layersPanel,
            levelsPanel,
            toolbarContainer,
            actorPropsPanelContainer
        };
    }

    /**
     * Initialize canvas renderer and context menu
     * @param {HTMLCanvasElement} canvas - Canvas element
     */
    initializeRenderer(canvas) {
        const editor = this.editor;

        // Initialize renderer
        editor.canvasRenderer = new CanvasRenderer(canvas);
        editor.canvasRenderer.stateManager = editor.stateManager; // Store reference for state updates
        editor.canvasRenderer.resizeCanvas();
        editor.lifecycle.register('canvasRenderer', editor.canvasRenderer, { priority: 1 });

        // Register CanvasRenderer in StateManager for AssetManager sync
        editor.stateManager.set('canvasRenderer', editor.canvasRenderer);

        // Initialize canvas context menu
        editor.canvasContextMenu = new CanvasContextMenu(canvas, editor, {
            onDuplicate: (objects) => editor.duplicateSelectedObjects(),
            onDelete: (objects) => editor.deleteSelectedObjects(),
            onCopy: () => editor.copySelectedObjects(),
            onPaste: () => editor.pasteObjects(),
            onCut: () => editor.cutSelectedObjects(),
            onGroup: () => editor.groupSelectedObjects(),
            onUngroup: () => editor.ungroupSelectedObjects(),
            onZoomIn: () => editor.zoomIn(),
            onZoomOut: () => editor.zoomOut(),
            onZoomFit: () => editor.zoomToFit(),
            onResetView: () => editor.resetView()
        });

        // Register canvas context menu with the manager
        editor.contextMenuManager.registerMenu('canvas', editor.canvasContextMenu);
    }

    /**
     * Initialize UI components (panels, toolbar, etc.)
     * @param {Object} domElements - DOM elements
     */
    initializeUIComponents(domElements) {
        const { assetsPanel, detailsPanel, outlinerPanel, layersPanel, levelsPanel, toolbarContainer } = domElements;
        const editor = this.editor;

        // Initialize UI panels
        editor.assetPanel = new AssetPanel(assetsPanel, editor.assetManager, editor.stateManager, editor);
        editor.detailsPanel = new DetailsPanel(detailsPanel, editor.stateManager, editor);
        editor.outlinerPanel = new OutlinerPanel(outlinerPanel, editor.stateManager, editor);
        editor.levelsPanel = new LevelsPanel(levelsPanel, editor.stateManager, editor);
        editor.layersPanel = new LayersPanel(layersPanel, editor.stateManager, editor);
        editor.settingsPanel = new SettingsPanel(document.body, editor.configManager, editor);

        // Initialize Asset Properties Window
        editor.actorPropertiesWindow = new ActorPropertiesWindow(editor.stateManager, editor);

        // Register all UI components in lifecycle manager
        editor.lifecycle.register('assetPanel', editor.assetPanel, { priority: 3 });
        editor.lifecycle.register('detailsPanel', editor.detailsPanel, { priority: 3 });
        editor.lifecycle.register('outlinerPanel', editor.outlinerPanel, { priority: 3 });
        editor.lifecycle.register('levelsPanel', editor.levelsPanel, { priority: 3 });
        editor.lifecycle.register('layersPanel', editor.layersPanel, { priority: 3 });
        editor.lifecycle.register('settingsPanel', editor.settingsPanel, { priority: 2 });
        editor.lifecycle.register('actorPropertiesWindow', editor.actorPropertiesWindow, { priority: 2 });

        // Initial render of asset panel
        editor.assetPanel.render();

        // Context menus for asset panel tabs will be setup by EventHandlers after panels are created

        // Create new level
        editor.level = editor.fileManager.createNewLevel();

        // Initialize toolbar after level is created
        editor.toolbar = new Toolbar(toolbarContainer, editor.stateManager, editor);
        editor.lifecycle.register('toolbar', editor.toolbar, { priority: 4 });

        // Initialize status bar
        const statusBarEl = document.getElementById('status-bar');
        if (statusBarEl) {
            editor.statusBar = new StatusBar(statusBarEl);
            Logger.setStatusCallback((msg, type) => {
                editor.statusBar?.show(msg, type);
            });
        }

        // Apply configuration to level settings
        editor.configController.applyConfigurationToLevel();
    }

    /**
     * Initialize EventHandlerManager
     */
    initializeEventHandlerManager() {
        try {
            eventHandlerManager.init();
            this.editor.log('info', 'EventHandlerManager initialized');
        } catch (error) {
            this.editor.log('error', 'Failed to initialize EventHandlerManager:', error.message);
            throw error;
        }
    }

    /**
     * Initialize menu manager and event listeners
     */
    initializeMenuAndEvents() {
        const editor = this.editor;

        // Initialize MenuManager
        const menuContainer = document.getElementById('menu-container');
        const navElement = menuContainer?.closest('nav');
        if (navElement) {
            editor.menuManager = new MenuManager(navElement, editor.eventHandlers);
            editor.menuManager.initialize();
            editor.lifecycle.register('menuManager', editor.menuManager, { priority: 5 });

            // Update EventHandlers with MenuManager reference
            editor.eventHandlers.menuManager = editor.menuManager;
        } else {
            Logger.ui.warn('Navigation element not found, menu functionality will be limited');
        }

        // Setup event listeners
        editor.eventHandlers.setupEventListeners();

        // Setup panel size listeners for StateManager changes
        this.setupPanelSizeListeners();
    }

    /**
     * Setup listeners for panel size changes from StateManager
     */
    setupPanelSizeListeners() {
        const editor = this.editor;

        // Listen for right panel width changes
        const rightPanelUnsubscribe = editor.stateManager.subscribe('panels.rightPanelWidth', (width) => {
            const rightPanel = document.getElementById('right-panel');
            if (rightPanel && width !== undefined) {
                if (width === 0) {
                    // Hide panel completely when collapsed
                    rightPanel.style.display = 'none';
                } else {
                    // Apply width and show panel
                    rightPanel.style.width = width + 'px';
                    rightPanel.style.flex = '0 0 auto';
                    rightPanel.style.display = 'flex';
                }

                // Update canvas and render
                editor.updateCanvas();
            }
        });
        editor.subscriptions.push(rightPanelUnsubscribe);

        // Listen for assets panel height changes
        const assetsPanelUnsubscribe = editor.stateManager.subscribe('panels.assetsPanelHeight', (height) => {
            const assetsPanel = document.getElementById('assets-panel');
            if (assetsPanel && height !== undefined) {
                if (height === 0) {
                    // Hide panel completely when collapsed
                    assetsPanel.style.display = 'none';
                } else {
                    // Apply height and show panel
                    assetsPanel.style.height = height + 'px';
                    assetsPanel.style.flexShrink = '0';
                    assetsPanel.style.display = 'flex';
                }

                // Update canvas and render
                editor.updateCanvas();
            }
        });
        editor.subscriptions.push(assetsPanelUnsubscribe);

        // Listen for tab position changes
        const tabPositionsUnsubscribe = editor.stateManager.subscribe('tabPositions', (tabPositions) => {
            if (tabPositions && editor.panelPositionManager && !editor.panelPositionManager._initializing) {
                Logger.ui.debug('Tab positions changed:', tabPositions);

                // Refresh search listeners when tabs move between panels
                searchManager.refreshAllSearches();

                // Update search controls for active tabs
                editor.initializeSearchControls();

                // Force search listener refresh after a short delay to ensure DOM is updated
                setTimeout(() => {
                    Logger.ui.debug('LevelEditor: Delayed search refresh after tab move');
                    searchManager.refreshAllSearches();
                }, 50);

                // Update canvas layout
                editor.updateCanvas();
            }
        });
        editor.subscriptions.push(tabPositionsUnsubscribe);

        // Listen for active tab changes and save to ConfigManager
        const rightPanelTabUnsubscribe = editor.stateManager.subscribe('rightPanelTab', (tabName) => {
            if (tabName && editor.configManager) {
                editor.configManager.set('editor.view.rightPanelTab', tabName);
            }
        });
        editor.subscriptions.push(rightPanelTabUnsubscribe);

        // Setup ResizeObserver for canvas-viewport to update canvas interactively
        const setupViewportObserver = (retryCount = 0) => {
            const viewport = document.getElementById('canvas-viewport');
            if (viewport && window.ResizeObserver) {
                editor.viewportResizeObserver = new ResizeObserver(() => {
                    editor.updateCanvas();
                });
                editor.viewportResizeObserver.observe(viewport);
            } else if (!viewport && retryCount < 10) {
                requestAnimationFrame(() => setupViewportObserver(retryCount + 1));
            }
        };
        setupViewportObserver();

        const leftPanelTabUnsubscribe = editor.stateManager.subscribe('leftPanelTab', (tabName) => {
            if (tabName && editor.configManager) {
                editor.configManager.set('editor.view.leftPanelTab', tabName);
            }
        });
        editor.subscriptions.push(leftPanelTabUnsubscribe);

        // Listen for panel visibility changes to update menu checkboxes
        const rightPanelVisibilityUnsubscribe = editor.stateManager.subscribe('view.rightPanel', (visible) => {
            if (editor.eventHandlers && editor.eventHandlers.updateViewCheckbox) {
                editor.eventHandlers.updateViewCheckbox('rightPanel', visible);
            }
        });
        editor.subscriptions.push(rightPanelVisibilityUnsubscribe);

        const leftPanelVisibilityUnsubscribe = editor.stateManager.subscribe('view.leftPanel', (visible) => {
            if (editor.eventHandlers && editor.eventHandlers.updateViewCheckbox) {
                editor.eventHandlers.updateViewCheckbox('leftPanel', visible);
            }
        });
        editor.subscriptions.push(leftPanelVisibilityUnsubscribe);
    }

    /**
     * Show the splash screen once, on the user's first visit to the editor.
     * Tracked via localStorage so it never shows again on subsequent loads/refreshes.
     */
    maybeShowSplashOnFirstVisit() {
        const key = 'levelEditor_hasSeenSplash';
        try {
            if (localStorage.getItem(key)) {
                return;
            }
            localStorage.setItem(key, 'true');
        } catch (error) {
            this.editor.log('warn', 'Failed to access localStorage for splash screen first-visit check:', error.message);
            return;
        }
        this.editor.showSplashScreen();
    }
}
