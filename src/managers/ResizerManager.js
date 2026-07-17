/**
 * ResizerManager - Unified manager for all panel resizers
 * 
 * Handles mouse events for panel resizers:
 * - Horizontal resizers (left/right panels, folders)
 * - Vertical resizers (assets panel, console)
 * - Automatic device detection and event routing
 */

import { Logger } from '../utils/Logger.js';
import { BaseManager } from './BaseManager.js';

export class ResizerManager extends BaseManager {
    constructor(levelEditor) {
        super();
        this.levelEditor = levelEditor;
        this.stateManager = levelEditor?.stateManager;
        this.userPrefs = levelEditor?.userPrefs;
        
        // Track active resizers
        this.activeResizers = new Map(); // Map<element, resizerData>
        
        Logger.ui.debug('ResizerManager: Initialized');
    }

    /**
     * Register a resizer element
     * @param {HTMLElement} resizer - Resizer element
     * @param {HTMLElement} panel - Target panel element
     * @param {string} panelSide - Panel side ('left', 'right', 'assets', 'folders')
     * @param {string} direction - Resize direction ('horizontal', 'vertical')
     * @param {Function} onDoubleClick - Double click handler (optional)
     * @param {{ assetPanel?: object }} [options] - e.g. owning AssetPanel for multi-instance folders
     */
    registerResizer(resizer, panel, panelSide, direction, onDoubleClick = null, options = {}) {
        if (!resizer || !panel) {
            Logger.ui.warn('ResizerManager: Invalid resizer or panel element');
            return;
        }

        // Store resizer data
        const resizerData = {
            element: resizer,
            panel: panel,
            panelSide: panelSide,
            direction: direction,
            isActive: false,
            mouseHandlers: null,
            onDoubleClick: onDoubleClick,
            options: options || {}
        };
        
        this.activeResizers.set(resizer, resizerData);

        // Setup mouse events (always enabled)
        this.setupMouseEvents(resizer, panel, panelSide, direction);

        // Setup the small "tab" shown on a collapsed resizer to expand the panel back
        this.setupCollapseTab(resizer);

        Logger.ui.debug(`ResizerManager: Registered ${direction} resizer for ${panelSide} panel`);
    }

    /**
     * Create (once) the collapse/expand tab child element for a resizer.
     * The tab itself stays hidden via CSS until the resizer gets the
     * 'collapsed' class (see setCollapsed()). Its shape (narrow-tall vs
     * wide-short) is driven purely by CSS off the resizer's own class
     * (.resizer/.resizer-x vs .resizer-y), so orientation always matches
     * how that resizer is actually drawn.
     * @param {HTMLElement} resizer - Resizer element
     */
    setupCollapseTab(resizer) {
        let tab = resizer.querySelector(':scope > .panel-resizer-tab');
        if (!tab) {
            tab = document.createElement('div');
            tab.className = 'panel-resizer-tab';
            tab.title = 'Expand panel';
            resizer.appendChild(tab);
        }

        if (!tab._collapseHandlersAdded) {
            // Prevent the tab click from also starting a resize-drag on the parent resizer
            tab.addEventListener('mousedown', (e) => e.stopPropagation());
            tab.addEventListener('dblclick', (e) => e.stopPropagation());
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const resizerData = this.activeResizers.get(resizer);
                if (resizerData?.onDoubleClick) {
                    resizerData.onDoubleClick(e, resizer, resizerData.panel, resizerData.panelSide);
                }
            });
            tab._collapseHandlersAdded = true;
        }
    }

    /**
     * Mark a resizer as collapsed/expanded so its expand-tab shows/hides via CSS
     * @param {HTMLElement} resizer - Resizer element
     * @param {boolean} isCollapsed - true when the associated panel is collapsed
     */
    setCollapsed(resizer, isCollapsed) {
        if (!resizer) return;
        resizer.classList.toggle('collapsed', !!isCollapsed);
    }

    /**
     * Setup mouse event handlers for resizer
     */
    setupMouseEvents(resizer, panel, panelSide, direction) {
        const resizerData = this.activeResizers.get(resizer);
        if (!resizerData) return;

        let isResizing = false;
        let initialMouseX = 0;
        let initialMouseY = 0;
        let initialPanelSize = 0;

        // Mouse down handler
        const handleMouseDown = (e) => {
            isResizing = true;
            resizerData.isActive = true;
            
            // Store initial values
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            initialPanelSize = direction === 'horizontal' ? panel.offsetWidth : panel.offsetHeight;
            
            // Apply visual feedback
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
            resizer.classList.add('resizing');
            
            // Add global listeners for this resize operation
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
            e.stopPropagation();
        };

        // Mouse move handler
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            let newSize;
            if (direction === 'horizontal') {
                // Calculate new width based on mouse movement
                const deltaX = e.clientX - initialMouseX;
                // For right panel or folders on right, resize should work in opposite direction
                const isRightPanel = panelSide === 'right';
                const owner = resizerData.options?.assetPanel;
                const isFoldersOnRight = panelSide === 'folders' &&
                    (owner?.foldersPosition || this.levelEditor?.assetPanel?.foldersPosition) === 'right';
                // Folders: allow drag down to near-collapse; other panels keep min 100
                const minSize = panelSide === 'folders' ? 0 : 100;
                newSize = Math.max(minSize, Math.min(800, initialPanelSize + ((isRightPanel || isFoldersOnRight) ? -deltaX : deltaX)));
            } else {
                // Calculate new height based on mouse movement
                const deltaY = e.clientY - initialMouseY;
                // For assets panel (bottom panel), resize should work in opposite direction
                const isAssetsPanel = panelSide === 'assets';
                newSize = Math.max(100, Math.min(800, initialPanelSize + (isAssetsPanel ? -deltaY : deltaY)));
            }
            
            // Apply resize using unified logic
            this.handlePanelResize(panel, panelSide, direction, newSize, resizerData);
        };

        // Mouse up handler
        const handleMouseUp = () => {
            if (!isResizing) return;
            
            isResizing = false;
            resizerData.isActive = false;
            
            // Remove visual feedback
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizer.classList.remove('resizing');
            
            // Remove global listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Save final size
            const currentSize = direction === 'horizontal' ? panel.offsetWidth : panel.offsetHeight;
            this.savePanelSize(panelSide, direction, currentSize, resizerData);
            
            Logger.ui.debug(`ResizerManager: ${direction} resize completed for ${panelSide} panel: ${currentSize}px`);
        };

        // Double click handler
        const handleDoubleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (resizerData.onDoubleClick) {
                resizerData.onDoubleClick(e, resizer, panel, panelSide);
            }
        };

        // Store handlers for cleanup
        resizerData.mouseHandlers = {
            mousedown: handleMouseDown,
            mousemove: handleMouseMove,
            mouseup: handleMouseUp,
            dblclick: handleDoubleClick
        };

        // Add event listeners
        resizer.addEventListener('mousedown', handleMouseDown);
        resizer.addEventListener('dblclick', handleDoubleClick);
    }

    /**
     * Handle panel resize using unified logic
     * @param {HTMLElement} panel
     * @param {string} panelSide
     * @param {string} direction
     * @param {number} newSize
     * @param {object} [resizerData]
     */
    handlePanelResize(panel, panelSide, direction, newSize, resizerData = null) {
        if (direction === 'horizontal') {
            panel.style.width = newSize + 'px';
            panel.style.flexShrink = '0';
            panel.style.flexGrow = '0';
        } else {
            panel.style.height = newSize + 'px';
            panel.style.flexShrink = '0';
        }

        // Live visibility/collapse-tab for the owning AssetPanel (not always primary)
        if (panelSide === 'folders') {
            const assetPanel = resizerData?.options?.assetPanel || this.levelEditor?.assetPanel;
            assetPanel?.updateContentVisibility?.(newSize);
        }
    }

    /**
     * Save panel size to StateManager and user preferences
     * @param {string} panelSide
     * @param {string} direction
     * @param {number} size
     * @param {object} [resizerData]
     */
    savePanelSize(panelSide, direction, size, resizerData = null) {
        const sizeKey = direction === 'horizontal' ? 'Width' : 'Height';
        const stateKey = `panels.${panelSide}Panel${sizeKey}`;
        const prefKey = `${panelSide}Panel${sizeKey}`;
        
        // Special handling for folders panel (per AssetPanel instance)
        if (panelSide === 'folders') {
            const assetPanel = resizerData?.options?.assetPanel || this.levelEditor?.assetPanel;
            assetPanel?.updateContentVisibility?.(size);
            // Primary → global prefs; copy → D1 per-leaf (via foldersController)
            if (assetPanel?.foldersController?._persistFoldersWidth) {
                assetPanel.foldersController._persistFoldersWidth(size);
            } else if (assetPanel?.isPrimary) {
                if (this.stateManager) {
                    this.stateManager.set('panels.foldersWidth', size);
                }
                if (this.userPrefs) {
                    this.userPrefs.set('foldersWidth', size);
                }
            }
        } else {
            if (this.stateManager) {
                this.stateManager.set(stateKey, size);
            }
            if (this.userPrefs) {
                this.userPrefs.set(prefKey, size);
            }
        }
    }

    /**
     * Unregister a resizer element
     */
    unregisterResizer(resizer) {
        const resizerData = this.activeResizers.get(resizer);
        if (!resizerData) return;

        // Remove mouse event listeners
        if (resizerData.mouseHandlers) {
            resizer.removeEventListener('mousedown', resizerData.mouseHandlers.mousedown);
            resizer.removeEventListener('dblclick', resizerData.mouseHandlers.dblclick);
            document.removeEventListener('mousemove', resizerData.mouseHandlers.mousemove);
            document.removeEventListener('mouseup', resizerData.mouseHandlers.mouseup);
        }

        // Clean up global listeners flag
        if (resizer._globalListenersAdded) {
            delete resizer._globalListenersAdded;
        }

        this.activeResizers.delete(resizer);
        Logger.ui.debug(`ResizerManager: Unregistered resizer for ${resizerData.panelSide} panel`);
    }

    /**
     * Get resizer data for an element
     */
    getResizerData(resizer) {
        return this.activeResizers.get(resizer);
    }

    /**
     * Destroy the manager and clean up all resizers
     */
    destroy() {
        Logger.ui.debug('ResizerManager: Destroying...');
        
        // Unregister all resizers
        this.activeResizers.forEach((resizerData, resizer) => {
            this.unregisterResizer(resizer);
        });
        
        this.activeResizers.clear();
        Logger.ui.debug('ResizerManager: Destroyed');
    }
}
