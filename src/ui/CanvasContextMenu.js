/**
 * CanvasContextMenu - Context menu handler for the main canvas
 * 
 * This module provides a context menu system for the main canvas panel
 * that allows users to interact with game objects and manage canvas settings.
 * 
 * Features:
 * - Right-click context menu on canvas
 * - Smart menu items based on context (object/empty space)
 * - Selection operations
 * - Object manipulation
 * - Canvas view controls
 * 
 * Usage:
 * ```javascript
 * const contextMenu = new CanvasContextMenu(canvasElement, {
 *     onDuplicate: (objects) => console.log('Duplicating:', objects),
 *     onDelete: (objects) => console.log('Deleting:', objects)
 * });
 * ```
 * 
 * @author Level Designer
 * @version dynamic
 */

import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';
import { CommandAvailability } from '../utils/CommandAvailability.js';

export class CanvasContextMenu extends BaseContextMenu {
    constructor(canvasElement, levelEditor, callbacks = {}) {
        super(canvasElement, {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            onDuplicate: callbacks.onDuplicate || (() => {}),
            onDelete: callbacks.onDelete || (() => {}),
            onCopy: callbacks.onCopy || (() => {}),
            onPaste: callbacks.onPaste || (() => {}),
            onCut: callbacks.onCut || (() => {}),
            onGroup: callbacks.onGroup || (() => {}),
            onUngroup: callbacks.onUngroup || (() => {}),
            onZoomIn: callbacks.onZoomIn || (() => {}),
            onZoomOut: callbacks.onZoomOut || (() => {}),
            onZoomFit: callbacks.onZoomFit || (() => {}),
            onResetView: callbacks.onResetView || (() => {})
        });

        this.levelEditor = levelEditor;
        this.setupMenuItems();
        Logger.ui.info('CanvasContextMenu initialized successfully');
    }

    /**
     * Override setupContextMenu to use ContextMenuManager
     */
    setupContextMenu() {
        // Add context menu to panel
        this.panel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Use requestAnimationFrame to allow mouse move events to be processed first
            requestAnimationFrame(() => {
                this.handleContextMenuEvent(e);
            });
        });
    }

    /**
     * Handle context menu event after mouse events are processed
     * @param {Event} e - The context menu event
     */
    handleContextMenuEvent(e) {

        // Check if user was panning (don't show menu after panning)
        const mouseState = this.levelEditor?.stateManager.get('mouse');

        // Check distance from start position as additional verification
        let wasActuallyPanning = mouseState?.wasPanning;
        if (!wasActuallyPanning && mouseState?.rightClickStartX !== undefined && mouseState?.rightClickStartY !== undefined) {
            const distanceFromStart = Math.sqrt(
                Math.pow(e.clientX - mouseState.rightClickStartX, 2) +
                Math.pow(e.clientY - mouseState.rightClickStartY, 2)
            );
            if (distanceFromStart > 3) {
                wasActuallyPanning = true;
            }
        }

        if (wasActuallyPanning) {
            // Don't reset here - let the scheduled cleanup in handleMouseUp do it
            return;
        }


        // Extract context data from clicked element and event
        const contextData = this.extractContextData(e.target, e);

        // Use ContextMenuManager to show menu (it will close all others first)
        if (this.levelEditor && this.levelEditor.contextMenuManager) {
            this.levelEditor.contextMenuManager.showMenu('canvas', e, contextData);
        } else {
            // Fallback to direct show if manager not available
            this.showContextMenu(e, contextData);
        }
    }

    /**
     * Override createContextMenu to add canvas-specific CSS class
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - The context menu element
     */
    createContextMenu(event, contextData) {
        const contextMenu = super.createContextMenu(event, contextData);
        contextMenu.classList.add('canvas-context');
        return contextMenu;
    }

    /**
     * Override createMenuItem to handle separators with custom classes
     * @param {Object} item - Menu item configuration
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - The menu item element
     */
    createMenuItem(item, contextData) {
        if (item.type === 'separator') {
            const separator = document.createElement('div');
            separator.className = 'base-context-menu-item separator';
            if (item.className) {
                separator.classList.add(item.className);
            }
            return separator;
        }

        return super.createMenuItem(item, contextData);
    }

    /**
     * Extract context data from clicked element and canvas state
     * @param {Element} target - The clicked element
     * @param {MouseEvent} event - The mouse event
     * @returns {Object} - Context data including selection info
     */
    extractContextData(target, event) {
        const contextData = super.extractContextData(target);

        // Add canvas-specific context data using CommandAvailability
        const availability = CommandAvailability.getContext(this.levelEditor);
        contextData.hasSelection = availability.hasSelection;
        contextData.hasMultipleSelection = availability.hasMultipleSelection;
        contextData.isGroup = availability.isGroup;
        contextData.clickPosition = this.getCanvasPosition(event);

        return contextData;
    }

    /**
     * Get canvas position from click event
     * @param {MouseEvent} event - The mouse event
     * @returns {Object} - Canvas position coordinates
     */
    getCanvasPosition(event) {
        if (!this.levelEditor || !this.levelEditor.canvasRenderer) return { x: 0, y: 0 };

        // Convert screen coordinates to world coordinates
        const camera = this.levelEditor.stateManager.get('camera');
        return this.levelEditor.canvasRenderer.screenToWorld(event.clientX, event.clientY, camera);
    }

    /**
     * Setup menu items based on context
     * Structure:
     * - Object operations (Copy, Cut, Paste, Duplicate, Delete, Group, Ungroup)
     * - Separator (visual division between object and view commands)
     * - View operations (Zoom In, Zoom Out, Zoom to Fit, Reset View)
     */
    setupMenuItems() {
        // Object operations (work with selected objects)
        this.addMenuItem('Copy', '📋', () => this.callbacks.onCopy(), {
            visible: (context) => CommandAvailability.check('copy', this.levelEditor)
        });

        this.addMenuItem('Cut', '✂️', () => this.callbacks.onCut(), {
            visible: (context) => CommandAvailability.check('cut', this.levelEditor)
        });

        this.addMenuItem('Paste', '📌', () => this.callbacks.onPaste(), {
            visible: (context) => CommandAvailability.check('paste', this.levelEditor)
        });

        this.addMenuItem('Duplicate', '🔄', () => this.callbacks.onDuplicate(), {
            visible: (context) => CommandAvailability.check('duplicate', this.levelEditor)
        });

        this.addMenuItem('Delete', '🗑️', () => this.callbacks.onDelete(), {
            visible: (context) => CommandAvailability.check('delete', this.levelEditor)
        });

        // Group operations
        this.addMenuItem('Group', '📦', () => this.callbacks.onGroup(), {
            visible: (context) => CommandAvailability.check('groupSelected', this.levelEditor)
        });

        this.addMenuItem('Ungroup', '📭', () => this.callbacks.onUngroup(), {
            visible: (context) => CommandAvailability.check('ungroupSelected', this.levelEditor)
        });

        this.addSeparatorWithClass('object-view-separator');

        // View operations
        this.addMenuItem('Zoom In', '🔍', (contextData) => {
            // Perform zoom in around cursor position without closing menu
            this.performZoomAroundCursor(1);
            // Don't close menu - return false to prevent default behavior
            return false;
        });
        this.addMenuItem('Zoom Out', '🔎', (contextData) => {
            // Perform zoom out around cursor position without closing menu
            this.performZoomAroundCursor(-1);
            // Don't close menu - return false to prevent default behavior
            return false;
        });
        this.addMenuItem('Zoom to Fit', '🎯', () => {
            // Use the same function as 'a' key - focusOnAll
            if (this.levelEditor && typeof this.levelEditor.focusOnAll === 'function') {
                this.levelEditor.focusOnAll();
            } else {
                // Fallback to zoomToFit if focusOnAll not available
                this.callbacks.onZoomFit();
            }
        });
        this.addMenuItem('Reset View', '🔄', () => this.callbacks.onResetView());
    }

    /**
     * Perform zoom around cursor position (like mouse wheel zoom)
     * @param {number} direction - 1 for zoom in, -1 for zoom out
     */
    performZoomAroundCursor(direction) {
        if (!this.levelEditor) return;

        const camera = this.levelEditor.stateManager.get('camera');
        const zoomIntensity = 0.1;

        const oldZoom = camera.zoom;
        const newZoom = Math.max(0.1, Math.min(10, oldZoom * (1 + direction * zoomIntensity)));

        // Use the cursor position from the last stored position
        const cursorX = this.lastCursorX || window.innerWidth / 2;
        const cursorY = this.lastCursorY || window.innerHeight / 2;

        // Calculate new camera position to keep cursor position fixed
        const mouseWorldPosBeforeZoom = this.levelEditor.canvasRenderer.screenToWorld(cursorX, cursorY, camera);

        // Create a temporary camera object for calculations
        const tempCamera = { ...camera, zoom: newZoom };
        const mouseWorldPosAfterZoom = this.levelEditor.canvasRenderer.screenToWorld(cursorX, cursorY, tempCamera);

        const newCameraX = camera.x + mouseWorldPosBeforeZoom.x - mouseWorldPosAfterZoom.x;
        const newCameraY = camera.y + mouseWorldPosBeforeZoom.y - mouseWorldPosAfterZoom.y;

        // Update camera in one operation
        this.levelEditor.stateManager.update({
            'camera.zoom': newZoom,
            'camera.x': newCameraX,
            'camera.y': newCameraY
        });

        // Render immediately for responsive zoom
        this.levelEditor.render();

    }

    /**
     * Add separator with custom class
     * @param {string} className - Additional CSS class for the separator
     */
    addSeparatorWithClass(className) {
        this.menuItems.push({
            type: 'separator',
            visible: true,
            className: className
        });
    }
}
