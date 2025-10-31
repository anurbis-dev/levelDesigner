/**
 * SplashScreenDialog - Splash screen dialog with image, text content, and version footer
 * 
 * @author Alexey Borzykh aka NURB
 * @version 3.54.0
 */

import { BaseDialog } from './BaseDialog.js';
import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';

export class SplashScreenDialog extends BaseDialog {
    constructor(config = {}) {
        super({
            id: 'splash-screen-dialog',
            title: '',
            width: 'auto',
            height: 'auto',
            showCloseButton: false,
            showFooter: true,
            footerButtons: [],
            contentRenderer: () => this.renderSplashContent(),
            ...config
        });

        this.splashImagePath = config.splashImagePath || 'HAPLO_editor_SplashScreen_v3-54.png';
        this.textContent = config.textContent || this.getDefaultTextContent();
        this.contentRendered = false;
    }

    /**
     * Render splash screen content
     */
    renderSplashContent() {
        return `
            <div class="splash-content" style="display: flex; flex-direction: column; width: 100%;">
                <!-- Image section - determines width -->
                <div class="splash-image-container" style="width: 100%; flex-shrink: 0;">
                    <img src="${this.splashImagePath}" 
                         alt="Splash Screen" 
                         style="width: 100%; height: auto; display: block;"
                         onload="this.parentElement.parentElement.querySelector('.splash-text-container').style.minHeight = '250px';"
                         onerror="console.error('Failed to load splash image');">
                </div>
                
                <!-- Text content section - minimum 250px height -->
                <div class="splash-text-container" 
                     style="min-height: 250px; 
                            padding: calc(1.5rem * max(var(--spacing-scale, 1.0), 0.5)); 
                            background-color: var(--ui-background-color, #1f2937);
                            overflow-y: auto;
                            flex: 1;">
                    ${this.textContent}
                </div>
            </div>
        `;
    }

    /**
     * Get default text content
     */
    getDefaultTextContent() {
        return `
            <h2 style="color: var(--ui-text-color, #f9fafb); margin-bottom: 1rem; font-size: 1.5rem;">
                Welcome to Level Editor
            </h2>
            <p style="color: var(--ui-text-color, #d1d5db); line-height: 1.6; margin-bottom: 1rem;">
                Professional 2D level editor with utility architecture.
            </p>
        `;
    }

    /**
     * Override createDialog to skip header
     */
    createDialog() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = `${this.config.id}-overlay`;
        this.overlay.className = 'dialog-overlay';
        this.overlay.style.display = 'none';

        // Create dialog container
        this.container = document.createElement('div');
        this.container.id = this.config.id;
        this.container.className = 'dialog-container dialog-container-auto-height';
        this.container._baseDialogInstance = this;
        
        // Set initial styles - width will be calculated later
        this.container.style.cssText = `
            background-color: var(--ui-background-color, #1f2937);
            border: 1px solid #374151;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            height: auto;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            width: auto;
            min-width: 300px;
            max-width: 90vw;
            visibility: hidden;
            position: relative;
            z-index: 10001;
        `;

        // Create content area
        const contentArea = this.createContentArea();
        this.container.appendChild(contentArea);

        // Create footer
        const footer = this.createFooter();
        this.container.appendChild(footer);

        this.overlay.appendChild(this.container);
        document.body.appendChild(this.overlay);

        Logger.ui.info(`${this.constructor.name}: Dialog structure created`);
    }

    /**
     * Create dialog footer with version
     */
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'dialog-footer';
        footer.style.cssText = `
            padding: calc(0.75rem * max(var(--spacing-scale, 1.0), 0.5)) calc(1.5rem * max(var(--spacing-scale, 1.0), 0.5));
            background-color: #111827;
            border-top: 1px solid #374151;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-shrink: 0;
        `;

        // Get version dynamically according to documentation
        const version = window.editor ? window.editor.constructor.VERSION : 'unknown';
        
        const versionText = document.createElement('div');
        versionText.className = 'splash-version-text';
        versionText.textContent = `Version ${version}`;
        versionText.style.cssText = `
            color: var(--ui-text-color, #9ca3af);
            font-size: 0.875rem;
            text-align: center;
        `;

        footer.appendChild(versionText);
        return footer;
    }

    /**
     * Override updateDialogSize to use image width
     */
    updateDialogSize() {
        if (this.widthCalculated) {
            return;
        }

        // Wait for image to load
        setTimeout(() => {
            const imageContainer = this.container?.querySelector('.splash-image-container');
            const img = imageContainer?.querySelector('img');
            
            if (img && img.complete && img.naturalWidth) {
                // Use image width as dialog width
                const imageWidth = img.naturalWidth;
                const maxWidth = window.innerWidth * 0.9;
                const dialogWidth = Math.min(imageWidth, maxWidth);
                
                if (this.container) {
                    this.container.style.width = `${dialogWidth}px`;
                    this.container.style.minWidth = `${dialogWidth}px`;
                    this.container.style.maxWidth = `${dialogWidth}px`;
                    this.container.style.visibility = 'visible';
                }
                
                this.widthCalculated = true;
            } else if (img) {
                // Image not loaded yet, wait for load event
                img.addEventListener('load', () => {
                    this.updateDialogSize();
                });
            }
        }, 100);
    }

    /**
     * Show dialog with custom height handling
     */
    show() {
        // Override height to auto for splash screen before calling super
        this.config.height = 'auto';
        
        // Call parent show
        super.show();
        
        // Ensure container has auto height after show (no max-height restriction)
        if (this.container) {
            this.container.style.height = 'auto';
            // Ensure high z-index to prevent text flickering from other elements
            if (this.overlay) {
                this.overlay.style.zIndex = '10000';
            }
        }
        
        // Setup overlay click handler
        this.setupOverlayClickHandler();
    }

    /**
     * Setup mouse button handler on overlay to close dialog
     * Handles all mouse buttons (left, right, middle)
     */
    setupOverlayClickHandler() {
        if (!this.overlay) return;

        // Check if overlay is already registered as container or element to avoid duplicate registration
        if (eventHandlerManager.getContainerInfo(this.overlay) || eventHandlerManager.isElementRegistered(this.overlay)) {
            return;
        }

        // Register mousedown handler on overlay for all mouse buttons
        const handlers = {
            mousedown: (e) => {
                // Close dialog if clicking on overlay (not on container)
                if (e.target === this.overlay) {
                    this.hide();
                    if (this.config.onCancel) {
                        this.config.onCancel();
                    }
                }
            }
        };

        eventHandlerManager.registerElement(this.overlay, handlers, `${this.config.id}-overlay-click`);
    }

    /**
     * Override destroy to cleanup overlay click handler
     */
    destroy() {
        // Unregister overlay click handler
        if (this.overlay) {
            eventHandlerManager.unregisterElement(this.overlay);
        }
        
        // Call parent destroy
        super.destroy();
    }
}

