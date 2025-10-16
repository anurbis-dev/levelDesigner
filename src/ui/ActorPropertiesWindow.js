import { SettingsPanel } from './SettingsPanel.js';
import { Logger } from '../utils/Logger.js';

/**
 * Actor Properties Window - inherits from SettingsPanel
 * Provides a modal window for editing actor properties
 */
export class ActorPropertiesWindow extends SettingsPanel {
    constructor(container, stateManager, levelEditor) {
        // Initialize with minimal config since we'll override most functionality
        super(container, levelEditor?.configManager || null, levelEditor);
        
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.currentActor = null;
        this.initialState = null; // Store initial state of properties
        this.hasChanges = false; // Track if any changes were made
        
        // Override the overlay ID to avoid conflicts
        this.overlayId = 'actor-properties-overlay';
        this.containerId = 'actor-properties-container';
        
        // Initialize our own functionality
        this.initActorProperties();
    }

    initActorProperties() {
        this.createActorPropertiesWindow();
        this.setupActorEventListeners();
    }

    init() {
        // Do nothing - initialization is handled in initActorProperties()
    }

    createActorPropertiesWindow() {
        // Create actor properties overlay element (similar to settings)
        const overlay = document.createElement('div');
        overlay.id = this.overlayId;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        `;
        
        overlay.innerHTML = `
            <div class="settings-panel-container" id="${this.containerId}">
                <div class="settings-header" id="actor-properties-header">
                    <h2>Actor Properties</h2>
                    <div class="settings-header-controls">
                        <button id="actor-props-close" class="settings-menu-btn">×</button>
                    </div>
                </div>
                
                <div class="settings-content-area">
                    <div class="settings-main-content">
                        <div id="actor-properties-content">
                            <div style="color: var(--ui-text-color, #9ca3af);">No actor selected</div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-footer">
                    <div class="settings-footer-right">
                        <button id="actor-props-cancel" class="settings-btn settings-btn-cancel">Cancel</button>
                        <button id="actor-props-apply" class="settings-btn settings-btn-save">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Append to container
        this.container.appendChild(overlay);
    }

    setupActorEventListeners() {
        // Close button
        const closeBtn = document.getElementById('actor-props-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Cancel button
        const cancelBtn = document.getElementById('actor-props-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }

        // Apply/Close button
        const applyBtn = document.getElementById('actor-props-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (this.hasChanges) {
                    this.applyChanges();
                } else {
                    this.hide();
                }
            });
        }

        // Escape key handler
        this.escapeKeyHandler = (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escapeKeyHandler);

        // Subscribe to selectedActor changes if stateManager is available
        if (this.stateManager && this.stateManager.subscribe) {
            this.stateManager.subscribe('selectedActor', (actor) => {
                this.currentActor = actor;
                this.renderActorProperties();
            });
        }
    }

    show(actor = null) {
        this.isVisible = true;
        const overlay = document.getElementById(this.overlayId);
        if (overlay) {
            overlay.style.display = 'flex';
            
            if (actor) {
                this.currentActor = actor;
                if (this.stateManager && this.stateManager.set) {
                    this.stateManager.set('selectedActor', actor);
                }
            }
            
            this.renderActorProperties();
            
            // Use setTimeout to ensure DOM is fully rendered before saving initial state
            setTimeout(() => {
                this.saveInitialState();
                this.hasChanges = false;
                this.updateApplyButton();
                this.setupChangeListeners();
            }, 0);
        }
    }

    hide() {
        this.isVisible = false;
        const overlay = document.getElementById(this.overlayId);
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // Clear selected actor
        if (this.stateManager && this.stateManager.set) {
            this.stateManager.set('selectedActor', null);
        }
        this.currentActor = null;
        this.initialState = null;
        this.hasChanges = false;
    }

    renderActorProperties() {
        const content = document.getElementById('actor-properties-content');
        if (!content) return;

        if (!this.currentActor) {
            content.innerHTML = '<div style="color: var(--ui-text-color, #9ca3af);">No actor selected</div>';
            return;
        }

        const actor = this.currentActor;
        content.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Name:</label>
                        <input type="text" id="actor-name" value="${actor.name || ''}" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" style="color: var(--ui-active-text-color, #ffffff);">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Type:</label>
                        <input type="text" id="actor-type" value="${actor.type || ''}" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" readonly style="color: var(--ui-active-text-color, #ffffff);">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">X Position:</label>
                        <input type="number" id="actor-x" value="${actor.x || 0}" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" style="color: var(--ui-active-text-color, #ffffff);">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Y Position:</label>
                        <input type="number" id="actor-y" value="${actor.y || 0}" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" style="color: var(--ui-active-text-color, #ffffff);">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Width:</label>
                        <input type="number" id="actor-width" value="${actor.width || 32}" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" style="color: var(--ui-active-text-color, #ffffff);">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Height:</label>
                        <input type="number" id="actor-height" value="${actor.height || 32}" 
                               class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" style="color: var(--ui-active-text-color, #ffffff);">
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Color:</label>
                    <input type="color" id="actor-color" value="${actor.color || '#3B82F6'}" 
                           class="w-full h-10 bg-gray-700 border border-gray-600 rounded">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Image Path:</label>
                    <input type="text" id="actor-imgSrc" value="${(actor.imgSrc !== null && actor.imgSrc !== undefined) ? actor.imgSrc : ''}" 
                           class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" style="color: var(--ui-active-text-color, #ffffff);"
                           placeholder="path/to/image.png">
                </div>
                
                <div>
                    <label class="block text-sm font-medium mb-1" style="color: var(--ui-text-color, #d1d5db);">Category:</label>
                    <input type="text" id="actor-category" value="${(actor.category !== null && actor.category !== undefined) ? actor.category : ''}" 
                           class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" style="color: var(--ui-active-text-color, #ffffff);">
                </div>
            </div>
        `;

        Logger.ui.info(`Rendered properties for actor: ${actor.name}`);
    }

    /**
     * Save initial state of all properties
     */
    saveInitialState() {
        const getNumericValue = (id, defaultVal) => {
            const value = parseFloat(document.getElementById(id)?.value);
            return isNaN(value) ? defaultVal : value;
        };

        this.initialState = {
            name: document.getElementById('actor-name')?.value || '',
            x: getNumericValue('actor-x', 0),
            y: getNumericValue('actor-y', 0),
            width: getNumericValue('actor-width', 32),
            height: getNumericValue('actor-height', 32),
            color: document.getElementById('actor-color')?.value || '#3B82F6',
            imgSrc: document.getElementById('actor-imgSrc')?.value || '',
            category: document.getElementById('actor-category')?.value || ''
        };
        
        Logger.ui.debug('Initial state saved:', this.initialState);
    }

    /**
     * Check if current values differ from initial state
     */
    checkForChanges() {
        if (!this.initialState) return false;

        const getNumericValue = (id, defaultVal) => {
            const value = parseFloat(document.getElementById(id)?.value);
            return isNaN(value) ? defaultVal : value;
        };

        const currentState = {
            name: document.getElementById('actor-name')?.value || '',
            x: getNumericValue('actor-x', 0),
            y: getNumericValue('actor-y', 0),
            width: getNumericValue('actor-width', 32),
            height: getNumericValue('actor-height', 32),
            color: document.getElementById('actor-color')?.value || '#3B82F6',
            imgSrc: document.getElementById('actor-imgSrc')?.value || '',
            category: document.getElementById('actor-category')?.value || ''
        };

        // Compare all properties
        const hasChanges = Object.keys(this.initialState).some(key => {
            const initial = this.initialState[key];
            const current = currentState[key];
            return initial !== current;
        });

        return hasChanges;
    }

    /**
     * Update Apply button text based on changes
     */
    updateApplyButton() {
        const applyBtn = document.getElementById('actor-props-apply');
        if (!applyBtn) return;

        this.hasChanges = this.checkForChanges();
        applyBtn.textContent = this.hasChanges ? 'Apply Changes' : 'Close';
    }

    /**
     * Setup change listeners on all input fields
     */
    setupChangeListeners() {
        const inputs = [
            'actor-name',
            'actor-x',
            'actor-y',
            'actor-width',
            'actor-height',
            'actor-color',
            'actor-imgSrc',
            'actor-category'
        ];

        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                // Remove old listener if exists
                if (input._changeHandler) {
                    input.removeEventListener('input', input._changeHandler);
                }
                
                // Create and store new handler
                input._changeHandler = () => this.updateApplyButton();
                
                // Add listener
                input.addEventListener('input', input._changeHandler);
            }
        });
    }

    applyChanges() {
        if (!this.currentActor) return;

        const name = document.getElementById('actor-name')?.value || '';
        const x = parseFloat(document.getElementById('actor-x')?.value) || 0;
        const y = parseFloat(document.getElementById('actor-y')?.value) || 0;
        const width = parseFloat(document.getElementById('actor-width')?.value) || 32;
        const height = parseFloat(document.getElementById('actor-height')?.value) || 32;
        const color = document.getElementById('actor-color')?.value || '#3B82F6';
        const imgSrc = document.getElementById('actor-imgSrc')?.value || '';
        const category = document.getElementById('actor-category')?.value || '';

        // Create updated data object (state 2 - current editor state)
        const updatedData = {
            name: name,
            x: x,
            y: y,
            width: width,
            height: height,
            color: color,
            imgSrc: imgSrc,
            category: category
        };

        // Update in asset manager if it's an asset
        // AssetManager will compare with original state (state 1) and set hasUnsavedChanges flag
        if (this.levelEditor && this.levelEditor.assetManager) {
            const success = this.levelEditor.assetManager.updateAsset(this.currentActor.id, updatedData);
            if (!success) {
                Logger.ui.error('Failed to update asset in AssetManager');
                return;
            }
        } else {
            // Fallback: update directly
            Object.assign(this.currentActor, updatedData);
        }

        // Mark state as dirty for re-render
        if (this.stateManager && this.stateManager.markDirty) {
            this.stateManager.markDirty();
        }

        // Trigger UI refresh
        if (this.levelEditor && this.levelEditor.render) {
            this.levelEditor.render();
        }

        // Update asset panel if available
        if (this.levelEditor && this.levelEditor.assetPanel && this.levelEditor.assetPanel.render) {
            this.levelEditor.assetPanel.render();
        }

        Logger.ui.info(`Applied changes to actor: ${this.currentActor.name}`);
        
        // Reset change tracking (state 3 - temporary window state cleared)
        this.hasChanges = false;
        
        // Close the window
        this.hide();
    }

    // Override parent methods to prevent conflicts
    createSettingsPanel() {
        // Do nothing - we create our own window
    }

    renderSettingsContent() {
        // Do nothing - we render actor properties instead
    }

    setupTabEventListeners() {
        // Do nothing - we don't use tabs
    }

    setupSettingsInputs() {
        // Do nothing - we handle inputs in renderActorProperties
    }
    
    /**
     * Cleanup and destroy window
     * Extends parent destroy() method
     */
    destroy() {
        Logger.ui.debug('Destroying ActorPropertiesWindow');
        
        // Remove overlay from DOM
        const overlay = document.getElementById(this.overlayId);
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        
        // Clear references
        this.currentActor = null;
        this.stateManager = null;
        
        // Call parent destroy
        super.destroy();
        
        Logger.ui.debug('ActorPropertiesWindow destroyed');
    }
}

