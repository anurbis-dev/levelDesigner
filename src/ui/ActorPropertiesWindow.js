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
import { NumericInput } from '../utils/NumericInput.js';
import { COMPONENT_TYPES, COMPONENT_CATEGORY, getComponentTypeById, createComponentStub } from '../constants/ComponentTypes.js';
import { buildTypeIconSvg } from '../constants/AssetTypeIcons.js';

/**
 * Asset Properties Window - extends BaseDialog
 * Provides a modal window for editing asset properties
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
        // Event handlers are now managed by EventHandlerManager via BaseDialog

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
        Logger.ui.info('AssetPropertiesWindow: show() called');
            
            if (actor) {
                this.currentActor = actor;
                // Working copy of components, edited in-place while the dialog is open and
                // only committed to the asset on Apply — Cancel/close simply discards it.
                this._workingComponents = (actor.components || []).map(c => ({ ...c, properties: { ...c.properties } }));
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
        this._workingComponents = null;
    }

    onShow() {
        // Called after dialog is shown
        // Use setTimeout to ensure DOM is fully rendered before saving initial state
        setTimeout(() => {
            // Scrub numerics (createSettingsInput type:number → NumericInput; wire scrub)
            if (this.overlay) NumericInput.wireAll(this.overlay);
            this.saveInitialState();
            this.hasChanges = false;
            this.updateApplyButton();
            this.setupChangeListeners();
            this.setupComponentsListeners();
            // Event handlers will be set up automatically by EventHandlerManager via BaseDialog
        }, 0);
    }

    onHide() {
        // Called after dialog is hidden
        Logger.ui.info('AssetPropertiesWindow: Dialog hidden');
    }

    onConfirm() {
        // Called when Apply button is clicked
        this.apply();
    }

    onCancel() {
        // Called when Cancel button is clicked
        // Restore values to initial state before closing
        if (this.initialState) {
            this.restoreInitialState();
        }
        this.hide();
    }

    /**
     * Restore form values to initial state (when window was opened)
     */
    restoreInitialState() {
        if (!this.initialState) return;

        const nameInput = document.getElementById('actor-name');
        const xInput = document.getElementById('actor-x');
        const yInput = document.getElementById('actor-y');
        const widthInput = document.getElementById('actor-width');
        const heightInput = document.getElementById('actor-height');
        const colorInput = document.getElementById('actor-color');
        const imgSrcInput = document.getElementById('actor-imgSrc');
        const categoryInput = document.getElementById('actor-category');

        if (nameInput) nameInput.value = this.initialState.name || '';
        if (xInput) xInput.value = this.initialState.x || 0;
        if (yInput) yInput.value = this.initialState.y || 0;
        if (widthInput) widthInput.value = this.initialState.width || 32;
        if (heightInput) heightInput.value = this.initialState.height || 32;
        if (colorInput) colorInput.value = this.initialState.color || '#3B82F6';
        if (imgSrcInput) imgSrcInput.value = this.initialState.imgSrc || '';
        if (categoryInput) categoryInput.value = this.initialState.category || '';
    }


    renderActorPropertiesContent() {
        if (!this.currentActor) {
            return '<div style="color: var(--ui-text-color, #9ca3af);">No asset selected</div>';
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

            ${createSettingsSection('Components', this.renderComponentsSection())}
        `, { gap: '1.5rem' });
    }

    /**
     * Build the "Components" editor: current component stub list + add-new row.
     * Component runtime behavior is implemented by the game consuming the exported
     * level JSON — the editor only stores { type, enabled, properties } metadata.
     * See src/constants/ComponentTypes.js.
     */
    renderComponentsSection() {
        const options = COMPONENT_TYPES
            .map(c => `<option value="${c.id}">${c.label}</option>`)
            .join('');

        return `
            <div id="actor-components-list" style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
                ${this.renderComponentRows()}
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <select id="actor-add-component-select" style="flex:1; background: var(--ui-input-background, #111827); color: var(--ui-text-color, #d1d5db); border: 1px solid var(--ui-border-color, #374151); border-radius: 4px; padding: 4px 6px;">
                    ${options}
                </select>
                <button id="actor-add-component-btn" type="button" style="padding: 4px 10px; background: var(--ui-accent-color, #2563eb); color: #fff; border-radius: 4px; border: none; cursor: pointer;">+ Add</button>
            </div>
        `;
    }

    /**
     * Render just the component row list (used both for initial render and refresh-in-place
     * after add/remove, so the rest of the form's unsaved edits are left untouched).
     */
    renderComponentRows() {
        const components = this._workingComponents || [];
        if (components.length === 0) {
            return `<div style="font-size:11px; color: var(--ui-text-color, #9ca3af);">No components attached</div>`;
        }

        return components.map(comp => {
            const def = getComponentTypeById(comp.type);
            const label = def ? def.label : comp.type;
            const icon = buildTypeIconSvg(comp.type, COMPONENT_CATEGORY.color, 16);
            return `
                <div class="actor-component-row" data-component-id="${comp.id}" style="display:flex; align-items:center; gap:6px; padding:4px 6px; background: var(--ui-input-background, #111827); border-radius:4px;">
                    <span style="display:flex; flex-shrink:0;">${icon}</span>
                    <span style="flex:1; font-size:12px;">${label}</span>
                    <button type="button" data-remove-component="${comp.id}" title="Remove component" style="background:none; border:none; color: var(--ui-text-color, #9ca3af); cursor:pointer; font-size:14px; line-height:1;">×</button>
                </div>
            `;
        }).join('');
    }

    /**
     * Wire the Add/Remove component controls. Uses event delegation on the list
     * container for removal so newly-added rows don't need re-binding.
     */
    setupComponentsListeners() {
        const addBtn = document.getElementById('actor-add-component-btn');
        const select = document.getElementById('actor-add-component-select');
        const list = document.getElementById('actor-components-list');
        if (!addBtn || !select || !list) return;

        if (addBtn._clickHandler) addBtn.removeEventListener('click', addBtn._clickHandler);
        addBtn._clickHandler = () => {
            const stub = createComponentStub(select.value);
            if (!stub) return;
            this._workingComponents = this._workingComponents || [];
            this._workingComponents.push(stub);
            list.innerHTML = this.renderComponentRows();
            this.updateApplyButton();
        };
        addBtn.addEventListener('click', addBtn._clickHandler);

        if (list._clickHandler) list.removeEventListener('click', list._clickHandler);
        list._clickHandler = (e) => {
            const removeBtn = e.target.closest('[data-remove-component]');
            if (!removeBtn) return;
            const componentId = removeBtn.dataset.removeComponent;
            this._workingComponents = (this._workingComponents || []).filter(c => c.id !== componentId);
            list.innerHTML = this.renderComponentRows();
            this.updateApplyButton();
        };
        list.addEventListener('click', list._clickHandler);
    }

    /**
     * Get numeric value from input field
     * @private
     */
    _getNumericValue(id, defaultVal) {
        const value = parseFloat(document.getElementById(id)?.value);
        return isNaN(value) ? defaultVal : value;
    }

    /**
     * Save initial state of all properties
     */
    saveInitialState() {
        this.initialState = {
            name: document.getElementById('actor-name')?.value || '',
            x: this._getNumericValue('actor-x', 0),
            y: this._getNumericValue('actor-y', 0),
            width: this._getNumericValue('actor-width', 32),
            height: this._getNumericValue('actor-height', 32),
            color: document.getElementById('actor-color')?.value || '#3B82F6',
            imgSrc: document.getElementById('actor-imgSrc')?.value || '',
            category: document.getElementById('actor-category')?.value || '',
            componentsSignature: JSON.stringify(this._workingComponents || [])
        };

        Logger.ui.debug('Initial state saved:', this.initialState);
    }

    /**
     * Check if current values differ from initial state
     */
    checkForChanges() {
        if (!this.initialState) return false;

        const normalizeColor = (c) => (c || '').toUpperCase().trim();
        const normalizeString = (s) => (s || '').trim();
        const normalizeImgSrc = (src) => (src === null || src === undefined || src === '') ? null : src;

        const name = normalizeString(document.getElementById('actor-name')?.value || '');
        const width = this._getNumericValue('actor-width', 32);
        const height = this._getNumericValue('actor-height', 32);
        const color = normalizeColor(document.getElementById('actor-color')?.value || '#3B82F6');
        const imgSrcValue = document.getElementById('actor-imgSrc')?.value || '';
        const imgSrc = normalizeImgSrc(imgSrcValue === '' ? null : imgSrcValue);
        const category = normalizeString(document.getElementById('actor-category')?.value || '');

        // Compare with normalized initial state values
        const initialWidth = Number(this.initialState.width || 32);
        const initialHeight = Number(this.initialState.height || 32);
        
        return (
            name !== normalizeString(this.initialState.name || '') ||
            width !== initialWidth ||
            height !== initialHeight ||
            color !== normalizeColor(this.initialState.color || '#3B82F6') ||
            imgSrc !== normalizeImgSrc(this.initialState.imgSrc) ||
            category !== normalizeString(this.initialState.category || '') ||
            JSON.stringify(this._workingComponents || []) !== (this.initialState.componentsSignature || '[]')
        );
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
        if (!this.currentActor) {
            Logger.ui.warn('ActorPropertiesWindow: apply() - no currentActor');
            return;
        }

        const name = document.getElementById('actor-name')?.value || '';
        const x = parseFloat(document.getElementById('actor-x')?.value) || 0;
        const y = parseFloat(document.getElementById('actor-y')?.value) || 0;
        const width = parseFloat(document.getElementById('actor-width')?.value) || 32;
        const height = parseFloat(document.getElementById('actor-height')?.value) || 32;
        const color = document.getElementById('actor-color')?.value || '#3B82F6';
        const imgSrcValue = document.getElementById('actor-imgSrc')?.value || '';
        const imgSrc = imgSrcValue === '' ? null : imgSrcValue;
        const category = document.getElementById('actor-category')?.value || '';

        // Check if there are actual changes from initial state (when window was opened)
        // This handles cases where user changed values but then reverted them back
        if (!this.checkForChanges()) {
            // No changes from initial state - close without update
            this.hide();
            return;
        }

        // Create updated data object (state 2 - current editor state)
        // Note: x and y are position properties for objects on level, not asset properties
        // They should not be included in asset update as they don't affect hasUnsavedChanges
        const updatedData = {
            name: name,
            width: width,
            height: height,
            color: color,
            imgSrc: imgSrc,
            category: category,
            components: this._workingComponents || []
        };

        // Update in asset manager
        // AssetManager will compare with original state and set hasUnsavedChanges flag
        const assetManager = this.levelEditor?.assetManager || this.levelEditor?.assetPanel?.assetManager;
        
        if (assetManager) {
            const success = assetManager.updateAsset(this.currentActor.id, updatedData);
            if (!success) {
                Logger.ui.error('ActorPropertiesWindow: Failed to update asset in AssetManager');
                return;
            }
            
            // AssetManager.updateAsset() already calls stateManager.notify('assetsChanged')
            // which triggers AssetPanel re-render via subscription
        } else {
            Logger.ui.warn('ActorPropertiesWindow: No assetManager available');
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
        Logger.ui.debug('Destroying AssetPropertiesWindow');
        
        // Clear references
        this.currentActor = null;
        this.stateManager = null;
        this.levelEditor = null;
        this._workingComponents = null;

        // Call parent destroy
        super.destroy();
        
        Logger.ui.debug('AssetPropertiesWindow destroyed');
    }
}

