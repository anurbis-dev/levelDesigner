/**
 * Asset identity / size / appearance / meta (live commit via AssetManager).
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
    patchEditingAsset,
    resolveAssetImageSrc
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

        const tagsStr = Array.isArray(asset.tags) ? asset.tags.join(', ') : '';
        const imgDisplay = resolveAssetImageSrc(asset) || '';
        const dirty = asset.properties?.hasUnsavedChanges === true;
        const temp = asset.properties?.isTemporary === true;

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
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Id:', 'ae-id')}
                    ${createSettingsInput({ id: 'ae-id', type: 'text', value: asset.id || '', readonly: true })}
                `)}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Path:', 'ae-path')}
                    ${createSettingsInput({ id: 'ae-path', type: 'text', value: asset.path || '', readonly: true })}
                `)}
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
                        value: imgDisplay,
                        placeholder: './content/.../image.png'
                    })}
                `)}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Category:', 'ae-category')}
                    ${createSettingsInput({
                        id: 'ae-category',
                        type: 'text',
                        value: (asset.category != null) ? asset.category : '',
                        placeholder: 'Category'
                    })}
                `)}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel('Tags (comma):', 'ae-tags')}
                    ${createSettingsInput({
                        id: 'ae-tags',
                        type: 'text',
                        value: tagsStr,
                        placeholder: 'enemy, flora'
                    })}
                `)}
            `))}
            ${createSettingsSection('Status', `
                <div style="font-size:11px;color:var(--ui-text-color,#9ca3af);line-height:1.5;">
                    Dirty: <strong style="color:${dirty ? '#fbbf24' : '#6b7280'}">${dirty ? 'yes' : 'no'}</strong>
                    · Temporary: <strong>${temp ? 'yes' : 'no'}</strong>
                    · Components: <strong>${(asset.components || []).length}</strong>
                </div>
            `)}
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
            const tagsRaw = this.container.querySelector('#ae-tags')?.value || '';
            const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
            patchEditingAsset(this.levelEditor, assetId, {
                name,
                width: Number.isFinite(width) ? width : 32,
                height: Number.isFinite(height) ? height : 32,
                color,
                imgSrc: imgRaw === '' ? null : imgRaw,
                category,
                tags
            });
            this.levelEditor?.dockManager?.syncAssetEditorTitle?.();
        };

        ['ae-name', 'ae-width', 'ae-height', 'ae-color', 'ae-imgSrc', 'ae-category', 'ae-tags'].forEach((id) => {
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
