/**
 * Asset identity / size / meta (live commit).
 * Disk path only on type=image; composites show linked Image asset name.
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
    resolveAssetImageSrc,
    isImageAsset,
    getImageDiskSrc,
    findSpriteComponent
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
        this._selfPatch = false;
        this._renderedAssetId = null;
        this._unsub = subscribeAssetEditor(stateManager, () => this._onContext());
        this.container.style.cssText = 'overflow:auto;padding:8px;font-size:12px;height:100%;box-sizing:border-box;';
        this.render();
    }

    /** @private */
    _onContext() {
        if (this._selfPatch) return;
        const asset = getEditingAsset(this.levelEditor);
        const id = asset?.id || null;
        if (id !== this._renderedAssetId) {
            this.render();
            return;
        }
        if (this.container.contains(document.activeElement)) {
            this._refreshVisualLine(asset);
            return;
        }
        this.render();
    }

    /**
     * @param {object|null} asset
     * @private
     */
    _refreshVisualLine(asset) {
        const el = this.container.querySelector('#ae-visual-readonly');
        if (!el || !asset) return;
        el.textContent = this._visualSummary(asset);
    }

    /**
     * @param {object} asset
     * @private
     */
    _visualSummary(asset) {
        const am = this.levelEditor?.assetManager;
        if (isImageAsset(asset)) {
            return getImageDiskSrc(asset) || '(no disk path)';
        }
        const spr = findSpriteComponent(asset.components);
        const refId = spr?.properties?.imageAssetId;
        if (refId && am?.getAsset) {
            const img = am.getAsset(refId);
            if (img) return `Image: ${img.name || img.id}`;
            return `Image id: ${refId} (missing)`;
        }
        if (!spr) return '(no Sprite component)';
        return '(Sprite: pick Image asset in Details)';
    }

    render() {
        const asset = getEditingAsset(this.levelEditor);
        this._renderedAssetId = asset?.id || null;
        if (!asset) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);padding:8px;">No asset selected</div>';
            return;
        }

        const tagsStr = Array.isArray(asset.tags) ? asset.tags.join(', ') : '';
        const dirty = asset.properties?.hasUnsavedChanges === true;
        const temp = asset.properties?.isTemporary === true;
        const compCount = (asset.components || []).length;
        const isImg = isImageAsset(asset);
        const visualLabel = isImg ? 'Disk path (Image):' : 'Visual:';
        const visualHint = isImg
            ? 'Only Image assets store a file path. Other assets use Sprite → Image.'
            : 'Texture comes from Sprite → Image asset. Edit link in Components / Details.';
        const visualValue = this._visualSummary(asset);
        const resolved = resolveAssetImageSrc(asset, this.levelEditor) || '';

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
                ${isImg ? createSettingsFormGroup(`
                    ${createSettingsLabel('Disk path:', 'ae-imgSrc')}
                    ${createSettingsInput({
                        id: 'ae-imgSrc',
                        type: 'text',
                        value: getImageDiskSrc(asset) || '',
                        placeholder: './content/.../file.png'
                    })}
                `) : ''}
                ${createSettingsFormGroup(`
                    ${createSettingsLabel(visualLabel, 'ae-visual-readonly')}
                    <div id="ae-visual-readonly" style="font-size:11px;color:var(--ui-text-color,#9ca3af);word-break:break-all;padding:4px 0;">${this._esc(visualValue)}</div>
                    ${resolved && !isImg ? `<div style="font-size:10px;color:#6b7280;word-break:break-all;">resolved: ${this._esc(resolved)}</div>` : ''}
                    <div style="font-size:10px;color:#6b7280;">${visualHint}</div>
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
                    · Components: <strong>${compCount}</strong>
                </div>
            `)}
        `, { gap: '1rem' });

        NumericInput.wireAll(this.container);
        this._bind(asset.id, isImg);
    }

    /**
     * @param {string} assetId
     * @param {boolean} isImg
     * @private
     */
    _bind(assetId, isImg) {
        const commit = () => {
            const name = this.container.querySelector('#ae-name')?.value || '';
            const width = parseFloat(this.container.querySelector('#ae-width')?.value);
            const height = parseFloat(this.container.querySelector('#ae-height')?.value);
            const color = this.container.querySelector('#ae-color')?.value || '#3B82F6';
            const category = this.container.querySelector('#ae-category')?.value || '';
            const tagsRaw = this.container.querySelector('#ae-tags')?.value || '';
            const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
            /** @type {object} */
            const patch = {
                name,
                width: Number.isFinite(width) ? width : 32,
                height: Number.isFinite(height) ? height : 32,
                color,
                category,
                tags
            };
            if (isImg) {
                const disk = this.container.querySelector('#ae-imgSrc')?.value?.trim() || null;
                patch.imgSrc = disk;
            }
            this._selfPatch = true;
            try {
                patchEditingAsset(this.levelEditor, assetId, patch);
            } finally {
                this._selfPatch = false;
            }
            this.levelEditor?.dockManager?.syncAssetEditorTitle?.();
            this._refreshVisualLine(getEditingAsset(this.levelEditor));
        };

        const ids = ['ae-name', 'ae-width', 'ae-height', 'ae-color', 'ae-category', 'ae-tags'];
        if (isImg) ids.push('ae-imgSrc');
        ids.forEach((id) => {
            const el = this.container.querySelector(`#${id}`);
            if (!el) return;
            el.addEventListener('change', commit);
            if (id === 'ae-color' || id === 'ae-width' || id === 'ae-height') {
                el.addEventListener('input', commit);
            }
        });
    }

    /** @private */
    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    destroy() {
        this._unsub?.();
        this._unsub = null;
        this.container.innerHTML = '';
        this.levelEditor = null;
        this.stateManager = null;
    }
}
