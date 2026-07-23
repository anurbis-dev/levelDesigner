/**
 * Selected component: enabled + typed property form (RUNTIME_SCHEMA fields).
 * Live input commits so Preview/info overlay update in realtime; self-patches skip form rebuild.
 */
import {
    getComponentTypeById,
    buildComponentDisplayLabels
} from '../../constants/ComponentTypes.js';
import {
    getComponentFields,
    readFieldValue,
    parseFieldInput,
    formatFieldValue
} from '../../constants/ComponentPropertySchema.js';
import { NumericInput } from '../../utils/NumericInput.js';
import {
    getEditingAsset,
    getEditingComponentId,
    subscribeAssetEditor,
    patchEditingComponent
} from './AssetEditorContext.js';
import { wireAssetDropTarget } from '../AssetRefControl.js';

export class AssetComponentDetailsPanel {
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
        /** @type {boolean} skip full re-render while we own a live patch */
        this._selfPatch = false;
        this._renderedKey = null;
        this._unsub = subscribeAssetEditor(stateManager, () => this._onContext());
        this.container.style.cssText = 'overflow:auto;padding:8px;font-size:12px;height:100%;box-sizing:border-box;';
        this.render();
    }

    /** @private */
    _onContext() {
        if (this._selfPatch) return;
        const asset = getEditingAsset(this.levelEditor);
        const compId = getEditingComponentId(this.levelEditor);
        const key = `${asset?.id || ''}|${compId || ''}`;
        // Selection/asset change → always rebuild form
        if (key !== this._renderedKey) {
            this.render();
            return;
        }
        // Same selection: live field edits already own the DOM; don't steal focus
        if (this.container.contains(document.activeElement)) return;
        this.render();
    }

    render() {
        const asset = getEditingAsset(this.levelEditor);
        if (!asset) {
            this._renderedKey = '|';
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">No asset selected</div>';
            return;
        }
        const compId = getEditingComponentId(this.levelEditor);
        this._renderedKey = `${asset.id}|${compId || ''}`;
        if (!compId) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">Select a component in the Components panel</div>';
            return;
        }
        const comp = (asset.components || []).find((c) => c.id === compId);
        if (!comp) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">Component not found</div>';
            return;
        }

        const labels = buildComponentDisplayLabels(asset.components || []);
        const label = labels.get(comp.id)
            || getComponentTypeById(comp.type)?.label
            || comp.type;
        const def = getComponentTypeById(comp.type);
        const desc = def?.description || '';
        const schema = getComponentFields(comp.type);
        const props = comp.properties || {};

        let fieldsHtml = '';
        if (schema && schema.length > 0) {
            fieldsHtml = schema.map((field) => this._fieldHtml(field, props)).join('');
        } else if (schema && schema.length === 0) {
            fieldsHtml = `<div style="color:var(--ui-text-color,#6b7280);font-size:11px;">No editable properties for this type (runtime uses entity transform).</div>`;
        } else {
            // Unknown / not-yet-schematized: show raw properties + free JSON
            const raw = formatFieldValue({ kind: 'json' }, props);
            fieldsHtml = `
                <div style="color:var(--ui-text-color,#6b7280);font-size:11px;margin-bottom:6px;">
                    No typed schema yet — edit raw properties JSON.
                </div>
                <label style="display:block;font-size:11px;margin-bottom:4px;color:var(--ui-text-color,#9ca3af);">properties</label>
                <textarea class="ae-raw-props" rows="8"
                    style="width:100%;box-sizing:border-box;font-family:monospace;font-size:11px;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:6px;">${this._esc(raw)}</textarea>
                <div class="ae-field-error" style="color:#f87171;font-size:11px;min-height:1em;"></div>
            `;
        }

        // Extra keys not in schema
        let extraHtml = '';
        if (schema) {
            const known = new Set(schema.map((f) => f.key));
            const extras = Object.keys(props).filter((k) => !known.has(k));
            if (extras.length) {
                extraHtml = `
                    <div style="margin-top:10px;font-size:11px;color:var(--ui-text-color,#6b7280);">
                        Extra keys (read-only): ${extras.map((k) => `<code>${this._esc(k)}</code>`).join(', ')}
                    </div>
                    <pre style="margin-top:4px;font-size:10px;background:#0f172a;padding:6px;border-radius:4px;overflow:auto;max-height:120px;">${this._esc(JSON.stringify(
                        Object.fromEntries(extras.map((k) => [k, props[k]])),
                        null,
                        2
                    ))}</pre>
                `;
            }
        }

        this.container.innerHTML = `
            <div style="font-weight:600;margin-bottom:4px;">${this._esc(label)}</div>
            ${desc ? `<div style="font-size:11px;color:var(--ui-text-color,#9ca3af);margin-bottom:8px;">${this._esc(desc)}</div>` : ''}
            <div style="font-size:10px;color:var(--ui-text-color,#6b7280);margin-bottom:8px;">type: ${this._esc(comp.type)} · id: ${this._esc(comp.id)}</div>
            <label style="display:flex;align-items:center;gap:6px;margin-bottom:10px;cursor:pointer;">
                <input type="checkbox" class="ae-comp-enabled" ${comp.enabled !== false ? 'checked' : ''} />
                <span>Enabled</span>
            </label>
            <div class="ae-comp-fields" style="display:flex;flex-direction:column;gap:8px;">
                ${fieldsHtml}
            </div>
            ${extraHtml}
        `;

        NumericInput.wireAll(this.container);
        this._bind(asset.id, comp.id, schema);
    }

    /**
     * Dynamic option source for 'idMultiSelect' fields — mirrors the assetRef pattern
     * (live list from editor state) but for level-scope id catalogs instead of assets.
     * @param {import('../../constants/ComponentPropertySchema.js').CompField} field
     * @returns {{id:string,label:string}[]}
     * @private
     */
    _dynamicIdOptions(field) {
        if (field.source === 'canvases') {
            return (this.levelEditor?.level?.canvases || []).map((c) => ({ id: c.id, label: c.name || c.id }));
        }
        return [];
    }

    /**
     * @param {import('../../constants/ComponentPropertySchema.js').CompField} field
     * @param {object} props
     * @private
     */
    _fieldHtml(field, props) {
        const val = readFieldValue(field, props);
        const id = `ae-cf-${field.key}`;
        const labelStyle = 'display:block;font-size:11px;margin-bottom:2px;color:var(--ui-text-color,#9ca3af);';
        const err = `<div class="ae-field-error" data-err-for="${field.key}" style="color:#f87171;font-size:11px;min-height:1em;"></div>`;
        if (field.kind === 'assetRef') {
            const types = field.assetTypes || ['image'];
            const am = this.levelEditor?.assetManager;
            const list = (am?.getAllAssets?.() || []).filter((a) => types.includes(a.type));
            const cur = String(val ?? field.default ?? '');
            const opts = [
                `<option value="">(none)</option>`,
                ...list.map((a) => {
                    const sel = a.id === cur ? ' selected' : '';
                    return `<option value="${this._esc(a.id)}"${sel}>${this._esc(a.name || a.id)}</option>`;
                })
            ].join('');
            const typeHint = types.join('/');
            return `
                <div class="asset-ref-drop" data-asset-ref-field="${field.key}" title="Pick or drop an asset from Assets panel">
                    <label for="${id}" style="${labelStyle}">${this._esc(field.label)}</label>
                    <select data-field="${field.key}" class="ae-cf" id="${id}"
                        style="width:100%;box-sizing:border-box;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:4px 6px;">
                        ${opts}
                    </select>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;">drop ${this._esc(typeHint)} asset here</div>
                    ${err}
                </div>
            `;
        }
        if (field.kind === 'bool') {
            return `
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" data-field="${field.key}" class="ae-cf" id="${id}" ${val ? 'checked' : ''} />
                    <span>${this._esc(field.label)}</span>
                </label>
            `;
        }
        if (field.kind === 'idMultiSelect') {
            const current = new Set(Array.isArray(val) ? val : (field.default || []));
            const options = this._dynamicIdOptions(field);
            const rows = options.length
                ? options.map((o) => `
                    <label style="display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer;">
                        <input type="checkbox" class="ae-cf-multi" data-multi-field="${field.key}" value="${this._esc(o.id)}" ${current.has(o.id) ? 'checked' : ''} />
                        <span>${this._esc(o.label)}</span>
                    </label>
                `).join('')
                : `<div style="color:var(--ui-text-color,#6b7280);font-size:11px;">None defined yet</div>`;
            return `
                <div data-multi-container="${field.key}">
                    <label style="${labelStyle}">${this._esc(field.label)}</label>
                    <div style="display:flex;flex-direction:column;border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:4px 6px;max-height:120px;overflow:auto;">
                        ${rows}
                    </div>
                    ${err}
                </div>
            `;
        }
        if (field.kind === 'select') {
            const opts = (field.options || []).map((o) => {
                const sel = String(val ?? field.default ?? '') === o.value ? ' selected' : '';
                return `<option value="${this._esc(o.value)}"${sel}>${this._esc(o.label)}</option>`;
            }).join('');
            return `
                <div>
                    <label for="${id}" style="${labelStyle}">${this._esc(field.label)}</label>
                    <select data-field="${field.key}" class="ae-cf" id="${id}"
                        style="width:100%;box-sizing:border-box;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:4px 6px;">
                        ${opts}
                    </select>
                    ${err}
                </div>
            `;
        }
        if (field.kind === 'color') {
            const hex = (typeof val === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val))
                ? val
                : '#fbbf24';
            const empty = !val;
            return `
                <div>
                    <label for="${id}" style="${labelStyle}">${this._esc(field.label)}</label>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input type="color" data-field="${field.key}" class="ae-cf ae-cf-color" id="${id}"
                            value="${this._esc(hex)}" ${empty ? 'data-empty="1"' : ''}
                            style="width:40px;height:28px;padding:0;border:1px solid var(--ui-border-color,#374151);border-radius:4px;background:transparent;cursor:pointer;" />
                        <button type="button" class="ae-cf-color-clear" data-for="${field.key}"
                            style="padding:3px 8px;font-size:11px;border-radius:4px;border:1px solid var(--ui-border-color,#374151);background:var(--ui-input-background,#111827);color:var(--ui-text-color,#9ca3af);cursor:pointer;">
                            Auto
                        </button>
                        <span style="font-size:10px;color:var(--ui-text-color,#6b7280);">${empty ? 'palette' : this._esc(hex)}</span>
                    </div>
                    ${err}
                </div>
            `;
        }
        if (field.kind === 'json') {
            return `
                <div>
                    <label for="${id}" style="${labelStyle}">${this._esc(field.label)}</label>
                    <textarea data-field="${field.key}" class="ae-cf" id="${id}" rows="6"
                        style="width:100%;box-sizing:border-box;font-family:monospace;font-size:11px;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:6px;">${this._esc(formatFieldValue(field, val))}</textarea>
                    ${err}
                </div>
            `;
        }
        const inputType = field.kind === 'number' ? 'number' : 'text';
        return `
            <div>
                <label for="${id}" style="${labelStyle}">${this._esc(field.label)}</label>
                <input type="${inputType}" data-field="${field.key}" class="ae-cf" id="${id}"
                    value="${this._esc(formatFieldValue(field, val))}"
                    style="width:100%;box-sizing:border-box;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:4px 6px;" />
                ${err}
            </div>
        `;
    }

    /**
     * @param {string} assetId
     * @param {string} componentId
     * @param {Array|null} schema
     * @private
     */
    /**
     * @param {string} assetId
     * @param {string} componentId
     * @param {(c: object) => object} mapFn
     * @private
     */
    /**
     * @param {string} assetId
     * @param {string} componentId
     * @param {(c: object) => object} mapFn
     * @param {{ recordHistory?: boolean }} [opts]
     * @private
     */
    _livePatch(assetId, componentId, mapFn, opts = {}) {
        this._selfPatch = true;
        try {
            patchEditingComponent(this.levelEditor, assetId, componentId, mapFn, opts);
        } finally {
            this._selfPatch = false;
        }
    }

    /**
     * @param {string} assetId
     * @param {string} componentId
     * @param {Array|null} schema
     * @private
     */
    _bind(assetId, componentId, schema) {
        const enabled = this.container.querySelector('.ae-comp-enabled');
        enabled?.addEventListener('change', () => {
            this._livePatch(assetId, componentId, (c) => {
                c.enabled = !!enabled.checked;
                return c;
            });
        });

        if (!schema) {
            const ta = this.container.querySelector('.ae-raw-props');
            const err = this.container.querySelector('.ae-field-error');
            const applyRaw = () => {
                try {
                    const parsed = JSON.parse(ta.value || '{}');
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        if (err) err.textContent = 'Properties must be a JSON object';
                        return;
                    }
                    if (err) err.textContent = '';
                    this._livePatch(assetId, componentId, (c) => {
                        c.properties = parsed;
                        return c;
                    });
                } catch (e) {
                    if (err) err.textContent = e.message || 'Invalid JSON';
                }
            };
            ta?.addEventListener('change', applyRaw);
            return;
        }

        this.container.querySelectorAll('.ae-cf').forEach((el) => {
            const key = el.dataset.field;
            const field = schema.find((f) => f.key === key);
            if (!field) return;
            const apply = (recordHistory = true) => {
                let raw = field.kind === 'bool' ? el.checked : el.value;
                // color: empty means palette default
                if (field.kind === 'color' && el.dataset.empty === '1' && el.type === 'color') {
                    // first interaction with picker clears empty flag via input
                }
                if (field.kind === 'color' && el.type === 'color') {
                    el.dataset.empty = '';
                    raw = el.value;
                }
                const parsed = parseFieldInput(field, raw);
                const errEl = this.container.querySelector(`[data-err-for="${key}"]`);
                if (!parsed.ok) {
                    if (errEl) errEl.textContent = parsed.error || 'Invalid';
                    return;
                }
                if (errEl) errEl.textContent = '';
                this._livePatch(assetId, componentId, (c) => {
                    const next = { ...(c.properties || {}) };
                    if (parsed.value === null && (field.key === 'width' || field.key === 'height' || field.key === 'radius')) {
                        delete next[field.key];
                    } else if (field.kind === 'color' && parsed.value === '') {
                        delete next[field.key];
                    } else {
                        next[field.key] = parsed.value;
                    }
                    // Seed freeform points when switching to freeform with empty points
                    if (field.key === 'shape' && parsed.value === 'freeform') {
                        if (!Array.isArray(next.points) || next.points.length === 0) {
                            const asset = getEditingAsset(this.levelEditor);
                            const aw = Math.max(1, Number(asset?.width) || 32);
                            const ah = Math.max(1, Number(asset?.height) || 32);
                            const ox = Number(next.offsetX) || 0;
                            const oy = Number(next.offsetY) || 0;
                            const w = next.width != null ? Number(next.width) : aw;
                            const h = next.height != null ? Number(next.height) : ah;
                            next.points = [
                                { x: ox, y: oy },
                                { x: ox + w, y: oy },
                                { x: ox + w, y: oy + h },
                                { x: ox, y: oy + h }
                            ];
                        }
                    }
                    c.properties = next;
                    return c;
                }, { recordHistory });
            };
            // Live preview on input; history on change (blur/commit) to avoid per-keystroke stack spam
            if (field.kind === 'json') {
                el.addEventListener('change', () => apply(true));
            } else if (field.kind === 'select' || field.kind === 'assetRef' || field.kind === 'bool') {
                el.addEventListener('change', () => apply(true));
                el.addEventListener('input', () => apply(true));
            } else if (field.kind === 'color') {
                el.addEventListener('input', () => apply(false));
                el.addEventListener('change', () => apply(true));
            } else {
                el.addEventListener('input', () => apply(false));
                el.addEventListener('change', () => apply(true));
            }
            // Assets panel drag-drop onto Sprite.imageAssetId (and any assetRef field)
            if (field.kind === 'assetRef') {
                const dropHost = el.closest('[data-asset-ref-field]') || el;
                wireAssetDropTarget(dropHost, {
                    assetManager: this.levelEditor?.assetManager,
                    assetTypes: field.assetTypes || ['image'],
                    onAssetId: (id) => {
                        if (![...el.options].some((o) => o.value === id)) {
                            const o = document.createElement('option');
                            o.value = id;
                            const asset = this.levelEditor?.assetManager?.getAsset?.(id)
                                || this.levelEditor?.assetManager?.getAssetById?.(id);
                            o.textContent = asset?.name || id;
                            el.appendChild(o);
                        }
                        el.value = id;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
        });

        this.container.querySelectorAll('.ae-cf-color-clear').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.for;
                const field = schema.find((f) => f.key === key);
                if (!field) return;
                const colorEl = this.container.querySelector(`.ae-cf-color[data-field="${key}"]`);
                if (colorEl) colorEl.dataset.empty = '1';
                this._livePatch(assetId, componentId, (c) => {
                    const next = { ...(c.properties || {}) };
                    delete next[key];
                    c.properties = next;
                    return c;
                });
                this.render();
            });
        });

        this.container.querySelectorAll('[data-multi-container]').forEach((box) => {
            const key = box.dataset.multiContainer;
            const field = schema.find((f) => f.key === key);
            if (!field) return;
            const checkboxes = box.querySelectorAll(`.ae-cf-multi[data-multi-field="${key}"]`);
            const apply = () => {
                const values = Array.from(checkboxes).filter((cb) => cb.checked).map((cb) => cb.value);
                this._livePatch(assetId, componentId, (c) => {
                    const next = { ...(c.properties || {}) };
                    if (values.length) next[key] = values;
                    else delete next[key];
                    c.properties = next;
                    return c;
                }, { recordHistory: true });
            };
            checkboxes.forEach((cb) => cb.addEventListener('change', apply));
        });
    }

    /** @private */
    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
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
