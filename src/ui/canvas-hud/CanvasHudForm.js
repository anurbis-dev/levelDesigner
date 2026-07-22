/**
 * Form widgets for CanvasHudPanel (canvas meta + widget fields + binding/action).
 * Pure DOM builders; panel owns commit/history/selection.
 */

import {
    WIDGET_TYPES,
    ANCHOR_OPTIONS,
    BINDING_SOURCE_OPTIONS,
    listVariableNameOptions,
    listCustomEventNameOptions,
    cloneCanvases,
    upsertWidget,
    removeWidget
} from './CanvasHudModel.js';
import { createIdSelect } from '../LevelObjectPicker.js';
import { listItemOptions } from '../items/ItemModel.js';

export const INPUT_CSS = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
export const BTN_CSS = 'background:#374151;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;';

export function fieldLabel(text) {
    const el = document.createElement('div');
    el.style.cssText = 'color:#9ca3af;margin:6px 0 2px;';
    el.textContent = text;
    return el;
}

export function mutedText(text) {
    const el = document.createElement('div');
    el.style.color = '#6b7280';
    el.textContent = text;
    return el;
}

/**
 * @param {{ value: string, placeholder?: string, options: {id:string,label:string}[], onChange: (v:string) => void, listId: string }} opts
 */
export function datalistInput(opts) {
    const wrap = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = opts.value || '';
    input.placeholder = opts.placeholder || '';
    input.setAttribute('list', opts.listId);
    input.style.cssText = INPUT_CSS;
    input.addEventListener('change', () => opts.onChange(input.value.trim()));
    wrap.appendChild(input);

    const datalist = document.createElement('datalist');
    datalist.id = opts.listId;
    for (const o of opts.options || []) {
        const opt = document.createElement('option');
        opt.value = o.id;
        datalist.appendChild(opt);
    }
    wrap.appendChild(datalist);
    return wrap;
}

/**
 * Two number inputs side by side.
 * @param {object} opts
 */
export function numberPairRow(opts) {
    const {
        labelA, labelB, valueA, valueB, onA, onB,
        optional = false, onLiveA = null, onLiveB = null
    } = opts;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';

    const parse = (raw) => {
        const s = raw.trim();
        return s === '' ? (optional ? undefined : 0) : Number(s);
    };

    const colA = document.createElement('div');
    colA.style.flex = '1';
    colA.appendChild(fieldLabel(labelA));
    const inA = document.createElement('input');
    inA.type = 'number';
    inA.value = valueA == null ? '' : String(valueA);
    inA.style.cssText = INPUT_CSS;
    if (onLiveA) inA.addEventListener('input', () => onLiveA(parse(inA.value)));
    inA.addEventListener('change', () => onA(parse(inA.value)));
    colA.appendChild(inA);

    const colB = document.createElement('div');
    colB.style.flex = '1';
    colB.appendChild(fieldLabel(labelB));
    const inB = document.createElement('input');
    inB.type = 'number';
    inB.value = valueB == null ? '' : String(valueB);
    inB.style.cssText = INPUT_CSS;
    if (onLiveB) inB.addEventListener('input', () => onLiveB(parse(inB.value)));
    inB.addEventListener('change', () => onB(parse(inB.value)));
    colB.appendChild(inB);

    wrap.appendChild(colA);
    wrap.appendChild(colB);
    return wrap;
}

/**
 * @param {HTMLElement} formEl
 * @param {object} canvas
 * @param {{ getList: () => object[], commitList: (list: object[]) => void, commitCanvas: (c: object) => void, setSelectedCanvasId: (id: string) => void }} api
 */
export function renderCanvasMeta(formEl, canvas, api) {
    const meta = document.createElement('div');
    meta.style.cssText = 'margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #374151;';

    meta.appendChild(fieldLabel('Canvas id'));
    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.value = canvas.id;
    idInput.style.cssText = INPUT_CSS;
    idInput.addEventListener('change', () => {
        const newId = idInput.value.trim();
        if (!newId || newId === canvas.id) return;
        if (api.getList().some((c) => c.id === newId)) {
            idInput.value = canvas.id;
            return;
        }
        const next = cloneCanvases(api.getList());
        const idx = next.findIndex((c) => c.id === canvas.id);
        if (idx < 0) return;
        next[idx] = { ...next[idx], id: newId };
        api.setSelectedCanvasId(newId);
        api.commitList(next);
    });
    meta.appendChild(idInput);

    meta.appendChild(fieldLabel('Display name'));
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = canvas.name || canvas.id;
    nameInput.style.cssText = INPUT_CSS;
    nameInput.addEventListener('change', () => {
        api.commitCanvas({ ...canvas, name: nameInput.value });
    });
    meta.appendChild(nameInput);

    formEl.appendChild(meta);
}

/**
 * @param {HTMLElement} formEl
 * @param {object} canvas
 * @param {object} widget
 * @param {{
 *   level: object|null|undefined,
 *   nextListId: () => string,
 *   stageLive: (fields: Record<string, unknown>) => void,
 *   commitCanvas: (c: object) => void,
 *   clearSelectedWidget: () => void
 * }} api
 */
export function renderWidgetForm(formEl, canvas, widget, api) {
    const patch = (fields) => {
        api.commitCanvas(upsertWidget(canvas, { ...widget, ...fields }));
    };

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
    const t = document.createElement('span');
    t.style.fontWeight = '600';
    t.textContent = `Widget ${widget.id}`;
    head.appendChild(t);
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete widget';
    del.style.cssText = BTN_CSS;
    del.addEventListener('click', () => {
        api.clearSelectedWidget();
        api.commitCanvas(removeWidget(canvas, widget.id));
    });
    head.appendChild(del);
    formEl.appendChild(head);

    formEl.appendChild(fieldLabel('Type'));
    formEl.appendChild(createIdSelect({
        value: widget.type || 'text',
        emptyLabel: '— type —',
        options: WIDGET_TYPES,
        onChange: (v) => patch({ type: v || 'text' })
    }));

    formEl.appendChild(fieldLabel('Anchor'));
    formEl.appendChild(createIdSelect({
        value: widget.anchor || 'topLeft',
        emptyLabel: '— anchor —',
        options: ANCHOR_OPTIONS,
        onChange: (v) => patch({ anchor: v || 'topLeft' })
    }));

    formEl.appendChild(numberPairRow({
        labelA: 'Offset X',
        labelB: 'Offset Y',
        valueA: widget.offsetX ?? 0,
        valueB: widget.offsetY ?? 0,
        onA: (x) => patch({ offsetX: x }),
        onB: (y) => patch({ offsetY: y }),
        optional: false,
        onLiveA: (x) => api.stageLive({ offsetX: x }),
        onLiveB: (y) => api.stageLive({ offsetY: y })
    }));

    formEl.appendChild(numberPairRow({
        labelA: 'Width (empty = auto)',
        labelB: 'Height (empty = auto)',
        valueA: widget.width,
        valueB: widget.height,
        onA: (v) => patch({ width: v }),
        onB: (v) => patch({ height: v }),
        optional: true,
        onLiveA: (v) => api.stageLive({ width: v }),
        onLiveB: (v) => api.stageLive({ height: v })
    }));

    if (widget.type === 'text' || widget.type === 'button') {
        formEl.appendChild(fieldLabel('Text (fallback if unbound)'));
        const textIn = document.createElement('input');
        textIn.type = 'text';
        textIn.value = widget.text || '';
        textIn.style.cssText = INPUT_CSS;
        textIn.addEventListener('input', () => api.stageLive({ text: textIn.value }));
        textIn.addEventListener('change', () => patch({ text: textIn.value }));
        formEl.appendChild(textIn);
    }

    if (widget.type === 'image') {
        formEl.appendChild(fieldLabel('Image src (URL/path)'));
        const src = document.createElement('input');
        src.type = 'text';
        src.value = widget.imgSrc || '';
        src.style.cssText = INPUT_CSS;
        src.addEventListener('input', () => api.stageLive({ imgSrc: src.value }));
        src.addEventListener('change', () => patch({ imgSrc: src.value }));
        formEl.appendChild(src);
    }

    renderBindingSection(formEl, widget, patch, api);
    if (widget.type === 'button') {
        renderActionSection(formEl, widget, patch, api);
    }
}

/** @private */
function renderBindingSection(formEl, widget, patch, api) {
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #374151;';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:600;margin-bottom:6px;';
    h.textContent = 'Data binding';
    box.appendChild(h);

    const binding = widget.binding || null;
    box.appendChild(fieldLabel('Bind to'));
    box.appendChild(createIdSelect({
        value: binding?.source || '',
        emptyLabel: '— static (no binding) —',
        options: BINDING_SOURCE_OPTIONS,
        onChange: (v) => {
            if (!v) {
                const next = { ...widget };
                delete next.binding;
                patch(next);
                return;
            }
            patch({
                binding: v === 'variable'
                    ? { source: 'variable', name: '' }
                    : { source: 'inventoryCount', itemId: '', max: 100 }
            });
        }
    }));

    if (binding?.source === 'variable') {
        box.appendChild(fieldLabel('Variable name'));
        box.appendChild(datalistInput({
            value: binding.name || '',
            placeholder: 'score',
            listId: api.nextListId(),
            options: listVariableNameOptions(api.level),
            onChange: (v) => patch({ binding: { ...binding, name: v } })
        }));
    }

    if (binding?.source === 'inventoryCount') {
        const items = api.level?.items || [];
        box.appendChild(fieldLabel('Item'));
        box.appendChild(createIdSelect({
            value: binding.itemId || '',
            emptyLabel: '— item —',
            options: listItemOptions(items, binding.itemId ? [binding.itemId] : []),
            onChange: (v) => patch({ binding: { ...binding, itemId: v } })
        }));
    }

    if (binding && widget.type === 'progressBar') {
        box.appendChild(fieldLabel('Max (100% value)'));
        const maxIn = document.createElement('input');
        maxIn.type = 'number';
        maxIn.value = String(binding.max ?? 100);
        maxIn.style.cssText = INPUT_CSS;
        maxIn.addEventListener('change', () => {
            patch({ binding: { ...binding, max: Number(maxIn.value) || 1 } });
        });
        box.appendChild(maxIn);
    }

    formEl.appendChild(box);
}

/** @private */
function renderActionSection(formEl, widget, patch, api) {
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #374151;';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:600;margin-bottom:6px;';
    h.textContent = 'On click';
    box.appendChild(h);

    const action = widget.action || null;
    box.appendChild(fieldLabel('Action'));
    box.appendChild(createIdSelect({
        value: action?.type || '',
        emptyLabel: '— none —',
        options: [{ id: 'customEvent', label: 'Emit custom event (Event Graph OnCustomEvent)' }],
        onChange: (v) => {
            if (!v) {
                const next = { ...widget };
                delete next.action;
                patch(next);
                return;
            }
            patch({ action: { type: 'customEvent', name: '' } });
        }
    }));

    if (action?.type === 'customEvent') {
        box.appendChild(fieldLabel('Event name'));
        box.appendChild(datalistInput({
            value: action.name || '',
            placeholder: 'addScore',
            listId: api.nextListId(),
            options: listCustomEventNameOptions(api.level),
            onChange: (v) => patch({ action: { ...action, name: v } })
        }));
    }

    formEl.appendChild(box);
}
