import { BaseDialog } from './BaseDialog.js';
import { getDialogStructure } from './panel-structures/DialogStructures.js';
import { 
    createSettingsSection, 
    createSettingsFormGroup, 
    createSettingsGrid, 
    createSettingsInput, 
    createSettingsLabel 
} from './panel-structures/SettingsSectionConstructor.js';
import { Logger } from '../utils/Logger.js';

/**
 * Actor Properties Window - extends BaseDialog
 * Provides a modal window for editing actor properties
 */
export class ActorPropertiesWindow extends BaseDialog {
    constructor(stateManager, levelEditor) {
        super({
            ...getDialogStructure('actor-properties'),
            id: 'actor-properties',
            contentRenderer: () => this.renderActorPropertiesContent(),
            onShow: () => this.onShow(),
            onHide: () => this.onHide(),
            onConfirm: () => this.onConfirm(),
            onCancel: () => this.onCancel()
        });
        
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.currentActor = null;
        this.initialState = null; // Store initial state of properties
        this.hasChanges = false; // Track if any changes were made
        
        // Initialize our own functionality
        this.initActorProperties();
    }

    initActorProperties() {
        // Setup event listeners for actor changes
        this.setupActorEventListeners();
    }

    setupActorEventListeners() {
        // Event handlers are now managed by EventHandlerManager

        // Subscribe to selectedActor changes if stateManager is available
        if (this.stateManager && this.stateManager.subscribe) {
            this.stateManager.subscribe('selectedActor', (actor) => {
                this.currentActor = actor;
                // Trigger content re-render if dialog is visible
                if (this.isVisible && this.overlay) {
                    this.renderContent();
                }
            });
        }
    }

    show(actor = null) {
        Logger.ui.info('ActorPropertiesWindow: show() called');
            
            if (actor) {
                this.currentActor = actor;
                if (this.stateManager && this.stateManager.set) {
                    this.stateManager.set('selectedActor', actor);
                }
            }
            
        // Use BaseDialog's show method
        super.show();
    }

    hide() {
        // Use BaseDialog's hide method
        super.hide();
        
        // Clear selected actor
        if (this.stateManager && this.stateManager.set) {
            this.stateManager.set('selectedActor', null);
        }
        this.currentActor = null;
        this.initialState = null;
        this.hasChanges = false;
    }

    onShow() {
        // Called after dialog is shown
        // Use setTimeout to ensure DOM is fully rendered before saving initial state
        setTimeout(() => {
            this.saveInitialState();
            this.hasChanges = false;
            this.updateApplyButton();
            this.setupChangeListeners();
            // Event handlers will be set up automatically by AutoEventHandlerManager
        }, 0);
    }

    onHide() {
        // Called after dialog is hidden
        Logger.ui.info('ActorPropertiesWindow: Dialog hidden');
    }

    onConfirm() {
        // Called when Apply button is clicked
        this.apply();
    }

    onCancel() {
        // Called when Cancel button is clicked
        this.hide();
    }


    renderActorPropertiesContent() {
        if (!this.currentActor) {
            return '<div style="color: var(--ui-text-color, #9ca3af);">No actor selected</div>';
        }

        const actor = this.currentActor;
        
        return createSettingsFormGroup(`
            ${createSettingsSection('Basic Properties', createSettingsFormGroup(`
                ${createSettingsGrid(`
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Name:', 'actor-name')}
                        ${createSettingsInput({
                            id: 'actor-name',
                            type: 'text',
                            value: actor.name || '',
                            placeholder: 'Actor name'
                        })}
                    `)}
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Type:', 'actor-type')}
                        ${createSettingsInput({
                            id: 'actor-type',
                            type: 'text',
                            value: actor.type || '',
                            readonly: true
                        })}
                    `)}
                `, { columns: 2 })}
            `))}
            
            ${createSettingsSection('Position', createSettingsFormGroup(`
                ${createSettingsGrid(`
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('X Position:', 'actor-x')}
                        ${createSettingsInput({
                            id: 'actor-x',
                            type: 'number',
                            value: actor.x || 0,
                            placeholder: '0'
                        })}
                    `)}
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Y Position:', 'actor-y')}
                        ${createSettingsInput({
                            id: 'actor-y',
                            type: 'number',
                            value: actor.y || 0,
                            placeholder: '0'
                        })}
                    `)}
                `, { columns: 2 })}
            `))}
            
            ${createSettingsSection('Size', createSettingsFormGroup(`
                ${createSettingsGrid(`
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Width:', 'actor-width')}
                        ${createSettingsInput({
                            id: 'actor-width',
                            type: 'number',
                            value: actor.width || 32,
                            placeholder: '32'
                        })}
                    `)}
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Height:', 'actor-height')}
                        ${createSettingsInput({
                            id: 'actor-height',
                            type: 'number',
                            value: actor.height || 32,
                            placeholder: '32'
                        })}
                    `)}
                `, { columns: 2 })}
            `))}
            
            ${createSettingsSection('Appearance', createSettingsFormGroup(`
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Color:', 'actor-color')}
                    ${createSettingsInput({
                        id: 'actor-color',
                        type: 'color',
                        value: actor.color || '#3B82F6'
                    })}
                `)}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Image Path:', 'actor-imgSrc')}
                    ${createSettingsInput({
                        id: 'actor-imgSrc',
                        type: 'text',
                        value: (actor.imgSrc !== null && actor.imgSrc !== undefined) ? actor.imgSrc : '',
                        placeholder: 'path/to/image.png'
                    })}
                `)}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Category:', 'actor-category')}
                    ${createSettingsInput({
                        id: 'actor-category',
                        type: 'text',
                        value: (actor.category !== null && actor.category !== undefined) ? actor.category : '',
                        placeholder: 'Category name'
                    })}
                `)}
            `))}
        `, { gap: '1.5rem' });
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

    apply() {
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

        Logger.ui.debug(`Applied changes to actor: ${this.currentActor.name}`);
        
        // Reset change tracking (state 3 - temporary window state cleared)
        this.hasChanges = false;
        
        // Close the window
        this.hide();
    }

    /**
     * Cleanup and destroy window
     */
    destroy() {
        Logger.ui.debug('Destroying ActorPropertiesWindow');
        
        // Clear references
        this.currentActor = null;
        this.stateManager = null;
        this.levelEditor = null;
        
        // Call parent destroy
        super.destroy();
        
        Logger.ui.debug('ActorPropertiesWindow destroyed');
    }
}

