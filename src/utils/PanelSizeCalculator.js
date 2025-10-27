/**
 * PanelSizeCalculator - Utility for calculating panel sizes during resize operations
 * 
 * Extracted from UnifiedTouchManager to provide panel size calculation
 * functionality without touch dependencies.
 */

import { Logger } from './Logger.js';

export class PanelSizeCalculator {
    constructor() {
        Logger.ui.debug('PanelSizeCalculator created');
    }

    /**
     * Calculate horizontal panel size
     * @param {HTMLElement} element - Resizer element
     * @param {Object} input - Input data (mouse event)
     * @param {Object} initialData - Initial data
     * @returns {number} - Calculated width
     */
    calculateHorizontalPanelSize(element, input, initialData) {
        const isRightPanel = element.id && element.id.includes('right');
        const isFoldersResizer = element.id === 'folders-resizer';
        
        // Get container width for constraints
        const container = isFoldersResizer ? 
            document.querySelector('.folders-container') : 
            document.querySelector('.panel-container');
        
        const containerWidth = container ? container.offsetWidth : window.innerWidth;
        const delta = input.clientX - initialData.startX;
        
        // Calculate new width based on panel type
        let newWidth;
        if (isRightPanel) {
            // Right panel grows rightward (should expand when cursor moves right)
            newWidth = initialData.startWidth + delta;
        } else {
            // Left panel or folders grows rightward
            newWidth = initialData.startWidth + delta;
        }
        
        // Apply constraints
        const minWidth = 100;
        const maxWidth = Math.min(800, containerWidth * 0.8);
        
        return Math.max(minWidth, Math.min(maxWidth, newWidth));
    }

    /**
     * Calculate vertical panel size
     * @param {HTMLElement} element - Resizer element
     * @param {Object} input - Input data (mouse event)
     * @param {Object} initialData - Initial data
     * @returns {number} - Calculated height
     */
    calculateVerticalPanelSize(element, input, initialData) {
        const isConsole = element.classList.contains('console-resize-handle');
        const isAssets = element.id === 'resizer-assets';
        
        const delta = input.clientY - initialData.startY;
        
        // Calculate new height based on panel type
        let newHeight;
        if (isConsole) {
            // Console grows upward (should expand when cursor moves up)
            newHeight = initialData.startHeight - delta;
        } else if (isAssets) {
            // Assets panel (bottom panel) - should expand when cursor moves up, shrink when down
            newHeight = initialData.startHeight - delta;
        } else {
            // Other panels grow downward
            newHeight = initialData.startHeight + delta;
        }
        
        // Apply constraints
        const minHeight = 100;
        const maxHeight = window.innerHeight * 0.8;
        
        return Math.max(minHeight, Math.min(maxHeight, newHeight));
    }
}
