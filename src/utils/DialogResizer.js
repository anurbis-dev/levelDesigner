/**
 * Dialog Resizer Utility
 * 
 * Unified utility for adding resizable width functionality to dialogs
 * Works for both BaseDialog and SettingsPanel
 */

export class DialogResizer {
    /**
     * Create and setup resizer for a dialog container
     * @param {HTMLElement} container - Dialog container element
     * @param {string} dialogId - Dialog ID for StateManager key
     * @param {Object} options - Options (levelEditor, resizerId)
     */
    static setupResizer(container, dialogId, options = {}) {
        if (!container) return null;
        
        const { levelEditor = window.editor, resizerId = `${dialogId}-resizer` } = options;
        
        // Remove existing resizer if any
        const existingResizer = document.getElementById(resizerId);
        if (existingResizer) {
            existingResizer.remove();
        }
        
        // Create resizer element
        const resizer = document.createElement('div');
        resizer.id = resizerId;
        resizer.className = 'dialog-resizer';
        resizer.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 4px;
            height: 100%;
            cursor: col-resize;
            background-color: transparent;
            z-index: 10;
        `;
        
        // Add hover effect
        resizer.addEventListener('mouseenter', () => {
            resizer.style.backgroundColor = 'var(--ui-active-color, #3b82f6)';
        });
        resizer.addEventListener('mouseleave', () => {
            if (!resizer.classList.contains('resizing')) {
                resizer.style.backgroundColor = 'transparent';
            }
        });
        
        // Mouse handlers
        resizer.addEventListener('mousedown', (e) => {
            let isResizing = false;
            const initialMouseX = e.clientX;
            const initialWidth = container.offsetWidth;
            
            const handleMouseMove = (e) => {
                if (!isResizing) {
                    isResizing = true;
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    resizer.classList.add('resizing');
                    resizer.style.backgroundColor = 'var(--ui-active-color, #3b82f6)';
                }
                
                const deltaX = e.clientX - initialMouseX;
                const newWidth = initialWidth + deltaX;
                const minWidth = 300;
                const maxWidth = window.innerWidth * 0.9;
                const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                
                // Apply resize (don't save yet - save only on mouseup)
                container.style.setProperty('width', `${clampedWidth}px`, 'important');
                container.style.setProperty('min-width', `${clampedWidth}px`, 'important');
                container.style.setProperty('max-width', `${clampedWidth}px`, 'important');
                container.style.setProperty('--fixed-dialog-width', `${clampedWidth}px`);
            };
            
            const handleMouseUp = () => {
                if (isResizing) {
                    // Save final width to StateManager
                    const finalWidth = container.offsetWidth;
                    const stateManager = levelEditor?.stateManager;
                    if (stateManager) {
                        stateManager.set(`dialogs.${dialogId}.width`, finalWidth);
                    }
                    
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    resizer.classList.remove('resizing');
                    resizer.style.backgroundColor = 'transparent';
                    
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                }
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
            e.stopPropagation();
        });
        
        container.appendChild(resizer);
        return resizer;
    }
    
    /**
     * Get saved dialog width from StateManager
     * @param {string} dialogId - Dialog ID
     * @param {Object} levelEditor - LevelEditor instance
     * @returns {number|null} Saved width or null
     */
    static getSavedWidth(dialogId, levelEditor = window.editor) {
        const stateManager = levelEditor?.stateManager;
        if (stateManager) {
            return stateManager.get(`dialogs.${dialogId}.width`);
        }
        return null;
    }
}

