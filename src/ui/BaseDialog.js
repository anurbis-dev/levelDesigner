/**
 * BaseDialog - Base class for all popup windows and dialogs
 * 
 * Provides common functionality for all dialog windows including:
 * - Fixed height based on viewport size
 * - Dynamic width calculation based on content
 * - Event handling and cleanup
 * - Consistent styling and positioning
 * 
 * @author Level Designer
 * @version 3.52.1
 */

import { Logger } from '../utils/Logger.js';
import { dialogSizeManager } from '../utils/DialogSizeManager.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { DialogResizer } from '../utils/DialogResizer.js';

export class BaseDialog {
    constructor(config = {}) {
        this.config = {
            id: config.id || 'base-dialog',
            title: config.title || 'Dialog',
            width: config.width || 'auto',
            height: config.height || 'calc(100vh - 4rem)',
            showCloseButton: config.showCloseButton !== false,
            showFooter: config.showFooter !== false,
            footerButtons: config.footerButtons || [],
            contentRenderer: config.contentRenderer || (() => '<div>No content</div>'),
            onShow: config.onShow || (() => {}),
            onHide: config.onHide || (() => {}),
            onConfirm: config.onConfirm || (() => {}),
            onCancel: config.onCancel || (() => {}),
            ...config
        };
        
        this.overlay = null;
        this.container = null;
        this.resizer = null;
        this.isVisible = false;
        this.widthCalculated = false;
        this.contentRendered = false;
        
        // Get levelEditor for resizer and state management
        this.levelEditor = config.levelEditor || window.editor || null;
        
        Logger.ui.info(`${this.constructor.name} initialized with config:`, this.config);
    }


    /**
     * Create dialog HTML structure
     */
    createDialog() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = `${this.config.id}-overlay`;
        this.overlay.className = 'dialog-overlay';
        this.overlay.style.display = 'none';
        
        // Overlay styles are handled by CSS - no JavaScript intervention needed

        // Create dialog container
        this.container = document.createElement('div');
        this.container.id = this.config.id;
        this.container.className = 'dialog-container';
        this.container._baseDialogInstance = this;
        
        // Set initial styles - width will be calculated later
        this.container.style.cssText = `
            background-color: var(--ui-background-color, #1f2937);
            border: 1px solid #374151;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            height: ${this.config.height};
            max-height: ${this.config.height};
            overflow: hidden;
            display: flex;
            flex-direction: column;
            width: auto;
            min-width: 300px;
            max-width: 90vw;
            visibility: hidden;
        `;

        // Create header
        const header = this.createHeader();
        this.container.appendChild(header);

        // Create content area
        const contentArea = this.createContentArea();
        this.container.appendChild(contentArea);

        // Create footer if needed
        if (this.config.showFooter) {
            const footer = this.createFooter();
            this.container.appendChild(footer);
        }

        // Resizer will be created in setupDialogResizer() after container is ready

        this.overlay.appendChild(this.container);
        document.body.appendChild(this.overlay);

        Logger.ui.info(`${this.constructor.name}: Dialog structure created`);
    }

    /**
     * Create dialog header
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'dialog-header';
        header.style.cssText = `
            background-color: #111827;
            border-bottom: 1px solid #374151;
            padding: calc(1rem * max(var(--spacing-scale, 1.0), 0.5)) calc(1.5rem * max(var(--spacing-scale, 1.0), 0.5));
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        `;

        const title = document.createElement('h2');
        title.className = 'dialog-title';
        title.textContent = this.config.title;
        title.style.cssText = `
            color: #f9fafb;
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
        `;

        header.appendChild(title);

        if (this.config.showCloseButton) {
            const closeBtn = document.createElement('button');
            closeBtn.id = `${this.config.id}-close`;
            closeBtn.className = 'dialog-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: var(--ui-text-color, #9ca3af);
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
            `;
            header.appendChild(closeBtn);
        }

        return header;
    }

    /**
     * Create dialog content area
     */
    createContentArea() {
        const contentArea = document.createElement('div');
        contentArea.className = 'dialog-content-area';
        contentArea.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
        `;

        const content = document.createElement('div');
        content.id = `${this.config.id}-content`;
        content.className = 'dialog-content';
        content.style.cssText = `
            flex: 1;
            padding: calc(0.5rem * max(var(--spacing-scale, 1.0), 0.5));
            overflow-y: auto;
            background-color: var(--ui-background-color, #1f2937);
        `;

        contentArea.appendChild(content);
        return contentArea;
    }

    /**
     * Setup dialog resizer for width adjustment
     */
    setupDialogResizer() {
        if (!this.container || this.config.resizable === false) {
            return;
        }
        
        // Use unified DialogResizer utility
        this.resizer = DialogResizer.setupResizer(
            this.container, 
            this.config.id, 
            { levelEditor: this.levelEditor }
        );
    }

    /**
     * Create dialog footer
     */
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'dialog-footer';

        const footerRight = document.createElement('div');
        footerRight.className = 'dialog-footer-right';

        // Add footer buttons
        this.config.footerButtons.forEach(button => {
            const btn = document.createElement('button');
            btn.id = `${this.config.id}-${button.id}`;
            btn.className = `dialog-btn ${button.class || 'dialog-btn-default'}`;
            btn.textContent = button.text;
            
            // Only set custom background and text color if specified
            if (button.backgroundColor) {
                btn.style.backgroundColor = button.backgroundColor;
            }
            if (button.textColor) {
                btn.style.color = button.textColor;
            }
            
            // Ensure button width adapts to text content
            btn.style.width = 'auto';
            btn.style.minWidth = 'auto';
            
            footerRight.appendChild(btn);
        });

        footer.appendChild(footerRight);
        return footer;
    }

    /**
     * Show dialog
     */
    show() {
        // Create dialog only when showing (not in constructor)
        if (!this.overlay) {
            this.createDialog();
        }

        this.isVisible = true;
        // Update display to flex while preserving other styles
        this.overlay.classList.add('dialog-visible');
        this.overlay.style.display = 'flex';

        // Setup event handlers and calculate size after DOM is ready
        setTimeout(() => {
            this.setupEventHandlers();
            
            // Apply Font Scale and Spacing BEFORE content is rendered
            this.applyUIScaling();
            
            // Render content AFTER scaling is applied (only if not already rendered)
            if (!this.contentRendered) {
                this.renderContent();
                this.contentRendered = true;
            }
            
            this.updateDialogSize();
            
            // Setup dialog resizer after size is calculated
            this.setupDialogResizer();
            
            this.config.onShow();
        }, 100);

        Logger.ui.info(`${this.constructor.name}: Dialog shown`);
    }

    /**
     * Hide dialog
     */
    hide() {
        if (!this.overlay) return;

        this.isVisible = false;
        // Update display to none while preserving other styles
        this.overlay.classList.remove('dialog-visible');
        this.overlay.style.display = 'none';
        this.config.onHide();

        Logger.ui.info(`${this.constructor.name}: Dialog hidden`);
    }


    /**
     * Apply UI scaling (Font Scale and Spacing) before calculating sizes
     */
    applyUIScaling() {
        // Try to get SettingsSyncManager to apply scaling
        if (window.editor?.settingsSyncManager) {
            window.editor.settingsSyncManager.applySpecialUISettings();
            
            // Also apply spacing to dialog elements specifically
            this.applySpacingToDialog();
        } else {
            // Fallback: apply basic scaling from localStorage
            try {
                const stored = localStorage.getItem('levelEditor_userConfig_complete');
                if (stored) {
                    const prefs = JSON.parse(stored);
                    const fontScale = prefs.ui?.fontScale || 1.0;
                    const spacingScale = prefs.ui?.spacing || 1.0;
                    
                    if (fontScale !== 1.0) {
                        document.documentElement.style.setProperty('--font-scale', String(fontScale));
                        document.documentElement.style.fontSize = `${fontScale * 16}px`;
                    }
                    
                    if (spacingScale !== 1.0) {
                        document.documentElement.style.setProperty('--spacing-scale', String(spacingScale));
                        this.applySpacingToDialog(spacingScale);
                    }
                }
            } catch (error) {
                Logger.ui.warn('Failed to apply UI scaling:', error);
            }
        }
    }

    /**
     * Apply spacing scale to dialog elements
     */
    applySpacingToDialog(spacingScale = null) {
        if (!this.container) return;
        
        // Get spacing scale from CSS variable if not provided
        if (spacingScale === null) {
            const spacingVar = getComputedStyle(document.documentElement).getPropertyValue('--spacing-scale');
            spacingScale = parseFloat(spacingVar) || 1.0;
        }
        
        // Apply spacing to dialog elements
        const elements = this.container.querySelectorAll('[style*="padding"], [style*="margin"], [style*="gap"]');
        elements.forEach(element => {
            const style = element.getAttribute('style');
            if (style) {
                // Update padding
                const paddingMatch = style.match(/padding:\s*([^;]+)/);
                if (paddingMatch) {
                    const newPadding = paddingMatch[1].replace(/(\d+(?:\.\d+)?)rem/g, (match, value) => {
                        return `${parseFloat(value) * spacingScale}rem`;
                    });
                    element.style.padding = newPadding;
                }
                
                // Update margin
                const marginMatch = style.match(/margin:\s*([^;]+)/);
                if (marginMatch) {
                    const newMargin = marginMatch[1].replace(/(\d+(?:\.\d+)?)rem/g, (match, value) => {
                        return `${parseFloat(value) * spacingScale}rem`;
                    });
                    element.style.margin = newMargin;
                }
                
                // Update gap
                const gapMatch = style.match(/gap:\s*([^;]+)/);
                if (gapMatch) {
                    const newGap = gapMatch[1].replace(/(\d+(?:\.\d+)?)rem/g, (match, value) => {
                        return `${parseFloat(value) * spacingScale}rem`;
                    });
                    element.style.gap = newGap;
                }
            }
        });
    }

    /**
     * Update dialog size
     */
    updateDialogSize() {
        // Only calculate width once to prevent jumping
        if (this.widthCalculated) {
            return;
        }

        // Try to restore saved width from StateManager first
        let dialogWidth = DialogResizer.getSavedWidth(this.config.id, this.levelEditor);
        
        // If no saved width, use default 50% of viewport width
        if (!dialogWidth) {
            dialogWidth = window.innerWidth * 0.5;
        }
        
        // Apply the width with !important to override CSS
        if (this.container) {
            this.container.style.setProperty('width', `${dialogWidth}px`, 'important');
            this.container.style.setProperty('min-width', `${dialogWidth}px`, 'important');
            this.container.style.setProperty('max-width', `${dialogWidth}px`, 'important');
            
            // Set CSS variable for override rules
            this.container.style.setProperty('--fixed-dialog-width', `${dialogWidth}px`);
            
            // Make dialog visible only after width is calculated
            this.container.style.visibility = 'visible';
            
            this.widthCalculated = true;
        }
    }

    /**
     * Render dialog content
     */
    renderContent() {
        const contentElement = document.getElementById(`${this.config.id}-content`);
        if (contentElement && this.config.contentRenderer) {
            contentElement.innerHTML = this.config.contentRenderer();
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Check if container is already registered to avoid duplicate registration
        if (eventHandlerManager.getContainerInfo(this.overlay)) {
            return;
        }

        // Create dialog handlers configuration using new system
        const dialogHandlers = EventHandlerUtils.createDialogHandlers(
            () => {
                // ESC handler
                this.hide();
                this.config.onCancel();
            },
            (e) => {
                // Overlay click handler - close dialog when clicking outside container
                // Check if click is on overlay itself (not on container or its children)
                if (e.target === this.overlay) {
                    this.hide();
                    if (this.config.onCancel) {
                        this.config.onCancel();
                    }
                }
            },
            (e) => {
                // Handle close button
                if (e.target.id === `${this.config.id}-close`) {
                    this.hide();
                    this.config.onCancel();
                    return;
                }

                // Handle footer buttons
                const button = e.target.closest('button');
                if (button) {
                    const buttonId = button.id.replace(`${this.config.id}-`, '');
                    const footerButton = this.config.footerButtons.find(btn => btn.id === buttonId);
                    
                    if (footerButton) {
                        if (footerButton.action) {
                            footerButton.action();
                        } else if (buttonId === 'confirm' || buttonId === 'save') {
                            this.config.onConfirm();
                        } else if (buttonId === 'cancel') {
                            this.config.onCancel();
                        }
                        this.hide();
                    }
                }
            }
        );

        // Register dialog with new event manager
        eventHandlerManager.registerContainer(this.overlay, dialogHandlers);
    }

    /**
     * Destroy dialog
     */
    destroy() {
        // Cleanup resizer if exists
        if (this.resizer && this.levelEditor?.resizerManager) {
            this.levelEditor.resizerManager.unregisterResizer(this.resizer);
        }
        
        if (this.overlay) {
            // Remove event handlers using new system
            eventHandlerManager.unregisterContainer(this.overlay);
            
            // Remove from DOM
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            
            this.overlay = null;
            this.container = null;
            this.resizer = null;
        }
        
        Logger.ui.info(`${this.constructor.name}: Dialog destroyed`);
    }
}
