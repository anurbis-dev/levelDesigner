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
        console.log('[CanvasContextMenu] Context menu event at:', e.clientX, e.clientY);

        // Check if user was panning (don't show menu after panning)
        const mouseState = this.levelEditor?.stateManager.get('mouse');
        console.log('[CanvasContextMenu] Mouse state at contextmenu:', mouseState);

        // Check distance from start position as additional verification
        let wasActuallyPanning = mouseState?.wasPanning;
        if (!wasActuallyPanning && mouseState?.rightClickStartX !== undefined && mouseState?.rightClickStartY !== undefined) {
            const distanceFromStart = Math.sqrt(
                Math.pow(e.clientX - mouseState.rightClickStartX, 2) +
                Math.pow(e.clientY - mouseState.rightClickStartY, 2)
            );
            console.log('[CanvasContextMenu] Distance from start:', distanceFromStart);
            if (distanceFromStart > 3) {
                console.log('[CanvasContextMenu] Detected panning by distance check:', distanceFromStart);
                console.log('[CanvasContextMenu] Start:', mouseState.rightClickStartX, mouseState.rightClickStartY);
                console.log('[CanvasContextMenu] Current:', e.clientX, e.clientY);
                wasActuallyPanning = true;
            }
        }

        if (wasActuallyPanning) {
            console.log('[CanvasContextMenu] Skipping menu - user was panning');
            console.log('[CanvasContextMenu] Mouse state:', {
                wasPanning: mouseState?.wasPanning,
                rightClickStartX: mouseState?.rightClickStartX,
                rightClickStartY: mouseState?.rightClickStartY,
                currentPos: { x: e.clientX, y: e.clientY }
            });
            // Don't reset here - let the scheduled cleanup in handleMouseUp do it
            return;
        }

        console.log('[CanvasContextMenu] Showing menu - no panning detected');
        console.log('[CanvasContextMenu] Mouse state:', {
            wasPanning: mouseState?.wasPanning,
            rightClickStartX: mouseState?.rightClickStartX,
            rightClickStartY: mouseState?.rightClickStartY,
            currentPos: { x: e.clientX, y: e.clientY }
        });

        // Extract context data from clicked element and event
        const contextData = this.extractContextData(e.target, e);

        // Use ContextMenuManager to show menu (it will close all others first)
        if (this.levelEditor && this.levelEditor.contextMenuManager) {
            this.levelEditor.contextMenuManager.showMenu('canvas', e, contextData);
        } else {
            // Fallback to direct show if manager not available
            console.warn('[CanvasContextMenu] ContextMenuManager not available, using fallback');
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

        // Add canvas-specific context data
        contextData.hasSelection = this.hasSelectedObjects();
        contextData.isGroup = this.isSelectedObjectGroup();
        contextData.clickPosition = this.getCanvasPosition(event);

        return contextData;
    }

    /**
     * Check if there are any selected objects
     * @returns {boolean} - Whether there are selected objects
     */
    hasSelectedObjects() {
        if (!this.levelEditor) return false;

        const selectedObjects = this.levelEditor.stateManager.get('selectedObjects');
        return selectedObjects && selectedObjects.size > 0;
    }

    /**
     * Check if the selected object is a group
     * @returns {boolean} - Whether selected object is a group
     */
    isSelectedObjectGroup() {
        if (!this.levelEditor) return false;

        const selectedObjects = this.levelEditor.stateManager.get('selectedObjects');
        if (!selectedObjects || selectedObjects.size !== 1) {
            return false;
        }

        // Get the single selected object
        const selectedId = Array.from(selectedObjects)[0];
        const object = this.levelEditor.level.findObjectById(selectedId);

        return object && object.type === 'group';
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
            visible: (context) => context.hasSelection
        });
        
        this.addMenuItem('Cut', '✂️', () => this.callbacks.onCut(), {
            visible: (context) => context.hasSelection
        });
        
        this.addMenuItem('Paste', '📌', () => this.callbacks.onPaste(), {
            visible: (context) => navigator.clipboard && window.isSecureContext
        });
        
        this.addMenuItem('Duplicate', '🔄', () => this.callbacks.onDuplicate(), {
            visible: (context) => context.hasSelection
        });
        
        this.addMenuItem('Delete', '🗑️', () => this.callbacks.onDelete(), {
            visible: (context) => context.hasSelection
        });
        
        // Group operations
        this.addMenuItem('Group', '📦', () => this.callbacks.onGroup(), {
            visible: (context) => context.hasSelection && !context.isGroup
        });

        this.addMenuItem('Ungroup', '📭', () => this.callbacks.onUngroup(), {
            visible: (context) => context.hasSelection && context.isGroup
        });

        this.addSeparatorWithClass('object-view-separator');

        // View operations
        this.addMenuItem('Zoom In', '🔍', () => this.callbacks.onZoomIn());
        this.addMenuItem('Zoom Out', '🔎', () => this.callbacks.onZoomOut());
        this.addMenuItem('Zoom to Fit', '🎯', () => this.callbacks.onZoomFit());
        this.addMenuItem('Reset View', '🔄', () => this.callbacks.onResetView());
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
