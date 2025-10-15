/**
 * LayersContextMenu - Context menu handler for layers
 * 
 * This module provides a context menu system for layers
 * that allows users to manage individual layers and perform bulk operations.
 * 
 * Features:
 * - Right-click context menu on layers
 * - Layer-specific operations (make current, rename, delete, etc.)
 * - Integration with BaseContextMenu architecture
 * 
 * Usage:
 * ```javascript
 * const contextMenu = new LayersContextMenu(layersPanel, {
 *     onMakeCurrent: (layer) => console.log('Making current:', layer),
 *     onDelete: (layer) => console.log('Deleting layer:', layer)
 * });
 * ```
 * 
 * @author Level Designer
 * @version dynamic
 */

import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';

export class LayersContextMenu extends BaseContextMenu {
    constructor(container, layersPanel, callbacks = {}) {
        super(container, {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            onMakeCurrent: callbacks.onMakeCurrent || (() => {}),
            onRename: callbacks.onRename || (() => {}),
            onDuplicate: callbacks.onDuplicate || (() => {}),
            onToggleVisibility: callbacks.onToggleVisibility || (() => {}),
            onToggleLock: callbacks.onToggleLock || (() => {}),
            onSelectAllObjects: callbacks.onSelectAllObjects || (() => {}),
            onDelete: callbacks.onDelete || (() => {}),
            onShowAll: callbacks.onShowAll || (() => {}),
            onHideAll: callbacks.onHideAll || (() => {}),
            onLockAll: callbacks.onLockAll || (() => {}),
            onUnlockAll: callbacks.onUnlockAll || (() => {})
        });

        this.layersPanel = layersPanel;
        this.setupMenuItems();
        Logger.ui.info('LayersContextMenu initialized successfully');
    }

    /**
     * Override extractContextData to extract layer information
     * @param {Element} target - The clicked element
     * @returns {Object} - Context data including layer info
     */
    extractContextData(target) {
        const contextData = super.extractContextData(target);
        
        // Find the layer element (try both selectors for compatibility)
        const layerElement = target.closest('.layer-item') || target.closest('[data-layer-id]');
        if (layerElement) {
            const layerId = layerElement.dataset.layerId;
            const level = this.layersPanel.levelEditor.getLevel();
            const layer = level.getLayerById(layerId);
            
            contextData.layer = layer;
            contextData.layerId = layerId;
            contextData.layerElement = layerElement;
            contextData.isLayer = true;
            
            // Check if it's main layer
            const mainLayerId = level.getMainLayerId();
            contextData.isMainLayer = layerId === mainLayerId;
            contextData.isCurrent = layerId === this.layersPanel.currentLayerId;
        } else {
            contextData.isLayer = false;
        }
        
        return contextData;
    }

    /**
     * Override shouldShowMenuItem to only show menu on layers
     * @param {Object} item - Menu item
     * @param {Object} contextData - Context data
     * @returns {boolean} - Whether to show the item
     */
    shouldShowMenuItem(item, contextData) {
        // Only show menu if click was on a layer
        if (!contextData.isLayer) return false;
        
        return super.shouldShowMenuItem(item, contextData);
    }

    /**
     * Override showContextMenu to prevent showing if click was not on layer
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data from clicked element
     */
    showContextMenu(event, contextData) {
        // Don't show layer menu if click was not on a layer
        if (!contextData.isLayer) {
            return;
        }
        
        super.showContextMenu(event, contextData);
    }


    /**
     * Override createContextMenu to add layers-specific CSS class
     * @param {Event} event - The context menu event
     * @param {Object} contextData - Context data
     * @returns {HTMLElement} - The context menu element
     */
    createContextMenu(event, contextData) {
        const contextMenu = super.createContextMenu(event, contextData);
        contextMenu.classList.add('layers-panel');
        return contextMenu;
    }

    /**
     * Setup menu items for layer operations
     */
    setupMenuItems() {
        // Make Current Layer
        this.addMenuItem('Make Current', '🎯', (contextData) => {
            this.callbacks.onMakeCurrent(contextData.layer);
        }, {
            disabled: (context) => context.isCurrent
        });

        this.addSeparator();

        // Rename Layer
        this.addMenuItem('Rename', '✏️', (contextData) => {
            this.callbacks.onRename(contextData.layer);
        });

        // Duplicate Layer
        this.addMenuItem('Duplicate', '🔄', (contextData) => {
            this.callbacks.onDuplicate(contextData.layer);
        });

        this.addSeparator();

        // Toggle Visibility
        this.addMenuItem('Toggle Visibility', '👁️', (contextData) => {
            this.callbacks.onToggleVisibility(contextData.layer);
        });

        // Toggle Lock
        this.addMenuItem('Toggle Lock', '🔒', (contextData) => {
            this.callbacks.onToggleLock(contextData.layer);
        });

        this.addSeparator();

        // Select All Objects
        this.addMenuItem('Select All Objects', '🎯', (contextData) => {
            this.callbacks.onSelectAllObjects(contextData.layer);
        });

        this.addSeparator();

        // Delete Layer
        this.addMenuItem('Delete', '🗑️', (contextData) => {
            this.callbacks.onDelete(contextData.layer);
        }, {
            disabled: (context) => context.isMainLayer,
            className: 'text-red-400 hover:bg-red-600'
        });
    }
}

