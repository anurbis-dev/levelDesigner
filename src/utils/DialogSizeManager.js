/**
 * Dialog Size Manager
 * 
 * Utility for managing dialog window sizes with fixed height and dynamic width
 * based on the widest content section.
 * 
 * @author Level Designer
 * @version 3.51.9
 */

export class DialogSizeManager {
    constructor() {
        this.maxContentWidth = 0;
        this.measuredSections = new Set();
    }

    /**
     * Calculate the optimal width for a dialog based on all its content sections
     * @param {string} dialogId - ID of the dialog container
     * @param {Array} sectionRenderers - Array of functions that render section content
     * @param {Object} stateManager - StateManager instance for refactored renderers
     * @returns {number} Optimal width in pixels
     */
    calculateOptimalWidth(dialogId, sectionRenderers = [], stateManager = null) {
        const dialog = document.getElementById(dialogId);
        if (!dialog) {
            console.warn(`Dialog with ID "${dialogId}" not found`);
            return 600; // Default width
        }

        let maxWidth = 0;
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            visibility: hidden;
            white-space: nowrap;
            font-family: inherit;
            font-size: inherit;
        `;
        
        // Copy dialog's computed styles to temp container
        const dialogStyles = window.getComputedStyle(dialog);
        tempContainer.style.fontFamily = dialogStyles.fontFamily;
        tempContainer.style.fontSize = dialogStyles.fontSize;
        tempContainer.style.lineHeight = dialogStyles.lineHeight;
        tempContainer.style.padding = dialogStyles.padding;
        tempContainer.style.border = dialogStyles.border;
        tempContainer.style.boxSizing = dialogStyles.boxSizing;
        
        document.body.appendChild(tempContainer);

        try {
            // Measure each section's content width
            sectionRenderers.forEach((renderer, index) => {
                if (typeof renderer === 'function') {
                    let content;
                    
                    // All renderers now accept stateManager parameter
                    content = stateManager ? renderer(stateManager) : renderer();
                    
                    if (content) {
                        tempContainer.innerHTML = content;
                        const contentWidth = tempContainer.scrollWidth;
                        maxWidth = Math.max(maxWidth, contentWidth);
                        this.measuredSections.add(`section_${index}`);
                    }
                }
            });

            // Add padding and margins for main content area
            const padding = this.parsePadding(dialogStyles.padding);
            const margin = this.parseMargin(dialogStyles.margin);
            const border = this.parseBorder(dialogStyles.borderWidth);
            
            maxWidth += padding.left + padding.right + margin.left + margin.right + border.left + border.right;
            
            // Add navigation width (if it's a settings panel)
            if (dialogId === 'settings-panel-container') {
                const navElement = document.querySelector('.settings-nav');
                if (navElement) {
                    const navWidth = navElement.offsetWidth || 200; // fallback to 200px
                    maxWidth += navWidth;
                }
            }
            
            // Apply constraints
            const minWidth = 300;
            const maxAllowedWidth = window.innerWidth * 0.9; // 90% of viewport width
            
            maxWidth = Math.max(minWidth, Math.min(maxWidth, maxAllowedWidth));
            
        } finally {
            document.body.removeChild(tempContainer);
        }

        this.maxContentWidth = maxWidth;
        return maxWidth;
    }

    /**
     * Apply optimal width to a dialog
     * @param {string} dialogId - ID of the dialog container
     * @param {number} width - Width to apply (optional, will calculate if not provided)
     */
    applyOptimalWidth(dialogId, width = null) {
        const dialog = document.getElementById(dialogId);
        if (!dialog) return;

        const optimalWidth = width || this.maxContentWidth || 600;
        dialog.style.width = `${optimalWidth}px`;
        dialog.style.minWidth = `${optimalWidth}px`;
        dialog.style.maxWidth = `${optimalWidth}px`;
    }

    /**
     * Update dialog size when content changes
     * @param {string} dialogId - ID of the dialog container
     * @param {Array} sectionRenderers - Array of functions that render section content
     * @param {Object} stateManager - StateManager instance for refactored renderers
     */
    updateDialogSize(dialogId, sectionRenderers = [], stateManager = null) {
        const optimalWidth = this.calculateOptimalWidth(dialogId, sectionRenderers, stateManager);
        this.applyOptimalWidth(dialogId, optimalWidth);
    }

    /**
     * Parse CSS padding value
     * @param {string} padding - CSS padding value
     * @returns {Object} Object with top, right, bottom, left values
     */
    parsePadding(padding) {
        const values = padding.split(' ').map(v => parseFloat(v) || 0);
        return {
            top: values[0] || 0,
            right: values[1] || values[0] || 0,
            bottom: values[2] || values[0] || 0,
            left: values[3] || values[1] || values[0] || 0
        };
    }

    /**
     * Parse CSS margin value
     * @param {string} margin - CSS margin value
     * @returns {Object} Object with top, right, bottom, left values
     */
    parseMargin(margin) {
        const values = margin.split(' ').map(v => parseFloat(v) || 0);
        return {
            top: values[0] || 0,
            right: values[1] || values[0] || 0,
            bottom: values[2] || values[0] || 0,
            left: values[3] || values[1] || values[0] || 0
        };
    }

    /**
     * Parse CSS border width value
     * @param {string} borderWidth - CSS border width value
     * @returns {Object} Object with top, right, bottom, left values
     */
    parseBorder(borderWidth) {
        const values = borderWidth.split(' ').map(v => parseFloat(v) || 0);
        return {
            top: values[0] || 0,
            right: values[1] || values[0] || 0,
            bottom: values[2] || values[0] || 0,
            left: values[3] || values[1] || values[0] || 0
        };
    }

    /**
     * Reset measured sections cache
     */
    resetCache() {
        this.measuredSections.clear();
        this.maxContentWidth = 0;
    }

    /**
     * Get current maximum content width
     * @returns {number} Current maximum content width
     */
    getMaxContentWidth() {
        return this.maxContentWidth;
    }
}

// Export singleton instance
export const dialogSizeManager = new DialogSizeManager();
