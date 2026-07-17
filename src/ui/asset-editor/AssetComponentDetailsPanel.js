/**
 * Selected component: enabled + typed property form (RUNTIME_SCHEMA fields).
 */
import { getComponentTypeById } from '../../constants/ComponentTypes.js';
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
        this._unsub = subscribeAssetEditor(stateManager, () => this.render());
        this.container.style.cssText = 'overflow:auto;padding:8px;font-size:12px;height:100%;box-sizing:border-box;';
        this.render();
    }

    render() {
        const asset = getEditingAsset(this.levelEditor);
        if (!asset) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">No asset selected</div>';
            return;
        }
        const compId = getEditingComponentId(this.levelEditor);
        if (!compId) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">Select a component in the Components panel</div>';
            return;
        }
        const comp = (asset.components || []).find((c) => c.id === compId);
        if (!comp) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">Component not found</div>';
            return;
        }

        const def = getComponentTypeById(comp.type);
        const label = def ? def.label : comp.type;
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
     * @param {import('../../constants/ComponentPropertySchema.js').CompField} field
     * @param {object} props
     * @private
     */
    _fieldHtml(field, props) {
        const val = readFieldValue(field, props);
        const id = `ae-cf-${field.key}`;
        if (field.kind === 'bool') {
            return `
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" data-field="${field.key}" class="ae-cf" id="${id}" ${val ? 'checked' : ''} />
                    <span>${this._esc(field.label)}</span>
                </label>
            `;
        }
        if (field.kind === 'json') {
            return `
                <div>
                    <label for="${id}" style="display:block;font-size:11px;margin-bottom:2px;color:var(--ui-text-color,#9ca3af);">${this._esc(field.label)}</label>
                    <textarea data-field="${field.key}" class="ae-cf" id="${id}" rows="6"
                        style="width:100%;box-sizing:border-box;font-family:monospace;font-size:11px;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:6px;">${this._esc(formatFieldValue(field, val))}</textarea>
                    <div class="ae-field-error" data-err-for="${field.key}" style="color:#f87171;font-size:11px;min-height:1em;"></div>
                </div>
            `;
        }
        const inputType = field.kind === 'number' ? 'number' : 'text';
        return `
            <div>
                <label for="${id}" style="display:block;font-size:11px;margin-bottom:2px;color:var(--ui-text-color,#9ca3af);">${this._esc(field.label)}</label>
                <input type="${inputType}" data-field="${field.key}" class="ae-cf" id="${id}"
                    value="${this._esc(formatFieldValue(field, val))}"
                    style="width:100%;box-sizing:border-box;background:var(--ui-input-background,#111827);color:var(--ui-text-color,#d1d5db);border:1px solid var(--ui-border-color,#374151);border-radius:4px;padding:4px 6px;" />
                <div class="ae-field-error" data-err-for="${field.key}" style="color:#f87171;font-size:11px;min-height:1em;"></div>
            </div>
        `;
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
            patchEditingComponent(this.levelEditor, assetId, componentId, (c) => {
                c.enabled = !!enabled.checked;
                return c;
            });
        });

        if (!schema) {
            const ta = this.container.querySelector('.ae-raw-props');
            const err = this.container.querySelector('.ae-field-error');
            ta?.addEventListener('change', () => {
                try {
                    const parsed = JSON.parse(ta.value || '{}');
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        if (err) err.textContent = 'Properties must be a JSON object';
                        return;
                    }
                    if (err) err.textContent = '';
                    patchEditingComponent(this.levelEditor, assetId, componentId, (c) => {
                        c.properties = parsed;
                        return c;
                    });
                } catch (e) {
                    if (err) err.textContent = e.message || 'Invalid JSON';
                }
            });
            return;
        }

        this.container.querySelectorAll('.ae-cf').forEach((el) => {
            const key = el.dataset.field;
            const field = schema.find((f) => f.key === key);
            if (!field) return;
            const apply = () => {
                const raw = field.kind === 'bool' ? el.checked : el.value;
                const parsed = parseFieldInput(field, raw);
                const errEl = this.container.querySelector(`[data-err-for="${key}"]`);
                if (!parsed.ok) {
                    if (errEl) errEl.textContent = parsed.error || 'Invalid';
                    return;
                }
                if (errEl) errEl.textContent = '';
                patchEditingComponent(this.levelEditor, assetId, componentId, (c) => {
                    const next = { ...(c.properties || {}) };
                    if (parsed.value === null && (field.key === 'width' || field.key === 'height')) {
                        delete next[field.key];
                    } else {
                        next[field.key] = parsed.value;
                    }
                    c.properties = next;
                    return c;
                });
            };
            el.addEventListener('change', apply);
            if (field.kind === 'bool') el.addEventListener('input', apply);
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
