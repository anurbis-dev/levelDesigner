/**
 * Asset identity / size / appearance form (live commit via AssetManager).
 */
import { NumericInput } from '../../utils/NumericInput.js';
import {
    createSettingsSection,
    createSettingsFormGroup,
    createSettingsGrid,
    createSettingsInput,
    createSettingsLabel
} from '../panel-structures/SettingsSectionConstructor.js';
import {
    getEditingAsset,
    subscribeAssetEditor,
    patchEditingAsset
} from './AssetEditorContext.js';

export class AssetIdentityPanel {
    /**
     * @param {HTMLElement} container
     * @param {object} stateManager
     * @param {object} levelEditor
     * @param {{ instanceKey?: string, isPrimary?: boolean }} [options]
     */
    constructor(container, stateManager, levelEditor, options = {}) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.instanceKey = options.instanceKey || null;
        this._unsub = subscribeAssetEditor(stateManager, () => this.render());
        this.container.style.cssText = 'overflow:auto;padding:8px;font-size:12px;height:100%;box-sizing:border-box;';
        this.render();
    }

    render() {
        const asset = getEditingAsset(this.levelEditor);
        if (!asset) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);padding:8px;">No asset selected</div>';
            return;
        }

        this.container.innerHTML = createSettingsFormGroup(`
            ${createSettingsSection('Basic', createSettingsFormGroup(`
                ${createSettingsGrid(`
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Name:', 'ae-name')}
                        ${createSettingsInput({ id: 'ae-name', type: 'text', value: asset.name || '', placeholder: 'Asset name' })}
                    `)}
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Type:', 'ae-type')}
                        ${createSettingsInput({ id: 'ae-type', type: 'text', value: asset.type || '', readonly: true })}
                    `)}
                `, { columns: 2 })}
            `))}
            ${createSettingsSection('Size', createSettingsFormGroup(`
                ${createSettingsGrid(`
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Width:', 'ae-width')}
                        ${createSettingsInput({ id: 'ae-width', type: 'number', value: asset.width ?? 32, placeholder: '32' })}
                    `)}
                    ${createSettingsFormGroup(`
                        ${createSettingsLabel('Height:', 'ae-height')}
                        ${createSettingsInput({ id: 'ae-height', type: 'number', value: asset.height ?? 32, placeholder: '32' })}
                    `)}
                `, { columns: 2 })}
            `))}
            ${createSettingsSection('Appearance', createSettingsFormGroup(`
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Color:', 'ae-color')}
                    ${createSettingsInput({ id: 'ae-color', type: 'color', value: asset.color || '#3B82F6' })}
                `)}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Image Path:', 'ae-imgSrc')}
                    ${createSettingsInput({
                        id: 'ae-imgSrc',
                        type: 'text',
                        value: asset.imgSrc != null ? asset.imgSrc : '',
                        placeholder: 'path/to/image.png'
                    })}
                `)}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Category:', 'ae-category')}
                    ${createSettingsInput({
                        id: 'ae-category',
                        type: 'text',
                        value: asset.category != null ? asset.category : '',
                        placeholder: 'Category'
                    })}
                `)}
            `))}
        `, { gap: '1rem' });

        NumericInput.wireAll(this.container);
        this._bind(asset.id);
    }

    /**
     * @param {string} assetId
     * @private
     */
    _bind(assetId) {
        const commit = () => {
            const name = this.container.querySelector('#ae-name')?.value || '';
            const width = parseFloat(this.container.querySelector('#ae-width')?.value);
            const height = parseFloat(this.container.querySelector('#ae-height')?.value);
            const color = this.container.querySelector('#ae-color')?.value || '#3B82F6';
            const imgRaw = this.container.querySelector('#ae-imgSrc')?.value || '';
            const category = this.container.querySelector('#ae-category')?.value || '';
            patchEditingAsset(this.levelEditor, assetId, {
                name,
                width: Number.isFinite(width) ? width : 32,
                height: Number.isFinite(height) ? height : 32,
                color,
                imgSrc: imgRaw === '' ? null : imgRaw,
                category
            });
            this.levelEditor?.dockManager?.syncAssetEditorTitle?.();
        };

        ['ae-name', 'ae-width', 'ae-height', 'ae-color', 'ae-imgSrc', 'ae-category'].forEach((id) => {
            const el = this.container.querySelector(`#${id}`);
            if (!el) return;
            el.addEventListener('change', commit);
            el.addEventListener('input', () => {
                if (id === 'ae-color') commit();
            });
        });
    }

    destroy() {
        this._unsub?.();
        this._unsub = null;
        this.container.innerHTML = '';
        this.levelEditor = null;
        this.stateManager = null;
    }
}
