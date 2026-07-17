/**
 * Asset components list + Add Component control (live commit).
 */
import {
    COMPONENT_TYPES,
    COMPONENT_CATEGORY,
    getComponentTypeById,
    createComponentStub
} from '../../constants/ComponentTypes.js';
import { buildTypeIconSvg } from '../../constants/AssetTypeIcons.js';
import {
    getEditingAsset,
    getEditingComponentId,
    setEditingComponentId,
    subscribeAssetEditor,
    patchEditingAsset
} from './AssetEditorContext.js';

export class AssetComponentsPanel {
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
        this.container.style.cssText = 'overflow:auto;padding:8px;font-size:12px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;';
        this.render();
    }

    render() {
        const asset = getEditingAsset(this.levelEditor);
        if (!asset) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">No asset selected</div>';
            return;
        }

        const selectedId = getEditingComponentId(this.levelEditor);
        const components = Array.isArray(asset.components) ? asset.components : [];
        const options = COMPONENT_TYPES
            .map((c) => `<option value="${c.id}">${c.label}</option>`)
            .join('');

        const rows = components.length === 0
            ? '<div style="color:var(--ui-text-color,#9ca3af);font-size:11px;padding:8px 0;">No components — use Add Component below</div>'
            : components.map((comp) => {
                const def = getComponentTypeById(comp.type);
                const label = def ? def.label : comp.type;
                const icon = buildTypeIconSvg(comp.type, COMPONENT_CATEGORY.color, 16);
                const sel = comp.id === selectedId
                    ? 'outline:1px solid var(--ui-accent-color,#2563eb);background:var(--ui-active-color,#1e3a5f);'
                    : 'background:var(--ui-input-background,#111827);';
                const en = comp.enabled === false
                    ? '<span style="font-size:10px;color:#6b7280;">off</span>'
                    : '';
                const propCount = comp.properties ? Object.keys(comp.properties).length : 0;
                return `
                    <div class="ae-comp-row" data-component-id="${comp.id}"
                        style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:4px;cursor:pointer;${sel}">
                        <span style="display:flex;flex-shrink:0;">${icon}</span>
                        <span style="flex:1;font-size:12px;min-width:0;">
                            <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</span>
                            <span style="font-size:10px;color:#6b7280;">${comp.type}${propCount ? ` · ${propCount} props` : ''}</span>
                        </span>
                        ${en}
                        <button type="button" data-remove-component="${comp.id}" title="Remove component"
                            style="background:none;border:none;color:var(--ui-text-color,#9ca3af);cursor:pointer;font-size:16px;line-height:1;padding:0 4px;">×</button>
                    </div>`;
            }).join('');

        this.container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px;">
                <div style="font-weight:600;">Components <span style="font-weight:400;color:#6b7280;">(${components.length})</span></div>
            </div>
            <div class="ae-comp-list" style="display:flex;flex-direction:column;gap:4px;flex:1;min-height:0;overflow:auto;margin-bottom:10px;">${rows}</div>
            <div style="border-top:1px solid var(--ui-border-color,#374151);padding-top:8px;flex-shrink:0;">
                <div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">Add Component</div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <select class="ae-add-select" title="Component type"
                        style="flex:1;min-width:0;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:6px 8px;">
                        ${options}
                    </select>
                    <button type="button" class="ae-add-btn" title="Add component to asset"
                        style="padding:6px 12px;background:var(--ui-accent-color,#2563eb);color:#fff;border-radius:4px;border:none;cursor:pointer;white-space:nowrap;font-weight:600;">+ Add</button>
                </div>
            </div>
        `;

        this._bind(asset);
    }

    /**
     * @param {object} asset
     * @private
     */
    _bind(asset) {
        const list = this.container.querySelector('.ae-comp-list');
        const addBtn = this.container.querySelector('.ae-add-btn');
        const select = this.container.querySelector('.ae-add-select');

        list?.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-remove-component]');
            if (removeBtn) {
                e.stopPropagation();
                const id = removeBtn.dataset.removeComponent;
                const next = (asset.components || []).filter((c) => c.id !== id);
                if (getEditingComponentId(this.levelEditor) === id) {
                    setEditingComponentId(this.levelEditor, null);
                }
                patchEditingAsset(this.levelEditor, asset.id, { components: next });
                return;
            }
            const row = e.target.closest('.ae-comp-row');
            if (row?.dataset.componentId) {
                setEditingComponentId(this.levelEditor, row.dataset.componentId);
            }
        });

        addBtn?.addEventListener('click', () => {
            const stub = createComponentStub(select?.value);
            if (!stub) return;
            const next = [...(asset.components || []), stub];
            patchEditingAsset(this.levelEditor, asset.id, { components: next });
            setEditingComponentId(this.levelEditor, stub.id);
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
