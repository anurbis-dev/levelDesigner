/**
 * SplashScreenDialog - Splash screen dialog with image, text content, and version footer
 * 
 * @author Alexey Borzykh aka NURB
 * @version 3.54.3
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
        // textContent can be overridden via config, but default is always fresh
        this.textContent = config.textContent;
        this.contentRendered = false;
    }

    /**
     * Get current text content (always fresh from getDefaultTextContent)
     */
    getTextContent() {
        return this.textContent || this.getDefaultTextContent();
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
                    ${this.getTextContent()}
                </div>
            </div>
        `;
    }

    /**
     * Get default text content
     */
    getDefaultTextContent() {
        // GitHub repository URL - update these if repository URL changes
        const githubRepo = 'https://github.com/username/repo'; // Update with actual repository URL
        
        // Common styles
        const textStyle = 'color: var(--ui-text-color, #d1d5db); font-size: 1rem; line-height: 1.75rem; margin: 0 0 1rem 0;';
        const linkStyle = 'color: var(--ui-active-color, #3b82f6); text-decoration: underline;';
        const headingStyle = 'color: var(--ui-active-text-color, #ffffff); font-size: 1.5rem; line-height: 2rem; margin: 0 0 1rem 0; font-weight: 600;';
        
        return `
            <h2 style="${headingStyle}">Welcome to HAPLO Level Editor</h2>
            <p style="${textStyle}">
                Designed by Alexey Borzykh aka NURB.<br>
                Built to help you design game levels for classic scrolling games of any genre.
            </p>
            <p style="${textStyle}margin-top: 1rem;">
                Refer to the <a href="${githubRepo}/blob/main/docs/CHANGELOG.md" target="_blank" rel="noopener noreferrer" style="${linkStyle}">Changelog</a><br>
                Scroll through the <a href="${githubRepo}/blob/main/docs/USER_MANUAL.md" target="_blank" rel="noopener noreferrer" style="${linkStyle}">User Manual</a>
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
     * Returns promise that resolves when dialog is fully ready
     */
    async updateDialogSize() {
        const imageContainer = this.container?.querySelector('.splash-image-container');
        const img = imageContainer?.querySelector('img');
        
        if (!img || !this.container) {
            return;
        }
        
        const applySize = () => {
            const imageWidth = img.naturalWidth || img.width || 600;
            const maxWidth = window.innerWidth * 0.9;
            const dialogWidth = Math.min(imageWidth, maxWidth);
            
            this.container.style.width = `${dialogWidth}px`;
            this.container.style.minWidth = `${dialogWidth}px`;
            this.container.style.maxWidth = `${dialogWidth}px`;
        };
        
        if (img.complete && img.naturalWidth) {
            applySize();
        } else {
            return new Promise((resolve) => {
                img.addEventListener('load', () => { applySize(); resolve(); }, { once: true });
                img.addEventListener('error', () => { applySize(); resolve(); }, { once: true });
            });
        }
    }

    /**
     * Override renderContent to always update text
     */
    renderContent() {
        const contentElement = document.getElementById(`${this.config.id}-content`);
        if (contentElement) {
            contentElement.innerHTML = this.renderSplashContent();
        }
    }

    /**
     * Show dialog with custom height handling
     * Ensures all styles and sizes are applied before displaying
     */
    async show() {
        this.config.height = 'auto';
        this.contentRendered = false;
        
        // Ensure dialog exists
        if (!this.overlay) {
            this.createDialog();
        }
        
        // Keep hidden until ready
        if (this.container) {
            this.container.style.visibility = 'hidden';
        }
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        
        this.isVisible = true;
        
        // Prepare content (hidden)
        this.setupEventHandlers();
        this.applyUIScaling();
        if (!this.contentRendered) {
            this.renderContent();
            this.contentRendered = true;
        }
        
        // Update text content
        const textContainer = this.container?.querySelector('.splash-text-container');
        if (textContainer) {
            textContainer.innerHTML = this.getTextContent();
        }
        
        // Apply container styles
        if (this.container) {
            this.container.style.height = 'auto';
            if (this.overlay) {
                this.overlay.style.zIndex = '10000';
            }
        }
        
        // Wait for size calculation (image loaded)
        await this.updateDialogSize();
        
        // Force one layout pass to ensure everything is calculated
        if (this.container) {
            void this.container.offsetHeight;
        }
        
        // Show dialog - everything is ready
        if (this.overlay) {
            this.overlay.style.display = 'flex';
            this.overlay.classList.add('dialog-visible');
        }
        if (this.container) {
            this.container.style.visibility = 'visible';
        }
        
        if (this.config.onShow) {
            this.config.onShow();
        }
        
        Logger.ui.info(`${this.constructor.name}: Dialog shown`);
    }

    /**
     * Override setupEventHandlers to add container click handler
     * Uses unified event handler system
     */
    setupEventHandlers() {
        // Call parent to setup overlay handlers
        super.setupEventHandlers();

        // Register click handler on container itself to close dialog
        // This uses unified event handler system (not inline addEventListener)
        if (this.container && !eventHandlerManager.isElementRegistered(this.container)) {
            const containerHandlers = {
                click: (e) => {
                    // Close dialog when clicking on container itself or its direct children
                    // Check if click target is container or immediate child elements (image, text container)
                    const isContainerClick = e.target === this.container;
                    const isDirectChild = this.container.contains(e.target) && 
                                         (e.target.classList.contains('splash-image-container') || 
                                          e.target.classList.contains('splash-text-container') ||
                                          e.target.tagName === 'IMG' ||
                                          e.target.closest('.splash-image-container') ||
                                          e.target.closest('.splash-text-container'));
                    
                    // Don't close on footer clicks (version info)
                    const isFooterClick = e.target.closest('.dialog-footer') || e.target.classList.contains('dialog-footer');
                    
                    if ((isContainerClick || isDirectChild) && !isFooterClick) {
                        e.stopPropagation(); // Prevent event bubbling
                        this.hide();
                        if (this.config.onCancel) {
                            this.config.onCancel();
                        }
                    }
                }
            };

            eventHandlerManager.registerElement(this.container, containerHandlers, `${this.config.id}-container-click`);
        }
    }

    /**
     * Override destroy to cleanup overlay and container click handlers
     */
    destroy() {
        // Unregister overlay click handler
        if (this.overlay) {
            eventHandlerManager.unregisterElement(this.overlay);
        }
        
        // Unregister container click handler
        if (this.container) {
            eventHandlerManager.unregisterElement(this.container);
        }
        
        // Call parent destroy
        super.destroy();
    }
}

