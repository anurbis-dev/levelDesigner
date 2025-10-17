import { Logger } from '../utils/Logger.js';

/**
 * Universal panel position manager
 * Handles position toggling for both folders panel and right panel
 */
export class PanelPositionManager {
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.stateManager = levelEditor.stateManager;
        this.userPrefs = levelEditor.userPrefs;
    }

    /**
     * Toggle panel position (left/right)
     * @param {string} panelType - 'folders' or 'rightPanel'
     */
    togglePanelPosition(panelType) {
        const currentPosition = this.stateManager.get(`${panelType}Position`) || 'right';
        const newPosition = currentPosition === 'right' ? 'left' : 'right';
        
        // Update state
        this.stateManager.set(`${panelType}Position`, newPosition);
        
        // Save to user preferences
        if (this.userPrefs) {
            this.userPrefs.set(`${panelType}Position`, newPosition);
        }
        
        // Update layout based on panel type
        if (panelType === 'folders') {
            this.updateFoldersLayout(newPosition);
        } else if (panelType === 'rightPanel') {
            this.updateRightPanelLayout(newPosition);
        }
        
        Logger.ui.info(`${panelType} panel moved to ${newPosition} side`);
    }

    /**
     * Update folders panel layout based on position
     * @param {string} position - 'left' or 'right'
     */
    updateFoldersLayout(position) {
        if (!this.levelEditor.assetPanel) return;
        
        // Use existing AssetPanel method
        this.levelEditor.assetPanel.foldersPosition = position;
        this.levelEditor.assetPanel.saveFoldersPosition();
        this.levelEditor.assetPanel.updateFoldersLayout();
    }

    /**
     * Update right panel layout based on position
     * @param {string} position - 'left' or 'right'
     */
    updateRightPanelLayout(position) {
        const rightPanel = document.getElementById('right-panel');
        const resizerX = document.getElementById('resizer-x');
        const mainPanel = document.getElementById('main-panel');
        
        if (!rightPanel || !resizerX || !mainPanel) return;
        
        const parent = rightPanel.parentElement;
        if (!parent) return;
        
        // Remove panel and resizer from current position
        if (rightPanel.parentElement) {
            rightPanel.parentElement.removeChild(rightPanel);
        }
        if (resizerX.parentElement) {
            resizerX.parentElement.removeChild(resizerX);
        }
        
        if (position === 'left') {
            // Move panel to left side
            parent.insertBefore(rightPanel, mainPanel);
            parent.insertBefore(resizerX, mainPanel);
            
            // Update border styles
            rightPanel.className = 'bg-gray-900 flex flex-col border-r border-gray-700';
        } else {
            // Move panel to right side (default)
            parent.appendChild(resizerX);
            parent.appendChild(rightPanel);
            
            // Update border styles
            rightPanel.className = 'bg-gray-900 flex flex-col border-l border-gray-700';
        }
        
        // Update canvas and render
        if (this.levelEditor.canvasRenderer) {
            this.levelEditor.canvasRenderer.resizeCanvas();
            this.levelEditor.render();
        }
    }

    /**
     * Initialize panel positions from saved preferences
     */
    initializePanelPositions() {
        // Initialize folders panel position
        const foldersPosition = this.userPrefs?.get('foldersPosition') ?? 'left';
        this.stateManager.set('foldersPosition', foldersPosition);
        if (this.levelEditor.assetPanel) {
            this.levelEditor.assetPanel.foldersPosition = foldersPosition;
            this.levelEditor.assetPanel.updateFoldersLayout();
        }

        // Initialize right panel position
        const rightPanelPosition = this.userPrefs?.get('rightPanelPosition') ?? 'right';
        this.stateManager.set('rightPanelPosition', rightPanelPosition);
        this.updateRightPanelLayout(rightPanelPosition);
    }

    /**
     * Get panel position
     * @param {string} panelType - 'folders' or 'rightPanel'
     * @returns {string} - 'left' or 'right'
     */
    getPanelPosition(panelType) {
        return this.stateManager.get(`${panelType}Position`) || (panelType === 'folders' ? 'left' : 'right');
    }

    /**
     * Destroy and cleanup resources
     */
    destroy() {
        // Clear references
        this.levelEditor = null;
        this.stateManager = null;
        this.userPrefs = null;
        
        Logger.ui.info('PanelPositionManager destroyed');
    }
}
