/**
 * TouchInitializationManager - Centralized touch support initialization
 * 
 * Manages all touch support registration in one place to avoid scattered initialization code
 */

import { Logger } from '../utils/Logger.js';

export class TouchInitializationManager {
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.touchSupportManager = levelEditor.touchSupportManager;
        this.stateManager = levelEditor.stateManager;
        this.userPrefs = levelEditor.userPrefs;
        
        // Track initialization status
        this.initialized = false;
        this.initializationQueue = [];
        
        Logger.ui.debug('TouchInitializationManager created');
    }

    /**
     * Initialize all touch support for the editor
     * Should be called after all UI elements are created
     */
    async initializeAllTouchSupport() {
        if (this.initialized) {
            Logger.ui.warn('TouchInitializationManager: Already initialized');
            return;
        }

        Logger.ui.debug('TouchInitializationManager: Starting touch support initialization...');

        try {
            // Import TouchSupportUtils once
            const { TouchSupportUtils } = await import('../utils/TouchSupportUtils.js');
            this.TouchSupportUtils = TouchSupportUtils;

            // Initialize touch support for different components
            await this.initializeCanvasTouchSupport();
            await this.initializeConsoleTouchSupport();
            await this.initializeAssetPanelTouchSupport();
            
            this.initialized = true;
            
            // Process any queued panel resizer initializations
            await this.processInitializationQueue();
            
            Logger.ui.debug('TouchInitializationManager: All touch support initialized successfully');
            
        } catch (error) {
            Logger.ui.error('TouchInitializationManager: Failed to initialize touch support:', error);
        }
    }

    /**
     * Initialize touch support for canvas
     */
    async initializeCanvasTouchSupport() {
        const canvas = document.getElementById('main-canvas');
        if (!canvas) {
            Logger.ui.warn('TouchInitializationManager: Canvas not found');
            return;
        }

        // Marquee selection (single finger tap + drag)
        this.TouchSupportUtils.addMarqueeTouchSupport(
            canvas,
            (element, touch, data) => {
                Logger.ui.debug('Touch marquee start:', data);
                this.levelEditor.startTouchMarquee(data.startX, data.startY);
            },
            (element, touch, data) => {
                Logger.ui.debug('Touch marquee move:', data);
                this.levelEditor.updateTouchMarquee(data.currentX, data.currentY);
            },
            (element, data) => {
                Logger.ui.debug('Touch marquee end:', data);
                this.levelEditor.endTouchMarquee(data.endX, data.endY);
            },
            this.touchSupportManager
        );

        // Combined two finger pan and zoom
        const panStartHandler = (element, data) => {
            this.levelEditor.startTouchPan(data.centerX, data.centerY);
        };
        
        const zoomStartHandler = (element, data) => {
            this.levelEditor.startTouchZoom(data.centerX, data.centerY);
        };
        this.TouchSupportUtils.addTwoFingerPanZoomSupport(
            canvas,
            // Pan handlers
            panStartHandler,
            (element, data) => {
                this.levelEditor.updateTouchPan(data.deltaX, data.deltaY);
            },
            (element, data) => {
                this.levelEditor.endTouchPan();
            },
            // Zoom handlers
            zoomStartHandler,
            (element, data) => {
                this.levelEditor.updateTouchZoom(data.scale, data.centerX, data.centerY);
            },
            (element, data) => {
                this.levelEditor.endTouchZoom();
            },
            this.touchSupportManager
        );

        // Two finger context menu
        this.TouchSupportUtils.addTwoFingerContextSupport(
            canvas,
            (element, data) => {
                Logger.ui.debug('Touch context menu:', data);
                this.levelEditor.showTouchContextMenu(data.centerX, data.centerY);
            },
            this.touchSupportManager
        );

        Logger.ui.debug('TouchInitializationManager: Canvas touch support initialized');
    }

    /**
     * Initialize touch support for console elements
     */
    async initializeConsoleTouchSupport() {
        const consolePanel = document.getElementById('console-panel');
        const resizeHandle = consolePanel?.querySelector('.console-resize-handle');
        const consoleHeader = document.getElementById('console-header');
        const consoleClose = document.getElementById('console-close');

        if (!consolePanel) {
            Logger.ui.warn('TouchInitializationManager: Console panel not found');
            return;
        }

        Logger.ui.debug('TouchInitializationManager: Initializing console touch support');

        // Console resizer
        if (resizeHandle) {
            const isMobile = this.TouchSupportUtils.isMobile() || window.innerWidth <= 768;
            const maxSize = isMobile ? window.innerHeight * 0.7 : window.innerHeight * 0.9;
            
            this.TouchSupportUtils.addResizeTouchSupport(
                resizeHandle,
                'vertical',
                200, // minSize
                maxSize, // maxSize - adaptive based on device
                (element, targetPanel, touch) => {
                    Logger.ui.debug('Console resize started via touch');
                },
                (element, targetPanel, newSize, touch) => {
                    // Apply new height with mobile-aware limits
                    const currentMaxSize = this.TouchSupportUtils.isMobile() || window.innerWidth <= 768 
                        ? window.innerHeight * 0.7 
                        : window.innerHeight * 0.9;
                    const clampedSize = Math.min(newSize, currentMaxSize);
                    consolePanel.style.height = clampedSize + 'px';
                    consolePanel.style.bottom = 'auto';
                },
                (element, targetPanel, currentSize) => {
                    // Save final height
                    if (this.userPrefs) {
                        this.userPrefs.set('consoleHeight', currentSize);
                    }
                    if (this.stateManager) {
                        this.stateManager.set('panels.consoleHeight', currentSize);
                    }
                    Logger.ui.debug(`Console resize ended: ${currentSize}px`);
                },
                (element, touch) => {
                    // Double tap to close console
                    if (this.levelEditor.eventHandlers) {
                        this.levelEditor.eventHandlers.togglePanel('console');
                    }
                    Logger.ui.info('Console closed via double-tap on resizer');
                },
                this.touchSupportManager
            );
        }

        // Console header and close button
        if (consoleHeader) {
            this.TouchSupportUtils.addButtonTouchSupport(
                consoleHeader,
                () => {
                    // Close console
                    if (this.levelEditor.eventHandlers) {
                        this.levelEditor.eventHandlers.togglePanel('console');
                    }
                },
                null, // no double tap
                null, // no long press
                this.touchSupportManager
            );
        }
        
        if (consoleClose) {
            this.TouchSupportUtils.addButtonTouchSupport(
                consoleClose,
                () => {
                    // Close console
                    if (this.levelEditor.eventHandlers) {
                        this.levelEditor.eventHandlers.togglePanel('console');
                    }
                },
                null, // no double tap
                null, // no long press
                this.touchSupportManager
            );
        }

        Logger.ui.debug('TouchInitializationManager: Console touch support initialized');
    }

    /**
     * Initialize touch support for asset panel
     */
    async initializeAssetPanelTouchSupport() {
        const assetPanel = this.levelEditor.assetPanel;
        if (!assetPanel || !assetPanel.previewsContainer) {
            Logger.ui.warn('TouchInitializationManager: Asset panel not found');
            return;
        }

        Logger.ui.debug('TouchInitializationManager: Initializing asset panel touch support');

        // Long press marquee selection for asset panel
        this.TouchSupportUtils.addLongPressMarqueeTouchSupport(
            assetPanel.previewsContainer,
            (element, touch, data) => {
                // Check if touch started on an asset element
                const elementAtPoint = document.elementFromPoint(data.startX, data.startY);
                if (elementAtPoint && (
                    elementAtPoint.closest('.asset-thumbnail') ||
                    elementAtPoint.closest('.asset-list-item') ||
                    elementAtPoint.closest('.asset-details-row') ||
                    elementAtPoint.closest('[data-asset-id]')
                )) {
                    // Touch started on asset, don't start marquee
                    return;
                }
                
                Logger.ui.debug('Asset panel marquee start:', data);
                assetPanel.startAssetMarquee(data.startX, data.startY);
            },
            (element, touch, data) => {
                Logger.ui.debug('Asset panel marquee move:', data);
                assetPanel.updateAssetMarquee(data.startX, data.startY, data.currentX, data.currentY);
            },
            (element, data) => {
                Logger.ui.debug('Asset panel marquee end:', data);
                assetPanel.endAssetMarquee(data.startX, data.startY, data.endX, data.endY);
            },
            this.touchSupportManager,
            500 // Long press delay
        );

        Logger.ui.debug('TouchInitializationManager: Asset panel touch support initialized');
    }

    /**
     * Register touch support for a panel resizer
     * Called by PanelPositionManager when creating resizers
     */
    async registerPanelResizerTouchSupport(resizer, panel, panelSide, direction) {
        if (!this.initialized) {
            // Queue for later initialization
            this.initializationQueue.push({ resizer, panel, panelSide, direction });
            return;
        }

        await this.initializePanelResizerTouchSupport(resizer, panel, panelSide, direction);
    }

    /**
     * Initialize touch support for a specific panel resizer
     */
    async initializePanelResizerTouchSupport(resizer, panel, panelSide, direction) {
        if (!this.TouchSupportUtils) {
            const { TouchSupportUtils } = await import('../utils/TouchSupportUtils.js');
            this.TouchSupportUtils = TouchSupportUtils;
        }

        const isVertical = direction === 'vertical';
        const minSize = isVertical ? 100 : 0;
        const maxSize = isVertical ? 600 : 800;
        
        this.TouchSupportUtils.addResizeTouchSupport(
            resizer,
            direction,
            minSize,
            maxSize,
            (element, targetPanel, touch) => {
                Logger.ui.debug(`${panelSide} panel resize started via touch`);
            },
            (element, targetPanel, newSize, touch) => {
                // Use unified resize logic
                this.levelEditor.panelPositionManager.handlePanelResize(panel, panelSide, direction, newSize);
            },
            (element, targetPanel, currentSize) => {
                // Save size to StateManager
                const stateKey = isVertical ? 'panels.assetsPanelHeight' : `panels.${panelSide}PanelWidth`;
                const prefKey = isVertical ? 'assetsPanelHeight' : `${panelSide}PanelWidth`;
                
                if (this.stateManager) {
                    this.stateManager.set(stateKey, currentSize);
                }
                if (this.userPrefs) {
                    this.userPrefs.set(prefKey, currentSize);
                }
                Logger.ui.debug(`Saved ${panelSide} panel ${isVertical ? 'height' : 'width'} from touch: ${currentSize}px`);
            },
            (element, touch) => {
                // Use universal double-click handler
                this.touchSupportManager.handlePanelDoubleClick(element, {
                    panel,
                    panelSide,
                    stateManager: this.stateManager,
                    userPrefs: this.userPrefs,
                    direction: direction,
                    stateKey: isVertical ? 'panels.assetsPanelHeight' : `panels.${panelSide}PanelWidth`,
                    prefKey: isVertical ? 'assetsPanelHeight' : `${panelSide}PanelWidth`,
                });
            },
            this.touchSupportManager
        );
        
        Logger.ui.debug(`TouchInitializationManager: Registered touch support for ${panelSide} panel resizer (${direction})`);
    }

    /**
     * Process queued initializations
     */
    async processInitializationQueue() {
        if (this.initializationQueue.length === 0) return;

        Logger.ui.debug(`TouchInitializationManager: Processing ${this.initializationQueue.length} queued initializations`);

        for (const item of this.initializationQueue) {
            await this.initializePanelResizerTouchSupport(item.resizer, item.panel, item.panelSide, item.direction);
        }

        this.initializationQueue = [];
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.initialized = false;
        this.initializationQueue = [];
        this.TouchSupportUtils = null;
        this.levelEditor = null;
        this.touchSupportManager = null;
        this.stateManager = null;
        this.userPrefs = null;
        
        Logger.ui.debug('TouchInitializationManager destroyed');
    }
}
